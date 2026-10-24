// Echo Pads: watch the pads light up, then repeat the sequence. Each round adds one more
// step and plays a little faster. One wrong pad ends the run (Easy gives you a retry).

import { CanvasGame } from '../kit/canvasGame.js';
import { glow, text } from '../core/canvas.js';

const W = 520, H = 560, CX = W / 2, CY = 270, R = 210, HOLE = 70;
const PADS = [
	{ color: '#22c55e', dim: '#14532d', freq: 392 },
	{ color: '#ef4444', dim: '#7f1d1d', freq: 330 },
	{ color: '#eab308', dim: '#713f12', freq: 262 },
	{ color: '#3b82f6', dim: '#1e3a8a', freq: 196 },
];

export default class EchoPads extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		clearTimeout(this.timer);
		this.sequence = [];
		this.input = 0;
		this.lit = -1;
		this.litT = 0;
		this.phase = 'idle';
		this.retries = (this.ctx.settings.difficulty ?? 'normal') === 'easy' ? 1 : 0;
		this.ctx.score(0);
		this.ctx.info('Watch, then repeat');
	}

	start() {
		super.start();
		this.extend();
	}

	extend() {
		this.sequence.push(Math.floor(Math.random() * 4));
		this.playback();
	}

	playback() {
		this.phase = 'show';
		this.input = 0;
		this.ctx.info(`Round ${this.sequence.length}: watch`);
		const hard = (this.ctx.settings.difficulty ?? 'normal') === 'hard';
		const gap = Math.max(hard ? 0.22 : 0.3, (hard ? 0.5 : 0.62) - this.sequence.length * 0.02);
		let i = 0;
		const stepFn = () => {
			if (!this.running) return;
			if (i >= this.sequence.length) { this.phase = 'input'; this.ctx.info(`Round ${this.sequence.length}: your turn`); this.wake(); return; }
			this.flash(this.sequence[i++], gap * 0.8);
			this.timer = setTimeout(stepFn, gap * 1000);
		};
		this.timer = setTimeout(stepFn, 650);
	}

	flash(pad, duration = 0.3) {
		this.lit = pad;
		this.litT = duration;
		this.ctx.audio.play('note', PADS[pad].freq);
		this.wake();
	}

	padAt(p) {
		const dx = p.x - CX, dy = p.y - CY, d = Math.hypot(dx, dy);
		if (d < HOLE || d > R) return -1;
		return (dx >= 0 ? (dy < 0 ? 1 : 2) : dy < 0 ? 0 : 3);
	}

	pointerDown(p) { this.press(this.padAt(p)); }

	key(action, event) {
		const map = { up: 0, right: 1, down: 2, left: 3 };
		const k = event?.key;
		if (map[action] !== undefined) this.press(map[action]);
		else if (k >= '1' && k <= '4') this.press(Number(k) - 1);
	}

	press(pad) {
		if (!this.running || this.phase !== 'input' || pad < 0) return;
		this.flash(pad, 0.22);
		if (pad !== this.sequence[this.input]) {
			this.ctx.audio.play('buzzer');
			this.fx.shake.kick(8);
			if (this.retries > 0) {
				this.retries--;
				this.ctx.fx.banner('One more try');
				this.phase = 'show';
				this.timer = setTimeout(() => this.playback(), 900);
				return;
			}
			this.phase = 'over';
			const score = this.sequence.length - 1;
			this.timer = setTimeout(() => this.finish({ win: score >= 8, title: 'Wrong pad!', message: `You repeated ${score} ${score === 1 ? 'step' : 'steps'}.`, score }), 800);
			return;
		}
		this.input++;
		if (this.input >= this.sequence.length) {
			this.phase = 'show';
			this.ctx.score(this.sequence.length);
			if (this.sequence.length % 5 === 0) { this.ctx.audio.play('levelup'); this.ctx.fx.banner(`${this.sequence.length} in a row!`); }
			this.burst(CX, CY, { count: 20, colors: PADS.map((q) => q.color), speed: 160, life: 0.6, shape: 'star', size: 4 });
			this.timer = setTimeout(() => { if (this.running) this.extend(); }, 700);
		}
	}

	busy() { return this.litT > 0; }
	tick(dt) { if (this.litT > 0 && (this.litT -= dt) <= 0) this.lit = -1; }

	draw(g) {
		g.fillStyle = '#0b0f19';
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#1f2937';
		g.beginPath(); g.arc(CX, CY, R + 14, 0, Math.PI * 2); g.fill();
		const starts = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
		PADS.forEach((pad, i) => {
			const a0 = starts[i] + 0.04, a1 = starts[i] + Math.PI / 2 - 0.04;
			const on = this.lit === i;
			g.fillStyle = on ? pad.color : pad.dim;
			g.beginPath(); g.arc(CX, CY, R, a0, a1); g.arc(CX, CY, HOLE + 8, a1, a0, true); g.closePath(); g.fill();
			if (on) { const mid = (a0 + a1) / 2; glow(g, CX + Math.cos(mid) * 140, CY + Math.sin(mid) * 140, 120, pad.color + '88'); }
		});
		g.fillStyle = '#111827';
		g.beginPath(); g.arc(CX, CY, HOLE, 0, Math.PI * 2); g.fill();
		text(g, String(Math.max(0, this.phase === 'input' ? this.sequence.length - this.input : this.sequence.length)), CX, CY - 4, { size: 40, color: '#f9fafb' });
		text(g, this.phase === 'input' ? 'left' : 'steps', CX, CY + 28, { size: 12, color: '#9ca3af' });
		text(g, this.phase === 'input' ? 'Your turn' : this.phase === 'show' ? 'Watch…' : '', CX, H - 40, { size: 18, color: '#e5e7eb' });
	}

	teardown() { clearTimeout(this.timer); }
}
