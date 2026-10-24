// Bubble Burst: aim and fire coloured bubbles into the hexagonal cluster above. Three or
// more of a colour pop, and anything left hanging falls for bonus points. Bank shots off
// the walls; every few misses the ceiling drops a row.

import { CanvasGame } from '../kit/canvasGame.js';
import { text } from '../core/canvas.js';

const COLS = 11, R = 20, DX = R * 2, DY = R * Math.sqrt(3);
const W = COLS * DX + R, H = 640, SHOOTER = { x: W / 2, y: H - 40 }, LOSE_ROW = 13;
const PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#06b6d4'];

export default class BubbleBurst extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.score = 0;
		this.level = 0;
		this.ctx.score(0);
		this.load(0);
	}

	load(level) {
		this.level = level;
		this.colors = Math.min(PALETTE.length, 4 + Math.floor(level / 2));
		this.grid = new Map(); // "r,c" → color index
		this.offset = 0; // rows the ceiling has dropped (also flips the hex parity)
		const rows = 5 + Math.min(4, level);
		for (let r = 0; r < rows; r++) for (let c = 0; c < this.cols(r); c++) this.grid.set(`${r},${c}`, this.randomColor());
		this.misses = 0;
		this.flying = null;
		this.falling = [];
		this.aim = -Math.PI / 2;
		this.current = this.pickColor();
		this.next = this.pickColor();
		this.ctx.info(`Level ${level + 1}`);
	}

	randomColor() { return (Math.random() * this.colors) | 0; }
	/** The next bubble only uses colours still on the board. */
	pickColor() {
		const present = [...new Set(this.grid.values())];
		return present.length ? present[(Math.random() * present.length) | 0] : this.randomColor();
	}

	shifted(r) { return (r + this.offset) % 2 === 1; }
	cols(r) { return this.shifted(r) ? COLS - 1 : COLS; }
	pos(r, c) { return { x: R + c * DX + (this.shifted(r) ? R : 0), y: R + r * DY }; }

	neighbours(r, c) {
		const odd = this.shifted(r);
		const d = odd ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
		return d.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < this.cols(rr));
	}

	pointerMove(p) { this.aimAt(p); }
	pointerDown(p) { this.aimAt(p); }
	pointerUp() { this.shoot(); }
	aimAt(p) { this.aim = Math.max(-Math.PI + 0.12, Math.min(-0.12, Math.atan2(p.y - SHOOTER.y, p.x - SHOOTER.x))); }

	key(action) {
		if (action === 'action' || action === 'up') this.shoot();
		if (action === 'down') { [this.current, this.next] = [this.next, this.current]; this.ctx.audio.play('click'); }
	}

	shoot() {
		if (!this.running || this.flying) return;
		this.flying = { x: SHOOTER.x, y: SHOOTER.y, vx: Math.cos(this.aim) * 900, vy: Math.sin(this.aim) * 900, color: this.current };
		this.current = this.next;
		this.next = this.pickColor();
		this.ctx.audio.play('whip');
	}

	step(dt) {
		const input = this.ctx.input;
		if (input.isDown('left')) this.aim = Math.max(-Math.PI + 0.12, this.aim - 1.8 * dt);
		if (input.isDown('right')) this.aim = Math.min(-0.12, this.aim + 1.8 * dt);
		for (const f of this.falling) { f.vy += 1400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; }
		this.falling = this.falling.filter((f) => f.y < H + 40);
		const b = this.flying;
		if (!b) return;
		const sub = 6;
		for (let s = 0; s < sub; s++) {
			b.x += (b.vx * dt) / sub;
			b.y += (b.vy * dt) / sub;
			if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); this.ctx.audio.play('tick'); }
			if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); this.ctx.audio.play('tick'); }
			let hit = b.y <= R;
			if (!hit) for (const key of this.grid.keys()) {
				const [r, c] = key.split(',').map(Number);
				const q = this.pos(r, c);
				if (Math.hypot(q.x - b.x, q.y - b.y) < R * 1.8) { hit = true; break; }
			}
			if (hit) return this.land(b);
		}
	}

	land(b) {
		this.flying = null;
		// snap to the nearest free cell
		let best = null, bestD = Infinity;
		const rMax = Math.ceil(b.y / DY) + 1;
		for (let r = 0; r <= rMax; r++) for (let c = 0; c < this.cols(r); c++) {
			if (this.grid.has(`${r},${c}`)) continue;
			const q = this.pos(r, c);
			const d = Math.hypot(q.x - b.x, q.y - b.y);
			if (d < bestD) { bestD = d; best = [r, c]; }
		}
		if (!best) return;
		const [r, c] = best;
		this.grid.set(`${r},${c}`, b.color);
		this.ctx.audio.play('place');
		// flood fill the matching colour
		const group = [[r, c]], seen = new Set([`${r},${c}`]);
		for (let i = 0; i < group.length; i++) for (const [nr, nc] of this.neighbours(...group[i])) {
			const k = `${nr},${nc}`;
			if (!seen.has(k) && this.grid.get(k) === b.color) { seen.add(k); group.push([nr, nc]); }
		}
		if (group.length >= 3) {
			for (const [gr, gc] of group) {
				const q = this.pos(gr, gc);
				this.grid.delete(`${gr},${gc}`);
				this.fx.particles.burst(q.x, q.y, { count: 6, color: PALETTE[b.color], speed: 140, life: 0.4, size: 3 });
			}
			const dropped = this.dropFloating();
			const gain = group.length * 10 + dropped * 20 * Math.max(1, dropped);
			this.score += gain;
			this.ctx.score(this.score);
			this.ctx.audio.play(dropped ? 'coin' : 'pop');
			const q = this.pos(r, c);
			this.popup(`+${gain}`, q.x, q.y, { color: '#fde047', size: 18 + Math.min(12, dropped) });
		} else if (++this.misses >= 5) {
			this.misses = 0;
			this.dropCeiling();
		}
		if (!this.grid.size) {
			this.score += 500;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.ctx.fx.confetti({ count: 60 });
			setTimeout(() => { if (this.running) { this.load(this.level + 1); this.ctx.fx.banner(`Level ${this.level + 1}`); } }, 900);
			return;
		}
		if (this.current !== undefined && ![...this.grid.values()].includes(this.current)) this.current = this.pickColor();
		for (const k of this.grid.keys()) if (+k.split(',')[0] >= LOSE_ROW) return this.finish({ win: false, title: 'The bubbles reached you', message: `You cleared ${this.level} levels.`, score: this.score });
	}

	/** Removes every bubble no longer connected to the ceiling; returns how many fell. */
	dropFloating() {
		const attached = new Set();
		const stack = [];
		for (const k of this.grid.keys()) if (k.startsWith('0,')) { attached.add(k); stack.push(k.split(',').map(Number)); }
		while (stack.length) {
			const [r, c] = stack.pop();
			for (const [nr, nc] of this.neighbours(r, c)) {
				const k = `${nr},${nc}`;
				if (this.grid.has(k) && !attached.has(k)) { attached.add(k); stack.push([nr, nc]); }
			}
		}
		let n = 0;
		for (const [k, color] of [...this.grid]) {
			if (attached.has(k)) continue;
			const [r, c] = k.split(',').map(Number);
			const q = this.pos(r, c);
			this.falling.push({ x: q.x, y: q.y, vx: (Math.random() - 0.5) * 120, vy: -100, color });
			this.grid.delete(k);
			n++;
		}
		return n;
	}

	dropCeiling() {
		const next = new Map();
		this.offset = (this.offset + 1) % 2;
		for (const [k, v] of this.grid) { const [r, c] = k.split(',').map(Number); next.set(`${r + 1},${c}`, v); }
		this.grid = next;
		for (let c = 0; c < this.cols(0); c++) this.grid.set(`0,${c}`, this.randomColor());
		// cells past a shorter row's end can't exist: shift them back in
		for (const [k, v] of [...this.grid]) {
			const [r, c] = k.split(',').map(Number);
			if (c >= this.cols(r)) { this.grid.delete(k); if (!this.grid.has(`${r},${c - 1}`)) this.grid.set(`${r},${c - 1}`, v); }
		}
		this.ctx.audio.play('thud');
		this.fx.shake.kick(4);
	}

	bubble(g, x, y, color) {
		const grad = g.createRadialGradient(x - R * 0.35, y - R * 0.35, 2, x, y, R);
		grad.addColorStop(0, '#ffffff');
		grad.addColorStop(0.25, PALETTE[color]);
		grad.addColorStop(1, shade(PALETTE[color]));
		g.fillStyle = grad;
		g.beginPath(); g.arc(x, y, R - 1, 0, Math.PI * 2); g.fill();
	}

	draw(g) {
		g.fillStyle = '#0f172a';
		g.fillRect(0, 0, W, H);
		g.strokeStyle = 'rgba(248,113,113,0.35)';
		g.setLineDash([6, 6]);
		const ly = R + LOSE_ROW * DY - R;
		g.beginPath(); g.moveTo(0, ly); g.lineTo(W, ly); g.stroke();
		g.setLineDash([]);
		for (const [k, color] of this.grid) { const [r, c] = k.split(',').map(Number); const q = this.pos(r, c); this.bubble(g, q.x, q.y, color); }
		for (const f of this.falling) this.bubble(g, f.x, f.y, f.color);
		// aim guide with one wall bounce
		g.strokeStyle = 'rgba(255,255,255,0.35)';
		g.setLineDash([4, 8]);
		g.beginPath();
		let x = SHOOTER.x, y = SHOOTER.y, vx = Math.cos(this.aim), vy = Math.sin(this.aim);
		g.moveTo(x, y);
		for (let i = 0; i < 2; i++) {
			const t = vx < 0 ? (R - x) / vx : vx > 0 ? (W - R - x) / vx : Infinity;
			const len = Math.min(t, 260 - i * 120);
			x += vx * len; y += vy * len;
			g.lineTo(x, y);
			vx = -vx;
		}
		g.stroke();
		g.setLineDash([]);
		if (this.flying) this.bubble(g, this.flying.x, this.flying.y, this.flying.color);
		else this.bubble(g, SHOOTER.x, SHOOTER.y, this.current);
		this.bubble(g, SHOOTER.x + 60, SHOOTER.y + 8, this.next);
		text(g, 'next', SHOOTER.x + 60, SHOOTER.y + 36, { size: 10, color: 'rgba(255,255,255,0.5)' });
		text(g, `${5 - this.misses} shots before the ceiling drops`, 12, H - 14, { size: 11, align: 'left', color: 'rgba(255,255,255,0.5)' });
	}
}

function shade(hex) {
	const n = parseInt(hex.slice(1), 16);
	return `rgb(${((n >> 16) * 0.55) | 0},${(((n >> 8) & 255) * 0.55) | 0},${((n & 255) * 0.55) | 0})`;
}
