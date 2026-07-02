import Repo from '../models/Repo.js';
import GraphCache from '../models/GraphCache.js';
import * as cognee from '../services/cognee.js';
import { analyzePR } from '../services/analyzer.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Extract file paths mentioned in Cognee recall text.
 */
function extractFilePathsFromRecall(rawResults, graphNodes) {
  const paths = new Set();
  const fileNodes = graphNodes.filter((n) => n.type === 'File' && n.filePath);

  for (const result of rawResults || []) {
    const text = result.text || '';
    for (const node of fileNodes) {
      if (text.includes(node.filePath) || text.includes(node.name)) {
        paths.add(node.filePath);
      }
    }
  }

  return [...paths].slice(0, 8).map((filePath) => {
    const node = fileNodes.find((n) => n.filePath === filePath);
    return {
      id: node?.id,
      name: node?.name || filePath.split('/').pop(),
      filePath,
      type: 'File',
    };
  });
}

/**
 * Query the codebase using natural language.
 *
 * @route POST /api/cognee/query
 */
async function queryCognee(req, res) {
  try {
    const { repoId, question } = req.body;

    if (!repoId || !question) {
      return res.status(400).json({
        success: false,
        error: 'repoId and question are required',
      });
    }

    const repo = await Repo.findOne({ _id: repoId, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    const cached = await GraphCache.findOne({ repoId: repo.repoId });
    const graphNodes = cached?.nodes || [];

    const cogneeResult = await cognee.recall(repo.repoId, question);
    const context = cogneeResult.success ? cogneeResult.context : '';

    const prompt = `You are CodeAtlas, an AI assistant helping developers understand their codebase "${repo.fullName}".

Answer using ONLY the context below. Cite files as \`path/to/file.ts\` when referencing code.

## Code Context:
${context || 'No context available — repository may still be ingesting.'}

## Question:
${question}

Be clear and concise. Reference specific files and functions when possible.`;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let answer = 'Unable to generate answer.';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { maxOutputTokens: 1000 },
      });
      answer = response.text || answer;
    } catch (apiErr) {
      console.error('❌ Gemini API error:', apiErr.message);
      answer = context || answer;
    }

    const relatedNodes = extractFilePathsFromRecall(cogneeResult.rawResults, graphNodes);

    res.json({ success: true, answer, relatedNodes });
  } catch (err) {
    console.error('❌ queryCognee failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to query codebase' });
  }
}

async function ingestFiles(req, res) {
  try {
    const { repoId, files } = req.body;

    if (!repoId || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'repoId and files array are required',
      });
    }

    const result = await cognee.ingest(repoId, files, { preserveGraphCache: true });

    res.json({
      success: true,
      nodesCreated: result.nodesCreated,
    });
  } catch (err) {
    console.error('❌ ingestFiles failed:', err.message);
    res.status(500).json({ success: false, error: 'Ingestion failed' });
  }
}

async function analyzePREndpoint(req, res) {
  try {
    const { repoId, prNumber, diff } = req.body;

    if (!repoId || !prNumber || !diff) {
      return res.status(400).json({
        success: false,
        error: 'repoId, prNumber, and diff are required',
      });
    }

    const io = req.app.locals.io;
    const result = await analyzePR(repoId, prNumber, diff, io);

    res.json({
      success: true,
      impactedModules: result.impactedModules,
      impactedNodeIds: result.impactedNodeIds,
      relatedHistory: result.relatedHistory,
      review: result.review,
    });
  } catch (err) {
    console.error('❌ analyzePREndpoint failed:', err.message);
    res.status(500).json({ success: false, error: 'PR analysis failed' });
  }
}

export { queryCognee, ingestFiles, analyzePREndpoint };
