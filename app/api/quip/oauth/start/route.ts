import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";

import { recordDataSourceSync } from "@/lib/data-sources";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  rootFolderUrl: z.string().url("A valid root folder URL is required"),
});

const quipAuthorizeEndpoint = "https://platform.quip.com/1/oauth/login";

function getRequiredEnv(name: string) {
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
    clientId = getRequiredEnv("QUIP_CLIENT_ID");
    redirectUri = getRequiredEnv("QUIP_REDIRECT_URI");
    scopes = process.env.QUIP_SCOPES ?? "read-all write-all";
  } catch (error) {
    console.error("Missing Quip OAuth configuration", error);
    return NextResponse.json(
      {
        error: "Server not configured for Quip OAuth",
      },
      { status: 500 },
    );
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

  const authorizeUrl = new URL(quipAuthorizeEndpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("state", state);

  try {
    await recordDataSourceSync({
      userId: user.id,
      dataSourceType: "QUIP",
      auth: {
        state,
        rootFolderUrl: parseResult.data.rootFolderUrl,
      },
    });
  } catch (error) {
    console.error("Quip recordDataSourceSync failed", error);
    return NextResponse.json({ error: "Failed to persist data source metadata" }, { status: 500 });
  }

  return NextResponse.json({
    authorizeUrl: authorizeUrl.toString(),
    state,
    nonce,
  });
}

