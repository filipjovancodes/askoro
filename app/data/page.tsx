"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataSourceOption = {
  value: "onedrive" | "googleDrive" | "quip" | "github" | "notion";
  label: string;
  placeholder: string;
  endpoint: string;
};

type DataSourceRecord = {
  id: string;
  dataSourceType: "QUIP" | "ONEDRIVE" | "GOOGLE_DRIVE" | "GITHUB" | "NOTION";
  rootFolderUrl: string | null;
  lastSyncTime: string | null;
  lastSyncStatus?: "failed" | "success" | null;
};

type StartSyncResponse = {
  authorizeUrl?: string;
};

const DATA_SOURCES: DataSourceOption[] = [
  {
    value: "onedrive",
    label: "OneDrive",
    placeholder: "https://onedrive.live.com/...",
    endpoint: "/api/onedrive/oauth/start",
  },
  {
    value: "googleDrive",
    label: "Google Drive",
    placeholder: "https://drive.google.com/drive/folders/...",
    endpoint: "/api/google/oauth/start",
  },
  {
    value: "quip",
    label: "Quip",
    placeholder: "https://platform.quip.com/home",
    endpoint: "/api/quip/oauth/start",
  },
  {
    value: "github",
    label: "GitHub",
    placeholder: "https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/path",
    endpoint: "/api/github/oauth/start",
  },
  {
    value: "notion",
    label: "Notion",
    placeholder: "https://www.notion.so/Page-Title-abc123...",
    endpoint: "/api/notion/oauth/start",
  },
];

function getDataSourceLabel(type: DataSourceRecord["dataSourceType"]): string {
  switch (type) {
    case "ONEDRIVE":
      return "OneDrive";
    case "GOOGLE_DRIVE":
      return "Google Drive";
    case "QUIP":
      return "Quip";
    case "GITHUB":
      return "GitHub";
    case "NOTION":
      return "Notion";
    default:
      return type;
  }
}

function getSyncEndpoint(type: DataSourceRecord["dataSourceType"]): string | null {
  switch (type) {
    case "GOOGLE_DRIVE":
      return "/api/sync/google-drive";
    case "GITHUB":
      return "/api/sync/github";
    case "NOTION":
      return "/api/sync/notion";
    case "ONEDRIVE":
    case "QUIP":
      // TODO: Add sync endpoints for OneDrive and Quip
      return null;
    default:
      return null;
  }
}

function DataSourceRow({
  dataSource,
  onSyncComplete,
  onDelete,
}: {
  dataSource: DataSourceRecord;
  onSyncComplete: () => void;
  onDelete: () => void;
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const syncEndpoint = getSyncEndpoint(dataSource.dataSourceType);

  async function handleSync() {
    if (!syncEndpoint) {
      setSyncError("Sync not available for this data source yet");
      return;
    }

    if (!dataSource.rootFolderUrl) {
      setSyncError("No folder selected for this data source. Please select a folder first.");
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      console.log("Starting sync with rootFolderUrl:", dataSource.rootFolderUrl);

      const response = await fetch(syncEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rootFolderUrl: dataSource.rootFolderUrl,
        }),
      });

      const data = await response.json();
      console.log("Sync response:", data);

      if (!response.ok) {
        const errorMsg = data.error ?? "Failed to sync data source";
        console.error("Sync failed:", errorMsg);
        throw new Error(errorMsg);
      }

      console.log("Sync completed successfully:", data);
      onSyncComplete();
    } catch (err) {
      console.error("Failed to sync data source", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to sync data source";
      setSyncError(errorMessage);
      alert(`Sync failed: ${errorMessage}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this data source? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/data-sources/${dataSource.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete data source");
      }

      onDelete();
    } catch (err) {
      console.error("Failed to delete data source", err);
      setDeleteError(err instanceof Error ? err.message : "Failed to delete data source");
      setIsDeleting(false);
    }
  }

  function formatLastSyncTime(lastSyncTime: string | null, lastSyncStatus?: "failed" | "success" | null): string {
    if (lastSyncStatus === "failed") {
      return "Failed";
    }
    if (!lastSyncTime) {
      return "Never";
    }

    const date = new Date(lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return "Just now";
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    }
  }

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 text-sm">{getDataSourceLabel(dataSource.dataSourceType)}</td>
      <td className="px-4 py-3 text-sm">
        {dataSource.rootFolderUrl ? (
          <a
            href={dataSource.rootFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate block max-w-md"
          >
            {dataSource.rootFolderUrl}
          </a>
        ) : (
          <span className="text-muted-foreground">No URL</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {formatLastSyncTime(dataSource.lastSyncTime, dataSource.lastSyncStatus)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {syncEndpoint ? (
            <div className="flex flex-col gap-1 flex-1">
              <Button
                onClick={handleSync}
                disabled={isSyncing || isDeleting}
                size="sm"
                variant="outline"
                className="w-full"
              >
                {isSyncing ? "Syncing..." : "Sync"}
              </Button>
              {syncError ? (
                <span className="text-xs text-destructive">{syncError}</span>
              ) : null}
              {deleteError ? (
                <span className="text-xs text-destructive">{deleteError}</span>
              ) : null}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Coming soon</span>
          )}
          <Button
            onClick={handleDelete}
            disabled={isDeleting || isSyncing}
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            {isDeleting ? (
              <span className="text-xs">...</span>
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function DataSourcesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [dataSources, setDataSources] = useState<DataSourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataSource, setDataSource] = useState<DataSourceOption["value"]>("onedrive");
  const [rootFolderUrl, setRootFolderUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = searchParams.get("status");
  const statusMessage = searchParams.get("message");

  useEffect(() => {
    fetchDataSources();
  }, []);

  // Refresh data sources when user returns from OAuth
  useEffect(() => {
    if (status && status.includes("success")) {
      fetchDataSources();
    }
  }, [status]);

  async function fetchDataSources() {
    try {
      const response = await fetch("/api/data-sources");
      if (!response.ok) {
        throw new Error("Failed to fetch data sources");
      }
      const data = await response.json();
      setDataSources(data.dataSources ?? []);
    } catch (err) {
      console.error("Failed to fetch data sources", err);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedSource = DATA_SOURCES.find((option) => option.value === dataSource)!;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rootFolderUrl.trim()) {
      setError("Please provide a root/home folder URL.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(selectedSource.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rootFolderUrl }),
      });

      const data = (await response.json().catch(() => ({}))) as StartSyncResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to start data source sync");
      }

      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      }
    } catch (err) {
      console.error("Failed to initiate data source sync", err);
      setError(err instanceof Error ? err.message : "Failed to start data source sync");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Knowledge Base Data Sources</h1>
        <p className="text-muted-foreground">
          Connect external data sources to ingest documents into your Amazon Bedrock knowledge base.
        </p>
      </section>

      {status && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            status === "success" || status.includes("success")
              ? "border-green-500/40 bg-green-500/10 text-green-700"
              : "border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {statusMessage ||
            (status.includes("success")
              ? "Data source connected successfully!"
              : "An unknown error occurred.")}
        </div>
      )}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left text-sm font-medium">Data Source</th>
              <th className="px-4 py-3 text-left text-sm font-medium">URL</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Last Sync</th>
              <th className="px-4 py-3 text-left text-sm font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : dataSources.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No data sources yet. Add one below.
                </td>
              </tr>
            ) : (
              dataSources.map((ds) => (
                <DataSourceRow
                  key={ds.id}
                  dataSource={ds}
                  onSyncComplete={() => fetchDataSources()}
                  onDelete={() => fetchDataSources()}
                />
              ))
            )}
            <tr className="bg-muted/30">
              <td colSpan={4} className="px-4 py-4">
                <form onSubmit={onSubmit} className="flex items-end gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-medium mb-1 block" htmlFor="data-source">
                      Data Source
                    </label>
                    <select
                      id="data-source"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      value={dataSource}
                      onChange={(event) => setDataSource(event.target.value as DataSourceOption["value"])}
                      disabled={isSubmitting}
                    >
                      {DATA_SOURCES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-xs font-medium mb-1 block" htmlFor="root-folder-url">
                      URL
                    </label>
                    <Input
                      id="root-folder-url"
                      value={rootFolderUrl}
                      onChange={(event) => setRootFolderUrl(event.target.value)}
                      placeholder={selectedSource.placeholder}
                      disabled={isSubmitting}
                      required
                      className="w-full bg-white"
                    />
                  </div>
                  <Button type="submit" disabled={isSubmitting} size="default">
                    {isSubmitting ? "Redirecting..." : "Add"}
                  </Button>
                </form>
                {error ? (
                  <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                ) : null}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}

