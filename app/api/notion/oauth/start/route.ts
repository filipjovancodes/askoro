import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid Notion workspace or page URL is required"),
});

const NOTION_AUTHORIZE_ENDPOINT = "https://api.notion.com/v1/oauth/authorize";

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
  let owner: string;

  try {
    clientId = getEnvOrThrow("NOTION_CLIENT_ID");
    redirectUri = getEnvOrThrow("NOTION_REDIRECT_URI");
    owner = process.env.NOTION_OWNER ?? "user";
  } catch (error) {
    console.error("Missing Notion OAuth configuration", error);
    return NextResponse.json({ error: "Server not configured for Notion OAuth" }, { status: 500 });
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

  const authorizeUrl = new URL(NOTION_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("owner", owner);
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}

