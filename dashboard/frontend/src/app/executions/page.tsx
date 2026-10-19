"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, Execution } from "@/lib/api";
import {
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Search,
  X,
} from "lucide-react";

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);

  const loadExecutions = async () => {
    try {
      setLoading(true);
      const res = await api.getExecutions({ limit: 50 });
      setExecutions(res.items);
      if (res.items.length > 0 && !selectedExecution) {
        setSelectedExecution(res.items[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
    const interval = setInterval(loadExecutions, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <DashboardShell
      title="Execution Center & Subprocess Logs"
      subtitle="Supervised Local Processes, Timeouts, and Sanitized Logs"
      onRefresh={loadExecutions}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-surface border border-borderline flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Zero Shell Interpolation Execution</h2>
              <p className="text-xs text-slate-400">
                Commands are dispatched via strict argument arrays with environment credential redaction.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">Max timeout: 420s</span>
        </div>

        {/* Master-Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
          {/* Left Column: Execution List (5 cols) */}
          <div className="lg:col-span-5 rounded-xl bg-surface border border-borderline flex flex-col overflow-hidden">
            <div className="p-3 border-b border-borderline bg-canvas/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Run History ({executions.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-borderline">
              {executions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">No subprocess runs recorded.</div>
              ) : (
                executions.map((ex) => (
                  <div
                    key={ex.id}
                    onClick={() => setSelectedExecution(ex)}
                    className={`p-3.5 cursor-pointer transition-colors space-y-1.5 ${
                      selectedExecution?.id === ex.id
                        ? "bg-accent/10 border-l-2 border-accent"
                        : "hover:bg-surface-hover/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-400">{ex.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          ex.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : ex.status === "running"
                            ? "bg-amber-500/10 text-amber-400 animate-pulse"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        Exit {ex.exit_code ?? "—"}
                      </span>
                    </div>

                    <p className="text-xs font-mono font-medium text-slate-200 truncate">{ex.command_name}</p>

                    <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-mono">
                      <span>{ex.started_at}</span>
                      {ex.duration_seconds && <span>• {ex.duration_seconds}s</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Execution Log Viewer (7 cols) */}
          <div className="lg:col-span-7 rounded-xl bg-surface border border-borderline flex flex-col overflow-hidden">
            {selectedExecution ? (
              <>
                <div className="p-4 border-b border-borderline bg-canvas/40 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200 font-mono">{selectedExecution.command_name}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">Run ID: {selectedExecution.id}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-canvas border border-borderline text-slate-400 font-mono">
                      Duration: {selectedExecution.duration_seconds ?? "—"}s
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Stdout */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-300">Standard Output (Sanitized)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Secrets Redacted</span>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-canvas border border-borderline text-xs font-mono text-slate-200 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed">
                      {selectedExecution.stdout || "(No standard output)"}
                    </pre>
                  </div>

                  {/* Stderr */}
                  {selectedExecution.stderr && (
                    <div>
                      <span className="block text-xs font-medium text-rose-400 mb-1.5">Standard Error</span>
                      <pre className="p-3.5 rounded-lg bg-rose-950/20 border border-rose-500/20 text-xs font-mono text-rose-300 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed">
                        {selectedExecution.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-500">Select an execution to inspect logs.</div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
