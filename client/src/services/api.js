import axios from 'axios';

/**
 * Axios instance pre-configured with the API base URL.
 * All API calls should use this instance.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : ''),
});

/**
 * Request interceptor — attaches the JWT from localStorage
 * to every outgoing request as a Bearer token.
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('codeatlas_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor — handles 401 errors by clearing
 * the token and redirecting to the landing page.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('codeatlas_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch the current authenticated user profile.
 * @returns {Promise<{id: string, username: string, avatar: string}>}
 */
export async function getMe() {
  const { data } = await api.get('/auth/me');
  return data;
}

/**
 * Fetch all repositories for the current user.
 * @returns {Promise<{repos: Array}>}
 */
export async function getRepos() {
  const { data } = await api.get('/api/repos');
  return data;
}

/**
 * Connect a new GitHub repository by full name.
 * @param {string} repoFullName - e.g. "facebook/react"
 * @returns {Promise<{success: boolean, repo: object}>}
 */
export async function connectRepo(repoFullName) {
  const { data } = await api.post('/api/repos/connect', { repoFullName });
  return data;
}

/**
 * Fetch D3-ready graph data for a repository.
 * @param {string} repoId - MongoDB ObjectId of the repo.
 * @returns {Promise<{nodes: Array, edges: Array}>}
 */
export async function getGraph(repoId, relations) {
  const params = relations ? { relations } : {};
  const { data } = await api.get(`/api/repos/${repoId}/graph`, { params });
  return data;
}

export async function getOnboarding(repoId) {
  const { data } = await api.get(`/api/repos/${repoId}/onboarding`);
  return data;
}

export async function getStats(repoId) {
  const { data } = await api.get(`/api/repos/${repoId}/stats`);
  return data;
}

export async function getNodeCode(repoId, nodeId) {
  const { data } = await api.get(`/api/repos/${repoId}/node/${encodeURIComponent(nodeId)}/code`);
  return data;
}

/**
 * Fetch all PR events for a repository.
 * @param {string} repoId - MongoDB ObjectId of the repo.
 * @returns {Promise<{prs: Array}>}
 */
export async function getPRs(repoId) {
  const { data } = await api.get(`/api/repos/${repoId}/prs`);
  return data;
}

/**
 * Query the codebase in natural language.
 * @param {string} repoId  - MongoDB ObjectId of the repo.
 * @param {string} question - Natural-language question.
 * @returns {Promise<{answer: string, relatedNodes: Array}>}
 */
export async function queryCodebase(repoId, question) {
  const { data } = await api.post('/api/cognee/query', { repoId, question });
  return data;
}

/**
 * Delete a repository.
 * @param {string} repoId - MongoDB ObjectId of the repo.
 */
export async function deleteRepo(repoId) {
  const { data } = await api.delete(`/api/repos/${repoId}`);
  return data;
}

export default api;
