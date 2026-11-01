import { useRef, useCallback, useLayoutEffect, useEffect } from "react";

export interface UseTextareaCaretPreservationOptions {
  content: string;
  onChangeContent: (content: string) => void;
  viewMode?: "edit" | "preview" | "split";
}

export interface UseTextareaCaretPreservationReturn {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  selectionRef: React.MutableRefObject<{ start: number; end: number } | null>;
  isInternalChangeRef: React.MutableRefObject<boolean>;
  recordSelection: (el?: HTMLTextAreaElement | null) => void;
  handleContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  restoreSelection: (start?: number, end?: number) => void;
}

/**
 * Hook to preserve cursor position and selection range across re-renders,
 * layout updates, window resizes, and view mode toggles.
 */
export function useTextareaCaretPreservation({
  content,
  onChangeContent,
  viewMode,
}: UseTextareaCaretPreservationOptions): UseTextareaCaretPreservationReturn {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      isInternalChangeRef.current = true;
      selectionRef.current = {
        start: e.target.selectionStart,
        end: e.target.selectionEnd,
      };
      onChangeContent(e.target.value);
    },
    [onChangeContent]
  );

  // Restore selection helper (optionally overriding positions)
  const restoreSelection = useCallback((start?: number, end?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const targetStart = start ?? selectionRef.current?.start;
    const targetEnd = end ?? selectionRef.current?.end;
    if (targetStart === undefined || targetEnd === undefined) return;
    const len = textarea.value.length;
    const safeStart = Math.min(targetStart, len);
    const safeEnd = Math.min(targetEnd, len);
    try {
      textarea.setSelectionRange(safeStart, safeEnd);
      selectionRef.current = { start: safeStart, end: safeEnd };
    } catch {}
  }, []);

  // Restore selection synchronously before paint if cursor jumped unexpectedly
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
  }, [content]);

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

  return {
    textareaRef,
    selectionRef,
    isInternalChangeRef,
    recordSelection,
    handleContentChange,
    restoreSelection,
  };
}

