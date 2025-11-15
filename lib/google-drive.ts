import { OAuth2Client } from "google-auth-library";

type GoogleStatePayload = {
  nonce: string;
  rootFolderUrl: string;
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

  oauth2Client.setCredentials(tokens);

  return {
    tokens,
    statePayload,
  };
}

