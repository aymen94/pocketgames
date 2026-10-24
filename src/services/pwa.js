// Service worker registration, the online/offline status and the install prompt.

const status = { online: navigator.onLine, offlineReady: false, installable: false };
const listeners = new Set();
let deferredPrompt = null;

function emit() {
	for (const fn of listeners) fn({ ...status });
}

export const pwa = {
	get status() { return { ...status }; },
	subscribe(fn) { listeners.add(fn); fn({ ...status }); return () => listeners.delete(fn); },

	async install() {
		if (!deferredPrompt) return false;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		deferredPrompt = null;
		status.installable = false;
		emit();
		return outcome === 'accepted';
	},
};

export function startPwa() {
	window.addEventListener('online', () => { status.online = true; emit(); });
	window.addEventListener('offline', () => { status.online = false; emit(); });

	window.addEventListener('beforeinstallprompt', (event) => {
		event.preventDefault();
		deferredPrompt = event;
		status.installable = true;
		emit();
	});
	window.addEventListener('appinstalled', () => { deferredPrompt = null; status.installable = false; emit(); });

	// The service worker only exists in production builds (vite.config.js emits it).
	if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
	navigator.serviceWorker.register('./sw.js').then(async (registration) => {
		await navigator.serviceWorker.ready;
		// Installed means every built file, every game chunk and the WAMR3D .wasm are cached.
		status.offlineReady = Boolean(registration.active);
		emit();
	}).catch(() => {
		status.offlineReady = false;
		emit();
	});
}
