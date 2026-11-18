import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { DEFAULT_DIST, CACHE_PREFIX, collectAssets, generateServiceWorker, buildServiceWorker } from '../scripts/build-sw.mjs';

const ORIGIN = 'https://nathan.example';
const key = request => new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nathan-pwa-test-'));
  t.after(async () => {
    assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'nathan-pwa-test-'));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'assets', 'fonts'), { recursive: true });
  const files = new Map([
    ['/index.html', Buffer.from('<!doctype html><title>Nathan release one</title>')],
    ['/app.js', Buffer.from('export const release = "one";')],
    ['/assets/atlas.json', Buffer.from('{"frames":[1,2,3]}')],
    ['/assets/sprite.png', Buffer.from([137,80,78,71,13,10,26,10,1,2,3])],
    ['/assets/fonts/game.woff2', Buffer.from('wOF2test-font-bytes')],
  ]);
  for (const [url, bytes] of files) await writeFile(path.join(root, url.slice(1)), bytes);
  const generated = await generateServiceWorker(root);
  return { root, files, generated };
}

function workerHarness(generated, initialFiles, options = {}) {
  const handlers = new Map(), stores = new Map(), files = new Map(initialFiles);
  const fetches = [], deleted = [], lifecycle = { claimed: 0, skipped: 0 };
  let online = true;
  class MemoryCache {
    constructor(name) { this.name = name; this.responses = new Map(); }
    async match(request) { return this.responses.get(key(request))?.clone(); }
    async put(request, response) {
      if (options.failMarker && key(request).endsWith('/__nathan_offline_complete__')) throw new Error('Quota exceeded');
      this.responses.set(key(request), response.clone());
    }
    async delete(request) { return this.responses.delete(key(request)); }
    async keys() { return [...this.responses.keys()].map(url => new Request(url)); }
  }
  const cacheStorage = {
    async open(name) { if (!stores.has(name)) stores.set(name, new MemoryCache(name)); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  async function network(request) {
    const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN);
    fetches.push(url.pathname);
    if (!online) throw new TypeError('Offline');
    const body = files.get(url.pathname);
    if (!body) return new Response('Not found', { status: 404 });
    const extension = path.extname(url.pathname);
    const mime = options.htmlWorker && url.pathname === '/sw.js' ? 'text/html' :
      extension === '.js' ? 'application/javascript' : extension === '.html' ? 'text/html' :
      extension === '.json' ? 'application/json' : extension === '.woff2' ? 'font/woff2' : 'image/png';
    return new Response(body, { headers: { 'Content-Type': mime } });
  }
  const self = {
    location: { origin: ORIGIN },
    addEventListener(type, handler) { handlers.set(type, handler); },
    clients: { async claim() { lifecycle.claimed++; } },
    async skipWaiting() { lifecycle.skipped++; },
  };
  vm.runInNewContext(generated.source, { self, caches: cacheStorage, fetch: network,
    Request, Response, URL, Uint8Array, crypto: webcrypto, console }, { filename: 'sw.js' });
  async function lifecycleEvent(type) {
    const promises = [];
    handlers.get(type)({ waitUntil(promise) { promises.push(promise); } });
    await Promise.all(promises);
  }
  async function fetchEvent(url, { mode = 'cors', method = 'GET' } = {}) {
    let response;
    handlers.get('fetch')({ request: { url: key(url), mode, method }, respondWith(value) { response = Promise.resolve(value); } });
    return response;
  }
  async function status() {
    let result;
    const promises = [];
    handlers.get('message')({ data: { type: 'NATHAN_PWA_STATUS' },
      ports: [{ postMessage(value) { result = value; } }], waitUntil(promise) { promises.push(promise); } });
    await Promise.all(promises);
    return result;
  }
  return { install: () => lifecycleEvent('install'), activate: () => lifecycleEvent('activate'),
    fetch: fetchEvent, status, stores, files, fetches, deleted, lifecycle, caches: cacheStorage,
    offline() { online = false; }, online() { online = true; } };
}

test('PWA manifests agree, use root scope and have real 180/192/512 PNG icons', async () => {
  const a = JSON.parse(await readFile(path.join(DEFAULT_DIST, 'manifest.json'), 'utf8'));
  const b = JSON.parse(await readFile(path.join(DEFAULT_DIST, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual(a, b);
  assert.equal(a.id, '/'); assert.equal(a.start_url, '/'); assert.equal(a.scope, '/');
  assert.equal(a.display, 'standalone'); assert.deepEqual(a.display_override, ['fullscreen', 'standalone']);
  assert.equal(a.orientation, 'landscape'); assert(a.name && a.short_name && a.theme_color && a.background_color);
  assert.deepEqual(a.icons.map(icon => icon.sizes).sort(), ['180x180', '192x192', '512x512']);
  for (const icon of a.icons) {
    assert.equal(icon.type, 'image/png');
    const data = await readFile(path.join(DEFAULT_DIST, icon.src.slice(1)));
    assert.equal(data.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`, icon.sizes);
  }
});

test('generated inventory contains every dist file and matches every content digest', async () => {
  const discovered = [];
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), prefix + entry.name + '/');
      else if (entry.isFile() && !['sw.js', '_headers'].includes(prefix + entry.name)) discovered.push(prefix + entry.name);
    }
  }
  await walk(DEFAULT_DIST);
  const assets = await collectAssets();
  assert.deepEqual(assets.map(asset => decodeURIComponent(asset.url.slice(1))), discovered.sort());
  for (const asset of assets) {
    const data = await readFile(path.join(DEFAULT_DIST, decodeURIComponent(asset.url.slice(1))));
    assert.equal(asset.bytes, data.length); assert.equal(asset.sha256, sha256(data));
  }
  assert(assets.some(asset => asset.url.endsWith('.woff2')));
  assert(assets.some(asset => asset.url === '/assets/nathan-sprites-v2.png'));
  assert(assets.some(asset => asset.url === '/index.html'));
});

test('committed service worker is current; regenerate after final dist changes', async () => {
  await buildServiceWorker(DEFAULT_DIST, { check: true });
});

test('release hashing is deterministic and changes for changed or added assets', async t => {
  const f = await fixture(t);
  assert.deepEqual(await generateServiceWorker(f.root), f.generated);
  await writeFile(path.join(f.root, 'sw.js'), 'ignored generated file');
  await writeFile(path.join(f.root, '_headers'), 'ignored host settings');
  assert.equal((await generateServiceWorker(f.root)).version, f.generated.version);
  await writeFile(path.join(f.root, 'app.js'), 'new app bytes');
  const changed = await generateServiceWorker(f.root);
  assert.notEqual(changed.version, f.generated.version);
  await writeFile(path.join(f.root, 'added.json'), '{}');
  assert.notEqual((await generateServiceWorker(f.root)).version, changed.version);
});

test('successful install precaches the entire release and reports readiness without forced activation', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  assert.equal((await worker.status()).offlineReady, false);
  await worker.install();
  assert.equal(worker.fetches.length, f.generated.assets.length);
  assert.equal((await worker.status()).offlineReady, true);
  assert.equal(worker.lifecycle.claimed, 0); assert.equal(worker.lifecycle.skipped, 0);
  await worker.activate();
  assert.equal(worker.lifecycle.claimed, 1); assert.equal(worker.lifecycle.skipped, 0);
});

test('failed or mismatched install deletes its partial cache and leaves the old release intact', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  const oldName = CACHE_PREFIX + 'previous';
  await worker.caches.open(oldName);
  worker.files.set('/app.js', Buffer.from('<html>unexpected SPA fallback</html>'));
  await assert.rejects(worker.install(), /integrity mismatch/);
  assert.deepEqual(await worker.caches.keys(), [oldName]);
  assert.equal(worker.lifecycle.skipped, 0);
});

test('cache completion-marker failure is atomic as well', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files, { failMarker: true });
  await assert.rejects(worker.install(), /Quota exceeded/);
  assert.equal((await worker.caches.keys()).length, 0);
});

test('offline navigation, modules, atlas, sprites and fonts all come from the installed release', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  await worker.install(); await worker.activate(); worker.offline();
  for (const [url, body] of f.files) {
    const response = await worker.fetch(url + '?cache-bust=new');
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
  }
  for (const url of ['/', '/play', '/play?lang=he']) {
    assert.equal(await (await worker.fetch(url, { mode: 'navigate' })).text(), f.files.get('/index.html').toString());
  }
  const missing = await worker.fetch('/missing.js', { mode: 'navigate' });
  assert.equal(missing.status, 503); assert(!missing.headers.get('Content-Type').includes('html'));
});

test('online deploy changes do not mix new modules into the current release', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  await worker.install(); await worker.activate();
  worker.files.set('/app.js', Buffer.from('export const release = "two";'));
  worker.files.set('/index.html', Buffer.from('<title>release two</title>'));
  assert.equal(await (await worker.fetch('/app.js')).text(), f.files.get('/app.js').toString());
  assert.equal(await (await worker.fetch('/', { mode: 'navigate' })).text(), f.files.get('/index.html').toString());
  const cache = await worker.caches.open(CACHE_PREFIX + f.generated.version);
  await cache.delete('/app.js');
  assert.equal((await worker.fetch('/app.js')).status, 503, 'wrong-version recovery is rejected');
});

test('evicted entries recover only verified bytes of the same release', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  await worker.install();
  const cache = await worker.caches.open(CACHE_PREFIX + f.generated.version);
  await cache.delete('/app.js');
  assert.equal((await worker.fetch('/app.js')).status, 200);
  worker.offline(); assert.equal((await worker.fetch('/app.js')).status, 200);
});

test('activation deletes only old Nathan caches and preserves unrelated applications', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  await worker.caches.open('another-app-cache'); await worker.caches.open(CACHE_PREFIX + 'old');
  await worker.install(); await worker.activate();
  assert.deepEqual((await worker.caches.keys()).sort(), ['another-app-cache', CACHE_PREFIX + f.generated.version].sort());
});

test('sw.js never receives an HTML navigation fallback, offline or from a misconfigured host', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files, { htmlWorker: true });
  await worker.install(); worker.files.set('/sw.js', Buffer.from('<html>SPA fallback</html>'));
  const bad = await worker.fetch('/sw.js', { mode: 'navigate' });
  assert.equal(bad.status, 503); assert.match(bad.headers.get('Content-Type'), /javascript/);
  assert(!(await bad.text()).includes('<html>'));
  worker.offline(); const offline = await worker.fetch('/sw.js', { mode: 'navigate' });
  assert.equal(offline.status, 503); assert.match(offline.headers.get('Content-Type'), /javascript/);
});

test('worker leaves non-GET and cross-origin requests to the browser', async t => {
  const f = await fixture(t), worker = workerHarness(f.generated, f.files);
  assert.equal(await worker.fetch('/save', { method: 'POST' }), undefined);
  assert.equal(await worker.fetch('https://outside.example/asset.js'), undefined);
});
