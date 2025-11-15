import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { recordDataSourceSync } from "@/lib/data-sources";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid root folder URL is required"),
});

const ONEDRIVE_AUTHORIZE_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";

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
    clientId = getEnvOrThrow("ONEDRIVE_CLIENT_ID");
    redirectUri = getEnvOrThrow("ONEDRIVE_REDIRECT_URI");
    scopes = process.env.ONEDRIVE_SCOPES ?? "offline_access Files.Read.All";
  } catch (error) {
    console.error("Missing OneDrive OAuth configuration", error);
    return NextResponse.json({ error: "Server not configured for OneDrive OAuth" }, { status: 500 });
  }

  const nonce = crypto.randomBytes(16).toString("hex");
  const statePayload = {
    nonce,
    rootFolderUrl: parseResult.data.rootFolderUrl,
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const authorizeUrl = new URL(ONEDRIVE_AUTHORIZE_ENDPOINT);
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("state", state);

  try {
    await recordDataSourceSync({
      dataSourceType: "ONEDRIVE",
      auth: {
        state,
        rootFolderUrl: parseResult.data.rootFolderUrl,
      },
    });
  } catch (error) {
    console.error("OneDrive recordDataSourceSync failed", error);
    return NextResponse.json({ error: "Failed to persist data source metadata" }, { status: 500 });
  }

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}

