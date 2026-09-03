/* Service Worker - Kerigma Admin */
const VERSION = 'kerigma-admin-v4';
const SHELL_CACHE = VERSION + '-shell';
const CDN_CACHE = VERSION + '-cdn';
const SUPABASE_CACHE = VERSION + '-supabase';

const SHELL_URLS = [
  '/configuracoes.html',
  '/config.js',
  '/admin.css',
  '/admin.js',
  '/manifest-admin.webmanifest',
  '/icons/admin-192.png',
  '/icons/admin-512.png',
  '/index.html',
  '/hero_logo.jpeg',
  '/robots.txt',
  '/sitemap.xml'
];

const CDN_PREFIXES = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
  'https://cdnjs.cloudflare.com'
];

function isSupabase(url) {
  const u = url.toLowerCase();
  return u.includes('supabase.co');
}

function isCDN(url) {
  return CDN_PREFIXES.some(p => url.startsWith(p));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // nunca interferir em login/escrita

  const url = new URL(req.url);

  // CDN: stale-while-revalidate
  if (isCDN(req.url)) {
    event.respondWith(
      caches.open(CDN_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Supabase (dados + auth): network-first, fallback para cache em GET
  if (isSupabase(req.url)) {
    event.respondWith(
      caches.open(SUPABASE_CACHE).then(async (cache) => {
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        } catch (e) {
          const cached = await cache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // App shell (mesmo-órdigo): cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          return res;
        });
      })
    );
    return;
  }

  // recursos restantes (ex.: unsplash): rede com cache fallback
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).catch(() => cached);
    })
  );
});
