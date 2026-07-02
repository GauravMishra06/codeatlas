import { Octokit } from 'octokit';
import Repo from '../models/Repo.js';
import GraphCache from '../models/GraphCache.js';
import PREvent from '../models/PREvent.js';
import User from '../models/User.js';
import { fetchRepoTree } from '../services/github.js';
import * as cognee from '../services/cognee.js';

function buildRepoGraph(files, repoId, repoName) {
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const rootNode = {
    id: `repo:${repoId}`,
    name: repoName,
    type: 'Module',
    filePath: '/',
    description: 'Repository root',
  };

  nodes.push(rootNode);
  nodeMap.set(rootNode.id, rootNode);

  const ensureNode = (id, node) => {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, node);
      nodes.push(node);
    }
    return nodeMap.get(id);
  };

  const addEdge = (source, target, type = 'contains') => {
    edges.push({ source, target, type });
  };

  for (const file of files) {
    const parts = file.path.split('/');
    let parentId = rootNode.id;
    let currentPath = '';

    for (let i = 0; i < parts.length - 1; i++) {
      currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
      const folderId = `folder:${repoId}:${currentPath}`;
      const folderNode = ensureNode(folderId, {
        id: folderId,
        name: currentPath,
        type: 'Module',
        filePath: `${currentPath}/`,
        description: 'Folder',
      });

      if (!edges.some((edge) => edge.source === parentId && edge.target === folderNode.id)) {
        addEdge(parentId, folderNode.id);
      }

      parentId = folderNode.id;
    }

    const fileId = `file:${repoId}:${file.path}`;
    const fileNode = ensureNode(fileId, {
      id: fileId,
      name: parts[parts.length - 1],
      type: 'File',
      filePath: file.path,
      description: file.language ? `${file.language} file` : 'File',
    });

    if (!edges.some((edge) => edge.source === parentId && edge.target === fileNode.id)) {
      addEdge(parentId, fileNode.id);
    }
  }

  return { nodes, edges };
}

/**
 * List all repositories connected by the current user.
 *
 * @route GET /api/repos
 */
async function listRepos(req, res) {
  try {
    const repos = await Repo.find({ userId: req.userId })
      .select('name fullName isIngested nodeCount lastAnalyzed repoId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      repos: repos.map((r) => ({
        id: r._id,
        repoId: r.repoId,
        name: r.name,
        fullName: r.fullName,
        isIngested: r.isIngested,
        nodeCount: r.nodeCount,
        lastAnalyzed: r.lastAnalyzed,
      })),
    });
  } catch (err) {
    console.error('❌ listRepos failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch repositories' });
  }
}

/**
 * Connect a new GitHub repository.
 * Fetches repo metadata from GitHub, saves it to MongoDB,
 * and triggers the async ingestion pipeline.
 *
 * @route POST /api/repos/connect
 * @body {{ repoFullName: string }}
 */
async function connectRepo(req, res) {
  try {
    const { repoFullName } = req.body;

    if (!repoFullName || !repoFullName.includes('/')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid repo name. Use format: owner/reponame',
      });
    }

    const [owner, repoName] = repoFullName.split('/');

    // Get user's access token
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    // Fetch repo details from GitHub
    const octokit = new Octokit({ auth: user.accessToken });
    const { data: ghRepo } = await octokit.rest.repos.get({
      owner,
      repo: repoName,
    });

    // Upsert in MongoDB
    const repo = await Repo.findOneAndUpdate(
      { repoId: String(ghRepo.id) },
      {
        userId: req.userId,
        repoId: String(ghRepo.id),
        fullName: ghRepo.full_name,
        name: ghRepo.name,
        description: ghRepo.description || '',
      },
      { upsert: true, new: true }
    );

    // Respond immediately — ingestion runs in the background
    res.json({
      success: true,
      repo: {
        id: repo._id,
        repoId: repo.repoId,
        name: repo.name,
        fullName: repo.fullName,
      },
    });

    // Trigger async ingestion (fire-and-forget)
    runIngestion(owner, repoName, user.accessToken, repo).catch((err) => {
      console.error('❌ Background ingestion failed:', err.message);
    });
  } catch (err) {
    console.error('❌ connectRepo failed:', err.message);

    if (err.status === 404) {
      return res.status(404).json({ success: false, error: 'Repository not found on GitHub' });
    }

    res.status(500).json({ success: false, error: 'Failed to connect repository' });
  }
}

/**
 * Background ingestion pipeline.
 * Fetches all code files, builds the repository graph cache, ingests them into Cognee,
 * and updates the repo record.
 *
 * @param {string} owner - Repo owner.
 * @param {string} repoName - Repo name.
 * @param {string} accessToken - GitHub access token.
 * @param {object} repo - Mongoose Repo document.
 */
async function runIngestion(owner, repoName, accessToken, repo) {
  try {
    console.log(`📦 Starting ingestion for ${owner}/${repoName}...`);

    // Fetch all code files from GitHub
    const files = await fetchRepoTree(owner, repoName, accessToken);
    console.log(`📄 Fetched ${files.length} files from ${owner}/${repoName}`);

    const graphData = buildRepoGraph(files, repo.repoId, repo.fullName || repo.name);
    await GraphCache.findOneAndUpdate(
      { repoId: repo.repoId },
      { repoId: repo.repoId, nodes: graphData.nodes, edges: graphData.edges, updatedAt: new Date() },
      { upsert: true }
    );

    // Ingest into Cognee
    const result = await cognee.ingest(repo.repoId, files);
    console.log(`🧠 Ingested: ${result.nodesCreated} nodes, ${result.edgesCreated} edges`);

    // Update repo record
    await Repo.findByIdAndUpdate(repo._id, {
      isIngested: true,
      nodeCount: result.nodesCreated,
      lastAnalyzed: new Date(),
    });

    // Emit socket event if io is available
    const io = global.__io;
    if (io) {
      io.to(`repo:${repo.repoId}`).emit('repo:ingested', {
        repoId: repo.repoId,
        nodeCount: result.nodesCreated,
      });
    }

    console.log(`✅ Ingestion complete for ${owner}/${repoName}`);
  } catch (err) {
    console.error(`❌ Ingestion failed for ${owner}/${repoName}:`, err.message);
  }
}

/**
 * Get the graph data for a repository.
 * Returns cached data if available, otherwise rebuilds it from the GitHub tree.
 *
 * @route GET /api/repos/:id/graph
 */
async function getGraph(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    // Check cache first
    const cached = await GraphCache.findOne({ repoId: repo.repoId });
    const hasRenderableNodes = cached
      && Array.isArray(cached.nodes)
      && cached.nodes.length > 1
      && cached.nodes.some((node) => node.type === 'File');

    if (hasRenderableNodes) {
      return res.json({
        success: true,
        nodes: cached.nodes,
        edges: cached.edges,
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const [owner, repoName] = repo.fullName.split('/');
    const files = await fetchRepoTree(owner, repoName, user.accessToken);
    const graphData = buildRepoGraph(files, repo.repoId, repo.fullName);

    // Save to cache
    await GraphCache.findOneAndUpdate(
      { repoId: repo.repoId },
      {
        repoId: repo.repoId,
        nodes: graphData.nodes,
        edges: graphData.edges,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    res.json({
      success: true,
      nodes: graphData.nodes,
      edges: graphData.edges,
    });
  } catch (err) {
    console.error('❌ getGraph failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch graph data' });
  }
}

/**
 * List all PR events for a repository.
 *
 * @route GET /api/repos/:id/prs
 */
async function listPRs(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const prs = await PREvent.find({ repoId: repo.repoId })
      .select('-diff')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      prs: prs.map((pr) => ({
        id: pr._id,
        prNumber: pr.prNumber,
        title: pr.title,
        author: pr.author,
        changedFiles: pr.changedFiles,
        impactedModules: pr.impactedModules,
        review: pr.review,
        status: pr.status,
        createdAt: pr.createdAt,
      })),
    });
  } catch (err) {
    console.error('❌ listPRs failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch PRs' });
  }
}

/**
 * Delete a connected repository.
 *
 * @route DELETE /api/repos/:id
 */
async function deleteRepo(req, res) {
  try {
    const repo = await Repo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    // Clean up related data
    await GraphCache.deleteOne({ repoId: repo.repoId });
    await PREvent.deleteMany({ repoId: repo.repoId });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ deleteRepo failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete repository' });
  }
}

export { listRepos, connectRepo, getGraph, listPRs, deleteRepo };
