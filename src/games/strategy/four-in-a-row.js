// Four in a Row on a 7 × 6 grid. Discs fall with gravity; the computer searches with
// negamax and a window-based evaluation.

import { Game } from '../core/game.js';
import { Surface, circle, fillRound, colors } from '../core/canvas.js';
import { negamax, think } from '../core/ai.js';
import { CanvasFx, ease } from '../core/fx.js';

const COLS = 7, ROWS = 6, S = 80, W = COLS * S, H = ROWS * S + S;
const DEPTH = { easy: 2, normal: 4, hard: 6 };
const COLORS = { 1: '#facc15', 2: '#ef4444' };

function drop(board, col) {
	for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
	return -1;
}

function lineAt(board) {
	const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
	for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
		const p = board[r * COLS + c];
		if (!p) continue;
		for (const [dr, dc] of dirs) {
			const cells = [];
			for (let k = 0; k < 4; k++) {
				const nr = r + dr * k, nc = c + dc * k;
				if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr * COLS + nc] !== p) break;
				cells.push(nr * COLS + nc);
			}
			if (cells.length === 4) return { side: p, cells };
		}
	}
	return null;
}

function scoreWindow(window, side) {
	const mine = window.filter((v) => v === side).length;
	const theirs = window.filter((v) => v && v !== side).length;
	if (mine && theirs) return 0;
	if (mine === 3) return 50;
	if (mine === 2) return 10;
	if (theirs === 3) return -60;
	if (theirs === 2) return -10;
	return 0;
}

const SEARCH = {
	moves: (s) => [3, 2, 4, 1, 5, 0, 6].filter((c) => drop(s.board, c) >= 0),
	order: (_s, moves) => moves,
	apply: (s, col) => {
		const board = s.board.slice();
		board[drop(board, col) * COLS + col] = s.turn;
		return { board, turn: 3 - s.turn };
	},
	terminal: (s) => Boolean(lineAt(s.board)) || s.board.every(Boolean),
	evaluate: (s, depth) => {
		if (lineAt(s.board)) return -100000 - depth; // the previous player just won
		const side = s.turn;
		let score = 0;
		for (let r = 0; r < ROWS; r++) if (s.board[r * COLS + 3] === side) score += 6;
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
				const er = r + dr * 3, ec = c + dc * 3;
				if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
				const w = [0, 1, 2, 3].map((k) => s.board[(r + dr * k) * COLS + c + dc * k]);
				score += scoreWindow(w, side);
			}
		}
		return score;
	},
};

export default class FourInARow extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(300);
		this.time = 0;
		this.bounces = new Map();
		const canvas = this.surface.canvas;
		this.ctx.input.on(canvas, 'pointermove', (e) => { this.hover = Math.floor(this.surface.local(e).x / S); });
		this.ctx.input.on(canvas, 'pointerleave', () => { this.hover = -1; });
		this.ctx.input.on(canvas, 'click', (e) => this.choose(Math.floor(this.surface.local(e).x / S)));
		this.reset();
	}

	get vsCpu() { return this.ctx.settings.mode !== 'local'; }

	reset() {
		this.running = false;
		this.cancel?.();
		this.board = new Array(COLS * ROWS).fill(0);
		this.turn = 1;
		this.hover = 3;
		this.falling = null;
		this.win = null;
		this.fx?.clear();
		this.bounces?.clear();
		this.done = false;
		this.status();
	}

	status() {
		this.ctx.info(this.vsCpu ? (this.turn === 1 ? 'Your move (yellow)' : 'Computer is thinking…') : `${this.turn === 1 ? 'Yellow' : 'Red'} to move`);
	}

	handleInput({ type, action, event }) {
		if (type !== 'down') return;
		const n = Number(event?.key);
		if (n >= 1 && n <= 7) return this.choose(n - 1);
		if (action === 'left') this.hover = Math.max(0, this.hover - 1);
		if (action === 'right') this.hover = Math.min(COLS - 1, this.hover + 1);
		if (action === 'action' || action === 'down') this.choose(this.hover);
	}

	choose(col) {
		if (!this.running || this.done || this.falling) return;
		if (this.vsCpu && this.turn !== 1) return;
		this.play(col);
	}

	play(col) {
		const row = drop(this.board, col);
		if (row < 0) return this.ctx.audio.play('error');
		this.falling = { col, row, y: S / 2, v: 0, side: this.turn };
	}

	land() {
		const { col, row, side } = this.falling;
		this.board[row * COLS + col] = side;
		this.falling = null;
		this.ctx.audio.play('thud');
		// the disc squashes on landing and kicks up a little dust
		this.bounces.set(row * COLS + col, 1);
		const x = col * S + S / 2, y = S + row * S + S / 2;
		this.fx.particles.burst(x, y + S * 0.35, { count: 10, colors: [COLORS[side], '#ffffff'], speed: 120, angle: -Math.PI / 2, spread: 2.6, life: 0.4, shape: 'dust', size: 3 });
		this.fx.shake.kick(2);
		this.turn = 3 - side;
		const win = lineAt(this.board);
		if (win) {
			for (const i of win.cells) {
				const cx = (i % COLS) * S + S / 2, cy = S + Math.floor(i / COLS) * S + S / 2;
				this.fx.particles.burst(cx, cy, { count: 14, colors: [COLORS[win.side], '#ffffff'], speed: 180, life: 0.8, shape: 'star', size: 5, gravity: 120 });
			}
			this.fx.shake.kick(6);
		}
		if (win || this.board.every(Boolean)) {
			this.done = true;
			this.win = win;
			let result;
			if (!win) result = { win: null, title: 'Draw', message: 'The grid is full.' };
			else if (this.vsCpu) result = win.side === 1 ? { win: true, title: 'Four in a row!', message: 'You beat the computer.' } : { win: false, title: 'The computer wins', message: 'It connected four first.' };
			else result = { win: null, title: `${win.side === 1 ? 'Yellow' : 'Red'} wins!`, message: 'Four in a row.' };
			setTimeout(() => this.finish(result), 900);
			return;
		}
		this.status();
		if (this.vsCpu && this.turn === 2) {
			this.cancel = think(() => {
				if (!this.running) return;
				const level = this.ctx.settings.difficulty;
				let { move } = negamax({ board: this.board, turn: 2 }, DEPTH[level] ?? 4, SEARCH);
				if (level === 'easy' && Math.random() < 0.25) {
					const free = SEARCH.moves({ board: this.board });
					move = free[Math.floor(Math.random() * free.length)];
				}
				this.play(move);
			}, 250);
		}
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		for (const [k, t] of this.bounces) { if (t - dt * 4 <= 0) this.bounces.delete(k); else this.bounces.set(k, t - dt * 4); }
		const f = this.falling;
		if (!f) return;
		f.v += 2600 * dt;
		f.y += f.v * dt;
		const target = S + f.row * S + S / 2;
		if (f.y >= target) this.land();
	}

	render() {
		const g = this.surface.g;
		this.surface.clear(colors.bg);
		this.fx.shake.apply(g);
		if (this.running && !this.done && (!this.vsCpu || this.turn === 1) && this.hover >= 0 && !this.falling) {
			// the waiting disc bobs over the column, which glows faintly
			g.fillStyle = 'rgba(255,255,255,0.05)';
			g.fillRect(this.hover * S, S, S, ROWS * S);
			circle(g, this.hover * S + S / 2, S / 2 + Math.sin(this.time * 5) * 4, S * 0.38, COLORS[this.turn]);
		}
		if (this.falling) circle(g, this.falling.col * S + S / 2, this.falling.y, S * 0.38, COLORS[this.falling.side]);
		fillRound(g, 0, S, W, ROWS * S, 16, '#1d4ed8');
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			const v = this.board[r * COLS + c];
			const x = c * S + S / 2, y = S + r * S + S / 2;
			const b = this.bounces.get(r * COLS + c) ?? 0;
			if (v && b) {
				// squash and stretch while settling
				g.save();
				g.translate(x, y + b * 4);
				g.scale(1 + b * 0.18, 1 - b * 0.18);
				circle(g, 0, 0, S * 0.38, COLORS[v]);
				g.restore();
			} else circle(g, x, y, S * 0.38, v ? COLORS[v] : colors.bg);
			if (v) circle(g, x - 6, y - 6, S * 0.12, 'rgba(255,255,255,0.25)');
			if (this.win?.cells.includes(r * COLS + c)) {
				const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
				g.strokeStyle = '#fff';
				g.lineWidth = 4 + pulse * 3;
				g.shadowColor = '#ffffff';
				g.shadowBlur = 10 + pulse * 14;
				g.beginPath(); g.arc(x, y, S * 0.3, 0, Math.PI * 2); g.stroke();
				g.shadowBlur = 0;
			}
		}
		this.fx.draw(g);
		g.restore();
	}

	dispose() {
		this.cancel?.();
		this.surface.dispose();
	}
}
