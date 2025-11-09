"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KnowledgeBaseResponse = {
  output?: { text?: string };
  citations?: unknown[];
  sessionId?: string;
  response?: unknown;
  error?: string;
  details?: unknown;
};

const endpoint = "/api/knowledge-base-query";

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [answer, setAnswer] = useState<KnowledgeBaseResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!query.trim()) {
      setError("Please enter a question before submitting.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnswer(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          sessionId,
        }),
      });

      const data: KnowledgeBaseResponse = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Bedrock request failed");
        setAnswer(data);
        return;
      }

      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      setAnswer(data);
    } catch (err) {
      console.error("Failed to ask knowledge base", err);
      setError("Unable to reach the knowledge base API.");
    } finally {
      setIsLoading(false);
    }
  }

  function resetSession() {
    setSessionId(undefined);
    setAnswer(null);
    setError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-12">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold">Knowledge Base Playground</h1>
        <p className="text-muted-foreground">
          Ask questions against your Amazon Bedrock knowledge base and inspect the raw response. Session IDs persist
          follow-up questions until you reset them.
        </p>
      </section>

      <form onSubmit={submitQuestion} className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Question</span>
          <Input
            value={query}
            placeholder="e.g. What are our support hours?"
            onChange={(event) => setQuery(event.target.value)}
            disabled={isLoading}
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Asking..." : "Ask"}
          </Button>

          <Button type="button" variant="secondary" onClick={resetSession} disabled={isLoading && !sessionId}>
            Reset Session
          </Button>

          {sessionId ? (
            <span className="text-xs text-muted-foreground">
              Session: <code className="font-mono">{sessionId}</code>
            </span>
          ) : null}
        </div>
      </form>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {answer ? (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Response</h2>
          <div className="rounded-md border bg-muted/30 p-4 text-sm">
            <div className="space-y-3">
              {answer.output?.text ? (
                <div>
                  <h3 className="font-medium uppercase text-muted-foreground">Answer</h3>
                  <p className="whitespace-pre-wrap">{answer.output.text}</p>
                </div>
              ) : null}

              <div>
                <h3 className="font-medium uppercase text-muted-foreground">Raw JSON</h3>
                <pre className="mt-2 max-h-96 overflow-auto rounded bg-background p-3">
                  {JSON.stringify(answer, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

