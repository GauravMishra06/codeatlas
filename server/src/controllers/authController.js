import jwt from 'jsonwebtoken';
import { Octokit } from 'octokit';
import User from '../models/User.js';

/**
 * Redirect the user to GitHub's OAuth authorization page.
 * Scopes requested: user, repo, read:org.
 *
 * @route GET /auth/github
 */
async function githubRedirect(req, res) {
  try {
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${req.protocol}://${req.get('host')}/auth/github/callback`,
      scope: 'user repo read:org',
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (err) {
    console.error('❌ GitHub redirect failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to initiate GitHub login' });
  }
}

/**
 * Handle the OAuth callback from GitHub.
 * Exchanges the temporary code for an access token, fetches
 * the user profile, upserts the user in MongoDB, signs a JWT,
 * and redirects to the client app with the token.
 *
 * @route GET /auth/github/callback
 */
async function githubCallback(req, res) {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('❌ GitHub OAuth error:', tokenData.error_description);
      return res.status(401).json({ success: false, error: 'GitHub OAuth failed' });
    }

    const accessToken = tokenData.access_token;

    // Fetch user profile from GitHub
    const octokit = new Octokit({ auth: accessToken });
    const { data: ghUser } = await octokit.rest.users.getAuthenticated();

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { githubId: String(ghUser.id) },
      {
        githubId: String(ghUser.id),
        username: ghUser.login,
        avatar: ghUser.avatar_url,
        accessToken,
      },
      { upsert: true, new: true }
    );

    // Sign JWT
    const token = jwt.sign(
      { userId: user._id, githubId: user.githubId },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to client with token
    res.redirect(`${process.env.CLIENT_URL}/dashboard?token=${token}`);
  } catch (err) {
    console.error('❌ GitHub callback failed:', err.message);
    res.redirect(`${process.env.CLIENT_URL}?error=auth_failed`);
  }
}

/**
 * Return the currently authenticated user's profile.
 * Requires a valid JWT (enforced by auth middleware).
 *
 * @route GET /auth/me
 */
async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select('-accessToken');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error('❌ getMe failed:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch user profile' });
  }
}

/**
 * JWT authentication middleware.
 * Extracts the token from the Authorization header, verifies it,
 * and attaches `req.userId` for downstream handlers.
 */
function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId;
    req.githubId = decoded.githubId;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export { githubRedirect, githubCallback, getMe, authMiddleware };
