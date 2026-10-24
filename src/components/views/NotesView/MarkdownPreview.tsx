import React from "react";

interface MarkdownPreviewProps {
  content: string;
  onToggleChecklist?: (lineIndex: number) => void;
  className?: string;
}

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  onToggleChecklist,
  className = "",
}) => {
  if (!content.trim()) {
    return (
      <div className="text-cyan-500/40 italic font-mono text-xs py-4 text-center">
        [NO CONTENT TO PREVIEW]
      </div>
    );
  }

  const lines = content.split("\n");
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  const renderInline = (text: string): React.ReactNode => {
    // Regex for bold, italic, and inline code
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // Inline code: `code`
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/);
      // Bold: **bold**
      const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/);
      // Italic: *italic*
      const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)$/);

      // Find the earliest match
      const matches = [
        { type: "code", match: codeMatch, index: codeMatch ? codeMatch[1].length : -1 },
        { type: "bold", match: boldMatch, index: boldMatch ? boldMatch[1].length : -1 },
        { type: "italic", match: italicMatch, index: italicMatch ? italicMatch[1].length : -1 },
      ]
        .filter((m) => m.match !== null && m.index !== -1)
        .sort((a, b) => a.index - b.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const earliest = matches[0];
      const prefix = earliest.match![1];
      const matchedContent = earliest.match![2];
      const suffix = earliest.match![3];

      if (prefix) {
        parts.push(prefix);
      }

      if (earliest.type === "code") {
        parts.push(
          <code
            key={`code_${keyIdx++}`}
            className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-200 border border-cyan-500/30 text-[11px] font-mono select-text"
          >
            {matchedContent}
          </code>
        );
      } else if (earliest.type === "bold") {
        parts.push(
          <strong key={`bold_${keyIdx++}`} className="font-bold text-cyan-100">
            {matchedContent}
          </strong>
        );
      } else if (earliest.type === "italic") {
        parts.push(
          <em key={`italic_${keyIdx++}`} className="italic text-cyan-300">
            {matchedContent}
          </em>
        );
      }

      remaining = suffix;
    }

    return parts;
  };

  const elements: React.ReactNode[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Fenced Code Block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code_block_${idx}`}
            className="p-3 my-2 rounded bg-black/80 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] overflow-x-auto select-text shadow-inner"
          >
            <code>{codeBlockLines.join("\n")}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={`h3_${idx}`}
          className="text-xs font-orbitron font-bold text-cyan-300 tracking-wider uppercase mt-3 mb-1 pb-0.5 border-b border-cyan-500/20"
        >
          {renderInline(line.slice(4))}
        </h3>
      );
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={`h2_${idx}`}
          className="text-sm font-orbitron font-bold text-cyan-200 tracking-wider uppercase mt-4 mb-1.5 pb-1 border-b border-cyan-500/30"
        >
          {renderInline(line.slice(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h1
          key={`h1_${idx}`}
          className="text-base font-orbitron font-extrabold text-cyan-100 tracking-wider uppercase mt-4 mb-2 pb-1 border-b border-cyan-500/40 hud-glow-cyan"
        >
          {renderInline(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote_${idx}`}
          className="border-l-2 border-amber-500/60 pl-2.5 my-1.5 italic text-amber-200/90 text-xs bg-amber-500/5 py-1 rounded-r"
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      continue;
    }

    // Interactive Checklist: - [ ] or - [x]
    const checklistMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/);
    if (checklistMatch) {
      const isChecked = checklistMatch[2].toLowerCase() === "x";
      const taskText = checklistMatch[3];
      const lineIndex = idx;

      elements.push(
        <div
          key={`checklist_${idx}`}
          className="flex items-start gap-2 my-1 text-xs select-none group"
        >
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onToggleChecklist && onToggleChecklist(lineIndex)}
            className="mt-0.5 w-3.5 h-3.5 rounded border border-cyan-500 bg-cyan-950/80 text-cyan-400 focus:ring-0 cursor-pointer accent-cyan-400 shrink-0"
          />
          <span
            onClick={() => onToggleChecklist && onToggleChecklist(lineIndex)}
            className={`cursor-pointer transition-colors ${
              isChecked
                ? "line-through text-cyan-500/50"
                : "text-cyan-200 group-hover:text-cyan-100"
            }`}
          >
            {renderInline(taskText)}
          </span>
        </div>
      );
      continue;
    }

    // Unordered Bullet: - or *
    if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={`bullet_${idx}`} className="flex items-start gap-2 my-0.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
          <span className="text-cyan-200">{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      elements.push(
        <hr
          key={`hr_${idx}`}
          className="border-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent my-3"
        />
      );
      continue;
    }

    // Numbered / Ordered List: 1. or 1)
    const olMatch = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (olMatch) {
      const num = olMatch[2];
      const text = olMatch[3];
      elements.push(
        <div key={`ol_${idx}`} className="flex items-start gap-2 my-0.5 text-xs">
          <span className="font-mono text-cyan-400 font-bold shrink-0">{num}.</span>
          <span className="text-cyan-200">{renderInline(text)}</span>
        </div>
      );
      continue;
    }

    // Empty Line
    if (line.trim() === "") {
      elements.push(<div key={`empty_${idx}`} className="h-2" />);
      continue;
    }

    // Standard Paragraph Line
    elements.push(
      <p key={`p_${idx}`} className="text-xs text-cyan-200/90 leading-relaxed my-0.5">
        {renderInline(line)}
      </p>
    );
  }

  // Close unclosed code block if needed
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="unclosed_code_block"
        className="p-3 my-2 rounded bg-black/80 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] overflow-x-auto select-text shadow-inner"
      >
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
  }

  return (
    <div
      className={`prose-sm max-w-none text-cyan-200 font-hud select-text ${className}`}
    >
      {elements}
    </div>
  );
};
