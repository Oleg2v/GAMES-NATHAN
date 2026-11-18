// Keep viewport geometry and delayed resume independent from combat simulation.
export function readViewport(viewport, fallbackWidth, fallbackHeight) {
 const valid = n => Number.isFinite(n) && n > 0;
 const width = valid(viewport?.width) ? viewport.width : fallbackWidth;
 const height = valid(viewport?.height) ? viewport.height : fallbackHeight;
 return { width, height, left:Math.max(0, viewport?.offsetLeft || 0), top:Math.max(0, viewport?.offsetTop || 0), landscape:width > height };
}

export function createResumeCountdown({ canResume, onTick, onFinish, onCancel = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
 let timer = null, generation = 0, active = false;
 function cancel() {
  generation++; if (timer !== null) clearTimer(timer); timer = null;
  const wasActive = active; active = false; if (wasActive) onCancel();
 }
 function start() {
  if (active || !canResume()) return;
  active = true; const current = ++generation;
  function tick(remaining) {
   if (current !== generation || !active) return;
   if (!canResume()) { cancel(); return; }
   if (remaining === 0) { active = false; timer = null; onFinish(); return; }
   onTick(remaining); timer = setTimer(() => tick(remaining - 1), 1000);
  }
  tick(3);
 }
 return { start, cancel, get active() { return active; } };
}
