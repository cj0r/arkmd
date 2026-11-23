// Horizontal swipe detection for the phone layout: a swipe right opens Recent files, a swipe left opens the Outline.

export const MIN_DISTANCE = 64;     // px the finger must travel sideways
export const MAX_SLOPE = 0.6;       // up/down travel allowed, as a share of the sideways travel
export const MAX_MS = 700;          // a slow drag is a scroll or a selection, not a swipe

/** "right", "left" or null for a touch that went from `start` to `end` ({ x, y, t } each). */
export function swipeDirection(start, end) {
  const dx = end.x - start.x, dy = end.y - start.y, dt = end.t - start.t;
  if (dt < 0 || dt > MAX_MS || Math.abs(dx) < MIN_DISTANCE) return null;
  if (Math.abs(dy) > Math.abs(dx) * MAX_SLOPE) return null;
  return dx > 0 ? "right" : "left";
}
