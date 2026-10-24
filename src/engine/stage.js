// A 3D stage: a scene, a camera, lights and resize handling on the shared renderer.
// The hero and every 3D game build on this, so the setup, sizing, picking and cleanup
// are written once.

import { THREE, loadEngine, loadPostprocessing, hasMsaa } from './wamr3d.js';
import { pointerNdc } from './input.js';
import { qualityProfile, onGraphicsChange } from '../services/graphics.js';

export class Stage3D {
	/**
	 * Loads the engine (once per session) and creates a stage drawing into `container`.
	 * The stage follows the graphics quality live (services/graphics.js):
	 * - bloom: WAMR3D's UnrealBloomPass on High. Pass `bloom: { strength, radius, threshold }`
	 *   to tune it, or `bloom: false` to skip it.
	 * - anti-aliasing: an FXAA pass when the quality wants it but the frame cannot get MSAA
	 *   (the context was created without it, or post-processing renders off-screen).
	 * - shadows: opt in with `shadows: { extent, near, far }` (or `true`): on High the sun
	 *   casts a shadow over a box of ±extent around its target (the origin by default), and
	 *   lit, opaque meshes cast and receive it. Use it for bounded scenes, where the box fits;
	 *   call `flagShadows()` after nesting new meshes inside existing groups.
	 */
	static async create(container, options = {}) {
		const renderer = await loadEngine();
		const stage = new Stage3D(container, renderer, options);
		await stage.applyQuality();
		return stage;
	}

	/** Kept for callers that add bloom explicitly; quality changes may remove it again. */
	async enableBloom(bloom = {}) {
		this.bloomOptions = bloom;
		await this.buildComposer({ bloom: true, fxaa: qualityProfile().antialias });
	}

	/** Brings post-processing and shadows in line with `profile` (the current quality by default). */
	async applyQuality(profile = qualityProfile()) {
		const bloom = this.bloomOptions !== false && profile.bloom;
		// composer targets are single-sampled, so post-processing always needs FXAA for smooth edges
		const fxaa = profile.antialias && (bloom || !hasMsaa());
		this.setShadows(Boolean(this.shadowOptions) && profile.shadows, profile.shadowMapSize);
		const key = `${bloom}:${fxaa}`;
		if (key === this.postKey) return;
		this.postKey = key;
		if (bloom || fxaa) {
			try {
				await this.buildComposer({ bloom, fxaa });
			} catch (error) {
				// post-processing is optional: draw the plain scene if the add-on fails here
				console.warn('PocketGames: post-processing unavailable', error);
				this.disposeComposer();
			}
		} else {
			this.disposeComposer();
		}
	}

	async buildComposer({ bloom, fxaa }) {
		const { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, FXAAPass } = await loadPostprocessing();
		if (this.disposed) return;
		this.disposeComposer();
		const composer = new EffectComposer(this.renderer);
		composer.addPass(new RenderPass(this.scene, this.camera));
		if (bloom) {
			const { strength = 0.55, radius = 0.4, threshold = 0.85 } = this.bloomOptions || {};
			this.bloom = new UnrealBloomPass(new THREE.Vector2(this.size.width, this.size.height), strength, radius, threshold);
			composer.addPass(this.bloom);
		}
		composer.addPass(new OutputPass());
		// FXAA works on the final, tone-mapped colours
		if (fxaa) composer.addPass(new FXAAPass());
		this.composer = composer;
		this.size.width = this.size.height = 0;
		this.resize();
	}

	disposeComposer() {
		if (!this.composer) return;
		for (const pass of this.composer.passes) pass.dispose?.();
		this.composer.dispose();
		this.composer = null;
		this.bloom = null;
	}

	/** Turns the sun's shadow on or off; meshes are flagged on the next frame. */
	setShadows(on, mapSize = 1024) {
		this.shadows = on && Boolean(this.sun);
		this.shadowObjects = -1;
		if (!this.sun) return;
		this.sun.castShadow = this.shadows;
		if (!this.shadows) return;
		const { extent = 12, near = 0.5, far = 80, bias = -0.0005, normalBias = 0.02 } = this.shadowOptions === true ? {} : this.shadowOptions;
		const shadow = this.sun.shadow;
		Object.assign(shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near, far });
		shadow.camera.updateProjectionMatrix();
		shadow.mapSize.set(mapSize, mapSize);
		shadow.bias = bias;
		shadow.normalBias = normalBias;
	}

	/** Flags lit, opaque meshes as shadow casters and receivers; additive effects and unlit meshes are left out. */
	flagShadows() {
		let count = 0;
		this.scene.traverse((object) => {
			count++;
			if (!object.isMesh) return;
			const materials = Array.isArray(object.material) ? object.material : [object.material];
			const lit = materials.every((m) => m && !m.isMeshBasicMaterial && !m.transparent && !m.isShaderMaterial);
			if (object.castShadow !== lit) object.castShadow = lit;
			if (object.receiveShadow !== lit) object.receiveShadow = lit;
		});
		return count;
	}

	constructor(container, renderer, { fov = 55, near = 0.1, far = 400, background = 0x0b1020, fog = null, lights = true, bloom = {}, shadows = false } = {}) {
		this.container = container;
		this.renderer = renderer;
		this.bloomOptions = bloom;
		this.shadowOptions = shadows;
		this.shadows = false;
		this.postKey = '';
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(background);
		if (fog) this.scene.fog = new THREE.Fog(fog.color ?? background, fog.near, fog.far);
		this.camera = new THREE.PerspectiveCamera(fov, 1, near, far);
		this.owned = new Set();
		this.raycaster = new THREE.Raycaster();
		this.ndc = { x: 0, y: 0 };
		this.size = { width: 1, height: 1 };
		if (lights) this.addLights();
		this.observer = new ResizeObserver(() => this.resize());
		this.unsubscribeQuality = onGraphicsChange((profile) => {
			// the renderer's pixel ratio has changed: resize the composer, then rebuild effects
			this.size.width = this.size.height = 0;
			this.resize();
			this.applyQuality(profile);
		});
		this.attach();
	}

	/** Moves the shared canvas into this stage's container and starts following its size. */
	attach() {
		const canvas = this.renderer.domElement;
		if (canvas.parentElement !== this.container) this.container.appendChild(canvas);
		this.observer.observe(this.container);
		// another stage may have resized the shared renderer meanwhile
		this.size.width = this.size.height = 0;
		this.resize();
	}

	/** Stops following the container; the canvas stays until another stage takes it. */
	detach() {
		this.observer.disconnect();
	}

	addLights({ sky = 0xbfd4ff, ground = 0x1b1530, intensity = 1.1, sun = 0xffffff, sunIntensity = 1.6, sunPosition = [6, 12, 8] } = {}) {
		this.hemi = new THREE.HemisphereLight(sky, ground, intensity);
		this.sun = new THREE.DirectionalLight(sun, sunIntensity);
		this.sun.position.set(...sunPosition);
		this.scene.add(this.hemi, this.sun);
	}

	/** Registers a geometry, material or texture made for this stage only, disposed with it. */
	own(resource) {
		this.owned.add(resource);
		return resource;
	}

	/** Creates a mesh, adds it to `parent` (the scene by default) and returns it. */
	mesh(geometry, material, parent = this.scene) {
		const mesh = new THREE.Mesh(geometry, material);
		parent.add(mesh);
		return mesh;
	}

	resize() {
		const rect = this.container.getBoundingClientRect();
		const width = Math.max(1, Math.floor(rect.width));
		const height = Math.max(1, Math.floor(rect.height));
		if (width === this.size.width && height === this.size.height && this.renderer.domElement.parentElement === this.container) return;
		this.size.width = width;
		this.size.height = height;
		this.renderer.setSize(width, height);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		if (this.composer) {
			this.composer.setPixelRatio(this.renderer.getPixelRatio());
			this.composer.setSize(width, height);
		}
		this.onResize?.(width, height);
	}

	render() {
		// the renderer is shared: shadows are switched per stage, for this stage's frames only
		this.renderer.shadowMap.enabled = this.shadows;
		if (this.shadows && this.shadowObjects !== this.scene.children.length) {
			this.flagShadows();
			this.shadowObjects = this.scene.children.length;
		}
		if (this.composer) this.composer.render();
		else this.renderer.render(this.scene, this.camera);
	}

	/** The first intersection under a pointer event among `objects`, or null. */
	pick(event, objects, recursive = true) {
		pointerNdc(event, this.renderer.domElement, this.ndc);
		this.raycaster.setFromCamera(this.ndc, this.camera);
		return this.raycaster.intersectObjects(objects, recursive)[0] ?? null;
	}

	/** Where the pointer ray crosses the horizontal plane y = `height`, written into `target`. */
	pointOnGround(event, height = 0, target = new THREE.Vector3()) {
		pointerNdc(event, this.renderer.domElement, this.ndc);
		this.raycaster.setFromCamera(this.ndc, this.camera);
		const { origin, direction } = this.raycaster.ray;
		if (Math.abs(direction.y) < 1e-6) return null;
		const t = (height - origin.y) / direction.y;
		if (t < 0) return null;
		return target.set(origin.x + direction.x * t, height, origin.z + direction.z * t);
	}

	/** Releases every object in the scene and the resources this stage owns. */
	dispose() {
		this.disposed = true;
		this.unsubscribeQuality();
		this.renderer.shadowMap.enabled = false;
		this.detach();
		const objects = [];
		this.scene.traverse((object) => objects.push(object));
		for (let i = objects.length - 1; i >= 0; i--) objects[i].dispose();
		this.camera.dispose();
		for (const resource of this.owned) resource.dispose?.();
		this.owned.clear();
		this.disposeComposer();
		const canvas = this.renderer.domElement;
		if (canvas.parentElement === this.container) canvas.remove();
	}
}

/** Smoothly moves `value` toward `target`; `rate` is roughly the fraction covered per 1/60 s. */
export function damp(value, target, rate, dt) {
	return target + (value - target) * Math.pow(1 - rate, dt * 60);
}
