import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

import { queryKnowledgeBase } from "@/lib/knowledge-base";

type SlackMessage = {
  response_type?: "ephemeral" | "in_channel";
  text?: string;
  blocks?: Array<Record<string, unknown>>;
};

const FIVE_MINUTES_IN_SECONDS = 60 * 5;

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    console.error("Missing SLACK_SIGNING_SECRET");
    return NextResponse.json({ error: "Slack integration not configured" }, { status: 500 });
  }

  const rawBody = await request.text();

  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");

  if (!timestamp || !signature) {
    return NextResponse.json({ error: "Missing Slack signature headers" }, { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > FIVE_MINUTES_IN_SECONDS) {
    return NextResponse.json({ error: "Slack request timestamp expired" }, { status: 401 });
  }

  const sigBasestring = `v0:${timestamp}:${rawBody}`;
  const computedSignature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(sigBasestring, "utf8")
    .digest("hex")}`;

  if (!crypto.timingSafeEqual(Buffer.from(computedSignature), Buffer.from(signature))) {
    return NextResponse.json({ error: "Invalid Slack signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);

  if (params.get("ssl_check") === "1") {
    return NextResponse.json({ ok: true });
  }

  const text = params.get("text")?.trim() ?? "";
  const responseUrl = params.get("response_url");
  const userId = params.get("user_id");
  const channelId = params.get("channel_id");

  if (!text) {
    const message: SlackMessage = {
      response_type: "ephemeral",
      text: "Please provide a question after the command. Example: `/askoro How do I restore the DynamoDB backup?`",
    };

    if (responseUrl) {
      void postToSlack(responseUrl, message);
      return new NextResponse("", { status: 200 });
    }

    return NextResponse.json(message);
  }

  if (!responseUrl) {
    const result = await tryQueryKnowledgeBase(text);

    if (result?.error) {
      return NextResponse.json(
        {
          response_type: "ephemeral",
          text: `Sorry, I couldn't look up that answer: ${result.error}`,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(buildSlackMessage(result!.answerText, result!.citations, userId));
  }

  const ackMessage: SlackMessage = {
    response_type: "ephemeral",
    text: `Searching the knowledge base for “${text}”…`,
  };

  void (async () => {
    const result = await tryQueryKnowledgeBase(text);

    if (!result) {
      return;
    }

    const message = result.error
      ? {
          response_type: "ephemeral",
          text: `Sorry, I couldn't look up that answer: ${result.error}`,
        }
      : buildSlackMessage(result.answerText, result.citations, userId, channelId);

    await postToSlack(responseUrl, message);
  })();

  return NextResponse.json(ackMessage);
}

async function tryQueryKnowledgeBase(query: string): Promise<
  | {
      answerText: string;
      citations: Awaited<ReturnType<typeof queryKnowledgeBase>>["citations"];
      error?: undefined;
    }
  | { error: string }
  | undefined
> {
  try {
    const response = await queryKnowledgeBase({ query });

    return {
      answerText: response.output?.text ?? "No answer found.",
      citations: response.citations,
    };
  } catch (error) {
    console.error("Slack knowledge base query failed", error);

    return {
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function buildSlackMessage(
  answerText: string,
  citations: Awaited<ReturnType<typeof queryKnowledgeBase>>["citations"],
  userId?: string | null,
  channelId?: string | null,
): SlackMessage {
  const headerText = userId ? `<@${userId}> asked:` : "Knowledge base answer:";
  const contextParts: string[] = [];

  if (citations?.length) {
    const references = citations
      .flatMap((citation) => citation.retrievedReferences ?? [])
      .filter((ref) => ref.sourceUrl || ref.location?.s3Location?.uri)
      .map((ref) => {
        const source = ref.sourceUrl ?? ref.location?.s3Location?.uri;
        if (!source) {
          return null;
        }

        return source.startsWith("http")
          ? `<${source}|Source>`
          : `Source: ${source.replace("s3://", "")}`;
      })
      .filter((ref): ref is string => Boolean(ref));

    if (references.length) {
      contextParts.push(references.join(" • "));
    }
  }

  const blocks: SlackMessage["blocks"] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${headerText}\n>${answerText}`,
      },
    },
  ];

  if (contextParts.length) {
    blocks.push({
      type: "context",
      elements: contextParts.map((text) => ({
        type: "mrkdwn",
        text,
      })),
    });
  }

  return {
    response_type: channelId ? "in_channel" : "ephemeral",
    text: answerText,
    blocks,
  };
}

async function postToSlack(responseUrl: string, message: SlackMessage) {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Failed to send Slack response", error);
  }
}

