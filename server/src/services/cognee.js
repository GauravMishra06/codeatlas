import axios from 'axios';
import FormData from 'form-data';
import GraphCache from '../models/GraphCache.js';

const COGNEE_URL = process.env.COGNEE_URL || 'http://localhost:8000';
const MAX_FILES_TO_INGEST = 20;

/**
 * Cognee Service — graph-vector memory layer for CodeAtlas.
 * Integrates with a local Cognee server via real HTTP calls.
 */

/**
 * Ingest a set of files into the Cognee graph for a repository.
 * 
 * Note: For the hackathon demo, this uses a file cap (MAX_FILES_TO_INGEST)
 * to avoid 10+ minute ingestion times, as each file takes ~20-30s.
 * For production/background use where time doesn't matter, this cap can be removed.
 *
 * @param {string} repoId - Unique repository identifier, used as the datasetName.
 * @param {Array<{path: string, content: string, language: string}>} files
 * @returns {Promise<{success: boolean, nodesCreated: number, skipped: number, error?: string}>}
 */
async function ingest(repoId, files) {
  try {
    const filesToProcess = files.slice(0, MAX_FILES_TO_INGEST);
    const skipped = Math.max(0, files.length - MAX_FILES_TO_INGEST);

    if (skipped > 0) {
      console.warn(`⚠️ Skipped ${skipped} files to stay within demo time limits.`);
    }

    console.log(`Estimated ingestion time: ~${filesToProcess.length * 27} seconds for ${filesToProcess.length} files`);

    let nodesCreated = 0;

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      console.log(`Ingesting file ${i + 1}/${filesToProcess.length}: ${file.path}`);
      
      const form = new FormData();
      const safeFilename = file.path.replace(/\//g, '_');
      
      // Cognee requires a file blob/buffer for 'data'
      form.append('data', Buffer.from(file.content, 'utf-8'), {
        filename: safeFilename,
        contentType: 'text/plain', // Or guess based on file.language
      });
      form.append('datasetName', repoId);

      // Cognee takes ~26s per file, so setting a long timeout
      await axios.post(`${COGNEE_URL}/api/v1/remember`, form, {
        headers: form.getHeaders(),
        timeout: 60000, 
      });

      nodesCreated++;
    }

    // Invalidate cache since we added new data
    await GraphCache.deleteOne({ repoId });

    return { success: true, nodesCreated, skipped };
  } catch (err) {
    console.error('❌ Cognee ingest failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Semantic search over the Cognee graph for a given repository.
 *
 * @param {string} repoId   - Unique repository identifier.
 * @param {string} question  - Natural-language query.
 * @returns {Promise<{success: boolean, answer?: string, rawResults?: Array, error?: string}>}
 */
async function query(repoId, question) {
  try {
    const response = await axios.post(`${COGNEE_URL}/api/v1/recall`, {
      query: question,
      datasets: [repoId]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const results = response.data;
    if (!Array.isArray(results) || results.length === 0) {
      return { 
        success: true, 
        answer: "No relevant information found in this codebase yet.", 
        rawResults: [] 
      };
    }

    const answer = results[0].text;
    return { success: true, answer, rawResults: results };
  } catch (err) {
    console.error('❌ Cognee query failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get the full graph data for a repository in D3-friendly format.
 *
 * TODO: Cognee's REST API doesn't expose raw graph nodes/edges directly via these endpoints — 
 * investigate /api/v1/activity/export/{dataset_id} for a markdown graph export, 
 * or query the underlying graph database directly for production use.
 *
 * @param {string} repoId - Unique repository identifier.
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
async function getGraphData(repoId) {
  try {
    // For the hackathon demo, we'll try to extract file lists from a simple query,
    // or just return an empty graph for now since Cognee doesn't expose raw nodes via REST yet.
    const response = await query(repoId, "list all files and their dependencies");
    
    // We could try to parse response.answer into nodes/edges, but without a structured 
    // endpoint, we'll just return a placeholder graph for the UI.
    const nodes = [
      { id: `repo:${repoId}`, name: 'Repository Root', type: 'Module', description: 'Root node' }
    ];
    const edges = [];

    return { nodes, edges };
  } catch (err) {
    console.error('❌ Cognee getGraphData failed:', err.message);
    throw err;
  }
}

/**
 * Update the Cognee graph with changes from a pull request.
 *
 * @param {string} repoId - Unique repository identifier.
 * @param {Array<{path: string, content: string, language: string}>} changedFiles - Files changed in the PR.
 * @param {string} diff - The full PR diff string.
 * @returns {Promise<{success: boolean, nodesUpdated: number, error?: string}>}
 */
async function updateFromPR(repoId, changedFiles, diff) {
  try {
    // Re-ingest the changed files. Cognee's /remember will add/update the graph.
    const result = await ingest(repoId, changedFiles);
    
    if (!result.success) {
      throw new Error(result.error);
    }

    return { success: true, nodesUpdated: result.nodesCreated };
  } catch (err) {
    console.error('❌ Cognee updateFromPR failed:', err.message);
    return { success: false, error: err.message };
  }
}

export { ingest, query, getGraphData, updateFromPR };
