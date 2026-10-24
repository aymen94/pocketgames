// PocketGames service worker. vite.config.ts fills in the version and the asset list at build time.
const VERSION = '__VERSION__';
const CACHE = `pocketgames-${VERSION}`;
const ASSETS = __ASSETS__;

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys()
			.then((keys) => Promise.all(keys.filter((k) => k.startsWith('pocketgames-') && k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	);
});

self.addEventListener('message', (event) => {
	if (event.data === 'version') event.source?.postMessage({ type: 'version', version: VERSION });
});

self.addEventListener('fetch', (event) => {
	const request = event.request;
	if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

	// Pages: network first so updates arrive, the cached shell when offline.
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put('./', copy));
					return response;
				})
				.catch(() => caches.match('./', { ignoreSearch: true }).then((shell) => shell ?? caches.match('./offline.html'))),
		);
		return;
	}

	// Hashed build assets never change: cache first.
	event.respondWith(
		caches.match(request, { ignoreSearch: true }).then((cached) => cached ?? fetch(request).then((response) => {
			if (response.ok) {
				const copy = response.clone();
				caches.open(CACHE).then((cache) => cache.put(request, copy));
			}
			return response;
		})),
	);
});
