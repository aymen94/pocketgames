// Reflex: how fast are you? Wait for the panel to turn green, then tap (or press Space)
// as fast as you can. Five rounds; tapping early costs you a 500 ms penalty. Your score
// is the average reaction time, lower is better. Target mode makes you also aim.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 640, H = 480, ROUNDS = 5;

export default class Reflex extends CanvasGame {
	static W = W;
	static H = H;
	static realtime = true;

	reset() {
		super.reset();
		this.round = 0;
		this.times = [];
		this.state = 'ready';
		this.wait = 0;
		this.shownAt = 0;
		this.target = null;
		this.message = 'Tap to start';
		this.ctx.score(0);
		this.ctx.info(`Round 1/${ROUNDS}`);
	}

	aim() { return this.ctx.settings.mode === 'target'; }

	arm() {
		this.state = 'wait';
		this.wait = 1.2 + Math.random() * 2.8;
		this.message = 'Wait for green…';
	}

	step(dt) {
		if (this.state === 'wait') {
			this.wait -= dt;
			if (this.wait <= 0) {
				this.state = 'go';
				this.shownAt = performance.now();
				this.target = this.aim() ? { x: 80 + Math.random() * (W - 160), y: 90 + Math.random() * (H - 180), r: 36 } : null;
				this.message = this.aim() ? 'HIT IT!' : 'TAP!';
				this.ctx.audio.play('blip');
			}
		}
	}

	pointerDown(p) { this.hit(p); }
	key(action) { if (action === 'action' && !this.aim()) this.hit(null); }

	hit(p) {
		if (!this.running) return;
		if (this.state === 'ready' || this.state === 'result') return this.arm();
		if (this.state === 'wait') {
			this.times.push(500);
			this.ctx.audio.play('buzzer');
			this.fx.shake.kick(6);
			this.state = 'result';
			this.message = 'Too soon! +500 ms';
			return this.next();
		}
		if (this.state === 'go') {
			if (this.target && p && Math.hypot(p.x - this.target.x, p.y - this.target.y) > this.target.r) return this.ctx.audio.play('error');
			const ms = Math.round(performance.now() - this.shownAt);
			this.times.push(ms);
			this.ctx.audio.play(ms < 250 ? 'coin' : 'click');
			this.burst(p?.x ?? W / 2, p?.y ?? H / 2, { count: 18, color: '#4ade80', speed: 160, life: 0.5, shape: 'star', size: 4 });
			this.state = 'result';
			this.message = `${ms} ms${ms < 200 ? ' · lightning!' : ms < 280 ? ' · sharp' : ''}`;
			this.next();
		}
	}

	next() {
		this.round++;
		const avg = Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length);
		this.ctx.score(avg);
		this.ctx.info(this.round < ROUNDS ? `Round ${this.round + 1}/${ROUNDS} · tap to continue` : 'Done');
		if (this.round >= ROUNDS) {
			this.state = 'done';
			this.ctx.audio.play('win');
			const best = Math.min(...this.times);
			setTimeout(() => this.finish({ win: avg < 400, title: `${avg} ms average`, message: `Best ${best} ms. ${avg < 220 ? 'Elite reflexes!' : avg < 300 ? 'Quick hands.' : 'Keep practising.'}`, score: avg, lowerIsBetter: true }), 900);
		}
	}

	draw(g) {
		const bg = this.state === 'go' ? '#16a34a' : this.state === 'wait' ? '#b91c1c' : '#1e293b';
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		if (this.target && this.state === 'go') {
			circle(g, this.target.x, this.target.y, this.target.r, '#f8fafc');
			circle(g, this.target.x, this.target.y, this.target.r * 0.62, '#ef4444');
			circle(g, this.target.x, this.target.y, this.target.r * 0.28, '#f8fafc');
		}
		text(g, this.message, W / 2, this.target && this.state === 'go' ? 40 : H / 2 - 10, { size: this.state === 'go' && !this.target ? 64 : 36 });
		if (this.state === 'ready' || this.state === 'result') text(g, this.state === 'ready' ? 'Wait for green, then tap as fast as you can' : 'Tap for the next round', W / 2, H / 2 + 44, { size: 16, color: '#cbd5e1' });
		// the round history
		for (let i = 0; i < ROUNDS; i++) {
			const x = W / 2 - 2 * 92 + i * 92 - 40, y = H - 64;
			fillRound(g, x, y, 80, 44, 10, i < this.times.length ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.2)');
			text(g, i < this.times.length ? `${this.times[i]}` : '–', x + 40, y + 22, { size: 18, color: i === this.times.length - 1 ? colors.highlight : '#f1f5f9' });
		}
	}
}
