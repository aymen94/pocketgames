import './styles/main.css';
import { App } from './app/app.js';
import { startPwa } from './services/pwa.js';
import { audio } from './services/audio.js';
import { startTheme } from './services/theme.js';
import { startButtonFeedback } from './components/feedback.js';

startTheme();
startPwa();
startButtonFeedback();
new App(document.getElementById('app'));
hideSplash();

/**
 * Fades the splash screen (index.html) out once the app has rendered, after at least
 * ~0.9 s from the first paint so the start reads as one smooth transition rather than a
 * flash; the dashboard eases in underneath.
 */
function hideSplash() {
	const splash = document.getElementById('splash');
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wait = reduced ? 0 : Math.max(0, 900 - performance.now());
	const ready = document.fonts?.ready ?? Promise.resolve();
	Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(() => setTimeout(() => {
		document.body.classList.add('app-ready', 'app-entering');
		// the card cascade is for the first reveal only, not for later searches and filters
		setTimeout(() => document.body.classList.remove('app-entering'), 1400);
		if (!splash) return;
		splash.classList.add('out');
		splash.addEventListener('transitionend', () => splash.remove(), { once: true });
		setTimeout(() => splash.remove(), 800);
	}, wait));
}

// browsers only allow audio after a gesture: unlock it on the first one
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
window.addEventListener('keydown', () => audio.unlock(), { once: true });
