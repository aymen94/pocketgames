// Five in a Row: place stones on a 15×15 grid, taking turns with the computer. The first
// to line up five (across, down or diagonally) wins. The computer weighs every empty
// point by the lines it would make for itself and the lines it would block.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, text, colors } from '../core/canvas.js';
import { think } from '../core/ai.js';

const N = 15, CELL = 38, PAD = 30, W = N * CELL + PAD * 2 - CELL, H = W + 40;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Length of the line through (r, c) for `who` in direction (dr, dc), with how many ends are open. */
function line(board, r, c, dr, dc, who) {
	let count = 1, open = 0;
	for (const s of [1, -1]) {
		let rr = r + dr * s, cc = c + dc * s;
		while (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === who) { count++; rr += dr * s; cc += dc * s; }
		if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc] === 0) open++;
	}
	return { count, open };
}

function value(count, open) {
	if (count >= 5) return 1e6;
	if (!open) return 0;
	return [0, 1, 12, 160, 3000][count] * (open === 2 ? 4 : 1);
}

export function bestPoint(board, me, noise = 0) {
	let best = -1, bestScore = -Infinity;
	const empty = board.every((x) => !x);
	if (empty) return Math.floor(N / 2) * N + Math.floor(N / 2);
	for (let i = 0; i < N * N; i++) {
		if (board[i]) continue;
		const r = Math.floor(i / N), c = i % N;
		// only consider points next to a stone
		let near = false;
		for (let dr = -2; dr <= 2 && !near; dr++) for (let dc = -2; dc <= 2; dc++) {
			const rr = r + dr, cc = c + dc;
			if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr * N + cc]) { near = true; break; }
		}
		if (!near) continue;
		let attack = 0, defend = 0;
		board[i] = me;
		for (const [dr, dc] of DIRS) { const l = line(board, r, c, dr, dc, me); attack += value(l.count, l.open); }
		board[i] = 3 - me;
		for (const [dr, dc] of DIRS) { const l = line(board, r, c, dr, dc, 3 - me); defend += value(l.count, l.open); }
		board[i] = 0;
		const score = attack * 1.1 + defend + Math.random() * noise;
		if (score > bestScore) { bestScore = score; best = i; }
	}
	return best;
}

export default class FiveInARow extends CanvasGame {
	static W = W;
	static H = H;

	setup() { this.wins = 0; }

	reset() {
		super.reset();
		this.cancel?.();
		this.board = new Uint8Array(N * N);
		this.turn = 1;
		this.lastMove = -1;
		this.winLine = null;
		this.hover = -1;
		this.moves = 0;
		this.ctx.score(this.wins);
		this.ctx.info('You play black and move first');
	}

	at(p) {
		const c = Math.round((p.x - PAD) / CELL), r = Math.round((p.y - PAD) / CELL);
		return r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
	}

	pointerMove(p) { const i = this.at(p); this.hover = this.turn === 1 && i >= 0 && !this.board[i] ? i : -1; }

	pointerDown(p) {
		if (!this.running || this.turn !== 1) return;
		const i = this.at(p);
		if (i < 0 || this.board[i]) return;
		this.place(i, 1);
	}

	place(i, who) {
		this.board[i] = who;
		this.lastMove = i;
		this.moves++;
		this.hover = -1;
		this.ctx.audio.play('place');
		const r = Math.floor(i / N), c = i % N;
		for (const [dr, dc] of DIRS) {
			if (line(this.board, r, c, dr, dc, who).count >= 5) {
				// find the ends for the highlight
				let a = [r, c], b = [r, c];
				while (a[0] - dr >= 0 && a[0] - dr < N && a[1] - dc >= 0 && a[1] - dc < N && this.board[(a[0] - dr) * N + a[1] - dc] === who) a = [a[0] - dr, a[1] - dc];
				while (b[0] + dr >= 0 && b[0] + dr < N && b[1] + dc >= 0 && b[1] + dc < N && this.board[(b[0] + dr) * N + b[1] + dc] === who) b = [b[0] + dr, b[1] + dc];
				this.winLine = [a, b];
				return this.end(who);
			}
		}
		if (this.moves >= N * N) return this.end(0);
		this.turn = 3 - who;
		this.ctx.info(this.turn === 1 ? 'Your turn' : 'Computer is thinking…');
		if (this.turn === 2) {
			this.cancel = think(() => {
				if (!this.running) return;
				const noise = { easy: 4000, normal: 60, hard: 0 }[this.ctx.settings.difficulty ?? 'normal'] ?? 60;
				this.place(bestPoint(this.board, 2, noise), 2);
				this.wake();
			}, 400);
		}
	}

	end(who) {
		this.turn = 0;
		if (who === 1) { this.wins++; this.ctx.score(this.wins); this.ctx.fx.confetti({ count: 70 }); }
		this.ctx.audio.play(who === 1 ? 'win' : 'lose');
		setTimeout(() => this.finish({ win: who === 1, title: who === 1 ? 'Five in a row!' : who === 2 ? 'The computer wins' : 'Board full: a draw', message: `${Math.ceil(this.moves / 2)} moves. Wins this session: ${this.wins}.`, score: this.wins }), 900);
	}

	draw(g) {
		g.fillStyle = '#e7c48a';
		g.fillRect(0, 0, W, H);
		g.strokeStyle = '#7c5a2e';
		g.lineWidth = 1;
		for (let k = 0; k < N; k++) {
			g.beginPath(); g.moveTo(PAD, PAD + k * CELL); g.lineTo(PAD + (N - 1) * CELL, PAD + k * CELL); g.stroke();
			g.beginPath(); g.moveTo(PAD + k * CELL, PAD); g.lineTo(PAD + k * CELL, PAD + (N - 1) * CELL); g.stroke();
		}
		for (const [r, c] of [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]]) circle(g, PAD + c * CELL, PAD + r * CELL, 4, '#7c5a2e');
		for (let i = 0; i < N * N; i++) {
			const who = this.board[i];
			if (!who && i !== this.hover) continue;
			const x = PAD + (i % N) * CELL, y = PAD + Math.floor(i / N) * CELL;
			if (!who) { g.globalAlpha = 0.35; circle(g, x, y, CELL * 0.42, '#111'); g.globalAlpha = 1; continue; }
			const grad = g.createRadialGradient(x - 5, y - 5, 2, x, y, CELL * 0.45);
			grad.addColorStop(0, who === 1 ? '#555' : '#fff');
			grad.addColorStop(1, who === 1 ? '#0a0a0a' : '#cbd5e1');
			g.fillStyle = grad;
			g.beginPath(); g.arc(x, y, CELL * 0.44, 0, Math.PI * 2); g.fill();
			if (i === this.lastMove) circle(g, x, y, 4, colors.accent);
		}
		if (this.winLine) {
			const [[r1, c1], [r2, c2]] = this.winLine;
			g.strokeStyle = colors.accent;
			g.lineWidth = 6;
			g.lineCap = 'round';
			g.beginPath(); g.moveTo(PAD + c1 * CELL, PAD + r1 * CELL); g.lineTo(PAD + c2 * CELL, PAD + r2 * CELL); g.stroke();
		}
		text(g, this.turn === 1 ? 'Your turn (black)' : this.turn === 2 ? 'Computer (white)…' : '', W / 2, H - 20, { size: 16, color: '#3f2a14' });
	}

	teardown() { this.cancel?.(); }
}
