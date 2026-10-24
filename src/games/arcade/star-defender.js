// Star Defender: a fixed shooter against marching formations of geometric drones.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, glow, text, colors } from '../core/canvas.js';
import { clamp, rectsOverlap } from '../core/physics.js';
import { CanvasFx, ease } from '../core/fx.js';

const W = 480, H = 640, ROWS = 5, COLS = 8;
const LEVELS = { easy: { fire: 0.6, speed: 0.8 }, normal: { fire: 1, speed: 1 }, hard: { fire: 1.6, speed: 1.25 } };
const DRONES = [
	{ color: '#f472b6', points: 40, shape: 'diamond' },
	{ color: '#a78bfa', points: 30, shape: 'hex' },
	{ color: '#a78bfa', points: 30, shape: 'hex' },
	{ color: '#22d3ee', points: 20, shape: 'tri' },
	{ color: '#22d3ee', points: 20, shape: 'tri' },
];

export default class StarDefender extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.stars = Array.from({ length: 90 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.3 }));
		this.fx = new CanvasFx(500);
		this.clock = 0;
		const canvas = this.surface.canvas;
		// touch: drag anywhere to move, the ship fires on its own while touching
		this.ctx.input.on(canvas, 'pointerdown', (e) => { this.touchX = this.surface.local(e).x; this.touching = true; });
		this.ctx.input.on(canvas, 'pointermove', (e) => { if (this.touching || e.pointerType === 'mouse') this.touchX = this.surface.local(e).x; });
		this.ctx.input.on(canvas, 'pointerup', () => { this.touching = false; });
		this.ctx.input.on(canvas, 'pointerleave', () => { this.touching = false; });
		this.reset();
	}

	reset() {
		this.running = false;
		this.tuning = LEVELS[this.ctx.settings.difficulty] ?? LEVELS.normal;
		this.wave = 0;
		this.score = 0;
		this.lives = 3;
		this.ship = { x: W / 2, cooldown: 0, flash: 0, tilt: 0, recoil: 0 };
		this.fx.clear();
		this.touchX = null;
		this.touching = false;
		this.buildShields();
		this.startWave();
		this.ctx.score(0);
	}

	buildShields() {
		this.shields = [];
		for (let s = 0; s < 4; s++) {
			const x0 = 50 + s * 110;
			for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
				if (r === 3 && c > 2 && c < 5) continue;
				this.shields.push({ x: x0 + c * 7, y: 510 + r * 7, w: 7, h: 7, hp: 2 });
			}
		}
	}

	startWave() {
		this.drones = [];
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			this.drones.push({ r, c, x: 50 + c * 46, y: 80 + r * 40 + Math.min(this.wave, 4) * 10, alive: true, hit: 0, ...DRONES[r] });
		}
		this.dir = 1;
		this.bullets = [];
		this.bolts = [];
		this.time = 0;
		this.bonus = null;
		this.bonusTimer = 12 + Math.random() * 8;
		this.ctx.info(`Wave ${this.wave + 1} · ${'♥'.repeat(this.lives)}`);
	}

	handleInput({ type, action }) {
		if (type === 'down' && action === 'action') this.fire();
	}

	fire() {
		if (!this.running || this.ship.cooldown > 0 || this.bullets.length >= 2) return;
		this.bullets.push({ x: this.ship.x, y: H - 70 });
		this.ship.cooldown = 0.32;
		this.ship.recoil = 1;
		this.ctx.audio.play('laser');
		this.fx.particles.burst(this.ship.x, H - 70, { count: 5, color: '#fde047', speed: 90, angle: -Math.PI / 2, spread: 1.2, life: 0.2, shape: 'spark', size: 2, glow: true });
	}

	update(dt) {
		this.time += dt;
		this.clock += dt;
		this.fx.update(dt);
		for (const s of this.stars) { s.y += s.s * 30 * dt; if (s.y > H) s.y = 0; }
		this.ship.recoil = Math.max(0, this.ship.recoil - dt * 8);
		if (!this.running) return;

		const ship = this.ship;
		const { x } = this.ctx.input.axis();
		const before = ship.x;
		if (x !== 0) { ship.x += x * 300 * dt; this.touchX = null; }
		else if (this.touchX !== null) ship.x += clamp(this.touchX - ship.x, -360 * dt, 360 * dt);
		ship.x = clamp(ship.x, 24, W - 24);
		ship.tilt += (clamp((ship.x - before) / (300 * dt || 1), -1, 1) - ship.tilt) * Math.min(1, dt * 10);
		// engine exhaust
		if (Math.random() < 0.7) this.fx.particles.burst(ship.x + (Math.random() - 0.5) * 6, H - 38, { count: 1, colors: ['#60a5fa', '#a5b4fc'], speed: 60, angle: Math.PI / 2, spread: 0.5, life: 0.3, shape: 'dot', size: 2.5, glow: true });
		ship.cooldown -= dt;
		ship.flash -= dt;
		if (this.ctx.input.isDown('action') || this.touching) this.fire();

		// the formation speeds up as it thins out
		const alive = this.drones.filter((d) => d.alive);
		const speed = (24 + (ROWS * COLS - alive.length) * 2.2 + this.wave * 8) * this.tuning.speed;
		let edge = false;
		for (const d of alive) {
			d.x += this.dir * speed * dt;
			if ((d.x > W - 22 && this.dir > 0) || (d.x < 22 && this.dir < 0)) edge = true;
		}
		if (edge) {
			this.dir *= -1;
			for (const d of alive) d.y += 16;
		}
		for (const d of alive) if (d.hit > 0) d.hit -= dt * 4;

		// the lowest drone of a random column fires
		const fireRate = (0.9 + this.wave * 0.25) * this.tuning.fire;
		if (Math.random() < fireRate * dt && alive.length) {
			const shooter = alive[Math.floor(Math.random() * alive.length)];
			const lowest = alive.filter((d) => d.c === shooter.c).reduce((a, b) => (b.y > a.y ? b : a));
			this.bolts.push({ x: lowest.x, y: lowest.y + 12, vy: 190 + this.wave * 15 });
		}

		this.bonusTimer -= dt;
		if (this.bonusTimer <= 0 && !this.bonus) {
			this.bonus = { x: -30, y: 46, vx: 110 };
			this.bonusTimer = 18 + Math.random() * 10;
		}
		if (this.bonus) {
			this.bonus.x += this.bonus.vx * dt;
			if (this.bonus.x > W + 40) this.bonus = null;
		}

		for (const b of this.bullets) {
			b.y -= 560 * dt;
			const rect = { x: b.x - 2, y: b.y, w: 4, h: 12 };
			for (const d of alive) {
				if (d.alive && Math.abs(d.x - b.x) < 16 && Math.abs(d.y - b.y) < 14) {
					d.alive = false;
					b.dead = true;
					this.addScore(d.points);
					this.burst(d.x, d.y, d.color);
					this.fx.popups.add(`+${d.points}`, d.x, d.y - 6, { color: d.color, size: 13, life: 0.6, rise: 26 });
					this.ctx.audio.play('explode');
					break;
				}
			}
			if (!b.dead && this.bonus && Math.abs(this.bonus.x - b.x) < 22 && Math.abs(this.bonus.y - b.y) < 12) {
				const points = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
				this.addScore(points);
				this.burst(this.bonus.x, this.bonus.y, colors.amber, true);
				this.fx.popups.add(`+${points}`, this.bonus.x, this.bonus.y + 10, { color: colors.amber, size: 20 });
				this.bonus = null;
				b.dead = true;
				this.ctx.audio.play('bonus');
			}
			if (!b.dead) this.hitShield(rect, b);
			if (b.y < -20) b.dead = true;
		}
		this.bullets = this.bullets.filter((b) => !b.dead);

		for (const bolt of this.bolts) {
			bolt.y += bolt.vy * dt;
			const rect = { x: bolt.x - 2, y: bolt.y, w: 4, h: 12 };
			this.hitShield(rect, bolt);
			if (!bolt.dead && ship.flash <= 0 && rectsOverlap(rect, { x: ship.x - 18, y: H - 64, w: 36, h: 24 })) {
				bolt.dead = true;
				this.loseLife();
			}
			if (bolt.y > H) bolt.dead = true;
		}
		this.bolts = this.bolts.filter((b) => !b.dead);

		// drones chew through shields and win if they land
		for (const d of alive) {
			if (!d.alive) continue;
			for (const s of this.shields) if (s.hp > 0 && Math.abs(s.x - d.x) < 18 && Math.abs(s.y - d.y) < 14) s.hp = 0;
			if (d.y > H - 80) {
				this.lives = 0;
				this.ctx.audio.play('crash');
				return this.finish({ win: false, title: 'They landed!', message: `You held out until wave ${this.wave + 1}.`, score: this.score });
			}
		}
		if (this.drones.every((d) => !d.alive)) {
			this.wave++;
			this.addScore(200);
			this.ctx.audio.play('levelup');
			this.fx.particles.confetti(W, { count: 50, colors: ['#22d3ee', '#a78bfa', '#f472b6', '#fde047'] });
			this.startWave();
		}
	}

	hitShield(rect, shot) {
		for (const s of this.shields) {
			if (s.hp > 0 && rectsOverlap(rect, s)) {
				s.hp--;
				shot.dead = true;
				// chips of shield fly off
				this.fx.particles.burst(s.x + 3, s.y + 3, { count: 4, colors: ['#34d399', '#166534'], speed: 70, life: 0.4, shape: 'square', size: 3, gravity: 200 });
				return;
			}
		}
	}

	loseLife() {
		this.lives--;
		this.burst(this.ship.x, H - 52, colors.blue, true);
		this.fx.shake.kick(10);
		this.fx.flash.trigger('#fb7185', 0.3);
		this.ctx.audio.play('crash');
		this.ship.flash = 1.6;
		this.bolts = [];
		this.ctx.info(`Wave ${this.wave + 1} · ${'♥'.repeat(Math.max(0, this.lives))}`);
		if (this.lives <= 0) this.finish({ win: false, message: `You reached wave ${this.wave + 1}.`, score: this.score });
	}

	addScore(points) {
		this.score += points;
		this.ctx.score(this.score);
	}

	burst(x, y, color, big = false) {
		const p = this.fx.particles;
		p.burst(x, y, { count: big ? 36 : 18, colors: [color, '#ffffff'], speed: big ? 260 : 180, life: 0.6, shape: 'spark', size: 3, glow: true });
		p.burst(x, y, { count: big ? 14 : 8, color, speed: 110, life: 0.8, shape: 'square', size: 3.5, gravity: 120 });
		p.ring(x, y, { color, radius: big ? 60 : 30, life: 0.35 });
		if (big) this.fx.shake.kick(5);
	}

	drawDrone(g, d) {
		const wobble = Math.sin(this.time * 6 + d.c) * 2;
		glow(g, d.x, d.y, 22, `${d.color}22`);
		g.fillStyle = d.color;
		g.beginPath();
		if (d.shape === 'diamond') { g.moveTo(d.x, d.y - 12); g.lineTo(d.x + 14, d.y); g.lineTo(d.x, d.y + 12); g.lineTo(d.x - 14, d.y); }
		else if (d.shape === 'hex') for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(d.x + Math.cos(a) * 14, d.y + Math.sin(a) * 10); }
		else { g.moveTo(d.x - 14, d.y - 8); g.lineTo(d.x + 14, d.y - 8); g.lineTo(d.x, d.y + 11); }
		g.closePath();
		g.fill();
		circle(g, d.x, d.y - 1, 3.5, '#0b1020');
		g.fillStyle = d.color;
		g.fillRect(d.x - 16, d.y + 4 + wobble, 4, 4);
		g.fillRect(d.x + 12, d.y + 4 - wobble, 4, 4);
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#070b1a');
		const fx = this.fx;
		fx.shake.apply(g);
		// drifting nebula clouds behind the stars
		glow(g, W * 0.25 + Math.sin(this.clock * 0.1) * 40, H * 0.3, 220, 'rgba(124, 58, 237, 0.10)');
		glow(g, W * 0.8 + Math.cos(this.clock * 0.08) * 40, H * 0.6, 200, 'rgba(14, 165, 233, 0.08)');
		for (const st of this.stars) { g.fillStyle = `rgba(255,255,255,${st.s / 2})`; g.fillRect(st.x, st.y, st.s, st.s * (1 + st.s)); }
		for (const sh of this.shields) if (sh.hp > 0) { g.fillStyle = sh.hp === 2 ? '#34d399' : '#166534'; g.fillRect(sh.x, sh.y, sh.w, sh.h); }
		for (const d of this.drones) if (d.alive) this.drawDrone(g, d);
		if (this.bonus) {
			fillRound(g, this.bonus.x - 22, this.bonus.y - 7, 44, 14, 7, colors.amber);
			fillRound(g, this.bonus.x - 10, this.bonus.y - 14, 20, 10, 5, '#fde68a');
		}
		for (const b of this.bullets) {
			// a fading streak behind each bolt
			const tail = g.createLinearGradient(b.x, b.y, b.x, b.y + 34);
			tail.addColorStop(0, 'rgba(253,224,71,0.8)');
			tail.addColorStop(1, 'rgba(253,224,71,0)');
			g.fillStyle = tail;
			g.fillRect(b.x - 1.5, b.y, 3, 34);
			glow(g, b.x, b.y + 4, 14, 'rgba(253,224,71,0.55)');
			g.fillStyle = '#fffbe6';
			g.fillRect(b.x - 2, b.y, 4, 10);
		}
		for (const b of this.bolts) {
			glow(g, b.x, b.y + 6, 12, 'rgba(251,113,133,0.5)');
			g.fillStyle = colors.coral;
			g.save(); g.translate(b.x, b.y + 6); g.rotate(this.clock * 12); g.fillRect(-3, -3, 6, 6); g.restore();
		}
		fx.draw(g);
		const ship = this.ship;
		if (ship.flash <= 0 || Math.floor(ship.flash * 10) % 2 === 0) {
			const y = H - 52 + ship.recoil * 3;
			const lean = ship.tilt * 5;
			glow(g, ship.x, y + 16, 16 + Math.random() * 4, 'rgba(79,140,255,0.7)');
			g.fillStyle = colors.blue;
			g.beginPath(); g.moveTo(ship.x, y - 16); g.lineTo(ship.x + 18 - lean, y + 12 + lean * 0.4); g.lineTo(ship.x, y + 6); g.lineTo(ship.x - 18 - lean, y + 12 - lean * 0.4); g.closePath(); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.25)';
			g.beginPath(); g.moveTo(ship.x, y - 16); g.lineTo(ship.x + 4, y + 2); g.lineTo(ship.x - 4, y + 2); g.closePath(); g.fill();
			circle(g, ship.x, y - 2, 4, '#e0e7ff');
		}
		g.fillStyle = 'rgba(255,255,255,0.12)';
		g.fillRect(0, H - 30, W, 1);
		if (this.running && this.time < 1.6) {
			const t = this.time / 1.6;
			const scale = ease.outBack(Math.min(1, t * 4));
			g.save();
			g.translate(W / 2, H / 2);
			g.scale(scale, scale);
			text(g, `WAVE ${this.wave + 1}`, 0, 0, { size: 34, weight: 900, color: `rgba(255,255,255,${1 - t})` });
			g.restore();
		}
		g.restore();
		fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
