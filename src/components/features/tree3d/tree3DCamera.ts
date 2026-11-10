/**
 * Projects a 3D coordinate (x, y, z) into a 2D screen coordinate based on camera state.
 */
export function project3DTo2D(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  currentYaw: number,
  pitch: number,
  currentCamCenterY: number,
  zoom: number
): { px: number; py: number; scale: number; zOrder: number } | null {
  const cx = width / 2;
  const cy = height / 2 + 10;
  const fov = 320 * zoom;
  const camDist = 280;

  // Rotate around Y axis (yaw: clockwise/anticlockwise)
  const cosY = Math.cos(currentYaw);
  const sinY = Math.sin(currentYaw);
  const x1 = x * cosY - z * sinY;
  const z1 = x * sinY + z * cosY;

  // Rotate around X axis (pitch: vertical tilt) centered on focused node's level
  const shiftedY = y - currentCamCenterY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  const y2 = shiftedY * cosP - z1 * sinP;
  const z2 = shiftedY * sinP + z1 * cosP;

  const distance = z2 + camDist;
  if (distance <= 10) return null;

  const scale = fov / distance;
  return {
    px: cx + x1 * scale,
    py: cy + y2 * scale,
    scale,
    zOrder: distance,
  };
}

