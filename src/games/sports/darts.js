// Darts 301: count down from 301 to exactly zero in as few darts as possible. Your aim
// drifts in a slow figure-eight while you hold; release to throw. Going below zero (or to
// 1 with double-out on) is a bust and the turn's darts don't count.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text } from '../core/canvas.js';

const W = 640, H = 640, CX = 320, CY = 300, R = 230;
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// ring radii as fractions of the scoring radius (standard board proportions)
const BULL = 0.037, OUTER_BULL = 0.094, TRIPLE_IN = 0.582, TRIPLE_OUT = 0.629, DOUBLE_IN = 0.953;

export function scoreAt(dx, dy) {
	const d = Math.hypot(dx, dy) / R;
	if (d > 1) return { points: 0, label: 'Miss', mult: 0 };
	if (d < BULL) return { points: 50, label: 'Bull!', mult: 2 };
	if (d < OUTER_BULL) return { points: 25, label: '25', mult: 1 };
	const angle = (Math.atan2(dx, -dy) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
	const n = ORDER[Math.floor(angle / (Math.PI / 10))];
	if (d >= DOUBLE_IN) return { points: n * 2, label: `D${n}`, mult: 2 };
	if (d >= TRIPLE_IN && d < TRIPLE_OUT) return { points: n * 3, label: `T${n}`, mult: 3 };
	return { points: n, label: String(n), mult: 1 };
}

export default class Darts extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.left = 301;
		this.turnStart = 301;
		this.darts = [];
		this.thrown = 0;
		this.turnDarts = 0;
		this.holding = false;
		this.t = 0;
		this.flying = null;
		this.aim = { x: CX, y: CY };
		this.log = [];
		this.ctx.score(0);
		this.ctx.info('Hold to aim, release to throw');
	}

	doubleOut() { return this.ctx.settings.finish === 'double'; }

	pointerDown(p) {
		if (!this.running || this.flying) return;
		this.holding = true;
		this.t = 0;
		this.base = { x: p.x, y: p.y };
	}

	pointerMove(p) { if (this.holding) this.base = { x: p.x, y: p.y }; }

	pointerUp() {
		if (!this.holding) return;
		this.holding = false;
		this.flying = { x: this.aim.x, y: this.aim.y, t: 0 };
		this.ctx.audio.play('whip');
	}

	key(action) {
		if (action === 'action' && !this.holding && !this.flying) this.pointerDown({ x: CX, y: CY });
	}
	keyUp(action) { if (action === 'action') this.pointerUp(); }

	step(dt) {
		const input = this.ctx.input;
		if (this.holding) {
			this.t += dt;
			// keyboard nudges the base point
			const ax = input.axis();
			if (ax.x || ax.y) this.base = { x: this.base.x + ax.x * 160 * dt, y: this.base.y + ax.y * 160 * dt };
			// the wobble grows the longer you hold
			const wobble = ({ easy: 10, normal: 18, hard: 28 }[this.ctx.settings.difficulty ?? 'normal'] ?? 18) * (1 + Math.min(2, this.t * 0.6));
			this.aim = { x: this.base.x + Math.sin(this.t * 2.3) * wobble, y: this.base.y + Math.sin(this.t * 4.6) * wobble * 0.6 };
		}
		if (this.flying && (this.flying.t += dt / 0.22) >= 1) this.land();
	}

	land() {
		const { x, y } = this.flying;
		this.flying = null;
		const s = scoreAt(x - CX, y - CY);
		this.darts.push({ x, y });
		this.thrown++;
		this.turnDarts++;
		this.ctx.audio.play(s.points ? 'thud' : 'error');
		const after = this.left - s.points;
		const bust = after < 0 || (this.doubleOut() && (after === 1 || (after === 0 && s.mult !== 2)));
		if (bust) {
			this.popup('Bust!', x, y - 20, { color: '#f87171', size: 26 });
			this.ctx.audio.play('buzzer');
			this.left = this.turnStart;
			this.log.unshift('Bust');
			return this.endTurn();
		}
		this.left = after;
		this.popup(s.label, x, y - 20, { color: s.mult === 3 ? '#4ade80' : s.mult === 2 ? '#f87171' : '#fde047', size: 22 });
		this.log.unshift(s.label);
		if (this.log.length > 9) this.log.pop();
		this.ctx.score(this.thrown);
		if (this.left === 0) {
			this.ctx.audio.play('cheer');
			this.ctx.fx.confetti({ count: 80 });
			return setTimeout(() => this.finish({ win: true, title: 'Checkout!', message: `301 finished in ${this.thrown} darts.`, score: this.thrown, lowerIsBetter: true }), 900);
		}
		if (this.turnDarts >= 3) this.endTurn();
		this.status();
	}

	endTurn() {
		this.turnDarts = 0;
		this.turnStart = this.left;
		setTimeout(() => { this.darts = []; }, 700);
		this.status();
		if (this.thrown >= 60) this.finish({ win: false, title: 'Out of darts', message: `${this.left} left after 60 darts.`, score: 999, lowerIsBetter: true });
	}

	status() { this.ctx.info(`${this.left} left · dart ${this.turnDarts + 1} of 3`); }

	draw(g) {
		g.fillStyle = '#1c1917';
		g.fillRect(0, 0, W, H);
		circle(g, CX, CY, R + 46, '#0a0a0a');
		const seg = Math.PI / 10;
		for (let i = 0; i < 20; i++) {
			const a0 = -Math.PI / 2 - seg / 2 + i * seg, a1 = a0 + seg;
			const dark = i % 2 === 0;
			for (const [r0, r1, color] of [[OUTER_BULL, TRIPLE_IN, dark ? '#111' : '#f5f0dc'], [TRIPLE_IN, TRIPLE_OUT, dark ? '#dc2626' : '#16a34a'], [TRIPLE_OUT, DOUBLE_IN, dark ? '#111' : '#f5f0dc'], [DOUBLE_IN, 1, dark ? '#dc2626' : '#16a34a']]) {
				g.fillStyle = color;
				g.beginPath(); g.arc(CX, CY, R * r1, a0, a1); g.arc(CX, CY, R * r0, a1, a0, true); g.closePath(); g.fill();
			}
			const mid = a0 + seg / 2;
			text(g, String(ORDER[i]), CX + Math.cos(mid) * (R + 24), CY + Math.sin(mid) * (R + 24), { size: 18, color: '#f5f5f4' });
		}
		circle(g, CX, CY, R * OUTER_BULL, '#16a34a');
		circle(g, CX, CY, R * BULL, '#dc2626');
		for (const d of this.darts) {
			circle(g, d.x, d.y, 4, '#fde047');
			g.strokeStyle = '#a3a3a3'; g.lineWidth = 2;
			g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + 10, d.y + 18); g.stroke();
			g.fillStyle = '#3b82f6'; g.fillRect(d.x + 8, d.y + 16, 6, 8);
		}
		if (this.flying) {
			const k = 1 - this.flying.t;
			circle(g, this.flying.x + k * 40, this.flying.y + k * 220, 5 + k * 6, '#fde047');
		}
		if (this.holding) {
			g.strokeStyle = 'rgba(255,255,255,0.85)';
			g.lineWidth = 2;
			g.beginPath(); g.arc(this.aim.x, this.aim.y, 10, 0, Math.PI * 2); g.moveTo(this.aim.x - 16, this.aim.y); g.lineTo(this.aim.x + 16, this.aim.y); g.moveTo(this.aim.x, this.aim.y - 16); g.lineTo(this.aim.x, this.aim.y + 16); g.stroke();
		}
		fillRound(g, 16, H - 70, 200, 56, 14, '#292524');
		text(g, String(this.left), 116, H - 42, { size: 34, color: '#fde047' });
		text(g, `Darts ${this.thrown}`, W - 20, H - 50, { size: 15, align: 'right', color: '#e7e5e4' });
		text(g, this.log.slice(0, 6).join('  ·  '), W - 20, H - 26, { size: 13, align: 'right', color: '#a8a29e' });
	}
}
