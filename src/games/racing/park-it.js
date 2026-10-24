// Park It: eight top-down parking challenges with a simple steering model. Stop fully
// inside the glowing bay; every scrape costs a star, three scrapes end the run.

import { Game } from '../core/game.js';
import { Surface, fillRound, text, colors } from '../core/canvas.js';
import { clamp } from '../core/physics.js';
import { CanvasFx } from '../core/fx.js';

const W = 800, H = 560, CAR_W = 30, CAR_L = 56, WHEELBASE = 36;

// rects: { x, y, w, h, a } centred, `a` in radians; a = 0 means the long side is vertical
const car = (x, y, a = 0, color = '#64748b') => ({ x, y, w: CAR_W + 2, h: CAR_L + 2, a, color, kind: 'car' });
const wall = (x, y, w, h, a = 0) => ({ x, y, w, h, a, kind: 'wall' });
const LEVELS = [
	{ name: 'First bay', start: { x: 400, y: 470, a: 0 }, bay: { x: 400, y: 110, w: 44, h: 70, a: 0 }, obstacles: [car(340, 110), car(460, 110), car(280, 110, 0, '#a78bfa'), car(520, 110, 0, '#f472b6')] },
	{ name: 'Turn in', start: { x: 140, y: 460, a: 0 }, bay: { x: 640, y: 120, w: 44, h: 70, a: 0 }, obstacles: [car(580, 120), car(700, 120, 0, '#fbbf24'), wall(400, 300, 260, 20)] },
	{ name: 'Reverse bay', start: { x: 400, y: 160, a: 0 }, bay: { x: 400, y: 440, w: 44, h: 70, a: 0 }, obstacles: [car(340, 440, 0, '#34d399'), car(460, 440), car(280, 440), car(520, 440, 0, '#f472b6')] },
	{ name: 'Parallel', start: { x: 120, y: 260, a: Math.PI / 2 }, bay: { x: 420, y: 430, w: 84, h: 42, a: 0 }, obstacles: [car(330, 430, Math.PI / 2, '#60a5fa'), car(510, 430, Math.PI / 2, '#fb7185'), wall(400, 470, 760, 14)] },
	{ name: 'Angled row', start: { x: 120, y: 470, a: 0 }, bay: { x: 520, y: 170, w: 44, h: 70, a: -Math.PI / 5 }, obstacles: [car(450, 190, -Math.PI / 5), car(590, 150, -Math.PI / 5, '#fbbf24'), car(660, 130, -Math.PI / 5), wall(560, 300, 300, 16)] },
	{ name: 'The corridor', start: { x: 100, y: 470, a: 0 }, bay: { x: 680, y: 470, w: 44, h: 70, a: 0 }, obstacles: [wall(250, 330, 16, 440), wall(450, 230, 16, 440), wall(600, 330, 16, 440), car(760, 470, 0, '#a78bfa')] },
	{ name: 'Tight parallel', start: { x: 700, y: 250, a: -Math.PI / 2 }, bay: { x: 400, y: 430, w: 72, h: 40, a: 0 }, obstacles: [car(318, 430, Math.PI / 2, '#22d3ee'), car(482, 430, Math.PI / 2), car(160, 430, Math.PI / 2, '#f472b6'), wall(400, 468, 760, 14), wall(400, 300, 200, 16)] },
	{ name: 'Garage', start: { x: 700, y: 120, a: -Math.PI / 2 }, bay: { x: 140, y: 440, w: 44, h: 70, a: 0 }, obstacles: [wall(100, 440, 10, 120), wall(180, 440, 10, 120), wall(140, 504, 90, 10), wall(330, 300, 14, 380), wall(520, 250, 14, 380), car(720, 480, 0, '#fbbf24')] },
];

function corners(r) {
	const c = Math.cos(r.a), s = Math.sin(r.a);
	const hw = r.w / 2, hh = r.h / 2;
	return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [r.x + x * c - y * s, r.y + x * s + y * c]);
}

/** Separating-axis test for two rotated rectangles. */
function overlaps(a, b) {
	const ca = corners(a), cb = corners(b);
	for (const poly of [ca, cb]) {
		for (let i = 0; i < 4; i++) {
			const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % 4];
			const nx = y2 - y1, ny = x1 - x2;
			const project = (pts) => pts.map(([x, y]) => x * nx + y * ny);
			const pa = project(ca), pb = project(cb);
			if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return false;
		}
	}
	return true;
}

function inside(point, r) {
	const dx = point[0] - r.x, dy = point[1] - r.y;
	const c = Math.cos(-r.a), s = Math.sin(-r.a);
	const lx = dx * c - dy * s, ly = dx * s + dy * c;
	return Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2;
}

export default class ParkIt extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(300);
		this.reset();
	}

	reset() {
		this.running = false;
		this.level = 0;
		this.stars = 0;
		this.loadLevel();
		this.ctx.score(0);
	}

	loadLevel() {
		const L = LEVELS[this.level];
		this.def = L;
		this.car = { x: L.start.x, y: L.start.y, a: L.start.a, v: 0, steer: 0 };
		this.dents = 0;
		this.hold = 0;
		this.cooldown = 0;
		this.banner = 1.6;
		this.walls = [wall(W / 2, -5, W, 10), wall(W / 2, H + 5, W, 10), wall(-5, H / 2, 10, H), wall(W + 5, H / 2, 10, H)];
		this.info();
	}

	info() {
		this.ctx.info(`Level ${this.level + 1}/${LEVELS.length} · ${'★'.repeat(3 - this.dents)}${'☆'.repeat(this.dents)}`);
	}

	rect() {
		return { x: this.car.x, y: this.car.y, w: CAR_W, h: CAR_L, a: this.car.a };
	}

	update(dt) {
		this.fx.update(dt);
		if (!this.running) return;
		if (this.banner > 0) this.banner -= dt;
		const c = this.car;
		const input = this.ctx.input;
		const gas = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
		c.steer += (input.axis().x * 0.6 - c.steer) * Math.min(1, dt * 6);
		if (gas > 0) c.v += (c.v < 0 ? 360 : 150) * dt;
		else if (gas < 0) c.v -= (c.v > 0 ? 360 : 110) * dt;
		else c.v -= c.v * Math.min(1, dt * 3);
		c.v = clamp(c.v, -80, 150);
		if (Math.abs(c.v) < 1 && !gas) c.v = 0;
		const prev = { x: c.x, y: c.y, a: c.a };
		c.a += (c.v / WHEELBASE) * Math.tan(c.steer) * dt;
		c.x += Math.sin(c.a) * c.v * dt;
		c.y -= Math.cos(c.a) * c.v * dt;
		this.cooldown -= dt;
		// tyre dust while moving
		if (Math.abs(c.v) > 50 && Math.random() < 0.4) {
			const back = c.v > 0 ? -1 : 1;
			this.fx.particles.burst(c.x + Math.sin(c.a) * 26 * back, c.y - Math.cos(c.a) * 26 * back, { count: 1, color: '#94a3b8', speed: 20, life: 0.5, shape: 'smoke', size: 4, grow: 10 });
		}

		const me = this.rect();
		const hit = [...this.def.obstacles, ...this.walls].some((o) => overlaps(me, o));
		if (hit) {
			Object.assign(c, prev);
			c.v = -c.v * 0.25;
			if (this.cooldown <= 0) {
				this.cooldown = 0.6;
				this.dents++;
				this.ctx.audio.play('crash');
				this.fx.particles.burst(c.x, c.y, { count: 22, colors: ['#fde047', '#ffffff', '#fb923c'], speed: 220, life: 0.4, shape: 'spark', size: 3, glow: true });
				this.fx.shake.kick(8);
				this.fx.popups.add('−★', c.x, c.y - 40, { color: '#fca5a5', size: 22 });
				this.info();
				if (this.dents >= 3) {
					return this.finish({ win: false, title: 'Too many scrapes', message: `You parked ${this.level} ${this.level === 1 ? 'car' : 'cars'} and earned ${this.stars} stars.`, score: this.stars });
				}
			}
		}

		const parked = corners(me).every((p) => inside(p, this.def.bay)) && Math.abs(c.v) < 6;
		this.hold = parked ? this.hold + dt : 0;
		if (this.hold >= 0.8) {
			const earned = 3 - this.dents;
			this.stars += earned;
			const bay = this.def.bay;
			this.fx.particles.burst(bay.x, bay.y, { count: 30 + earned * 10, colors: ['#fde047', '#ffffff', '#34d399'], speed: 220, life: 0.9, shape: 'star', size: 5, gravity: 120 });
			this.fx.particles.ring(bay.x, bay.y, { color: '#34d399', radius: 90 });
			this.fx.popups.add('★'.repeat(earned) + '☆'.repeat(3 - earned), bay.x, bay.y - 30, { color: '#fde047', size: 30, life: 1.4 });
			this.ctx.score(this.stars);
			this.ctx.audio.play('levelup');
			this.level++;
			if (this.level >= LEVELS.length) {
				this.level = LEVELS.length - 1;
				return this.finish({ win: true, title: 'Master parker!', message: `All ${LEVELS.length} levels done with ${this.stars} of ${LEVELS.length * 3} stars.`, score: this.stars });
			}
			this.loadLevel();
		}
	}

	drawRect(g, r, color, radius = 4) {
		g.save();
		g.translate(r.x, r.y);
		g.rotate(r.a);
		fillRound(g, -r.w / 2, -r.h / 2, r.w, r.h, radius, color);
		g.restore();
	}

	drawCar(g, r, color, mine = false) {
		g.save();
		g.translate(r.x, r.y);
		g.rotate(r.a);
		fillRound(g, -r.w / 2 + 2, -r.h / 2 + 3, r.w, r.h, 7, 'rgba(0,0,0,0.3)');
		fillRound(g, -r.w / 2, -r.h / 2, r.w, r.h, 7, color);
		fillRound(g, -r.w / 2 + 4, -r.h / 2 + 12, r.w - 8, 12, 3, '#1e293b');
		fillRound(g, -r.w / 2 + 4, r.h / 2 - 16, r.w - 8, 8, 3, '#334155');
		if (mine) {
			g.fillStyle = '#fef9c3';
			g.fillRect(-r.w / 2 + 3, -r.h / 2, 6, 3);
			g.fillRect(r.w / 2 - 9, -r.h / 2, 6, 3);
		}
		g.restore();
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#334155');
		this.fx.shake.apply(g);
		g.fillStyle = 'rgba(255,255,255,0.04)';
		for (let x = 0; x < W; x += 50) g.fillRect(x, 0, 1, H);
		for (let y = 0; y < H; y += 50) g.fillRect(0, y, W, 1);
		const bay = this.def.bay;
		const pulse = 0.5 + Math.sin(performance.now() / 250) * 0.2;
		this.drawRect(g, bay, `rgba(250,204,21,${this.hold > 0 ? 0.55 : pulse * 0.35})`);
		g.save();
		g.translate(bay.x, bay.y);
		g.rotate(bay.a);
		g.strokeStyle = '#facc15';
		g.lineWidth = 3;
		g.strokeRect(-bay.w / 2, -bay.h / 2, bay.w, bay.h);
		text(g, 'P', 0, 0, { size: 22, color: 'rgba(250,204,21,0.8)', weight: 900 });
		g.restore();
		for (const o of this.def.obstacles) {
			if (o.kind === 'car') this.drawCar(g, o, o.color);
			else this.drawRect(g, o, '#94a3b8', 3);
		}
		this.drawCar(g, this.rect(), this.cooldown > 0 && Math.floor(this.cooldown * 12) % 2 ? '#fecaca' : colors.coral, true);
		if (this.hold > 0) {
			g.strokeStyle = colors.mint;
			g.lineWidth = 5;
			g.beginPath();
			g.arc(this.car.x, this.car.y, 44, -Math.PI / 2, -Math.PI / 2 + (this.hold / 0.8) * Math.PI * 2);
			g.stroke();
		}
		this.fx.draw(g);
		g.restore();
		if (this.banner > 0) {
			const slide = Math.min(1, (1.6 - this.banner) * 4);
			text(g, `Level ${this.level + 1}: ${this.def.name}`, W / 2, 34 - (1 - slide) * 30, { size: 24, color: `rgba(255,255,255,${Math.min(1, this.banner) * slide})` });
		}
	}

	dispose() {
		this.surface.dispose();
	}
}
