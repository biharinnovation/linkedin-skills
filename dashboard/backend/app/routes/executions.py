"""Execution and process run tracking endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import ExecutionResponse

router = APIRouter(prefix="/executions", tags=["Executions"])


def _row_to_execution(row: Any) -> ExecutionResponse:
    d = dict(row)
    return ExecutionResponse(
        id=d["id"],
        task_id=d.get("task_id"),
        command_name=d["command_name"],
        backend_model=d.get("backend_model"),
        status=d["status"],
        exit_code=d.get("exit_code"),
        stdout=d.get("stdout"),
        stderr=d.get("stderr"),
        started_at=str(d["started_at"]),
        ended_at=str(d["ended_at"]) if d.get("ended_at") else None,
        duration_seconds=d.get("duration_seconds"),
    )


@router.get("", response_model=Dict[str, Any])
def list_executions(
    task_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List execution records with optional filtering."""
    query = "SELECT * FROM executions WHERE 1=1"
    params: List[Any] = []

    if task_id:
        query += " AND task_id = ?"
        params.append(task_id)
    if status:
        query += " AND status = ?"
        params.append(status)

    count_query = query.replace("SELECT *", "SELECT COUNT(*)")
    query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_db() as conn:
        total = conn.execute(count_query, params[:-2]).fetchone()[0]
        cur = conn.execute(query, params)
        executions = [_row_to_execution(row) for row in cur.fetchall()]

    return {"total": total, "items": executions, "limit": limit, "offset": offset}


@router.get("/{exec_id}", response_model=ExecutionResponse)
def get_execution(exec_id: str):
    """Retrieve detailed logs and execution outcome for a specific run."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM executions WHERE id = ?", (exec_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Execution {exec_id} not found")

    return _row_to_execution(row)
