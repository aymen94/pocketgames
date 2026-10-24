// FreeCell: every card is dealt face up into eight columns. Build the four foundations up
// by suit from Ace to King, using four free cells as temporary space. Runs move as a unit
// when there is room for them: (free cells + 1) × 2 for each empty column.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { PileTable, makeDeck, isRed } from '../core/cards.js';

const CW = 72, CH = 100, GAP = 10, W = 8 * (CW + GAP) + GAP, H = 660, TOP = 14, TAB = TOP + CH + 24;

export default class FreeCell extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.movesLabel = tool.label('');
		return tool.bar(this.movesLabel, tool.button('Undo', () => this.undo()), tool.button('Hint', () => this.hint()));
	}

	setup() {
		this.table = new PileTable(this.surface, this, { cardW: CW, cardH: CH });
		this.table.redraw = () => this.render();
	}

	reset() {
		super.reset();
		const x = (i) => GAP + i * (CW + GAP);
		this.cells = [0, 1, 2, 3].map((i) => ({ x: x(i), y: TOP, cards: [], fan: 0, kind: 'cell' }));
		this.foundations = [0, 1, 2, 3].map((i) => ({ x: x(4 + i), y: TOP, cards: [], fan: 0, kind: 'foundation', label: 'A' }));
		this.tableau = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ x: x(i), y: TAB, cards: [], fan: 28, kind: 'tableau' }));
		this.table.piles = [...this.cells, ...this.foundations, ...this.tableau];
		const deck = makeDeck();
		deck.forEach((card, i) => { card.up = true; this.tableau[i % 8].cards.push(card); });
		this.moves = 0;
		this.history = [];
		this.table.deal(W / 2, H);
		this.update0();
	}

	update0() {
		this.movesLabel.textContent = `Moves ${this.moves}`;
		this.ctx.score(this.moves);
	}

	snapshot() { return JSON.stringify(this.table.piles.map((p) => p.cards)); }

	restore(data) {
		data.piles.forEach((cards, i) => { this.table.piles[i].cards = cards; });
		this.moves = data.moves;
		this.update0();
		this.render();
	}

	capacity(target) {
		const free = this.cells.filter((c) => !c.cards.length).length;
		const empty = this.tableau.filter((t) => !t.cards.length && t !== target).length;
		return (free + 1) * 2 ** empty;
	}

	isRun(cards) {
		for (let i = 1; i < cards.length; i++) if (cards[i].rank !== cards[i - 1].rank - 1 || isRed(cards[i]) === isRed(cards[i - 1])) return false;
		return true;
	}

	// ------------------------------------------------------------ PileTable rules

	canDrag(pile, index) {
		if (!this.running || pile.kind === 'foundation') return false;
		return this.isRun(pile.cards.slice(index));
	}

	accepts(pile, cards) {
		const first = cards[0], top = pile.cards.at(-1);
		if (pile.kind === 'cell') return cards.length === 1 && !top;
		if (pile.kind === 'foundation') return cards.length === 1 && (top ? top.suit === first.suit && first.rank === top.rank + 1 : first.rank === 1);
		if (cards.length > this.capacity(pile)) return false;
		return !top || (first.rank === top.rank - 1 && isRed(first) !== isRed(top));
	}

	drop(from, index, to) {
		const cards = from.cards.slice(index);
		if (!this.accepts(to, cards)) { this.ctx.audio.play('error'); return false; }
		this.history.push(this.snapshot());
		from.cards.splice(index);
		to.cards.push(...cards);
		this.after(to);
		return true;
	}

	tap(pile, index) {
		if (!this.running || index < 0 || pile.kind === 'foundation') return;
		const cards = pile.cards.slice(index);
		if (!this.isRun(cards)) return;
		// prefer a foundation, then a non-empty column, then an empty column, then a cell
		const order = [...this.foundations, ...this.tableau.filter((t) => t.cards.length), ...this.tableau.filter((t) => !t.cards.length), ...this.cells];
		const target = order.find((t) => t !== pile && this.accepts(t, cards));
		if (target) this.drop(pile, index, target);
		else this.ctx.audio.play('error');
	}

	after(to) {
		this.moves++;
		this.ctx.audio.play(to.kind === 'foundation' ? 'chip' : 'card');
		this.autoPlay();
		this.update0();
		this.ctx.saveProgress({ piles: JSON.parse(this.snapshot()), moves: this.moves });
		if (this.foundations.every((f) => f.cards.length === 13)) {
			this.ctx.audio.play('win');
			this.ctx.fx.confetti({ count: 100 });
			setTimeout(() => this.finish({ win: true, title: 'Solved!', message: `FreeCell solved in ${this.moves} moves.`, score: this.moves, lowerIsBetter: true }), 900);
		}
	}

	/** Moves cards no other card could ever need onto the foundations. */
	autoPlay() {
		for (let moved = true; moved;) {
			moved = false;
			for (const pile of [...this.cells, ...this.tableau]) {
				const card = pile.cards.at(-1);
				if (!card) continue;
				const f = this.foundations.find((fd) => this.accepts(fd, [card]));
				if (!f) continue;
				const opposite = this.foundations.filter((fd) => fd.cards.length && isRed(fd.cards[0]) !== isRed(card)).map((fd) => fd.cards.length);
				const lowOpposite = opposite.length === 2 ? Math.min(...opposite) : 0;
				if (card.rank <= 2 || card.rank <= lowOpposite + 1) {
					const before = this.table.capture();
					f.cards.push(pile.cards.pop());
					this.table.animateFrom(before, { duration: 0.18 });
					moved = true;
				}
			}
		}
	}

	hint() {
		if (!this.running) return;
		for (const pile of [...this.cells, ...this.tableau]) {
			for (let i = 0; i < pile.cards.length; i++) {
				const cards = pile.cards.slice(i);
				if (!this.isRun(cards)) continue;
				const to = [...this.foundations, ...this.tableau.filter((t) => t.cards.length)].find((t) => t !== pile && this.accepts(t, cards));
				if (to) {
					this.hinted = { x: this.table.cardX(pile, i), y: this.table.cardY(pile, i), t: 1.2 };
					this.wake();
					return;
				}
			}
		}
		this.ctx.fx.banner('Try a free cell or an empty column');
	}

	undo() {
		if (!this.running || !this.history.length) return;
		const before = this.table.capture();
		JSON.parse(this.history.pop()).forEach((cards, i) => { this.table.piles[i].cards = cards; });
		this.table.animateFrom(before, { duration: 0.2 });
		this.moves++;
		this.update0();
		this.ctx.audio.play('flip');
	}

	pointerDown(p) { this.table.pointerDown(p); }
	pointerMove(p) { this.table.pointerMove(p); }
	pointerUp(p) { this.table.pointerUp(p); }

	busy() { return Boolean(this.hinted) || this.table.moves.size > 0; }
	tick(dt) { if (this.hinted && (this.hinted.t -= dt) <= 0) this.hinted = null; }

	draw(g) {
		g.fillStyle = '#0f5132';
		g.fillRect(0, 0, W, H);
		this.table.draw();
		if (this.hinted) {
			g.strokeStyle = `rgba(253,224,71,${Math.min(1, this.hinted.t)})`;
			g.lineWidth = 4;
			g.beginPath(); g.roundRect(this.hinted.x - 3, this.hinted.y - 3, CW + 6, CH + 6, 9); g.stroke();
		}
	}

	teardown() { this.table.animator.stop(); }
}
