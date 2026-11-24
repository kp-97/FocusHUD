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

export interface MarkdownPreviewProps {
  content: string;
  onToggleChecklist?: (lineIndex: number) => void;
  className?: string;
  variant?: "cyan" | "amber";
  hideEmptyPlaceholder?: boolean;
}

const THEMES = {
  cyan: {
    container: "text-cyan-200",
    paragraph: "text-cyan-200/90",
    h1: "text-base font-extrabold text-cyan-100 tracking-wider uppercase mt-3 mb-2 pb-1 border-b border-cyan-500/40 hud-glow-cyan",
    h2: "text-sm font-bold text-cyan-200 tracking-wider uppercase mt-3 mb-1.5 pb-1 border-b border-cyan-500/30",
    h3: "text-xs font-bold text-cyan-300 tracking-wider uppercase mt-2.5 mb-1 pb-0.5 border-b border-cyan-500/20",
    blockquote: "border-l-2 border-amber-500/60 pl-2.5 my-1.5 italic text-amber-200/90 text-xs bg-amber-500/5 py-1 rounded-r",
    bulletDot: "bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.6)]",
    bulletText: "text-cyan-200",
    olNum: "text-cyan-400",
    codeInline: "px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-200 border border-cyan-500/30 text-[11px] font-mono select-text",
    codeBlock: "p-3 my-2 rounded bg-black/80 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] overflow-x-auto select-text shadow-inner",
    bold: "font-bold text-cyan-100",
    italic: "italic text-cyan-300",
    tableWrap: "my-3 w-full overflow-x-auto rounded border border-cyan-500/30 bg-black/50 shadow-inner",
    tableThead: "border-b border-cyan-500/30 bg-cyan-950/60 font-semibold tracking-wider text-cyan-100 uppercase",
    tableThBorder: "border-r last:border-r-0 border-cyan-500/20",
    tableDivide: "divide-y divide-cyan-500/10",
    tableTrHover: "hover:bg-cyan-500/10",
    tableTrAlt: "bg-cyan-950/20",
    tableTd: "border-r last:border-r-0 border-cyan-500/10 text-cyan-200/90",
    hr: "via-cyan-500/50",
    link: "text-cyan-300 hover:text-cyan-100",
    emptyPlaceholder: "text-cyan-500/40",
  },
  amber: {
    container: "text-amber-100",
    paragraph: "text-amber-100/90",
    h1: "text-base font-extrabold text-amber-200 tracking-wider uppercase mt-3 mb-2 pb-1 border-b border-amber-500/40",
    h2: "text-sm font-bold text-amber-300 tracking-wider uppercase mt-3 mb-1.5 pb-1 border-b border-amber-500/30",
    h3: "text-xs font-bold text-amber-300 tracking-wider uppercase mt-2.5 mb-1 pb-0.5 border-b border-amber-500/20",
    blockquote: "border-l-2 border-cyan-500/60 pl-2.5 my-1.5 italic text-cyan-200/90 text-xs bg-cyan-500/5 py-1 rounded-r",
    bulletDot: "bg-amber-400 shadow-[0_0_6px_rgba(255,145,0,0.6)]",
    bulletText: "text-amber-100/90",
    olNum: "text-amber-400",
    codeInline: "px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-200 border border-amber-500/30 text-[11px] font-mono select-text",
    codeBlock: "p-3 my-2 rounded bg-black/80 border border-amber-500/30 text-amber-300 font-mono text-[11px] overflow-x-auto select-text shadow-inner",
    bold: "font-bold text-amber-50",
    italic: "italic text-amber-200",
    tableWrap: "my-3 w-full overflow-x-auto rounded border border-amber-500/30 bg-black/50 shadow-inner",
    tableThead: "border-b border-amber-500/30 bg-amber-950/60 font-semibold tracking-wider text-amber-100 uppercase",
    tableThBorder: "border-r last:border-r-0 border-amber-500/20",
    tableDivide: "divide-y divide-amber-500/10",
    tableTrHover: "hover:bg-amber-500/10",
    tableTrAlt: "bg-amber-950/20",
    tableTd: "border-r last:border-r-0 border-amber-500/10 text-amber-100/90",
    hr: "via-amber-500/50",
    link: "text-amber-300 hover:text-amber-100",
    emptyPlaceholder: "text-amber-500/40",
  },
};

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  onToggleChecklist,
  className = "",
  variant = "cyan",
  hideEmptyPlaceholder = false,
}) => {
  const theme = THEMES[variant];

  if (!content.trim()) {
    if (hideEmptyPlaceholder) return null;
    return (
      <div className={`${theme.emptyPlaceholder} italic font-mono text-xs py-4 text-center`}>
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
      // Link: [text](url)
      const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);

      // Find the earliest match
      const matches = [
        { type: "code", match: codeMatch, index: codeMatch ? codeMatch[1].length : -1 },
        { type: "bold", match: boldMatch, index: boldMatch ? boldMatch[1].length : -1 },
        { type: "italic", match: italicMatch, index: italicMatch ? italicMatch[1].length : -1 },
        { type: "link", match: linkMatch, index: linkMatch ? linkMatch[1].length : -1 },
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
      const suffix = earliest.type === "link" ? earliest.match![4] : earliest.match![3];

      if (prefix) {
        parts.push(prefix);
      }

      if (earliest.type === "code") {
        parts.push(
          <code
            key={`code_${keyIdx++}`}
            className={theme.codeInline}
          >
            {matchedContent}
          </code>
        );
      } else if (earliest.type === "bold") {
        parts.push(
          <strong key={`bold_${keyIdx++}`} className={theme.bold}>
            {matchedContent}
          </strong>
        );
      } else if (earliest.type === "italic") {
        parts.push(
          <em key={`italic_${keyIdx++}`} className={theme.italic}>
            {matchedContent}
          </em>
        );
      } else if (earliest.type === "link") {
        const href = earliest.match![3];
        parts.push(
          <a
            key={`link_${keyIdx++}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className={`underline underline-offset-2 ${theme.link}`}
          >
            {matchedContent}
          </a>
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
            className={theme.codeBlock}
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
            className={theme.tableWrap}
          >
            <table className="w-full min-w-full border-collapse text-left text-xs">
              <thead className={theme.tableThead}>
                <tr>
                  {headerCells.map((headerText, cIdx) => (
                    <th
                      key={`th_${cIdx}`}
                      style={{ textAlign: alignments[cIdx] }}
                      className={`px-3 py-2 text-[11px] font-bold ${theme.tableThBorder} whitespace-nowrap`}
                    >
                      {renderInline(headerText.replace(/\\\|/g, "|"))}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`font-mono text-[11px] ${theme.tableDivide}`}>
                {dataRows.map((rowCells, rIdx) => (
                  <tr
                    key={`tr_${rIdx}`}
                    className={`transition-colors ${theme.tableTrHover} ${
                      rIdx % 2 === 1 ? theme.tableTrAlt : "bg-transparent"
                    }`}
                  >
                    {headerCells.map((_, cIdx) => (
                      <td
                        key={`td_${rIdx}_${cIdx}`}
                        style={{ textAlign: alignments[cIdx] }}
                        className={`px-3 py-1.5 leading-relaxed ${theme.tableTd}`}
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
          className={theme.h3}
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
          className={theme.h2}
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
          className={theme.h1}
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
          className={theme.blockquote}
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
          <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${theme.bulletDot}`} />
          <span className={theme.bulletText}>{renderInline(line.slice(2))}</span>
        </div>
      );
      continue;
    }

    // Horizontal Rule: ---, ***, ___
    if (/^(\s*[-*_]\s*){3,}$/.test(line.trim())) {
      elements.push(
        <hr
          key={`hr_${idx}`}
          className={`border-0 h-px bg-gradient-to-r from-transparent ${theme.hr} to-transparent my-2.5`}
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
          <span className={`font-mono font-bold shrink-0 ${theme.olNum}`}>{num}.</span>
          <span className={theme.bulletText}>{renderInline(text)}</span>
        </div>
      );
      continue;
    }

    // Empty Line
    if (line.trim() === "") {
      elements.push(<div key={`empty_${idx}`} className="h-1.5" />);
      continue;
    }

    // Standard Paragraph Line
    elements.push(
      <p key={`p_${idx}`} className={`text-xs leading-relaxed my-0.5 ${theme.paragraph}`}>
        {renderInline(line)}
      </p>
    );
  }

  // Close unclosed code block if needed
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre
        key="unclosed_code_block"
        className={theme.codeBlock}
      >
        <code>{codeBlockLines.join("\n")}</code>
      </pre>
    );
  }

  return (
    <div
      className={`prose-sm max-w-none font-hud select-text ${theme.container} ${className}`}
    >
      {elements}
    </div>
  );
};
