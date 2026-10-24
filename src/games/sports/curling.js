// Curling 3D (WAMR3D): slide granite stones down the ice toward the house. Drag back to
// aim and set the weight, pick the turn (the stone curls that way as it slows), and hold
// to sweep: sweeping makes the stone run farther and straighter. After each end the side
// with the stone nearest the button scores one point per stone closer than any of the
// other side's. Stones collide, so you can knock theirs out.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, themed } from '../../engine/materials.js';
import { Particles } from '../../engine/effects.js';
import { collideDiscs } from '../core/physics.js';
import { h } from '../../components/dom.js';

const SHEET_W = 4.4, HALF = SHEET_W / 2, TEE = -28, BACK = TEE - 1.9, HOG = TEE + 7, HOUSE = 1.83;
const R = 0.2, MU = 0.6, CURL = 0.11, PER_TEAM = 4;
const RED = 0, YELLOW = 1;

/** Moves stones one step: friction, curl, collisions. Returns true while anything moves. */
function simulate(stones, dt, sweeping) {
	let moving = false;
	for (const s of stones) {
		if (!s.inPlay) continue;
		const speed = Math.hypot(s.vx, s.vy);
		if (speed < 0.01) { s.vx = s.vy = 0; continue; }
		moving = true;
		const sweep = sweeping && s.thrown ? 0.7 : 1;
		const decel = MU * sweep * dt;
		const k = Math.max(0, speed - decel) / speed;
		s.vx *= k; s.vy *= k;
		// curl: sideways push that grows as the stone slows
		if (s.spin) {
			const curl = CURL * s.spin * sweep * Math.min(1.5, 0.6 / Math.max(0.35, speed));
			const px = -s.vy / speed, py = s.vx / speed; // perpendicular to the motion: +spin curls right
			s.vx += px * curl * dt;
			s.vy += py * curl * dt;
		}
		s.x += s.vx * dt;
		s.y += s.vy * dt;
		if (Math.abs(s.x) > HALF - R || s.y < BACK - R * 2) s.inPlay = false;
	}
	for (let i = 0; i < stones.length; i++) for (let j = i + 1; j < stones.length; j++) {
		const a = stones[i], b = stones[j];
		if (a.inPlay && b.inPlay) { const hit = collideDiscs(a, b, 0.88); if (hit > 0.2) a.clack = b.clack = hit; }
	}
	return moving;
}

export default class Curling extends Game {
	static realtime = true;

	async init() {
		// dev builds expose the open game for automated play-testing
		if (import.meta.env?.DEV) window.__pgGame = this;
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0b1220, fov: 45, far: 120, fog: { color: 0x0b1220, near: 30, far: 70 }, bloom: false, shadows: { extent: 6 } });
		const s = this.stage;
		s.addLights({ sky: 0xf0f9ff, ground: 0x334155, intensity: 1.1, sunIntensity: 1.2, sunPosition: [2, 12, TEE + 6] });
		this.build();
		this.particles = new Particles(s, { capacity: 160, additive: false });
		this.hud = h('div.hud-3d', h('span'), h('span'), h('span'));
		this.turnBar = h('div', { style: { position: 'absolute', right: '14px', top: '14px', zIndex: 2, display: 'flex', gap: '6px' } },
			this.curlBtn = h('button.btn.small', { type: 'button', onclick: () => this.toggleCurl() }, ''),
		);
		this.hint = h('div.hint-3d', 'Drag back to aim and set weight · hold Space or a finger to sweep');
		this.ctx.root.append(this.hud, this.turnBar, this.hint);
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => this.down(e));
		this.ctx.input.on(root, 'pointermove', (e) => this.move(e));
		this.ctx.input.on(window, 'pointerup', (e) => this.up(e));
		this.reset();
	}

	build() {
		const s = this.stage;
		const ice = s.mesh(geo.box(SHEET_W, 0.1, 40), standard(0xf1f5f9, { roughness: 0.15, metalness: 0.05 }));
		ice.position.set(0, -0.05, -16);
		for (const side of [-1, 1]) {
			const board = s.mesh(geo.box(0.12, 0.3, 40), standard(0x1e3a8a, { roughness: 0.6 }));
			board.position.set(side * (HALF + 0.06), 0.1, -16);
		}
		const ring = (r0, r1, color, y) => { const m = s.mesh(geo.ring(r0, r1, 64), basic(color)); m.rotation.x = -Math.PI / 2; m.position.set(0, y, TEE); return m; };
		ring(1.22, HOUSE, 0x2563eb, 0.002);
		ring(0.61, 1.22, 0xf8fafc, 0.003);
		ring(0.15, 0.61, 0xdc2626, 0.004);
		const line = (z, color = 0x94a3b8, w = 0.04) => { const m = s.mesh(geo.box(SHEET_W, 0.004, w), basic(color)); m.position.set(0, 0.005, z); };
		line(TEE); line(BACK + 0.0, 0x475569); line(HOG, 0xdc2626, 0.1);
		const centre = s.mesh(geo.box(0.02, 0.004, 36), basic(0xcbd5e1));
		centre.position.set(0, 0.004, -16);
		// eight reusable stones
		this.meshes = [];
		this.pools = [[], []];
		for (let i = 0; i < PER_TEAM * 2; i++) {
			const g = new THREE.Group();
			const body = s.mesh(geo.cylinder(R, R * 0.92, 0.16, 28), standard(0x6b7280, { roughness: 0.55, metalness: 0.1 }), g);
			body.position.y = 0.08;
			const band = s.mesh(geo.cylinder(R * 0.75, R * 0.75, 0.03, 24), i % 2 === RED ? standard(0xdc2626) : standard(0xfacc15), g);
			band.position.y = 0.17;
			const handle = s.mesh(geo.box(0.05, 0.05, 0.22), i % 2 === RED ? standard(0xb91c1c) : standard(0xca8a04), g);
			handle.position.set(0, 0.21, 0.02);
			s.scene.add(g);
			this.meshes.push(g);
			this.pools[i % 2].push(g);
		}
		// the aiming guide
		this.guide = s.mesh(geo.box(0.03, 0.01, 1), themed('primary', { basic: true }));
		this.guide.visible = false;
		this.curlArrow = s.mesh(geo.cone(0.12, 0.3, 3), themed('primary', { basic: true }));
		this.curlArrow.visible = false;
	}

	reset() {
		this.running = false;
		this.ends = Number(this.ctx.settings.ends ?? 4);
		this.end = 0;
		this.totals = [0, 0];
		this.hammer = YELLOW; // the side throwing last
		this.spin = 1;
		this.ctx.score(0);
		this.startEnd();
	}

	startEnd() {
		this.stones = [];
		this.thrownCount = 0;
		this.phase = 'aim';
		this.aimX = 0; this.weight = 0.5;
		this.drag = null;
		this.camFocus = 0;
		this.nextThrow();
	}

	team() { return (this.thrownCount + (this.hammer === RED ? 1 : 0)) % 2 === 0 ? RED : YELLOW; }

	nextThrow() {
		if (this.thrownCount >= PER_TEAM * 2) return this.scoreEnd();
		this.current = this.team();
		this.phase = this.current === RED ? 'aim' : 'cpu';
		this.updateHud();
		if (this.phase === 'cpu') this.cpuTimer = setTimeout(() => this.cpuThrow(), 900);
	}

	updateHud() {
		const left = [0, 0];
		for (let k = this.thrownCount; k < PER_TEAM * 2; k++) left[(k + (this.hammer === RED ? 1 : 0)) % 2 === 0 ? RED : YELLOW]++;
		this.hud.children[0].textContent = `End ${this.end + 1}/${this.ends} · You ${this.totals[RED]} – ${this.totals[YELLOW]} CPU`;
		this.hud.children[1].textContent = `Stones left: you ${left[RED]}, CPU ${left[YELLOW]}`;
		this.hud.children[2].textContent = this.phase === 'cpu' ? 'CPU is throwing…' : this.phase === 'aim' ? 'Your throw' : 'Sweep! (hold)';
		this.curlBtn.textContent = this.spin > 0 ? 'Turn: ⟳ curls right' : 'Turn: ⟲ curls left';
		this.ctx.info(`End ${this.end + 1}/${this.ends}`);
	}

	toggleCurl() { this.spin = -this.spin; this.ctx.audio.play('click'); this.updateHud(); }

	down(e) {
		if (!this.running || e.target.closest?.('button')) return;
		if (this.phase === 'slide') { this.pointerHeld = true; return; }
		if (this.phase !== 'aim') return;
		this.drag = { x: e.clientX, y: e.clientY };
	}

	move(e) {
		if (!this.drag) return;
		const rect = this.ctx.root.getBoundingClientRect();
		const dx = (e.clientX - this.drag.x) / rect.width, dy = (e.clientY - this.drag.y) / rect.height;
		this.aimX = Math.max(-1, Math.min(1, -dx * 2.2));
		this.weight = Math.max(0.05, Math.min(1, dy * 2.4));
	}

	up() {
		this.pointerHeld = false;
		if (!this.drag) return;
		this.drag = null;
		if (this.phase === 'aim' && this.weight > 0.08) this.throwStone(RED, this.aimX * 0.06, this.speedFor(this.weight), this.spin);
	}

	speedFor(w) {
		// weight 0.5 ≈ a draw to the button; 1 ≈ a hard takeout
		const draw = Math.sqrt(2 * MU * Math.abs(TEE));
		return w < 0.6 ? draw * (0.75 + w * 0.42) : draw * (1.0 + (w - 0.6) * 1.3);
	}

	throwStone(team, angle, speed, spin) {
		const stone = { x: 0, y: -0.5, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, r: R, team, spin, inPlay: true, thrown: true, mesh: this.pools[team][this.stones.filter((o) => o.team === team).length] };
		for (const s of this.stones) s.thrown = false;
		this.stones.push(stone);
		this.thrownCount++;
		this.phase = 'slide';
		this.hint.hidden = true;
		this.ctx.audio.play('roll');
		this.updateHud();
	}

	cpuThrow() {
		if (!this.running) return;
		const skill = { easy: 0.06, normal: 0.03, hard: 0.012 }[this.ctx.settings.difficulty ?? 'normal'] ?? 0.03;
		const inHouse = this.stones.filter((s) => s.inPlay && Math.hypot(s.x, s.y - TEE) < HOUSE + R).sort((a, b) => Math.hypot(a.x, a.y - TEE) - Math.hypot(b.x, b.y - TEE));
		const spin = Math.random() < 0.5 ? 1 : -1;
		let target = { x: (Math.random() - 0.5) * 0.4, y: TEE + (Math.random() - 0.5) * 0.4 }, speed = null;
		if (inHouse.length && inHouse[0].team === RED) { target = { x: inHouse[0].x, y: inHouse[0].y }; speed = this.speedFor(0.85); }
		// search the release angle (and weight for draws) with a quick simulation without other stones
		let best = null;
		for (let a = -0.08; a <= 0.08; a += 0.004) {
			for (const w of speed ? [speed] : [0.42, 0.46, 0.5, 0.54, 0.58].map((x) => this.speedFor(x))) {
				const ghost = [{ x: 0, y: -0.5, vx: Math.sin(a) * w, vy: -Math.cos(a) * w, r: R, spin, inPlay: true }];
				let closest = Infinity;
				for (let t = 0; t < 30 && simulate(ghost, 1 / 30, false); t += 1 / 30) closest = Math.min(closest, Math.hypot(ghost[0].x - target.x, ghost[0].y - target.y));
				const err = speed ? closest : Math.hypot(ghost[0].x - target.x, ghost[0].y - target.y);
				if (!best || err < best.err) best = { a, w, err };
			}
		}
		this.throwStone(YELLOW, best.a + (Math.random() - 0.5) * skill, best.w * (1 + (Math.random() - 0.5) * skill * 2), spin);
	}

	update(dt) {
		this.particles.update(dt);
		if (this.running && this.phase === 'slide') {
			const sweeping = this.current === RED && (this.ctx.input.isDown('action') || Boolean(this.drag) || this.pointerHeld);
			const steps = 4;
			let moving = false;
			for (let k = 0; k < steps; k++) moving = simulate(this.stones, dt / steps, sweeping) || moving;
			for (const s of this.stones) if (s.clack) { this.ctx.audio.play('blockhit'); this.particles.emit(s.x, 0.15, s.y, { count: 8, color: 0xe2e8f0, speed: 1, size: 0.04, life: 0.4, gravity: -3 }); s.clack = 0; }
			const thrown = this.stones.at(-1);
			if (sweeping && thrown?.inPlay && Math.random() < 0.6) this.particles.emit(thrown.x + (Math.random() - 0.5) * 0.3, 0.02, thrown.y - 0.45, { count: 1, color: 0xe0f2fe, speed: 0.4, size: 0.03, life: 0.35, gravity: 0 });
			if (!moving) {
				// stones that stop short of the hog line are removed
				for (const s of this.stones) if (s.thrown && s.y > HOG) s.inPlay = false;
				this.phase = 'wait';
				setTimeout(() => { if (this.running) this.nextThrow(); }, 700);
			}
		}
		this.place(dt);
	}

	scoreEnd() {
		const live = this.stones.filter((s) => s.inPlay).map((s) => ({ s, d: Math.hypot(s.x, s.y - TEE) })).filter((o) => o.d < HOUSE + R).sort((a, b) => a.d - b.d);
		let points = 0, winner = -1;
		if (live.length) {
			winner = live[0].s.team;
			const theirs = live.find((o) => o.s.team !== winner);
			points = live.filter((o) => o.s.team === winner && (!theirs || o.d < theirs.d)).length;
		}
		if (winner >= 0) { this.totals[winner] += points; this.hammer = 1 - winner; }
		this.ctx.score(this.totals[RED]);
		this.ctx.audio.play(winner === RED ? 'cheer' : winner === YELLOW ? 'lose' : 'click');
		this.ctx.fx.banner(winner < 0 ? 'Blank end' : `${winner === RED ? 'You score' : 'CPU scores'} ${points}`);
		this.end++;
		this.phase = 'between';
		if (this.end >= this.ends) {
			const [a, b] = this.totals;
			const win = a > b;
			if (win) this.ctx.fx.confetti({ count: 70 });
			return setTimeout(() => this.finish({ win, title: win ? 'You win the match!' : a === b ? 'A tied match' : 'The computer wins', message: `Final score ${a}–${b} after ${this.ends} ends.`, score: a * 10 + Math.max(0, a - b) * 5 }), 1400);
		}
		setTimeout(() => { if (this.running) this.startEnd(); }, 1800);
	}

	place(dt) {
		for (const m of this.meshes) m.visible = false;
		for (const st of this.stones) {
			if (!st.inPlay || !st.mesh) continue;
			st.mesh.visible = true;
			st.mesh.position.set(st.x, 0, st.y);
			st.mesh.rotation.y += st.spin * Math.hypot(st.vx, st.vy) * dt * 0.8;
		}
		const aiming = this.phase === 'aim' && this.running;
		if (aiming) {
			const next = this.pools[RED][this.stones.filter((o) => o.team === RED).length];
			if (next) { next.position.set(0, 0, -0.5); next.rotation.y = 0; next.visible = true; }
			const angle = this.aimX * 0.06, len = 2 + this.weight * 8;
			this.guide.visible = true;
			this.guide.scale.set(1, 1, len);
			this.guide.position.set(Math.sin(angle) * len / 2, 0.01, -0.5 - Math.cos(angle) * len / 2);
			this.guide.rotation.y = -angle;
			this.curlArrow.visible = true;
			this.curlArrow.position.set(Math.sin(angle) * len, 0.05, -0.5 - Math.cos(angle) * len);
			this.curlArrow.rotation.set(-Math.PI / 2, 0, this.spin > 0 ? -Math.PI / 2 : Math.PI / 2);
		} else { this.guide.visible = false; this.curlArrow.visible = false; }
		// camera: behind the hack while aiming, then chase the stone, then look over the house
		const cam = this.stage.camera;
		const moving = this.stones.at(-1);
		let fz = 0;
		if ((this.phase === 'slide' || this.phase === 'wait') && moving?.inPlay) fz = moving.y;
		else if (this.phase === 'aim' || this.phase === 'cpu') fz = 0;
		else fz = TEE;
		this.camFocus = damp(this.camFocus, fz, 0.06, dt);
		const nearHouse = Math.min(1, Math.max(0, (this.camFocus - (TEE + 12)) / -12));
		cam.position.set(0, 2.4 + nearHouse * 4.5, this.camFocus + 4.2 - nearHouse * 1.5);
		cam.lookAt(0, 0, this.camFocus - 6 + nearHouse * 3.5);
	}

	render() { this.stage.render(); }

	dispose() {
		clearTimeout(this.cpuTimer);
		this.stage.dispose();
		this.hud.remove();
		this.turnBar.remove();
		this.hint.remove();
	}
}
