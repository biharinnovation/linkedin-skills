"""SQLite Database access, migrations, and process crash recovery."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Generator
from .config import DB_PATH

SCHEMA_VERSION = 1

MIGRATION_V1 = """
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

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_executions_task_id ON executions(task_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
"""


def get_connection(path: str | None = None) -> sqlite3.Connection:
    """Create a SQLite connection with foreign keys and WAL mode enabled."""
    target_path = str(path or DB_PATH)
    conn = sqlite3.connect(target_path, timeout=10.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def get_db(path: str | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Context manager for SQLite database transactions."""
    conn = get_connection(path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db(path: str | None = None) -> None:
    """Initialize database and execute migrations."""
    with get_db(path) as conn:
        conn.executescript(MIGRATION_V1)
        cur = conn.execute("SELECT version FROM schema_versions WHERE version = ?", (SCHEMA_VERSION,))
        if not cur.fetchone():
            conn.execute("INSERT INTO schema_versions (version) VALUES (?)", (SCHEMA_VERSION,))


def recover_stale_tasks(path: str | None = None) -> int:
    """Recover from unexpected server termination by marking orphaned running tasks as failed."""
    recovered = 0
    with get_db(path) as conn:
        # Mark running tasks as failed
        cur = conn.execute(
            """
            UPDATE tasks
            SET status = 'failed',
                error_message = 'Execution interrupted by server restart',
                completed_at = CURRENT_TIMESTAMP
            WHERE status = 'running'
            """
        )
        recovered += cur.rowcount
        # Mark running executions as failed
        conn.execute(
            """
            UPDATE executions
            SET status = 'failed',
                stderr = 'Execution interrupted by server restart',
                ended_at = CURRENT_TIMESTAMP
            WHERE status = 'running'
            """
        )
    return recovered
