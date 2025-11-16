import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { syncGitHubToS3 } from "@/lib/sync-github";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const rootFolderUrl = body.rootFolderUrl as string | undefined;

    console.log("Sync request received:", { userId: user.id, rootFolderUrl });

    if (!rootFolderUrl) {
      console.error("Missing rootFolderUrl in sync request");
      return NextResponse.json({ error: "rootFolderUrl is required" }, { status: 400 });
    }

    console.log("Starting GitHub sync...");
    const result = await syncGitHubToS3({
      userId: user.id,
      rootFolderUrl,
    });

    console.log("GitHub sync completed:", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("GitHub sync failed", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync GitHub";
    console.error("Error details:", errorMessage, error);
    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

