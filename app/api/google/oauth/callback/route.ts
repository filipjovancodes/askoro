import { NextRequest, NextResponse } from "next/server";

import { exchangeGoogleCodeForTokens } from "@/lib/google-drive";
import { updateDataSourceAuthByState } from "@/lib/data-sources";

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

    await updateDataSourceAuthByState(state, {
      auth: {
        state,
        ...statePayload,
        tokens,
      },
      lastSyncTime: new Date().toISOString(),
    });

    return NextResponse.redirect(new URL("/data?status=google_success", request.url));
  } catch (err) {
    console.error("Failed to process Google OAuth callback", err);
    return NextResponse.redirect(new URL("/data?status=google_exchange_failed", request.url));
  }
}

