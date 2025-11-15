"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DataSourceOption = {
  value: "onedrive" | "googleDrive" | "quip";
  label: string;
  placeholder: string;
  description: string;
  endpoint: string;
};

type StartSyncResponse = {
  authorizeUrl?: string;
};

const DATA_SOURCES: DataSourceOption[] = [
  {
    value: "onedrive",
    label: "OneDrive",
    placeholder: "https://onedrive.live.com/...",
    description:
      "Provide the OneDrive folder link that contains the documents you want to synchronize. We will preserve it in the OAuth state payload.",
    endpoint: "/api/onedrive/oauth/start",
  },
  {
    value: "googleDrive",
    label: "Google Drive",
    placeholder: "https://drive.google.com/drive/folders/...",
    description:
      "Provide the shared Google Drive folder link containing the documents to synchronize. We store it in the OAuth state payload so ingestion jobs know which scope to index.",
    endpoint: "/api/google/oauth/start",
  },
  {
    value: "quip",
    label: "Quip",
    placeholder: "https://platform.quip.com/home",
    description:
      "Paste the Quip folder link that contains the documents you want to synchronize. This is stored in the OAuth state payload so we can pick up the right workspace.",
    endpoint: "/api/quip/oauth/start",
  },
];

export default function DataSourcesPage() {
  const [dataSource, setDataSource] = useState<DataSourceOption["value"]>("onedrive");
  const [rootFolderUrl, setRootFolderUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Knowledge Base Data Sources</h1>
        <p className="text-muted-foreground">
          Connect enterprise content systems so Askoro can ingest documents into your Amazon Bedrock knowledge base. Begin by
          selecting a provider and providing the folder link that scopes the ingestion.
        </p>
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="data-source">
            Data source
          </label>
          <select
            id="data-source"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="root-folder-url">
            {selectedSource.label} root/home folder URL
          </label>
          <Input
            id="root-folder-url"
            value={rootFolderUrl}
            onChange={(event) => setRootFolderUrl(event.target.value)}
            placeholder={selectedSource.placeholder}
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-muted-foreground">{selectedSource.description}</p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Redirecting..." : "Sync Data"}
          </Button>
        </div>
      </form>

      <section className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="text-base font-medium">How it works</h2>
        <ol className="space-y-1 list-decimal pl-4">
          <li>Select the system you want to sync from and provide a root folder link.</li>
          <li>Click “Sync Data” to start the provider&apos;s OAuth flow and grant Askoro access.</li>
          <li>
            After authorizing, you&apos;ll return to the configured callback where we can schedule ingestion jobs for the Bedrock
            knowledge base.
          </li>
        </ol>
      </section>
    </main>
  );
}

