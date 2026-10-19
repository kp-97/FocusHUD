import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LeftSidebar } from "./LeftSidebar";
import * as tauriBridge from "../utils/tauriBridge";

vi.mock("../utils/tauriBridge", () => ({
  exitApp: vi.fn(),
  getSystemDiagnostics: vi.fn().mockResolvedValue(null),
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

    // 1. Sidebar toggle button
    const toggleBtn = screen.getByTestId("sidebar-toggle-left");
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

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(screen.getByText("SYSTEM MENU")).toBeInTheDocument();
    expect(screen.getByText("THEMES")).toBeInTheDocument();
    expect(screen.getByText("EXTENSIONS")).toBeInTheDocument();
    expect(screen.getByText("LOG OUT")).toBeInTheDocument();

    // Clicking Settings menuitem
    const settingsItem = screen.getByText("SETTINGS");
    act(() => {
      fireEvent.click(settingsItem);
    });
    expect(handleSettings).toHaveBeenCalledTimes(1);
    // Menu should close
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

  it("closes hamburger menu when clicking outside", () => {
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

    // Click outside
    act(() => {
      fireEvent.mouseDown(document.body);
    });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("renders compact mode with toggle button when width < 120", () => {
    const handleToggle = vi.fn();
    render(
      <LeftSidebar
        width={68}
        activeNav="home"
        onSelectNav={vi.fn()}
        onToggleCollapse={handleToggle}
      />
    );

    // Text label hidden
    expect(screen.queryByText("FocusHUD")).not.toBeInTheDocument();

    // Toggle button exists and triggers onToggleCollapse
    const toggleBtn = screen.getByTestId("sidebar-toggle-left");
    expect(toggleBtn).toBeInTheDocument();
    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
