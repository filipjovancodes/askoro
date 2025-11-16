import {
  listNotionPages,
  retrieveNotionPageContent,
  parseNotionUrl,
  type NotionTokens,
  type NotionPage,
} from "@/lib/notion";
import { uploadFileToKnowledgeBase, fileExistsInKnowledgeBase } from "@/lib/s3-sync";
import { getDataSourceByUserTypeAndUrl, updateDataSourceById } from "@/lib/data-sources";

export async function syncNotionToS3(params: {
  userId: string;
  rootFolderUrl: string;
}): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log("syncNotionToS3 called with:", params);

  let parsed: { pageId?: string; databaseId?: string } | null = null;
  if (params.rootFolderUrl !== "all") {
    parsed = parseNotionUrl(params.rootFolderUrl);
    // If parsing fails (e.g., base Notion URL), treat as syncing all accessible pages
    // i.e., leave parsed as null to query all pages
  }

  const dataSource = await getDataSourceByUserTypeAndUrl({
    userId: params.userId,
    dataSourceType: "NOTION",
    rootFolderUrl: params.rootFolderUrl,
  });

  console.log("Data source found:", dataSource ? "yes" : "no");

  if (!dataSource || !dataSource.auth) {
    throw new Error("Notion data source not found or not configured");
  }

  const auth = dataSource.auth;
  const tokens = auth.tokens as NotionTokens;

  console.log("Tokens available:", tokens ? "yes" : "no");

  if (!tokens || !tokens.access_token) {
    throw new Error("Invalid Notion configuration: missing tokens");
  }

  console.log("Listing Notion pages...");
  const pages = await listNotionPages({
    accessToken: tokens.access_token,
    pageId: parsed?.pageId,
    databaseId: parsed?.databaseId,
  });

  console.log(`Found ${pages.length} pages in Notion`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      const s3Key = `${params.userId}/notion/${page.id}.md`;

      // Skip if already synced
      if (await fileExistsInKnowledgeBase(s3Key)) {
        skipped++;
        continue;
      }

      console.log(`Retrieving content for page: ${page.title} (${page.id})`);
      const { content } = await retrieveNotionPageContent({
        accessToken: tokens.access_token,
        pageId: page.id,
      });

      // Convert to Buffer
      const data = Buffer.from(content, "utf-8");

      await uploadFileToKnowledgeBase({
        key: s3Key,
        body: data,
        contentType: "text/markdown",
        metadata: {
          "quip-url": page.url,
          "source": "notion",
          "page-id": page.id,
          "page-title": page.title,
          "last-edited": page.last_edited_time,
        },
      });

      synced++;
    } catch (error) {
      console.error(`Failed to sync Notion page ${page.id} (${page.title})`, error);
      errors++;
    }
  }

  // Update last sync time
  await updateDataSourceById(dataSource.id, {
    lastSyncTime: new Date().toISOString(),
  });

  return { synced, skipped, errors };
}

