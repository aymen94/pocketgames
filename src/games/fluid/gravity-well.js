// Gravity Well: slingshot a probe through a system of planets to the beacon. Gravity bends
// every path; rocks and planets destroy the probe. A short trajectory preview shows the
// start of each shot; where it goes after that is up to your physics intuition.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, text, glow } from '../core/canvas.js';
import { LEVELS, stepProbe, launch } from './gravity-levels.js';

const W = 720, H = 480;
const PLANET_COLORS = [['#60a5fa', '#1e3a8a'], ['#f59e0b', '#7c2d12'], ['#34d399', '#064e3b'], ['#f472b6', '#831843']];

export default class GravityWell extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.stars = Array.from({ length: 120 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.6 + 0.3 }));
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	load(i) {
		this.level = i;
		this.L = LEVELS[i];
		this.shots = this.L.shots;
		this.probe = null;
		this.aim = null;
		this.path = [];
		this.ctx.info(`Level ${i + 1}: ${this.L.name}`);
	}

	pointerDown(p) {
		if (!this.running || this.probe) return;
		if (Math.hypot(p.x - this.L.start.x, p.y - this.L.start.y) > 120) return;
		this.aim = { x: p.x, y: p.y };
	}

	pointerMove(p) { if (this.aim && p.down) { this.aim.x = p.x; this.aim.y = p.y; } }

	pointerUp(p) {
		if (!this.aim) return;
		const dx = this.L.start.x - p.x, dy = this.L.start.y - p.y;
		this.aim = null;
		if (Math.hypot(dx, dy) < 10) return;
		this.fire(launch(dx, dy));
	}

	/** Keyboard aiming: arrows turn and stretch, Space fires. */
	key(action) {
		if (this.probe) return;
		this.kAim ??= { a: -0.6, power: 70 };
		if (action === 'left') this.kAim.a -= 0.03;
		if (action === 'right') this.kAim.a += 0.03;
		if (action === 'up') this.kAim.power = Math.min(170, this.kAim.power + 6);
		if (action === 'down') this.kAim.power = Math.max(15, this.kAim.power - 6);
		if (action === 'action') this.fire(launch(Math.cos(this.kAim.a) * this.kAim.power, Math.sin(this.kAim.a) * this.kAim.power));
	}

	fire(v) {
		if (!this.running || this.probe || this.shots <= 0) return;
		this.shots--;
		this.probe = { x: this.L.start.x, y: this.L.start.y, vx: v.vx, vy: v.vy, t: 0 };
		this.path = [];
		this.ctx.audio.play('boost');
	}

	preview() {
		let dx, dy;
		if (this.aim) { dx = this.L.start.x - this.aim.x; dy = this.L.start.y - this.aim.y; }
		else if (this.kAim) { dx = Math.cos(this.kAim.a) * this.kAim.power; dy = Math.sin(this.kAim.a) * this.kAim.power; }
		else return null;
		const v = launch(dx, dy);
		const p = { x: this.L.start.x, y: this.L.start.y, vx: v.vx, vy: v.vy };
		const pts = [];
		for (let i = 0; i < 150; i++) {
			if (stepProbe(p, this.L, 1 / 120)) break;
			if (i % 6 === 0) pts.push(p.x, p.y);
		}
		return pts;
	}

	step(dt) {
		const p = this.probe;
		if (!p) return;
		const sub = Math.max(1, Math.round(dt * 120));
		for (let s = 0; s < sub; s++) {
			const r = stepProbe(p, this.L, dt / sub);
			p.t += dt / sub;
			if (r === 'goal') return this.goal();
			if (r || p.t > 10) return this.lost(r);
		}
		this.path.push(p.x, p.y);
		if (this.path.length > 400) this.path.splice(0, 2);
		if (Math.random() < 0.5) this.fx.particles.burst(p.x, p.y, { count: 1, color: '#fde68a', speed: 20, life: 0.5, size: 2, glow: true });
	}

	goal() {
		const gain = 150 + this.shots * 50;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		const t = this.L.target;
		this.burst(t.x, t.y, { count: 50, colors: ['#a7f3d0', '#fde047', '#ffffff'], speed: 220, life: 0.9, shape: 'star', size: 5 });
		this.popup(`+${gain}`, t.x, t.y - 30, { color: '#fde047', size: 26 });
		this.probe = null;
		if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Navigator!', message: 'Every beacon reached.', score: this.score });
		setTimeout(() => { if (this.running) { this.load(this.level + 1); this.ctx.fx.banner(`Level ${this.level + 1}`); } }, 900);
	}

	lost(reason) {
		const p = this.probe;
		this.probe = null;
		if (reason === 'crash') {
			this.ctx.audio.play('explode');
			this.burst(p.x, p.y, { count: 30, colors: ['#fb923c', '#fde047', '#ffffff'], speed: 200, life: 0.7, shape: 'spark', size: 3 });
			this.fx.shake.kick(6);
		} else this.ctx.audio.play('lifelost');
		if (this.shots <= 0) this.finish({ win: false, title: 'Out of probes', message: `You reached level ${this.level + 1}.`, score: this.score });
	}

	draw(g) {
		g.fillStyle = '#050816';
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#ffffff';
		for (const s of this.stars) { g.globalAlpha = 0.3 + s.s * 0.3; g.fillRect(s.x, s.y, s.s, s.s); }
		g.globalAlpha = 1;
		const L = this.L, t = performance.now() / 1000;
		L.planets.forEach((pl, i) => {
			const [a, b] = PLANET_COLORS[i % PLANET_COLORS.length];
			glow(g, pl.x, pl.y, pl.r * 2.6, `${a}33`);
			const grad = g.createRadialGradient(pl.x - pl.r * 0.4, pl.y - pl.r * 0.4, pl.r * 0.1, pl.x, pl.y, pl.r);
			grad.addColorStop(0, a);
			grad.addColorStop(1, b);
			g.fillStyle = grad;
			g.beginPath(); g.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2); g.fill();
		});
		for (const r of L.rocks) {
			g.fillStyle = '#57534e';
			g.beginPath();
			for (let k = 0; k < 9; k++) {
				const a = (k / 9) * Math.PI * 2, rr = r.r * (0.8 + ((k * 37) % 10) / 40);
				g.lineTo(r.x + Math.cos(a) * rr, r.y + Math.sin(a) * rr);
			}
			g.fill();
		}
		const T = L.target;
		glow(g, T.x, T.y, T.r * 2.5, 'rgba(52,211,153,0.4)');
		g.strokeStyle = '#34d399';
		g.lineWidth = 3;
		g.beginPath(); g.arc(T.x, T.y, T.r * (0.8 + Math.sin(t * 4) * 0.1), 0, Math.PI * 2); g.stroke();
		// past path
		if (this.path.length > 2) {
			g.strokeStyle = 'rgba(253,230,138,0.45)';
			g.lineWidth = 2;
			g.beginPath();
			g.moveTo(this.path[0], this.path[1]);
			for (let i = 2; i < this.path.length; i += 2) g.lineTo(this.path[i], this.path[i + 1]);
			g.stroke();
		}
		// launcher and preview
		const S = L.start;
		circle(g, S.x, S.y, 12, '#334155');
		const pts = !this.probe && this.preview();
		if (pts) {
			g.fillStyle = 'rgba(255,255,255,0.7)';
			for (let i = 0; i < pts.length; i += 2) { g.globalAlpha = 1 - i / pts.length; g.fillRect(pts[i] - 1.5, pts[i + 1] - 1.5, 3, 3); }
			g.globalAlpha = 1;
			if (this.aim) { g.strokeStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.moveTo(S.x, S.y); g.lineTo(this.aim.x, this.aim.y); g.stroke(); }
		}
		if (this.probe) circle(g, this.probe.x, this.probe.y, 5, '#fde68a');
		else circle(g, S.x, S.y, 5, '#fde68a');
		text(g, `Probes ${'●'.repeat(this.shots)}${'○'.repeat(L.shots - this.shots)}`, 14, 18, { size: 14, align: 'left', color: '#e2e8f0' });
		if (!this.probe && this.running && !this.aim) text(g, 'Drag back from the probe and release · or arrows + Space', W / 2, H - 16, { size: 12, color: 'rgba(226,232,240,0.6)' });
	}
}
