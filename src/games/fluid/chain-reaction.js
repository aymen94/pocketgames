// Chain Reaction: one click sets off a blast. Every drifting orb it touches bursts into a
// blast of its own, and so on down the chain. Catch enough orbs to clear the level.

import { CanvasGame } from '../kit/canvasGame.js';
import { text, glow } from '../core/canvas.js';

const W = 720, H = 480;
const HUES = [200, 280, 330, 40, 150, 10];
// orbs and the quota for each level
const LEVELS = [[10, 2], [15, 4], [20, 7], [25, 11], [30, 15], [35, 20], [40, 26], [45, 32], [50, 38], [55, 44], [60, 52], [65, 60]];

export default class ChainReaction extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	load(i) {
		this.level = i;
		const [n, need] = LEVELS[i];
		this.need = need;
		this.used = false;
		this.caught = 0;
		this.combo = 0;
		this.blasts = [];
		this.orbs = Array.from({ length: n }, () => {
			const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 50;
			return { x: 30 + Math.random() * (W - 60), y: 30 + Math.random() * (H - 60), vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: 8, hue: HUES[(Math.random() * HUES.length) | 0], alive: true };
		});
		this.ctx.info(`Level ${i + 1}: catch ${need} of ${n}`);
		this.result = null;
	}

	pointerDown(p) { this.trigger(p.x, p.y); }
	key(action) { if (action === 'action') this.trigger(this.pointer.x, this.pointer.y); }

	trigger(x, y) {
		if (!this.running || this.used || this.result) return;
		this.used = true;
		this.blasts.push({ x, y, r: 0, t: 0, hue: 0, player: true });
		this.ctx.audio.play('pop');
	}

	step(dt) {
		for (const o of this.orbs) {
			if (!o.alive) continue;
			o.x += o.vx * dt; o.y += o.vy * dt;
			if (o.x < o.r || o.x > W - o.r) { o.vx *= -1; o.x = Math.max(o.r, Math.min(W - o.r, o.x)); }
			if (o.y < o.r || o.y > H - o.r) { o.vy *= -1; o.y = Math.max(o.r, Math.min(H - o.r, o.y)); }
		}
		// a blast grows, holds, then shrinks away
		const MAX = 46, GROW = 0.35, HOLD = 1.2, SHRINK = 0.35;
		for (const b of this.blasts) {
			b.t += dt;
			b.r = b.t < GROW ? (b.t / GROW) * MAX : b.t < GROW + HOLD ? MAX : Math.max(0, MAX * (1 - (b.t - GROW - HOLD) / SHRINK));
		}
		for (const b of this.blasts) {
			if (b.r <= 0) continue;
			for (const o of this.orbs) {
				if (!o.alive || Math.hypot(o.x - b.x, o.y - b.y) > b.r + o.r) continue;
				o.alive = false;
				this.caught++;
				this.combo++;
				this.blasts.push({ x: o.x, y: o.y, r: 0, t: 0, hue: o.hue });
				const points = 10 * this.combo;
				this.score += points;
				this.ctx.score(this.score);
				this.ctx.audio.play('stack', this.combo);
				this.popup(`+${points}`, o.x, o.y - 10, { color: `hsl(${o.hue} 90% 75%)`, size: 14 + Math.min(14, this.combo) });
				this.fx.particles.burst(o.x, o.y, { count: 8, color: `hsl(${o.hue} 90% 65%)`, speed: 120, life: 0.5, size: 3, glow: true });
			}
		}
		this.blasts = this.blasts.filter((b) => b.t < GROW + HOLD + SHRINK);
		if (this.used && !this.blasts.length && !this.result) this.judge();
	}

	judge() {
		if (this.caught >= this.need) {
			this.result = 'win';
			this.ctx.audio.play('levelup');
			if (this.caught === this.orbs.length) { this.score += 500; this.ctx.score(this.score); this.popup('PERFECT +500', W / 2, H / 2 - 40, { color: '#fde047', size: 30 }); }
			setTimeout(() => {
				if (!this.running) return;
				if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Chain master!', message: 'All 12 levels cleared.', score: this.score });
				this.load(this.level + 1);
				this.ctx.fx.banner(`Level ${this.level + 1}`);
			}, 1200);
		} else {
			this.result = 'lose';
			this.finish({ win: false, title: 'Chain broken', message: `Caught ${this.caught} of ${this.need} needed on level ${this.level + 1}.`, score: this.score });
		}
	}

	draw(g) {
		g.fillStyle = '#060918';
		g.fillRect(0, 0, W, H);
		g.save();
		g.globalCompositeOperation = 'lighter';
		for (const b of this.blasts) {
			if (b.r <= 0) continue;
			const c = b.player ? '255,255,255' : null;
			g.fillStyle = c ? `rgba(${c},0.18)` : `hsla(${b.hue} 90% 60% / 0.22)`;
			g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
			g.strokeStyle = c ? `rgba(${c},0.6)` : `hsla(${b.hue} 90% 70% / 0.7)`;
			g.lineWidth = 2;
			g.stroke();
		}
		for (const o of this.orbs) {
			if (!o.alive) continue;
			glow(g, o.x, o.y, o.r * 3, `hsla(${o.hue} 90% 60% / 0.35)`);
			g.fillStyle = `hsl(${o.hue} 90% 65%)`;
			g.beginPath(); g.arc(o.x, o.y, o.r, 0, Math.PI * 2); g.fill();
		}
		g.restore();
		if (!this.used && this.running) {
			const p = this.pointer;
			g.strokeStyle = 'rgba(255,255,255,0.35)';
			g.setLineDash([4, 4]);
			g.beginPath(); g.arc(p.x, p.y, 46, 0, Math.PI * 2); g.stroke();
			g.setLineDash([]);
		}
		text(g, `${this.caught} / ${this.need}`, W / 2, 22, { size: 18, color: this.caught >= this.need ? '#34d399' : '#e2e8f0' });
	}
}
