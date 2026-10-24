// The site-wide theme manager. Named themes live in styles/themes.css under
// [data-theme]; this module switches between them, builds the Custom theme from one
// accent colour (deriving hover, active, focus, surfaces and text with readable
// contrast), persists the choice, and tells listeners (canvas games, shared 3D
// materials, the hero) so they can follow without a reload.
//
// The choice is stored under its own key; index.html reads it before first paint.

const KEY = 'pocketgames:theme';

export const THEMES = [
	{ id: 'midnight', label: 'Midnight' },
	{ id: 'neon-arcade', label: 'Neon Arcade' },
	{ id: 'cyberpunk', label: 'Cyberpunk' },
	{ id: 'emerald', label: 'Emerald' },
	{ id: 'sunset', label: 'Sunset' },
	{ id: 'light', label: 'Light' },
	{ id: 'monochrome', label: 'Monochrome' },
	{ id: 'custom', label: 'Custom' },
];

export const CUSTOM_BASES = [
	{ id: 'dark', label: 'Dark' },
	{ id: 'graphite', label: 'Graphite' },
	{ id: 'light', label: 'Light' },
];

const DEFAULT = { id: 'midnight', accent: '#4f8cff', base: 'dark' };
const HEX = /^#[0-9a-f]{6}$/i;
const listeners = new Set();

function load() {
	try {
		const saved = JSON.parse(localStorage.getItem(KEY));
		if (!saved || typeof saved !== 'object') return { ...DEFAULT };
		return {
			id: THEMES.some((t) => t.id === saved.id) ? saved.id : DEFAULT.id,
			accent: HEX.test(saved.accent) ? saved.accent : DEFAULT.accent,
			base: CUSTOM_BASES.some((b) => b.id === saved.base) ? saved.base : DEFAULT.base,
		};
	} catch {
		return { ...DEFAULT };
	}
}

let state = load();

// ---------------------------------------------------------------- colour maths

function hexToRgb(hex) {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
	return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl([r, g, b]) {
	r /= 255; g /= 255; b /= 255;
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [h / 6, s, l];
}

function hsl(h, s, l) {
	h = ((h % 1) + 1) % 1;
	s = Math.max(0, Math.min(1, s));
	l = Math.max(0, Math.min(1, l));
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
	const f = (t) => {
		t = ((t % 1) + 1) % 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return rgbToHex([f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]);
}

function luminance(hex) {
	const c = hexToRgb(hex).map((v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** WCAG contrast ratio between two colours. */
export function contrast(a, b) {
	const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
	return (x + 0.05) / (y + 0.05);
}

/** Moves the lightness of `colour` until it reaches `ratio` against `against`. */
function ensureContrast(colour, against, ratio) {
	let [h, s, l] = rgbToHsl(hexToRgb(colour));
	const lighten = luminance(against) < 0.4;
	let out = colour;
	for (let i = 0; i < 40 && contrast(out, against) < ratio; i++) {
		l += lighten ? 0.02 : -0.02;
		out = hsl(h, s, l);
	}
	return out;
}

/** Every core token of the Custom theme, derived from an accent and a base. */
export function customTokens(accent = state.accent, base = state.base) {
	const [h, s] = rgbToHsl(hexToRgb(HEX.test(accent) ? accent : DEFAULT.accent));
	const light = base === 'light';
	const tintSat = base === 'graphite' ? 0.06 : Math.min(0.45, s * 0.5);
	const bg = light ? hsl(h, tintSat * 0.6, 0.965) : hsl(h, tintSat, 0.065);
	const surface = light ? '#ffffff' : hsl(h, tintSat, 0.11);
	const text = light ? hsl(h, 0.3, 0.12) : hsl(h, 0.25, 0.96);
	const primary = ensureContrast(accent, bg, light ? 4.5 : 4.5);
	const [ph, ps, pl] = rgbToHsl(hexToRgb(primary));
	const onPrimary = contrast('#ffffff', primary) >= 4.5 ? '#ffffff' : hsl(ph, 0.4, 0.08);
	return {
		'--scheme': light ? 'light' : 'dark',
		'--color-background': bg,
		'--color-background-2': light ? hsl(h, tintSat, 0.92) : hsl(h, tintSat * 1.2, 0.13),
		'--color-surface': surface,
		'--color-surface-2': light ? hsl(h, tintSat * 0.7, 0.94) : hsl(h, tintSat, 0.15),
		'--color-surface-3': light ? '#ffffff' : hsl(h, tintSat, 0.145),
		'--color-surface-hover': light ? hsl(h, tintSat, 0.9) : hsl(h, tintSat, 0.2),
		'--color-border': light ? hsl(h, tintSat * 0.6, 0.84) : hsl(h, tintSat, 0.24),
		'--color-border-strong': light ? hsl(h, tintSat * 0.6, 0.7) : hsl(h, tintSat * 1.2, 0.36),
		'--color-text': text,
		'--color-text-soft': ensureContrast(light ? hsl(h, 0.15, 0.28) : hsl(h, 0.2, 0.82), bg, 7),
		'--color-text-muted': ensureContrast(light ? hsl(h, 0.1, 0.42) : hsl(h, 0.15, 0.64), bg, 4.5),
		'--color-primary': primary,
		'--color-primary-hover': hsl(ph, ps, light ? pl - 0.07 : pl + 0.08),
		'--color-primary-active': hsl(ph, ps, light ? pl - 0.13 : pl - 0.08),
		'--color-on-primary': onPrimary,
		'--color-secondary': ensureContrast(hsl(ph + 0.11, Math.max(ps, 0.55), pl), bg, 3),
		'--color-tertiary': ensureContrast(hsl(ph - 0.12, Math.max(ps, 0.55), pl), bg, 3),
		'--color-focus': ensureContrast(hsl(ph, ps, light ? pl - 0.05 : pl + 0.15), bg, 4.5),
		'--color-success': light ? '#0b8a5e' : '#34d399',
		'--color-warning': light ? '#a16207' : '#fbbf24',
		'--color-danger': light ? '#c42a4a' : '#fb7185',
		'--color-eyebrow': ensureContrast(hsl(ph, ps, light ? 0.4 : 0.78), bg, 4.5),
		'--color-scrim': light ? '#1e293b' : hsl(h, tintSat, 0.03),
		'--color-shadow': light ? 'rgba(15, 23, 42, 0.18)' : 'rgba(0, 0, 0, 0.7)',
	};
}

// ---------------------------------------------------------------- applying

let transition = null;

/**
 * Applies the theme with a short cross-fade instead of an abrupt repaint: a View Transition
 * where the browser has one (a single GPU cross-fade of the whole page, so nothing stutters
 * while every token changes at once), otherwise a brief colour transition on the page.
 * Reduced motion and the first paint switch instantly.
 */
function apply(animate = true) {
	const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!animate || reduced) return applyNow();
	const root = document.documentElement;
	if (typeof document.startViewTransition === 'function') {
		// a change while the previous fade still runs finishes that one first
		transition?.skipTransition?.();
		root.classList.add('theme-switching');
		transition = document.startViewTransition(() => applyNow());
		transition.finished.finally(() => { root.classList.remove('theme-switching'); transition = null; });
		return;
	}
	root.classList.add('theme-fading');
	applyNow();
	clearTimeout(apply.timer);
	apply.timer = setTimeout(() => root.classList.remove('theme-fading'), 450);
}

function applyNow() {
	const root = document.documentElement;
	root.dataset.theme = state.id;
	const custom = state.id === 'custom' ? customTokens() : null;
	// clear any previous custom values, then write the new ones
	for (const name of Object.keys(customTokens())) root.style.removeProperty(name);
	if (custom) for (const [name, value] of Object.entries(custom)) root.style.setProperty(name, value);
	try {
		localStorage.setItem(KEY, JSON.stringify({ ...state, vars: custom }));
	} catch {
		// storage unavailable: the theme still applies for this visit
	}
	const meta = document.querySelector('meta[name="theme-color"]');
	if (meta) meta.content = themeColors().background;
	const colors = themeColors();
	for (const fn of listeners) fn(colors, state);
}

/** The active theme's colours as hex strings, read from the computed tokens. */
export function themeColors() {
	const style = getComputedStyle(document.documentElement);
	const get = (name) => style.getPropertyValue(name).trim();
	return {
		scheme: get('--scheme') || 'dark',
		background: get('--color-background'),
		background2: get('--color-background-2'),
		surface: get('--color-surface'),
		surface2: get('--color-surface-2'),
		border: get('--color-border'),
		text: get('--color-text'),
		muted: get('--color-text-muted'),
		primary: get('--color-primary'),
		primaryHover: get('--color-primary-hover'),
		secondary: get('--color-secondary'),
		tertiary: get('--color-tertiary'),
		success: get('--color-success'),
		warning: get('--color-warning'),
		danger: get('--color-danger'),
	};
}

export const theme = {
	get state() { return { ...state }; },
	setTheme(id) {
		if (!THEMES.some((t) => t.id === id)) return;
		state = { ...state, id };
		apply();
	},
	setCustom({ accent = state.accent, base = state.base } = {}) {
		state = { id: 'custom', accent: HEX.test(accent) ? accent : state.accent, base: CUSTOM_BASES.some((b) => b.id === base) ? base : state.base };
		apply();
	},
	/** Calls fn(colors, state) on every change; returns an unsubscribe function. */
	subscribe(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	},
};

/** Applies the saved theme (index.html already did, before paint) and normalises storage. */
export function startTheme() {
	apply(false);
}
