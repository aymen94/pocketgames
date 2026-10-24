// Playing cards: decks, drawing on Canvas 2D, and a table of piles with drag and drop.
// Klondike, Spider and Blackjack share all of it and only add their rules.

import { shuffle } from './ai.js';
import { fillRound, roundRect, text, colors } from './canvas.js';
import { Animator, ease, reducedMotion } from './fx.js';

export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const isRed = (card) => card.suit === 1 || card.suit === 2;

/** A shuffled deck of `decks` × 52 cards, optionally limited to some suits (Spider). */
export function makeDeck({ decks = 1, suits = [0, 1, 2, 3] } = {}) {
	const cards = [];
	const copies = (decks * 4) / suits.length;
	for (let d = 0; d < copies; d++) {
		// `id` survives JSON snapshots (undo, saved games), so moves can be animated across them
		for (const suit of suits) for (let rank = 1; rank <= 13; rank++) cards.push({ id: cards.length, suit, rank, up: false });
	}
	return shuffle(cards);
}

/** Draws a card face or back with its top-left corner at (x, y). */
export function drawCard(g, card, x, y, w, h, { highlight = false, flip = 1, lift = 0 } = {}) {
	// `flip` (0..1) turns the card over around its vertical axis: the back shows until halfway
	if (flip < 1) {
		const sx = Math.abs(Math.cos(flip * Math.PI));
		g.save();
		g.translate(x + w / 2, y);
		g.scale(Math.max(0.04, sx), 1);
		drawCard(g, flip < 0.5 ? { ...card, up: false } : card, -w / 2, 0, w, h, { highlight });
		g.restore();
		return;
	}
	const r = w * 0.09;
	g.save();
	if (lift) {
		g.shadowColor = 'rgba(0,0,0,0.45)';
		g.shadowBlur = 6 + lift * 14;
		g.shadowOffsetY = 2 + lift * 8;
	}
	if (!lift) {
		g.shadowColor = 'rgba(0,0,0,0.35)';
		g.shadowBlur = 6;
		g.shadowOffsetY = 2;
	}
	fillRound(g, x, y, w, h, r, card.up ? '#fbfbff' : '#3a4fd6');
	g.restore();
	if (!card.up) {
		g.save();
		roundRect(g, x + w * 0.08, y + w * 0.08, w * 0.84, h - w * 0.16, r * 0.6);
		g.clip();
		g.fillStyle = '#5b6ff0';
		g.fillRect(x, y, w, h);
		g.strokeStyle = 'rgba(255,255,255,0.18)';
		g.lineWidth = 2;
		for (let i = -h; i < w + h; i += 9) {
			g.beginPath();
			g.moveTo(x + i, y);
			g.lineTo(x + i + h, y + h);
			g.stroke();
		}
		g.restore();
	} else {
		const color = isRed(card) ? '#e11d48' : '#1e2340';
		const size = Math.max(10, w * 0.24);
		text(g, RANKS[card.rank], x + w * 0.07, y + size * 0.62, { size, color, align: 'left' });
		text(g, SUITS[card.suit], x + w * 0.07, y + size * 1.55, { size: size * 0.85, color, align: 'left' });
		text(g, SUITS[card.suit], x + w * 0.62, y + h * 0.66, { size: w * 0.5, color });
	}
	g.lineWidth = highlight ? 3 : 1;
	g.strokeStyle = highlight ? colors.amber : 'rgba(0,0,0,0.25)';
	roundRect(g, x + 0.5, y + 0.5, w - 1, h - 1, r);
	g.stroke();
}

/** An empty pile's outline, with an optional label (A for foundations, ↺ for stock). */
export function drawSlot(g, x, y, w, h, label = '') {
	g.strokeStyle = 'rgba(255,255,255,0.22)';
	g.lineWidth = 2;
	g.setLineDash([6, 5]);
	roundRect(g, x + 1, y + 1, w - 2, h - 2, w * 0.09);
	g.stroke();
	g.setLineDash([]);
	if (label) text(g, label, x + w / 2, y + h / 2, { size: w * 0.32, color: 'rgba(255,255,255,0.3)' });
}

/**
 * Piles of cards on a canvas with dragging. Each pile: { x, y, cards, fan, kind, label }.
 * `fan` is how far apart face-up cards are drawn vertically (0 stacks them); `fanX`
 * spreads the top three cards of a stacked pile sideways (a draw-three waste).
 * The rules object answers:
 *   canDrag(pile, index)                 whether the run from `index` can be picked up
 *   drop(from, index, to)                moves the run if allowed, returns true when it moved
 *   tap(pile, index)                     a click without dragging (stock, auto-move)
 */
export class PileTable {
	constructor(surface, rules, { cardW = 70, cardH = 98 } = {}) {
		this.surface = surface;
		this.rules = rules;
		this.cardW = cardW;
		this.cardH = cardH;
		this.piles = [];
		this.drag = null;
		this.enabled = true;
		// motion: cards glide from where they were to where the rules put them
		this.moves = new Map(); // card -> { x, y, t, delay }
		this.flips = new Map(); // card -> t
		this.redraw = () => {};
		this.animator = new Animator((dt) => this.tick(dt), () => this.moves.size > 0 || this.flips.size > 0);
	}

	/** Where every card is drawn right now (including a card being dragged). */
	capture() {
		const map = new Map();
		for (const pile of this.piles) {
			pile.cards.forEach((card, i) => map.set(card.id ?? card, { x: this.cardX(pile, i), y: this.cardY(pile, i), up: card.up }));
		}
		const d = this.drag;
		if (d?.offset && d.moved) {
			const fan = d.from.fan ? Math.max(this.step(d.from).up, 18) : 22;
			for (let i = d.index; i < d.from.cards.length; i++) {
				map.set(d.from.cards[i].id ?? d.from.cards[i], { x: d.point.x - d.offset.x, y: d.point.y - d.offset.y + (i - d.index) * fan, up: true });
			}
		}
		return map;
	}

	/** Starts glides for every card whose place changed since `before`, and flips for new face-ups. */
	animateFrom(before, { duration = 0.2 } = {}) {
		if (reducedMotion()) return;
		let n = 0;
		for (const pile of this.piles) {
			pile.cards.forEach((card, i) => {
				const was = before.get(card.id ?? card);
				if (!was) return;
				const x = this.cardX(pile, i), y = this.cardY(pile, i);
				if (Math.hypot(was.x - x, was.y - y) > 1) this.moves.set(card, { x: was.x, y: was.y, t: -Math.min(n++, 6) * 0.03, duration });
				if (!was.up && card.up) this.flips.set(card, -0.12);
			});
		}
		this.animator.wake();
	}

	/** Deals every card in from (x, y), one after another. */
	deal(x, y, stagger = 0.025) {
		if (reducedMotion()) return;
		let n = 0;
		for (const pile of this.piles) {
			if (pile.kind === 'stock') continue;
			for (const card of pile.cards) {
				this.moves.set(card, { x, y, t: -n * stagger, duration: 0.28 });
				if (card.up) this.flips.set(card, -n * stagger - 0.2);
				n++;
			}
		}
		this.animator.wake();
	}

	tick(dt) {
		for (const [card, m] of this.moves) { m.t += dt / m.duration; if (m.t >= 1) this.moves.delete(card); }
		for (const [card, t] of this.flips) { const next = t + dt / 0.22; if (next >= 1) this.flips.delete(card); else this.flips.set(card, next); }
		this.redraw();
	}

	/** Draw position of a card: its glide position if moving, else its place. */
	placed(card, x, y) {
		const m = this.moves.get(card);
		if (!m) return { x, y, moving: false };
		if (m.t <= 0) return { x: m.x, y: m.y, moving: true };
		const k = ease.outCubic(m.t);
		return { x: m.x + (x - m.x) * k, y: m.y + (y - m.y) * k, moving: true };
	}

	drawOne(g, card, x, y, later) {
		const p = this.placed(card, x, y);
		const f = this.flips.get(card);
		const flip = f === undefined ? 1 : Math.max(0, f);
		// moving cards are drawn last so they pass over the table
		if (p.moving && later) later.push([card, p.x, p.y, flip]);
		else drawCard(this.surface.g, card, p.x, p.y, this.cardW, this.cardH, { flip });
	}

	/** Vertical step of card `i` in a pile, compressing long piles to fit the table. */
	step(pile) {
		if (!pile.fan) return { up: 0, down: 0 };
		const room = this.surface.height - pile.y - this.cardH - 6;
		let up = pile.fan, down = pile.fan * 0.45;
		const ups = pile.cards.filter((c) => c.up).length;
		const downs = pile.cards.length - ups;
		const need = Math.max(0, ups - 1) * up + downs * down;
		if (need > room && need > 0) {
			const k = room / need;
			up *= k; down *= k;
		}
		return { up, down };
	}

	cardY(pile, index) {
		const { up, down } = this.step(pile);
		let y = pile.y;
		for (let i = 0; i < index; i++) y += pile.cards[i].up ? up : down;
		return y;
	}

	cardX(pile, index) {
		if (!pile.fanX) return pile.x;
		return pile.x + Math.max(0, index - Math.max(0, pile.cards.length - 3)) * pile.fanX;
	}

	/** The pile and card index under a point, or the pile alone when it is empty. */
	hit(p) {
		for (const pile of this.piles) {
			const right = pile.x + this.cardW + (pile.fanX ? pile.fanX * 2 : 0);
			if (p.x < pile.x || p.x > right) continue;
			if (pile.cards.length === 0) {
				if (p.y >= pile.y && p.y <= pile.y + this.cardH && p.x <= pile.x + this.cardW) return { pile, index: -1 };
				continue;
			}
			for (let i = pile.cards.length - 1; i >= 0; i--) {
				const x = this.cardX(pile, i), y = this.cardY(pile, i);
				if (p.x >= x && p.x <= x + this.cardW && p.y >= y && p.y <= y + this.cardH) return { pile, index: pile.fan ? i : pile.cards.length - 1 };
			}
		}
		return null;
	}

	pointerDown(p) {
		if (!this.enabled) return;
		const hit = this.hit(p);
		if (!hit) return;
		this.drag = { from: hit.pile, index: hit.index, start: p, offset: null, moved: false, point: p };
		if (hit.index >= 0 && this.rules.canDrag(hit.pile, hit.index)) {
			this.drag.offset = { x: p.x - this.cardX(hit.pile, hit.index), y: p.y - this.cardY(hit.pile, hit.index) };
		}
	}

	pointerMove(p) {
		if (!this.drag) return;
		this.drag.point = p;
		if (Math.hypot(p.x - this.drag.start.x, p.y - this.drag.start.y) > 6) this.drag.moved = true;
	}

	pointerUp(p) {
		const drag = this.drag;
		const before = this.capture();
		this.drag = null;
		if (!drag) return;
		if (!drag.moved) {
			this.rules.tap(drag.from, drag.index);
			this.animateFrom(before);
			return;
		}
		if (!drag.offset) return;
		const x = p.x - drag.offset.x + this.cardW / 2, y = p.y - drag.offset.y + this.cardH / 2;
		let best = null, bestDist = Infinity;
		for (const pile of this.piles) {
			if (pile === drag.from) continue;
			const top = pile.cards.length ? this.cardY(pile, pile.cards.length - 1) : pile.y;
			const cx = pile.x + this.cardW / 2, cy = top + this.cardH / 2;
			const dist = Math.hypot(cx - x, cy - y);
			if (Math.abs(cx - x) < this.cardW && Math.abs(cy - y) < this.cardH * 1.1 && dist < bestDist) {
				best = pile;
				bestDist = dist;
			}
		}
		if (best && this.rules.drop(drag.from, drag.index, best)) this.animateFrom(before, { duration: 0.14 });
		// an illegal drop: the cards slide back home
		else this.animateFrom(before, { duration: 0.24 });
	}

	draw() {
		const g = this.surface.g;
		const dragging = this.drag?.offset && this.drag.moved ? this.drag : null;
		const later = [];
		for (const pile of this.piles) {
			if (pile.cards.length === 0) drawSlot(g, pile.x, pile.y, this.cardW, this.cardH, pile.label);
			const end = dragging && dragging.from === pile ? dragging.index : pile.cards.length;
			if (!pile.fan) {
				// stacked piles only need their top cards
				const from = Math.max(0, end - (pile.fanX ? 3 : 2));
				// any moving cards in a stacked pile still need drawing as they arrive
				for (let i = 0; i < from; i++) if (this.moves.has(pile.cards[i])) this.drawOne(g, pile.cards[i], this.cardX(pile, i), pile.y, later);
				for (let i = from; i < end; i++) this.drawOne(g, pile.cards[i], this.cardX(pile, i), pile.y, later);
				if (pile.cards.length > 0 && end === 0) drawSlot(g, pile.x, pile.y, this.cardW, this.cardH, pile.label);
			} else {
				for (let i = 0; i < end; i++) this.drawOne(g, pile.cards[i], pile.x, this.cardY(pile, i), later);
			}
		}
		for (const [card, x, y, flip] of later) drawCard(g, card, x, y, this.cardW, this.cardH, { flip, lift: 0.6 });
		if (dragging) {
			const { from, index, point, offset } = dragging;
			const { up } = this.step(from);
			const fan = from.fan ? Math.max(up, 18) : 22;
			for (let i = index; i < from.cards.length; i++) {
				drawCard(g, from.cards[i], point.x - offset.x, point.y - offset.y + (i - index) * fan, this.cardW, this.cardH, { highlight: i === index, lift: 1 });
			}
		}
	}

	/** Wires pointer events on the surface's canvas through `input` (cleaned up with it). */
	listen(input, redraw) {
		const canvas = this.surface.canvas;
		this.redraw = redraw;
		canvas.style.touchAction = 'none';
		input.on(canvas, 'pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); this.pointerDown(this.surface.local(e)); redraw(); });
		input.on(canvas, 'pointermove', (e) => { if (this.drag) { this.pointerMove(this.surface.local(e)); redraw(); } });
		input.on(canvas, 'pointerup', (e) => { this.pointerUp(this.surface.local(e)); redraw(); });
		input.on(canvas, 'pointercancel', () => { this.drag = null; redraw(); });
	}
}
