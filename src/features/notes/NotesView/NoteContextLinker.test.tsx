import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NoteContextLinker } from "./NoteContextLinker";
import { GoalNode, TaskItem, ActionPlanNode } from "../../../types/hud";

describe("NoteContextLinker component", () => {
  const mockGoals: GoalNode[] = [
    {
      id: "goal-1",
      title: "Master Rust & React",
      completed: false,
      children: [],
    },
  ];

  const mockTasks: TaskItem[] = [
    {
      id: "task-1",
      title: "Finish Issue 61",
      completed: false,
      status: "todo",
      subtasks: [],
    },
  ];

  const mockPlans: ActionPlanNode[] = [
    {
      id: "plan-1",
      title: "Q4 Roadmap",
      completed: false,
      children: [],
    },
  ];

  it("renders Standalone Scratchpad when unlinked", () => {
    const onChangeLink = vi.fn();
    render(<NoteContextLinker onChangeLink={onChangeLink} />);

    expect(screen.getByText("STANDALONE SCRATCHPAD")).toBeInTheDocument();
  });

  it("renders linked Goal title and allows detachment", () => {
    const onChangeLink = vi.fn();
    render(
      <NoteContextLinker
        goalId="goal-1"
        goals={mockGoals}
        onChangeLink={onChangeLink}
      />
    );

    expect(screen.getByText("GOAL: Master Rust & React")).toBeInTheDocument();

    const detachBtn = screen.getByTitle("Detach from Context (Make Standalone)");
    expect(detachBtn).toBeInTheDocument();

    fireEvent.click(detachBtn);
    expect(onChangeLink).toHaveBeenCalledWith({
      goalId: null,
      taskId: null,
      actionPlanId: null,
    });
  });

  it("opens context menu and selects a task", () => {
    const onChangeLink = vi.fn();
    render(
      <NoteContextLinker
        tasks={mockTasks}
        goals={mockGoals}
        actionPlans={mockPlans}
        onChangeLink={onChangeLink}
      />
    );

    const toggleBtn = screen.getByText("STANDALONE SCRATCHPAD");
    fireEvent.click(toggleBtn);

    expect(screen.getByText("Link Note To Context")).toBeInTheDocument();
    expect(screen.getByText("Finish Issue 61")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Finish Issue 61"));
    expect(onChangeLink).toHaveBeenCalledWith({
      goalId: null,
      taskId: "task-1",
      actionPlanId: null,
    });
  });
});
