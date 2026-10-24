// Moon Lander: rotate and fire the main engine to set the lander down gently on a pad.
// Narrow pads pay more. Land too fast, too tilted or off a pad and you crash. Later
// levels add stronger gravity, rougher ground and crosswinds.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text } from '../core/canvas.js';
import { Trail } from '../core/fx.js';

const W = 800, H = 500;

function terrain(level) {
	// a seeded random walk with flat pads cut into it
	let seed = 1234 + level * 977;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const rough = 30 + level * 12;
	const pts = [];
	let y = 380;
	for (let x = 0; x <= W; x += 20) {
		y = Math.max(250, Math.min(470, y + (rnd() - 0.5) * rough));
		pts.push([x, y]);
	}
	const pads = [];
	const widths = level < 2 ? [80, 60, 44] : level < 4 ? [60, 44, 34] : [44, 34, 30];
	const mult = [2, 3, 5];
	const slots = [[60, 220], [320, 480], [580, 740]];
	for (let i = 0; i < 3; i++) {
		const [a, b] = slots[(i + level) % 3];
		const x0 = Math.round((a + rnd() * (b - a - widths[i])) / 20) * 20;
		const x1 = x0 + Math.ceil(widths[i] / 20) * 20;
		const py = pts[x0 / 20][1];
		for (const p of pts) if (p[0] >= x0 && p[0] <= x1) p[1] = py;
		pads.push({ x0, x1, y: py, mult: mult[i] });
	}
	return { pts, pads };
}

export default class MoonLander extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.stars = Array.from({ length: 90 }, () => [Math.random() * W, Math.random() * 300, Math.random() * 1.5 + 0.3]);
		this.trail = new Trail(20);
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ships = 3;
		this.ctx.score(0);
		this.load(0);
	}

	load(i) {
		this.level = i;
		this.ground = terrain(i);
		this.gravity = 34 + i * 6;
		this.wind = i >= 3 ? (i - 2) * 6 * (i % 2 ? 1 : -1) : 0;
		this.spawn();
	}

	spawn() {
		this.ship = { x: 120 + Math.random() * 560, y: 50, vx: (Math.random() - 0.5) * 40, vy: 0, a: 0, fuel: 100, thrust: false };
		this.state = 'flying';
		this.trail.reset();
		this.ctx.info(`Level ${this.level + 1} · Ships ${this.ships}${this.wind ? ` · wind ${this.wind > 0 ? '→' : '←'}` : ''}`);
	}

	groundAt(x) {
		const pts = this.ground.pts;
		const i = Math.max(0, Math.min(pts.length - 2, Math.floor(x / 20)));
		const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
		return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
	}

	step(dt) {
		const s = this.ship;
		if (this.state !== 'flying') return;
		const input = this.ctx.input;
		if (input.isDown('left')) s.a -= 2.6 * dt;
		if (input.isDown('right')) s.a += 2.6 * dt;
		s.thrust = (input.isDown('up') || input.isDown('action') || this.pointer.down) && s.fuel > 0;
		if (this.pointer.down) {
			// touch: steer toward the side of the screen being held
			const want = Math.max(-1, Math.min(1, (this.pointer.x - W / 2) / (W / 3)));
			s.a += (want * 0.9 - s.a) * Math.min(1, dt * 4);
		}
		s.a = Math.max(-1.6, Math.min(1.6, s.a));
		if (s.thrust) {
			s.vx += Math.sin(s.a) * 110 * dt;
			s.vy -= Math.cos(s.a) * 110 * dt;
			s.fuel = Math.max(0, s.fuel - dt * 9);
			if (Math.random() < 0.6) this.fx.particles.burst(s.x - Math.sin(s.a) * 14, s.y + Math.cos(s.a) * 14, { count: 1, colors: ['#fde047', '#fb923c'], speed: 120, angle: s.a + Math.PI / 2, spread: 0.5, life: 0.35, size: 3, glow: true });
		}
		s.vy += this.gravity * dt;
		s.vx += this.wind * dt;
		s.x += s.vx * dt;
		s.y += s.vy * dt;
		if (s.x < 0) s.x += W;
		if (s.x > W) s.x -= W;
		this.trail.push(s.x, s.y);
		if (s.y < -100) s.y = -100;
		// touchdown: check both legs
		const lx = s.x - 10, rx = s.x + 10;
		if (s.y + 12 >= this.groundAt(lx) || s.y + 12 >= this.groundAt(rx)) this.touchdown();
	}

	touchdown() {
		const s = this.ship;
		const pad = this.ground.pads.find((p) => s.x - 10 >= p.x0 && s.x + 10 <= p.x1);
		const soft = s.vy < 40 && Math.abs(s.vx) < 25 && Math.abs(s.a) < 0.22;
		if (pad && soft) {
			this.state = 'landed';
			s.y = pad.y - 12;
			const gain = pad.mult * 50 + Math.round(s.fuel * 2);
			this.score += gain;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.popup(`Landed ×${pad.mult} · +${gain}`, s.x, s.y - 40, { color: '#a7f3d0', size: 22 });
			setTimeout(() => {
				if (!this.running) return;
				if (this.level + 1 >= 8) return this.finish({ win: true, title: 'The Eagle has landed!', message: 'All 8 landings made.', score: this.score });
				this.load(this.level + 1);
				this.ctx.fx.banner(`Level ${this.level + 1}`);
			}, 1500);
		} else {
			this.state = 'crashed';
			this.ships--;
			this.ctx.audio.play('explode');
			this.fx.shake.kick(10);
			this.burst(s.x, s.y, { count: 50, colors: ['#fb923c', '#fde047', '#e5e7eb'], speed: 240, life: 0.9, shape: 'spark', size: 3, gravity: 120 });
			const why = !pad ? 'Missed the pad' : s.vy >= 40 ? 'Too fast' : Math.abs(s.vx) >= 25 ? 'Drifting sideways' : 'Not level';
			this.popup(why, s.x, s.y - 30, { color: '#fca5a5', size: 22 });
			setTimeout(() => {
				if (!this.running) return;
				if (this.ships <= 0) return this.finish({ win: false, title: 'Mission over', message: `You reached level ${this.level + 1}.`, score: this.score });
				this.spawn();
			}, 1400);
		}
	}

	draw(g) {
		g.fillStyle = '#030712';
		g.fillRect(0, 0, W, H);
		for (const [x, y, s] of this.stars) { g.fillStyle = `rgba(255,255,255,${0.3 + s * 0.3})`; g.fillRect(x, y, s, s); }
		g.fillStyle = '#9ca3af';
		g.beginPath();
		g.arc(680, 80, 30, 0, Math.PI * 2);
		g.fill();
		// ground
		g.fillStyle = '#374151';
		g.beginPath();
		g.moveTo(0, H);
		for (const [x, y] of this.ground.pts) g.lineTo(x, y);
		g.lineTo(W, H);
		g.fill();
		g.strokeStyle = '#6b7280';
		g.lineWidth = 2;
		g.beginPath();
		this.ground.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
		g.stroke();
		for (const p of this.ground.pads) {
			g.strokeStyle = '#34d399';
			g.lineWidth = 4;
			g.beginPath(); g.moveTo(p.x0, p.y); g.lineTo(p.x1, p.y); g.stroke();
			text(g, `×${p.mult}`, (p.x0 + p.x1) / 2, p.y + 16, { size: 13, color: '#a7f3d0' });
		}
		const s = this.ship;
		if (this.state !== 'crashed') {
			this.trail.draw(g, 'rgba(147,197,253,0.6)', 2);
			g.save();
			g.translate(s.x, s.y);
			g.rotate(s.a);
			g.fillStyle = '#e5e7eb';
			g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 4); g.lineTo(-10, 4); g.closePath(); g.fill();
			fillRound(g, -8, 2, 16, 6, 2, '#9ca3af');
			g.strokeStyle = '#e5e7eb';
			g.lineWidth = 2;
			g.beginPath(); g.moveTo(-6, 6); g.lineTo(-11, 12); g.moveTo(6, 6); g.lineTo(11, 12); g.stroke();
			if (s.thrust) { g.fillStyle = '#fb923c'; g.beginPath(); g.moveTo(-4, 8); g.lineTo(0, 18 + Math.random() * 8); g.lineTo(4, 8); g.fill(); }
			g.restore();
		}
		// instruments
		const ok = (v, lim) => (Math.abs(v) < lim ? '#a7f3d0' : '#fca5a5');
		fillRound(g, 10, 10, 190, 78, 8, 'rgba(15,23,42,0.75)');
		text(g, `Fuel`, 20, 24, { size: 12, align: 'left', color: '#cbd5e1' });
		fillRound(g, 60, 18, 128, 10, 5, 'rgba(255,255,255,0.1)');
		fillRound(g, 60, 18, Math.max(10, 1.28 * s.fuel), 10, 5, s.fuel > 25 ? '#fde047' : '#f87171');
		text(g, `↓ speed ${Math.round(s.vy)}`, 20, 46, { size: 12, align: 'left', color: ok(s.vy, 40) });
		text(g, `→ drift ${Math.round(s.vx)}`, 20, 64, { size: 12, align: 'left', color: ok(s.vx, 25) });
		text(g, `tilt ${Math.round((s.a * 180) / Math.PI)}°`, 120, 64, { size: 12, align: 'left', color: ok(s.a, 0.22) });
		text(g, `Ships ${'▲'.repeat(Math.max(0, this.ships))}`, 120, 46, { size: 12, align: 'left', color: '#e5e7eb' });
	}
}
