// Peg Jump: the classic cross-shaped peg solitaire. Jump a peg over a neighbour into an
// empty hole to remove the jumped peg. Finish with one peg (in the centre for a perfect
// game). Undo as often as you like.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { circle, text, colors, glow } from '../core/canvas.js';

const W = 560, H = 600;
const N = 7, CELL = 70, OX = (W - N * CELL) / 2, OY = 40;
const onBoard = (r, c) => (r >= 2 && r <= 4) || (c >= 2 && c <= 4);

export default class PegJump extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		return tool.bar(tool.button('Undo', () => this.undo()), tool.button('Hint', () => this.hint()));
	}

	reset() {
		super.reset();
		this.holes = [];
		this.pegs = new Set();
		for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (onBoard(r, c)) { this.holes.push(r * N + c); this.pegs.add(r * N + c); }
		this.pegs.delete(3 * N + 3);
		this.selected = -1;
		this.history = [];
		this.hinted = null;
		this.anim = null;
		this.ctx.score(this.pegs.size);
		this.ctx.info('Jump pegs to remove them');
	}

	isHole(i) { return this.holes.includes(i); }

	jumpsFrom(i) {
		const r = Math.floor(i / N), c = i % N, out = [];
		for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
			const mr = r + dr, mc = c + dc, tr = r + dr * 2, tc = c + dc * 2;
			if (tr < 0 || tr >= N || tc < 0 || tc >= N) continue;
			const mid = mr * N + mc, to = tr * N + tc;
			if (this.pegs.has(mid) && this.isHole(to) && !this.pegs.has(to)) out.push({ from: i, mid, to });
		}
		return out;
	}

	allJumps() { return [...this.pegs].flatMap((i) => this.jumpsFrom(i)); }

	pointerDown(p) {
		if (!this.running || this.anim) return;
		const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
		if (r < 0 || r >= N || c < 0 || c >= N) return;
		const i = r * N + c;
		if (this.pegs.has(i)) {
			this.selected = this.jumpsFrom(i).length ? i : -1;
			this.ctx.audio.play(this.selected >= 0 ? 'select' : 'error');
			return;
		}
		if (this.selected >= 0) {
			const jump = this.jumpsFrom(this.selected).find((j) => j.to === i);
			if (jump) return this.jump(jump);
			this.ctx.audio.play('error');
		}
	}

	jump(j) {
		this.history.push([...this.pegs]);
		this.anim = { ...j, t: 0 };
		this.selected = -1;
		this.hinted = null;
		this.ctx.audio.play('jump');
	}

	busy() { return Boolean(this.anim); }

	tick(dt) {
		const a = this.anim;
		if (!a || (a.t += dt / 0.25) < 1) return;
		this.anim = null;
		this.pegs.delete(a.from);
		this.pegs.delete(a.mid);
		this.pegs.add(a.to);
		this.ctx.audio.play('pop');
		const [mx, my] = this.center(a.mid);
		this.burst(mx, my, { count: 14, color: '#f59e0b', speed: 120, life: 0.45, shape: 'square', size: 3 });
		this.ctx.score(this.pegs.size);
		this.ctx.info(`${this.pegs.size} pegs left`);
		if (!this.allJumps().length) this.end();
	}

	end() {
		const n = this.pegs.size, centre = n === 1 && this.pegs.has(3 * N + 3);
		this.ctx.audio.play(n === 1 ? 'win' : 'lose');
		if (n === 1) this.ctx.fx.confetti({ count: centre ? 120 : 60 });
		const title = centre ? 'Perfect game!' : n === 1 ? 'One peg left!' : n <= 3 ? 'So close!' : 'No more jumps';
		setTimeout(() => this.finish({ win: n === 1, title, message: `${n} ${n === 1 ? 'peg' : 'pegs'} left${centre ? ', right in the centre' : ''}.`, score: n, lowerIsBetter: true }), 700);
	}

	undo() {
		if (!this.running || this.anim || !this.history.length) return;
		this.pegs = new Set(this.history.pop());
		this.selected = -1;
		this.ctx.score(this.pegs.size);
		this.ctx.audio.play('swoosh');
		this.wake();
	}

	hint() {
		if (!this.running) return;
		// prefer a jump that leaves the most follow-up jumps
		let best = null, bestScore = -1;
		for (const j of this.allJumps()) {
			const saved = new Set(this.pegs);
			this.pegs.delete(j.from); this.pegs.delete(j.mid); this.pegs.add(j.to);
			const score = this.allJumps().length;
			this.pegs = saved;
			if (score > bestScore) { bestScore = score; best = j; }
		}
		this.hinted = best;
		if (best) this.selected = best.from;
		this.wake();
	}

	center(i) { return [OX + (i % N + 0.5) * CELL, OY + (Math.floor(i / N) + 0.5) * CELL]; }

	draw(g) {
		g.fillStyle = '#3f2a1d';
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#7c4a2a';
		g.beginPath(); g.arc(W / 2, OY + (N * CELL) / 2, N * CELL * 0.56, 0, Math.PI * 2); g.fill();
		const targets = this.selected >= 0 ? this.jumpsFrom(this.selected).map((j) => j.to) : [];
		for (const i of this.holes) {
			const [x, y] = this.center(i);
			circle(g, x, y, 15, '#2b1a10');
			if (targets.includes(i)) { g.strokeStyle = colors.accent; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 20, 0, Math.PI * 2); g.stroke(); }
			if (this.hinted?.to === i) glow(g, x, y, 30, 'rgba(250,204,21,0.5)');
		}
		const a = this.anim;
		for (const i of this.pegs) {
			if (a && i === a.from) continue;
			const [x, y] = this.center(i);
			this.peg(g, x, y, i === this.selected, a && i === a.mid ? 1 - a.t : 1);
		}
		if (a) {
			const [x0, y0] = this.center(a.from), [x1, y1] = this.center(a.to);
			const t = a.t;
			this.peg(g, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * 40, true, 1);
		}
		text(g, `${this.pegs.size} pegs`, W / 2, H - 24, { size: 18, color: '#fde68a' });
	}

	peg(g, x, y, selected, scale) {
		if (scale <= 0) return;
		const grad = g.createRadialGradient(x - 6, y - 6, 2, x, y, 22 * scale);
		grad.addColorStop(0, selected ? '#fef9c3' : '#fde68a');
		grad.addColorStop(1, selected ? '#ca8a04' : '#b45309');
		g.fillStyle = grad;
		g.beginPath(); g.arc(x, y, 20 * scale, 0, Math.PI * 2); g.fill();
	}
}
