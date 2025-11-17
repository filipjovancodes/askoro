import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { syncConfluenceToS3 } from "@/lib/sync-confluence";
import { getDataSourceByUserTypeAndUrl, updateDataSourceById } from "@/lib/data-sources";

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

    console.log("Confluence sync request received:", { userId: user.id, rootFolderUrl });

    if (!rootFolderUrl) {
      console.error("Missing rootFolderUrl in Confluence sync request");
      return NextResponse.json({ error: "rootFolderUrl is required" }, { status: 400 });
    }

    console.log("Starting Confluence sync...");
    const result = await syncConfluenceToS3({
      userId: user.id,
      rootFolderUrl,
    });

    console.log("Confluence sync completed:", result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Confluence sync failed", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to sync Confluence";
    console.error("Error details:", errorMessage, error);

    try {
      const body = await request.json().catch(() => ({}));
      const rootFolderUrlInCatch = (body as any).rootFolderUrl as string | undefined;
      const dataSource = await getDataSourceByUserTypeAndUrl({
        userId: user!.id,
        dataSourceType: "CONFLUENCE",
        rootFolderUrl: rootFolderUrlInCatch ?? "",
      });
      if (dataSource) {
        await updateDataSourceById(dataSource.id, {
          auth: {
            ...(dataSource.auth ?? {}),
            lastSyncStatus: "failed",
            lastSyncMessage: "Requires Authentication",
          },
        });
      }
    } catch (e) {
      console.error("Failed to update Confluence data source after auth error", e);
    }

    return NextResponse.json(
      {
        error: "Requires Authentication",
        reauth: true,
        startEndpoint: "/api/confluence/oauth/start",
      },
      { status: 401 },
    );
  }
}


