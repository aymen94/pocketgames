// Traffic Rush: steer through four lanes of highway traffic in 3D (WAMR3D). Cars, lane
// dashes and roadside trees are pooled and recycled as the road streams past.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette } from '../../engine/materials.js';
import { makeCar } from './car-model.js';
import { h } from '../../components/dom.js';
import { clamp } from '../core/physics.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';

const LANE = 2.6, LANES = [-1.5, -0.5, 0.5, 1.5].map((k) => k * LANE), EDGE = 2 * LANE - 1;
const TRAFFIC = { light: 1.25, normal: 0.9, heavy: 0.62 };
const PAINTS = [0x60a5fa, 0xf472b6, 0xfbbf24, 0x34d399, 0xa78bfa, 0xe2e8f0, 0xf97316, 0x22d3ee];

export default class TrafficRush extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x9cc7ff, fov: 60, far: 220, fog: { color: 0x9cc7ff, near: 60, far: 180 } });
		this.stage.addLights({ sky: 0xdbeafe, ground: 0x3f6212, intensity: 1.3, sunIntensity: 2 });
		this.hud = h('div.hud-3d', h('span', '0 km/h'));
		this.callout = h('div');
		this.ctx.root.append(this.hud, this.callout);
		this.build();
		// touch: hold the left or right half of the road to steer
		const root = this.ctx.root;
		this.ctx.input.on(root, 'pointerdown', (e) => {
			const rect = root.getBoundingClientRect();
			this.touch = e.clientX < rect.left + rect.width / 2 ? -1 : 1;
		});
		this.ctx.input.on(window, 'pointerup', () => { this.touch = 0; });
		this.reset();
	}

	build() {
		const { camera } = this.stage;
		camera.position.set(0, 4.6, 9);
		camera.lookAt(0, 0.5, -12);
		const road = this.stage.mesh(geo.box(4 * LANE + 1.2, 0.1, 400), standard(palette.asphalt, { roughness: 0.9 }));
		road.position.set(0, -0.05, -150);
		const grass = this.stage.mesh(geo.plane(300, 400), standard(0x4d7c0f, { roughness: 1 }));
		grass.rotation.x = -Math.PI / 2;
		grass.position.set(0, -0.12, -150);
		for (const x of [-(2 * LANE + 0.45), 2 * LANE + 0.45]) {
			const line = this.stage.mesh(geo.box(0.18, 0.02, 400), basic(0xf8fafc));
			line.position.set(x, 0.02, -150);
			const rail = this.stage.mesh(geo.box(0.15, 0.5, 400), standard(0x94a3b8, { metalness: 0.6, roughness: 0.3 }));
			rail.position.set(x * 1.07, 0.45, -150);
		}
		this.dashes = [];
		for (let i = 0; i < 30; i++) for (const x of [-LANE, 0, LANE]) {
			const dash = this.stage.mesh(geo.box(0.14, 0.02, 2.4), basic(x === 0 ? 0xfacc15 : 0xe5e7eb));
			dash.position.set(x, 0.02, -i * 7);
			this.dashes.push(dash);
		}
		this.trees = [];
		const trunk = standard(0x7c4a24, { roughness: 1 });
		const leaves = [standard(0x166534, { roughness: 0.9 }), standard(0x15803d, { roughness: 0.9 })];
		for (let i = 0; i < 36; i++) {
			const tree = new THREE.Group();
			this.stage.mesh(geo.cylinder(0.2, 0.25, 1.4, 8), trunk, tree).position.y = 0.7;
			const crown = this.stage.mesh(geo.cone(1.3, 3, 9), leaves[i % 2], tree);
			crown.position.y = 2.8;
			const side = i % 2 ? 1 : -1;
			tree.position.set(side * (2 * LANE + 4 + Math.random() * 12), 0, -i * 6 - Math.random() * 4);
			tree.scale.setScalar(0.8 + Math.random() * 0.6);
			this.stage.scene.add(tree);
			this.trees.push(tree);
		}
		this.player = makeCar(this.stage, palette.coral, { lights: true });
		this.particles = new Particles(this.stage, { capacity: 500 });
		this.shake = new Shake();
		this.exhaust = [-0.5, 0.5].map(() => new Trail3D(this.particles, { color: 0x94a3b8, rate: 18, size: 0.12, life: 0.4 }));
		this.fov = 60;
		this.traffic = [];
		for (let i = 0; i < 16; i++) {
			const car = makeCar(this.stage, PAINTS[i % PAINTS.length]);
			car.rotation.y = 0; // same direction as the player
			car.visible = false;
			this.traffic.push({ car, active: false, lane: 0, z: 0, speed: 0, passed: false });
		}
	}

	reset() {
		this.running = false;
		this.x = 0;
		this.speed = 22;
		this.distance = 0;
		this.bonus = 0;
		this.spawn = 0.5;
		this.touch = 0;
		this.steer = 0;
		this.particles?.clear();
		this.player.visible = true;
		if (this.fov) { this.fov = 60; this.stage.camera.fov = 60; this.stage.camera.updateProjectionMatrix(); }
		for (const t of this.traffic) { t.active = false; t.car.visible = false; }
		this.player.position.set(0, 0, 0);
		this.player.rotation.set(0, 0, 0);
		this.ctx.score(0);
	}

	score() {
		return Math.floor(this.distance / 5) + this.bonus;
	}

	pop(text) {
		const el = h('div.big-callout', text);
		this.callout.replaceChildren(el);
	}

	update(dt) {
		this.particles.update(dt);
		this.shake.update(dt);
		this.stage.camera.position.set(this.x * 0.5 + this.shake.x, 4.6 + this.shake.y, 9);
		this.stage.camera.lookAt(this.x * 0.3, 0.5, -12);
		if (!this.running) return;
		this.speed = Math.min(22 + this.distance / 90, 60);
		const move = this.speed * dt;
		this.distance += move;

		const input = this.ctx.input.axis().x || this.touch;
		this.steer = damp(this.steer, input, 0.25, dt);
		this.x = clamp(this.x + this.steer * (9 + this.speed * 0.12) * dt, -EDGE, EDGE);
		this.player.position.x = this.x;
		this.player.rotation.y = -this.steer * 0.18;
		this.player.rotation.z = this.steer * 0.04;
		// exhaust from both pipes, thicker at speed; the view widens as you go faster
		this.exhaust.forEach((trail, k) => trail.update(this.x + (k ? 0.5 : -0.5), 0.35, 2.2, dt, this.speed / 40));
		const fov = 60 + (this.speed - 22) * 0.35;
		if (Math.abs(fov - this.fov) > 0.15) { this.fov = fov; this.stage.camera.fov = fov; this.stage.camera.updateProjectionMatrix(); }

		for (const d of this.dashes) { d.position.z += move; if (d.position.z > 10) d.position.z -= 210; }
		for (const t of this.trees) { t.position.z += move; if (t.position.z > 12) t.position.z -= 216; }

		this.spawn -= dt;
		if (this.spawn <= 0) {
			this.spawn = (TRAFFIC[this.ctx.settings.traffic] ?? 0.9) * (0.8 + Math.random() * 0.5) * Math.max(0.55, 1 - this.distance / 6000);
			this.spawnCar();
		}

		for (const t of this.traffic) {
			if (!t.active) continue;
			t.z += (this.speed - t.speed) * dt;
			t.car.position.z = t.z;
			if (t.z > 14) { t.active = false; t.car.visible = false; continue; }
			const dx = Math.abs(t.car.position.x - this.x), dz = Math.abs(t.z);
			if (dx < 1.75 && dz < 3.9) return this.crash();
			if (!t.passed && t.z > 4) {
				t.passed = true;
				if (dx < 2.5) {
					this.bonus += 25;
					this.ctx.audio.play('whip');
					this.pop('Near miss! +25');
					// sparks between the two cars
					const side = Math.sign(t.car.position.x - this.x) || 1;
					this.particles.emit(this.x + side * 0.95, 0.6, 0, { count: 22, colors: [0xfde047, 0xffffff, 0xfb923c], speed: 5, size: 0.07, life: 0.35, gravity: -12 });
					this.shake.kick(0.15);
				}
			}
		}
		this.hud.firstChild.textContent = `${Math.round(this.speed * 3.6)} km/h`;
		this.ctx.score(this.score());
	}

	spawnCar() {
		const free = this.traffic.find((t) => !t.active);
		if (!free) return;
		// never fill all four lanes near the spawn point
		const blocked = new Set(this.traffic.filter((t) => t.active && t.z < -95).map((t) => t.lane));
		const lanes = [0, 1, 2, 3].filter((l) => !blocked.has(l));
		if (lanes.length <= 1) return;
		const lane = lanes[Math.floor(Math.random() * lanes.length)];
		Object.assign(free, { active: true, lane, z: -130, speed: 10 + Math.random() * 9, passed: false });
		free.car.visible = true;
		free.car.position.set(LANES[lane], 0, free.z);
	}

	crash() {
		this.ctx.audio.play('crash');
		this.player.rotation.y = 0.5;
		this.pop('CRASH!');
		this.particles.emit(this.x, 0.8, -1.5, { count: 80, colors: [0xfb923c, 0xfde047, 0xffffff, palette.coral], speed: 9, size: 0.14, life: 1, gravity: -10, up: 3 });
		this.particles.emit(this.x, 0.8, -1.5, { count: 20, colors: [0x334155, 0x64748b], speed: 2, size: 0.4, life: 1.2, gravity: 2 });
		this.shake.kick(1.1);
		this.finish({ win: false, title: 'Crashed!', message: `${(this.distance / 1000).toFixed(2)} km driven, ${this.bonus / 25} near misses.`, score: this.score() });
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.callout.remove();
	}
}
