"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import NewTaskModal from "./NewTaskModal";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

export default function DashboardShell({ children, title, subtitle, onRefresh }: DashboardShellProps) {
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onOpenNewTask={() => setIsNewTaskOpen(true)}
          title={title}
          subtitle={subtitle}
        />
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>

      <NewTaskModal
        isOpen={isNewTaskOpen}
        onClose={() => setIsNewTaskOpen(false)}
        onTaskCreated={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
