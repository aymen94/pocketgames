// Ripple Pond: a 3D pond rendered with WAMR3D. Tap the water to drop pebbles; the ripples
// (a damped wave equation on a height grid) push the floating ducks along the slope of
// the waves. Herd every duck into the reed nest before time runs out. The water surface
// is a single InstancedMesh of tiles that rise, fall and change colour with the waves.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { Particles } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const N = 44, SIZE = 22, CELL = SIZE / N;
const LEVELS = [
	{ ducks: 1, time: 45, rocks: [] },
	{ ducks: 2, time: 55, rocks: [[0, 0, 2]] },
	{ ducks: 3, time: 60, rocks: [[-4, 3, 1.6], [4, -2, 1.6]] },
	{ ducks: 4, time: 70, rocks: [[0, 4, 2], [-5, -3, 1.4], [5, -4, 1.4]] },
	{ ducks: 5, time: 80, rocks: [[-3, 0, 1.8], [3, 0, 1.8], [0, -5, 1.4]] },
];
const NEST = { x: 7.5, z: -7.5, r: 2.4 };

const matrix = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const scl = new THREE.Vector3();
const col = new THREE.Color();

export default class RipplePond extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0c1a2b, fov: 45, far: 120, bloom: { strength: 0.35, radius: 0.4, threshold: 0.9 } });
		const s = this.stage;
		s.addLights({ sky: 0xdbeafe, ground: 0x0f172a, intensity: 1.1, sunIntensity: 1.8, sunPosition: [-6, 14, 8] });
		s.camera.position.set(0, 21, 17);
		s.camera.lookAt(0, 0, 0.5);
		this.h = new Float32Array(N * N);
		this.v = new Float32Array(N * N);
		this.solid = new Uint8Array(N * N);
		// the water: one instanced tile per grid cell
		this.tiles = new THREE.InstancedMesh(geo.box(CELL * 0.98, 1, CELL * 0.98), s.own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.1 })), N * N);
		this.tiles.frustumCulled = false;
		s.scene.add(this.tiles);
		// shore and pond bed
		const bed = s.mesh(geo.box(1, 1, 1), standard(0x3f6212, { roughness: 0.9 }));
		bed.scale.set(SIZE + 3, 1, SIZE + 3);
		bed.position.y = -1.1;
		this.nest = new THREE.Group();
		s.scene.add(this.nest);
		const ring = s.mesh(geo.torus(NEST.r, 0.12, 8, 40), standard(0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.8 }), this.nest);
		ring.rotation.x = Math.PI / 2;
		for (let i = 0; i < 14; i++) {
			const a = (i / 14) * Math.PI * 2;
			const reed = s.mesh(geo.cylinder(0.06, 0.08, 1.6, 6), standard(0x65a30d), this.nest);
			reed.position.set(Math.cos(a) * (NEST.r + 0.3), 0.6, Math.sin(a) * (NEST.r + 0.3));
		}
		this.nest.position.set(NEST.x, 0, NEST.z);
		this.rockGroup = new THREE.Group();
		s.scene.add(this.rockGroup);
		this.duckGroup = new THREE.Group();
		s.scene.add(this.duckGroup);
		this.particles = new Particles(s, { capacity: 300 });
		this.hud = h('div.hud-3d', h('span'), h('span'));
		this.hint = h('div.hint-3d', 'Tap the water to make ripples');
		this.ctx.root.append(this.hud, this.hint);
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => this.drop(e));
		this.reset();
	}

	reset() {
		this.running = false;
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	clearGroup(group) {
		const list = [...group.children];
		for (const o of list) { group.remove(o); o.traverse?.((c) => c !== o && c.dispose?.()); o.dispose?.(); }
	}

	load(i) {
		this.level = i;
		const L = LEVELS[i];
		this.time = L.time;
		this.h.fill(0);
		this.v.fill(0);
		this.solid.fill(0);
		this.clearGroup(this.rockGroup);
		this.clearGroup(this.duckGroup);
		this.rocks = L.rocks.map(([x, z, r]) => ({ x, z, r }));
		for (const r of this.rocks) {
			const m = this.stage.mesh(geo.icosa(1, 1), standard(0x78716c, { roughness: 0.85 }), this.rockGroup);
			m.position.set(r.x, 0.1, r.z);
			m.scale.set(r.r, r.r * 0.6, r.r);
			for (let gz = 0; gz < N; gz++) for (let gx = 0; gx < N; gx++) {
				const [wx, wz] = this.world(gx, gz);
				if (Math.hypot(wx - r.x, wz - r.z) < r.r) this.solid[gx + gz * N] = 1;
			}
		}
		this.ducks = [];
		for (let k = 0; k < L.ducks; k++) {
			const duck = new THREE.Group();
			const body = this.stage.mesh(geo.sphere(0.5, 18, 12), standard(0xfde047, { roughness: 0.4 }), duck);
			body.scale.set(1.2, 0.8, 1);
			const head = this.stage.mesh(geo.sphere(0.3, 14, 10), standard(0xfde047, { roughness: 0.4 }), duck);
			head.position.set(0.45, 0.45, 0);
			const beak = this.stage.mesh(geo.cone(0.12, 0.3, 8), standard(0xf97316), duck);
			beak.rotation.z = -Math.PI / 2;
			beak.position.set(0.8, 0.42, 0);
			this.duckGroup.add(duck);
			let x, z;
			do { x = -8 + Math.random() * 7; z = 2 + Math.random() * 6; } while (this.rocks.some((r) => Math.hypot(r.x - x, r.z - z) < r.r + 1));
			this.ducks.push({ mesh: duck, x, z, vx: 0, vz: 0, home: false, yaw: 0 });
		}
		this.paintHud();
		this.hint.hidden = false;
	}

	world(gx, gz) { return [(gx + 0.5) * CELL - SIZE / 2, (gz + 0.5) * CELL - SIZE / 2]; }
	gridAt(x, z) { return [Math.floor((x + SIZE / 2) / CELL), Math.floor((z + SIZE / 2) / CELL)]; }

	paintHud() {
		const home = this.ducks.filter((d) => d.home).length;
		this.hud.children[0].textContent = `Level ${this.level + 1}/${LEVELS.length} · Ducks ${home}/${this.ducks.length}`;
		this.hud.children[1].textContent = `${Math.max(0, Math.ceil(this.time))} s`;
	}

	drop(e) {
		if (!this.running || this.paused) return;
		const p = this.stage.pointOnGround(e, 0);
		if (!p) return;
		const [gx, gz] = this.gridAt(p.x, p.z);
		if (gx < 1 || gz < 1 || gx >= N - 1 || gz >= N - 1) return;
		this.hint.hidden = true;
		// a pebble: push the surface down in a small dimple
		for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
			const k = gx + dx + (gz + dz) * N;
			if (this.solid[k]) continue;
			this.h[k] -= 1.6 * Math.exp(-(dx * dx + dz * dz) / 2);
		}
		this.particles.emit(p.x, 0.2, p.z, { count: 14, color: 0xbfdbfe, speed: 3, size: 0.08, life: 0.6, gravity: -9, up: 3 });
		this.ctx.audio.play('splash');
	}

	update(dt) {
		this.particles.update(dt);
		this.waves(Math.min(dt, 1 / 30));
		this.paintWater();
		this.nest.rotation.y += dt * 0.3;
		if (!this.running) return;
		this.time -= dt;
		const H = this.h;
		for (const d of this.ducks) {
			if (d.home) {
				d.mesh.position.y = 0.15 + Math.sin(performance.now() / 300) * 0.05;
				continue;
			}
			// the slope of the water pushes the duck downhill
			const [gx, gz] = this.gridAt(d.x, d.z);
			const at = (x, z) => H[Math.max(0, Math.min(N - 1, x)) + Math.max(0, Math.min(N - 1, z)) * N];
			const sx = at(gx + 1, gz) - at(gx - 1, gz), sz = at(gx, gz + 1) - at(gx, gz - 1);
			d.vx -= sx * 22 * dt;
			d.vz -= sz * 22 * dt;
			d.vx *= 1 - 1.2 * dt;
			d.vz *= 1 - 1.2 * dt;
			d.x += d.vx * dt;
			d.z += d.vz * dt;
			const lim = SIZE / 2 - 0.8;
			if (Math.abs(d.x) > lim) { d.x = Math.sign(d.x) * lim; d.vx *= -0.5; }
			if (Math.abs(d.z) > lim) { d.z = Math.sign(d.z) * lim; d.vz *= -0.5; }
			for (const r of this.rocks) {
				const dx = d.x - r.x, dz = d.z - r.z, dist = Math.hypot(dx, dz), min = r.r + 0.6;
				if (dist < min && dist > 0) { d.x = r.x + (dx / dist) * min; d.z = r.z + (dz / dist) * min; const dot = d.vx * dx / dist + d.vz * dz / dist; if (dot < 0) { d.vx -= 1.5 * dot * dx / dist; d.vz -= 1.5 * dot * dz / dist; } }
			}
			const speed = Math.hypot(d.vx, d.vz);
			if (speed > 0.2) d.yaw = Math.atan2(-d.vz, d.vx);
			d.mesh.position.set(d.x, 0.15 + at(gx, gz) * 0.5, d.z);
			d.mesh.rotation.y += ((d.yaw - d.mesh.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 5);
			if (Math.hypot(d.x - NEST.x, d.z - NEST.z) < NEST.r - 0.4) {
				d.home = true;
				d.x = NEST.x + (Math.random() - 0.5) * 2;
				d.z = NEST.z + (Math.random() - 0.5) * 2;
				d.mesh.position.set(d.x, 0.15, d.z);
				this.score += 100;
				this.ctx.score(this.score);
				this.ctx.audio.play('coin');
				this.particles.emit(d.x, 0.8, d.z, { count: 30, colors: [0xfde047, 0xffffff], speed: 4, size: 0.1, life: 0.8, gravity: -6, up: 3 });
			}
		}
		this.paintHud();
		if (this.ducks.every((d) => d.home)) {
			const bonus = Math.round(this.time) * 10;
			this.score += bonus;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'All ducks home!', message: 'Every pond cleared.', score: this.score });
			this.load(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		} else if (this.time <= 0) {
			this.finish({ win: false, title: 'Time is up', message: `Level ${this.level + 1}: ${this.ducks.filter((d) => d.home).length} of ${this.ducks.length} ducks home.`, score: this.score });
		}
	}

	/** Damped wave equation; rocks and the pond edge reflect. */
	waves(dt) {
		const { h, v, solid } = this;
		const c2 = 60, damp = 1 - 0.55 * dt;
		for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
			const k = x + z * N;
			if (solid[k]) continue;
			const c = h[k];
			const l = solid[k - 1] ? c : h[k - 1], r = solid[k + 1] ? c : h[k + 1];
			const u = solid[k - N] ? c : h[k - N], d = solid[k + N] ? c : h[k + N];
			v[k] = (v[k] + (l + r + u + d - 4 * c) * c2 * dt) * damp;
		}
		for (let k = 0; k < N * N; k++) h[k] += v[k] * dt;
	}

	paintWater() {
		const { h, solid, tiles } = this;
		quat.identity();
		for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
			const k = x + z * N;
			const [wx, wz] = this.world(x, z);
			const height = solid[k] ? 0 : h[k];
			pos.set(wx, -0.5 + height * 0.25, wz);
			scl.set(1, 1, 1);
			matrix.compose(pos, quat, scl);
			tiles.setMatrixAt(k, matrix);
			const t = Math.max(-1, Math.min(1, height));
			col.setRGB(0.03 + t * 0.12 + Math.max(0, t) * 0.5, 0.16 + t * 0.14 + Math.max(0, t) * 0.45, 0.42 + t * 0.2 + Math.max(0, t) * 0.3);
			tiles.setColorAt(k, col);
		}
		tiles.instanceMatrix.needsUpdate = true;
		if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
	}

	render() { this.stage.render(); }

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.hint.remove();
	}
}
