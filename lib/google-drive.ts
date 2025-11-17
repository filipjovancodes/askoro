import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

type GoogleStatePayload = {
  nonce: string;
  rootFolderUrl: string;
};

export type GoogleTokens = {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  token_type?: string | null;
  scope?: string | null;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let oauthClient: OAuth2Client | null = null;

function getOAuthClient(): OAuth2Client {
  if (oauthClient) {
    return oauthClient;
  }

  oauthClient = new OAuth2Client({
    clientId: getEnv("GOOGLE_CLIENT_ID"),
    clientSecret: getEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: getEnv("GOOGLE_REDIRECT_URI"),
  });

  return oauthClient;
}

function decodeState(state: string): GoogleStatePayload {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload.nonce !== "string" || typeof payload.rootFolderUrl !== "string") {
      throw new Error("Invalid state payload");
    }

    return payload;
  } catch (error) {
    console.error("Failed to decode Google OAuth state", error);
    throw new Error("Invalid state parameter");
  }
}

export async function exchangeGoogleCodeForTokens(params: { code: string; state: string }) {
  const oauth2Client = getOAuthClient();
  const statePayload = decodeState(params.state);

  const { tokens } = await oauth2Client.getToken({
    code: params.code,
    redirect_uri: getEnv("GOOGLE_REDIRECT_URI"),
  });

  // Convert tokens to match Credentials type (remove null from scope)
  const credentials = {
    ...tokens,
    scope: tokens.scope ?? undefined,
  };
  oauth2Client.setCredentials(credentials);

  return {
    tokens,
    statePayload,
  };
}

export async function ensureGoogleAccessToken(params: {
  tokens: GoogleTokens;
  onTokensUpdated?: (updated: GoogleTokens) => Promise<void> | void;
}): Promise<GoogleTokens> {
  const oauth2Client = getOAuthClient();
  const credentials = { ...params.tokens, scope: params.tokens.scope ?? undefined };
  oauth2Client.setCredentials(credentials);

  // Trigger refresh if needed by requesting an access token
  const res = await oauth2Client.getAccessToken();
  const newAccessToken = res?.token ?? undefined;

  const updated: GoogleTokens = {
    ...params.tokens,
    access_token: newAccessToken ?? params.tokens.access_token ?? null,
    expiry_date: oauth2Client.credentials.expiry_date ?? params.tokens.expiry_date ?? null,
    scope: (oauth2Client.credentials.scope as string | undefined) ?? params.tokens.scope ?? undefined,
    token_type: oauth2Client.credentials.token_type ?? params.tokens.token_type ?? undefined,
    refresh_token: params.tokens.refresh_token ?? oauth2Client.credentials.refresh_token ?? null,
  };

  const changed =
    updated.access_token !== params.tokens.access_token ||
    updated.expiry_date !== params.tokens.expiry_date;

  if (changed && params.onTokensUpdated) {
    await params.onTokensUpdated(updated);
  }

  return updated;
}

function createDriveClient(tokens: GoogleTokens): drive_v3.Drive {
  const oauth2Client = getOAuthClient();
  // Convert tokens to match Credentials type (remove null from scope)
  const credentials = {
    ...tokens,
    scope: tokens.scope ?? undefined,
  };
  oauth2Client.setCredentials(credentials);
  return google.drive({ version: "v3", auth: oauth2Client });
}

function extractFolderIdFromUrl(url: string): string | null {
  try {
    // If it's just a folder ID (alphanumeric, dashes, underscores), return it directly
    if (/^[a-zA-Z0-9_-]+$/.test(url.trim())) {
      return url.trim();
    }

    const urlObj = new URL(url);
    
    // Normalize the pathname by removing u/<number> patterns
    // e.g., /drive/u/0/folders/... -> /drive/folders/...
    let normalizedPath = urlObj.pathname.replace(/\/u\/\d+\//, "/");
    
    // Handle standard folder URLs:
    // - https://drive.google.com/drive/folders/FOLDER_ID
    // - https://drive.google.com/drive/u/0/folders/FOLDER_ID (normalized)
    // - https://drive.google.com/drive/u/1/folders/FOLDER_ID?usp=sharing (normalized)
    const folderMatch = normalizedPath.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folderMatch) {
      return folderMatch[1];
    }

    // Check if URL is root/home (no folder ID)
    // e.g., https://drive.google.com/drive, https://drive.google.com/drive/u/0/my-drive, etc.
    if (
      normalizedPath === "/drive" ||
      normalizedPath === "/drive/" ||
      normalizedPath.includes("/my-drive") ||
      normalizedPath.includes("/home")
    ) {
      return "root";
    }

    // Handle share links with ?id= parameter:
    // - https://drive.google.com/open?id=FOLDER_ID
    // - https://drive.google.com/drive/folders?id=FOLDER_ID
    const idParam = urlObj.searchParams.get("id");
    if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) {
      return idParam;
    }

    // Handle URLs with resourcekey parameter but check normalized pathname for folders
    // - https://drive.google.com/drive/folders/FOLDER_ID?resourcekey=...
    if (normalizedPath.includes("/folders/")) {
      const pathMatch = normalizedPath.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (pathMatch) {
        return pathMatch[1];
      }
    }

    // If no folder ID found, treat as root
    return "root";
  } catch {
    // If URL parsing fails, check if it might be just a folder ID
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      return trimmed;
    }
    // Default to root if URL parsing fails
    return "root";
  }
}

export async function listGoogleDriveFolders(params: {
  tokens: GoogleTokens;
}): Promise<drive_v3.Schema$File[]> {
  const drive = createDriveClient(params.tokens);

  const allFolders: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType, parents, webViewLink)",
      orderBy: "name",
    });

    if (response.data.files) {
      allFolders.push(...response.data.files);
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allFolders;
}

export async function listGoogleDriveFiles(params: {
  tokens: GoogleTokens;
  rootFolderUrl: string;
}): Promise<drive_v3.Schema$File[]> {
  const drive = createDriveClient(params.tokens);
  
  // Handle "root" special case for syncing all files
  let folderId: string | null;
  if (params.rootFolderUrl === "root") {
    folderId = "root";
  } else {
    folderId = extractFolderIdFromUrl(params.rootFolderUrl);
  }

  if (!folderId) {
    throw new Error(`Invalid Google Drive folder URL: ${params.rootFolderUrl}`);
  }

  const allFiles: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;

  // For root, query all files not in trash
  // For specific folders, query files in that folder
  const query = folderId === "root" 
    ? "trashed = false" 
    : `'${folderId}' in parents and trashed = false`;

  do {
    const response = await drive.files.list({
      q: query,
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, parents)",
    });

    if (response.data.files) {
      allFiles.push(...response.data.files);
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return allFiles;
}

export async function downloadGoogleDriveFile(params: {
  tokens: GoogleTokens;
  fileId: string;
}): Promise<{ data: Buffer; mimeType: string; fileName: string }> {
  const drive = createDriveClient(params.tokens);

  const fileMetadata = await drive.files.get({
    fileId: params.fileId,
    fields: "name, mimeType",
  });

  if (!fileMetadata.data.name || !fileMetadata.data.mimeType) {
    throw new Error(`Failed to get file metadata for ${params.fileId}`);
  }

  const response = await drive.files.get(
    {
      fileId: params.fileId,
      alt: "media",
    },
    {
      responseType: "arraybuffer",
    },
  );

  const data = Buffer.from(response.data as ArrayBuffer);
  const fileName = fileMetadata.data.name;
  const mimeType = fileMetadata.data.mimeType;

  return { data, mimeType, fileName };
}

