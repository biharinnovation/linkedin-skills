"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  GitFork,
  Cpu,
  FolderArchive,
  Terminal,
  Award,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Workflows", href: "/workflows", icon: GitFork },
  { name: "Skills Registry", href: "/skills", icon: Cpu },
  { name: "Asset Library", href: "/assets", icon: FolderArchive },
  { name: "Execution Center", href: "/executions", icon: Terminal },
  { name: "Quality & Evals", href: "/evaluations", icon: Award },
  { name: "Integrations", href: "/integrations", icon: KeyRound },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`h-screen sticky top-0 bg-surface border-r border-borderline flex flex-col transition-all duration-300 z-30 ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-borderline">
        {!collapsed && (
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-bold text-white text-base shadow-lg shadow-accent/20">
              in
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-wide text-slate-100">LinkedIn Skills</span>
              <span className="text-[10px] text-slate-400 font-mono">Control Ops v1.0</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center font-bold text-white text-base">
              in
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-surface-hover text-slate-400 hover:text-slate-200 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-accent/15 text-accent-light border border-accent/30 shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-surface-hover"
              }`}
            >
              <Icon
                size={18}
                className={`flex-shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? "text-accent-light" : "text-slate-400 group-hover:text-slate-200"
                }`}
              />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Security & System Info Footer */}
      <div className="p-3 border-t border-borderline">
        {!collapsed ? (
          <div className="p-2.5 rounded-lg bg-canvas border border-borderline/80 flex items-center space-x-2.5">
            <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
            <div className="text-[11px] overflow-hidden leading-tight">
              <p className="text-slate-300 font-medium">Safe Subprocess Mode</p>
              <p className="text-slate-500 font-mono truncate">127.0.0.1:8000 (Local)</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1 text-emerald-400" title="Safe Subprocess Mode Active">
            <ShieldCheck size={18} />
          </div>
        )}
      </div>
    </aside>
  );
}
