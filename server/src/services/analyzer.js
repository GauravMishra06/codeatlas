import PREvent from '../models/PREvent.js';
import Repo from '../models/Repo.js';
import User from '../models/User.js';
import GraphCache from '../models/GraphCache.js';
import * as cognee from './cognee.js';
import { postReviewComment, fetchFilesByPaths } from './github.js';
import { computePRImpact } from './codeGraph.js';
import { GoogleGenAI } from '@google/genai';

function parseDiff(diff) {
  const changedFiles = [];
  const changedFunctions = [];
  const lines = diff.split('\n');

  for (const line of lines) {
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      changedFiles.push(fileMatch[2]);
    }

    const hunkMatch = line.match(/^@@.*@@\s*(?:export\s+)?(?:async\s+)?(?:function\s+)?(\w+)/);
    if (hunkMatch && hunkMatch[1] !== 'function') {
      changedFunctions.push(hunkMatch[1]);
    }
  }

  return {
    changedFiles: [...new Set(changedFiles)],
    changedFunctions: [...new Set(changedFunctions)],
  };
}

function buildPrompt(diff, graphContext, changedFiles, changedFunctions, impactedModules) {
  const impactList = impactedModules.length > 0
    ? impactedModules.map((m) =>
        `- **${m.name}** (\`${m.filePath}\`${m.startLine ? `:${m.startLine}` : ''}) — ${m.reason}\n  Path: ${(m.relationPath || []).join(' → ')}`
      ).join('\n')
    : 'No graph dependencies detected yet.';

  return `You are CodeAtlas, an AI code review assistant with access to a verified code dependency graph.

Analyze this pull request. Every claim MUST cite a specific file path (and line if known).
Format citations as \`file/path.ts:42\`.

## Verified Graph Impact (from static analysis — trust this):
${impactList}

## Changed Functions:
${changedFunctions.length ? changedFunctions.join(', ') : 'None detected'}

## Changed Files:
${changedFiles.join('\n')}

## Semantic Context (from Cognee memory):
${graphContext || 'No semantic context yet.'}

## Diff:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Respond in markdown with these sections:
1. **Impact Analysis** — cite affected files/functions with \`path:line\`
2. **Risk Assessment** — what could break based on import graph
3. **Code Review** — constructive suggestions with citations

Be concise. Do not invent files not in the impact list or changed files.`;
}

async function callGemini(prompt) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { maxOutputTokens: 1200 },
    });
    return response.text || 'No analysis generated.';
  } catch (err) {
    console.error('❌ Gemini API call failed:', err.message);
    return 'Impact analysis unavailable — AI service error.';
  }
}

function emitToRepo(io, repo, event, payload) {
  if (!io || !repo) return;
  io.to(`repo:${repo.repoId}`).emit(event, payload);
  io.to(`repo:${repo._id}`).emit(event, payload);
}

/**
 * Full PR analysis with graph-grounded impact + Cognee semantic enrichment.
 */
async function analyzePR(repoId, prNumber, diff, io) {
  try {
    const { changedFiles, changedFunctions } = parseDiff(diff);
    const repo = await Repo.findOne({ repoId });

    // Load canonical code graph
    const cached = await GraphCache.findOne({ repoId });
    const graph = cached
      ? { nodes: cached.nodes, edges: cached.edges }
      : { nodes: [], edges: [] };

    const impact = computePRImpact(graph, changedFiles, changedFunctions);

    // Cognee semantic enrichment (no double synthesis — raw recall only)
    const queryText = `What do these files do and what depends on them: ${changedFiles.join(', ')}`;
    const cogneeResult = await cognee.recall(repoId, queryText);
    const contextText = cogneeResult.success
      ? cogneeResult.context
      : 'No semantic context available yet.';

    const prompt = buildPrompt(
      diff,
      contextText,
      changedFiles,
      changedFunctions,
      impact.impactedModules
    );
    const review = await callGemini(prompt);

    // Re-ingest changed files with actual content
    if (repo && changedFiles.length > 0) {
      const user = await User.findById(repo.userId);
      if (user) {
        const [owner, repoName] = repo.fullName.split('/');
        const fileContents = await fetchFilesByPaths(
          owner,
          repoName,
          changedFiles.slice(0, 10),
          user.accessToken
        );
        if (fileContents.length > 0) {
          await cognee.ingest(repoId, fileContents, { preserveGraphCache: true });
        }
      }
    }

    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      {
        changedFiles,
        changedFunctions,
        impactedModules: impact.impactedModules,
        impactedNodeIds: impact.allAffectedNodeIds,
        changedNodeIds: impact.changedNodeIds,
        review,
        status: 'analyzed',
      }
    );

    if (repo) {
      await Repo.findOneAndUpdate(
        { repoId },
        {
          nodeCount: graph.nodes.length,
          lastAnalyzed: new Date(),
        }
      );
    }

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const atlasLink = repo
      ? `\n\n[🗺️ View blast radius on CodeAtlas](${clientUrl}/repo/${repo._id})`
      : '';

    emitToRepo(io, repo, 'pr:analyzed', {
      prNumber,
      impactedModules: impact.impactedModules,
      impactedNodeIds: impact.allAffectedNodeIds,
      changedNodeIds: impact.changedNodeIds,
      review: review.slice(0, 200) + '...',
    });

    try {
      if (repo) {
        const user = await User.findById(repo.userId);
        if (user) {
          const [owner, repoName] = repo.fullName.split('/');
          const impactSummary = impact.impactedModules.slice(0, 5).map((m) =>
            `- \`${m.filePath}\` — ${m.reason}`
          ).join('\n');

          const commentBody = `## 🗺️ CodeAtlas Impact Analysis

${review}

### Graph Blast Radius (${impact.impactedModules.length} affected)
${impactSummary || '_No downstream dependencies detected._'}

${atlasLink}
---
*Analyzed by [CodeAtlas](${clientUrl}) — your codebase's living map*`;

          await postReviewComment(owner, repoName, prNumber, commentBody, user.accessToken);
        }
      }
    } catch (commentErr) {
      console.error('⚠️ Failed to post GitHub comment:', commentErr.message);
    }

    return {
      impactedModules: impact.impactedModules,
      impactedNodeIds: impact.allAffectedNodeIds,
      relatedHistory: contextText,
      review,
    };
  } catch (err) {
    console.error('❌ analyzePR failed:', err.message);

    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      { status: 'failed', review: `Analysis failed: ${err.message}` }
    );

    throw err;
  }
}

export { analyzePR, parseDiff };
