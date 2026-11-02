import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomeView } from "./HomeView";

describe("HomeView component", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not render redundant 'TOP SLOT' or 'BOTTOM SLOT' heading labels", () => {
    render(<HomeView />);

    // Ensure slot labels 'TOP SLOT' and 'BOTTOM SLOT' are removed
    expect(screen.queryByText(/TOP SLOT/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/BOTTOM SLOT/i)).not.toBeInTheDocument();
  });

  it("shows the selected view name exclusively in the dropdown select box", () => {
    render(<HomeView />);

    const topSelect = screen.getByLabelText("Select Top View") as HTMLSelectElement;
    const bottomSelect = screen.getByLabelText("Select Bottom View") as HTMLSelectElement;

    expect(topSelect.value).toBe("timer");
    expect(bottomSelect.value).toBe("action_plans");

    // Check that PomodoroDial inside the slot does not display redundant view heading
    expect(screen.queryByText("POMODORO TIMER", { selector: "span" })).not.toBeInTheDocument();
  });

  it("allows switching slot views via dropdowns", () => {
    render(<HomeView />);

    const topSelect = screen.getByLabelText("Select Top View") as HTMLSelectElement;
    fireEvent.change(topSelect, { target: { value: "notes" } });

    expect(topSelect.value).toBe("notes");
    expect(localStorage.getItem("focushud_home_top_view")).toBe("notes");
  });

  it("hides view title in half-height compact mode on HomeView, but full views show title", () => {
    render(<HomeView />);

    // In half-height compact mode on HomeView, the slot views hide their internal headings
    // Top slot: Timer -> "POMODORO TIMER" heading hidden
    expect(screen.queryByTestId("pomodoro-header-title")).not.toBeInTheDocument();

    // Bottom slot: Action Plans -> "ACTION PLANS" heading hidden
    expect(screen.queryByText("ACTION PLANS", { selector: "span.font-orbitron" })).not.toBeInTheDocument();
  });

  it("toggles between 1 full height view and 2 half height views, persisting in localStorage", () => {
    render(<HomeView />);

    // Starts in default split mode (2 views)
    expect(screen.getByLabelText("Select Top View")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Bottom View")).toBeInTheDocument();
    expect(screen.queryByTestId("pomodoro-header-title")).not.toBeInTheDocument();

    // Click toggle to switch to 1 full-height view
    const toggleButton = screen.getByTestId("home-layout-toggle");
    expect(toggleButton).toHaveTextContent("1 VIEW");
    fireEvent.click(toggleButton);

    // Now in single mode: only 1 view selector is shown
    expect(screen.getByLabelText("Select Top View")).toBeInTheDocument();
    expect(screen.queryByLabelText("Select Bottom View")).not.toBeInTheDocument();
    expect(localStorage.getItem("focushud_home_layout_mode")).toBe("single");

    // Full height mode shows the view title!
    expect(screen.getByTestId("pomodoro-header-title")).toBeInTheDocument();

    // Toggle button now shows option to switch back to 2 VIEWS
    const switchBackBtn = screen.getByTestId("home-layout-toggle");
    expect(switchBackBtn).toHaveTextContent("2 VIEWS");

    // Click to switch back to 2 half-height views
    fireEvent.click(switchBackBtn);
    expect(screen.getByLabelText("Select Top View")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Bottom View")).toBeInTheDocument();
    expect(localStorage.getItem("focushud_home_layout_mode")).toBe("split");
    expect(screen.queryByTestId("pomodoro-header-title")).not.toBeInTheDocument();
  });
});

