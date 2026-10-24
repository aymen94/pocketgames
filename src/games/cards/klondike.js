// Klondike Solitaire: draw one or three, drag or tap to move, undo, auto-finish, and
// resumable progress.

import { Game } from '../core/game.js';
import { Surface } from '../core/canvas.js';
import { PileTable, makeDeck, isRed } from '../core/cards.js';
import { h } from '../../components/dom.js';

const CW = 72, CH = 100, GAP = 12, W = 7 * (CW + GAP) + GAP, H = 640, TOP = 16, TAB = TOP + CH + 22;

export default class Klondike extends Game {
	static realtime = false;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.surface.canvas.style.borderRadius = '16px';
		this.table = new PileTable(this.surface, this, { cardW: CW, cardH: CH });
		this.table.listen(this.ctx.input, () => this.render());
		this.undoButton = h('button.btn.small', { type: 'button', onclick: () => this.undo() }, '↶ Undo');
		this.toolbar = h('div.card-toolbar', this.undoButton);
		this.toolbar.style.cssText = 'position:absolute;right:12px;bottom:12px;z-index:2';
		this.ctx.root.appendChild(this.toolbar);
		this.reset();
	}

	reset() {
		this.running = false;
		clearTimeout(this.auto);
		const deck = makeDeck();
		this.layout();
		for (let col = 0; col < 7; col++) {
			for (let k = 0; k <= col; k++) {
				const card = deck.pop();
				card.up = k === col;
				this.tableau[col].cards.push(card);
			}
		}
		this.stock.cards = deck;
		this.moves = 0;
		this.history = [];
		this.ctx.score(0);
		this.render();
	}

	layout() {
		const x = (i) => GAP + i * (CW + GAP);
		this.stock = { x: x(0), y: TOP, cards: [], fan: 0, kind: 'stock', label: '↺' };
		this.waste = { x: x(1), y: TOP, cards: [], fan: 0, fanX: this.drawCount === 3 ? 18 : 0, kind: 'waste' };
		this.foundations = [0, 1, 2, 3].map((i) => ({ x: x(3 + i), y: TOP, cards: [], fan: 0, kind: 'foundation', label: 'A' }));
		this.tableau = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: x(i), y: TAB, cards: [], fan: 26, kind: 'tableau' }));
		this.table.piles = [this.stock, this.waste, ...this.foundations, ...this.tableau];
	}

	get drawCount() { return +this.ctx.settings.draw || 1; }

	snapshot() {
		return JSON.stringify(this.table.piles.map((p) => p.cards));
	}

	serialize() { return { piles: JSON.parse(this.snapshot()), moves: this.moves, draw: this.drawCount }; }

	restore(data) {
		if (data.draw !== this.drawCount) return;
		data.piles.forEach((cards, i) => { this.table.piles[i].cards = cards; });
		this.moves = data.moves;
		this.history = [];
		this.ctx.score(this.moves);
		this.render();
	}

	record() {
		this.history.push(this.snapshot());
		if (this.history.length > 200) this.history.shift();
	}

	undo() {
		if (!this.running || !this.history.length) return;
		const before = this.table.capture();
		JSON.parse(this.history.pop()).forEach((cards, i) => { this.table.piles[i].cards = cards; });
		this.table.animateFrom(before, { duration: 0.22 });
		this.moves++;
		this.ctx.score(this.moves);
		this.ctx.audio.play('flip');
		this.render();
	}

	moved() {
		this.moves++;
		this.ctx.score(this.moves);
		for (const pile of this.tableau) {
			const top = pile.cards.at(-1);
			if (top && !top.up) top.up = true;
		}
		this.ctx.saveProgress(this.serialize());
		this.render();
		this.checkWin();
	}

	// ------------------------------------------------------------ rules (PileTable callbacks)

	canDrag(pile, index) {
		if (!this.running) return false;
		const card = pile.cards[index];
		if (!card?.up) return false;
		if (pile.kind === 'tableau') return true;
		return (pile.kind === 'waste' || pile.kind === 'foundation') && index === pile.cards.length - 1;
	}

	accepts(pile, cards) {
		const first = cards[0], top = pile.cards.at(-1);
		if (pile.kind === 'foundation') {
			if (cards.length !== 1) return false;
			return top ? top.suit === first.suit && first.rank === top.rank + 1 : first.rank === 1;
		}
		if (pile.kind === 'tableau') {
			return top ? top.up && first.rank === top.rank - 1 && isRed(first) !== isRed(top) : first.rank === 13;
		}
		return false;
	}

	drop(from, index, to) {
		const cards = from.cards.slice(index);
		if (!this.accepts(to, cards)) return false;
		this.record();
		from.cards.length = index;
		to.cards.push(...cards);
		this.ctx.audio.play(to.kind === 'foundation' ? 'chip' : 'card');
		if (to.kind === 'foundation') {
			const at = this.ctx.fx.fromSurface(this.surface, to.x + CW / 2, to.y + CH / 2);
			const king = cards[0].rank === 13;
			this.ctx.fx.burst(at, { count: king ? 30 : 10, colors: ['#fde047', '#ffffff', '#34d399'], speed: king ? 220 : 120, life: 0.6, shape: 'star', size: king ? 5 : 3.5, gravity: 120 });
			if (king) { this.ctx.fx.ring(at, { color: '#fde047', radius: 70 }); this.ctx.audio.play('sparkle'); }
		}
		this.moved();
		return true;
	}

	tap(pile, index) {
		if (!this.running) return;
		if (pile.kind === 'stock') return this.deal();
		if (index < 0 || !this.canDrag(pile, index)) return;
		const cards = pile.cards.slice(index);
		// single cards try the foundations first, then any tableau column that fits
		const targets = cards.length === 1 ? [...this.foundations, ...this.tableau] : this.tableau;
		for (const target of targets) {
			if (target !== pile && this.accepts(target, cards)) return this.drop(pile, index, target);
		}
		this.ctx.audio.play('error');
	}

	deal() {
		this.record();
		if (this.stock.cards.length === 0) {
			if (!this.waste.cards.length) return;
			this.stock.cards = this.waste.cards.reverse().map((c) => ({ ...c, up: false }));
			this.waste.cards = [];
		} else {
			for (let k = 0; k < this.drawCount && this.stock.cards.length; k++) {
				const card = this.stock.cards.pop();
				card.up = true;
				this.waste.cards.push(card);
			}
		}
		this.ctx.audio.play('card');
		this.moved();
	}

	checkWin() {
		if (this.foundations.every((f) => f.cards.length === 13)) {
			return this.finish({ win: true, title: 'Solitaire solved!', message: `All four suits built in ${this.moves} moves.`, score: this.moves });
		}
		// everything face up and no stock left: finish the foundations automatically
		const allUp = this.tableau.every((p) => p.cards.every((c) => c.up));
		if (allUp && !this.stock.cards.length && !this.waste.cards.length && this.running) {
			clearTimeout(this.auto);
			this.auto = setTimeout(() => this.autoStep(), 120);
		}
	}

	autoStep() {
		if (!this.running) return;
		for (const pile of this.tableau) {
			const i = pile.cards.length - 1;
			if (i < 0) continue;
			for (const f of this.foundations) {
				if (!this.accepts(f, [pile.cards[i]])) continue;
				const before = this.table.capture();
				this.drop(pile, i, f);
				this.table.animateFrom(before, { duration: 0.16 });
				return;
			}
		}
	}

	start() {
		super.start();
		// deal the table from the stock
		this.table.deal(this.stock.x, this.stock.y);
		this.ctx.audio.play('card');
	}

	render() {
		const s = this.surface;
		s.clear('#0f5132');
		const g = s.g;
		const gradient = g.createRadialGradient(W / 2, H * 0.3, 50, W / 2, H * 0.4, W);
		gradient.addColorStop(0, 'rgba(255,255,255,0.08)');
		gradient.addColorStop(1, 'rgba(0,0,0,0.25)');
		g.fillStyle = gradient;
		g.fillRect(0, 0, W, H);
		this.table.draw();
		this.undoButton.disabled = !this.history.length;
	}

	dispose() {
		clearTimeout(this.auto);
		this.toolbar.remove();
		this.surface.dispose();
	}
}
