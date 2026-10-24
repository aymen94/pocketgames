// Tiny Town: a pocket city builder. Lay roads, zone houses, open shops and factories,
// plant parks. Houses only grow when they touch a road, have jobs nearby and are happy:
// parks and shops cheer people up, factories next door do not. Taxes pay the bills;
// reach 600 residents to win, but go bankrupt and the mayor is out.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text, colors } from '../core/canvas.js';

const COLS = 24, ROWS = 15, CELL = 32, TOP = 34, W = COLS * CELL, H = ROWS * CELL + TOP;
const GOAL = 600;
const KINDS = {
	road: { name: 'Road', cost: 5 },
	house: { name: 'House', cost: 20 },
	shop: { name: 'Shop', cost: 40, jobs: 6 },
	factory: { name: 'Factory', cost: 60, jobs: 16 },
	park: { name: 'Park', cost: 30 },
	bulldoze: { name: 'Bulldoze', cost: 2 },
};
const CAP = [0, 4, 10, 20];

export default class TinyTown extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.toolChoice = tool.choice(Object.entries(KINDS).map(([k, v]) => [k, `${v.name} ${v.cost}`]), 'road', (v) => { this.tool = v; });
		return tool.bar(this.toolChoice.el);
	}

	reset() {
		super.reset();
		this.tool = 'road';
		this.toolChoice?.set('road');
		this.map = Array.from({ length: COLS * ROWS }, () => null);
		// a starter road along the middle and a lake
		for (let x = 0; x < COLS; x++) this.map[7 * COLS + x] = { kind: 'road' };
		const lx = 3 + Math.floor(Math.random() * 14), ly = Math.random() < 0.5 ? 2 : 10;
		for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) if ((x + y) % 5) this.map[(ly + y) * COLS + lx + x] = { kind: 'water' };
		this.money = 300;
		this.day = 0;
		this.acc = 0;
		this.pop = 0;
		this.jobs = 0;
		this.happy = 50;
		this.income = 0;
		this.milestone = 100;
		this.ctx.score(0);
		this.status();
	}

	status() { this.ctx.info(`Day ${this.day} · $${Math.floor(this.money)} (${this.income >= 0 ? '+' : ''}${this.income.toFixed(0)}/day) · pop ${this.pop}/${GOAL}`); }

	at(x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS ? this.map[y * COLS + x] : undefined; }
	onRoad(x, y) { return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.at(x + dx, y + dy)?.kind === 'road'); }
	near(x, y, kind, r) {
		let n = 0;
		for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (this.at(xx, yy)?.kind === kind && Math.abs(xx - x) + Math.abs(yy - y) <= r) n++;
		return n;
	}

	pointerDown(p) { this.build(p); }
	pointerMove(p) { if (this.pointer.down && (this.tool === 'road' || this.tool === 'bulldoze')) this.build(p); }

	build(p) {
		if (!this.running) return;
		const x = Math.floor(p.x / CELL), y = Math.floor((p.y - TOP) / CELL);
		if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
		const i = y * COLS + x, here = this.map[i], spec = KINDS[this.tool];
		if (this.tool === 'bulldoze') {
			if (!here || here.kind === 'water') return;
			this.map[i] = null;
			this.money -= spec.cost;
			this.ctx.audio.play('crash');
			this.burst(x * CELL + CELL / 2, TOP + y * CELL + CELL / 2, { count: 10, color: '#a8a29e', speed: 80, life: 0.4, size: 3, shape: 'square' });
			return this.status();
		}
		if (here) return;
		if (this.money < spec.cost) { this.popup('Not enough money', p.x, p.y, { size: 14, color: '#fca5a5' }); return this.ctx.audio.play('error'); }
		this.map[i] = { kind: this.tool, level: this.tool === 'house' ? 1 : 0, residents: 0 };
		this.money -= spec.cost;
		this.ctx.audio.play(this.tool === 'road' ? 'tick' : 'place');
		this.status();
	}

	step(dt) {
		this.acc += dt;
		if (this.acc < 1) return;
		this.acc -= 1;
		this.day++;
		this.simulate();
	}

	simulate() {
		let jobs = 0, pop = 0, income = 0, happySum = 0, houses = 0;
		for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
			const t = this.map[y * COLS + x];
			if (!t) continue;
			if (t.kind === 'road') income -= 0.25;
			if (t.kind === 'park') income -= 1;
			if ((t.kind === 'shop' || t.kind === 'factory') && this.onRoad(x, y)) { t.open = true; jobs += KINDS[t.kind].jobs; } else if (t.kind === 'shop' || t.kind === 'factory') t.open = false;
			if (t.kind === 'house') pop += t.residents;
		}
		const employment = pop ? Math.min(1, jobs / (pop * 0.6)) : 1;
		for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
			const t = this.map[y * COLS + x];
			if (!t) continue;
			if (t.kind === 'shop' && t.open) income += 2 + Math.min(6, this.near(x, y, 'house', 4) * 0.6);
			if (t.kind === 'factory' && t.open) { income += 4; if (Math.random() < 0.5) this.burst(x * CELL + 22, TOP + y * CELL + 2, { count: 1, color: '#9ca3af', speed: 20, angle: -Math.PI / 2, spread: 0.6, life: 1.4, size: 4, shape: 'smoke', gravity: -10 }); }
			if (t.kind !== 'house') continue;
			houses++;
			const connected = this.onRoad(x, y);
			let happy = 45 + Math.min(30, this.near(x, y, 'park', 3) * 15) + Math.min(20, this.near(x, y, 'shop', 4) * 10) - this.near(x, y, 'factory', 2) * 18 + (this.near(x, y, 'water', 2) ? 8 : 0) - (1 - employment) * 40;
			if (!connected) happy -= 40;
			t.happy = Math.max(0, Math.min(100, happy));
			happySum += t.happy;
			const cap = CAP[t.level];
			if (connected && t.happy >= 40 && employment > 0.7 && t.residents < cap) t.residents = Math.min(cap, t.residents + 1 + (t.happy > 70 ? 1 : 0));
			else if ((t.happy < 25 || !connected) && t.residents > 0) t.residents--;
			if (t.residents >= cap && t.level < 3 && t.happy >= 60 + t.level * 10 && Math.random() < 0.15) {
				t.level++;
				this.ctx.audio.play('powerup');
				this.burst(x * CELL + CELL / 2, TOP + y * CELL + CELL / 2, { count: 14, color: colors.accent, speed: 90, life: 0.5, shape: 'star', size: 3 });
			}
			income += t.residents * 0.9;
		}
		this.money += income;
		this.income = income;
		this.pop = pop;
		this.jobs = jobs;
		this.happy = houses ? Math.round(happySum / houses) : 50;
		this.ctx.score(pop);
		this.status();
		if (pop >= this.milestone && pop < GOAL) { this.ctx.fx.banner(`${this.milestone} residents!`); this.ctx.audio.play('levelup'); this.milestone += 100; }
		if (pop >= GOAL) {
			this.ctx.audio.play('cheer');
			this.ctx.fx.confetti({ count: 100 });
			return this.finish({ win: true, title: 'A thriving town!', message: `${pop} residents on day ${this.day}.`, score: pop + Math.max(0, 600 - this.day) });
		}
		if (this.money < -100) {
			this.ctx.audio.play('lose');
			this.finish({ win: false, title: 'Bankrupt', message: `The town ran out of money on day ${this.day} with ${pop} residents.`, score: pop });
		}
	}

	drawTile(g, t, x, y) {
		const px = x * CELL, py = TOP + y * CELL;
		switch (t.kind) {
			case 'road': {
				g.fillStyle = '#4b5563';
				g.fillRect(px, py, CELL, CELL);
				g.fillStyle = '#fde68a';
				const h = this.at(x - 1, y)?.kind === 'road' || this.at(x + 1, y)?.kind === 'road', v = this.at(x, y - 1)?.kind === 'road' || this.at(x, y + 1)?.kind === 'road';
				if (h) g.fillRect(px + 4, py + CELL / 2 - 1, CELL - 8, 2);
				if (v) g.fillRect(px + CELL / 2 - 1, py + 4, 2, CELL - 8);
				break;
			}
			case 'water': fillRound(g, px + 1, py + 1, CELL - 2, CELL - 2, 6, '#38bdf8'); break;
			case 'park':
				fillRound(g, px + 2, py + 2, CELL - 4, CELL - 4, 6, '#22c55e');
				circle(g, px + 11, py + 12, 6, '#15803d'); circle(g, px + 21, py + 20, 6, '#166534');
				break;
			case 'shop':
				fillRound(g, px + 3, py + 6, CELL - 6, CELL - 9, 3, t.open ? '#f472b6' : '#9ca3af');
				g.fillStyle = '#fdf2f8'; g.fillRect(px + 3, py + 6, CELL - 6, 5);
				g.fillStyle = '#1f2937'; g.fillRect(px + 12, py + 18, 8, 11);
				break;
			case 'factory':
				fillRound(g, px + 2, py + 10, CELL - 4, CELL - 12, 2, t.open ? '#a16207' : '#9ca3af');
				g.fillStyle = '#57534e'; g.fillRect(px + 19, py + 2, 6, 12);
				g.fillStyle = '#fde68a'; g.fillRect(px + 6, py + 18, 5, 5); g.fillRect(px + 14, py + 18, 5, 5);
				break;
			case 'house': {
				const hue = t.happy >= 60 ? '#60a5fa' : t.happy >= 35 ? '#fbbf24' : '#f87171';
				const s = 12 + t.level * 4;
				g.fillStyle = hue;
				g.fillRect(px + CELL / 2 - s / 2, py + CELL - 4 - s, s, s);
				g.fillStyle = '#b91c1c';
				g.beginPath(); g.moveTo(px + CELL / 2 - s / 2 - 3, py + CELL - 4 - s); g.lineTo(px + CELL / 2, py + CELL - 10 - s); g.lineTo(px + CELL / 2 + s / 2 + 3, py + CELL - 4 - s); g.fill();
				if (t.level >= 2) { g.fillStyle = '#fef9c3'; g.fillRect(px + CELL / 2 - 2, py + CELL - s + 2, 4, 4); }
				break;
			}
		}
	}

	draw(g) {
		g.fillStyle = '#4d7c0f';
		g.fillRect(0, 0, W, H);
		for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
			if ((x + y) % 2) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x * CELL, TOP + y * CELL, CELL, CELL); }
			const t = this.map[y * COLS + x];
			if (t) this.drawTile(g, t, x, y);
		}
		// hover info
		const hx = Math.floor(this.pointer.x / CELL), hy = Math.floor((this.pointer.y - TOP) / CELL);
		const hover = this.at(hx, hy);
		if (hover !== undefined) {
			g.strokeStyle = colors.accent; g.lineWidth = 2;
			g.strokeRect(hx * CELL + 1, TOP + hy * CELL + 1, CELL - 2, CELL - 2);
		}
		g.fillStyle = 'rgba(15,23,42,0.85)';
		g.fillRect(0, 0, W, TOP);
		const info = hover?.kind === 'house' ? `House L${hover.level}: ${hover.residents}/${CAP[hover.level]} residents · happiness ${Math.round(hover.happy ?? 0)}${this.onRoad(hx, hy) ? '' : ' · needs a road!'}` : hover && (hover.kind === 'shop' || hover.kind === 'factory') ? `${KINDS[hover.kind].name}: ${hover.open ? `${KINDS[hover.kind].jobs} jobs` : 'closed: needs a road'}` : `Pop ${this.pop}/${GOAL} · jobs ${this.jobs} · happiness ${this.happy}`;
		text(g, `Day ${this.day}   $${Math.floor(this.money)} (${this.income >= 0 ? '+' : ''}${this.income.toFixed(0)})`, 10, TOP / 2, { size: 14, align: 'left', color: this.money < 0 ? '#fca5a5' : '#fef3c7' });
		text(g, info, W - 10, TOP / 2, { size: 13, align: 'right', color: '#e2e8f0' });
	}
}
