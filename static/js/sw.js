const CACHE_NAME = 'hospital-verify-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/static/index.html',
    '/static/admin.html',
    '/static/logs.html',
    '/static/css/style.css',
    '/static/js/app.js',
    '/static/js/db.js',
    '/static/manifest.json',
    '/static/vendor/html5-qrcode.min.js',
    '/static/vendor/tesseract.min.js',
    '/static/vendor/worker.min.js',
    '/static/vendor/tesseract-core.wasm.js',
    '/static/vendor/tesseract-core.wasm.wasm'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Network first for API, Cache first for statics
    if (event.request.url.includes('/api/')) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // If offline and it's an API call, we return a 503 or handled json
                    return new Response(JSON.stringify({ error: "Offline" }), {
                        headers: { 'Content-Type': 'application/json' }
                    });
                })
        );
    } else {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    return response || fetch(event.request);
                })
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
