import PREvent from '../models/PREvent.js';
import Repo from '../models/Repo.js';
import User from '../models/User.js';
import * as cognee from './cognee.js';
import { postReviewComment } from './github.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Parse a unified diff to extract the list of changed files
 * and modified function names.
 *
 * @param {string} diff - Unified diff string.
 * @returns {{ changedFiles: string[], changedFunctions: string[] }}
 */
function parseDiff(diff) {
  const changedFiles = [];
  const changedFunctions = [];
  const lines = diff.split('\n');

  for (const line of lines) {
    // Detect file headers: "diff --git a/path b/path"
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      changedFiles.push(fileMatch[2]);
    }

    // Detect function context in hunk headers: "@@ ... @@ functionName"
    const hunkMatch = line.match(/^@@.*@@\s+(?:function\s+)?(\w+)/);
    if (hunkMatch) {
      changedFunctions.push(hunkMatch[1]);
    }
  }

  return { changedFiles, changedFunctions };
}

/**
 * Build a human-readable prompt for the Claude API to generate
 * an impact analysis and code review.
 *
 * @param {string} diff - The PR diff.
 * @param {string} cogneeContext - Context from the Cognee graph.
 * @param {string[]} changedFiles - List of changed file paths.
 * @returns {string} The formatted prompt string.
 */
function buildPrompt(diff, cogneeContext, changedFiles) {
  return `You are CodeAtlas, an AI code review assistant. Analyze the following pull request diff and provide:

1. **Impact Analysis**: Which modules, functions, and features are affected by these changes? Consider the dependency graph context provided.
2. **Risk Assessment**: What could break? Are there any files that import or depend on the changed code?
3. **Code Review**: Provide a brief, constructive code review with suggestions for improvement.

## Dependency Graph Context (from Cognee):
${cogneeContext || 'No graph context available yet.'}

## Changed Files:
${changedFiles.join('\n')}

## Diff:
\`\`\`diff
${diff.slice(0, 8000)}
\`\`\`

Respond in markdown format. Be concise but thorough.`;
}

/**
 * Call the Gemini API to generate an impact analysis for a PR.
 *
 * @param {string} prompt - The formatted prompt.
 * @returns {Promise<string>} The AI-generated review text.
 */
async function callGemini(prompt) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        maxOutputTokens: 1000,
      }
    });

    return response.text || 'No analysis generated.';
  } catch (err) {
    console.error('❌ Gemini API call failed:', err.message);
    return 'Impact analysis unavailable — AI service error.';
  }
}

/**
 * Full PR analysis pipeline:
 * 1. Parse the diff to extract changed files/functions
 * 2. Query Cognee graph for dependencies of changed files
 * 3. Call Gemini API for impact analysis + review
 * 4. Update the Cognee graph with PR changes
 * 5. Update the PREvent document in MongoDB
 * 6. Emit Socket.io event 'pr:analyzed'
 * 7. Post review comment to GitHub
 *
 * @param {string} repoId   - GitHub repo ID.
 * @param {number} prNumber - Pull request number.
 * @param {string} diff     - Full unified diff string.
 * @param {object} io       - Socket.io server instance.
 * @returns {Promise<{impactedModules: Array, relatedHistory: string, review: string}>}
 */
async function analyzePR(repoId, prNumber, diff, io) {
  try {
    const { changedFiles, changedFunctions } = parseDiff(diff);

    // Step 1: Query Cognee for dependencies of changed files
    const queryText = `files that depend on or import: ${changedFiles.join(', ')}`;
    const cogneeResult = await cognee.query(repoId, queryText);

    const contextText = cogneeResult.success ? cogneeResult.answer : 'No graph context available yet.';

    // Step 2: Build context and call Gemini
    const prompt = buildPrompt(diff, contextText, changedFiles);
    const review = await callGemini(prompt);

    // Step 3: Extract impacted modules from Cognee results
    // The new Cognee /recall endpoint returns mostly text fragments.
    const impactedModules = (cogneeResult.rawResults || []).slice(0, 5).map((res, i) => ({
      name: `Context Fragment ${i+1}`,
      filePath: 'Extracted from Cognee',
      reason: res.text ? res.text.substring(0, 50) + '...' : 'Related to PR changes',
    }));

    // Step 4: Update Cognee graph
    await cognee.updateFromPR(repoId, changedFiles, diff);

    // Step 5: Update PREvent in MongoDB
    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      {
        changedFiles,
        impactedModules,
        review,
        status: 'analyzed',
      }
    );

    // Step 6: Update repo stats
    const graphData = await cognee.getGraphData(repoId);
    await Repo.findOneAndUpdate(
      { repoId },
      {
        nodeCount: graphData.nodes.length,
        lastAnalyzed: new Date(),
      }
    );

    // Step 7: Emit Socket.io event
    if (io) {
      io.to(`repo:${repoId}`).emit('pr:analyzed', {
        prNumber,
        impactedModules,
        review: review.slice(0, 200) + '...',
      });
    }

    // Step 8: Post review comment to GitHub
    try {
      const repo = await Repo.findOne({ repoId });
      if (repo) {
        const user = await User.findById(repo.userId);
        if (user) {
          const [owner, repoName] = repo.fullName.split('/');
          const commentBody = `## 🗺️ CodeAtlas Impact Analysis\n\n${review}\n\n---\n*Analyzed by [CodeAtlas](https://codeatlas.dev) — your codebase's living map*`;
          await postReviewComment(owner, repoName, prNumber, commentBody, user.accessToken);
        }
      }
    } catch (commentErr) {
      // Non-critical: log but don't fail the analysis
      console.error('⚠️ Failed to post GitHub comment:', commentErr.message);
    }

    return { impactedModules, relatedHistory: contextText, review };
  } catch (err) {
    console.error('❌ analyzePR failed:', err.message);

    // Mark PR as failed
    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      { status: 'failed', review: `Analysis failed: ${err.message}` }
    );

    throw err;
  }
}

export { analyzePR, parseDiff };
