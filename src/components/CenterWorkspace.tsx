import React, { useState } from "react";
import {
  Lock,
  RotateCw,
  Minus,
  Square,
  X,
  GitBranch,
  FolderGit2,
  Code2,
  Sparkles,
} from "lucide-react";

interface CenterWorkspaceProps {
  middleWidth: number;
  snapMode: "fluid" | "grid-snap" | "ratio-16-9";
  onToggleSnapMode: (mode: "fluid" | "grid-snap" | "ratio-16-9") => void;
}

export const CenterWorkspace: React.FC<CenterWorkspaceProps> = ({
  middleWidth,
  snapMode,
  onToggleSnapMode,
}) => {
  const [activeTab, setActiveTab] = useState<"code" | "preview">("code");
  const [urlInput, setUrlInput] = useState("https://github.com/project/modeteral");

  // Sample code reflecting the code seen in the user's screenshot
  const codeLines = [
    `import React from "react";`,
    `import { useState, useEffect } from "react";`,
    ``,
    `export function ReadmeView() {`,
    `  const [count, setCount] = useState(0);`,
    `  const [status, setStatus] = useState("idle");`,
    ``,
    `  // Run on startup`,
    `  useEffect(() => {`,
    `    const timer = setInterval(() => {`,
    `      console.log("HUD sync telemetry update");`,
    `    }, 1000);`,
    `    return () => clearInterval(timer);`,
    `  }, []);`,
    ``,
    `  // Trigger user inference process`,
    `  const handleInference = async () => {`,
    `    setStatus("running");`,
    `    try {`,
    `      await fetch("/api/inference/run");`,
    `      setStatus("complete");`,
    `    } catch (err) {`,
    `      console.error(err);`,
    `    }`,
    `  };`,
    ``,
    `  return (`,
    `    <div className="p-4 bg-neutral-900 text-white rounded">`,
    `      <h1>Productivity Overlay Module</h1>`,
    `      <p>Snapping container verified at {count}px.</p>`,
    `    </div>`,
    `  );`,
    `}`,
  ];

  // Calculate container snap styles
  const getContainerConstraints = () => {
    if (snapMode === "grid-snap") {
      // Snaps to neat 120px increments or standard breakpoint widths
      const snapWidths = [640, 768, 960, 1080, 1200, 1440];
      const bestFit = snapWidths.reverse().find((w) => w <= middleWidth - 24) || 640;
      return { maxWidth: `${bestFit}px`, width: "100%", margin: "0 auto" };
    }
    if (snapMode === "ratio-16-9") {
      return { maxWidth: "100%", width: "100%", margin: "0 auto" };
    }
    return { width: "100%" };
  };

  return (
    <main className="flex-1 h-full flex flex-col p-2.5 bg-[#05090f]/90 relative overflow-hidden select-text">
      {/* Top Overlay Snap Bar */}
      <div className="flex items-center justify-between pb-1.5 px-2 text-[11px] font-tech text-cyan-400/80 border-b border-cyan-500/20 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-cyan-200 uppercase tracking-wider">
            MIDDLE COLUMN WORKSPACE
          </span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-[10px] text-cyan-300 font-bold">
            WIDTH: {Math.round(middleWidth)}px
          </span>
        </div>

        {/* Snap Mode Quick Toggles */}
        <div className="flex items-center gap-1.5 bg-black/40 p-0.5 rounded border border-cyan-500/30">
          <span className="text-[10px] text-cyan-500/70 px-1 font-hud">SNAP CONTENT:</span>
          <button
            onClick={() => onToggleSnapMode("fluid")}
            className={`px-2 py-0.5 rounded text-[10px] font-tech uppercase transition ${
              snapMode === "fluid"
                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400 shadow-[0_0_6px_#00e5ff]"
                : "text-cyan-500/60 hover:text-cyan-300"
            }`}
          >
            Fluid Fit
          </button>
          <button
            onClick={() => onToggleSnapMode("grid-snap")}
            className={`px-2 py-0.5 rounded text-[10px] font-tech uppercase transition ${
              snapMode === "grid-snap"
                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400 shadow-[0_0_6px_#00e5ff]"
                : "text-cyan-500/60 hover:text-cyan-300"
            }`}
          >
            Grid Snap
          </button>
        </div>
      </div>

      {/* Main Content Window Frame matching GitHub screenshot */}
      <div
        style={getContainerConstraints()}
        className="flex-1 flex flex-col rounded-md border border-[#2b313a] bg-[#0d1117] shadow-2xl overflow-hidden transition-all duration-150"
      >
        {/* Browser Chrome Header */}
        <div className="bg-[#161b22] border-b border-[#30363d] px-3 py-2 flex items-center justify-between text-xs text-neutral-300">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-[#0d1117] rounded-t border-t-2 border-cyan-500 text-neutral-200 font-mono text-[11px] shadow">
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>GitHub: modeteral/project</span>
              <X className="w-3 h-3 ml-1 text-neutral-500 hover:text-white cursor-pointer" />
            </div>

            <button
              onClick={() => setActiveTab("code")}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeTab === "code" ? "text-cyan-300 font-semibold" : "text-neutral-400 hover:text-white"
              }`}
            >
              Code
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-2 py-1 rounded text-[11px] transition ${
                activeTab === "preview" ? "text-cyan-300 font-semibold" : "text-neutral-400 hover:text-white"
              }`}
            >
              Preview
            </button>
          </div>

          {/* Window control buttons */}
          <div className="flex items-center gap-2 text-neutral-400">
            <Minus className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
            <Square className="w-3 h-3 hover:text-white cursor-pointer" />
            <X className="w-3.5 h-3.5 hover:text-red-400 cursor-pointer" />
          </div>
        </div>

        {/* Browser URL & Navigation Bar */}
        <div className="bg-[#161b22] px-3 py-1.5 border-b border-[#30363d] flex items-center gap-2">
          <button className="text-neutral-400 hover:text-white">
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          {/* URL Input */}
          <div className="flex-1 flex items-center gap-2 bg-[#0d1117] border border-[#30363d] rounded px-3 py-1 text-xs text-neutral-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <input
              id="workspace-url-input"
              name="workspaceUrl"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="bg-transparent text-neutral-200 w-full focus:outline-none font-mono text-[11px]"
            />
          </div>

          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white">
            PK
          </div>
        </div>

        {/* Repository Subheader Bar */}
        <div className="bg-[#0d1117] px-4 py-2.5 border-b border-[#30363d] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-neutral-400">modeteral</span>
            <span className="text-neutral-600">/</span>
            <span className="text-cyan-400 font-bold">project</span>

            <div className="ml-4 flex items-center gap-1.5 bg-[#21262d] border border-[#30363d] px-2 py-0.5 rounded text-[11px] text-neutral-200">
              <GitBranch className="w-3 h-3 text-neutral-400" />
              <span>main</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <button className="px-2 py-1 rounded bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-neutral-200 transition">
              Go to file
            </button>
            <button className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 font-semibold text-white transition flex items-center gap-1">
              <Code2 className="w-3 h-3" /> Code
            </button>
          </div>
        </div>

        {/* Main Editor View / Code Content */}
        <div className="flex-1 bg-[#0d1117] overflow-auto p-3 text-xs font-mono">
          {activeTab === "code" && (
            <div className="space-y-0.5 font-mono select-text">
              {codeLines.map((line, idx) => (
                <div key={idx} className="flex hover:bg-[#161b22] px-1 py-0.5 rounded">
                  <span className="w-10 select-none text-neutral-600 text-right pr-3 font-mono">
                    {idx + 1}
                  </span>
                  <span className="flex-1 whitespace-pre text-neutral-300">
                    {line.startsWith("import") ? (
                      <span className="text-purple-400">{line}</span>
                    ) : line.startsWith("export") || line.startsWith("function") ? (
                      <span className="text-blue-400">{line}</span>
                    ) : line.includes("//") ? (
                      <span className="text-neutral-500 italic">{line}</span>
                    ) : line.includes("const ") ? (
                      <span>
                        <span className="text-red-400">const </span>
                        {line.replace("const ", "")}
                      </span>
                    ) : (
                      line
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "preview" && (
            <div className="p-6 h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
              <div className="p-4 rounded-full bg-cyan-950/40 border border-cyan-500/30">
                <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
              </div>
              <h3 className="text-base font-orbitron font-bold text-neutral-200">
                PRODUCTIVITY OVERLAY ACTIVE
              </h3>
              <p className="max-w-md text-xs text-neutral-400">
                Middle workspace snapped nicely to {Math.round(middleWidth)}px width. Left bar and right bar can be resized seamlessly with magnetic snapping.
              </p>
            </div>
          )}
        </div>

        {/* Bottom Status bar */}
        <div className="bg-[#161b22] border-t border-[#30363d] px-3 py-1 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
          <div className="flex items-center gap-3">
            <span>TypeScript React</span>
            <span>UTF-8</span>
            <span>LF</span>
          </div>
          <div className="flex items-center gap-2 text-cyan-400/80">
            <span>GRID-SNAP: READY</span>
          </div>
        </div>
      </div>
    </main>
  );
};
