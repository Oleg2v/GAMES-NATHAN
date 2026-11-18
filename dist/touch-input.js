/**
 * Resolve a point on an eight-way virtual D-pad without retaining pointer state.
 * Coordinates use the same CSS-pixel space as getBoundingClientRect(). Each axis
 * is normalized by half its dimension, so resizing or moving the pad preserves
 * its controls. The circular zones therefore become ellipses for a non-square
 * rectangle. Returning [] tells the caller to release this pointer's actions.
 *
 * @param {number} clientX
 * @param {number} clientY
 * @param {{left:number, top:number, width:number, height:number}} rect
 * @returns {Array<'up'|'down'|'left'|'right'>} Vertical action, then horizontal.
 */
export function getDpadDirections(clientX, clientY, rect) {
  if (!rect || ![clientX, clientY, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)) return [];
  if (rect.width <= 0 || rect.height <= 0) return [];

  const x = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
  const y = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
  const radius = Math.hypot(x, y);
  if (!Number.isFinite(radius) || radius < 0.18 || radius > 1.35) return [];

  const directions = [];
  if (Math.abs(y) >= Math.abs(x) * 0.42) directions.push(y < 0 ? 'up' : 'down');
  if (Math.abs(x) >= Math.abs(y) * 0.42) directions.push(x < 0 ? 'left' : 'right');
  return directions;
}

/**
 * Convert a floating joystick's CSS-pixel displacement into an eight-way unit
 * direction and an independent speed magnitude. Multiply x/y by magnitude when
 * applying movement. The neutral zone is inclusive; long drags stay capped.
 */
export function getJoystickVector(deltaX, deltaY, options = {}) {
  const deadZone = options?.deadZone ?? 10;
  const maxRadius = options?.maxRadius ?? 52;
  const neutral = { x: 0, y: 0, magnitude: 0 };
  if (![deltaX, deltaY, deadZone, maxRadius].every(Number.isFinite) || deadZone < 0 || maxRadius <= deadZone) return neutral;
  const distance = Math.hypot(deltaX, deltaY);
  if (!Number.isFinite(distance) || distance <= deadZone) return neutral;
  const octant = (Math.round(Math.atan2(deltaY, deltaX) / (Math.PI / 4)) + 8) % 8;
  const diagonal = Math.SQRT1_2;
  const directions = [[1, 0], [diagonal, diagonal], [0, 1], [-diagonal, diagonal], [-1, 0], [-diagonal, -diagonal], [0, -1], [diagonal, -diagonal]];
  const [x, y] = directions[octant];
  return { x, y, magnitude: Math.min(1, (distance - deadZone) / (maxRadius - deadZone)) };
}
