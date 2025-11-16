import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { deleteDataSource } from "@/lib/data-sources";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Data source ID is required" }, { status: 400 });
    }

    await deleteDataSource({
      userId: user.id,
      dataSourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete data source", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete data source",
      },
      { status: 500 },
    );
  }
}

