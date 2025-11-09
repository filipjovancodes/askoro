import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { S3Client } from "@aws-sdk/client-s3";

const requiredEnvVars = ["AWS_REGION", "BEDROCK_KNOWLEDGE_BASE_ID", "BEDROCK_MODEL_ARN"] as const;

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required Bedrock environment variables: ${missingEnvVars.join(", ")}`);
}

const hasStaticCredentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;

export const bedrockAgentRuntimeClient = new BedrockAgentRuntimeClient({
  region: process.env.AWS_REGION,
  credentials: hasStaticCredentials
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: hasStaticCredentials
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : undefined,
});

export const bedrockKnowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID!;
export const bedrockModelArn = process.env.BEDROCK_MODEL_ARN!;

