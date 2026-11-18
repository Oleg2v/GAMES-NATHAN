import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, useItem } from '../dist/game-core.js';
import { logicalFraming, updateCamera, computeCameraTarget, edgeIndicators, intersects, spriteOffsets } from '../dist/camera.js';
import { createRenderer } from '../dist/renderer.js';

const sizes = [[844, 390], [667, 375], [740, 320]];

// 844x390 positions were measured from the actual mobile DOM. The other sizes
// retain the same corner anchors/control sizes and responsive HUD width.
function phoneFraming(width, height) {
  const right = width - 844, bottom = height - 390;
  const rect = (left, top, w, h) => ({ left, top, right:left + w, bottom:top + h });
  const occlusions = [
    rect(28, 206 + bottom, 56, 32),
    rect(764 + right, 173.61 + bottom, 56, 32),
    rect(721.8 + right, 213.61 + bottom, 56, 56),
    rect(768 + right, 259.8 + bottom, 56, 56),
    rect(721.8 + right, 306 + bottom, 56, 56),
    rect(675.61 + right, 259.8 + bottom, 56, 56),
    rect(8, 242 + bottom, 132, 120),
    rect(12, 12, Math.min(width * .25, 170), 48),
    rect(width * .49 - 55, 12, 110, 51),
    rect(758 + right, 52, 74, 36),
    rect(627 + right, 8, 67, 36),
    rect(700 + right, 8, 40, 36),
    rect(746 + right, 8, 86, 36),
  ];
  return logicalFraming({ enabled:true, viewportWidth:width, viewportHeight:height, occlusions }, Math.round(540 * width / height), 540);
}

function assertPlayerVisible(view, options, message) {
  assert.equal(view.playerSafe, true, message);
  const b = view.playerBox;
  assert.ok(b.left >= 0 && b.right <= options.width && b.top >= 0 && b.bottom <= options.height, message);
  assert.ok(options.occlusions.every(r => !intersects(b, r)), message);
}

test('full-size phone controls remain physical-size occlusions after logical canvas scaling', () => {
  for (const [width, height] of sizes) {
    const options = phoneFraming(width, height);
    assert.equal(options.occlusions.length, 13);
    assert.equal(options.height, 540);
    assert.equal(options.width, Math.round(width / height * 540));
    const control = options.occlusions[0];
    assert.ok(Math.abs((control.right - control.left) * width / options.width - 56) < .0001);
    assert.ok(Math.abs((control.bottom - control.top) * height / options.height - 32) < .0001);
  }
});

test('Nathan remains visible at both world edges and both lane limits in every action pose', () => {
  for (const [width, height] of sizes) {
    const options = phoneFraming(width, height);
    for (const x of [45, 1200, 2355]) for (const y of [330, 500]) {
      for (const attack of [null, 'punch', 'kick', 'throw']) for (const face of [-1, 1]) {
        const state = createGame();
        state.enemies = [];
        Object.assign(state.player, { x, y, attack, attackTimer:attack ? .2 : 0, face });
        assertPlayerVisible(computeCameraTarget(state, options), options, `${width}x${height} ${x},${y} ${attack} facing ${face}`);
      }
    }
  }
});

test('real maximum-speed boosted dodges and reversals never escape the visible phone frame', () => {
  for (const [width, height] of sizes) for (const fps of [30, 60, 120]) {
    const state = createGame(), options = phoneFraming(width, height);
    state.player.y = 500;
    useItem(state, 3);
    let view = null, maximumSpeed = 0;
    for (let frame = 0; frame < fps * 4; frame++) {
      const before = state.player.x, right = frame < fps * 2;
      stepGame(state, 1 / fps, { right, left:!right, dodge:true });
      maximumSpeed = Math.max(maximumSpeed, Math.abs(state.player.x - before) * fps);
      view = updateCamera(view, state, options, 1 / fps);
      assertPlayerVisible(view, options, `${width}x${height} @${fps}fps frame${frame}`);
      assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y));
    }
    assert.ok(maximumSpeed > 900, 'the test actually exercised the boosted dodge, not ordinary walking');
  }
});

test('nearby enemies cannot displace Nathan underneath the score HUD on a compact phone', () => {
  const options = phoneFraming(667, 375);
  for (const y of [330, 370, 410, 450, 500]) for (const dy of [-100, -50, 0, 50, 100]) {
    for (const dx of [80, 150, 205, 280]) {
      const state = createGame();
      Object.assign(state.player, { x:1200, y, attack:'kick', attackTimer:.3, face:1 });
      state.enemies = state.enemies.slice(0, 2).map((enemy, index) => ({
        ...enemy, x:1200 + (index ? -dx : dx), y:Math.max(330, Math.min(500, y + dy)), hp:100,
      }));
      assertPlayerVisible(computeCameraTarget(state, options), options, `playerY=${y}, enemyDY=${dy}, enemyDX=${dx}`);
    }
  }
});

test('camera calculations do not mutate the simulation and warnings exclude defeated rear enemies', () => {
  const options = phoneFraming(844, 390), state = createGame();
  state.player.x = 1200;
  state.enemies = state.enemies.slice(0, 3).map((enemy, i) => ({ ...enemy, x:[50, 2350, 40][i], hp:i === 2 ? 0 : 20 }));
  const before = structuredClone(state);
  const view = updateCamera(null, state, options, 1 / 60);
  const warnings = edgeIndicators(state, view, options);
  assert.deepEqual(state, before);
  assert.deepEqual(warnings.map(w => w.edge).sort(), ['left', 'right']);
  assert.equal(warnings.reduce((sum, w) => sum + w.count, 0), 2);
  for (const warning of warnings) assert.ok(options.occlusions.every(r => !intersects(warning.box, r)));
});

test('stationary facing changes do not snap the camera and aspect changes immediately reframe safely', () => {
  const state = createGame();
  state.enemies = [];
  state.player.x = 1200;
  let view = updateCamera(null, state, phoneFraming(844, 390), 1 / 60);
  for (let i = 0; i < 20; i++) {
    state.player.face *= -1;
    const next = updateCamera(view, state, phoneFraming(844, 390), 1 / 60);
    assert.equal(next.x, view.x);
    assert.equal(next.y, view.y);
    view = next;
  }
  const options = phoneFraming(667, 375);
  view = updateCamera(view, state, options, 1 / 60);
  assertPlayerVisible(view, options, 'resize');
  assert.equal(view.velocityX, 0, 'old-aspect lookahead is reset');
});

test('enemy attack bounds mirror the visible attacking arm', () => {
  const enemy = { type:'punk', attackTimer:.4, face:1 };
  const right = spriteOffsets(enemy);
  const left = spriteOffsets({ ...enemy, face:-1 });
  assert.equal(left.left, -right.right);
  assert.equal(left.right, -right.left);
  assert.equal(left.top, right.top);
  assert.equal(left.bottom, right.bottom);
});

test('renderer keeps camera history on unchanged layout and freezes it during pause without modifying gameplay', () => {
  const context = new Proxy({}, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  } });
  const canvas = { width:0, height:0, getContext:() => context };
  const renderer = createRenderer(canvas), options = phoneFraming(844, 390);
  renderer.resize(844, 390);
  renderer.setMobileFraming({ ...options, viewportWidth:options.width, viewportHeight:options.height });
  const state = createGame();
  for (let i = 0; i < 20; i++) {
    stepGame(state, 1 / 60, { right:true });
    renderer.render(state, 1 / 60);
  }
  const runningView = structuredClone(renderer.getCameraView());
  assert.ok(runningView.velocityX > 100);
  renderer.resize(844, 390);
  renderer.setMobileFraming({ ...options, viewportWidth:options.width, viewportHeight:options.height });
  assert.deepEqual(renderer.getCameraView(), runningView, 'duplicate layout notifications retain damping history');
  state.mode = 'paused';
  const before = structuredClone(state);
  for (let i = 0; i < 60; i++) renderer.render(state, 1 / 60);
  assert.deepEqual(renderer.getCameraView(), runningView, 'paused render calls must not ease the camera');
  assert.deepEqual(state, before, 'rendering must not change simulation state');
});
