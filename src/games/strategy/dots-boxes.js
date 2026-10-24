// Dots and Boxes: take turns drawing a line between two neighbouring dots. Close the
// fourth side of a box to claim it and move again. Most boxes wins. The computer takes
// free boxes, avoids handing out third sides and, when it must, gives away the shortest
// chain.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';
import { think } from '../core/ai.js';

const W = 560, H = 620;
const YOU = '#3b82f6', CPU = '#f43f5e';

export default class DotsBoxes extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.cancel?.();
		const size = { small: 3, medium: 4, large: 6 }[this.ctx.settings.size ?? 'medium'] ?? 4;
		this.n = size; // boxes per side
		this.cell = Math.min(110, 460 / size);
		this.ox = W / 2 - (this.n * this.cell) / 2;
		this.oy = 100;
		// h[r][c]: line from dot (r,c) to (r,c+1); v[r][c]: from (r,c) to (r+1,c)
		this.h = Array.from({ length: size + 1 }, () => Array(size).fill(0));
		this.v = Array.from({ length: size }, () => Array(size + 1).fill(0));
		this.boxes = Array.from({ length: size }, () => Array(size).fill(0));
		this.scores = { 1: 0, 2: 0 };
		this.turn = 1;
		this.hover = null;
		this.last = null;
		this.ctx.score(0);
		this.status();
	}

	status() { this.ctx.info(this.turn === 1 ? 'Your turn' : 'Computer’s turn'); }

	lines() {
		const out = [];
		for (let r = 0; r <= this.n; r++) for (let c = 0; c < this.n; c++) if (!this.h[r][c]) out.push(['h', r, c]);
		for (let r = 0; r < this.n; r++) for (let c = 0; c <= this.n; c++) if (!this.v[r][c]) out.push(['v', r, c]);
		return out;
	}

	sides(r, c) { return (this.h[r][c] ? 1 : 0) + (this.h[r + 1][c] ? 1 : 0) + (this.v[r][c] ? 1 : 0) + (this.v[r][c + 1] ? 1 : 0); }

	/** Boxes touching a line. */
	touching([k, r, c]) {
		const out = [];
		if (k === 'h') { if (r > 0) out.push([r - 1, c]); if (r < this.n) out.push([r, c]); }
		else { if (c > 0) out.push([r, c - 1]); if (c < this.n) out.push([r, c]); }
		return out;
	}

	set(line, value) { const [k, r, c] = line; this[k][r][c] = value; }

	play(line, who) {
		this.set(line, who);
		this.last = line;
		let closed = 0;
		for (const [r, c] of this.touching(line)) {
			if (this.sides(r, c) === 4 && !this.boxes[r][c]) {
				this.boxes[r][c] = who;
				this.scores[who]++;
				closed++;
				this.burst(this.ox + (c + 0.5) * this.cell, this.oy + (r + 0.5) * this.cell, { count: 16, color: who === 1 ? YOU : CPU, speed: 140, life: 0.5, shape: 'star', size: 3 });
			}
		}
		this.ctx.audio.play(closed ? 'score' : 'click');
		this.ctx.score(this.scores[1]);
		if (this.scores[1] + this.scores[2] === this.n * this.n) return this.end();
		if (!closed) this.turn = 3 - who;
		this.status();
		if (this.turn === 2) this.cpu();
	}

	end() {
		const you = this.scores[1], cpu = this.scores[2];
		const win = you > cpu;
		this.ctx.audio.play(win ? 'win' : you === cpu ? 'score' : 'lose');
		if (win) this.ctx.fx.confetti({ count: 60 });
		setTimeout(() => this.finish({ win, title: win ? 'You win!' : you === cpu ? 'A draw' : 'The computer wins', message: `Boxes: you ${you}, computer ${cpu}.`, score: you }), 700);
	}

	/** How many boxes the opponent could chain-capture after `line` is drawn. */
	giveaway(line) {
		const saved = { h: this.h.map((r) => r.slice()), v: this.v.map((r) => r.slice()) };
		this.set(line, 9);
		let total = 0;
		for (;;) {
			const grab = this.lines().find((l) => this.touching(l).some(([r, c]) => this.sides(r, c) === 3));
			if (!grab) break;
			this.set(grab, 9);
			total++;
		}
		this.h = saved.h; this.v = saved.v;
		return total;
	}

	cpu() {
		this.cancel = think(() => {
			if (!this.running) return;
			const lines = this.lines().sort(() => Math.random() - 0.5);
			const d = this.ctx.settings.difficulty ?? 'normal';
			const sloppy = d === 'easy' ? 0.35 : d === 'normal' ? 0.1 : 0;
			const captures = (l) => this.touching(l).some(([r, c]) => this.sides(r, c) === 3);
			let move = Math.random() >= sloppy ? lines.find(captures) : null;
			if (!move) {
				const safe = lines.filter((l) => this.touching(l).every(([r, c]) => this.sides(r, c) < 2));
				if (safe.length && Math.random() >= sloppy) move = safe[0];
				else if (d === 'easy') move = lines[0];
				else {
					let best = Infinity;
					for (const l of lines) { const k = this.giveaway(l); if (k < best) { best = k; move = l; } }
				}
			}
			this.play(move, 2);
			this.wake();
		}, 450);
	}

	nearest(p) {
		let best = null, dist = this.cell * 0.3;
		for (const l of this.lines()) {
			const [k, r, c] = l;
			const x = this.ox + (k === 'h' ? c + 0.5 : c) * this.cell, y = this.oy + (k === 'h' ? r : r + 0.5) * this.cell;
			const d = Math.hypot(p.x - x, p.y - y);
			if (d < dist) { dist = d; best = l; }
		}
		return best;
	}

	pointerMove(p) { this.hover = this.running && this.turn === 1 ? this.nearest(p) : null; }

	pointerDown(p) {
		if (!this.running || this.turn !== 1) return;
		const l = this.nearest(p);
		if (l) { this.hover = null; this.play(l, 1); }
	}

	drawLine(g, [k, r, c], color, width) {
		const x = this.ox + c * this.cell, y = this.oy + r * this.cell;
		g.strokeStyle = color;
		g.lineWidth = width;
		g.lineCap = 'round';
		g.beginPath();
		g.moveTo(x, y);
		g.lineTo(x + (k === 'h' ? this.cell : 0), y + (k === 'v' ? this.cell : 0));
		g.stroke();
	}

	draw(g) {
		g.fillStyle = '#f8fafc';
		g.fillRect(0, 0, W, H);
		fillRound(g, 30, 20, 220, 50, 14, '#dbeafe');
		text(g, `You ${this.scores[1]}`, 140, 45, { size: 22, color: YOU });
		fillRound(g, W - 250, 20, 220, 50, 14, '#ffe4e6');
		text(g, `Computer ${this.scores[2]}`, W - 140, 45, { size: 22, color: CPU });
		g.strokeStyle = this.turn === 1 ? YOU : CPU;
		g.lineWidth = 3;
		g.beginPath(); g.roundRect(this.turn === 1 ? 30 : W - 250, 20, 220, 50, 14); g.stroke();
		for (let r = 0; r < this.n; r++) for (let c = 0; c < this.n; c++) {
			const who = this.boxes[r][c];
			if (who) {
				fillRound(g, this.ox + c * this.cell + 4, this.oy + r * this.cell + 4, this.cell - 8, this.cell - 8, 8, who === 1 ? '#bfdbfe' : '#fecdd3');
				text(g, who === 1 ? 'YOU' : 'CPU', this.ox + (c + 0.5) * this.cell, this.oy + (r + 0.5) * this.cell, { size: this.cell * 0.2, color: who === 1 ? YOU : CPU });
			}
		}
		if (this.hover) this.drawLine(g, this.hover, colors.accent + '88', 7);
		for (let r = 0; r <= this.n; r++) for (let c = 0; c < this.n; c++) if (this.h[r][c]) this.drawLine(g, ['h', r, c], this.h[r][c] === 1 ? YOU : CPU, 6);
		for (let r = 0; r < this.n; r++) for (let c = 0; c <= this.n; c++) if (this.v[r][c]) this.drawLine(g, ['v', r, c], this.v[r][c] === 1 ? YOU : CPU, 6);
		if (this.last) this.drawLine(g, this.last, 'rgba(255,255,255,0.6)', 2);
		for (let r = 0; r <= this.n; r++) for (let c = 0; c <= this.n; c++) circle(g, this.ox + c * this.cell, this.oy + r * this.cell, 7, '#1e293b');
	}

	teardown() { this.cancel?.(); }
}
