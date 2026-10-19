"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, EvaluationRecord } from "@/lib/api";
import {
  Award,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Layers,
  ChevronDown,
  Clock,
} from "lucide-react";

export default function EvaluationsPage() {
  const [history, setHistory] = useState<EvaluationRecord[]>([]);
  const [cases, setCases] = useState<Array<{ id: string; description: string; skill: string }>>([]);
  const [backend, setBackend] = useState<"gemini" | "claude">("gemini");
  const [model, setModel] = useState("gemini-flash-latest");
  const [selectedCase, setSelectedCase] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [hist, cs] = await Promise.all([
        api.getEvaluations(),
        api.getEvaluationCases().catch(() => []),
      ]);
      setHistory(hist);
      setCases(cs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriggering(true);
    try {
      await api.triggerEvaluation({
        backend,
        model: backend === "gemini" ? model : undefined,
        case: selectedCase || undefined,
      });
      alert(`Evaluation run queued on backend: ${backend.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      alert(`Failed to trigger evaluation: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  return (
    <DashboardShell
      title="AI Quality & Evaluation Center"
      subtitle="Deterministic Skill Grading across Claude and Gemini Backends"
      onRefresh={loadData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Trigger Evaluation Form Card */}
        <div className="p-6 rounded-xl bg-surface border border-borderline space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent-light">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Run Evaluation Batch</h2>
                <p className="text-xs text-slate-400">
                  Select explicit model backend and test case for deterministic grading.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleTrigger} className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            {/* Backend Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Backend Provider</label>
              <select
                value={backend}
                onChange={(e) => {
                  const b = e.target.value as "gemini" | "claude";
                  setBackend(b);
                  if (b === "claude") setModel("");
                  else setModel("gemini-flash-latest");
                }}
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                <option value="gemini">Gemini API (Google AI)</option>
                <option value="claude">Claude Code CLI (OAuth)</option>
              </select>
            </div>

            {/* Model (if Gemini) */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Model Name</label>
              <input
                type="text"
                disabled={backend === "claude"}
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={backend === "claude" ? "Managed by Claude CLI" : "gemini-flash-latest"}
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>

            {/* Case Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Test Scope</label>
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                <option value="">All Test Cases (Full Suite)</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>

            {/* Trigger CTA */}
            <div className="flex items-end">
              <button
                type="submit"
                disabled={triggering}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-md shadow-accent/20"
              >
                <Play size={14} />
                <span>{triggering ? "Queuing..." : "Start Evaluation"}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Evaluation History */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Historical Evaluation Runs ({history.length})</h3>
            <span className="text-xs text-slate-500 font-mono">Real deterministic grader results</span>
          </div>

          {loading && history.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading evaluation runs...</div>
          ) : history.length === 0 ? (
            <div className="p-12 rounded-xl bg-surface border border-borderline text-center text-xs text-slate-500">
              No evaluations recorded yet. Run a batch using the form above.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((record) => (
                <div
                  key={record.id}
                  className="p-5 rounded-xl bg-surface border border-borderline flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2.5">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-canvas border border-borderline text-slate-300">
                        {record.backend.toUpperCase()}
                      </span>
                      {record.model && (
                        <span className="text-xs font-mono text-accent-light">{record.model}</span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">• {record.created_at}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono">Run ID: {record.id}</p>
                  </div>

                  {/* Pass / Fail / Skip stats */}
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                      <CheckCircle2 size={14} />
                      <span>{record.passed_count} PASS</span>
                    </div>

                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
                      <XCircle size={14} />
                      <span>{record.failed_count} FAIL</span>
                    </div>

                    <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-slate-500/10 border border-slate-500/30 text-slate-400 text-xs font-mono">
                      <AlertCircle size={14} />
                      <span>{record.skipped_count} SKIP</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
