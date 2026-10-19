"use client";

import React, { useState } from "react";
import { api } from "@/lib/api";
import { X, Play, ShieldAlert } from "lucide-react";

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: () => void;
}

const TASK_TYPES = [
  { id: "selftest", name: "Run Repository Selftest", skill: "linkedin-pipeline-eval", desc: "Runs selftest suite verifying 12 skills, tests, and configuration." },
  { id: "check_config", name: "Check Credentials Configuration (Offline)", skill: "linkedin-post-writer", desc: "Verifies .env wiring, key prefixes, and fallback modes without live calls." },
  { id: "test_detectors", name: "AI Humanizer Detector Test", skill: "linkedin-humanizer", desc: "Analyzes text against AI detector heuristics and vocabulary traps." },
  { id: "check_frontmatter", name: "Validate SKILL.md Frontmatter", skill: "linkedin-pipeline-eval", desc: "Verifies strict YAML parsing across all 12 skills." },
  { id: "check_no_secrets", name: "Scan for Tracked Secrets", skill: "linkedin-pipeline-eval", desc: "Scans all tracked files for accidental API keys or .env leakage." },
  { id: "check_actor_inputs", name: "Verify Apify Actor Inputs", skill: "linkedin-engager-analytics", desc: "Validates Apify actor input schemas to catch breaking changes." },
  { id: "schedule_post_dry_run", name: "Schedule Post (Dry Run)", skill: "linkedin-post-writer", desc: "Simulates post validation and Publora scheduling without external API calls." },
  { id: "post_comment_dry_run", name: "Post Comment (Dry Run)", skill: "linkedin-comment-drafter", desc: "Simulates comment generation and posting safeguards." },
  { id: "publish_post_live", name: "Publish LinkedIn Post (Live with Approval)", skill: "linkedin-post-writer", desc: "Creates a live post; triggers mandatory operator approval gate before publishing." },
];

const SKILL_NAMES = [
  "linkedin-humanizer",
  "linkedin-post-writer",
  "linkedin-comment-drafter",
  "linkedin-reply-handler",
  "linkedin-content-planner",
  "linkedin-profile-optimizer",
  "linkedin-repurposer",
  "linkedin-interviewer",
  "linkedin-thread-monitor",
  "linkedin-hook-extractor",
  "linkedin-engager-analytics",
  "linkedin-employee-advocacy",
];

export default function NewTaskModal({ isOpen, onClose, onTaskCreated }: NewTaskModalProps) {
  const [taskType, setTaskType] = useState(TASK_TYPES[0].id);
  const [title, setTitle] = useState(TASK_TYPES[0].name);
  const [description, setDescription] = useState(TASK_TYPES[0].desc);
  const [skillName, setSkillName] = useState(TASK_TYPES[0].skill);
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [customParamText, setCustomParamText] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTypeChange = (typeId: string) => {
    setTaskType(typeId);
    const found = TASK_TYPES.find((t) => t.id === typeId);
    if (found) {
      setTitle(found.name);
      setDescription(found.desc);
      setSkillName(found.skill);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const parameters: Record<string, any> = {};
    if (taskType === "test_detectors" && customParamText.trim()) {
      parameters.text = customParamText.trim();
    } else if (taskType === "publish_post_live") {
      parameters.action_type = "publish";
      parameters.content = customParamText.trim() || "Automating data infrastructure with LinkedIn automation skills.";
    }

    try {
      await api.createTask({
        title,
        description,
        skill_name: skillName,
        task_type: taskType,
        priority,
        parameters,
        auto_start: autoStart,
      });
      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const isLiveAction = taskType === "publish_post_live";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-borderline rounded-xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-accent"></div>
            <h2 className="text-base font-semibold text-slate-100">Create Controlled Task</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Task Type Allowlist */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Action & Operation Allowlist</label>
            <select
              value={taskType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-sm text-slate-200 focus:outline-none focus:border-accent"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {isLiveAction && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start space-x-2.5">
              <ShieldAlert size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300">
                <span className="font-semibold">Human Approval Gate Required:</span> This task initiates external LinkedIn side-effects. It will enter the <code className="bg-amber-950/50 px-1 py-0.5 rounded">needs_approval</code> state until explicitly confirmed by you.
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Task Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-sm text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-sm text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Skill */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Associated Skill</label>
              <select
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                {SKILL_NAMES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Custom parameter input if applicable */}
          {(taskType === "test_detectors" || taskType === "publish_post_live") && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                {taskType === "test_detectors" ? "Text to Audit for AI Detection" : "Post Content Preview"}
              </label>
              <textarea
                rows={3}
                value={customParamText}
                onChange={(e) => setCustomParamText(e.target.value)}
                placeholder="Enter draft text..."
                className="w-full px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 font-mono focus:outline-none focus:border-accent"
              />
            </div>
          )}

          {/* Auto queue checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="autoQueue"
              checked={autoStart}
              onChange={(e) => setAutoStart(e.target.checked)}
              className="rounded bg-canvas border-borderline text-accent focus:ring-0"
            />
            <label htmlFor="autoQueue" className="text-xs text-slate-300 select-none cursor-pointer">
              Automatically queue task to background execution worker
            </label>
          </div>

          {/* Submit */}
          <div className="pt-3 border-t border-borderline flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-card hover:bg-surface-hover border border-borderline text-xs font-medium text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-xs font-medium shadow-md shadow-accent/20"
            >
              <Play size={13} />
              <span>{submitting ? "Creating..." : autoStart ? "Create & Queue" : "Create Task"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
