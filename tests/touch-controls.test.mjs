import test from 'node:test';
import assert from 'node:assert/strict';
import { attachTouchControls } from '../dist/touch-controls.js';

class Events {
  listeners = new Map();
  addEventListener(type, handler) { const list = this.listeners.get(type) || []; list.push(handler); this.listeners.set(type, list); }
  removeEventListener(type, handler) { this.listeners.set(type, (this.listeners.get(type) || []).filter(value => value !== handler)); }
  emit(type, values = {}) {
    const event = { type, pointerType: 'touch', button: 0, cancelable: true, target: this, preventDefault() { this.prevented = true; }, ...values };
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
    return event;
  }
}
class ClockWindow extends Events {
  time = 0; timers = new Map(); sequence = 0;
  performance = { now: () => this.time };
  setTimeout(callback, delay) { const id = ++this.sequence; this.timers.set(id, { at: this.time + delay, callback }); return id; }
  clearTimeout(id) { this.timers.delete(id); }
  advance(ms) {
    const end = this.time + ms;
    while (true) {
      const next = [...this.timers.entries()].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.time = next[1].at; this.timers.delete(next[0]); next[1].callback();
    }
    this.time = end;
  }
}
class Element extends Events {
  constructor(document, rect, action, parent = null) {
    super(); this.ownerDocument = document; this.rect = rect; this.dataset = action ? { control: action } : {}; this.parentElement = parent;
    this.style = {}; this.hidden = false; this.disabled = false; this.captures = new Set(); this.classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)), toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name), contains: name => this.classes.has(name) };
  }
  getBoundingClientRect() { return this.rect; }
  contains(element) { for (let current = element; current; current = current.parentElement) if (current === this) return true; return false; }
  closest(selector) { if (selector === '.touch-combat' && this.classes.has('touch-combat')) return this; return this.parentElement?.closest(selector) || null; }
  setPointerCapture(id) { this.captures.add(id); }
  hasPointerCapture(id) { return this.captures.has(id); }
  releasePointerCapture(id) { if (this.captures.delete(id)) this.ownerDocument.defaultView.emit('lostpointercapture', { pointerId: id, target: this }); }
}
function setup(initialPlaying = true, contactHook) {
  const window = new ClockWindow(), document = new Events();
  document.defaultView = window; document.hidden = false;
  const zone = new Element(document, { left: 0, top: 0, width: 400, height: 400 });
  const base = new Element(document, { left: 0, top: 0, width: 104, height: 104 }, null, zone);
  const stick = new Element(document, { left: 0, top: 0, width: 44, height: 44 }, null, base);
  const combat = new Element(document, { left: 580, top: 80, width: 200, height: 170 }); combat.classList.add('touch-combat');
  const punch = new Element(document, { left: 600, top: 100, width: 60, height: 60 }, 'punch', combat);
  const kick = new Element(document, { left: 680, top: 100, width: 60, height: 60 }, 'kick', combat);
  const special = new Element(document, { left: 600, top: 180, width: 60, height: 60 }, 'special', combat);
  const crouch = new Element(document, { left: 20, top: 30, width: 70, height: 40 }, 'crouch');
  const buttons = [punch, kick, special, crouch], actions = [], moves = [], active = new Map(), contacts = [];
  let playing = initialPlaying;
  document.elementFromPoint = (x, y) => buttons.find(button => x >= button.rect.left && x <= button.rect.left + button.rect.width && y >= button.rect.top && y <= button.rect.top + button.rect.height) || zone;
  const api = attachTouchControls({ zone, base, stick, buttons, canPlay: () => playing,
    onMove: vector => moves.push(vector),
    onAction: (action, pressed, sourceId) => { actions.push({ action, pressed, sourceId }); if (pressed) active.set(sourceId, action); else active.delete(sourceId); },
    onFirstContact: event => { contacts.push(event.type); if (contactHook) playing = contactHook(playing); },
  });
  return { api, window, document, zone, base, stick, combat, punch, kick, special, crouch, buttons, actions, moves, active, contacts, setPlaying: value => { playing = value; } };
}
const down = (element, pointerId, x, y) => element.emit('pointerdown', { pointerId, clientX: x, clientY: y });
const move = (game, pointerId, x, y) => game.window.emit('pointermove', { pointerId, clientX: x, clientY: y });
const up = (game, pointerId) => game.window.emit('pointerup', { pointerId });

test('first joystick contact is neutral and the same contact immediately accepts a drag', () => {
  const game = setup(false, () => true);
  down(game.zone, 1, 4, 395);
  assert.equal(game.contacts.length, 1);
  assert.equal(game.base.hidden, false);
  assert.deepEqual(game.moves.at(-1), { x: 0, y: 0, magnitude: 0 });
  assert.equal(game.base.style.left, '60px');
  assert.equal(game.base.style.top, '340px');
  move(game, 1, 35, 395);
  assert.deepEqual(game.moves.at(-1), { x: 1, y: 0, magnitude: 0.5 });
  up(game, 1);
  assert.deepEqual(game.moves.at(-1), { x: 0, y: 0, magnitude: 0 });
  assert.equal(game.base.hidden, true);
});

test('one joystick pointer and two action fingers remain independent', () => {
  const game = setup();
  down(game.zone, 1, 150, 250); move(game, 1, 202, 250);
  down(game.zone, 4, 220, 220); move(game, 4, 150, 220);
  assert.equal(game.moves.at(-1).x, 1);
  down(game.punch, 2, 620, 120); down(game.kick, 3, 700, 120);
  assert.equal(game.active.size, 2);
  game.window.advance(100); up(game, 2);
  assert.deepEqual([...game.active.values()], ['kick']);
  assert.equal(game.moves.at(-1).magnitude, 1);
  up(game, 1);
  assert.deepEqual([...game.active.values()], ['kick']);
  up(game, 3);
  assert.equal(game.active.size, 0);
});

test('action pointer slides across buttons with immediate release and re-press using the same source', () => {
  const game = setup();
  down(game.punch, 2, 620, 120);
  assert.deepEqual(game.actions, [{ action: 'punch', pressed: true, sourceId: 'touch:2' }]);
  assert.equal(game.combat.hasPointerCapture(2), true);
  move(game, 2, 700, 120);
  assert.deepEqual(game.actions.slice(-2), [
    { action: 'punch', pressed: false, sourceId: 'touch:2' },
    { action: 'kick', pressed: true, sourceId: 'touch:2' },
  ]);
  move(game, 2, 500, 300);
  assert.equal(game.active.size, 0);
  move(game, 2, 45, 45);
  assert.deepEqual([...game.active.values()], ['crouch']);
  up(game, 2);
  assert.equal(game.active.size, 0);
});

test('short normal taps activate on down and last ninety milliseconds, while cancel never lingers', () => {
  const game = setup(false, () => true);
  down(game.punch, 2, 620, 120);
  assert.equal(game.active.get('touch:2'), 'punch');
  game.window.advance(10); up(game, 2);
  game.combat.releasePointerCapture(2);
  assert.equal(game.active.get('touch:2'), 'punch');
  game.window.advance(79); assert.equal(game.active.size, 1);
  game.window.advance(1); assert.equal(game.active.size, 0);
  down(game.kick, 3, 700, 120);
  game.window.emit('pointercancel', { pointerId: 3 });
  assert.equal(game.active.size, 0);
  game.window.advance(100); assert.equal(game.active.size, 0);
});

test('same action can be held by two sources without one release clearing the other', () => {
  const game = setup();
  down(game.punch, 2, 620, 120); down(game.punch, 3, 625, 125);
  game.window.advance(100); up(game, 2);
  assert.equal(game.active.get('touch:3'), 'punch');
  assert.equal(game.active.size, 1);
  up(game, 3);
  assert.equal(game.active.size, 0);
});

test('crouch never lingers and action capture loss cancels an active hold', () => {
  const game = setup();
  down(game.crouch, 2, 45, 45); up(game, 2);
  assert.equal(game.active.size, 0);
  down(game.punch, 3, 620, 120);
  game.combat.releasePointerCapture(3);
  assert.equal(game.active.size, 0);
});

test('reset, backgrounding and destroy clear pointers, pending taps and callbacks', () => {
  const game = setup();
  down(game.zone, 1, 150, 250); move(game, 1, 180, 220);
  down(game.punch, 2, 620, 120); game.window.advance(5); up(game, 2);
  game.api.reset();
  assert.equal(game.active.size, 0); assert.equal(game.base.hidden, true); assert.equal(game.window.timers.size, 0);
  assert.deepEqual(game.moves.at(-1), { x: 0, y: 0, magnitude: 0 });
  down(game.kick, 3, 700, 120); game.document.hidden = true; game.document.emit('visibilitychange');
  assert.equal(game.active.size, 0);
  down(game.punch, 4, 620, 120); game.window.emit('blur');
  assert.equal(game.active.size, 0);
  game.api.destroy();
  const count = game.actions.length;
  down(game.punch, 5, 620, 120); game.window.advance(200);
  assert.equal(game.actions.length, count);
});

test('disabled buttons, stopped play and non-primary mouse buttons never activate input', () => {
  const game = setup();
  game.special.disabled = true;
  down(game.special, 2, 620, 200);
  game.punch.emit('pointerdown', { pointerId: 3, clientX: 620, clientY: 120, pointerType: 'mouse', button: 2 });
  assert.equal(game.active.size, 0);
  down(game.punch, 4, 620, 120); game.setPlaying(false); move(game, 4, 700, 120);
  assert.equal(game.active.size, 0);
  down(game.zone, 5, 100, 100);
  assert.equal(game.base.hidden, true);
});

test('keyboard activation of a screen button produces an independent accessible tap', () => {
  const game = setup();
  game.punch.emit('click', { detail: 0 });
  assert.equal(game.active.size, 1);
  down(game.punch, 2, 620, 120);
  game.window.advance(90);
  assert.equal(game.active.get('touch:2'), 'punch');
  up(game, 2); assert.equal(game.active.size, 0);
});
