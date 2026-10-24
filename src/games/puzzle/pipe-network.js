// Pipe Network: rotate the pipe tiles so water from the pump reaches every tile. Each board
// is a random spanning tree with every tile turned at random, so exactly the pipes you
// see make a complete network. Water fills whatever is connected as you go.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text } from '../core/canvas.js';

const W = 560, H = 600;
const N = 1, E = 2, S = 4, Wd = 8;
const DIRS = [[N, -1, 0, S], [E, 0, 1, Wd], [S, 1, 0, N], [Wd, 0, -1, E]];
const SIZES = [4, 5, 5, 6, 6, 7, 7, 8, 8, 9];

export const rotate = (m, turns = 1) => { for (let i = 0; i < ((turns % 4) + 4) % 4; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };

/** A random spanning tree over an n×n grid, as connection masks. */
export function tree(n) {
	const mask = new Uint8Array(n * n), seen = new Uint8Array(n * n);
	const start = Math.floor(n / 2) * n + Math.floor(n / 2);
	const stack = [start];
	seen[start] = 1;
	while (stack.length) {
		// pick a random frontier cell instead of the top, for branchier trees
		const k = Math.random() < 0.5 ? stack.length - 1 : Math.floor(Math.random() * stack.length);
		const cell = stack[k];
		const r = Math.floor(cell / n), c = cell % n;
		const options = DIRS.filter(([, dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < n && cc >= 0 && cc < n && !seen[rr * n + cc]; });
		if (!options.length) { stack.splice(k, 1); continue; }
		const [bit, dr, dc, back] = options[Math.floor(Math.random() * options.length)];
		const next = (r + dr) * n + c + dc;
		mask[cell] |= bit;
		mask[next] |= back;
		seen[next] = 1;
		stack.push(next);
	}
	return { mask, source: start };
}

export default class PipeNetwork extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.label = tool.label('');
		return tool.bar(this.label, tool.button('Restart level', () => this.startLevel(this.level)));
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.startLevel(0);
	}

	restore(data) {
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.startLevel(data.level ?? 0);
	}

	startLevel(level) {
		this.level = level;
		this.n = SIZES[Math.min(level, SIZES.length - 1)];
		const { mask, source } = tree(this.n);
		this.solution = mask;
		this.source = source;
		this.tiles = Array.from(mask, (m) => rotate(m, Math.floor(Math.random() * 4)));
		this.moves = 0;
		this.spin = new Float32Array(this.n * this.n);
		this.flow();
		if (this.full) return this.startLevel(level);
		this.label.textContent = `Level ${level + 1} / ${SIZES.length}`;
		this.ctx.info('Click to turn a pipe (right-click turns back)');
		this.ctx.saveProgress({ level, score: this.score });
		this.wake();
	}

	flow() {
		const n = this.n, wet = new Uint8Array(n * n);
		const queue = [this.source];
		wet[this.source] = 1;
		while (queue.length) {
			const cell = queue.shift();
			const r = Math.floor(cell / n), c = cell % n;
			for (const [bit, dr, dc, back] of DIRS) {
				if (!(this.tiles[cell] & bit)) continue;
				const rr = r + dr, cc = c + dc;
				if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
				const next = rr * n + cc;
				if (!wet[next] && this.tiles[next] & back) { wet[next] = 1; queue.push(next); }
			}
		}
		this.wet = wet;
		this.full = wet.every(Boolean);
	}

	geometry() {
		const size = Math.floor(Math.min(500 / this.n, 90));
		return { size, x0: (W - size * this.n) / 2, y0: (H - size * this.n) / 2 };
	}

	pointerDown(p, e) {
		if (!this.running || this.full) return;
		const { size, x0, y0 } = this.geometry();
		const c = Math.floor((p.x - x0) / size), r = Math.floor((p.y - y0) / size);
		if (r < 0 || r >= this.n || c < 0 || c >= this.n) return;
		const i = r * this.n + c;
		const dir = e?.button === 2 ? -1 : 1;
		this.tiles[i] = rotate(this.tiles[i], dir);
		this.spin[i] = -dir * Math.PI / 2;
		this.moves++;
		this.ctx.audio.play('flip');
		const before = this.wet.reduce((a, b) => a + b, 0);
		this.flow();
		if (this.wet.reduce((a, b) => a + b, 0) > before) this.ctx.audio.play('splash');
		if (this.full) this.complete();
	}

	complete() {
		const gain = 50 * this.n + Math.max(0, this.n * this.n * 2 - this.moves) * 3;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		this.ctx.fx.confetti({ count: 50 });
		this.popup(`+${gain}`, W / 2, 40, { color: '#7dd3fc', size: 26 });
		setTimeout(() => {
			if (!this.running) return;
			if (this.level + 1 >= SIZES.length) return this.finish({ win: true, title: 'Network complete!', message: `All ${SIZES.length} networks running.`, score: this.score });
			this.startLevel(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1100);
	}

	busy() { return this.spin.some((s) => Math.abs(s) > 0.01); }

	tick(dt) {
		for (let i = 0; i < this.spin.length; i++) this.spin[i] *= Math.exp(-dt * 18);
	}

	draw(g) {
		g.fillStyle = '#1c1917';
		g.fillRect(0, 0, W, H);
		const { size, x0, y0 } = this.geometry();
		const n = this.n;
		for (let i = 0; i < n * n; i++) {
			const x = x0 + (i % n) * size, y = y0 + Math.floor(i / n) * size;
			fillRound(g, x + 2, y + 2, size - 4, size - 4, 8, this.full ? '#164e63' : '#292524');
			g.save();
			g.translate(x + size / 2, y + size / 2);
			g.rotate(this.spin[i]);
			const m = this.tiles[i], wet = this.wet[i];
			g.lineCap = 'round';
			for (const [width, color] of [[size * 0.3, '#57534e'], [size * 0.18, wet ? '#38bdf8' : '#0c0a09']]) {
				g.strokeStyle = color;
				g.lineWidth = width;
				g.beginPath();
				for (const [bit, dr, dc] of DIRS) if (m & bit) { g.moveTo(0, 0); g.lineTo(dc * size / 2, dr * size / 2); }
				g.stroke();
			}
			const ends = [N, E, S, Wd].filter((b) => m & b).length;
			if (i === this.source) { circle(g, 0, 0, size * 0.28, '#0ea5e9'); text(g, '⛲', 0, 1, { size: size * 0.3 }); }
			else if (ends === 1) { circle(g, 0, 0, size * 0.2, wet ? '#38bdf8' : '#78716c'); circle(g, 0, 0, size * 0.1, wet ? '#e0f2fe' : '#292524'); }
			else circle(g, 0, 0, size * 0.09, wet ? '#38bdf8' : '#57534e');
			g.restore();
		}
	}
}
