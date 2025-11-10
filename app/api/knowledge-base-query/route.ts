import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { queryKnowledgeBase } from "@/lib/knowledge-base";

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
    const response = await queryKnowledgeBase({ query, sessionId });

    return NextResponse.json({
      output: response.output,
      citations: response.citations ?? null,
      sessionId: response.sessionId,
      response: response.raw,
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

