import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getDataSourceByUserTypeAndUrl, getDataSourceByUserAndType } from "@/lib/data-sources";
import { listGoogleDriveFolders, type GoogleTokens } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get the first Google Drive data source (we can enhance this later to handle multiple)
    const dataSource = await getDataSourceByUserAndType({
      userId: user.id,
      dataSourceType: "GOOGLE_DRIVE",
    });

    if (!dataSource || !dataSource.auth) {
      return NextResponse.json({ error: "Google Drive not authenticated" }, { status: 404 });
    }

    const auth = dataSource.auth;
    const tokens = auth.tokens as GoogleTokens;

    if (!tokens) {
      return NextResponse.json({ error: "No Google Drive tokens found" }, { status: 404 });
    }

    const folders = await listGoogleDriveFolders({ tokens });

    return NextResponse.json({ folders });
  } catch (error) {
    console.error("Failed to list Google Drive folders", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list folders",
      },
      { status: 500 },
    );
  }
}

