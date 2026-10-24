// Fairway Golf: nine side-view holes over rolling, generated terrain. Drag back from the
// ball to aim and set power, release to swing. Wind pushes the ball in flight, sand
// grabs it, water costs a stroke, and the ball rolls down slopes. Fewest strokes wins.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 800, H = 480, STEP = 16, G = 420;
const HOLES = 9;

function terrain(seed, holeIndex) {
	let s = seed;
	const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	const length = 1300 + holeIndex * 120 + Math.floor(rnd() * 500);
	const n = Math.ceil(length / STEP) + 1;
	const h = new Float32Array(n), kind = new Uint8Array(n); // 0 grass, 1 sand, 2 water, 3 green
	let y = 330, slope = 0;
	for (let i = 0; i < n; i++) {
		slope += (rnd() - 0.5) * 1.6;
		slope *= 0.9;
		y = Math.max(190, Math.min(400, y + slope));
		h[i] = y;
	}
	// flatten the tee and the green
	for (let i = 0; i < 10; i++) h[i] = h[10];
	const hole = n - 14;
	for (let i = hole - 12; i < n; i++) { h[i] = h[hole - 12]; kind[i] = 3; }
	// hazards somewhere in the middle
	const hazards = 1 + Math.floor(rnd() * 2) + (holeIndex > 4 ? 1 : 0);
	for (let k = 0; k < hazards; k++) {
		const at = 25 + Math.floor(rnd() * (hole - 60)), len = 6 + Math.floor(rnd() * 8);
		const water = rnd() < 0.45;
		const base = Math.max(...Array.from({ length: len }, (_, j) => h[at + j] ?? 0)) + (water ? 16 : 6);
		for (let j = 0; j < len && at + j < hole - 14; j++) { kind[at + j] = water ? 2 : 1; h[at + j] = water ? base : h[at + j] + 6; }
	}
	const par = length < 1500 ? 3 : length < 2000 ? 4 : 5;
	return { h, kind, n, length, holeX: hole * STEP, par, wind: (rnd() - 0.5) * 70 };
}

export default class FairwayGolf extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.hole = 0;
		this.total = 0;
		this.card = [];
		this.seed = 1 + Math.floor(Math.random() * 1e9);
		this.ctx.score(0);
		this.loadHole();
	}

	loadHole() {
		this.course = terrain(this.seed + this.hole * 7919, this.hole);
		this.strokes = 0;
		this.ball = { x: 6 * STEP, y: this.ground(6 * STEP) - 5, vx: 0, vy: 0, moving: false, rest: 0, inAir: false };
		this.safe = { x: this.ball.x, y: this.ball.y };
		this.camX = 0;
		this.aim = null;
		this.holed = false;
		this.ctx.info(`Hole ${this.hole + 1}/${HOLES} · Par ${this.course.par} · Total ${this.total}`);
	}

	ground(x) {
		const c = this.course;
		const i = Math.max(0, Math.min(c.n - 2, Math.floor(x / STEP)));
		const t = Math.max(0, Math.min(1, x / STEP - i));
		return c.h[i] * (1 - t) + c.h[i + 1] * t;
	}

	kindAt(x) { return this.course.kind[Math.max(0, Math.min(this.course.n - 1, Math.round(x / STEP)))]; }

	pointerDown(p) {
		const b = this.ball;
		if (!this.running || b.moving || this.holed) return;
		this.aim = { sx: p.x, sy: p.y, x: p.x, y: p.y };
	}

	pointerMove(p) { if (this.aim) { this.aim.x = p.x; this.aim.y = p.y; } }

	shotVector() {
		const b = this.ball;
		const dx = this.aim.sx - this.aim.x, dy = this.aim.sy - this.aim.y;
		const len = Math.min(170, Math.hypot(dx, dy));
		if (len < 10) return null;
		const a = Math.atan2(dy, dx), power = len * 4.4 * (this.kindAt(b.x) === 1 ? 0.6 : this.kindAt(b.x) === 3 ? 0.45 : 1);
		return { vx: Math.cos(a) * power, vy: Math.sin(a) * power };
	}

	pointerUp() {
		if (!this.aim) return;
		const v = this.shotVector();
		this.aim = null;
		if (!v) return;
		const b = this.ball;
		this.safe = { x: b.x, y: b.y };
		b.vx = v.vx; b.vy = v.vy;
		b.moving = true;
		b.rest = 0;
		b.flight = 0;
		this.strokes++;
		this.ctx.audio.play(Math.hypot(v.vx, v.vy) > 300 ? 'swish' : 'click');
		this.ctx.info(`Hole ${this.hole + 1}/${HOLES} · Par ${this.course.par} · Stroke ${this.strokes}`);
	}

	step(dt) {
		const b = this.ball, c = this.course;
		if (b.moving && (b.flight += dt) > 14) this.stop();
		if (b.moving) {
			const sub = 4, h = dt / sub;
			for (let k = 0; k < sub && b.moving; k++) this.integrate(h);
		}
		// camera follows the ball
		const want = Math.max(0, Math.min(c.length - W, b.x - W * 0.4));
		this.camX += (want - this.camX) * Math.min(1, dt * 3);
	}

	integrate(dt) {
		const b = this.ball, c = this.course;
		const gy = this.ground(b.x);
		const air = b.y < gy - 5.5;
		b.vy += G * dt;
		if (air) b.vx += c.wind * dt;
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		if (b.x < 5) { b.x = 5; b.vx = Math.abs(b.vx) * 0.5; }
		if (b.x > c.length - 5) { b.x = c.length - 5; b.vx = -Math.abs(b.vx) * 0.5; }
		const ground = this.ground(b.x) - 5;
		if (b.y >= ground) {
			const kind = this.kindAt(b.x);
			if (kind === 2) return this.splash();
			// collide with the local slope
			const slope = (this.ground(b.x + 2) - this.ground(b.x - 2)) / 4;
			let nx = slope, ny = -1;
			const len = Math.hypot(nx, ny); nx /= len; ny /= len;
			b.y = ground;
			const vn = b.vx * nx + b.vy * ny;
			if (vn < 0) {
				const bounce = kind === 1 ? 0.05 : kind === 3 ? 0.15 : 0.35;
				b.vx -= (1 + bounce) * vn * nx;
				b.vy -= (1 + bounce) * vn * ny;
				if (-vn > 120) { this.ctx.audio.play(kind === 1 ? 'thud' : 'tick'); if (kind === 1) this.burst(b.x - this.camX, b.y, { count: 8, color: '#fde68a', speed: 80, angle: -Math.PI / 2, spread: 1.6, life: 0.4, size: 2, gravity: 200 }); }
			}
			const friction = kind === 1 ? 6 : kind === 3 ? 0.9 : 1.6;
			b.vx *= Math.exp(-friction * dt);
			b.vy *= Math.exp(-friction * dt);
			// into the cup
			if (Math.abs(b.x - c.holeX) < 7 && Math.hypot(b.vx, b.vy) < 300) return this.sink();
			if (Math.hypot(b.vx, b.vy) < 10) { b.rest += dt; if (b.rest > 0.25) this.stop(); } else b.rest = 0;
		}
	}

	splash() {
		const b = this.ball;
		this.ctx.audio.play('splash');
		this.burst(b.x - this.camX, b.y, { count: 20, color: '#7dd3fc', speed: 140, angle: -Math.PI / 2, spread: 1.4, life: 0.6, size: 3, gravity: 300 });
		this.popup('Water! +1', b.x - this.camX, b.y - 30, { color: '#7dd3fc', size: 18 });
		this.strokes++;
		Object.assign(b, { x: this.safe.x, y: this.safe.y, vx: 0, vy: 0, moving: false });
	}

	stop() {
		const b = this.ball;
		b.moving = false;
		b.vx = b.vy = 0;
		if (this.strokes >= 10) { this.popup('Picked up', b.x - this.camX, b.y - 30, { size: 18 }); this.sink(true); }
	}

	sink(pickup = false) {
		const b = this.ball, c = this.course;
		b.moving = false;
		this.holed = true;
		const diff = this.strokes - c.par;
		const name = pickup ? 'Max strokes' : this.strokes === 1 ? 'Hole in one!' : ['Albatross!', 'Eagle!', 'Birdie!', 'Par', 'Bogey', 'Double bogey'][diff + 3] ?? `+${diff}`;
		this.ctx.audio.play(diff < 0 ? 'cheer' : 'coin');
		if (diff < 0) this.ctx.fx.confetti({ count: 50 });
		this.popup(name, W / 2, 120, { color: diff <= 0 ? '#bef264' : '#fde68a', size: 30 });
		this.total += this.strokes;
		this.card.push(this.strokes);
		this.ctx.score(this.total);
		setTimeout(() => {
			if (!this.running) return;
			this.hole++;
			if (this.hole >= HOLES) {
				return this.finish({ win: true, title: 'Round complete', message: `${this.total} strokes over ${HOLES} holes (${this.card.join(' · ')}).`, score: this.total, lowerIsBetter: true });
			}
			this.loadHole();
			this.ctx.fx.banner(`Hole ${this.hole + 1} · Par ${this.course.par}`);
		}, 1400);
	}

	draw(g) {
		const c = this.course, cam = this.camX;
		const sky = g.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#7dd3fc');
		sky.addColorStop(1, '#e0f2fe');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		// distant hills (parallax)
		g.fillStyle = '#86efac';
		g.beginPath(); g.moveTo(0, H);
		for (let x = 0; x <= W; x += 20) g.lineTo(x, 250 + Math.sin((x + cam * 0.3) * 0.01) * 30);
		g.lineTo(W, H); g.fill();
		// terrain
		const first = Math.max(0, Math.floor(cam / STEP) - 1), last = Math.min(c.n - 1, Math.ceil((cam + W) / STEP) + 1);
		g.fillStyle = '#65a30d';
		g.beginPath(); g.moveTo(first * STEP - cam, H);
		for (let i = first; i <= last; i++) g.lineTo(i * STEP - cam, c.h[i]);
		g.lineTo(last * STEP - cam, H); g.fill();
		for (let i = first; i < last; i++) {
			const k = c.kind[i];
			if (!k) continue;
			g.fillStyle = k === 1 ? '#fde68a' : k === 2 ? '#38bdf8' : '#4ade80';
			g.beginPath();
			g.moveTo(i * STEP - cam, c.h[i]); g.lineTo((i + 1) * STEP - cam, c.h[i + 1]);
			g.lineTo((i + 1) * STEP - cam, c.h[i + 1] + (k === 2 ? 30 : 10)); g.lineTo(i * STEP - cam, c.h[i] + (k === 2 ? 30 : 10));
			g.fill();
		}
		// cup and flag
		const hx = c.holeX - cam, hy = this.ground(c.holeX);
		fillRound(g, hx - 7, hy - 2, 14, 8, 3, '#1f2937');
		g.strokeStyle = '#f8fafc'; g.lineWidth = 2;
		g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx, hy - 70); g.stroke();
		const wave = Math.sin(performance.now() / 200) * 3;
		g.fillStyle = '#ef4444';
		g.beginPath(); g.moveTo(hx, hy - 70); g.lineTo(hx + 26 * Math.sign(c.wind || 1), hy - 62 + wave); g.lineTo(hx, hy - 54); g.fill();
		// ball and aim
		const b = this.ball;
		circle(g, b.x - cam, b.y, 5, '#ffffff');
		if (this.aim) {
			const v = this.shotVector();
			if (v) {
				g.fillStyle = colors.accent;
				let x = b.x, y = b.y, vx = v.vx, vy = v.vy;
				for (let k = 0; k < 26; k++) {
					for (let s = 0; s < 3; s++) { vy += G / 60; vx += c.wind / 60; x += vx / 60; y += vy / 60; }
					if (y > this.ground(x)) break;
					g.globalAlpha = 1 - k / 26;
					g.beginPath(); g.arc(x - cam, y, 3, 0, Math.PI * 2); g.fill();
				}
				g.globalAlpha = 1;
				const pw = Math.min(1, Math.hypot(v.vx, v.vy) / 750);
				fillRound(g, 20, H - 34, 160, 12, 6, 'rgba(0,0,0,0.3)');
				fillRound(g, 20, H - 34, 160 * pw, 12, 6, pw > 0.85 ? '#ef4444' : colors.accent);
			}
		}
		// HUD
		fillRound(g, 10, 10, 240, 58, 12, 'rgba(15,23,42,0.6)');
		text(g, `Hole ${this.hole + 1}/${HOLES}  ·  Par ${c.par}`, 22, 28, { size: 15, align: 'left' });
		text(g, `Stroke ${this.strokes}  ·  Total ${this.total}`, 22, 50, { size: 13, align: 'left', color: '#cbd5e1' });
		fillRound(g, W - 150, 10, 140, 40, 12, 'rgba(15,23,42,0.6)');
		const wind = Math.round(c.wind / 7);
		text(g, `Wind ${wind > 0 ? '→' : wind < 0 ? '←' : '·'} ${Math.abs(wind)}`, W - 80, 30, { size: 15 });
		const dist = Math.round(Math.abs(c.holeX - b.x) / 8);
		text(g, `${dist} m to the pin`, W / 2, 24, { size: 14, color: '#0c4a6e' });
		if (!b.moving && !this.aim && !this.holed && this.strokes === 0) text(g, 'Drag back from anywhere to aim, release to swing', W / 2, H - 24, { size: 14, color: '#14532d' });
	}
}
