// Memory Match: flip two cards per turn and find all the pairs.

import { Game } from '../core/game.js';
import { shuffle } from '../core/ai.js';
import { h } from '../../components/dom.js';

const SYMBOLS = [
	['★', '#fbbf24'], ['♥', '#fb7185'], ['♦', '#f472b6'], ['♣', '#34d399'], ['♠', '#a5b4fc'], ['●', '#22d3ee'],
	['▲', '#fb923c'], ['■', '#a78bfa'], ['✿', '#f9a8d4'], ['☀', '#fde047'], ['☾', '#93c5fd'], ['♪', '#6ee7b7'],
];

export default class MemoryMatch extends Game {
	async init() {
		this.board = h('div.memory-board');
		this.style = h('style', MEMORY_CSS);
		this.ctx.root.append(this.style, this.board);
		this.board.addEventListener('click', (e) => {
			const card = e.target.closest('.memory-card');
			if (card) this.flip(+card.dataset.i);
		});
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.ctx.root);
		this.reset();
	}

	reset() {
		this.running = false;
		clearTimeout(this.timer);
		const pairs = +this.ctx.settings.pairs || 8;
		this.cards = shuffle([...SYMBOLS.slice(0, pairs), ...SYMBOLS.slice(0, pairs)].map(([s, color], k) => ({ s, color, k })));
		this.open = [];
		this.matched = 0;
		this.moves = 0;
		this.cols = pairs === 6 ? 4 : pairs === 8 ? 4 : 6;
		this.board.style.setProperty('--cols', this.cols);
		this.board.replaceChildren(...this.cards.map((card, i) => h('button.memory-card.dealt', { type: 'button', dataset: { i }, 'aria-label': 'Hidden card', style: { '--i': i } },
			h('span.memory-face.memory-back'),
			h('span.memory-face.memory-front', { style: { color: card.color } }, card.s),
		)));
		clearTimeout(this.dealTimer);
		// once dealt, drop the class so later animations (miss, flip) do not replay the deal
		this.dealTimer = setTimeout(() => { for (const el of this.board.children) el.classList.remove('dealt'); }, 500 + this.cards.length * 30);
		this.ctx.score(0);
		this.ctx.info(`0 / ${pairs} pairs`);
		this.fit();
	}

	fit() {
		const rect = this.ctx.root.getBoundingClientRect();
		const rows = Math.ceil(this.cards.length / this.cols);
		const size = Math.floor(Math.min((rect.width - 40) / this.cols, ((rect.height - 40) / rows) / 1.25, 130));
		this.board.style.setProperty('--card', `${Math.max(44, size)}px`);
	}

	flip(i) {
		if (!this.running || this.open.length === 2) return;
		const el = this.board.children[i];
		if (el.classList.contains('up')) return;
		el.classList.add('up');
		el.setAttribute('aria-label', `Card ${this.cards[i].s}`);
		this.open.push(i);
		this.ctx.audio.play('flip');
		if (this.open.length < 2) return;
		this.moves++;
		this.ctx.score(this.moves);
		const [a, b] = this.open;
		if (this.cards[a].s === this.cards[b].s) {
			this.matched++;
			this.open = [];
			for (const k of [a, b]) {
				const el = this.board.children[k];
				el.classList.add('done');
				this.ctx.fx.burst(el, { count: 14, colors: [this.cards[k].color, '#ffffff'], speed: 150, life: 0.6, shape: 'star', size: 4, gravity: 80 });
				this.ctx.fx.ring(el, { color: this.cards[k].color, radius: 46 });
			}
			this.ctx.audio.play('pickup');
			const pairs = this.cards.length / 2;
			this.ctx.info(`${this.matched} / ${pairs} pairs`);
			if (this.matched === pairs) this.finish({ win: true, title: 'All pairs found!', message: `Solved in ${this.moves} moves.`, score: this.moves });
		} else {
			// a short shake says 'no match' before the cards turn back
			setTimeout(() => { for (const k of [a, b]) this.board.children[k]?.classList.add('miss'); this.ctx.audio.play('error'); }, 380);
			this.timer = setTimeout(() => {
				for (const k of [a, b]) {
					this.board.children[k].classList.remove('up', 'miss');
					this.board.children[k].setAttribute('aria-label', 'Hidden card');
				}
				this.open = [];
			}, 750);
		}
	}

	dispose() {
		clearTimeout(this.timer);
		clearTimeout(this.dealTimer);
		this.observer.disconnect();
		this.board.remove();
		this.style.remove();
	}
}

const MEMORY_CSS = `
.memory-board { display: grid; grid-template-columns: repeat(var(--cols), var(--card)); gap: 10px; perspective: 900px; }
.memory-card { position: relative; width: var(--card); height: calc(var(--card) * 1.25); border: 0; padding: 0; background: none; cursor: pointer; transform-style: preserve-3d; transition: transform 0.35s cubic-bezier(.2,.8,.2,1); touch-action: manipulation; }
.memory-card.up { transform: rotateY(180deg); }
.memory-card.dealt { animation: memory-deal 0.45s cubic-bezier(.2,.8,.2,1) backwards; animation-delay: calc(var(--i) * 30ms); }
@keyframes memory-deal { from { opacity: 0; transform: translateY(-40px) rotate(-10deg) scale(0.6); } }
.memory-card.miss { animation: memory-miss 0.35s ease; }
@keyframes memory-miss { 25% { transform: rotateY(180deg) translateX(-6px); } 75% { transform: rotateY(180deg) translateX(6px); } }
.memory-card:hover:not(.up) { transform: translateY(-3px); }
.memory-face { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 12px; backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: 0 8px 18px -8px rgba(0,0,0,0.6); }
.memory-back { background: repeating-linear-gradient(45deg, var(--color-primary-active) 0 8px, var(--color-primary) 8px 16px); border: 3px solid color-mix(in srgb, var(--color-primary) 40%, #ffffff); }
.memory-front { background: #f8faff; transform: rotateY(180deg); font-size: calc(var(--card) * 0.55); }
.memory-card.done .memory-front { background: #ecfdf5; box-shadow: 0 0 0 3px #34d399, 0 0 24px #34d39988; animation: memory-glow 1.6s ease-in-out infinite alternate; }
@keyframes memory-glow { to { box-shadow: 0 0 0 3px #34d399, 0 0 6px #34d39944; } }
`;
