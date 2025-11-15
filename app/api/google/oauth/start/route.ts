import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { recordDataSourceSync } from "@/lib/data-sources";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid root folder URL is required"),
});

const GOOGLE_AUTHORIZE_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

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
    clientId = getEnvOrThrow("GOOGLE_CLIENT_ID");
    redirectUri = getEnvOrThrow("GOOGLE_REDIRECT_URI");
    scopes = process.env.GOOGLE_SCOPES ?? "https://www.googleapis.com/auth/drive.readonly";
  } catch (error) {
    console.error("Missing Google Drive OAuth configuration", error);
    return NextResponse.json({ error: "Server not configured for Google Drive OAuth" }, { status: 500 });
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

  const authorizeUrl = new URL(GOOGLE_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("access_type", "offline");
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("state", state);

  try {
    await recordDataSourceSync({
      userId: user.id,
      dataSourceType: "GOOGLE_DRIVE",
      auth: {
        state,
        rootFolderUrl: parseResult.data.rootFolderUrl,
      },
    });
  } catch (error) {
    console.error("Google Drive recordDataSourceSync failed", error);
    return NextResponse.json({ error: "Failed to persist data source metadata" }, { status: 500 });
  }

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}

