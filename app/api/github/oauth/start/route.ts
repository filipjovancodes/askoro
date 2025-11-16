import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid repository URL is required"),
});

const GITHUB_AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";

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
    clientId = getEnvOrThrow("GITHUB_CLIENT_ID");
    redirectUri = getEnvOrThrow("GITHUB_REDIRECT_URI");
    scopes = process.env.GITHUB_SCOPES ?? "repo read:org";
  } catch (error) {
    console.error("Missing GitHub OAuth configuration", error);
    return NextResponse.json({ error: "Server not configured for GitHub OAuth" }, { status: 500 });
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

  const authorizeUrl = new URL(GITHUB_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}

