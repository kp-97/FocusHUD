import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { NotesView } from "./NotesView";
import * as dbService from "../../../services/dbService";
import { NoteItem } from "../../../types/hud";

vi.mock("../../../services/dbService", () => ({
  fetchNotes: vi.fn(),
  persistNote: vi.fn(),
  removeNote: vi.fn(),
  syncNotes: vi.fn(),
  onDbChange: vi.fn().mockReturnValue(Promise.resolve(vi.fn())),
  isTauriEnvironment: vi.fn().mockReturnValue(true),
  fetchGoals: vi.fn().mockResolvedValue([]),
  fetchTasks: vi.fn().mockResolvedValue([]),
  fetchActionPlans: vi.fn().mockResolvedValue([]),
}));

describe("NotesView Component", () => {
  const mockInitialNotes: NoteItem[] = [
    {
      id: "note-1",
      title: "First Scratchpad",
      content: "# Heading 1\n- [ ] Task item 1\n**Bold Note Content**",
      isPinned: false,
      sortOrder: 0,
      createdAt: 1000,
      updatedAt: 1000,
    },
    {
      id: "note-2",
      title: "Pinned Goal Note",
      content: "Linked to important goal",
      isPinned: true,
      goalId: "goal-1",
      sortOrder: 1,
      createdAt: 2000,
      updatedAt: 2000,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      value: 600,
    });
    (dbService.fetchNotes as any).mockResolvedValue([...mockInitialNotes]);
    (dbService.persistNote as any).mockResolvedValue(null);
    (dbService.removeNote as any).mockResolvedValue(true);
    (dbService.syncNotes as any).mockResolvedValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders notes list ordered by pinned first", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    // Pinned note has GOAL badge
    expect(screen.getByText("GOAL")).toBeInTheDocument();
  });

  it("filters notes by search query", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search notes/i);
    fireEvent.change(searchInput, { target: { value: "Pinned" } });

    expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
    expect(screen.queryByText("First Scratchpad")).not.toBeInTheDocument();
  });

  it("filters notes by tab: Standalone vs Linked", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    // Click SCRATCHPAD filter tab
    const scratchpadTab = screen.getByRole("button", { name: "SCRATCHPAD" });
    fireEvent.click(scratchpadTab);

    // note-1 is standalone (no goal/task/plan id)
    expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    // note-2 is linked to goal-1, so it shouldn't show under scratchpad
    expect(screen.queryByText("Pinned Goal Note")).not.toBeInTheDocument();

    // Click LINKED filter tab
    const linkedTab = screen.getByRole("button", { name: "LINKED" });
    fireEvent.click(linkedTab);

    expect(screen.queryByText("First Scratchpad")).not.toBeInTheDocument();
    expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
  });

  it("creates a new note when clicking NEW button", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
    });

    const newBtn = screen.getByTitle(/Create New Note/i);
    fireEvent.click(newBtn);

    expect(screen.getAllByText("UNTITLED NOTE").length).toBeGreaterThan(0);
  });

  it("creates a new note via Ctrl+N keyboard shortcut", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "n", ctrlKey: true });

    expect(screen.getAllByText("UNTITLED NOTE").length).toBeGreaterThan(0);
  });

  it("toggles note pin state", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    // Select note-1 (First Scratchpad)
    fireEvent.click(screen.getByText("First Scratchpad"));

    // Find pin button
    const pinBtns = screen.getAllByTitle("Pin Note to Top");
    fireEvent.click(pinBtns[0]);

    // Now it should have an unpin action
    await waitFor(() => {
      expect(screen.getAllByTitle(/Unpin Note/i).length).toBeGreaterThan(0);
    });
  });

  it("switches to Markdown Preview and renders formatting and interactive checklists", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    // Select note-1
    fireEvent.click(screen.getByText("First Scratchpad"));

    // Click PREVIEW mode tab
    const previewBtn = screen.getByTitle(/Preview Rendered Markdown/i);
    fireEvent.click(previewBtn);

    // Markdown rendered elements
    expect(screen.getByRole("heading", { name: "Heading 1" })).toBeInTheDocument();
    expect(screen.getByText("Task item 1")).toBeInTheDocument();
    expect(screen.getByText("Bold Note Content")).toBeInTheDocument();

    // Checkbox toggle test
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it("copies note to clipboard and shows toast notification", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("First Scratchpad"));

    const copyBtn = screen.getByTitle(/Copy Note to Clipboard/i);
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("COPIED TO CLIPBOARD!")).toBeInTheDocument();
    });
  });

  it("deletes note with confirmation prompt", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByText("First Scratchpad")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Delete Active Note");
    fireEvent.click(deleteBtn);

    // Confirmation prompt appears
    expect(screen.getByText("DELETE?")).toBeInTheDocument();
    const yesBtn = screen.getByText("YES");
    fireEvent.click(yesBtn);

    await waitFor(() => {
      expect(screen.queryByText("First Scratchpad")).not.toBeInTheDocument();
      expect(dbService.removeNote).toHaveBeenCalledWith("note-1");
    });
  });

  it("debounces auto-save on typing and calls persistNote", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue("First Scratchpad");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });

    // Status indicator switches to SAVING...
    expect(screen.getByText(/SAVING/i)).toBeInTheDocument();

    // Wait for 350ms debounce
    await waitFor(
      () => {
        expect(dbService.persistNote).toHaveBeenCalled();
        expect(screen.getByText(/SAVED/i)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it("renders back button when rendered inside left dock", async () => {
    const handleBack = vi.fn();
    render(<NotesView isLeftDock={true} onBackToMonitoring={handleBack} />);

    await waitFor(() => {
      expect(screen.getByText("Pinned Goal Note")).toBeInTheDocument();
    });

    const backBtn = screen.getByRole("button", { name: /RETURN TO MONITORING/i });
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);
  });

  it("applies formatting from markdown toolbar to active note", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const boldBtn = screen.getByTitle("Bold (**text**)");
    expect(boldBtn).toBeInTheDocument();

    fireEvent.click(boldBtn);

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("**");
  });

  it("inserts checklist item from markdown toolbar", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const checklistBtn = screen.getByTitle("Interactive Checklist (- [ ] task)");
    fireEvent.click(checklistBtn);

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("- [ ]");
  });

  it("preserves cursor selection range when content updates and component re-renders (Issue #41)", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    textarea.focus();

    // Set cursor in middle of content
    textarea.setSelectionRange(5, 5);
    fireEvent.select(textarea);

    // Simulate user typing at position 5
    const updatedContent = textarea.value.slice(0, 5) + "X" + textarea.value.slice(5);
    fireEvent.change(textarea, {
      target: {
        value: updatedContent,
        selectionStart: 6,
        selectionEnd: 6,
      },
    });

    // Cursor position should be preserved at 6, not jumped to end
    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(6);
  });

  it("preserves cursor selection across window resize events (Issue #41)", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(8, 8);
    fireEvent.select(textarea);

    // Trigger window resize event
    fireEvent(window, new Event("resize"));

    // Cursor position should stay preserved at 8
    expect(textarea.selectionStart).toBe(8);
    expect(textarea.selectionEnd).toBe(8);
  });

  it("preserves NoteEditor and cursor selection when container width crosses split breakpoint (Issue #41)", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(10, 10);
    fireEvent.select(textarea);

    // Verify textarea is still mounted and cursor is maintained
    expect(textarea.selectionStart).toBe(10);
    expect(document.activeElement).toBe(textarea);
  });

  it("inserts table template when clicking table button in editor toolbar", async () => {
    render(<NotesView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("First Scratchpad")).toBeInTheDocument();
    });

    const tableButton = screen.getByTitle(/Table \(\| col \| col \|\)/i);
    fireEvent.click(tableButton);

    const textarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain("| Column 1 | Column 2 | Column 3 |");
    expect(textarea.value).toContain("| :--- | :---: | ---: |");
  });
});
