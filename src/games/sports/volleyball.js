// Beach Volley: one-on-one volleyball on the sand, side view. Move and jump to bump the
// ball over the net; it bounces off your head and body with real angles. Each side may
// touch the ball three times. Rally scoring to 11 (win by two).

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 800, H = 480;
const GROUND = 420, NET_X = W / 2, NET_TOP = 270, BALL_R = 16, PR = 34;
const GRAVITY = 900, BALL_G = 520;

export default class Volleyball extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.score = [0, 0];
		this.server = 0;
		this.me = { x: 200, y: GROUND, vx: 0, vy: 0, color: colors.accent };
		this.cpu = { x: 600, y: GROUND, vx: 0, vy: 0, color: '#f97316' };
		this.ctx.score(0);
		this.newRally();
	}

	newRally() {
		const s = this.server === 0 ? this.me : this.cpu;
		this.me.x = 200; this.cpu.x = 600;
		this.ball = { x: s.x, y: 150, vx: 0, vy: 0, touches: 0, side: this.server, lastHit: -1, frozen: 0.8 };
		this.ctx.info(`You ${this.score[0]} – ${this.score[1]} CPU · first to 11`);
	}

	key(action) { if (action === 'up' || action === 'action') this.jump(this.me); }
	pointerDown() { if (this.pointer.y < GROUND - 120 || this.pointer.y < this.me.y - 40) this.jump(this.me); }

	jump(p) { if (p.y >= GROUND - 0.5) { p.vy = -560; this.ctx.audio.play('jump'); } }

	movePlayer(p, dir, min, max, dt) {
		p.vx = dir * 330;
		p.x = Math.max(min + PR, Math.min(max - PR, p.x + p.vx * dt));
		p.vy += GRAVITY * dt;
		p.y = Math.min(GROUND, p.y + p.vy * dt);
		if (p.y >= GROUND) p.vy = 0;
	}

	step(dt) {
		const b = this.ball, input = this.ctx.input;
		let dir = input.axis().x;
		if (this.pointer.down && !dir) { const dx = this.pointer.x - this.me.x; dir = Math.abs(dx) > 8 ? Math.sign(dx) : 0; }
		this.movePlayer(this.me, dir, 0, NET_X - 6, dt);
		// computer: get under the ball's landing point on its side, slightly behind it to send it forward
		const skill = { easy: 0.65, normal: 0.85, hard: 1 }[this.ctx.settings.difficulty ?? 'normal'] ?? 0.85;
		let target = 620;
		if (b.x > NET_X - 60 || b.vx > 0) {
			// predict where the ball falls to head height
			let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
			for (let k = 0; k < 120 && y < GROUND - PR * 1.4; k++) { vy += BALL_G / 60; x += vx / 60; y += vy / 60; if (x > W - BALL_R || x < BALL_R) vx = -vx; }
			target = Math.max(NET_X + PR, x + 14);
		}
		const cdx = target - this.cpu.x;
		this.movePlayer(this.cpu, Math.abs(cdx) > 6 ? Math.sign(cdx) * skill : 0, NET_X + 6, W, dt);
		if (b.x > NET_X && Math.abs(b.x - this.cpu.x) < 50 && b.y > GROUND - 200 && b.y < GROUND - 90 && b.vy > 0 && Math.random() < skill * 0.2) this.jump(this.cpu);

		if (b.frozen > 0) { b.frozen -= dt; if (b.frozen <= 0) { b.vy = -80; b.vx = this.server === 0 ? 30 : -30; } return; }
		b.vy += BALL_G * dt;
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.9; }
		if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.9; }
		if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); }
		// the net: a thin post with a rounded top
		if (b.y > NET_TOP && Math.abs(b.x - NET_X) < BALL_R + 4) { b.x = NET_X + Math.sign(b.x - NET_X || 1) * (BALL_R + 4); b.vx = -b.vx * 0.6; this.ctx.audio.play('tick'); }
		else if (Math.hypot(b.x - NET_X, b.y - NET_TOP) < BALL_R + 4) {
			const nx = (b.x - NET_X) / (BALL_R + 4), ny = (b.y - NET_TOP) / (BALL_R + 4);
			const dot = b.vx * nx + b.vy * ny;
			if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
		}
		// side changes reset the touch count
		const side = b.x < NET_X ? 0 : 1;
		if (side !== b.side) { b.side = side; b.touches = 0; b.lastHit = -1; }
		for (const [who, p] of [[0, this.me], [1, this.cpu]]) {
			// players are half discs: collide with the circle at body height
			const dx = b.x - p.x, dy = b.y - (p.y - PR * 0.4), d = Math.hypot(dx, dy);
			if (d < BALL_R + PR && d > 0) {
				const nx = dx / d, ny = dy / d;
				b.x = p.x + nx * (BALL_R + PR);
				b.y = p.y - PR * 0.4 + ny * (BALL_R + PR);
				const rel = (b.vx - p.vx) * nx + (b.vy - p.vy) * ny;
				if (rel < 0) {
					b.vx -= 1.9 * rel * nx;
					b.vy -= 1.9 * rel * ny;
					b.vx += p.vx * 0.35;
					b.vy += Math.min(0, p.vy) * 0.3;
					// keep hits lively and pointed upward
					const speed = Math.hypot(b.vx, b.vy);
					if (speed < 420) { b.vx *= 420 / speed; b.vy *= 420 / speed; }
					if (b.vy > -200) b.vy = -Math.max(200, Math.abs(b.vy));
					if (b.lastHit !== who || performance.now() - (b.hitAt ?? 0) > 200) {
						b.touches++;
						b.lastHit = who;
						b.hitAt = performance.now();
						this.ctx.audio.play('bounce');
						if (b.touches > 3) return this.point(1 - who, 'Four touches!');
					}
				}
			}
		}
		if (b.y >= GROUND - BALL_R) {
			this.burst(b.x, GROUND, { count: 16, colors: ['#fde68a', '#fcd34d'], speed: 120, angle: -Math.PI / 2, spread: 2, life: 0.5, size: 3, gravity: 300 });
			this.point(b.x < NET_X ? 1 : 0, b.x < NET_X ? 'Point computer' : 'Point you');
		}
	}

	point(winner, why) {
		this.score[winner]++;
		this.server = winner;
		this.ctx.score(this.score[0]);
		this.ctx.audio.play(winner === 0 ? 'score' : 'hit');
		this.popup(why, W / 2, 120, { color: winner === 0 ? '#bef264' : '#fca5a5', size: 26 });
		const [a, b] = this.score;
		if ((a >= 11 || b >= 11) && Math.abs(a - b) >= 2) {
			const win = a > b;
			this.ctx.audio.play(win ? 'cheer' : 'lose');
			if (win) this.ctx.fx.confetti({ count: 70 });
			return this.finish({ win, title: win ? 'Match won!' : 'The computer wins', message: `Final score ${a}–${b}.`, score: a });
		}
		this.newRally();
	}

	draw(g) {
		const sky = g.createLinearGradient(0, 0, 0, GROUND);
		sky.addColorStop(0, '#38bdf8');
		sky.addColorStop(1, '#bae6fd');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		circle(g, 680, 80, 40, '#fef08a');
		g.fillStyle = '#0ea5e9';
		g.fillRect(0, GROUND - 60, W, 20);
		g.fillStyle = '#fcd34d';
		g.fillRect(0, GROUND, W, H - GROUND);
		g.fillStyle = '#fde68a';
		g.fillRect(0, GROUND, W, 6);
		// net
		g.fillStyle = '#e5e7eb';
		g.fillRect(NET_X - 4, NET_TOP, 8, GROUND - NET_TOP);
		circle(g, NET_X, NET_TOP, 6, '#f8fafc');
		const b = this.ball;
		// shadow of the ball on the sand
		const k = Math.max(0.2, 1 - (GROUND - b.y) / 400);
		g.fillStyle = `rgba(0,0,0,${0.25 * k})`;
		g.beginPath(); g.ellipse(b.x, GROUND + 4, BALL_R * k * 1.4, 5 * k, 0, 0, Math.PI * 2); g.fill();
		for (const p of [this.me, this.cpu]) {
			g.fillStyle = p.color;
			g.beginPath(); g.arc(p.x, p.y, PR, Math.PI, 0); g.closePath(); g.fill();
			circle(g, p.x + (p === this.me ? 12 : -12), p.y - PR * 0.55, 6, '#fff');
			circle(g, p.x + (p === this.me ? 14 : -14), p.y - PR * 0.55, 3, '#111');
		}
		circle(g, b.x, b.y, BALL_R, '#f8fafc');
		g.strokeStyle = '#f59e0b';
		g.lineWidth = 2.5;
		g.beginPath(); g.arc(b.x, b.y, BALL_R * 0.7, 0.3, 2.2); g.stroke();
		g.strokeStyle = '#3b82f6';
		g.beginPath(); g.arc(b.x, b.y, BALL_R * 0.7, 3.4, 5.3); g.stroke();
		if (b.frozen > 0) text(g, this.server === 0 ? 'Your serve' : 'Computer serves', W / 2, 60, { size: 20, color: '#0c4a6e' });
		fillRound(g, W / 2 - 80, 10, 160, 36, 12, 'rgba(15,23,42,0.6)');
		text(g, `${this.score[0]}  –  ${this.score[1]}`, W / 2, 28, { size: 22 });
		text(g, `touches ${b.touches}/3`, b.x < NET_X ? 90 : W - 90, 28, { size: 13, color: '#0c4a6e' });
	}
}
