import axios from 'axios';
import FormData from 'form-data';
import GraphCache from '../models/GraphCache.js';

const COGNEE_URL = process.env.COGNEE_URL || 'http://localhost:8000';
const MAX_FILES_TO_INGEST = 20;

const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

const RATE_LIMIT_BACKOFF_MS = 60000; // 1 minute
let rateLimitedUntil = null;

const LLM_PROVIDERS = [
  {
    name: 'gemini',
    url: `${COGNEE_URL}/api/v1/remember`,
    // We don't switch Cognee's provider mid-request since Cognee
    // manages its own LLM config. Instead, track failures and
    // implement a retry delay strategy.
  }
];

/**
 * Log which LLM provider API keys are configured.
 */
function getAvailableProviders() {
  console.log('🔑 LLM providers configured:', {
    gemini: !!GEMINI_API_KEY,
    groq: !!GROQ_API_KEY
  });
}

getAvailableProviders();

const STOP_WORDS = new Set([
  'the', 'and', 'are', 'here', 'these', 'those', 'this', 'that', 'with', 'from',
  'codebase', 'repository', 'repo', 'files', 'functions', 'modules', 'components',
  'list', 'all', 'some', 'any', 'what', 'where', 'when', 'why', 'how', 'which',
  'who', 'whom', 'whose', 'is', 'it', 'to', 'for', 'in', 'on', 'at', 'by', 'an', 'a',
  'of', 'as', 'if', 'we', 'you', 'they', 'i', 'me', 'my', 'your', 'their', 'our',
  'can', 'could', 'would', 'should', 'will', 'shall', 'may', 'might', 'must',
  'has', 'have', 'had', 'do', 'does', 'did', 'be', 'been', 'being', 'am', 'was', 'were',
  'not', 'no', 'yes', 'true', 'false', 'null', 'undefined', 'return', 'import', 'export',
  'const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum', 'extends', 'implements',
  'new', 'super', 'public', 'private', 'protected', 'static', 'readonly', 'async', 'await'
]);

/**
 * Parse raw text from Cognee recall responses to extract code entities.
 * @param {string} text - Raw text from a Cognee query response.
 * @returns {Array<{name: string, type: string}>}
 */
function parseEntitiesFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const entities = [];
  const seen = new Set();

  const lines = text.split(/[\n,;|]+/).map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const tokens = line.match(/[\w./\-]+/g);
    if (!tokens) continue;

    for (const rawToken of tokens) {
      // Strip trailing and leading punctuation that got caught by \w
      const token = rawToken.replace(/^[.,;:!?'")\]]+|[.,;:!?'")\]]+$/g, '');

      if (token.length < 2 || seen.has(token) || STOP_WORDS.has(token.toLowerCase())) continue;

      let type = 'Feature';

      if (token.includes('/') || /\.(js|ts|jsx|tsx|py|go|rs|java|css|html|json|yaml|md|sql|sh)$/i.test(token)) {
        type = 'File';
      } else if (/^[A-Z][a-zA-Z0-9]+$/.test(token) && !token.includes('/')) {
        type = 'Module';
      } else if (/^[a-z]+[A-Z][a-zA-Z0-9]*$/.test(token) || /^[a-z]+_[a-z0-9_]+$/.test(token)) {
        type = 'Function';
      }

      seen.add(token);
      entities.push({ name: token, type });
    }
  }

  return entities;
}

/**
 * Synthesize a natural-language answer from Cognee context using an LLM.
 * Tries Groq first, then Gemini, then falls back to raw context.
 *
 * @param {string} context - Combined text context from Cognee recall.
 * @param {string} question - The user's original question.
 * @returns {Promise<string>} The synthesized answer.
 */
async function synthesizeAnswer(context, question) {
  // Try Groq first if available
  if (GROQ_API_KEY) {
    try {
      console.log('🤖 Synthesizing with groq');
      const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a helpful code assistant analyzing a codebase. Answer concisely based on the context.' },
          { role: 'user', content: `Context from codebase:\n${context}\n\nQuestion: ${question}` }
        ],
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });
      return response.data.choices[0].message.content;
    } catch (groqErr) {
      console.warn('⚠️ Groq synthesis failed, trying Gemini:', groqErr.message);
    }
  }

  // Fall back to Gemini directly (only reached if Groq failed or key not set)
  if (GEMINI_API_KEY) {
    try {
      console.log('🤖 Synthesizing with gemini');
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }] }]
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );
      return response.data.candidates[0].content.parts[0].text;
    } catch (geminiErr) {
      console.warn('⚠️ Gemini also failed, returning raw context:', geminiErr.message);
    }
  }

  // Both failed or no keys — return raw context
  console.log('🤖 Returning raw context');
  return context;
}

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
async function ingest(repoId, files, options = {}) {
  const { preserveGraphCache = false } = options;
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
      if (!file.content) {
        console.warn(`⚠️ Skipping ${file.path || file} — no content`);
        continue;
      }
      console.log(`Ingesting file ${i + 1}/${filesToProcess.length}: ${file.path}`);

      // Rate-limit backoff: wait if we recently hit a 429
      if (rateLimitedUntil && Date.now() < rateLimitedUntil) {
        const waitMs = rateLimitedUntil - Date.now();
        console.log(`⏳ Rate limited — waiting ${Math.round(waitMs / 1000)}s before next file`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        rateLimitedUntil = null;
      }

      const form = new FormData();
      const safeFilename = file.path.replace(/\//g, '_');
      
      // Cognee requires a file blob/buffer for 'data'
      form.append('data', Buffer.from(file.content, 'utf-8'), {
        filename: safeFilename,
        contentType: 'text/plain', // Or guess based on file.language
      });
      form.append('datasetName', repoId);

      let ingested = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          // Cognee takes ~26s per file, so setting a long timeout
          await axios.post(`${COGNEE_URL}/api/v1/remember`, form, {
            headers: form.getHeaders(),
            timeout: 60000, 
          });
          ingested = true;
          break;
        } catch (postErr) {
          const status = postErr.response?.status;
          const msg = (postErr.message || '').toLowerCase();
          if (status === 429 || msg.includes('quota') || msg.includes('rate')) {
            console.warn('⚠️ Rate limit hit — pausing ingestion for 60 seconds');
            rateLimitedUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
            if (attempt === 0) {
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_BACKOFF_MS));
              rateLimitedUntil = null;
              // Rebuild form for retry since streams may be consumed
              const retryForm = new FormData();
              retryForm.append('data', Buffer.from(file.content, 'utf-8'), {
                filename: safeFilename,
                contentType: 'text/plain',
              });
              retryForm.append('datasetName', repoId);
              // Replace form reference for the retry attempt
              // (the loop will use the original `form` var, so we re-assign)
              Object.assign(form, retryForm);
            }
          } else {
            console.error(`❌ Skipping file ${file.path}: ${postErr.message}`);
            break;
          }
        }
      }

      if (ingested) nodesCreated++;
    }

    if (!preserveGraphCache) {
      await GraphCache.deleteOne({ repoId });
    }

    return { success: true, nodesCreated, skipped };
  } catch (err) {
    console.error('❌ Cognee ingest failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Raw recall from Cognee without LLM synthesis (for PR analysis / grounding).
 */
async function recall(repoId, question) {
  try {
    const response = await axios.post(`${COGNEE_URL}/api/v1/recall`, {
      query: question,
      datasets: [repoId],
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const results = response.data;
    if (!Array.isArray(results) || results.length === 0) {
      return { success: true, context: '', rawResults: [] };
    }

    const context = results.map((r) => r.text).filter(Boolean).join('\n\n');
    return { success: true, context, rawResults: results };
  } catch (err) {
    console.error('❌ Cognee recall failed:', err.message);
    return { success: false, error: err.message, context: '', rawResults: [] };
  }
}

/**
 * Semantic search over the Cognee graph for a given repository.
 *
 * @param {string} repoId   - Unique repository identifier.
 * @param {string} question  - Natural-language query.
 * @param {{ skipSynthesis?: boolean }} options
 */
async function query(repoId, question, options = {}) {
  try {
    const response = await axios.post(`${COGNEE_URL}/api/v1/recall`, {
      query: question,
      datasets: [repoId]
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const results = response.data;
    if (!Array.isArray(results) || results.length === 0) {
      return { 
        success: true, 
        answer: "No relevant information found in this codebase yet.", 
        rawResults: [] 
      };
    }

    const context = results.map(r => r.text).filter(Boolean).join('\n\n');

    if (options.skipSynthesis) {
      return { success: true, answer: context, rawResults: results };
    }

    const answer = await synthesizeAnswer(context, question);
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
    // Step 1: Check GraphCache first
    const cached = await GraphCache.findOne({ repoId });
    if (cached && cached.nodes && cached.nodes.length > 0) {
      return { nodes: cached.nodes, edges: cached.edges };
    }

    // Step 2: Run 4 recall queries sequentially (Cognee returns 409 on concurrent requests)
    const r1 = await query(repoId, 'list all files in this codebase with their paths');
    await new Promise(r => setTimeout(r, 500));
    const r2 = await query(repoId, 'list all modules and components in this codebase');
    await new Promise(r => setTimeout(r, 500));
    const r3 = await query(repoId, 'list all functions and classes defined in this code');
    await new Promise(r => setTimeout(r, 500));
    const r4 = await query(repoId, 'what files depend on each other or import each other');

    const responses = [r1, r2, r3, r4].map(r => (r && r.success ? r.answer : ''));

    // Step 3: Parse entities from all responses
    const allEntities = [];
    for (const text of responses) {
      allEntities.push(...parseEntitiesFromText(text));
    }

    // Step 4: Deduplicate entities by name
    const entityMap = new Map();
    for (const entity of allEntities) {
      if (!entityMap.has(entity.name)) {
        entityMap.set(entity.name, {
          id: `${repoId}:${entity.name}`,
          name: entity.name,
          type: entity.type,
          filePath: entity.type === 'File' ? entity.name : undefined,
          description: `${entity.type}: ${entity.name}`,
        });
      }
    }

    const nodes = Array.from(entityMap.values());
    const edges = [];
    const edgeSet = new Set();

    // Step 5: Build edges by co-mention proximity (within 200 chars)
    for (const text of responses) {
      const nodeList = nodes.filter(n => text.includes(n.name));
      for (let i = 0; i < nodeList.length; i++) {
        for (let j = i + 1; j < nodeList.length; j++) {
          const posA = text.indexOf(nodeList[i].name);
          const posB = text.indexOf(nodeList[j].name);
          if (Math.abs(posA - posB) <= 200) {
            const edgeKey = [nodeList[i].id, nodeList[j].id].sort().join('→');
            if (!edgeSet.has(edgeKey)) {
              edgeSet.add(edgeKey);
              edges.push({
                source: nodeList[i].id,
                target: nodeList[j].id,
                type: 'related',
              });
            }
          }
        }
      }
    }

    // Step 6: Always add root node and connect to first 5 nodes
    const rootNode = {
      id: `repo:${repoId}`,
      name: 'Repository',
      type: 'Module',
      filePath: '/',
      description: 'Repository root',
    };
    nodes.unshift(rootNode);

    const connectCount = Math.min(5, nodes.length - 1);
    for (let i = 1; i <= connectCount; i++) {
      edges.push({
        source: rootNode.id,
        target: nodes[i].id,
        type: 'contains',
      });
    }

    // Step 7: Save to GraphCache
    await GraphCache.findOneAndUpdate(
      { repoId },
      { repoId, nodes, edges, updatedAt: new Date() },
      { upsert: true }
    );

    // Step 8: Return the graph
    return { nodes, edges };
  } catch (err) {
    console.error('❌ Cognee getGraphData failed:', err.message);
    return {
      nodes: [{
        id: `repo:${repoId}`,
        name: 'Repository Root',
        type: 'Module',
        description: 'Ingestion may still be in progress',
      }],
      edges: [],
    };
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

export { ingest, query, recall, getGraphData, updateFromPR };
