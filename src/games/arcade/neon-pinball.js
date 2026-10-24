// Neon Pinball: a glowing table with two flippers, pop bumpers, kicker slingshots and a
// bank of drop targets. Hold Space (or the plunger) to charge the launch. Flippers are
// moving segments: the ball picks up their speed, so timing your flip aims the shot.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, glow } from '../core/canvas.js';

const W = 480, H = 720, R = 10, GRAVITY = 820;
const FLIP_LEN = 84, FLIP_REST = 0.52, FLIP_UP = -0.48, FLIP_SPEED = 22;

const WALLS = [
	[20, 720, 20, 120], [20, 120, 60, 50], [60, 50, 140, 22], [140, 22, 340, 22], [340, 22, 420, 50], [420, 50, 460, 120], [460, 120, 460, 720],
	[425, 170, 425, 720], // launch lane divider
	[20, 540, 148, 640], [425, 540, 332, 640], // inlane guides
];
const KICKERS = [[70, 450, 118, 560], [380, 450, 332, 560]];
const BUMPERS = [{ x: 170, y: 230, r: 26 }, { x: 290, y: 230, r: 26 }, { x: 230, y: 320, r: 26 }, { x: 110, y: 340, r: 18 }, { x: 360, y: 340, r: 18 }];

export default class NeonPinball extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.flippers = [
			{ x: 150, y: 640, side: 1, a: FLIP_REST, w: 0, up: false },
			{ x: 330, y: 640, side: -1, a: FLIP_REST, w: 0, up: false },
		];
	}

	reset() {
		super.reset();
		this.score = 0;
		this.balls = 3;
		this.mult = 1;
		this.targets = [0, 1, 2, 3].map((i) => ({ x: 170 + i * 46, y: 120, up: true }));
		this.lights = BUMPERS.map(() => 0);
		this.ctx.score(0);
		this.newBall();
	}

	newBall() {
		this.ball = { x: 442, y: 660, vx: 0, vy: 0, inLane: true };
		this.charge = 0;
		this.charging = false;
		this.ctx.info(`Ball ${4 - this.balls}/3 · ×${this.mult}`);
	}

	key(action, event) {
		const k = event?.key;
		if (action === 'left' || k === 'z' || k === 'Z') this.flippers[0].up = true;
		if (action === 'right' || k === '/' || k === 'm' || k === 'M') this.flippers[1].up = true;
		if (action === 'action' || action === 'down') if (this.ball.inLane) this.charging = true;
	}

	keyUp(action, event) {
		const k = event?.key;
		if (action === 'left' || k === 'z' || k === 'Z') this.flippers[0].up = false;
		if (action === 'right' || k === '/' || k === 'm' || k === 'M') this.flippers[1].up = false;
		if ((action === 'action' || action === 'down') && this.charging) this.launch();
	}

	pointerDown(p) {
		if (this.ball.inLane && p.x > 400 && p.y > 560) { this.charging = true; return; }
		this.flippers[p.x < W / 2 ? 0 : 1].up = true;
		this.touchSide = p.x < W / 2 ? 0 : 1;
	}

	pointerUp() {
		if (this.charging) return this.launch();
		for (const f of this.flippers) f.up = false;
	}

	launch() {
		if (!this.charging) return;
		this.charging = false;
		this.ball.vy = -(700 + this.charge * 600);
		this.charge = 0;
		this.ctx.audio.play('whip');
	}

	step(dt) {
		if (this.charging) this.charge = Math.min(1, this.charge + dt * 1.2);
		for (let i = 0; i < this.lights.length; i++) this.lights[i] = Math.max(0, this.lights[i] - dt * 3);
		const sub = 10, h = Math.min(dt, 1 / 30) / sub;
		for (let s = 0; s < sub; s++) {
			for (const f of this.flippers) {
				const target = f.up ? FLIP_UP : FLIP_REST;
				const prev = f.a;
				f.a += Math.max(-FLIP_SPEED * h, Math.min(FLIP_SPEED * h, target - f.a));
				f.w = (f.a - prev) / h;
				if (f.up && prev === FLIP_REST && s === 0) this.ctx.audio.play('flip');
			}
			this.physics(h);
		}
		const b = this.ball;
		if (b.y > H + 20) this.drain();
	}

	tip(f) {
		// the flipper tip: left flipper points right, right flipper points left; positive angle droops
		const dir = f.side > 0 ? f.a : Math.PI - f.a;
		return [f.x + Math.cos(dir) * FLIP_LEN, f.y + Math.sin(dir) * FLIP_LEN];
	}

	physics(h) {
		const b = this.ball;
		if (b.inLane && b.vy === 0) return;
		b.vy += GRAVITY * h;
		b.x += b.vx * h;
		b.y += b.vy * h;
		if (b.inLane && b.y < 160) b.inLane = false;
		// a weak launch falls back onto the plunger instead of draining
		if (b.x > 425 && b.y > 660) { b.x = 442; b.y = 660; b.vx = 0; b.vy = 0; b.inLane = true; return; }
		for (const [ax, ay, bx, by] of WALLS) this.segment(b, ax, ay, bx, by, 0.5);
		for (const [ax, ay, bx, by] of KICKERS) if (this.segment(b, ax, ay, bx, by, 0.5)) { this.kick(b, ax, ay, bx, by); }
		BUMPERS.forEach((bu, i) => {
			const dx = b.x - bu.x, dy = b.y - bu.y, d = Math.hypot(dx, dy);
			if (d < bu.r + R && d > 0) {
				const nx = dx / d, ny = dy / d;
				b.x = bu.x + nx * (bu.r + R);
				b.y = bu.y + ny * (bu.r + R);
				b.vx = nx * 560; b.vy = ny * 560;
				this.lights[i] = 1;
				this.add(100);
				this.ctx.audio.play('bounce');
				this.fx.particles.burst(b.x, b.y, { count: 8, color: '#f0abfc', speed: 160, life: 0.3, size: 2, glow: true });
			}
		});
		for (const t of this.targets) {
			if (!t.up) continue;
			if (Math.abs(b.x - t.x) < 18 + R && Math.abs(b.y - t.y) < 6 + R) {
				t.up = false;
				b.vy = Math.abs(b.vy) * 0.7 + 60;
				this.add(250);
				this.ctx.audio.play('hit');
				if (this.targets.every((q) => !q.up)) {
					this.mult = Math.min(5, this.mult + 1);
					this.add(1000);
					this.ctx.audio.play('powerup');
					this.popup(`TARGETS! ×${this.mult}`, W / 2, 180, { color: '#fde047', size: 26 });
					setTimeout(() => { for (const q of this.targets) q.up = true; }, 1200);
					this.ctx.info(`Ball ${4 - this.balls}/3 · ×${this.mult}`);
				}
			}
		}
		for (const f of this.flippers) this.flipper(b, f);
		const sp = Math.hypot(b.vx, b.vy);
		if (sp > 1600) { b.vx *= 1600 / sp; b.vy *= 1600 / sp; }
	}

	segment(b, ax, ay, bx, by, e) {
		const abx = bx - ax, aby = by - ay;
		const t = Math.max(0, Math.min(1, ((b.x - ax) * abx + (b.y - ay) * aby) / (abx * abx + aby * aby)));
		const cx = ax + abx * t, cy = ay + aby * t;
		const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
		if (d >= R + 3 || d === 0) return false;
		const nx = dx / d, ny = dy / d;
		b.x = cx + nx * (R + 3); b.y = cy + ny * (R + 3);
		const vn = b.vx * nx + b.vy * ny;
		if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
		return vn < -40;
	}

	kick(b, ax, ay, bx, by) {
		// slingshot: fire the ball away from the kicker face
		let nx = -(by - ay), ny = bx - ax;
		const len = Math.hypot(nx, ny);
		nx /= len; ny /= len;
		if (nx * (W / 2 - ax) + ny * (500 - ay) < 0) { nx = -nx; ny = -ny; }
		b.vx += nx * 380; b.vy += ny * 380;
		this.add(50);
		this.ctx.audio.play('zap');
	}

	flipper(b, f) {
		const [tx, ty] = this.tip(f);
		const abx = tx - f.x, aby = ty - f.y;
		const t = Math.max(0, Math.min(1, ((b.x - f.x) * abx + (b.y - f.y) * aby) / (abx * abx + aby * aby)));
		const cx = f.x + abx * t, cy = f.y + aby * t;
		const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
		const thick = 9 - t * 4;
		if (d >= R + thick || d === 0) return;
		const nx = dx / d, ny = dy / d;
		b.x = cx + nx * (R + thick); b.y = cy + ny * (R + thick);
		// velocity of the flipper surface at the contact point (ω × r)
		const w = f.w * f.side;
		const rx = cx - f.x, ry = cy - f.y;
		const px = -w * ry, py = w * rx;
		const rvx = b.vx - px, rvy = b.vy - py;
		const vn = rvx * nx + rvy * ny;
		if (vn < 0) {
			b.vx = px + rvx - 1.35 * vn * nx;
			b.vy = py + rvy - 1.35 * vn * ny;
		}
	}

	add(points) {
		this.score += points * this.mult;
		this.ctx.score(this.score);
	}

	drain() {
		this.balls--;
		this.ctx.audio.play('lifelost');
		if (this.balls <= 0) return this.finish({ win: null, title: 'Game over', message: `Final multiplier ×${this.mult}.`, score: this.score });
		this.mult = Math.max(1, this.mult - 1);
		this.newBall();
	}

	draw(g) {
		g.fillStyle = '#0a0620';
		g.fillRect(0, 0, W, H);
		g.save();
		g.lineCap = 'round';
		g.shadowColor = '#a855f7';
		g.shadowBlur = 12;
		g.strokeStyle = '#c084fc';
		g.lineWidth = 4;
		for (const [ax, ay, bx, by] of WALLS) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
		g.strokeStyle = '#22d3ee';
		g.shadowColor = '#22d3ee';
		g.lineWidth = 6;
		for (const [ax, ay, bx, by] of KICKERS) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
		g.restore();
		BUMPERS.forEach((bu, i) => {
			glow(g, bu.x, bu.y, bu.r * 2.4, `rgba(240,171,252,${0.15 + this.lights[i] * 0.5})`);
			g.fillStyle = this.lights[i] > 0.3 ? '#fdf4ff' : '#c026d3';
			g.beginPath(); g.arc(bu.x, bu.y, bu.r, 0, Math.PI * 2); g.fill();
			g.strokeStyle = '#f0abfc';
			g.lineWidth = 3;
			g.beginPath(); g.arc(bu.x, bu.y, bu.r - 6, 0, Math.PI * 2); g.stroke();
		});
		for (const t of this.targets) fillRound(g, t.x - 18, t.y - 6, 36, 12, 4, t.up ? '#fde047' : 'rgba(253,224,71,0.15)');
		for (const f of this.flippers) {
			const [tx, ty] = this.tip(f);
			g.strokeStyle = '#38bdf8';
			g.lineCap = 'round';
			g.lineWidth = 16;
			g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(tx, ty); g.stroke();
			g.strokeStyle = '#e0f2fe';
			g.lineWidth = 4;
			g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(tx, ty); g.stroke();
		}
		// plunger
		fillRound(g, 432, 672 + this.charge * 30, 20, 40, 4, this.charging ? '#f43f5e' : '#64748b');
		const b = this.ball;
		glow(g, b.x, b.y, 26, 'rgba(255,255,255,0.35)');
		const grad = g.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, R);
		grad.addColorStop(0, '#ffffff');
		grad.addColorStop(1, '#94a3b8');
		g.fillStyle = grad;
		g.beginPath(); g.arc(b.x, b.y, R, 0, Math.PI * 2); g.fill();
		text(g, `×${this.mult}`, W / 2, 70, { size: 22, color: '#fde047', weight: 900 });
		text(g, `Balls ${'●'.repeat(this.balls)}`, 40, 700, { size: 13, align: 'left', color: '#c084fc' });
		if (b.inLane && b.vy === 0) text(g, 'Hold Space to launch', W / 2, 470, { size: 15, color: 'rgba(226,232,240,0.6)' });
	}
}
