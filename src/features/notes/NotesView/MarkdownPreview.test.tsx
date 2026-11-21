import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  MarkdownPreview,
  splitTableRow,
  isDelimiterRow,
  parseAlignment,
} from "./MarkdownPreview";

describe("MarkdownPreview GFM Table Support", () => {
  describe("Helper Functions", () => {
    it("splitTableRow correctly parses pipe-delimited strings with and without edge pipes", () => {
      expect(splitTableRow("| Col A | Col B | Col C |")).toEqual(["Col A", "Col B", "Col C"]);
      expect(splitTableRow("Col A | Col B | Col C")).toEqual(["Col A", "Col B", "Col C"]);
      expect(splitTableRow("| OnlyOne |")).toEqual(["OnlyOne"]);
    });

    it("splitTableRow handles escaped pipes and backticks correctly", () => {
      expect(splitTableRow("| Escaped \\| Pipe | Normal |")).toEqual(["Escaped \\| Pipe", "Normal"]);
      expect(splitTableRow("| `a | b` | Normal |")).toEqual(["`a | b`", "Normal"]);
    });

    it("isDelimiterRow correctly identifies valid GFM delimiter rows", () => {
      expect(isDelimiterRow("| --- | --- |")).toBe(true);
      expect(isDelimiterRow("| :--- | :---: | ---: |")).toBe(true);
      expect(isDelimiterRow("--- | :---: | ---:")).toBe(true);
      expect(isDelimiterRow("| - | - |")).toBe(true);

      // Invalid delimiter rows
      expect(isDelimiterRow("---")).toBe(false); // no pipe
      expect(isDelimiterRow("| hello | world |")).toBe(false);
      expect(isDelimiterRow("| --- | invalid |")).toBe(false);
      expect(isDelimiterRow("")).toBe(false);
    });

    it("parseAlignment extracts column alignment from delimiter cell", () => {
      expect(parseAlignment(":---:")).toBe("center");
      expect(parseAlignment(":-:")).toBe("center");
      expect(parseAlignment("---:")).toBe("right");
      expect(parseAlignment("-:")).toBe("right");
      expect(parseAlignment(":---")).toBe("left");
      expect(parseAlignment(":-")).toBe("left");
      expect(parseAlignment("---")).toBe("left");
    });
  });

  describe("Table Rendering", () => {
    it("renders standard GFM tables with header, delimiter, and rows", () => {
      const markdown = `
| Task | Owner | Priority |
| :--- | :---: | ---: |
| Build HUD | Alice | High |
| Ship Tables | Bob | Medium |
`;
      const { container } = render(<MarkdownPreview content={markdown} />);

      const table = container.querySelector("table");
      expect(table).toBeInTheDocument();

      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(3);
      expect(headers[0]).toHaveTextContent("Task");
      expect(headers[1]).toHaveTextContent("Owner");
      expect(headers[2]).toHaveTextContent("Priority");

      // Check alignments
      expect(headers[0]).toHaveStyle({ textAlign: "left" });
      expect(headers[1]).toHaveStyle({ textAlign: "center" });
      expect(headers[2]).toHaveStyle({ textAlign: "right" });

      const cells = screen.getAllByRole("cell");
      expect(cells).toHaveLength(6);
      expect(cells[0]).toHaveTextContent("Build HUD");
      expect(cells[0]).toHaveStyle({ textAlign: "left" });
      expect(cells[1]).toHaveTextContent("Alice");
      expect(cells[1]).toHaveStyle({ textAlign: "center" });
      expect(cells[2]).toHaveTextContent("High");
      expect(cells[2]).toHaveStyle({ textAlign: "right" });
    });

    it("renders inline markdown elements inside table cells", () => {
      const markdown = `
| Feature | State | Code |
| --- | --- | --- |
| **Dark Mode** | *Beta* | \`config.json\` |
`;
      const { container } = render(<MarkdownPreview content={markdown} />);

      const boldEl = container.querySelector("strong");
      expect(boldEl).toBeInTheDocument();
      expect(boldEl).toHaveTextContent("Dark Mode");

      const italicEl = container.querySelector("em");
      expect(italicEl).toBeInTheDocument();
      expect(italicEl).toHaveTextContent("Beta");

      const codeEl = container.querySelector("code");
      expect(codeEl).toBeInTheDocument();
      expect(codeEl).toHaveTextContent("config.json");
    });

    it("handles escaped pipes and preserves content", () => {
      const markdown = `
| Command | Symbol |
| --- | --- |
| Pipe Test | Prefix \\| Suffix |
`;
      render(<MarkdownPreview content={markdown} />);

      expect(screen.getByText("Prefix | Suffix")).toBeInTheDocument();
    });

    it("pads missing cells when row has fewer columns than header", () => {
      const markdown = `
| Col 1 | Col 2 | Col 3 |
| --- | --- | --- |
| A | B |
`;
      const { container } = render(<MarkdownPreview content={markdown} />);

      const rows = container.querySelectorAll("tbody tr");
      expect(rows).toHaveLength(1);
      const rowCells = rows[0].querySelectorAll("td");
      expect(rowCells).toHaveLength(3);
      expect(rowCells[0]).toHaveTextContent("A");
      expect(rowCells[1]).toHaveTextContent("B");
      expect(rowCells[2]).toHaveTextContent("");
    });

    it("wraps tables in horizontal scroll container for narrow/half-pane views", () => {
      const markdown = `
| H1 | H2 |
| --- | --- |
| C1 | C2 |
`;
      const { container } = render(<MarkdownPreview content={markdown} />);

      const wrapper = container.querySelector(".overflow-x-auto");
      expect(wrapper).toBeInTheDocument();
      expect(wrapper).toContainElement(container.querySelector("table"));
    });

    it("does not treat normal text with pipes or hyphens as a table", () => {
      const markdown = `
This is line 1 | with a pipe
This is line 2 without pipes
`;
      const { container } = render(<MarkdownPreview content={markdown} />);
      expect(container.querySelector("table")).not.toBeInTheDocument();
      expect(screen.getByText(/This is line 1 \| with a pipe/)).toBeInTheDocument();
    });

    it("handles table followed by another paragraph seamlessly", () => {
      const markdown = `
| Name | Role |
| --- | --- |
| Sam | Lead |

Here is a paragraph after the table.
`;
      const { container } = render(<MarkdownPreview content={markdown} />);
      expect(container.querySelector("table")).toBeInTheDocument();
      expect(screen.getByText("Here is a paragraph after the table.")).toBeInTheDocument();
    });
  });
});

