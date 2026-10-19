"""Pydantic request and response schemas for the LinkedIn Skills Dashboard."""
from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    QUEUED = "queued"
    RUNNING = "running"
    NEEDS_APPROVAL = "needs_approval"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    skill_name: Optional[str] = None
    task_type: str = Field(..., min_length=1, max_length=100)
    priority: TaskPriority = TaskPriority.MEDIUM
    owner: str = "user"
    parameters: Dict[str, Any] = Field(default_factory=dict)
    auto_start: bool = False


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[TaskPriority] = None
    owner: Optional[str] = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    skill_name: Optional[str] = None
    task_type: str
    status: TaskStatus
    priority: TaskPriority
    owner: str
    progress: int
    parameters: Dict[str, Any]
    result: Dict[str, Any]
    error_message: Optional[str] = None
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    retry_count: int


class ExecutionResponse(BaseModel):
    id: str
    task_id: Optional[str] = None
    command_name: str
    backend_model: Optional[str] = None
    status: str
    exit_code: Optional[int] = None
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    started_at: str
    ended_at: Optional[str] = None
    duration_seconds: Optional[float] = None


class ApprovalResponse(BaseModel):
    id: str
    task_id: str
    title: str
    action_type: str
    target_url: Optional[str] = None
    content_preview: str
    status: str
    created_at: str
    decided_at: Optional[str] = None


class ApprovalDecision(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")
    reason: Optional[str] = None


class SkillSummary(BaseModel):
    name: str
    display_name: str
    description: str
    has_subskills: bool
    subskills: List[str]
    has_scripts: bool
    scripts: List[str]
    supported_actions: List[str]
    doc_path: str


class EvaluationTriggerRequest(BaseModel):
    backend: str = Field("gemini", pattern="^(claude|gemini)$")
    model: Optional[str] = None
    case: Optional[str] = None


class EvaluationRecord(BaseModel):
    id: str
    backend: str
    model: Optional[str] = None
    total_cases: int
    passed_count: int
    failed_count: int
    skipped_count: int
    results: Dict[str, Any]
    created_at: str


class IntegrationStatus(BaseModel):
    name: str
    tier: str
    configured: bool
    status: str
    required_env: List[str]
    capabilities: List[str]
    limitations: List[str]


class SystemHealthResponse(BaseModel):
    status: str
    python_version: str
    active_skills_count: int
    db_status: str
    pending_tasks: int
    running_tasks: int
    pending_approvals: int
    integrations: List[IntegrationStatus]


class AssetFile(BaseModel):
    name: str
    relative_path: str
    size_bytes: int
    extension: str
    category: str
    modified_at: str
