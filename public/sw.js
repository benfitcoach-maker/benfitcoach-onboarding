// Service Worker — Benfit PWA V30
// Stratégie minimaliste :
//   - network-first pour tout (assure fraîcheur des builds Vercel)
//   - fallback cache uniquement si offline
//   - pas d'interception pour Supabase / API (laisser passer)

const CACHE_NAME = 'benfit-v1';
const CORE_ASSETS = ['/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Pas d'interception : requêtes non-GET, Supabase, autres APIs
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache shell léger (HTML + assets Vite) pour fallback offline
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          try { cache.put(request, copy); } catch {}
        });
        return response;
      })
      .catch(() => caches.match(request).then(r => r || caches.match('/')))
  );
});
