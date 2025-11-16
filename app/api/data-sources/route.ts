import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getServiceSupabaseClient } from "@/lib/supabase";
import type { DataSourceType } from "@/lib/data-sources";

type DataSourceRecord = {
  id: string;
  dataSourceType: DataSourceType;
  lastSyncTime: string | null;
  rootFolderUrl: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serviceSupabase = getServiceSupabaseClient();

  const { data, error } = await serviceSupabase
    .from("data_sources")
    .select("id, data_source_type, last_sync_time, auth")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch data sources", { userId: user.id, error });
    return NextResponse.json({ error: "Failed to fetch data sources" }, { status: 500 });
  }

  const dataSources: DataSourceRecord[] =
    data?.map((record) => {
      const auth = (record.auth ?? {}) as Record<string, unknown>;
      const rootFolderUrl = (auth.rootFolderUrl as string | undefined) ?? null;

      return {
        id: record.id,
        dataSourceType: record.data_source_type as DataSourceType,
        lastSyncTime: record.last_sync_time,
        rootFolderUrl,
      };
    }) ?? [];

  return NextResponse.json({ dataSources });
}

