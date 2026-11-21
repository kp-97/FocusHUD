import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import {
  DEFAULT_VIEW_DEFINITIONS,
  getAllViews,
  getViewDefinition,
  resolveViewComponent,
  registerView,
  unregisterView,
  resetViewRegistry,
  getViewIcon,
  ViewSlot,
  NAV_ICON_MAP,
  AVAILABLE_RIGHT_VIEWS,
} from "./viewRegistry";
import type { ViewDefinition } from "../types/navigation";
import { Sparkles } from "lucide-react";

describe("View Registry", () => {
  beforeEach(() => {
    resetViewRegistry();
  });

  it("registers all default view definitions", () => {
    expect(DEFAULT_VIEW_DEFINITIONS).toHaveLength(9);
    const views = getAllViews();
    expect(views).toHaveLength(9);

    const ids = views.map((v) => v.id);
    expect(ids).toContain("home");
    expect(ids).toContain("chat");
    expect(ids).toContain("calendar");
    expect(ids).toContain("goals");
    expect(ids).toContain("tasks");
    expect(ids).toContain("notes");
    expect(ids).toContain("action_plans");
    expect(ids).toContain("timer");
    expect(ids).toContain("kanban");
  });

  it("retrieves a view definition by ID", () => {
    const calendarDef = getViewDefinition("calendar");
    expect(calendarDef).toBeDefined();
    expect(calendarDef?.title).toBe("CALENDAR");
    expect(calendarDef?.defaultDock).toBe("left");

    const chatDef = getViewDefinition("chat");
    expect(chatDef).toBeDefined();
    expect(chatDef?.title).toBe("AI CHAT");
    expect(chatDef?.defaultDock).toBe("right");
  });

  it("resolves the component for a known view ID", () => {
    const Component = resolveViewComponent("home");
    expect(Component).toBeDefined();
    expect(typeof Component).toBe("function");
  });

  it("falls back to home or specified fallback for unknown view ID", () => {
    const FallbackComponent = resolveViewComponent("non_existent_view");
    const HomeDef = getViewDefinition("home");
    expect(FallbackComponent).toBe(HomeDef?.component);

    const CalendarDef = getViewDefinition("calendar");
    const CustomFallback = resolveViewComponent("non_existent_view", "calendar");
    expect(CustomFallback).toBe(CalendarDef?.component);
  });

  it("supports dynamic registration and unregistration of views", () => {
    const customDef: ViewDefinition = {
      id: "analytics" as any,
      title: "ANALYTICS",
      icon: Sparkles,
      component: () => <div data-testid="custom-analytics-view">Analytics View</div>,
      defaultDock: "left",
      minWidth: 300,
    };

    registerView(customDef);
    expect(getViewDefinition("analytics")).toEqual(customDef);

    const Resolved = resolveViewComponent("analytics");
    expect(Resolved).toBe(customDef.component);

    const removed = unregisterView("analytics");
    expect(removed).toBe(true);
    expect(getViewDefinition("analytics")).toBeUndefined();
  });

  it("renders views dynamically using ViewSlot and forwards props", () => {
    const MockView: React.FC<{ customProp?: string }> = ({ customProp }) => (
      <div data-testid="mock-view">Prop: {customProp}</div>
    );

    const mockDef: ViewDefinition = {
      id: "mock_test" as any,
      title: "MOCK TEST",
      icon: Sparkles,
      component: MockView,
      defaultDock: "left",
    };
    registerView(mockDef);

    render(<ViewSlot viewId="mock_test" customProp="focus-value" />);

    expect(screen.getByTestId("mock-view")).toHaveTextContent("Prop: focus-value");
  });

  it("provides NAV_ICON_MAP and AVAILABLE_RIGHT_VIEWS correctly", () => {
    expect(NAV_ICON_MAP.home).toBeDefined();
    expect(NAV_ICON_MAP.chat).toBeDefined();
    expect(NAV_ICON_MAP.calendar).toBeDefined();

    expect(AVAILABLE_RIGHT_VIEWS).toHaveLength(9);
    expect(AVAILABLE_RIGHT_VIEWS[0].id).toBe("home");
    expect(AVAILABLE_RIGHT_VIEWS[0].label).toBe("HOME");
    expect(AVAILABLE_RIGHT_VIEWS[1].id).toBe("chat");
    expect(AVAILABLE_RIGHT_VIEWS[1].label).toBe("AI CHAT");
  });

  it("returns appropriate icon with fallback in getViewIcon", () => {
    const chatIcon = getViewIcon("chat");
    expect(chatIcon).toBe(NAV_ICON_MAP.chat);

    const unknownIcon = getViewIcon("unknown_id");
    expect(unknownIcon).toBe(NAV_ICON_MAP.home);
  });
});
