import React from "react";

export function splitTableRow(row: string): string[] {
  let trimmed = row.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let escaped = false;
  let inBacktick = false;

  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "\\" && !escaped) {
      escaped = true;
      current += char;
      continue;
    }
    if (char === "`" && !escaped) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }
    if (char === "|" && !escaped && !inBacktick) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
    escaped = false;
  }
  cells.push(current.trim());
  return cells;
}

export function isDelimiterRow(row: string): boolean {
  const trimmed = row.trim();
  if (!trimmed.includes("-") || !trimmed.includes("|")) return false;
  const cells = splitTableRow(trimmed);
  if (cells.length === 0) return false;
  return cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

export function parseAlignment(delimiterCell: string): "left" | "center" | "right" {
  const trimmed = delimiterCell.trim();
  const leftColon = trimmed.startsWith(":");
  const rightColon = trimmed.endsWith(":");
  if (leftColon && rightColon) return "center";
  if (rightColon) return "right";
  return "left";
}

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

    // GFM Table: Check if current line and next line form a valid table header and delimiter row
    if (
      line.includes("|") &&
      idx + 1 < lines.length &&
      lines[idx + 1].includes("|") &&
      isDelimiterRow(lines[idx + 1])
    ) {
      const headerCells = splitTableRow(line);
      const delimCells = splitTableRow(lines[idx + 1]);

      if (headerCells.length > 0 && delimCells.length === headerCells.length) {
        const alignments = delimCells.map(parseAlignment);
        const dataRows: string[][] = [];
        let tableEndIdx = idx + 1;

        for (let r = idx + 2; r < lines.length; r++) {
          const rowLine = lines[r];
          const trimmedRow = rowLine.trim();

          if (!trimmedRow) break;
          if (trimmedRow.startsWith("```")) break;
          if (/^(\s*[-*_]\s*){3,}$/.test(trimmedRow)) break;
          if (trimmedRow.startsWith("#")) break;
          if (!trimmedRow.includes("|")) break;

          dataRows.push(splitTableRow(rowLine));
          tableEndIdx = r;
        }

        elements.push(
          <div
            key={`table_wrap_${idx}`}
            className="my-3 w-full overflow-x-auto rounded border border-cyan-500/30 bg-black/50 shadow-inner"
          >
            <table className="w-full min-w-full border-collapse text-left text-xs text-cyan-200">
              <thead className="border-b border-cyan-500/30 bg-cyan-950/60 font-orbitron font-semibold tracking-wider text-cyan-100 uppercase">
                <tr>
                  {headerCells.map((headerText, cIdx) => (
                    <th
                      key={`th_${cIdx}`}
                      style={{ textAlign: alignments[cIdx] }}
                      className="px-3 py-2 text-[11px] font-bold border-r last:border-r-0 border-cyan-500/20 whitespace-nowrap"
                    >
                      {renderInline(headerText.replace(/\\\|/g, "|"))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/10 font-mono text-[11px]">
                {dataRows.map((rowCells, rIdx) => (
                  <tr
                    key={`tr_${rIdx}`}
                    className={`transition-colors hover:bg-cyan-500/10 ${
                      rIdx % 2 === 1 ? "bg-cyan-950/20" : "bg-transparent"
                    }`}
                  >
                    {headerCells.map((_, cIdx) => (
                      <td
                        key={`td_${rIdx}_${cIdx}`}
                        style={{ textAlign: alignments[cIdx] }}
                        className="px-3 py-1.5 border-r last:border-r-0 border-cyan-500/10 text-cyan-200/90 leading-relaxed"
                      >
                        {renderInline((rowCells[cIdx] ?? "").replace(/\\\|/g, "|"))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

        idx = tableEndIdx;
        continue;
      }
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
