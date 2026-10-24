// Paddle Duel: table-tennis against a computer paddle that reacts with a delay.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, glow, text, colors } from '../core/canvas.js';
import { clamp } from '../core/physics.js';
import { CanvasFx, Trail } from '../core/fx.js';

const W = 800, H = 500, PW = 14, PH = 90, R = 9;
const AI = { easy: { speed: 300, error: 60, react: 0.22 }, normal: { speed: 430, error: 30, react: 0.12 }, hard: { speed: 600, error: 12, react: 0.05 } };

export default class PaddleDuel extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(300);
		this.trail = new Trail(16);
		const canvas = this.surface.canvas;
		const follow = (e) => { this.pointerY = this.surface.local(e).y; };
		this.ctx.input.on(canvas, 'pointermove', follow);
		this.ctx.input.on(canvas, 'pointerdown', follow);
		this.reset();
	}

	reset() {
		this.running = false;
		this.player = { y: H / 2, score: 0 };
		this.cpu = { y: H / 2, score: 0, target: H / 2, think: 0 };
		this.pointerY = null;
		this.target = +this.ctx.settings.target || 7;
		this.ai = AI[this.ctx.settings.difficulty] ?? AI.normal;
		this.trail.reset();
		this.fx.clear();
		this.squash = { player: 0, cpu: 0 };
		this.time = 0;
		this.serve(Math.random() < 0.5 ? 1 : -1);
		this.ctx.score('0 – 0');
	}

	serve(direction) {
		const angle = (Math.random() - 0.5) * 0.8;
		this.ball = { x: W / 2, y: H / 2, vx: Math.cos(angle) * 380 * direction, vy: Math.sin(angle) * 380, wait: 0.8 };
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		this.squash.player = Math.max(0, this.squash.player - dt * 5);
		this.squash.cpu = Math.max(0, this.squash.cpu - dt * 5);
		if (!this.running) return;
		const input = this.ctx.input;
		const p = this.player;
		if (input.isDown('up')) { p.y -= 520 * dt; this.pointerY = null; }
		if (input.isDown('down')) { p.y += 520 * dt; this.pointerY = null; }
		if (this.pointerY !== null) p.y += clamp(this.pointerY - p.y, -900 * dt, 900 * dt);
		p.y = clamp(p.y, PH / 2, H - PH / 2);

		// the cpu re-aims every `react` seconds at where the ball will be, with some error
		const c = this.cpu, b = this.ball;
		c.think -= dt;
		if (c.think <= 0) {
			c.think = this.ai.react;
			c.target = b.vx > 0 ? this.predict() + (Math.random() - 0.5) * this.ai.error * 2 : H / 2;
		}
		c.y += clamp(c.target - c.y, -this.ai.speed * dt, this.ai.speed * dt);
		c.y = clamp(c.y, PH / 2, H - PH / 2);

		if (b.wait > 0) { b.wait -= dt; return; }
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); this.wallHit(); }
		if (b.y > H - R) { b.y = H - R; b.vy = -Math.abs(b.vy); this.wallHit(); }
		this.paddleHit(30, p.y, 1);
		this.paddleHit(W - 30 - PW, c.y, -1);
		this.trail.push(b.x, b.y);

		if (b.x < -20) this.point(c, -1);
		else if (b.x > W + 20) this.point(p, 1);
	}

	paddleHit(px, py, side) {
		const b = this.ball;
		const moving = side > 0 ? b.vx < 0 : b.vx > 0;
		if (!moving) return;
		if (b.x + R < px || b.x - R > px + PW || b.y + R < py - PH / 2 || b.y - R > py + PH / 2) return;
		const offset = clamp((b.y - py) / (PH / 2), -1, 1);
		const speed = Math.min(Math.hypot(b.vx, b.vy) * 1.06, 900);
		const angle = offset * 1.05;
		b.vx = Math.cos(angle) * speed * side;
		b.vy = Math.sin(angle) * speed;
		b.x = side > 0 ? px + PW + R : px - R;
		this.ctx.audio.play('bounce');
		// sparks fly off the paddle face; faster returns throw more
		const hot = speed > 650;
		this.fx.particles.burst(b.x, b.y, { count: hot ? 22 : 12, colors: [side > 0 ? colors.blue : colors.pink, '#ffffff', colors.amber], speed: 220, angle: side > 0 ? 0 : Math.PI, spread: 1.6, life: 0.4, shape: 'spark', size: 3, glow: true });
		this.squash[side > 0 ? 'player' : 'cpu'] = 1;
		if (hot) this.fx.shake.kick(3);
	}

	wallHit() {
		this.ctx.audio.play('blip');
		const b = this.ball;
		this.fx.particles.burst(b.x, b.y, { count: 6, color: colors.amber, speed: 90, angle: b.y < H / 2 ? Math.PI / 2 : -Math.PI / 2, spread: 2, life: 0.3, shape: 'dust', size: 3 });
	}

	predict() {
		const b = this.ball;
		let x = b.x, y = b.y, vy = b.vy;
		const t = (W - 30 - PW - x) / b.vx;
		y += vy * t;
		// fold the bounces off top and bottom
		const span = H - 2 * R;
		y = ((y - R) % (2 * span) + 2 * span) % (2 * span);
		return y > span ? 2 * span - y + R : y + R;
	}

	point(winner, direction) {
		winner.score++;
		this.ctx.score(`${this.player.score} – ${this.cpu.score}`);
		const mine = winner === this.player;
		this.ctx.audio.play(mine ? 'score' : 'lifelost');
		// the ball bursts against the far wall
		const b = this.ball;
		const x = b.x < 0 ? 4 : W - 4;
		this.fx.particles.burst(x, clamp(b.y, 10, H - 10), { count: 40, colors: [mine ? colors.blue : colors.pink, colors.amber, '#ffffff'], speed: 320, angle: b.x < 0 ? 0 : Math.PI, spread: 2.4, life: 0.8, shape: 'spark', size: 3.5, glow: true });
		this.fx.particles.ring(x, clamp(b.y, 10, H - 10), { color: mine ? colors.blue : colors.pink, radius: 70 });
		this.fx.flash.trigger(mine ? colors.blue : colors.pink, 0.18);
		this.fx.shake.kick(6);
		this.fx.popups.add(mine ? 'POINT!' : 'Rival scores', W / 2, H / 2 - 20, { color: mine ? colors.blue : colors.pink, size: 26 });
		this.trail.reset();
		if (winner.score >= this.target) {
			const won = winner === this.player;
			this.finish({ win: won, title: won ? 'You win the duel!' : 'The rival wins', message: `Final score ${this.player.score} – ${this.cpu.score}.`, score: this.player.score, record: won });
			return;
		}
		this.serve(-direction);
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear(colors.bg);
		this.fx.shake.apply(g);
		g.fillStyle = '#101a38';
		g.fillRect(-10, -10, W + 20, H + 20);
		// a slowly breathing centre circle and court lines
		const breathe = 60 + Math.sin(this.time * 1.2) * 4;
		g.strokeStyle = 'rgba(255,255,255,0.08)';
		g.lineWidth = 3;
		g.beginPath(); g.arc(W / 2, H / 2, breathe, 0, Math.PI * 2); g.stroke();
		g.strokeRect(6, 6, W - 12, H - 12);
		g.setLineDash([10, 12]);
		g.strokeStyle = 'rgba(255,255,255,0.15)';
		g.lineWidth = 3;
		g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
		g.setLineDash([]);
		text(g, String(this.player.score), W / 2 - 60, 50, { size: 44, color: 'rgba(255,255,255,0.25)' });
		text(g, String(this.cpu.score), W / 2 + 60, 50, { size: 44, color: 'rgba(255,255,255,0.25)' });
		const paddle = (x, y, color, squash) => {
			const w = PW * (1 + squash * 0.5), hgt = PH * (1 - squash * 0.12);
			glow(g, x + PW / 2, y, PH * 0.9, `${color}33`);
			fillRound(g, x + PW / 2 - w / 2, y - hgt / 2, w, hgt, 7, color);
		};
		paddle(30, this.player.y, colors.blue, this.squash.player);
		paddle(W - 30 - PW, this.cpu.y, colors.pink, this.squash.cpu);
		this.trail.draw(g, colors.amber, R * 1.6);
		const b = this.ball;
		glow(g, b.x, b.y, 30, 'rgba(251,191,36,0.35)');
		circle(g, b.x, b.y, R, colors.amber);
		if (b.wait > 0 && this.running) text(g, 'Get ready', W / 2, H / 2 + 50, { size: 20, color: colors.muted });
		this.fx.draw(g);
		g.restore();
		this.fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
