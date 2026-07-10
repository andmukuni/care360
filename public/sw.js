// Service worker for the AdonisJS + Inertia hospital app.
//
// Ported from the Laravel public/sw.js and adapted for Inertia client-side
// navigation:
//   - Network-first for navigations (full page loads AND Inertia XHR visits),
//     falling back to the cached offline page when the network is unavailable.
//   - Cache-first for static assets (Vite build output, PWA icons, images).
//   - Cache name bumped so returning clients discard the old Laravel caches.
const CACHE_VERSION = 'ihz-adonis-v2';
const PRECACHE_URLS = [
    '/offline.html',
    '/images/app-icon.png',
    '/pwa/icon-192.png',
    '/pwa/icon-512.png',
    '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            )
        ).then(() =>
            caches.open(CACHE_VERSION).then((cache) =>
                fetch('/offline.html')
                    .then((response) => {
                        if (response && response.ok) {
                            return cache.put('/offline.html', response);
                        }
                    })
                    .catch(() => {})
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) {
        return;
    }

    // Treat full-page navigations AND Inertia XHR page visits as "navigations".
    // Inertia sends its GET visits with the `X-Inertia` header; those are not
    // `mode: 'navigate'`, so we detect them explicitly. All navigations are
    // network-first with an offline fallback so users always get fresh content
    // when online and a graceful offline page otherwise.
    const isInertiaVisit = event.request.headers.get('X-Inertia') === 'true';
    const isNavigation = event.request.mode === 'navigate' || isInertiaVisit;

    if (isNavigation) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Inertia expects an Inertia response; a plain HTML offline page
                // would break its client. For Inertia XHR failures we let the
                // client surface its own offline error, and only serve the
                // offline page for true document navigations.
                if (isInertiaVisit) {
                    return Response.error();
                }

                return caches.match('/offline.html');
            })
        );
        return;
    }

    // Cache-first for static assets (Vite build output + PWA/media assets).
    const isStaticAsset =
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/pwa/') ||
        url.pathname.startsWith('/storage/') ||
        url.pathname === '/manifest.webmanifest' ||
        url.pathname === '/sw.js' ||
        url.pathname.startsWith('/images/');

    if (isStaticAsset) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) {
                    return cached;
                }

                return fetch(event.request).then((response) => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }

                    const copy = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, copy));

                    return response;
                });
            })
        );
    }
});
