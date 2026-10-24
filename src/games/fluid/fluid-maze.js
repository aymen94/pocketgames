// Fluid Maze: tilt gravity to pour a body of liquid through a maze into the drain.
// The liquid splits, splashes and pools like water; fire cells boil it away. Get enough
// of it home before the clock runs out.

import { CanvasGame } from '../kit/canvasGame.js';
import { Liquid } from './liquid.js';
import { fillRound, text } from '../core/canvas.js';

const CELL = 36, COLS = 16, ROWS = 14;
const W = CELL * COLS, H = CELL * ROWS;

const BASE = [
	{ name: 'Switchback', need: 0.5, time: 60, grid: ['################', '#SS............#', '#SS............#', '###########....#', '#..............#', '#..............#', '#....###########', '#..............#', '#..............#', '###########....#', '#..............#', '#GGG...........#', '#GGG...........#', '################'] },
	{ name: 'Hot Shelves', need: 0.55, time: 70, grid: ['################', '#SS............#', '#SS............#', '#########...####', '#FFF...........#', '#..............#', '#....#########F#', '#..............#', '#..............#', '######.....#####', '#FF............#', '#............GG#', '#FF..........GG#', '################'] },
	{ name: 'Spiral', need: 0.55, time: 100, grid: ['################', '#SS#...........#', '#SS#.#########.#', '#..#.#.......#.#', '#..#.#.#####.#.#', '#..#.#.#GGG#.#.#', '#..#.#.#GGG#.#.#', '#..#.#.##..#.#.#', '#..#.#.....#.#.#', '#..#.#######.#.#', '#..#.........#.#', '#..###########.#', '#..............#', '################'] },
];
const mirror = (L, extra) => ({ ...L, ...extra, grid: L.grid.map((row) => [...row].reverse().join('')) });
const LEVELS = [...BASE, mirror(BASE[1], { name: 'Hot Shelves II', need: 0.6, time: 60 }), mirror(BASE[2], { name: 'Spiral II', need: 0.6, time: 85 })];

export default class FluidMaze extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.liquid = new Liquid(240, { radius: 4.5, width: W, height: H, gravity: 0 });
		this.liquid.viscosity = 0.1;
		this.angle = Math.PI / 2;
		this.target = Math.PI / 2;
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	load(i) {
		this.level = i;
		const L = LEVELS[i];
		this.L = L;
		this.time = L.time;
		this.home = 0;
		this.done = false;
		this.angle = this.target = Math.PI / 2;
		const segs = [];
		this.fire = [];
		this.goal = [];
		const spawn = [];
		const at = (r, c) => (r < 0 || c < 0 || r >= ROWS || c >= COLS ? '#' : L.grid[r][c]);
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			const ch = at(r, c);
			const x = c * CELL, y = r * CELL;
			if (ch === '#') {
				// only the edges that face open space collide
				if (at(r - 1, c) !== '#') segs.push({ ax: x, ay: y, bx: x + CELL, by: y, thick: 1 });
				if (at(r + 1, c) !== '#') segs.push({ ax: x, ay: y + CELL, bx: x + CELL, by: y + CELL, thick: 1 });
				if (at(r, c - 1) !== '#') segs.push({ ax: x, ay: y, bx: x, by: y + CELL, thick: 1 });
				if (at(r, c + 1) !== '#') segs.push({ ax: x + CELL, ay: y, bx: x + CELL, by: y + CELL, thick: 1 });
			} else if (ch === 'F') this.fire.push({ x, y });
			else if (ch === 'G') this.goal.push({ x, y });
			else if (ch === 'S') spawn.push({ x, y });
		}
		this.liquid.segments = segs;
		this.liquid.clear();
		for (let i = 0; i < 200; i++) {
			const s = spawn[i % spawn.length];
			this.liquid.add(s.x + 6 + Math.random() * (CELL - 12), s.y + 6 + Math.random() * (CELL - 12));
		}
		this.total = 200;
		this.ctx.info(`Level ${i + 1}: ${L.name}`);
	}

	key(action) {
		const dirs = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
		if (action in dirs) this.target = dirs[action];
	}

	pointerDown(p) { this.aim(p); }
	pointerMove(p) { if (p.down) this.aim(p); }
	aim(p) {
		const dx = p.x - W / 2, dy = p.y - H / 2;
		if (Math.hypot(dx, dy) > 20) this.target = Math.atan2(dy, dx);
	}

	step(dt) {
		if (this.done) { this.liquid.step(Math.min(dt, 1 / 40)); return; }
		const axis = this.ctx.input.axis();
		if (axis.x || axis.y) this.target = Math.atan2(axis.y, axis.x);
		// turn gravity smoothly toward the target direction
		let d = this.target - this.angle;
		d = Math.atan2(Math.sin(d), Math.cos(d));
		this.angle += d * Math.min(1, dt * 6);
		const g = 1100;
		this.liquid.gravity.x = Math.cos(this.angle) * g;
		this.liquid.gravity.y = Math.sin(this.angle) * g;
		this.liquid.step(Math.min(dt, 1 / 40), 2);
		const liq = this.liquid;
		for (let i = 0; i < liq.count; i++) {
			if (!liq.alive[i]) continue;
			const c = Math.floor(liq.x[i] / CELL), r = Math.floor(liq.y[i] / CELL);
			const ch = this.L.grid[r]?.[c];
			if (ch === 'G') {
				liq.kill(i);
				this.home++;
				if (Math.random() < 0.4) this.fx.particles.burst(liq.x[i], liq.y[i], { count: 2, color: '#a7f3d0', speed: 60, life: 0.4, size: 3 });
				if (this.home % 10 === 0) this.ctx.audio.play('blip');
			} else if (ch === 'F') {
				liq.kill(i);
				this.fx.particles.burst(liq.x[i], liq.y[i], { count: 2, color: '#e2e8f0', speed: 30, angle: -Math.PI / 2, spread: 1, life: 0.7, shape: 'smoke', size: 5, grow: 6 });
			} else if (ch === '#' || ch === undefined) {
				// squeezed into a wall: put it back where it came from
				liq.x[i] = liq.px[i]; liq.y[i] = liq.py[i];
			}
		}
		this.time -= dt;
		const left = liq.living;
		const L = this.L;
		if (this.home / this.total >= L.need && (left === 0 || this.home / this.total >= Math.min(0.95, L.need + 0.25) || this.time <= 0)) return this.complete();
		if (this.time <= 0 || (this.home + left) / this.total < L.need) {
			if (this.home / this.total >= L.need) return this.complete();
			this.done = true;
			this.ctx.audio.play('lifelost');
			return this.finish({ win: false, title: this.time <= 0 ? 'Out of time' : 'Too much boiled away', message: `You reached level ${this.level + 1} (${L.name}).`, score: this.score });
		}
	}

	complete() {
		this.done = true;
		const pct = Math.round((this.home / this.total) * 100);
		const gain = pct * 5 + Math.max(0, Math.round(this.time)) * 3;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		this.popup(`${pct}% home · +${gain}`, W / 2, H / 2, { color: '#a7f3d0', size: 26 });
		setTimeout(() => {
			if (!this.running) return;
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Maze drained!', message: 'Every maze flowing home.', score: this.score });
			this.load(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1300);
	}

	draw(g) {
		g.fillStyle = '#0b1226';
		g.fillRect(0, 0, W, H);
		const t = performance.now() / 1000;
		for (const f of this.goal) {
			g.fillStyle = `rgba(52,211,153,${0.25 + Math.sin(t * 3 + f.x) * 0.08})`;
			g.fillRect(f.x, f.y, CELL, CELL);
		}
		for (const f of this.fire) {
			const grad = g.createLinearGradient(0, f.y + CELL, 0, f.y);
			grad.addColorStop(0, '#f97316');
			grad.addColorStop(1, 'rgba(251,113,133,0.25)');
			g.fillStyle = grad;
			g.fillRect(f.x, f.y, CELL, CELL);
			g.fillStyle = '#fde047';
			g.beginPath();
			g.moveTo(f.x + 8, f.y + CELL);
			g.quadraticCurveTo(f.x + CELL / 2, f.y + 6 + Math.sin(t * 10 + f.x) * 5, f.x + CELL - 8, f.y + CELL);
			g.fill();
		}
		this.liquid.draw(g, ['rgba(56,189,248,0.95)']);
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			if (this.L.grid[r][c] !== '#') continue;
			g.fillStyle = (r + c) % 2 ? '#334155' : '#3b4a63';
			g.fillRect(c * CELL, r * CELL, CELL, CELL);
		}
		// gravity arrow
		g.save();
		g.translate(W - 40, 40);
		g.rotate(this.angle);
		g.fillStyle = 'rgba(15,23,42,0.75)';
		g.beginPath(); g.arc(0, 0, 22, 0, Math.PI * 2); g.fill();
		g.fillStyle = '#fde047';
		g.beginPath(); g.moveTo(16, 0); g.lineTo(-8, -9); g.lineTo(-3, 0); g.lineTo(-8, 9); g.closePath(); g.fill();
		g.restore();
		const L = this.L;
		fillRound(g, 46, 10, 170, 16, 8, 'rgba(15,23,42,0.8)');
		fillRound(g, 46, 10, Math.max(16, 170 * Math.min(1, this.home / this.total / L.need)), 16, 8, this.home / this.total >= L.need ? '#34d399' : '#38bdf8');
		text(g, `${Math.round((this.home / this.total) * 100)}% / ${Math.round(L.need * 100)}%`, 131, 18, { size: 11, color: '#fff' });
		text(g, `${Math.max(0, Math.ceil(this.time))} s`, W / 2 + 40, 18, { size: 14, color: this.time < 10 ? '#fb7185' : '#e2e8f0' });
	}
}
