import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCodeForTokens } from "@/lib/google-drive";
import {
  getDataSourceByUserTypeAndUrl,
  recordDataSourceSync,
  updateDataSourceById,
} from "@/lib/data-sources";
import { createClient } from "@/lib/supabase/server";
import { syncGoogleDriveToS3 } from "@/lib/sync-google-drive";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("Google OAuth returned error", error);
    return NextResponse.redirect(new URL("/data?status=google_error", request.url));
  }

  if (!state || !code) {
    console.error("Missing state or code in Google OAuth callback");
    return NextResponse.redirect(new URL("/data?status=google_missing_params", request.url));
  }

  try {
    const { tokens, statePayload } = await exchangeGoogleCodeForTokens({ code, state });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/data?status=google_missing_user", request.url));
    }

    // Insert or update data source after successful OAuth
    const existing = await getDataSourceByUserTypeAndUrl({
      userId: user.id,
      dataSourceType: "GOOGLE_DRIVE",
      rootFolderUrl: statePayload.rootFolderUrl,
    });

    if (!existing) {
      await recordDataSourceSync({
        userId: user.id,
        dataSourceType: "GOOGLE_DRIVE",
        auth: {
          state,
          ...statePayload,
          tokens,
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
          tokens,
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
          dataSourceType: "GOOGLE_DRIVE",
          rootFolderUrl: statePayload.rootFolderUrl,
        });

        if (dataSource) {
          // Trigger sync in the background (don't wait for it)
          syncGoogleDriveToS3({
            userId: user.id,
            rootFolderUrl: statePayload.rootFolderUrl,
          }).catch((error) => {
            console.error("Failed to auto-sync Google Drive after OAuth", error);
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
      console.error("Failed to trigger auto-sync after Google Drive OAuth", syncError);
      // Continue to success page even if auto-sync fails
    }

    return NextResponse.redirect(new URL("/data?status=google_success", request.url));
  } catch (err) {
    console.error("Failed to process Google OAuth callback", err);
    return NextResponse.redirect(new URL("/data?status=google_exchange_failed", request.url));
  }
}

