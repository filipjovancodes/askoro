import {
  RetrieveAndGenerateCommand,
  type RetrieveAndGenerateCommandInput,
  type Citation,
  type RetrievedReference,
  type RetrieveAndGenerateResponse,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

import {
  bedrockAgentRuntimeClient,
  bedrockKnowledgeBaseId,
  bedrockModelArn,
  s3Client,
} from "@/lib/bedrock";

type RetrievedReferenceWithSource = RetrievedReference & {
  sourceUrl?: string | null;
};

export type CitationWithSource = Citation & {
  retrievedReferences?: RetrievedReferenceWithSource[];
};

export type KnowledgeBaseQueryResult = {
  output: RetrieveAndGenerateResponse["output"];
  citations?: CitationWithSource[];
  sessionId?: string;
  raw: RetrieveAndGenerateResponse;
};

export async function queryKnowledgeBase(input: {
  query: string;
  sessionId?: string;
}): Promise<KnowledgeBaseQueryResult> {
  const commandInput: RetrieveAndGenerateCommandInput = {
    sessionId: input.sessionId,
    input: {
      text: input.query,
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

  const citations = await enrichCitationsWithSourceUrls(response.citations);

  return {
    output: response.output,
    citations,
    sessionId: response.sessionId,
    raw: {
      ...response,
      citations,
    },
  };
}

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

          const sourceUrl = await getQuipUrlFromS3(reference.location.s3Location.uri, cache);

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

    const sourceUrl = head.Metadata?.["source-url"] ?? null;

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

