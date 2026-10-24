// Crazy Eights: be the first to empty your hand. Play a card that matches the top of the
// pile by suit or rank; eights are wild and name a new suit. If you cannot play, draw
// until you can (at most three cards), then pass. You face one to three computer players.

import { CanvasGame } from '../kit/canvasGame.js';
import { drawCard, makeDeck, SUITS } from '../core/cards.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { shuffle } from '../core/ai.js';

const W = 760, H = 600, CW = 66, CH = 94;
const NAMES = ['You', 'Ada', 'Bo', 'Cy'];

export default class CrazyEights extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		clearTimeout(this.timer);
		const players = 1 + Number(this.ctx.settings.opponents ?? 2);
		this.deck = makeDeck();
		this.hands = Array.from({ length: players }, () => []);
		for (let k = 0; k < 7; k++) for (const h of this.hands) h.push(this.deck.pop());
		for (const c of this.hands[0]) c.up = true;
		let first;
		do { first = this.deck.pop(); if (first.rank === 8) this.deck.unshift(first); } while (first.rank === 8);
		first.up = true;
		this.pile = [first];
		this.suit = first.suit;
		this.turn = 0;
		this.drawn = 0;
		this.choosing = null;
		this.flying = null;
		this.ctx.score(0);
		this.status();
	}

	status() {
		this.ctx.info(this.turn === 0 ? (this.choosing ? 'Choose a suit for your eight' : 'Your turn: match the suit or rank') : `${NAMES[this.turn]} is playing…`);
	}

	top() { return this.pile.at(-1); }
	playable(card) { return card.rank === 8 || card.suit === this.suit || card.rank === this.top().rank; }

	refill() {
		if (this.deck.length) return true;
		if (this.pile.length <= 1) return false;
		const top = this.pile.pop();
		this.deck = shuffle(this.pile).map((c) => ({ ...c, up: false }));
		this.pile = [top];
		this.ctx.audio.play('swoosh');
		return true;
	}

	handPos(i, n) {
		const spread = Math.min(CW + 6, (W - 120) / Math.max(1, n));
		return [W / 2 - ((n - 1) * spread) / 2 - CW / 2 + i * spread, H - CH - 24];
	}

	pointerDown(p) {
		if (!this.running || this.turn !== 0 || this.flying) return;
		if (this.choosing) {
			for (let s = 0; s < 4; s++) {
				const x = W / 2 - 150 + s * 80, y = H / 2 - 40;
				if (p.x >= x && p.x <= x + 70 && p.y >= y && p.y <= y + 80) { this.suit = s; this.choosing = null; this.ctx.audio.play('select'); return this.next(); }
			}
			return;
		}
		// the draw pile
		if (p.x >= W / 2 - 110 && p.x <= W / 2 - 110 + CW && p.y >= H / 2 - 70 && p.y <= H / 2 - 70 + CH) return this.playerDraw();
		const hand = this.hands[0];
		for (let i = hand.length - 1; i >= 0; i--) {
			const [x, y] = this.handPos(i, hand.length);
			const lift = this.playable(hand[i]) ? 14 : 0;
			if (p.x >= x && p.x <= x + CW && p.y >= y - lift && p.y <= y + CH) {
				if (!this.playable(hand[i])) return this.ctx.audio.play('error');
				return this.play(0, i);
			}
		}
	}

	playerDraw() {
		const hand = this.hands[0];
		if (hand.some((c) => this.playable(c))) { this.ctx.fx.banner('You have a card to play'); return this.ctx.audio.play('error'); }
		if (this.drawn >= 3 || !this.refill()) { this.drawn = 0; this.ctx.audio.play('flip'); this.popup('Pass', W / 2, H / 2 + 60, { size: 20 }); return this.advance(); }
		const card = this.deck.pop();
		card.up = true;
		hand.push(card);
		this.drawn++;
		this.ctx.audio.play('card');
		if (!hand.some((c) => this.playable(c)) && this.drawn >= 3) { this.drawn = 0; this.popup('Pass', W / 2, H / 2 + 60, { size: 20 }); this.advance(); }
	}

	play(who, index) {
		const card = this.hands[who].splice(index, 1)[0];
		card.up = true;
		this.flying = { card, who, t: 0 };
		this.ctx.audio.play('card');
	}

	land() {
		const { card, who } = this.flying;
		this.flying = null;
		this.pile.push(card);
		this.suit = card.suit;
		this.drawn = 0;
		if (!this.hands[who].length) return this.end(who);
		if (card.rank === 8) {
			this.ctx.audio.play('powerup');
			if (who === 0) { this.choosing = true; this.status(); return; }
			// the computer names the suit it holds most of
			const counts = [0, 0, 0, 0];
			for (const c of this.hands[who]) if (c.rank !== 8) counts[c.suit]++;
			this.suit = counts.indexOf(Math.max(...counts));
			this.popup(`${NAMES[who]} picks ${SUITS[this.suit]}`, W / 2, H / 2 + 70, { size: 20, color: '#fde047' });
		}
		this.next();
	}

	next() { this.advance(); }

	advance() {
		this.turn = (this.turn + 1) % this.hands.length;
		this.status();
		if (this.turn !== 0) this.timer = setTimeout(() => this.cpu(), 700);
		this.wake();
	}

	cpu() {
		if (!this.running) return;
		const hand = this.hands[this.turn];
		const options = hand.map((c, i) => [c, i]).filter(([c]) => this.playable(c));
		if (options.length) {
			// keep eights for last; prefer the suit with the most cards
			options.sort(([a], [b]) => (a.rank === 8) - (b.rank === 8) || hand.filter((c) => c.suit === b.suit).length - hand.filter((c) => c.suit === a.suit).length);
			this.play(this.turn, options[0][1]);
		} else if (this.drawn < 3 && this.refill()) {
			hand.push(this.deck.pop());
			this.drawn++;
			this.ctx.audio.play('card');
			this.timer = setTimeout(() => this.cpu(), 380);
		} else {
			this.drawn = 0;
			this.advance();
		}
		this.wake();
	}

	end(who) {
		const points = this.hands.reduce((sum, h, i) => sum + (i === who ? 0 : h.reduce((s, c) => s + (c.rank === 8 ? 50 : Math.min(10, c.rank)), 0)), 0);
		const win = who === 0;
		this.ctx.audio.play(win ? 'win' : 'lose');
		if (win) { this.ctx.score(points); this.ctx.fx.confetti({ count: 70 }); }
		setTimeout(() => this.finish({ win, title: win ? 'You went out first!' : `${NAMES[who]} went out first`, message: win ? `You scored ${points} points from the other hands.` : `You were left holding ${this.hands[0].length} cards.`, score: win ? points : 0 }), 800);
	}

	busy() { return Boolean(this.flying); }

	tick(dt) {
		if (this.flying && (this.flying.t += dt / 0.3) >= 1) this.land();
	}

	from(who) {
		if (who === 0) return [W / 2, H - CH];
		const n = this.hands.length - 1;
		return [(W / (n + 1)) * who - CW / 2, 30];
	}

	draw(g) {
		const bg = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.7);
		bg.addColorStop(0, '#1d4ed8');
		bg.addColorStop(1, '#172554');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		const n = this.hands.length - 1;
		for (let p = 1; p <= n; p++) {
			const cx = (W / (n + 1)) * p, hand = this.hands[p];
			for (let i = 0; i < hand.length; i++) drawCard(g, { up: false }, cx - CW / 2 - (hand.length - 1) * 6 + i * 12, 30, CW * 0.8, CH * 0.8);
			fillRound(g, cx - 46, 116, 92, 24, 12, this.turn === p ? colors.accent : 'rgba(0,0,0,0.35)');
			text(g, `${NAMES[p]} · ${hand.length}`, cx, 128, { size: 13 });
		}
		// draw pile and discard pile
		if (this.deck.length) drawCard(g, { up: false }, W / 2 - 110, H / 2 - 70, CW, CH);
		text(g, `${this.deck.length}`, W / 2 - 110 + CW / 2, H / 2 + 38, { size: 12, color: '#bfdbfe' });
		drawCard(g, this.top(), W / 2 + 20, H / 2 - 70, CW, CH);
		const red = this.suit === 1 || this.suit === 2;
		fillRound(g, W / 2 + 100, H / 2 - 50, 52, 52, 12, '#f8fafc');
		text(g, SUITS[this.suit], W / 2 + 126, H / 2 - 23, { size: 32, color: red ? '#e11d48' : '#1e2340' });
		const hand = this.hands[0];
		hand.forEach((card, i) => {
			const [x, y] = this.handPos(i, hand.length);
			const ok = this.turn === 0 && !this.choosing && this.playable(card);
			drawCard(g, card, x, y - (ok ? 14 : 0), CW, CH, { highlight: ok });
		});
		if (this.flying) {
			const [fx, fy] = this.from(this.flying.who), t = this.flying.t;
			drawCard(g, this.flying.card, fx + (W / 2 + 20 - fx) * t, fy + (H / 2 - 70 - fy) * t, CW, CH, { lift: 1 });
		}
		if (this.choosing) {
			fillRound(g, W / 2 - 170, H / 2 - 70, 340, 130, 18, 'rgba(15,23,42,0.92)');
			text(g, 'Name the suit', W / 2, H / 2 - 54, { size: 14, color: '#e2e8f0' });
			for (let s = 0; s < 4; s++) {
				const x = W / 2 - 150 + s * 80, y = H / 2 - 40;
				fillRound(g, x, y, 70, 80, 12, '#f8fafc');
				text(g, SUITS[s], x + 35, y + 42, { size: 40, color: s === 1 || s === 2 ? '#e11d48' : '#1e2340' });
			}
		}
		if (this.turn === 0 && !this.choosing && !hand.some((c) => this.playable(c))) text(g, 'No match: click the deck to draw', W / 2, H - CH - 50, { size: 14, color: '#fde68a' });
	}

	teardown() { clearTimeout(this.timer); }
}
