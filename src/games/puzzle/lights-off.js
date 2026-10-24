// Lights Off: pressing a lamp toggles it and its four neighbours. Switch every lamp off.
// Each level is made by pressing random lamps on a dark board, so it is always solvable,
// and par is the number of presses that made it. Boards grow from 4×4 to 6×6.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, glow, text, colors } from '../core/canvas.js';

const W = 520, H = 600;
const LEVELS = 15;

export default class LightsOff extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.label = tool.label('');
		return tool.bar(this.label, tool.button('Restart level', () => this.startLevel(this.level, this.start0)), tool.button('Hint', () => this.hint()));
	}

	reset() {
		super.reset();
		this.done = false;
		this.score = 0;
		this.ctx.score(0);
		this.startLevel(0);
	}

	restore(data) {
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.startLevel(data.level ?? 0);
	}

	startLevel(level, board = null) {
		this.level = level;
		this.n = level < 4 ? 4 : level < 10 ? 5 : 6;
		const n = this.n;
		if (board) {
			this.lit = board.lit.slice();
			this.solution = board.solution.slice();
		} else {
			this.lit = new Uint8Array(n * n);
			this.solution = new Uint8Array(n * n);
			const presses = 3 + Math.min(10, level);
			while (this.solution.reduce((a, b) => a + b, 0) < presses) {
				const i = Math.floor(Math.random() * n * n);
				if (!this.solution[i]) { this.solution[i] = 1; this.toggle(i, true); }
			}
			if (!this.lit.some(Boolean)) return this.startLevel(level);
		}
		this.start0 = { lit: this.lit.slice(), solution: this.solution.slice() };
		this.par = this.solution.reduce((a, b) => a + b, 0);
		this.moves = 0;
		this.hinted = -1;
		this.label.textContent = `Level ${level + 1} / ${LEVELS}`;
		this.ctx.info(`Par ${this.par}`);
		this.ctx.saveProgress({ level, score: this.score });
		this.wake();
	}

	toggle(i, silent = false) {
		const n = this.n, r = Math.floor(i / n), c = i % n;
		for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
			const rr = r + dr, cc = c + dc;
			if (rr >= 0 && rr < n && cc >= 0 && cc < n) this.lit[rr * n + cc] ^= 1;
		}
		if (!silent) this.solution[i] ^= 1; // pressing twice cancels, so the remaining solution flips too
	}

	geometry() {
		const size = Math.min(440 / this.n, 100);
		return { size, x0: W / 2 - (size * this.n) / 2, y0: 70 };
	}

	hint() {
		if (!this.running) return;
		this.hinted = this.solution.findIndex(Boolean);
		this.score = Math.max(0, this.score - 10);
		this.ctx.score(this.score);
		this.wake();
	}

	press(i) {
		if (!this.running || this.done) return;
		this.toggle(i);
		this.moves++;
		this.hinted = -1;
		this.ctx.audio.play('click');
		const { size, x0, y0 } = this.geometry();
		this.fx.particles.ring(x0 + (i % this.n + 0.5) * size, y0 + (Math.floor(i / this.n) + 0.5) * size, { color: colors.accent, radius: size * 0.7 });
		this.ctx.info(`Par ${this.par} · Moves ${this.moves}`);
		if (!this.lit.some(Boolean)) {
			const gain = 100 + Math.max(0, this.par - this.moves + 5) * 10;
			this.score += gain;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.popup(`+${gain}`, W / 2, 40, { color: '#fde047', size: 26 });
			this.done = true;
			setTimeout(() => {
				this.done = false;
				if (!this.running) return;
				if (this.level + 1 >= LEVELS) return this.finish({ win: true, title: 'Lights out!', message: `All ${LEVELS} boards dark.`, score: this.score });
				this.startLevel(this.level + 1);
				this.ctx.fx.banner(`Level ${this.level + 1}`);
			}, 900);
		}
		this.wake();
	}

	pointerDown(p) {
		const { size, x0, y0 } = this.geometry();
		const c = Math.floor((p.x - x0) / size), r = Math.floor((p.y - y0) / size);
		if (r >= 0 && r < this.n && c >= 0 && c < this.n) this.press(r * this.n + c);
	}

	draw(g) {
		g.fillStyle = '#0a0a14';
		g.fillRect(0, 0, W, H);
		const { size, x0, y0 } = this.geometry();
		for (let i = 0; i < this.n * this.n; i++) {
			const x = x0 + (i % this.n) * size, y = y0 + Math.floor(i / this.n) * size;
			const on = this.lit[i];
			if (on) glow(g, x + size / 2, y + size / 2, size * 0.9, 'rgba(253,224,71,0.35)');
			fillRound(g, x + 5, y + 5, size - 10, size - 10, 14, on ? '#fde047' : '#1e1b2e');
			if (on) fillRound(g, x + 12, y + 10, size - 24, 8, 4, 'rgba(255,255,255,0.6)');
			if (i === this.hinted) { g.strokeStyle = colors.accent; g.lineWidth = 4; g.strokeRect(x + 3, y + 3, size - 6, size - 6); }
		}
		const left = this.lit.reduce((a, b) => a + b, 0);
		text(g, `${left} lit`, W / 2, y0 + size * this.n + 34, { size: 18, color: '#c4b5fd' });
	}
}
