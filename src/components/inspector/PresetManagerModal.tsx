/**
 * src/components/inspector/PresetManagerModal.tsx
 *
 * visionOS Preset Library & Management Modal.
 * Provides preset catalog (14 factory presets + user custom presets),
 * category filter tabs, save custom preset form, LocalStorage persistence,
 * and JSON Export/Import matching E2E test selectors.
 */

import React, { useState, useRef } from "react";
import {
  X,
  Sparkles,
  Download,
  Upload,
  Plus,
  Trash2,
  Check,
  Apple,
  Bot,
  Radio,
  Minimize2,
  Cpu,
  Flame,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DEFAULT_PRESETS } from "@/data/defaultPresets";
import type { VuiPreset } from "@/types/presets";
import { cn } from "@/lib/utils";

interface PresetManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PresetManagerModal: React.FC<PresetManagerModalProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetDesc, setNewPresetDesc] = useState("");
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePresetId = useAppStore((s) => s.activePresetId);
  const customPresets = useAppStore((s) => s.customPresets);
  const applyPreset = useAppStore((s) => s.applyPreset);
  const saveCustomPreset = useAppStore((s) => s.saveCustomPreset);
  const deleteCustomPreset = useAppStore((s) => s.deleteCustomPreset);
  const exportCustomPresets = useAppStore((s) => s.exportCustomPresets);
  const importCustomPresets = useAppStore((s) => s.importCustomPresets);

  if (!isOpen) return null;

  const allPresets: VuiPreset[] = [...DEFAULT_PRESETS, ...customPresets];

  const filteredPresets = allPresets.filter((p) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "custom") return p.category === "custom" || p.isCustom;
    return p.category === selectedCategory;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    saveCustomPreset(newPresetName.trim(), newPresetDesc.trim());
    setNewPresetName("");
    setNewPresetDesc("");
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (text) {
        const res = importCustomPresets(text);
        if (res.imported > 0) {
          setImportStatus(`Successfully imported ${res.imported} preset(s).`);
        } else {
          setImportStatus(`Import failed: ${res.errors.join(", ")}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const categories: { id: string; label: string; icon?: React.FC<{ className?: string }> }[] = [
    { id: "all", label: "All (14+)" },
    { id: "apple", label: "Apple", icon: Apple },
    { id: "ai", label: "AI & Orbs", icon: Bot },
    { id: "broadcast", label: "Broadcast", icon: Radio },
    { id: "minimal", label: "Minimal", icon: Minimize2 },
    { id: "cyber", label: "Cyber", icon: Cpu },
    { id: "ambient", label: "Ambient", icon: Flame },
    { id: "custom", label: `Custom (${customPresets.length})` },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="preset-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
    >
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-3xl border border-white/15 bg-[#09090b]/95 shadow-2xl overflow-hidden backdrop-blur-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Preset Library & Manager</h2>
              <p className="text-xs text-zinc-400">
                14 production factory presets + custom saves with JSON synchronization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Preset JSON Button */}
            <button
              type="button"
              data-testid="preset-export-btn"
              onClick={() => exportCustomPresets()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/[0.1] transition-all"
              title="Export presets to .json"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Preset JSON</span>
            </button>

            {/* Import Presets Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:text-white hover:bg-white/[0.1] transition-all"
              title="Import presets from .json"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Import JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-1.5 text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {importStatus && (
          <div className="bg-purple-950/40 border-b border-purple-500/30 px-6 py-2 text-xs text-purple-300 flex items-center justify-between">
            <span>{importStatus}</span>
            <button
              type="button"
              onClick={() => setImportStatus(null)}
              className="text-purple-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10 px-6 py-2.5 bg-white/[0.01]">
          {categories.map((c) => {
            const isSelected = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium whitespace-nowrap transition-all",
                  isSelected
                    ? "bg-purple-600/80 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]"
                )}
              >
                <span>{c.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Preset Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPresets.map((p) => {
              const isSelected = activePresetId === p.id;
              return (
                <div
                  key={p.id}
                  data-preset-id={p.id}
                  className={cn(
                    "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200",
                    isSelected
                      ? "border-purple-500/70 bg-purple-500/15 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/50"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                  )}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/[0.08] border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase text-zinc-300">
                          {p.category}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">{p.framing}</span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {p.backgroundMode}
                        </span>
                      </div>

                      {p.isCustom && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCustomPreset(p.id);
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1 transition-colors"
                          title="Delete custom preset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <h4 className="mt-2 text-sm font-semibold text-white">{p.name}</h4>
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{p.description}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400">
                      <span>Sens: {p.params.sensitivity}x</span>
                      <span>•</span>
                      <span>Turb: {p.params.turbulence}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        applyPreset(p);
                        onClose();
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                        isSelected
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-white/10 text-zinc-200 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      {isSelected ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          <span>Active</span>
                        </>
                      ) : (
                        <span>Apply Preset</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Save Current Settings as Custom Preset */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-md">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Save Current Configuration
            </h3>
            <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="Preset Name (e.g. Broadcast Siri 4K)"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/80"
                />
              </div>
              <div className="sm:col-span-5">
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/80"
                />
              </div>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={!newPresetName.trim()}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 bg-purple-600/80 hover:bg-purple-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PresetManagerModal;
