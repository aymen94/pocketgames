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
	ultralow: {
		label: 'Ultra low', note: 'Half resolution, plain rendering, very few particles and the coarsest simulations. For very weak devices or saving battery.',
		pixelRatio: 0.5, canvasDpr: 0.75, antialias: false, bloom: false, shadows: false, shadowMapSize: 0, particles: 0.2, fluid: 'low', detail: 0,
	},
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
	ultra: {
		label: 'Ultra high', note: 'Native resolution on sharp screens, crisp shadows, bloom and the most particles. For powerful desktops; uses more power.',
		pixelRatio: 3, canvasDpr: 3, antialias: true, bloom: true, shadows: true, shadowMapSize: 2048, particles: 1.5, fluid: 'high', detail: 2,
	},
};

export const BACKENDS = {
	auto: { label: 'Auto', note: 'WebGPU when available, WebGL 2 otherwise (recommended).' },
	webgpu: { label: 'WebGPU', note: 'The modern GPU API. Fails on browsers without WebGPU.' },
	webgl: { label: 'WebGL 2', note: 'The widely supported fallback renderer.' },
};

/** The quality choices offered in settings: 'auto' picks a level for this device. */
export const QUALITY_CHOICES = {
	auto: { label: 'Auto', note: 'Picks a level that suits this device (recommended).' },
	...QUALITY,
};

const listeners = new Set();
let detected = null;

/** True when the GPU is a software rasteriser (no real graphics hardware). */
function softwareRenderer() {
	try {
		const gl = document.createElement('canvas').getContext('webgl');
		if (!gl) return true;
		const info = gl.getExtension('WEBGL_debug_renderer_info');
		const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return /swiftshader|llvmpipe|softpipe|basic render|software/i.test(renderer);
	} catch {
		return false;
	}
}

/**
 * The quality level that suits this device, worked out once from memory, cores, input and GPU.
 * Never 'ultra': the browser cannot tell how strong the GPU is, so that stays a manual choice.
 */
export function detectQuality() {
	if (detected) return detected;
	const memory = navigator.deviceMemory; // GB, Chromium only
	const cores = navigator.hardwareConcurrency || 4;
	const phone = window.matchMedia?.('(pointer: coarse)').matches ?? false;
	if (softwareRenderer() || (memory && memory <= 1)) detected = 'ultralow';
	else if (navigator.connection?.saveData || (memory && memory <= 2) || cores <= 2) detected = 'low';
	else if (!phone && (!memory || memory >= 8) && cores >= 8) detected = 'high';
	else detected = 'medium';
	return detected;
}

/**
 * `quality` is the level in effect; `choice` is what the player picked ('auto' or a level).
 * Records saved before 'auto' existed stored 'medium' without the player choosing it, so
 * an unflagged 'medium' counts as 'auto'.
 */
export function graphicsSettings() {
	const saved = store.state.settings.graphics ?? {};
	const picked = QUALITY[saved.quality] && (saved.picked || saved.quality !== 'medium');
	const choice = picked ? saved.quality : 'auto';
	return {
		quality: choice === 'auto' ? detectQuality() : choice,
		choice,
		backend: BACKENDS[saved.backend] ? saved.backend : 'auto',
	};
}

/**
 * Saves new settings (`quality` takes a QUALITY_CHOICES key) and notifies `onGraphicsChange`
 * listeners when the quality in effect changed. Returns what changed, so callers know whether
 * the GPU context must be recreated (a backend change needs a reload; quality never does).
 */
export function setGraphicsSettings(values) {
	const before = graphicsSettings();
	const quality = values.quality ?? before.choice;
	store.state.settings.graphics = { quality, backend: values.backend ?? before.backend, picked: quality !== 'auto' };
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

/** The active quality key: 'ultralow', 'low', 'medium', 'high' or 'ultra'. */
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
