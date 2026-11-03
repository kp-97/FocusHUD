/**
 * Generic tree data structures and recursive operations for nested hierarchical views
 * (Goals, Action Plans, etc.)
 */

export interface BaseTreeNode {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  parentId?: string | null;
  children?: this[];
}

/**
 * Recursively inserts a child node under a parent with the given parentId.
 */
export function insertChildNode<T extends { id: string; children?: T[] }>(
  list: T[],
  parentId: string,
  newChild: T
): T[] {
  return list.map((item) => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [...(item.children || []), newChild],
      };
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: insertChildNode(item.children, parentId, newChild),
      };
    }
    return item;
  });
}

/**
 * Recursively toggles a node's completed status and updates its completedAt timestamp.
 */
export function toggleNodeComplete<T extends { id: string; completed: boolean; completedAt?: string; children?: T[] }>(
  list: T[],
  id: string,
  today: string
): T[] {
  return list.map((item) => {
    if (item.id === id) {
      const next = !item.completed;
      return {
        ...item,
        completed: next,
        completedAt: next ? today : undefined,
      };
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: toggleNodeComplete(item.children, id, today),
      };
    }
    return item;
  });
}

/**
 * Recursively removes a node with the given id from the tree.
 */
export function removeTreeNode<T extends { id: string; children?: T[] }>(
  list: T[],
  id: string
): T[] {
  return list
    .filter((item) => item.id !== id)
    .map((item) => {
      if (item.children && item.children.length > 0) {
        return {
          ...item,
          children: removeTreeNode(item.children, id),
        };
      }
      return item;
    });
}

/**
 * Recursively counts total and completed nodes in the tree.
 */
export function countTreeStats<T extends { completed: boolean; children?: T[] }>(
  list: T[]
): { total: number; completed: number } {
  let total = 0;
  let completed = 0;

  const traverse = (nodes: T[]) => {
    nodes.forEach((item) => {
      total++;
      if (item.completed) completed++;
      if (item.children) traverse(item.children);
    });
  };

  traverse(list);
  return { total, completed };
}

/**
 * Checks if any node in the tree has children.
 */
export function hasAnyTreeNesting<T extends { children?: any[]; [key: string]: any }>(list: T[]): boolean {
  for (const item of list) {
    if (item.children && item.children.length > 0) return true;
  }
  return false;
}

/**
 * Maps a generic tree into TreeNode3D array for 3D visualization.
 */
export function mapTreeTo3D<T extends { id: string; title: string; completed: boolean; children?: T[] }>(
  list: T[]
): Array<{ id: string; title: string; completed: boolean; children?: any[] }> {
  return list.map((item) => ({
    id: item.id,
    title: item.title,
    completed: item.completed,
    children: item.children ? mapTreeTo3D(item.children) : undefined,
  }));
}
