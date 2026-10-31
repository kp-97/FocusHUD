import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { NoteEditor } from "./NoteEditor";
import { NoteItem } from "../../../types/hud";
import {
  broadcastSpellcheckChange,
  SPELLCHECK_ENABLED_KEY,
} from "../../../stores/spellcheckStore";

describe("NoteEditor component spellcheck integration", () => {
  const dummyNote: NoteItem = {
    id: "note-1",
    title: "Regional Spellcheck Spec",
    content: "The colour and flavour of tea are marvellous.",
    isPinned: false,
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.documentElement.removeAttribute("data-spellcheck");
  });

  it("applies default en-AU spellcheck attributes to title input and content textarea", () => {
    render(
      <NoteEditor
        note={dummyNote}
        onChangeTitle={vi.fn()}
        onChangeContent={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteNote={vi.fn()}
        onChangeLink={vi.fn()}
        saveStatus="saved"
      />
    );

    const titleInput = screen.getByPlaceholderText(/NOTE TITLE.../i) as HTMLInputElement;
    expect(titleInput.getAttribute("spellcheck")).toBe("true");
    expect(titleInput.lang).toBe("en-AU");

    const contentTextarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(contentTextarea.getAttribute("spellcheck")).toBe("true");
    expect(contentTextarea.lang).toBe("en-AU");
  });

  it("updates lang attribute dynamically when spellcheck locale changes across windows", () => {
    render(
      <NoteEditor
        note={dummyNote}
        onChangeTitle={vi.fn()}
        onChangeContent={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteNote={vi.fn()}
        onChangeLink={vi.fn()}
        saveStatus="saved"
      />
    );

    const contentTextarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(contentTextarea.lang).toBe("en-AU");

    // Broadcast spellcheck switch to en-US
    act(() => {
      broadcastSpellcheckChange("en-US", true);
    });

    expect(contentTextarea.lang).toBe("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });

  it("disables spellcheck when enabled is toggled off", () => {
    localStorage.setItem(SPELLCHECK_ENABLED_KEY, "false");

    render(
      <NoteEditor
        note={dummyNote}
        onChangeTitle={vi.fn()}
        onChangeContent={vi.fn()}
        onTogglePin={vi.fn()}
        onDeleteNote={vi.fn()}
        onChangeLink={vi.fn()}
        saveStatus="saved"
      />
    );

    const contentTextarea = screen.getByPlaceholderText(/Type notes here/i) as HTMLTextAreaElement;
    expect(contentTextarea.getAttribute("spellcheck")).toBe("false");
  });
});
