// Spider Solitaire with one, two or four suits: build down, move same-suit runs, and
// clear complete King-to-Ace runs. Undo and resumable progress included.

import { Game } from '../core/game.js';
import { Surface } from '../core/canvas.js';
import { PileTable, makeDeck, drawCard } from '../core/cards.js';
import { h } from '../../components/dom.js';

const CW = 60, CH = 84, GAP = 9, W = 10 * (CW + GAP) + GAP, H = 660, TOP = 14, TAB = TOP + CH + 18;
const SUIT_SETS = { 1: [0], 2: [0, 1], 4: [0, 1, 2, 3] };

export default class Spider extends Game {
	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.table = new PileTable(this.surface, this, { cardW: CW, cardH: CH });
		this.table.listen(this.ctx.input, () => this.render());
		this.undoButton = h('button.btn.small', { type: 'button', onclick: () => this.undo() }, '↶ Undo');
		this.toolbar = h('div', this.undoButton);
		this.toolbar.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:2';
		this.ctx.root.appendChild(this.toolbar);
		this.reset();
	}

	get suits() { return this.ctx.settings.suits ?? '1'; }

	start() {
		super.start();
		this.table.deal(this.stock.x, this.stock.y, 0.018);
		this.ctx.audio.play('card');
	}

	reset() {
		this.running = false;
		const deck = makeDeck({ decks: 2, suits: SUIT_SETS[this.suits] ?? [0] });
		this.stock = { x: GAP, y: TOP, cards: [], fan: 0, kind: 'stock', label: '' };
		this.tableau = Array.from({ length: 10 }, (_, i) => ({ x: GAP + i * (CW + GAP), y: TAB, cards: [], fan: 22, kind: 'tableau' }));
		this.table.piles = [this.stock, ...this.tableau];
		this.tableau.forEach((pile, i) => {
			const n = i < 4 ? 6 : 5;
			for (let k = 0; k < n; k++) {
				const card = deck.pop();
				card.up = k === n - 1;
				pile.cards.push(card);
			}
		});
		this.stock.cards = deck;
		this.done = [];
		this.moves = 0;
		this.history = [];
		this.ctx.score(0);
		this.info();
		this.render();
	}

	info() {
		this.ctx.info(`${this.done.length} / 8 runs · ${this.stock.cards.length / 10} deals left`);
	}

	snapshot() { return JSON.stringify({ piles: this.table.piles.map((p) => p.cards), done: this.done }); }
	apply(json) {
		const data = typeof json === 'string' ? JSON.parse(json) : json;
		data.piles.forEach((cards, i) => { this.table.piles[i].cards = cards; });
		this.done = data.done;
	}

	serialize() { return { state: JSON.parse(this.snapshot()), moves: this.moves, suits: this.suits }; }
	restore(data) {
		if (data.suits !== this.suits) return;
		this.apply(data.state);
		this.moves = data.moves;
		this.ctx.score(this.moves);
		this.info();
		this.render();
	}

	undo() {
		if (!this.running || !this.history.length) return;
		const before = this.table.capture();
		this.apply(this.history.pop());
		this.table.animateFrom(before, { duration: 0.22 });
		this.moves++;
		this.ctx.score(this.moves);
		this.ctx.audio.play('flip');
		this.info();
		this.render();
	}

	/** A face-up run of one suit, each card one lower than the last. */
	isRun(cards) {
		for (let i = 0; i < cards.length; i++) {
			if (!cards[i].up) return false;
			if (i && (cards[i].suit !== cards[i - 1].suit || cards[i].rank !== cards[i - 1].rank - 1)) return false;
		}
		return true;
	}

	canDrag(pile, index) {
		return this.running && pile.kind === 'tableau' && this.isRun(pile.cards.slice(index));
	}

	accepts(pile, cards) {
		if (pile.kind !== 'tableau') return false;
		const top = pile.cards.at(-1);
		return !top || (top.up && top.rank === cards[0].rank + 1);
	}

	drop(from, index, to) {
		const cards = from.cards.slice(index);
		if (!this.accepts(to, cards)) return false;
		this.history.push(this.snapshot());
		from.cards.length = index;
		to.cards.push(...cards);
		this.ctx.audio.play('card');
		this.moved();
		return true;
	}

	tap(pile, index) {
		if (!this.running) return;
		if (pile.kind === 'stock') return this.deal();
		if (index < 0 || !this.canDrag(pile, index)) return;
		const cards = pile.cards.slice(index);
		// prefer a same-suit target, then any fitting column, then an empty one
		const fits = this.tableau.filter((t) => t !== pile && this.accepts(t, cards));
		const best = fits.find((t) => t.cards.length && t.cards.at(-1).suit === cards[0].suit) ?? fits.find((t) => t.cards.length) ?? fits[0];
		if (best) this.drop(pile, index, best);
		else this.ctx.audio.play('error');
	}

	deal() {
		if (!this.stock.cards.length) return;
		if (this.tableau.some((p) => !p.cards.length)) {
			this.ctx.audio.play('error');
			this.ctx.info('Every column needs a card before dealing');
			return;
		}
		this.history.push(this.snapshot());
		for (const pile of this.tableau) {
			const card = this.stock.cards.pop();
			card.up = true;
			pile.cards.push(card);
		}
		this.ctx.audio.play('swoosh');
		this.moved();
	}

	moved() {
		this.moves++;
		this.ctx.score(this.moves);
		for (const pile of this.tableau) {
			// a complete King-to-Ace run of one suit leaves the table
			if (pile.cards.length >= 13) {
				const tail = pile.cards.slice(-13);
				if (tail[0].rank === 13 && this.isRun(tail)) {
					pile.cards.length -= 13;
					this.done.push(tail[12].suit);
					this.ctx.audio.play('treasure');
					const at = this.ctx.fx.fromSurface(this.surface, pile.x + CW / 2, pile.y + this.table.cardY(pile, Math.max(0, pile.cards.length - 1)) - pile.y + CH);
					this.ctx.fx.burst(at, { count: 36, colors: ['#fde047', '#ffffff', '#a78bfa'], speed: 240, life: 0.9, shape: 'star', size: 5, gravity: 100 });
					this.ctx.fx.banner(`Run ${this.done.length} of 8!`);
				}
			}
			const top = pile.cards.at(-1);
			if (top && !top.up) top.up = true;
		}
		this.info();
		this.ctx.saveProgress(this.serialize());
		this.render();
		if (this.done.length === 8) this.finish({ win: true, title: 'All runs cleared!', message: `Spider solved in ${this.moves} moves.`, score: this.moves });
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#1e293b');
		const gradient = g.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H * 0.4, W);
		gradient.addColorStop(0, 'rgba(255,255,255,0.06)');
		gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
		g.fillStyle = gradient;
		g.fillRect(0, 0, W, H);
		// stock as a fan of remaining deals
		const deals = this.stock.cards.length / 10;
		this.table.draw();
		for (let k = 1; k < deals; k++) drawCard(g, { up: false }, GAP + k * 8, TOP, CW, CH);
		// cleared runs, as kings at the top right
		this.done.forEach((suit, i) => drawCard(g, { up: true, rank: 13, suit }, W - GAP - CW - i * 22, TOP, CW, CH));
		this.undoButton.disabled = !this.history.length;
	}

	dispose() {
		this.toolbar.remove();
		this.surface.dispose();
	}
}
