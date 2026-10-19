/**
 * Typed API Client for the LinkedIn Skills Dashboard Backend.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface SystemHealth {
  status: string;
  python_version: string;
  active_skills_count: number;
  db_status: string;
  pending_tasks: number;
  running_tasks: number;
  pending_approvals: number;
  integrations: IntegrationStatus[];
}

export interface IntegrationStatus {
  name: string;
  tier: string;
  configured: boolean;
  status: string;
  required_env: string[];
  capabilities: string[];
  limitations: string[];
}

export interface SkillSummary {
  name: string;
  display_name: string;
  description: string;
  has_subskills: boolean;
  subskills: string[];
  has_scripts: boolean;
  scripts: string[];
  supported_actions: string[];
  doc_path: string;
}

export interface SkillDetail extends SkillSummary {
  references: string[];
  instructions_markdown: string;
  related_tasks: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
    completed_at?: string;
  }>;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  skill_name?: string;
  task_type: string;
  status: "pending" | "assigned" | "queued" | "running" | "needs_approval" | "completed" | "failed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  owner: string;
  progress: number;
  parameters: Record<string, any>;
  result: Record<string, any>;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  retry_count: number;
}

export interface Execution {
  id: string;
  task_id?: string;
  command_name: string;
  backend_model?: string;
  status: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface Approval {
  id: string;
  task_id: string;
  title: string;
  action_type: "publish" | "schedule" | "comment" | "reply" | "reshare";
  target_url?: string;
  content_preview: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  decided_at?: string;
}

export interface EvaluationRecord {
  id: string;
  backend: string;
  model?: string;
  total_cases: number;
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  results: Record<string, any>;
  created_at: string;
}

export interface AssetFile {
  name: string;
  relative_path: string;
  size_bytes: number;
  extension: string;
  category: string;
  modified_at: string;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const body = await res.json();
        if (body.detail) errorMsg = body.detail;
      } catch {}
      throw new Error(errorMsg);
    }

    return res.json();
  } catch (err: any) {
    if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
      throw new Error(`Cannot reach backend at ${API_BASE}. Make sure the FastAPI server is running on port 8000.`);
    }
    throw err;
  }
}

export const api = {
  // System
  getHealth: () => request<SystemHealth>("/system/health"),
  getIntegrations: () => request<IntegrationStatus[]>("/system/integrations"),
  validateOffline: () => request<{ success: boolean; output: string; errors: string }>("/system/validate-offline", { method: "POST" }),

  // Skills
  getSkills: () => request<SkillSummary[]>("/skills"),
  getSkillDetail: (name: string) => request<SkillDetail>(`/skills/${name}`),

  // Tasks
  getTasks: (params?: { status?: string; priority?: string; skill_name?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.priority) qs.set("priority", params.priority);
    if (params?.skill_name) qs.set("skill_name", params.skill_name);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    return request<{ total: number; items: Task[]; limit: number; offset: number }>(`/tasks?${qs.toString()}`);
  },
  getTask: (id: string) => request<{ task: Task; executions: Execution[]; approvals: Approval[] }>(`/tasks/${id}`),
  createTask: (data: { title: string; description?: string; skill_name?: string; task_type: string; priority?: string; parameters?: Record<string, any>; auto_start?: boolean }) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(data) }),
  updateTask: (id: string, data: { title?: string; description?: string; priority?: string; owner?: string }) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  queueTask: (id: string) => request<Task>(`/tasks/${id}/queue`, { method: "POST" }),
  cancelTask: (id: string) => request<Task>(`/tasks/${id}/cancel`, { method: "POST" }),
  retryTask: (id: string) => request<Task>(`/tasks/${id}/retry`, { method: "POST" }),

  // Executions
  getExecutions: (params?: { task_id?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.task_id) qs.set("task_id", params.task_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.limit) qs.set("limit", params.limit.toString());
    if (params?.offset) qs.set("offset", params.offset.toString());
    return request<{ total: number; items: Execution[]; limit: number; offset: number }>(`/executions?${qs.toString()}`);
  },
  getExecution: (id: string) => request<Execution>(`/executions/${id}`),

  // Approvals
  getApprovals: (status = "pending") => request<Approval[]>(`/approvals?status=${status}`),
  decideApproval: (id: string, decision: "approved" | "rejected", reason?: string) =>
    request<Approval>(`/approvals/${id}/decision`, { method: "POST", body: JSON.stringify({ decision, reason }) }),

  // Evaluations
  getEvaluations: () => request<EvaluationRecord[]>("/evaluations"),
  getEvaluationCases: () => request<Array<{ id: string; description: string; skill: string }>>("/evaluations/cases"),
  triggerEvaluation: (payload: { backend: "claude" | "gemini"; model?: string; case?: string }) =>
    request<Task>("/evaluations/run", { method: "POST", body: JSON.stringify(payload) }),

  // Assets
  getAssets: (params?: { category?: string; extension?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.extension) qs.set("extension", params.extension);
    if (params?.search) qs.set("search", params.search);
    return request<AssetFile[]>(`/assets?${qs.toString()}`);
  },
  viewAsset: (path: string) => request<{ path: string; extension: string; content: string }>(`/assets/view?path=${encodeURIComponent(path)}`),
  getDownloadUrl: (path: string) => `${API_BASE}/assets/download?path=${encodeURIComponent(path)}`,
};
