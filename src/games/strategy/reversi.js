// Reversi: outflank to flip discs. Players with no legal move pass; the game ends when
// neither side can move. The computer weighs corners, edges and mobility.

import { Game } from '../core/game.js';
import { Surface, circle } from '../core/canvas.js';
import { negamax, think } from '../core/ai.js';
import { CanvasFx, Animator, ease } from '../core/fx.js';

const S = 64, SIZE = S * 8;
const DEPTH = { easy: 1, normal: 3, hard: 5 };
const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const WEIGHTS = [
	100, -20, 10, 5, 5, 10, -20, 100,
	-20, -50, -2, -2, -2, -2, -50, -20,
	10, -2, 1, 1, 1, 1, -2, 10,
	5, -2, 1, 0, 0, 1, -2, 5,
	5, -2, 1, 0, 0, 1, -2, 5,
	10, -2, 1, 1, 1, 1, -2, 10,
	-20, -50, -2, -2, -2, -2, -50, -20,
	100, -20, 10, 5, 5, 10, -20, 100,
];
// 1 = black (you, moves first), -1 = white

function flips(board, i, side) {
	if (board[i]) return [];
	const r = i >> 3, c = i & 7, out = [];
	for (const [dr, dc] of DIRS) {
		const line = [];
		let nr = r + dr, nc = c + dc;
		while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === -side) { line.push(nr * 8 + nc); nr += dr; nc += dc; }
		if (line.length && nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === side) out.push(...line);
	}
	return out;
}

const legal = (board, side) => board.map((_, i) => i).filter((i) => flips(board, i, side).length);
const count = (board, side) => board.filter((v) => v === side).length;

const SEARCH = {
	moves: (s) => {
		const list = legal(s.board, s.turn);
		return list.length || !legal(s.board, -s.turn).length ? list : ['pass'];
	},
	apply: (s, move) => {
		if (move === 'pass') return { board: s.board, turn: -s.turn };
		const board = s.board.slice();
		board[move] = s.turn;
		for (const f of flips(s.board, move, s.turn)) board[f] = s.turn;
		return { board, turn: -s.turn };
	},
	noMoves: (s) => (count(s.board, s.turn) - count(s.board, -s.turn)) * 1000,
	evaluate: (s) => {
		let score = 0;
		for (let i = 0; i < 64; i++) score += s.board[i] * WEIGHTS[i];
		score += (legal(s.board, 1).length - legal(s.board, -1).length) * 4;
		return score * s.turn;
	},
	order: (_s, moves) => moves.slice().sort((a, b) => (WEIGHTS[b] ?? 0) - (WEIGHTS[a] ?? 0)),
};

export default class Reversi extends Game {
	async init() {
		this.surface = new Surface(this.ctx.root, SIZE, SIZE);
		this.fx = new CanvasFx(200);
		this.flipping = new Map(); // square -> { t, from }
		this.animator = new Animator((dt) => {
			this.fx.update(dt);
			for (const [i, f] of this.flipping) { f.t += dt / 0.32; if (f.t >= 1) this.flipping.delete(i); }
			this.render();
		}, () => this.fx.busy || this.flipping.size > 0);
		this.ctx.input.on(this.surface.canvas, 'click', (e) => {
			const p = this.surface.local(e);
			this.click(Math.floor(p.y / S) * 8 + Math.floor(p.x / S));
		});
		this.reset();
	}

	get vsCpu() { return this.ctx.settings.mode !== 'local'; }

	reset() {
		this.running = false;
		this.cancel?.();
		this.board = new Array(64).fill(0);
		this.board[27] = this.board[36] = -1;
		this.board[28] = this.board[35] = 1;
		this.turn = 1;
		this.last = -1;
		this.flipping?.clear();
		this.fx?.clear();
		this.done = false;
		this.status();
		this.render();
	}

	status(note = '') {
		const b = count(this.board, 1), w = count(this.board, -1);
		const who = this.vsCpu ? (this.turn === 1 ? 'Your move' : 'Computer is thinking…') : `${this.turn === 1 ? 'Black' : 'White'} to move`;
		this.ctx.info(`${note}${who} · ● ${b}  ○ ${w}`);
		this.ctx.score(b);
	}

	click(i) {
		if (!this.running || this.done) return;
		if (this.vsCpu && this.turn !== 1) return;
		if (!flips(this.board, i, this.turn).length) { this.fx.shake.kick(3); this.animator.wake(); return this.ctx.audio.play('error'); }
		this.play(i);
	}

	play(i) {
		const flipped = flips(this.board, i, this.turn);
		// discs turn over in order of distance from the move
		for (const f of flipped) {
			const d = Math.max(Math.abs((f >> 3) - (i >> 3)), Math.abs((f & 7) - (i & 7)));
			this.flipping.set(f, { t: -d * 0.35, from: this.board[f] });
			this.board[f] = this.turn;
		}
		this.board[i] = this.turn;
		this.last = i;
		this.placedT = 0;
		this.ctx.audio.play('place');
		if (flipped.length) setTimeout(() => this.ctx.audio.play(flipped.length >= 4 ? 'pickup' : 'flip'), 120);
		const x = (i & 7) * S + S / 2, y = (i >> 3) * S + S / 2;
		this.fx.particles.ring(x, y, { color: this.turn === 1 ? '#111827' : '#ffffff', radius: S * 0.7, width: 4 });
		if (flipped.length >= 5) this.fx.popups.add(`+${flipped.length}`, x, y - 16, { color: '#fde047', size: 22 });
		this.animator.wake();
		this.turn = -this.turn;
		this.advance();
	}

	advance() {
		let note = '';
		if (!legal(this.board, this.turn).length) {
			if (!legal(this.board, -this.turn).length) return this.end();
			note = `${this.turn === 1 ? (this.vsCpu ? 'You pass' : 'Black passes') : (this.vsCpu ? 'Computer passes' : 'White passes')} · `;
			this.turn = -this.turn;
		}
		this.status(note);
		this.render();
		if (this.vsCpu && this.turn === -1) {
			this.cancel = think(() => {
				if (!this.running) return;
				const { move } = negamax({ board: this.board, turn: -1 }, DEPTH[this.ctx.settings.difficulty] ?? 3, SEARCH);
				if (move !== null && move !== 'pass') this.play(move);
			}, 400);
		}
	}

	end() {
		this.done = true;
		this.render();
		const b = count(this.board, 1), w = count(this.board, -1);
		this.status();
		let result;
		if (b === w) result = { win: null, title: 'Draw', message: `${b} discs each.` };
		else if (this.vsCpu) result = b > w ? { win: true, title: 'You win!', message: `${b} to ${w}.`, score: b } : { win: false, title: 'The computer wins', message: `${w} to ${b}.`, score: b, record: false };
		else result = { win: null, title: `${b > w ? 'Black' : 'White'} wins!`, message: `${Math.max(b, w)} to ${Math.min(b, w)}.` };
		setTimeout(() => this.finish(result), 700);
	}

	render() {
		const g = this.surface.g;
		this.fx.shake.apply(g);
		g.fillStyle = '#166534';
		g.fillRect(-6, -6, SIZE + 12, SIZE + 12);
		g.strokeStyle = '#0f3d22';
		g.lineWidth = 2;
		for (let k = 0; k <= 8; k++) {
			g.beginPath(); g.moveTo(k * S, 0); g.lineTo(k * S, SIZE); g.stroke();
			g.beginPath(); g.moveTo(0, k * S); g.lineTo(SIZE, k * S); g.stroke();
		}
		const hints = this.running && !this.done && (!this.vsCpu || this.turn === 1) ? legal(this.board, this.turn) : [];
		for (let i = 0; i < 64; i++) {
			const x = (i & 7) * S + S / 2, y = (i >> 3) * S + S / 2;
			const v = this.board[i];
			if (v) {
				const flip = this.flipping.get(i);
				let colour = v, sx = 1;
				if (flip && flip.t < 1) {
					const t = Math.max(0, flip.t);
					sx = Math.abs(Math.cos(t * Math.PI));
					colour = t < 0.5 ? flip.from : v;
				}
				circle(g, x, y + 3, S * 0.4, 'rgba(0,0,0,0.3)');
				g.save();
				g.translate(x, y - (flip ? Math.sin(Math.max(0, Math.min(1, flip.t)) * Math.PI) * 8 : 0));
				g.scale(Math.max(0.05, sx), 1);
				circle(g, 0, 0, S * 0.4, colour === 1 ? '#111827' : '#f8fafc');
				g.restore();
				if (i === this.last) circle(g, x, y, 5, '#ef4444');
			} else if (hints.includes(i)) {
				circle(g, x, y, S * 0.12, 'rgba(255,255,255,0.3)');
			}
		}
		this.fx.draw(g);
		g.restore();
	}

	dispose() {
		this.animator.stop();
		this.cancel?.();
		this.surface.dispose();
	}
}
