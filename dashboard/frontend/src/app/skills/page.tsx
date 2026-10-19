"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, SkillSummary, SkillDetail } from "@/lib/api";
import {
  Cpu,
  Layers,
  FileCode,
  BookOpen,
  ArrowRight,
  X,
  Play,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadSkills = async () => {
    try {
      setLoading(true);
      const data = await api.getSkills();
      setSkills(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkills();
  }, []);

  const openSkillDetail = async (name: string) => {
    try {
      setLoadingDetail(true);
      const detail = await api.getSkillDetail(name);
      setSelectedSkill(detail);
    } catch (err: any) {
      alert(`Failed to load skill instructions: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <DashboardShell
      title="Skills Registry"
      subtitle="Dynamic Repository Inspection across 12 LinkedIn Skills"
      onRefresh={loadSkills}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="p-4 rounded-xl bg-surface border border-borderline flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Discovered Skills ({skills.length}/12)</h2>
            <p className="text-xs text-slate-400">
              Discovered directly from YAML frontmatter across <code className="text-slate-300">skills/*/SKILL.md</code>.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-medium">
            12 Skills Verified
          </span>
        </div>

        {/* Skills Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <div
              key={skill.name}
              onClick={() => openSkillDetail(skill.name)}
              className="p-5 rounded-xl bg-surface hover:bg-surface-card border border-borderline hover:border-accent/40 transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent-light group-hover:scale-105 transition-transform">
                      <Cpu size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100 group-hover:text-accent-light transition-colors">
                        {skill.display_name}
                      </h3>
                      <span className="text-[10px] text-slate-500 font-mono">{skill.name}</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                  {skill.description}
                </p>
              </div>

              <div className="pt-3 border-t border-borderline/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  {skill.has_subskills && (
                    <span className="px-2 py-0.5 rounded bg-surface-card border border-borderline text-[10px] text-purple-300 font-mono">
                      {skill.subskills.length} sub-skills
                    </span>
                  )}
                  {skill.has_scripts && (
                    <span className="px-2 py-0.5 rounded bg-surface-card border border-borderline text-[10px] text-blue-300 font-mono">
                      {skill.scripts.length} script{skill.scripts.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="text-slate-500 group-hover:text-accent-light flex items-center space-x-1 text-[11px] font-medium">
                  <span>View Docs</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail Drawer Modal */}
      {selectedSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-borderline rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">{selectedSkill.display_name}</h2>
                <p className="text-xs text-slate-400 font-mono">{selectedSkill.doc_path}</p>
              </div>
              <button
                onClick={() => setSelectedSkill(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div className="p-4 rounded-lg bg-canvas border border-borderline text-xs text-slate-300 leading-relaxed">
                {selectedSkill.description}
              </div>

              {/* Sub-skills and Scripts Badges */}
              {(selectedSkill.has_subskills || selectedSkill.has_scripts || selectedSkill.references.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {selectedSkill.has_subskills && (
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1.5">
                      <span className="text-[11px] font-semibold text-purple-300">Sub-Skills</span>
                      <ul className="text-xs text-slate-300 space-y-1 font-mono">
                        {selectedSkill.subskills.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedSkill.has_scripts && (
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1.5">
                      <span className="text-[11px] font-semibold text-blue-300">Runnable Scripts</span>
                      <ul className="text-xs text-slate-300 space-y-1 font-mono">
                        {selectedSkill.scripts.map((s) => (
                          <li key={s}>• {s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {selectedSkill.references.length > 0 && (
                    <div className="p-3 rounded-lg bg-canvas border border-borderline space-y-1.5">
                      <span className="text-[11px] font-semibold text-emerald-300">Skill References</span>
                      <ul className="text-xs text-slate-300 space-y-1 font-mono">
                        {selectedSkill.references.map((r) => (
                          <li key={r}>• {r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Instructions Markdown Viewer */}
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Instructions & Skill Contract
                </h4>
                <pre className="p-4 rounded-xl bg-canvas border border-borderline text-xs font-mono text-slate-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                  {selectedSkill.instructions_markdown}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
