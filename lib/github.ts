import { Octokit } from "@octokit/rest";
import type { Endpoints } from "@octokit/types";

type GitHubStatePayload = {
  nonce: string;
  rootFolderUrl: string;
};

export type GitHubTokens = {
  access_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
};

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createGitHubClient(tokens: GitHubTokens): Octokit {
  if (!tokens.access_token) {
    throw new Error("GitHub access token not found");
  }

  return new Octokit({
    auth: tokens.access_token,
  });
}

export function decodeState(state: string): GitHubStatePayload {
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const payload = JSON.parse(decoded);

    if (!payload || typeof payload.nonce !== "string" || typeof payload.rootFolderUrl !== "string") {
      throw new Error("Invalid state payload");
    }

    return payload;
  } catch (error) {
    console.error("Failed to decode GitHub OAuth state", error);
    throw new Error("Invalid state parameter");
  }
}

export function parseGitHubUrl(url: string): {
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
} | null {
  try {
    const urlObj = new URL(url);

    // Handle various GitHub URL formats:
    // - https://github.com/owner/repo (repo root, default branch)
    // - https://github.com/owner/repo/tree/branch (branch root)
    // - https://github.com/owner/repo/tree/branch/path/to/folder (specific path)
    // - https://github.com/owner/repo/blob/branch/path/to/file (specific file - will be handled as its directory)
    const repoMatch = urlObj.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)(?:\/(.+))?)?$/);

    if (!repoMatch) {
      return null;
    }

    const owner = repoMatch[1];
    const repo = repoMatch[2];
    const type = repoMatch[3]; // 'tree' or 'blob' or undefined
    const branchOrPath = repoMatch[4];
    const path = repoMatch[5];

    if (type === "blob" && branchOrPath && path) {
      // For blob URLs, extract the file path and get its directory
      const filePath = path;
      const dirPath = filePath.split("/").slice(0, -1).join("/");
      return {
        owner,
        repo,
        branch: branchOrPath,
        path: dirPath || undefined,
      };
    }

    if (type === "tree" && branchOrPath) {
      return {
        owner,
        repo,
        branch: branchOrPath,
        path: path?.replace(/\/$/, "") || undefined, // Remove trailing slash
      };
    }

    // Default: repo root (will use default branch)
    return { owner, repo };
  } catch {
    return null;
  }
}

export async function listGitHubFiles(params: {
  tokens: GitHubTokens;
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
}): Promise<
  Endpoints["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"]["response"]["data"]["tree"]
> {
  const octokit = createGitHubClient(params.tokens);

  try {
    // Determine which branch to use
    let branch: string;
    if (params.branch) {
      branch = params.branch;
    } else {
      // Get repository info to find default branch
      const { data: repoData } = await octokit.repos.get({
        owner: params.owner,
        repo: params.repo,
      });
      branch = repoData.default_branch;
    }

    // Get the commit SHA for the branch
    const { data: branchData } = await octokit.repos.getBranch({
      owner: params.owner,
      repo: params.repo,
      branch,
    });

    // Get the commit tree SHA
    const { data: commitData } = await octokit.git.getCommit({
      owner: params.owner,
      repo: params.repo,
      commit_sha: branchData.commit.sha,
    });

    // Get the tree recursively for the entire branch
    const { data: treeData } = await octokit.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: commitData.tree.sha,
      recursive: "1",
    });

    // Filter to only files (not directories) and ensure required properties exist
    let files = treeData.tree.filter(
      (item): item is typeof item & { path: string; mode: string; type: string; sha: string } =>
        item.type === "blob" &&
        typeof item.path === "string" &&
        typeof item.mode === "string" &&
        typeof item.sha === "string"
    );

    // If a path is specified, filter to that path
    if (params.path) {
      const pathPrefix = params.path.endsWith("/") ? params.path : `${params.path}/`;
      files = files.filter((file) => file.path.startsWith(pathPrefix));
    }

    return files;
  } catch (error) {
    console.error("Failed to list GitHub files", error);
    throw error;
  }
}

export async function downloadGitHubFile(params: {
  tokens: GitHubTokens;
  owner: string;
  repo: string;
  path: string;
  branch?: string;
}): Promise<{ data: Buffer; content: string; sha: string }> {
  const octokit = createGitHubClient(params.tokens);

  try {
    const getContentParams: Parameters<typeof octokit.repos.getContent>[0] = {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
    };

    // If branch is specified, use it as the ref
    if (params.branch) {
      getContentParams.ref = params.branch;
    }

    const { data } = await octokit.repos.getContent(getContentParams);

    if (Array.isArray(data)) {
      throw new Error("Path must point to a file, not a directory");
    }

    if (data.type !== "file") {
      throw new Error("Path must point to a file");
    }

    if (data.encoding === "base64" && data.content) {
      const buffer = Buffer.from(data.content, "base64");
      return {
        data: buffer,
        content: data.content,
        sha: data.sha,
      };
    }

    throw new Error("Unsupported file encoding");
  } catch (error) {
    console.error("Failed to download GitHub file", error);
    throw error;
  }
}

