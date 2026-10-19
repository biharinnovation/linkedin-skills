"""Approval workflows for external-facing actions (posting, scheduling, commenting)."""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import ApprovalDecision, ApprovalResponse

router = APIRouter(prefix="/approvals", tags=["Approvals"])


def _row_to_approval(row: Any) -> ApprovalResponse:
    d = dict(row)
    return ApprovalResponse(
        id=d["id"],
        task_id=d["task_id"],
        title=d["title"],
        action_type=d["action_type"],
        target_url=d.get("target_url"),
        content_preview=d["content_preview"],
        status=d["status"],
        created_at=str(d["created_at"]),
        decided_at=str(d["decided_at"]) if d.get("decided_at") else None,
    )


@router.get("", response_model=List[ApprovalResponse])
def list_approvals(status: Optional[str] = Query("pending")):
    """List pending or resolved action approvals."""
    with get_db() as conn:
        if status:
            cur = conn.execute("SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC", (status,))
        else:
            cur = conn.execute("SELECT * FROM approvals ORDER BY created_at DESC")
        return [_row_to_approval(row) for row in cur.fetchall()]


@router.get("/{approval_id}", response_model=ApprovalResponse)
def get_approval(approval_id: str):
    """Get single approval detail."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Approval {approval_id} not found")
        return _row_to_approval(row)


@router.post("/{approval_id}/decision", response_model=ApprovalResponse)
def decide_approval(approval_id: str, decision: ApprovalDecision):
    """Approve or reject a pending external action."""
    with get_db() as conn:
        cur = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Approval {approval_id} not found")

        appr = dict(row)
        if appr["status"] != "pending":
            raise HTTPException(status_code=400, detail=f"Approval already decided with status '{appr['status']}'")

        new_status = decision.decision
        conn.execute(
            "UPDATE approvals SET status = ?, decided_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, approval_id),
        )

        task_id = appr["task_id"]
        if new_status == "approved":
            # Resume task execution in queue
            conn.execute("UPDATE tasks SET status = 'queued', progress = 60 WHERE id = ?", (task_id,))
        else:
            # Action rejected by operator
            reason_msg = f"Rejected by human operator: {decision.reason or 'No reason provided'}"
            conn.execute(
                "UPDATE tasks SET status = 'cancelled', error_message = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                (reason_msg, task_id),
            )

        updated_row = conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()

    return _row_to_approval(updated_row)
