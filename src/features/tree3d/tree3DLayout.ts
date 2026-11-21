import { TreeNode3D, SpatialNode } from "./Tree3DRenderer";

/**
 * Flatten nested tree nodes into 3D spatial cylindrical coordinates.
 */
export function flattenTreeTo3D(nodes: TreeNode3D[]): SpatialNode[] {
  const result: SpatialNode[] = [];

  const traverse = (
    itemList: TreeNode3D[],
    parentId: string | null,
    depth: number,
    centerX: number,
    centerY: number,
    centerZ: number,
    angleSpread: number,
    startAngle: number
  ) => {
    const count = itemList.length;
    if (count === 0) return;

    const angleStep = count > 1 ? angleSpread / (count - 1) : 0;
    const radius = 90 + depth * 35;

    itemList.forEach((item, idx) => {
      let x = centerX;
      let y = centerY;
      let z = centerZ;

      if (depth === 0) {
        // Place root nodes along circle
        const a = (idx / Math.max(1, count)) * Math.PI * 2;
        x = Math.cos(a) * 75;
        z = Math.sin(a) * 75;
        y = -40;
      } else {
        // Spread child nodes downward in cone
        const a = startAngle + (idx - (count - 1) / 2) * (angleStep || 0.6);
        x = centerX + Math.cos(a) * radius * 0.7;
        z = centerZ + Math.sin(a) * radius * 0.7;
        y = centerY + 55;
      }

      const spatial: SpatialNode = {
        id: item.id,
        title: item.title,
        completed: Boolean(item.completed),
        x,
        y,
        z,
        parentId,
        depth,
      };

      result.push(spatial);

      if (item.children && item.children.length > 0) {
        traverse(item.children, item.id, depth + 1, x, y, z, Math.PI * 0.9, Math.atan2(z, x));
      }
    });
  };

  traverse(nodes, null, 0, 0, -40, 0, Math.PI * 2, 0);
  return result;
}

