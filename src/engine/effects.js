// Visual effects shared by the 3D games, built on WAMR3D's InstancedMesh so a burst of
// hundreds of sparks is a single draw call on both WebGPU and WebGL 2. Particle counts
// scale with the player's quality setting.

import { THREE } from './wamr3d.js';
import { geo } from './materials.js';
import { qualityProfile } from '../services/graphics.js';
import { reducedMotion } from '../games/core/fx.js';

const matrix = new THREE.Matrix4();
const position = new THREE.Vector3();
const rotation = new THREE.Quaternion();
const scale = new THREE.Vector3();
const color = new THREE.Color();
const AXIS = new THREE.Vector3(1, 1, 1).normalize();

/**
 * Sparks, debris and glows: unlit, additively blended instances that shrink and fade.
 * emit(x, y, z, { count, color, speed, size, life, gravity, spread }) adds a burst.
 */
export class Particles {
	constructor(stage, { capacity = 400, geometry = geo.octa(1), additive = true } = {}) {
		this.capacity = Math.max(32, Math.round(capacity * qualityProfile().particles));
		const material = stage.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }));
		this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
		this.mesh.frustumCulled = false;
		this.mesh.count = 0;
		stage.scene.add(this.mesh);
		this.items = [];
		this.scale = qualityProfile().particles;
	}

	emit(x, y, z, { count = 24, color: tint = 0xffffff, colors = null, speed = 4, size = 0.12, life = 0.8, gravity = -6, spread = 1, up = 0 } = {}) {
		const n = Math.max(1, Math.round(count * this.scale * (reducedMotion() ? 0.5 : 1)));
		const palette = (colors ?? [tint]).map((c) => new THREE.Color(c));
		for (let i = 0; i < n; i++) {
			const base = palette[i % palette.length];
			if (this.items.length >= this.capacity) this.items.shift();
			// random direction on a sphere, flattened by `spread`
			const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
			const v = speed * (0.35 + Math.random() * 0.65);
			this.items.push({
				x, y, z,
				vx: r * Math.cos(a) * v, vy: u * v * spread + up, vz: r * Math.sin(a) * v,
				life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.8), gravity,
				r: base.r, g: base.g, b: base.b, spin: Math.random() * 6,
			});
		}
	}

	update(dt) {
		const items = this.items;
		let alive = 0;
		for (const p of items) {
			p.life -= dt;
			if (p.life <= 0) continue;
			p.vy += p.gravity * dt;
			p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
			items[alive++] = p;
		}
		items.length = alive;
		for (let i = 0; i < alive; i++) {
			const p = items[i];
			const t = p.life / p.max;
			position.set(p.x, p.y, p.z);
			rotation.setFromAxisAngle(AXIS, p.spin * t);
			scale.setScalar(p.size * (0.3 + 0.7 * t));
			matrix.compose(position, rotation, scale);
			this.mesh.setMatrixAt(i, matrix);
			// additive blending: fading toward black fades out
			color.setRGB(p.r * t, p.g * t, p.b * t);
			this.mesh.setColorAt(i, color);
		}
		this.mesh.count = alive;
		if (alive) {
			this.mesh.instanceMatrix.needsUpdate = true;
			if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
		}
	}

	clear() {
		this.items.length = 0;
		this.mesh.count = 0;
	}
}

/** A sphere of still stars around the origin, one instanced draw. */
export function starfield(stage, { count = 700, radius = 120, size = 0.35, tint = 0xdbe4ff } = {}) {
	const n = Math.round(count * Math.max(0.5, qualityProfile().particles));
	const material = stage.own(new THREE.MeshBasicMaterial({ color: tint, fog: false }));
	const mesh = new THREE.InstancedMesh(geo.octa(1), material, n);
	mesh.frustumCulled = false;
	for (let i = 0; i < n; i++) {
		const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
		const d = radius * (0.7 + Math.random() * 0.3);
		position.set(r * Math.cos(a) * d, u * d, r * Math.sin(a) * d);
		rotation.identity();
		scale.setScalar(size * (0.4 + Math.random()));
		matrix.compose(position, rotation, scale);
		mesh.setMatrixAt(i, matrix);
		const warm = Math.random();
		mesh.setColorAt(i, color.setRGB(0.75 + warm * 0.25, 0.8 + Math.random() * 0.2, 1 - warm * 0.2));
	}
	mesh.instanceMatrix.needsUpdate = true;
	if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
	stage.scene.add(mesh);
	return mesh;
}

/** A trail of fading sparks behind a moving object: call `update(x, y, z, dt)` each frame. */
export class Trail3D {
	constructor(particles, { color = 0xffffff, rate = 40, size = 0.08, life = 0.35 } = {}) {
		Object.assign(this, { particles, color, rate, size, life, carry: 0 });
	}
	update(x, y, z, dt, intensity = 1) {
		this.carry += this.rate * intensity * dt * this.particles.scale;
		while (this.carry >= 1) {
			this.carry -= 1;
			this.particles.emit(x, y, z, { count: 1, color: this.color, speed: 0.25, size: this.size, life: this.life, gravity: 0 });
		}
	}
}

/** Camera shake: `kick(amount)` then add `offset(dt)` to the camera each frame. None with reduced motion. */
export class Shake {
	constructor() { this.power = 0; this.x = 0; this.y = 0; }
	kick(amount) { if (!reducedMotion()) this.power = Math.max(this.power, amount); }
	update(dt) {
		this.power = Math.max(0, this.power - dt * 2.5);
		const p = this.power * this.power;
		this.x = (Math.random() * 2 - 1) * p;
		this.y = (Math.random() * 2 - 1) * p;
		return this;
	}
}
