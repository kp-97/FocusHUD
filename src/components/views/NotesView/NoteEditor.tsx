import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import {
  Pin,
  Trash2,
  Copy,
  Check,
  Eye,
  Edit3,
  Columns2,
  Target,
  CheckSquare,
  Workflow,
  Sparkles,
  ChevronDown,
  ArrowLeft,
  Bold,
  Italic,
  List,
  ListTodo,
  Code,
  Quote,
  Minus,
  Table,
} from "lucide-react";
import { NoteItem, GoalNode, TaskItem, ActionPlanNode } from "../../../types/hud";
import { MarkdownPreview } from "./MarkdownPreview";
import { loadGoals, loadTasks, loadActionPlans } from "../../../stores/layoutStore";
import { fetchGoals, fetchTasks, fetchActionPlans, isTauriEnvironment } from "../../../services/dbService";
import { dbGoalsToTree, dbTasksToTree, dbActionPlansToTree } from "../../../services/dbAdapters";
import { useSpellcheck } from "../../../stores/spellcheckStore";

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
  const [isLinkDropdownOpen, setIsLinkDropdownOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { locale: spellcheckLocale, enabled: spellcheckEnabled } = useSpellcheck();

  // Available context options to link note to
  const [goals, setGoals] = useState<GoalNode[]>(() => loadGoals());
  const [tasks, setTasks] = useState<TaskItem[]>(() => loadTasks());
  const [actionPlans, setActionPlans] = useState<ActionPlanNode[]>(() => loadActionPlans());

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Caret / Selection preservation refs across re-renders, layout changes, and document expansion
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const isInternalChangeRef = useRef<boolean>(false);

  // Helper to record selection on user interaction
  const recordSelection = useCallback((el?: HTMLTextAreaElement | null) => {
    const target = el || textareaRef.current;
    if (target && document.activeElement === target) {
      selectionRef.current = {
        start: target.selectionStart,
        end: target.selectionEnd,
      };
    }
  }, []);

  // Handle content changes from typing
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    isInternalChangeRef.current = true;
    selectionRef.current = {
      start: e.target.selectionStart,
      end: e.target.selectionEnd,
    };
    onChangeContent(e.target.value);
  };

  // Restore selection synchronously before paint if cursor jumped unexpectedly (e.g. from container resize / external update)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !selectionRef.current) return;

    if (document.activeElement === textarea) {
      const { start, end } = selectionRef.current;
      if (textarea.selectionStart !== start || textarea.selectionEnd !== end) {
        const len = textarea.value.length;
        const safeStart = Math.min(start, len);
        const safeEnd = Math.min(end, len);
        try {
          textarea.setSelectionRange(safeStart, safeEnd);
        } catch {}
      }
    }
    isInternalChangeRef.current = false;
  }, [note.content]);

  // Restore selection when viewMode switches (e.g. between edit and split)
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && selectionRef.current && (viewMode === "edit" || viewMode === "split")) {
      const { start, end } = selectionRef.current;
      const len = textarea.value.length;
      try {
        textarea.setSelectionRange(Math.min(start, len), Math.min(end, len));
      } catch {}
    }
  }, [viewMode]);

  // Restore selection across window and container resize events
  useEffect(() => {
    const handleResize = () => {
      const textarea = textareaRef.current;
      if (textarea && document.activeElement === textarea && selectionRef.current) {
        const { start, end } = selectionRef.current;
        requestAnimationFrame(() => {
          if (textarea && document.activeElement === textarea) {
            const len = textarea.value.length;
            try {
              textarea.setSelectionRange(Math.min(start, len), Math.min(end, len));
            } catch {}
          }
        });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load goals, tasks, and action plans for contextual linking
  useEffect(() => {
    if (isTauriEnvironment()) {
      fetchGoals().then((g) => {
        if (g.length > 0) setGoals(dbGoalsToTree(g));
      });
      fetchTasks().then((t) => {
        if (t.length > 0) setTasks(dbTasksToTree(t));
      });
      fetchActionPlans().then((ap) => {
        if (ap.length > 0) setActionPlans(dbActionPlansToTree(ap));
      });
    }
  }, []);

  // Close context dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsLinkDropdownOpen(false);
      }
    };
    if (isLinkDropdownOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isLinkDropdownOpen]);

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

  // Apply Markdown formatting tag to selected text or current cursor position
  const applyFormatting = (
    type:
      | "bold"
      | "italic"
      | "h1"
      | "h2"
      | "h3"
      | "bullet"
      | "checklist"
      | "code"
      | "codeblock"
      | "quote"
      | "divider"
      | "table"
  ) => {
    if (viewMode === "preview") {
      setViewMode("edit");
    }

    const textarea = textareaRef.current;
    const content = note.content || "";

    if (!textarea) {
      let insertion = "";
      switch (type) {
        case "bold": insertion = "**bold text**"; break;
        case "italic": insertion = "*italic text*"; break;
        case "h1": insertion = "# Heading 1\n"; break;
        case "h2": insertion = "## Heading 2\n"; break;
        case "h3": insertion = "### Heading 3\n"; break;
        case "bullet": insertion = "- List item\n"; break;
        case "checklist": insertion = "- [ ] Task item\n"; break;
        case "code": insertion = "`code`"; break;
        case "codeblock": insertion = "```\ncode block\n```\n"; break;
        case "quote": insertion = "> Quote\n"; break;
        case "divider": insertion = "\n---\n"; break;
        case "table": insertion = "\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Item 1 | Item 2 | Item 3 |\n| Item 4 | Item 5 | Item 6 |\n"; break;
      }
      onChangeContent(content ? `${content}\n${insertion}` : insertion);
      return;
    }

    const start = textarea.selectionStart ?? content.length;
    const end = textarea.selectionEnd ?? content.length;
    const selected = content.substring(start, end);

    let replacement = "";
    let cursorOffsetStart = 0;
    let cursorOffsetEnd = 0;

    switch (type) {
      case "bold":
        replacement = `**${selected || "bold text"}**`;
        cursorOffsetStart = start + 2;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        break;
      case "italic":
        replacement = `*${selected || "italic text"}*`;
        cursorOffsetStart = start + 1;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 11);
        break;
      case "h1":
        replacement = `\n# ${selected || "Heading 1"}\n`;
        cursorOffsetStart = start + 3;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        break;
      case "h2":
        replacement = `\n## ${selected || "Heading 2"}\n`;
        cursorOffsetStart = start + 4;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        break;
      case "h3":
        replacement = `\n### ${selected || "Heading 3"}\n`;
        cursorOffsetStart = start + 5;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        break;
      case "bullet":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line) => `- ${line}`)
            .join("\n");
          cursorOffsetStart = start;
          cursorOffsetEnd = start + replacement.length;
        } else {
          replacement = `\n- ${selected || "List item"}\n`;
          cursorOffsetStart = start + 3;
          cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        }
        break;
      case "checklist":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line) => `- [ ] ${line}`)
            .join("\n");
          cursorOffsetStart = start;
          cursorOffsetEnd = start + replacement.length;
        } else {
          replacement = `\n- [ ] ${selected || "Task item"}\n`;
          cursorOffsetStart = start + 7;
          cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 9);
        }
        break;
      case "code":
        replacement = `\`${selected || "code"}\``;
        cursorOffsetStart = start + 1;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 4);
        break;
      case "codeblock":
        replacement = `\n\`\`\`\n${selected || "code block"}\n\`\`\`\n`;
        cursorOffsetStart = start + 5;
        cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 10);
        break;
      case "quote":
        if (selected.includes("\n")) {
          replacement = selected
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n");
          cursorOffsetStart = start;
          cursorOffsetEnd = start + replacement.length;
        } else {
          replacement = `\n> ${selected || "Quote"}\n`;
          cursorOffsetStart = start + 3;
          cursorOffsetEnd = cursorOffsetStart + (selected ? selected.length : 5);
        }
        break;
      case "divider":
        replacement = `\n---\n`;
        cursorOffsetStart = start + replacement.length;
        cursorOffsetEnd = cursorOffsetStart;
        break;
      case "table":
        replacement = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Item 1 | Item 2 | Item 3 |\n| Item 4 | Item 5 | Item 6 |\n`;
        cursorOffsetStart = start + 3;
        cursorOffsetEnd = cursorOffsetStart + 8;
        break;
    }

    const nextContent = content.substring(0, start) + replacement + content.substring(end);
    onChangeContent(nextContent);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorOffsetStart, cursorOffsetEnd);
        selectionRef.current = { start: cursorOffsetStart, end: cursorOffsetEnd };
      }
    }, 0);
  };

  // Flatten nested goals for selector
  const flattenGoals = (list: GoalNode[], depth = 0): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const g of list) {
      res.push({ id: g.id, title: g.title, depth });
      if (g.children && g.children.length > 0) {
        res.push(...flattenGoals(g.children, depth + 1));
      }
    }
    return res;
  };

  // Flatten nested tasks for selector
  const flattenTasks = (list: TaskItem[], depth = 0): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const t of list) {
      res.push({ id: t.id, title: t.title, depth });
      if (t.subtasks && t.subtasks.length > 0) {
        res.push(...flattenTasks(t.subtasks, depth + 1));
      }
    }
    return res;
  };

  // Flatten action plans for selector
  const flattenActionPlans = (list: ActionPlanNode[], depth = 0): Array<{ id: string; title: string; depth: number }> => {
    const res: Array<{ id: string; title: string; depth: number }> = [];
    for (const ap of list) {
      res.push({ id: ap.id, title: ap.title, depth });
      if (ap.children && ap.children.length > 0) {
        res.push(...flattenActionPlans(ap.children, depth + 1));
      }
    }
    return res;
  };

  const allFlatGoals = flattenGoals(goals);
  const allFlatTasks = flattenTasks(tasks);
  const allFlatPlans = flattenActionPlans(actionPlans);

  // Current linked name
  const linkedGoal = allFlatGoals.find((g) => g.id === note.goalId);
  const linkedTask = allFlatTasks.find((t) => t.id === note.taskId);
  const linkedPlan = allFlatPlans.find((p) => p.id === note.actionPlanId);

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
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center justify-between text-[11px] font-tech text-cyan-400/80">
            <button
              type="button"
              onClick={() => setIsLinkDropdownOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-cyan-500/30 hover:border-cyan-400 transition cursor-pointer text-[10px]"
            >
              {linkedGoal ? (
                <>
                  <Target className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-200 font-semibold truncate max-w-[200px]">
                    GOAL: {linkedGoal.title}
                  </span>
                </>
              ) : linkedTask ? (
                <>
                  <CheckSquare className="w-3 h-3 text-amber-400" />
                  <span className="text-amber-200 font-semibold truncate max-w-[200px]">
                    TASK: {linkedTask.title}
                  </span>
                </>
              ) : linkedPlan ? (
                <>
                  <Workflow className="w-3 h-3 text-purple-400" />
                  <span className="text-purple-200 font-semibold truncate max-w-[200px]">
                    PLAN: {linkedPlan.title}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-cyan-500/70" />
                  <span className="text-cyan-400/70">STANDALONE SCRATCHPAD</span>
                </>
              )}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Unlink button if linked */}
            {(note.goalId || note.taskId || note.actionPlanId) && (
              <button
                type="button"
                onClick={() =>
                  onChangeLink({ goalId: null, taskId: null, actionPlanId: null })
                }
                title="Detach from Context (Make Standalone)"
                className="text-[9px] text-cyan-500/60 hover:text-cyan-300 underline cursor-pointer"
              >
                Detach
              </button>
            )}
          </div>

          {/* Context Dropdown Popover */}
          {isLinkDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-56 overflow-y-auto rounded bg-[#03070d] border border-cyan-500/40 shadow-[0_4px_16px_rgba(0,0,0,0.8)] z-50 p-1.5 text-xs font-tech space-y-1">
              <div className="text-[10px] text-cyan-500/60 uppercase font-bold px-1.5 py-0.5 border-b border-cyan-500/20">
                Link Note To Context
              </div>

              {/* Standalone Option */}
              <div
                onClick={() => {
                  onChangeLink({ goalId: null, taskId: null, actionPlanId: null });
                  setIsLinkDropdownOpen(false);
                }}
                className={`p-1.5 rounded flex items-center gap-1.5 cursor-pointer transition ${
                  !note.goalId && !note.taskId && !note.actionPlanId
                    ? "bg-cyan-500/20 text-cyan-100 font-bold"
                    : "hover:bg-cyan-950/50 text-cyan-300"
                }`}
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Standalone Scratchpad (No Link)</span>
              </div>

              {/* Goals */}
              {allFlatGoals.length > 0 && (
                <div>
                  <div className="text-[9px] text-cyan-500/50 uppercase px-1.5 pt-1">
                    Goals
                  </div>
                  {allFlatGoals.map((g) => (
                    <div
                      key={g.id}
                      onClick={() => {
                        onChangeLink({ goalId: g.id, taskId: null, actionPlanId: null });
                        setIsLinkDropdownOpen(false);
                      }}
                      style={{ paddingLeft: `${g.depth * 8 + 6}px` }}
                      className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                        note.goalId === g.id
                          ? "bg-cyan-500/20 text-cyan-100 font-bold"
                          : "hover:bg-cyan-950/50 text-cyan-300"
                      }`}
                    >
                      <Target className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="truncate">{g.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {allFlatTasks.length > 0 && (
                <div>
                  <div className="text-[9px] text-amber-500/50 uppercase px-1.5 pt-1">
                    Tasks
                  </div>
                  {allFlatTasks.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        onChangeLink({ goalId: null, taskId: t.id, actionPlanId: null });
                        setIsLinkDropdownOpen(false);
                      }}
                      style={{ paddingLeft: `${t.depth * 8 + 6}px` }}
                      className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                        note.taskId === t.id
                          ? "bg-amber-500/20 text-amber-100 font-bold"
                          : "hover:bg-amber-950/50 text-amber-300"
                      }`}
                    >
                      <CheckSquare className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Plans */}
              {allFlatPlans.length > 0 && (
                <div>
                  <div className="text-[9px] text-purple-500/50 uppercase px-1.5 pt-1">
                    Action Plans
                  </div>
                  {allFlatPlans.map((ap) => (
                    <div
                      key={ap.id}
                      onClick={() => {
                        onChangeLink({ goalId: null, taskId: null, actionPlanId: ap.id });
                        setIsLinkDropdownOpen(false);
                      }}
                      style={{ paddingLeft: `${ap.depth * 8 + 6}px` }}
                      className={`p-1 rounded flex items-center gap-1.5 cursor-pointer transition truncate ${
                        note.actionPlanId === ap.id
                          ? "bg-purple-500/20 text-purple-100 font-bold"
                          : "hover:bg-purple-950/50 text-purple-300"
                      }`}
                    >
                      <Workflow className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">{ap.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Markdown Quick Formatting Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-[#040810] border-b border-cyan-500/20 overflow-x-auto shrink-0 select-none">
        <button
          type="button"
          onClick={() => applyFormatting("bold")}
          title="Bold (**text**)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("italic")}
          title="Italic (*text*)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => applyFormatting("h1")}
          title="Heading 1 (# Text)"
          className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("h2")}
          title="Heading 2 (## Text)"
          className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("h3")}
          title="Heading 3 (### Text)"
          className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          H3
        </button>

        <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => applyFormatting("bullet")}
          title="Bullet List (- item)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("checklist")}
          title="Interactive Checklist (- [ ] task)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <ListTodo className="w-3.5 h-3.5" />
        </button>

        <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

        <button
          type="button"
          onClick={() => applyFormatting("code")}
          title="Inline Code (`code`)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Code className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("quote")}
          title="Blockquote (> text)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("table")}
          title="Table (| col | col |)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Table className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => applyFormatting("divider")}
          title="Divider Line (---)"
          className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

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
