// Slide Puzzle: the n×n sliding tiles, shuffled by random legal moves so it is always solvable.

import { Game } from '../core/game.js';
import { h } from '../../components/dom.js';

export default class SlidePuzzle extends Game {
	async init() {
		this.board = h('div.slide-board');
		this.style = h('style', SLIDE_CSS);
		this.ctx.root.append(this.style, this.board);
		this.board.addEventListener('click', (e) => {
			const tile = e.target.closest('.slide-tile');
			if (tile) this.tap(this.tiles.indexOf(+tile.dataset.v));
		});
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.ctx.root);
		this.reset();
	}

	fit() {
		const rect = this.ctx.root.getBoundingClientRect();
		this.board.style.setProperty('--board', `${Math.floor(Math.min(rect.width - 24, rect.height - 24, 520))}px`);
	}

	reset() {
		this.running = false;
		this.n = +this.ctx.settings.size || 4;
		const total = this.n * this.n;
		this.tiles = [...Array(total).keys()].map((i) => (i + 1) % total); // 0 is the gap, last
		let gap = total - 1, prev = -1;
		for (let k = 0; k < total * 40; k++) {
			const options = this.adjacent(gap).filter((i) => i !== prev);
			const pick = options[Math.floor(Math.random() * options.length)];
			[this.tiles[gap], this.tiles[pick]] = [this.tiles[pick], this.tiles[gap]];
			prev = gap;
			gap = pick;
		}
		if (this.solved()) return this.reset();
		this.moves = 0;
		this.build();
	}

	build() {
		this.board.style.setProperty('--n', this.n);
		this.els = new Map();
		this.board.replaceChildren(...this.tiles.filter((v) => v).map((v) => {
			const el = h('button.slide-tile', { type: 'button', dataset: { v } }, String(v));
			this.els.set(v, el);
			return el;
		}));
		this.place();
		this.ctx.score(this.moves);
		this.fit();
	}

	serialize() { return { n: this.n, tiles: this.tiles, moves: this.moves }; }
	restore(data) {
		if (data?.n !== this.n) return;
		this.tiles = data.tiles;
		this.moves = data.moves;
		this.build();
	}

	adjacent(i) {
		const n = this.n, r = Math.floor(i / n), c = i % n, out = [];
		if (r > 0) out.push(i - n);
		if (r < n - 1) out.push(i + n);
		if (c > 0) out.push(i - 1);
		if (c < n - 1) out.push(i + 1);
		return out;
	}

	place() {
		this.tiles.forEach((v, i) => {
			if (!v) return;
			const el = this.els.get(v);
			el.style.setProperty('--r', Math.floor(i / this.n));
			el.style.setProperty('--c', i % this.n);
			const home = v === i + 1;
			// a tile arriving home sparkles once
			if (home && !el.classList.contains('home') && this.running) setTimeout(() => this.ctx.fx.burst(el, { count: 8, colors: ['#5eead4', '#ffffff'], speed: 90, life: 0.45, shape: 'star', size: 3 }), 130);
			el.classList.toggle('home', home);
		});
	}

	tap(i) {
		if (!this.running) return;
		const gap = this.tiles.indexOf(0);
		const n = this.n;
		const sameRow = Math.floor(i / n) === Math.floor(gap / n), sameCol = i % n === gap % n;
		if (!sameRow && !sameCol) {
			this.ctx.fx.nope(this.els.get(this.tiles[i]));
			this.ctx.audio.play('error');
			return;
		}
		// slide a whole line of tiles toward the gap
		const step = sameRow ? (i < gap ? -1 : 1) : (i < gap ? -n : n);
		let g = gap;
		while (g !== i) {
			const next = g + step;
			this.tiles[g] = this.tiles[next];
			this.tiles[next] = 0;
			g = next;
			this.moves++;
		}
		this.ctx.audio.play('move');
		this.place();
		this.ctx.score(this.moves);
		this.ctx.saveProgress(this.serialize());
		if (this.solved()) {
			[...this.els.values()].forEach((el, k) => { el.style.setProperty('--d', `${k * 45}ms`); el.classList.add('wave'); });
		}
		if (this.solved()) this.finish({ win: true, title: 'Solved!', message: `${this.n} × ${this.n} in ${this.moves} moves.`, score: this.moves });
	}

	solved() {
		return this.tiles.every((v, i) => v === (i + 1) % (this.n * this.n));
	}

	handleInput({ type, action }) {
		if (type !== 'down') return;
		// arrows move the tile next to the gap in that direction
		const gap = this.tiles.indexOf(0), n = this.n;
		const from = { up: gap + n, down: gap - n, left: gap + 1, right: gap - 1 }[action];
		if (from === undefined || from < 0 || from >= n * n) return;
		if ((action === 'left' || action === 'right') && Math.floor(from / n) !== Math.floor(gap / n)) return;
		this.tap(from);
	}

	dispose() {
		this.observer.disconnect();
		this.board.remove();
		this.style.remove();
	}
}

const SLIDE_CSS = `
.slide-board { --gap: 8px; --cell: calc((var(--board) - var(--gap) * (var(--n) + 1)) / var(--n)); position: relative; width: var(--board); height: var(--board); border-radius: 18px; background: var(--color-surface-2); border: 1px solid var(--color-border); box-shadow: 0 20px 60px -20px rgba(0,0,0,0.8); }
.slide-tile { position: absolute; left: 0; top: 0; width: var(--cell); height: var(--cell); display: grid; place-items: center; border: 0; border-radius: 12px; background: linear-gradient(160deg, var(--color-primary), var(--color-primary-active)); color: var(--color-on-primary); font-weight: 900; font-size: calc(var(--cell) * 0.38); cursor: pointer; transform: translate(calc(var(--gap) + var(--c) * (var(--cell) + var(--gap))), calc(var(--gap) + var(--r) * (var(--cell) + var(--gap)))); transition: transform 0.16s cubic-bezier(.34,1.4,.64,1), background 0.3s, filter 0.2s; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.25); touch-action: manipulation; }
.slide-tile.home { background: linear-gradient(160deg, #2dd4bf, #0f766e); color: #fff; }
.slide-tile:hover { filter: brightness(1.12); }
.slide-tile.fx-nope { animation: slide-nope 0.3s; }
@keyframes slide-nope { 30% { filter: brightness(1.4) hue-rotate(-40deg); } }
.slide-tile.wave { animation: slide-wave 0.6s ease-out backwards; animation-delay: var(--d); }
@keyframes slide-wave { 40% { filter: brightness(1.6); box-shadow: 0 0 24px #5eead4; } }
`;
