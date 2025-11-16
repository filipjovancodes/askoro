import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getDataSourceByUserAndType, updateDataSourceById } from "@/lib/data-sources";

const requestSchema = z.object({
  folderId: z.string().min(1, "Folder ID is required").optional(),
  folderName: z.string().optional(),
  folderUrl: z.string().url().optional(),
});

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

    // Get the Google Drive data source
    const dataSource = await getDataSourceByUserAndType({
      userId: user.id,
      dataSourceType: "GOOGLE_DRIVE",
    });

    if (!dataSource || !dataSource.auth) {
      return NextResponse.json({ error: "Google Drive data source not found" }, { status: 404 });
    }

    let rootFolderUrl: string;
    let folderName: string;

    if (parseResult.data.folderId === "all" || !parseResult.data.folderId) {
      // Sync All - use "root" as the folder ID
      rootFolderUrl = "root";
      folderName = "All Folders";
    } else {
      // Specific folder selected
      rootFolderUrl = parseResult.data.folderUrl ?? `https://drive.google.com/drive/folders/${parseResult.data.folderId}`;
      folderName = parseResult.data.folderName ?? "Selected Folder";
    }

    // Update the data source with the selected folder
    await updateDataSourceById(dataSource.id, {
      auth: {
        ...(dataSource.auth as Record<string, unknown>),
        rootFolderUrl,
        folderName,
        needsFolderSelection: false,
      },
    });

    return NextResponse.json({ success: true, rootFolderUrl, folderName });
  } catch (error) {
    console.error("Failed to select Google Drive folder", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to select folder",
      },
      { status: 500 },
    );
  }
}

