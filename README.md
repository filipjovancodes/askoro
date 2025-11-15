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
QUIP_CLIENT_ID=<oauth-client-id>
QUIP_REDIRECT_URI=<https://yourapp.com/api/quip/oauth/callback>
QUIP_SCOPES=<optional custom scopes, defaults to "read-all write-all">
SLACK_SIGNING_SECRET=<slack-app-signing-secret>
SUPABASE_URL=<https://xyzcompany.supabase.co>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
ONEDRIVE_CLIENT_ID=<azure-app-client-id>
ONEDRIVE_REDIRECT_URI=<https://yourapp.com/api/onedrive/oauth/callback>
ONEDRIVE_SCOPES=<optional custom scopes, defaults to "offline_access Files.Read.All">
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_REDIRECT_URI=<https://yourapp.com/api/google/oauth/callback>
GOOGLE_SCOPES=<optional custom scopes, defaults to "https://www.googleapis.com/auth/drive.readonly">
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

The route forwards the query to Amazon Bedrock RetrieveAndGenerate, returning the generated answer, citations, and session metadata. Use the `sessionId` to maintain conversational continuity between requests. When a citation points to an S3 object, the API issues a `HeadObject` call to fetch custom metadata (for example `x-amz-meta-source-url`) and includes that URL in the `sourceUrl` field of each retrieved reference.

## Deployment Notes

- **Vercel:** add the environment variables in the project settings. Provide an IAM role or static credentials with permissions for `bedrock:RetrieveAndGenerate`, `s3:HeadObject` on the knowledge base bucket, and access to any external OAuth callback routes.
- **Supabase:** configure authentication hooks to require a valid Supabase session before calling the API route if desired.
- **Logging:** server-side logs will surface in Vercel for troubleshooting failed calls to Bedrock.

## Data Source Sync

Visit `/data` to pick a provider (OneDrive or Quip today), paste the root folder URL, and kick off the corresponding OAuth authorization flow. Clicking **Sync Data** calls the provider-specific endpoint (`/api/onedrive/oauth/start` or `/api/quip/oauth/start`), which constructs the authorization URL, persists the sync metadata in Supabase (`data_sources` table), and preserves the folder link in the encoded OAuth `state`. After approval, the provider redirects back to the configured callback where you can exchange the code for tokens and queue ingestion jobs.

### Supabase table

Create the `data_sources` table using `supabase/scripts/create_data_sources_table.sql`:

```bash
supabase db push --file supabase/scripts/create_data_sources_table.sql
```

The backend inserts a row each time a user initiates a sync, storing the OAuth `state` payload in the `auth` column for later reconciliation.

## Slack Bot Integration

Create a Slack app with a slash command (for example `/askoro`) that points to `POST https://yourapp.com/api/slack/command`. Copy the **Signing Secret** into `SLACK_SIGNING_SECRET`. When a user submits a command, the backend verifies the signature, acknowledges the request, queries the Bedrock knowledge base, and posts the answer (including source citations when available) back to Slack via the provided `response_url`. Responses default to `in_channel` when a channel is provided, otherwise they remain ephemeral to the requester.

## Next Steps

- Implement Supabase-authenticated front-end calls into the knowledge base route.
- Persist conversation transcripts in Supabase for analytics.
- Add streaming/partial responses if required by the product UX.
