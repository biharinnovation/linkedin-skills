"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import TaskDetailModal from "@/components/TaskDetailModal";
import { api, Task, Execution } from "@/lib/api";
import {
  GitFork,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  RotateCcw,
  Ban,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from "lucide-react";

export default function WorkflowsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({ limit: 20 });
      setTasks(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const renderStageNode = (
    label: string,
    status: "done" | "active" | "pending" | "failed"
  ) => {
    const nodeStyles = {
      done: "bg-emerald-500 text-white border-emerald-400",
      active: "bg-accent text-white border-accent-light animate-pulse",
      pending: "bg-surface-card text-slate-500 border-borderline",
      failed: "bg-rose-500 text-white border-rose-400",
    };

    return (
      <div className="flex flex-col items-center space-y-1">
        <div
          className={`w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold ${nodeStyles[status]}`}
        >
          {status === "done" ? "✓" : status === "failed" ? "✗" : ""}
        </div>
        <span className="text-[10px] font-mono text-slate-400 text-center whitespace-nowrap">{label}</span>
      </div>
    );
  };

  return (
    <DashboardShell
      title="Workflow Monitor"
      subtitle="Execution Pipeline Stages and State Transitions"
      onRefresh={loadWorkflows}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-surface border border-borderline flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Live & Historical Execution Pipelines</h2>
            <p className="text-xs text-slate-400">
              Honest representations of command runs, subprocess execution, and safety approval gates.
            </p>
          </div>
        </div>

        {loading && tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading workflows...</div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No workflow runs recorded yet.</div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => {
              const isNeedsApproval = task.status === "needs_approval";
              const isCompleted = task.status === "completed";
              const isFailed = task.status === "failed";
              const isRunning = task.status === "running";

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="p-5 rounded-xl bg-surface hover:bg-surface-card/60 border border-borderline transition-all cursor-pointer space-y-4"
                >
                  {/* Pipeline Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-borderline/60 pb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent-light">
                        <GitFork size={15} />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-xs text-slate-400">{task.id}</span>
                          <span className="text-xs font-semibold text-slate-200">{task.title}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Skill: {task.skill_name || "core"} • Owner: {task.owner}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 text-xs font-mono">
                      <span className="text-slate-400">Created: {task.created_at}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          isCompleted
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : isFailed
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            : isRunning
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse"
                            : "bg-slate-500/10 text-slate-400 border border-slate-500/30"
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>

                  {/* Visual Pipeline Progression Stages */}
                  <div className="flex items-center justify-between max-w-2xl px-4 py-2 bg-canvas rounded-lg border border-borderline/60">
                    {/* Stage 1: Init / Parameters */}
                    {renderStageNode("1. Dispatched", "done")}

                    <div className="flex-1 h-0.5 bg-borderline mx-2"></div>

                    {/* Stage 2: Queue */}
                    {renderStageNode(
                      "2. Queued",
                      task.status === "pending"
                        ? "pending"
                        : "done"
                    )}

                    <div className="flex-1 h-0.5 bg-borderline mx-2"></div>

                    {/* Stage 3: Subprocess Execution */}
                    {renderStageNode(
                      "3. Subprocess",
                      isRunning
                        ? "active"
                        : isCompleted
                        ? "done"
                        : isFailed
                        ? "failed"
                        : "pending"
                    )}

                    <div className="flex-1 h-0.5 bg-borderline mx-2"></div>

                    {/* Stage 4: Safety / Approval Gate */}
                    {renderStageNode(
                      "4. Safety Gate",
                      isNeedsApproval
                        ? "active"
                        : isCompleted
                        ? "done"
                        : "pending"
                    )}

                    <div className="flex-1 h-0.5 bg-borderline mx-2"></div>

                    {/* Stage 5: Final Outcome */}
                    {renderStageNode(
                      "5. Outcome",
                      isCompleted ? "done" : isFailed ? "failed" : "pending"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={loadWorkflows}
      />
    </DashboardShell>
  );
}
