// Hex: a connection game on a rhombus of hexagons. You (blue) join the left and right
// edges; the computer (orange) joins top and bottom. There are no draws: someone always
// connects. The computer measures both players' shortest remaining paths and plays where
// that difference changes most.

import { CanvasGame } from '../kit/canvasGame.js';
import { text, colors } from '../core/canvas.js';
import { think } from '../core/ai.js';

const W = 760, H = 520;
const NB = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]];
const BLUE = '#3b82f6', ORANGE = '#f97316';

/** Stones still needed for `who` to connect (0-1 BFS: own stones cost 0, empty cost 1). */
export function distance(board, n, who) {
	const dist = new Array(n * n).fill(Infinity);
	const deque = [];
	for (let k = 0; k < n; k++) {
		const i = who === 1 ? k * n : k; // blue starts on the left column, orange on the top row
		const cost = board[i] === who ? 0 : board[i] === 0 ? 1 : Infinity;
		if (cost < dist[i]) { dist[i] = cost; cost ? deque.push(i) : deque.unshift(i); }
	}
	while (deque.length) {
		const i = deque.shift();
		const r = Math.floor(i / n), c = i % n;
		for (const [dr, dc] of NB) {
			const rr = r + dr, cc = c + dc;
			if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
			const j = rr * n + cc;
			if (board[j] === 3 - who) continue;
			const d = dist[i] + (board[j] === who ? 0 : 1);
			if (d < dist[j]) { dist[j] = d; board[j] === who ? deque.unshift(j) : deque.push(j); }
		}
	}
	let best = Infinity;
	for (let k = 0; k < n; k++) best = Math.min(best, dist[who === 1 ? k * n + n - 1 : (n - 1) * n + k]);
	return best;
}

export default class Hex extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.cancel?.();
		this.n = Number(this.ctx.settings.size ?? 9);
		this.board = new Uint8Array(this.n * this.n);
		this.turn = 1;
		this.hover = -1;
		this.last = -1;
		this.moves = 0;
		this.winPath = null;
		this.r = Math.min(30, 640 / (Math.sqrt(3) * (this.n + (this.n - 1) / 2)), 400 / (1.5 * (this.n - 1)));
		this.ctx.score(0);
		this.ctx.info('Connect left and right');
	}

	center(i) {
		const n = this.n, r = Math.floor(i / n), c = i % n, s = this.r;
		const w = Math.sqrt(3) * s;
		const totalW = w * (n + (n - 1) / 2);
		const x0 = (W - totalW) / 2 + w / 2, y0 = (H - s * 1.5 * (n - 1)) / 2;
		return [x0 + c * w + r * w / 2, y0 + r * s * 1.5];
	}

	at(p) {
		let best = -1, bd = this.r;
		for (let i = 0; i < this.n * this.n; i++) { const [x, y] = this.center(i); const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }
		return best;
	}

	pointerMove(p) { const i = this.at(p); this.hover = this.turn === 1 && i >= 0 && !this.board[i] ? i : -1; }

	pointerDown(p) {
		if (!this.running || this.turn !== 1) return;
		const i = this.at(p);
		if (i >= 0 && !this.board[i]) this.place(i, 1);
	}

	place(i, who) {
		this.board[i] = who;
		this.last = i;
		this.moves++;
		this.hover = -1;
		this.ctx.audio.play('place');
		const [x, y] = this.center(i);
		this.fx.particles.ring(x, y, { color: who === 1 ? BLUE : ORANGE, radius: this.r * 1.4 });
		if (distance(this.board, this.n, who) === 0) return this.end(who);
		this.turn = 3 - who;
		this.ctx.info(this.turn === 1 ? 'Your turn' : 'Computer is thinking…');
		if (this.turn === 2) this.cancel = think(() => { if (this.running) { this.place(this.choose(), 2); this.wake(); } }, 450);
	}

	choose() {
		const n = this.n, b = this.board;
		const d = this.ctx.settings.difficulty ?? 'normal';
		const empty = [];
		for (let i = 0; i < n * n; i++) if (!b[i]) empty.push(i);
		if (this.moves <= 1) {
			const mid = Math.floor(n / 2) * n + Math.floor(n / 2);
			if (!b[mid]) return mid;
		}
		let best = empty[0], bestScore = -Infinity;
		for (const i of empty) {
			b[i] = 2;
			const mine = distance(b, n, 2), theirs = distance(b, n, 1);
			b[i] = 0;
			if (mine === 0) return i;
			// shorten my path and lengthen theirs; a little noise varies equal choices
			const score = theirs * 10 - mine * 11 + Math.random() * (d === 'easy' ? 30 : d === 'normal' ? 6 : 1.5);
			if (score > bestScore) { bestScore = score; best = i; }
		}
		return best;
	}

	end(who) {
		this.turn = 0;
		this.winner = who;
		const win = who === 1;
		this.ctx.audio.play(win ? 'win' : 'lose');
		if (win) { this.ctx.fx.confetti({ count: 70 }); this.ctx.score(1); }
		setTimeout(() => this.finish({ win, title: win ? 'Connected!' : 'The computer connected', message: `After ${this.moves} stones on a ${this.n}×${this.n} board.`, score: win ? Math.max(1, this.n * this.n - this.moves) : 0 }), 900);
	}

	hexPath(g, x, y, s) {
		g.beginPath();
		for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); }
		g.closePath();
	}

	draw(g) {
		g.fillStyle = '#0f172a';
		g.fillRect(0, 0, W, H);
		const n = this.n, s = this.r;
		// edge bands show who connects where
		const corner = (i) => this.center(i);
		const [tlx, tly] = corner(0), [trx, try_] = corner(n - 1), [blx, bly] = corner((n - 1) * n), [brx, bry] = corner(n * n - 1);
		g.lineWidth = 8;
		g.lineCap = 'round';
		g.strokeStyle = ORANGE;
		g.beginPath(); g.moveTo(tlx - s, tly - s * 1.2); g.lineTo(trx + s, try_ - s * 1.2); g.stroke();
		g.beginPath(); g.moveTo(blx - s, bly + s * 1.2); g.lineTo(brx + s, bry + s * 1.2); g.stroke();
		g.strokeStyle = BLUE;
		g.beginPath(); g.moveTo(tlx - s * 1.3, tly - s * 0.6); g.lineTo(blx - s * 1.3, bly + s * 0.6); g.stroke();
		g.beginPath(); g.moveTo(trx + s * 1.3, try_ - s * 0.6); g.lineTo(brx + s * 1.3, bry + s * 0.6); g.stroke();
		for (let i = 0; i < n * n; i++) {
			const [x, y] = this.center(i);
			this.hexPath(g, x, y, s * 0.97);
			const v = this.board[i];
			g.fillStyle = v === 1 ? BLUE : v === 2 ? ORANGE : i === this.hover ? colors.accent + '66' : '#1e293b';
			g.fill();
			g.strokeStyle = '#334155';
			g.lineWidth = 1.5;
			g.stroke();
			if (i === this.last) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); }
		}
		text(g, 'You: left ↔ right', 20, H - 18, { size: 14, align: 'left', color: BLUE });
		text(g, 'Computer: top ↕ bottom', W - 20, H - 18, { size: 14, align: 'right', color: ORANGE });
	}

	teardown() { this.cancel?.(); }
}
