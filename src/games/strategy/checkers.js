// Checkers (American rules): mandatory captures, multi-jump chains, kings that move
// both ways one step. You play red from the bottom against the computer or a friend.

import { Game } from '../core/game.js';
import { Surface, circle, text, colors } from '../core/canvas.js';
import { negamax, think } from '../core/ai.js';
import { CanvasFx, Animator, ease } from '../core/fx.js';

const S = 64, SIZE = S * 8;
const DEPTH = { easy: 2, normal: 4, hard: 6 };
// pieces: 1 red man, 2 red king, -1 black man, -2 black king; red moves up (toward row 0)

function initial() {
	const board = new Array(64).fill(0);
	for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
		if ((r + c) % 2 === 0) continue;
		if (r < 3) board[r * 8 + c] = -1;
		if (r > 4) board[r * 8 + c] = 1;
	}
	return { board, turn: 1, quiet: 0 };
}

const owner = (p) => Math.sign(p);

function jumpsFrom(board, from, piece, path = [from], taken = []) {
	const r = from >> 3, c = from & 7;
	const dirs = Math.abs(piece) === 2 ? [-1, 1] : [piece > 0 ? -1 : 1];
	const out = [];
	for (const dr of dirs) for (const dc of [-1, 1]) {
		const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
		if (lr < 0 || lr > 7 || lc < 0 || lc > 7) continue;
		const mid = mr * 8 + mc, land = lr * 8 + lc;
		if (owner(board[mid]) !== -owner(piece) || board[land] !== 0 || taken.includes(mid)) continue;
		const next = board.slice();
		next[from] = 0;
		next[land] = piece;
		const crowned = Math.abs(piece) === 1 && (lr === 0 || lr === 7);
		const further = crowned ? [] : jumpsFrom(next, land, piece, [...path, land], [...taken, mid]);
		if (further.length) out.push(...further);
		else out.push({ path: [...path, land], taken: [...taken, mid] });
	}
	return out;
}

function moves(state) {
	const { board, turn } = state;
	const jumps = [], steps = [];
	for (let i = 0; i < 64; i++) {
		const p = board[i];
		if (owner(p) !== turn) continue;
		jumps.push(...jumpsFrom(board, i, p));
		if (jumps.length) continue;
		const r = i >> 3, c = i & 7;
		for (const dr of Math.abs(p) === 2 ? [-1, 1] : [turn > 0 ? -1 : 1]) for (const dc of [-1, 1]) {
			const nr = r + dr, nc = c + dc;
			if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && board[nr * 8 + nc] === 0) steps.push({ path: [i, nr * 8 + nc], taken: [] });
		}
	}
	return jumps.length ? jumps : steps;
}

function apply(state, move) {
	const board = state.board.slice();
	const from = move.path[0], to = move.path.at(-1);
	let piece = board[from];
	board[from] = 0;
	for (const t of move.taken) board[t] = 0;
	const row = to >> 3;
	if (Math.abs(piece) === 1 && ((piece > 0 && row === 0) || (piece < 0 && row === 7))) piece *= 2;
	board[to] = piece;
	return { board, turn: -state.turn, quiet: move.taken.length ? 0 : state.quiet + 1 };
}

function evaluate(state) {
	let score = 0;
	for (let i = 0; i < 64; i++) {
		const p = state.board[i];
		if (!p) continue;
		const row = i >> 3;
		const advance = Math.abs(p) === 1 ? (p > 0 ? 7 - row : row) * 4 : 0;
		const centre = (i & 7) > 1 && (i & 7) < 6 ? 3 : 0;
		score += owner(p) * ((Math.abs(p) === 2 ? 170 : 100) + advance + centre);
	}
	return score * state.turn;
}

const SEARCH = { moves, apply, evaluate, terminal: (s) => s.quiet >= 80, noMoves: (_s, depth) => -10000 - depth,
	order: (_s, list) => list.slice().sort((a, b) => b.taken.length - a.taken.length) };

export default class Checkers extends Game {
	async init() {
		this.surface = new Surface(this.ctx.root, SIZE, SIZE);
		this.fx = new CanvasFx(300);
		this.anim = null;
		this.time = 0;
		this.animator = new Animator((dt) => {
			this.fx.update(dt);
			this.time += dt;
			const a = this.anim;
			if (a) {
				const before = Math.floor(a.t);
				a.t += dt / 0.2;
				// each completed hop bursts the piece it jumped
				for (let k = before; k < Math.min(Math.floor(a.t), a.taken.length); k++) this.capturePop(a.taken[k]);
				if (a.t >= a.path.length - 1) { this.anim = null; this.landed(a); }
			}
			this.render();
		}, () => this.fx.busy || this.anim);
		this.ctx.input.on(this.surface.canvas, 'click', (e) => this.click(this.surface.local(e)));
		this.reset();
	}

	get vsCpu() { return this.ctx.settings.mode !== 'local'; }

	reset() {
		this.running = false;
		this.cancel?.();
		this.state = initial();
		this.anim = null;
		this.fx?.clear();
		this.selected = -1;
		this.options = [];
		this.last = null;
		this.done = false;
		this.status();
		this.render();
	}

	status() {
		const red = this.state.turn > 0;
		const count = (side) => this.state.board.filter((p) => owner(p) === side).length;
		const tally = `${count(1)} vs ${count(-1)}`;
		this.ctx.info(this.vsCpu ? `${red ? 'Your move' : 'Computer is thinking…'} · ${tally}` : `${red ? 'Red' : 'Black'} to move · ${tally}`);
	}

	click({ x, y }) {
		if (!this.running || this.done) return;
		if (this.vsCpu && this.state.turn < 0) return;
		const sq = Math.floor(y / S) * 8 + Math.floor(x / S);
		const chosen = this.options.find((m) => m.path.at(-1) === sq);
		if (chosen) return this.play(chosen);
		const all = moves(this.state);
		const mine = all.filter((m) => m.path[0] === sq);
		if (mine.length) {
			this.selected = sq;
			this.options = mine;
			this.ctx.audio.play('click');
		} else {
			if (owner(this.state.board[sq]) === this.state.turn && all.length && all[0].taken.length) this.ctx.audio.play('error');
			this.selected = -1;
			this.options = [];
		}
		this.render();
	}

	play(move) {
		const before = this.state.board;
		const piece = before[move.path[0]];
		this.state = apply(this.state, move);
		this.last = move;
		this.selected = -1;
		this.options = [];
		this.anim = { path: move.path, t: 0, piece, crowned: Math.abs(this.state.board[move.path.at(-1)]) === 2 && Math.abs(piece) === 1, taken: move.taken.map((sq) => ({ sq, piece: before[sq] })) };
		this.ctx.audio.play(move.taken.length ? 'whip' : 'place');
		this.animator.wake();
		this.render();
		if (this.checkEnd()) return;
		this.status();
		if (this.vsCpu && this.state.turn < 0) this.cpu();
	}

	capturePop({ sq, piece }) {
		const x = (sq & 7) * S + S / 2, y = (sq >> 3) * S + S / 2;
		this.ctx.audio.play('punch');
		this.fx.particles.burst(x, y, { count: 20, colors: piece > 0 ? ['#e11d48', '#fda4af'] : ['#111827', '#6b7280'], speed: 200, life: 0.6, shape: 'square', size: 5, gravity: 260 });
		this.fx.particles.ring(x, y, { color: '#fbbf24', radius: S * 0.55 });
		this.fx.shake.kick(3);
	}

	landed(a) {
		if (!a.crowned) return;
		const to = a.path.at(-1);
		const x = (to & 7) * S + S / 2, y = (to >> 3) * S + S / 2;
		this.ctx.audio.play('powerup');
		this.fx.particles.burst(x, y, { count: 24, colors: ['#fde047', '#ffffff'], speed: 160, life: 0.8, shape: 'star', size: 5, gravity: 80 });
		this.fx.popups.add('KING!', x, y - 20, { color: '#fde047', size: 22 });
	}

	drawPiece(g, p, x, y, lift = 0) {
		circle(g, x, y + 3 + lift * 10, S * 0.38, 'rgba(0,0,0,0.35)');
		circle(g, x, y, S * 0.38 * (1 + lift * 0.15), p > 0 ? '#e11d48' : '#111827');
		g.strokeStyle = p > 0 ? '#fda4af' : '#4b5563';
		g.lineWidth = 2;
		g.beginPath(); g.arc(x, y, S * 0.27, 0, Math.PI * 2); g.stroke();
		if (Math.abs(p) === 2) text(g, '♛︎', x, y + 1, { size: S * 0.36, color: '#fde047' });
	}

	cpu() {
		this.cancel = think(() => {
			if (!this.running) return;
			const { move } = negamax(this.state, DEPTH[this.ctx.settings.difficulty] ?? 4, SEARCH);
			if (move) this.play(move);
		}, 350);
	}

	checkEnd() {
		const s = this.state;
		let result = null;
		if (moves(s).length === 0) {
			const redWins = s.turn < 0;
			result = this.vsCpu
				? { win: redWins, title: redWins ? 'You win!' : 'The computer wins', message: redWins ? 'Black has no pieces or moves left.' : 'You have no pieces or moves left.' }
				: { win: null, title: `${redWins ? 'Red' : 'Black'} wins!`, message: 'The other side cannot move.' };
		} else if (s.quiet >= 80) result = { win: null, title: 'Draw', message: '40 moves each without a capture.' };
		if (!result) return false;
		this.done = true;
		setTimeout(() => this.finish(result), 600);
		return true;
	}

	render() {
		const g = this.surface.g;
		const forced = this.running && !this.anim && moves(this.state).filter((m) => m.taken.length).map((m) => m.path[0]);
		const a = this.anim;
		this.fx.shake.apply(g);
		for (let i = 0; i < 64; i++) {
			const r = i >> 3, c = i & 7;
			g.fillStyle = (r + c) % 2 ? '#2a335e' : '#d7dcf2';
			if (this.last?.path.includes(i)) g.fillStyle = '#3f4a8f';
			g.fillRect(c * S, r * S, S, S);
		}
		for (let i = 0; i < 64; i++) {
			const p = this.state.board[i];
			if (!p || (a && i === a.path.at(-1))) continue;
			const x = (i & 7) * S + S / 2, y = (i >> 3) * S + S / 2;
			this.drawPiece(g, p, x, y);
			if (i === this.selected) { g.strokeStyle = '#fbbf24'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, S * 0.42, 0, Math.PI * 2); g.stroke(); }
			else if (forced && forced.includes(i) && (!this.vsCpu || this.state.turn > 0)) { g.strokeStyle = 'rgba(251,191,36,0.75)'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, S * 0.44, 0, Math.PI * 2); g.stroke(); }
		}
		if (a) {
			// pieces still to be jumped stay until the hop passes them
			a.taken.forEach(({ sq, piece }, k) => { if (k >= Math.floor(a.t)) this.drawPiece(g, piece, (sq & 7) * S + S / 2, (sq >> 3) * S + S / 2); });
			const seg = Math.min(Math.floor(a.t), a.path.length - 2), f = ease.inOutCubic(Math.min(1, a.t - seg));
			const from = a.path[seg], to = a.path[seg + 1];
			const x = ((from & 7) + ((to & 7) - (from & 7)) * f) * S + S / 2;
			const y = ((from >> 3) + ((to >> 3) - (from >> 3)) * f) * S + S / 2;
			const lift = Math.sin(f * Math.PI) * (a.taken.length ? 1 : 0.4);
			this.drawPiece(g, a.piece, x, y - lift * 14, lift);
		}
		for (const m of this.options) {
			const to = m.path.at(-1);
			circle(g, (to & 7) * S + S / 2, (to >> 3) * S + S / 2, S * 0.14, colors.accent);
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
