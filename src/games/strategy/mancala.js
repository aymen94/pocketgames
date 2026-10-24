// Mancala (Kalah rules): sow the seeds of one of your pits anticlockwise, one per pit,
// including your own store but skipping your opponent's. Ending in your store earns another
// turn; ending in an empty pit of yours captures the seeds opposite. Most seeds wins.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { negamax, think } from '../core/ai.js';

const W = 800, H = 420;
const STORE = [6, 13];

export function sow(state, pit) {
	const b = state.b.slice();
	const side = state.side;
	let seeds = b[pit];
	b[pit] = 0;
	let i = pit;
	while (seeds > 0) {
		i = (i + 1) % 14;
		if (i === STORE[1 - side]) continue;
		b[i]++;
		seeds--;
	}
	const own = side === 0 ? i >= 0 && i <= 5 : i >= 7 && i <= 12;
	let captured = 0;
	if (own && b[i] === 1 && b[12 - i] > 0) {
		captured = b[12 - i] + 1;
		b[STORE[side]] += captured;
		b[i] = 0;
		b[12 - i] = 0;
	}
	const again = i === STORE[side];
	// game over when one side is empty: the other side banks what is left
	const empty0 = b.slice(0, 6).every((x) => !x), empty1 = b.slice(7, 13).every((x) => !x);
	let over = false;
	if (empty0 || empty1) {
		over = true;
		for (let k = 0; k < 6; k++) { b[6] += b[k]; b[k] = 0; b[13] += b[k + 7]; b[k + 7] = 0; }
	}
	return { b, side: again && !over ? side : 1 - side, sameSide: again && !over, over, last: i, captured };
}

const rules = {
	moves: (s) => (s.over ? [] : [0, 1, 2, 3, 4, 5].map((k) => k + (s.side ? 7 : 0)).filter((k) => s.b[k] > 0)),
	apply: (s, m) => sow(s, m),
	terminal: (s) => s.over,
	evaluate: (s) => (s.b[STORE[s.side]] - s.b[STORE[1 - s.side]]) * (s.over ? 100 : 1),
	order: (s, moves) => moves.sort((a, b) => ((b + s.b[b]) % 13 === STORE[s.side] ? 1 : 0) - ((a + s.b[a]) % 13 === STORE[s.side] ? 1 : 0)),
};

export default class Mancala extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.cancel?.();
		const seeds = Number(this.ctx.settings.seeds ?? 4);
		this.state = { b: [...Array(6).fill(seeds), 0, ...Array(6).fill(seeds), 0], side: 0, over: false };
		this.anim = null;
		this.hover = -1;
		this.ctx.score(0);
		this.status();
	}

	status() {
		this.ctx.info(this.state.over ? 'Game over' : this.state.side === 0 ? 'Your turn: pick a pit on the bottom row' : 'Computer is thinking…');
	}

	pitPos(i) {
		if (i === 6) return [W - 70, H / 2];
		if (i === 13) return [70, H / 2];
		if (i < 6) return [170 + i * 92, H / 2 + 80];
		return [170 + (12 - i) * 92, H / 2 - 80];
	}

	pointerMove(p) {
		this.hover = -1;
		if (this.state.side !== 0 || this.anim) return;
		for (let i = 0; i < 6; i++) { const [x, y] = this.pitPos(i); if (Math.hypot(p.x - x, p.y - y) < 40 && this.state.b[i]) this.hover = i; }
	}

	pointerDown(p) {
		if (!this.running || this.state.side !== 0 || this.anim) return;
		this.pointerMove(p);
		if (this.hover >= 0) this.move(this.hover);
	}

	key(action, event) {
		const n = Number(event?.key);
		if (n >= 1 && n <= 6 && this.state.side === 0 && !this.anim && this.state.b[n - 1]) this.move(n - 1);
	}

	move(pit) {
		const before = this.state.b.slice();
		const next = sow(this.state, pit);
		// animate the seeds landing one pit at a time
		const path = [];
		let i = pit, seeds = before[pit];
		while (seeds > 0) { i = (i + 1) % 14; if (i === STORE[1 - this.state.side]) continue; path.push(i); seeds--; }
		this.anim = { before, path, step: 0, t: 0, next, who: this.state.side, from: pit };
		this.hover = -1;
	}

	busy() { return Boolean(this.anim); }

	tick(dt) {
		const a = this.anim;
		if (!a) return;
		a.t += dt;
		while (a.t > 0.12 && a.step < a.path.length) {
			a.t -= 0.12;
			a.step++;
			this.ctx.audio.play('tick');
		}
		if (a.step >= a.path.length && a.t > 0.25) {
			this.anim = null;
			this.state = a.next;
			if (a.next.captured) {
				this.ctx.audio.play('chip');
				const [x, y] = this.pitPos(a.next.last);
				this.popup(`Capture +${a.next.captured}`, x, y - 50, { color: '#fde047', size: 20 });
			} else if (a.next.sameSide) {
				this.ctx.audio.play('powerup');
				const [x, y] = this.pitPos(STORE[a.who]);
				this.popup('Extra turn!', x, y - 80, { color: '#a7f3d0', size: 18 });
			}
			this.ctx.score(this.state.b[6]);
			if (this.state.over) return this.end();
			this.status();
			if (this.state.side === 1) this.cpu();
		}
	}

	cpu() {
		this.cancel = think(() => {
			if (!this.running) return;
			const depth = { easy: 1, normal: 5, hard: 8 }[this.ctx.settings.difficulty ?? 'normal'] ?? 4;
			const { move } = negamax(this.state, depth, rules);
			this.move(move ?? rules.moves(this.state)[0]);
			this.wake();
		}, 600);
	}

	end() {
		const you = this.state.b[6], cpu = this.state.b[13];
		const win = you > cpu;
		this.ctx.audio.play(win ? 'win' : 'lose');
		if (win) this.ctx.fx.confetti({ count: 60 });
		this.status();
		setTimeout(() => this.finish({ win, title: win ? 'You win!' : you === cpu ? 'A draw' : 'The computer wins', message: `Stores: you ${you}, computer ${cpu}.`, score: you }), 800);
	}

	seeds(g, x, y, n, seed) {
		for (let k = 0; k < n; k++) {
			const a = (k * 2.39996) + seed, r = Math.min(26, 4 + Math.sqrt(k) * 6);
			const hue = (k * 47 + seed * 31) % 360;
			g.fillStyle = `hsl(${hue} 70% 62%)`;
			g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 5.5, 0, Math.PI * 2); g.fill();
		}
	}

	draw(g) {
		g.fillStyle = '#0f172a';
		g.fillRect(0, 0, W, H);
		fillRound(g, 20, 40, W - 40, H - 80, 120, '#92400e');
		fillRound(g, 30, 50, W - 60, H - 100, 110, '#b45309');
		const a = this.anim;
		const b = a ? a.before.slice() : this.state.b;
		if (a) { b[a.from] = 0; for (let k = 0; k < a.step; k++) b[a.path[k]]++; b[a.from] += a.path.length - a.step; }
		for (let i = 0; i < 14; i++) {
			const [x, y] = this.pitPos(i);
			const store = i === 6 || i === 13;
			g.fillStyle = '#78350f';
			g.beginPath();
			if (store) g.ellipse(x, y, 42, 120, 0, 0, Math.PI * 2); else g.arc(x, y, 38, 0, Math.PI * 2);
			g.fill();
			if (i === this.hover) { g.strokeStyle = colors.accent; g.lineWidth = 4; g.stroke(); }
			if (store) {
				// seeds in the stores fill in a column
				for (let k = 0; k < b[i]; k++) { g.fillStyle = `hsl(${(k * 47 + i * 31) % 360} 70% 62%)`; g.beginPath(); g.arc(x - 18 + (k % 4) * 12, y + 100 - Math.floor(k / 4) * 11, 5, 0, Math.PI * 2); g.fill(); }
			} else this.seeds(g, x, y, b[i], i);
			const lx = x, ly = store ? y + (i === 6 ? 150 : -150) : y + (i < 6 ? 58 : -58);
			text(g, String(b[i]), lx, ly, { size: store ? 22 : 16, color: '#fde68a' });
		}
		text(g, 'COMPUTER', 70, 22, { size: 12, color: '#fca5a5' });
		text(g, 'YOU', W - 70, H - 18, { size: 12, color: '#93c5fd' });
	}

	teardown() { this.cancel?.(); }
}
