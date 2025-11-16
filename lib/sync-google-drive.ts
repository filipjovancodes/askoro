import { listGoogleDriveFiles, downloadGoogleDriveFile, type GoogleTokens } from "@/lib/google-drive";
import { uploadFileToKnowledgeBase, fileExistsInKnowledgeBase } from "@/lib/s3-sync";
import { getDataSourceByUserTypeAndUrl, updateDataSourceById } from "@/lib/data-sources";

export async function syncGoogleDriveToS3(params: {
  userId: string;
  rootFolderUrl: string;
}): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log("syncGoogleDriveToS3 called with:", params);
  
  const dataSource = await getDataSourceByUserTypeAndUrl({
    userId: params.userId,
    dataSourceType: "GOOGLE_DRIVE",
    rootFolderUrl: params.rootFolderUrl,
  });

  console.log("Data source found:", dataSource ? "yes" : "no");

  if (!dataSource || !dataSource.auth) {
    throw new Error("Google Drive data source not found or not configured");
  }

  const auth = dataSource.auth;
  const tokens = auth.tokens as GoogleTokens;

  console.log("Tokens available:", tokens ? "yes" : "no");

  if (!tokens || !params.rootFolderUrl) {
    throw new Error("Invalid Google Drive configuration: missing tokens or root folder URL");
  }

  console.log("Listing Google Drive files...");
  const files = await listGoogleDriveFiles({
    tokens,
    rootFolderUrl: params.rootFolderUrl,
  });

  console.log(`Found ${files.length} files in Google Drive`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    if (!file.id || !file.name) {
      continue;
    }

    // Skip Google Workspace files (Docs, Sheets, Slides) - they need export conversion
    if (
      file.mimeType?.startsWith("application/vnd.google-apps.") ||
      file.mimeType === "application/vnd.google-apps.folder"
    ) {
      skipped++;
      continue;
    }

    try {
      const s3Key = `${params.userId}/google-drive/${file.id}/${file.name}`;
      const webViewLink = file.webViewLink ?? null;

      // Skip if already synced
      if (await fileExistsInKnowledgeBase(s3Key)) {
        skipped++;
        continue;
      }

      const { data, mimeType, fileName } = await downloadGoogleDriveFile({
        tokens,
        fileId: file.id,
      });

      await uploadFileToKnowledgeBase({
        key: s3Key,
        body: data,
        contentType: mimeType,
        metadata: webViewLink
          ? {
              "quip-url": webViewLink,
              "source": "google-drive",
              "file-id": file.id,
            }
          : {
              "source": "google-drive",
              "file-id": file.id,
            },
      });

      synced++;
    } catch (error) {
      console.error(`Failed to sync Google Drive file ${file.id} (${file.name})`, error);
      errors++;
    }
  }

  // Update last sync time
  await updateDataSourceById(dataSource.id, {
    lastSyncTime: new Date().toISOString(),
  });

  return { synced, skipped, errors };
}
