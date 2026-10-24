// Blackjack against a dealer who stands on 17, from a six-deck shoe. Start with 500
// chips; cash out whenever you like. The score is the chips you cash out (or your peak
// if you go broke).

import { Game } from '../core/game.js';
import { Surface, text, fillRound, circle } from '../core/canvas.js';
import { makeDeck, drawCard } from '../core/cards.js';
import { h } from '../../components/dom.js';
import { CanvasFx, Animator, ease } from '../core/fx.js';

const W = 640, H = 420, CW = 74, CH = 104;
const CHIPS = [10, 25, 50, 100];

function total(hand) {
	let sum = 0, aces = 0;
	for (const c of hand) {
		sum += c.rank === 1 ? 11 : Math.min(10, c.rank);
		if (c.rank === 1) aces++;
	}
	while (sum > 21 && aces) { sum -= 10; aces--; }
	return { sum, soft: aces > 0 };
}
const isBlackjack = (hand) => hand.length === 2 && total(hand).sum === 21;

export default class Blackjack extends Game {
	async init() {
		this.style = h('style', BJ_CSS);
		this.canvasBox = h('div.bj-table');
		this.controls = h('div.bj-controls');
		this.column = h('div.game-column.bj-column', this.canvasBox, this.controls);
		this.ctx.root.append(this.style, this.column);
		this.surface = new Surface(this.canvasBox, W, H);
		this.fx = new CanvasFx(300);
		this.anims = new Map(); // card -> { t } dealing from the shoe
		this.flips = new Map(); // card -> t turning face up
		this.msgT = 1;
		this.animator = new Animator((dt) => {
			this.fx.update(dt);
			for (const [card, a] of this.anims) { a.t += dt / 0.32; if (a.t >= 1) this.anims.delete(card); }
			for (const [card, t] of this.flips) { if (t + dt / 0.25 >= 1) this.flips.delete(card); else this.flips.set(card, t + dt / 0.25); }
			this.msgT = Math.min(1, this.msgT + dt * 3);
			this.render();
		}, () => this.fx.busy || this.anims.size > 0 || this.flips.size > 0 || this.msgT < 1);
		this.reset();
	}

	reset() {
		this.running = false;
		clearTimeout(this.timer);
		this.shoe = makeDeck({ decks: 6 });
		this.chips = 500;
		this.peak = 500;
		this.bet = 0;
		this.lastBet = 25;
		this.player = [];
		this.dealer = [];
		this.phase = 'bet'; // bet | play | dealer | done
		this.message = 'Place your bet';
		this.ctx.score(this.chips);
		this.controlsFor();
		this.render();
	}

	draw(up = true) {
		if (this.shoe.length < 60) this.shoe = makeDeck({ decks: 6 });
		const card = this.shoe.pop();
		card.up = up;
		// each new card slides out of the shoe a beat after the previous one
		this.anims.set(card, { t: -this.anims.size * 0.45 });
		this.animator?.wake();
		setTimeout(() => this.ctx.audio.play('card'), this.anims.size * 140);
		return card;
	}

	button(label, onclick, { primary = false, disabled = false } = {}) {
		return h(`button.btn${primary ? '.primary' : ''}`, { type: 'button', onclick, disabled }, label);
	}

	controlsFor() {
		const c = [];
		if (this.phase === 'bet' || this.phase === 'done') {
			c.push(...CHIPS.map((v) => h('button.bj-chip', { type: 'button', disabled: this.bet + v > this.chips, onclick: () => this.addBet(v), dataset: { v } }, String(v))));
			c.push(this.button('Clear', () => { this.bet = 0; this.render(); this.controlsFor(); }, { disabled: !this.bet }));
			c.push(this.button(this.bet ? `Deal ${this.bet}` : 'Deal', () => this.deal(), { primary: true, disabled: !this.bet }));
			c.push(this.button('Cash out', () => this.cashOut()));
		} else if (this.phase === 'play') {
			c.push(this.button('Hit (H)', () => this.hit(), { primary: true }));
			c.push(this.button('Stand (S)', () => this.stand()));
			c.push(this.button('Double (D)', () => this.double(), { disabled: this.player.length !== 2 || this.chips < this.bet }));
		}
		this.controls.replaceChildren(...c);
	}

	addBet(v) {
		if (!this.running) return;
		if (this.phase === 'done') this.clearHands();
		if (this.bet + v > this.chips) return;
		this.bet += v;
		this.ctx.audio.play('chip');
		this.render();
		this.controlsFor();
	}

	clearHands() {
		this.player = [];
		this.dealer = [];
		this.phase = 'bet';
		this.message = 'Place your bet';
	}

	deal() {
		if (!this.running || !this.bet) return;
		if (this.phase === 'done') this.clearHands();
		this.chips -= this.bet;
		this.lastBet = this.bet;
		this.player = [this.draw(), this.draw()];
		this.dealer = [this.draw(), this.draw(false)];
		this.phase = 'play';
		this.message = '';
		this.ctx.audio.play('flip');
		this.ctx.score(this.chips);
		if (isBlackjack(this.player) || isBlackjack(this.dealer)) return this.dealerTurn();
		this.controlsFor();
		this.render();
	}

	hit() {
		if (this.phase !== 'play') return;
		this.player.push(this.draw());
		this.ctx.audio.play('flip');
		const { sum } = total(this.player);
		if (sum > 21) return this.settle();
		if (sum === 21) return this.stand();
		this.controlsFor();
		this.render();
	}

	stand() {
		if (this.phase !== 'play') return;
		this.dealerTurn();
	}

	double() {
		if (this.phase !== 'play' || this.player.length !== 2 || this.chips < this.bet) return;
		this.chips -= this.bet;
		this.bet *= 2;
		this.player.push(this.draw());
		this.ctx.audio.play('coin');
		if (total(this.player).sum > 21) return this.settle();
		this.dealerTurn();
	}

	dealerTurn() {
		this.phase = 'dealer';
		this.controlsFor();
		if (!this.dealer[1].up) { this.dealer[1].up = true; this.flips.set(this.dealer[1], 0); this.animator.wake(); }
		this.render();
		const step = () => {
			if (!this.running) return;
			const { sum } = total(this.dealer);
			if (!isBlackjack(this.player) && !isBlackjack(this.dealer) && sum < 17) {
				this.dealer.push(this.draw());
				this.ctx.audio.play('flip');
				this.render();
				this.timer = setTimeout(step, 550);
			} else this.settle();
		};
		this.timer = setTimeout(step, 550);
	}

	settle() {
		if (!this.dealer[1].up) { this.dealer[1].up = true; this.flips.set(this.dealer[1], 0); this.animator.wake(); }
		const p = total(this.player).sum, d = total(this.dealer).sum;
		let payout = 0;
		if (p > 21) this.message = 'Bust! Dealer wins.';
		else if (isBlackjack(this.player) && !isBlackjack(this.dealer)) { payout = this.bet * 2.5; this.message = 'Blackjack! Pays 3 to 2.'; }
		else if (isBlackjack(this.dealer) && !isBlackjack(this.player)) this.message = 'Dealer has blackjack.';
		else if (d > 21) { payout = this.bet * 2; this.message = 'Dealer busts. You win!'; }
		else if (p > d) { payout = this.bet * 2; this.message = `You win, ${p} to ${d}.`; }
		else if (p === d) { payout = this.bet; this.message = `Push at ${p}.`; }
		else this.message = `Dealer wins, ${d} to ${p}.`;
		this.chips += Math.floor(payout);
		this.peak = Math.max(this.peak, this.chips);
		this.ctx.audio.play(payout > this.bet ? (isBlackjack(this.player) ? 'treasure' : 'coin') : payout === this.bet ? 'blip' : 'lifelost');
		this.msgT = 0;
		if (payout > this.bet) {
			const big = isBlackjack(this.player);
			this.fx.particles.burst(W / 2, 214, { count: big ? 50 : 20, colors: ['#fde047', '#e11d48', '#ffffff', '#16a34a'], speed: big ? 300 : 200, life: 0.9, shape: big ? 'star' : 'dot', size: big ? 5 : 4, gravity: 260 });
			this.fx.popups.add(`+${Math.floor(payout - this.bet)}`, W - 50, H - 60, { color: '#fde047', size: 20 });
		} else if (payout < this.bet && total(this.player).sum > 21) this.fx.shake.kick(5);
		this.animator.wake();
		this.ctx.score(this.chips);
		this.phase = 'done';
		this.bet = Math.min(this.lastBet, this.chips);
		this.render();
		this.controlsFor();
		if (this.chips < CHIPS[0]) {
			this.timer = setTimeout(() => this.finish({ win: false, title: 'Out of chips', message: `Your stack peaked at ${this.peak} chips.`, score: this.peak }), 1200);
		}
	}

	cashOut() {
		if (!this.running || (this.phase !== 'bet' && this.phase !== 'done')) return;
		const won = this.chips > 500;
		this.finish({ win: won, title: 'Cashed out', message: `You leave the table with ${this.chips} chips (${this.chips >= 500 ? '+' : ''}${this.chips - 500}).`, score: this.chips });
	}

	handleInput({ type, event }) {
		if (type !== 'down' || !event) return;
		const k = event.key.toLowerCase();
		if (k === 'h') this.hit();
		else if (k === 's') this.stand();
		else if (k === 'd') this.double();
	}

	hand(cards, y, label) {
		const g = this.surface.g;
		const width = CW + (cards.length - 1) * 40;
		const x0 = W / 2 - width / 2;
		cards.forEach((card, i) => {
			const a = this.anims.get(card);
			const flip = this.flips.get(card);
			if (a) {
				// from the shoe at the top right, turning over as it lands
				const k = ease.outCubic(Math.max(0, Math.min(1, a.t)));
				const x = W - 90 + (x0 + i * 40 - (W - 90)) * k, yy = -CH + (y + CH) * k;
				drawCard(g, card, x, yy, CW, CH, { flip: card.up ? Math.max(0, a.t * 1.4 - 0.4) : 1, lift: 1 - k });
			} else drawCard(g, card, x0 + i * 40, y, CW, CH, { flip: flip === undefined ? 1 : flip });
		});
		if (cards.length) {
			const hidden = cards.some((c) => !c.up);
			const t = hidden ? total(cards.filter((c) => c.up)) : total(cards);
			text(g, `${label} · ${t.sum}${hidden ? ' + ?' : t.soft && t.sum < 21 ? ' (soft)' : ''}`, W / 2, y - 14, { size: 14, color: '#d1fae5' });
		}
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#0b5134');
		this.fx.shake.apply(g);
		// felt texture and the shoe
		const felt = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
		felt.addColorStop(0, 'rgba(255,255,255,0.07)');
		felt.addColorStop(1, 'rgba(0,0,0,0.3)');
		g.fillStyle = felt;
		g.fillRect(-10, -10, W + 20, H + 20);
		fillRound(g, W - 100, -10, 90, 34, 8, '#1f2937');
		g.strokeStyle = 'rgba(255,255,255,0.15)';
		g.lineWidth = 2;
		g.beginPath(); g.ellipse(W / 2, -60, W * 0.62, H * 0.86, 0, 0, Math.PI); g.stroke();
		text(g, 'BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON 17', W / 2, 186, { size: 11, color: 'rgba(255,255,255,0.35)' });
		this.hand(this.dealer, 40, 'Dealer');
		this.hand(this.player, 260, 'You');
		if (this.message) {
			const k = ease.outBack(this.msgT);
			g.save();
			g.translate(W / 2, 214);
			g.scale(k, k);
			fillRound(g, -150, -18, 300, 36, 18, 'rgba(0,0,0,0.4)');
			text(g, this.message, 0, 0, { size: 16 });
			g.restore();
		}
		text(g, `Chips ${this.chips}`, 16, H - 20, { size: 15, align: 'left', color: '#fde68a' });
		if (this.bet) {
			circle(g, W - 50, H - 30, 20, '#e11d48');
			circle(g, W - 50, H - 30, 14, '#fff');
			text(g, String(this.bet), W - 50, H - 29, { size: 11, color: '#111' });
		}
		this.fx.draw(g);
		g.restore();
	}

	dispose() {
		this.animator.stop();
		clearTimeout(this.timer);
		this.surface.dispose();
		this.column.remove();
		this.style.remove();
	}
}

const BJ_CSS = `
.bj-column { justify-content: center; }
.bj-table { position: relative; flex: 1; width: 100%; min-height: 0; display: flex; align-items: center; justify-content: center; }
.bj-controls { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.bj-chip { width: 52px; height: 52px; border-radius: 50%; border: 4px dashed rgba(255,255,255,0.75); color: #fff; font-weight: 900; cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,0.3); }
.bj-chip[data-v='10'] { background: #2563eb; }
.bj-chip[data-v='25'] { background: #16a34a; }
.bj-chip[data-v='50'] { background: #dc2626; }
.bj-chip[data-v='100'] { background: #111827; }
.bj-chip:disabled { opacity: 0.35; cursor: not-allowed; }
`;
