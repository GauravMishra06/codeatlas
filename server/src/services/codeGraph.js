import { extractImports, extractSymbols, resolveImportPath, extractCodeSnippet } from './codeAnalyzer.js';

const EDGE_LABELS = {
  contains: 'Contains',
  imports: 'Imports',
  calls: 'Calls',
  related: 'Related',
  extends: 'Extends',
  tests: 'Tests',
};

/**
 * Build a canonical code graph: folder tree + file nodes + symbol nodes + import edges.
 *
 * @param {Array<{path: string, content: string, language: string}>} files
 * @param {string} repoId
 * @param {string} repoName
 */
function buildCodeGraph(files, repoId, repoName) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();
  const allPaths = new Set(files.map((f) => f.path));
  const fileContentMap = new Map(files.map((f) => [f.path, f.content]));

  const ensureNode = (id, node) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, node);
      nodes.push(node);
    }
    return nodeMap.get(id);
  };

  const addEdge = (source, target, type, metadata = {}) => {
    if (source === target) return;
    const exists = edges.some(
      (e) => e.source === source && e.target === target && e.type === type
    );
    if (!exists) {
      edges.push({
        source,
        target,
        type,
        label: EDGE_LABELS[type] || type,
        ...metadata,
      });
    }
  };

  const rootId = `repo:${repoId}`;
  ensureNode(rootId, {
    id: rootId,
    name: repoName,
    type: 'Module',
    filePath: '/',
    description: 'Repository root',
    source: 'github_tree',
  });

  // ── Pass 1: folder + file hierarchy ──
  for (const file of files) {
    const parts = file.path.split('/');
    let parentId = rootId;
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const folderId = `folder:${repoId}:${currentPath}`;
      ensureNode(folderId, {
        id: folderId,
        name: parts[i],
        type: 'Module',
        filePath: `${currentPath}/`,
        description: 'Folder',
        source: 'github_tree',
      });
      addEdge(parentId, folderId, 'contains');
      parentId = folderId;
    }

    const fileId = `file:${repoId}:${file.path}`;
    ensureNode(fileId, {
      id: fileId,
      name: parts[parts.length - 1],
      type: 'File',
      filePath: file.path,
      description: file.language ? `${file.language} file` : 'File',
      language: file.language,
      source: 'github_tree',
    });
    addEdge(parentId, fileId, 'contains');
  }

  // ── Pass 2: symbols, imports, test edges ──
  for (const file of files) {
    const fileId = `file:${repoId}:${file.path}`;
    const parts = file.path.split('/');

    // Symbols within file
    const symbols = extractSymbols(file.path, file.content, file.language);
    for (const sym of symbols.slice(0, 20)) {
      const symId = `sym:${repoId}:${file.path}#${sym.name}`;
      const snippet = extractCodeSnippet(file.content, sym.startLine, sym.endLine);
      ensureNode(symId, {
        id: symId,
        name: sym.name,
        type: sym.kind === 'Class' ? 'Module' : 'Function',
        filePath: file.path,
        startLine: sym.startLine,
        endLine: sym.endLine,
        signature: sym.signature,
        codeSnippet: snippet.slice(0, 800),
        description: `${sym.kind} in ${file.path}:${sym.startLine}`,
        source: 'ast',
      });
      addEdge(fileId, symId, 'contains', { line: sym.startLine });
    }

    // Import edges
    const imports = extractImports(file.path, file.content, file.language);
    for (const imp of imports) {
      const targetPath = resolveImportPath(file.path, imp, allPaths);
      if (targetPath) {
        const targetId = `file:${repoId}:${targetPath}`;
        if (nodeMap.has(targetId)) {
          addEdge(fileId, targetId, 'imports', {
            importStatement: imp,
            confidence: imp.startsWith('.') ? 1.0 : 0.7,
          });
        }
      }
    }

    // Test file heuristic
    if (/\.(test|spec)\.(js|jsx|ts|tsx)$/.test(file.path)) {
      const baseName = file.path.replace(/\.(test|spec)\.(jsx?|tsx?)$/, '');
      for (const ext of ['.js', '.jsx', '.ts', '.tsx']) {
        const srcPath = baseName + ext;
        if (allPaths.has(srcPath)) {
          addEdge(fileId, `file:${repoId}:${srcPath}`, 'tests');
        }
      }
    }
  }

  return { nodes, edges, fileContentMap };
}

/**
 * Reverse BFS from changed files to find dependents (blast radius).
 *
 * @param {{nodes: Array, edges: Array}} graph
 * @param {string[]} changedFiles
 * @param {string[]} changedFunctions
 */
function computePRImpact(graph, changedFiles, changedFunctions = []) {
  const { nodes, edges } = graph;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const nodeByFilePath = new Map(
    nodes.filter((n) => n.type === 'File' && n.filePath).map((n) => [n.filePath, n])
  );

  const changedNodeIds = new Set();
  for (const fp of changedFiles) {
    const fileNode = nodeByFilePath.get(fp);
    if (fileNode) changedNodeIds.add(fileNode.id);
  }

  for (const fn of changedFunctions) {
    const sym = nodes.find(
      (n) => n.type === 'Function' && n.name === fn && changedFiles.includes(n.filePath)
    );
    if (sym) changedNodeIds.add(sym.id);
  }

  // Build reverse adjacency (who depends on me?)
  const reverseAdj = new Map();
  for (const edge of edges) {
    if (['imports', 'calls', 'tests'].includes(edge.type)) {
      if (!reverseAdj.has(edge.target)) reverseAdj.set(edge.target, []);
      reverseAdj.get(edge.target).push({ source: edge.source, type: edge.type });
    }
  }

  const impacted = [];
  const visited = new Set(changedNodeIds);
  const queue = [...changedNodeIds].map((id) => ({ id, path: [id], depth: 0 }));

  while (queue.length > 0) {
    const { id, path, depth } = queue.shift();
    if (depth > 3) continue;

    const dependents = reverseAdj.get(id) || [];
    for (const { source, type } of dependents) {
      if (visited.has(source)) continue;
      visited.add(source);

      const sourceNode = nodeById.get(source);
      if (!sourceNode) continue;

      const relationPath = [...path, type, source];
      impacted.push({
        nodeId: source,
        name: sourceNode.name,
        filePath: sourceNode.filePath || sourceNode.name,
        type: sourceNode.type,
        relationPath: relationPath.map((p) => {
          if (typeof p === 'string' && p.includes(':')) {
            const n = nodeById.get(p);
            return n ? n.name : p;
          }
          return p;
        }),
        reason: depth === 0
          ? `Direct ${type} dependency of changed code`
          : `Transitive ${type} dependency (hop ${depth + 1})`,
        startLine: sourceNode.startLine,
        endLine: sourceNode.endLine,
      });

      queue.push({ id: source, path: relationPath, depth: depth + 1 });
    }
  }

  return {
    changedNodeIds: [...changedNodeIds],
    impactedModules: impacted.slice(0, 15),
    allAffectedNodeIds: [...visited],
  };
}

/**
 * Context coverage score for demo / onboarding.
 */
function computeContextDebt(files, graph, ingestedCount = 0) {
  const totalFiles = files.length;
  const fileNodes = graph.nodes.filter((n) => n.type === 'File').length;
  const symbolNodes = graph.nodes.filter((n) => n.type === 'Function').length;
  const importEdges = graph.edges.filter((e) => e.type === 'imports').length;

  const structureScore = totalFiles > 0 ? Math.min(100, (fileNodes / totalFiles) * 100) : 0;
  const relationScore = totalFiles > 0 ? Math.min(100, (importEdges / Math.max(totalFiles, 1)) * 50) : 0;
  const semanticScore = totalFiles > 0 ? Math.min(100, (ingestedCount / totalFiles) * 100) : 0;
  const symbolScore = totalFiles > 0 ? Math.min(100, (symbolNodes / Math.max(totalFiles * 2, 1)) * 100) : 0;

  const overall = Math.round(
    structureScore * 0.3 + relationScore * 0.3 + symbolScore * 0.2 + semanticScore * 0.2
  );

  return {
    overall,
    breakdown: {
      structure: Math.round(structureScore),
      relations: Math.round(relationScore),
      symbols: Math.round(symbolScore),
      semantic: Math.round(semanticScore),
    },
    stats: {
      totalFiles,
      fileNodes,
      symbolNodes,
      importEdges,
      ingestedCount,
    },
  };
}

/**
 * Build an onboarding tour from top-level modules.
 */
function buildOnboardingTour(graph, repoName) {
  const { nodes, edges } = graph;
  const root = nodes.find((n) => n.id.startsWith('repo:'));
  if (!root) return { title: repoName, steps: [] };

  const childModules = edges
    .filter((e) => e.source === root.id && e.type === 'contains')
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter(Boolean)
    .slice(0, 6);

  const steps = [
    {
      order: 1,
      title: 'Repository Overview',
      description: `${repoName} has ${nodes.filter((n) => n.type === 'File').length} files mapped across ${childModules.length} top-level areas.`,
      nodeIds: [root.id],
    },
  ];

  childModules.forEach((mod, i) => {
    const fileCount = edges.filter((e) => e.source === mod.id && e.type === 'contains').length;
    const importCount = edges.filter((e) => e.source === mod.id || e.target === mod.id)
      .filter((e) => e.type === 'imports').length;

    steps.push({
      order: i + 2,
      title: mod.name,
      description: `Module "${mod.name}" contains ${fileCount} direct children and ${importCount} import relationships.`,
      nodeIds: [mod.id],
      filePath: mod.filePath,
    });
  });

  const entryPoints = nodes.filter(
    (n) => n.type === 'File' && (/index\.(js|ts|tsx)$/.test(n.filePath) || /main\.(py|go|rs)$/.test(n.filePath))
  ).slice(0, 3);

  if (entryPoints.length > 0) {
    steps.push({
      order: steps.length + 1,
      title: 'Entry Points',
      description: `Start here: ${entryPoints.map((n) => n.name).join(', ')}`,
      nodeIds: entryPoints.map((n) => n.id),
    });
  }

  return { title: repoName, steps };
}

export { buildCodeGraph, computePRImpact, computeContextDebt, buildOnboardingTour, EDGE_LABELS };
