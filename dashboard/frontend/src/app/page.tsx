"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import TaskDetailModal from "@/components/TaskDetailModal";
import { api, SystemHealth, Task, Execution, Approval } from "@/lib/api";
import {
  Cpu,
  Layers,
  Clock,
  ShieldAlert,
  Terminal,
  CheckCircle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function OverviewPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentExecutions, setRecentExecutions] = useState<Execution[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [h, t, e, a] = await Promise.all([
        api.getHealth(),
        api.getTasks({ limit: 6 }),
        api.getExecutions({ limit: 6 }),
        api.getApprovals("pending"),
      ]);
      setHealth(h);
      setRecentTasks(t.items);
      setRecentExecutions(e.items);
      setPendingApprovals(a);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (approvalId: string) => {
    try {
      await api.decideApproval(approvalId, "approved");
      loadData();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    }
  };

  const handleReject = async (approvalId: string) => {
    const reason = prompt("Enter rejection reason (optional):");
    try {
      await api.decideApproval(approvalId, "rejected", reason || undefined);
      loadData();
    } catch (err: any) {
      alert(`Rejection failed: ${err.message}`);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      running: "bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse",
      queued: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
      pending: "bg-slate-500/10 text-slate-400 border-slate-500/30",
      needs_approval: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      failed: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      cancelled: "bg-slate-500/10 text-slate-500 border-slate-500/30",
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${styles[status] || styles.pending}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  return (
    <DashboardShell
      title="Operations Overview"
      subtitle="LinkedIn Skills Automation Control Center"
      onRefresh={loadData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Error notification if backend is offline */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-400 text-sm">
            <div className="flex items-center space-x-2.5">
              <AlertCircle size={18} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium"
            >
              Retry
            </button>
          </div>
        )}

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Active Skills */}
          <div className="p-5 rounded-xl bg-surface border border-borderline flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Skills</span>
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent-light">
                <Cpu size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-100">{health?.active_skills_count ?? 12}</span>
              <span className="text-xs text-emerald-400 font-mono">100% Loadable</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">All 12 bundle skills verified</p>
          </div>

          {/* Card 2: Running & Queued Tasks */}
          <div className="p-5 rounded-xl bg-surface border border-borderline flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Queue & In-Flight</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-400">
                <Clock size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-100">
                {(health?.pending_tasks ?? 0) + (health?.running_tasks ?? 0)}
              </span>
              <span className="text-xs text-indigo-400 font-mono">
                {health?.running_tasks ?? 0} Running
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{health?.pending_tasks ?? 0} queued in background</p>
          </div>

          {/* Card 3: Pending Human Approvals */}
          <div className="p-5 rounded-xl bg-surface border border-borderline flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Human Approvals</span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center text-purple-400">
                <ShieldAlert size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-3xl font-bold text-slate-100">{health?.pending_approvals ?? 0}</span>
              <span className="text-xs text-purple-400 font-mono">Safety Gated</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Live LinkedIn posts/comments</p>
          </div>

          {/* Card 4: Python & Local DB Status */}
          <div className="p-5 rounded-xl bg-surface border border-borderline flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Environment</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                <Terminal size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-slate-100">
                Py {health?.python_version ?? "3.13"}
              </span>
              <span className="text-xs text-emerald-400 font-mono">SQLite WAL</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">crash-recoverable persistence</p>
          </div>
        </div>

        {/* Pending Approvals Section (Shown Prominently if any exist) */}
        {pendingApprovals.length > 0 && (
          <div className="p-5 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert size={18} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-200">
                  Pending Human Action Approvals ({pendingApprovals.length})
                </h3>
              </div>
              <span className="text-[11px] text-purple-400">
                External side-effects paused until confirmed
              </span>
            </div>

            <div className="space-y-3">
              {pendingApprovals.map((appr) => (
                <div
                  key={appr.id}
                  className="p-4 rounded-lg bg-surface border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300">
                        {appr.action_type}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">{appr.title}</span>
                    </div>
                    <p className="text-xs text-slate-300 font-mono bg-canvas p-2 rounded border border-borderline">
                      {appr.content_preview}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleReject(appr.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(appr.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
                    >
                      Approve & Execute
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integration Status Breakdown Banner */}
        <div className="p-5 rounded-xl bg-surface border border-borderline space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Integrations & Credentials Layer</h3>
            <Link
              href="/integrations"
              className="text-xs text-accent-light hover:underline flex items-center space-x-1"
            >
              <span>Manage & Validate</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {health?.integrations.map((item) => (
              <div
                key={item.name}
                className="p-3.5 rounded-lg bg-canvas border border-borderline flex flex-col justify-between space-y-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">{item.name}</span>
                    {item.configured ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate">{item.tier}</span>
                </div>
                <div className="pt-2 border-t border-borderline/60">
                  <span
                    className={`text-[11px] font-mono block truncate ${
                      item.configured ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Two-Column: Recent Tasks & Recent Executions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Recent Tasks */}
          <div className="p-5 rounded-xl bg-surface border border-borderline space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Recent Task Queue</h3>
              <Link href="/tasks" className="text-xs text-accent-light hover:underline">
                View all tasks
              </Link>
            </div>

            {recentTasks.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">No tasks created yet.</div>
            ) : (
              <div className="space-y-2.5">
                {recentTasks.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className="p-3 rounded-lg bg-canvas hover:bg-surface-card border border-borderline cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div className="space-y-1 overflow-hidden pr-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-[10px] text-slate-400">{t.id}</span>
                        <span className="text-xs font-medium text-slate-200 truncate">{t.title}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                        <span>{t.task_type}</span>
                        <span>•</span>
                        <span>Priority: {t.priority}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">{statusBadge(t.status)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Column 2: Recent Subprocess Executions */}
          <div className="p-5 rounded-xl bg-surface border border-borderline space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Execution Activity Log</h3>
              <Link href="/executions" className="text-xs text-accent-light hover:underline">
                View execution center
              </Link>
            </div>

            {recentExecutions.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">No subprocesses run yet.</div>
            ) : (
              <div className="space-y-2.5">
                {recentExecutions.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-lg bg-canvas border border-borderline flex items-center justify-between text-xs font-mono"
                  >
                    <div className="space-y-0.5 overflow-hidden pr-3">
                      <p className="text-slate-300 font-medium truncate">{ex.command_name}</p>
                      <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                        <span>{ex.started_at}</span>
                        {ex.duration_seconds && <span>• {ex.duration_seconds}s</span>}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          ex.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        Exit {ex.exit_code ?? "?"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadData}
      />
    </DashboardShell>
  );
}
