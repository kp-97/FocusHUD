import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  NoteFormattingToolbar,
  applyMarkdownFormatting,
} from "./NoteFormattingToolbar";

describe("NoteFormattingToolbar component", () => {
  it("renders all markdown format buttons", () => {
    const onApply = vi.fn();
    render(<NoteFormattingToolbar onApplyFormatting={onApply} />);

    expect(screen.getByTitle("Bold (**text**)")).toBeInTheDocument();
    expect(screen.getByTitle("Italic (*text*)")).toBeInTheDocument();
    expect(screen.getByTitle("Heading 1 (# Text)")).toBeInTheDocument();
    expect(screen.getByTitle("Heading 2 (## Text)")).toBeInTheDocument();
    expect(screen.getByTitle("Heading 3 (### Text)")).toBeInTheDocument();
    expect(screen.getByTitle("Bullet List (- item)")).toBeInTheDocument();
    expect(screen.getByTitle("Interactive Checklist (- [ ] task)")).toBeInTheDocument();
    expect(screen.getByTitle("Inline Code (`code`)")).toBeInTheDocument();
    expect(screen.getByTitle("Blockquote (> text)")).toBeInTheDocument();
    expect(screen.getByTitle("Table (| col | col |)")).toBeInTheDocument();
    expect(screen.getByTitle("Divider Line (---)")).toBeInTheDocument();
  });

  it("calls onApplyFormatting when a button is clicked", () => {
    const onApply = vi.fn();
    const onEnsureEdit = vi.fn();
    render(
      <NoteFormattingToolbar
        onApplyFormatting={onApply}
        onEnsureEditMode={onEnsureEdit}
      />
    );

    fireEvent.click(screen.getByTitle("Bold (**text**)"));
    expect(onEnsureEdit).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("bold");

    fireEvent.click(screen.getByTitle("Heading 1 (# Text)"));
    expect(onApply).toHaveBeenCalledWith("h1");
  });

  it("applies formatting directly when textareaRef is supplied", () => {
    const onChangeContent = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.value = "Selected phrase";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 15;
    document.body.appendChild(textarea);

    const textareaRef = { current: textarea };

    render(
      <NoteFormattingToolbar
        content="Selected phrase"
        onChangeContent={onChangeContent}
        textareaRef={textareaRef}
      />
    );

    fireEvent.click(screen.getByTitle("Italic (*text*)"));
    expect(onChangeContent).toHaveBeenCalledWith("*Selected phrase*");
    document.body.removeChild(textarea);
  });
});

describe("applyMarkdownFormatting helper", () => {
  it("formats without textarea element by appending", () => {
    const onChange = vi.fn();
    applyMarkdownFormatting("bold", "Initial", null, onChange);
    expect(onChange).toHaveBeenCalledWith("Initial\n**bold text**");
  });

  it("formats multiline text into checklist items", () => {
    const onChange = vi.fn();
    const textarea = document.createElement("textarea");
    textarea.value = "Item 1\nItem 2";
    textarea.selectionStart = 0;
    textarea.selectionEnd = 13;

    applyMarkdownFormatting("checklist", textarea.value, textarea, onChange);
    expect(onChange).toHaveBeenCalledWith("- [ ] Item 1\n- [ ] Item 2");
  });
});

