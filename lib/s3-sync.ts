import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "@/lib/bedrock";

const KNOWLEDGE_BASE_BUCKET = "filipjov-knowledge-base-app";

export async function uploadFileToKnowledgeBase(params: {
  key: string;
  body: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: KNOWLEDGE_BASE_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      Metadata: params.metadata,
    }),
  );
}

export async function fileExistsInKnowledgeBase(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: KNOWLEDGE_BASE_BUCKET,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

