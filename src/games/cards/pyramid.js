// Pyramid: clear a pyramid of 28 cards by removing pairs that add up to 13 (Jack 11,
// Queen 12, King 13 on its own). A card is free once both cards covering it are gone.
// The stock is turned onto a waste pile; its top card may pair too. Three passes.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { drawCard, drawSlot, makeDeck } from '../core/cards.js';
import { text, colors } from '../core/canvas.js';

const CW = 64, CH = 90, W = 640, H = 600;
const PASSES = 3;

export default class Pyramid extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.label = tool.label('');
		return tool.bar(this.label, tool.button('Undo', () => this.undo()));
	}

	reset() {
		super.reset();
		const deck = makeDeck();
		deck.forEach((c) => { c.up = true; });
		this.pyramid = [];
		for (let r = 0; r < 7; r++) for (let c = 0; c <= r; c++) this.pyramid.push({ r, c, card: deck.pop(), gone: false });
		this.stock = deck;
		this.waste = [];
		this.pass = 1;
		this.selected = null;
		this.history = [];
		this.score = 0;
		this.ctx.score(0);
		this.status();
	}

	status() {
		this.label.textContent = `Pass ${this.pass}/${PASSES} · Stock ${this.stock.length}`;
		this.ctx.info(`${this.pyramid.filter((t) => !t.gone).length} cards left in the pyramid`);
	}

	pos(t) { return [W / 2 - CW / 2 + (t.c - t.r / 2) * (CW + 8), 20 + t.r * 46]; }

	free(t) {
		if (t.gone) return false;
		return !this.pyramid.some((o) => !o.gone && o.r === t.r + 1 && (o.c === t.c || o.c === t.c + 1));
	}

	stockRect() { return [W / 2 - CW - 60, H - CH - 30]; }
	wasteRect() { return [W / 2 + 60, H - CH - 30]; }

	snapshot() { return { gone: this.pyramid.map((t) => t.gone), stock: this.stock.slice(), waste: this.waste.slice(), pass: this.pass, score: this.score }; }

	pointerDown(p) {
		if (!this.running) return;
		const inRect = ([x, y]) => p.x >= x && p.x <= x + CW && p.y >= y && p.y <= y + CH;
		if (inRect(this.stockRect())) return this.draw1();
		let hit = null;
		if (inRect(this.wasteRect()) && this.waste.length) hit = { waste: true, card: this.waste.at(-1) };
		for (let i = this.pyramid.length - 1; i >= 0 && !hit; i--) {
			const t = this.pyramid[i];
			if (!t.gone && inRect(this.pos(t))) hit = this.free(t) ? { t, card: t.card } : 'blocked';
		}
		if (hit === 'blocked') return this.ctx.audio.play('error');
		if (!hit) { this.selected = null; return; }
		if (hit.card.rank === 13) return this.remove([hit]);
		if (!this.selected) { this.selected = hit; this.ctx.audio.play('select'); return; }
		if (this.selected.card === hit.card) { this.selected = null; return; }
		if (this.selected.card.rank + hit.card.rank === 13) return this.remove([this.selected, hit]);
		this.selected = hit;
		this.ctx.audio.play('click');
	}

	remove(items) {
		this.history.push(this.snapshot());
		for (const it of items) {
			const [x, y] = it.waste ? this.wasteRect() : this.pos(it.t);
			if (it.waste) this.waste.pop(); else it.t.gone = true;
			this.burst(x + CW / 2, y + CH / 2, { count: 12, colors: ['#fde047', colors.accent], speed: 140, life: 0.5, shape: 'star', size: 3 });
		}
		this.score += items.some((i) => i.t) ? 10 * items.length : 5;
		this.selected = null;
		this.ctx.audio.play('chip');
		this.ctx.score(this.score);
		this.status();
		if (this.pyramid.every((t) => t.gone)) {
			this.score += 100 + this.stock.length * 5 + (PASSES - this.pass) * 50;
			this.ctx.score(this.score);
			this.ctx.audio.play('win');
			this.ctx.fx.confetti({ count: 90 });
			setTimeout(() => this.finish({ win: true, title: 'Pyramid cleared!', message: `Cleared on pass ${this.pass}.`, score: this.score }), 900);
		} else this.checkStuck();
	}

	draw1() {
		if (!this.stock.length) {
			if (this.pass >= PASSES) return this.ctx.audio.play('error');
			this.history.push(this.snapshot());
			this.pass++;
			this.stock = this.waste.reverse();
			this.waste = [];
			this.ctx.audio.play('swoosh');
		} else {
			this.history.push(this.snapshot());
			this.waste.push(this.stock.pop());
			this.ctx.audio.play('card');
		}
		this.selected = null;
		this.status();
		this.checkStuck();
	}

	checkStuck() {
		if (this.stock.length || this.pass < PASSES) return;
		const open = this.pyramid.filter((t) => this.free(t)).map((t) => t.card);
		if (this.waste.length) open.push(this.waste.at(-1));
		const canPair = open.some((a) => a.rank === 13 || open.some((b) => a !== b && a.rank + b.rank === 13));
		if (!canPair) {
			this.ctx.audio.play('lose');
			setTimeout(() => this.finish({ win: false, title: 'No more moves', message: `${this.pyramid.filter((t) => !t.gone).length} cards left in the pyramid.`, score: this.score }), 700);
		}
	}

	undo() {
		if (!this.running || !this.history.length) return;
		const s = this.history.pop();
		this.pyramid.forEach((t, i) => { t.gone = s.gone[i]; });
		this.stock = s.stock; this.waste = s.waste; this.pass = s.pass; this.score = s.score;
		this.selected = null;
		this.ctx.score(this.score);
		this.ctx.audio.play('flip');
		this.status();
		this.wake();
	}

	draw(g) {
		g.fillStyle = '#7f1d1d';
		g.fillRect(0, 0, W, H);
		for (const t of this.pyramid) {
			if (t.gone) continue;
			const [x, y] = this.pos(t);
			drawCard(g, t.card, x, y, CW, CH, { highlight: this.selected?.t === t });
			if (!this.free(t)) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(x, y, CW, CH, 6); g.fill(); }
		}
		const [sx, sy] = this.stockRect(), [wx, wy] = this.wasteRect();
		if (this.stock.length) drawCard(g, { up: false }, sx, sy, CW, CH);
		else drawSlot(g, sx, sy, CW, CH, this.pass < PASSES ? '↺' : '×');
		if (this.waste.length) drawCard(g, this.waste.at(-1), wx, wy, CW, CH, { highlight: Boolean(this.selected?.waste) });
		else drawSlot(g, wx, wy, CW, CH);
		text(g, 'Stock', sx + CW / 2, sy - 12, { size: 12, color: '#fecaca' });
		text(g, 'Waste', wx + CW / 2, wy - 12, { size: 12, color: '#fecaca' });
		text(g, 'Pairs make 13 · K = 13', W / 2, H - 70, { size: 14, color: '#fecaca' });
	}
}
