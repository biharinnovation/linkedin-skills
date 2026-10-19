"""System health and integration status endpoints."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
from typing import List
from fastapi import APIRouter
from ..config import ROOT_DIR
from ..database import get_db
from ..models import SystemHealthResponse, IntegrationStatus

router = APIRouter(prefix="/system", tags=["System"])


def get_integration_statuses() -> List[IntegrationStatus]:
    """Inspect integration credentials without revealing secrets."""
    integrations = []

    # 1. Apify
    apify_token = os.getenv("APIFY_TOKEN")
    has_apify = bool(apify_token and apify_token.strip())
    integrations.append(
        IntegrationStatus(
            name="Apify",
            tier="Data Ingestion (Read Layer)",
            configured=has_apify,
            status="Configured" if has_apify else "Not configured (Paste text fallback active)",
            required_env=["APIFY_TOKEN"],
            capabilities=["Post scraping", "Comments scraping", "Engagers scraping", "User recent comments"],
            limitations=["Requires active Apify compute units when live calls are made"],
        )
    )

    # 2. Publora
    publora_key = os.getenv("PUBLORA_API_KEY")
    publora_platform = os.getenv("LINKEDIN_PLATFORM_ID")
    has_publora = bool(publora_key and publora_platform)
    integrations.append(
        IntegrationStatus(
            name="Publora",
            tier="Publishing & Scheduling (Write Layer)",
            configured=has_publora,
            status="Configured" if has_publora else "Not configured (Manual copy-paste fallback active)",
            required_env=["PUBLORA_API_KEY", "LINKEDIN_PLATFORM_ID"],
            capabilities=["Direct post publishing", "Post scheduling", "Comment posting", "Post resharing"],
            limitations=["Both PUBLORA_API_KEY and LINKEDIN_PLATFORM_ID must be set together"],
        )
    )

    # 3. Pixfaro
    pixfaro_token = os.getenv("PIXFARO_TOKEN") or os.getenv("PIXFARO_API_KEY")
    has_pixfaro = bool(pixfaro_token and pixfaro_token.strip())
    integrations.append(
        IntegrationStatus(
            name="Pixfaro",
            tier="Image Generation (Asset Layer)",
            configured=has_pixfaro,
            status="Configured" if has_pixfaro else "Not configured (Generates prompts for manual generation)",
            required_env=["PIXFARO_TOKEN"],
            capabilities=["Automated visual asset generation", "Text-to-image pipeline for posts"],
            limitations=["Requires active Pixfaro account balance"],
        )
    )

    # 4. Gemini API
    gemini_key = os.getenv("GEMINI_API_KEY")
    has_gemini = bool(gemini_key and gemini_key.strip())
    integrations.append(
        IntegrationStatus(
            name="Gemini API",
            tier="AI Evaluation Backend",
            configured=has_gemini,
            status="Ready (Live evaluations supported)" if has_gemini else "Not configured",
            required_env=["GEMINI_API_KEY"],
            capabilities=["Deterministic skill grading", "Multi-turn evaluation test cases", "Model selection (flash/pro)"],
            limitations=["Requires Google AI Studio API key"],
        )
    )

    # 5. Claude CLI
    claude_bin = shutil.which("claude")
    integrations.append(
        IntegrationStatus(
            name="Claude Code CLI",
            tier="AI Evaluation Backend",
            configured=bool(claude_bin),
            status="CLI Installed" if claude_bin else "Binary not in PATH",
            required_env=["claude auth (OAuth session)"],
            capabilities=["Native Claude skill evaluation runner"],
            limitations=["Requires active OAuth session (`claude login`)"],
        )
    )

    return integrations


@router.get("/health", response_model=SystemHealthResponse)
def get_system_health():
    """Retrieve operational system health, task queues, and integration status."""
    skills_dir = ROOT_DIR / "skills"
    skill_count = len(list(skills_dir.glob("*/SKILL.md"))) if skills_dir.exists() else 0

    pending_tasks = 0
    running_tasks = 0
    pending_approvals = 0
    db_status = "connected"

    try:
        with get_db() as conn:
            pending_cur = conn.execute("SELECT COUNT(*) FROM tasks WHERE status IN ('pending', 'queued')")
            pending_tasks = pending_cur.fetchone()[0]

            running_cur = conn.execute("SELECT COUNT(*) FROM tasks WHERE status = 'running'")
            running_tasks = running_cur.fetchone()[0]

            approval_cur = conn.execute("SELECT COUNT(*) FROM approvals WHERE status = 'pending'")
            pending_approvals = approval_cur.fetchone()[0]
    except Exception as e:
        db_status = f"error: {e}"

    return SystemHealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        python_version=sys.version.split()[0],
        active_skills_count=skill_count,
        db_status=db_status,
        pending_tasks=pending_tasks,
        running_tasks=running_tasks,
        pending_approvals=pending_approvals,
        integrations=get_integration_statuses(),
    )


@router.get("/integrations", response_model=List[IntegrationStatus])
def get_integrations():
    """Retrieve all integration status rows."""
    return get_integration_statuses()


@router.post("/integrations/validate-offline")
def run_offline_validation():
    """Execute offline configuration check script without network calls."""
    res = subprocess.run(
        [sys.executable, str(ROOT_DIR / "scripts" / "check_config.py"), "--offline"],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
    )
    return {
        "success": res.returncode == 0,
        "output": res.stdout,
        "errors": res.stderr,
    }
