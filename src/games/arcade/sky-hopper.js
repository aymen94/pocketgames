// Sky Hopper: lift a paper plane through gaps between cloud towers.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, text, colors } from '../core/canvas.js';
import { circleRect } from '../core/physics.js';
import { CanvasFx, Trail, ease } from '../core/fx.js';

const W = 400, H = 640, GRAVITY = 1250, LIFT = -380, SPEED = 150;
const GAPS = { wide: 200, normal: 165, tight: 138 };

export default class SkyHopper extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.ctx.input.on(this.surface.canvas, 'pointerdown', () => this.flap());
		this.clouds = Array.from({ length: 6 }, (_, i) => ({ x: i * 90, y: 60 + Math.random() * 300, r: 20 + Math.random() * 25 }));
		this.hills = Array.from({ length: 7 }, (_, i) => ({ x: i * 90, h: 60 + Math.random() * 70 }));
		this.fx = new CanvasFx(300);
		this.trail = new Trail(18);
		this.reset();
	}

	reset() {
		this.running = false;
		this.plane = { x: 110, y: H / 2, vy: 0, spin: 0 };
		this.crashed = false;
		this.fx?.clear();
		this.trail?.reset();
		this.towers = [];
		this.spawn = 0.4;
		this.score = 0;
		this.started = false;
		this.time = 0;
		this.gap = GAPS[this.ctx.settings.gap] ?? GAPS.normal;
		this.ctx.score(0);
	}

	handleInput({ type, action }) {
		if (type === 'down' && (action === 'action' || action === 'up')) this.flap();
	}

	flap() {
		if (!this.running || this.paused) return;
		this.started = true;
		this.plane.vy = LIFT;
		this.flapT = 1;
		this.ctx.audio.play('whip');
		// a puff of air under the wings
		this.fx.particles.burst(this.plane.x - 10, this.plane.y + 8, { count: 6, color: '#ffffff', speed: 70, angle: Math.PI * 0.7, spread: 1.2, life: 0.45, shape: 'smoke', size: 6, grow: 10 });
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		this.flapT = Math.max(0, (this.flapT ?? 0) - dt * 5);
		this.scoreBump = Math.max(0, (this.scoreBump ?? 0) - dt * 4);
		for (const c of this.clouds) { c.x -= 20 * dt; if (c.x < -60) { c.x = W + 60; c.y = 60 + Math.random() * 300; } }
		for (const hl of this.hills) { hl.x -= 45 * dt; if (hl.x < -120) { hl.x += 7 * 90; hl.h = 60 + Math.random() * 70; } }
		if (this.crashed) {
			// the plane tumbles to the ground after a crash
			const p = this.plane;
			p.vy = Math.min(p.vy + GRAVITY * dt, 700);
			p.y = Math.min(p.y + p.vy * dt, H - 46);
			p.spin = (p.spin ?? 0) + dt * 8;
			return;
		}
		if (!this.running) return;
		const p = this.plane;
		if (!this.started) { p.y = H / 2 + Math.sin(this.time * 3) * 10; return; }
		p.vy += GRAVITY * dt;
		p.y += p.vy * dt;

		const speed = SPEED + Math.min(this.score * 2, 80);
		this.spawn -= dt;
		if (this.spawn <= 0) {
			this.spawn = 1.55 - Math.min(this.score * 0.01, 0.3);
			const top = 70 + Math.random() * (H - 140 - this.gap - 60);
			this.towers.push({ x: W + 40, top, passed: false });
		}
		for (const t of this.towers) {
			t.x -= speed * dt;
			if (!t.passed && t.x + 30 < p.x) {
				t.passed = true;
				this.score++;
				this.scoreBump = 1;
				this.ctx.score(this.score);
				this.ctx.audio.play('score');
				const gy = t.top + this.gap / 2;
				this.fx.particles.burst(t.x, gy, { count: 14, colors: ['#fde047', '#ffffff', '#f0abfc'], speed: 140, life: 0.6, shape: 'star', size: 4, gravity: 60 });
				this.fx.popups.add('+1', p.x + 20, p.y - 24, { color: '#fde047', size: 20 });
			}
			const upper = { x: t.x - 30, y: -20, w: 60, h: t.top + 20 };
			const lower = { x: t.x - 30, y: t.top + this.gap, w: 60, h: H };
			if (circleRect(p.x, p.y, 13, upper) || circleRect(p.x, p.y, 13, lower)) return this.crash();
		}
		this.towers = this.towers.filter((t) => t.x > -60);
		if (p.y > H - 40 || p.y < -30) this.crash();
	}

	crash() {
		this.ctx.audio.play('crash');
		this.crashed = true;
		const p = this.plane;
		this.fx.particles.burst(p.x, p.y, { count: 20, colors: ['#ffffff', '#c7d2fe', '#fde047'], speed: 220, life: 0.8, shape: 'square', size: 4, gravity: 600 });
		this.fx.particles.burst(p.x, p.y, { count: 10, color: '#ffffff', speed: 60, life: 0.8, shape: 'smoke', size: 10, grow: 14 });
		this.fx.shake.kick(10);
		this.fx.flash.trigger('#ffffff', 0.45);
		this.finish({ win: false, title: 'Crashed!', message: `You flew through ${this.score} ${this.score === 1 ? 'gate' : 'gates'}.`, score: this.score });
	}

	render() {
		const s = this.surface, g = s.g;
		const sky = g.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#3b5bdb');
		sky.addColorStop(0.6, '#7c8cf8');
		sky.addColorStop(1, '#f0abfc');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		const fx = this.fx;
		fx.shake.apply(g);
		// a low sun and distant hills, slower than the towers for depth
		circle(g, 300, 470, 60, 'rgba(255, 237, 213, 0.55)');
		g.fillStyle = 'rgba(167, 139, 250, 0.45)';
		for (const hl of this.hills) {
			g.beginPath();
			g.moveTo(hl.x - 70, H - 40);
			g.quadraticCurveTo(hl.x + 20, H - 40 - hl.h * 2, hl.x + 110, H - 40);
			g.fill();
		}
		for (const c of this.clouds) {
			g.globalAlpha = 0.35;
			circle(g, c.x, c.y, c.r, '#fff');
			circle(g, c.x + c.r * 0.8, c.y + 5, c.r * 0.7, '#fff');
			circle(g, c.x - c.r * 0.8, c.y + 6, c.r * 0.6, '#fff');
		}
		g.globalAlpha = 1;
		for (const t of this.towers) {
			for (const [y, h] of [[-10, t.top + 10], [t.top + this.gap, H]]) {
				fillRound(g, t.x - 30, y, 60, h, 14, '#f8fafc');
				g.fillStyle = 'rgba(99,102,241,0.18)';
				g.fillRect(t.x + 12, y, 18, h);
			}
			fillRound(g, t.x - 36, t.top - 18, 72, 18, 9, '#e0e7ff');
			fillRound(g, t.x - 36, t.top + this.gap, 72, 18, 9, '#e0e7ff');
		}
		fillRound(g, -10, H - 40, W + 20, 60, 0, '#6d28d9');
		g.fillStyle = '#7c3aed';
		for (let x = -((this.time * 150) % 40); x < W; x += 40) g.fillRect(x, H - 40, 20, 6);

		const p = this.plane;
		if (this.running && this.started) this.trail.push(p.x - 14, p.y + 2);
		this.trail.draw(g, '#ffffff', 5, { glow: false });
		fx.draw(g);
		g.save();
		g.translate(p.x, p.y);
		g.rotate(this.crashed ? p.spin : Math.max(-0.5, Math.min(p.vy / 600, 1.1)));
		// wings flex on each flap
		g.scale(1, 1 + this.flapT * 0.25);
		g.fillStyle = '#fff';
		g.beginPath(); g.moveTo(20, 0); g.lineTo(-16, -12); g.lineTo(-8, 0); g.lineTo(-16, 12); g.closePath(); g.fill();
		g.fillStyle = '#c7d2fe';
		g.beginPath(); g.moveTo(20, 0); g.lineTo(-8, 0); g.lineTo(-16, 12); g.closePath(); g.fill();
		g.restore();

		g.restore();
		const bump = 1 + ease.outBack(this.scoreBump ?? 0) * 0.25 * (this.scoreBump ?? 0);
		g.save();
		g.translate(W / 2, 70);
		g.scale(bump, bump);
		text(g, String(this.score), 0, 0, { size: 52, color: 'rgba(255,255,255,0.92)', weight: 900 });
		g.restore();
		if (this.running && !this.started) text(g, 'Tap or press Space to fly', W / 2, H / 2 + 80 + Math.sin(this.time * 4) * 4, { size: 18, color: '#fff' });
		fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
