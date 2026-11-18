import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, stepGame, getStats, useItem, nextLevel, attack, activateSpecial, setLocale, clearInputBuffer, LEVELS, ITEMS } from '../dist/game-core.js';

const inert = state => {
  state.enemies.forEach(enemy => { enemy.speed = 0; enemy.attackCooldown = 10000; enemy.x = 2300; });
  return state;
};

test('three distinct levels, reproducible waves, and bounded movement', () => {
  assert.equal(LEVELS.length, 3);
  assert.deepEqual(createGame().enemies, createGame().enemies);
  const game = inert(createGame());
  stepGame(game, 30, { left: true, up: true });
  assert.equal(game.player.x, 45);
  assert.equal(game.player.y, 330);
  stepGame(game, 30, { right: true, down: true });
  assert.equal(game.player.x, 2355);
  assert.equal(game.player.y, 500);
  assert.equal(game.cameraX, 1440);
});

test('strength tiers replace instead of stack and weak tier cannot downgrade', () => {
  const game = createGame();
  assert.equal(useItem(game, 0), true);
  assert.equal(getStats(game).damage, 38);
  assert.equal(useItem(game, 1), true);
  assert.equal(getStats(game).damage, 48);
  assert.equal(useItem(game, 0), false);
  assert.equal(game.inventory[0], 1);
});

test('all buffs use 120 active seconds, smoke does not extend duration, pause freezes', () => {
  const game = inert(createGame());
  useItem(game, 0); useItem(game, 2); useItem(game, 3);
  assert.equal(getStats(game).enemyTimeScale, 0.42);
  assert.equal(getStats(game).speed, 205 * 1.7);
  assert.equal(getStats(game).damage, 38 * 1.25);
  stepGame(game, 60);
  assert.ok(Math.abs(game.buffs.smoke.remaining - 60) < 0.001);
  game.mode = 'paused';
  stepGame(game, 60);
  assert.ok(Math.abs(game.buffs.smoke.remaining - 60) < 0.001);
  game.mode = 'playing';
  stepGame(game, 60.01);
  assert.equal(game.buffs.smoke.remaining, 0);
  assert.equal(game.buffs.slim.remaining, 0);
  assert.equal(game.buffs.strength.amount, 0);
  assert.equal(getStats(game).damage, 18);
});

test('shawarma clamps HP and cannot be wasted at full HP; empty items fail', () => {
  const game = createGame();
  assert.equal(useItem(game, 4), false);
  assert.equal(game.inventory[4], 2);
  game.player.hp = 95;
  assert.equal(useItem(game, 4), true);
  assert.equal(game.player.hp, 120);
  game.inventory[2] = 0;
  assert.equal(useItem(game, 2), false);
  assert.equal(useItem(game, 8), false);
});

test('punch has startup, faces the target, respects lane, and hits once', () => {
  const game = createGame();
  const enemy = game.enemies[0];
  Object.assign(enemy, { x: game.player.x + 60, y: game.player.y, attackCooldown: 10, speed: 0, hp: 100 });
  game.enemies = [enemy];
  attack(game, 'punch');
  stepGame(game, 0.03);
  assert.equal(enemy.hp, 100);
  stepGame(game, 0.1);
  assert.equal(enemy.hp, 82);
  stepGame(game, 0.16);
  assert.equal(enemy.hp, 82);
  enemy.x = game.player.x - 55;
  stepGame(game, 0.1);
  attack(game, 'punch'); stepGame(game, 0.3);
  assert.equal(enemy.hp, 82);
  enemy.x = game.player.x + 60; enemy.y = game.player.y - 80;
  stepGame(game, 0.1); attack(game, 'kick'); stepGame(game, 0.5);
  assert.equal(enemy.hp, 82);
});

test('telegraphed enemy attack can hit, dodge prevents a hit, and lethal hit ends run', () => {
  const make = () => {
    const game = createGame();
    const enemy = game.enemies[0];
    Object.assign(enemy, { x: game.player.x + 55, y: game.player.y, attackCooldown: 0, speed: 0 });
    game.enemies = [enemy];
    return game;
  };
  const game = make();
  stepGame(game, 0.1);
  assert.ok(game.enemies[0].attackTimer > 0);
  assert.equal(game.player.hp, 120);
  stepGame(game, 0.6);
  assert.equal(game.player.hp, 113);
  const dodge = make();
  stepGame(dodge, 0.45);
  stepGame(dodge, 0.23, { dodge: true, left: true });
  assert.equal(dodge.player.hp, 120);
  const lethal = make(); lethal.player.hp = 1;
  stepGame(lethal, 0.7);
  assert.equal(lethal.mode, 'gameover');
});

test('three waves clear each level, next level retains progress, factory wins', () => {
  const game = createGame();
  for (let level = 0; level < 3; level++) {
    for (let wave = 1; wave <= 3; wave++) {
      assert.equal(game.wave, wave);
      assert.ok(game.enemies.length > 0);
      game.enemies = [];
      stepGame(game, 1.15);
    }
    assert.equal(game.mode, level === 2 ? 'victory' : 'levelclear');
    if (level < 2) {
      const score = game.score;
      assert.equal(nextLevel(game), true);
      assert.equal(game.level, level + 1);
      assert.equal(game.score, score);
      assert.equal(game.mode, 'playing');
    }
  }
  assert.equal(nextLevel(game), false);
});

test('pickups replenish inventory on proximity', () => {
  const game = createGame();
  game.inventory[3] = 0;
  game.pickups.push({ id: 90, x: game.player.x, y: game.player.y, itemIndex: 3, life: 30, bob: 0 });
  stepGame(game, 0.02);
  assert.equal(game.inventory[3], 1);
  assert.equal(game.pickups.length, 0);
});

test('throw grabs nearest, cancels telegraph, damages its forward path once and animates flight', () => {
  const game = createGame();
  const [target, collateral, outside] = game.enemies;
  for (const enemy of game.enemies) Object.assign(enemy, { hp: 200, maxHp: 200, y: game.player.y, speed: 0, attackCooldown: 10 });
  target.x = game.player.x + 55; target.attackTimer = 0.1;
  collateral.x = game.player.x + 170;
  outside.x = game.player.x + 260;
  assert.equal(attack(game, 'throw'), true);
  assert.equal(target.grabbed, true);
  assert.equal(target.attackTimer, 0);
  assert.equal(game.player.attackTimer, 0.75);
  stepGame(game, 0.15);
  assert.equal(target.hp, 200);
  stepGame(game, 0.25);
  assert.equal(target.hp, 135);
  assert.equal(collateral.hp, 158);
  assert.equal(outside.hp, 200);
  assert.equal(target.grabbed, false);
  assert.ok(target.knockedTimer > 0 && target.vx > 0 && target.airHeight > 0);
  const frozen = [target.x, target.knockedTimer, target.airHeight, game.player.attackTimer];
  game.mode = 'paused'; stepGame(game, 3);
  assert.deepEqual([target.x, target.knockedTimer, target.airHeight, game.player.attackTimer], frozen);
  game.mode = 'playing'; stepGame(game, 0.8);
  assert.equal(target.hp, 135);
  assert.equal(collateral.hp, 158);
  assert.equal(target.knockedTimer, 0);
  assert.equal(target.airHeight, 0);
});

test('throw miss gives feedback, kills award once and dead flight persists until landing', () => {
  const game = createGame(0, 'en');
  game.enemies = [game.enemies[0]];
  game.enemies[0].x = 1000;
  assert.equal(attack(game, 'throw'), false);
  assert.equal(game.texts.at(-1).text, 'GET CLOSER');
  stepGame(game, 0.41);
  Object.assign(game.enemies[0], { x: game.player.x - 50, y: game.player.y, hp: 30, speed: 0, attackCooldown: 10 });
  const enemy = game.enemies[0];
  assert.equal(attack(game, 'throw'), true);
  assert.equal(game.player.face, -1);
  stepGame(game, 0.4);
  assert.equal(enemy.hp, 0);
  assert.equal(game.kills, 1);
  assert.equal(game.rage, 18);
  assert.ok(game.enemies.includes(enemy));
  stepGame(game, 0.8);
  assert.equal(game.kills, 1);
  assert.equal(game.enemies.includes(enemy), false);
});

test('rage builds from hits and damage; full special spends meter and hits its radius exactly once', () => {
  const game = createGame();
  const [near, far, behind] = game.enemies;
  for (const enemy of game.enemies) Object.assign(enemy, { hp: 200, maxHp: 200, y: game.player.y, speed: 0, attackCooldown: 10 });
  near.x = game.player.x + 65;
  far.x = game.player.x + 260;
  behind.x = game.player.x - 120;
  attack(game, 'punch'); stepGame(game, 0.3);
  assert.equal(game.rage, 6);
  assert.equal(activateSpecial(game), false);
  game.rage = 100;
  const hp = near.hp;
  assert.equal(activateSpecial(game), true);
  assert.equal(game.rage, 0);
  assert.equal(game.specialTimer, 0.85);
  assert.equal(near.hp, hp - 88);
  assert.equal(behind.hp, 112);
  assert.equal(far.hp, 200);
  assert.ok(near.vx > 0 && behind.vx < 0);
  const snapshot = [near.x, game.specialTimer];
  game.mode = 'paused'; stepGame(game, 2);
  assert.deepEqual([near.x, game.specialTimer], snapshot);
  game.mode = 'playing'; stepGame(game, 0.9, { special: true });
  assert.equal(near.hp, hp - 88);
  assert.equal(game.rage, 0);
  Object.assign(far, { x: game.player.x + 55, y: game.player.y, attackTimer: 0.01, attackCooldown: 0 });
  game.player.hitTimer = 0;
  stepGame(game, 0.02);
  assert.equal(game.rage, far.damage);
});

test('floating item text localizes and language/rage survive level transitions', () => {
  const game = createGame(0, 'en');
  useItem(game, 0);
  assert.equal(game.texts.at(-1).text, 'POWER +20');
  setLocale(game, 'he');
  useItem(game, 2);
  assert.equal(game.texts.at(-1).text, 'הילוך איטי');
  game.rage = 73;
  game.mode = 'levelclear';
  nextLevel(game);
  assert.equal(game.locale, 'he');
  assert.equal(game.rage, 73);
  setLocale(game, 'invalid');
  assert.equal(game.locale, 'ru');
});

test('actual combat can complete the full campaign with throws and specials', () => {
  const game = createGame();
  let buffedLevel = -1;
  let throws = 0, specials = 0;
  for (let tick = 0; tick < 60 * 180 && game.mode !== 'victory' && game.mode !== 'gameover'; tick++) {
    if (game.mode === 'levelclear') nextLevel(game);
    if (game.level !== buffedLevel) {
      useItem(game, 1); useItem(game, 2); useItem(game, 3);
      buffedLevel = game.level;
    }
    if (game.player.hp < 75) useItem(game, 4);
    const target = [...game.enemies].filter(enemy => enemy.hp > 0)
      .sort((a, b) => Math.hypot(a.x - game.player.x, a.y - game.player.y) - Math.hypot(b.x - game.player.x, b.y - game.player.y))[0];
    const dx = target ? target.x - game.player.x : 0;
    const dy = target ? target.y - game.player.y : 0;
    const wrongFace = target && Math.sign(dx) !== game.player.face;
    const canThrow = target && !target.knockedTimer && Math.abs(dx) < 76 && Math.abs(dy) < 40;
    stepGame(game, 1 / 60, {
      left: dx < -60 || (wrongFace && dx < 0), right: dx > 60 || (wrongFace && dx > 0),
      up: dy < -15, down: dy > 15,
      throw: canThrow, kick: Boolean(target?.knockedTimer) && Math.abs(dx) < 140 && Math.abs(dy) < 40,
      special: game.rage >= 100,
    });
    throws += game.events.filter(event => event.type === 'throw-impact').length;
    specials += game.events.filter(event => event.type === 'special').length;
    game.events.length = 0;
  }
  assert.equal(game.mode, 'victory');
  assert.equal(game.kills, 42);
  assert.ok(throws > 0);
  assert.ok(specials > 0);
});

test('three connected punches finish with stronger damage, launch and one localized finisher event', () => {
  const game = createGame(0, 'en');
  const enemy = game.enemies[0];
  game.enemies = [enemy];
  Object.assign(enemy, { x: game.player.x + 60, y: game.player.y, hp: 200, maxHp: 200, speed: 0, attackCooldown: 20 });
  for (let frame = 0; frame < 100 && !game.events.some(event => event.type === 'finisher'); frame++) {
    stepGame(game, 1 / 60, { punch: true });
  }
  assert.equal(enemy.hp, 200 - 18 - 20 - 32);
  assert.equal(game.player.punchStep, 3);
  assert.equal(game.player.isFinisher, true);
  assert.equal(game.player.punchChain, 0);
  assert.ok(enemy.knockedTimer > 0);
  assert.ok(game.hitStop > 0);
  assert.equal(game.events.filter(event => event.type === 'finisher').length, 1);
  assert.ok(game.impacts.some(effect => effect.kind === 'finisher'));
  assert.ok(game.texts.some(label => label.text === 'FINISHER!'));
});

test('punch chain expires and kick breaks the chain instead of becoming a finisher', () => {
  const game = createGame();
  const enemy = game.enemies[0];
  game.enemies = [enemy];
  Object.assign(enemy, { x: game.player.x + 55, y: game.player.y, hp: 500, maxHp: 500, speed: 0, attackCooldown: 20 });
  attack(game, 'punch'); stepGame(game, 0.4);
  assert.equal(game.player.punchChain, 1);
  attack(game, 'kick'); stepGame(game, 0.7);
  assert.equal(game.player.punchChain, 0);
  assert.equal(game.player.isFinisher, false);
  enemy.x = game.player.x + 55;
  attack(game, 'punch'); stepGame(game, 0.4);
  assert.equal(game.player.punchStep, 1);
  stepGame(game, 1.1);
  attack(game, 'punch');
  assert.equal(game.player.punchStep, 1);
});

test('brief throw and special taps buffer near recovery, and pausing clears pending actions', () => {
  const game = createGame();
  const enemy = game.enemies[0];
  game.enemies = [enemy];
  Object.assign(enemy, { x: game.player.x + 60, y: game.player.y, hp: 200, maxHp: 200, speed: 0, attackCooldown: 20 });
  game.player.attackCooldown = 0.18;
  stepGame(game, 0.016, { throw: true });
  assert.ok(game.inputBuffer.throw > 0);
  stepGame(game, 0.2);
  assert.equal(game.player.attack, 'throw');
  assert.equal(enemy.grabbed, true);
  stepGame(game, 1.2);
  game.rage = 100;
  game.player.dodgeTimer = 0.15;
  stepGame(game, 0.016, { special: true });
  assert.ok(game.inputBuffer.special > 0);
  stepGame(game, 0.2);
  assert.equal(game.rage, 0);
  assert.ok(game.specialTimer > 0);
  game.inputBuffer.throw = game.inputBuffer.special = 0.24;
  game.mode = 'paused'; stepGame(game, 1);
  assert.deepEqual(game.inputBuffer, { throw: 0, special: 0 });
  game.inputBuffer.throw = 0.2; clearInputBuffer(game);
  assert.equal(game.inputBuffer.throw, 0);
});

test('hitstop freezes combat movement but active buff clocks still run', () => {
  const game = inert(createGame());
  useItem(game, 2);
  game.hitStop = 0.08;
  game.player.attackCooldown = 0.5;
  const x = game.player.x;
  const before = game.buffs.smoke.remaining;
  stepGame(game, 0.06, { right: true });
  assert.equal(game.player.x, x);
  assert.equal(game.player.attackCooldown, 0.5);
  assert.ok(Math.abs(game.buffs.smoke.remaining - (before - 0.06)) < 1e-8);
  stepGame(game, 0.04, { right: true });
  assert.ok(game.player.x > x);
  assert.equal(game.hitStop, 0);
});

test('smoke item uses the requested weed name in all three languages', () => {
  assert.equal(ITEMS[2].name, 'Шмаль');
  for (const [locale, word] of [['ru', 'Шмаль'], ['en', 'Weed'], ['he', 'גראס']]) {
    const game = createGame(0, locale);
    game.pickups.push({ id: 900, itemIndex: 2, x: game.player.x, y: game.player.y, bob: 0, life: 20 });
    stepGame(game, 0.02);
    assert.ok(game.texts.some(label => label.text.includes(word)));
  }
});

test('held crouch halves movement, preserves paused pose and releases on key up', () => {
  const standing = inert(createGame());
  const crouched = inert(createGame());
  const start = standing.player.x;
  stepGame(standing, 1, { right: true });
  stepGame(crouched, 1, { right: true, crouch: true });
  assert.equal(crouched.player.crouching, true);
  assert.ok(Math.abs((crouched.player.x - start) * 2 - (standing.player.x - start)) < 1e-8);
  const x = crouched.player.x;
  crouched.mode = 'paused'; stepGame(crouched, 2);
  assert.equal(crouched.player.crouching, true);
  assert.equal(crouched.player.x, x);
  crouched.mode = 'playing'; stepGame(crouched, 0.02, {});
  assert.equal(crouched.player.crouching, false);
});

test('crouch ducks ordinary high punches but cannot duck boss attacks', () => {
  for (const type of ['punk', 'runner', 'boss']) {
    const game = createGame();
    const enemy = game.enemies[0];
    game.enemies = [enemy];
    Object.assign(enemy, { type, x: game.player.x + 55, y: game.player.y, speed: 0, attackTimer: 0.01 });
    stepGame(game, 0.02, { crouch: true });
    assert.equal(game.player.hp, type === 'boss' ? 120 - enemy.damage : 120);
    assert.equal(game.events.some(event => event.type === 'evade'), type !== 'boss');
  }
});

test('attacks stand the hero up even while crouch is held', () => {
  for (const type of ['punch', 'kick', 'throw']) {
    const game = createGame();
    const enemy = game.enemies[0];
    game.enemies = [enemy];
    Object.assign(enemy, { x: game.player.x + 55, y: game.player.y, speed: 0, attackCooldown: 20 });
    stepGame(game, 0.02, { crouch: true });
    assert.equal(game.player.crouching, true);
    stepGame(game, 0.02, { crouch: true, [type]: true });
    assert.equal(game.player.crouching, false);
    assert.equal(game.player.attack, type);
  }
});
