// Nim: rows of 1, 3, 5 and 7 matches. On your turn take any number of matches from one
// row. In the misère game (the default) whoever takes the last match loses; in the normal
// game, whoever takes it wins. The computer plays the nim-sum strategy on Hard.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { think } from '../core/ai.js';

const W = 560, H = 520;
const ROWS = [1, 3, 5, 7];

export function bestMove(heaps, misere) {
	const xor = heaps.reduce((a, b) => a ^ b, 0);
	const big = heaps.filter((h) => h > 1).length;
	if (misere && big <= 1) {
		// endgame: leave an odd number of single matches
		const ones = heaps.filter((h) => h === 1).length;
		const i = heaps.findIndex((h) => h > 1);
		if (i >= 0) return { row: i, take: ones % 2 ? heaps[i] : heaps[i] - 1 };
		return { row: heaps.findIndex((h) => h > 0), take: 1 };
	}
	if (xor) {
		for (let i = 0; i < heaps.length; i++) {
			const target = heaps[i] ^ xor;
			if (target < heaps[i]) return { row: i, take: heaps[i] - target };
		}
	}
	return null;
}

export default class Nim extends CanvasGame {
	static W = W;
	static H = H;

	setup() { this.streak = 0; }

	reset() {
		super.reset();
		this.cancel?.();
		this.heaps = ROWS.slice();
		this.misere = (this.ctx.settings.rule ?? 'misere') === 'misere';
		this.turn = this.ctx.settings.first === 'cpu' ? 'cpu' : 'you';
		this.hover = null;
		this.falling = [];
		this.ctx.score(this.streak);
		this.status();
	}

	start() {
		super.start();
		if (this.turn === 'cpu') this.cpu();
	}

	status() {
		this.ctx.info(this.turn === 'you' ? `Your turn · last match ${this.misere ? 'loses' : 'wins'}` : 'Computer is thinking…');
	}

	stick(p) {
		for (let r = 0; r < ROWS.length; r++) {
			const y = 110 + r * 95;
			if (Math.abs(p.y - y) > 40) continue;
			const n = ROWS[r], x0 = W / 2 - ((n - 1) * 50) / 2;
			const i = Math.round((p.x - x0) / 50);
			if (i >= 0 && i < this.heaps[r]) return { row: r, index: i };
		}
		return null;
	}

	pointerMove(p) { this.hover = this.turn === 'you' && this.running ? this.stick(p) : null; }

	pointerDown(p) {
		if (!this.running || this.turn !== 'you') return;
		const s = this.stick(p);
		if (!s) return;
		this.take(s.row, this.heaps[s.row] - s.index, 'you');
	}

	take(row, count, who) {
		const n = ROWS[row], x0 = W / 2 - ((n - 1) * 50) / 2;
		for (let i = this.heaps[row] - count; i < this.heaps[row]; i++) this.falling.push({ x: x0 + i * 50, y: 110 + row * 95, vy: -120, rot: 0, t: 0 });
		this.heaps[row] -= count;
		this.hover = null;
		this.ctx.audio.play('flip');
		if (this.heaps.every((h) => h === 0)) {
			const youWin = this.misere ? who === 'cpu' : who === 'you';
			this.streak = youWin ? this.streak + 1 : 0;
			this.ctx.score(this.streak);
			this.ctx.audio.play(youWin ? 'win' : 'lose');
			if (youWin) this.ctx.fx.confetti({ count: 60 });
			setTimeout(() => this.finish({ win: youWin, title: youWin ? 'You win!' : 'The computer wins', message: `${who === 'you' ? 'You' : 'The computer'} took the last match. Win streak: ${this.streak}.`, score: this.streak }), 700);
			return;
		}
		this.turn = who === 'you' ? 'cpu' : 'you';
		this.status();
		if (this.turn === 'cpu') this.cpu();
	}

	cpu() {
		this.cancel = think(() => {
			if (!this.running) return;
			const d = this.ctx.settings.difficulty ?? 'normal';
			const smart = d === 'hard' ? 1 : d === 'normal' ? 0.7 : 0.3;
			let move = Math.random() < smart ? bestMove(this.heaps, this.misere) : null;
			if (!move) {
				const rows = this.heaps.map((h, i) => [h, i]).filter(([h]) => h > 0);
				const [h, i] = rows[Math.floor(Math.random() * rows.length)];
				move = { row: i, take: 1 + Math.floor(Math.random() * Math.min(h, 3)) };
			}
			this.take(move.row, move.take, 'cpu');
			this.wake();
		}, 650);
	}

	busy() { return this.falling.length > 0; }

	tick(dt) {
		for (const f of this.falling) { f.t += dt; f.vy += 900 * dt; f.y += f.vy * dt; f.rot += dt * 6; }
		this.falling = this.falling.filter((f) => f.y < H + 60);
	}

	match(g, x, y, rot = 0, alpha = 1, lit = false) {
		g.save();
		g.globalAlpha = alpha;
		g.translate(x, y);
		g.rotate(rot);
		fillRound(g, -4, -30, 8, 62, 3, lit ? '#fde68a' : '#f5deb3');
		g.fillStyle = lit ? colors.accent : '#dc2626';
		g.beginPath(); g.ellipse(0, -32, 6.5, 9, 0, 0, Math.PI * 2); g.fill();
		g.restore();
	}

	draw(g) {
		g.fillStyle = '#1e293b';
		g.fillRect(0, 0, W, H);
		fillRound(g, 30, 50, W - 60, 400, 22, '#334155');
		for (let r = 0; r < ROWS.length; r++) {
			const n = ROWS[r], x0 = W / 2 - ((n - 1) * 50) / 2, y = 110 + r * 95;
			for (let i = 0; i < this.heaps[r]; i++) {
				const lit = this.hover && this.hover.row === r && i >= this.hover.index;
				this.match(g, x0 + i * 50, y + (lit ? -6 : 0), 0, 1, lit);
			}
			text(g, String(this.heaps[r]), 52, y, { size: 16, color: '#94a3b8' });
		}
		for (const f of this.falling) this.match(g, f.x, f.y, f.rot, Math.max(0, 1 - f.t), false);
		text(g, this.turn === 'you' ? 'Your move: click the first match to take' : 'Computer’s move', W / 2, 482, { size: 16, color: this.turn === 'you' ? '#e2e8f0' : '#94a3b8' });
	}

	teardown() { this.cancel?.(); }
}
