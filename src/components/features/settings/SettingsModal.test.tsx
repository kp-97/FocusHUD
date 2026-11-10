import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SettingsModal } from "./SettingsModal";
import * as store from "../../../stores/layoutStore";
import * as tauriBridge from "../../../services/tauriBridge";

vi.mock("./UpdatesTab", () => ({
  UpdatesTab: () => <div data-testid="updates-tab">Mock Updates Tab</div>,
}));

describe("SettingsModal component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SettingsModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal dialog when isOpen is true", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /HUD PREFERENCES & SETTINGS/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/NAVIGATION VIEWS & ORDERING/i)).toBeInTheDocument();
    expect(screen.getByText(/MAXIMUM PANE WIDTH LIMITS/i)).toBeInTheDocument();
    expect(screen.getByText(/PANE SIZING & MEMORY/i)).toBeInTheDocument();
  });

  it("resets remembered widths to defaults when clicking Reset Widths button", () => {
    const handleReset = vi.fn();
    store.setRememberedLeftWidth(450);
    store.setRememberedRightWidth(420);

    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        onResetWidths={handleReset}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Reset Widths/i });
    fireEvent.click(resetBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
    expect(store.getRememberedLeftWidth()).toBe(store.DEFAULT_LEFT_WIDTH);
    expect(store.getRememberedRightWidth()).toBe(store.DEFAULT_RIGHT_WIDTH);
    expect(screen.getByText(/Reset to Defaults!/i)).toBeInTheDocument();
  });

  it("toggles view visibility using checkboxes", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Toggle Calendar visibility off
    const calendarCheckbox = screen.getByLabelText(/Toggle CALENDAR visibility/i) as HTMLInputElement;
    expect(calendarCheckbox.checked).toBe(true);

    fireEvent.click(calendarCheckbox);
    expect(calendarCheckbox.checked).toBe(false);

    const saved = store.loadNavConfig();
    const calendarItem = saved.find((item) => item.id === "calendar");
    expect(calendarItem?.visible).toBe(false);
  });

  it("reorders views with Move Up and Move Down buttons", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    // Default: item 0 is HOME, item 1 is AI CHAT
    const moveDownHome = screen.getByLabelText(/Move HOME Down/i);
    fireEvent.click(moveDownHome);

    const nav = store.loadNavConfig();
    expect(nav[0].id).toBe("chat");
    expect(nav[1].id).toBe("home");

    // Move home back up
    const moveUpHome = screen.getByLabelText(/Move HOME Up/i);
    fireEvent.click(moveUpHome);

    const restored = store.loadNavConfig();
    expect(restored[0].id).toBe("home");
    expect(restored[1].id).toBe("chat");
  });

  it("resets nav views to default order and visibility on Reset to Default click", () => {
    store.saveNavConfig([
      { id: "kanban", label: "KANBAN", visible: false },
      { id: "home", label: "HOME", visible: true },
      { id: "chat", label: "AI CHAT", visible: true },
      { id: "calendar", label: "CALENDAR", visible: true },
      { id: "goals", label: "GOALS", visible: true },
      { id: "tasks", label: "TASKS", visible: true },
      { id: "action_plans", label: "ACTION PLANS", visible: true },
      { id: "timer", label: "TIMER", visible: true },
    ]);

    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const resetNavBtn = screen.getByRole("button", { name: /Reset to Default/i });
    fireEvent.click(resetNavBtn);

    expect(screen.getByText(/Reset to Default!/i)).toBeInTheDocument();
    const config = store.loadNavConfig();
    expect(config[0].id).toBe("home");
    expect(config.every((item) => item.visible)).toBe(true);
  });

  it("adjusts max pane widths and applies limits", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const leftInput = screen.getByLabelText(/Left Pane Max Width$/i);
    const rightInput = screen.getByLabelText(/Right Pane Max Width$/i);

    fireEvent.change(leftInput, { target: { value: "620" } });
    fireEvent.change(rightInput, { target: { value: "700" } });

    const applyBtn = screen.getByRole("button", { name: /Apply Limits/i });
    fireEvent.click(applyBtn);

    expect(store.getMaxLeftWidth()).toBe(620);
    expect(store.getMaxRightWidth()).toBe(700);
    expect(screen.getByText(/Applied!/i)).toBeInTheDocument();
  });

  it("renders in standalone window mode", () => {
    render(<SettingsModal isOpen={true} isStandalone={true} onClose={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: /HUD PREFERENCES & SETTINGS/i })
    ).toBeInTheDocument();
  });

  it("renders specific tab when initialTab is provided and switches tabs on click", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} initialTab="appearance" />);

    // In appearance tab, themes section is visible but navigation views is filtered out
    expect(screen.getByText(/HUD THEME & PALETTE/i)).toBeInTheDocument();
    expect(screen.queryByText(/NAVIGATION VIEWS & ORDERING/i)).not.toBeInTheDocument();

    // Click EDITOR & SPELLCHECK tab
    const editorTabBtn = screen.getByRole("button", { name: "EDITOR & SPELLCHECK" });
    fireEvent.click(editorTabBtn);
    expect(screen.getByText(/SPELLCHECK & DICTIONARY/i)).toBeInTheDocument();
    expect(screen.queryByText(/NAVIGATION VIEWS & ORDERING/i)).not.toBeInTheDocument();

    // Click ALL tab
    const allTabBtn = screen.getByRole("button", { name: "ALL" });
    fireEvent.click(allTabBtn);
    expect(screen.getByText(/NAVIGATION VIEWS & ORDERING/i)).toBeInTheDocument();
    expect(screen.getByText(/HUD THEME & PALETTE/i)).toBeInTheDocument();
    expect(screen.getByText(/SPELLCHECK & DICTIONARY/i)).toBeInTheDocument();
  });

  it("closes modal on Done or close button click", () => {
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} />);

    const doneBtn = screen.getByRole("button", { name: /DONE/i });
    fireEvent.click(doneBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByTitle(/Close Settings \(Esc\)/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(2);
  });

  it("closes modal when pressing Escape key", () => {
    const handleClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={handleClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("allows dragging the preferences & settings modal around in modal mode", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const header = screen.getByText("HUD PREFERENCES & SETTINGS").parentElement!.parentElement!;
    const modalContent = screen.getByTestId("settings-modal-content");

    expect(modalContent).toHaveStyle({ transform: "translate(0px, 0px)" });

    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 150, clientY: 180, pointerId: 1 });
    fireEvent.pointerUp(header, { clientX: 150, clientY: 180, pointerId: 1 });

    expect(modalContent).toHaveStyle({ transform: "translate(50px, 80px)" });
  });

  it("does not apply CSS translate transform and invokes moveWindowByDelta in standalone mode", () => {
    const startDraggingSpy = vi.spyOn(tauriBridge, "startDraggingWindow").mockResolvedValue(true);
    const moveDeltaSpy = vi.spyOn(tauriBridge, "moveWindowByDelta").mockResolvedValue(true);

    render(<SettingsModal isOpen={true} isStandalone={true} onClose={vi.fn()} />);

    const header = screen.getByText("HUD PREFERENCES & SETTINGS").parentElement!.parentElement!;
    const modalContent = screen.getByTestId("settings-modal-content");

    // Standalone mode must not have translate transform
    expect(modalContent.style.transform).toBe("");

    fireEvent.pointerDown(header, { clientX: 100, clientY: 100, screenX: 200, screenY: 200, pointerId: 1 });
    expect(startDraggingSpy).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(header, { clientX: 150, clientY: 180, screenX: 250, screenY: 280, pointerId: 1 });
    expect(moveDeltaSpy).toHaveBeenCalledWith(50, 80);

    fireEvent.pointerUp(header, { clientX: 150, clientY: 180, screenX: 250, screenY: 280, pointerId: 1 });

    // Ensure transform remains unset (no inner DOM dragging)
    expect(modalContent.style.transform).toBe("");
  });

  it("sets default popup height to 80% of the viewport and enables scrolling on the body", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const modalContent = screen.getByTestId("settings-modal-content");
    expect(modalContent.style.height).toBe("80vh");

    const scrollBody = screen.getByTestId("settings-scroll-body");
    expect(scrollBody.className).toContain("overflow-y-auto");
    expect(scrollBody.className).toContain("min-h-0");
  });

  it("allows resizing the popup settings window via the resize handle", () => {
    render(<SettingsModal isOpen={true} onClose={vi.fn()} />);

    const modalContent = screen.getByTestId("settings-modal-content");
    vi.spyOn(modalContent, "getBoundingClientRect").mockReturnValue({
      width: 620,
      height: 600,
      top: 50,
      left: 50,
      right: 670,
      bottom: 650,
      x: 50,
      y: 50,
      toJSON: () => ({}),
    });

    const resizeHandle = screen.getByTestId("settings-modal-resize-handle");
    fireEvent.pointerDown(resizeHandle, { clientX: 670, clientY: 650, pointerId: 1 });
    fireEvent.pointerMove(resizeHandle, { clientX: 750, clientY: 720, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { clientX: 750, clientY: 720, pointerId: 1 });

    expect(modalContent.style.width).toBe("700px");
    expect(modalContent.style.height).toBe("670px");
  });
});
