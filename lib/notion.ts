type NotionStatePayload = {
  nonce: string;
  rootFolderUrl: string;
};

type NotionTokens = {
  access_token?: string | null;
  token_type?: string | null;
  bot_id?: string | null;
  workspace_name?: string | null;
  workspace_icon?: string | null;
  owner?: {
    type: string;
    user?: {
      object: string;
      id: string;
      name?: string | null;
      avatar_url?: string | null;
    };
  } | null;
};

type NotionPage = {
  id: string;
  url: string;
  title: string;
  last_edited_time: string;
  parent?: {
    type: string;
    page_id?: string;
    database_id?: string;
  };
};

type NotionBlock = {
  id: string;
  type: string;
  content?: string;
  has_children?: boolean;
  children?: NotionBlock[];
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function decodeState(state: string): NotionStatePayload {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload.nonce !== "string" || typeof payload.rootFolderUrl !== "string") {
      throw new Error("Invalid state payload");
    }

    return payload;
  } catch (error) {
    console.error("Failed to decode Notion OAuth state", error);
    throw new Error("Invalid state parameter");
  }
}

export function parseNotionUrl(url: string): { pageId?: string; databaseId?: string } | null {
  try {
    const urlObj = new URL(url);
    
    // Extract page ID or database ID from Notion URLs:
    // https://www.notion.so/Page-Title-abc123def456...
    // https://www.notion.so/workspace/Page-Title-abc123def456...
    // https://www.notion.so/database-id?v=...
    // IDs are 32-character hex strings, possibly with hyphens
    
    // Remove hyphens from the URL path to match IDs
    const pathWithoutHyphens = urlObj.pathname.replace(/-/g, "");
    const match = pathWithoutHyphens.match(/([a-f0-9]{32})/i);
    
    if (match) {
      // Extract the full ID with hyphens from original URL
      const fullId = extractIdFromPath(urlObj.pathname, match[1]);
      
      // Check if it's a database view URL (has ?v= parameter)
      if (urlObj.searchParams.has("v")) {
        return { databaseId: fullId };
      }
      // Otherwise, it's a page
      return { pageId: fullId };
    }

    return null;
  } catch {
    return null;
  }
}

function extractIdFromPath(pathname: string, idWithoutHyphens: string): string {
  // Notion IDs are 32 hex chars, formatted as 8-4-4-4-12
  // e.g., abc12345-def6-7890-abcd-ef1234567890
  if (idWithoutHyphens.length !== 32) {
    return idWithoutHyphens;
  }
  
  // Format as 8-4-4-4-12
  return `${idWithoutHyphens.slice(0, 8)}-${idWithoutHyphens.slice(8, 12)}-${idWithoutHyphens.slice(12, 16)}-${idWithoutHyphens.slice(16, 20)}-${idWithoutHyphens.slice(20)}`;
}

async function notionApiRequest(
  endpoint: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<unknown> {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Notion API error: ${response.status} - ${JSON.stringify(error)}`);
  }

  return response.json();
}

export async function listNotionPages(params: {
  accessToken: string;
  pageId?: string;
  databaseId?: string;
}): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];

  try {
    if (params.databaseId) {
      // Query database for pages
      const response = await notionApiRequest(
        `/databases/${params.databaseId}/query`,
        params.accessToken,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      ) as {
        results: Array<{
          id: string;
          url: string;
          properties: Record<string, unknown>;
          last_edited_time: string;
          parent: {
            type: string;
            database_id?: string;
            page_id?: string;
          };
        }>;
        next_cursor: string | null;
        has_more: boolean;
      };

      for (const page of response.results) {
        // Extract title from properties
        const titleProperty = Object.values(page.properties).find(
          (prop: any) => prop.type === "title",
        );
        const title = titleProperty
          ? (titleProperty as { title: Array<{ plain_text: string }> }).title
              .map((t) => t.plain_text)
              .join("")
          : "Untitled";

        allPages.push({
          id: page.id,
          url: page.url,
          title,
          last_edited_time: page.last_edited_time,
          parent: page.parent,
        });
      }

      // Handle pagination
      let cursor = response.next_cursor;
      while (cursor) {
        const nextResponse = await notionApiRequest(
          `/databases/${params.databaseId}/query`,
          params.accessToken,
          {
            method: "POST",
            body: JSON.stringify({ start_cursor: cursor }),
          },
        ) as typeof response;

        for (const page of nextResponse.results) {
          const titleProperty = Object.values(page.properties).find(
            (prop: any) => prop.type === "title",
          );
          const title = titleProperty
            ? (titleProperty as { title: Array<{ plain_text: string }> }).title
                .map((t) => t.plain_text)
                .join("")
            : "Untitled";

          allPages.push({
            id: page.id,
            url: page.url,
            title,
            last_edited_time: page.last_edited_time,
            parent: page.parent,
          });
        }

        cursor = nextResponse.next_cursor ?? null;
      }
    } else if (params.pageId) {
      // Start from a specific page and search for child pages
      // First, get the page itself
      const pageResponse = await notionApiRequest(`/pages/${params.pageId}`, params.accessToken) as {
        id: string;
        url: string;
        properties: Record<string, unknown>;
        last_edited_time: string;
        parent?: {
          type: string;
          page_id?: string;
          database_id?: string;
        };
      };

      const titleProperty = Object.values(pageResponse.properties).find(
        (prop: any) => prop.type === "title",
      );
      const title = titleProperty
        ? (titleProperty as { title: Array<{ plain_text: string }> }).title
            .map((t) => t.plain_text)
            .join("")
        : "Untitled";

      allPages.push({
        id: pageResponse.id,
        url: pageResponse.url,
        title,
        last_edited_time: pageResponse.last_edited_time,
        parent: pageResponse.parent,
      });

      // Use search to find child pages (Notion doesn't have a direct "list children" endpoint)
      // Note: The search API searches all accessible pages, so we'll filter by parent
      const searchResponse = await notionApiRequest(
        "/search",
        params.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            filter: {
              property: "object",
              value: "page",
            },
            sort: {
              direction: "descending",
              timestamp: "last_edited_time",
            },
          }),
        },
      ) as {
        results: Array<{
          id: string;
          url: string;
          properties: Record<string, unknown>;
          last_edited_time: string;
          parent: {
            type: string;
            page_id?: string;
            database_id?: string;
          };
        }>;
        next_cursor: string | null;
        has_more: boolean;
      };

      // Filter to only child pages of the specified page
      for (const page of searchResponse.results) {
        if (page.parent?.type === "page_id" && page.parent.page_id === params.pageId) {
          const titleProperty = Object.values(page.properties).find(
            (prop: any) => prop.type === "title",
          );
          const title = titleProperty
            ? (titleProperty as { title: Array<{ plain_text: string }> }).title
                .map((t) => t.plain_text)
                .join("")
            : "Untitled";

          allPages.push({
            id: page.id,
            url: page.url,
            title,
            last_edited_time: page.last_edited_time,
            parent: page.parent,
          });
        }
      }

      // Handle pagination for search
      let cursor = searchResponse.next_cursor;
      while (cursor) {
        const nextSearchResponse = await notionApiRequest(
          "/search",
          params.accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              start_cursor: cursor,
              filter: {
                property: "object",
                value: "page",
              },
              sort: {
                direction: "descending",
                timestamp: "last_edited_time",
              },
            }),
          },
        ) as typeof searchResponse;

        for (const page of nextSearchResponse.results) {
          if (page.parent?.type === "page_id" && page.parent.page_id === params.pageId) {
            const titleProperty = Object.values(page.properties).find(
              (prop: any) => prop.type === "title",
            );
            const title = titleProperty
              ? (titleProperty as { title: Array<{ plain_text: string }> }).title
                  .map((t) => t.plain_text)
                  .join("")
              : "Untitled";

            allPages.push({
              id: page.id,
              url: page.url,
              title,
              last_edited_time: page.last_edited_time,
              parent: page.parent,
            });
          }
        }

        cursor = nextSearchResponse.next_cursor ?? null;
      }
    } else {
      // Search all pages the integration has access to
      const searchResponse = await notionApiRequest(
        "/search",
        params.accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            filter: {
              property: "object",
              value: "page",
            },
            sort: {
              direction: "descending",
              timestamp: "last_edited_time",
            },
          }),
        },
      ) as {
        results: Array<{
          id: string;
          url: string;
          properties: Record<string, unknown>;
          last_edited_time: string;
          parent: {
            type: string;
            page_id?: string;
            database_id?: string;
          };
        }>;
        next_cursor: string | null;
        has_more: boolean;
      };

      for (const page of searchResponse.results) {
        const titleProperty = Object.values(page.properties).find(
          (prop: any) => prop.type === "title",
        );
        const title = titleProperty
          ? (titleProperty as { title: Array<{ plain_text: string }> }).title
              .map((t) => t.plain_text)
              .join("")
          : "Untitled";

        allPages.push({
          id: page.id,
          url: page.url,
          title,
          last_edited_time: page.last_edited_time,
          parent: page.parent,
        });
      }

      // Handle pagination
      let cursor = searchResponse.next_cursor;
      while (cursor) {
        const nextSearchResponse = await notionApiRequest(
          "/search",
          params.accessToken,
          {
            method: "POST",
            body: JSON.stringify({
              start_cursor: cursor,
              filter: {
                property: "object",
                value: "page",
              },
              sort: {
                direction: "descending",
                timestamp: "last_edited_time",
              },
            }),
          },
        ) as typeof searchResponse;

        for (const page of nextSearchResponse.results) {
          const titleProperty = Object.values(page.properties).find(
            (prop: any) => prop.type === "title",
          );
          const title = titleProperty
            ? (titleProperty as { title: Array<{ plain_text: string }> }).title
                .map((t) => t.plain_text)
                .join("")
            : "Untitled";

          allPages.push({
            id: page.id,
            url: page.url,
            title,
            last_edited_time: page.last_edited_time,
            parent: page.parent,
          });
        }

        cursor = nextSearchResponse.next_cursor ?? null;
      }
    }

    return allPages;
  } catch (error) {
    console.error("Failed to list Notion pages", error);
    throw error;
  }
}

export async function retrieveNotionPageContent(params: {
  accessToken: string;
  pageId: string;
}): Promise<{ content: string; blocks: NotionBlock[] }> {
  try {
    // Get page blocks
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;

    do {
      const response = await notionApiRequest(
        `/blocks/${params.pageId}/children${cursor ? `?start_cursor=${cursor}` : ""}`,
        params.accessToken,
      ) as {
        results: Array<{
          id: string;
          type: string;
          [key: string]: unknown;
        }>;
        next_cursor: string | null;
        has_more: boolean;
      };

      for (const block of response.results) {
        const blockContent = extractBlockContent(block);
        blocks.push({
          id: block.id,
          type: block.type,
          content: blockContent,
          has_children: (block as { has_children?: boolean }).has_children,
        });
      }

      cursor = response.next_cursor ?? undefined;
    } while (cursor);

    // Recursively get child blocks
    for (const block of blocks) {
      if (block.has_children) {
        block.children = await retrieveBlockChildren(params.accessToken, block.id);
      }
    }

    // Convert blocks to markdown-like text
    const content = blocksToText(blocks);

    return { content, blocks };
  } catch (error) {
    console.error("Failed to retrieve Notion page content", error);
    throw error;
  }
}

async function retrieveBlockChildren(
  accessToken: string,
  blockId: string,
): Promise<NotionBlock[]> {
  const children: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionApiRequest(
      `/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ""}`,
      accessToken,
    ) as {
      results: Array<{
        id: string;
        type: string;
        [key: string]: unknown;
      }>;
      next_cursor: string | null;
      has_more: boolean;
    };

    for (const block of response.results) {
      const blockContent = extractBlockContent(block);
      const childBlock: NotionBlock = {
        id: block.id,
        type: block.type,
        content: blockContent,
        has_children: (block as { has_children?: boolean }).has_children,
      };

      if (childBlock.has_children) {
        childBlock.children = await retrieveBlockChildren(accessToken, block.id);
      }

      children.push(childBlock);
    }

    cursor = response.next_cursor ?? undefined;
  } while (cursor);

  return children;
}

function extractBlockContent(block: { type: string; [key: string]: unknown }): string {
  const blockType = block[block.type] as Record<string, unknown> | undefined;
  if (!blockType) {
    return "";
  }

  // Extract rich_text arrays
  const richText = blockType.rich_text as Array<{ plain_text: string }> | undefined;
  if (richText && Array.isArray(richText)) {
    return richText.map((text) => text.plain_text).join("");
  }

  // Extract caption for images/videos
  const caption = blockType.caption as Array<{ plain_text: string }> | undefined;
  if (caption && Array.isArray(caption)) {
    return caption.map((text) => text.plain_text).join("");
  }

  // Extract name for to_do
  const name = blockType.name as Array<{ plain_text: string }> | undefined;
  if (name && Array.isArray(name)) {
    return name.map((text) => text.plain_text).join("");
  }

  return "";
}

function blocksToText(blocks: NotionBlock[], indent = 0): string {
  const lines: string[] = [];
  const prefix = "  ".repeat(indent);

  for (const block of blocks) {
    if (block.content) {
      switch (block.type) {
        case "heading_1":
          lines.push(`${prefix}# ${block.content}`);
          break;
        case "heading_2":
          lines.push(`${prefix}## ${block.content}`);
          break;
        case "heading_3":
          lines.push(`${prefix}### ${block.content}`);
          break;
        case "bulleted_list_item":
          lines.push(`${prefix}- ${block.content}`);
          break;
        case "numbered_list_item":
          lines.push(`${prefix}1. ${block.content}`);
          break;
        case "to_do":
          lines.push(`${prefix}- [ ] ${block.content}`);
          break;
        case "toggle":
          lines.push(`${prefix}> ${block.content}`);
          break;
        case "quote":
          lines.push(`${prefix}> ${block.content}`);
          break;
        case "callout":
          lines.push(`${prefix}> ${block.content}`);
          break;
        default:
          lines.push(`${prefix}${block.content}`);
      }
    }

    if (block.children && block.children.length > 0) {
      const childText = blocksToText(block.children, indent + 1);
      if (childText) {
        lines.push(childText);
      }
    }

    lines.push(""); // Empty line between blocks
  }

  return lines.join("\n").trim();
}

export type { NotionTokens, NotionPage };

