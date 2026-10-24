// Brick Breaker: paddle, balls, brick layouts that change every level, and power-ups.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, glow, text, colors } from '../core/canvas.js';
import { clamp, circleRect, reflect } from '../core/physics.js';
import { CanvasFx, Trail, ease } from '../core/fx.js';

const W = 480, H = 640, R = 7, BW = 52, BH = 20, COLS = 8, TOP = 70;
const ROW_COLORS = ['#f472b6', '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#34d399', '#22d3ee', '#818cf8'];
const POWERS = [
	{ kind: 'wide', color: colors.blue, label: 'W' },
	{ kind: 'multi', color: colors.pink, label: 'M' },
	{ kind: 'slow', color: colors.mint, label: 'S' },
];

// level layouts: functions of (row, col) returning brick strength (0 = empty)
const LAYOUTS = [
	(r) => (r < 5 ? 1 : 0),
	(r, c) => (r < 6 && (r + c) % 2 === 0 ? 1 + (r < 2 ? 1 : 0) : 0),
	(r, c) => (r < 7 && Math.abs(c - 3.5) <= r * 0.6 + 0.5 ? 1 + (r % 3 === 0 ? 1 : 0) : 0),
	(r, c) => (r < 7 && (c === 0 || c === 7 || r === 0 || r === 6 || (r === 3 && c > 1 && c < 6)) ? 2 : r < 7 ? 1 : 0),
	(r, c) => (r < 8 ? ((r + c) % 3 === 0 ? 3 : 1) : 0),
];

export default class BrickBreaker extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(500);
		this.time = 0;
		const canvas = this.surface.canvas;
		const follow = (e) => { this.pointerX = this.surface.local(e).x; };
		this.ctx.input.on(canvas, 'pointermove', follow);
		this.ctx.input.on(canvas, 'pointerdown', (e) => { follow(e); this.launch(); });
		this.reset();
	}

	reset() {
		this.running = false;
		this.level = 0;
		this.score = 0;
		this.lives = +this.ctx.settings.lives || 3;
		this.paddle = { x: W / 2, w: 84, wide: 0 };
		this.pointerX = null;
		this.slow = 0;
		this.fx.clear();
		this.buildLevel();
		this.ctx.score(0);
	}

	buildLevel() {
		const layout = LAYOUTS[this.level % LAYOUTS.length];
		const boost = Math.floor(this.level / LAYOUTS.length);
		this.bricks = [];
		for (let r = 0; r < 9; r++) for (let c = 0; c < COLS; c++) {
			const hp = layout(r, c);
			if (hp > 0) this.bricks.push({ x: 18 + c * (BW + 4), y: TOP + r * (BH + 5), w: BW, h: BH, hp: hp + boost, max: hp + boost, color: ROW_COLORS[r % ROW_COLORS.length] });
		}
		this.drops = [];
		this.levelStart = this.time;
		// bricks drop into place row by row
		for (const b of this.bricks) { b.flash = 0; b.delay = ((b.y - TOP) / (BH + 5)) * 0.06 + Math.random() * 0.05; }
		this.resetBalls();
		this.info();
	}

	resetBalls() {
		this.balls = [{ x: this.paddle.x, y: H - 60 - R, vx: 0, vy: 0, stuck: true, trail: new Trail(12) }];
	}

	info() {
		this.ctx.info(`Level ${this.level + 1} · ${'♥'.repeat(Math.max(0, this.lives))}`);
	}

	launch() {
		if (!this.running || this.paused) return;
		for (const b of this.balls) {
			if (!b.stuck) continue;
			b.stuck = false;
			const speed = 330 + this.level * 18;
			const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
			b.vx = Math.cos(angle) * speed;
			b.vy = Math.sin(angle) * speed;
		}
	}

	handleInput({ type, action }) {
		if (type === 'down' && (action === 'action' || action === 'up')) this.launch();
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		this.squash = Math.max(0, (this.squash ?? 0) - dt * 5);
		for (const b of this.bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 6);
		if (!this.running) return;
		const p = this.paddle;
		const { x } = this.ctx.input.axis();
		if (x !== 0) { p.x += x * 560 * dt; this.pointerX = null; }
		if (this.pointerX !== null) p.x += clamp(this.pointerX - p.x, -1200 * dt, 1200 * dt);
		if (p.wide > 0) p.wide -= dt;
		const width = p.wide > 0 ? 130 : 84;
		p.w += (width - p.w) * Math.min(1, dt * 10);
		p.x = clamp(p.x, p.w / 2, W - p.w / 2);
		if (this.slow > 0) this.slow -= dt;
		const speedScale = this.slow > 0 ? 0.6 : 1;

		const paddleRect = { x: p.x - p.w / 2, y: H - 60, w: p.w, h: 14 };
		// sub-steps keep fast balls from tunnelling through bricks
		const steps = 3;
		for (const b of this.balls) {
			if (b.stuck) { b.x = p.x; b.y = H - 60 - R; continue; }
			for (let i = 0; i < steps; i++) {
				b.x += (b.vx * speedScale * dt) / steps;
				b.y += (b.vy * speedScale * dt) / steps;
				if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); this.wallSpark(b, 0); }
				if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); this.wallSpark(b, Math.PI); }
				if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); this.wallSpark(b, Math.PI / 2); }
				if (b.vy > 0 && circleRect(b.x, b.y, R, paddleRect)) {
					const offset = clamp((b.x - p.x) / (p.w / 2), -1, 1);
					const speed = Math.min(Math.hypot(b.vx, b.vy) * 1.01, 640);
					const angle = -Math.PI / 2 + offset * 1.1;
					b.vx = Math.cos(angle) * speed;
					b.vy = Math.sin(angle) * speed;
					b.y = paddleRect.y - R;
					this.ctx.audio.play('bounce');
					this.squash = 1;
					this.fx.particles.burst(b.x, paddleRect.y, { count: 10, colors: [colors.accent, '#ffffff'], speed: 160, angle: -Math.PI / 2, spread: 1.8, life: 0.35, shape: 'spark', size: 2.5, glow: true });
				}
				for (const brick of this.bricks) {
					if (brick.hp <= 0) continue;
					const hit = circleRect(b.x, b.y, R, brick);
					if (!hit) continue;
					b.x += hit.nx * hit.depth;
					b.y += hit.ny * hit.depth;
					reflect(b, hit.nx, hit.ny);
					this.hitBrick(brick);
					break;
				}
			}
			b.trail.push(b.x, b.y);
		}
		this.bricks = this.bricks.filter((b) => b.hp > 0);
		this.balls = this.balls.filter((b) => b.y < H + 20);

		for (const d of this.drops) {
			d.y += 160 * dt;
			if (d.y > paddleRect.y - 8 && d.y < paddleRect.y + 20 && Math.abs(d.x - p.x) < p.w / 2 + 10) {
				d.taken = true;
				this.power(d.kind);
				this.fx.particles.ring(d.x, paddleRect.y, { color: d.color, radius: 60 });
				this.fx.popups.add({ wide: 'WIDE!', multi: 'MULTI-BALL!', slow: 'SLOW-MO' }[d.kind], d.x, paddleRect.y - 30, { color: d.color, size: 18 });
			}
		}
		this.drops = this.drops.filter((d) => !d.taken && d.y < H + 20);

		if (this.balls.length === 0) {
			this.lives--;
			this.ctx.audio.play('lifelost');
			this.fx.shake.kick(8);
			this.fx.flash.trigger('#fb7185', 0.25);
			if (this.lives <= 0) {
				this.info();
				return this.finish({ win: false, message: `You reached level ${this.level + 1}.`, score: this.score });
			}
			this.paddle.wide = 0;
			this.resetBalls();
			this.info();
		}
		if (this.bricks.length === 0) {
			this.level++;
			this.score += 100;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.fx.particles.confetti(W, { count: 70 });
			this.fx.popups.add(`LEVEL ${this.level + 1}`, W / 2, H / 2, { color: colors.amber, size: 34, life: 1.4, rise: 30 });
			this.buildLevel();
		}
	}

	hitBrick(brick) {
		brick.hp--;
		brick.flash = 1;
		const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2;
		this.ctx.audio.play(brick.hp > 0 ? 'blip' : 'blockhit');
		if (brick.hp > 0) {
			this.fx.particles.burst(cx, cy, { count: 5, color: '#ffffff', speed: 90, life: 0.25, shape: 'dust', size: 2.5 });
			return;
		}
		const points = 10 * brick.max;
		this.score += points;
		this.ctx.score(this.score);
		// the brick shatters into chunks of its own colour
		this.fx.particles.burst(cx, cy, { count: 14, colors: [brick.color, '#ffffff'], speed: 200, life: 0.8, shape: 'square', size: 5, gravity: 520, drag: 0.8 });
		this.fx.particles.burst(cx, cy, { count: 6, color: brick.color, speed: 120, life: 0.35, shape: 'spark', size: 2, glow: true });
		this.fx.popups.add(`+${points}`, cx, cy, { color: brick.color, size: 13, life: 0.6, rise: 24 });
		if (brick.max > 1) this.fx.shake.kick(2.5);
		if (Math.random() < 0.12) {
			const power = POWERS[Math.floor(Math.random() * POWERS.length)];
			this.drops.push({ ...power, x: brick.x + brick.w / 2, y: brick.y });
		}
	}

	power(kind) {
		this.ctx.audio.play('powerup');
		if (kind === 'wide') this.paddle.wide = 12;
		else if (kind === 'slow') this.slow = 8;
		else if (kind === 'multi') {
			const extra = [];
			for (const b of this.balls.slice(0, 3)) {
				if (b.stuck) continue;
				for (const turn of [-0.4, 0.4]) {
					const c = Math.cos(turn), s = Math.sin(turn);
					extra.push({ x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, stuck: false, trail: new Trail(12) });
				}
			}
			this.balls.push(...extra);
		}
	}

	wallSpark(b, angle) {
		this.fx.particles.burst(b.x, b.y, { count: 4, color: '#c7d2fe', speed: 80, angle, spread: 1.5, life: 0.25, shape: 'dust', size: 2 });
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#0d1430');
		const fx = this.fx;
		fx.shake.apply(g);
		// a faint moving grid behind the wall
		g.strokeStyle = 'rgba(99, 102, 241, 0.08)';
		g.lineWidth = 1;
		const off = (this.time * 12) % 32;
		for (let y = -32 + off; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
		const since = this.time - this.levelStart;
		for (const b of this.bricks) {
			const t = Math.max(0, Math.min(1, (since - b.delay) / 0.35));
			if (t <= 0) continue;
			const drop = (1 - ease.outBack(t)) * -40;
			g.globalAlpha = (0.45 + 0.55 * (b.hp / b.max)) * t;
			fillRound(g, b.x, b.y + drop, b.w, b.h, 5, b.color);
			g.globalAlpha = t;
			g.fillStyle = 'rgba(255,255,255,0.25)';
			g.fillRect(b.x + 4, b.y + 3 + drop, b.w - 8, 3);
			if (b.flash > 0) { g.globalAlpha = b.flash * 0.8; fillRound(g, b.x, b.y + drop, b.w, b.h, 5, '#ffffff'); }
			g.globalAlpha = 1;
			if (b.hp > 1) text(g, String(b.hp), b.x + b.w / 2, b.y + b.h / 2 + 1 + drop, { size: 11, color: 'rgba(0,0,0,0.6)' });
		}
		for (const d of this.drops) {
			const bob = Math.sin(this.time * 8 + d.x) * 2;
			glow(g, d.x, d.y, 26, `${d.color}55`);
			fillRound(g, d.x - 14, d.y - 9 + bob, 28, 18, 9, d.color);
			text(g, d.label, d.x, d.y + 1 + bob, { size: 12, color: '#0b1020' });
		}
		const p = this.paddle;
		const sq = this.squash ?? 0;
		const pw = p.w * (1 + sq * 0.08), ph = 14 * (1 - sq * 0.3);
		glow(g, p.x, H - 53, p.w * 0.7, p.wide > 0 ? 'rgba(79,140,255,0.25)' : 'rgba(255,255,255,0.12)');
		fillRound(g, p.x - pw / 2, H - 60 + (14 - ph), pw, ph, 7, p.wide > 0 ? colors.blue : '#e2e8ff');
		for (const b of this.balls) {
			b.trail.draw(g, this.slow > 0 ? colors.mint : colors.accent, R * 1.6);
			glow(g, b.x, b.y, 22, 'rgba(255,255,255,0.25)');
			circle(g, b.x, b.y, R, this.slow > 0 ? colors.mint : '#fff');
		}
		if (this.running && this.balls.some((b) => b.stuck)) text(g, 'Tap or press Space to launch', W / 2, H - 120, { size: 15, color: colors.muted });
		fx.draw(g);
		g.restore();
		fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
