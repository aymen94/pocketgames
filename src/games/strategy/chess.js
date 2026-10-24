// Chess: full rules (castling, en passant, promotion, check, mate, stalemate, fifty-move
// and insufficient-material draws) with an alpha-beta computer opponent.

import { Game } from '../core/game.js';
import { Surface, circle, text, colors } from '../core/canvas.js';
import { negamax, think } from '../core/ai.js';
import { CanvasFx, Animator, ease } from '../core/fx.js';
import { h } from '../../components/dom.js';

const S = 64, SIZE = S * 8;
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const DEPTH = { easy: 1, normal: 2, hard: 3 };

// piece-square tables from White's side (row 0 = rank 8)
const PST = {
	p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
	n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
	b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
	r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
	q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
	k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};

const isWhite = (p) => p !== '' && p === p.toUpperCase();
const colorOf = (p) => (p === '' ? null : isWhite(p) ? 'w' : 'b');
const kind = (p) => p.toLowerCase();
const rc = (i) => [i >> 3, i & 7];
const at = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);

function initial() {
	const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
	const board = [...back, ...Array(8).fill('p'), ...Array(32).fill(''), ...Array(8).fill('P'), ...back.map((p) => p.toUpperCase())];
	return { board, turn: 'w', castling: { K: true, Q: true, k: true, q: true }, ep: -1, half: 0 };
}

/** Whether square `sq` is attacked by side `by`. */
function attacked(board, sq, by) {
	const [r, c] = rc(sq);
	const own = (p, k) => p !== '' && colorOf(p) === by && kind(p) === k;
	const dir = by === 'w' ? 1 : -1; // white pawns attack from the row below
	for (const dc of [-1, 1]) { const i = at(r + dir, c + dc); if (i >= 0 && own(board[i], 'p')) return true; }
	for (const [dr, dc] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) { const i = at(r + dr, c + dc); if (i >= 0 && own(board[i], 'n')) return true; }
	for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const i = at(r + dr, c + dc); if (i >= 0 && own(board[i], 'k')) return true; }
	for (const [dr, dc, a, b] of [[1, 0, 'r', 'q'], [-1, 0, 'r', 'q'], [0, 1, 'r', 'q'], [0, -1, 'r', 'q'], [1, 1, 'b', 'q'], [1, -1, 'b', 'q'], [-1, 1, 'b', 'q'], [-1, -1, 'b', 'q']]) {
		let nr = r + dr, nc = c + dc;
		while (true) {
			const i = at(nr, nc);
			if (i < 0) break;
			const p = board[i];
			if (p !== '') { if (colorOf(p) === by && (kind(p) === a || kind(p) === b)) return true; break; }
			nr += dr; nc += dc;
		}
	}
	return false;
}

const kingSquare = (board, side) => board.indexOf(side === 'w' ? 'K' : 'k');
const inCheck = (state, side = state.turn) => attacked(state.board, kingSquare(state.board, side), side === 'w' ? 'b' : 'w');

function pseudoMoves(state) {
	const { board, turn, castling, ep } = state;
	const moves = [];
	const enemy = turn === 'w' ? 'b' : 'w';
	const add = (from, to, extra = {}) => moves.push({ from, to, capture: board[to] !== '' ? board[to] : extra.ep ? (turn === 'w' ? 'p' : 'P') : '', ...extra });
	for (let from = 0; from < 64; from++) {
		const p = board[from];
		if (p === '' || colorOf(p) !== turn) continue;
		const [r, c] = rc(from);
		const k = kind(p);
		if (k === 'p') {
			const dir = turn === 'w' ? -1 : 1, start = turn === 'w' ? 6 : 1, last = turn === 'w' ? 0 : 7;
			const one = at(r + dir, c);
			const push = (to, extra) => (rc(to)[0] === last ? ['q', 'r', 'b', 'n'].forEach((promo) => add(from, to, { ...extra, promo })) : add(from, to, extra));
			if (one >= 0 && board[one] === '') {
				push(one);
				const two = at(r + 2 * dir, c);
				if (r === start && board[two] === '') add(from, two, { double: true });
			}
			for (const dc of [-1, 1]) {
				const to = at(r + dir, c + dc);
				if (to < 0) continue;
				if (board[to] !== '' && colorOf(board[to]) === enemy) push(to);
				else if (to === ep) add(from, to, { ep: true });
			}
		} else if (k === 'n' || k === 'k') {
			const steps = k === 'n' ? [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
			for (const [dr, dc] of steps) {
				const to = at(r + dr, c + dc);
				if (to >= 0 && colorOf(board[to]) !== turn) add(from, to);
			}
			if (k === 'k') {
				const row = turn === 'w' ? 7 : 0;
				const [kk, qq] = turn === 'w' ? ['K', 'Q'] : ['k', 'q'];
				if (from === row * 8 + 4 && !attacked(board, from, enemy)) {
					if (castling[kk] && board[row * 8 + 5] === '' && board[row * 8 + 6] === '' && !attacked(board, row * 8 + 5, enemy) && !attacked(board, row * 8 + 6, enemy)) add(from, row * 8 + 6, { castle: 'k' });
					if (castling[qq] && board[row * 8 + 3] === '' && board[row * 8 + 2] === '' && board[row * 8 + 1] === '' && !attacked(board, row * 8 + 3, enemy) && !attacked(board, row * 8 + 2, enemy)) add(from, row * 8 + 2, { castle: 'q' });
				}
			}
		} else {
			const dirs = k === 'r' ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : k === 'b' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
			for (const [dr, dc] of dirs) {
				let nr = r + dr, nc = c + dc;
				while (true) {
					const to = at(nr, nc);
					if (to < 0) break;
					if (board[to] === '') add(from, to);
					else { if (colorOf(board[to]) !== turn) add(from, to); break; }
					nr += dr; nc += dc;
				}
			}
		}
	}
	return moves;
}

function apply(state, move) {
	const board = state.board.slice();
	const p = board[move.from];
	const castling = { ...state.castling };
	board[move.to] = move.promo ? (state.turn === 'w' ? move.promo.toUpperCase() : move.promo) : p;
	board[move.from] = '';
	if (move.ep) board[move.to + (state.turn === 'w' ? 8 : -8)] = '';
	if (move.castle) {
		const row = state.turn === 'w' ? 7 : 0;
		const [rf, rt] = move.castle === 'k' ? [row * 8 + 7, row * 8 + 5] : [row * 8, row * 8 + 3];
		board[rt] = board[rf];
		board[rf] = '';
	}
	if (p === 'K') castling.K = castling.Q = false;
	if (p === 'k') castling.k = castling.q = false;
	for (const [sq, right] of [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']]) if (move.from === sq || move.to === sq) castling[right] = false;
	return {
		board,
		turn: state.turn === 'w' ? 'b' : 'w',
		castling,
		ep: move.double ? (move.from + move.to) / 2 : -1,
		half: kind(p) === 'p' || move.capture ? 0 : state.half + 1,
	};
}

function legalMoves(state) {
	return pseudoMoves(state).filter((m) => !inCheck(apply(state, m), state.turn));
}

function insufficient(board) {
	const pieces = board.filter((p) => p !== '' && kind(p) !== 'k');
	return pieces.length === 0 || (pieces.length === 1 && (kind(pieces[0]) === 'n' || kind(pieces[0]) === 'b'));
}

function evaluate(state) {
	if (state.half >= 100 || insufficient(state.board)) return 0;
	let score = 0;
	for (let i = 0; i < 64; i++) {
		const p = state.board[i];
		if (p === '') continue;
		const k = kind(p);
		const v = VALUE[k] + (isWhite(p) ? PST[k][i] : PST[k][(7 - (i >> 3)) * 8 + (i & 7)]);
		score += isWhite(p) ? v : -v;
	}
	return state.turn === 'w' ? score : -score;
}

const SEARCH = {
	moves: legalMoves,
	apply,
	evaluate,
	noMoves: (state, depth) => (inCheck(state) ? -100000 - depth : 0),
	terminal: (s) => s.half >= 100,
	order: (state, moves) => moves
		.map((m) => ({ m, k: (m.capture ? VALUE[kind(m.capture)] * 10 - VALUE[kind(state.board[m.from])] : 0) + (m.promo ? 800 : 0) + Math.random() }))
		.sort((a, b) => b.k - a.k)
		.map((x) => x.m),
};

export default class Chess extends Game {
	async init() {
		this.surface = new Surface(this.ctx.root, SIZE, SIZE);
		this.fx = new CanvasFx(300);
		this.anim = null;
		this.pulse = 0;
		this.pop = 1;
		// animates only while a piece slides, particles fly or the check square pulses
		this.animator = new Animator((dt) => {
			this.fx.update(dt);
			if (this.anim) { this.anim.t += dt / 0.24; if (this.anim.t >= 1) this.anim = null; }
			this.pulse = Math.max(0, this.pulse - dt);
			this.pop = Math.min(1, this.pop + dt * 5);
			this.render();
		}, () => this.fx.busy || this.anim || this.pulse > 0 || this.pop < 1);
		this.ctx.input.on(this.surface.canvas, 'click', (e) => this.click(this.surface.local(e)));
		this.reset();
	}

	reset() {
		this.running = false;
		this.cancel?.();
		this.picker?.remove();
		this.state = initial();
		this.selected = -1;
		this.targets = [];
		this.last = null;
		this.over = false;
		this.anim = null;
		this.pulse = 0;
		this.fx?.clear();
		this.status();
		this.render();
	}

	get vsCpu() { return this.ctx.settings.mode !== 'local'; }

	serialize() { return { state: this.state, last: this.last }; }
	restore(data) {
		this.state = data.state;
		this.last = data.last;
		this.status();
		this.render();
	}

	start() {
		super.start();
		if (this.vsCpu && this.state.turn === 'b') this.cpuMove();
	}

	status(text) {
		const s = this.state;
		const side = s.turn === 'w' ? 'White' : 'Black';
		const check = inCheck(s) ? ' · Check!' : '';
		this.ctx.info(text ?? (this.vsCpu ? (s.turn === 'w' ? `Your move${check}` : `Computer is thinking…${check}`) : `${side} to move${check}`));
	}

	click({ x, y }) {
		if (!this.running || this.over || this.picker) return;
		if (this.vsCpu && this.state.turn !== 'w') return;
		const sq = Math.floor(y / S) * 8 + Math.floor(x / S);
		const p = this.state.board[sq];
		const move = this.targets.filter((m) => m.to === sq);
		if (move.length) {
			if (move.length > 1) return this.promote(move);
			return this.play(move[0]);
		}
		if (p !== '' && colorOf(p) === this.state.turn) {
			this.selected = sq;
			this.targets = legalMoves(this.state).filter((m) => m.from === sq);
			this.ctx.audio.play(this.targets.length ? 'select' : 'error');
			this.pop = 0;
			this.animator.wake();
		} else {
			this.selected = -1;
			this.targets = [];
		}
		this.render();
	}

	promote(options) {
		const white = this.state.turn === 'w';
		this.picker = h('div.promo-picker', h('p', 'Promote to'), h('div', ['q', 'r', 'b', 'n'].map((k) => h('button.btn', {
			type: 'button',
			onclick: () => { this.picker.remove(); this.picker = null; this.play(options.find((m) => m.promo === k)); },
		}, GLYPH[k] + '︎'))));
		this.picker.style.cssText = 'position:absolute;z-index:4;padding:14px;border-radius:16px;background:#19214a;border:1px solid #3a4890;text-align:center;font-weight:800';
		this.picker.querySelector('div').style.cssText = `display:flex;gap:8px;font-size:30px;color:${white ? '#fff' : '#111'}`;
		this.ctx.root.appendChild(this.picker);
	}

	play(move) {
		const capture = move.capture;
		this.state = apply(this.state, move);
		this.last = { from: move.from, to: move.to };
		this.selected = -1;
		this.targets = [];
		this.anim = { from: move.from, to: move.to, t: 0, capture };
		this.ctx.audio.play(capture ? 'punch' : 'place');
		if (capture) {
			const [r, c] = rc(move.to);
			const white = isWhite(capture);
			this.fx.particles.burst(c * S + S / 2, r * S + S / 2, { count: 22, colors: white ? ['#ffffff', '#c9d3f5', '#fbbf24'] : ['#141833', '#6d63c9', '#fbbf24'], speed: 200, life: 0.7, shape: 'square', size: 5, gravity: 300 });
			this.fx.particles.ring(c * S + S / 2, r * S + S / 2, { color: '#fbbf24', radius: S * 0.6 });
		}
		if (inCheck(this.state)) {
			const [r, c] = rc(kingSquare(this.state.board, this.state.turn));
			this.pulse = 1.4;
			this.fx.popups.add('CHECK!', c * S + S / 2, r * S + S / 2 - 10, { color: '#fb7185', size: 22, life: 1.1 });
			this.ctx.audio.play('error');
		}
		this.animator.wake();
		this.render();
		if (this.checkEnd()) return;
		this.ctx.saveProgress(this.serialize());
		this.status();
		if (this.vsCpu && this.state.turn === 'b') this.cpuMove();
	}

	cpuMove() {
		this.cancel = think(() => {
			if (!this.running) return;
			const depth = DEPTH[this.ctx.settings.difficulty] ?? 2;
			let { move } = negamax(this.state, depth, SEARCH);
			// easy: sometimes plays a random legal move
			const moves = legalMoves(this.state);
			if (this.ctx.settings.difficulty === 'easy' && Math.random() < 0.3) move = moves[Math.floor(Math.random() * moves.length)];
			if (move) this.play(move);
		}, 300);
	}

	checkEnd() {
		const s = this.state;
		const moves = legalMoves(s);
		let result = null;
		if (moves.length === 0) {
			if (inCheck(s)) {
				const winner = s.turn === 'w' ? 'Black' : 'White';
				const won = this.vsCpu ? winner === 'White' : true;
				result = { win: this.vsCpu ? won : null, title: 'Checkmate!', message: this.vsCpu ? (won ? 'You checkmated the computer.' : 'The computer checkmated you.') : `${winner} wins.` };
			} else result = { win: null, title: 'Stalemate', message: 'No legal moves and no check: a draw.' };
		} else if (s.half >= 100) result = { win: null, title: 'Draw', message: 'Fifty moves without a capture or pawn move.' };
		else if (insufficient(s.board)) result = { win: null, title: 'Draw', message: 'Neither side has enough material to mate.' };
		if (!result) return false;
		this.over = true;
		this.ctx.info(result.title);
		setTimeout(() => this.finish(result), 700);
		return true;
	}

	render() {
		const g = this.surface.g;
		const s = this.state;
		const checked = inCheck(s) ? kingSquare(s.board, s.turn) : -1;
		this.fx.shake.apply(g);
		for (let i = 0; i < 64; i++) {
			const [r, c] = rc(i);
			g.fillStyle = (r + c) % 2 ? '#3b4a8a' : '#c9d3f5';
			if (this.last && (i === this.last.from || i === this.last.to)) g.fillStyle = (r + c) % 2 ? '#6d63c9' : '#d8c8ff';
			if (i === this.selected) g.fillStyle = '#fbbf24';
			if (i === checked) g.fillStyle = `rgba(251, 113, 133, ${0.7 + Math.sin(this.pulse * 14) * 0.3})`;
			g.fillRect(c * S, r * S, S, S);
			if (i === this.selected) { g.strokeStyle = colors.accent; g.lineWidth = 4; g.strokeRect(c * S + 2, r * S + 2, S - 4, S - 4); }
		}
		for (let i = 0; i < 8; i++) {
			text(g, 'abcdefgh'[i], i * S + S - 7, SIZE - 8, { size: 11, color: i % 2 ? '#3b4a8a' : '#c9d3f5' });
			text(g, String(8 - i), 7, i * S + 10, { size: 11, color: i % 2 ? '#c9d3f5' : '#3b4a8a' });
		}
		const anim = this.anim;
		for (let i = 0; i < 64; i++) {
			const p = s.board[i];
			if (p === '' || (anim && i === anim.to)) continue;
			const [r, c] = rc(i);
			this.drawPiece(g, p, c * S + S / 2, r * S + S / 2, i === this.selected ? 1.08 : 1);
		}
		if (anim) {
			// the moving piece glides with a slight lift
			const [fr, fc] = rc(anim.from), [tr, tc] = rc(anim.to);
			const k = ease.inOutCubic(Math.min(1, anim.t));
			const lift = Math.sin(k * Math.PI) * 0.12;
			this.drawPiece(g, s.board[anim.to], (fc + (tc - fc) * k) * S + S / 2, (fr + (tr - fr) * k) * S + S / 2 - lift * S, 1 + lift);
		}
		for (const m of this.targets) {
			const [r, c] = rc(m.to);
			if (m.capture) {
				g.strokeStyle = 'rgba(17,24,39,0.55)';
				g.lineWidth = 5;
				g.beginPath(); g.arc(c * S + S / 2, r * S + S / 2, S * 0.44, 0, Math.PI * 2); g.stroke();
			} else circle(g, c * S + S / 2, r * S + S / 2, S * 0.15 * ease.outBack(this.pop), 'rgba(17,24,39,0.45)');
		}
		this.fx.draw(g);
		g.restore();
	}

	drawPiece(g, p, x, y, scale = 1) {
		const white = isWhite(p);
		g.font = `${S * 0.78 * scale}px "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif`;
		g.textAlign = 'center';
		g.textBaseline = 'middle';
		g.lineWidth = 3;
		g.strokeStyle = white ? '#1e2340' : '#e8ecff';
		g.strokeText(GLYPH[kind(p)] + '︎', x, y + 3);
		g.fillStyle = white ? '#ffffff' : '#141833';
		g.fillText(GLYPH[kind(p)] + '︎', x, y + 3);
	}

	dispose() {
		this.animator.stop();
		this.cancel?.();
		this.picker?.remove();
		this.surface.dispose();
	}
}
