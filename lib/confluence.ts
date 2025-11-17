type ConfluenceStatePayload = {
  nonce: string;
  rootFolderUrl: string;
};

export type ConfluenceTokens = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type ConfluenceAccessibleResource = {
  id: string; // cloudId
  url: string; // https://your-domain.atlassian.net
  name: string;
  scopes: string[];
  avatarUrl?: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function decodeState(state: string): ConfluenceStatePayload {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload.nonce !== "string" || typeof payload.rootFolderUrl !== "string") {
      throw new Error("Invalid state payload");
    }

    return payload;
  } catch (error) {
    console.error("Failed to decode Confluence OAuth state", error);
    throw new Error("Invalid state parameter");
  }
}

export function parseConfluenceUrl(url: string): { siteBaseUrl: string; spaceKey?: string } | null {
  try {
    const urlObj = new URL(url);
    // Expect atl. domain like https://your-domain.atlassian.net/wiki or /wiki/spaces/SPACEKEY
    const siteBaseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const spaceMatch = urlObj.pathname.match(/\/spaces\/([^/]+)/);
    const spaceKey = spaceMatch ? spaceMatch[1] : undefined;
    return { siteBaseUrl, spaceKey };
  } catch {
    return null;
  }
}

export async function exchangeConfluenceCodeForTokens(params: { code: string; redirectUri: string }) {
  const res = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: getEnv("CONFLUENCE_CLIENT_ID"),
      client_secret: getEnv("CONFLUENCE_CLIENT_SECRET"),
      code: params.code,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confluence token exchange failed: ${body}`);
  }
  return (await res.json()) as ConfluenceTokens;
}

export async function refreshConfluenceTokens(params: { refreshToken: string; redirectUri: string }) {
  const res = await fetch("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: getEnv("CONFLUENCE_CLIENT_ID"),
      client_secret: getEnv("CONFLUENCE_CLIENT_SECRET"),
      refresh_token: params.refreshToken,
      redirect_uri: params.redirectUri,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confluence token refresh failed: ${body}`);
  }
  return (await res.json()) as ConfluenceTokens;
}

export async function getAccessibleResources(accessToken: string): Promise<ConfluenceAccessibleResource[]> {
  const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to list accessible resources: ${body}`);
  }
  return (await res.json()) as ConfluenceAccessibleResource[];
}

export async function listConfluencePages(params: {
  accessToken: string;
  cloudId: string;
  spaceKey?: string;
}): Promise<Array<{ id: string; title: string; webLink: string }>> {
  const base = `https://api.atlassian.com/ex/confluence/${params.cloudId}`;
  const searchParams = new URLSearchParams({
    expand: "body.export_view,version,space,history",
    limit: "100",
    type: "page",
  });
  if (params.spaceKey) {
    searchParams.set("spaceKey", params.spaceKey);
  }
  const pages: Array<{ id: string; title: string; webLink: string }> = [];
  let start = 0;
  while (true) {
    const res = await fetch(`${base}/wiki/rest/api/content?${searchParams.toString()}&start=${start}`, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Confluence list content failed: ${body}`);
    }
    const data = (await res.json()) as {
      size: number;
      limit: number;
      start: number;
      results: Array<{
        id: string;
        title: string;
        _links?: { webui?: string; base?: string };
      }>;
    };
    for (const item of data.results) {
      const baseLink = (item as any)._links?.base;
      const webui = (item as any)._links?.webui;
      const webLink = baseLink && webui ? `${baseLink}${webui}` : "";
      pages.push({ id: item.id, title: item.title, webLink });
    }
    if (data.size < data.limit) break;
    start = data.start + data.limit;
  }
  return pages;
}

export async function getConfluencePageHtml(params: {
  accessToken: string;
  cloudId: string;
  pageId: string;
}): Promise<{ html: string; title: string; webLink?: string }> {
  const base = `https://api.atlassian.com/ex/confluence/${params.cloudId}`;
  const res = await fetch(
    `${base}/wiki/rest/api/content/${params.pageId}?expand=body.export_view,version,space,_links`,
    { headers: { Authorization: `Bearer ${params.accessToken}` } },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Confluence get content failed: ${body}`);
  }
  const data = (await res.json()) as any;
  const html = data?.body?.export_view?.value ?? "";
  const title = data?.title ?? params.pageId;
  const webLink =
    (data?._links?.base && data?._links?.webui && `${data._links.base}${data._links.webui}`) || undefined;
  return { html, title, webLink };
}
*** End Patch```}아요้assistant шудани to=functions.apply_patch_COMMENTARY code appears not valid because tool expects specific grammar; our payload ended with backticks; Need proper format no json wrapper. Let's resend correctly. We'll reissue apply_patch with the valid diff. Let's do it. 

