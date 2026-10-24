// Table Tennis 3D (WAMR3D): a rally game seen from behind your bat. Move the bat with the
// mouse or a finger (or the arrow keys); the ball is returned when it reaches your bat,
// and where it meets the bat steers the shot. The ball must bounce once on each side.
// First to 11, win by two; the serve changes every two points.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, themed } from '../../engine/materials.js';
import { Particles, Trail3D } from '../../engine/effects.js';
import { pointerNdc } from '../../engine/input.js';
import { h } from '../../components/dom.js';

const HALF_L = 1.37, HALF_W = 0.76, NET_H = 0.15, BALL_R = 0.035;
const BAT_Z = 1.55, G = 6.5, BAT_R = 0.2;

export default class TableTennis extends Game {
	static realtime = true;

	async init() {
		// dev builds expose the open game for automated play-testing
		if (import.meta.env?.DEV) window.__pgGame = this;
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0f172a, fov: 50, far: 60, fog: { color: 0x0f172a, near: 8, far: 22 }, bloom: { strength: 0.5, radius: 0.4, threshold: 0.8 }, shadows: { extent: 3 } });
		const s = this.stage;
		s.addLights({ sky: 0xe0f2fe, ground: 0x1e293b, intensity: 0.9, sunIntensity: 1.4, sunPosition: [1, 6, 2] });
		s.camera.position.set(0, 1.25, 3.1);
		s.camera.lookAt(0, 0, -0.5);
		this.build();
		this.particles = new Particles(s, { capacity: 220 });
		this.trail = new Trail3D(this.particles, { color: 0xfde68a, rate: 50, size: 0.025, life: 0.25 });
		this.hud = h('div.hud-3d', h('span'), h('span'));
		this.hint = h('div.hint-3d', 'Move the bat into the ball’s path');
		this.ctx.root.append(this.hud, this.hint);
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.target = { x: 0, y: 0.25 };
		this.ndc = { x: 0, y: 0 };
		this.ctx.input.on(root, 'pointermove', (e) => this.aim(e));
		this.ctx.input.on(root, 'pointerdown', (e) => this.aim(e));
		this.reset();
	}

	build() {
		const s = this.stage;
		const floor = s.mesh(geo.plane(30, 30), standard(0x1e293b, { roughness: 0.9 }));
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.76;
		const top = s.mesh(geo.box(HALF_W * 2, 0.04, HALF_L * 2), standard(0x1d4ed8, { roughness: 0.45 }));
		top.position.y = -0.02;
		const white = basic(0xf8fafc);
		for (const [w, d, x, z] of [[HALF_W * 2, 0.02, 0, HALF_L - 0.01], [HALF_W * 2, 0.02, 0, -HALF_L + 0.01], [0.02, HALF_L * 2, HALF_W - 0.01, 0], [0.02, HALF_L * 2, -HALF_W + 0.01, 0], [0.006, HALF_L * 2, 0, 0]]) {
			const line = s.mesh(geo.box(w, 0.005, d), white);
			line.position.set(x, 0.002, z);
		}
		for (const [x, z] of [[-0.6, -1.1], [0.6, -1.1], [-0.6, 1.1], [0.6, 1.1]]) {
			const leg = s.mesh(geo.box(0.05, 0.74, 0.05), standard(0x334155));
			leg.position.set(x, -0.41, z);
		}
		const net = s.mesh(geo.box(HALF_W * 2 + 0.2, NET_H, 0.01), s.own(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.45 })));
		net.position.set(0, NET_H / 2, 0);
		const tape = s.mesh(geo.box(HALF_W * 2 + 0.2, 0.012, 0.014), white);
		tape.position.set(0, NET_H, 0);
		this.ball = s.mesh(geo.sphere(BALL_R, 16, 12), standard(0xfff7ed, { emissive: 0xfb923c, emissiveIntensity: 0.25, roughness: 0.3 }));
		this.shadow = s.mesh(geo.circle(BALL_R * 1.2, 16), s.own(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })));
		this.shadow.rotation.x = -Math.PI / 2;
		this.bats = [this.bat(themed('primary', { glow: 0.25 })), this.bat(standard(0xef4444, { roughness: 0.5 }))];
	}

	bat(material) {
		const s = this.stage;
		const group = new THREE.Group();
		const face = s.mesh(geo.cylinder(0.11, 0.11, 0.015, 28), material, group);
		face.rotation.x = Math.PI / 2;
		const handle = s.mesh(geo.box(0.035, 0.12, 0.025), standard(0x92400e), group);
		handle.position.y = -0.16;
		s.scene.add(group);
		return group;
	}

	aim(e) {
		pointerNdc(e, this.stage.renderer.domElement, this.ndc);
		this.target.x = this.ndc.x * 1.05;
		this.target.y = 0.05 + (this.ndc.y + 1) * 0.3;
	}

	reset() {
		this.running = false;
		this.points = [0, 0];
		this.serves = 0;
		this.me = { x: 0, y: 0.25, vx: 0 };
		this.cpu = { x: 0, y: 0.25 };
		this.ctx.score(0);
		this.serve();
	}

	serve() {
		const server = Math.floor(this.serves / 2) % 2;
		this.server = server;
		const z = server === 0 ? BAT_Z - 0.1 : -BAT_Z + 0.1;
		this.b = { x: server === 0 ? this.me.x : this.cpu.x, y: 0.25, z, vx: 0, vy: 0, vz: 0, live: false, wait: 0.9, hitter: server, bounced: false };
		this.updateHud();
	}

	updateHud() {
		const [a, b] = this.points;
		this.hud.children[0].textContent = `You ${a} – ${b} CPU`;
		this.hud.children[1].textContent = this.server === 0 ? 'Your serve' : 'CPU serve';
		this.ctx.info(`First to 11 · ${this.server === 0 ? 'your serve' : 'CPU serve'}`);
	}

	/** Sends the ball from its current spot to land at (tx, tz) on the far side. */
	launch(who, tx, tz, speed) {
		const b = this.b;
		const vz = (who === 0 ? -1 : 1) * speed;
		const t = Math.abs((tz - b.z) / vz);
		b.vx = (tx - b.x) / t;
		b.vz = vz;
		b.vy = (0.5 * G * t * t - b.y) / t;
		// make sure it clears the net
		const tn = Math.abs(b.z / vz);
		const yNet = b.y + b.vy * tn - 0.5 * G * tn * tn;
		if (yNet < NET_H + 0.06) b.vy += (NET_H + 0.06 - yNet) / tn;
		b.hitter = who;
		b.bounced = false;
		b.live = true;
		this.ctx.audio.play('bounce');
	}

	update(dt) {
		const input = this.ctx.input, b = this.b;
		this.particles.update(dt);
		// your bat
		const ax = input.axis();
		if (ax.x || ax.y) { this.target.x += ax.x * 2.2 * dt; this.target.y -= ax.y * 1.2 * dt; }
		this.target.x = Math.max(-1.1, Math.min(1.1, this.target.x));
		this.target.y = Math.max(0.03, Math.min(0.7, this.target.y));
		const px = this.me.x;
		this.me.x = damp(this.me.x, this.target.x, 0.35, dt);
		this.me.y = damp(this.me.y, this.target.y, 0.35, dt);
		this.me.vx = (this.me.x - px) / Math.max(dt, 1e-3);
		// the computer tracks where the ball will cross its bat plane
		const skill = { easy: 1.4, normal: 2.1, hard: 3 }[this.ctx.settings.difficulty ?? 'normal'] ?? 2.1;
		if (b.live && b.vz < 0) {
			const t = Math.max(0, (b.z + BAT_Z) / -b.vz);
			let x = b.x + b.vx * t, y = b.y + b.vy * t - 0.5 * G * t * t;
			if (y < 0.05) y = 0.15;
			const step = skill * dt;
			this.cpu.x += Math.max(-step, Math.min(step, x - this.cpu.x));
			this.cpu.y += Math.max(-step, Math.min(step, Math.min(0.6, y) - this.cpu.y));
		} else this.cpu.x = damp(this.cpu.x, 0, 0.05, dt);

		if (this.running) this.physics(dt);
		this.place(dt);
	}

	physics(dt) {
		const b = this.b;
		if (!b.live) {
			const bat = this.server === 0 ? this.me : this.cpu;
			b.x = bat.x; b.y = Math.max(0.2, bat.y);
			b.wait -= dt;
			if (b.wait <= 0) {
				const side = Math.random() < 0.5 ? -1 : 1;
				this.launch(this.server, side * (0.2 + Math.random() * 0.4), this.server === 0 ? -0.8 - Math.random() * 0.4 : 0.8 + Math.random() * 0.4, 3.4);
				this.hint.hidden = true;
			}
			return;
		}
		const steps = 3, h = dt / steps;
		for (let k = 0; k < steps && b.live; k++) {
			const prevZ = b.z;
			b.vy -= G * h;
			b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
			// table bounce
			if (b.y <= BALL_R && b.vy < 0 && Math.abs(b.x) <= HALF_W && Math.abs(b.z) <= HALF_L) {
				b.y = BALL_R;
				b.vy = -b.vy * 0.88;
				const side = b.z > 0 ? 0 : 1;
				this.ctx.audio.play('tick');
				if (side === b.hitter) return this.point(1 - b.hitter, 'Fault');
				if (b.bounced) return this.point(b.hitter, 'Double bounce');
				b.bounced = true;
			}
			// the net
			if (prevZ * b.z <= 0 && b.y < NET_H + BALL_R && Math.abs(b.x) < HALF_W + 0.1) return this.point(1 - b.hitter, 'Net');
			// bats
			for (const [who, bat, z] of [[0, this.me, BAT_Z], [1, this.cpu, -BAT_Z]]) {
				if (b.hitter === who) continue;
				const crossed = who === 0 ? prevZ < z && b.z >= z : prevZ > z && b.z <= z;
				if (!crossed) continue;
				const dx = b.x - bat.x, dy = b.y - bat.y;
				if (b.bounced && Math.hypot(dx, dy) < BAT_R + (who === 1 ? 0.03 : 0.04)) {
					b.z = z;
					if (who === 0) {
						const tx = Math.max(-HALF_W + 0.08, Math.min(HALF_W - 0.08, dx * 3.2 + this.me.vx * 0.12));
						this.launch(0, tx, -0.5 - Math.random() * 0.7, 3.6 + Math.min(1.4, Math.abs(this.me.vx) * 0.25));
						this.particles.emit(b.x, b.y, b.z, { count: 10, color: 0xfde68a, speed: 1.2, size: 0.02, life: 0.3, gravity: -2 });
					} else {
						const spread = { easy: 0.5, normal: 0.75, hard: 0.95 }[this.ctx.settings.difficulty ?? 'normal'] ?? 0.75;
						// the computer sometimes overhits: the ball sails long
						const error = { easy: 0.14, normal: 0.07, hard: 0.03 }[this.ctx.settings.difficulty ?? 'normal'] ?? 0.07;
						const long = Math.random() < error;
						this.launch(1, (Math.random() * 2 - 1) * HALF_W * spread, long ? HALF_L + 0.2 + Math.random() * 0.3 : 0.5 + Math.random() * 0.7, 3.2 + spread);
					}
					break;
				}
			}
			if (b.y < -0.7 || Math.abs(b.z) > 4) {
				// off the table: the receiver loses only if the ball had bounced on their side
				return this.point(b.bounced ? b.hitter : 1 - b.hitter, b.bounced ? 'Missed!' : 'Out');
			}
		}
		this.trail.update(b.x, b.y, b.z, dt);
	}

	point(winner, why) {
		this.b.live = false;
		this.points[winner]++;
		this.serves++;
		this.ctx.score(this.points[0]);
		this.ctx.audio.play(winner === 0 ? 'score' : 'hit');
		this.ctx.fx.banner(`${why} · ${winner === 0 ? 'your point' : 'CPU point'}`);
		const [a, c] = this.points;
		if ((a >= 11 || c >= 11) && Math.abs(a - c) >= 2) {
			const win = a > c;
			this.ctx.audio.play(win ? 'cheer' : 'lose');
			if (win) this.ctx.fx.confetti({ count: 70 });
			this.updateHud();
			return this.finish({ win, title: win ? 'Match won!' : 'The computer wins', message: `Final score ${a}–${c}.`, score: a * 10 - c * 3 + (win ? 50 : 0) });
		}
		this.serve();
		this.b.wait = 1.2;
	}

	place(dt) {
		const b = this.b;
		this.ball.position.set(b.x, b.y, b.z);
		const onTable = Math.abs(b.x) <= HALF_W && Math.abs(b.z) <= HALF_L;
		this.shadow.visible = onTable;
		this.shadow.position.set(b.x, 0.004, b.z);
		const [mine, theirs] = this.bats;
		mine.position.set(this.me.x, this.me.y, BAT_Z);
		mine.rotation.z = -this.me.x * 0.4;
		theirs.position.set(this.cpu.x, this.cpu.y, -BAT_Z);
		theirs.rotation.z = this.cpu.x * 0.4;
		// the camera sways a little with your bat
		const cam = this.stage.camera;
		cam.position.x = damp(cam.position.x, this.me.x * 0.35, 0.08, dt);
		cam.lookAt(this.me.x * 0.15, 0, -0.5);
	}

	render() { this.stage.render(); }

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.hint.remove();
	}
}
