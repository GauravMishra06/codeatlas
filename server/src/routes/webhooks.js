import { Router } from 'express';
import { handleGitHubWebhook } from '../controllers/webhookController.js';

const router = Router();

/**
 * @route POST /api/webhooks/github
 * @desc  Handle incoming GitHub webhook events (pull_request)
 * @access Public (verified via HMAC signature)
 */
router.post('/github', handleGitHubWebhook);

export default router;
