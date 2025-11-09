## Overview

This project is a Next.js application that integrates with Amazon Bedrock Knowledge Bases to provide retrieval-augmented generation (RAG) answers. The backend is exposed via an App Router API route that proxies requests to the Bedrock **RetrieveAndGenerate** API. The frontend can be deployed on Vercel, while Supabase can be used for authentication or persistence needs.

## Requirements

- Node.js 18+
- AWS account with access to Amazon Bedrock Knowledge Bases
- A provisioned knowledge base and associated model ARN

## Environment Variables

Configure the following variables in `.env.local` (and in your Vercel/Supabase project settings):

```
AWS_REGION=<aws-region>
AWS_ACCESS_KEY_ID=<optional-static-access-key>
AWS_SECRET_ACCESS_KEY=<optional-static-secret-key>
BEDROCK_KNOWLEDGE_BASE_ID=<knowledge-base-id>
BEDROCK_MODEL_ARN=<arn:aws:bedrock:...:foundation-model/...>
```

Static AWS credentials are optional if you rely on an execution role (for example, when running on Vercel with IAM roles for service accounts).

## Installation

```bash
npm install
```

## Running Locally

```bash
npm run dev
```

Navigate to `http://localhost:3000` in your browser.

## Knowledge Base API Route

The backend lives at `app/api/knowledge-base-query/route.ts`. It accepts `POST` requests with:

```json
{
  "query": "How do I authenticate?",
  "sessionId": "optional-session-id"
}
```

The route forwards the query to Amazon Bedrock RetrieveAndGenerate, returning the generated answer, citations, and session metadata. Use the `sessionId` to maintain conversational continuity between requests. When a citation points to an S3 object, the API issues a `HeadObject` call to fetch custom metadata (for example `x-amz-meta-quip-url`) and includes that URL in the `sourceUrl` field of each retrieved reference.

## Deployment Notes

- **Vercel:** add the environment variables in the project settings. Provide an IAM role or static credentials with permissions for `bedrock:RetrieveAndGenerate` and `s3:HeadObject` on the knowledge base bucket.
- **Supabase:** configure authentication hooks to require a valid Supabase session before calling the API route if desired.
- **Logging:** server-side logs will surface in Vercel for troubleshooting failed calls to Bedrock.

## Next Steps

- Implement Supabase-authenticated front-end calls into the knowledge base route.
- Persist conversation transcripts in Supabase for analytics.
- Add streaming/partial responses if required by the product UX.
