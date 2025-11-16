import { NextRequest, NextResponse } from "next/server";

import { decodeState } from "@/lib/github";
import {
  getDataSourceByUserTypeAndUrl,
  recordDataSourceSync,
  updateDataSourceById,
} from "@/lib/data-sources";
import { createClient } from "@/lib/supabase/server";
import { syncGitHubToS3 } from "@/lib/sync-github";

const GITHUB_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";

function getEnvOrThrow(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("GitHub OAuth returned error", error);
    return NextResponse.redirect(new URL("/data?status=github_error", request.url));
  }

  if (!state || !code) {
    console.error("Missing state or code in GitHub OAuth callback");
    return NextResponse.redirect(new URL("/data?status=github_missing_params", request.url));
  }

  try {
    const statePayload = decodeState(state);

    // Exchange code for access token
    const clientId = getEnvOrThrow("GITHUB_CLIENT_ID");
    const clientSecret = getEnvOrThrow("GITHUB_CLIENT_SECRET");
    const redirectUri = getEnvOrThrow("GITHUB_REDIRECT_URI");

    const tokenResponse = await fetch(GITHUB_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange GitHub authorization code for token");
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      throw new Error(tokenData.error_description ?? tokenData.error);
    }

    if (!tokenData.access_token) {
      throw new Error("No access token received from GitHub");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/data?status=github_missing_user", request.url));
    }

    const existing = await getDataSourceByUserTypeAndUrl({
      userId: user.id,
      dataSourceType: "GITHUB",
      rootFolderUrl: statePayload.rootFolderUrl,
    });

    if (!existing) {
      await recordDataSourceSync({
        userId: user.id,
        dataSourceType: "GITHUB",
        auth: {
          state,
          ...statePayload,
          tokens: {
            access_token: tokenData.access_token,
            token_type: tokenData.token_type ?? "bearer",
            scope: tokenData.scope,
          },
          lastSyncStatus: "success",
        },
        lastSyncTime: new Date().toISOString(),
      });
    } else {
      await updateDataSourceById(existing.id, {
        auth: {
          ...(existing.auth ?? {}),
          state,
          ...statePayload,
          tokens: {
            access_token: tokenData.access_token,
            token_type: tokenData.token_type ?? "bearer",
            scope: tokenData.scope,
          },
          lastSyncStatus: "success",
        },
        lastSyncTime: new Date().toISOString(),
      });
    }

    // Automatically trigger sync after successful OAuth
    try {
      if (user && statePayload.rootFolderUrl) {
        const dataSource = await getDataSourceByUserTypeAndUrl({
          userId: user.id,
          dataSourceType: "GITHUB",
          rootFolderUrl: statePayload.rootFolderUrl,
        });

        if (dataSource) {
          // Trigger sync in the background (don't wait for it)
          syncGitHubToS3({
            userId: user.id,
            rootFolderUrl: statePayload.rootFolderUrl,
          }).catch((error) => {
            console.error("Failed to auto-sync GitHub after OAuth", error);
            // Mark last sync failed
            void updateDataSourceById(dataSource.id, {
              auth: {
                ...(dataSource.auth ?? {}),
                lastSyncStatus: "failed",
              },
            });
            // Don't throw - we still want to redirect to success page
          });
        }
      }
    } catch (syncError) {
      console.error("Failed to trigger auto-sync after GitHub OAuth", syncError);
      // Continue to success page even if auto-sync fails
    }

    return NextResponse.redirect(new URL("/data?status=github_success", request.url));
  } catch (err) {
    console.error("Failed to process GitHub OAuth callback", err);
    return NextResponse.redirect(
      new URL(
        `/data?status=github_exchange_failed&message=${encodeURIComponent(err instanceof Error ? err.message : "Unknown error")}`,
        request.url,
      ),
    );
  }
}

