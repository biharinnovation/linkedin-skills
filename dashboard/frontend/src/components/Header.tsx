"use client";

import React, { useEffect, useState } from "react";
import { api, SystemHealth } from "@/lib/api";
import { Activity, Plus, Play, AlertCircle, RefreshCw } from "lucide-react";

interface HeaderProps {
  onOpenNewTask: () => void;
  title?: string;
  subtitle?: string;
}

export default function Header({ onOpenNewTask, title = "Dashboard", subtitle = "LinkedIn Skills Operations & Orchestration" }: HeaderProps) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickSelftest = async () => {
    try {
      await api.createTask({
        title: "Quick Selftest Execution",
        description: "Run automated repository and skill smoke verification",
        task_type: "selftest",
        priority: "high",
        auto_start: true,
      });
      fetchHealth();
    } catch (err: any) {
      alert(`Failed to trigger selftest: ${err.message}`);
    }
  };

  return (
    <header className="h-16 px-6 bg-surface/80 backdrop-blur-md border-b border-borderline flex items-center justify-between sticky top-0 z-20">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-base font-semibold text-slate-100">{title}</h1>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      {/* Status & Quick Actions */}
      <div className="flex items-center space-x-3.5">
        {/* Backend Connectivity Status */}
        {error ? (
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>API Offline</span>
          </div>
        ) : health ? (
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>12/12 Skills Live</span>
            </div>

            {health.pending_approvals > 0 && (
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
                <AlertCircle size={13} />
                <span>{health.pending_approvals} Approval{health.pending_approvals > 1 ? "s" : ""}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500">Connecting...</div>
        )}

        {/* Refresh button */}
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-2 rounded-lg bg-surface-card border border-borderline hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition-colors"
          title="Refresh system status"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </button>

        {/* Quick Selftest */}
        <button
          onClick={handleQuickSelftest}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-borderline text-xs font-medium text-slate-200 transition-colors"
        >
          <Play size={13} className="text-emerald-400" />
          <span>Run Selftest</span>
        </button>

        {/* New Task CTA */}
        <button
          onClick={onOpenNewTask}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-all shadow-md shadow-accent/20"
        >
          <Plus size={14} />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
}
