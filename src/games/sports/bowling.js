// Strike Lane: ten frames of 3D ten-pin bowling (WAMR3D). The ball and pins collide as
// discs on the lane; struck pins topple and can take their neighbours with them.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { h } from '../../components/dom.js';
import { clamp } from '../core/physics.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';

const LANE_W = 1.06, HALF = LANE_W / 2, LENGTH = 16, HEAD = -LENGTH, BALL_R = 0.11, PIN_R = 0.06;
const BALL_M = 6, PIN_M = 1.5;

function pinSpots() {
	const spots = [];
	for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) spots.push([(k - row / 2) * 0.3, HEAD - row * 0.26]);
	return spots;
}

/** Ten-pin scores per frame from the list of rolls. */
export function frameScores(rolls) {
	const out = [];
	let i = 0, total = 0;
	for (let f = 0; f < 10; f++) {
		if (rolls[i] === undefined) break;
		if (rolls[i] === 10) {
			if (rolls[i + 2] === undefined) { out.push(null); break; }
			total += 10 + rolls[i + 1] + rolls[i + 2];
			i += 1;
		} else {
			if (rolls[i + 1] === undefined) { out.push(null); break; }
			if (rolls[i] + rolls[i + 1] === 10) {
				if (rolls[i + 2] === undefined) { out.push(null); break; }
				total += 10 + rolls[i + 2];
			} else total += rolls[i] + rolls[i + 1];
			i += 2;
		}
		out.push(total);
	}
	return out;
}

export default class Bowling extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0b1020, fov: 50, far: 80, fog: { color: 0x0b1020, near: 18, far: 40 } });
		this.stage.addLights({ sky: 0xfff1d6, ground: 0x1a1020, intensity: 1.0, sunIntensity: 1.2, sunPosition: [0, 10, 4] });
		const spot = new THREE.PointLight(0xfff7e6, 25, 14);
		spot.position.set(0, 3, HEAD + 1);
		this.stage.scene.add(spot);
		this.style = h('style', BOWL_CSS);
		this.sheet = h('div.bowl-sheet');
		this.hint = h('div.hint-3d', 'Drag sideways to line up, then swipe up to roll');
		this.callout = h('div');
		this.ctx.root.append(this.style, this.sheet, this.hint, this.callout);
		this.build();
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => this.down(e));
		this.ctx.input.on(root, 'pointermove', (e) => this.move(e));
		this.ctx.input.on(root, 'pointerup', (e) => this.up(e));
		this.reset();
	}

	build() {
		const s = this.stage;
		const lane = s.mesh(geo.box(LANE_W, 0.06, LENGTH + 2), standard(0xd4a373, { roughness: 0.25, metalness: 0.05 }));
		lane.position.set(0, -0.03, -LENGTH / 2 - 0.5);
		for (let i = -3; i <= 3; i++) {
			const arrow = s.mesh(geo.cone(0.03, 0.12, 3), basic(0x7c3f12));
			arrow.rotation.x = -Math.PI / 2;
			arrow.position.set(i * 0.13, 0.005, -4.5 - Math.abs(i) * 0.25);
		}
		for (const side of [-1, 1]) {
			const gutter = s.mesh(geo.box(0.22, 0.04, LENGTH + 2), standard(0x334155, { roughness: 0.4, metalness: 0.5 }));
			gutter.position.set(side * (HALF + 0.11), -0.08, -LENGTH / 2 - 0.5);
			const wall = s.mesh(geo.box(0.1, 0.4, LENGTH + 3), standard(0x1e1b4b, { roughness: 0.8 }));
			wall.position.set(side * (HALF + 0.27), 0.1, -LENGTH / 2 - 1);
			const neon = s.mesh(geo.box(0.03, 0.03, LENGTH + 3), basic(side < 0 ? 0xf472b6 : 0x22d3ee));
			neon.position.set(side * (HALF + 0.22), 0.32, -LENGTH / 2 - 1);
		}
		const pit = s.mesh(geo.box(2.5, 1.4, 0.2), standard(0x111827, { roughness: 1 }));
		pit.position.set(0, 0.5, HEAD - 1.5);
		const foul = s.mesh(geo.box(LANE_W, 0.008, 0.03), basic(0xef4444));
		foul.position.set(0, 0.002, 0);

		const profile = [[0, 0], [0.032, 0.005], [0.06, 0.09], [0.05, 0.19], [0.025, 0.26], [0.022, 0.29], [0.035, 0.34], [0.025, 0.38], [0, 0.39]].map(([x, y]) => new THREE.Vector2(x, y));
		const pinGeometry = s.own(new THREE.LatheGeometry(profile, 16));
		const pinMat = standard(0xf8fafc, { roughness: 0.3 });
		const stripe = standard(0xdc2626, { roughness: 0.4 });
		this.pins = pinSpots().map(([x, z]) => {
			const group = new THREE.Group();
			s.mesh(pinGeometry, pinMat, group);
			const band = s.mesh(geo.cylinder(0.0235, 0.0235, 0.02, 12), stripe, group);
			band.position.y = 0.285;
			s.scene.add(group);
			return { group, home: [x, z], x, z, vx: 0, vz: 0, down: false, tip: 0, tipAxis: [1, 0], gone: false };
		});

		this.ballMesh = new THREE.Group();
		s.mesh(geo.sphere(BALL_R, 28, 18), standard(0x4f46e5, { roughness: 0.15, metalness: 0.3 }), this.ballMesh);
		for (const [x, y] of [[-0.03, 0.04], [0.03, 0.04], [0, -0.01]]) {
			const hole = s.mesh(geo.sphere(0.017, 8, 6), basic(0x0b1020), this.ballMesh);
			hole.position.set(x, y + 0.03, BALL_R * 0.92);
		}
		s.scene.add(this.ballMesh);
		this.guide = s.mesh(geo.box(0.02, 0.003, 3), basic(0xfbbf24, { transparent: true, opacity: 0.5 }));
		this.particles = new Particles(s, { capacity: 500 });
		this.shake = new Shake();
		this.trail = new Trail3D(this.particles, { color: 0x818cf8, rate: 35, size: 0.03, life: 0.45 });
	}

	reset() {
		this.running = false;
		clearTimeout(this.timer);
		this.rolls = [];
		this.tenthStart = undefined;
		this.frame = 0;
		this.ballInFrame = 0;
		this.camZ = 2.2;
		this.rack(true);
		this.newBall();
		this.paintSheet();
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	rack(full) {
		for (const p of this.pins) {
			if (full) Object.assign(p, { x: p.home[0], z: p.home[1], vx: 0, vz: 0, down: false, tip: 0, gone: false });
			p.group.visible = !p.gone;
			p.group.position.set(p.x, 0, p.z);
			p.group.rotation.set(0, 0, 0);
		}
	}

	newBall() {
		this.ball = { x: 0, z: 0.4, vx: 0, vz: 0, spin: 0, rolling: false, gutter: false, t: 0 };
		this.phase = 'aim';
		this.ballMesh.position.set(0, BALL_R, 0.4);
		this.guide.visible = true;
	}

	paintSheet() {
		const scores = frameScores(this.rolls);
		const marks = this.frameMarks();
		this.sheet.replaceChildren(...Array.from({ length: 10 }, (_, f) => h(`div.bowl-frame${f === this.frame ? '.now' : ''}`,
			h('div.bowl-num', String(f + 1)),
			h('div.bowl-marks', (marks[f] ?? []).join(' ')),
			h('div.bowl-total', scores[f] != null ? String(scores[f]) : ''),
		)));
		const total = scores.filter((v) => v != null).at(-1) ?? 0;
		this.ctx.score(total);
		this.ctx.info(`Frame ${Math.min(this.frame + 1, 10)} · ball ${this.ballInFrame + 1}`);
	}

	frameMarks() {
		const marks = [];
		let i = 0;
		for (let f = 0; f < 10 && i < this.rolls.length; f++) {
			const m = [];
			if (f < 9) {
				const a = this.rolls[i];
				if (a === 10) { m.push('X'); i++; }
				else {
					m.push(a === 0 ? '–' : String(a));
					const b = this.rolls[i + 1];
					if (b !== undefined) m.push(a + b === 10 ? '/' : b === 0 ? '–' : String(b));
					i += 2;
				}
			} else {
				let standing = 10;
				for (let k = 0; k < 3 && i < this.rolls.length; k++, i++) {
					const v = this.rolls[i];
					const spare = standing < 10 && v === standing;
					m.push(v === 10 && standing === 10 ? 'X' : spare ? '/' : v === 0 ? '–' : String(v));
					standing = v === standing || standing - v === 0 ? 10 : standing - v;
				}
			}
			marks.push(m);
		}
		return marks;
	}

	// ------------------------------------------------------------ input

	down(e) {
		if (!this.running || this.phase !== 'aim') return;
		this.drag = { x0: e.clientX, y0: e.clientY, startBall: this.ball.x, path: [[e.clientX, e.clientY, performance.now()]] };
	}

	move(e) {
		if (!this.drag) return;
		const d = this.drag;
		d.path.push([e.clientX, e.clientY, performance.now()]);
		const rect = this.ctx.root.getBoundingClientRect();
		// mostly sideways drags slide the ball along the foul line
		if (Math.abs(e.clientY - d.y0) < 30) this.ball.x = clamp(d.startBall + ((e.clientX - d.x0) / rect.width) * 1.4, -HALF + BALL_R, HALF - BALL_R);
	}

	up(e) {
		const d = this.drag;
		this.drag = null;
		if (!d || this.phase !== 'aim') return;
		const rect = this.ctx.root.getBoundingClientRect();
		const dy = (d.y0 - e.clientY) / rect.height;
		if (dy < 0.12) return;
		// the last part of the swipe sets speed and direction, its bend sets the hook
		const recent = d.path.filter((p) => p[2] > performance.now() - 260);
		const first = recent[0] ?? d.path[0];
		const dt = Math.max(0.05, (performance.now() - first[2]) / 1000);
		const speed = clamp(((first[1] - e.clientY) / rect.height) / dt * 3.2, 4.5, 11);
		const angle = clamp(((e.clientX - d.x0) / rect.width) * 0.12, -0.06, 0.06);
		const mid = d.path[Math.floor(d.path.length / 2)];
		const straightMid = d.x0 + (e.clientX - d.x0) / 2;
		const bend = clamp((mid[0] - straightMid) / rect.width, -0.15, 0.15);
		this.roll(speed, angle, -bend * 2.4);
	}

	handleInput({ type, action }) {
		if (type !== 'down' || this.phase !== 'aim') return;
		if (action === 'left') this.ball.x = clamp(this.ball.x - 0.05, -HALF + BALL_R, HALF - BALL_R);
		if (action === 'right') this.ball.x = clamp(this.ball.x + 0.05, -HALF + BALL_R, HALF - BALL_R);
		if (action === 'action' || action === 'up') this.roll(8, 0, 0);
	}

	roll(speed, angle, spin) {
		const b = this.ball;
		b.vx = Math.sin(angle) * speed;
		b.vz = -Math.cos(angle) * speed;
		b.spin = spin;
		b.rolling = true;
		this.phase = 'rolling';
		this.guide.visible = false;
		this.hint.hidden = true;
		this.settle = 0;
		this.ctx.audio.play('roll');
	}

	// ------------------------------------------------------------ simulation

	update(dt) {
		const b = this.ball;
		const target = this.phase === 'rolling' ? Math.max(HEAD + 3.2, b.z + 2.2) : 2.2;
		this.camZ = damp(this.camZ, target, 0.06, dt);
		this.particles.update(dt);
		this.shake.update(dt);
		this.stage.camera.position.set(b.x * 0.3 + this.shake.x * 0.2, 0.9 + this.shake.y * 0.2, this.camZ);
		this.stage.camera.lookAt(0, 0.1, this.camZ - 5);
		if (this.phase === 'aim') {
			this.ballMesh.position.set(b.x, BALL_R, 0.4);
			this.guide.position.set(b.x, 0.004, -1.2);
		}
		if (!this.running || this.phase !== 'rolling') return;

		const steps = 4, h = dt / steps;
		for (let s = 0; s < steps; s++) {
			if (b.rolling) {
				// hook builds up as the ball travels down the lane
				if (!b.gutter && b.z < -LENGTH * 0.35) b.vx += b.spin * h;
				b.x += b.vx * h;
				b.z += b.vz * h;
				if (!b.gutter && Math.abs(b.x) > HALF && b.z > HEAD + 0.5) {
					b.gutter = true;
					b.x = Math.sign(b.x) * (HALF + 0.11);
					b.vx = 0;
					this.ctx.audio.play('error');
				}
				if (b.z < HEAD - 1.4) b.rolling = false;
				if (!b.gutter) for (const p of this.pins) this.hitPin(b, p);
			}
			for (const p of this.pins) {
				if (p.gone) continue;
				p.x += p.vx * h;
				p.z += p.vz * h;
				p.vx *= 1 - 2.5 * h;
				p.vz *= 1 - 2.5 * h;
				if (Math.abs(p.x) > HALF + 0.1 || p.z < HEAD - 1.2) { p.down = true; }
			}
			for (let i = 0; i < 10; i++) for (let j = i + 1; j < 10; j++) this.pinPin(this.pins[i], this.pins[j]);
		}
		b.t += dt;
		this.ballMesh.position.set(b.x, BALL_R - (b.gutter ? 0.06 : 0), b.z);
		this.ballMesh.rotation.x -= (b.vz * dt) / BALL_R;
		if (b.rolling) this.trail.update(b.x, 0.02, b.z, dt, Math.min(1.5, -b.vz / 7));
		for (const p of this.pins) {
			if (p.gone) continue;
			if (p.down && p.tip < 1) p.tip = Math.min(1, p.tip + dt * 4);
			p.group.position.set(p.x, 0.0, p.z);
			const [ax, az] = p.tipAxis;
			p.group.rotation.set(az * p.tip * 1.45, 0, -ax * p.tip * 1.45);
		}
		const moving = this.pins.some((p) => !p.gone && Math.hypot(p.vx, p.vz) > 0.05);
		if (!b.rolling && !moving) this.settle += dt;
		if (this.settle > 0.8 || b.t > 7) this.count();
	}

	hitPin(b, p) {
		if (p.gone) return;
		const dx = p.x - b.x, dz = p.z - b.z;
		const dist = Math.hypot(dx, dz), min = BALL_R + PIN_R;
		if (dist >= min || dist === 0) return;
		const nx = dx / dist, nz = dz / dist;
		const rel = (b.vx - p.vx) * nx + (b.vz - p.vz) * nz;
		if (rel <= 0) return;
		const j = (1.6 * rel) / (1 / BALL_M + 1 / PIN_M);
		b.vx -= (j / BALL_M) * nx; b.vz -= (j / BALL_M) * nz;
		p.vx += (j / PIN_M) * nx; p.vz += (j / PIN_M) * nz;
		p.x = b.x + nx * min; p.z = b.z + nz * min;
		this.knock(p);
		this.ctx.audio.play('hit');
		// wood chips and a jolt at each pin strike
		this.particles.emit(p.x, 0.2, p.z, { count: 12, colors: [0xffffff, 0xdc2626, 0xd4a373], speed: 2.5, size: 0.025, life: 0.5, gravity: -7, up: 1 });
		this.shake.kick(0.12);
	}

	pinPin(a, c) {
		if (a.gone || c.gone) return;
		const dx = c.x - a.x, dz = c.z - a.z;
		// a toppled pin reaches further along the lane than an upright one
		const reach = PIN_R * 2 + (a.down || c.down ? 0.14 : 0);
		const dist = Math.hypot(dx, dz);
		if (dist >= reach || dist === 0) return;
		const nx = dx / dist, nz = dz / dist;
		const rel = (a.vx - c.vx) * nx + (a.vz - c.vz) * nz;
		if (rel <= 0.05) return;
		const j = rel * 0.9;
		a.vx -= j * nx; a.vz -= j * nz;
		c.vx += j * nx; c.vz += j * nz;
		if (rel > 0.35) { this.knock(a); this.knock(c); }
	}

	knock(p) {
		if (p.down) return;
		p.down = true;
		const speed = Math.hypot(p.vx, p.vz) || 1;
		p.tipAxis = [p.vx / speed, p.vz / speed];
	}

	count() {
		this.phase = 'counting';
		const standingBefore = this.pins.filter((p) => !p.gone).length;
		const standing = this.pins.filter((p) => !p.gone && !p.down).length;
		const knocked = standingBefore - standing;
		this.rolls.push(knocked);
		const tenth = this.frame === 9;
		const strike = standingBefore === 10 && knocked === 10;
		const spare = standingBefore < 10 && standing === 0;
		if (strike) {
			this.pop('STRIKE!');
			this.ctx.audio.play('cheer');
			this.particles.emit(0, 0.6, HEAD - 0.3, { count: 90, colors: [0xfbbf24, 0xf472b6, 0x22d3ee, 0xffffff], speed: 3, size: 0.04, life: 1.4, gravity: -3, up: 2 });
			this.shake.kick(0.4);
		} else if (spare) {
			this.pop('SPARE!');
			this.ctx.audio.play('score');
			this.particles.emit(0, 0.5, HEAD - 0.3, { count: 40, colors: [0x22d3ee, 0xffffff], speed: 2.4, size: 0.035, life: 1.1, gravity: -3, up: 1.5 });
		}
		if (strike && this.rolls.length >= 12 && this.rolls.every((r) => r === 10)) this.ctx.fx.banner('Perfect game!');
		else if (knocked === 0) this.pop(this.ball.gutter ? 'Gutter ball' : 'Miss');
		else this.pop(`${knocked} ${knocked === 1 ? 'pin' : 'pins'}`);

		let frameDone, reset;
		if (!tenth) {
			frameDone = strike || this.ballInFrame === 1;
			reset = frameDone;
		} else {
			const r = this.rolls.slice(this.tenthStart ??= this.rolls.length - 1);
			const bonus = r[0] === 10 || r[0] + (r[1] ?? 0) === 10;
			frameDone = r.length === 3 || (r.length === 2 && !bonus);
			reset = standing === 0;
		}
		this.timer = setTimeout(() => {
			if (!this.running) return;
			for (const p of this.pins) if (p.down) p.gone = true;
			if (frameDone) {
				this.frame++;
				this.ballInFrame = 0;
				this.rack(true);
			} else {
				this.ballInFrame++;
				if (reset) this.rack(true); else this.rack(false);
			}
			this.paintSheet();
			if (this.frame >= 10) {
				const total = frameScores(this.rolls).at(-1);
				return this.finish({ win: true, title: total === 300 ? 'Perfect game!' : 'Game complete', message: `You bowled ${total}.`, score: total });
			}
			this.newBall();
		}, 1300);
		this.paintSheet();
	}

	pop(text) {
		this.callout.replaceChildren(h('div.big-callout', text));
	}

	render() {
		this.stage.render();
	}

	dispose() {
		clearTimeout(this.timer);
		this.stage.dispose();
		for (const el of [this.style, this.sheet, this.hint, this.callout]) el.remove();
	}
}

const BOWL_CSS = `
.bowl-sheet { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); z-index: 2; display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); width: min(560px, calc(100% - 20px)); border-radius: 10px; overflow: hidden; background: rgba(11,16,32,0.8); border: 1px solid rgba(255,255,255,0.15); pointer-events: none; }
.bowl-frame { border-right: 1px solid rgba(255,255,255,0.12); text-align: center; padding: 3px 0 4px; font-variant-numeric: tabular-nums; }
.bowl-frame:last-child { border-right: 0; }
.bowl-frame.now { background: rgba(79,140,255,0.25); }
.bowl-num { font-size: 0.6rem; color: #8d97c4; font-weight: 700; }
.bowl-marks { font-size: 0.72rem; font-weight: 800; min-height: 1.1em; color: #fbbf24; }
.bowl-total { font-size: 0.9rem; font-weight: 900; min-height: 1.2em; }
`;
