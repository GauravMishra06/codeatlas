import { Octokit } from 'octokit';
import Repo from '../models/Repo.js';
import GraphCache from '../models/GraphCache.js';
import PREvent from '../models/PREvent.js';
import User from '../models/User.js';
import { fetchRepoTree } from '../services/github.js';
import * as cognee from '../services/cognee.js';
import {
  buildCodeGraph,
  computeContextDebt,
  buildOnboardingTour,
} from '../services/codeGraph.js';

/**
 * Emit socket events to both GitHub repoId and MongoDB _id rooms.
 */
function emitToRepo(io, repo, event, payload) {
  if (!io || !repo) return;
  io.to(`repo:${repo.repoId}`).emit(event, payload);
  io.to(`repo:${repo._id}`).emit(event, payload);
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
 *
 * @route POST /api/repos/connect
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

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    const octokit = new Octokit({ auth: user.accessToken });
    const { data: ghRepo } = await octokit.rest.repos.get({ owner, repo: repoName });

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

    res.json({
      success: true,
      repo: {
        id: repo._id,
        repoId: repo.repoId,
        name: repo.name,
        fullName: repo.fullName,
      },
    });

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
 * Background ingestion: build canonical code graph + Cognee semantic layer.
 */
async function runIngestion(owner, repoName, accessToken, repo) {
  try {
    console.log(`📦 Starting ingestion for ${owner}/${repoName}...`);

    const files = await fetchRepoTree(owner, repoName, accessToken);
    console.log(`📄 Fetched ${files.length} files from ${owner}/${repoName}`);

    const graphData = buildCodeGraph(files, repo.repoId, repo.fullName || repo.name);
    const contextDebt = computeContextDebt(files, graphData, 0);

    await GraphCache.findOneAndUpdate(
      { repoId: repo.repoId },
      {
        repoId: repo.repoId,
        nodes: graphData.nodes,
        edges: graphData.edges,
        contextDebt,
        updatedAt: new Date(),
      },
      { upsert: true }
    );

    const result = await cognee.ingest(repo.repoId, files, { preserveGraphCache: true });
    console.log(`🧠 Cognee ingested: ${result.nodesCreated} files`);

    const updatedDebt = computeContextDebt(files, graphData, result.nodesCreated);

    await GraphCache.findOneAndUpdate(
      { repoId: repo.repoId },
      { contextDebt: updatedDebt, updatedAt: new Date() }
    );

    await Repo.findByIdAndUpdate(repo._id, {
      isIngested: true,
      nodeCount: graphData.nodes.length,
      lastAnalyzed: new Date(),
    });

    const io = global.__io;
    emitToRepo(io, repo, 'repo:ingested', {
      repoId: repo.repoId,
      mongoId: repo._id,
      nodeCount: graphData.nodes.length,
      contextDebt: updatedDebt.overall,
    });

    console.log(`✅ Ingestion complete for ${owner}/${repoName}`);
  } catch (err) {
    console.error(`❌ Ingestion failed for ${owner}/${repoName}:`, err.message);
  }
}

/**
 * Get graph data with optional relation filter.
 *
 * @route GET /api/repos/:id/graph
 * @query relations - comma-separated edge types (contains,imports,tests)
 */
async function getGraph(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const relationFilter = req.query.relations
      ? req.query.relations.split(',').map((r) => r.trim())
      : null;

    const cached = await GraphCache.findOne({ repoId: repo.repoId });
    const hasRenderableNodes = cached
      && Array.isArray(cached.nodes)
      && cached.nodes.length > 1
      && cached.nodes.some((node) => node.type === 'File');

    let nodes = cached?.nodes || [];
    let edges = cached?.edges || [];
    let contextDebt = cached?.contextDebt || null;

    if (!hasRenderableNodes) {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(401).json({ success: false, error: 'User not found' });
      }

      const [owner, repoName] = repo.fullName.split('/');
      const files = await fetchRepoTree(owner, repoName, user.accessToken);
      const graphData = buildCodeGraph(files, repo.repoId, repo.fullName);
      contextDebt = computeContextDebt(files, graphData, 0);

      await GraphCache.findOneAndUpdate(
        { repoId: repo.repoId },
        {
          repoId: repo.repoId,
          nodes: graphData.nodes,
          edges: graphData.edges,
          contextDebt,
          updatedAt: new Date(),
        },
        { upsert: true }
      );

      nodes = graphData.nodes;
      edges = graphData.edges;
    }

    if (relationFilter) {
      edges = edges.filter((e) => relationFilter.includes(e.type));
    }

    res.json({
      success: true,
      nodes,
      edges,
      contextDebt,
      repoId: repo.repoId,
      fullName: repo.fullName,
    });
  } catch (err) {
    console.error('❌ getGraph failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch graph data' });
  }
}

/**
 * Get onboarding tour steps for a repository.
 *
 * @route GET /api/repos/:id/onboarding
 */
async function getOnboarding(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const cached = await GraphCache.findOne({ repoId: repo.repoId });
    if (!cached?.nodes?.length) {
      return res.json({
        success: true,
        tour: { title: repo.fullName, steps: [] },
        message: 'Graph still building — try again shortly.',
      });
    }

    const tour = buildOnboardingTour(
      { nodes: cached.nodes, edges: cached.edges },
      repo.fullName
    );

    res.json({ success: true, tour, contextDebt: cached.contextDebt });
  } catch (err) {
    console.error('❌ getOnboarding failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to build onboarding tour' });
  }
}

/**
 * Get context debt / coverage score.
 *
 * @route GET /api/repos/:id/stats
 */
async function getStats(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const cached = await GraphCache.findOne({ repoId: repo.repoId });

    res.json({
      success: true,
      nodeCount: cached?.nodes?.length || repo.nodeCount || 0,
      edgeCount: cached?.edges?.length || 0,
      contextDebt: cached?.contextDebt || null,
      isIngested: repo.isIngested,
      lastAnalyzed: repo.lastAnalyzed,
    });
  } catch (err) {
    console.error('❌ getStats failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
}

/**
 * Get code snippet for a specific node.
 *
 * @route GET /api/repos/:id/node/:nodeId/code
 */
async function getNodeCode(req, res) {
  try {
    const repo = await Repo.findById(req.params.id);
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const nodeId = decodeURIComponent(req.params.nodeId);
    const cached = await GraphCache.findOne({ repoId: repo.repoId });
    const node = cached?.nodes?.find((n) => n.id === nodeId);

    if (!node) {
      return res.status(404).json({ success: false, error: 'Node not found' });
    }

    if (node.codeSnippet) {
      return res.json({
        success: true,
        node: {
          id: node.id,
          name: node.name,
          filePath: node.filePath,
          startLine: node.startLine,
          endLine: node.endLine,
          signature: node.signature,
        },
        code: node.codeSnippet,
      });
    }

    const user = await User.findById(req.userId);
    if (!user || !node.filePath) {
      return res.status(404).json({ success: false, error: 'Code not available' });
    }

    const [owner, repoName] = repo.fullName.split('/');
    const files = await fetchRepoTree(owner, repoName, user.accessToken);
    const file = files.find((f) => f.path === node.filePath);

    if (!file) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const lines = file.content.split('\n');
    const start = node.startLine ? node.startLine - 1 : 0;
    const end = node.endLine || Math.min(start + 40, lines.length);
    const code = lines.slice(start, end).join('\n');

    res.json({
      success: true,
      node: {
        id: node.id,
        name: node.name,
        filePath: node.filePath,
        startLine: node.startLine || 1,
        endLine: end,
        signature: node.signature,
      },
      code,
    });
  } catch (err) {
    console.error('❌ getNodeCode failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch code' });
  }
}

/**
 * List PR events for a repository.
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
        changedFunctions: pr.changedFunctions,
        impactedModules: pr.impactedModules,
        impactedNodeIds: pr.impactedNodeIds,
        changedNodeIds: pr.changedNodeIds,
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

    await GraphCache.deleteOne({ repoId: repo.repoId });
    await PREvent.deleteMany({ repoId: repo.repoId });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ deleteRepo failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete repository' });
  }
}

export {
  listRepos,
  connectRepo,
  getGraph,
  getOnboarding,
  getStats,
  getNodeCode,
  listPRs,
  deleteRepo,
};
