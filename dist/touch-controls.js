import { getJoystickVector } from './touch-input.js';

const JOYSTICK_RADIUS = 52;
const TAP_DURATION = 90;
const neutral = () => ({ x: 0, y: 0, magnitude: 0 });

/**
 * Attach isolated touch input, without changing simulation or keyboard state.
 *
 * onMove({x,y,magnitude}): x/y are an eight-way unit direction; apply magnitude
 * separately. onAction(action, pressed, sourceId): each pointer has its own
 * source. DOWN is immediate. A normal short UP completes a 90 ms minimum press
 * except for crouch; switching/off-target/cancel/reset never prolong a press.
 * onFirstContact(event) runs synchronously before the canPlay() check, so audio
 * or fullscreen setup does not consume the first input.
 */
export function attachTouchControls({ zone, base, stick, buttons, canPlay = () => true, onMove = () => {}, onAction = () => {}, onFirstContact = () => {} }) {
  if (!zone?.addEventListener || !base?.style || !stick?.style) throw new TypeError('Joystick zone, base and stick elements are required.');
  const document = zone.ownerDocument;
  const window = document?.defaultView || globalThis.window;
  if (!window?.addEventListener) throw new TypeError('Touch controls require an event window.');
  const actionButtons = [...new Set(Array.from(buttons || []))].filter(button => button?.dataset?.control);
  const actionRecords = new Map();
  const listeners = [];
  const now = () => window.performance?.now?.() ?? Date.now();
  const schedule = (fn, duration) => window.setTimeout(fn, duration);
  const unschedule = id => window.clearTimeout(id);
  let joystick = null, destroyed = false, accessibleSequence = 0;

  function listen(target, type, handler, options) {
    if (!target?.addEventListener) return;
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function prevent(event) { if (event.cancelable !== false) event.preventDefault?.(); }
  function primary(event) { return event.pointerId != null && !(event.pointerType === 'mouse' && event.button !== 0); }
  function firstContact(event) {
    // Audio/fullscreen hooks are best effort; neither may swallow game input.
    try { onFirstContact(event); } catch {}
  }
  function capture(target, pointerId) {
    try { target.setPointerCapture?.(pointerId); } catch {}
  }
  function releaseCapture(target, pointerId) {
    try { if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId); } catch {}
  }
  function updateStick(deltaX, deltaY) {
    const distance = Math.hypot(deltaX, deltaY);
    const scale = distance > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / distance : 1;
    stick.style.transform = `translate(-50%, -50%) translate(${deltaX * scale}px, ${deltaY * scale}px)`;
  }
  function placeBase(clientX, clientY) {
    const rect = zone.getBoundingClientRect();
    const inset = JOYSTICK_RADIUS + 8;
    const clampAxis = (value, start, size) => size < inset * 2 ? start + size / 2 : Math.max(start + inset, Math.min(start + size - inset, value));
    base.style.left = `${clampAxis(clientX, rect.left, rect.width)}px`;
    base.style.top = `${clampAxis(clientY, rect.top, rect.height)}px`;
  }
  function endJoystick() {
    if (!joystick) return;
    const previous = joystick;
    joystick = null;
    zone.classList.remove('joystick-active');
    base.hidden = true;
    updateStick(0, 0);
    onMove(neutral());
    releaseCapture(zone, previous.pointerId);
  }
  function setAction(record, button) {
    const next = button?.dataset?.control || null;
    if (record.action === next) return;
    if (record.timer != null) { unschedule(record.timer); record.timer = null; }
    if (record.action) onAction(record.action, false, record.sourceId);
    record.action = next;
    record.button = button || null;
    record.downAt = now();
    if (next) onAction(next, true, record.sourceId);
  }
  function removeAction(pointerId) {
    const record = actionRecords.get(pointerId);
    if (!record) return;
    actionRecords.delete(pointerId);
    if (record.timer != null) unschedule(record.timer);
    if (record.action) onAction(record.action, false, record.sourceId);
    if (typeof pointerId === 'number') releaseCapture(record.captureTarget, pointerId);
  }
  function hitButton(clientX, clientY) {
    if (![clientX, clientY].every(Number.isFinite)) return null;
    if (typeof document?.elementFromPoint === 'function') {
      const element = document.elementFromPoint(clientX, clientY);
      return actionButtons.find(button => !button.disabled && (button === element || button.contains?.(element))) || null;
    }
    return actionButtons.find(button => {
      if (button.disabled) return false;
      const rect = button.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.left + rect.width && clientY >= rect.top && clientY <= rect.top + rect.height;
    }) || null;
  }
  function startJoystick(event) {
    if (destroyed || !primary(event) || actionButtons.some(button => button === event.target || button.contains?.(event.target))) return;
    firstContact(event);
    if (!canPlay() || joystick || ![event.clientX, event.clientY].every(Number.isFinite)) return;
    prevent(event);
    // The input anchor stays at the actual touch even when the visible base is
    // nudged away from a screen edge. Initial contact is therefore always neutral.
    joystick = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    placeBase(event.clientX, event.clientY);
    base.hidden = false;
    zone.classList.add('joystick-active');
    updateStick(0, 0);
    capture(zone, event.pointerId);
    onMove(neutral());
  }
  function startAction(event, button) {
    if (destroyed || !primary(event) || button.disabled) return;
    firstContact(event);
    if (!canPlay()) return;
    prevent(event);
    if (joystick?.pointerId === event.pointerId) endJoystick();
    removeAction(event.pointerId);
    const captureTarget = button.closest?.('.touch-combat') || button;
    const record = { sourceId: `touch:${event.pointerId}`, action: null, button: null, captureTarget, downAt: now(), physical: true, timer: null };
    actionRecords.set(event.pointerId, record);
    capture(captureTarget, event.pointerId);
    setAction(record, button);
  }
  function move(event) {
    if (destroyed) return;
    const ownsJoystick = joystick?.pointerId === event.pointerId;
    const record = actionRecords.get(event.pointerId);
    if (!ownsJoystick && !record?.physical) return;
    if (!canPlay()) { reset(); return; }
    prevent(event);
    if (ownsJoystick) {
      const dx = event.clientX - joystick.x, dy = event.clientY - joystick.y;
      if (![dx, dy].every(Number.isFinite)) return;
      updateStick(dx, dy);
      onMove(getJoystickVector(dx, dy));
    } else setAction(record, hitButton(event.clientX, event.clientY));
  }
  function finish(event) {
    if (destroyed) return;
    if (joystick?.pointerId === event.pointerId) endJoystick();
    const record = actionRecords.get(event.pointerId);
    if (!record) return;
    // Normal UP is followed by implicit lostpointercapture. Do not let that
    // second event cancel the deliberate short-tap completion already scheduled.
    if (event.type === 'lostpointercapture' && !record.physical) return;
    if (event.type === 'pointerup' && record.physical && record.action && record.action !== 'crouch' && canPlay()) {
      const remainder = TAP_DURATION - (now() - record.downAt);
      record.physical = false;
      if (remainder > 0) {
        record.timer = schedule(() => removeAction(event.pointerId), remainder);
        return;
      }
    }
    removeAction(event.pointerId);
  }
  function accessibleClick(event, button) {
    if (destroyed || event.detail !== 0 || button.disabled) return;
    firstContact(event);
    if (!canPlay()) return;
    const token = Symbol('accessible-touch-action');
    const record = { sourceId: `touch:accessible:${++accessibleSequence}`, action: null, button: null, captureTarget: null, downAt: now(), physical: false, timer: null };
    actionRecords.set(token, record);
    setAction(record, button);
    record.timer = schedule(() => removeAction(token), TAP_DURATION);
  }
  function reset() {
    endJoystick();
    for (const pointerId of [...actionRecords.keys()]) removeAction(pointerId);
    zone.classList.remove('joystick-active');
    base.hidden = true;
    updateStick(0, 0);
  }
  function destroy() {
    if (destroyed) return;
    reset();
    destroyed = true;
    for (const remove of listeners.splice(0)) remove();
  }

  base.hidden = true;
  base.style.position = 'fixed';
  base.style.transform = 'translate(-50%, -50%)';
  stick.style.position = 'absolute';
  stick.style.left = stick.style.top = '50%';
  updateStick(0, 0);
  listen(zone, 'pointerdown', startJoystick, { passive: false });
  listen(zone, 'contextmenu', prevent);
  for (const button of actionButtons) {
    listen(button, 'pointerdown', event => startAction(event, button), { passive: false });
    listen(button, 'click', event => accessibleClick(event, button));
    listen(button, 'contextmenu', prevent);
  }
  listen(window, 'pointermove', move, { capture: true, passive: false });
  listen(window, 'pointerup', finish, true);
  listen(window, 'pointercancel', finish, true);
  listen(window, 'lostpointercapture', finish, true);
  listen(window, 'blur', reset);
  listen(document, 'visibilitychange', () => { if (document.hidden) reset(); });
  return { reset, destroy };
}
