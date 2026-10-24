// Neon Hockey: air hockey on a glowing 3D table (WAMR3D) against a computer opponent.
// The puck leaves a light trail, hits throw sparks, goals shake the camera.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette } from '../../engine/materials.js';
import { Particles, Shake } from '../../engine/effects.js';
import { clamp } from '../core/physics.js';
import { h } from '../../components/dom.js';

const W = 6, L = 10, GOAL = 2.2, PUCK = 0.3, MALLET = 0.45, TARGET = 7;
const AI = { easy: { speed: 4.5, aim: 0.5 }, normal: { speed: 6.5, aim: 0.75 }, hard: { speed: 9, aim: 1 } };

export default class NeonHockey extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x05060f, fov: 50, far: 80, bloom: { strength: 0.6, radius: 0.35, threshold: 0.8 }, shadows: { extent: 7 } });
		this.stage.addLights({ sky: 0x93c5fd, ground: 0x0b0b1a, intensity: 0.7, sunIntensity: 1.0, sunPosition: [0, 10, 4] });
		this.board = h('div.hud-3d', h('span'));
		this.callout = h('div');
		this.ctx.root.append(this.board, this.callout);
		this.build();
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		const follow = (e) => {
			const p = this.stage.pointOnGround(e, 0.1);
			if (p) this.target = { x: p.x, z: p.z };
		};
		this.ctx.input.on(root, 'pointermove', follow);
		this.ctx.input.on(root, 'pointerdown', follow);
		this.reset();
	}

	build() {
		const s = this.stage;
		s.camera.position.set(0, 9.5, 8.6);
		s.camera.lookAt(0, 0, 0.6);
		const table = s.mesh(geo.box(W + 0.6, 0.4, L + 0.6), standard(0x0b1026, { roughness: 0.25, metalness: 0.3 }));
		table.position.y = -0.2;
		const lineMat = basic(0x334155);
		const centre = s.mesh(geo.box(W, 0.01, 0.05), lineMat);
		centre.position.y = 0.005;
		const circle = s.mesh(geo.ring(0.9, 0.96, 48), lineMat);
		circle.rotation.x = -Math.PI / 2;
		circle.position.y = 0.006;
		const rail = (x, z, w, d, color) => {
			const m = s.mesh(geo.box(w, 0.25, d), standard(color, { emissive: color, emissiveIntensity: 1.2, roughness: 0.3 }));
			m.position.set(x, 0.12, z);
		};
		for (const side of [-1, 1]) rail(side * (W / 2 + 0.1), 0, 0.2, L + 0.4, palette.violet);
		// end rails with a goal gap in the middle
		for (const end of [-1, 1]) {
			const color = end > 0 ? palette.blue : palette.pink;
			const seg = (W - GOAL) / 2;
			for (const dir of [-1, 1]) rail(dir * (GOAL / 2 + seg / 2), end * (L / 2 + 0.1), seg, 0.2, color);
			const mouth = s.mesh(geo.box(GOAL, 0.02, 0.4), basic(end > 0 ? 0x1e3a8a : 0x831843));
			mouth.position.set(0, 0.01, end * (L / 2 + 0.2));
		}
		const glow = new THREE.PointLight(palette.violet, 6, 14);
		glow.position.set(0, 3, 0);
		s.scene.add(glow);
		this.glow = glow;
		this.flare = 0;

		const mallet = (color) => {
			const g = new THREE.Group();
			s.mesh(geo.cylinder(MALLET, MALLET, 0.14, 32), standard(color, { emissive: color, emissiveIntensity: 0.8, roughness: 0.3 }), g).position.y = 0.07;
			s.mesh(geo.cylinder(0.16, 0.2, 0.32, 20), standard(0xe2e8f0, { roughness: 0.3, metalness: 0.5 }), g).position.y = 0.3;
			s.scene.add(g);
			return g;
		};
		this.playerMesh = mallet(palette.blue);
		this.aiMesh = mallet(palette.pink);
		this.puckMesh = s.mesh(geo.cylinder(PUCK, PUCK, 0.08, 32), standard(0xf8fafc, { emissive: 0xfef08a, emissiveIntensity: 0.9, roughness: 0.2 }));
		this.puckLight = new THREE.PointLight(0xfef08a, 2, 3);
		s.scene.add(this.puckLight);
		this.particles = new Particles(s, { capacity: 500 });
		this.shake = new Shake();
	}

	reset() {
		this.running = false;
		this.scores = { you: 0, cpu: 0 };
		this.ai = AI[this.ctx.settings.difficulty] ?? AI.normal;
		this.player = { x: 0, z: L / 2 - 1.2, vx: 0, vz: 0 };
		this.cpu = { x: 0, z: -L / 2 + 1.2, vx: 0, vz: 0 };
		this.target = null;
		this.particles.clear();
		this.serve(1);
		this.paint();
		this.ctx.score(0);
	}

	serve(towards) {
		this.puck = { x: 0, z: towards * 1.2, vx: 0, vz: 0, wait: 0.8 };
	}

	paint() {
		this.board.firstChild.textContent = `You ${this.scores.you} – ${this.scores.cpu} CPU · first to ${TARGET}`;
		this.ctx.info(`${this.scores.you} – ${this.scores.cpu}`);
	}

	pop(text) { this.callout.replaceChildren(h('div.big-callout', text)); }

	moveMallet(m, tx, tz, maxSpeed, dt, zMin, zMax) {
		const ox = m.x, oz = m.z;
		const dx = tx - m.x, dz = tz - m.z;
		const dist = Math.hypot(dx, dz), step = maxSpeed * dt;
		if (dist > step) { m.x += (dx / dist) * step; m.z += (dz / dist) * step; }
		else { m.x = tx; m.z = tz; }
		m.x = clamp(m.x, -W / 2 + MALLET, W / 2 - MALLET);
		m.z = clamp(m.z, zMin, zMax);
		m.vx = (m.x - ox) / Math.max(dt, 1e-4);
		m.vz = (m.z - oz) / Math.max(dt, 1e-4);
	}

	strike(m) {
		const p = this.puck;
		const dx = p.x - m.x, dz = p.z - m.z;
		const dist = Math.hypot(dx, dz), min = PUCK + MALLET;
		if (dist >= min || dist === 0) return;
		const nx = dx / dist, nz = dz / dist;
		p.x = m.x + nx * min; p.z = m.z + nz * min;
		const rel = (p.vx - m.vx) * nx + (p.vz - m.vz) * nz;
		if (rel < 0) {
			p.vx -= 1.9 * rel * nx;
			p.vz -= 1.9 * rel * nz;
			const speed = Math.hypot(p.vx, p.vz);
			if (speed > 16) { p.vx *= 16 / speed; p.vz *= 16 / speed; }
			this.ctx.audio.play(Math.abs(rel) > 6 ? 'punch' : 'bounce');
			m.squash = 1;
			this.particles.emit(p.x - nx * PUCK, 0.1, p.z - nz * PUCK, { count: 14, color: 0xfef08a, speed: 4, size: 0.06, life: 0.35, gravity: -6, spread: 0.3 });
		}
	}

	update(dt) {
		this.particles.update(dt);
		this.shake.update(dt);
		// the arena light flares after a goal and settles back
		this.flare = Math.max(0, this.flare - dt * 1.2);
		this.glow.intensity = 6 + this.flare * 30;
		for (const m of [this.player, this.cpu]) m.squash = Math.max(0, (m.squash ?? 0) - dt * 6);
		const cam = this.stage.camera;
		cam.position.set(this.shake.x, 9.5 + this.shake.y, 8.6);
		cam.lookAt(0, 0, 0.6);
		if (this.running) {
			const input = this.ctx.input.axis();
			let tx = this.player.x, tz = this.player.z;
			if (input.x || input.y) { this.target = null; tx += input.x * 2; tz += input.y * 2; }
			else if (this.target) { tx = this.target.x; tz = this.target.z; }
			this.moveMallet(this.player, tx, tz, 14, dt, 0.4, L / 2 - MALLET);

			// the computer guards its goal, attacking when the puck is on its side
			const p = this.puck;
			let ax = clamp(p.x * this.ai.aim, -GOAL / 2, GOAL / 2), az = -L / 2 + 1;
			if (p.z < 0 && p.vz < 6) { ax = p.x; az = p.z - 0.4; }
			this.moveMallet(this.cpu, ax, az, this.ai.speed, dt, -L / 2 + MALLET, -0.4);

			if (p.wait > 0) p.wait -= dt;
			else {
				const steps = 4, h = dt / steps;
				for (let s = 0; s < steps; s++) {
					p.x += p.vx * h; p.z += p.vz * h;
					p.vx *= 1 - 0.25 * h; p.vz *= 1 - 0.25 * h;
					if (Math.abs(p.x) > W / 2 - PUCK) { p.x = Math.sign(p.x) * (W / 2 - PUCK); p.vx = -p.vx * 0.9; this.wallHit(); }
					if (Math.abs(p.z) > L / 2 - PUCK) {
						if (Math.abs(p.x) < GOAL / 2 - PUCK * 0.3) {
							if (Math.abs(p.z) > L / 2 + 0.3) return this.goal(p.z < 0);
						} else { p.z = Math.sign(p.z) * (L / 2 - PUCK); p.vz = -p.vz * 0.9; this.wallHit(); }
					}
					this.strike(this.player);
					this.strike(this.cpu);
				}
				if (Math.hypot(p.vx, p.vz) > 4) this.particles.emit(p.x, 0.05, p.z, { count: 1, color: 0xfde047, speed: 0.2, size: 0.12, life: 0.35, gravity: 0 });
			}
		}
		this.playerMesh.position.set(this.player.x, 0, this.player.z);
		this.aiMesh.position.set(this.cpu.x, 0, this.cpu.z);
		for (const [mesh, m] of [[this.playerMesh, this.player], [this.aiMesh, this.cpu]]) {
			const s = m.squash ?? 0;
			mesh.scale.set(1 + s * 0.18, 1 - s * 0.3, 1 + s * 0.18);
		}
		this.puckMesh.position.set(this.puck.x, 0.04, this.puck.z);
		this.puckLight.position.set(this.puck.x, 0.6, this.puck.z);
	}

	wallHit() {
		if (Math.hypot(this.puck.vx, this.puck.vz) > 3) this.ctx.audio.play('blip');
	}

	goal(forPlayer) {
		const side = forPlayer ? 'you' : 'cpu';
		this.scores[side]++;
		this.paint();
		this.ctx.score(this.scores.you);
		this.shake.kick(0.8);
		this.ctx.audio.play(forPlayer ? 'cheer' : 'buzzer');
		this.flare = 1;
		this.glow.color.set(forPlayer ? palette.blue : palette.pink);
		setTimeout(() => this.glow?.color.set(palette.violet), 1200);
		this.particles.emit(this.puck.x, 0.3, Math.sign(this.puck.z) * L / 2, { count: 90, color: forPlayer ? palette.blue : palette.pink, speed: 7, size: 0.12, life: 1, gravity: -5, up: 2 });
		this.pop(forPlayer ? 'GOAL!' : 'Conceded');
		if (this.scores[side] >= TARGET) {
			const won = forPlayer;
			return this.finish({ win: won, title: won ? 'You win the match!' : 'The computer wins', message: `Final score ${this.scores.you} – ${this.scores.cpu}.`, score: this.scores.you, record: won });
		}
		this.serve(forPlayer ? -1 : 1);
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.board.remove();
		this.callout.remove();
	}
}
