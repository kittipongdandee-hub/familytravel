/* ============================================================
   Italy Trip 2026 — Service Worker
   Repo: kittipongdandee-hub/familytravel
   GitHub Pages: https://kittipongdandee-hub.github.io/familytravel/

   Strategy:
     Static shell         → Cache-First (HTML, manifest)
     private.enc.json     → Network-First, cache encrypted copy for offline
                            (NEVER cache decrypted/plaintext data — decryption
                             only happens in the page's JS, never in the SW)
     Google Fonts         → Cache-First, long-lived
     Wikipedia img        → Network-First, cache fallback
     Offline page         → Served from cache if network fails

   Security note:
     The encrypted file (private.enc.json) is safe to cache because it
     contains only AES-256-GCM ciphertext. Plaintext private data is
     NEVER stored or passed through the service worker.
   ============================================================ */

const CACHE_VERSION = 'v11';
const SHELL_CACHE   = `italy-shell-${CACHE_VERSION}`;
const IMG_CACHE     = `italy-images-${CACHE_VERSION}`;
const FONT_CACHE    = `italy-fonts-${CACHE_VERSION}`;
const PRIV_CACHE    = `italy-private-enc-${CACHE_VERSION}`;  /* encrypted only */

/* Critical files to pre-cache on install */
const BASE = '/familytravel';
const PRECACHE = [
  `${BASE}/italy_trip.html`,
  `${BASE}/manifest.json`,
];

/* ── Install ──────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Pre-cache warning:', err))
  );
});

/* ── Activate ─────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  const valid = [SHELL_CACHE, IMG_CACHE, FONT_CACHE, PRIV_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => !valid.includes(k)).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  /* Skip non-GET and chrome-extension */
  if (req.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  /* 1. Google Fonts → cache-first */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  /* 2. Wikimedia images → network-first with image cache fallback */
  if (url.hostname.includes('upload.wikimedia.org')) {
    event.respondWith(networkFirstImg(req));
    return;
  }

  /* 3. Same-origin (GitHub Pages /familytravel/*) */
  if (url.hostname === self.location.hostname) {
    /* private.enc.json → network-first so unlocks always try fresh;
       fall back to cached encrypted copy if offline.
       IMPORTANT: only the encrypted JSON is ever stored here. */
    if (url.pathname.endsWith('private.enc.json')) {
      event.respondWith(networkFirstPrivateEnc(req));
      return;
    }
    /* Everything else → cache-first */
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  /* 4. All other external → pass through */
});

/* ── Cache-First ──────────────────────────────────────────── */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    if (req.destination === 'document') return offlineFallback();
    return new Response('', { status: 503 });
  }
}

/* ── Network-First for private.enc.json (encrypted only) ──── */
async function networkFirstPrivateEnc(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      /* Cache encrypted file for offline unlock */
      const cache = await caches.open(PRIV_CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    /* Offline: serve cached encrypted copy (still needs password to decrypt) */
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', msg: 'private.enc.json not cached yet — connect once to cache it' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/* ── Network-First (images) ───────────────────────────────── */
async function networkFirstImg(req) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(IMG_CACHE);
      cache.put(req, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(req, { cacheName: IMG_CACHE });
    if (cached) return cached;
    /* 1×1 transparent SVG placeholder */
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
}

/* ── Offline fallback HTML ────────────────────────────────── */
function offlineFallback() {
  return new Response(`<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Italy 2026 — Offline</title>
<style>
  body{background:#0e0e0e;color:#f0ebe3;font-family:sans-serif;display:flex;
    align-items:center;justify-content:center;min-height:100vh;margin:0;
    text-align:center;padding:2rem;box-sizing:border-box}
  h1{color:#c8923a;font-size:1.4rem;margin-bottom:.75rem}
  p{opacity:.65;line-height:1.7;font-size:.9rem;max-width:320px}
  .btn{display:inline-block;margin-top:1.5rem;padding:.75rem 2rem;
    background:#c8923a;color:#0e0e0e;border-radius:4px;
    text-decoration:none;font-weight:700;font-size:.9rem}
</style>
</head>
<body>
<div>
  <div style="font-size:3rem;margin-bottom:1rem">✈️</div>
  <h1>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
  <p>เปิดแอปนี้ขณะออนไลน์ก่อน<br>
     แล้วกด <strong>"เตรียมข้อมูลออฟไลน์"</strong><br>
     เพื่อดาวน์โหลดข้อมูลทริปไว้ในเครื่อง</p>
  <a class="btn" href="/familytravel/italy_trip.html">ลองใหม่</a>
</div>
</body>
</html>`, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/* ── Message handler (triggered by Download button in page) ─ */
self.addEventListener('message', async event => {
  const { type, urls } = event.data || {};

  /* Reply helper: prefer MessageChannel port (iOS Safari compatible),
     fall back to event.source for broadcast messages like CACHE_PROGRESS */
  const replyPort = event.ports && event.ports[0];
  const reply = (msg) => {
    if (replyPort) replyPort.postMessage(msg);
    else event.source?.postMessage(msg);
  };

  /* Allow page to force SW claim (helps iOS Safari first-load) */
  if (type === 'SKIP_WAITING') {
    await self.skipWaiting();
    await self.clients.claim();
    return;
  }

  /* Cache image URLs sent from page */
  if (type === 'CACHE_IMAGES' && Array.isArray(urls)) {
    const cache = await caches.open(IMG_CACHE);
    let done = 0;

    for (const url of urls) {
      try {
        const res = await fetch(url, { mode: 'cors' });
        if (res.ok) { await cache.put(url, res); done++; }
      } catch { /* skip failed */ }

      /* CACHE_PROGRESS always goes to event.source (broadcast, no port) */
      event.source?.postMessage({
        type: 'CACHE_PROGRESS',
        done,
        total: urls.length,
        pct: Math.round((done / urls.length) * 100)
      });
    }
    event.source?.postMessage({ type: 'CACHE_IMAGES_DONE', done, total: urls.length });
  }

  /* Re-cache the main HTML file — reply via port (MessageChannel) */
  if (type === 'CACHE_SHELL') {
    try {
      const cache = await caches.open(SHELL_CACHE);
      const res = await fetch(`${BASE}/italy_trip.html`);
      if (res.ok) await cache.put(`${BASE}/italy_trip.html`, res.clone());
      reply({ type: 'CACHE_SHELL_DONE' });
    } catch (err) {
      reply({ type: 'CACHE_SHELL_ERROR', err: String(err) });
    }
  }

  /* Check what's cached — reply via port (MessageChannel) */
  if (type === 'CHECK_CACHE') {
    const shellCache = await caches.open(SHELL_CACHE);
    const imgCache   = await caches.open(IMG_CACHE);
    const fontCache  = await caches.open(FONT_CACHE);
    const [shellKeys, imgKeys, fontKeys] = await Promise.all([
      shellCache.keys(), imgCache.keys(), fontCache.keys()
    ]);
    reply({
      type: 'CACHE_STATUS',
      shell: shellKeys.length,
      images: imgKeys.length,
      fonts: fontKeys.length
    });
  }
});
