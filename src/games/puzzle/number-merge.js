// Number Merge: slide the board, equal tiles merge into their sum. DOM tiles animate
// with CSS transitions; the board state is plain arrays so it can be saved and resumed.

import { Game } from '../core/game.js';
import { h } from '../../components/dom.js';

const TILE_COLORS = {
	2: ['#e0e7ff', '#1e2340'], 4: ['#c7d2fe', '#1e2340'], 8: ['#fbbf24', '#3b2300'], 16: ['#fb923c', '#fff'],
	32: ['#fb7185', '#fff'], 64: ['#f43f5e', '#fff'], 128: ['#a78bfa', '#fff'], 256: ['#8b5cf6', '#fff'],
	512: ['#6366f1', '#fff'], 1024: ['#22d3ee', '#083344'], 2048: ['#34d399', '#052e1c'],
};

export default class NumberMerge extends Game {
	async init() {
		this.board = h('div.merge-board');
		this.wrap = h('div.merge-wrap', this.board);
		this.style = h('style', MERGE_CSS);
		this.ctx.root.append(this.style, this.wrap);
		this.ctx.input.swipe(this.board, (dir) => this.move(dir));
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.ctx.root);
		this.reset();
	}

	fit() {
		const rect = this.ctx.root.getBoundingClientRect();
		this.wrap.style.setProperty('--board', `${Math.floor(Math.min(rect.width - 24, rect.height - 24, 560))}px`);
	}

	reset() {
		this.running = false;
		this.size = +this.ctx.settings.size || 4;
		this.board.style.setProperty('--n', this.size);
		this.board.replaceChildren(...Array.from({ length: this.size * this.size }, () => h('div.merge-slot')));
		this.cells = new Array(this.size * this.size).fill(null);
		this.score = 0;
		this.won = false;
		this.nextId = 1;
		this.spawn();
		this.spawn();
		this.ctx.score(0);
		this.fit();
	}

	serialize() {
		return { size: this.size, values: this.cells.map((t) => t?.value ?? 0), score: this.score, won: this.won };
	}

	restore(data) {
		if (!data || data.size !== this.size) return;
		for (const t of this.cells) t?.el.remove();
		this.cells = data.values.map((v, i) => (v ? this.makeTile(v, i) : null));
		this.score = data.score;
		this.won = data.won;
		this.ctx.score(this.score);
	}

	makeTile(value, index, fresh = false) {
		const el = h(`div.merge-tile${fresh ? '.fresh' : ''}`);
		const tile = { id: this.nextId++, value, el };
		this.paint(tile);
		this.position(tile, index);
		this.board.appendChild(el);
		return tile;
	}

	paint(tile) {
		const [bg, fg] = TILE_COLORS[tile.value] ?? ['#0f172a', '#fff'];
		tile.el.textContent = tile.value;
		tile.el.style.background = bg;
		tile.el.style.color = fg;
		tile.el.style.fontSize = `calc(var(--cell) * ${tile.value >= 1024 ? 0.3 : tile.value >= 128 ? 0.36 : 0.44})`;
	}

	position(tile, index) {
		tile.el.style.setProperty('--r', Math.floor(index / this.size));
		tile.el.style.setProperty('--c', index % this.size);
	}

	spawn() {
		const free = this.cells.map((t, i) => (t ? -1 : i)).filter((i) => i >= 0);
		if (!free.length) return;
		const i = free[Math.floor(Math.random() * free.length)];
		this.cells[i] = this.makeTile(Math.random() < 0.9 ? 2 : 4, i, true);
	}

	handleInput({ type, action }) {
		if (type === 'down' && ['up', 'down', 'left', 'right'].includes(action)) this.move(action);
	}

	/** Index of cell `k` along line `line` when sliding toward `dir`. */
	lineIndex(dir, line, k) {
		const n = this.size;
		if (dir === 'left') return line * n + k;
		if (dir === 'right') return line * n + (n - 1 - k);
		if (dir === 'up') return k * n + line;
		return (n - 1 - k) * n + line;
	}

	move(dir) {
		if (!this.running) return;
		const n = this.size;
		const next = new Array(n * n).fill(null);
		let moved = false, gained = 0;
		const merging = [];
		for (let line = 0; line < n; line++) {
			let target = 0, last = null;
			for (let k = 0; k < n; k++) {
				const from = this.lineIndex(dir, line, k);
				const tile = this.cells[from];
				if (!tile) continue;
				if (last && last.value === tile.value && !last.merged) {
					// slide onto the previous tile and merge with it
					const to = this.lineIndex(dir, line, target - 1);
					this.position(tile, to);
					last.merged = true;
					last.value *= 2;
					gained += last.value;
					merging.push({ survivor: last, gone: tile });
					moved = true;
				} else {
					const to = this.lineIndex(dir, line, target);
					if (to !== from) moved = true;
					next[to] = tile;
					this.position(tile, to);
					last = tile;
					target++;
				}
			}
		}
		if (!moved) {
			// nothing slid: nudge the board toward the attempted direction
			this.board.dataset.nudge = dir;
			this.board.classList.remove('nudge');
			void this.board.offsetWidth;
			this.board.classList.add('nudge');
			return;
		}
		this.cells = next;
		for (const t of next) if (t) t.merged = false;
		this.ctx.audio.play(gained ? 'score' : 'move');
		setTimeout(() => {
			for (const { survivor, gone } of merging) {
				gone.el.remove();
				this.paint(survivor);
				survivor.el.classList.remove('pop');
				void survivor.el.offsetWidth;
				survivor.el.classList.add('pop');
				const fx = this.ctx.fx;
				const [bg] = TILE_COLORS[survivor.value] ?? ['#ffffff'];
				const at = fx.centre(survivor.el);
				const big = survivor.value >= 128;
				fx.burst(at, { count: big ? 22 : 10, colors: [bg, '#ffffff'], speed: big ? 220 : 140, life: 0.5, shape: big ? 'star' : 'square', size: big ? 5 : 3.5, gravity: 120 });
				fx.text(`+${survivor.value}`, { x: at.x, y: at.y - 18 }, { color: bg, size: big ? 22 : 16, life: 0.7 });
				if (survivor.value >= 512) { fx.ring(at, { color: bg, radius: 70 }); this.ctx.audio.play('sparkle'); }
			}
		}, 110);
		this.score += gained;
		this.ctx.score(this.score);
		this.spawn();
		this.ctx.saveProgress(this.serialize());
		const best = Math.max(...this.cells.map((t) => t?.value ?? 0));
		if (best >= 2048 && !this.won) {
			this.won = true;
			return this.finish({ win: true, title: '2048!', message: 'You built the 2048 tile.', score: this.score });
		}
		if (!this.canMove()) this.finish({ win: false, title: 'No moves left', message: `Your biggest tile was ${best}.`, score: this.score });
	}

	canMove() {
		const n = this.size;
		for (let i = 0; i < n * n; i++) {
			const t = this.cells[i];
			if (!t) return true;
			const r = Math.floor(i / n), c = i % n;
			if (c < n - 1 && this.cells[i + 1]?.value === t.value) return true;
			if (r < n - 1 && this.cells[i + n]?.value === t.value) return true;
		}
		return false;
	}

	dispose() {
		this.observer.disconnect();
		this.wrap.remove();
		this.style.remove();
	}
}

const MERGE_CSS = `
.merge-wrap { --gap: 10px; width: var(--board); height: var(--board); }
.merge-board { --cell: calc((var(--board) - var(--gap) * (var(--n) + 1)) / var(--n)); position: relative; width: 100%; height: 100%; padding: var(--gap); border-radius: 18px; background: var(--color-surface-2); border: 1px solid var(--color-border); display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: var(--gap); touch-action: none; box-shadow: 0 20px 60px -20px rgba(0,0,0,0.8); }
.merge-slot { border-radius: 10px; background: var(--color-tint-strong); }
.merge-board.nudge[data-nudge='left'] { animation: nudge-x 0.22s ease-out; --n-dir: -1; }
.merge-board.nudge[data-nudge='right'] { animation: nudge-x 0.22s ease-out; --n-dir: 1; }
.merge-board.nudge[data-nudge='up'] { animation: nudge-y 0.22s ease-out; --n-dir: -1; }
.merge-board.nudge[data-nudge='down'] { animation: nudge-y 0.22s ease-out; --n-dir: 1; }
@keyframes nudge-x { 40% { transform: translateX(calc(var(--n-dir) * 8px)); } }
@keyframes nudge-y { 40% { transform: translateY(calc(var(--n-dir) * 8px)); } }
.merge-tile { position: absolute; left: 0; top: 0; width: var(--cell); height: var(--cell); display: grid; place-items: center; border-radius: 10px; font-weight: 900; transform: translate(calc(var(--gap) + var(--c) * (var(--cell) + var(--gap))), calc(var(--gap) + var(--r) * (var(--cell) + var(--gap)))); transition: transform 0.11s ease-out; box-shadow: 0 4px 0 rgba(0,0,0,0.18); }
.merge-tile.fresh { animation: merge-in 0.18s ease-out; }
.merge-tile.pop { animation: merge-pop 0.16s ease-out; }
@keyframes merge-in { from { opacity: 0; scale: 0.4; } }
@keyframes merge-pop { 50% { scale: 1.14; } }
`;
