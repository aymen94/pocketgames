// Rock Drift: an inertia shooter in a wrap-around field of drifting rocks. Big rocks split
// into smaller, faster ones; clear the field to start a denser wave. Your ship keeps its
// momentum, so thrust carefully.

import { CanvasGame } from '../kit/canvasGame.js';
import { text } from '../core/canvas.js';

const W = 800, H = 520;
const SIZES = [0, 12, 24, 40]; // radius by size class
const POINTS = [0, 100, 50, 20];

export default class RockDrift extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.stars = Array.from({ length: 80 }, () => [Math.random() * W, Math.random() * H, Math.random()]);
	}

	reset() {
		super.reset();
		this.score = 0;
		this.lives = 3;
		this.wave = 0;
		this.shots = [];
		this.rocks = [];
		this.ctx.score(0);
		this.spawnShip();
		this.nextWave();
	}

	spawnShip() {
		this.ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, safe: 2.5, cool: 0, thrust: false };
	}

	nextWave() {
		this.wave++;
		const n = 3 + this.wave;
		for (let i = 0; i < n; i++) {
			let x, y;
			do { x = Math.random() * W; y = Math.random() * H; } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 180);
			this.rock(x, y, 3);
		}
		this.ctx.info(`Wave ${this.wave} · Lives ${this.lives}`);
		if (this.wave > 1) this.ctx.fx.banner(`Wave ${this.wave}`);
	}

	rock(x, y, size) {
		const a = Math.random() * Math.PI * 2, s = (40 + Math.random() * 40) * (1 + (3 - size) * 0.5) * (1 + this.wave * 0.05);
		const shape = Array.from({ length: 11 }, () => 0.72 + Math.random() * 0.4);
		this.rocks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size, r: SIZES[size], spin: (Math.random() - 0.5) * 2, rot: 0, shape });
	}

	key(action) {
		if (action === 'action') this.fire();
	}

	pointerDown() { this.fire(); }

	fire() {
		const s = this.ship;
		if (!s || s.cool > 0 || this.shots.length > 6) return;
		s.cool = 0.18;
		this.shots.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: s.vx + Math.cos(s.a) * 520, vy: s.vy + Math.sin(s.a) * 520, life: 0.9 });
		this.ctx.audio.play('laser');
	}

	wrap(o, pad = 0) {
		if (o.x < -pad) o.x += W + pad * 2;
		if (o.x > W + pad) o.x -= W + pad * 2;
		if (o.y < -pad) o.y += H + pad * 2;
		if (o.y > H + pad) o.y -= H + pad * 2;
	}

	step(dt) {
		const s = this.ship;
		const input = this.ctx.input;
		if (s) {
			if (input.isDown('left')) s.a -= 4.2 * dt;
			if (input.isDown('right')) s.a += 4.2 * dt;
			// touch / mouse: hold to turn toward the pointer and thrust
			if (this.pointer.down) {
				const want = Math.atan2(this.pointer.y - s.y, this.pointer.x - s.x);
				let d = want - s.a;
				d = Math.atan2(Math.sin(d), Math.cos(d));
				s.a += Math.max(-4.2 * dt, Math.min(4.2 * dt, d));
			}
			s.thrust = input.isDown('up') || (this.pointer.down && Math.hypot(this.pointer.x - s.x, this.pointer.y - s.y) > 60);
			if (s.thrust) {
				s.vx += Math.cos(s.a) * 260 * dt;
				s.vy += Math.sin(s.a) * 260 * dt;
				if (Math.random() < 0.7) this.fx.particles.burst(s.x - Math.cos(s.a) * 12, s.y - Math.sin(s.a) * 12, { count: 1, colors: ['#fde047', '#fb923c'], speed: 90, angle: s.a + Math.PI, spread: 0.6, life: 0.3, size: 2.5, glow: true });
			}
			if (input.isDown('action') || (this.pointer.down && this.autoFire)) this.fire();
			s.vx *= 1 - 0.35 * dt;
			s.vy *= 1 - 0.35 * dt;
			s.x += s.vx * dt; s.y += s.vy * dt;
			this.wrap(s);
			s.cool -= dt;
			s.safe -= dt;
		}
		for (const b of this.shots) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; this.wrap(b); }
		this.shots = this.shots.filter((b) => b.life > 0);
		for (const r of this.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.spin * dt; this.wrap(r, r.r); }
		// shots against rocks
		for (const b of this.shots) {
			for (const r of this.rocks) {
				if (r.dead || Math.hypot(b.x - r.x, b.y - r.y) > r.r) continue;
				b.life = 0;
				this.smash(r);
				break;
			}
		}
		this.rocks = this.rocks.filter((r) => !r.dead);
		// rocks against the ship
		if (s && s.safe <= 0) {
			for (const r of this.rocks) {
				if (Math.hypot(s.x - r.x, s.y - r.y) < r.r + 9) { this.die(); break; }
			}
		}
		if (!this.rocks.length) this.nextWave();
	}

	smash(r) {
		r.dead = true;
		this.score += POINTS[r.size];
		this.ctx.score(this.score);
		this.ctx.audio.play(r.size === 3 ? 'explode' : 'hit');
		this.fx.particles.burst(r.x, r.y, { count: 6 + r.size * 5, colors: ['#d6d3d1', '#a8a29e', '#fde68a'], speed: 140, life: 0.6, shape: 'square', size: 3 });
		if (r.size === 3) this.fx.shake.kick(4);
		if (r.size > 1) for (let i = 0; i < 2; i++) this.rock(r.x, r.y, r.size - 1);
	}

	die() {
		const s = this.ship;
		this.ctx.audio.play('crash');
		this.fx.shake.kick(10);
		this.fx.particles.burst(s.x, s.y, { count: 40, colors: ['#93c5fd', '#ffffff', '#fb923c'], speed: 220, life: 0.9, shape: 'spark', size: 3 });
		this.lives--;
		this.ship = null;
		this.ctx.info(`Wave ${this.wave} · Lives ${this.lives}`);
		if (this.lives <= 0) return this.finish({ win: false, title: 'Ship destroyed', message: `You reached wave ${this.wave}.`, score: this.score });
		setTimeout(() => { if (this.running) this.spawnShip(); }, 1200);
	}

	draw(g) {
		g.fillStyle = '#04060f';
		g.fillRect(0, 0, W, H);
		for (const [x, y, b] of this.stars) { g.fillStyle = `rgba(255,255,255,${0.2 + b * 0.5})`; g.fillRect(x, y, 1.5, 1.5); }
		g.strokeStyle = '#e7e5e4';
		g.lineWidth = 2;
		g.fillStyle = '#292524';
		for (const r of this.rocks) {
			g.beginPath();
			r.shape.forEach((k, i) => {
				const a = r.rot + (i / r.shape.length) * Math.PI * 2;
				const x = r.x + Math.cos(a) * r.r * k, y = r.y + Math.sin(a) * r.r * k;
				i ? g.lineTo(x, y) : g.moveTo(x, y);
			});
			g.closePath();
			g.fill();
			g.stroke();
		}
		g.fillStyle = '#fde047';
		for (const b of this.shots) { g.beginPath(); g.arc(b.x, b.y, 2.5, 0, Math.PI * 2); g.fill(); }
		const s = this.ship;
		if (s && (s.safe <= 0 || Math.floor(s.safe * 8) % 2 === 0)) {
			g.save();
			g.translate(s.x, s.y);
			g.rotate(s.a);
			g.strokeStyle = '#93c5fd';
			g.fillStyle = '#1e3a8a';
			g.lineWidth = 2;
			g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -9); g.lineTo(-6, 0); g.lineTo(-10, 9); g.closePath();
			g.fill(); g.stroke();
			g.restore();
		}
		text(g, '♦'.repeat(Math.max(0, this.lives)), 14, 18, { size: 16, align: 'left', color: '#93c5fd' });
	}
}
