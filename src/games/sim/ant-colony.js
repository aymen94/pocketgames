// Ant Colony: hundreds of ants forage by smell. Searching ants follow the food trail and
// lay a home trail; laden ants follow the home trail back and lay a food trail, so roads
// emerge by themselves. Guide them with walls and a few sugar drops, and store as much
// food as you can before winter (three minutes). Every 5 food stored hatches a new ant.
// Ants live in typed arrays and the trails in two Float32Array grids drawn via ImageData.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { circle, text, colors } from '../core/canvas.js';
import { qualityProfile } from '../../services/graphics.js';

const W = 800, H = 520, CELL = 4, GW = W / CELL, GH = H / CELL;
const NEST = { x: W / 2, y: H / 2, r: 16 };
const SEASON = 180;

export default class AntColony extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.toolChoice = tool.choice([['wall', 'Wall'], ['erase', 'Erase'], ['sugar', 'Sugar']], 'wall', (v) => { this.tool = v; });
		this.sugarLabel = tool.label('');
		return tool.bar(this.toolChoice.el, this.sugarLabel, tool.choice([['1', '1×'], ['2', '2×'], ['4', '4×']], '1', (v) => { this.timeScale = Number(v); }).el);
	}

	setup() {
		this.max = Math.round(900 * Math.max(0.45, qualityProfile().particles));
		this.ax = new Float32Array(this.max); this.ay = new Float32Array(this.max); this.aa = new Float32Array(this.max);
		this.carry = new Uint8Array(this.max);
		this.toFood = new Float32Array(GW * GH); this.toHome = new Float32Array(GW * GH);
		this.food = new Uint16Array(GW * GH); this.wall = new Uint8Array(GW * GH);
		this.img = new ImageData(GW, GH);
		this.off = document.createElement('canvas'); this.off.width = GW; this.off.height = GH;
		this.offG = this.off.getContext('2d');
		this.tool = 'wall';
		this.timeScale = 1;
	}

	reset() {
		super.reset();
		this.toFood.fill(0); this.toHome.fill(0); this.food.fill(0); this.wall.fill(0);
		this.count = 0;
		for (let i = 0; i < 120; i++) this.spawn();
		// three food piles at random spots away from the nest
		for (let k = 0; k < 3; k++) {
			let x, y;
			do { x = 40 + Math.random() * (W - 80); y = 40 + Math.random() * (H - 80); } while (Math.hypot(x - NEST.x, y - NEST.y) < 170);
			this.pile(x, y, 18, 6);
		}
		// a few rocks
		for (let k = 0; k < 6; k++) {
			const x = Math.floor(Math.random() * GW), y = Math.floor(Math.random() * GH), len = 8 + Math.floor(Math.random() * 20), horiz = Math.random() < 0.5;
			for (let j = 0; j < len; j++) this.setWall(horiz ? x + j : x, horiz ? y : y + j, 1, 1);
		}
		this.clearNest();
		this.stored = 0;
		this.hatchProgress = 0;
		this.sugar = 4;
		this.time = SEASON;
		this.sugarLabel.textContent = `Sugar ×${this.sugar}`;
		this.ctx.score(0);
	}

	clearNest() {
		for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) { const gx = Math.floor(NEST.x / CELL) + x, gy = Math.floor(NEST.y / CELL) + y; if (gx >= 0 && gy >= 0 && gx < GW && gy < GH) this.wall[gy * GW + gx] = 0; }
	}

	spawn() {
		if (this.count >= this.max) return;
		const i = this.count++;
		this.ax[i] = NEST.x; this.ay[i] = NEST.y; this.aa[i] = Math.random() * Math.PI * 2; this.carry[i] = 0;
	}

	pile(cx, cy, r, amount) {
		const gx0 = Math.floor(cx / CELL), gy0 = Math.floor(cy / CELL), gr = Math.ceil(r / CELL);
		for (let y = -gr; y <= gr; y++) for (let x = -gr; x <= gr; x++) {
			if (x * x + y * y > gr * gr) continue;
			const gx = gx0 + x, gy = gy0 + y;
			if (gx >= 0 && gy >= 0 && gx < GW && gy < GH && !this.wall[gy * GW + gx]) this.food[gy * GW + gx] = Math.min(60000, this.food[gy * GW + gx] + amount);
		}
	}

	setWall(gx, gy, v, size = 2) {
		for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
			const xx = gx + x, yy = gy + y;
			if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
			const i = yy * GW + xx;
			this.wall[i] = v;
			if (v) { this.food[i] = 0; this.toFood[i] = this.toHome[i] = 0; }
		}
	}

	apply(p) {
		if (!this.running) return;
		if (Math.hypot(p.x - NEST.x, p.y - NEST.y) < NEST.r + 20 && this.tool !== 'sugar') return;
		if (this.tool === 'sugar') {
			if (!this.pointer.fresh) return;
			this.pointer.fresh = false;
			if (this.sugar <= 0) return this.ctx.audio.play('error');
			this.sugar--;
			this.sugarLabel.textContent = `Sugar ×${this.sugar}`;
			this.pile(p.x, p.y, 14, 5);
			this.ctx.audio.play('pop');
			return;
		}
		this.setWall(Math.floor(p.x / CELL) - 1, Math.floor(p.y / CELL) - 1, this.tool === 'wall' ? 1 : 0, 3);
	}

	pointerDown(p) { this.pointer.fresh = true; this.apply(p); }
	pointerMove(p) { if (this.pointer.down) this.apply(p); }

	sense(field, x, y) {
		const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
		if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1) return -1;
		const i = gy * GW + gx;
		if (this.wall[i]) return -1;
		return field[i] + field[i - 1] + field[i + 1] + field[i - GW] + field[i + GW];
	}

	step(dt) {
		dt *= this.timeScale;
		this.time -= dt;
		if (this.time <= 0) {
			this.time = 0;
			this.ctx.audio.play('win');
			return this.finish({ win: this.stored >= 100, title: 'Winter has come', message: `Your colony stored ${this.stored} food and grew to ${this.count} ants.`, score: this.stored });
		}
		const sub = Math.ceil(dt / (1 / 60));
		for (let s = 0; s < sub; s++) this.tick1(dt / sub);
		this.ctx.score(this.stored);
		this.ctx.info(`${Math.ceil(this.time)} s to winter · ${this.count} ants · ${this.stored} food`);
	}

	tick1(dt) {
		const { ax, ay, aa, carry, toFood, toHome, food, wall } = this;
		const speed = 46, look = 9, turn = 0.6;
		for (let i = 0; i < this.count; i++) {
			const field = carry[i] ? toHome : toFood;
			let a = aa[i];
			// smell ahead-left, ahead and ahead-right
			const l = this.sense(field, ax[i] + Math.cos(a - turn) * look, ay[i] + Math.sin(a - turn) * look);
			const c = this.sense(field, ax[i] + Math.cos(a) * look, ay[i] + Math.sin(a) * look);
			const r = this.sense(field, ax[i] + Math.cos(a + turn) * look, ay[i] + Math.sin(a + turn) * look);
			if (c >= l && c >= r) a += (Math.random() - 0.5) * 0.25;
			else if (l > r) a -= 0.35;
			else a += 0.35;
			a += (Math.random() - 0.5) * 0.35;
			// laden ants also feel the nest when close
			if (carry[i]) {
				const dx = NEST.x - ax[i], dy = NEST.y - ay[i], d = Math.hypot(dx, dy);
				if (d < 80) a += Math.sin(Math.atan2(dy, dx) - a) * 0.2;
			}
			let nx = ax[i] + Math.cos(a) * speed * dt, ny = ay[i] + Math.sin(a) * speed * dt;
			const gx = (nx / CELL) | 0, gy = (ny / CELL) | 0;
			if (nx < 2 || ny < 2 || nx > W - 2 || ny > H - 2 || wall[gy * GW + gx]) { a += Math.PI * (0.6 + Math.random() * 0.8); nx = ax[i]; ny = ay[i]; }
			ax[i] = nx; ay[i] = ny; aa[i] = a;
			const cell = ((ny / CELL) | 0) * GW + ((nx / CELL) | 0);
			if (carry[i]) {
				toFood[cell] = Math.min(1, toFood[cell] + 0.12);
				if (Math.hypot(nx - NEST.x, ny - NEST.y) < NEST.r) {
					carry[i] = 0;
					aa[i] += Math.PI;
					this.stored++;
					if (++this.hatchProgress >= 5) { this.hatchProgress = 0; this.spawn(); }
				}
			} else {
				toHome[cell] = Math.min(1, toHome[cell] + 0.08);
				if (food[cell] > 0) { food[cell]--; carry[i] = 1; aa[i] += Math.PI; }
			}
		}
		// evaporation
		const keepF = Math.exp(-dt * 0.25), keepH = Math.exp(-dt * 0.18);
		for (let i = 0; i < toFood.length; i++) { toFood[i] *= keepF; toHome[i] *= keepH; }
		// the nest smells like home
		const ni = Math.floor(NEST.y / CELL) * GW + Math.floor(NEST.x / CELL);
		for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) toHome[ni + y * GW + x] = 1;
	}

	draw(g) {
		const { img, toFood, toHome, food, wall } = this;
		const d = img.data;
		for (let i = 0, p = 0; i < GW * GH; i++, p += 4) {
			if (wall[i]) { d[p] = 87; d[p + 1] = 83; d[p + 2] = 78; d[p + 3] = 255; continue; }
			if (food[i]) { d[p] = 132; d[p + 1] = 204; d[p + 2] = 22; d[p + 3] = 255; continue; }
			const f = toFood[i], h = toHome[i];
			d[p] = 40 + f * 200; d[p + 1] = 30 + f * 60 + h * 40; d[p + 2] = 22 + h * 170; d[p + 3] = 255;
		}
		this.offG.putImageData(img, 0, 0);
		g.imageSmoothingEnabled = qualityProfile().detail > 0;
		g.drawImage(this.off, 0, 0, W, H);
		g.imageSmoothingEnabled = true;
		circle(g, NEST.x, NEST.y, NEST.r + 4, '#451a03');
		circle(g, NEST.x, NEST.y, NEST.r - 4, '#1c0a00');
		g.fillStyle = '#f5f5f4';
		for (let i = 0; i < this.count; i++) {
			if (this.carry[i]) continue;
			g.fillRect(this.ax[i] - 1, this.ay[i] - 1, 2.4, 2.4);
		}
		g.fillStyle = '#bef264';
		for (let i = 0; i < this.count; i++) if (this.carry[i]) g.fillRect(this.ax[i] - 1.5, this.ay[i] - 1.5, 3.2, 3.2);
		g.fillStyle = 'rgba(0,0,0,0.55)';
		g.fillRect(0, 0, W, 24);
		text(g, `Winter in ${Math.ceil(this.time)} s   ·   ${this.count} ants   ·   ${this.stored} food stored`, 10, 12, { size: 13, align: 'left', color: '#fef3c7' });
		text(g, 'orange = food trail · blue = home trail', W - 10, 12, { size: 12, align: 'right', color: colors.highlight });
	}
}
