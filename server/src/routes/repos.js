import { Router } from 'express';
import { authMiddleware } from '../controllers/authController.js';
import {
  listRepos,
  connectRepo,
  getGraph,
  listPRs,
  deleteRepo,
} from '../controllers/repoController.js';

const router = Router();

/**
 * @route GET /api/repos
 * @desc  List all repositories for the authenticated user
 * @access Protected
 */
router.get('/', authMiddleware, listRepos);

/**
 * @route POST /api/repos/connect
 * @desc  Connect a GitHub repository and trigger ingestion
 * @access Protected
 */
router.post('/connect', authMiddleware, connectRepo);

/**
 * @route GET /api/repos/:id/graph
 * @desc  Get D3-ready graph data for a repository
 * @access Protected
 */
router.get('/:id/graph', authMiddleware, getGraph);

/**
 * @route GET /api/repos/:id/prs
 * @desc  List all PR events for a repository
 * @access Protected
 */
router.get('/:id/prs', authMiddleware, listPRs);

/**
 * @route DELETE /api/repos/:id
 * @desc  Delete a repository
 * @access Protected
 */
router.delete('/:id', authMiddleware, deleteRepo);

export default router;
