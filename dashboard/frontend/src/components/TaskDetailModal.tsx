"use client";

import React, { useEffect, useState } from "react";
import { api, Task, Execution, Approval } from "@/lib/api";
import { X, Play, RotateCcw, Ban, Terminal, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export default function TaskDetailModal({ taskId, onClose, onTaskUpdated }: TaskDetailModalProps) {
  const [data, setData] = useState<{ task: Task; executions: Execution[]; approvals: Approval[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "executions" | "approvals">("details");

  const loadDetail = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTask(taskId);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [taskId]);

  if (!taskId) return null;

  const handleQueue = async () => {
    try {
      await api.queueTask(taskId);
      loadDetail();
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelTask(taskId);
      loadDetail();
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetry = async () => {
    try {
      await api.retryTask(taskId);
      loadDetail();
      onTaskUpdated();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    assigned: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    queued: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
    running: "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse",
    needs_approval: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-borderline rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
          <div className="flex items-center space-x-3 overflow-hidden">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-canvas border border-borderline text-slate-400">
              {taskId}
            </span>
            <h2 className="text-base font-semibold text-slate-100 truncate">
              {data?.task.title || "Task Details"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !data && (
            <div className="text-center py-12 text-slate-400 text-sm">Loading task details...</div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* Status Banner */}
              <div className="p-4 rounded-lg bg-canvas border border-borderline flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[data.task.status] || ""}`}>
                    {data.task.status.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Priority: <span className="text-slate-200 uppercase font-semibold">{data.task.priority}</span>
                  </span>
                  {data.task.skill_name && (
                    <span className="text-xs px-2 py-0.5 rounded bg-surface border border-borderline text-accent-light font-mono">
                      {data.task.skill_name}
                    </span>
                  )}
                </div>

                {/* Task Action Controls */}
                <div className="flex items-center space-x-2">
                  {(data.task.status === "pending" || data.task.status === "assigned") && (
                    <button
                      onClick={handleQueue}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium"
                    >
                      <Play size={13} />
                      <span>Queue</span>
                    </button>
                  )}

                  {(data.task.status === "running" || data.task.status === "queued" || data.task.status === "pending") && (
                    <button
                      onClick={handleCancel}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium"
                    >
                      <Ban size={13} />
                      <span>Cancel</span>
                    </button>
                  )}

                  {(data.task.status === "failed" || data.task.status === "cancelled") && (
                    <button
                      onClick={handleRetry}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-borderline text-xs font-medium text-slate-200"
                    >
                      <RotateCcw size={13} />
                      <span>Retry ({data.task.retry_count})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex space-x-4 border-b border-borderline text-xs font-medium">
                <button
                  onClick={() => setActiveTab("details")}
                  className={`pb-2 transition-colors ${
                    activeTab === "details" ? "text-accent-light border-b-2 border-accent" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Overview & Output
                </button>
                <button
                  onClick={() => setActiveTab("executions")}
                  className={`pb-2 transition-colors flex items-center space-x-1.5 ${
                    activeTab === "executions" ? "text-accent-light border-b-2 border-accent" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>Subprocess Runs</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-surface-card border border-borderline text-[10px]">
                    {data.executions.length}
                  </span>
                </button>
                {data.approvals.length > 0 && (
                  <button
                    onClick={() => setActiveTab("approvals")}
                    className={`pb-2 transition-colors flex items-center space-x-1.5 ${
                      activeTab === "approvals" ? "text-accent-light border-b-2 border-accent" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <span>Approvals Gate</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 text-[10px]">
                      {data.approvals.length}
                    </span>
                  </button>
                )}
              </div>

              {/* Tab 1: Details */}
              {activeTab === "details" && (
                <div className="space-y-4">
                  {data.task.error_message && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 font-mono">
                      <div className="font-semibold text-rose-400 mb-1 flex items-center space-x-1.5">
                        <AlertTriangle size={14} />
                        <span>Execution Failure Reason</span>
                      </div>
                      {data.task.error_message}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1">
                      <span className="text-slate-500">Operation Type</span>
                      <p className="font-mono text-slate-200 font-semibold">{data.task.task_type}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1">
                      <span className="text-slate-500">Owner</span>
                      <p className="font-mono text-slate-200">{data.task.owner}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1">
                      <span className="text-slate-500">Created At</span>
                      <p className="font-mono text-slate-300">{data.task.created_at}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1">
                      <span className="text-slate-500">Completed At</span>
                      <p className="font-mono text-slate-300">{data.task.completed_at || "—"}</p>
                    </div>
                  </div>

                  {/* Parameters */}
                  <div>
                    <span className="block text-xs font-medium text-slate-400 mb-1.5">Parameters JSON</span>
                    <pre className="p-3 rounded-lg bg-canvas border border-borderline text-[11px] font-mono text-slate-300 overflow-x-auto">
                      {JSON.stringify(data.task.parameters, null, 2)}
                    </pre>
                  </div>

                  {/* Output Result */}
                  {Object.keys(data.task.result || {}).length > 0 && (
                    <div>
                      <span className="block text-xs font-medium text-slate-400 mb-1.5">Result Payload</span>
                      <pre className="p-3 rounded-lg bg-canvas border border-borderline text-[11px] font-mono text-emerald-400 overflow-x-auto">
                        {JSON.stringify(data.task.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Executions */}
              {activeTab === "executions" && (
                <div className="space-y-4">
                  {data.executions.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500">No subprocess executions recorded yet.</div>
                  ) : (
                    data.executions.map((ex) => (
                      <div key={ex.id} className="p-4 rounded-lg bg-canvas border border-borderline space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-slate-200">{ex.command_name}</span>
                          <span className={`px-2 py-0.5 rounded text-[11px] ${ex.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                            Status: {ex.status} (exit {ex.exit_code ?? "?"})
                          </span>
                        </div>

                        <div className="flex items-center space-x-4 text-[11px] text-slate-500 font-mono">
                          <span>Started: {ex.started_at}</span>
                          {ex.duration_seconds && <span>Duration: {ex.duration_seconds}s</span>}
                        </div>

                        {ex.stdout && (
                          <div>
                            <span className="block text-[11px] text-slate-400 mb-1">Standard Output (Sanitized)</span>
                            <pre className="p-2.5 rounded bg-surface border border-borderline text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {ex.stdout}
                            </pre>
                          </div>
                        )}

                        {ex.stderr && (
                          <div>
                            <span className="block text-[11px] text-rose-400 mb-1">Standard Error</span>
                            <pre className="p-2.5 rounded bg-surface border border-rose-500/20 text-[10px] font-mono text-rose-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                              {ex.stderr}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Approvals */}
              {activeTab === "approvals" && (
                <div className="space-y-3">
                  {data.approvals.map((appr) => (
                    <div key={appr.id} className="p-4 rounded-lg bg-canvas border border-borderline space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-purple-300 uppercase">{appr.action_type} Gate</span>
                        <span className="px-2 py-0.5 rounded text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/30">
                          {appr.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono p-2 rounded bg-surface border border-borderline">
                        {appr.content_preview}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
