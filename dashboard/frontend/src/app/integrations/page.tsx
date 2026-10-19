"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, IntegrationStatus } from "@/lib/api";
import {
  KeyRound,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Play,
  Terminal,
  ExternalLink,
  Lock,
} from "lucide-react";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [offlineOutput, setOfflineOutput] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getIntegrations();
      setIntegrations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunOfflineValidation = async () => {
    setTesting(true);
    setOfflineOutput(null);
    try {
      const res = await api.validateOffline();
      setOfflineOutput(res.output || res.errors);
      loadData();
    } catch (err: any) {
      setOfflineOutput(`Offline check failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <DashboardShell
      title="Integrations & Settings"
      subtitle="Credential Layers, API Configurations, and Fallback Behaviors"
      onRefresh={loadData}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Security Notice */}
        <div className="p-4 rounded-xl bg-canvas border border-borderline flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Lock size={18} className="text-emerald-400" />
            <div className="text-xs">
              <span className="font-semibold text-slate-200">Zero-Secret-Exposure Architecture: </span>
              <span className="text-slate-400">
                Secrets are never sent to the browser or rendered in client HTML. Configure keys via your local shell or <code className="text-slate-300">.env</code> file.
              </span>
            </div>
          </div>

          <button
            onClick={handleRunOfflineValidation}
            disabled={testing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-surface-card hover:bg-surface-hover border border-borderline text-xs font-medium text-slate-200 flex-shrink-0"
          >
            <Play size={13} className="text-emerald-400" />
            <span>{testing ? "Checking..." : "Run Offline Config Test"}</span>
          </button>
        </div>

        {/* Offline Validation Output (if run) */}
        {offlineOutput && (
          <div className="p-4 rounded-xl bg-canvas border border-borderline space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <span>scripts/check_config.py --offline output:</span>
              <button
                onClick={() => setOfflineOutput(null)}
                className="text-[11px] text-slate-500 hover:text-slate-300"
              >
                Dismiss
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-surface border border-borderline text-[11px] font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {offlineOutput}
            </pre>
          </div>
        )}

        {/* Integration Cards List */}
        <div className="space-y-4">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="p-5 rounded-xl bg-surface border border-borderline flex flex-col md:flex-row md:items-start justify-between gap-6"
            >
              <div className="space-y-3 flex-1">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent-light">
                    <KeyRound size={16} />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">({item.tier})</span>
                    </div>
                    <span
                      className={`text-xs font-mono font-medium ${
                        item.configured ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      Status: {item.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                  {/* Capabilities */}
                  <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1.5">
                    <span className="text-slate-400 font-medium">Supported Capabilities</span>
                    <ul className="text-slate-300 space-y-1 font-mono text-[11px]">
                      {item.capabilities.map((c) => (
                        <li key={c}>• {c}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Requirements & Env */}
                  <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1.5">
                    <span className="text-slate-400 font-medium">Required Environment Variables</span>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.required_env.map((env) => (
                        <code
                          key={env}
                          className="px-2 py-0.5 rounded bg-surface border border-borderline text-[11px] font-mono text-accent-light"
                        >
                          {env}
                        </code>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1">
                      Limitation: {item.limitations.join(", ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicator Badge */}
              <div className="flex-shrink-0 flex items-center space-x-2">
                {item.configured ? (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                    <CheckCircle2 size={14} />
                    <span>Configured</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                    <AlertCircle size={14} />
                    <span>Not Configured (Fallback Active)</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
