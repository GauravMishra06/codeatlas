import { Router } from 'express';
import { authMiddleware } from '../controllers/authController.js';
import {
  queryCognee,
  ingestFiles,
  analyzePREndpoint,
} from '../controllers/queryController.js';

const router = Router();

/**
 * @route POST /api/cognee/query
 * @desc  Query the codebase in natural language
 * @access Protected
 */
router.post('/query', authMiddleware, queryCognee);

/**
 * @route POST /api/cognee/ingest
 * @desc  Ingest files into the Cognee graph (internal)
 * @access Protected
 */
router.post('/ingest', authMiddleware, ingestFiles);

/**
 * @route POST /api/cognee/analyze-pr
 * @desc  Analyze a PR using graph context + Claude (internal)
 * @access Protected
 */
router.post('/analyze-pr', authMiddleware, analyzePREndpoint);

export default router;
