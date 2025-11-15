import { getServiceSupabaseClient } from "@/lib/supabase";

export type DataSourceType = "QUIP" | "ONEDRIVE" | "GOOGLE_DRIVE";

export type DataSourceRecord = {
  id: string;
  dataSourceType: DataSourceType;
  lastSyncTime: string | null;
  auth: Record<string, unknown> | null;
};

export async function recordDataSourceSync(params: {
  userId: string;
  dataSourceType: DataSourceType;
  auth: Record<string, unknown>;
  lastSyncTime?: string | null;
}): Promise<DataSourceRecord> {
  const supabase = getServiceSupabaseClient();

  const payload = {
    user_id: params.userId,
    data_source_type: params.dataSourceType,
    last_sync_time: params.lastSyncTime ?? null,
    auth: params.auth,
  };

  const { data, error } = await supabase
    .from("data_sources")
    .insert(payload)
    .select("id, data_source_type, last_sync_time, auth")
    .single();

  if (error) {
    console.error("Failed to record data source sync", {
      error,
      payload,
    });
    throw new Error("Failed to store data source metadata");
  }

  return {
    id: data.id,
    dataSourceType: data.data_source_type as DataSourceType,
    lastSyncTime: data.last_sync_time,
    auth: (data.auth ?? null) as Record<string, unknown> | null,
  };
}

export async function updateDataSourceAuthByState(
  state: string,
  update: { auth?: Record<string, unknown>; lastSyncTime?: string | null },
): Promise<void> {
  const supabase = getServiceSupabaseClient();

  const updates: Record<string, unknown> = {};

  if (typeof update.auth !== "undefined") {
    updates.auth = update.auth;
  }

  if (typeof update.lastSyncTime !== "undefined") {
    updates.last_sync_time = update.lastSyncTime;
  }

  const { error } = await supabase
    .from("data_sources")
    .update(updates)
    .eq("auth->>state", state);

  if (error) {
    console.error("Failed to update data source auth by state", { state, update, error });
    throw new Error("Failed to update data source metadata");
  }
}

