// Mole Bonk: a 3 × 3 field of holes; bonk the moles, spare the bunnies.

import { Game } from '../core/game.js';
import { h } from '../../components/dom.js';
import { Countdown } from '../core/timer.js';

const KINDS = {
	mole: { points: 10, face: '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="36" rx="22" ry="24" fill="#a16207"/><ellipse cx="30" cy="44" rx="14" ry="12" fill="#d6a35c"/><circle cx="22" cy="30" r="3.5" fill="#1c1917"/><circle cx="38" cy="30" r="3.5" fill="#1c1917"/><ellipse cx="30" cy="38" rx="5" ry="3.5" fill="#fb7185"/></svg>' },
	gold: { points: 30, face: '<svg viewBox="0 0 60 60"><ellipse cx="30" cy="36" rx="22" ry="24" fill="#f59e0b"/><ellipse cx="30" cy="44" rx="14" ry="12" fill="#fde68a"/><circle cx="22" cy="30" r="3.5" fill="#1c1917"/><circle cx="38" cy="30" r="3.5" fill="#1c1917"/><ellipse cx="30" cy="38" rx="5" ry="3.5" fill="#fb7185"/><path d="M18 14 l5 7 7-9 7 9 5-7 v10 h-24z" fill="#fde047"/></svg>' },
	bunny: { points: -15, face: '<svg viewBox="0 0 60 60"><ellipse cx="22" cy="12" rx="5" ry="13" fill="#f5f5f5"/><ellipse cx="38" cy="12" rx="5" ry="13" fill="#f5f5f5"/><ellipse cx="22" cy="12" rx="2.5" ry="9" fill="#fbcfe8"/><ellipse cx="38" cy="12" rx="2.5" ry="9" fill="#fbcfe8"/><ellipse cx="30" cy="38" rx="20" ry="20" fill="#f5f5f5"/><circle cx="23" cy="34" r="3" fill="#1c1917"/><circle cx="37" cy="34" r="3" fill="#1c1917"/><ellipse cx="30" cy="42" rx="3.5" ry="2.5" fill="#f472b6"/></svg>' },
};

export default class MoleBonk extends Game {
	static realtime = true;

	async init() {
		this.holes = [];
		const field = h('div.mole-field');
		for (let i = 0; i < 9; i++) {
			const critter = h('div.mole-critter');
			const hole = h('button.mole-hole', { type: 'button', 'aria-label': `Hole ${i + 1}`, onpointerdown: (e) => { e.preventDefault(); this.bonk(i); } }, h('div.mole-pit', critter), h('span.mole-key', String(i + 1)));
			this.holes.push({ el: hole, critter, kind: null, up: 0, life: 0, hit: false });
			field.appendChild(hole);
		}
		this.bar = h('div.mole-timer', h('div'));
		this.el = h('div.mole-wrap', this.bar, field);
		this.ctx.root.appendChild(this.el);
		this.style = h('style', MOLE_CSS);
		this.ctx.root.appendChild(this.style);
		this.reset();
	}

	reset() {
		this.running = false;
		this.score = 0;
		this.clock = new Countdown(+this.ctx.settings.time || 45);
		this.spawn = 0.6;
		for (const hole of this.holes) this.hide(hole);
		this.ctx.score(0);
		this.ctx.info(`${Math.ceil(this.clock.left)} s`);
		this.bar.firstChild.style.width = '100%';
	}

	hide(hole) {
		hole.kind = null;
		hole.up = 0;
		hole.el.classList.remove('up', 'hit');
	}

	handleInput({ type, event }) {
		if (type !== 'down' || !event) return;
		const n = Number(event.key);
		if (n >= 1 && n <= 9) this.bonk(n - 1);
	}

	bonk(i) {
		if (!this.running || this.paused) return;
		const hole = this.holes[i];
		if (!hole.kind || hole.hit) return;
		hole.hit = true;
		hole.life = Math.min(hole.life, 0.25);
		hole.el.classList.add('hit');
		const points = KINDS[hole.kind].points;
		this.score = Math.max(0, this.score + points);
		this.ctx.score(this.score);
		const fx = this.ctx.fx;
		const at = fx.centre(hole.el);
		if (points > 0) {
			this.ctx.audio.play(hole.kind === 'gold' ? 'treasure' : 'punch');
			const gold = hole.kind === 'gold';
			fx.burst(at, { count: gold ? 26 : 12, colors: gold ? ['#fde047', '#fbbf24', '#ffffff'] : ['#fde047', '#ffffff'], speed: gold ? 260 : 180, life: 0.6, shape: 'star', size: gold ? 7 : 5, gravity: 200 });
			fx.burst({ x: at.x, y: at.y + 20 }, { count: 8, color: '#a16207', speed: 90, angle: -Math.PI / 2, spread: 2.2, life: 0.5, shape: 'dust', size: 4, gravity: 300 });
			fx.ring(at, { color: gold ? '#fde047' : '#ffffff', radius: 50 });
			fx.text(`+${points}`, { x: at.x, y: at.y - 30 }, { color: gold ? '#fde047' : '#ffffff', size: gold ? 30 : 22 });
			if (gold) fx.shake(4);
		} else {
			this.ctx.audio.play('error');
			fx.text(`${points}`, { x: at.x, y: at.y - 30 }, { color: '#fb7185', size: 24 });
			fx.flash('#fb7185', 0.22);
			fx.nope(hole.el);
		}
	}

	update(dt) {
		if (!this.running) return;
		if (this.clock.update(dt)) {
			for (const hole of this.holes) this.hide(hole);
			return this.finish({ win: true, title: 'Time!', message: `You scored ${this.score} points.`, score: this.score });
		}
		this.ctx.info(`${Math.ceil(this.clock.left)} s`);
		this.bar.firstChild.style.width = `${(this.clock.left / this.clock.total) * 100}%`;
		this.bar.classList.toggle('low', this.clock.left <= 5);
		// moles come faster and stay shorter as the clock runs down
		const progress = 1 - this.clock.left / this.clock.total;
		this.spawn -= dt;
		if (this.spawn <= 0) {
			this.spawn = 0.75 - progress * 0.4 + Math.random() * 0.3;
			const free = this.holes.filter((hole) => !hole.kind);
			if (free.length) {
				const hole = free[Math.floor(Math.random() * free.length)];
				const roll = Math.random();
				hole.kind = roll < 0.1 ? 'gold' : roll < 0.28 ? 'bunny' : 'mole';
				hole.critter.innerHTML = KINDS[hole.kind].face;
				hole.life = 1.1 - progress * 0.45 + Math.random() * 0.3;
				hole.hit = false;
				hole.el.classList.add('up');
				this.ctx.audio.play('pop');
			}
		}
		for (const hole of this.holes) {
			if (!hole.kind) continue;
			hole.life -= dt;
			if (hole.life <= 0) this.hide(hole);
		}
	}

	dispose() {
		this.el.remove();
		this.style.remove();
	}
}

const MOLE_CSS = `
.mole-wrap { display: flex; flex-direction: column; gap: 16px; width: min(560px, 94vw, 80vh); }
.mole-timer { height: 8px; border-radius: 4px; background: rgba(255,255,255,0.08); overflow: hidden; }
.mole-timer div { height: 100%; background: linear-gradient(90deg, var(--color-success), var(--color-warning)); transition: width 0.2s linear; }
.mole-timer.low div { background: var(--color-danger); animation: mole-low 0.5s ease-in-out infinite alternate; }
@keyframes mole-low { to { opacity: 0.45; } }
.mole-field { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 18px; border-radius: 24px; background: linear-gradient(180deg, #4d7c0f, #365314); box-shadow: inset 0 -8px 0 rgba(0,0,0,0.2); }
.mole-hole { position: relative; aspect-ratio: 1; border: 0; padding: 0; background: none; cursor: pointer; touch-action: manipulation; }
.mole-pit { position: absolute; left: 8%; right: 8%; bottom: 10%; height: 70%; overflow: hidden; border-radius: 0 0 50% 50% / 0 0 30% 30%; }
.mole-pit::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 26%; border-radius: 50%; background: #1c1007; box-shadow: inset 0 6px 10px rgba(0,0,0,0.6); z-index: 2; opacity: 0.85; }
.mole-critter { position: absolute; left: 10%; right: 10%; bottom: -100%; height: 90%; transition: bottom 0.12s ease-out; z-index: 1; }
.mole-critter svg { width: 100%; height: 100%; display: block; }
.mole-hole.up .mole-critter { bottom: 4%; }
.mole-hole.hit .mole-critter { filter: brightness(1.6) saturate(0.4); transform: scale(1.15, 0.6); transform-origin: bottom; transition: bottom 0.12s ease-out, transform 0.08s ease-out; }
.mole-hole.up .mole-critter { animation: mole-pop 0.28s cubic-bezier(.34,1.56,.64,1); }
@keyframes mole-pop { from { transform: scale(0.8, 1.2); } }
.mole-hole:active { transform: scale(0.96); }
.mole-hole::before { content: ''; position: absolute; left: 4%; right: 4%; bottom: 4%; height: 26%; border-radius: 50%; background: #2a1a0b; }
.mole-key { position: absolute; right: 6px; top: 4px; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.4); }
`;
