import { LEVELS, ITEMS, createGame, stepGame, useItem, nextLevel, getStats, setLocale, clearInputBuffer } from './game-core.js';
import { createRenderer } from './renderer.js';
import { LOCALES, getCopy, translate } from './i18n.js';

const $ = id => document.getElementById(id);
const canvas = $('game'), input = {}, assets = {};
const stageButtons = [...document.querySelectorAll('[data-level]')];
const touchButtons = [...document.querySelectorAll('[data-control]')];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let state = null, selectedLevel = 0, locale = 'ru', renderer, last = 0, lastHud = 0;
let ready = false, loadFailed = false, chosenStage = false, soundEnabled = false, audioContext, masterGain, record = 0, activeDialog = '', toastTimer = 0, toastKind = '', currentFps = 60;
try {
 const savedLocale = localStorage.getItem('nathan-language');
 if (LOCALES.includes(savedLocale)) locale = savedLocale;
 record = Math.max(0, Number(localStorage.getItem('nathan-record')) || 0);
 soundEnabled = localStorage.getItem('nathan-sound') === '1';
} catch {}
const t = (key, values) => translate(locale, key, values);
const bidi = text => locale === 'he' ? String(text).replace(/(?:[+×]?\d+(?:[.,]\d+)?(?:\s*[\/–-]\s*\d+)?|[A-Za-z]+(?:\s*[\/+]\s*[A-Za-z]+)*)/g, value => '\u2066' + value + '\u2069') : text;
const copy = () => getCopy(locale);
const formatNumber = n => Number(n).toLocaleString({ ru:'ru-RU', en:'en-US', he:'he-IL' }[locale]);
const arrow = () => '<span aria-hidden="true">' + (locale === 'he' ? '←' : '→') + '</span>';
const iconPaths = [
 '<path fill="currentColor" d="M6 4h14v4h4v20h-4v4H6v-4H2V8h4z"/><path fill="#d9e8df" d="M6 4h14v4h4v9H2V8h4z"/><path fill="#15232a" d="M9 20h8v3H9z"/>',
 '<path fill="currentColor" d="M6 4h14v4h4v20h-4v4H6v-4H2V8h4z"/><path fill="#e8dfef" d="M6 4h14v4h4v9H2V8h4z"/><path fill="#221d2c" d="M8 20h10v3H8z"/>',
 '<path fill="#dbe0d6" d="M2 22h20v7H2z"/><path fill="#d2995e" d="M2 22h7v7H2z"/><path fill="#ed9253" d="M22 22h4v7h-4z"/><path fill="currentColor" d="M18 6h3v6h-3zm3 6h3v5h-3zm-5-12h3v5h-3z"/>',
 '<path fill="currentColor" d="M9 4h10v21H9zM7 5h14v4H7z"/><path fill="#e0efdd" d="M12 25h4v8h-4zM12 0h4v4h-4z"/><path fill="#204543" d="M10 12h8v3h-8zM10 19h5v2h-5z"/>',
 '<path fill="#dfb87b" d="M3 7h21v6h-2v9h-3v11H8V22H5V13H3z"/><path fill="#e3e3d1" d="M6 18h15v7h-2v8H8v-8H6z"/><path fill="#718849" d="M3 6h21v5H3z"/><path fill="#b75e40" d="M6 3h5v6H6zm10 1h5v7h-5z"/>'
];
$('items').innerHTML = ITEMS.map((item, i) => `<button class="item" style="--item-color:${item.color}" data-item="${i}" disabled><span class="item-key" dir="ltr">[${item.key}]</span><span class="item-icon" aria-hidden="true"><svg viewBox="0 0 28 36">${iconPaths[i]}</svg></span><span class="item-info"><span class="item-name"></span><span class="item-effect"></span><span class="item-count"></span></span></button>`).join('');
const itemButtons = [...document.querySelectorAll('[data-item]')];

function clearInput() {
 for (const key in input) delete input[key];
 if (state) clearInputBuffer(state);
 document.querySelectorAll('.pressed').forEach(el => el.classList.remove('pressed'));
}
function announce(text) { $('announcement').textContent = text; }
function updateRecord() { $('record').innerHTML = `${t('record')} <b dir="ltr">${String(record).padStart(6, '0')}</b>`; }
function syncAudioGain() {
 if (masterGain && audioContext) masterGain.gain.setTargetAtTime(soundEnabled && state?.mode !== 'paused' ? 0.7 : 0, audioContext.currentTime, .012);
}
function ensureAudio() {
 if (!soundEnabled) return false;
 try {
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  if (!masterGain) { masterGain = audioContext.createGain(); masterGain.connect(audioContext.destination); }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  syncAudioGain();
  return true;
 } catch { return false; }
}
function beep(type) {
 if (!soundEnabled || state?.mode === 'paused' || !ensureAudio()) return;
 const time = audioContext.currentTime;
 function tone(start, end, duration, volume = .055, shape = 'sine', delay = 0) {
  const osc = audioContext.createOscillator(), gain = audioContext.createGain(), at = time + delay;
  osc.type = shape; osc.connect(gain); gain.connect(masterGain);
  osc.frequency.setValueAtTime(start, at); osc.frequency.exponentialRampToValueAtTime(Math.max(15, end), at + duration);
  gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .004);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  osc.start(at); osc.stop(at + duration + .01);
 }
 function noise(duration, volume, frequency = 1600, delay = 0) {
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
  const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain(), at = time + delay;
  source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
  source.connect(filter); filter.connect(gain); gain.connect(masterGain);
  gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  source.start(at); source.stop(at + duration);
 }
 const heavy = ['finisher', 'special', 'throw-hit', 'throw-impact', 'land'].includes(type);
 if (heavy) { noise(.15, .19, 2400); tone(125, 27, .28, .21); tone(58, 24, .3, .12, 'triangle', .02); return; }
 if (type === 'hit') { noise(.09, .15, 2600); tone(155, 39, .15, .13); return; }
 if (type === 'throw') { noise(.13, .085, 1100); tone(170, 45, .18, .085); return; }
 if (type === 'punch' || type === 'kick') { noise(type === 'kick' ? .1 : .065, .045, 850); tone(type === 'kick' ? 115 : 155, 43, .09, .04); return; }
 if (type === 'hurt') { noise(.08, .09, 700); tone(80, 26, .17, .11); return; }
 const tones = { powerup:[320,850,.23], heal:[480,720,.2], pickup:[700,1000,.09], clear:[460,920,.4], victory:[520,1040,.6], gameover:[150,45,.6], dodge:[120,200,.06], wave:[250,420,.15], 'throw-miss':[130,90,.06], 'rage-ready':[700,1100,.25] };
 if (tones[type]) { const [a, b, d] = tones[type]; tone(a, b, d, .035, 'triangle'); if (['clear','victory','powerup'].includes(type)) tone(a * 1.5, b * 1.5, d, .02, 'sine', .08); }
}
function updateSoundLabel() {
 $('sound-value').textContent = t(soundEnabled ? 'soundOn' : 'soundOff');
 $('sound').setAttribute('aria-pressed', String(soundEnabled));
 $('sound').setAttribute('aria-label', t(soundEnabled ? 'soundDisable' : 'soundEnable'));
}
function setLocation() {
 const level = state ? state.level : selectedLevel;
 $('top-location').textContent = `0${level + 1} — ${copy().levels[level].name}`;
 stageButtons.forEach((button, i) => {
  const stage = copy().levels[i];
  button.classList.toggle('active', i === level); button.setAttribute('aria-pressed', String(i === level)); button.disabled = !!state;
  button.querySelector('.stage-label b').textContent = stage.name; button.querySelector('.stage-label small').textContent = stage.subtitle;
  button.setAttribute('aria-label', t('stageAria', { number:i + 1, ...stage }));
 });
}
function updateStart() {
 $('start').innerHTML = (ready ? chosenStage ? t('startLevel', { level:copy().levels[selectedLevel].name }) : t('start') : t('loading')) + arrow();
 $('load-status').textContent = bidi(t(loadFailed ? 'loadFailed' : ready ? 'startHint' : 'prepare'));
}
function updateItems() {
 itemButtons.forEach((button, i) => {
  const item = copy().items[i];
  button.querySelector('.item-name').textContent = bidi(item.name);
  button.querySelector('.item-effect').textContent = bidi(item.effect);
  button.querySelector('.item-count').textContent = bidi(state ? t('inPocket', { count:state.inventory[i] }) : t(i === 4 ? 'instant' : 'oneTwenty'));
  button.title = item.description; button.setAttribute('aria-label', t('itemAria', { ...item, key:ITEMS[i].key }));
  button.disabled = !state || state.mode !== 'playing' || state.inventory[i] <= 0;
 });
}
function updateTouch() {
 touchButtons.forEach(button => {
  const action = button.dataset.control;
  button.disabled = state?.mode !== 'playing' || (action === 'special' && state.rage < 100);
  button.classList.toggle('ready', action === 'special' && state?.rage >= 100);
  if (action === 'special') button.setAttribute('aria-label', t(state?.rage >= 100 ? 'specialReady' : 'specialNotReady', { rage:Math.floor(state?.rage || 0) }));
  else button.setAttribute('aria-label', t(action));
 });
}
function updateMeta() { document.querySelector('.cabinet-meta').innerHTML = `${t('fps', { fps:currentFps })} <i aria-hidden="true">●</i> ${t('localArcade')}`; }
function applyLocale(next) {
 locale = LOCALES.includes(next) ? next : 'ru';
 try { localStorage.setItem('nathan-language', locale); } catch {}
 document.documentElement.lang = locale; document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
 document.title = t('pageTitle'); document.querySelector('meta[name="description"]').content = t('description');
 document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = bidi(t(el.dataset.i18n)); });
 document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
 document.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
 document.querySelectorAll('[data-i18n-alt]').forEach(el => el.alt = t(el.dataset.i18nAlt));
 document.querySelectorAll('[data-locale]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.locale === locale)));
 clearInput(); if (state) setLocale(state, locale);
 updateRecord(); updateSoundLabel(); setLocation(); updateStart(); updateItems(); updateTouch(); updateMeta();
 if (state) { updateHud(); if (activeDialog) showDialog(activeDialog, false); if (toastTimer > 0) renderToast(); }
 else $('arena-status').textContent = t('arenaMenu');
}
function renderToast() { $('level-toast').textContent = toastKind === 'wave' ? t('wave', { wave:state.wave }) : `0${state.level + 1} / ${copy().levels[state.level].name}`; }
function showToast(kind = 'level') { toastKind = kind; toastTimer = 2; renderToast(); announce($('level-toast').textContent); }
function saveRecord() { if (state && state.score > record) { record = state.score; try { localStorage.setItem('nathan-record', String(record)); } catch {} updateRecord(); } }
function startGame() {
 if (!ready) return;
 saveRecord(); state = createGame(selectedLevel, locale); state.reducedMotion = reduced; clearInput(); ensureAudio();
 $('screen').classList.add('in-game'); $('menu').hidden = true; $('dialog').hidden = true; $('hud').hidden = false; $('pause').disabled = false; activeDialog = '';
 setLocation(); showToast(); canvas.focus({ preventScroll:true }); updateHud();
}
function menu() {
 saveRecord(); clearInput(); state = null; $('screen').classList.remove('in-game'); $('menu').hidden = false; $('dialog').hidden = true; $('hud').hidden = true; $('pause').disabled = true; activeDialog = '';
 setLocation(); updateStart(); updateItems(); updateTouch(); syncAudioGain(); $('arena-status').textContent = t('arenaMenu'); $('start').focus({ preventScroll:true });
}
function showDialog(mode, focus = true) {
 if (!state) return;
 activeDialog = mode; clearInput(); $('dialog').hidden = false;
 const values = { score:formatNumber(state.score), kills:state.kills, next:copy().levels[state.level + 1]?.name || '' };
 $('dialog-kicker').textContent = t(mode + 'Kicker'); $('dialog-title').textContent = t(mode + 'Title'); $('dialog-text').textContent = bidi(t(mode + 'Text', values));
 $('dialog-primary').innerHTML = t(mode + 'Button') + arrow();
 announce($('dialog-title').textContent + ' ' + $('dialog-text').textContent); updateTouch(); updateItems();
 if (focus) $('dialog-primary').focus({ preventScroll:true });
 if (mode !== 'paused') saveRecord(); syncAudioGain();
}
function pause() { if (state?.mode === 'playing') { state.mode = 'paused'; showDialog('paused'); } else if (state?.mode === 'paused') resume(); }
function resume() { if (state?.mode !== 'paused') return; clearInput(); state.mode = 'playing'; activeDialog = ''; $('dialog').hidden = true; syncAudioGain(); updateTouch(); updateItems(); canvas.focus({ preventScroll:true }); }
function activateItem(i) { if (state?.mode !== 'playing') return; useItem(state, i); updateHud(); canvas.focus({ preventScroll:true }); }
function updateHud() {
 if (!state) return;
 const p = state.player, stats = getStats(state), rage = Math.max(0, Math.min(100, Math.floor(state.rage || 0)));
 $('hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`; $('hp-bar').style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`; $('hp-bar').style.background = p.hp < 35 ? '#ed7355' : '#cedb8d';
 $('health-meter').setAttribute('aria-valuenow', String(Math.ceil(p.hp))); $('health-meter').setAttribute('aria-valuemax', String(p.maxHp)); $('health-meter').setAttribute('aria-valuetext', t('healthStatus', { hp:Math.ceil(p.hp), max:p.maxHp }));
 $('rage-bar').style.width = `${rage}%`; $('rage-meter').setAttribute('aria-valuenow', String(rage)); $('rage-meter').classList.toggle('full', rage >= 100); $('rage-label').textContent = t(rage >= 100 ? 'rageReady' : 'rage'); $('rage-text').textContent = `${rage} / 100`;
 $('score').textContent = String(state.score).padStart(6, '0'); $('wave').textContent = t('wave', { wave:state.wave }); $('enemies').textContent = t('enemies', { count:state.enemies.filter(e => e.hp > 0).length });
 const tags = [], seconds = n => bidi(t('seconds', { n:Math.ceil(n) }));
 if (state.buffs.strength.remaining > 0) tags.push(`<span class="buff-tag" style="color:#b6a1ff">${t('force')} <bdi dir="ltr">+${state.buffs.strength.amount}</bdi> · ${seconds(state.buffs.strength.remaining)}</span>`);
 if (state.buffs.smoke.remaining > 0) tags.push(`<span class="buff-tag" style="color:#bde6a1">${t('slowmo')} · ${seconds(state.buffs.smoke.remaining)}</span>`);
 if (state.buffs.slim.remaining > 0) tags.push(`<span class="buff-tag" style="color:#66e1d6">${t('speed')} · ${seconds(state.buffs.slim.remaining)}</span>`);
 $('buffs').innerHTML = tags.join(''); $('combo').hidden = state.combo < 2;
 if (state.combo >= 2) $('combo').innerHTML = `<bdi>${state.combo}×</bdi><small>${t('combo')}</small>`;
 updateItems(); updateTouch(); $('arena-status').textContent = bidi(t('arenaRun', { level:copy().levels[state.level].name, damage:Math.round(stats.damage), weight:t(stats.slim ? 'light' : 'heavy') }));
}
$('start').addEventListener('click', startGame); $('pause').addEventListener('click', pause); $('dialog-secondary').addEventListener('click', menu);
$('dialog-primary').addEventListener('click', () => {
 if (!state) return;
 if (activeDialog === 'paused') resume();
 else if (activeDialog === 'levelclear') { clearInput(); nextLevel(state); $('dialog').hidden = true; activeDialog = ''; setLocation(); showToast(); updateHud(); canvas.focus({ preventScroll:true }); }
 else { selectedLevel = activeDialog === 'victory' ? 0 : state.level; startGame(); }
});
stageButtons.forEach(button => button.addEventListener('click', () => { if (!state) { selectedLevel = Number(button.dataset.level); chosenStage = true; setLocation(); updateStart(); } }));
itemButtons.forEach((button, i) => button.addEventListener('click', () => activateItem(i)));
document.querySelectorAll('[data-locale]').forEach(button => button.addEventListener('click', () => applyLocale(button.dataset.locale)));
$('sound').addEventListener('click', () => { soundEnabled = !soundEnabled; try { localStorage.setItem('nathan-sound', soundEnabled ? '1' : '0'); } catch {} updateSoundLabel(); syncAudioGain(); if (soundEnabled) beep('pickup'); });
$('fullscreen').addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else { const target = matchMedia('(pointer:coarse)').matches ? document.documentElement : document.querySelector('.cabinet'); await target.requestFullscreen(); } } catch { announce(t('fullscreenError')); } });

const keyMap = { KeyW:'up', ArrowUp:'up', KeyS:'down', ArrowDown:'down', KeyA:'left', ArrowLeft:'left', KeyD:'right', ArrowRight:'right', KeyJ:'punch', KeyK:'kick', KeyE:'throw', KeyL:'throw', KeyQ:'special', KeyC:'crouch', Space:'dodge' };
window.addEventListener('keydown', event => {
 if (event.code === 'Tab' && activeDialog) {
  const controls = [$('dialog-primary'), $('dialog-secondary')], index = controls.indexOf(document.activeElement);
  event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus(); return;
 }
 if (event.code === 'Escape' || event.code === 'KeyP') { if (state) { event.preventDefault(); if (!event.repeat) pause(); } return; }
 if (!state) { if (event.code === 'Enter' && document.activeElement === canvas) startGame(); return; }
 if (state.mode !== 'playing') return;
 if (keyMap[event.code]) { event.preventDefault(); input[keyMap[event.code]] = true; }
 const item = /^Digit([1-5])$/.exec(event.code); if (item && !event.repeat) { event.preventDefault(); activateItem(Number(item[1]) - 1); }
});
window.addEventListener('keyup', event => { if (keyMap[event.code]) { delete input[keyMap[event.code]]; if (state) event.preventDefault(); } });
window.addEventListener('blur', () => { clearInput(); if (state?.mode === 'playing') pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { clearInput(); if (state?.mode === 'playing') pause(); } });
for (const button of touchButtons) {
 const release = () => { delete input[button.dataset.control]; button.classList.remove('pressed'); };
 button.addEventListener('pointerdown', event => { event.preventDefault(); if (button.disabled || state?.mode !== 'playing') return; button.setPointerCapture(event.pointerId); input[button.dataset.control] = true; button.classList.add('pressed'); });
 button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
 button.addEventListener('click', event => { if (event.detail === 0 && !button.disabled && state?.mode === 'playing') { input[button.dataset.control] = true; setTimeout(release, 100); } });
}
canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll:true }));
function loadImage(src) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(src)); image.src = src; }); }
async function loadAtlas(src) { const response = await fetch(src); if (!response.ok) throw new Error(src); return response.json(); }
async function boot() {
 try {
  const [hero, concept, atlas, enemies, enemyAtlas, throws, throwAtlas, crouch, crouchAtlas] = await Promise.all([
   loadImage('./assets/nathan-sprites-v2.png'), loadImage('./assets/nathan-concept.png'), loadAtlas('./assets/nathan-atlas.json'),
   loadImage('./assets/enemy-sprites.png'), loadAtlas('./assets/enemy-atlas.json'), loadImage('./assets/nathan-throws.png'), loadAtlas('./assets/nathan-throws-atlas.json'),
   loadImage('./assets/nathan-crouch.png'), loadAtlas('./assets/nathan-crouch-atlas.json')
  ]);
  Object.assign(assets, { hero, concept, atlas, enemies, enemyAtlas, throws, throwAtlas, crouch, crouchAtlas });
 } catch (error) { loadFailed = true; updateStart(); console.error('Character assets failed', error); return; }
 renderer = createRenderer(canvas, assets); ready = true; $('start').disabled = false; updateStart(); setLocation(); requestAnimationFrame(frame);
}
let fpsTime = 0, fpsCount = 0;
function frame(now) {
 const dt = Math.min((now - last) / 1000 || 0, .05); last = now;
 if (state) {
  const previousMode = state.mode; stepGame(state, dt, input);
  for (const event of state.events.splice(0)) { beep(event.type); if (event.type === 'wave') showToast('wave'); }
  renderer.render(state, dt);
  if (state.mode !== previousMode && ['levelclear', 'victory', 'gameover'].includes(state.mode)) showDialog(state.mode);
  if (state.mode === 'playing' && toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('level-toast').textContent = ''; }
  if (now - lastHud > 80) { updateHud(); lastHud = now; }
 } else renderer.drawMenu(selectedLevel, locale);
 fpsTime += dt; fpsCount++;
 if (fpsTime > 1) { currentFps = Math.min(60, Math.round(fpsCount / fpsTime)); updateMeta(); fpsTime = 0; fpsCount = 0; }
 requestAnimationFrame(frame);
}
applyLocale(locale);
boot();
