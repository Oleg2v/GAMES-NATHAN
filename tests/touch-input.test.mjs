import test from 'node:test';
import assert from 'node:assert/strict';
import { getDpadDirections, getJoystickVector } from '../dist/touch-input.js';

const pads = [
  { left: 0, top: 0, width: 48, height: 48 },
  { left: 20, top: 230, width: 144, height: 144 },
  { left: 610.5, top: 75.25, width: 180, height: 120 },
  { left: -32, top: -18, width: 64, height: 96 },
];
function point(rect, x, y) {
  return [rect.left + rect.width / 2 + x * rect.width / 2, rect.top + rect.height / 2 + y * rect.height / 2];
}
function resolve(rect, x, y) { return getDpadDirections(...point(rect, x, y), rect); }

test('center and a small neutral zone release movement on every pad size', () => {
  for (const rect of pads) {
    for (const [x, y] of [[0, 0], [0.1, 0], [-0.1, 0.08], [0, -0.17], [0.12, 0.12]]) {
      assert.deepEqual(resolve(rect, x, y), []);
    }
    assert.deepEqual(resolve(rect, 0.22, 0), ['right']);
  }
});

test('all eight compass angles map consistently across sizes and offsets', () => {
  const cases = [
    [0, ['right']], [45, ['down', 'right']], [90, ['down']], [135, ['down', 'left']],
    [180, ['left']], [225, ['up', 'left']], [270, ['up']], [315, ['up', 'right']],
  ];
  for (const rect of pads) {
    for (const [degrees, expected] of cases) {
      const angle = degrees * Math.PI / 180;
      assert.deepEqual(resolve(rect, Math.cos(angle) * 0.8, Math.sin(angle) * 0.8), expected, `${degrees} degrees on ${JSON.stringify(rect)}`);
    }
  }
});

test('shallow movement stays cardinal while deliberate diagonal motion activates two axes', () => {
  const rect = pads[1];
  assert.deepEqual(resolve(rect, 0.8, 0.16), ['right']);
  assert.deepEqual(resolve(rect, 0.8, 0.4), ['down', 'right']);
  assert.deepEqual(resolve(rect, 0.16, -0.8), ['up']);
  assert.deepEqual(resolve(rect, -0.4, -0.8), ['up', 'left']);
});

test('sliding one contact changes directions and releases at center or far outside', () => {
  const path = [[0, 0], [0.8, 0], [0.6, 0.6], [0, 0.8], [-0.6, 0.6], [-0.8, 0], [-0.6, -0.6], [0, -0.8], [0.6, -0.6], [0, 0], [1.6, 0]];
  const expected = [[], ['right'], ['down', 'right'], ['down'], ['down', 'left'], ['left'], ['up', 'left'], ['up'], ['up', 'right'], [], []];
  for (const rect of pads) assert.deepEqual(path.map(([x, y]) => resolve(rect, x, y)), expected);
});

test('a small edge overshoot remains usable but dragging too far cancels', () => {
  for (const rect of pads) {
    assert.deepEqual(resolve(rect, 1.2, 0), ['right']);
    assert.deepEqual(resolve(rect, 0, -1.2), ['up']);
    for (const [x, y] of [[1.36, 0], [-1.36, 0], [0, 1.36], [0, -1.36], [1, 1], [-1, -1]]) {
      assert.deepEqual(resolve(rect, x, y), []);
    }
  }
});

test('opposite points produce exactly opposite directions without stale actions', () => {
  const inverse = { up: 'down', down: 'up', left: 'right', right: 'left' };
  for (const rect of pads) {
    for (let degrees = 0; degrees < 360; degrees += 7) {
      const angle = degrees * Math.PI / 180, x = Math.cos(angle) * 0.7, y = Math.sin(angle) * 0.7;
      const forward = resolve(rect, x, y);
      assert.deepEqual(resolve(rect, -x, -y), forward.map(direction => inverse[direction]));
      assert.ok(forward.length === 1 || forward.length === 2);
    }
  }
});

test('invalid coordinates and rectangles safely return neutral input', () => {
  const rect = pads[0];
  for (const value of [NaN, Infinity, -Infinity, undefined, null, '12']) {
    assert.deepEqual(getDpadDirections(value, 10, rect), []);
    assert.deepEqual(getDpadDirections(10, value, rect), []);
  }
  for (const bad of [undefined, null, {}, { ...rect, width: 0 }, { ...rect, width: -1 }, { ...rect, height: 0 }, { ...rect, height: -2 }, { ...rect, left: NaN }, { ...rect, top: Infinity }, { ...rect, width: '48' }, { ...rect, height: Infinity }]) {
    assert.deepEqual(getDpadDirections(10, 10, bad), []);
  }
});

test('joystick stays neutral through ten pixels and scales speed to full at fifty-two', () => {
  for (const [x, y] of [[0, 0], [10, 0], [-10, 0], [6, 8], [0, -10]]) {
    assert.deepEqual(getJoystickVector(x, y), { x: 0, y: 0, magnitude: 0 });
  }
  const slight = getJoystickVector(11, 0), half = getJoystickVector(31, 0), full = getJoystickVector(52, 0);
  assert.ok(slight.magnitude > 0 && slight.magnitude < half.magnitude);
  assert.deepEqual(half, { x: 1, y: 0, magnitude: 0.5 });
  assert.deepEqual(full, { x: 1, y: 0, magnitude: 1 });
  assert.deepEqual(getJoystickVector(500, 0), full);
});

test('joystick quantizes all eight directions without increasing diagonal speed', () => {
  const expected = [[1, 0], [Math.SQRT1_2, Math.SQRT1_2], [0, 1], [-Math.SQRT1_2, Math.SQRT1_2], [-1, 0], [-Math.SQRT1_2, -Math.SQRT1_2], [0, -1], [Math.SQRT1_2, -Math.SQRT1_2]];
  expected.forEach(([x, y], index) => {
    const angle = index * Math.PI / 4;
    const vector = getJoystickVector(Math.cos(angle) * 31, Math.sin(angle) * 31);
    assert.equal(vector.x, x); assert.equal(vector.y, y);
    assert.ok(Math.abs(vector.magnitude - 0.5) < 1e-12);
    assert.ok(Math.abs(Math.hypot(vector.x, vector.y) - 1) < 1e-12);
  });
  assert.equal(getJoystickVector(40, 10).y, 0);
  assert.equal(getJoystickVector(40, 20).y, Math.SQRT1_2);
});

test('joystick speed is monotonic and opposite drags have symmetric magnitude', () => {
  let previous = 0;
  for (let distance = 0; distance <= 100; distance++) {
    const forward = getJoystickVector(distance, distance / 2);
    const backward = getJoystickVector(-distance, -distance / 2);
    assert.ok(forward.magnitude >= previous && forward.magnitude <= 1);
    assert.equal(forward.magnitude, backward.magnitude);
    if (forward.magnitude > 0) { assert.equal(forward.x, -backward.x); assert.equal(forward.y, -backward.y); }
    previous = forward.magnitude;
  }
});

test('joystick rejects invalid displacements and unusable radius settings', () => {
  const neutral = { x: 0, y: 0, magnitude: 0 };
  for (const value of [NaN, Infinity, -Infinity, undefined, null, '20']) {
    assert.deepEqual(getJoystickVector(value, 20), neutral);
    assert.deepEqual(getJoystickVector(20, value), neutral);
  }
  for (const options of [{ deadZone: -1 }, { deadZone: 52 }, { maxRadius: 0 }, { maxRadius: 10 }, { maxRadius: Infinity }, { deadZone: NaN }]) {
    assert.deepEqual(getJoystickVector(20, 20, options), neutral);
  }
  assert.deepEqual(getJoystickVector(15, 0, { deadZone: 5, maxRadius: 25 }), { x: 1, y: 0, magnitude: 0.5 });
});
