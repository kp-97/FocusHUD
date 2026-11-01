import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTextareaCaretPreservation } from "./useTextareaCaretPreservation";

describe("useTextareaCaretPreservation hook", () => {
  it("initializes with null selection and empty textareaRef", () => {
    const onChangeContent = vi.fn();
    const { result } = renderHook(() =>
      useTextareaCaretPreservation({
        content: "Hello world",
        onChangeContent,
        viewMode: "edit",
      })
    );

    expect(result.current.textareaRef.current).toBeNull();
    expect(result.current.selectionRef.current).toBeNull();
    expect(result.current.isInternalChangeRef.current).toBe(false);
  });

  it("records selection on recordSelection callback", () => {
    const onChangeContent = vi.fn();
    const { result } = renderHook(() =>
      useTextareaCaretPreservation({
        content: "Testing selection",
        onChangeContent,
        viewMode: "edit",
      })
    );

    const textarea = document.createElement("textarea");
    textarea.value = "Testing selection";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.setSelectionRange(3, 7);

    act(() => {
      result.current.recordSelection(textarea);
    });

    expect(result.current.selectionRef.current).toEqual({ start: 3, end: 7 });
    document.body.removeChild(textarea);
  });

  it("handles content change and notifies onChangeContent", () => {
    const onChangeContent = vi.fn();
    const { result } = renderHook(() =>
      useTextareaCaretPreservation({
        content: "Old text",
        onChangeContent,
        viewMode: "edit",
      })
    );

    const mockEvent = {
      target: {
        value: "New text",
        selectionStart: 8,
        selectionEnd: 8,
      },
    } as unknown as React.ChangeEvent<HTMLTextAreaElement>;

    act(() => {
      result.current.handleContentChange(mockEvent);
    });

    expect(onChangeContent).toHaveBeenCalledWith("New text");
    expect(result.current.selectionRef.current).toEqual({ start: 8, end: 8 });
    expect(result.current.isInternalChangeRef.current).toBe(true);
  });

  it("restores selection within safe bounds", () => {
    const onChangeContent = vi.fn();
    const { result } = renderHook(() =>
      useTextareaCaretPreservation({
        content: "Short",
        onChangeContent,
        viewMode: "edit",
      })
    );

    const textarea = document.createElement("textarea");
    textarea.value = "Short";
    document.body.appendChild(textarea);
    (result.current.textareaRef as any).current = textarea;

    act(() => {
      result.current.restoreSelection(100, 100);
    });

    expect(textarea.selectionStart).toBe(5);
    expect(textarea.selectionEnd).toBe(5);
    document.body.removeChild(textarea);
  });
});

