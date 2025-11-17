import { getDataSourceByUserTypeAndUrl, updateDataSourceById } from "@/lib/data-sources";
import { ConfluenceTokens, getConfluencePageHtml, listConfluencePages, refreshConfluenceTokens } from "@/lib/confluence";
import { uploadFileToKnowledgeBase, fileExistsInKnowledgeBase } from "@/lib/s3-sync";

export async function syncConfluenceToS3(params: {
  userId: string;
  rootFolderUrl: string;
}): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log("syncConfluenceToS3 called with:", params);

  const dataSource = await getDataSourceByUserTypeAndUrl({
    userId: params.userId,
    dataSourceType: "CONFLUENCE",
    rootFolderUrl: params.rootFolderUrl,
  });

  if (!dataSource || !dataSource.auth) {
    throw new Error("Confluence data source not found or not configured");
  }

  let tokens = dataSource.auth.tokens as ConfluenceTokens;
  const cloudId = dataSource.auth.cloudId as string | undefined;
  const siteBaseUrl = dataSource.auth.siteBaseUrl as string | undefined;
  if (!tokens?.access_token || !cloudId || !siteBaseUrl) {
    throw new Error("Invalid Confluence configuration: missing tokens or cloud info");
  }

  // Attempt refresh if we have a refresh token and access fails
  const spaceKey = (() => {
    try {
      const url = new URL(params.rootFolderUrl);
      const match = url.pathname.match(/\/spaces\/([^/]+)/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  })();

  let pages: Array<{ id: string; title: string; webLink: string }>;

  try {
    pages = await listConfluencePages({ accessToken: tokens.access_token!, cloudId, spaceKey });
  } catch (err) {
    // Try refresh if unauthorized
    if (tokens.refresh_token) {
      try {
        const refreshed = await refreshConfluenceTokens({
          refreshToken: tokens.refresh_token!,
          redirectUri: process.env.CONFLUENCE_REDIRECT_URI!,
        });
        tokens = { ...tokens, ...refreshed };
        await updateDataSourceById(dataSource.id, {
          auth: { ...(dataSource.auth ?? {}), tokens },
        });
        pages = await listConfluencePages({ accessToken: tokens.access_token!, cloudId, spaceKey });
      } catch (refreshErr) {
        throw new Error("Requires Authentication");
      }
    } else {
      throw new Error("Requires Authentication");
    }
  }

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const page of pages) {
    try {
      const s3Key = `${params.userId}/confluence/${page.id}.html`;
      if (await fileExistsInKnowledgeBase(s3Key)) {
        skipped++;
        continue;
      }
      const { html } = await getConfluencePageHtml({
        accessToken: tokens.access_token!,
        cloudId,
        pageId: page.id,
      });
      const body = Buffer.from(html, "utf-8");
      await uploadFileToKnowledgeBase({
        key: s3Key,
        body,
        contentType: "text/html",
        metadata: {
          "quip-url": page.webLink || `${siteBaseUrl}/wiki/spaces`,
          "source": "confluence",
          "page-id": page.id,
          "page-title": page.title,
        },
      });
      synced++;
    } catch (e) {
      console.error(`Failed to sync Confluence page ${page.id}`, e);
      errors++;
    }
  }

  await updateDataSourceById(dataSource.id, {
    lastSyncTime: new Date().toISOString(),
  });

  return { synced, skipped, errors };
}


