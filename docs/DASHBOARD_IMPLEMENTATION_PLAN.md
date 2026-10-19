# LinkedIn Skills — Dashboard Architecture & Implementation Plan

## 1. Executive Summary

This document specifies the technical architecture, security model, database schema, API design, and delivery phases for the **LinkedIn Skills Web Dashboard & Operations Control Center**.

The dashboard provides a local-first, production-grade web interface to monitor, manage, and execute automation workflows in the `linkedin-skills` repository without requiring routine terminal command execution, while preserving the existing CLI tools, agent interfaces, and 100% of the repository's unit tests and skill contracts.

---

## 2. Current Repository State & Capabilities

### 2.1 Core Assets
- **12 Canonical Skills (`skills/`, `.claude/skills/`):**
  - `linkedin-comment-drafter`: Drafts targeted comments for feed engagement.
  - `linkedin-content-planner`: Content pillars and scheduling cadences.
  - `linkedin-employee-advocacy`: Team reshares and advocacy posts.
  - `linkedin-engager-analytics`: ICP analysis and engager segmentation.
  - `linkedin-hook-extractor`: Reverse-engineers post hooks against 20 formulas (`references/hook-formulas.md`).
  - `linkedin-humanizer`: Multi-tier de-AI scrubber and post auditor (`sub-skills/post-audit.md`).
  - `linkedin-interviewer`: Subject matter extraction via structured dialogue.
  - `linkedin-post-writer`: Formula-driven drafting and carousel outlining.
  - `linkedin-profile-optimizer`: Headline, About, and Featured section audits.
  - `linkedin-reply-handler`: Two-level threaded comment replies with URN flattening.
  - `linkedin-repurposer`: Long-form to post/carousel conversion.
  - `linkedin-thread-monitor`: Comment thread health and escalation flagging.

- **Client Libraries (`lib/`):**
  - `apify_client.py`: LinkedIn read layer with 256-entry LRU cache, 6-hour TTL, and exponential backoff.
  - `publora_client.py`: Multi-format posting, scheduling, comments, reactions, and URN resolution.
  - `pixfaro_client.py`: Pixel-exact image and quote-card generation.
  - `backend_selector.py`: Multi-tier publishing router (`publora` -> `diy` -> `manual`).
  - `url_parser.py`: Robust URN extraction from LinkedIn post and comment URLs.
  - `approval.py`: Emoji-safe approval card generator for human-in-the-loop confirmation.

- **Automation & Quality Scripts (`scripts/`, `evals/`):**
  - `evals/run_evals.py`: 6 deterministic behavioral evaluations with `--backend claude` and `--backend gemini`.
  - `scripts/selftest.py`: Comprehensive 5-phase health and contract verification.
  - `scripts/check_config.py`: Credentials and tier diagnostics.
  - `scripts/check_frontmatter.py`: Strict YAML manifest validation across all 12 skills.
  - `scripts/check_no_secrets.py`: Credential leakage scanner.
  - `scripts/check_actor_inputs.py`: Apify actor input schema contract verification.
  - `scripts/check_markdown_references.py`: Cross-file Markdown reference resolution.
  - `scripts/schedule_post.py` & `scripts/post_comment.py`: CLI dispatchers with dry-run support.

### 2.2 Gaps Identified
1. **No UI or HTTP API:** Routine tasks currently require terminal commands.
2. **No Persistent Task Lifecycle:** Workflows are executed ad-hoc without a local database tracking state across restarts.
3. **Approval Friction:** Approval cards are printed to stdout, requiring terminal input (`yes/no`).
4. **Asset Visibility:** Generated drafts, evaluation transcripts, and test outputs are scattered across filesystem paths without a visual browser.

---

## 3. Technology Stack & Directory Structure

- **Backend:** Python 3.13 + FastAPI + Uvicorn + Pydantic v2 + SQLite3 (WAL mode).
- **Frontend:** Next.js 14+ (App Router) + TypeScript + Tailwind CSS + Lucide Icons.
- **Theme:** Premium dark minimalist interface (charcoal/zinc `#09090b` background, subtle `#27272a` borders, emerald/cyan accents).

```text
linkedin-skills/
├── dashboard/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py              # FastAPI application entry point
│   │   │   ├── config.py            # Dashboard settings & paths
│   │   │   ├── database.py          # SQLite connection & schema migrations
│   │   │   ├── models.py            # Pydantic request/response schemas
│   │   │   ├── worker.py            # Background task runner & process supervisor
│   │   │   ├── security.py          # Path validation & credential redaction
│   │   │   └── routes/
│   │   │       ├── system.py        # Health, integrations & diagnostic checks
│   │   │       ├── skills.py        # Dynamic skill discovery & inspection
│   │   │       ├── tasks.py         # Task queue, state transitions & dispatch
│   │   │       ├── executions.py    # Subprocess execution logs & history
│   │   │       ├── evaluations.py   # Test/eval triggers & historical results
│   │   │       └── assets.py        # Safe file browser & preview endpoints
│   │   ├── tests/                   # Backend API & worker unit tests
│   │   └── requirements.txt         # Dashboard backend dependencies
│   ├── frontend/                    # Next.js TypeScript frontend
│   │   ├── src/
│   │   │   ├── app/                 # Pages (dashboard, tasks, skills, etc.)
│   │   │   ├── components/          # Reusable UI components & layouts
│   │   │   └── lib/                 # Typed API client & hooks
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   └── data/                        # Local runtime SQLite database & logs (.gitignored)
├── docs/
│   ├── DASHBOARD_IMPLEMENTATION_PLAN.md
│   └── DASHBOARD_SETUP.md
```

---

## 4. Database Schema (SQLite)

Local-first database located at `dashboard/data/dashboard.sqlite3`:

```sql
CREATE TABLE IF NOT EXISTS schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    skill_name TEXT,
    task_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'assigned', 'queued', 'running', 'needs_approval', 'completed', 'failed', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
    owner TEXT DEFAULT 'system',
    progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
    parameters_json TEXT DEFAULT '{}',
    result_json TEXT DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    task_id TEXT,
    command_name TEXT NOT NULL,
    backend_model TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    duration_seconds REAL,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('publish', 'schedule', 'comment', 'reply', 'reshare')),
    target_url TEXT,
    content_preview TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP,
    FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluation_history (
    id TEXT PRIMARY KEY,
    backend TEXT NOT NULL,
    model TEXT,
    total_cases INTEGER NOT NULL,
    passed_count INTEGER NOT NULL,
    failed_count INTEGER NOT NULL,
    skipped_count INTEGER NOT NULL,
    results_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Security & Isolation Architecture

1. **Local Host Binding:** Backend binds strictly to `127.0.0.1:8000`.
2. **Command Allowlist:** No arbitrary shell strings are accepted. Only validated parameter dictionaries targeting specific registered scripts (`run_evals`, `selftest`, `check_config`, `schedule_post_dry_run`, `post_comment_dry_run`, `test_detectors_demo`) are executed via `subprocess.run(args_list)`.
3. **Path Traversal Protection:** File access in the Asset Library strictly resolves canonical paths within an allowlist of project subdirectories (`testing/`, `evals/`, `docs/`, `references/`) and rejects any request containing parent paths (`..`), `.env`, `.git`, or hidden system directories.
4. **Token Sanitization:** All subprocess outputs and error logs pass through regex redactors that scrub potential bearer tokens, API keys (`APIFY_TOKEN`, `PUBLORA_API_KEY`, `PIXFARO_TOKEN`, `GEMINI_API_KEY`), and secret patterns before database insertion or API response transmission.
5. **Git Ignored Runtime State:** `dashboard/data/` is excluded in `.gitignore` to prevent database or temporary logs from being committed.

---

## 6. Phased Implementation Steps

- **Phase 1: Backend Foundation & Persistence**
  - Install dashboard requirements (`fastapi`, `uvicorn`, `pydantic`).
  - Implement SQLite database initialization and schema migrations.
  - Implement dynamic Skill Registry loader reading direct repository manifests.
  - Implement background worker for queue execution and crash recovery.
- **Phase 2: API Endpoints & Verification**
  - Implement `/api/system`, `/api/skills`, `/api/tasks`, `/api/executions`, `/api/evaluations`, and `/api/assets`.
  - Add backend test suite (`dashboard/backend/tests/`) verifying validation, state transitions, security bounds, and redaction.
- **Phase 3: Frontend Web Dashboard**
  - Initialize Next.js TypeScript project under `dashboard/frontend/`.
  - Configure Tailwind CSS dark design system.
  - Build navigation sidebar, system status header, metrics cards, task management table, live execution log drawer, asset viewer, and evaluation runner.
- **Phase 4: End-to-End Integration & Quality Audit**
  - Run full test suite: 145 offline unit tests + new backend API tests.
  - Verify selftest, frontmatter, credential scans, and clean Git status.
