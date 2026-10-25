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

  it("renders branding and header controls in expanded mode (width >= 120)", () => {
    const handleToggle = vi.fn();
    const handleSettings = vi.fn();

    render(
      <LeftSidebar
        width={280}
        activeNav="home"
        onSelectNav={vi.fn()}
        onToggleCollapse={handleToggle}
        onOpenSettings={handleSettings}
      />
    );

    expect(screen.getByText("FocusHUD")).toBeInTheDocument();

    // 1. Dual pane sidebar toggle button
    const toggleBtn = screen.getByTestId("sidebar-toggle-both");
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

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
    expect(handleSettings).toHaveBeenCalledTimes(1);
    // Menu should close
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);

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

    // Click outside
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);

    // Reopen and test window blur
    act(() => {
      fireEvent.click(menuBtn);
    });
    expect(screen.getByRole("menu")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(tauriBridge.setDockPopoutMode).toHaveBeenCalledWith("left", false);
  });

  it("renders compact mode with dual toggle button and bottom settings button when width < 120", () => {
    const handleToggle = vi.fn();
    const handleSettings = vi.fn();
    render(
      <LeftSidebar
        width={68}
        activeNav="home"
        onSelectNav={vi.fn()}
        onToggleCollapse={handleToggle}
        onOpenSettings={handleSettings}
      />
    );

    // Text label hidden
    expect(screen.queryByText("FocusHUD")).not.toBeInTheDocument();

    // Dual toggle button exists and triggers onToggleCollapse
    const toggleBtn = screen.getByTestId("sidebar-toggle-both");
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);

    // Settings button appears at the bottom of the left pane
    const settingsBtn = screen.getByLabelText("Settings");
    expect(settingsBtn).toBeInTheDocument();
    fireEvent.click(settingsBtn);
    expect(handleSettings).toHaveBeenCalledTimes(1);
  });

  it("renders navigation items according to navConfig and hides invisible items", () => {
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

    // Visible items
    expect(screen.getByText("TIMER")).toBeInTheDocument();
    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(screen.getByText("AI CHAT")).toBeInTheDocument();
    // Hidden item should not be rendered
    expect(screen.queryByText("CALENDAR")).not.toBeInTheDocument();
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

    // Moving mouse to Settings button updates tooltip
    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    expect(settingsBtn).not.toHaveAttribute("title");

    fireEvent.mouseLeave(homeBtn);
    fireEvent.mouseEnter(settingsBtn);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Settings");

    // Leaving button hides tooltip
    fireEvent.mouseLeave(settingsBtn);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
