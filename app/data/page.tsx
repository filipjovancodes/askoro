"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type StartSyncResponse = {
  authorizeUrl: string;
};

export default function DataSourcesPage() {
  const [rootFolderUrl, setRootFolderUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!rootFolderUrl.trim()) {
      setError("Please provide a Quip home/root folder URL.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/quip/oauth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rootFolderUrl }),
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error ?? "Failed to start Quip sync");
      }

      const data = (await response.json()) as StartSyncResponse;

      window.location.href = data.authorizeUrl;
    } catch (err) {
      console.error("Failed to initiate Quip sync", err);
      setError(err instanceof Error ? err.message : "Failed to start Quip sync");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Knowledge Base Data Sources</h1>
        <p className="text-muted-foreground">
          Connect a Quip workspace folder to ingest documents into your Amazon Bedrock knowledge base. Start by providing
          the root folder link and authorize Askoro to access Quip on your behalf.
        </p>
      </section>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="root-folder-url">
            Quip root/home folder URL
          </label>
          <Input
            id="root-folder-url"
            value={rootFolderUrl}
            onChange={(event) => setRootFolderUrl(event.target.value)}
            placeholder="https://platform.quip.com/home"
            disabled={isSubmitting}
            required
          />
          <p className="text-xs text-muted-foreground">
            Paste the Quip folder link that contains the documents you want to synchronize. This value is preserved in the
            OAuth state payload.
          </p>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Redirecting..." : "Sync Data"}
        </Button>
      </form>

      <section className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
        <h2 className="text-base font-medium">How it works</h2>
        <ol className="space-y-1 list-decimal pl-4">
          <li>Provide the Quip root folder link that scopes the documents to ingest.</li>
          <li>Click “Sync Data” to go through Quip OAuth authorization.</li>
          <li>
            After authorizing, Quip redirects back to the configured callback where ingestion can be queued for your Bedrock
            knowledge base.
          </li>
        </ol>
      </section>
    </main>
  );
}

