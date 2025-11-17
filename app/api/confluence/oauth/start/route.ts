import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { parseConfluenceUrl } from "@/lib/confluence";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid Confluence site or space URL is required"),
});

const ATLASSIAN_AUTHORIZE_ENDPOINT = "https://auth.atlassian.com/authorize";

function getEnvOrThrow(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parseResult = requestSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  let clientId: string;
  let redirectUri: string;
  let scopes: string;

  try {
    clientId = getEnvOrThrow("CONFLUENCE_CLIENT_ID");
    redirectUri = getEnvOrThrow("CONFLUENCE_REDIRECT_URI");
    scopes = process.env.CONFLUENCE_SCOPES ?? "read:confluence-content.all offline_access";
  } catch (error) {
    console.error("Missing Confluence OAuth configuration", error);
    return NextResponse.json({ error: "Server not configured for Confluence OAuth" }, { status: 500 });
  }

  const parsed = parseConfluenceUrl(parseResult.data.rootFolderUrl);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid Confluence URL" }, { status: 400 });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = {
    nonce,
    rootFolderUrl: parseResult.data.rootFolderUrl,
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authorizeUrl = new URL(ATLASSIAN_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("audience", "api.atlassian.com");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("prompt", "consent");

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}


