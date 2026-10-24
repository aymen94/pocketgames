// Tic-Tac-Toe. Against the computer, rounds keep coming until you lose; the score is
// how many rounds you won. Hard mode plays perfectly (full negamax search).

import { Game } from '../core/game.js';
import { Grid } from '../core/grid.js';
import { negamax, think } from '../core/ai.js';
import { h } from '../../components/dom.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

function winner(b) {
	for (const line of LINES) {
		const [a, c, d] = line;
		if (b[a] && b[a] === b[c] && b[a] === b[d]) return { side: b[a], line };
	}
	return null;
}

const SEARCH = {
	moves: (s) => s.board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0),
	apply: (s, i) => { const board = s.board.slice(); board[i] = s.turn; return { board, turn: s.turn === 'X' ? 'O' : 'X' }; },
	terminal: (s) => Boolean(winner(s.board)) || s.board.every(Boolean),
	// the side to move has lost if the previous move made a line
	evaluate: (s, depth) => (winner(s.board) ? -10 - depth : 0),
};

export default class TicTacToe extends Game {
	async init() {
		this.column = h('div.game-column');
		this.message = h('p.game-message');
		this.style = h('style', TTT_CSS);
		this.ctx.root.append(this.style, this.column);
		this.grid = new Grid(this.column, 3, 3, { className: 'ttt-board', gap: 10, onCell: (r, c) => this.click(r * 3 + c) });
		this.column.appendChild(this.message);
		this.reset();
	}

	get vsCpu() { return this.ctx.settings.mode !== 'local'; }

	reset() {
		this.running = false;
		this.cancel?.();
		this.wins = 0;
		this.draws = 0;
		this.starter = 'X';
		this.ctx.score(0);
		this.newRound();
	}

	newRound() {
		this.board = new Array(9).fill('');
		this.turn = this.starter;
		this.locked = false;
		this.paint();
		this.status();
		if (this.running && this.vsCpu && this.turn === 'O') this.cpu();
	}

	start() {
		super.start();
		if (this.vsCpu && this.turn === 'O') this.cpu();
	}

	status(text) {
		const tally = this.vsCpu ? ` · Wins ${this.wins} · Draws ${this.draws}` : '';
		this.message.textContent = text ?? (this.vsCpu ? (this.turn === 'X' ? 'Your turn (X)' : 'Computer is thinking…') : `${this.turn} to play`);
		this.ctx.info(`${this.vsCpu ? 'vs Computer' : 'Two players'}${tally}`);
	}

	handleInput({ type, event }) {
		const n = Number(event?.key);
		if (type === 'down' && n >= 1 && n <= 9) this.click(n - 1);
	}

	click(i) {
		if (!this.running || this.locked || this.board[i]) return;
		if (this.vsCpu && this.turn !== 'X') return;
		this.place(i);
	}

	place(i) {
		this.board[i] = this.turn;
		this.fresh = i;
		this.ctx.audio.play('place');
		this.turn = this.turn === 'X' ? 'O' : 'X';
		this.paint();
		if (this.roundOver()) return;
		this.status();
		if (this.vsCpu && this.turn === 'O') this.cpu();
	}

	cpu() {
		this.locked = true;
		this.cancel = think(() => {
			if (!this.running) return;
			const level = this.ctx.settings.difficulty;
			const free = SEARCH.moves({ board: this.board });
			let move;
			const random = level === 'easy' ? 0.55 : level === 'normal' ? 0.2 : 0;
			if (Math.random() < random) move = free[Math.floor(Math.random() * free.length)];
			else move = negamax({ board: this.board, turn: 'O' }, level === 'normal' ? 3 : 9, SEARCH).move;
			this.locked = false;
			this.place(move);
		}, 420);
	}

	roundOver() {
		const win = winner(this.board);
		const full = this.board.every(Boolean);
		if (!win && !full) return false;
		this.locked = true;
		if (win) win.line.forEach((i, k) => {
			const el = this.grid.cells[i];
			el.style.setProperty('--d', `${k * 120}ms`);
			el.classList.add('win');
			setTimeout(() => this.ctx.fx.burst(el, { count: 12, colors: [win.side === 'X' ? '#60a5fa' : '#fbbf24', '#ffffff'], speed: 160, life: 0.6, shape: 'star', size: 4 }), k * 120);
		});
		this.starter = this.starter === 'X' ? 'O' : 'X';
		if (!this.vsCpu) {
			this.ctx.audio.play(win ? 'win' : 'blip');
			setTimeout(() => this.finish({ win: null, title: win ? `${win.side} wins!` : 'Draw', message: win ? 'Three in a row.' : 'The board is full.' }), 700);
			return true;
		}
		if (win?.side === 'O') {
			this.status('The computer wins this round.');
			setTimeout(() => this.finish({ win: false, title: 'Round lost', message: `You won ${this.wins} ${this.wins === 1 ? 'round' : 'rounds'} (and drew ${this.draws}) before losing.`, score: this.wins }), 800);
			return true;
		}
		if (win) { this.wins++; this.ctx.score(this.wins); this.ctx.audio.play('win'); this.status('You win this round!'); this.ctx.fx.banner('Round won!'); }
		else { this.draws++; this.ctx.audio.play('blip'); this.status('Draw. Next round…'); }
		this.cancel = think(() => this.newRound(), 1300);
		return true;
	}

	paint() {
		this.grid.cells.forEach((el, i) => {
			el.className = `grid-cell ttt-cell${this.board[i] ? ` ${this.board[i].toLowerCase()}` : ''}`;
			// marks are drawn as strokes; only the newest one animates in
			const mark = this.board[i];
			el.innerHTML = mark === 'X'
				? '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24 24 L76 76 M76 24 L24 76"/></svg>'
				: mark === 'O' ? '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="28"/></svg>' : '';
			el.setAttribute('aria-label', mark ? `${mark} in square ${i + 1}` : `Empty square ${i + 1}`);
			if (mark && i === this.fresh) el.classList.add('fresh');
		});
	}

	dispose() {
		this.cancel?.();
		this.grid.dispose();
		this.column.remove();
		this.style.remove();
	}
}

const TTT_CSS = `
.ttt-board .ttt-cell { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: 18px; box-shadow: inset 0 -4px 0 rgba(0,0,0,0.2); }
.ttt-cell:hover:empty { background: var(--color-surface-hover); transform: translateY(-2px); }
.ttt-cell svg { width: 72%; height: 72%; fill: none; stroke-width: 11; stroke-linecap: round; }
.ttt-cell.x svg { stroke: #60a5fa; filter: drop-shadow(0 0 6px #60a5fa88); }
.ttt-cell.o svg { stroke: #fbbf24; filter: drop-shadow(0 0 6px #fbbf2488); }
.ttt-cell.fresh svg path, .ttt-cell.fresh svg circle { stroke-dasharray: 180; animation: ttt-draw 0.35s ease-out backwards; }
@keyframes ttt-draw { from { stroke-dashoffset: 180; } }
.ttt-cell.win { background: color-mix(in srgb, var(--color-success) 55%, var(--color-surface-2)); animation: ttt-win 0.5s cubic-bezier(.34,1.56,.64,1) backwards; animation-delay: var(--d, 0ms); }
@keyframes ttt-win { 50% { transform: scale(1.12); } }
`;
