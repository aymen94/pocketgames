// Neon Trails: light-cycle duels on a grid. Every rider leaves a solid wall of light;
// touch any wall and you are out. Outlast three computer riders, who steer toward open
// space, to win the round. First to three rounds takes the match.

import { CanvasGame } from '../kit/canvasGame.js';
import { text } from '../core/canvas.js';

const COLS = 80, ROWS = 52, CELL = 10;
const W = COLS * CELL, H = ROWS * CELL;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const RIDERS = [
	{ color: '#22d3ee', name: 'You' },
	{ color: '#f472b6', name: 'Pink' },
	{ color: '#fbbf24', name: 'Gold' },
	{ color: '#a3e635', name: 'Lime' },
];
const SPEEDS = { easy: 12, normal: 16, hard: 21 };

export default class NeonTrails extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.wins = [0, 0, 0, 0];
		this.score = 0;
		this.ctx.score(0);
		this.round();
	}

	round() {
		this.grid = new Uint8Array(COLS * ROWS); // 0 empty, 1+ rider index + 1
		const starts = [[10, ROWS / 2, 'right'], [COLS - 11, ROWS / 2, 'left'], [COLS / 2, 8, 'down'], [COLS / 2, ROWS - 9, 'up']];
		this.riders = RIDERS.map((r, i) => ({ ...r, i, x: starts[i][0], y: starts[i][1], dir: starts[i][2], next: starts[i][2], alive: true }));
		for (const r of this.riders) this.grid[r.x + r.y * COLS] = r.i + 1;
		this.acc = 0;
		this.countdown = 1.2;
		this.over = false;
		this.paint();
	}

	paint() { this.ctx.info(`Rounds ${this.wins.map((w, i) => `${RIDERS[i].name} ${w}`).join(' · ')}`); }

	key(action) {
		const me = this.riders[0];
		if (!DIRS[action] || !me.alive) return;
		const [dx, dy] = DIRS[action], [cx, cy] = DIRS[me.dir];
		if (dx === -cx && dy === -cy) return; // no reversing into your own trail
		me.next = action;
	}

	pointerDown(p) {
		// tap/click: turn toward the side of the screen relative to the rider
		const me = this.riders[0];
		const dx = p.x / CELL - me.x, dy = p.y / CELL - me.y;
		const horizontal = me.dir === 'left' || me.dir === 'right';
		this.key(horizontal ? (dy < 0 ? 'up' : 'down') : (dx < 0 ? 'left' : 'right'));
	}

	free(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && !this.grid[x + y * COLS]; }

	/** Open cells reachable from (x, y), counted up to a limit: how roomy a move is. */
	room(x, y, limit = 160) {
		if (!this.free(x, y)) return 0;
		const seen = new Set([x + y * COLS]);
		const stack = [[x, y]];
		while (stack.length && seen.size < limit) {
			const [cx, cy] = stack.pop();
			for (const [dx, dy] of Object.values(DIRS)) {
				const nx = cx + dx, ny = cy + dy, k = nx + ny * COLS;
				if (this.free(nx, ny) && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
			}
		}
		return seen.size;
	}

	think(r) {
		const [cx, cy] = DIRS[r.dir];
		let best = r.dir, score = -1;
		for (const [name, [dx, dy]] of Object.entries(DIRS)) {
			if (dx === -cx && dy === -cy) continue;
			let s = this.room(r.x + dx, r.y + dy);
			if (name === r.dir) s += 6; // prefer going straight
			s += Math.random() * 4;
			// a little aggression: drift toward the player's path
			const me = this.riders[0];
			if (me.alive) s -= Math.hypot(r.x + dx - me.x, r.y + dy - me.y) * 0.05;
			if (s > score) { score = s; best = name; }
		}
		r.next = best;
	}

	step(dt) {
		if (this.over) return;
		if (this.countdown > 0) { this.countdown -= dt; return; }
		this.acc += dt * (SPEEDS[this.ctx.settings.difficulty] ?? SPEEDS.normal);
		while (this.acc >= 1) {
			this.acc -= 1;
			this.tickRiders();
			if (this.over) return;
		}
	}

	tickRiders() {
		for (const r of this.riders) if (r.alive && r.i > 0) this.think(r);
		const moves = [];
		for (const r of this.riders) {
			if (!r.alive) continue;
			r.dir = r.next;
			const [dx, dy] = DIRS[r.dir];
			moves.push([r, r.x + dx, r.y + dy]);
		}
		for (const [r, nx, ny] of moves) {
			// head-on collisions take out both riders
			const clash = moves.some(([o, ox, oy]) => o !== r && ox === nx && oy === ny);
			if (!this.free(nx, ny) || clash) {
				r.alive = false;
				this.ctx.audio.play(r.i === 0 ? 'crash' : 'explode');
				this.fx.particles.burst((r.x + 0.5) * CELL, (r.y + 0.5) * CELL, { count: 30, color: r.color, speed: 200, life: 0.6, shape: 'spark', size: 3 });
				if (r.i === 0) this.fx.shake.kick(8);
				continue;
			}
			r.x = nx; r.y = ny;
			this.grid[nx + ny * COLS] = r.i + 1;
		}
		const alive = this.riders.filter((r) => r.alive);
		const meAlive = this.riders[0].alive;
		if (alive.length <= 1 || !meAlive) {
			this.over = true;
			const winner = meAlive ? 0 : alive.length === 1 ? alive[0].i : -1;
			if (!meAlive && alive.length > 1) {
				// the round goes on without you: decide it by who has the most room
				const best = alive.reduce((a, b) => (this.room(a.x, a.y, 400) >= this.room(b.x, b.y, 400) ? a : b));
				this.wins[best.i]++;
			} else if (winner >= 0) this.wins[winner]++;
			if (winner === 0) {
				this.score += 100 + this.riders.filter((r) => !r.alive).length * 25;
				this.ctx.score(this.score);
				this.ctx.audio.play('win');
			}
			this.paint();
			const champ = this.wins.findIndex((w) => w >= 3);
			if (champ >= 0) {
				return setTimeout(() => this.finish({ win: champ === 0, title: champ === 0 ? 'Grid champion!' : `${RIDERS[champ].name} wins the match`, message: `Rounds: ${this.wins.join(' – ')}`, score: this.score }), 900);
			}
			setTimeout(() => { if (this.running) this.round(); }, 1300);
		}
	}

	draw(g) {
		g.fillStyle = '#030712';
		g.fillRect(0, 0, W, H);
		g.strokeStyle = 'rgba(56,189,248,0.07)';
		g.lineWidth = 1;
		for (let x = 0; x <= COLS; x += 4) { g.beginPath(); g.moveTo(x * CELL, 0); g.lineTo(x * CELL, H); g.stroke(); }
		for (let y = 0; y <= ROWS; y += 4) { g.beginPath(); g.moveTo(0, y * CELL); g.lineTo(W, y * CELL); g.stroke(); }
		for (let k = 0; k < this.grid.length; k++) {
			const v = this.grid[k];
			if (!v) continue;
			g.fillStyle = RIDERS[v - 1].color;
			g.globalAlpha = this.riders[v - 1].alive ? 0.85 : 0.3;
			g.fillRect((k % COLS) * CELL + 1, Math.floor(k / COLS) * CELL + 1, CELL - 2, CELL - 2);
		}
		g.globalAlpha = 1;
		for (const r of this.riders) {
			if (!r.alive) continue;
			g.save();
			g.shadowColor = r.color;
			g.shadowBlur = 14;
			g.fillStyle = '#ffffff';
			g.fillRect(r.x * CELL - 1, r.y * CELL - 1, CELL + 2, CELL + 2);
			g.restore();
		}
		if (this.countdown > 0) text(g, 'READY', W / 2, H / 2, { size: 40, weight: 900, color: '#22d3ee' });
	}
}
