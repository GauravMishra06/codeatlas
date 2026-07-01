# 🗺️ CodeAtlas

> **Your codebase has a story. CodeAtlas makes sure your team always knows it.**

CodeAtlas is an AI-powered tool that maintains a **living, interactive map** of your GitHub codebase using [Cognee](https://cognee.ai) as the memory/graph layer. Every PR and commit automatically updates the map. Developers can query the codebase in plain English, see PR impact analysis, and onboard instantly.

Built for the **WeMakeDevs × Cognee Hackathon** — *"The Hangover Part AI: Where's My Context?"* (Jun 29 – Jul 5, 2026).

---

## ✨ Features

- **🗺️ Interactive Code Graph** — Force-directed D3.js visualization of your codebase architecture (files, modules, functions, and their relationships)
- **🔍 PR Impact Analysis** — Automatic analysis of every pull request showing which modules are affected and why
- **💬 Natural Language Queries** — Ask questions about your codebase in plain English and get context-aware answers
- **⚡ Real-Time Updates** — Socket.io-powered live updates when PRs are analyzed
- **🔐 GitHub OAuth** — Secure sign-in with GitHub, scoped to your repositories

---

## 🏗️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React, Vite, TailwindCSS, D3.js, React Query, React Router v6, Socket.io-client |
| **Backend** | Node.js, Express, MongoDB, Mongoose, Cognee SDK, Octokit, JWT, Socket.io |
| **AI** | Gemini API (Google AI Studio) for impact analysis and natural language answers |
| **Deployment** | Vercel (frontend), Render (backend), MongoDB Atlas (database) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- GitHub OAuth App ([create one here](https://github.com/settings/developers))
- Gemini API key ([get one here](https://aistudio.google.com/app/apikey))
- Cognee API key or local setup ([cognee.ai](https://www.cognee.ai))

> [!WARNING]
> **Cognee Integration is Mandatory but Currently Missing:** CodeAtlas relies on Cognee as its core graph-vector memory layer. Because Cognee is a Python SDK without an official Node.js package, the current backend uses a mock implementation in `server/src/services/cognee.js`. **To be fully functional for the hackathon, you must replace the mock by running a separate Python microservice that runs the real Cognee SDK and communicates with this Node backend.**
### 1. Clone the Repository

```bash
git clone https://github.com/GauravMishra06/codeatlas.git
cd codeatlas
```

### 2. Set Up Environment Variables

```bash
# Server
cp .env.example server/.env
# Edit server/.env with your credentials

# Client
echo "VITE_API_URL=http://localhost:3000" > client/.env
```

### 3. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 4. Start Development Servers

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

The app will be available at **http://localhost:5173**.

---

## 📁 Project Structure

```
codeatlas/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components (Graph, PRPanel, Chat, Shared)
│   │   ├── pages/          # Route pages (Landing, Dashboard, Connect, RepoView)
│   │   ├── hooks/          # Custom hooks (useSocket, useGraph, usePRs)
│   │   ├── services/       # API service layer
│   │   └── App.jsx         # Router setup
│   └── package.json
│
├── server/                 # Express backend
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # Express routes
│   │   ├── services/       # Business logic (GitHub, Cognee, Analyzer)
│   │   └── index.js        # Server entry point
│   └── package.json
│
├── .github/workflows/      # CI pipeline
├── .env.example            # Environment variable template
└── README.md
```

---

## 🔧 Configuration

### GitHub OAuth App Setup

1. Go to **GitHub Settings → Developer Settings → OAuth Apps → New OAuth App**
2. Set the **Homepage URL** to `http://localhost:5173`
3. Set the **Authorization callback URL** to `http://localhost:3000/auth/github/callback`
4. Copy the Client ID and Client Secret to `server/.env`

### GitHub Webhook Setup

1. In your connected repository, go to **Settings → Webhooks → Add webhook**
2. Set the **Payload URL** to your deployed backend URL + `/api/webhooks/github`
3. Set the **Content type** to `application/json`
4. Set a **Secret** and copy it to `GITHUB_WEBHOOK_SECRET` in `server/.env`
5. Select **Pull requests** events

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/auth/github` | Initiate GitHub OAuth |
| GET | `/auth/github/callback` | OAuth callback |
| GET | `/auth/me` | Current user profile |
| GET | `/api/repos` | List connected repos |
| POST | `/api/repos/connect` | Connect a new repo |
| GET | `/api/repos/:id/graph` | Get graph data |
| GET | `/api/repos/:id/prs` | List PR events |
| POST | `/api/webhooks/github` | GitHub webhook receiver |
| POST | `/api/cognee/query` | Query codebase in NL |
| POST | `/api/cognee/ingest` | Ingest files |
| POST | `/api/cognee/analyze-pr` | Analyze a PR |

---

## 🎨 Design System

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0D1117` | Page background |
| Card | `#161B22` | Card surfaces |
| Border | `#30363D` | Borders and dividers |
| Text | `#E6EDF3` | Primary text |
| Muted | `#8B949E` | Secondary text |
| Blue | `#58A6FF` | Accent, links, File nodes |
| Green | `#3FB950` | Success, Module nodes |
| Purple | `#BC8CFF` | Function nodes |
| Yellow | `#E3B341` | Feature nodes, warnings |
| Red | `#F78166` | Errors, danger |

---

## 🚢 Deployment

### Frontend → Vercel

1. Connect the repo to Vercel
2. Set the root directory to `client`
3. Add environment variable: `VITE_API_URL` = your Render backend URL

### Backend → Render

1. Create a new Web Service on Render
2. Set the root directory to `server`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add all environment variables from `server/.env`

### Database → MongoDB Atlas

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a database user and whitelist IPs
3. Copy the connection string to `MONGODB_URI`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit with conventional commits: `git commit -m "feat: add new feature"`
4. Push and create a Pull Request

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">
  <sub>Built with ❤️ for the WeMakeDevs × Cognee Hackathon 2026</sub>
</div>