import crypto from 'crypto';
import PREvent from '../models/PREvent.js';
import Repo from '../models/Repo.js';
import User from '../models/User.js';
import { fetchPRDiff } from '../services/github.js';
import { analyzePR } from '../services/analyzer.js';

/**
 * Verify that the incoming webhook request is genuinely from GitHub
 * by comparing the HMAC-SHA256 signature in the X-Hub-Signature-256 header.
 *
 * @param {string} payload   - Raw request body string.
 * @param {string} signature - Value of the X-Hub-Signature-256 header.
 * @returns {boolean} True if the signature is valid.
 */
function verifyWebhookSignature(payload, signature) {
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Handle incoming GitHub webhook events.
 * Currently processes `pull_request` events with actions:
 * opened, synchronize.
 *
 * The handler responds with 200 immediately (GitHub requires a fast response)
 * and runs the analysis pipeline asynchronously.
 *
 * @route POST /api/webhooks/github
 */
async function handleGitHubWebhook(req, res) {
  try {
    // Verify signature
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = JSON.stringify(req.body);

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('⚠️ Invalid webhook signature');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const payload = req.body;

    // Only handle pull_request events
    if (event !== 'pull_request') {
      return res.status(200).json({ success: true, message: 'Event ignored' });
    }

    const { action } = payload;

    // Only handle opened and synchronize actions
    if (action !== 'opened' && action !== 'synchronize') {
      return res.status(200).json({ success: true, message: 'Action ignored' });
    }

    const pr = payload.pull_request;
    const repoId = String(payload.repository.id);
    const prNumber = pr.number;
    const title = pr.title;
    const author = pr.user.login;
    const changedFiles = pr.changed_files
      ? Array.from({ length: pr.changed_files }, (_, i) => `file_${i}`)
      : [];

    // Emit immediate socket event
    const io = req.app.locals.io;
    if (io) {
      io.to(`repo:${repoId}`).emit('pr:received', { prNumber, title });
    }

    // Save PREvent to MongoDB with pending status
    const prEvent = await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      {
        repoId,
        prNumber,
        title,
        author,
        status: 'pending',
      },
      { upsert: true, new: true }
    );

    // Respond immediately to GitHub
    res.status(200).json({ success: true, message: 'Webhook received' });

    // Run analysis in the background (fire-and-forget)
    processWebhookAsync(repoId, prNumber, payload, io).catch((err) => {
      console.error('❌ Background webhook processing failed:', err.message);
    });
  } catch (err) {
    console.error('❌ handleGitHubWebhook failed:', err.message);
    res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
}

/**
 * Async background processing for a webhook event.
 * Fetches the PR diff, then runs the full analysis pipeline.
 *
 * @param {string} repoId   - GitHub repo ID.
 * @param {number} prNumber - PR number.
 * @param {object} payload  - Full webhook payload.
 * @param {object} io       - Socket.io instance.
 */
async function processWebhookAsync(repoId, prNumber, payload, io) {
  try {
    // Find repo and user to get access token
    const repo = await Repo.findOne({ repoId });
    if (!repo) {
      console.error(`⚠️ Repo ${repoId} not found in database, skipping PR analysis`);
      return;
    }

    const user = await User.findById(repo.userId);
    if (!user) {
      console.error('⚠️ User not found for repo, skipping PR analysis');
      return;
    }

    const [owner, repoName] = repo.fullName.split('/');

    // Fetch the full diff
    const diff = await fetchPRDiff(owner, repoName, prNumber, user.accessToken);

    // Update PREvent with diff and changed files
    const prFiles = payload.pull_request?.changed_files
      ? []
      : [];

    // Fetch changed files list from the PR
    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: user.accessToken });
    const { data: filesData } = await octokit.rest.pulls.listFiles({
      owner,
      repo: repoName,
      pull_number: prNumber,
      per_page: 100,
    });

    const changedFiles = filesData.map((f) => f.filename);

    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      { diff: typeof diff === 'string' ? diff : JSON.stringify(diff), changedFiles }
    );

    // Run the full analysis pipeline
    await analyzePR(repoId, prNumber, typeof diff === 'string' ? diff : '', io);

    console.log(`✅ PR #${prNumber} analyzed for repo ${repo.fullName}`);
  } catch (err) {
    console.error(`❌ Async webhook processing failed for PR #${prNumber}:`, err.message);

    await PREvent.findOneAndUpdate(
      { repoId, prNumber },
      { status: 'failed', review: `Analysis failed: ${err.message}` }
    );
  }
}

export { handleGitHubWebhook };
