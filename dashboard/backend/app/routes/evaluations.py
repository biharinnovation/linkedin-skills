"""AI Evaluation and Quality Center endpoints."""
from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..config import DATA_DIR
from ..database import get_db
from ..models import EvaluationRecord, EvaluationTriggerRequest, TaskCreate, TaskPriority
from .tasks import create_task

router = APIRouter(prefix="/evaluations", tags=["Evaluations"])


def _row_to_eval_record(row: Any) -> EvaluationRecord:
    d = dict(row)
    results = {}
    try:
        results = json.loads(d["results_json"])
    except Exception:
        pass

    return EvaluationRecord(
        id=d["id"],
        backend=d["backend"],
        model=d.get("model"),
        total_cases=d["total_cases"],
        passed_count=d["passed_count"],
        failed_count=d["failed_count"],
        skipped_count=d["skipped_count"],
        results=results,
        created_at=str(d["created_at"]),
    )


def _sync_saved_eval_files() -> None:
    """Scan data directory for any eval_output_*.json files and persist into DB if not present."""
    if not DATA_DIR.is_dir():
        return

    for p in DATA_DIR.glob("eval_output_*.json"):
        try:
            content = p.read_text(encoding="utf-8")
            data = json.loads(content)
            eval_id = p.stem
            with get_db() as conn:
                cur = conn.execute("SELECT id FROM evaluation_history WHERE id = ?", (eval_id,))
                if not cur.fetchone():
                    cases = data.get("cases", [])
                    total = len(cases)
                    passed = sum(1 for c in cases if c.get("status") == "PASS")
                    failed = sum(1 for c in cases if c.get("status") == "FAIL")
                    skipped = sum(1 for c in cases if c.get("status") == "SKIP")
                    backend = data.get("backend", "gemini")
                    model = data.get("model")

                    conn.execute(
                        """
                        INSERT INTO evaluation_history (id, backend, model, total_cases, passed_count, failed_count, skipped_count, results_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (eval_id, backend, model, total, passed, failed, skipped, content),
                    )
        except Exception:
            continue


@router.get("", response_model=List[EvaluationRecord])
def list_evaluations():
    """List historical evaluation runs."""
    _sync_saved_eval_files()
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM evaluation_history ORDER BY created_at DESC LIMIT 50")
        return [_row_to_eval_record(r) for r in cur.fetchall()]


@router.get("/cases")
def list_eval_cases():
    """List available evaluation test cases from the suite."""
    from evals.run_evals import CASES

    return [
        {"id": c.name, "description": c.description, "skill": c.skill, "requires_backend": True}
        for c in CASES
    ]


@router.post("/run")
def trigger_evaluation(payload: EvaluationTriggerRequest):
    """Trigger a live evaluation run using the specified backend (Gemini or Claude)."""
    task_payload = TaskCreate(
        title=f"Evaluation Suite ({payload.backend.upper()}{f' - {payload.case}' if payload.case else ''})",
        description=f"Run LinkedIn skills evaluation suite against backend '{payload.backend}'",
        skill_name="linkedin-pipeline-eval",
        task_type="run_evals",
        priority=TaskPriority.HIGH,
        parameters={"backend": payload.backend, "model": payload.model, "case": payload.case},
        auto_start=True,
    )
    return create_task(task_payload)


@router.get("/{eval_id}", response_model=EvaluationRecord)
def get_evaluation_detail(eval_id: str):
    """Retrieve details and case breakdown of a specific evaluation run."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM evaluation_history WHERE id = ?", (eval_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Evaluation run {eval_id} not found")
        return _row_to_eval_record(row)
