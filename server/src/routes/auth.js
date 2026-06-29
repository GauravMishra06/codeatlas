import { Router } from 'express';
import {
  githubRedirect,
  githubCallback,
  getMe,
  authMiddleware,
} from '../controllers/authController.js';

const router = Router();

/**
 * @route GET /auth/github
 * @desc  Redirect to GitHub OAuth authorization page
 */
router.get('/github', githubRedirect);

/**
 * @route GET /auth/github/callback
 * @desc  Handle GitHub OAuth callback, upsert user, issue JWT
 */
router.get('/github/callback', githubCallback);

/**
 * @route GET /auth/me
 * @desc  Return current authenticated user profile
 * @access Protected
 */
router.get('/me', authMiddleware, getMe);

export default router;
