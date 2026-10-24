// Mini Golf: nine holes rendered in 3D with WAMR3D. The putting physics are 2D on the
// green (x, z): walls, blocks, bumpers, slopes, sand, water and a moving gate.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { circleRect, reflect } from '../core/physics.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const BALL_R = 0.08, CUP_R = 0.14, MAX_SPEED = 7.5, MAX_PULL = 2.4, MAX_STROKES = 8;

// [x, z, w, d] rectangles are centred; the tee is near +z, the cup near -z
const HOLES = [
	{ par: 2, size: [2.4, 8], tee: [0, 3.2], cup: [0, -3.1] },
	{ par: 2, size: [3, 8], tee: [0, 3.2], cup: [0, -3.1], blocks: [[0, 0, 1.6, 0.4]] },
	{ par: 3, size: [5, 7], tee: [-1.6, 2.8], cup: [1.6, -2.7], blocks: [[0.9, 1.2, 3.2, 4.6]] },
	{ par: 2, size: [3.4, 8], tee: [0, 3.2], cup: [0, -3.1], bumpers: [[-0.8, 0.8, 0.3], [0.8, 0.8, 0.3], [0, -0.6, 0.3], [-0.9, -1.8, 0.25], [0.9, -1.8, 0.25]] },
	{ par: 3, size: [3, 9], tee: [-0.8, 3.7], cup: [0.6, -3.6], slopes: [[0, 0.4, 3, 2.6, 1.8, 0]], blocks: [[0.9, -2.2, 1.2, 0.3]] },
	{ par: 3, size: [3.4, 9], tee: [0, 3.7], cup: [-0.6, -3.5], sand: [[0.7, -0.6, 1.6, 1.6]], water: [[-0.85, 1, 1.4, 1.4]] },
	{ par: 3, size: [3, 9], tee: [0, 3.7], cup: [0, -3.6], blocks: [[-1.2, -0.5, 0.6, 0.3], [1.2, -0.5, 0.6, 0.3]], movers: [[0, -0.5, 0.9, 0.3, 0.55, 1.7]] },
	{ par: 3, size: [4, 10], tee: [1.4, 4.2], cup: [-1.4, -4.1], blocks: [[-0.7, 1.8, 2.6, 0.3], [0.7, -0.6, 2.6, 0.3], [-0.7, -2.8, 2.6, 0.3]] },
	{ par: 3, size: [4, 9], tee: [0, 3.7], cup: [0, -3.6], water: [[-1.3, -1.2, 1.4, 1.0], [1.3, -1.2, 1.4, 1.0]], bumpers: [[0.55, -2.9, 0.2], [-0.55, -2.9, 0.2]], slopes: [[0, 1.6, 4, 1.4, 0, -0.8]] },
];

export default class MiniGolf extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x7dd3fc, fov: 45, far: 120, fog: { color: 0x7dd3fc, near: 30, far: 70 }, shadows: { extent: 7 }, bloom: { strength: 0.18, radius: 0.3, threshold: 0.97 } });
		this.stage.addLights({ sky: 0xe0f2fe, ground: 0x365314, intensity: 1.2, sunIntensity: 1.8, sunPosition: [5, 12, 6] });
		this.style = h('style', '.golf-card{position:absolute;left:14px;top:12px;z-index:2;padding:8px 12px;border-radius:12px;background:rgba(11,16,32,.7);font-weight:800;pointer-events:none;line-height:1.5}');
		this.card = h('div.golf-card');
		this.hint = h('div.hint-3d', 'Drag back from the ball, then release to putt');
		this.callout = h('div');
		this.ctx.root.append(this.style, this.card, this.hint, this.callout);
		const s = this.stage;
		const ground = s.mesh(geo.plane(120, 120), standard(0x4d7c0f, { roughness: 1 }));
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.3;
		this.particles = new Particles(s, { capacity: 400 });
		this.trail = new Trail3D(this.particles, { color: 0xffffff, rate: 30, size: 0.035, life: 0.4 });
		this.course = new THREE.Group();
		s.scene.add(this.course);
		this.ball = s.mesh(geo.sphere(BALL_R, 20, 14), standard(0xffffff, { roughness: 0.35 }));
		// its colour follows the shot power, so the arrow has a material of its own
		this.arrow = s.mesh(geo.box(1, 0.02, 1), s.own(new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.85 })));
		this.arrow.visible = false;
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => this.down(e));
		this.ctx.input.on(root, 'pointermove', (e) => this.move(e));
		this.ctx.input.on(root, 'pointerup', () => this.up());
		this.reset();
	}

	reset() {
		this.running = false;
		this.hole = 0;
		this.card.textContent = '';
		this.scores = [];
		this.time = 0;
		this.loadHole();
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	total() { return this.scores.reduce((a, b) => a + b, 0) + (this.strokes ?? 0); }

	paintCard() {
		const par = HOLES.slice(0, this.hole).reduce((a, h) => a + h.par, 0);
		const done = this.scores.reduce((a, b) => a + b, 0);
		const diff = done - par;
		this.card.replaceChildren(
			h('div', `Hole ${this.hole + 1} / ${HOLES.length} · Par ${HOLES[this.hole].par}`),
			h('div', `Strokes ${this.strokes} · Total ${done}${this.hole ? ` (${diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff})` : ''}`),
		);
		this.ctx.info(`Hole ${this.hole + 1} · par ${HOLES[this.hole].par}`);
	}

	clearCourse() {
		const objects = [];
		this.course.traverse((o) => { if (o !== this.course) objects.push(o); });
		for (let i = objects.length - 1; i >= 0; i--) objects[i].dispose();
	}

	box(x, z, w, d, hgt, material, y = 0) {
		const m = this.stage.mesh(geo.box(1, 1, 1), material, this.course);
		m.scale.set(w, hgt, d);
		m.position.set(x, y + hgt / 2, z);
		return m;
	}

	loadHole() {
		this.clearCourse();
		const H = HOLES[this.hole];
		this.def = H;
		const [w, d] = H.size;
		const wood = standard(0xa16207, { roughness: 0.7 });
		const rail = standard(0xf8fafc, { roughness: 0.5 });
		this.box(0, 0, w, d, 0.06, standard(0x22c55e, { roughness: 0.85 }), -0.06);
		this.box(0, 0, w + 0.5, d + 0.5, 0.1, standard(0x78350f, { roughness: 0.9 }), -0.2);
		this.walls = [[-w / 2 - 0.5, -d / 2 - 0.5, 0.5, d + 1], [w / 2, -d / 2 - 0.5, 0.5, d + 1], [-w / 2, -d / 2 - 0.5, w, 0.5], [-w / 2, d / 2, w, 0.5]]
			.map(([x, z, ww, dd]) => ({ x, y: z, w: ww, h: dd }));
		for (const [x, z, ww, dd] of [[-w / 2 - 0.08, 0, 0.16, d + 0.32], [w / 2 + 0.08, 0, 0.16, d + 0.32], [0, -d / 2 - 0.08, w, 0.16], [0, d / 2 + 0.08, w, 0.16]]) this.box(x, z, ww, dd, 0.16, rail);
		for (const [x, z, ww, dd] of H.blocks ?? []) {
			this.box(x, z, ww, dd, 0.2, wood);
			this.walls.push({ x: x - ww / 2, y: z - dd / 2, w: ww, h: dd });
		}
		this.movers = (H.movers ?? []).map(([x, z, ww, dd, amp, speed]) => ({ x0: x, z, w: ww, d: dd, amp, speed, mesh: this.box(x, z, ww, dd, 0.22, standard(0xe11d48, { roughness: 0.4 })) }));
		this.bumpers = (H.bumpers ?? []).map(([x, z, r]) => {
			const m = this.stage.mesh(geo.cylinder(1, 1, 1, 24), standard(0xf472b6, { roughness: 0.3, emissive: 0x3b0a24 }), this.course);
			m.scale.set(r, 0.22, r);
			m.position.set(x, 0.11, z);
			return { x, z, r, mesh: m, flash: 0 };
		});
		this.slopes = (H.slopes ?? []).map(([x, z, ww, dd, ax, az]) => {
			this.box(x, z, ww, dd, 0.004, standard(0x16a34a, { roughness: 0.9 }), 0.0);
			for (let k = -1; k <= 1; k++) {
				const cone = this.stage.mesh(geo.cone(0.1, 0.3, 3), basic(0xbbf7d0), this.course);
				cone.position.set(x + (az ? k * ww * 0.3 : 0), 0.03, z + (ax ? k * dd * 0.3 : 0));
				// lie the cone flat (pointing -z), then turn it toward the slope's pull
				cone.rotation.order = 'YXZ';
				cone.rotation.set(-Math.PI / 2, Math.atan2(-ax, -az), 0);
			}
			return { x: x - ww / 2, y: z - dd / 2, w: ww, h: dd, ax, az };
		});
		this.sand = (H.sand ?? []).map(([x, z, ww, dd]) => { this.box(x, z, ww, dd, 0.006, standard(0xfde68a, { roughness: 1 })); return { x: x - ww / 2, y: z - dd / 2, w: ww, h: dd }; });
		this.water = (H.water ?? []).map(([x, z, ww, dd]) => { this.box(x, z, ww, dd, 0.008, standard(0x38bdf8, { roughness: 0.1, metalness: 0.2 })); return { x: x - ww / 2, y: z - dd / 2, w: ww, h: dd }; });

		const [cx, cz] = H.cup;
		const cup = this.stage.mesh(geo.circle(CUP_R, 24), basic(0x0b0b0b), this.course);
		cup.rotation.x = -Math.PI / 2;
		cup.position.set(cx, 0.012, cz);
		const pole = this.stage.mesh(geo.cylinder(0.015, 0.015, 1.1, 8), standard(0xf8fafc), this.course);
		pole.position.set(cx, 0.55, cz);
		this.flag = this.stage.mesh(geo.box(0.4, 0.24, 0.01), standard(0xef4444, { roughness: 0.6 }), this.course);
		this.flag.position.set(cx + 0.2, 0.96, cz);
		const tee = this.stage.mesh(geo.ring(0.12, 0.16, 20), basic(0xffffff), this.course);
		tee.rotation.x = -Math.PI / 2;
		tee.position.set(H.tee[0], 0.012, H.tee[1]);

		this.b = { x: H.tee[0], z: H.tee[1], vx: 0, vz: 0, sinking: 0 };
		this.last = { x: H.tee[0], z: H.tee[1] };
		this.strokes = 0;
		this.drag = null;
		this.view = { dist: Math.max(w * 1.25, d * 0.95) + 1.5 };
		this.paintCard();
	}

	down(e) {
		if (!this.running || this.paused || this.moving() || this.b.sinking) return;
		const p = this.stage.pointOnGround(e, 0);
		if (!p) return;
		this.drag = { x: p.x, z: p.z };
		this.updateArrow();
	}

	move(e) {
		if (!this.drag) return;
		const p = this.stage.pointOnGround(e, 0);
		if (p) { this.drag.x = p.x; this.drag.z = p.z; }
		this.updateArrow();
	}

	shotVector() {
		const dx = this.b.x - this.drag.x, dz = this.b.z - this.drag.z;
		const pull = Math.min(Math.hypot(dx, dz), MAX_PULL);
		const len = Math.hypot(dx, dz) || 1;
		return { ux: dx / len, uz: dz / len, power: pull / MAX_PULL };
	}

	updateArrow() {
		const { ux, uz, power } = this.shotVector();
		const length = 0.25 + power * 1.6;
		this.arrow.visible = power > 0.03;
		this.arrow.scale.set(0.06, 1, length);
		this.arrow.position.set(this.b.x + ux * (length / 2 + 0.1), 0.03, this.b.z + uz * (length / 2 + 0.1));
		this.arrow.rotation.y = Math.atan2(ux, uz);
		this.arrow.material.color.setHSL(0.15 - power * 0.15, 0.9, 0.55);
	}

	up() {
		if (!this.drag) return;
		const { ux, uz, power } = this.shotVector();
		this.drag = null;
		this.arrow.visible = false;
		if (power < 0.04 || !this.running) return;
		this.hint.hidden = true;
		this.last = { x: this.b.x, z: this.b.z };
		this.b.vx = ux * power * MAX_SPEED;
		this.b.vz = uz * power * MAX_SPEED;
		this.strokes++;
		this.ctx.score(this.total());
		this.ctx.audio.play('hit');
		this.paintCard();
	}

	moving() {
		return Math.hypot(this.b.vx, this.b.vz) > 0.02;
	}

	inRect(r) {
		return this.b.x > r.x && this.b.x < r.x + r.w && this.b.z > r.y && this.b.z < r.y + r.h;
	}

	update(dt) {
		this.time += dt;
		this.particles.update(dt);
		const H = this.def;
		for (const m of this.movers) {
			m.x = m.x0 + Math.sin(this.time * m.speed) * m.amp;
			m.mesh.position.x = m.x;
		}
		for (const bp of this.bumpers) {
			bp.flash = Math.max(0, bp.flash - dt * 4);
			bp.mesh.scale.set(bp.r * (1 + bp.flash * 0.15), 0.22, bp.r * (1 + bp.flash * 0.15));
		}
		// the flag flutters, and waves wildly while the ball drops in
		this.flag.rotation.y = Math.sin(this.time * (this.b.sinking ? 9 : 2)) * (this.b.sinking ? 0.6 : 0.2);
		const cam = this.stage.camera;
		const tx = this.b.x * 0.35, tz = this.b.z * 0.35;
		cam.position.set(damp(cam.position.x, tx, 0.05, dt), this.view.dist * 0.95, damp(cam.position.z, tz + this.view.dist * 0.62, 0.05, dt));
		cam.lookAt(cam.position.x, 0, cam.position.z - this.view.dist * 0.62);

		const b = this.b;
		if (b.sinking) {
			b.sinking += dt;
			this.ball.position.set(H.cup[0], BALL_R - Math.min(b.sinking, 0.4) * 0.5, H.cup[1]);
			if (b.sinking > 0.9) this.holeDone();
			return;
		}
		if (!this.running) { this.ball.position.set(b.x, BALL_R, b.z); return; }

		const steps = 6, h = dt / steps;
		for (let s = 0; s < steps; s++) {
			const sandy = this.sand.some((r) => this.inRect(r));
			for (const sl of this.slopes) if (this.inRect(sl)) { b.vx += sl.ax * h; b.vz += sl.az * h; }
			const speed = Math.hypot(b.vx, b.vz);
			if (speed > 0) {
				const decel = (sandy ? 5.5 : 1.1) * h;
				const k = Math.max(0, speed - decel) / speed;
				b.vx *= k; b.vz *= k;
			}
			b.x += b.vx * h;
			b.z += b.vz * h;
			const rects = [...this.walls, ...this.movers.map((m) => ({ x: m.x - m.w / 2, y: m.z - m.d / 2, w: m.w, h: m.d }))];
			const body = { vx: b.vx, vy: b.vz };
			for (const r of rects) {
				const hit = circleRect(b.x, b.z, BALL_R, r);
				if (!hit) continue;
				b.x += hit.nx * hit.depth; b.z += hit.ny * hit.depth;
				body.vx = b.vx; body.vy = b.vz;
				if (reflect(body, hit.nx, hit.ny, 0.75)) {
					b.vx = body.vx; b.vz = body.vy;
					if (Math.hypot(b.vx, b.vz) > 0.8) {
						this.ctx.audio.play('bounce');
						this.particles.emit(b.x - hit.nx * BALL_R, 0.1, b.z - hit.ny * BALL_R, { count: 6, color: 0xfde68a, speed: 1.2, size: 0.025, life: 0.3, gravity: -4 });
					}
				}
			}
			for (const bp of this.bumpers) {
				const dx = b.x - bp.x, dz = b.z - bp.z, dist = Math.hypot(dx, dz), min = bp.r + BALL_R;
				if (dist >= min || dist === 0) continue;
				const nx = dx / dist, nz = dz / dist;
				b.x = bp.x + nx * min; b.z = bp.z + nz * min;
				body.vx = b.vx; body.vy = b.vz;
				if (reflect(body, nx, nz, 1.15)) { b.vx = body.vx; b.vz = body.vy; bp.flash = 1; this.ctx.audio.play('blip'); }
			}
			if (this.water.some((r) => this.inRect(r))) {
				this.ctx.audio.play('splash');
				this.particles.emit(b.x, 0.05, b.z, { count: 40, colors: [0x7dd3fc, 0xe0f2fe, 0xffffff], speed: 2.4, size: 0.05, life: 0.8, gravity: -9, up: 2.5 });
				this.callout.replaceChildren(h('div.big-callout', 'Splash! +1'));
				this.strokes++;
				Object.assign(b, { x: this.last.x, z: this.last.z, vx: 0, vz: 0 });
				this.ctx.score(this.total());
				this.paintCard();
				break;
			}
			const cdx = b.x - H.cup[0], cdz = b.z - H.cup[1];
			const cd = Math.hypot(cdx, cdz);
			if (cd < CUP_R) {
				if (Math.hypot(b.vx, b.vz) < 3.2) {
					b.vx = b.vz = 0;
					b.sinking = 0.0001;
					this.ctx.audio.play('pop');
					this.particles.emit(H.cup[0], 0.15, H.cup[1], { count: 30, colors: [0xfde047, 0xffffff, 0x34d399], speed: 2.2, size: 0.045, life: 0.8, gravity: -5, up: 2 });
					break;
				}
				// too fast: the cup's edge nudges the ball
				b.vx += (-cdx / (cd || 1)) * 0.6; b.vz += (-cdz / (cd || 1)) * 0.6;
			}
		}
		if (!this.moving()) {
			b.vx = b.vz = 0;
			if (this.strokes >= MAX_STROKES && !b.sinking) {
				this.callout.replaceChildren(h('div.big-callout', 'Picked up'));
				b.sinking = 0.0001;
				this.strokes = MAX_STROKES;
			}
		}
		this.ball.position.set(b.x, BALL_R, b.z);
		this.ball.rotation.x += b.vz * dt * 6;
		this.ball.rotation.z -= b.vx * dt * 6;
		if (this.moving()) this.trail.update(b.x, BALL_R, b.z, dt, Math.min(1.5, Math.hypot(b.vx, b.vz) / 3));
	}

	holeDone() {
		const par = this.def.par;
		const diff = this.strokes - par;
		const names = { '-3': 'Albatross!', '-2': 'Eagle!', '-1': 'Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Double bogey' };
		this.callout.replaceChildren(h('div.big-callout', this.strokes === 1 ? 'Hole in one!' : names[diff] ?? `+${diff}`));
		this.ctx.audio.play(this.strokes === 1 ? 'treasure' : diff <= 0 ? 'win' : 'score');
		if (this.strokes === 1 || diff < 0) {
			// a fountain of confetti from the cup
			this.particles.emit(this.def.cup[0], 0.3, this.def.cup[1], { count: this.strokes === 1 ? 120 : 60, colors: [0xfbbf24, 0xf472b6, 0x60a5fa, 0x34d399, 0xffffff], speed: 3.5, size: 0.06, life: 1.5, gravity: -4, up: 4 });
			if (this.strokes === 1) this.ctx.fx.banner('HOLE IN ONE!');
		}
		this.scores.push(this.strokes);
		this.strokes = 0;
		this.hole++;
		if (this.hole >= HOLES.length) {
			this.hole = HOLES.length - 1;
			this.b.sinking = 0;
			const total = this.scores.reduce((a, b) => a + b, 0);
			const parTotal = HOLES.reduce((a, h) => a + h.par, 0);
			const vs = total - parTotal;
			this.ctx.score(total);
			return this.finish({ win: vs <= 0, title: 'Round complete', message: `${total} strokes, ${vs === 0 ? 'even par' : vs > 0 ? `${vs} over par` : `${-vs} under par`}.`, score: total });
		}
		this.loadHole();
		this.ctx.score(this.total());
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		for (const el of [this.style, this.card, this.hint, this.callout]) el.remove();
	}
}
