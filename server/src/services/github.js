import { Octokit } from 'octokit';

/**
 * File extensions considered "code" for ingestion purposes.
 * Non-code files (images, binaries, configs) are skipped.
 */
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs',
  '.rb', '.php', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift',
  '.kt', '.scala', '.vue', '.svelte', '.astro', '.md', '.mdx',
  '.json', '.yaml', '.yml', '.toml', '.graphql', '.gql',
  '.css', '.scss', '.less', '.html', '.sql', '.sh', '.bash',
]);

/** Maximum file size in bytes to ingest (100 KB). */
const MAX_FILE_SIZE = 100_000;

/**
 * Derive the language identifier from a file path extension.
 * @param {string} filePath - Full path to the file.
 * @returns {string} Language string for downstream processing.
 */
function getLanguage(filePath) {
  const ext = filePath.slice(filePath.lastIndexOf('.'));
  const map = {
    '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript',
    '.tsx': 'typescript', '.py': 'python', '.java': 'java',
    '.go': 'go', '.rs': 'rust', '.rb': 'ruby', '.php': 'php',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
    '.cs': 'csharp', '.swift': 'swift', '.kt': 'kotlin',
    '.scala': 'scala', '.vue': 'vue', '.svelte': 'svelte',
    '.md': 'markdown', '.json': 'json', '.yaml': 'yaml',
    '.yml': 'yaml', '.toml': 'toml', '.graphql': 'graphql',
    '.css': 'css', '.scss': 'scss', '.html': 'html',
    '.sql': 'sql', '.sh': 'shell',
  };
  return map[ext] || 'text';
}

/**
 * Fetch the full file tree of a GitHub repository recursively.
 * Filters to code files only and skips files larger than 100 KB.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo  - Repository name.
 * @param {string} accessToken - GitHub OAuth token.
 * @returns {Promise<Array<{path: string, content: string, language: string}>>}
 */
async function fetchRepoTree(owner, repo, accessToken) {
  try {
    const octokit = new Octokit({ auth: accessToken });

    // Get the recursive tree for the default branch
    const { data: refData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = refData.default_branch;

    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: 'true',
    });

    // Filter to code files under the size limit
    const codeFiles = treeData.tree.filter((item) => {
      if (item.type !== 'blob') return false;
      if (item.size && item.size > MAX_FILE_SIZE) return false;
      const ext = item.path.slice(item.path.lastIndexOf('.'));
      return CODE_EXTENSIONS.has(ext);
    });

    // Fetch content for each file (batched for performance)
    const files = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < codeFiles.length; i += BATCH_SIZE) {
      const batch = codeFiles.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const { data } = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: file.path,
              ref: defaultBranch,
            });

            // GitHub returns base64-encoded content
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return {
              path: file.path,
              content,
              language: getLanguage(file.path),
            };
          } catch {
            // Skip files that fail to fetch (permissions, encoding, etc.)
            return null;
          }
        })
      );
      files.push(...results.filter(Boolean));
    }

    return files;
  } catch (err) {
    console.error('❌ fetchRepoTree failed:', err.message);
    throw err;
  }
}

/**
 * Fetch the unified diff for a pull request.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo  - Repository name.
 * @param {number} prNumber - Pull request number.
 * @param {string} accessToken - GitHub OAuth token.
 * @returns {Promise<string>} The diff as a plain-text string.
 */
async function fetchPRDiff(owner, repo, prNumber, accessToken) {
  try {
    const octokit = new Octokit({ auth: accessToken });

    const { data } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: 'diff' },
    });

    return data;
  } catch (err) {
    console.error('❌ fetchPRDiff failed:', err.message);
    throw err;
  }
}

/**
 * Post a review comment on a GitHub pull request.
 *
 * @param {string} owner - Repository owner.
 * @param {string} repo  - Repository name.
 * @param {number} prNumber - Pull request number.
 * @param {string} body  - Markdown body of the comment.
 * @param {string} accessToken - GitHub OAuth token.
 * @returns {Promise<{success: boolean, commentUrl: string}>}
 */
async function postReviewComment(owner, repo, prNumber, body, accessToken) {
  try {
    const octokit = new Octokit({ auth: accessToken });

    const { data } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });

    return { success: true, commentUrl: data.html_url };
  } catch (err) {
    console.error('❌ postReviewComment failed:', err.message);
    throw err;
  }
}

export { fetchRepoTree, fetchPRDiff, postReviewComment };
