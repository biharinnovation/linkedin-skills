"""Task management endpoints: lifecycle, transitions, query, and controls."""
from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import TaskCreate, TaskResponse, TaskStatus, TaskUpdate, TaskPriority
from ..worker import get_worker

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def _row_to_task(row: Any) -> TaskResponse:
    d = dict(row)
    params = {}
    result = {}
    try:
        if d.get("parameters_json"):
            params = json.loads(d["parameters_json"])
    except Exception:
        pass
    try:
        if d.get("result_json"):
            result = json.loads(d["result_json"])
    except Exception:
        pass

    return TaskResponse(
        id=d["id"],
        title=d["title"],
        description=d.get("description"),
        skill_name=d.get("skill_name"),
        task_type=d["task_type"],
        status=TaskStatus(d["status"]),
        priority=TaskPriority(d["priority"]),
        owner=d.get("owner", "user"),
        progress=d.get("progress", 0),
        parameters=params,
        result=result,
        error_message=d.get("error_message"),
        created_at=str(d["created_at"]),
        started_at=str(d["started_at"]) if d.get("started_at") else None,
        completed_at=str(d["completed_at"]) if d.get("completed_at") else None,
        retry_count=d.get("retry_count", 0),
    )


@router.get("", response_model=Dict[str, Any])
def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    skill_name: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List tasks with filtering, search, and pagination."""
    query = "SELECT * FROM tasks WHERE 1=1"
    params: List[Any] = []

    if status:
        query += " AND status = ?"
        params.append(status)
    if priority:
        query += " AND priority = ?"
        params.append(priority)
    if skill_name:
        query += " AND skill_name = ?"
        params.append(skill_name)
    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR id LIKE ?)"
        wildcard = f"%{search}%"
        params.extend([wildcard, wildcard, wildcard])

    count_query = query.replace("SELECT *", "SELECT COUNT(*)")

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    with get_db() as conn:
        total = conn.execute(count_query, params[:-2]).fetchone()[0]
        cur = conn.execute(query, params)
        tasks = [_row_to_task(row) for row in cur.fetchall()]

    return {"total": total, "items": tasks, "limit": limit, "offset": offset}


@router.post("", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate):
    """Create a new task and optionally queue it for execution."""
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    initial_status = TaskStatus.QUEUED if payload.auto_start else TaskStatus.PENDING

    with get_db() as conn:
        conn.execute(
            """
            INSERT INTO tasks (id, title, description, skill_name, task_type, status, priority, owner, parameters_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                payload.title,
                payload.description,
                payload.skill_name,
                payload.task_type,
                initial_status.value,
                payload.priority.value,
                payload.owner,
                json.dumps(payload.parameters),
            ),
        )
        cur = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()

    return _row_to_task(row)


@router.get("/{task_id}")
def get_task(task_id: str):
    """Get full task details including executions and approvals."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        task = _row_to_task(row)

        exec_cur = conn.execute("SELECT * FROM executions WHERE task_id = ? ORDER BY started_at DESC", (task_id,))
        executions = [dict(r) for r in exec_cur.fetchall()]

        appr_cur = conn.execute("SELECT * FROM approvals WHERE task_id = ? ORDER BY created_at DESC", (task_id,))
        approvals = [dict(r) for r in appr_cur.fetchall()]

    return {"task": task, "executions": executions, "approvals": approvals}


@router.patch("/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, payload: TaskUpdate):
    """Update task metadata like title, description, or priority."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        updates = []
        vals = []
        if payload.title is not None:
            updates.append("title = ?")
            vals.append(payload.title)
        if payload.description is not None:
            updates.append("description = ?")
            vals.append(payload.description)
        if payload.priority is not None:
            updates.append("priority = ?")
            vals.append(payload.priority.value)
        if payload.owner is not None:
            updates.append("owner = ?")
            vals.append(payload.owner)

        if updates:
            vals.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(updates)} WHERE id = ?", vals)

        updated_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return _row_to_task(updated_row)


@router.post("/{task_id}/queue", response_model=TaskResponse)
def queue_task(task_id: str):
    """Queue an assigned or pending task for execution."""
    with get_db() as conn:
        cur = conn.execute("SELECT status FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        current_status = row[0]
        if current_status not in ("pending", "assigned"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot queue task in state '{current_status}'. Only pending or assigned tasks can be queued.",
            )

        conn.execute("UPDATE tasks SET status = 'queued' WHERE id = ?", (task_id,))
        updated_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return _row_to_task(updated_row)


@router.post("/{task_id}/cancel", response_model=TaskResponse)
def cancel_task(task_id: str):
    """Cancel a pending, queued, or running task safely."""
    with get_db() as conn:
        cur = conn.execute("SELECT status FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        current_status = row[0]
        if current_status in ("completed", "failed", "cancelled"):
            raise HTTPException(status_code=400, detail=f"Cannot cancel task already in terminal state '{current_status}'")

        if current_status == "running":
            worker = get_worker()
            worker.stop()

        conn.execute(
            "UPDATE tasks SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (task_id,),
        )
        updated_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return _row_to_task(updated_row)


@router.post("/{task_id}/retry", response_model=TaskResponse)
def retry_task(task_id: str):
    """Retry a failed or cancelled task."""
    with get_db() as conn:
        cur = conn.execute("SELECT status, retry_count FROM tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")

        current_status = row[0]
        retry_count = row[1]
        if current_status not in ("failed", "cancelled"):
            raise HTTPException(
                status_code=400,
                detail=f"Cannot retry task in state '{current_status}'. Only failed or cancelled tasks can be retried.",
            )

        conn.execute(
            """
            UPDATE tasks
            SET status = 'queued',
                progress = 0,
                error_message = NULL,
                started_at = NULL,
                completed_at = NULL,
                retry_count = ?
            WHERE id = ?
            """,
            (retry_count + 1, task_id),
        )
        updated_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()

    return _row_to_task(updated_row)
