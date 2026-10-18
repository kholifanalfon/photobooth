const CACHE_NAME = 'photobooth-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/live',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/favicon.png'
];

// Install: pre-cache critical shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Pre-cache error during SW install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && !key.includes('video-cache')) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: offline-ready caching strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }

  // Strictly only cache http: and https: schemes (ignores chrome-extension://, moz-extension://, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  // Ignore non-GET requests (e.g. POST /api/print, POST /api/photos/upload)
  if (req.method !== 'GET') {
    return;
  }

  // Pass through all /api/ requests directly to the network without caching
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle SPA navigation requests: Network First -> Cache Fallback (offline ready)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => {
          // Offline fallback: serve cached index or root
          return caches.match(req).then((cached) => {
            if (cached) return cached;
            return caches.match('/') || caches.match('/live');
          });
        })
    );
    return;
  }

  // Pass through video files and uploads directly to browser native engine.
  // Service Workers cannot cache HTTP 206 Partial Content range requests and cause streaming aborts.
  if (
    url.pathname.match(/\.(mp4|webm|ogg|mov|m4v)$/i) ||
    url.pathname.includes('/uploads/')
  ) {
    return;
  }

  // Handle static assets (.js, .css, images, fonts): Cache-First with Network fallback and dynamic caching
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2|woff|ttf)$/i);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Revalidate in background
          fetch(req).then((fresh) => {
            if (fresh && fresh.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
            }
          }).catch(() => {});
          return cached;
        }

        return fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        });
      })
    );
  }
});
