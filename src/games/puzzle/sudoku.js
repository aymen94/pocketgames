// Sudoku with generated puzzles that always have exactly one solution, pencil notes,
// mistake highlighting, hints and resumable progress.

import { Game } from '../core/game.js';
import { Grid } from '../core/grid.js';
import { PuzzleClock } from '../core/timer.js';
import { shuffle } from '../core/ai.js';
import { h } from '../../components/dom.js';

const REMOVE = { easy: 40, medium: 49, hard: 55 };
const box = (i) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

/** Candidate mask (bits 1..9) for cell i of grid g. */
function candidates(g, i) {
	const r = Math.floor(i / 9), c = i % 9, b = box(i);
	let used = 0;
	for (let k = 0; k < 9; k++) {
		used |= 1 << g[r * 9 + k];
		used |= 1 << g[k * 9 + c];
		const br = Math.floor(b / 3) * 3 + Math.floor(k / 3), bc = (b % 3) * 3 + (k % 3);
		used |= 1 << g[br * 9 + bc];
	}
	return ~used & 0b1111111110;
}

/** Counts solutions up to `limit`, filling `g` with the last one found when `fill` is set. */
function solve(g, limit = 2, randomize = false) {
	let best = -1, bestMask = 0, bestCount = 10;
	for (let i = 0; i < 81; i++) {
		if (g[i]) continue;
		const mask = candidates(g, i);
		const count = popcount(mask);
		if (count < bestCount) { best = i; bestMask = mask; bestCount = count; if (count <= 1) break; }
	}
	if (best < 0) return 1;
	if (bestCount === 0) return 0;
	let digits = [];
	for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
	if (randomize) digits = shuffle(digits);
	let total = 0;
	for (const d of digits) {
		g[best] = d;
		total += solve(g, limit - total, randomize);
		if (total >= limit) { if (!randomize) g[best] = 0; return total; }
	}
	g[best] = 0;
	return total;
}

function popcount(x) {
	let n = 0;
	while (x) { x &= x - 1; n++; }
	return n;
}

function generate(level) {
	const solution = new Array(81).fill(0);
	solve(solution, 1, true);
	const puzzle = solution.slice();
	let removed = 0;
	for (const i of shuffle([...Array(81).keys()])) {
		if (removed >= REMOVE[level]) break;
		const keep = puzzle[i];
		puzzle[i] = 0;
		if (solve(puzzle.slice(), 2) !== 1) puzzle[i] = keep;
		else removed++;
	}
	return { puzzle, solution };
}

export default class Sudoku extends Game {
	async init() {
		this.column = h('div.game-column');
		this.style = h('style', SUDOKU_CSS);
		this.ctx.root.append(this.style, this.column);
		this.clock = new PuzzleClock((t) => this.ctx.info(`${t} · ${this.mistakes} mistakes`));
		this.reset();
	}

	reset() {
		this.running = false;
		this.clock.reset();
		const { puzzle, solution } = generate(this.ctx.settings.level ?? 'easy');
		this.load({ puzzle, solution, values: puzzle.slice(), notes: new Array(81).fill(0), mistakes: 0, time: 0 });
	}

	load(data) {
		this.puzzle = data.puzzle;
		this.solution = data.solution;
		this.values = data.values;
		this.notes = data.notes;
		this.mistakes = data.mistakes;
		this.clock.reset();
		this.clock.elapsed = data.time ?? 0;
		this.selected = this.puzzle.findIndex((v) => v === 0);
		this.notesMode = false;
		this.build();
		this.paint();
		this.ctx.info(`0:00 · ${this.mistakes} mistakes`);
	}

	serialize() {
		return { puzzle: this.puzzle, solution: this.solution, values: this.values, notes: this.notes, mistakes: this.mistakes, time: this.clock.time };
	}

	restore(data) {
		this.load(data);
	}

	start() {
		super.start();
		this.clock.start();
	}

	build() {
		this.grid?.dispose();
		this.column.replaceChildren();
		this.grid = new Grid(this.column, 9, 9, { className: 'sudoku-board', gap: 0, onCell: (r, c) => { this.selected = r * 9 + c; this.paint(); } });
		this.notesButton = h('button.btn.small', { type: 'button', 'aria-pressed': 'false', onclick: () => this.toggleNotes() }, '✎ Notes');
		this.keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('button.btn.sudoku-key', { type: 'button', onclick: () => this.enter(d) }, String(d)));
		const pad = h('div.sudoku-pad', this.keys);
		this.column.append(pad, h('div.game-toolbar',
			this.notesButton,
			h('button.btn.small', { type: 'button', onclick: () => this.enter(0) }, '⌫ Erase'),
			h('button.btn.small', { type: 'button', onclick: () => this.hint() }, '💡 Hint'),
		));
		this.grid.observer.disconnect();
		this.grid.observer = new ResizeObserver(() => this.grid.fit(130));
		this.grid.observer.observe(this.column);
		this.grid.fit(130);
	}

	toggleNotes() {
		this.notesMode = !this.notesMode;
		this.notesButton.setAttribute('aria-pressed', String(this.notesMode));
	}

	enter(d) {
		if (!this.running || this.paused) return;
		const i = this.selected;
		if (i < 0 || this.puzzle[i]) return;
		if (this.notesMode && d) {
			if (this.values[i]) return;
			this.notes[i] ^= 1 << d;
			this.ctx.audio.play('click');
		} else {
			this.values[i] = d;
			this.notes[i] = 0;
			if (d && d !== this.solution[i]) {
				this.mistakes++;
				this.ctx.audio.play('error');
				this.wrongAt = i;
			} else if (d) {
				this.ctx.audio.play('place');
				this.clearNotes(i, d);
				this.placedAt = i;
			}
		}
		const wrong = this.wrongAt === i, placed = this.placedAt === i;
		this.paint();
		if (wrong) this.ctx.fx.nope(this.grid.cells[i]);
		else if (placed) this.celebrateUnits(i);
		this.ctx.saveProgress(this.serialize());
		this.checkWin();
	}

	clearNotes(i, d) {
		const r = Math.floor(i / 9), c = i % 9, b = box(i);
		for (let k = 0; k < 81; k++) {
			if (Math.floor(k / 9) === r || k % 9 === c || box(k) === b) this.notes[k] &= ~(1 << d);
		}
	}

	hint() {
		if (!this.running) return;
		let i = this.selected;
		if (i < 0 || this.puzzle[i] || this.values[i] === this.solution[i]) {
			i = this.values.findIndex((v, k) => v !== this.solution[k]);
		}
		if (i < 0) return;
		this.selected = i;
		this.values[i] = this.solution[i];
		this.notes[i] = 0;
		this.clearNotes(i, this.solution[i]);
		this.clock.elapsed += 30; // hints cost 30 seconds
		this.ctx.audio.play('sparkle');
		this.placedAt = i;
		this.paint();
		this.grid.cells[i].classList.add('hinted');
		this.ctx.fx.burst(this.grid.cells[i], { count: 14, colors: ['#fde047', '#ffffff'], speed: 120, life: 0.6, shape: 'star', size: 4 });
		this.celebrateUnits(i);
		this.ctx.saveProgress(this.serialize());
		this.checkWin();
	}

	/** A finished row, column or box ripples with light. */
	celebrateUnits(i) {
		const r = Math.floor(i / 9), c = i % 9, b = box(i);
		const units = [
			[...Array(9).keys()].map((k) => r * 9 + k),
			[...Array(9).keys()].map((k) => k * 9 + c),
			[...Array(81).keys()].filter((k) => box(k) === b),
		].filter((unit) => unit.every((k) => this.values[k] === this.solution[k]));
		if (!units.length) return;
		this.ctx.audio.play('pickup');
		for (const unit of units) {
			unit.forEach((k, n) => {
				const el = this.grid.cells[k];
				el.style.setProperty('--d', `${n * 35}ms`);
				el.classList.remove('wave');
				void el.offsetWidth;
				el.classList.add('wave');
			});
			const mid = this.grid.cells[unit[4]];
			this.ctx.fx.burst(mid, { count: 12, colors: ['#93c5fd', '#ffffff', '#fde047'], speed: 140, life: 0.6, shape: 'star', size: 3.5 });
		}
	}

	checkWin() {
		if (this.values.every((v, i) => v === this.solution[i])) {
			this.clock.stop();
			const t = Math.round(this.clock.time);
			this.finish({ win: true, title: 'Solved!', message: `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} with ${this.mistakes} ${this.mistakes === 1 ? 'mistake' : 'mistakes'}.`, score: t });
		}
	}

	handleInput({ type, action, event }) {
		if (type !== 'down' || !event) return;
		const d = Number(event.key);
		if (d >= 1 && d <= 9) return this.enter(d);
		if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') return this.enter(0);
		if (event.key === 'n' || event.key === 'N') return this.toggleNotes();
		const moves = { up: -9, down: 9, left: -1, right: 1 };
		if (moves[action] !== undefined) {
			const next = this.selected + moves[action];
			if (next >= 0 && next < 81 && !(action === 'left' && this.selected % 9 === 0) && !(action === 'right' && this.selected % 9 === 8)) {
				this.selected = next;
				this.paint();
			}
		}
	}

	paint() {
		const sel = this.selected;
		const selValue = sel >= 0 ? this.values[sel] : 0;
		const sr = Math.floor(sel / 9), sc = sel % 9, sb = box(sel);
		this.grid.cells.forEach((el, i) => {
			const v = this.values[i];
			const r = Math.floor(i / 9), c = i % 9;
			el.className = 'grid-cell sudoku-cell';
			if (c % 3 === 2 && c < 8) el.classList.add('br');
			if (r % 3 === 2 && r < 8) el.classList.add('bb');
			if (this.puzzle[i]) el.classList.add('given');
			if (sel >= 0 && (r === sr || c === sc || box(i) === sb)) el.classList.add('peer');
			if (selValue && v === selValue) el.classList.add('same');
			if (i === sel) el.classList.add('sel');
			if (v && v !== this.solution[i]) el.classList.add('wrong');
			if (v) {
				el.textContent = v;
				if (i === this.placedAt) el.classList.add('placed');
			} else if (this.notes[i]) {
				el.replaceChildren(h('div.sudoku-notes', [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => h('span', this.notes[i] & (1 << d) ? String(d) : ''))));
			} else {
				el.textContent = '';
			}
		});
		this.placedAt = this.wrongAt = -1;
		// a digit placed nine times is done: its key fades
		const counts = new Array(10).fill(0);
		this.values.forEach((v, k) => { if (v && v === this.solution[k]) counts[v]++; });
		this.keys?.forEach((key, n) => key.classList.toggle('done', counts[n + 1] === 9));
	}

	pause() { super.pause(); this.clock.stop(); }
	resume() { super.resume(); this.clock.start(); }

	dispose() {
		this.clock.stop();
		this.grid?.dispose();
		this.column.remove();
		this.style.remove();
	}
}

const SUDOKU_CSS = `
.sudoku-board { border: 2px solid var(--color-primary); border-radius: 10px; overflow: hidden; background: var(--color-surface-2); box-shadow: 0 20px 50px -20px var(--color-shadow); }
.sudoku-cell { border-radius: 0; background: var(--color-surface); border-right: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); font-weight: 600; color: var(--color-primary); font-size: calc(var(--cell) * 0.52); transition: background 0.15s; }
.sudoku-cell.br { border-right: 2px solid var(--color-primary); }
.sudoku-cell.bb { border-bottom: 2px solid var(--color-primary); }
.sudoku-cell.given { color: var(--color-text); font-weight: 800; }
.sudoku-cell.peer { background: color-mix(in srgb, var(--color-primary) 7%, var(--color-surface)); }
.sudoku-cell.same { background: color-mix(in srgb, var(--color-primary) 22%, var(--color-surface)); }
.sudoku-cell.sel { background: color-mix(in srgb, var(--color-primary) 40%, var(--color-surface)); box-shadow: inset 0 0 0 2px var(--color-primary); }
.sudoku-cell.wrong { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 14%, var(--color-surface)); }
.sudoku-cell.placed { animation: sudoku-place 0.3s cubic-bezier(.34,1.56,.64,1); }
@keyframes sudoku-place { from { transform: scale(0.3); } }
.sudoku-cell.hinted { color: var(--color-warning); text-shadow: 0 0 12px var(--color-warning); }
.sudoku-cell.wave { animation: sudoku-wave 0.6s ease-out backwards; animation-delay: var(--d, 0ms); }
@keyframes sudoku-wave { 30% { background: color-mix(in srgb, var(--color-success) 45%, var(--color-surface)); transform: scale(1.08); } }
.sudoku-notes { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%; padding: 2px; font-size: calc(var(--cell) * 0.22); color: var(--color-text-muted); font-weight: 700; line-height: 1; }
.sudoku-notes span { display: grid; place-items: center; }
.sudoku-pad { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; width: min(100%, calc(var(--cell, 40px) * 9 + 10px)); max-width: 520px; }
.sudoku-key { min-height: 44px; padding: 0; font-size: 1.15rem; }
.sudoku-key.done { opacity: 0.35; }
`;
