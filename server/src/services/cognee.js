/**
 * Cognee Service — graph-vector memory layer for CodeAtlas.
 *
 * TODO: Replace mock implementations with actual Cognee SDK calls
 * once the SDK is available. The mock implementations below maintain
 * the correct interface so the rest of the app works end-to-end.
 *
 * Cognee SDK expected usage (based on docs):
 *   import cognee from 'cognee';
 *   await cognee.add(data, datasetName);
 *   await cognee.cognify();
 *   const results = await cognee.search('INSIGHTS', { query });
 */

import GraphCache from '../models/GraphCache.js';

/**
 * In-memory graph store keyed by repoId.
 * Each entry: { nodes: Map<id, node>, edges: [] }
 *
 * TODO: Replace with Cognee SDK storage when available.
 */
const graphStore = new Map();

/**
 * Ensure a graph bucket exists for the given repoId.
 * @param {string} repoId
 */
function ensureBucket(repoId) {
  if (!graphStore.has(repoId)) {
    graphStore.set(repoId, { nodes: new Map(), edges: [] });
  }
}

/**
 * Parse a source file to extract basic structural information.
 * Extracts import statements, export statements, and function names.
 *
 * @param {string} content  - Raw file content.
 * @param {string} language - Language identifier.
 * @returns {{ imports: string[], exports: string[], functions: string[] }}
 */
function parseFileStructure(content, language) {
  const imports = [];
  const exports = [];
  const functions = [];

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Import detection
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      const match = trimmed.match(/from\s+['"]([^'"]+)['"]/);
      if (match) imports.push(match[1]);
    }
    if (trimmed.startsWith('require(') || trimmed.includes('require(')) {
      const match = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (match) imports.push(match[1]);
    }

    // Export detection
    if (trimmed.startsWith('export ')) {
      const match = trimmed.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/);
      if (match) exports.push(match[1]);
    }
    if (trimmed.startsWith('module.exports')) {
      exports.push('default');
    }

    // Function detection (JS/TS/Python/Go)
    const fnPatterns = [
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
      /^(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(/,
      /^def\s+(\w+)\s*\(/,
      /^func\s+(\w+)\s*\(/,
      /^\s*(\w+)\s*\([^)]*\)\s*\{/,
    ];

    for (const pattern of fnPatterns) {
      const match = trimmed.match(pattern);
      if (match && match[1] !== 'if' && match[1] !== 'for' && match[1] !== 'while') {
        functions.push(match[1]);
        break;
      }
    }
  }

  return { imports, exports, functions };
}

/**
 * Ingest a set of files into the Cognee graph for a repository.
 * Creates File nodes, Function nodes, and import/export edges.
 *
 * TODO: Replace with actual Cognee SDK:
 *   await cognee.add(files, `repo:${repoId}`);
 *   await cognee.cognify();
 *
 * @param {string} repoId - Unique repository identifier.
 * @param {Array<{path: string, content: string, language: string}>} files
 * @returns {Promise<{nodesCreated: number, edgesCreated: number}>}
 */
async function ingest(repoId, files) {
  try {
    ensureBucket(repoId);
    const graph = graphStore.get(repoId);
    let nodesCreated = 0;
    let edgesCreated = 0;

    for (const file of files) {
      // Create a File node
      const fileNodeId = `file:${file.path}`;
      graph.nodes.set(fileNodeId, {
        id: fileNodeId,
        name: file.path.split('/').pop(),
        type: 'File',
        filePath: file.path,
        description: `${file.language} file`,
      });
      nodesCreated++;

      // Parse structure
      const structure = parseFileStructure(file.content, file.language);

      // Create Function nodes + edges
      for (const fn of structure.functions) {
        const fnNodeId = `fn:${file.path}:${fn}`;
        graph.nodes.set(fnNodeId, {
          id: fnNodeId,
          name: fn,
          type: 'Function',
          filePath: file.path,
          description: `Function in ${file.path}`,
        });
        nodesCreated++;

        // Edge: File contains Function
        graph.edges.push({
          source: fileNodeId,
          target: fnNodeId,
          type: 'contains',
        });
        edgesCreated++;
      }

      // Create import edges
      for (const imp of structure.imports) {
        // Resolve relative imports to file paths
        const importedFileId = `file:${imp.replace(/^\.\//, '')}`;
        graph.edges.push({
          source: fileNodeId,
          target: importedFileId,
          type: 'imports',
        });
        edgesCreated++;
      }
    }

    // Detect Module nodes from directory structure
    const directories = new Set();
    for (const file of files) {
      const parts = file.path.split('/');
      if (parts.length > 1) {
        directories.add(parts.slice(0, -1).join('/'));
      }
    }

    for (const dir of directories) {
      const modNodeId = `module:${dir}`;
      if (!graph.nodes.has(modNodeId)) {
        graph.nodes.set(modNodeId, {
          id: modNodeId,
          name: dir.split('/').pop(),
          type: 'Module',
          filePath: dir,
          description: `Module directory`,
        });
        nodesCreated++;
      }

      // Link files to their parent module
      for (const file of files) {
        if (file.path.startsWith(dir + '/') && !file.path.slice(dir.length + 1).includes('/')) {
          graph.edges.push({
            source: modNodeId,
            target: `file:${file.path}`,
            type: 'contains',
          });
          edgesCreated++;
        }
      }
    }

    // Invalidate cache
    await GraphCache.deleteOne({ repoId });

    return { nodesCreated, edgesCreated };
  } catch (err) {
    console.error('❌ Cognee ingest failed:', err.message);
    throw err;
  }
}

/**
 * Semantic search over the Cognee graph for a given repository.
 *
 * TODO: Replace with actual Cognee SDK:
 *   const results = await cognee.search('INSIGHTS', {
 *     query: question,
 *     datasets: [`repo:${repoId}`]
 *   });
 *
 * @param {string} repoId   - Unique repository identifier.
 * @param {string} question  - Natural-language query.
 * @returns {Promise<{nodes: Array, rawContext: string}>}
 */
async function query(repoId, question) {
  try {
    ensureBucket(repoId);
    const graph = graphStore.get(repoId);
    const allNodes = Array.from(graph.nodes.values());

    // Simple keyword matching as a mock for Cognee's semantic search
    const keywords = question
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const matchedNodes = allNodes.filter((node) => {
      const text = `${node.name} ${node.filePath} ${node.description} ${node.type}`.toLowerCase();
      return keywords.some((kw) => text.includes(kw));
    });

    // Take top 10 matches
    const topNodes = matchedNodes.slice(0, 10);

    const rawContext = topNodes
      .map((n) => `[${n.type}] ${n.name} — ${n.filePath}: ${n.description}`)
      .join('\n');

    return { nodes: topNodes, rawContext };
  } catch (err) {
    console.error('❌ Cognee query failed:', err.message);
    throw err;
  }
}

/**
 * Get the full graph data for a repository in D3-friendly format.
 *
 * TODO: Replace with actual Cognee SDK retrieval.
 *
 * @param {string} repoId - Unique repository identifier.
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function getGraphData(repoId) {
  try {
    ensureBucket(repoId);
    const graph = graphStore.get(repoId);

    const nodes = Array.from(graph.nodes.values());
    const validNodeIds = new Set(nodes.map((n) => n.id));

    // Only include edges where both source and target exist
    const edges = graph.edges.filter(
      (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target)
    );

    return { nodes, edges };
  } catch (err) {
    console.error('❌ Cognee getGraphData failed:', err.message);
    throw err;
  }
}

/**
 * Update the Cognee graph with changes from a pull request.
 *
 * TODO: Replace with actual Cognee SDK incremental update.
 *
 * @param {string} repoId - Unique repository identifier.
 * @param {string[]} changedFiles - List of file paths changed in the PR.
 * @param {string} diff - The full PR diff string.
 * @returns {Promise<{nodesUpdated: number, nodesAdded: number}>}
 */
async function updateFromPR(repoId, changedFiles, diff) {
  try {
    ensureBucket(repoId);
    const graph = graphStore.get(repoId);
    let nodesUpdated = 0;
    let nodesAdded = 0;

    for (const filePath of changedFiles) {
      const fileNodeId = `file:${filePath}`;

      if (graph.nodes.has(fileNodeId)) {
        // Update existing node
        const node = graph.nodes.get(fileNodeId);
        node.description = `${node.description} (updated via PR)`;
        graph.nodes.set(fileNodeId, node);
        nodesUpdated++;
      } else {
        // New file — add a node
        graph.nodes.set(fileNodeId, {
          id: fileNodeId,
          name: filePath.split('/').pop(),
          type: 'File',
          filePath,
          description: 'New file added via PR',
        });
        nodesAdded++;
      }
    }

    // Invalidate cache
    await GraphCache.deleteOne({ repoId });

    return { nodesUpdated, nodesAdded };
  } catch (err) {
    console.error('❌ Cognee updateFromPR failed:', err.message);
    throw err;
  }
}

export { ingest, query, getGraphData, updateFromPR };
