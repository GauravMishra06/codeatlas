import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';

import authRoutes from './routes/auth.js';
import repoRoutes from './routes/repos.js';
import webhookRoutes from './routes/webhooks.js';
import queryRoutes from './routes/query.js';

const app = express();
const httpServer = createServer(app);

/**
 * Initialise Socket.io with CORS matching the client origin.
 * The `io` instance is attached to `app.locals` so controllers
 * can emit events without importing the module directly.
 */
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.locals.io = io;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

// ── Routes ─────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/repos', repoRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/cognee', queryRoutes);

/**
 * Health-check endpoint for uptime monitors and deployment probes.
 * @route GET /health
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ── Socket.io ──────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`⚡ Socket connected: ${socket.id}`);

  socket.on('join:repo', (repoId) => {
    socket.join(`repo:${repoId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });
});

// ── Database + Server Start ────────────────────────────────
const PORT = process.env.PORT || 3000;

/**
 * Connect to MongoDB then start the HTTP server.
 * Exits the process on connection failure.
 */
async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    httpServer.listen(PORT, () => {
      console.log(`🚀 CodeAtlas server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

export { app, io };
