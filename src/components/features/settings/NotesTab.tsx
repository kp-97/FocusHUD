import React, { useState, useEffect } from "react";
import { Folder, FolderOpen, RefreshCw, CheckCircle, HardDrive, Info } from "lucide-react";
import {
  fetchNotesDir,
  updateNotesDir,
  pickNotesDir,
  isTauriEnvironment,
} from "../../../services/dbService";

export const NotesTab: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [migrateExisting, setMigrateExisting] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchNotesDir().then((dir) => {
      if (mounted && dir) {
        setCurrentPath(dir);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handlePickFolder = async () => {
    if (!isTauriEnvironment()) {
      setStatusMessage("Folder selection is only available in desktop environment.");
      setTimeout(() => setStatusMessage(null), 3000);
      return;
    }

    try {
      const selected = await pickNotesDir();
      if (!selected) return;

      setLoading(true);
      const success = await updateNotesDir(selected, migrateExisting);
      if (success) {
        setCurrentPath(selected);
        setStatusMessage(
          migrateExisting
            ? "Notes directory updated & existing notes migrated to Markdown!"
            : "Notes directory updated & existing files indexed!"
        );
      } else {
        setStatusMessage("Failed to update notes directory.");
      }
    } catch {
      setStatusMessage("Error selecting folder.");
    } finally {
      setLoading(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-4">
      {/* STORAGE DIRECTORY LOCATION CARD */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
            MARKDOWN STORAGE DIRECTORY
          </span>
          <span className="text-[10px] font-mono text-cyan-400/70">
            HYBRID ARCHITECTURE
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-cyan-200/80">
          Notes are saved as human-readable <code>.md</code> files on your filesystem. SQLite maintains
          a synchronized metadata index for instant calendar event attachment and search.
        </p>

        {/* Current Path Display */}
        <div className="bg-black/60 border border-cyan-500/30 rounded p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[9px] uppercase tracking-wider text-cyan-500/70 font-tech">
                CURRENT STORAGE PATH
              </div>
              <div
                data-testid="current-notes-path"
                title={currentPath || "Default LocalAppData directory"}
                className="text-xs font-mono text-cyan-100 truncate"
              >
                {currentPath || "Default LocalAppData directory"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePickFolder}
            disabled={loading}
            className="hud-btn px-3 py-1.5 rounded text-xs font-tech tracking-wider uppercase flex items-center gap-1.5 text-cyan-200 border-cyan-500/40 hover:border-cyan-400 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>CHANGE FOLDER</span>
          </button>
        </div>

        {/* Migration Checkbox */}
        <div className="pt-1">
          <label className="flex items-center gap-2 text-xs text-cyan-300/90 cursor-pointer select-none hover:text-cyan-200">
            <input
              type="checkbox"
              checked={migrateExisting}
              onChange={(e) => setMigrateExisting(e.target.checked)}
              className="w-3.5 h-3.5 accent-cyan-400 rounded cursor-pointer"
            />
            <span>
              Migrate existing notes to new folder when switching directories
            </span>
          </label>
          <p className="text-[10px] text-cyan-500/70 pl-5.5 pt-0.5">
            If checked, notes currently in FocusHUD will be written out as <code>.md</code> files.
            Any existing <code>.md</code> files already in the chosen directory will also be indexed.
          </p>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div className="flex items-center gap-2 p-2 rounded bg-cyan-950/80 border border-cyan-400 text-xs text-cyan-200">
            <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* COMPATIBILITY & ECOSYSTEM INFORMATION */}
      <div className="bg-cyan-950/25 border border-cyan-500/15 rounded p-3 space-y-2 text-[11px] text-cyan-300/80">
        <div className="flex items-center gap-1.5 text-cyan-300 font-bold uppercase text-[10.5px]">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>INTEROPERABILITY & SYNC DETAILS</span>
        </div>
        <ul className="list-disc pl-4 space-y-1 text-cyan-200/70 text-[10.5px]">
          <li>
            <strong>Obsidian & VS Code Ready:</strong> Notes contain clean YAML frontmatter linking to FocusHUD entities while keeping standard Markdown headers and lists.
          </li>
          <li>
            <strong>Live Watcher:</strong> Files modified externally in your chosen directory are automatically re-indexed and updated in the HUD in real time.
          </li>
          <li>
            <strong>Safe Deletions:</strong> Notes and folders deleted in the HUD are moved to the OS Recycle Bin / Trash rather than permanently erased.
          </li>
        </ul>
      </div>
    </div>
  );
};

