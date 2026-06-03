# Student Organization Tool

A full-stack academic planner that lets students manage their course hierarchy (years → semesters → courses), track assignments and grades, upload course materials for AI-powered Q&A, run deep research, and prioritize tasks with a built-in ROI engine.

## Features

- **Academic hierarchy** — create academic years, semesters inside each year, and courses inside each semester
- **Event & assignment tracking** — add, edit, and delete events per course; three-state status (to-do / in-progress / completed); supports assignments, exams, lectures, reminders, and other types
- **Grade tracking** — per-course weighted grade calculator with letter grades; earned, current, and best-case grade projections
- **File upload & resource management** — upload PDF, DOCX, or plain-text files per course; text is extracted and optionally embedded for vector search
- **AI syllabus extraction** — upload a syllabus and Claude automatically extracts every scheduled event, assessment, and graded item for human review before saving
- **RAG course Q&A** — ask natural-language questions about a course's uploaded materials; Claude answers using only retrieved chunks (requires Gemini embeddings and a configured Atlas Vector Search index)
- **Deep research** — generate academic search queries via Claude, fetch results from Tavily or Serper, and synthesize a structured summary with inline citations
- **Task management** — cross-domain tasks (Academic, Professional, Personal, Career) with ROI priority scoring (`grade/business value ÷ estimated effort`)
- **Context Mode** — per-task warm-up prompts for AI-assisted context switching
- **Workspace system** — organize views into typed workspaces (Home, Academic, Work, General); persisted in localStorage
- **Global calendar** — month view of all course events; create and delete events inline
- **Omni search / command menu** — ⌘K palette to jump to any course
- **Dark / light theme** — persisted toggle
- **JWT authentication** — register and login; 7-day tokens; encrypted user API key storage (AES-256-GCM)
- **AI rate limiting** — users on the shared server key get 10 AI requests per hour; users who supply their own `x-user-api-key` header are billed to their own Anthropic account with no server-side limit

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 19, Vite, Tailwind CSS v4, Framer Motion, TanStack Query, cmdk |
| Backend   | Node.js, Express 4, ES modules |
| Database  | MongoDB (Atlas recommended for vector search) |
| AI        | Anthropic Claude (claude-sonnet-4-6), Gemini text-embedding-004 (embeddings), Tavily / Serper (research search) |

## Project Structure

```
/
├── client/          React + Vite frontend
│   ├── src/
│   │   ├── components/   Reusable UI pieces (calendar, modals, sidebar, nav)
│   │   ├── context/      WorkspaceContext (workspace state), DomainContext
│   │   ├── hooks/        TanStack Query hooks (useAcademic, useEvents, useTasks, …)
│   │   ├── pages/        LoginPage
│   │   ├── utils/        auth helpers, ROI calc, API warm-up
│   │   └── views/        Full-page views (Dashboard, CourseView, GradesView, …)
│   └── vite.config.js    Dev server proxies /api → localhost:5000
│
└── server/          Express API
    ├── config/       DB connection, Gemini embedding client, search client
    ├── controllers/  Route handlers
    ├── middleware/   JWT protect, AI gatekeeper (key resolution + rate limit), multer upload
    ├── models/       Mongoose schemas (User, Academic/Year, Task, Embedding, …)
    └── routes/       Route declarations
```

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB Atlas cluster (or local MongoDB 7+; Atlas is required for the `$vectorSearch` aggregation stage)
- Anthropic API key (required for AI features)
- Gemini API key (required for RAG embeddings — see note below)
- Tavily or Serper API key (optional — falls back to placeholder results without one)

### Installation

```bash
# Install all dependencies (root, server, client)
npm run install:all
```

### Configure environment

```bash
cp server/.env.example server/.env
# Edit server/.env and fill in all required values
```

### Run

The root `package.json` starts both servers concurrently:

```bash
npm start
```

Or run them separately in two terminals:

```bash
# Terminal 1 — API server (port 5000)
cd server && npm run dev

# Terminal 2 — Vite dev server (port 5173)
cd client && npm run dev
```

Open `http://localhost:5173`.

### Note on RAG / vector search

The Gemini embedding client currently has its embedding call disabled by default (`embed()` returns `[]`). To enable RAG:

1. Set `GEMINI_API_KEY` in `server/.env`.
2. In [`server/config/geminiClient.js`](server/config/geminiClient.js), replace the stub `embed()` function body with a call to `embedBatched` / `batchRequest` (the full implementation is already in the file above the stub).
3. Create the Atlas Search vector index by running `node server/scripts/createVectorIndex.js`.

Course queries and file uploads still work without embeddings — RAG answers just won't be grounded in uploaded materials.

## Environment Variables

All variables live in `server/.env`. Copy from [`server/.env.example`](server/.env.example).

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Port the Express server listens on (default `5000`) |
| `MONGO_URI` | Yes | MongoDB connection string |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | Yes | Long random string used to sign JWTs and encrypt stored API keys. Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `DEFAULT_AI_KEY` | Yes* | Server-side Anthropic key used when callers don't supply their own. Also accepted as `ANTHROPIC_API_KEY`. Subject to 10 req/hr rate limit per user. *Required for any AI feature. |
| `GEMINI_API_KEY` | No | Gemini API key for generating embeddings (RAG). Without this, vector search is unavailable. |
| `TAVILY_API_KEY` | No | Tavily search API key for deep research. Preferred over Serper. |
| `SERPER_API_KEY` | No | Serper Google search API key for deep research. Fallback if Tavily is not set. |

## API Endpoints

### Auth — `/api/auth`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new user; returns JWT + user |
| POST | `/api/auth/login` | Login; returns JWT + user |

### Academic hierarchy — `/api/years` _(requires JWT)_

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/years` | List all academic years (with nested semesters and courses) |
| POST | `/api/years` | Create an academic year |
| DELETE | `/api/years/:yearId` | Delete a year and all its embeddings |
| POST | `/api/years/:yearId/semesters` | Add a semester to a year |
| DELETE | `/api/years/:yearId/semesters/:semId` | Delete a semester |
| POST | `/api/years/:yearId/semesters/:semId/courses` | Add a course to a semester |
| DELETE | `/api/years/:yearId/semesters/:semId/courses/:courseId` | Delete a course |

### Courses — `/api/courses` _(requires JWT)_

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/courses/:id/query` | Ask a question about a course's uploaded materials (RAG via vector search + Claude) |
| POST | `/api/courses/:id/upload` | Upload a file (PDF / DOCX / text); extracts text, generates embeddings, runs syllabus extraction |
| DELETE | `/api/courses/:id/resources/:resourceId` | Delete a resource and its embeddings |
| GET | `/api/courses/:courseId/assignments` | List assignments for a course |
| POST | `/api/courses/:courseId/assignments` | Create an assignment |
| PATCH | `/api/courses/:courseId/assignments/:assignmentId` | Update assignment status |
| POST | `/api/courses/:courseId/events` | Create an event |
| PATCH | `/api/courses/:courseId/events/:eventId` | Update an event (title, date, type, status, grade fields) |
| DELETE | `/api/courses/:courseId/events/:eventId` | Delete an event |
| POST | `/api/courses/:courseId/events/batch` | Batch-create events (used for human-approved syllabus extractions) |

### AI — `/api/ai` _(requires JWT)_

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ai/query` | Global RAG query across a course's materials |

### Research — `/api/research` _(requires JWT)_

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/research/search` | Generate search terms via Claude, fetch web results, synthesize a structured report |
| POST | `/api/research/save` | Save a research summary as a course resource and index it for RAG |

### Tasks — `/api/tasks` _(requires JWT)_

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tasks` | List tasks (filterable by `workspaceId`, `domain`, `status`; sortable by `priority`, `dueDate`, `created`) |
| GET | `/api/tasks/:id` | Get a single task |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update a task |
| DELETE | `/api/tasks/:id` | Delete a task |

## License

MIT
