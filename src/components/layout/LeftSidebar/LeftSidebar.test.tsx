import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { LeftSidebar } from "./LeftSidebar";
import * as tauriBridge from "../../../services/tauriBridge";

vi.mock("../../../services/tauriBridge", () => ({
  exitApp: vi.fn(),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
  setDockPopoutMode: vi.fn(),
}));

describe("LeftSidebar component", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("renders branding and header controls in expanded mode (width >= 120) without left pane toggle", () => {
    const handleSettings = vi.fn();

    render(
      <LeftSidebar
        width={280}
        activeNav="home"
        onSelectNav={vi.fn()}
        onOpenSettings={handleSettings}
      />
    );

    expect(screen.getByText("FocusHUD")).toBeInTheDocument();

    // 1. Left pane sidebar toggle button is removed
    expect(screen.queryByTestId("sidebar-toggle-left")).not.toBeInTheDocument();

    // 2. Settings button
    const settingsBtn = screen.getByLabelText("Settings");
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(handleSettings).toHaveBeenCalledTimes(1);

    // 3. Hamburger menu button
    const menuBtn = screen.getByLabelText("System Menu");
    expect(menuBtn).toBeInTheDocument();

    // 4. Close (X) button should NOT exist on LeftSidebar
    expect(screen.queryByTitle(/Close FocusHUD/i)).not.toBeInTheDocument();
  });

  it("opens hamburger dropdown menu and handles menu selections", () => {
    const handleSettings = vi.fn();

    render(
      <LeftSidebar
        width={280}
        activeNav="home"
        onSelectNav={vi.fn()}
        onOpenSettings={handleSettings}
      />
    );

    const menuBtn = screen.getByLabelText("System Menu");
    // Initially closed
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Click to open
    act(() => {
      fireEvent.click(menuBtn);
    });

    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", true);

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText("SYSTEM MENU")).toBeInTheDocument();
    expect(screen.getByText("THEMES")).toBeInTheDocument();
    expect(screen.getByText("EXTENSIONS")).toBeInTheDocument();
    expect(screen.getByText("LOG OUT")).toBeInTheDocument();

    // Clicking Settings menuitem inside menu
    const settingsItem = within(menu).getByText("SETTINGS");
    act(() => {
      fireEvent.click(settingsItem);
    });
    expect(handleSettings).toHaveBeenCalledWith("all");
    // Menu should close
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);

    // Reopen menu and test Themes button
    act(() => {
      fireEvent.click(menuBtn);
    });
    const themesItem = screen.getByText("THEMES");
    act(() => {
      fireEvent.click(themesItem);
    });
    expect(handleSettings).toHaveBeenCalledWith("appearance");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    // Reopen menu and test Log out
    act(() => {
      fireEvent.click(menuBtn);
    });
    const logoutItem = screen.getByText("LOG OUT");
    act(() => {
      fireEvent.click(logoutItem);
    });
    expect(tauriBridge.exitApp).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes hamburger menu when clicking outside or when window blurs", () => {
    vi.useFakeTimers();
    try {
      render(
        <LeftSidebar
          width={280}
          activeNav="home"
          onSelectNav={vi.fn()}
        />
      );

      const menuBtn = screen.getByLabelText("System Menu");
      act(() => {
        fireEvent.click(menuBtn);
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();
      expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", true);

      // Premature blur during focus shift / geometry transition (< 250ms) is ignored (Issue #42)
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Click outside after opening immunity window closes menu
      act(() => {
        vi.advanceTimersByTime(150);
        fireEvent.mouseDown(document.body);
      });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);

      // Reopen and test window blur after opening transition
      act(() => {
        fireEvent.click(menuBtn);
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Blur during initial 250ms is ignored
      act(() => {
        vi.advanceTimersByTime(100);
        window.dispatchEvent(new Event("blur"));
      });
      expect(screen.getByRole("menu")).toBeInTheDocument();

      // Blur after 250ms closes menu
      act(() => {
        vi.advanceTimersByTime(200);
        window.dispatchEvent(new Event("blur"));
      });
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders compact mode with bottom settings button and no left pane toggle when width < 120", () => {
    const handleSettings = vi.fn();
    render(
      <LeftSidebar
        width={68}
        activeNav="home"
        onSelectNav={vi.fn()}
        onOpenSettings={handleSettings}
      />
    );

    // Text label hidden
    expect(screen.queryByText("FocusHUD")).not.toBeInTheDocument();

    // Left toggle button is removed
    expect(screen.queryByTestId("sidebar-toggle-left")).not.toBeInTheDocument();

    // Settings button appears at the bottom of the left pane
    const settingsBtn = screen.getByLabelText("Settings");
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(handleSettings).toHaveBeenCalledTimes(1);
  });

  it("renders left-rail navigation items according to navConfig (excluding right-rail items like AI CHAT by default) and hides invisible items", () => {
    localStorage.setItem(
      "focushud_nav_config",
      JSON.stringify([
        { id: "timer", label: "TIMER", visible: true },
        { id: "calendar", label: "CALENDAR", visible: false },
        { id: "home", label: "HOME", visible: true },
        { id: "chat", label: "AI CHAT", visible: true },
        { id: "goals", label: "GOALS", visible: true },
        { id: "tasks", label: "TASKS", visible: true },
        { id: "action_plans", label: "ACTION PLANS", visible: true },
        { id: "kanban", label: "KANBAN", visible: true },
      ])
    );

    render(
      <LeftSidebar
        width={280}
        activeNav="home"
        onSelectNav={vi.fn()}
      />
    );

    // Visible left-rail items
    expect(screen.getByTestId("left-rail-nav-timer")).toBeInTheDocument();
    expect(screen.getByTestId("left-rail-nav-home")).toBeInTheDocument();
    // AI CHAT defaults to the right rail, so it is not on the left rail
    expect(screen.queryByTestId("left-rail-nav-chat")).not.toBeInTheDocument();
    // Hidden item should not be rendered
    expect(screen.queryByTestId("left-rail-nav-calendar")).not.toBeInTheDocument();
  });

  it("falls back to home when activeNav is toggled to invisible", () => {
    const handleSelectNav = vi.fn();
    localStorage.setItem(
      "focushud_nav_config",
      JSON.stringify([
        { id: "home", label: "HOME", visible: true },
        { id: "timer", label: "TIMER", visible: false },
      ])
    );

    render(
      <LeftSidebar
        width={280}
        activeNav="timer"
        onSelectNav={handleSelectNav}
      />
    );

    expect(handleSelectNav).toHaveBeenCalledWith("home");
  });

  it("shows instant custom tooltips without native title lag in compact icon-only mode", () => {
    render(
      <LeftSidebar
        width={68}
        activeNav="home"
        onSelectNav={vi.fn()}
      />
    );

    // Buttons should have aria-label and NO native title (to avoid 1s OS delay)
    const homeBtn = screen.getByRole("button", { name: "HOME" });
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).not.toHaveAttribute("title");

    // Tooltip not visible before hover
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Hover over HOME icon button
    fireEvent.mouseEnter(homeBtn);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveTextContent("HOME");
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", true);

    // Moving mouse to Settings button updates tooltip
    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(settingsBtn).not.toHaveAttribute("title");

    fireEvent.mouseLeave(homeBtn);
    fireEvent.mouseEnter(settingsBtn);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Settings");

    // Leaving sidebar hides tooltip and restores popout mode to false
    const aside = homeBtn.closest("aside")!;
    fireEvent.mouseLeave(settingsBtn);
    fireEvent.mouseLeave(aside);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);
  });

  it("changes the view of the left pane when selecting views from the left rail", () => {
    const handleSelectNav = vi.fn();
    const { rerender } = render(
      <LeftSidebar
        width={280}
        activeNav="home"
        onSelectNav={handleSelectNav}
      />
    );

    // Click Calendar icon button on left rail
    const calendarBtn = screen.getByTestId("left-rail-nav-calendar");
    expect(calendarBtn).toBeInTheDocument();
    fireEvent.click(calendarBtn);
    expect(handleSelectNav).toHaveBeenCalledWith("calendar");

    // Re-render with activeNav="calendar"
    rerender(
      <LeftSidebar
        width={280}
        activeNav="calendar"
        onSelectNav={handleSelectNav}
      />
    );

    // Left pane now displays Calendar view components
    expect(screen.getByText("CALENDAR")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();
  });

  it("renders hamburger menu fixed at top with Fullscreen/Exit Fullscreen underneath and Split/Join underneath Fullscreen", () => {
    const handleFullscreen = vi.fn();
    const handleExitFullscreen = vi.fn();
    const handleSplit = vi.fn();
    const handleJoin = vi.fn();

    const { rerender } = render(
      <LeftSidebar
        width={68}
        activeNav="home"
        isJoinedMode={true}
        windowState="windowed"
        onSelectNav={vi.fn()}
        onClickFullscreen={handleFullscreen}
        onClickExitFullscreen={handleExitFullscreen}
        onClickSplit={handleSplit}
        onClickJoin={handleJoin}
      />
    );

    const menuBtn = screen.getByLabelText("System Menu");
    const fsBtn = screen.getByTestId("window-btn-fullscreen");
    const splitBtn = screen.getByTestId("window-btn-split");
    const homeBtn = screen.getByTestId("left-rail-nav-home");

    expect(menuBtn).toBeInTheDocument();
    expect(fsBtn).toBeInTheDocument();
    expect(splitBtn).toBeInTheDocument();

    // Vertical DOM order: Hamburger -> Fullscreen -> Split -> Navigation buttons
    expect(menuBtn.compareDocumentPosition(fsBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(fsBtn.compareDocumentPosition(splitBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(splitBtn.compareDocumentPosition(homeBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(fsBtn);
    expect(handleFullscreen).toHaveBeenCalledTimes(1);

    fireEvent.click(splitBtn);
    expect(handleSplit).toHaveBeenCalledTimes(1);

    // In Fullscreen state, button switches to Exit Fullscreen; in Split state, button switches to Join
    rerender(
      <LeftSidebar
        width={68}
        activeNav="home"
        isJoinedMode={false}
        windowState="split"
        onSelectNav={vi.fn()}
        onClickFullscreen={handleFullscreen}
        onClickExitFullscreen={handleExitFullscreen}
        onClickSplit={handleSplit}
        onClickJoin={handleJoin}
      />
    );
    const joinBtn = screen.getByTestId("window-btn-join");
    expect(joinBtn).toBeInTheDocument();
    fireEvent.click(joinBtn);
    expect(handleJoin).toHaveBeenCalledTimes(1);

    // Left, right, and both toggles are removed from left rail
    expect(screen.queryByTestId("sidebar-toggle-left")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-toggle-right")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sidebar-toggle-both")).not.toBeInTheDocument();
  });

  it("fixes the top-right and bottom-right blue dots on the left rail so components do not move around", () => {
    const { container } = render(
      <LeftSidebar
        width={68}
        activeNav="home"
        onSelectNav={vi.fn()}
      />
    );

    // Assert top-right and bottom-right blue mini square/dot exist on the rail
    const dots = container.querySelectorAll(".bg-cyan-400\\/80");
    expect(dots.length).toBeGreaterThanOrEqual(4);
  });

  it("locates navigation view buttons directly under the top header line and supports drag-and-drop reordering and Split mode toggle", () => {
    const handleSelectNav = vi.fn();
    const handleToggleLeft = vi.fn();

    const { rerender } = render(
      <LeftSidebar
        width={68}
        activeNav="home"
        isJoinedMode={false}
        onSelectNav={handleSelectNav}
        onToggleLeftPane={handleToggleLeft}
      />
    );

    const menuBtn = screen.getByLabelText("System Menu");
    const homeBtn = screen.getByTestId("left-rail-nav-home");
    const calendarBtn = screen.getByTestId("left-rail-nav-calendar");

    expect(homeBtn).toBeInTheDocument();
    expect(menuBtn.compareDocumentPosition(homeBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    const navContainer = homeBtn.parentElement!;
    expect(navContainer).toHaveClass("justify-start");

    // In Split mode while collapsed (width=68), clicking a view button opens the pane
    fireEvent.click(calendarBtn);
    expect(handleSelectNav).toHaveBeenCalledWith("calendar");
    expect(handleToggleLeft).toHaveBeenCalledTimes(1);

    // In Split mode while expanded (width=280), clicking the SAME active view button closes the pane
    handleToggleLeft.mockClear();
    rerender(
      <LeftSidebar
        width={280}
        activeNav="calendar"
        isJoinedMode={false}
        onSelectNav={handleSelectNav}
        onToggleLeftPane={handleToggleLeft}
      />
    );
    fireEvent.click(screen.getByTestId("left-rail-nav-calendar"));
    expect(handleToggleLeft).toHaveBeenCalledTimes(1);

    // Drag and reorder: drag "calendar" onto "home"
    const dataTransfer = {
      data: {} as Record<string, string>,
      setData(k: string, v: string) {
        this.data[k] = v;
      },
      getData(k: string) {
        return this.data[k] || "";
      },
      effectAllowed: "move",
      dropEffect: "move",
    };

    fireEvent.dragStart(screen.getByTestId("left-rail-nav-calendar"), { dataTransfer });
    fireEvent.dragOver(screen.getByTestId("left-rail-nav-home"), { dataTransfer });
    fireEvent.drop(screen.getByTestId("left-rail-nav-home"), { dataTransfer });
    fireEvent.dragEnd(screen.getByTestId("left-rail-nav-calendar"), { dataTransfer });

    const buttons = within(screen.getByTestId("left-rail-nav-list")).getAllByRole("button");
    expect(buttons[0]).toHaveAttribute("data-testid", "left-rail-nav-calendar");
    expect(buttons[1]).toHaveAttribute("data-testid", "left-rail-nav-home");
  });
});
