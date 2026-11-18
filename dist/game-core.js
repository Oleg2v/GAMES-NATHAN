// Deterministic, DOM-free simulation. Item effects are fictional arcade mechanics.
export const WORLD = Object.freeze({ width: 2400, height: 540, minY: 330, maxY: 500 });
export const LEVELS = Object.freeze([
  { id: 'city', name: 'ГОРОД', subtitle: 'Ночная смена на улицах', color: '#ffa454' },
  { id: 'forest', name: 'ЛЕС', subtitle: 'Тропа без обхода', color: '#99d078' },
  { id: 'factory', name: 'ЗАВОД', subtitle: 'Последняя смена', color: '#ff735c' },
]);
export const ITEMS = Object.freeze([
  { id: 'vyvanse20', name: 'Виванс 20', key: '1', description: '+20 к силе · 120 сек', color: '#78c2ff' },
  { id: 'vyvanse30', name: 'Виванс 30', key: '2', description: '+30 к силе · 120 сек', color: '#b6a1ff' },
  { id: 'smoke', name: 'Шмаль', key: '3', description: 'Слоу-мо + сильнее удары · 120 сек', color: '#bde6a1' },
  { id: 'ozempic', name: 'Оземпик', key: '4', description: 'Стройнее + скорость ×1,7 · 120 сек', color: '#66e1d6' },
  { id: 'shawarma', name: 'Шаурма', key: '5', description: '+45 здоровья', color: '#ffc576' },
]);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const BASE_INVENTORY = [2, 1, 1, 1, 2];
const TEXTS = {
  ru: { fullHealth: 'ЗДОРОВЬЕ ПОЛНОЕ', alreadyStrong: 'УЖЕ +30 К СИЛЕ', strength: 'СИЛА', slowmo: 'СЛОУ-МО', speed: 'СКОРОСТЬ ×1,7', hp: 'HP', closer: 'ПОДОЙДИ БЛИЖЕ', throw: 'БРОСОК!', rage: 'ЯРОСТЬ!', finisher: 'МОЩНЫЙ ХУК!', items: ['ВИВАНС 20', 'ВИВАНС 30', 'Шмаль', 'ОЗЕМПИК', 'ШАУРМА'] },
  en: { fullHealth: 'HEALTH FULL', alreadyStrong: 'ALREADY +30 POWER', strength: 'POWER', slowmo: 'SLOW-MO', speed: 'SPEED ×1.7', hp: 'HP', closer: 'GET CLOSER', throw: 'THROW!', rage: 'RAGE!', finisher: 'FINISHER!', items: ['VYVANSE 20', 'VYVANSE 30', 'Weed', 'OZEMPIC', 'SHAWARMA'] },
  he: { fullHealth: 'הבריאות מלאה', alreadyStrong: 'כבר +30 כוח', strength: 'כוח', slowmo: 'הילוך איטי', speed: 'מהירות ×1.7', hp: 'חיים', closer: 'צריך להתקרב', throw: 'הטלה!', rage: 'זעם!', finisher: 'מכה מסיימת!', items: ['ויואנס 20', 'ויואנס 30', 'גראס', 'אוזמפיק', 'שווארמה'] },
};
const T = (state, key) => (TEXTS[state.locale] || TEXTS.ru)[key];
export function setLocale(state, locale) {
  state.locale = Object.hasOwn(TEXTS, locale) ? locale : 'ru';
  return state.locale;
}
const ATTACKS = {
  punch: { duration: 0.25, active: 0.17, reach: 104, lane: 38, multiplier: 1, knockback: 26, cooldown: 0.31 },
  kick: { duration: 0.42, active: 0.26, reach: 146, lane: 43, multiplier: 1.5, knockback: 72, cooldown: 0.55 },
  throw: { duration: 0.75, active: 0.42, reach: 80, lane: 45, cooldown: 1.2 },
};

function random(state) {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}
function emit(state, type, data = {}) { state.events.push({ type, ...data }); }
function label(state, text, x, y, color = '#ffffff') {
  state.texts.push({ text: String(text), x, y, color, life: 0.95, maxLife: 0.95, vy: -38 });
}
function burst(state, x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = random(state) * Math.PI * 2;
    const speed = 45 + random(state) * 110;
    const life = 0.2 + random(state) * 0.25;
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 35, life, maxLife: life, color, size: 2 + Math.floor(random(state) * 4) });
  }
}
function impact(state, x, y, kind, direction = state.player.face, color = '#ffd478') {
  state.impacts.push({ x, y, kind, direction, color, life: kind === 'special' ? 0.45 : 0.25, maxLife: kind === 'special' ? 0.45 : 0.25 });
}
export function clearInputBuffer(state) {
  state.inputBuffer = { throw: 0, special: 0 };
}

function spawnWave(state) {
  const count = 2 + state.wave + Math.min(state.level, 1);
  const start = clamp(state.player.x + 340, 460, 2000);
  for (let i = 0; i < count; i++) {
    const boss = state.level === 2 && state.wave === 3 && i === count - 1;
    const maxHp = boss ? 190 : 48 + state.level * 12 + state.wave * 5;
    const side = i % 3 === 2 ? -1 : 1;
    state.enemies.push({
      id: ++state.entityId,
      x: side === -1 ? clamp(state.player.x - 260 - i * 25, 55, 2340) : clamp(start + i * 95, 70, 2330),
      y: 365 + random(state) * 110,
      face: side === -1 ? 1 : -1, hp: maxHp, maxHp,
      type: boss ? 'boss' : i % 2 ? 'runner' : 'punk',
      attackTimer: 0, attackCooldown: 0.6 + i * 0.32, hitTimer: 0, walkTime: 0,
      stunned: 0, speed: boss ? 65 : 70 + state.level * 8 + random(state) * 16,
      grabbed: false, grabbedBy: null, knockedTimer: 0, knockDuration: 0.7, vx: 0, airHeight: 0, spin: 0, koCounted: false,
      slot: i, damage: boss ? 16 : 7 + state.level * 2,
    });
  }
  state.waveDelay = 0;
  state.waveAnnounce = 2.2;
  emit(state, 'wave', { wave: state.wave, level: state.level });
}

export function createGame(level = 0, locale = 'ru') {
  level = clamp(Math.floor(Number(level) || 0), 0, LEVELS.length - 1);
  const state = {
    mode: 'playing', level, wave: 1, locale: Object.hasOwn(TEXTS, locale) ? locale : 'ru', rage: 0, specialTimer: 0,
    hitStop: 0, inputBuffer: { throw: 0, special: 0 }, impacts: [],
    player: {
      x: 230, y: 430, face: 1, hp: 120, maxHp: 120,
      attack: null, attackTimer: 0, attackCooldown: 0, attackHit: false,
      dodgeTimer: 0, dodgeCooldown: 0, hitTimer: 0, walkTime: 0,
      useTimer: 0, useItem: null, moving: false, crouching: false, specialTimer: 0, throwTargetId: null, throwFace: 1,
      punchStep: 0, isFinisher: false, punchChain: 0, punchChainTimer: 0,
    },
    enemies: [], pickups: [], particles: [], texts: [],
    buffs: { strength: { amount: 0, remaining: 0 }, smoke: { remaining: 0 }, slim: { remaining: 0 } },
    inventory: [...BASE_INVENTORY], score: 0, kills: 0, combo: 0, comboTimer: 0,
    time: 0, cameraX: 0, events: [], seed: 410029 + level * 34567, entityId: 0,
    waveDelay: 0, waveAnnounce: 2.2, screenShake: 0,
  };
  spawnWave(state);
  return state;
}

export function getStats(state) {
  return {
    damage: (18 + (state.buffs.strength.remaining > 0 ? state.buffs.strength.amount : 0)) * (state.buffs.smoke.remaining > 0 ? 1.25 : 1),
    speed: 205 * (state.buffs.slim.remaining > 0 ? 1.7 : 1),
    enemyTimeScale: state.buffs.smoke.remaining > 0 ? 0.42 : 1,
    slim: state.buffs.slim.remaining > 0,
  };
}

export function useItem(state, index) {
  if (state.mode !== 'playing' || !Number.isInteger(index) || index < 0 || index >= ITEMS.length || state.inventory[index] <= 0) return false;
  const player = state.player;
  if (index === 4 && player.hp >= player.maxHp) {
    label(state, T(state, 'fullHealth'), player.x, player.y - 180, '#ffc576');
    return false;
  }
  // A weaker pickup never consumes a charge or reduces an already stronger buff.
  if (index < 2 && state.buffs.strength.remaining > 0 && state.buffs.strength.amount > (index === 0 ? 20 : 30)) {
    label(state, T(state, 'alreadyStrong'), player.x, player.y - 180, '#b6a1ff');
    return false;
  }
  state.inventory[index]--;
  player.useTimer = 0.7;
  player.useItem = ITEMS[index].id;
  if (index < 2) {
    state.buffs.strength = { amount: index === 0 ? 20 : 30, remaining: 120 };
    label(state, `${T(state, 'strength')} +${state.buffs.strength.amount}`, player.x, player.y - 180, ITEMS[index].color);
  } else if (index === 2) {
    state.buffs.smoke.remaining = 120;
    label(state, T(state, 'slowmo'), player.x, player.y - 180, ITEMS[index].color);
  } else if (index === 3) {
    state.buffs.slim.remaining = 120;
    label(state, T(state, 'speed'), player.x, player.y - 180, ITEMS[index].color);
  } else {
    const restored = Math.min(45, player.maxHp - player.hp);
    player.hp += restored;
    label(state, `+${restored} ${T(state, 'hp')}`, player.x, player.y - 180, ITEMS[index].color);
  }
  burst(state, player.x, player.y - 80, ITEMS[index].color, 14);
  emit(state, index === 4 ? 'heal' : 'powerup', { item: ITEMS[index].id, index });
  return true;
}

export function attack(state, type = 'punch') {
  const player = state.player;
  if (state.mode !== 'playing' || !ATTACKS[type] || player.attackCooldown > 0 || player.dodgeTimer > 0 || state.specialTimer > 0) return false;
  if (type === 'throw') {
    const target = state.enemies
      .filter(enemy => enemy.hp > 0 && !enemy.grabbed && !enemy.knockedTimer && Math.abs(enemy.x - player.x) <= 80 && Math.abs(enemy.y - player.y) <= 45)
      .sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0];
    if (!target) {
      player.attackCooldown = 0.4;
      label(state, T(state, 'closer'), player.x, player.y - 180, '#f4ce99');
      emit(state, 'throw-miss');
      return false;
    }
    player.face = target.x >= player.x ? 1 : -1;
    player.throwFace = player.face;
    player.throwTargetId = target.id;
    target.grabbed = true;
    target.grabbedBy = 'player';
    target.attackTimer = 0;
    target.attackCooldown = 1.5;
  }
  const config = ATTACKS[type];
  player.crouching = false;
  if (type === 'punch') {
    player.punchStep = player.punchChainTimer > 0 ? player.punchChain + 1 : 1;
    player.isFinisher = player.punchStep === 3;
  } else {
    player.punchStep = 0;
    player.isFinisher = false;
    player.punchChain = 0;
    player.punchChainTimer = 0;
  }
  player.attack = type;
  player.attackTimer = config.duration;
  player.attackCooldown = config.cooldown;
  player.attackHit = false;
  emit(state, type, { step: player.punchStep, finisher: player.isFinisher });
  return true;
}

function launchEnemy(enemy, direction) {
  enemy.grabbed = false;
  enemy.grabbedBy = null;
  enemy.knockedTimer = 0.7;
  enemy.knockDuration = 0.7;
  enemy.vx = direction * (enemy.type === 'boss' ? 260 : 390);
  enemy.airHeight = 0;
  enemy.spin = 0;
  enemy.attackTimer = 0;
  enemy.attackCooldown = 1.6;
  enemy.stunned = 0.95;
}

function damageEnemy(state, enemy, damage, { direction = state.player.face, knockback = 0, launch = false, gainRage = true, color = '#ffd478' } = {}) {
  if (enemy.hp <= 0) return false;
  if (launch) launchEnemy(enemy, direction);
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.hitTimer = 0.24;
  enemy.stunned = Math.max(enemy.stunned, enemy.type === 'boss' ? 0.14 : 0.35);
  enemy.attackTimer = 0;
  enemy.attackCooldown = Math.max(enemy.attackCooldown, 0.55);
  enemy.x = clamp(enemy.x + knockback * direction * (enemy.type === 'boss' ? 0.5 : 1), 45, WORLD.width - 45);
  label(state, damage, enemy.x, enemy.y - 145, color);
  burst(state, enemy.x - direction * 18, enemy.y - 90, color, 8);
  if (gainRage) state.rage = Math.min(100, state.rage + 6);
  if (enemy.hp === 0 && !enemy.koCounted) {
    enemy.koCounted = true;
    state.kills++;
    if (gainRage) state.rage = Math.min(100, state.rage + 12);
    state.score += (enemy.type === 'boss' ? 700 : 100) + Math.min(state.combo, 20) * 10;
    emit(state, 'ko', { x: enemy.x, y: enemy.y, boss: enemy.type === 'boss' });
    burst(state, enemy.x, enemy.y - 65, '#eff3da', 15);
    if (state.kills % 2 === 0) {
      const itemIndex = state.kills % 6 === 0 ? 4 : Math.floor(random(state) * 5);
      state.pickups.push({ id: ++state.entityId, x: enemy.x, y: enemy.y, itemIndex, bob: random(state) * 6, life: 35 });
    }
  }
  return true;
}

function finishHits(state, hits, type, shake = 7) {
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0 || enemy.knockedTimer > 0);
  if (!hits) return;
  state.combo += hits;
  state.comboTimer = 2.3;
  state.screenShake = shake;
  state.hitStop = Math.max(state.hitStop, type === 'punch' ? 0.035 : type === 'kick' ? 0.055 : type === 'finisher' ? 0.075 : 0.08);
  emit(state, 'hit', { count: hits, attack: type });
}

function releaseThrow(state) {
  const p = state.player;
  const target = state.enemies.find(enemy => enemy.id === p.throwTargetId && enemy.hp > 0);
  if (!target) { p.throwTargetId = null; return; }
  const direction = p.throwFace;
  let hits = 0;
  for (const enemy of state.enemies) {
    const dx = (enemy.x - p.x) * direction;
    if (enemy !== target && (enemy.hp <= 0 || dx < 25 || dx > 225 || Math.abs(enemy.y - target.y) > 45)) continue;
    const damage = enemy === target ? 65 + Math.round((getStats(state).damage - 18) * 0.5) : 42;
    if (damageEnemy(state, enemy, damage, { direction, launch: true, color: '#ffbb78' })) {
      impact(state, enemy.x, enemy.y - 85, 'throw', direction, '#ffbb78');
      hits++;
    }
  }
  p.throwTargetId = null;
  label(state, T(state, 'throw'), p.x, p.y - 195, '#ffbb78');
  emit(state, 'throw-impact', { count: hits });
  finishHits(state, hits, 'throw', 10);
}

export function activateSpecial(state) {
  const p = state.player;
  if (state.mode !== 'playing' || state.rage < 100 || p.attackTimer > 0 || p.dodgeTimer > 0 || state.specialTimer > 0) return false;
  state.rage = 0;
  p.crouching = false;
  clearInputBuffer(state);
  state.specialTimer = p.specialTimer = 0.85;
  p.punchChain = p.punchStep = 0;
  p.isFinisher = false;
  p.punchChainTimer = 0;
  p.attackCooldown = 0.85;
  p.hitTimer = Math.max(p.hitTimer, 0.85);
  let hits = 0;
  for (const enemy of state.enemies) {
    if (Math.hypot(enemy.x - p.x, (enemy.y - p.y) * 1.25) > 195) continue;
    const direction = enemy.x >= p.x ? 1 : -1;
    if (damageEnemy(state, enemy, 88 + Math.round((getStats(state).damage - 18) * 0.5), { direction, launch: true, gainRage: false, color: '#ff9e57' })) hits++;
  }
  label(state, T(state, 'rage'), p.x, p.y - 205, '#ff9e57');
  burst(state, p.x, p.y - 70, '#ff9e57', 40);
  impact(state, p.x, p.y - 60, 'special', p.face, '#ff9e57');
  finishHits(state, hits, 'special', 13);
  state.screenShake = 13;
  emit(state, 'special', { count: hits, radius: 195 });
  return true;
}

function hitEnemies(state) {
  const p = state.player;
  if (p.attack === 'throw') { releaseThrow(state); return; }
  const config = ATTACKS[p.attack];
  const punch = p.attack === 'punch';
  const finisher = punch && p.isFinisher;
  const damage = Math.round(getStats(state).damage * (finisher ? 1.8 : punch && p.punchStep === 2 ? 1.12 : config.multiplier));
  const reach = config.reach + (punch ? (p.punchStep - 1) * 10 : 0);
  let hits = 0;
  for (const enemy of state.enemies) {
    const dx = (enemy.x - p.x) * p.face;
    if (enemy.hp <= 0 || dx < -25 || dx > reach || Math.abs(enemy.y - p.y) > config.lane) continue;
    if (damageEnemy(state, enemy, damage, { knockback: punch ? finisher ? 22 : 12 : config.knockback, launch: finisher })) {
      impact(state, enemy.x, enemy.y - 90, finisher ? 'finisher' : p.attack);
      hits++;
    }
  }
  if (punch) {
    p.punchChain = hits && !finisher ? p.punchStep : 0;
    p.punchChainTimer = hits && !finisher ? 1.0 : 0;
  }
  if (finisher && hits) {
    label(state, T(state, 'finisher'), p.x, p.y - 195, '#ffe1a0');
    emit(state, 'finisher', { x: p.x + p.face * 80, y: p.y - 90, count: hits });
  }
  finishHits(state, hits, finisher ? 'finisher' : p.attack, finisher ? 10 : p.attack === 'kick' ? 7 : 4);
}

function updateEnemy(state, enemy, dt, enemyDt) {
  const p = state.player;
  enemy.hitTimer = Math.max(0, enemy.hitTimer - dt);
  enemy.stunned = Math.max(0, enemy.stunned - enemyDt);
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - enemyDt);
  if (enemy.grabbed) {
    enemy.x = clamp(p.x + p.throwFace * 42, 45, WORLD.width - 45);
    enemy.y = p.y;
    enemy.airHeight = 22;
    return;
  }
  if (enemy.knockedTimer > 0) {
    enemy.knockedTimer = Math.max(0, enemy.knockedTimer - enemyDt);
    enemy.x = clamp(enemy.x + enemy.vx * enemyDt, 45, WORLD.width - 45);
    const progress = 1 - enemy.knockedTimer / enemy.knockDuration;
    enemy.airHeight = Math.sin(progress * Math.PI) * (enemy.type === 'boss' ? 42 : 65);
    enemy.spin = progress * Math.sign(enemy.vx) * Math.PI * 1.7;
    if (enemy.knockedTimer === 0) {
      enemy.airHeight = 0; enemy.spin = 0; enemy.vx = 0;
      burst(state, enemy.x, enemy.y - 8, '#b6b3a0', 9);
      emit(state, 'land', { x: enemy.x, y: enemy.y });
    }
    return;
  }
  if (enemy.hp <= 0) return;
  if (enemy.stunned > 0) return;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  enemy.face = dx >= 0 ? 1 : -1;
  if (enemy.attackTimer > 0) {
    enemy.attackTimer = Math.max(0, enemy.attackTimer - enemyDt);
    if (enemy.attackTimer === 0) {
      const inRange = Math.abs(dx) < (enemy.type === 'boss' ? 100 : 76) && Math.abs(dy) < 33;
      const ducksPunch = p.crouching && enemy.type !== 'boss';
      if (inRange && ducksPunch && p.hitTimer <= 0 && p.dodgeTimer <= 0) emit(state, 'evade', { style: 'crouch', enemy: enemy.id });
      if (inRange && !ducksPunch && p.hitTimer <= 0 && p.dodgeTimer <= 0) {
        p.hp = Math.max(0, p.hp - enemy.damage);
        p.hitTimer = 0.72;
        p.x = clamp(p.x + enemy.face * 18, 45, WORLD.width - 45);
        state.combo = 0;
        state.comboTimer = 0;
        state.screenShake = 5;
        state.rage = Math.min(100, state.rage + enemy.damage);
        label(state, `−${enemy.damage}`, p.x, p.y - 160, '#ff7867');
        emit(state, 'hurt', { damage: enemy.damage });
      }
      enemy.attackCooldown = 1.2 + (enemy.slot % 3) * 0.25;
    }
    return;
  }
  const desiredDistance = enemy.type === 'boss' ? 70 : 55;
  if (Math.abs(dx) < desiredDistance + 6 && Math.abs(dy) < 27 && enemy.attackCooldown <= 0) {
    enemy.attackTimer = enemy.type === 'boss' ? 0.75 : 0.58;
    emit(state, 'telegraph', { enemy: enemy.id });
    return;
  }
  let moveX = Math.abs(dx) > desiredDistance ? Math.sign(dx) : 0;
  let moveY = Math.abs(dy) > 11 ? Math.sign(dy) * 0.72 : 0;
  // Crowd separation gives every foe a readable silhouette and an approach lane.
  for (const other of state.enemies) {
    if (other.id === enemy.id || other.hp <= 0 || other.knockedTimer > 0 || other.grabbed) continue;
    const ox = enemy.x - other.x;
    const oy = enemy.y - other.y;
    if (Math.abs(ox) < 34 && Math.abs(oy) < 23) {
      moveY += (oy === 0 ? (enemy.slot % 2 ? 1 : -1) : Math.sign(oy)) * 0.55;
    }
  }
  const magnitude = Math.max(1, Math.hypot(moveX, moveY));
  enemy.x = clamp(enemy.x + moveX / magnitude * enemy.speed * enemyDt, 45, WORLD.width - 45);
  enemy.y = clamp(enemy.y + moveY / magnitude * enemy.speed * enemyDt, WORLD.minY, WORLD.maxY);
  if (moveX || moveY) enemy.walkTime += enemyDt;
}

function updateStep(state, dt, input) {
  const p = state.player;
  // Buffs count real active play time; impact freeze only pauses combat motion.
  state.time += dt;
  for (const buff of Object.values(state.buffs)) buff.remaining = Math.max(0, buff.remaining - dt);
  if (state.buffs.strength.remaining === 0) state.buffs.strength.amount = 0;
  if (input.throw && p.attackCooldown > 0 && p.attackCooldown <= 0.22 && p.dodgeTimer <= 0.22 && state.specialTimer <= 0.22) state.inputBuffer.throw = 0.24;
  if (input.special && state.rage >= 100 && Math.max(p.attackTimer, p.dodgeTimer, state.specialTimer) <= 0.22) state.inputBuffer.special = 0.24;
  if (state.hitStop > 0) {
    const frozen = Math.min(dt, state.hitStop);
    state.hitStop = Math.max(0, state.hitStop - frozen);
    dt -= frozen;
    if (dt <= 1e-8) return;
  }
  state.waveAnnounce = Math.max(0, state.waveAnnounce - dt);
  state.screenShake = Math.max(0, state.screenShake - dt * 28);
  state.specialTimer = Math.max(0, state.specialTimer - dt);
  p.specialTimer = state.specialTimer;
  state.inputBuffer.throw = Math.max(0, state.inputBuffer.throw - dt);
  state.inputBuffer.special = Math.max(0, state.inputBuffer.special - dt);
  p.punchChainTimer = Math.max(0, p.punchChainTimer - dt);
  if (p.punchChainTimer === 0) p.punchChain = 0;
  state.comboTimer = Math.max(0, state.comboTimer - dt);
  if (state.comboTimer === 0) state.combo = 0;
  p.hitTimer = Math.max(0, p.hitTimer - dt);
  p.dodgeTimer = Math.max(0, p.dodgeTimer - dt);
  p.dodgeCooldown = Math.max(0, p.dodgeCooldown - dt);
  p.attackCooldown = Math.max(0, p.attackCooldown - dt);
  p.useTimer = Math.max(0, p.useTimer - dt);
  if (p.useTimer === 0) p.useItem = null;
  if (p.attackTimer > 0) {
    p.attackTimer = Math.max(0, p.attackTimer - dt);
    const config = ATTACKS[p.attack];
    if (!p.attackHit && p.attackTimer <= config.active) {
      p.attackHit = true;
      hitEnemies(state);
    }
    if (p.attackTimer === 0) p.attack = null;
  }
  p.crouching = Boolean(input.crouch) && !p.attack && p.dodgeTimer <= 0 && state.specialTimer <= 0;
  if (input.dodge && p.dodgeCooldown <= 0 && !p.attack && state.specialTimer <= 0) {
    p.crouching = false;
    p.dodgeTimer = 0.23;
    p.dodgeCooldown = 0.95;
    emit(state, 'dodge');
  }
  if (input.special || state.inputBuffer.special > 0) {
    if (activateSpecial(state)) state.inputBuffer.special = 0;
  }
  if (input.throw || state.inputBuffer.throw > 0) {
    const ready = p.attackCooldown <= 0 && p.dodgeTimer <= 0 && state.specialTimer <= 0;
    if (attack(state, 'throw') || ready) state.inputBuffer.throw = 0;
  }
  else if (input.kick) attack(state, 'kick');
  else if (input.punch) attack(state, 'punch');
  let moveX = Number.isFinite(input.moveX) ? clamp(input.moveX, -1, 1) : Number(Boolean(input.right)) - Number(Boolean(input.left));
  let moveY = Number.isFinite(input.moveY) ? clamp(input.moveY, -1, 1) : Number(Boolean(input.down)) - Number(Boolean(input.up));
  if (moveX && p.attack !== 'throw') p.face = Math.sign(moveX);
  if (p.dodgeTimer > 0 && !moveX && !moveY) moveX = p.face;
  const movement = Math.max(1, Math.hypot(moveX, moveY));
  const stats = getStats(state);
  const speed = stats.speed * (p.dodgeTimer > 0 ? 2.65 : state.specialTimer > 0 ? 0.15 : p.attack === 'throw' ? 0.18 : p.attack ? 0.45 : p.crouching ? 0.5 : 1);
  p.x = clamp(p.x + moveX / movement * speed * dt, 45, WORLD.width - 45);
  p.y = clamp(p.y + moveY / movement * speed * 0.73 * dt, WORLD.minY, WORLD.maxY);
  p.moving = Boolean(moveX || moveY);
  if (p.moving) p.walkTime += dt;
  for (const enemy of state.enemies) updateEnemy(state, enemy, dt, dt * stats.enemyTimeScale);
  state.enemies = state.enemies.filter(enemy => enemy.hp > 0 || enemy.knockedTimer > 0);

  for (const pickup of state.pickups) {
    pickup.life -= dt;
    pickup.bob += dt * 3;
    if (Math.abs(pickup.x - p.x) < 46 && Math.abs(pickup.y - p.y) < 35 && pickup.life > 0) {
      state.inventory[pickup.itemIndex] = Math.min(9, state.inventory[pickup.itemIndex] + 1);
      label(state, `+ ${T(state, 'items')[pickup.itemIndex]}`, p.x, p.y - 170, ITEMS[pickup.itemIndex].color);
      emit(state, 'pickup', { index: pickup.itemIndex });
      pickup.life = 0;
    }
  }
  state.pickups = state.pickups.filter(item => item.life > 0);
  for (const particle of state.particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vy += 160 * dt;
  }
  state.particles = state.particles.filter(particle => particle.life > 0);
  for (const effect of state.impacts) effect.life -= dt;
  state.impacts = state.impacts.filter(effect => effect.life > 0);
  for (const text of state.texts) { text.life -= dt; text.y += text.vy * dt; }
  state.texts = state.texts.filter(text => text.life > 0);
  state.cameraX = clamp(p.x - 360, 0, WORLD.width - 960);
  if (p.hp <= 0) {
    state.mode = 'gameover';
    emit(state, 'gameover');
    return;
  }
  if (state.enemies.length === 0) {
    state.waveDelay += dt;
    if (state.waveDelay >= 1.1) {
      if (state.wave < 3) { state.wave++; spawnWave(state); }
      else {
        state.mode = state.level === LEVELS.length - 1 ? 'victory' : 'levelclear';
        state.score += 500;
        emit(state, state.mode === 'victory' ? 'victory' : 'clear', { level: state.level });
      }
    }
  }
}

export function stepGame(state, dt, input = {}) {
  if (state.mode !== 'playing') { clearInputBuffer(state); return state; }
  if (!Number.isFinite(dt) || dt <= 0) return state;
  // Bounded integration keeps collisions consistent at low frame rates. Long time
  // advances remain useful for headless tests; the browser supplies capped dt.
  let remaining = Math.min(dt, 300);
  while (remaining > 1e-8 && state.mode === 'playing') {
    const slice = Math.min(remaining, 1 / 60);
    updateStep(state, slice, input);
    remaining -= slice;
  }
  return state;
}

export function nextLevel(state) {
  if (state.mode !== 'levelclear' || state.level >= LEVELS.length - 1) return false;
  const next = createGame(state.level + 1, state.locale);
  next.score = state.score;
  next.kills = state.kills;
  next.time = state.time;
  next.rage = state.rage;
  next.player.hp = Math.min(next.player.maxHp, state.player.hp + 30);
  next.inventory = state.inventory.map((count, index) => Math.max(count, BASE_INVENTORY[index]));
  next.buffs = {
    strength: { ...state.buffs.strength }, smoke: { ...state.buffs.smoke }, slim: { ...state.buffs.slim },
  };
  Object.assign(state, next);
  return true;
}
