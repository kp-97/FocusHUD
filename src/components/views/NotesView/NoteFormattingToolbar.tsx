import React from "react";
import {
  Bold,
  Italic,
  List,
  ListTodo,
  Code,
  Quote,
  Minus,
  Table,
} from "lucide-react";

export type MarkdownFormatType =
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
  | "table";

export function applyMarkdownFormatting(
  type: MarkdownFormatType,
  content: string,
  textarea: HTMLTextAreaElement | null,
  onChangeContent: (content: string) => void,
  onCursorUpdate?: (start: number, end: number) => void
): void {
  if (!textarea) {
    let insertion = "";
    switch (type) {
      case "bold":
        insertion = "**bold text**";
        break;
      case "italic":
        insertion = "*italic text*";
        break;
      case "h1":
        insertion = "# Heading 1\n";
        break;
      case "h2":
        insertion = "## Heading 2\n";
        break;
      case "h3":
        insertion = "### Heading 3\n";
        break;
      case "bullet":
        insertion = "- List item\n";
        break;
      case "checklist":
        insertion = "- [ ] Task item\n";
        break;
      case "code":
        insertion = "`code`";
        break;
      case "codeblock":
        insertion = "```\ncode block\n```\n";
        break;
      case "quote":
        insertion = "> Quote\n";
        break;
      case "divider":
        insertion = "\n---\n";
        break;
      case "table":
        insertion =
          "\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Item 1 | Item 2 | Item 3 |\n| Item 4 | Item 5 | Item 6 |\n";
        break;
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
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(cursorOffsetStart, cursorOffsetEnd);
      if (onCursorUpdate) {
        onCursorUpdate(cursorOffsetStart, cursorOffsetEnd);
      }
    }
  }, 0);
}

export interface NoteFormattingToolbarProps {
  onApplyFormatting?: (type: MarkdownFormatType) => void;
  content?: string;
  onChangeContent?: (content: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  selectionRef?: React.MutableRefObject<{ start: number; end: number } | null>;
  onEnsureEditMode?: () => void;
  className?: string;
}

export const NoteFormattingToolbar: React.FC<NoteFormattingToolbarProps> = ({
  onApplyFormatting,
  content = "",
  onChangeContent,
  textareaRef,
  selectionRef,
  onEnsureEditMode,
  className = "",
}) => {
  const handleClick = (type: MarkdownFormatType) => {
    if (onEnsureEditMode) {
      onEnsureEditMode();
    }

    if (onApplyFormatting) {
      onApplyFormatting(type);
    } else if (onChangeContent && textareaRef) {
      applyMarkdownFormatting(
        type,
        content,
        textareaRef.current,
        onChangeContent,
        (start, end) => {
          if (selectionRef) {
            selectionRef.current = { start, end };
          }
        }
      );
    }
  };

  return (
    <div
      className={`flex items-center gap-0.5 px-2 py-1 bg-[#040810] border-b border-cyan-500/20 overflow-x-auto shrink-0 select-none ${className}`}
    >
      <button
        type="button"
        onClick={() => handleClick("bold")}
        title="Bold (**text**)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick("italic")}
        title="Italic (*text*)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

      <button
        type="button"
        onClick={() => handleClick("h1")}
        title="Heading 1 (# Text)"
        className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => handleClick("h2")}
        title="Heading 2 (## Text)"
        className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => handleClick("h3")}
        title="Heading 3 (### Text)"
        className="px-1.5 py-0.5 rounded text-[10px] font-orbitron font-bold text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        H3
      </button>

      <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

      <button
        type="button"
        onClick={() => handleClick("bullet")}
        title="Bullet List (- item)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <List className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick("checklist")}
        title="Interactive Checklist (- [ ] task)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <ListTodo className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-3.5 bg-cyan-500/20 mx-1 shrink-0" />

      <button
        type="button"
        onClick={() => handleClick("code")}
        title="Inline Code (`code`)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Code className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick("quote")}
        title="Blockquote (> text)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Quote className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick("table")}
        title="Table (| col | col |)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Table className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => handleClick("divider")}
        title="Divider Line (---)"
        className="p-1 rounded text-cyan-400/70 hover:text-cyan-100 hover:bg-cyan-500/20 transition cursor-pointer"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

