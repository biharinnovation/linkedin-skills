"""Configuration and path settings for the dashboard backend."""
from __future__ import annotations

import os
from pathlib import Path

# Paths relative to the project root
ROOT_DIR = Path(__file__).resolve().parents[3]
DASHBOARD_DIR = ROOT_DIR / "dashboard"
DATA_DIR = DASHBOARD_DIR / "data"
LOGS_DIR = DATA_DIR / "logs"
ASSETS_EXPORT_DIR = DATA_DIR / "exports"
DB_PATH = DATA_DIR / "dashboard.sqlite3"

# Ensure data runtime directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)
ASSETS_EXPORT_DIR.mkdir(parents=True, exist_ok=True)

# Server configuration
HOST = os.getenv("DASHBOARD_HOST", "127.0.0.1")
PORT = int(os.getenv("DASHBOARD_PORT", "8000"))
CORS_ORIGINS = [
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

# Safe asset scanning allowlist
ALLOWED_ASSET_DIRECTORIES = [
    ROOT_DIR / "testing",
    ROOT_DIR / "evals",
    ROOT_DIR / "references",
    ROOT_DIR / "docs",
    ASSETS_EXPORT_DIR,
]
