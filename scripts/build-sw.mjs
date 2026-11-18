import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_DIST = path.join(PROJECT, 'dist');
export const CACHE_PREFIX = 'nathan-offline-';
const EXCLUDED = new Set(['sw.js', '_headers']);

// Included in the release hash: a change to worker logic gets its own cache.
export const WORKER_RUNTIME = String.raw`
const CACHE_PREFIX = 'nathan-offline-';
const CACHE_NAME = CACHE_PREFIX + RELEASE.version;
const ORIGIN = self.location.origin;
const COMPLETE_URL = new URL('/__nathan_offline_complete__', ORIGIN).href;
const ASSETS = new Map(RELEASE.assets.map(asset => [asset.url, asset]));
const absolute = pathname => new URL(pathname, ORIGIN).href;

async function verifiedFetch(asset) {
  // Static hosts may canonicalize /index.html with a redirect to /.
  // Fetch the canonical entry point while retaining /index.html as the cache key.
  const fetchPath = asset.url === '/index.html' ? '/' : asset.url;
  const request = new Request(absolute(fetchPath), {
    cache: 'reload', credentials: 'same-origin', redirect: 'error',
  });
  const response = await fetch(request);
  if (!response.ok || response.type === 'opaque') throw new Error('Unable to cache ' + asset.url);
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== asset.sha256 || bytes.byteLength !== asset.bytes) {
    throw new Error('Release integrity mismatch: ' + asset.url);
  }
  return response;
}

async function installRelease() {
  const cache = await caches.open(CACHE_NAME);
  const previous = await cache.match(COMPLETE_URL);
  if (previous) {
    const marker = await previous.json().catch(() => null);
    if (marker?.complete && marker.version === RELEASE.version) return;
  }
  // A failed install never becomes active. Its incomplete cache is deleted.
  // Promise.allSettled waits for every in-flight put before any cleanup.
  let cursor = 0;
  const tasks = Array.from({ length: Math.min(4, RELEASE.assets.length) }, async () => {
    while (cursor < RELEASE.assets.length) {
      const asset = RELEASE.assets[cursor++];
      const response = await verifiedFetch(asset);
      await cache.put(absolute(asset.url), response);
    }
  });
  const results = await Promise.allSettled(tasks);
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    await caches.delete(CACHE_NAME);
    throw failure.reason;
  }
  try {
    await cache.put(COMPLETE_URL, new Response(JSON.stringify({
      version: RELEASE.version, assets: RELEASE.assets.length, complete: true,
    }), { headers: { 'Content-Type': 'application/json' } }));
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil(installRelease());
  // No skipWaiting: an update must not interrupt or mix files into a running game.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (!(await cache.match(COMPLETE_URL))) throw new Error('Incomplete offline release');
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

const unavailable = () => new Response('NATHAN is unavailable offline. Reopen the game while online.', {
  status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});

async function serveAsset(asset) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(absolute(asset.url));
  if (cached) return cached;
  // Recover evicted entries only if their bytes still belong to this release.
  // A newer deployed JS file must never be mixed with an older cached index.
  try {
    const response = await verifiedFetch(asset);
    await cache.put(absolute(asset.url), response.clone());
    return response;
  } catch { return unavailable(); }
}

async function workerScript(request) {
  // Never serve index.html for /sw.js, even if a host has an SPA fallback.
  try {
    const response = await fetch(request);
    const type = response.headers.get('Content-Type') || '';
    if (response.ok && /(?:java|ecma)script/i.test(type)) return response;
  } catch {}
  return new Response('// NATHAN service worker must be fetched online as JavaScript.\n', {
    status: 503, headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== ORIGIN) return;
  if (url.pathname === '/sw.js') {
    event.respondWith(workerScript(request));
    return;
  }
  const asset = ASSETS.get(url.pathname);
  if (asset) {
    event.respondWith(serveAsset(asset));
    return;
  }
  const looksLikeAsset = /\.[a-z0-9]+$/i.test(url.pathname);
  if (request.mode === 'navigate' && !looksLikeAsset && ASSETS.has('/index.html')) {
    // All game navigations resolve to this version's index, online or offline.
    event.respondWith(serveAsset(ASSETS.get('/index.html')));
    return;
  }
  event.respondWith(fetch(request).catch(unavailable));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'NATHAN_PWA_STATUS') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const offlineReady = Boolean(await cache.match(COMPLETE_URL));
    const reply = { type: 'NATHAN_PWA_STATUS', version: RELEASE.version, offlineReady };
    if (event.ports?.[0]) event.ports[0].postMessage(reply);
    else event.source?.postMessage(reply);
  })());
});
`;

export async function collectAssets(distDir = DEFAULT_DIST) {
  const files = [];
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in dist: ' + relative);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile() && !EXCLUDED.has(relative)) files.push(relative);
    }
  }
  await walk(distDir);
  files.sort();
  return Promise.all(files.map(async relative => {
    const data = await readFile(path.join(distDir, ...relative.split('/')));
    return { url: '/' + relative.split('/').map(encodeURIComponent).join('/'), bytes: data.length,
      sha256: createHash('sha256').update(data).digest('hex') };
  }));
}

export async function generateServiceWorker(distDir = DEFAULT_DIST) {
  const assets = await collectAssets(distDir);
  if (!assets.some(asset => asset.url === '/index.html')) throw new Error('dist/index.html is required');
  const version = createHash('sha256').update(WORKER_RUNTIME).update(JSON.stringify(assets)).digest('hex').slice(0, 24);
  const release = { version, assets };
  const source = '// Generated by scripts/build-sw.mjs. Do not edit directly.\n' +
    'const RELEASE = ' + JSON.stringify(release, null, 2) + ';\n' + WORKER_RUNTIME.trimStart();
  return { ...release, source };
}

export async function buildServiceWorker(distDir = DEFAULT_DIST, { check = false } = {}) {
  const generated = await generateServiceWorker(distDir);
  const destination = path.join(distDir, 'sw.js');
  if (check) {
    const existing = await readFile(destination, 'utf8').catch(() => '');
    if (existing !== generated.source) throw new Error('Offline inventory is stale. Run node scripts/build-sw.mjs after the final dist changes.');
  } else {
    const temporary = path.join(path.dirname(distDir), '.nathan-sw-build.tmp');
    try {
      await writeFile(temporary, generated.source, 'utf8');
      await rename(temporary, destination);
    } finally { await rm(temporary, { force: true }); }
  }
  return generated;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await buildServiceWorker(DEFAULT_DIST, { check: process.argv.includes('--check') });
  console.log(JSON.stringify({ version: result.version, assets: result.assets.length,
    bytes: result.assets.reduce((total, asset) => total + asset.bytes, 0), checked: process.argv.includes('--check') }));
}
