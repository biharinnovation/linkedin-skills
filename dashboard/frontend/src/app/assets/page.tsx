"use client";

import React, { useEffect, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import { api, AssetFile } from "@/lib/api";
import {
  FolderArchive,
  Search,
  FileText,
  FileCode,
  Download,
  Eye,
  X,
  FileCheck,
} from "lucide-react";

const CATEGORIES = [
  { id: "", label: "All Categories" },
  { id: "documentation", label: "Documentation" },
  { id: "reference", label: "References & Rules" },
  { id: "evaluation", label: "Evaluation Data" },
  { id: "test_artifact", label: "Test Artifacts" },
  { id: "exported_post", label: "Exported Posts" },
];

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetFile[]>([]);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewContent, setPreviewContent] = useState<{ path: string; content: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadAssets = async () => {
    try {
      setLoading(true);
      const data = await api.getAssets({
        category: category || undefined,
        search: search || undefined,
      });
      setAssets(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [category, search]);

  const handlePreview = async (path: string) => {
    try {
      setLoadingPreview(true);
      const data = await api.viewAsset(path);
      setPreviewContent({ path: data.path, content: data.content });
    } catch (err: any) {
      alert(`Preview error: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <DashboardShell
      title="Asset Library"
      subtitle="Scoped File Browser and Safe Preview Center"
      onRefresh={loadAssets}
    >
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Filter & Search Bar */}
        <div className="p-4 rounded-xl bg-surface border border-borderline flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search assets by name or path..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-200 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-canvas border border-borderline text-xs text-slate-300 focus:outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Assets Grid */}
        {loading && assets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">Scanning allowed asset directories...</div>
        ) : assets.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">No assets found in allowed directories.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.relative_path}
                className="p-4 rounded-xl bg-surface hover:bg-surface-card border border-borderline transition-all flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-accent/15 text-accent-light">
                      {asset.extension}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">{formatBytes(asset.size_bytes)}</span>
                  </div>

                  <h4 className="text-xs font-semibold text-slate-200 truncate pt-1">{asset.name}</h4>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{asset.relative_path}</p>
                </div>

                <div className="pt-2 border-t border-borderline/60 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-400 capitalize">{asset.category.replace("_", " ")}</span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePreview(asset.relative_path)}
                      className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200"
                      title="Preview content"
                    >
                      <Eye size={14} />
                    </button>
                    <a
                      href={api.getDownloadUrl(asset.relative_path)}
                      download
                      className="p-1.5 rounded hover:bg-surface-hover text-slate-400 hover:text-slate-200"
                      title="Download asset safely"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-borderline rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-borderline flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Asset Preview</h3>
                <p className="text-xs text-slate-400 font-mono">{previewContent.path}</p>
              </div>
              <button
                onClick={() => setPreviewContent(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-surface-hover"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <pre className="p-4 rounded-xl bg-canvas border border-borderline text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {previewContent.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
