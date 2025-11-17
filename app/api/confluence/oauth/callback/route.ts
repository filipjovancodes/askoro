import { NextRequest, NextResponse } from "next/server";

import { decodeState, exchangeConfluenceCodeForTokens, getAccessibleResources, parseConfluenceUrl } from "@/lib/confluence";
import { createClient } from "@/lib/supabase/server";
import { getDataSourceByUserTypeAndUrl, recordDataSourceSync, updateDataSourceById } from "@/lib/data-sources";
import { syncConfluenceToS3 } from "@/lib/sync-confluence";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    console.error("Confluence OAuth returned error", error);
    return NextResponse.redirect(new URL("/data?status=confluence_error", request.url));
  }

  if (!state || !code) {
    console.error("Missing state or code in Confluence OAuth callback");
    return NextResponse.redirect(new URL("/data?status=confluence_missing_params", request.url));
  }

  try {
    const statePayload = decodeState(state);
    const redirectUri = process.env.CONFLUENCE_REDIRECT_URI!;

    const tokens = await exchangeConfluenceCodeForTokens({ code, redirectUri });

    // Determine cloud resource info for Confluence
    const resources = await getAccessibleResources(tokens.access_token!);
    const parsed = parseConfluenceUrl(statePayload.rootFolderUrl);
    const siteMatch = resources.find((r) => parsed && r.url.startsWith(parsed.siteBaseUrl));
    const resource = siteMatch ?? resources[0];
    if (!resource) {
      throw new Error("No accessible Confluence resource found for this account");
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL("/data?status=confluence_missing_user", request.url));
    }

    const existing = await getDataSourceByUserTypeAndUrl({
      userId: user.id,
      dataSourceType: "CONFLUENCE",
      rootFolderUrl: statePayload.rootFolderUrl,
    });

    const authPayload = {
      state,
      ...statePayload,
      tokens,
      cloudId: resource.id,
      siteBaseUrl: resource.url,
      lastSyncStatus: "success",
    };

    if (!existing) {
      await recordDataSourceSync({
        userId: user.id,
        dataSourceType: "CONFLUENCE",
        auth: authPayload,
        lastSyncTime: new Date().toISOString(),
      });
    } else {
      await updateDataSourceById(existing.id, {
        auth: { ...(existing.auth ?? {}), ...authPayload },
        lastSyncTime: new Date().toISOString(),
      });
    }

    // Auto-sync in background
    try {
      await syncConfluenceToS3({
        userId: user.id,
        rootFolderUrl: statePayload.rootFolderUrl,
      });
    } catch (syncErr) {
      console.error("Failed to auto-sync Confluence after OAuth", syncErr);
      const ds = await getDataSourceByUserTypeAndUrl({
        userId: user.id,
        dataSourceType: "CONFLUENCE",
        rootFolderUrl: statePayload.rootFolderUrl,
      });
      if (ds) {
        await updateDataSourceById(ds.id, {
          auth: { ...(ds.auth ?? {}), lastSyncStatus: "failed", lastSyncMessage: "Requires Authentication" },
        });
      }
    }

    return NextResponse.redirect(new URL("/data?status=confluence_success", request.url));
  } catch (err) {
    console.error("Failed to process Confluence OAuth callback", err);
    return NextResponse.redirect(
      new URL(
        `/data?status=confluence_exchange_failed&message=${encodeURIComponent(err instanceof Error ? err.message : "Unknown error")}`,
        request.url,
      ),
    );
  }
}


