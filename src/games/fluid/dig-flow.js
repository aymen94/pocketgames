// Dig Flow: dig channels through the dirt so the water reaches the thirsty flower pots.
// Built on the falling-sand engine: water flows and pools for real, stone cannot be dug,
// and lava turns any water that touches it into stone and steam. Dig as little as you can.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { Powder, M } from './powder.js';
import { fillRound, text } from '../core/canvas.js';

const GW = 160, GH = 100, CELL = 5;
const W = GW * CELL, H = GH * CELL;

// Each level paints the grid: rect(type, x0, y0, x1, y1) in cells. Pots are { x0, x1, y, need }.
const LEVELS = [
	{ name: 'First Drops', budget: 900, build: (b) => { b.dirt(0, 30, GW, GH); b.pool(10, 4, 40, 26); b.pot(120, 150, 92, 140); } },
	{ name: 'Stone Shelf', budget: 900, build: (b) => { b.dirt(0, 28, GW, GH); b.pool(110, 4, 150, 24); b.rect(M.STONE, 40, 52, 150, 56); b.pot(10, 40, 92, 150); } },
	{ name: 'Hot Spot', budget: 1000, build: (b) => { b.dirt(0, 30, GW, GH); b.pool(8, 4, 44, 26); b.rect(M.LAVA, 64, 64, 96, 72); b.rect(M.STONE, 60, 72, 100, 75); b.pot(120, 150, 92, 140); } },
	{ name: 'Two Pots', budget: 1200, build: (b) => { b.dirt(0, 30, GW, GH); b.pool(62, 2, 98, 26); b.pot(6, 34, 92, 110); b.pot(126, 154, 92, 110); } },
	{ name: 'Maze of Rock', budget: 1100, build: (b) => { b.dirt(0, 24, GW, GH); b.pool(6, 2, 40, 20); b.rect(M.STONE, 0, 44, 120, 47); b.rect(M.STONE, 40, 68, GW, 71); b.rect(M.LAVA, 10, 80, 30, 86); b.pot(130, 156, 94, 150); } },
];

export default class DigFlow extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.levelLabel = tool.label('');
		this.budgetLabel = tool.label('');
		return tool.bar(this.levelLabel, this.budgetLabel, tool.button('Retry level', () => this.load(this.level)));
	}

	setup() {
		this.sim = new Powder(GW, GH);
		this.buffer = document.createElement('canvas');
		this.buffer.width = GW;
		this.buffer.height = GH;
		this.bg = this.buffer.getContext('2d');
		this.time = 0;
	}

	reset() {
		super.reset();
		this.level = 0;
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	restore(data) {
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.load(Math.min(LEVELS.length - 1, data.level ?? 0));
	}

	load(i) {
		this.level = i;
		const L = LEVELS[i];
		const s = this.sim;
		s.clear();
		this.pots = [];
		const builder = {
			rect: (t, x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s.set(x, y, t); },
			dirt: (x0, y0, x1, y1) => builder.rect(M.DIRT, x0, y0, x1, y1),
			// a stone basin full of water, sunk into the dirt
			pool: (x0, y0, x1, y1) => {
				builder.rect(M.STONE, x0 - 2, y0, x1 + 2, y1 + 2);
				builder.rect(M.WATER, x0, y0, x1, y1);
				builder.rect(M.DIRT, x0, y1, x1, y1 + 2); // the plug you dig through
			},
			pot: (x0, x1, y, need) => {
				builder.rect(M.EMPTY, x0, y - 16, x1, y);
				builder.rect(M.STONE, x0 - 2, y, x1 + 2, y + 3);
				builder.rect(M.STONE, x0 - 2, y - 12, x0, y);
				builder.rect(M.STONE, x1, y - 12, x1 + 2, y);
				this.pots.push({ x0, x1, y, need, have: 0 });
			},
		};
		L.build(builder);
		// the bottom row and sides are bedrock
		builder.rect(M.STONE, 0, GH - 2, GW, GH);
		this.budget = L.budget;
		this.dug = 0;
		this.done = false;
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${L.name}`;
		this.paintBudget();
		this.ctx.info('Dig with the mouse or a finger');
		this.ctx.saveProgress({ level: i, score: this.score });
	}

	paintBudget() {
		this.budgetLabel.textContent = `Digging left ${Math.max(0, this.budget - this.dug)}`;
	}

	pointerDown(p) { this.last = { x: p.x / CELL, y: p.y / CELL }; this.dig(this.last, this.last); }
	pointerMove(p) {
		if (!p.down || !this.last) return;
		const q = { x: p.x / CELL, y: p.y / CELL };
		this.dig(this.last, q);
		this.last = q;
	}
	pointerUp() { this.last = null; }

	dig(a, b) {
		if (!this.running || this.done) return;
		const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
		const s = this.sim;
		let removed = 0;
		for (let i = 0; i <= steps; i++) {
			const cx = a.x + ((b.x - a.x) * i) / steps, cy = a.y + ((b.y - a.y) * i) / steps;
			for (let y = Math.floor(cy - 3); y <= cy + 3; y++) for (let x = Math.floor(cx - 3); x <= cx + 3; x++) {
				if ((x - cx) ** 2 + (y - cy) ** 2 > 9 || s.get(x, y) !== M.DIRT) continue;
				if (this.dug + removed >= this.budget) break;
				s.set(x, y, M.EMPTY);
				removed++;
			}
		}
		if (removed) {
			this.dug += removed;
			this.paintBudget();
			if (Math.random() < 0.3) this.ctx.audio.play('flip');
			this.fx.particles.burst(b.x * CELL, b.y * CELL, { count: 2, color: '#8b5a2b', speed: 60, life: 0.4, shape: 'dust', size: 3, gravity: 300 });
		}
	}

	tick(dt) {
		this.time += dt;
		if (!this.running || this.paused) return;
		this.sim.step();
		if (this.done) return;
		const s = this.sim;
		let all = true;
		for (const p of this.pots) {
			let n = 0;
			for (let y = p.y - 12; y < p.y; y++) for (let x = p.x0; x < p.x1; x++) if (s.type[x + y * GW] === M.WATER) n++;
			p.have = n;
			if (n < p.need) all = false;
		}
		if (all) this.complete();
	}

	complete() {
		this.done = true;
		const left = Math.max(0, this.budget - this.dug);
		const gain = 200 + Math.round(left / 4);
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		for (const p of this.pots) {
			// the flowers bloom
			this.sim.paint((p.x0 + p.x1) / 2, p.y - 13, 3, M.PLANT, { replace: true });
			this.burst(((p.x0 + p.x1) / 2) * CELL, (p.y - 14) * CELL, { count: 30, colors: ['#f472b6', '#fde047', '#34d399'], speed: 160, angle: -Math.PI / 2, spread: 1.8, life: 0.9, shape: 'star', size: 5, gravity: 200 });
		}
		this.popup(`+${gain}`, W / 2, 60, { color: '#fde047', size: 28 });
		setTimeout(() => {
			if (!this.running) return;
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Garden in bloom!', message: 'Every pot watered.', score: this.score });
			this.load(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1600);
	}

	draw(g) {
		const img = this.sim.paintImage(this.time);
		// the sky behind empty cells
		const d = img.data;
		for (let k = 0, n = GW * GH; k < n; k++) {
			if (this.sim.type[k] !== M.EMPTY) continue;
			const y = (k / GW) | 0;
			d[k * 4] = 20 + y * 0.4; d[k * 4 + 1] = 28 + y * 0.5; d[k * 4 + 2] = 56 + y * 0.6;
		}
		this.bg.putImageData(img, 0, 0);
		g.imageSmoothingEnabled = false;
		g.drawImage(this.buffer, 0, 0, W, H);
		for (const p of this.pots) {
			const x = p.x0 * CELL, w = (p.x1 - p.x0) * CELL, y = (p.y - 12) * CELL;
			const k = Math.min(1, p.have / p.need);
			g.strokeStyle = k >= 1 ? '#34d399' : 'rgba(255,255,255,0.5)';
			g.setLineDash([4, 4]);
			g.strokeRect(x, y, w, 12 * CELL);
			g.setLineDash([]);
			fillRound(g, x, y - 16, w, 8, 4, 'rgba(0,0,0,0.4)');
			fillRound(g, x, y - 16, Math.max(8, w * k), 8, 4, k >= 1 ? '#34d399' : '#60a5fa');
			text(g, '🌱', x + w / 2, y + 30, { size: 22 });
		}
		const p = this.pointer;
		g.strokeStyle = 'rgba(255,255,255,0.6)';
		g.beginPath();
		g.arc(p.x, p.y, 3 * CELL, 0, Math.PI * 2);
		g.stroke();
	}
}
