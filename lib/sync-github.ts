import { listGitHubFiles, downloadGitHubFile, parseGitHubUrl, type GitHubTokens } from "@/lib/github";
import { uploadFileToKnowledgeBase, fileExistsInKnowledgeBase } from "@/lib/s3-sync";
import { getDataSourceByUserTypeAndUrl, updateDataSourceById } from "@/lib/data-sources";

export async function syncGitHubToS3(params: {
  userId: string;
  rootFolderUrl: string;
}): Promise<{ synced: number; skipped: number; errors: number }> {
  console.log("syncGitHubToS3 called with:", params);

  const parsed = parseGitHubUrl(params.rootFolderUrl);
  if (!parsed) {
    throw new Error(`Invalid GitHub repository URL: ${params.rootFolderUrl}`);
  }

  const { owner, repo, path, branch } = parsed;

  const dataSource = await getDataSourceByUserTypeAndUrl({
    userId: params.userId,
    dataSourceType: "GITHUB",
    rootFolderUrl: params.rootFolderUrl,
  });

  console.log("Data source found:", dataSource ? "yes" : "no");

  if (!dataSource || !dataSource.auth) {
    throw new Error("GitHub data source not found or not configured");
  }

  const auth = dataSource.auth;
  const tokens = auth.tokens as GitHubTokens;

  console.log("Tokens available:", tokens ? "yes" : "no");

  if (!tokens || !tokens.access_token) {
    throw new Error("Invalid GitHub configuration: missing tokens");
  }

  console.log("Listing GitHub files...");
  const files = await listGitHubFiles({
    tokens,
    owner,
    repo,
    path,
    branch,
  });

  console.log(`Found ${files.length} files in GitHub repository`);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of files) {
    if (!file.path) {
      continue;
    }

    try {
      const s3Key = `${params.userId}/github/${owner}/${repo}/${file.path}`;

      // Skip if already synced
      if (await fileExistsInKnowledgeBase(s3Key)) {
        skipped++;
        continue;
      }

      const { data } = await downloadGitHubFile({
        tokens,
        owner,
        repo,
        path: file.path,
        branch,
      });

      // Determine content type from file extension
      const contentType = getContentTypeFromPath(file.path);

      const repoUrl = `https://github.com/${owner}/${repo}`;
      const branchName = branch || "main"; // Fallback to main if no branch specified
      const fileUrl = `${repoUrl}/blob/${branchName}/${file.path}`;

      await uploadFileToKnowledgeBase({
        key: s3Key,
        body: data,
        contentType,
        metadata: {
          "quip-url": fileUrl,
          "source": "github",
          "owner": owner,
          "repo": repo,
          "path": file.path,
          "sha": file.sha ?? "",
        },
      });

      synced++;
    } catch (error) {
      console.error(`Failed to sync GitHub file ${file.path}`, error);
      errors++;
    }
  }

  // Update last sync time
  await updateDataSourceById(dataSource.id, {
    lastSyncTime: new Date().toISOString(),
  });

  return { synced, skipped, errors };
}

function getContentTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();

  const contentTypes: Record<string, string> = {
    // Text files
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    yml: "text/yaml",
    yaml: "text/yaml",
    xml: "application/xml",
    csv: "text/csv",

    // Code files
    js: "application/javascript",
    ts: "application/typescript",
    jsx: "application/javascript",
    tsx: "application/typescript",
    py: "text/x-python",
    java: "text/x-java-source",
    c: "text/x-c",
    cpp: "text/x-c++",
    h: "text/x-c",
    hpp: "text/x-c++",
    go: "text/x-go",
    rs: "text/rust",
    rb: "text/x-ruby",
    php: "text/x-php",
    swift: "text/x-swift",
    kt: "text/x-kotlin",

    // Web files
    html: "text/html",
    css: "text/css",
    scss: "text/x-scss",
    less: "text/x-less",

    // Config files
    env: "text/plain",
    gitignore: "text/plain",
    dockerfile: "text/plain",
    makefile: "text/plain",
  };

  return contentTypes[ext ?? ""] ?? "application/octet-stream";
}

