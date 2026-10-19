# LinkedIn Skills Operations Dashboard — Setup & Operations Guide

## Overview

The LinkedIn Skills Operations Dashboard provides a complete, production-grade web control center for the `linkedin-skills` automation toolkit. It replaces routine terminal interactions with a secure, responsive, dark-mode web application while keeping the existing repository, skills contracts, and CLI workflows completely intact.

---

## Architecture

- **Backend:** Python FastAPI (`dashboard/backend/app/`), executing under the project's virtual environment (`.venv/bin/python`).
- **Persistence:** SQLite (`dashboard/data/dashboard.sqlite3`) with WAL journal mode, automatic schema migrations, and server crash recovery.
- **Worker & Supervisor:** Async background queue (`dashboard/backend/app/worker.py`) utilizing strict subprocess argument arrays (`asyncio.create_subprocess_exec`) without shell interpolation.
- **Security & Redaction:** Real-time log sanitization (`dashboard/backend/app/security.py`) redacting API tokens (`sk_*`, `apify_api_*`, `pf_live_*`, `AIzaSy*`, Bearer tokens) and path traversal validation.
- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS (`dashboard/frontend/`), designed with a restrained charcoal/graphite palette (`#0B0E14`, `#111622`) and LinkedIn blue accents (`#0A66C2`).

---

## Directory Structure

```
dashboard/
├── backend/
│   ├── app/
│   │   ├── config.py           # Paths, ports, allowed directories
│   │   ├── database.py         # SQLite connection, migrations, crash recovery
│   │   ├── models.py           # Pydantic request & response schemas
│   │   ├── security.py         # Token redaction and path traversal guards
│   │   ├── worker.py           # Subprocess supervisor & allowlist
│   │   ├── main.py             # FastAPI entrypoint & lifespan
│   │   └── routes/             # Typed API routers (system, skills, tasks, etc.)
│   ├── requirements.txt        # FastAPI, Uvicorn, Pydantic, HTTPX
│   └── tests/                  # Unit and API integration test suite
├── data/                       # Local runtime SQLite DB & logs (gitignored)
└── frontend/                   # Next.js 14 TypeScript web dashboard
    ├── src/
    │   ├── app/                # Pages: Overview, Tasks, Workflows, Skills, Assets, etc.
    │   ├── components/         # Sidebar, Header, Modals, Shell
    │   └── lib/api.ts          # Typed client
    └── package.json
```

---

## macOS Quickstart

### 1. Start the Backend API Server

In your primary terminal:

```bash
cd ~/linkedin-skills
source .venv/bin/activate
pip install -r dashboard/backend/requirements.txt
python -m uvicorn dashboard.backend.app.main:app --host 127.0.0.1 --port 8000
```

The backend starts at `http://127.0.0.1:8000`. You can inspect the interactive OpenAPI documentation at `http://127.0.0.1:8000/docs`.

### 2. Start the Frontend Dashboard

In a second terminal:

```bash
cd ~/linkedin-skills/dashboard/frontend
npm install
npm run dev
```

Open your browser to:
```
http://localhost:3000
```

---

## Key Dashboard Capabilities

### 1. Main Overview (`/`)
- Live system status, active skills count (12/12 verified), pending queue count, and background worker status.
- Urgent **Human Approval Gate** alert banner for any pending external actions (such as live post publications or comment scheduling).
- Live integration status breakdown showing real configured vs. fallback states.

### 2. Task Management (`/tasks`)
- Filter tasks by status (`Pending`, `Queued`, `Running`, `Needs Approval`, `Completed`, `Failed`, `Cancelled`), priority, or search term.
- Queue pending tasks, cancel running tasks, and retry failed tasks with automatic retry-count tracking.
- Inspect full task detail, parameters JSON, output payload, and linked subprocess execution logs.

### 3. Workflow Monitor (`/workflows`)
- Honest visualization of pipeline progression: Dispatched → Queued → Subprocess Execution → Safety Gate → Final Outcome.
- Displays real start times, duration, and exit codes without fabricating multi-step stages for simple commands.

### 4. Skills Registry (`/skills`)
- Automatically discovers all 12 repository skills by parsing `skills/*/SKILL.md` YAML frontmatter.
- Identifies sub-skills (e.g. `post-audit`, `detector-tester`, `rules-explainer`), runnable scripts, and reference documents.
- Click any skill to inspect its complete instructions and execution contract in a reader drawer.

### 5. Asset Library (`/assets`)
- Safely browses approved repository directories (`docs/`, `references/`, `evals/`, `testing/`, and `dashboard/data/exports/`).
- Full path traversal protection: blocks access to `.env`, private keys, hidden directories, or arbitrary machine files.
- Live preview for Markdown, JSON, Python, and images, plus safe direct downloads.

### 6. Execution Center (`/executions`)
- Live inspection of all subprocess runs with duration, exit code, and timestamps.
- Displays sanitized standard output and standard error with sensitive credentials (`APIFY_TOKEN`, `PUBLORA_API_KEY`, `PIXFARO_TOKEN`, `GEMINI_API_KEY`) automatically redacted.

### 7. AI Quality & Evaluation Center (`/evaluations`)
- Direct integration with `evals/run_evals.py`.
- Select between **Gemini API** and **Claude CLI** backends.
- Select specific models (e.g. `gemini-flash-latest`, `gemini-pro-latest`) and individual test cases (e.g. `humanizer-audit`).
- Displays real pass/fail/skip counts without mislabeling skipped cases.

### 8. Integrations & Settings (`/integrations`)
- Live checks for Apify, Publora, Pixfaro, Claude CLI, and Gemini API.
- Non-destructive **Run Offline Config Test** button invoking `scripts/check_config.py --offline`.
- Displays setup guides and copyable `.env` snippets without exposing sensitive keys.

---

## Verified Test Suites

Run these anytime to ensure complete system integrity:

1. **Dashboard Backend Tests (17 tests):**
   ```bash
   .venv/bin/python -m unittest discover -s dashboard/backend/tests
   ```
2. **Repository Unit Tests (145 tests):**
   ```bash
   .venv/bin/python -m unittest discover -s tests
   ```
3. **Repository Selftest Suite:**
   ```bash
   .venv/bin/python scripts/selftest.py
   ```
4. **Offline Credentials Check:**
   ```bash
   .venv/bin/python scripts/check_config.py --offline
   ```
5. **Skill Frontmatter & Secret Scans:**
   ```bash
   .venv/bin/python scripts/check_frontmatter.py
   .venv/bin/python scripts/check_no_secrets.py
   ```
6. **Frontend Production Build:**
   ```bash
   cd dashboard/frontend && npm run build
   ```
