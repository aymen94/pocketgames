// Code Breaker: deduce a hidden colour code. Each guess is marked with solid pegs (right
// colour, right place) and hollow pegs (right colour, wrong place). Easy codes never repeat
// a colour; Hard adds a fifth slot and two more colours.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 420, H = 680;
const PEGS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#f8fafc'];
const ROWS = 10;

export function mark(code, guess) {
	let exact = 0, near = 0;
	const left = new Map(), want = [];
	code.forEach((c, i) => {
		if (guess[i] === c) exact++;
		else { left.set(c, (left.get(c) ?? 0) + 1); want.push(guess[i]); }
	});
	for (const c of want) if (left.get(c) > 0) { near++; left.set(c, left.get(c) - 1); }
	return { exact, near };
}

export default class CodeBreaker extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		const d = this.ctx.settings.difficulty ?? 'normal';
		this.slots = d === 'hard' ? 5 : 4;
		this.palette = d === 'hard' ? 8 : 6;
		const pool = [...Array(this.palette).keys()];
		this.code = [];
		for (let i = 0; i < this.slots; i++) {
			if (d === 'easy') this.code.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
			else this.code.push(Math.floor(Math.random() * this.palette));
		}
		this.rows = [];
		this.current = [];
		this.revealed = false;
		this.ctx.score(0);
		this.ctx.info(`${ROWS} guesses · ${this.slots} slots`);
	}

	layout() {
		const top = 70, rowH = 46;
		const boardX = 70, gap = 44;
		return { top, rowH, boardX, gap, paletteY: top + ROWS * rowH + 30 };
	}

	pick(colour) {
		if (!this.running || this.current.length >= this.slots) return;
		if ((this.ctx.settings.difficulty ?? 'normal') === 'easy' && this.current.includes(colour)) return this.ctx.audio.play('error');
		this.current.push(colour);
		this.ctx.audio.play('click');
	}

	submit() {
		if (!this.running) return;
		if (this.current.length < this.slots) return this.ctx.audio.play('error');
		const result = mark(this.code, this.current);
		this.rows.push({ guess: this.current, ...result });
		this.current = [];
		this.ctx.score(this.rows.length);
		const L = this.layout();
		const y = L.top + (this.rows.length - 1) * L.rowH + L.rowH / 2;
		if (result.exact === this.slots) {
			this.revealed = true;
			this.ctx.audio.play('win');
			this.ctx.fx.confetti({ count: 70 });
			this.burst(W / 2, y, { count: 30, colors: PEGS, speed: 200, life: 0.8, shape: 'star', size: 4 });
			setTimeout(() => this.finish({ win: true, title: 'Code cracked!', message: `Solved in ${this.rows.length} ${this.rows.length === 1 ? 'guess' : 'guesses'}.`, score: this.rows.length, lowerIsBetter: true }), 900);
			return;
		}
		this.ctx.audio.play(result.exact ? 'score' : 'place');
		if (this.rows.length >= ROWS) {
			this.revealed = true;
			this.ctx.audio.play('lose');
			setTimeout(() => this.finish({ win: false, title: 'Out of guesses', message: 'The code is shown at the top.' }), 1200);
		}
	}

	pointerDown(p) {
		if (!this.running) return;
		const L = this.layout();
		// palette
		const n = this.palette, size = 40, startX = W / 2 - (n * size) / 2 + size / 2;
		for (let i = 0; i < n; i++) if (Math.hypot(p.x - (startX + i * size), p.y - L.paletteY) < 18) return this.pick(i);
		// buttons
		if (p.y > L.paletteY + 30 && p.y < L.paletteY + 74) {
			if (p.x < W / 2) { this.current.pop(); this.ctx.audio.play('flip'); } else this.submit();
			return;
		}
		// tap a slot of the current row to clear it
		const rowY = L.top + this.rows.length * L.rowH + L.rowH / 2;
		if (Math.abs(p.y - rowY) < 20) {
			const i = Math.round((p.x - L.boardX) / L.gap);
			if (i >= 0 && i < this.current.length) this.current.splice(i, 1);
		}
	}

	key(action, event) {
		const k = event?.key;
		const n = Number(k);
		if (n >= 1 && n <= this.palette) this.pick(n - 1);
		else if (k === 'Backspace') this.current.pop();
		else if (action === 'action') this.submit();
	}

	draw(g) {
		g.fillStyle = '#16120f';
		g.fillRect(0, 0, W, H);
		const L = this.layout();
		fillRound(g, 20, 14, W - 40, 44, 12, '#2a211a');
		for (let i = 0; i < this.slots; i++) {
			const x = L.boardX + i * L.gap;
			if (this.revealed) circle(g, x, 36, 14, PEGS[this.code[i]]);
			else { circle(g, x, 36, 14, '#3f3328'); text(g, '?', x, 37, { size: 16, color: '#a8957f' }); }
		}
		for (let r = 0; r < ROWS; r++) {
			const y = L.top + r * L.rowH + L.rowH / 2;
			const row = this.rows[r];
			const active = r === this.rows.length && this.running;
			fillRound(g, 20, y - 20, W - 40, 40, 10, active ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)');
			text(g, String(r + 1), 34, y, { size: 12, color: '#7c6a58' });
			const guess = row ? row.guess : active ? this.current : [];
			for (let i = 0; i < this.slots; i++) {
				const x = L.boardX + i * L.gap;
				if (guess[i] !== undefined) {
					circle(g, x, y, 15, PEGS[guess[i]]);
					circle(g, x - 5, y - 5, 4, 'rgba(255,255,255,0.35)');
				} else circle(g, x, y, 8, '#2d241c');
			}
			if (row) {
				const marks = [...Array(row.exact).fill(2), ...Array(row.near).fill(1)];
				for (let i = 0; i < this.slots; i++) {
					const mx = W - 92 + (i % 3) * 16, my = y - 7 + Math.floor(i / 3) * 14;
					if (marks[i] === 2) circle(g, mx, my, 5.5, '#f8fafc');
					else if (marks[i] === 1) { g.strokeStyle = '#f8fafc'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 4.5, 0, Math.PI * 2); g.stroke(); }
					else circle(g, mx, my, 2.5, '#3f3328');
				}
			}
		}
		const n = this.palette, size = 40, startX = W / 2 - (n * size) / 2 + size / 2;
		for (let i = 0; i < n; i++) {
			circle(g, startX + i * size, L.paletteY, 16, PEGS[i]);
			text(g, String(i + 1), startX + i * size, L.paletteY + 1, { size: 11, color: 'rgba(0,0,0,0.55)' });
		}
		fillRound(g, 30, L.paletteY + 30, W / 2 - 40, 44, 12, '#3f3328');
		text(g, 'Undo ⌫', W / 4 + 5, L.paletteY + 52, { size: 16 });
		const ready = this.current.length === this.slots;
		fillRound(g, W / 2 + 10, L.paletteY + 30, W / 2 - 40, 44, 12, ready ? colors.accent : '#3f3328');
		text(g, 'Check ↵', (W * 3) / 4 - 5, L.paletteY + 52, { size: 16 });
	}
}
