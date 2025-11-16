import { NextRequest, NextResponse } from "next/server";

import { decodeState } from "@/lib/notion";
import {
  getDataSourceByUserTypeAndUrl,
  recordDataSourceSync,
  updateDataSourceById,
} from "@/lib/data-sources";
import { createClient } from "@/lib/supabase/server";
import { syncNotionToS3 } from "@/lib/sync-notion";

const NOTION_TOKEN_ENDPOINT = "https://api.notion.com/v1/oauth/token";

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
    console.error("Notion OAuth returned error", error);
    return NextResponse.redirect(new URL("/data?status=notion_error", request.url));
  }

  if (!state || !code) {
    console.error("Missing state or code in Notion OAuth callback");
    return NextResponse.redirect(new URL("/data?status=notion_missing_params", request.url));
  }

  try {
    const statePayload = decodeState(state);

    // Exchange code for access token
    const clientId = getEnvOrThrow("NOTION_CLIENT_ID");
    const clientSecret = getEnvOrThrow("NOTION_CLIENT_SECRET");
    const redirectUri = getEnvOrThrow("NOTION_REDIRECT_URI");

    const tokenResponse = await fetch(NOTION_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      throw new Error(
        `Failed to exchange Notion authorization code for token: ${JSON.stringify(errorData)}`,
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      token_type?: string;
      bot_id?: string;
      workspace_name?: string;
      workspace_icon?: string;
      owner?: {
        type: string;
        user?: {
          object: string;
          id: string;
          name?: string | null;
          avatar_url?: string | null;
        };
      };
      error?: string;
      error_description?: string;
    };

    if (tokenData.error) {
      throw new Error(tokenData.error_description ?? tokenData.error);
    }

    if (!tokenData.access_token) {
      throw new Error("No access token received from Notion");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/data?status=notion_missing_user", request.url));
    }

    const existing = await getDataSourceByUserTypeAndUrl({
      userId: user.id,
      dataSourceType: "NOTION",
      rootFolderUrl: statePayload.rootFolderUrl,
    });

    const authPayload = {
      state,
      ...statePayload,
      tokens: {
        access_token: tokenData.access_token,
        token_type: tokenData.token_type ?? "bearer",
        bot_id: tokenData.bot_id,
        workspace_name: tokenData.workspace_name,
        workspace_icon: tokenData.workspace_icon,
        owner: tokenData.owner,
      },
      lastSyncStatus: "success",
    };

    if (!existing) {
      await recordDataSourceSync({
        userId: user.id,
        dataSourceType: "NOTION",
        auth: authPayload,
        lastSyncTime: new Date().toISOString(),
      });
    } else {
      await updateDataSourceById(existing.id, {
        auth: {
          ...(existing.auth ?? {}),
          ...authPayload,
        },
        lastSyncTime: new Date().toISOString(),
      });
    }

    // Automatically trigger sync after successful OAuth
    try {
      if (user) {
        const dataSource = await getDataSourceByUserTypeAndUrl({
          userId: user.id,
          dataSourceType: "NOTION",
          rootFolderUrl: statePayload.rootFolderUrl,
        });

        if (dataSource) {
          // Trigger sync in the background (don't wait for it)
          syncNotionToS3({
            userId: user.id,
            rootFolderUrl: statePayload.rootFolderUrl,
          }).catch((error) => {
            console.error("Failed to auto-sync Notion after OAuth", error);
            // Mark last sync failed
            if (dataSource) {
              void updateDataSourceById(dataSource.id, {
                auth: {
                  ...(dataSource.auth ?? {}),
                  lastSyncStatus: "failed",
                },
              });
            }
            // Don't throw - we still want to redirect to success page
          });
        }
      }
    } catch (syncError) {
      console.error("Failed to trigger auto-sync after Notion OAuth", syncError);
      // Continue to success page even if auto-sync fails
    }

    return NextResponse.redirect(new URL("/data?status=notion_success", request.url));
  } catch (err) {
    console.error("Failed to process Notion OAuth callback", err);
    return NextResponse.redirect(
      new URL(
        `/data?status=notion_exchange_failed&message=${encodeURIComponent(err instanceof Error ? err.message : "Unknown error")}`,
        request.url,
      ),
    );
  }
}

