// Pocket Pool: a solo nine-ball table. Pull back from the cue ball to aim and set power;
// clear every ball in as few shots as possible. Scratching costs two extra shots.

import { Game } from '../core/game.js';
import { Surface, circle, fillRound, text, colors } from '../core/canvas.js';
import { collideDiscs } from '../core/physics.js';
import { CanvasFx, Trail } from '../core/fx.js';

const W = 900, H = 500, RAIL = 34, R = 11, POCKET = 23;
const L = RAIL, T = RAIL, Rr = W - RAIL, B = H - RAIL;
const POCKETS = [[L, T], [W / 2, T - 4], [Rr, T], [L, B], [W / 2, B + 4], [Rr, B]];
const BALL_COLORS = ['#f8fafc', '#facc15', '#2563eb', '#dc2626', '#7c3aed', '#f97316', '#16a34a', '#7f1d1d', '#111827', '#facc15'];
const HEAD = [L + (Rr - L) * 0.25, H / 2], FOOT = [L + (Rr - L) * 0.72, H / 2];

export default class Pool extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(300);
		this.trail = new Trail(14);
		this.sinking = [];
		const canvas = this.surface.canvas;
		this.ctx.input.on(canvas, 'pointerdown', (e) => this.down(this.surface.local(e), e));
		this.ctx.input.on(canvas, 'pointermove', (e) => this.move(this.surface.local(e)));
		this.ctx.input.on(canvas, 'pointerup', () => this.up());
		this.reset();
	}

	reset() {
		this.running = false;
		this.shots = 0;
		this.balls = [{ n: 0, x: HEAD[0], y: HEAD[1], vx: 0, vy: 0, r: R, sunk: false }];
		// nine-ball diamond: 1 at the front, 9 in the middle
		const order = [1, 2, 3, 9, 4, 5, 6, 7, 8];
		const rows = [1, 2, 3, 2, 1];
		let k = 0;
		rows.forEach((count, row) => {
			for (let i = 0; i < count; i++) {
				const n = row === 2 && i === 1 ? 9 : order.filter((v) => v !== 9)[k++];
				this.balls.push({ n, x: FOOT[0] + row * R * 1.75, y: FOOT[1] + (i - (count - 1) / 2) * R * 2.02, vx: 0, vy: 0, r: R, sunk: false });
			}
		});
		this.cue = this.balls[0];
		this.aim = null;
		this.potted = [];
		this.fx?.clear();
		this.sinking = [];
		this.scratched = false;
		this.ctx.score(0);
		this.ctx.info('9 balls left');
	}

	get moving() {
		return this.balls.some((b) => !b.sunk && Math.hypot(b.vx, b.vy) > 2);
	}

	down(p, e) {
		if (!this.running || this.moving || this.cue.sunk) return;
		this.surface.canvas.setPointerCapture(e.pointerId);
		this.aim = { x: p.x, y: p.y };
	}

	move(p) {
		if (this.aim) { this.aim.x = p.x; this.aim.y = p.y; }
	}

	up() {
		const aim = this.aim;
		this.aim = null;
		if (!aim || !this.running) return;
		const dx = this.cue.x - aim.x, dy = this.cue.y - aim.y;
		const pull = Math.min(Math.hypot(dx, dy), 180);
		if (pull < 10) return;
		const power = (pull / 180) * 1300;
		this.cue.vx = (dx / Math.hypot(dx, dy)) * power;
		this.cue.vy = (dy / Math.hypot(dx, dy)) * power;
		this.shots++;
		this.ctx.score(this.shots);
		this.ctx.audio.play(pull > 140 ? 'punch' : 'hit');
		// the tip strikes: a flash of chalk and sparks off the ball
		const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
		this.fx.particles.burst(this.cue.x - ux * R, this.cue.y - uy * R, { count: 6 + Math.round(pull / 20), colors: ['#93c5fd', '#ffffff'], speed: 60 + pull, angle: Math.atan2(-uy, -ux), spread: 1.4, life: 0.3, shape: 'spark', size: 2.5, glow: true });
		if (pull > 150) this.fx.shake.kick(3);
	}

	update(dt) {
		this.fx.update(dt);
		for (const s of this.sinking) s.t += dt / 0.35;
		this.sinking = this.sinking.filter((s) => s.t < 1);
		if (!this.cue.sunk && Math.hypot(this.cue.vx, this.cue.vy) > 40) this.trail.push(this.cue.x, this.cue.y);
		else if (this.trail.size) this.trail.reset();
		if (!this.running) return;
		const steps = 8, h = dt / steps;
		for (let s = 0; s < steps; s++) {
			for (const b of this.balls) {
				if (b.sunk) continue;
				b.x += b.vx * h;
				b.y += b.vy * h;
				const speed = Math.hypot(b.vx, b.vy);
				if (speed > 0) {
					const slow = Math.max(0, speed - 260 * h) / speed;
					b.vx *= slow * (1 - 0.15 * h);
					b.vy *= slow * (1 - 0.15 * h);
				}
				for (const [px, py] of POCKETS) {
					if (Math.hypot(b.x - px, b.y - py) < POCKET) { this.sink(b, px, py); break; }
				}
				if (b.sunk) continue;
				// cushions, except in the pocket mouths
				const nearPocket = POCKETS.some(([px, py]) => Math.hypot(b.x - px, b.y - py) < POCKET + R * 1.2);
				if (!nearPocket) {
					if (b.x < L + R) { b.x = L + R; b.vx = Math.abs(b.vx) * 0.8; this.cushion(b); }
					if (b.x > Rr - R) { b.x = Rr - R; b.vx = -Math.abs(b.vx) * 0.8; this.cushion(b); }
					if (b.y < T + R) { b.y = T + R; b.vy = Math.abs(b.vy) * 0.8; this.cushion(b); }
					if (b.y > B - R) { b.y = B - R; b.vy = -Math.abs(b.vy) * 0.8; this.cushion(b); }
				} else {
					b.x = Math.max(L - 10, Math.min(Rr + 10, b.x));
					b.y = Math.max(T - 10, Math.min(B + 10, b.y));
				}
			}
			for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
				const a = this.balls[i], c = this.balls[j];
				if (a.sunk || c.sunk) continue;
				const impact = collideDiscs(a, c, 0.96);
				if (impact > 60) {
					this.ctx.audio.play('blip');
					// a clack of light where the balls meet
					this.fx.particles.burst((a.x + c.x) / 2, (a.y + c.y) / 2, { count: Math.min(10, Math.round(impact / 60)), color: '#ffffff', speed: 90, life: 0.2, shape: 'spark', size: 2, glow: true });
				}
			}
		}
		if (!this.moving) {
			for (const b of this.balls) { b.vx = 0; b.vy = 0; }
			if (this.cue.sunk) this.respot();
			const left = this.balls.filter((b) => b.n && !b.sunk).length;
			if (left === 0) this.finish({ win: true, title: 'Table cleared!', message: `All nine balls potted in ${this.shots} shots.`, score: this.shots });
		}
	}

	cushion(b) {
		if (Math.hypot(b.vx, b.vy) > 120) this.ctx.audio.play('bounce');
	}

	sink(b, px, py) {
		// the ball spirals down into the pocket
		this.sinking.push({ n: b.n, x: b.x, y: b.y, px, py, t: 0 });
		this.fx.particles.ring(px, py, { color: b.n === 0 ? '#fb7185' : BALL_COLORS[b.n], radius: POCKET * 1.6 });
		b.sunk = true;
		b.vx = b.vy = 0;
		if (b.n === 0) {
			this.shots += 2;
			this.ctx.score(this.shots);
			this.ctx.audio.play('error');
			this.fx.flash.trigger('#fb7185', 0.2);
			this.fx.shake.kick(4);
			this.fx.popups.add('SCRATCH +2', W / 2, H / 2, { color: '#fb7185', size: 26 });
			this.ctx.info('Scratch! +2 shots');
			return;
		}
		this.potted.push(b.n);
		this.ctx.audio.play(b.n === 9 ? 'treasure' : 'pop');
		this.fx.particles.burst(px, py, { count: 14, colors: [BALL_COLORS[b.n], '#ffffff'], speed: 120, life: 0.5, shape: 'star', size: 3.5 });
		this.fx.popups.add(b.n === 9 ? 'NINE!' : '+1', px, py + (py < H / 2 ? 30 : -30), { color: BALL_COLORS[b.n], size: 18 });
		const left = this.balls.filter((x) => x.n && !x.sunk).length;
		this.ctx.info(`${left} ${left === 1 ? 'ball' : 'balls'} left`);
	}

	respot() {
		const c = this.cue;
		let x = HEAD[0], y = HEAD[1];
		while (this.balls.some((b) => b !== c && !b.sunk && Math.hypot(b.x - x, b.y - y) < R * 2.2)) y += R * 2.2;
		Object.assign(c, { x, y, sunk: false, vx: 0, vy: 0 });
	}

	/** The first ball the aim line touches, for the ghost-ball guide. */
	predict(dx, dy) {
		const c = this.cue;
		let best = null;
		for (const b of this.balls) {
			if (b === c || b.sunk) continue;
			const ox = b.x - c.x, oy = b.y - c.y;
			const along = ox * dx + oy * dy;
			if (along <= 0) continue;
			const perp2 = ox * ox + oy * oy - along * along;
			const r2 = (2 * R) ** 2;
			if (perp2 > r2) continue;
			const t = along - Math.sqrt(r2 - perp2);
			if (!best || t < best.t) best = { t, b };
		}
		return best;
	}

	ball(g, b) {
		circle(g, b.x + 2, b.y + 3, b.r, 'rgba(0,0,0,0.35)');
		if (b.n === 9) {
			circle(g, b.x, b.y, b.r, '#f8fafc');
			g.save();
			g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.clip();
			g.fillStyle = BALL_COLORS[9];
			g.fillRect(b.x - b.r, b.y - b.r * 0.5, b.r * 2, b.r);
			g.restore();
		} else circle(g, b.x, b.y, b.r, BALL_COLORS[b.n]);
		if (b.n) {
			circle(g, b.x, b.y, b.r * 0.5, '#fff');
			text(g, String(b.n), b.x, b.y + 0.5, { size: 8, color: '#111' });
		}
		circle(g, b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.25, 'rgba(255,255,255,0.45)');
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear(colors.bg);
		this.fx.shake.apply(g);
		fillRound(g, 0, 0, W, H, 26, '#5b3418');
		fillRound(g, 8, 8, W - 16, H - 16, 20, '#7a4521');
		const felt = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.6);
		felt.addColorStop(0, '#0f8a5f');
		felt.addColorStop(1, '#065f46');
		fillRound(g, L - 6, T - 6, Rr - L + 12, B - T + 12, 8, '#064e3b');
		g.fillStyle = felt;
		g.fillRect(L, T, Rr - L, B - T);
		g.strokeStyle = 'rgba(255,255,255,0.12)';
		g.beginPath(); g.moveTo(HEAD[0], T); g.lineTo(HEAD[0], B); g.stroke();
		circle(g, FOOT[0], FOOT[1], 3, 'rgba(255,255,255,0.3)');
		for (const [px, py] of POCKETS) circle(g, px, py, POCKET, '#0b0b0b');
		for (let i = 1; i < 8; i++) {
			circle(g, L + ((Rr - L) / 8) * i, T / 2 + 2, 3, '#fde68a');
			circle(g, L + ((Rr - L) / 8) * i, B + RAIL / 2 - 2, 3, '#fde68a');
		}

		const c = this.cue;
		if (this.aim && !c.sunk) {
			const dx = c.x - this.aim.x, dy = c.y - this.aim.y;
			const len = Math.hypot(dx, dy) || 1;
			const ux = dx / len, uy = dy / len;
			const hit = this.predict(ux, uy);
			const reach = hit ? hit.t : 900;
			g.strokeStyle = 'rgba(255,255,255,0.55)';
			g.setLineDash([6, 6]);
			g.lineWidth = 2;
			g.beginPath(); g.moveTo(c.x, c.y); g.lineTo(c.x + ux * reach, c.y + uy * reach); g.stroke();
			g.setLineDash([]);
			if (hit) {
				const gx = c.x + ux * hit.t, gy = c.y + uy * hit.t;
				g.strokeStyle = 'rgba(255,255,255,0.7)';
				g.beginPath(); g.arc(gx, gy, R, 0, Math.PI * 2); g.stroke();
				const nx = hit.b.x - gx, ny = hit.b.y - gy, nl = Math.hypot(nx, ny) || 1;
				g.strokeStyle = 'rgba(253,224,71,0.7)';
				g.beginPath(); g.moveTo(hit.b.x, hit.b.y); g.lineTo(hit.b.x + (nx / nl) * 80, hit.b.y + (ny / nl) * 80); g.stroke();
			}
			// the cue stick, pulled back with the drag
			const pull = Math.min(len, 180);
			g.strokeStyle = '#e9c48a';
			g.lineWidth = 7;
			g.lineCap = 'round';
			g.beginPath(); g.moveTo(c.x - ux * (R + 6 + pull * 0.4), c.y - uy * (R + 6 + pull * 0.4)); g.lineTo(c.x - ux * (R + 300 + pull * 0.4), c.y - uy * (R + 300 + pull * 0.4)); g.stroke();
			fillRound(g, 20, H - 26, 160, 10, 5, 'rgba(0,0,0,0.4)');
			fillRound(g, 20, H - 26, 160 * (pull / 180), 10, 5, pull > 150 ? colors.coral : colors.amber);
		}
		for (const s of this.sinking) {
			const k = s.t * s.t;
			this.ball(g, { n: s.n, x: s.x + (s.px - s.x) * Math.min(1, s.t * 1.6), y: s.y + (s.py - s.y) * Math.min(1, s.t * 1.6), r: R * (1 - k * 0.8) });
		}
		this.trail.draw(g, '#e0f2fe', 9);
		for (const b of this.balls) if (!b.sunk) this.ball(g, b);
		this.potted.forEach((n, i) => this.ball(g, { n, x: W / 2 - 100 + i * 25, y: H - 9, r: 8 }));
		this.fx.draw(g);
		g.restore();
		this.fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
