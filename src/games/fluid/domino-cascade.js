// Domino Cascade: place a line of dominoes from the pusher to the bell, then push. A
// falling domino knocks the one in front of it, or, if that cell is empty, the ones half
// a turn to either side, so lines can curve 45° at a time. Rocks stop nothing; vases
// break. Every level's domino budget is computed by a search, so it is always enough.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, text } from '../core/canvas.js';

const COLS = 12, ROWS = 9, CELL = 52;
const W = COLS * CELL, H = ROWS * CELL;
const DIRS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]; // [dr, dc], clockwise from east
const PUSH = { R: 0, D: 2, L: 4, U: 6 };

// . empty  # rock  o vase  B bell  R/L/U/D pusher facing right/left/up/down
const LEVELS = [
	{ name: 'Straight Line', extra: 2, grid: ['............', '............', '............', '............', 'R.........B.', '............', '............', '............', '............'] },
	{ name: 'The Wall', extra: 2, grid: ['............', '............', '......#.....', '......#.....', 'R.....#....B', '......#.....', '............', '............', '............'] },
	{ name: 'Vase Alley', extra: 1, grid: ['............', '.....o......', '............', '..o.....o...', 'R.....o....B', '..o.....o...', '............', '......o.....', '............'] },
	{ name: 'Switchback', extra: 1, grid: ['R...........', '............', '####.######.', '............', '............', '.##########.', '............', '............', 'B...........'] },
	{ name: 'Guarded Bell', extra: 1, grid: ['............', '............', '....ooooo...', '....o...o...', 'R...o.B.o...', '....o...o...', '....oo.oo...', '............', '............'] },
	{ name: 'Crossfire', extra: 1, grid: ['...o....o...', '.D.o.##.o...', '...o.#..o...', '.....#......', '..o..#.o..o.', '.....#......', '..o.......o.', '.....oo..B..', '............'] },
];

const rot = (d, k) => (d + k + 8) % 8;

/** Fewest dominoes that reach the bell, by BFS over (cell, falling direction). */
function shortest(grid) {
	let start = null;
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (PUSH[grid[r][c]] !== undefined) start = { r, c, d: PUSH[grid[r][c]] };
	const at = (r, c) => (r < 0 || c < 0 || r >= ROWS || c >= COLS ? '#' : grid[r][c]);
	// the pusher only knocks straight ahead
	const fr = start.r + DIRS[start.d][0], fc = start.c + DIRS[start.d][1];
	if (at(fr, fc) === 'B') return 0;
	if (at(fr, fc) !== '.') return Infinity;
	const seen = new Map();
	let frontier = [{ r: fr, c: fc, d: start.d }];
	seen.set(`${fr},${fc},${start.d}`, 1);
	for (let n = 1; frontier.length; n++) {
		const next = [];
		for (const s of frontier) {
			const f = [s.r + DIRS[s.d][0], s.c + DIRS[s.d][1]];
			const fch = at(f[0], f[1]);
			if (fch === 'B') return n;
			if (fch === 'o') continue; // would knock the vase
			const moves = [];
			if (fch === '.') moves.push([f[0], f[1], s.d]);
			// with the front left empty (or a rock), the diagonals get knocked
			for (const k of [-1, 1]) {
				const d = rot(s.d, k), r = s.r + DIRS[d][0], c = s.c + DIRS[d][1];
				if (at(r, c) === 'B') return n;
				if (at(r, c) === '.') moves.push([r, c, d]);
			}
			for (const [r, c, d] of moves) {
				const key = `${r},${c},${d}`;
				if (seen.has(key)) continue;
				seen.set(key, 1);
				next.push({ r, c, d });
			}
		}
		frontier = next;
	}
	return Infinity;
}

export default class DominoCascade extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.pushBtn = tool.button('Push!', () => this.push(), { primary: true });
		this.levelLabel = tool.label('');
		this.countLabel = tool.label('');
		return tool.bar(this.levelLabel, this.countLabel, this.pushBtn, tool.button('Stand up', () => this.standUp()), tool.button('Clear', () => { if (this.state === 'build') { this.dominoes.clear(); this.paintCount(); } }));
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	restore(data) {
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.load(Math.min(LEVELS.length - 1, data.level ?? 0));
	}

	load(i) {
		this.level = i;
		const L = LEVELS[i];
		this.grid = L.grid;
		this.budget = shortest(L.grid) + L.extra;
		this.dominoes = new Map(); // "r,c" → { r, c, state, d, t }
		this.state = 'build';
		this.queue = [];
		this.bellRung = 0;
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (PUSH[L.grid[r][c]] !== undefined) this.pusher = { r, c, d: PUSH[L.grid[r][c]] };
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${L.name}`;
		this.pushBtn.disabled = false;
		this.paintCount();
		this.ctx.saveProgress({ level: i, score: this.score });
	}

	paintCount() { this.countLabel.textContent = `Dominoes ${this.budget - this.dominoes.size} left`; }
	cell(r, c) { return r < 0 || c < 0 || r >= ROWS || c >= COLS ? '#' : this.grid[r][c]; }

	pointerDown(p) {
		if (!this.running || this.state !== 'build') return;
		const r = Math.floor(p.y / CELL), c = Math.floor(p.x / CELL);
		if (this.cell(r, c) !== '.') return;
		const key = `${r},${c}`;
		if (this.dominoes.has(key)) { this.dominoes.delete(key); this.ctx.audio.play('flip'); }
		else if (this.dominoes.size < this.budget) { this.dominoes.set(key, { r, c, state: 'up', d: 0, t: 0 }); this.ctx.audio.play('place'); }
		else this.ctx.audio.play('error');
		this.paintCount();
	}

	key(action) { if (action === 'action') this.push(); }

	standUp() {
		if (this.state === 'running') return;
		for (const d of this.dominoes.values()) { d.state = 'up'; d.t = 0; }
		this.state = 'build';
		this.pushBtn.disabled = false;
	}

	push() {
		if (!this.running || this.state !== 'build') return;
		this.state = 'running';
		this.pushBtn.disabled = true;
		this.clock = 0;
		this.ctx.audio.play('swoosh');
		const p = this.pusher;
		this.queue.push({ at: 0.15, r: p.r + DIRS[p.d][0], c: p.c + DIRS[p.d][1], d: p.d });
	}

	/** Something is hit at (r, c) while falling in direction d. */
	hit(r, c, d) {
		const ch = this.cell(r, c);
		if (ch === 'B') return this.ring();
		if (ch === 'o') return this.breakVase(r, c);
		const dom = this.dominoes.get(`${r},${c}`);
		if (!dom || dom.state !== 'up') return false;
		dom.state = 'falling';
		dom.d = d;
		dom.t = 0;
		this.ctx.audio.play('tick');
		const f = [r + DIRS[d][0], c + DIRS[d][1]];
		const fch = this.cell(f[0], f[1]);
		const front = this.dominoes.get(`${f[0]},${f[1]}`);
		if ((front && front.state === 'up') || fch === 'B' || fch === 'o') this.queue.push({ at: this.clock + 0.11, r: f[0], c: f[1], d });
		else {
			for (const k of [-1, 1]) {
				const nd = rot(d, k), nr = r + DIRS[nd][0], nc = c + DIRS[nd][1];
				const n = this.dominoes.get(`${nr},${nc}`);
				if ((n && n.state === 'up') || this.cell(nr, nc) === 'B') this.queue.push({ at: this.clock + 0.13, r: nr, c: nc, d: nd });
			}
		}
		return true;
	}

	ring() {
		if (this.state !== 'running') return;
		this.state = 'won';
		this.bellRung = 1;
		const left = this.budget - this.dominoes.size;
		const gain = 150 + left * 40;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		const b = this.find('B');
		this.burst((b.c + 0.5) * CELL, (b.r + 0.5) * CELL, { count: 40, colors: ['#fde047', '#fbbf24', '#ffffff'], speed: 220, life: 0.9, shape: 'star', size: 5 });
		this.popup(`+${gain}`, (b.c + 0.5) * CELL, b.r * CELL, { color: '#fde047', size: 26 });
		setTimeout(() => {
			if (!this.running) return;
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Ding ding!', message: 'Every bell rung.', score: this.score });
			this.load(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1400);
	}

	breakVase(r, c) {
		if (this.state !== 'running') return;
		this.state = 'broken';
		this.broken = { r, c };
		this.ctx.audio.play('shatter');
		this.burst((c + 0.5) * CELL, (r + 0.5) * CELL, { count: 24, colors: ['#93c5fd', '#e0f2fe'], speed: 180, life: 0.6, shape: 'square', size: 4, gravity: 0 });
		this.fx.shake.kick(5);
		setTimeout(() => { if (this.running && this.state === 'broken') { this.broken = null; this.standUp(); } }, 1500);
	}

	find(ch) {
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.grid[r][c] === ch) return { r, c };
		return null;
	}

	step(dt) {
		for (const d of this.dominoes.values()) if (d.state === 'falling') { d.t += dt * 6; if (d.t >= 1) d.state = 'down'; }
		this.bellRung = Math.max(0, this.bellRung - dt * 0.5);
		if (this.state !== 'running') return;
		this.clock += dt;
		const due = this.queue.filter((q) => q.at <= this.clock);
		this.queue = this.queue.filter((q) => q.at > this.clock);
		for (const q of due) this.hit(q.r, q.c, q.d);
		if (this.state === 'running' && !this.queue.length && ![...this.dominoes.values()].some((d) => d.state === 'falling')) {
			// the chain stopped short
			this.state = 'stopped';
			this.ctx.audio.play('lifelost');
			setTimeout(() => { if (this.running && this.state === 'stopped') this.standUp(); }, 1200);
		}
	}

	draw(g) {
		g.fillStyle = '#1c2541';
		g.fillRect(0, 0, W, H);
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			const x = c * CELL, y = r * CELL, ch = this.grid[r][c];
			g.fillStyle = (r + c) % 2 ? '#22305a' : '#1f2b52';
			g.fillRect(x, y, CELL, CELL);
			if (ch === '#') fillRound(g, x + 4, y + 4, CELL - 8, CELL - 8, 10, '#64748b');
			if (ch === 'o' && !(this.broken && this.broken.r === r && this.broken.c === c)) {
				g.fillStyle = '#60a5fa';
				g.beginPath(); g.ellipse(x + CELL / 2, y + CELL / 2 + 4, 13, 15, 0, 0, Math.PI * 2); g.fill();
				fillRound(g, x + CELL / 2 - 6, y + 8, 12, 10, 3, '#93c5fd');
			}
			if (ch === 'B') {
				const sw = Math.sin(performance.now() / 50) * this.bellRung * 0.5;
				g.save();
				g.translate(x + CELL / 2, y + 10);
				g.rotate(sw);
				g.fillStyle = '#fbbf24';
				g.beginPath(); g.moveTo(-14, 26); g.quadraticCurveTo(-14, 0, 0, 0); g.quadraticCurveTo(14, 0, 14, 26); g.closePath(); g.fill();
				g.fillStyle = '#92400e';
				g.beginPath(); g.arc(0, 28, 4, 0, Math.PI * 2); g.fill();
				g.restore();
			}
			if (PUSH[ch] !== undefined) {
				g.save();
				g.translate(x + CELL / 2, y + CELL / 2);
				g.rotate(Math.atan2(DIRS[PUSH[ch]][0], DIRS[PUSH[ch]][1]));
				fillRound(g, -16, -12, 22, 24, 6, '#f472b6');
				g.fillStyle = '#fbcfe8';
				g.beginPath(); g.moveTo(8, -10); g.lineTo(20, 0); g.lineTo(8, 10); g.fill();
				g.restore();
			}
		}
		for (const d of this.dominoes.values()) {
			const x = (d.c + 0.5) * CELL, y = (d.r + 0.5) * CELL;
			g.save();
			g.translate(x, y);
			if (d.state === 'up') {
				fillRound(g, -7, -18, 14, 36, 3, '#f8fafc');
				g.fillStyle = '#0f172a';
				g.beginPath(); g.arc(0, -8, 2.2, 0, Math.PI * 2); g.arc(0, 8, 2.2, 0, Math.PI * 2); g.fill();
			} else {
				const t = d.state === 'down' ? 1 : d.t;
				g.rotate(Math.atan2(DIRS[d.d][0], DIRS[d.d][1]));
				// falling: the domino tips over, lengthening along its fall direction
				const len = 14 + 30 * t;
				fillRound(g, -7, -9, len, 18, 3, t >= 1 ? '#cbd5e1' : '#f1f5f9');
			}
			g.restore();
		}
		if (this.state === 'build' && this.running) text(g, 'Click cells to place dominoes, then Push!', W / 2, H - 12, { size: 12, color: 'rgba(226,232,240,0.6)' });
		if (this.state === 'stopped') text(g, 'The chain stopped. Try another line!', W / 2, H / 2, { size: 24, color: '#fca5a5', weight: 900 });
		if (this.state === 'broken') text(g, 'Crash! A vase broke.', W / 2, H / 2, { size: 24, color: '#fca5a5', weight: 900 });
	}
}

export { shortest, LEVELS };
