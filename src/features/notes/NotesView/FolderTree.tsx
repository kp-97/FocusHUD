import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Inbox,
  Check,
  X,
} from "lucide-react";
import { NoteFolder } from "../../../types/hud";

interface FolderTreeProps {
  folders: NoteFolder[];
  selectedFolder: string | null; // null = all notes, "" = root, "path/to/folder" = subfolder
  onSelectFolder: (folderPath: string | null) => void;
  onCreateFolder: (parentPath: string, name: string) => void;
  onRenameFolder: (oldPath: string, newPath: string) => void;
  onDeleteFolder: (folderPath: string) => void;
  onDropNote?: (noteId: string, targetFolderPath: string) => void;
  totalNotesCount: number;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolder,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropNote,
  totalNotesCount,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const startCreate = (parentPath: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCreatingIn(parentPath);
    setNewFolderName("");
  };

  const submitCreate = () => {
    const trimmed = newFolderName.trim();
    if (trimmed && creatingIn !== null) {
      const full = creatingIn ? `${creatingIn}/${trimmed}` : trimmed;
      onCreateFolder(creatingIn, full);
    }
    setCreatingIn(null);
    setNewFolderName("");
  };

  const startRename = (folder: NoteFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(folder.relativePath);
    setRenameValue(folder.name);
  };

  const submitRename = (oldPath: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      const parent = oldPath.includes("/")
        ? oldPath.substring(0, oldPath.lastIndexOf("/"))
        : "";
      const newPath = parent ? `${parent}/${trimmed}` : trimmed;
      onRenameFolder(oldPath, newPath);
    }
    setEditingFolder(null);
    setRenameValue("");
  };

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(path);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolder(null);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    const noteId = e.dataTransfer.getData("text/plain");
    if (noteId && onDropNote) {
      onDropNote(noteId, targetPath);
    }
  };

  const renderFolderItem = (folder: NoteFolder, depth = 0) => {
    const isExpanded = !!expandedFolders[folder.relativePath];
    const isSelected = selectedFolder === folder.relativePath;
    const isDragTarget = dragOverFolder === folder.relativePath;
    const isEditing = editingFolder === folder.relativePath;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.relativePath} className="flex flex-col">
        <div
          onDragOver={(e) => handleDragOver(e, folder.relativePath)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.relativePath)}
          onClick={() => onSelectFolder(folder.relativePath)}
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
          className={`group flex items-center justify-between py-1 pr-1.5 rounded cursor-pointer text-xs transition border ${
            isDragTarget
              ? "bg-cyan-500/30 border-cyan-400"
              : isSelected
                ? "bg-cyan-950/70 border-cyan-400/80 text-cyan-100 font-bold"
                : "border-transparent text-cyan-300/80 hover:bg-cyan-950/40 hover:text-cyan-200"
          }`}
        >
          <div className="flex items-center gap-1 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleExpand(folder.relativePath, e)}
                className="p-0.5 text-cyan-400/70 hover:text-cyan-100 cursor-pointer"
                title={isExpanded ? "Collapse Folder" : "Expand Folder"}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
            ) : (
              <span className="w-4" />
            )}

            {isExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-cyan-400/80 shrink-0" />
            )}

            {isEditing ? (
              <div
                className="flex items-center gap-1 min-w-0 flex-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitRename(folder.relativePath);
                    if (e.key === "Escape") setEditingFolder(null);
                  }}
                  autoFocus
                  className="bg-black/90 border border-cyan-400 rounded px-1 py-0.5 text-xs text-cyan-100 font-tech w-full focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => submitRename(folder.relativePath)}
                  className="text-cyan-400 hover:text-cyan-100 p-0.5"
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingFolder(null)}
                  className="text-red-400 hover:text-red-300 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span className="truncate text-[11px] font-tech">{folder.name}</span>
            )}
          </div>

          {/* Action buttons on hover */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              <button
                type="button"
                onClick={(e) => startCreate(folder.relativePath, e)}
                title="New Subfolder"
                className="p-0.5 text-cyan-500/70 hover:text-cyan-200 cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => startRename(folder, e)}
                title="Rename Folder"
                className="p-0.5 text-cyan-500/70 hover:text-cyan-200 cursor-pointer"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderToDelete(folder.relativePath);
                }}
                title="Delete Folder"
                className="p-0.5 text-cyan-500/70 hover:text-red-400 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Inline Create Input for child */}
        {creatingIn === folder.relativePath && (
          <div
            style={{ paddingLeft: `${(depth + 1) * 12 + 16}px` }}
            className="flex items-center gap-1 py-1 pr-2"
          >
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") setCreatingIn(null);
              }}
              placeholder="Folder name..."
              autoFocus
              className="bg-black/90 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-cyan-100 font-tech w-full focus:outline-none"
            />
            <button
              type="button"
              onClick={submitCreate}
              className="text-cyan-400 hover:text-cyan-100 p-0.5"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setCreatingIn(null)}
              className="text-red-400 hover:text-red-300 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Recursive Children */}
        {isExpanded &&
          hasChildren &&
          folder.children.map((child) => renderFolderItem(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col border-b border-cyan-500/20 bg-[#02050a] p-2 space-y-1 select-none">
      {/* Header with New Root Folder Action */}
      <div className="flex items-center justify-between pb-1 border-b border-cyan-500/10 text-[10px] font-tech text-cyan-400/80">
        <span className="font-bold tracking-wider uppercase">FOLDERS & STORAGE</span>
        <button
          type="button"
          onClick={() => startCreate("")}
          title="Create New Folder"
          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-100 cursor-pointer px-1 py-0.5 rounded border border-cyan-500/30 hover:border-cyan-400"
        >
          <FolderPlus className="w-3 h-3" />
          <span>FOLDER</span>
        </button>
      </div>

      {/* Root Inline Create Input */}
      {creatingIn === "" && (
        <div className="flex items-center gap-1 py-1">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") setCreatingIn(null);
            }}
            placeholder="New folder name..."
            autoFocus
            className="bg-black/90 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-cyan-100 font-tech w-full focus:outline-none"
          />
          <button
            type="button"
            onClick={submitCreate}
            className="text-cyan-400 hover:text-cyan-100 p-0.5"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setCreatingIn(null)}
            className="text-red-400 hover:text-red-300 p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* All Notes item */}
      <div
        onClick={() => onSelectFolder(null)}
        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition border ${
          selectedFolder === null
            ? "bg-cyan-950/70 border-cyan-400/80 text-cyan-100 font-bold"
            : "border-transparent text-cyan-300/80 hover:bg-cyan-950/40 hover:text-cyan-200"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Inbox className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-tech text-[11px]">ALL NOTES</span>
        </div>
        <span className="text-[9.5px] font-mono text-cyan-500/70 bg-cyan-950/80 px-1 rounded border border-cyan-500/20">
          {totalNotesCount}
        </span>
      </div>

      {/* Root / Unfiled Folder */}
      <div
        onDragOver={(e) => handleDragOver(e, "")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "")}
        onClick={() => onSelectFolder("")}
        className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer text-xs transition border ${
          dragOverFolder === ""
            ? "bg-cyan-500/30 border-cyan-400"
            : selectedFolder === ""
              ? "bg-cyan-950/70 border-cyan-400/80 text-cyan-100 font-bold"
              : "border-transparent text-cyan-300/80 hover:bg-cyan-950/40 hover:text-cyan-200"
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Folder className="w-3.5 h-3.5 text-cyan-400/70" />
          <span className="font-tech text-[11px]">ROOT / UNFILED</span>
        </div>
      </div>

      {/* Nested folders */}
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {folders.map((f) => renderFolderItem(f))}
      </div>

      {/* Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#050b14] border border-cyan-500/40 rounded p-4 max-w-sm w-full space-y-3 font-tech text-cyan-200">
            <div className="flex items-center gap-2 text-red-400 font-bold uppercase text-xs">
              <Trash2 className="w-4 h-4" />
              <span>DELETE FOLDER & CONTENTS?</span>
            </div>
            <p className="text-[11px] text-cyan-300/80 leading-relaxed">
              Are you sure you want to delete folder <code>{folderToDelete}</code>?
              Files and notes within it will be safely moved to the OS Recycle Bin / Trash.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-3 py-1 rounded text-xs border border-cyan-500/30 text-cyan-300 hover:text-cyan-100 cursor-pointer"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteFolder(folderToDelete);
                  setFolderToDelete(null);
                }}
                className="px-3 py-1 rounded text-xs bg-red-950 border border-red-500/60 text-red-200 hover:bg-red-900 cursor-pointer font-bold"
              >
                CONFIRM DELETE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

