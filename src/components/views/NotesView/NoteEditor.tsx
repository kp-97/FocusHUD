import React, { useState } from "react";
import {
  Pin,
  Trash2,
  Copy,
  Check,
  Eye,
  Edit3,
  Columns2,
  ArrowLeft,
} from "lucide-react";
import { NoteItem } from "../../../types/hud";
import { MarkdownPreview } from "./MarkdownPreview";
import { useSpellcheck } from "../../../stores/spellcheckStore";
import { useTextareaCaretPreservation } from "./useTextareaCaretPreservation";
import { NoteFormattingToolbar } from "./NoteFormattingToolbar";
import { NoteContextLinker } from "./NoteContextLinker";

interface NoteEditorProps {
  note: NoteItem;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onTogglePin: () => void;
  onDeleteNote: () => void;
  onChangeLink: (links: { goalId?: string | null; taskId?: string | null; actionPlanId?: string | null }) => void;
  saveStatus: "saved" | "saving";
  onBackToList?: () => void;
  isCompact?: boolean;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  note,
  onChangeTitle,
  onChangeContent,
  onTogglePin,
  onDeleteNote,
  onChangeLink,
  saveStatus,
  onBackToList,
  isCompact = false,
}) => {
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("edit");
  const [copiedToast, setCopiedToast] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { locale: spellcheckLocale, enabled: spellcheckEnabled } = useSpellcheck();

  // Caret / Selection preservation hook
  const {
    textareaRef,
    selectionRef,
    recordSelection,
    handleContentChange,
  } = useTextareaCaretPreservation({
    content: note.content || "",
    onChangeContent,
    viewMode,
  });

  // Copy note content to clipboard with toast
  const handleCopyClipboard = async () => {
    const fullText = note.title
      ? `# ${note.title}\n\n${note.content}`
      : note.content;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Word & character counts
  const wordCount = (note.content || "")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const charCount = (note.content || "").length;

  // Toggle checklist item from markdown preview
  const handleToggleChecklist = (lineIndex: number) => {
    const lines = (note.content || "").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;

    const line = lines[lineIndex];
    const match = line.match(/^(\s*-\s*\[)([ xX])(\]\s*.*)$/);
    if (!match) return;

    const currentCheck = match[2].toLowerCase() === "x";
    const nextCheckChar = currentCheck ? " " : "x";
    lines[lineIndex] = `${match[1]}${nextCheckChar}${match[3]}`;
    onChangeContent(lines.join("\n"));
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#03070d] text-cyan-200 select-none overflow-hidden relative">
      {/* Toast Notification */}
      {copiedToast && (
        <div className="absolute top-10 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-200 text-xs font-tech shadow-[0_0_15px_rgba(0,229,255,0.4)] animate-in fade-in">
          <Check className="w-3.5 h-3.5 text-cyan-300" />
          <span>COPIED TO CLIPBOARD!</span>
        </div>
      )}

      {/* Editor Top Navigation & Action Controls */}
      <div className="flex items-center justify-between p-2 border-b border-cyan-500/20 bg-black/40 shrink-0 gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {onBackToList && (
            <button
              onClick={onBackToList}
              title="Back to notes list"
              className="p-1 rounded text-cyan-400 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Auto-save Status Indicator */}
          <div className="flex items-center gap-1 text-[10px] font-tech tracking-wider uppercase">
            {saveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-amber-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                SAVING...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-cyan-400/80">
                <Check className="w-3 h-3 text-cyan-400" />
                SAVED
              </span>
            )}
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mode Switcher: Edit / Preview / Split */}
          <div className="flex items-center bg-black/60 border border-cyan-500/30 rounded p-0.5 text-[10px] font-tech">
            <button
              onClick={() => setViewMode("edit")}
              title="Edit Markdown"
              className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                viewMode === "edit"
                  ? "bg-cyan-500/30 text-cyan-100 font-bold"
                  : "text-cyan-500/60 hover:text-cyan-300"
              }`}
            >
              <Edit3 className="w-3 h-3" />
              {!isCompact && <span>EDIT</span>}
            </button>
            <button
              onClick={() => setViewMode("preview")}
              title="Preview Rendered Markdown"
              className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                viewMode === "preview"
                  ? "bg-cyan-500/30 text-cyan-100 font-bold"
                  : "text-cyan-500/60 hover:text-cyan-300"
              }`}
            >
              <Eye className="w-3 h-3" />
              {!isCompact && <span>PREVIEW</span>}
            </button>
            {!isCompact && (
              <button
                onClick={() => setViewMode("split")}
                title="Split Edit & Preview"
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  viewMode === "split"
                    ? "bg-cyan-500/30 text-cyan-100 font-bold"
                    : "text-cyan-500/60 hover:text-cyan-300"
                }`}
              >
                <Columns2 className="w-3 h-3" />
                <span>SPLIT</span>
              </button>
            )}
          </div>

          {/* Pin Button */}
          <button
            onClick={onTogglePin}
            title={note.isPinned ? "Unpin Note" : "Pin Note to Top"}
            className={`p-1 rounded transition cursor-pointer border ${
              note.isPinned
                ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                : "border-cyan-500/30 text-cyan-400/70 hover:text-cyan-200 hover:border-cyan-400"
            }`}
          >
            <Pin className={`w-3.5 h-3.5 ${note.isPinned ? "fill-amber-400" : ""}`} />
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopyClipboard}
            title="Copy Note to Clipboard"
            className="p-1 rounded border border-cyan-500/30 text-cyan-400/70 hover:text-cyan-200 hover:border-cyan-400 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete Button (with inline confirmation) */}
          {confirmDelete ? (
            <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 rounded px-1.5 py-0.5 text-[10px] font-tech text-red-200">
              <span>DELETE?</span>
              <button
                onClick={onDeleteNote}
                className="font-bold text-red-400 hover:text-red-200 underline cursor-pointer"
              >
                YES
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-cyan-300 hover:text-cyan-100 cursor-pointer ml-1"
              >
                NO
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              title="Delete Active Note"
              className="p-1 rounded border border-cyan-500/30 text-cyan-500/60 hover:text-red-400 hover:border-red-400 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Note Title & Contextual Attachment Bar */}
      <div className="p-2 border-b border-cyan-500/20 bg-[#050b14] shrink-0 space-y-1.5">
        {/* Title Input */}
        <input
          type="text"
          value={note.title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="NOTE TITLE..."
          spellCheck={spellcheckEnabled}
          lang={spellcheckEnabled ? spellcheckLocale : undefined}
          className="w-full bg-transparent font-orbitron font-bold text-sm text-cyan-100 tracking-wider placeholder:text-cyan-700/50 focus:outline-none"
        />

        {/* Context Link Selector / Chip */}
        <NoteContextLinker
          goalId={note.goalId}
          taskId={note.taskId}
          actionPlanId={note.actionPlanId}
          onChangeLink={onChangeLink}
        />
      </div>

      {/* Markdown Quick Formatting Toolbar */}
      <NoteFormattingToolbar
        content={note.content}
        onChangeContent={onChangeContent}
        textareaRef={textareaRef}
        selectionRef={selectionRef}
        onEnsureEditMode={() => {
          if (viewMode === "preview") {
            setViewMode("edit");
          }
        }}
      />

      {/* Editor Main Content Area */}
      <div className="flex-1 min-h-0 relative overflow-hidden flex flex-col">
        {viewMode === "edit" && (
          <textarea
            ref={textareaRef}
            value={note.content}
            onChange={handleContentChange}
            onSelect={(e) => recordSelection(e.currentTarget)}
            onKeyUp={(e) => recordSelection(e.currentTarget)}
            onClick={(e) => recordSelection(e.currentTarget)}
            onPointerUp={(e) => recordSelection(e.currentTarget)}
            spellCheck={spellcheckEnabled}
            lang={spellcheckEnabled ? spellcheckLocale : undefined}
            placeholder="Type notes here... Supports Markdown headers (#), bullets (-), checklists (- [ ]), and bold (**text**)..."
            className="flex-1 w-full p-3 bg-transparent text-cyan-200 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder:text-cyan-700/40 select-text"
          />
        )}

        {viewMode === "preview" && (
          <div className="flex-1 w-full p-3 overflow-y-auto">
            <MarkdownPreview
              content={note.content}
              onToggleChecklist={handleToggleChecklist}
            />
          </div>
        )}

        {viewMode === "split" && (
          <div className="flex-1 w-full flex flex-row overflow-hidden divide-x divide-cyan-500/20">
            <textarea
              ref={textareaRef}
              value={note.content}
              onChange={handleContentChange}
              onSelect={(e) => recordSelection(e.currentTarget)}
              onKeyUp={(e) => recordSelection(e.currentTarget)}
              onClick={(e) => recordSelection(e.currentTarget)}
              onPointerUp={(e) => recordSelection(e.currentTarget)}
              spellCheck={spellcheckEnabled}
              lang={spellcheckEnabled ? spellcheckLocale : undefined}
              placeholder="Type markdown here..."
              className="flex-1 h-full p-3 bg-transparent text-cyan-200 font-mono text-xs leading-relaxed resize-none focus:outline-none placeholder:text-cyan-700/40 select-text"
            />
            <div className="flex-1 h-full p-3 overflow-y-auto bg-black/30">
              <MarkdownPreview
                content={note.content}
                onToggleChecklist={handleToggleChecklist}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer Metadata Status Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 border-t border-cyan-500/20 bg-black/40 text-[10px] font-mono text-cyan-500/60 shrink-0">
        <div className="flex items-center gap-2">
          <span>{wordCount} words</span>
          <span>•</span>
          <span>{charCount} chars</span>
        </div>

        <div>
          {note.updatedAt ? (
            <span>
              Updated {new Date(note.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : (
            <span>New note</span>
          )}
        </div>
      </div>
    </div>
  );
};
