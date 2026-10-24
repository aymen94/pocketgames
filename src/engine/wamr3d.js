// The only module that initializes WAMR3D. Everything 3D in PocketGames goes through
// `loadEngine()` and the single shared renderer it creates, so the WebAssembly module is
// loaded once and only one GPU context ever exists. The renderer's canvas is moved
// between the dashboard hero and whichever 3D game is open.
//
// The player's graphics settings (services/graphics.js) pick the backend (Auto, WebGPU,
// WebGL 2) and the quality profile (resolution, anti-aliasing, bloom, shadows). Resolution
// follows quality changes live; MSAA is fixed when the context is created (stages fall back
// to FXAA, see stage.js), and so is the backend.

import * as THREE from 'wamr3d/compat';
import wasmUrl from 'wamr3d/wamr3d_wasm_bg.wasm?url';
import { graphicsSettings, qualityProfile, renderPixelRatio, onGraphicsChange } from '../services/graphics.js';

export { THREE };

let engine = null;
let renderer = null;
let failure = null;
let postprocessing = null;
let msaa = false;

/** Loads the WebAssembly module and creates the shared renderer. Resolves to the renderer. */
export function loadEngine() {
	engine ??= (async () => {
		await THREE.init(wasmUrl);
		const { backend } = graphicsSettings();
		const quality = qualityProfile();
		const next = new THREE.WebGPURenderer({ antialias: quality.antialias, powerPreference: 'high-performance', backend });
		// Minimum renders below CSS resolution; the others cap the device pixel ratio
		next.setPixelRatio(renderPixelRatio(quality));
		next.toneMapping = THREE.ACESFilmicToneMapping;
		next.toneMappingExposure = 1.1;
		// Shadows stay off on the shared renderer; a stage that opts in turns them on for its
		// own frames when the quality allows (Stage3D.render).
		next.shadowMap.enabled = false;
		next.shadowMap.type = THREE.PCFShadowMap;
		await next.init();
		msaa = quality.antialias;
		next.domElement.classList.add('wamr-canvas');
		renderer = next;
		return next;
	})().catch((error) => {
		failure = error;
		engine = null;
		throw error;
	});
	return engine;
}

/**
 * WAMR3D's post-processing add-ons. Add-ons create engine objects when their modules run,
 * so they are imported only after `init()`.
 */
export async function loadPostprocessing() {
	await loadEngine();
	postprocessing ??= import('wamr3d/addons/postprocessing/passes.js');
	return postprocessing;
}

// resolution follows the quality setting live; stages resize their composers on the same event
onGraphicsChange((profile) => {
	renderer?.setPixelRatio(renderPixelRatio(profile));
});

/** Whether the GPU context was created with multisample anti-aliasing. */
export function hasMsaa() {
	return renderer !== null && msaa;
}

/** The renderer once `loadEngine()` has resolved, otherwise null. */
export function getRenderer() {
	return renderer;
}

/** The error that made the engine unavailable, if any. */
export function engineError() {
	return failure;
}

/** Which graphics API draws the frames ('webgpu', 'webgpu-software', 'webgl'), or null. */
export function backendName() {
	return renderer?.backend?.name ?? null;
}

export function backendLabel(name = backendName()) {
	return name === 'webgl' ? 'WebGL 2' : name === 'webgpu-software' ? 'software WebGPU' : name === 'webgpu' ? 'WebGPU' : 'not started';
}
