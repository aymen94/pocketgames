// Zen Tiles: a tile-matching solitaire on a three-layer pyramid. Pick two free tiles with
// the same symbol to clear them. A tile is free when nothing lies on it and its left or
// right side is open. Deals are built by removing free pairs from the full layout, so
// every deal has a solution; a reshuffle keeps that guarantee for the tiles still left.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, text, colors } from '../core/canvas.js';

const W = 760, H = 560;
const TW = 66, TH = 86, LIFT = 7;
const SYMBOLS = [['☀', '#f59e0b'], ['☾', '#6366f1'], ['★', '#eab308'], ['♣', '#16a34a'], ['♠', '#1e293b'], ['♥', '#e11d48'], ['♦', '#f97316'], ['✿', '#db2777'], ['❄', '#0ea5e9'], ['⚓', '#1d4ed8'], ['♪', '#7c3aed'], ['☂', '#0d9488'], ['✈', '#475569'], ['⚑', '#dc2626'], ['☘', '#15803d']];

function layout() {
	const tiles = [];
	for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) tiles.push({ l: 0, c, r });
	for (let r = 1; r < 4; r++) for (let c = 1; c < 7; c++) tiles.push({ l: 1, c, r });
	tiles.push({ l: 2, c: 3, r: 2 }, { l: 2, c: 4, r: 2 });
	return tiles;
}

export function isFree(tile, tiles) {
	let left = false, right = false;
	for (const t of tiles) {
		if (t === tile || t.gone) continue;
		if (t.l === tile.l + 1 && t.c === tile.c && t.r === tile.r) return false;
		if (t.l === tile.l && t.r === tile.r) {
			if (t.c === tile.c - 1) left = true;
			if (t.c === tile.c + 1) right = true;
		}
	}
	return !left || !right;
}

/** Gives the live tiles symbols so that removing them pair by pair is always possible. */
export function assign(tiles) {
	const live = tiles.filter((t) => !t.gone);
	const counts = new Map();
	for (const t of live) counts.set(t.s, (counts.get(t.s) ?? 0) + 1);
	const pairs = [];
	for (const [s, n] of counts) for (let i = 0; i < n / 2; i++) pairs.push(s);
	for (let attempt = 0; attempt < 200; attempt++) {
		const order = pairs.slice().sort(() => Math.random() - 0.5);
		const temp = live.map((t) => ({ ...t, gone: false, ref: t }));
		let ok = true;
		for (const s of order) {
			const free = temp.filter((t) => !t.gone && isFree(t, temp));
			if (free.length < 2) { ok = false; break; }
			free.sort(() => Math.random() - 0.5);
			free[0].gone = free[1].gone = true;
			free[0].ref.s = free[1].ref.s = s;
		}
		if (ok) return true;
	}
	return false;
}

export default class ZenTiles extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.pairsLabel = tool.label('');
		return tool.bar(this.pairsLabel, tool.button('Hint', () => this.hint()), tool.button('Shuffle', () => this.shuffle()), tool.button('Undo', () => this.undo()));
	}

	reset() {
		super.reset();
		this.tiles = layout();
		const symbols = [];
		for (let i = 0; i < this.tiles.length / 4; i++) symbols.push(i, i);
		this.tiles.forEach((t, i) => { t.s = symbols[Math.floor(i / 2) % symbols.length]; });
		assign(this.tiles);
		this.selected = null;
		this.hinted = [];
		this.history = [];
		this.shuffles = 0;
		this.started = performance.now();
		this.ctx.score(0);
		this.update0();
	}

	start() {
		super.start();
		this.started = performance.now();
	}

	update0() {
		const left = this.tiles.filter((t) => !t.gone).length;
		this.pairsLabel.textContent = `${left / 2} pairs left`;
		this.ctx.info(`${this.moves().length} moves available`);
	}

	moves() {
		const free = this.tiles.filter((t) => !t.gone && isFree(t, this.tiles));
		const out = [];
		for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) if (free[i].s === free[j].s) out.push([free[i], free[j]]);
		return out;
	}

	pos(t) {
		const x0 = (W - 8 * TW) / 2 + 10, y0 = (H - 5 * TH) / 2 + 6;
		return [x0 + t.c * TW - t.l * LIFT, y0 + t.r * TH - t.l * LIFT];
	}

	order() {
		return this.tiles.filter((t) => !t.gone).sort((a, b) => a.l - b.l || a.r - b.r || b.c - a.c);
	}

	pointerDown(p) {
		if (!this.running) return;
		const hit = this.order().reverse().find((t) => { const [x, y] = this.pos(t); return p.x >= x && p.x <= x + TW && p.y >= y && p.y <= y + TH; });
		if (!hit) { this.selected = null; return; }
		if (!isFree(hit, this.tiles)) { this.ctx.audio.play('error'); this.nudge = { t: hit, k: 1 }; return; }
		if (!this.selected || this.selected === hit) { this.selected = this.selected === hit ? null : hit; this.ctx.audio.play('select'); return; }
		if (this.selected.s !== hit.s) { this.selected = hit; this.ctx.audio.play('click'); return; }
		this.clear(this.selected, hit);
	}

	clear(a, b) {
		a.gone = b.gone = true;
		this.history.push([a, b]);
		this.selected = null;
		this.hinted = [];
		this.ctx.audio.play('chip');
		for (const t of [a, b]) {
			const [x, y] = this.pos(t);
			this.burst(x + TW / 2, y + TH / 2, { count: 14, color: SYMBOLS[t.s][1], speed: 140, life: 0.5, shape: 'star', size: 3 });
		}
		const left = this.tiles.filter((t) => !t.gone).length;
		this.ctx.score(this.history.length);
		this.update0();
		if (!left) {
			const secs = Math.round((performance.now() - this.started) / 1000);
			this.ctx.audio.play('win');
			this.ctx.fx.confetti({ count: 80 });
			setTimeout(() => this.finish({ win: true, title: 'Temple cleared!', message: `Cleared in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} with ${this.shuffles} ${this.shuffles === 1 ? 'shuffle' : 'shuffles'}.`, score: secs + this.shuffles * 30, lowerIsBetter: true }), 900);
		} else if (!this.moves().length) {
			this.ctx.fx.banner('No moves: shuffle!');
			this.ctx.audio.play('buzzer');
		}
	}

	hint() {
		if (!this.running) return;
		const m = this.moves();
		this.hinted = m.length ? m[0] : [];
		if (!m.length) this.ctx.fx.banner('No moves: shuffle!');
		this.wake();
	}

	shuffle() {
		if (!this.running) return;
		this.shuffles++;
		assign(this.tiles);
		this.selected = null;
		this.hinted = [];
		this.ctx.audio.play('swoosh');
		this.update0();
		this.wake();
	}

	undo() {
		if (!this.running || !this.history.length) return;
		for (const t of this.history.pop()) t.gone = false;
		this.ctx.audio.play('swoosh');
		this.ctx.score(this.history.length);
		this.update0();
		this.wake();
	}

	busy() { return Boolean(this.nudge); }
	tick(dt) { if (this.nudge && (this.nudge.k -= dt * 4) <= 0) this.nudge = null; }

	draw(g) {
		const bg = g.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
		bg.addColorStop(0, '#14532d');
		bg.addColorStop(1, '#052e16');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		for (const t of this.order()) {
			let [x, y] = this.pos(t);
			if (this.nudge?.t === t) x += Math.sin(this.nudge.k * 20) * 4 * this.nudge.k;
			const free = isFree(t, this.tiles);
			fillRound(g, x + 5, y + 6, TW - 2, TH - 2, 9, 'rgba(0,0,0,0.35)');
			fillRound(g, x + 3, y + 3, TW - 2, TH - 2, 9, '#a8a29e');
			fillRound(g, x, y, TW - 2, TH - 2, 9, t === this.selected ? '#fef08a' : this.hinted.includes(t) ? '#bae6fd' : free ? '#fafaf9' : '#e7e5e4');
			const [glyph, color] = SYMBOLS[t.s];
			text(g, glyph, x + TW / 2 - 1, y + TH / 2, { size: 36, color: free ? color : color + '99', font: 'serif' });
			if (t === this.selected) { g.strokeStyle = colors.accent; g.lineWidth = 3; g.beginPath(); g.roundRect(x, y, TW - 2, TH - 2, 9); g.stroke(); }
		}
	}
}
