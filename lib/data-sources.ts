import { getServiceSupabaseClient } from "@/lib/supabase";

export type DataSourceType = "QUIP" | "ONEDRIVE" | "GOOGLE_DRIVE" | "GITHUB" | "NOTION";

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

export async function updateDataSourceById(
  id: string,
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
    .eq("id", id);

  if (error) {
    console.error("Failed to update data source by id", { id, update, error });
    throw new Error("Failed to update data source metadata");
  }
}

export async function getDataSourceByUserAndType(params: {
  userId: string;
  dataSourceType: DataSourceType;
}): Promise<DataSourceRecord | null> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("id, data_source_type, last_sync_time, auth")
    .eq("user_id", params.userId)
    .eq("data_source_type", params.dataSourceType)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Failed to get data source", { userId: params.userId, dataSourceType: params.dataSourceType, error });
    throw new Error("Failed to retrieve data source");
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    dataSourceType: data.data_source_type as DataSourceType,
    lastSyncTime: data.last_sync_time,
    auth: (data.auth ?? null) as Record<string, unknown> | null,
  };
}

export async function getDataSourceByUserTypeAndUrl(params: {
  userId: string;
  dataSourceType: DataSourceType;
  rootFolderUrl: string;
}): Promise<DataSourceRecord | null> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from("data_sources")
    .select("id, data_source_type, last_sync_time, auth")
    .eq("user_id", params.userId)
    .eq("data_source_type", params.dataSourceType)
    .eq("auth->>rootFolderUrl", params.rootFolderUrl)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    console.error("Failed to get data source", { userId: params.userId, dataSourceType: params.dataSourceType, rootFolderUrl: params.rootFolderUrl, error });
    throw new Error("Failed to retrieve data source");
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    dataSourceType: data.data_source_type as DataSourceType,
    lastSyncTime: data.last_sync_time,
    auth: (data.auth ?? null) as Record<string, unknown> | null,
  };
}

export async function deleteDataSource(params: {
  userId: string;
  dataSourceId: string;
}): Promise<void> {
  const supabase = getServiceSupabaseClient();

  // First verify the data source belongs to the user
  const { data: existing, error: fetchError } = await supabase
    .from("data_sources")
    .select("id, user_id")
    .eq("id", params.dataSourceId)
    .single();

  if (fetchError) {
    if (fetchError.code === "PGRST116") {
      throw new Error("Data source not found");
    }
    console.error("Failed to fetch data source for deletion", { dataSourceId: params.dataSourceId, error: fetchError });
    throw new Error("Failed to verify data source");
  }

  if (!existing || existing.user_id !== params.userId) {
    throw new Error("Unauthorized: Data source does not belong to user");
  }

  const { error } = await supabase
    .from("data_sources")
    .delete()
    .eq("id", params.dataSourceId)
    .eq("user_id", params.userId);

  if (error) {
    console.error("Failed to delete data source", { dataSourceId: params.dataSourceId, userId: params.userId, error });
    throw new Error("Failed to delete data source");
  }
}

