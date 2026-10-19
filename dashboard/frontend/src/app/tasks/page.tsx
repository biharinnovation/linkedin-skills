"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import TaskDetailModal from "@/components/TaskDetailModal";
import { api, Task } from "@/lib/api";
import {
  Search,
  Filter,
  Play,
  RotateCcw,
  Ban,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Plus,
} from "lucide-react";

const STATUSES = [
  { id: "", label: "All Tasks" },
  { id: "pending", label: "Pending" },
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "needs_approval", label: "Needs Approval" },
  { id: "completed", label: "Completed" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        search: searchQuery || undefined,
        limit: 100,
      });
      setTasks(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, priorityFilter, searchQuery]);

  const handleQueue = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.queueTask(id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancel = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.cancelTask(id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.retryTask(id);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
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
      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const priorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: "text-rose-400 font-semibold",
      high: "text-amber-400 font-medium",
      medium: "text-slate-300",
      low: "text-slate-500",
    };
    return <span className={`text-xs uppercase font-mono ${styles[priority] || ""}`}>{priority}</span>;
  };

  return (
    <DashboardShell
      title="Task Management"
      subtitle="Lifecycle, Queue States, and Execution Supervision"
      onRefresh={fetchTasks}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Filter Controls Row */}
        <div className="p-4 rounded-xl bg-surface border border-borderline flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, ID, or skill..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-3">
            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-300 focus:outline-none focus:border-accent"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* Status Tab Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 border-b border-borderline">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === s.id
                  ? "bg-accent/20 text-accent-light border border-accent/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-surface"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Tasks Table */}
        <div className="rounded-xl bg-surface border border-borderline overflow-hidden shadow-sm">
          {loading && tasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading persisted tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No tasks found matching the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borderline bg-canvas/60 text-slate-400 font-medium">
                    <th className="py-3 px-4">Task ID</th>
                    <th className="py-3 px-4">Title & Type</th>
                    <th className="py-3 px-4">Skill</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderline">
                  {tasks.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTaskId(t.id)}
                      className="hover:bg-surface-hover/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {t.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-200 max-w-xs truncate">{t.title}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{t.task_type}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-accent-light">
                        {t.skill_name || "—"}
                      </td>
                      <td className="py-3 px-4">{priorityBadge(t.priority)}</td>
                      <td className="py-3 px-4">{statusBadge(t.status)}</td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {t.created_at}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
                          {(t.status === "pending" || t.status === "assigned") && (
                            <button
                              onClick={(e) => handleQueue(e, t.id)}
                              className="p-1.5 rounded hover:bg-accent/20 text-accent-light"
                              title="Queue task"
                            >
                              <Play size={14} />
                            </button>
                          )}
                          {(t.status === "running" || t.status === "queued" || t.status === "pending") && (
                            <button
                              onClick={(e) => handleCancel(e, t.id)}
                              className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400"
                              title="Cancel task"
                            >
                              <Ban size={14} />
                            </button>
                          )}
                          {(t.status === "failed" || t.status === "cancelled") && (
                            <button
                              onClick={(e) => handleRetry(e, t.id)}
                              className="p-1.5 rounded hover:bg-slate-700 text-slate-300"
                              title="Retry task"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedTaskId(t.id)}
                            className="p-1.5 rounded hover:bg-surface-card text-slate-400 hover:text-slate-200"
                            title="Inspect details"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={fetchTasks}
      />
    </DashboardShell>
  );
}
