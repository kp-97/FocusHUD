/**
 * Pure numeric & geometry math helper utilities
 */

/**
 * Clamps a numeric value between min and max bounds
 */
export const clamp = (val: number, min: number, max: number): number => {
  return Math.min(Math.max(val, min), max);
};

/**
 * Finds the nearest magnetic snap point within a given distance threshold
 */
export const calculateSnap = (
  val: number,
  snapPoints: number[],
  threshold = 12
): number => {
  for (const point of snapPoints) {
    if (Math.abs(val - point) <= threshold) {
      return point;
    }
  }
  return val;
};
