"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  FolderKanban,
  Sparkles,
  Layers,
  LayoutGrid,
  Sun,
  Moon,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VersionA } from "./version-a";
import { VersionB } from "./version-b";
import { VersionC } from "./version-c";
import { INITIAL_PROJECTS } from "./data";
import { PrototypeProject } from "./types";

type VersionKey = "version-a" | "version-b" | "version-c";

export default function ProjectsPrototypePage() {
  const [selectedVersion, setSelectedVersion] = useState<VersionKey>("version-a");
  const [projects, setProjects] = useState<PrototypeProject[]>(INITIAL_PROJECTS);
  const { resolvedTheme, setTheme } = useTheme();

  const handleAddProject = (newProject: PrototypeProject) => {
    setProjects((prev) => [newProject, ...prev]);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top Prototype Controls Banner */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/manager/projects"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Manager</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/20 text-orange-600 dark:text-orange-400">
                <FolderKanban className="size-4" />
              </span>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Projects Page Prototypes
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Table-first design with search, filters, and modal-based project creation
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: Version Switcher & Theme Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1 text-xs">
              <button
                onClick={() => setSelectedVersion("version-a")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-a"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5" />
                <span>Version A: Directory</span>
              </button>

              <button
                onClick={() => setSelectedVersion("version-b")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-b"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Version B: Executive Hub</span>
              </button>

              <button
                onClick={() => setSelectedVersion("version-c")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-c"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Version C: Streamlined</span>
              </button>
            </div>

            {/* Dark / Light Mode Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-8 w-8 p-0"
              title="Toggle Light / Dark Mode"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4 text-orange-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </Button>
          </div>
        </div>

        {/* Sub-banner describing selected version */}
        <div className="border-t border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-orange-500 shrink-0" />
              {selectedVersion === "version-a" && (
                <span>
                  <strong className="text-foreground">Version A (Clean Studio Directory):</strong>{" "}
                  Data-dense tabular directory with live search, client dropdown filter, segmented status pills, progress meters, and top `+ Add Project` modal trigger.
                </span>
              )}
              {selectedVersion === "version-b" && (
                <span>
                  <strong className="text-foreground">Version B (Executive Studio Hub):</strong>{" "}
                  Top summary KPI metric cards, rich visual table with client avatars, category tags, deadline trackers, and multi-filter dropdowns.
                </span>
              )}
              {selectedVersion === "version-c" && (
                <span>
                  <strong className="text-foreground">Version C (Modern Streamlined Workspace):</strong>{" "}
                  Clean command-bar header with count badge tabs (All / In Production / In Review / Completed), fast search, and streamlined row layout.
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Try clicking <strong>Add Project</strong> or <strong>View</strong> to test modal flows!
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {selectedVersion === "version-a" && (
          <VersionA projects={projects} onAddProject={handleAddProject} />
        )}
        {selectedVersion === "version-b" && (
          <VersionB projects={projects} onAddProject={handleAddProject} />
        )}
        {selectedVersion === "version-c" && (
          <VersionC projects={projects} onAddProject={handleAddProject} />
        )}
      </main>
    </div>
  );
}
