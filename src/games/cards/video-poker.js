// Video Poker (Jacks or Better): bet one to five credits, get five cards, hold the ones
// you like and draw replacements once. The final hand pays from the table; a pair of
// Jacks or better is the smallest win. Start with 100 credits and cash out any time.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { drawCard, makeDeck } from '../core/cards.js';
import { fillRound, text, colors } from '../core/canvas.js';

const W = 720, H = 560, CW = 110, CH = 154;
const PAYS = [
	['Royal Flush', 250], ['Straight Flush', 50], ['Four of a Kind', 25], ['Full House', 9], ['Flush', 6],
	['Straight', 4], ['Three of a Kind', 3], ['Two Pair', 2], ['Jacks or Better', 1],
];

export function evaluate(cards) {
	const ranks = cards.map((c) => (c.rank === 1 ? 14 : c.rank)).sort((a, b) => a - b);
	const counts = new Map();
	for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
	const groups = [...counts.values()].sort((a, b) => b - a);
	const flush = cards.every((c) => c.suit === cards[0].suit);
	const wheel = ranks.join() === '2,3,4,5,14';
	const straight = (counts.size === 5 && ranks[4] - ranks[0] === 4) || wheel;
	if (straight && flush) return ranks[0] === 10 ? 0 : 1;
	if (groups[0] === 4) return 2;
	if (groups[0] === 3 && groups[1] === 2) return 3;
	if (flush) return 4;
	if (straight) return 5;
	if (groups[0] === 3) return 6;
	if (groups[0] === 2 && groups[1] === 2) return 7;
	if (groups[0] === 2 && [...counts].some(([r, n]) => n === 2 && r >= 11)) return 8;
	return -1;
}

export default class VideoPoker extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.betBtn = tool.button('Bet 1', () => this.cycleBet());
		this.dealBtn = tool.button('Deal', () => this.dealOrDraw(), { primary: true });
		this.cashBtn = tool.button('Cash out', () => this.cashOut());
		return tool.bar(this.betBtn, this.dealBtn, this.cashBtn);
	}

	reset() {
		super.reset();
		this.credits = 100;
		this.best = 100;
		this.bet = 1;
		this.hand = [];
		this.held = [false, false, false, false, false];
		this.phase = 'bet';
		this.result = -1;
		this.flips = [];
		this.ui();
	}

	ui() {
		this.betBtn.textContent = `Bet ${this.bet}`;
		this.betBtn.disabled = this.phase !== 'bet';
		this.dealBtn.textContent = this.phase === 'hold' ? 'Draw' : 'Deal';
		this.ctx.score(this.credits);
		this.ctx.info(this.phase === 'hold' ? 'Click cards to hold them, then Draw' : `Credits ${this.credits} · bet ${this.bet}`);
	}

	cycleBet() {
		if (this.phase !== 'bet') return;
		this.bet = (this.bet % 5) + 1;
		if (this.bet > this.credits) this.bet = 1;
		this.ctx.audio.play('chip');
		this.ui();
		this.wake();
	}

	dealOrDraw() {
		if (!this.running) return;
		if (this.phase === 'bet') {
			if (this.credits < this.bet) return this.ctx.audio.play('error');
			this.credits -= this.bet;
			this.deck = makeDeck();
			this.hand = Array.from({ length: 5 }, () => ({ ...this.deck.pop(), up: true }));
			this.held = [false, false, false, false, false];
			this.result = -1;
			this.phase = 'hold';
			this.flips = this.hand.map((_, i) => -i * 0.07);
			this.ctx.audio.play('card');
			// suggest nothing, but show what the dealt hand already is
			this.dealt = evaluate(this.hand);
		} else if (this.phase === 'hold') {
			this.hand = this.hand.map((c, i) => (this.held[i] ? c : { ...this.deck.pop(), up: true }));
			this.flips = this.hand.map((_, i) => (this.held[i] ? 1 : -i * 0.07));
			this.result = evaluate(this.hand);
			const win = this.result >= 0 ? PAYS[this.result][1] * (this.result === 0 && this.bet === 5 ? 3.2 : 1) * this.bet : 0;
			this.credits += Math.round(win);
			this.best = Math.max(this.best, this.credits);
			this.phase = 'bet';
			this.lastWin = Math.round(win);
			if (win) {
				this.ctx.audio.play(this.result <= 3 ? 'levelup' : 'coin');
				this.popup(`${PAYS[this.result][0]}! +${this.lastWin}`, W / 2, 236, { color: '#fde047', size: 26 });
				if (this.result <= 3) this.ctx.fx.confetti({ count: 80 });
			} else this.ctx.audio.play('flip');
			if (this.bet > this.credits) this.bet = Math.max(1, this.credits);
			if (this.credits <= 0) setTimeout(() => this.finish({ win: false, title: 'Out of credits', message: `Your best was ${this.best} credits.`, score: this.best }), 1200);
		}
		this.ui();
		this.wake();
	}

	cashOut() {
		if (!this.running || this.phase !== 'bet') return;
		this.ctx.audio.play('treasure');
		this.finish({ win: this.credits > 100, title: 'Cashed out', message: `You leave with ${this.credits} credits (you started with 100).`, score: this.credits });
	}

	pointerDown(p) {
		if (!this.running || this.phase !== 'hold') return;
		for (let i = 0; i < 5; i++) {
			const x = this.cardX(i), y = 280;
			if (p.x >= x && p.x <= x + CW && p.y >= y && p.y <= y + CH) {
				this.held[i] = !this.held[i];
				this.ctx.audio.play('click');
			}
		}
	}

	key(action, event) {
		const n = Number(event?.key);
		if (n >= 1 && n <= 5 && this.phase === 'hold') { this.held[n - 1] = !this.held[n - 1]; this.ctx.audio.play('click'); }
		if (action === 'action') this.dealOrDraw();
	}

	cardX(i) { return W / 2 - (5 * CW + 4 * 14) / 2 + i * (CW + 14); }

	busy() { return this.flips.some((f) => f < 1); }
	tick(dt) { this.flips = this.flips.map((f) => Math.min(1, f + dt / 0.25)); }

	draw(g) {
		g.fillStyle = '#1e1b4b';
		g.fillRect(0, 0, W, H);
		// pay table
		fillRound(g, 20, 14, W - 40, 200, 14, '#0f0c2e');
		PAYS.forEach(([name, pay], i) => {
			const y = 34 + i * 20;
			const hit = this.phase === 'bet' && this.result === i;
			if (hit) fillRound(g, 26, y - 9, W - 52, 18, 6, colors.accent);
			text(g, name, 40, y, { size: 13, align: 'left', color: hit ? '#fff' : '#fde68a' });
			for (let b = 1; b <= 5; b++) {
				const x = 300 + b * 70;
				const amount = i === 0 && b === 5 ? 4000 : pay * b;
				text(g, String(amount), x, y, { size: 13, align: 'right', color: b === this.bet ? '#ffffff' : '#a5b4fc', weight: b === this.bet ? 800 : 600 });
			}
		});
		for (let i = 0; i < 5; i++) {
			const x = this.cardX(i), y = 280;
			const card = this.hand[i];
			if (!card) { drawCard(g, { up: false }, x, y, CW, CH); continue; }
			const f = this.flips[i] ?? 1;
			drawCard(g, f < 0.5 ? { up: false } : card, x, y - (this.held[i] ? 10 : 0), CW, CH, { flip: Math.max(0, f), highlight: this.held[i] });
			if (this.held[i]) { fillRound(g, x + 20, y + CH + 4, CW - 40, 24, 8, colors.accent); text(g, 'HELD', x + CW / 2, y + CH + 16, { size: 13 }); }
		}
		text(g, `Credits ${this.credits}`, 30, H - 22, { size: 18, align: 'left', color: '#fde68a' });
		text(g, `Bet ${this.bet}`, W - 30, H - 22, { size: 18, align: 'right', color: '#c7d2fe' });
		if (this.phase === 'hold' && this.dealt >= 0) text(g, `Dealt: ${PAYS[this.dealt][0]}`, W / 2, 250, { size: 16, color: '#a5f3fc' });
		if (this.phase === 'bet' && this.hand.length && this.result < 0) text(g, 'No win', W / 2, 250, { size: 16, color: '#94a3b8' });
		if (this.phase === 'bet') text(g, 'Space / Deal to play the next hand', W / 2, H - 22, { size: 13, color: '#94a3b8' });
	}
}
