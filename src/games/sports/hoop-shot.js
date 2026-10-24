// Hoop Shot: swipe to shoot in a 3D arena (WAMR3D). The ball flies under gravity and
// bounces off the floor, backboard and rim; a clean swish scores more, streaks double up.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { Countdown } from '../core/timer.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const G = 9.8, BALL_R = 0.12, RIM = { x: 0, y: 3.05, z: 0, r: 0.23, tube: 0.018 };
const BOARD_Z = -0.38;
const SPOTS = [[0, 4.6], [-2.4, 4.4], [2.4, 4.4], [-1.4, 6.2], [1.4, 6.2], [0, 7]];

export default class HoopShot extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0f1530, fov: 52, fog: { color: 0x0f1530, near: 18, far: 40 }, shadows: { extent: 8 } });
		this.stage.addLights({ sky: 0xfff4e0, ground: 0x2a1a10, intensity: 1.2, sunIntensity: 1.4, sunPosition: [3, 10, 6] });
		this.hint = h('div.hint-3d', 'Swipe up to shoot');
		this.callout = h('div');
		this.ctx.root.append(this.hint, this.callout);
		this.build();
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => { this.swipe = { x: e.clientX, y: e.clientY, t: performance.now() }; });
		this.ctx.input.on(root, 'pointerup', (e) => this.release(e));
		this.ctx.input.on(root, 'pointercancel', () => { this.swipe = null; });
		this.reset();
	}

	build() {
		const s = this.stage;
		const floor = s.mesh(geo.box(16, 0.1, 18), standard(0xc98d4e, { roughness: 0.55 }));
		floor.position.set(0, -0.05, 3);
		const paint = s.mesh(geo.box(4.9, 0.012, 5.8), standard(0x2563eb, { roughness: 0.6 }));
		paint.position.set(0, 0.006, 2.2);
		const arc = s.mesh(s.own(new THREE.RingGeometry(6.6, 6.68, 64, 1, Math.PI, Math.PI)), basic(0xffffff));
		arc.rotation.x = -Math.PI / 2;
		arc.position.set(0, 0.014, 0.4);
		const wall = s.mesh(geo.box(16, 8, 0.2), standard(0x1e2a5a, { roughness: 0.9 }));
		wall.position.set(0, 4, -3);
		for (let i = 0; i < 5; i++) {
			const banner = s.mesh(geo.box(1.6, 0.6, 0.05), standard([0xf472b6, 0xfbbf24, 0x34d399, 0x60a5fa, 0xa78bfa][i], { emissive: 0x111111 }));
			banner.position.set(-5 + i * 2.5, 6.2, -2.88);
		}
		const pole = s.mesh(geo.cylinder(0.08, 0.1, 3.4, 12), standard(0x94a3b8, { metalness: 0.7, roughness: 0.3 }));
		pole.position.set(0, 1.7, -1.4);
		const arm = s.mesh(geo.box(0.12, 0.12, 1.0), standard(0x94a3b8, { metalness: 0.7, roughness: 0.3 }));
		arm.position.set(0, 3.3, -0.9);
		const board = s.mesh(geo.box(1.8, 1.05, 0.05), standard(0xf8fafc, { roughness: 0.25, transparent: true, opacity: 0.92 }));
		board.position.set(0, 3.45, BOARD_Z - 0.025);
		const square = s.mesh(geo.box(0.59, 0.45, 0.01), basic(0xef4444));
		square.position.set(0, 3.3, BOARD_Z + 0.002);
		const inner = s.mesh(geo.box(0.53, 0.39, 0.012), basic(0xf8fafc));
		inner.position.set(0, 3.3, BOARD_Z + 0.004);
		const rim = s.mesh(geo.torus(RIM.r, RIM.tube, 8, 40), standard(0xf97316, { metalness: 0.5, roughness: 0.3 }));
		rim.rotation.x = Math.PI / 2;
		rim.position.set(RIM.x, RIM.y, RIM.z);
		const net = s.mesh(s.own(new THREE.CylinderGeometry(RIM.r, RIM.r * 0.6, 0.42, 16, 3, true)), standard(0xffffff, { transparent: true, opacity: 0.45, wireframe: true, side: THREE.DoubleSide }));
		net.position.set(RIM.x, RIM.y - 0.22, RIM.z);
		this.net = net;

		this.ball = new THREE.Group();
		s.mesh(geo.sphere(BALL_R, 28, 18), standard(0xf97316, { roughness: 0.75 }), this.ball);
		const seam = standard(0x3b1606, { roughness: 0.9 });
		for (const [rx, ry] of [[Math.PI / 2, 0], [0, 0], [0, Math.PI / 2]]) {
			const ring = s.mesh(geo.torus(BALL_R, 0.004, 4, 32), seam, this.ball);
			ring.rotation.set(rx, ry, 0);
		}
		s.scene.add(this.ball);
		this.shadow = s.mesh(geo.circle(BALL_R * 1.1, 20), basic(0x000000, { transparent: true, opacity: 0.35 }));
		this.particles = new Particles(s, { capacity: 500 });
		this.shake = new Shake();
		this.trail = new Trail3D(this.particles, { color: 0xfdba74, rate: 40, size: 0.03, life: 0.3 });
		this.flames = new Trail3D(this.particles, { color: 0xf97316, rate: 70, size: 0.06, life: 0.35 });
		this.shadow.rotation.x = -Math.PI / 2;
		this.shadow.position.y = 0.012;
	}

	reset() {
		this.running = false;
		this.clock = new Countdown(+this.ctx.settings.time || 60);
		this.points = 0;
		this.streak = 0;
		this.made = 0;
		this.shots = 0;
		this.spot = 0;
		this.netSwing = 0;
		this.camX = SPOTS[0][0];
		this.camZ = SPOTS[0][1];
		this.ready();
		this.ctx.score(0);
		this.info();
		this.hint.hidden = false;
	}

	info() {
		this.ctx.info(`${Math.ceil(this.clock.left)} s · ${this.made}/${this.shots}${this.streak >= 3 ? ' · Hot streak ×2' : ''}`);
	}

	ready() {
		const [x, z] = SPOTS[this.spot % SPOTS.length];
		this.shooter = { x, z };
		this.b = { x, y: 1.7, z: z - 0.5, vx: 0, vy: 0, vz: 0, flying: false, t: 0, touched: false, scored: false, below: false };
		this.ball.position.set(this.b.x, this.b.y, this.b.z);
	}

	release(e) {
		const start = this.swipe;
		this.swipe = null;
		if (!start || !this.running || this.paused || this.b.flying) return;
		const rect = this.ctx.root.getBoundingClientRect();
		const dx = (e.clientX - start.x) / rect.height, dy = (start.y - e.clientY) / rect.height;
		if (dy < 0.06) return;
		this.hint.hidden = true;
		this.shoot(dy, dx);
	}

	/** Launches toward the rim: a perfect swipe (~38% of the height, straight) is a make. */
	shoot(length, side) {
		const b = this.b;
		const tx = RIM.x - b.x, tz = RIM.z - b.z;
		const d = Math.hypot(tx, tz), hgt = RIM.y + 0.02 - b.y;
		const angle = (52 * Math.PI) / 180;
		const ideal = Math.sqrt((G * d * d) / (2 * Math.cos(angle) ** 2 * (d * Math.tan(angle) - hgt)));
		const power = Math.max(0.55, Math.min(1.45, length / 0.38));
		const speed = ideal * (1 + (power - 1) * 0.16);
		const yaw = Math.atan2(tx, tz) + side * 0.5;
		const horizontal = speed * Math.cos(angle);
		b.vx = Math.sin(yaw) * horizontal;
		b.vz = Math.cos(yaw) * horizontal;
		b.vy = speed * Math.sin(angle);
		b.flying = true;
		b.t = 0;
		this.shots++;
		this.ctx.audio.play('swoosh');
		this.info();
	}

	pop(text) {
		this.callout.replaceChildren(h('div.big-callout', text));
	}

	collideRim(b) {
		// closest point on the rim circle to the ball centre
		const dx = b.x - RIM.x, dz = b.z - RIM.z;
		const radial = Math.hypot(dx, dz) || 1e-6;
		const px = RIM.x + (dx / radial) * RIM.r, pz = RIM.z + (dz / radial) * RIM.r;
		const nx = b.x - px, ny = b.y - RIM.y, nz = b.z - pz;
		const dist = Math.hypot(nx, ny, nz);
		const min = BALL_R + RIM.tube;
		if (dist >= min || dist === 0) return;
		const ux = nx / dist, uy = ny / dist, uz = nz / dist;
		b.x += ux * (min - dist); b.y += uy * (min - dist); b.z += uz * (min - dist);
		const dot = b.vx * ux + b.vy * uy + b.vz * uz;
		if (dot < 0) {
			b.vx -= 1.55 * dot * ux; b.vy -= 1.55 * dot * uy; b.vz -= 1.55 * dot * uz;
			if (!b.touched) {
				this.ctx.audio.play('blockhit');
				this.particles.emit(px, RIM.y, pz, { count: 12, colors: [0xfb923c, 0xfde047], speed: 2.5, size: 0.025, life: 0.3, gravity: -8 });
			}
			b.touched = true;
		}
	}

	update(dt) {
		this.netSwing = damp(this.netSwing, 0, 0.08, dt);
		this.net.scale.set(1 - this.netSwing * 0.15, 1 + this.netSwing * 0.25, 1 - this.netSwing * 0.15);
		this.camX = damp(this.camX, this.shooter.x * 0.85, 0.06, dt);
		this.camZ = damp(this.camZ, this.shooter.z + 1.6, 0.06, dt);
		this.particles.update(dt);
		this.shake.update(dt);
		// real shadows on High replace the painted blob
		this.shadow.visible = !this.stage.shadows;
		this.stage.camera.position.set(this.camX + this.shake.x * 0.3, 2.1 + this.shake.y * 0.3, this.camZ);
		this.stage.camera.lookAt(RIM.x, RIM.y - 0.4, RIM.z);
		if (!this.running) return;
		if (this.clock.update(dt) && !this.b.flying) {
			this.ctx.audio.play('buzzer');
			return this.finish({ win: true, title: 'Buzzer!', message: `${this.made} of ${this.shots} shots made for ${this.points} points.`, score: this.points });
		}
		this.info();
		const b = this.b;
		if (!b.flying) {
			b.y = 1.7 + Math.sin(performance.now() / 300) * 0.03;
			this.ball.position.set(b.x, b.y, b.z);
			this.shadow.position.set(b.x, 0.012, b.z);
			return;
		}
		// sub-steps keep the ball from slipping through the thin rim
		const steps = 6, h = dt / steps;
		for (let i = 0; i < steps; i++) {
			const prevY = b.y;
			b.vy -= G * h;
			b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
			this.collideRim(b);
			// backboard
			if (b.z - BALL_R < BOARD_Z && b.z > BOARD_Z - 0.3 && Math.abs(b.x) < 0.9 && b.y > 2.92 && b.y < 3.98 && b.vz < 0) {
				b.z = BOARD_Z + BALL_R;
				b.vz = -b.vz * 0.55;
				b.touched = true;
				this.ctx.audio.play('bounce');
			}
			if (b.y < BALL_R) {
				b.y = BALL_R;
				if (b.vy < -1) this.ctx.audio.play('bounce');
				b.vy = -b.vy * 0.6;
				b.vx *= 0.8; b.vz *= 0.8;
			}
			// a basket: passing down through the rim plane inside the ring
			if (!b.scored && prevY >= RIM.y && b.y < RIM.y && b.vy < 0 && Math.hypot(b.x - RIM.x, b.z - RIM.z) < RIM.r - BALL_R * 0.4) {
				b.scored = true;
				this.score(!b.touched);
			}
		}
		b.t += dt;
		this.ball.position.set(b.x, b.y, b.z);
		this.ball.rotation.x -= dt * 8;
		this.trail.update(b.x, b.y, b.z, dt);
		// a hot streak sets the ball alight
		if (this.streak >= 3) this.flames.update(b.x, b.y, b.z, dt);
		this.shadow.position.set(b.x, 0.012, b.z);
		this.shadow.scale.setScalar(Math.max(0.4, 1.4 - b.y / 4));
		if (b.t > 2.6 || Math.abs(b.x) > 8 || b.z > 12) {
			if (!b.scored) { this.streak = 0; this.ctx.audio.play('error'); this.shake.kick(0.25); }
			if (b.scored) this.spot++;
			if (this.clock.done) return this.finish({ win: true, title: 'Buzzer!', message: `${this.made} of ${this.shots} shots made for ${this.points} points.`, score: this.points });
			this.ready();
		}
	}

	score(swish) {
		this.made++;
		this.streak++;
		const base = swish ? 3 : 2;
		const gained = base * (this.streak >= 3 ? 2 : 1);
		this.points += gained;
		this.netSwing = 1;
		this.ctx.score(this.points);
		this.ctx.audio.play(swish ? 'swish' : 'score');
		this.pop(swish ? `SWISH! +${gained}` : `+${gained}`);
		// confetti bursts through the net; swishes get the big one
		this.particles.emit(RIM.x, RIM.y - 0.25, RIM.z, { count: swish ? 70 : 30, colors: [0xfbbf24, 0xf472b6, 0x60a5fa, 0x34d399, 0xffffff], speed: swish ? 3.5 : 2.2, size: 0.04, life: 1.1, gravity: -5, up: 1 });
		if (this.streak === 3) this.ctx.fx.banner('ON FIRE!');
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.hint.remove();
		this.callout.remove();
	}
}
