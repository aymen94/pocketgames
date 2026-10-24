// Pixel Logic: nonograms. Each puzzle is a random picture; a grid counts as solved as
// soon as every row and column matches its clues, even if it differs from the original.

import { Game } from '../core/game.js';
import { PuzzleClock } from '../core/timer.js';
import { h } from '../../components/dom.js';

function runs(line) {
	const out = [];
	let n = 0;
	for (const v of line) {
		if (v === 1) n++;
		else if (n) { out.push(n); n = 0; }
	}
	if (n) out.push(n);
	return out.length ? out : [0];
}

/** A random picture with some structure: blobs rather than noise, around 55% filled. */
function picture(n) {
	const grid = Array.from({ length: n }, () => new Array(n).fill(0));
	const seeds = Math.ceil(n * 0.9);
	for (let s = 0; s < seeds; s++) {
		let r = Math.floor(Math.random() * n), c = Math.floor(Math.random() * n);
		for (let k = 0; k < n * 1.6; k++) {
			grid[r][c] = 1;
			if (Math.random() < 0.5) r = Math.max(0, Math.min(n - 1, r + (Math.random() < 0.5 ? -1 : 1)));
			else c = Math.max(0, Math.min(n - 1, c + (Math.random() < 0.5 ? -1 : 1)));
		}
	}
	// no empty rows or columns: they make dull clues
	for (let i = 0; i < n; i++) {
		if (!grid[i].some(Boolean)) grid[i][Math.floor(Math.random() * n)] = 1;
		if (!grid.some((row) => row[i])) grid[Math.floor(Math.random() * n)][i] = 1;
	}
	return grid;
}

export default class PixelLogic extends Game {
	async init() {
		this.column = h('div.game-column');
		this.style = h('style', PIXEL_CSS);
		this.ctx.root.append(this.style, this.column);
		this.clock = new PuzzleClock((t) => this.ctx.info(t));
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.ctx.root);
		this.reset();
	}

	reset() {
		this.running = false;
		this.clock.reset();
		this.n = +this.ctx.settings.size || 8;
		this.solution = picture(this.n);
		this.cells = Array.from({ length: this.n }, () => new Array(this.n).fill(0)); // 0 empty, 1 filled, 2 crossed
		this.build();
	}

	serialize() { return { n: this.n, solution: this.solution, cells: this.cells, time: this.clock.time }; }
	restore(data) {
		if (data?.n !== this.n) return;
		this.solution = data.solution;
		this.cells = data.cells;
		this.clock.elapsed = data.time;
		this.build();
	}

	start() { super.start(); this.clock.start(); }

	build() {
		const n = this.n;
		this.rowClues = this.solution.map(runs);
		this.colClues = this.solution[0].map((_, c) => runs(this.solution.map((row) => row[c])));
		this.mode = 1;
		const table = h('div.pixel-table', { style: { '--n': n } });
		table.appendChild(h('div.pixel-corner'));
		this.colEls = this.colClues.map((clue) => h('div.pixel-clue.col', clue.map((v) => h('span', String(v)))));
		table.append(...this.colEls);
		this.rowEls = [];
		this.cellEls = [];
		for (let r = 0; r < n; r++) {
			const rowClue = h('div.pixel-clue.row', this.rowClues[r].map((v) => h('span', String(v))));
			this.rowEls.push(rowClue);
			table.appendChild(rowClue);
			for (let c = 0; c < n; c++) {
				const cell = h('button.pixel-cell', { type: 'button', dataset: { r, c } });
				if (c % 5 === 4 && c < n - 1) cell.classList.add('br');
				if (r % 5 === 4 && r < n - 1) cell.classList.add('bb');
				this.cellEls.push(cell);
				table.appendChild(cell);
			}
		}
		// drag painting: the first cell decides whether the stroke fills, crosses or clears
		let stroke = null;
		table.addEventListener('pointerdown', (e) => {
			const cell = e.target.closest('.pixel-cell');
			if (!cell || !this.running) return;
			e.preventDefault();
			// touch pointers are captured by the first cell; release so the stroke can cross cells
			if (cell.hasPointerCapture?.(e.pointerId)) cell.releasePointerCapture(e.pointerId);
			const mode = e.button === 2 ? 2 : this.mode;
			const r = +cell.dataset.r, c = +cell.dataset.c;
			stroke = { value: this.cells[r][c] === mode ? 0 : mode };
			this.set(r, c, stroke.value);
		});
		table.addEventListener('pointerover', (e) => {
			if (!stroke) return;
			const cell = e.target.closest('.pixel-cell');
			if (cell) this.set(+cell.dataset.r, +cell.dataset.c, stroke.value);
		});
		const end = () => { if (stroke) { stroke = null; this.commit(); } };
		this.ctx.input.on(window, 'pointerup', end);
		table.addEventListener('contextmenu', (e) => e.preventDefault());
		this.table = table;
		this.fillButton = h('button.btn.small', { type: 'button', 'aria-pressed': 'true', onclick: () => this.setMode(1) }, '■ Fill');
		this.crossButton = h('button.btn.small', { type: 'button', 'aria-pressed': 'false', onclick: () => this.setMode(2) }, '✕ Mark');
		this.column.replaceChildren(table, h('div.game-toolbar', this.fillButton, this.crossButton));
		this.paint();
		this.fit();
	}

	fit() {
		if (!this.table) return;
		const rect = this.ctx.root.getBoundingClientRect();
		const clueSpace = Math.ceil(this.n / 2) + 1;
		const size = Math.floor(Math.min((rect.width - 30) / (this.n + clueSpace * 0.55), (rect.height - 90) / (this.n + clueSpace * 0.55), 48));
		this.table.style.setProperty('--cell', `${Math.max(18, size)}px`);
	}

	setMode(mode) {
		this.mode = mode;
		this.fillButton.setAttribute('aria-pressed', String(mode === 1));
		this.crossButton.setAttribute('aria-pressed', String(mode === 2));
	}

	set(r, c, value) {
		if (this.cells[r][c] === value) return;
		this.cells[r][c] = value;
		this.ctx.audio.play(value === 1 ? 'click' : 'flip');
		this.paint();
		const el = this.cellEls[r * this.n + c];
		el.classList.remove('pop');
		void el.offsetWidth;
		if (value) el.classList.add('pop');
	}

	commit() {
		this.ctx.saveProgress(this.serialize());
		const filled = (r, c) => (this.cells[r][c] === 1 ? 1 : 0);
		const ok = this.rowClues.every((clue, r) => runs(this.cells[r].map((_, c) => filled(r, c))).join() === clue.join())
			&& this.colClues.every((clue, c) => runs(this.cells.map((_, r) => filled(r, c))).join() === clue.join());
		if (ok) {
			this.clock.stop();
			const t = Math.round(this.clock.time);
			this.table.classList.add('solved');
			// the finished picture lights up in a diagonal wave
			this.cellEls.forEach((el, i) => el.style.setProperty('--d', `${(Math.floor(i / this.n) + (i % this.n)) * 40}ms`));
			this.ctx.fx.burst(this.table, { count: 40, colors: ['#34d399', '#fde047', '#ffffff'], speed: 260, life: 0.9, shape: 'star', size: 5, gravity: 120 });
			this.finish({ win: true, title: 'Picture complete!', message: `Solved in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}.`, score: t });
		}
	}

	paint() {
		const n = this.n;
		this.cellEls.forEach((el, i) => {
			const v = this.cells[Math.floor(i / n)][i % n];
			el.classList.toggle('on', v === 1);
			el.classList.toggle('x', v === 2);
		});
		// dim clues of lines that already match
		const filled = (r, c) => (this.cells[r][c] === 1 ? 1 : 0);
		const mark = (el, done) => {
			// a line that just became correct flashes its clue
			if (done && !el.classList.contains('done') && this.running) {
				el.classList.add('just-done');
				setTimeout(() => el.classList.remove('just-done'), 600);
				this.ctx.audio.play('select');
			}
			el.classList.toggle('done', done);
		};
		this.rowEls.forEach((el, r) => mark(el, runs(this.cells[r].map((_, c) => filled(r, c))).join() === this.rowClues[r].join()));
		this.colEls.forEach((el, c) => mark(el, runs(this.cells.map((_, r) => filled(r, c))).join() === this.colClues[c].join()));
	}

	pause() { super.pause(); this.clock.stop(); }
	resume() { super.resume(); this.clock.start(); }

	dispose() {
		this.clock.stop();
		this.observer.disconnect();
		this.column.remove();
		this.style.remove();
	}
}

const PIXEL_CSS = `
.pixel-table { display: grid; grid-template-columns: auto repeat(var(--n), var(--cell)); grid-template-rows: auto repeat(var(--n), var(--cell)); gap: 2px; user-select: none; touch-action: none; }
.pixel-clue { display: flex; gap: 4px; color: var(--color-text-soft); font-weight: 800; font-size: calc(var(--cell) * 0.42); transition: color 0.3s; }
.pixel-clue.col { flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 4px; }
.pixel-clue.row { justify-content: flex-end; align-items: center; padding-right: 6px; }
.pixel-clue.done { color: var(--color-text-muted); opacity: 0.55; }
.pixel-clue.just-done { animation: clue-done 0.6s ease-out; }
@keyframes clue-done { 30% { color: var(--color-success); transform: scale(1.25); opacity: 1; } }
.pixel-cell { width: var(--cell); height: var(--cell); border: 0; padding: 0; border-radius: 3px; background: var(--color-surface-2); cursor: pointer; position: relative; transition: background 0.15s; }
.pixel-cell:hover { background: var(--color-surface-hover); }
.pixel-cell.pop { animation: pixel-pop 0.22s cubic-bezier(.34,1.56,.64,1); }
@keyframes pixel-pop { from { transform: scale(0.55); } }
.pixel-cell.br { margin-right: 2px; }
.pixel-cell.bb { margin-bottom: 2px; }
.pixel-cell.on { background: linear-gradient(160deg, #fbbf24, #f59e0b); }
.pixel-cell.x::after { content: '✕'; position: absolute; inset: 0; display: grid; place-items: center; color: var(--color-text-muted); font-size: calc(var(--cell) * 0.55); animation: fade 0.2s; }
.pixel-table.solved .pixel-cell.on { background: linear-gradient(160deg, #34d399, #059669); animation: pixel-solved 0.5s ease-out backwards; animation-delay: var(--d, 0ms); }
@keyframes pixel-solved { 40% { transform: scale(1.2); filter: brightness(1.5); } }
`;
