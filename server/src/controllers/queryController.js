import Repo from '../models/Repo.js';
import * as cognee from '../services/cognee.js';
import { fetchRepoTree } from '../services/github.js';
import User from '../models/User.js';
import { analyzePR } from '../services/analyzer.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Query the codebase using natural language.
 * Searches the Cognee graph for relevant nodes, then passes
 * the context to Claude for a human-readable answer.
 *
 * @route POST /api/cognee/query
 * @body {{ repoId: string, question: string }}
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

    // Verify repo belongs to user
    const repo = await Repo.findOne({ _id: repoId, userId: req.userId });
    if (!repo) {
      return res.status(404).json({ success: false, error: 'Repository not found' });
    }

    // Search Cognee graph
    const cogneeResult = await cognee.query(repo.repoId, question);

    // Build prompt for Claude
    const prompt = `You are CodeAtlas, an AI assistant that helps developers understand their codebase. 
Answer the following question about the repository "${repo.fullName}" using the context from the code graph below.

## Code Graph Context:
${cogneeResult.success && cogneeResult.answer ? cogneeResult.answer : 'No context available. The repository may not be fully ingested yet.'}

## Question:
${question}

Provide a clear, concise answer. Reference specific files and functions when possible. If the context is insufficient, say so honestly.`;

    // Call Gemini API
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let answer = 'Unable to generate answer.';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { maxOutputTokens: 1000 }
      });
      answer = response.text || answer;
    } catch (apiErr) {
      console.error('❌ Gemini API error:', apiErr.message);
    }

    // Extract related nodes for display (now using rawResults)
    const relatedNodes = (cogneeResult.rawResults || []).map((n, idx) => ({
      name: `Result ${idx+1}`,
      filePath: n.source || 'Cognee Graph',
      type: n.kind || 'search_result',
    }));

    res.json({ success: true, answer, relatedNodes });
  } catch (err) {
    console.error('❌ queryCognee failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to query codebase' });
  }
}

/**
 * Ingest files into the Cognee graph for a repository.
 * Typically called internally after connecting a repo.
 *
 * @route POST /api/cognee/ingest
 * @body {{ repoId: string, files: Array<{path, content, language}> }}
 */
async function ingestFiles(req, res) {
  try {
    const { repoId, files } = req.body;

    if (!repoId || !files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'repoId and files array are required',
      });
    }

    const result = await cognee.ingest(repoId, files);

    res.json({
      success: true,
      nodesCreated: result.nodesCreated,
      edgesCreated: result.edgesCreated,
    });
  } catch (err) {
    console.error('❌ ingestFiles failed:', err.message);
    res.status(500).json({ success: false, error: 'Ingestion failed' });
  }
}

/**
 * Analyze a PR using the Cognee graph and Claude API.
 * Typically called internally from the webhook handler.
 *
 * @route POST /api/cognee/analyze-pr
 * @body {{ repoId: string, prNumber: number, diff: string }}
 */
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
      relatedHistory: result.relatedHistory,
      review: result.review,
    });
  } catch (err) {
    console.error('❌ analyzePREndpoint failed:', err.message);
    res.status(500).json({ success: false, error: 'PR analysis failed' });
  }
}

export { queryCognee, ingestFiles, analyzePREndpoint };
