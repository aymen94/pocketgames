// Minefield: reveal the safe cells using the neighbour counts. The first reveal is
// always safe (mines are laid afterwards, away from it).

import { Game } from '../core/game.js';
import { Grid, neighbours } from '../core/grid.js';
import { PuzzleClock, formatTime } from '../core/timer.js';
import { h } from '../../components/dom.js';

const LEVELS = { easy: [9, 9, 10], medium: [12, 12, 24], hard: [16, 16, 40] };
const NUMBER_COLORS = ['', '#60a5fa', '#34d399', '#fb7185', '#a78bfa', '#fbbf24', '#22d3ee', '#f472b6', '#e2e8f0'];

export default class Minefield extends Game {
	async init() {
		this.column = h('div.game-column');
		this.ctx.root.appendChild(this.column);
		this.style = h('style', MINE_CSS);
		this.ctx.root.appendChild(this.style);
		this.clock = new PuzzleClock((t) => this.ctx.info(`${t} · ${this.flagsLeft()} flags`));
		this.reset();
	}

	reset() {
		this.running = false;
		this.clock.reset();
		for (const t of this.timers ?? []) clearTimeout(t);
		this.timers = [];
		this.exploded = -1;
		const [rows, cols, mines] = LEVELS[this.ctx.settings.level] ?? LEVELS.easy;
		Object.assign(this, { rows, cols, mines });
		this.cells = Array.from({ length: rows * cols }, () => ({ mine: false, open: false, flag: false, count: 0 }));
		this.laid = false;
		this.flagMode = false;
		this.grid?.dispose();
		this.column.replaceChildren();
		this.flagButton = h('button.btn.small', { type: 'button', 'aria-pressed': 'false', onclick: () => this.toggleFlagMode() }, '⚑ Flag mode');
		this.column.appendChild(h('div.game-toolbar', this.flagButton));
		this.grid = new Grid(this.column, rows, cols, {
			className: 'mine-board',
			gap: 2,
			onCell: (r, c) => {
				if (this.suppressClick) { this.suppressClick = false; return; }
				if (this.flagMode) this.flag(r, c); else this.reveal(r, c);
			},
			onContext: (r, c) => this.flag(r, c),
		});
		this.grid.fit(50);
		this.grid.observer.disconnect();
		this.grid.observer = new ResizeObserver(() => this.grid.fit(50));
		this.grid.observer.observe(this.column);
		this.longPress();
		this.ctx.info(`0:00 · ${mines} flags`);
		this.paint();
	}

	longPress() {
		let timer = 0;
		this.grid.el.addEventListener('pointerdown', (e) => {
			if (e.pointerType === 'mouse') return;
			const cell = e.target.closest('.grid-cell');
			if (!cell) return;
			timer = setTimeout(() => {
				this.suppressClick = true;
				this.flag(+cell.dataset.r, +cell.dataset.c);
				navigator.vibrate?.(20);
			}, 380);
		});
		const cancel = () => clearTimeout(timer);
		this.grid.el.addEventListener('pointerup', cancel);
		this.grid.el.addEventListener('pointerleave', cancel);
		this.grid.el.addEventListener('pointercancel', cancel);
	}

	toggleFlagMode() {
		this.flagMode = !this.flagMode;
		this.flagButton.setAttribute('aria-pressed', String(this.flagMode));
	}

	flagsLeft() {
		return this.mines - this.cells.filter((c) => c.flag).length;
	}

	idx(r, c) { return r * this.cols + c; }

	lay(safeR, safeC) {
		const forbidden = new Set([this.idx(safeR, safeC), ...neighbours(safeR, safeC, this.rows, this.cols).map(([r, c]) => this.idx(r, c))]);
		let placed = 0;
		while (placed < this.mines) {
			const i = Math.floor(Math.random() * this.cells.length);
			if (forbidden.has(i) || this.cells[i].mine) continue;
			this.cells[i].mine = true;
			placed++;
		}
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			this.cells[this.idx(r, c)].count = neighbours(r, c, this.rows, this.cols).filter(([nr, nc]) => this.cells[this.idx(nr, nc)].mine).length;
		}
		this.laid = true;
		this.clock.start();
	}

	reveal(r, c) {
		if (!this.running || this.paused) return;
		const cell = this.cells[this.idx(r, c)];
		if (cell.flag) return;
		if (!this.laid) this.lay(r, c);
		if (cell.open) return this.chord(r, c);
		if (cell.mine) return this.boom(r, c);
		this.flood(r, c);
		this.ctx.audio.play('flip');
		this.paint();
		this.checkWin();
	}

	/** Clicking an open number whose flags are all placed opens its other neighbours. */
	chord(r, c) {
		const cell = this.cells[this.idx(r, c)];
		const around = neighbours(r, c, this.rows, this.cols);
		const flags = around.filter(([nr, nc]) => this.cells[this.idx(nr, nc)].flag).length;
		if (cell.count === 0 || flags !== cell.count) return;
		for (const [nr, nc] of around) {
			const n = this.cells[this.idx(nr, nc)];
			if (n.flag || n.open) continue;
			if (n.mine) return this.boom(nr, nc);
			this.flood(nr, nc);
		}
		this.ctx.audio.play('flip');
		this.paint();
		this.checkWin();
	}

	/** Opens from (r, c) outward, breadth first, remembering each cell's ring for the reveal wave. */
	flood(r, c) {
		const queue = [[r, c, 0]];
		this.fresh ??= new Map();
		while (queue.length) {
			const [cr, cc, d] = queue.shift();
			const i = this.idx(cr, cc);
			const cell = this.cells[i];
			if (cell.open || cell.flag) continue;
			cell.open = true;
			this.fresh.set(i, d);
			if (cell.count === 0) for (const [nr, nc] of neighbours(cr, cc, this.rows, this.cols)) queue.push([nr, nc, d + 1]);
		}
	}

	flag(r, c) {
		if (!this.running || this.paused) return;
		const cell = this.cells[this.idx(r, c)];
		if (cell.open) return;
		cell.flag = !cell.flag;
		this.justFlagged = cell.flag ? this.idx(r, c) : -1;
		this.ctx.audio.play(cell.flag ? 'place' : 'blip');
		this.ctx.info(`${formatTime(this.clock.time)} · ${this.flagsLeft()} flags`);
		this.paint();
	}

	boom(r, c) {
		this.clock.stop();
		this.exploded = this.idx(r, c);
		this.ctx.audio.play('bomb');
		const fx = this.ctx.fx;
		const first = this.grid.cells[this.exploded];
		this.cells[this.exploded].open = true;
		this.paint();
		fx.burst(first, { count: 40, colors: ['#fb7185', '#fde047', '#ffffff'], speed: 320, life: 0.8, shape: 'spark', size: 4, glow: true });
		fx.ring(first, { color: '#fb7185', radius: 90 });
		fx.shake(10);
		fx.flash('#fb7185', 0.3);
		// the other mines go off one after another, nearest first
		const others = this.cells.map((cell, i) => ({ cell, i })).filter(({ cell, i }) => cell.mine && i !== this.exploded)
			.sort((a, b) => Math.hypot(Math.floor(a.i / this.cols) - r, (a.i % this.cols) - c) - Math.hypot(Math.floor(b.i / this.cols) - r, (b.i % this.cols) - c));
		others.forEach(({ cell, i }, k) => {
			this.timers.push(setTimeout(() => {
				cell.open = true;
				this.paint();
				const el = this.grid.cells[i];
				fx.burst(el, { count: 10, colors: ['#fb923c', '#fde047'], speed: 160, life: 0.5, shape: 'spark', size: 3, glow: true });
				if (k % 4 === 0) this.ctx.audio.play('hit');
			}, 120 + k * 70));
		});
		this.finish({ win: false, title: 'Boom!', message: 'You hit a mine. The first click is always safe: try again.', record: false });
	}

	checkWin() {
		if (this.cells.every((cell) => cell.mine || cell.open)) {
			this.clock.stop();
			for (const cell of this.cells) if (cell.mine) cell.flag = true;
			this.paint();
			const seconds = Math.round(this.clock.time);
			this.finish({ win: true, title: 'Field cleared!', message: `Cleared in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.`, score: seconds });
		}
	}

	paint() {
		this.cells.forEach((cell, i) => {
			const el = this.grid.cells[i];
			el.className = 'grid-cell mine-cell';
			el.textContent = '';
			el.style.color = '';
			if (cell.open) {
				el.classList.add('open');
				if (this.fresh?.has(i)) {
					el.style.setProperty('--d', `${Math.min(this.fresh.get(i), 14) * 28}ms`);
					el.classList.add('reveal');
				}
				if (cell.mine) { el.textContent = '✹'; el.classList.add(i === this.exploded ? 'boom' : 'mine'); }
				else if (cell.count) { el.textContent = cell.count; el.style.color = NUMBER_COLORS[cell.count]; }
			} else if (cell.flag) {
				el.textContent = '⚑';
				el.classList.add('flag');
				if (i === this.justFlagged) el.classList.add('planted');
			}
		});
		this.fresh?.clear();
		this.justFlagged = -1;
	}

	pause() { super.pause(); this.clock.stop(); }
	resume() { super.resume(); if (this.laid) this.clock.start(); }

	dispose() {
		for (const t of this.timers) clearTimeout(t);
		this.clock.stop();
		this.grid?.dispose();
		this.column.remove();
		this.style.remove();
	}
}

const MINE_CSS = `
.mine-cell { background: linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 30%, var(--color-surface-2)), var(--color-surface-2)); border-radius: 4px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.25); font-size: calc(var(--cell) * 0.55); }
.mine-cell:hover:not(.open) { background: color-mix(in srgb, var(--color-primary) 40%, var(--color-surface-2)); transform: translateY(-1px); }
.mine-cell.open { background: var(--color-surface); box-shadow: none; cursor: default; }
.mine-cell.reveal { animation: mine-reveal 0.32s cubic-bezier(.34,1.56,.64,1) backwards; animation-delay: var(--d, 0ms); }
@keyframes mine-reveal { from { transform: scale(0.4) rotate(-8deg); opacity: 0; } }
.mine-cell.planted { animation: mine-flag 0.35s cubic-bezier(.34,1.56,.64,1); }
@keyframes mine-flag { from { transform: translateY(-40%) scale(1.4); opacity: 0; } }
.mine-cell.flag { color: #fb7185; }
.mine-cell.mine { color: #e2e8f0; }
.mine-cell.boom { background: #e11d48; color: #fff; }
`;
