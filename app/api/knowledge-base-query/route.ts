import { NextRequest, NextResponse } from "next/server";
import {
  RetrieveAndGenerateCommand,
  type RetrieveAndGenerateCommandInput,
  type Citation,
  type RetrievedReference,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

import {
  bedrockAgentRuntimeClient,
  bedrockKnowledgeBaseId,
  bedrockModelArn,
  s3Client,
} from "@/lib/bedrock";

const requestBodySchema = z.object({
  query: z.string().min(1, "Query is required"),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const jsonBody = await request.json().catch(() => null);

  const parseResult = requestBodySchema.safeParse(jsonBody);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { query, sessionId } = parseResult.data;

  try {
    const commandInput: RetrieveAndGenerateCommandInput = {
      sessionId,
      input: {
        text: query,
      },
      retrieveAndGenerateConfiguration: {
        type: "KNOWLEDGE_BASE",
        knowledgeBaseConfiguration: {
          knowledgeBaseId: bedrockKnowledgeBaseId,
          modelArn: bedrockModelArn,
        },
      },
    };

    const command = new RetrieveAndGenerateCommand(commandInput);

    const response = await bedrockAgentRuntimeClient.send(command);

    const citationsWithSourceUrls = await enrichCitationsWithSourceUrls(response.citations);

    return NextResponse.json({
      output: response.output,
      citations: citationsWithSourceUrls ?? null,
      sessionId: response.sessionId,
      response: {
        ...response,
        citations: citationsWithSourceUrls ?? response.citations,
      },
    });
  } catch (error) {
    console.error("Bedrock retrieveAndGenerate error", error);

    return NextResponse.json(
      {
        error: "Failed to retrieve knowledge base answer",
      },
      { status: 500 },
    );
  }
}

type RetrievedReferenceWithSource = RetrievedReference & {
  sourceUrl?: string | null;
};

type CitationWithSource = Citation & {
  retrievedReferences?: RetrievedReferenceWithSource[];
};

async function enrichCitationsWithSourceUrls(
  citations: Citation[] | undefined,
): Promise<CitationWithSource[] | undefined> {
  if (!citations?.length) {
    return citations;
  }

  const cache = new Map<string, string | null>();

  return Promise.all(
    citations.map(async (citation) => {
      if (!citation.retrievedReferences?.length) {
        return citation;
      }

      const retrievedReferences = await Promise.all(
        citation.retrievedReferences.map(async (reference) => {

          if (!reference.location?.s3Location?.uri) {
            return reference;
          }

          const sourceUrl = await getQuipUrlFromS3(reference.location?.s3Location?.uri, cache);

          return {
            ...reference,
            sourceUrl: sourceUrl ?? undefined,
          };
        }),
      );

      return {
        ...citation,
        retrievedReferences,
      };
    }),
  );
}

async function getQuipUrlFromS3(uri: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(uri)) {
    return cache.get(uri) ?? null;
  }

  const parsed = parseS3Uri(uri);

  console.log("parsed S3 URI: ", parsed);

  if (!parsed) {
    cache.set(uri, null);
    return null;
  }

  const { bucket, key } = parsed;

  try {
    const head = await s3Client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!head.Metadata?.["quip-url"]) {
      cache.set(uri, null);
      return null;
    }

    const sourceUrl = head.Metadata["quip-url"];

    cache.set(uri, sourceUrl ?? null);
    return sourceUrl ?? null;
  } catch (error) {
    console.error("Failed to fetch S3 metadata for reference", { uri, error });
    cache.set(uri, null);
    return null;
  }
}

function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  if (!uri.startsWith("s3://")) {
    return null;
  }

  const withoutScheme = uri.slice("s3://".length);
  const slashIndex = withoutScheme.indexOf("/");

  if (slashIndex === -1) {
    return null;
  }

  const bucket = withoutScheme.slice(0, slashIndex);
  const key = withoutScheme.slice(slashIndex + 1);

  if (!bucket || !key) {
    return null;
  }

  return { bucket, key };
}

