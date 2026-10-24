// Magnet Lab: a stream of charged particles pours from the emitter. Place magnets that
// attract or repel them and bend the stream into the collector. Walls absorb particles;
// a live field map shows where the force points.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text, glow } from '../core/canvas.js';
import { circleSegment } from '../core/physics.js';
import { LEVELS } from './magnet-levels.js';

const W = 720, H = 480;
const STRENGTH = 2.4e6;

export default class MagnetLab extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.runBtn = tool.button('Fire stream', () => this.fire(), { primary: true });
		this.levelLabel = tool.label('');
		return tool.bar(this.levelLabel, this.runBtn, tool.button('Clear magnets', () => { if (this.state === 'arrange') this.magnets = []; }), tool.button('Retry', () => this.load(this.level)), tool.button('Hint', () => this.showHint(), { title: 'Show a layout that works (−50 points)' }));
	}

	setup() {
		this.max = 260;
		this.ps = Array.from({ length: this.max }, () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, trail: [] }));
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
		this.magnets = [];
		this.hintUsed = false;
		this.hintUntil = 0;
		this.state = 'arrange';
		this.emitted = 0;
		this.caught = 0;
		this.carry = 0;
		for (const p of this.ps) p.alive = false;
		this.runBtn.disabled = false;
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${this.L.name}`;
		this.ctx.info(`Magnets ${this.L.magnets} · catch ${Math.round(this.L.need * 100)}%`);
	}

	showHint() {
		if (!this.running || this.state !== 'arrange') return;
		if (!this.hintUsed) { this.score = Math.max(0, this.score - 50); this.ctx.score(this.score); }
		this.hintUsed = true;
		this.hintUntil = performance.now() + 3500;
		this.ctx.audio.play('sparkle');
	}

	fire() {
		if (!this.running || this.state !== 'arrange') return;
		this.state = 'firing';
		this.runBtn.disabled = true;
		this.ctx.audio.play('zap');
	}

	magnetAt(p) { return this.magnets.find((m) => Math.hypot(m.x - p.x, m.y - p.y) < 22); }

	pointerDown(p, e) {
		if (!this.running) return;
		const m = this.magnetAt(p);
		if (m) {
			if (e.button === 2) { this.magnets.splice(this.magnets.indexOf(m), 1); return; }
			this.drag = { m, sx: p.x, sy: p.y, moved: false };
			return;
		}
		if (this.magnets.length >= this.L.magnets) { this.ctx.audio.play('error'); return; }
		this.magnets.push({ x: p.x, y: p.y, sign: 1 });
		this.ctx.audio.play('place');
	}

	pointerMove(p) {
		const d = this.drag;
		if (!d || !p.down) return;
		if (Math.hypot(p.x - d.sx, p.y - d.sy) > 5) d.moved = true;
		if (d.moved) { d.m.x = Math.max(16, Math.min(W - 16, p.x)); d.m.y = Math.max(16, Math.min(H - 16, p.y)); }
	}

	pointerUp() {
		const d = this.drag;
		if (d && !d.moved) { d.m.sign *= -1; this.ctx.audio.play('click'); }
		this.drag = null;
	}

	key(action) { if (action === 'action') this.fire(); }

	force(x, y) {
		let fx = 0, fy = 0;
		for (const m of this.magnets) {
			const dx = m.x - x, dy = m.y - y;
			const d2 = dx * dx + dy * dy + 900;
			const f = (STRENGTH * m.sign) / (d2 * Math.sqrt(d2));
			fx += dx * f; fy += dy * f;
		}
		return [fx, fy];
	}

	step(dt) {
		const L = this.L;
		if (this.state === 'firing' && this.emitted < this.max) {
			this.carry += dt * 80;
			while (this.carry >= 1 && this.emitted < this.max) {
				this.carry--;
				const p = this.ps[this.emitted++];
				const e = L.emitter, len = Math.hypot(e.dx, e.dy);
				Object.assign(p, { alive: true, x: e.x, y: e.y, vx: (e.dx / len) * 260 + (Math.random() - 0.5) * 20, vy: (e.dy / len) * 260 + (Math.random() - 0.5) * 20 });
				p.trail.length = 0;
			}
		}
		const sub = 3, h = Math.min(dt, 1 / 30) / sub;
		let alive = 0;
		for (const p of this.ps) {
			if (!p.alive) continue;
			for (let s = 0; s < sub && p.alive; s++) {
				const [fx, fy] = this.force(p.x, p.y);
				p.vx += fx * h; p.vy += fy * h;
				// speed limit keeps close passes from slingshotting to infinity
				const sp = Math.hypot(p.vx, p.vy);
				if (sp > 600) { p.vx *= 600 / sp; p.vy *= 600 / sp; }
				p.x += p.vx * h; p.y += p.vy * h;
				if (p.x < 0 || p.y < 0 || p.x > W || p.y > H) p.alive = false;
				for (const [ax, ay, bx, by] of L.walls) if (circleSegment(p.x, p.y, 5, ax, ay, bx, by)) { p.alive = false; this.fx.particles.burst(p.x, p.y, { count: 2, color: '#f472b6', speed: 60, life: 0.3, size: 2 }); }
				for (const m of this.magnets) if (Math.hypot(m.x - p.x, m.y - p.y) < 12) p.alive = false;
				if (Math.hypot(p.x - L.target.x, p.y - L.target.y) < L.target.r) {
					p.alive = false;
					this.caught++;
					if (this.caught % 8 === 0) this.ctx.audio.play('blip');
					this.fx.particles.burst(p.x, p.y, { count: 2, color: '#a7f3d0', speed: 80, life: 0.4, size: 2, glow: true });
				}
			}
			if (p.alive) {
				alive++;
				p.trail.push(p.x, p.y);
				if (p.trail.length > 16) p.trail.splice(0, 2);
			}
		}
		if (this.state === 'firing' && this.emitted >= this.max && alive === 0) this.judge();
	}

	judge() {
		const L = this.L;
		const pct = this.caught / this.max;
		if (pct >= L.need) {
			this.state = 'won';
			const gain = Math.round(pct * 300) + (L.magnets - this.magnets.length) * 100;
			this.score += gain;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.popup(`${Math.round(pct * 100)}% caught · +${gain}`, W / 2, H / 2, { color: '#a7f3d0', size: 26 });
			setTimeout(() => {
				if (!this.running) return;
				if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Field master!', message: 'Every stream collected.', score: this.score });
				this.load(this.level + 1);
				this.ctx.fx.banner(`Level ${this.level + 1}`);
			}, 1400);
		} else {
			this.state = 'missed';
			this.ctx.audio.play('lifelost');
			this.popup(`Only ${Math.round(pct * 100)}% caught`, W / 2, H / 2, { color: '#fb7185', size: 26 });
			setTimeout(() => {
				if (!this.running) return;
				// keep the magnets for another try
				this.state = 'arrange';
				this.emitted = 0;
				this.caught = 0;
				this.runBtn.disabled = false;
			}, 1400);
		}
	}

	draw(g) {
		const L = this.L;
		g.fillStyle = '#070b1a';
		g.fillRect(0, 0, W, H);
		// field map: short arrows on a grid, brighter where the force is strong
		if (this.magnets.length) {
			g.lineWidth = 1.5;
			for (let y = 20; y < H; y += 32) for (let x = 20; x < W; x += 32) {
				const [fx, fy] = this.force(x, y);
				const f = Math.hypot(fx, fy);
				if (f < 5) continue;
				const k = Math.min(1, f / 600);
				g.strokeStyle = `rgba(125,211,252,${0.08 + k * 0.35})`;
				g.beginPath();
				g.moveTo(x, y);
				g.lineTo(x + (fx / f) * 10, y + (fy / f) * 10);
				g.stroke();
			}
		}
		g.strokeStyle = '#475569';
		g.lineWidth = 8;
		g.lineCap = 'round';
		for (const [ax, ay, bx, by] of L.walls) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
		// collector
		const t = performance.now() / 1000;
		glow(g, L.target.x, L.target.y, L.target.r * 2, 'rgba(52,211,153,0.35)');
		g.strokeStyle = '#34d399';
		g.lineWidth = 3;
		g.setLineDash([6, 5]);
		g.lineDashOffset = -t * 20;
		g.beginPath(); g.arc(L.target.x, L.target.y, L.target.r, 0, Math.PI * 2); g.stroke();
		g.setLineDash([]);
		// emitter
		const e = L.emitter, a = Math.atan2(e.dy, e.dx);
		g.save();
		g.translate(e.x, e.y);
		g.rotate(a);
		fillRound(g, -18, -12, 30, 24, 6, '#94a3b8');
		fillRound(g, 8, -6, 14, 12, 3, '#fde047');
		g.restore();
		// particles with short glowing trails
		g.save();
		g.globalCompositeOperation = 'lighter';
		g.strokeStyle = 'rgba(250,204,21,0.35)';
		g.lineWidth = 2;
		for (const p of this.ps) {
			if (!p.alive || p.trail.length < 4) continue;
			g.beginPath();
			g.moveTo(p.trail[0], p.trail[1]);
			for (let i = 2; i < p.trail.length; i += 2) g.lineTo(p.trail[i], p.trail[i + 1]);
			g.stroke();
		}
		g.fillStyle = '#fef08a';
		g.beginPath();
		for (const p of this.ps) if (p.alive) { g.moveTo(p.x + 2.5, p.y); g.arc(p.x, p.y, 2.5, 0, Math.PI * 2); }
		g.fill();
		g.restore();
		if (performance.now() < this.hintUntil) {
			g.setLineDash([5, 5]);
			g.lineWidth = 2;
			for (const m of L.hint) {
				g.strokeStyle = m.sign > 0 ? '#93c5fd' : '#fda4af';
				g.beginPath(); g.arc(m.x, m.y, 18, 0, Math.PI * 2); g.stroke();
				text(g, m.sign > 0 ? '+' : '−', m.x, m.y + 1, { size: 18, weight: 900, color: g.strokeStyle });
			}
			g.setLineDash([]);
		}
		// magnets
		for (const m of this.magnets) {
			glow(g, m.x, m.y, 46, m.sign > 0 ? 'rgba(96,165,250,0.35)' : 'rgba(251,113,133,0.35)');
			circle(g, m.x, m.y, 16, m.sign > 0 ? '#3b82f6' : '#e11d48');
			text(g, m.sign > 0 ? '+' : '−', m.x, m.y + 1, { size: 20, weight: 900 });
		}
		fillRound(g, 12, H - 30, 180, 16, 8, 'rgba(255,255,255,0.08)');
		fillRound(g, 12, H - 30, Math.max(16, 180 * Math.min(1, this.caught / this.max / L.need)), 16, 8, this.caught / this.max >= L.need ? '#34d399' : '#60a5fa');
		text(g, `${Math.round((this.caught / this.max) * 100)}% / ${Math.round(L.need * 100)}%`, 200, H - 22, { size: 12, align: 'left' });
		text(g, `Magnets ${this.magnets.length}/${L.magnets}`, W - 16, H - 22, { size: 13, align: 'right', color: '#cbd5e1' });
		if (this.state === 'arrange' && this.running) text(g, 'Click to place a magnet · tap it to flip + / − · drag to move · right-click removes', W / 2, 18, { size: 12, color: 'rgba(226,232,240,0.7)' });
	}
}
