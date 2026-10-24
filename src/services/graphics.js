// Graphics preferences: render quality and which WAMR3D backend draws the frames.
// This is the one place the quality levels are defined; the renderer, 3D stages, 2D
// canvases, particle effects and simulations all read their budget from `qualityProfile()`
// and follow `onGraphicsChange()`, so games never branch on the level themselves.
//
// Everything applies live except two things fixed when the GPU context is created: the
// backend, and multisample anti-aliasing. A stage whose quality wants anti-aliasing on a
// context created without it uses an FXAA pass instead (see engine/stage.js).

import { store } from './storage.js';

/**
 * Per-level budgets. Fields:
 * - pixelRatio   3D render resolution: below 1 renders under CSS size, otherwise caps devicePixelRatio
 * - canvasDpr    the same cap for 2D canvases
 * - antialias    anti-aliasing (MSAA at renderer creation, FXAA as a live fallback / with post-processing)
 * - bloom        WAMR3D UnrealBloomPass post-processing on stages that allow it
 * - shadows      directional-light shadow maps on stages that opt in (`Stage3D.create(…, { shadows })`)
 * - shadowMapSize the shadow map resolution when shadows are on
 * - particles    particle count multiplier (also scales trails, starfields, tracers)
 * - fluid        simulation detail key for grid solvers ('low' | 'medium' | 'high')
 * - detail       animation complexity, 0 (minimal) to 2 (full), for optional flourishes
 */
export const QUALITY = {
	low: {
		label: 'Minimum', note: 'Lower resolution, no shadows, bloom or anti-aliasing, fewer particles and simpler simulations. Best for older phones.',
		pixelRatio: 0.75, canvasDpr: 1, antialias: false, bloom: false, shadows: false, shadowMapSize: 0, particles: 0.4, fluid: 'low', detail: 0,
	},
	medium: {
		label: 'Medium', note: 'Sharp anti-aliased rendering, moderate particles and simulation detail. A good balance for most devices.',
		pixelRatio: 1.5, canvasDpr: 2, antialias: true, bloom: false, shadows: false, shadowMapSize: 0, particles: 0.75, fluid: 'medium', detail: 1,
	},
	high: {
		label: 'High', note: 'Full resolution, shadows, bloom glow, richer particles and the most detailed simulations.',
		pixelRatio: 2, canvasDpr: 2.5, antialias: true, bloom: true, shadows: true, shadowMapSize: 1024, particles: 1, fluid: 'high', detail: 2,
	},
};

export const BACKENDS = {
	auto: { label: 'Auto', note: 'WebGPU when available, WebGL 2 otherwise (recommended).' },
	webgpu: { label: 'WebGPU', note: 'The modern GPU API. Fails on browsers without WebGPU.' },
	webgl: { label: 'WebGL 2', note: 'The widely supported fallback renderer.' },
};

const listeners = new Set();

export function graphicsSettings() {
	const saved = store.state.settings.graphics ?? {};
	return {
		quality: QUALITY[saved.quality] ? saved.quality : 'medium',
		backend: BACKENDS[saved.backend] ? saved.backend : 'auto',
	};
}

/**
 * Saves new settings and notifies `onGraphicsChange` listeners when the quality changed.
 * Returns what changed, so callers know whether the GPU context must be recreated
 * (a backend change needs a reload; quality never does).
 */
export function setGraphicsSettings(values) {
	const before = graphicsSettings();
	store.state.settings.graphics = { ...before, ...values };
	store.save();
	const after = graphicsSettings();
	const changed = { quality: after.quality !== before.quality, backend: after.backend !== before.backend };
	if (changed.quality) {
		for (const fn of [...listeners]) {
			try { fn(qualityProfile(), after.quality); } catch (error) { console.warn('PocketGames: graphics listener failed', error); }
		}
	}
	return changed;
}

/** The active quality profile (see QUALITY). */
export function qualityProfile() {
	return QUALITY[graphicsSettings().quality];
}

/** The active quality key: 'low', 'medium' or 'high'. */
export function qualityLevel() {
	return graphicsSettings().quality;
}

/** Calls `fn(profile, level)` whenever the quality level changes. Returns the unsubscribe function. */
export function onGraphicsChange(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/** The device pixel ratio a 2D canvas should use at the current quality. */
export function canvasPixelRatio() {
	return Math.max(0.75, Math.min(window.devicePixelRatio || 1, qualityProfile().canvasDpr));
}

/** The 3D renderer's pixel ratio at the current quality. */
export function renderPixelRatio(profile = qualityProfile()) {
	return profile.pixelRatio < 1 ? profile.pixelRatio : Math.min(window.devicePixelRatio || 1, profile.pixelRatio);
}
