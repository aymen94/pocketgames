// Sky Strike: a vertical scrolling shooter. Fly over the clouds, gun down enemy squadrons
// that sweep in on curved paths, grab weapon power-ups, and face a boss every fifth wave.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, circle } from '../core/canvas.js';

const W = 420, H = 640;

const PATTERNS = [
	// each returns x, y for an enemy at time t with lane offset i
	(t, i) => [60 + i * 60, -30 + t * 120],
	(t, i) => [W / 2 + Math.sin(t * 2 + i) * 150, -30 + t * 110],
	(t, i) => [(i % 2 ? W + 30 - t * 140 : -30 + t * 140), 80 + i * 26 + Math.sin(t * 3) * 20],
	(t, i) => [W / 2 + Math.cos(t * 1.6 + i * 0.8) * (60 + t * 30), 120 + Math.sin(t * 1.6 + i * 0.8) * (60 + t * 30) - 120 + t * 60],
];

export default class SkyStrike extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.clouds = Array.from({ length: 8 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 30 + Math.random() * 40, s: 30 + Math.random() * 40 }));
	}

	reset() {
		super.reset();
		this.p = { x: W / 2, y: H - 80, power: 1, cool: 0, hurt: 0, lives: 3 };
		this.bullets = [];
		this.enemyShots = [];
		this.enemies = [];
		this.drops = [];
		this.wave = 0;
		this.waveT = 1.5;
		this.score = 0;
		this.boss = null;
		this.ctx.score(0);
		this.paint();
	}

	paint() { this.ctx.info(`Wave ${this.wave} · Lives ${this.p.lives} · Power ${this.p.power}`); }

	pointerDown(p) { this.drag = { x: p.x - this.p.x, y: p.y - this.p.y }; }
	pointerMove(p) { if (this.drag && p.down) { this.p.x = Math.max(16, Math.min(W - 16, p.x - this.drag.x)); this.p.y = Math.max(60, Math.min(H - 24, p.y - this.drag.y)); } }
	pointerUp() { this.drag = null; }

	nextWave() {
		this.wave++;
		if (this.wave % 5 === 0) {
			this.boss = { x: W / 2, y: -80, hp: 60 + this.wave * 12, max: 60 + this.wave * 12, t: 0, cool: 1 };
			this.ctx.fx.banner('BOSS');
			this.ctx.audio.play('buzzer');
		} else {
			const pattern = PATTERNS[(this.wave - 1) % PATTERNS.length];
			const n = 5 + Math.min(6, this.wave);
			for (let i = 0; i < n; i++) this.enemies.push({ pattern, i, t: -i * 0.25, hp: 1 + Math.floor(this.wave / 4), x: -100, y: -100, cool: 1 + Math.random() * 2 });
		}
		this.paint();
	}

	step(dt) {
		const p = this.p;
		const ax = this.ctx.input.axis();
		p.x = Math.max(16, Math.min(W - 16, p.x + ax.x * 260 * dt));
		p.y = Math.max(60, Math.min(H - 24, p.y + ax.y * 260 * dt));
		p.hurt = Math.max(0, p.hurt - dt);
		p.cool -= dt;
		// auto-fire
		if (p.cool <= 0) {
			p.cool = 0.14;
			const spread = [[0], [-6, 6], [-10, 0, 10], [-14, -5, 5, 14]][Math.min(3, p.power - 1)];
			for (const off of spread) this.bullets.push({ x: p.x + off, y: p.y - 16, vx: off * 6, vy: -620 });
			this.ctx.audio.play('laser', 1.6);
		}
		for (const c of this.clouds) { c.y += c.s * dt; if (c.y - c.r > H) { c.y = -c.r; c.x = Math.random() * W; } }
		for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; }
		this.bullets = this.bullets.filter((b) => b.y > -20);
		for (const s of this.enemyShots) { s.x += s.vx * dt; s.y += s.vy * dt; }
		this.enemyShots = this.enemyShots.filter((s) => s.y < H + 20 && s.y > -20 && s.x > -20 && s.x < W + 20);
		for (const e of this.enemies) {
			e.t += dt;
			if (e.t < 0) continue;
			[e.x, e.y] = e.pattern(e.t, e.i);
			e.cool -= dt;
			if (e.cool <= 0 && e.y > 0 && e.y < H * 0.6) { e.cool = 2 + Math.random() * 2; this.aimShot(e.x, e.y, 200); }
			for (const b of this.bullets) if (!b.dead && Math.abs(b.x - e.x) < 16 && Math.abs(b.y - e.y) < 14) { b.dead = true; e.hp--; if (e.hp <= 0) this.kill(e); }
			if (!e.dead && p.hurt <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 22) { this.kill(e); this.hurt(); }
		}
		this.enemies = this.enemies.filter((e) => !e.dead && e.t < 12 && e.y < H + 60);
		const bo = this.boss;
		if (bo) {
			bo.t += dt;
			bo.y = Math.min(110, bo.y + 60 * dt);
			bo.x = W / 2 + Math.sin(bo.t * 0.8) * 120;
			bo.cool -= dt;
			if (bo.cool <= 0 && bo.y >= 110) {
				bo.cool = 1.3;
				// a ring of shots and an aimed burst
				for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2 + bo.t; this.enemyShots.push({ x: bo.x, y: bo.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150 }); }
				this.aimShot(bo.x, bo.y + 20, 260);
				this.ctx.audio.play('zap');
			}
			for (const b of this.bullets) if (!b.dead && Math.abs(b.x - bo.x) < 60 && Math.abs(b.y - bo.y) < 34) { b.dead = true; bo.hp--; if (Math.random() < 0.3) this.fx.particles.burst(b.x, b.y, { count: 3, color: '#fde047', speed: 80, life: 0.2, size: 2 }); }
			if (bo.hp <= 0) {
				this.score += 2000;
				this.ctx.score(this.score);
				this.ctx.audio.play('blast');
				this.fx.shake.kick(14);
				this.burst(bo.x, bo.y, { count: 90, colors: ['#fde047', '#fb923c', '#ffffff'], speed: 300, life: 1, shape: 'spark', size: 4 });
				this.drops.push({ x: bo.x, y: bo.y, kind: 'power' }, { x: bo.x + 30, y: bo.y, kind: 'life' });
				this.boss = null;
			}
		}
		this.bullets = this.bullets.filter((b) => !b.dead);
		for (const s of this.enemyShots) if (!s.dead && p.hurt <= 0 && Math.hypot(s.x - p.x, s.y - p.y) < 9) { s.dead = true; this.hurt(); }
		this.enemyShots = this.enemyShots.filter((s) => !s.dead);
		for (const d of this.drops) {
			d.y += 90 * dt;
			if (Math.hypot(d.x - p.x, d.y - p.y) < 22) {
				d.taken = true;
				if (d.kind === 'power') p.power = Math.min(4, p.power + 1);
				else p.lives = Math.min(5, p.lives + 1);
				this.ctx.audio.play('powerup');
				this.paint();
			}
		}
		this.drops = this.drops.filter((d) => !d.taken && d.y < H + 20);
		if (!this.enemies.length && !this.boss) {
			this.waveT -= dt;
			if (this.waveT <= 0) { this.waveT = 1.2; this.nextWave(); }
		}
		if (!this.running) return;
	}

	aimShot(x, y, speed) {
		const a = Math.atan2(this.p.y - y, this.p.x - x);
		this.enemyShots.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
	}

	kill(e) {
		e.dead = true;
		this.score += 50 + this.wave * 5;
		this.ctx.score(this.score);
		this.ctx.audio.play('explode');
		this.fx.particles.burst(e.x, e.y, { count: 16, colors: ['#fb923c', '#fde047'], speed: 160, life: 0.5, shape: 'spark', size: 3 });
		if (Math.random() < 0.08) this.drops.push({ x: e.x, y: e.y, kind: 'power' });
	}

	hurt() {
		const p = this.p;
		p.lives--;
		p.hurt = 2;
		p.power = Math.max(1, p.power - 1);
		this.ctx.audio.play('crash');
		this.fx.shake.kick(9);
		this.fx.flash.trigger('#fb7185', 0.3);
		this.paint();
		if (p.lives <= 0) this.finish({ win: false, title: 'Shot down', message: `You reached wave ${this.wave}.`, score: this.score });
	}

	draw(g) {
		g.fillStyle = '#0ea5e9';
		g.fillRect(0, 0, W, H);
		const sea = g.createLinearGradient(0, 0, 0, H);
		sea.addColorStop(0, '#0369a1');
		sea.addColorStop(1, '#0c4a6e');
		g.fillStyle = sea;
		g.fillRect(0, 0, W, H);
		g.fillStyle = 'rgba(255,255,255,0.18)';
		for (const c of this.clouds) { g.beginPath(); g.arc(c.x, c.y, c.r, 0, Math.PI * 2); g.arc(c.x + c.r * 0.7, c.y + 6, c.r * 0.7, 0, Math.PI * 2); g.fill(); }
		for (const d of this.drops) { circle(g, d.x, d.y, 11, d.kind === 'power' ? '#a855f7' : '#f43f5e'); text(g, d.kind === 'power' ? 'P' : '♥', d.x, d.y + 1, { size: 12 }); }
		for (const e of this.enemies) {
			if (e.t < 0) continue;
			g.fillStyle = '#ef4444';
			g.beginPath(); g.moveTo(e.x, e.y + 14); g.lineTo(e.x - 16, e.y - 8); g.lineTo(e.x, e.y - 2); g.lineTo(e.x + 16, e.y - 8); g.closePath(); g.fill();
		}
		const bo = this.boss;
		if (bo) {
			fillRound(g, bo.x - 60, bo.y - 26, 120, 52, 16, '#7f1d1d');
			fillRound(g, bo.x - 40, bo.y - 14, 80, 28, 10, '#dc2626');
			circle(g, bo.x, bo.y, 10, '#fde047');
			fillRound(g, 60, 70, W - 120, 8, 4, 'rgba(0,0,0,0.4)');
			fillRound(g, 60, 70, Math.max(8, (W - 120) * (bo.hp / bo.max)), 8, 4, '#f43f5e');
		}
		g.fillStyle = '#fde047';
		for (const b of this.bullets) g.fillRect(b.x - 1.5, b.y - 7, 3, 12);
		g.fillStyle = '#fda4af';
		for (const s of this.enemyShots) { g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI * 2); g.fill(); }
		const p = this.p;
		if (p.hurt <= 0 || Math.floor(p.hurt * 10) % 2) {
			g.fillStyle = '#e0f2fe';
			g.beginPath(); g.moveTo(p.x, p.y - 18); g.lineTo(p.x + 18, p.y + 12); g.lineTo(p.x, p.y + 6); g.lineTo(p.x - 18, p.y + 12); g.closePath(); g.fill();
			g.fillStyle = '#38bdf8';
			g.fillRect(p.x - 3, p.y - 8, 6, 10);
		}
	}
}
