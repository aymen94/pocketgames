// Make 24: combine four numbers with + − × ÷ to reach exactly 24. Pick a number, an
// operator and another number; the two merge into the result. Every deal is checked by a
// solver first. Solve as many as you can in three minutes.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, text, colors } from '../core/canvas.js';

const W = 560, H = 560, TIME = 180;
const OPS = ['+', '−', '×', '÷'];

const apply = (a, b, op) => (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : b === 0 ? NaN : a / b);
const close = (a, b) => Math.abs(a - b) < 1e-6;

/** A solution expression for `nums` (any order, any brackets), or null. */
export function solve(items) {
	if (items.length === 1) return close(items[0].v, 24) ? items[0].e : null;
	for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
		if (i === j) continue;
		const rest = items.filter((_, k) => k !== i && k !== j);
		for (const op of OPS) {
			if ((op === '+' || op === '×') && i > j) continue;
			const v = apply(items[i].v, items[j].v, op);
			if (!Number.isFinite(v)) continue;
			const found = solve([...rest, { v, e: `(${items[i].e} ${op} ${items[j].e})` }]);
			if (found) return found;
		}
	}
	return null;
}

const fmt = (v) => (Number.isInteger(Math.round(v * 1e6) / 1e6) ? String(Math.round(v)) : (Math.round(v * 100) / 100).toString());

export default class Make24 extends CanvasGame {
	static W = W;
	static H = H;
	static realtime = true;

	buildToolbar() {
		return tool.bar(tool.button('Undo', () => this.undo()), tool.button('Reset', () => this.restart()), tool.button('Skip', () => this.skip(), { title: 'New numbers (costs 10 seconds)' }), tool.button('Hint', () => this.hint()));
	}

	reset() {
		super.reset();
		this.solved = 0;
		this.time = TIME;
		this.ctx.score(0);
		this.deal();
	}

	deal() {
		const max = (this.ctx.settings.difficulty ?? 'normal') === 'easy' ? 9 : 13;
		let nums;
		do nums = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * max));
		while (!solve(nums.map((v) => ({ v, e: String(v) }))));
		this.start4 = nums;
		this.restart(true);
	}

	restart(quiet = false) {
		this.cards = this.start4.map((v, i) => ({ v, id: i, alive: true }));
		this.history = [];
		this.pick = null;
		this.op = null;
		this.hintText = '';
		if (!quiet) this.ctx.audio.play('swoosh');
	}

	skip() {
		if (!this.running) return;
		this.time = Math.max(1, this.time - 10);
		this.ctx.audio.play('flip');
		this.deal();
	}

	hint() {
		if (!this.running) return;
		const live = this.cards.filter((c) => c.alive);
		const s = solve(live.map((c) => ({ v: c.v, e: fmt(c.v) })));
		this.hintText = s ? `Try: ${s.slice(1, -1)}` : 'This path cannot reach 24: Undo';
		this.time = Math.max(1, this.time - 5);
	}

	undo() {
		if (!this.running || !this.history.length) return;
		this.cards = this.history.pop();
		this.pick = null;
		this.op = null;
		this.ctx.audio.play('swoosh');
	}

	cardRect(i) {
		const live = this.cards.filter((c) => c.alive);
		const n = live.length, w = 110, gap = 18;
		return [W / 2 - (n * w + (n - 1) * gap) / 2 + i * (w + gap), 150, w, 130];
	}

	opRect(i) { return [W / 2 - 2 * 84 + i * 84 + 4, 330, 76, 70]; }

	pointerDown(p) {
		if (!this.running) return;
		const inside = ([x, y, w, h]) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
		for (let i = 0; i < OPS.length; i++) if (inside(this.opRect(i))) { if (this.pick) { this.op = OPS[i]; this.ctx.audio.play('click'); } return; }
		const live = this.cards.filter((c) => c.alive);
		const idx = live.findIndex((_, i) => inside(this.cardRect(i)));
		if (idx < 0) return;
		const card = live[idx];
		if (this.pick && this.op && card !== this.pick) return this.combine(this.pick, card, this.op);
		this.pick = this.pick === card ? null : card;
		this.op = null;
		this.ctx.audio.play('select');
	}

	key(action, event) {
		const k = event?.key;
		const map = { '+': '+', '-': '−', '*': '×', x: '×', '/': '÷' };
		if (map[k] && this.pick) this.op = map[k];
		const n = Number(k);
		const live = this.cards.filter((c) => c.alive);
		if (n >= 1 && n <= live.length) {
			const card = live[n - 1];
			if (this.pick && this.op && card !== this.pick) this.combine(this.pick, card, this.op);
			else { this.pick = card; this.op = null; }
		}
	}

	combine(a, b, op) {
		const v = apply(a.v, b.v, op);
		if (!Number.isFinite(v)) { this.ctx.audio.play('error'); this.popup('Cannot divide by zero', W / 2, 120, { color: '#fca5a5', size: 16 }); return; }
		this.history.push(this.cards.map((c) => ({ ...c })));
		this.cards = this.cards.map((c) => (c === a ? { ...c, v } : c === b ? { ...c, alive: false } : c));
		this.pick = null;
		this.op = null;
		this.hintText = '';
		this.ctx.audio.play('place');
		const live = this.cards.filter((c) => c.alive);
		if (live.length === 1) {
			if (close(live[0].v, 24)) {
				this.solved++;
				this.ctx.score(this.solved);
				this.ctx.audio.play('score');
				this.burst(W / 2, 215, { count: 30, colors: ['#fde047', colors.accent, '#4ade80'], speed: 200, life: 0.7, shape: 'star', size: 4 });
				this.popup('24!', W / 2, 110, { color: '#fde047', size: 36 });
				this.deal();
			} else {
				this.ctx.audio.play('error');
				this.popup(`${fmt(live[0].v)} is not 24`, W / 2, 110, { color: '#fca5a5', size: 20 });
				setTimeout(() => { if (this.running && this.cards.filter((c) => c.alive).length === 1) this.restart(); }, 700);
			}
		}
	}

	step(dt) {
		this.time -= dt;
		if (this.time <= 0) {
			this.time = 0;
			this.ctx.audio.play('buzzer');
			this.finish({ win: this.solved > 0, title: 'Time!', message: `You made 24 ${this.solved} ${this.solved === 1 ? 'time' : 'times'}.`, score: this.solved });
		}
	}

	draw(g) {
		g.fillStyle = '#0c1424';
		g.fillRect(0, 0, W, H);
		const t = Math.ceil(this.time);
		fillRound(g, 30, 24, W - 60, 12, 6, '#1e293b');
		fillRound(g, 30, 24, (W - 60) * (this.time / TIME), 12, 6, this.time < 30 ? '#ef4444' : colors.accent);
		text(g, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}   ·   solved ${this.solved}`, W / 2, 60, { size: 18, color: '#e2e8f0' });
		text(g, 'Make 24', W / 2, 98, { size: 14, color: '#64748b' });
		const live = this.cards.filter((c) => c.alive);
		live.forEach((c, i) => {
			const [x, y, w, h] = this.cardRect(i);
			const sel = c === this.pick;
			fillRound(g, x, y + (sel ? -8 : 0), w, h, 16, sel ? '#fde68a' : '#f8fafc');
			text(g, fmt(c.v), x + w / 2, y + h / 2 + (sel ? -8 : 0), { size: fmt(c.v).length > 3 ? 30 : 44, color: '#0f172a' });
			text(g, String(i + 1), x + 14, y + 16 + (sel ? -8 : 0), { size: 11, color: '#94a3b8' });
		});
		OPS.forEach((op, i) => {
			const [x, y, w, h] = this.opRect(i);
			fillRound(g, x, y, w, h, 14, this.op === op ? colors.accent : this.pick ? '#334155' : '#1e293b');
			text(g, op, x + w / 2, y + h / 2, { size: 34, color: this.pick ? '#f8fafc' : '#475569' });
		});
		text(g, this.pick ? (this.op ? 'Now pick the second number' : 'Pick an operator') : 'Pick a number', W / 2, 440, { size: 16, color: '#94a3b8' });
		if (this.hintText) text(g, this.hintText, W / 2, 490, { size: 16, color: '#fde68a' });
	}
}
