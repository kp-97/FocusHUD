import { describe, it, expect } from "vitest";
import {
  insertChildNode,
  toggleNodeComplete,
  removeTreeNode,
  countTreeStats,
  hasAnyTreeNesting,
  mapTreeTo3D,
} from "./treeUtils";

interface TestNode {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: TestNode[];
}

describe("treeUtils", () => {
  const initialTree: TestNode[] = [
    {
      id: "root-1",
      title: "Root 1",
      completed: false,
      children: [
        { id: "child-1-1", title: "Child 1.1", completed: true, parentId: "root-1" },
      ],
    },
    {
      id: "root-2",
      title: "Root 2",
      completed: false,
    },
  ];

  it("inserts child node recursively", () => {
    const newChild: TestNode = { id: "child-1-2", title: "Child 1.2", completed: false, parentId: "root-1" };
    const updated = insertChildNode(initialTree, "root-1", newChild);
    expect(updated[0].children).toHaveLength(2);
    expect(updated[0].children?.[1].id).toBe("child-1-2");
  });

  it("toggles node completion and updates completedAt", () => {
    const updated = toggleNodeComplete(initialTree, "root-2", "2026-11-03");
    expect(updated[1].completed).toBe(true);
    expect(updated[1].completedAt).toBe("2026-11-03");

    const untoggled = toggleNodeComplete(updated, "root-2", "2026-11-03");
    expect(untoggled[1].completed).toBe(false);
    expect(untoggled[1].completedAt).toBeUndefined();
  });

  it("removes tree node recursively", () => {
    const updated = removeTreeNode(initialTree, "child-1-1");
    expect(updated[0].children).toHaveLength(0);

    const removedRoot = removeTreeNode(initialTree, "root-1");
    expect(removedRoot).toHaveLength(1);
    expect(removedRoot[0].id).toBe("root-2");
  });

  it("counts total and completed nodes", () => {
    const stats = countTreeStats(initialTree);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
  });

  it("detects nesting in tree", () => {
    expect(hasAnyTreeNesting(initialTree)).toBe(true);
    expect(hasAnyTreeNesting([{ id: "1", title: "1", completed: false }])).toBe(false);
  });

  it("maps tree to 3D node format", () => {
    const nodes3d = mapTreeTo3D(initialTree);
    expect(nodes3d).toEqual([
      {
        id: "root-1",
        title: "Root 1",
        completed: false,
        children: [{ id: "child-1-1", title: "Child 1.1", completed: true, children: undefined }],
      },
      {
        id: "root-2",
        title: "Root 2",
        completed: false,
        children: undefined,
      },
    ]);
  });
});

