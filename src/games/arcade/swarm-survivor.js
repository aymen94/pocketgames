// Swarm Survivor: a twin-stick arena shooter. Move with the keys, aim with the mouse (or
// let the auto-aim pick the nearest enemy), and survive the growing swarm. Enemies drop
// gems; every level-up upgrades your gun.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, circle } from '../core/canvas.js';

const W = 800, H = 520;
const KINDS = {
	grunt: { hp: 2, speed: 70, r: 11, color: '#f87171', points: 10 },
	dart: { hp: 1, speed: 140, r: 8, color: '#fbbf24', points: 15 },
	tank: { hp: 8, speed: 42, r: 18, color: '#a78bfa', points: 40 },
};
const UPGRADES = [
	['Faster fire', (p) => { p.rate *= 0.82; }],
	['Twin shot', (p) => { p.spread = Math.min(5, p.spread + 1); }],
	['Heavy rounds', (p) => { p.damage += 1; }],
	['Quick feet', (p) => { p.speed *= 1.12; }],
	['Shield +1', (p) => { p.hp = Math.min(p.maxHp + 1, p.hp + 1); p.maxHp++; }],
];

export default class SwarmSurvivor extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.p = { x: W / 2, y: H / 2, speed: 190, rate: 0.28, cool: 0, spread: 1, damage: 1, hp: 3, maxHp: 3, hurt: 0 };
		this.enemies = [];
		this.bullets = [];
		this.gems = [];
		this.time = 0;
		this.kills = 0;
		this.score = 0;
		this.xp = 0;
		this.level = 1;
		this.spawnT = 1;
		this.mouseAim = false;
		this.upgradeIndex = 0;
		this.ctx.score(0);
		this.paint();
	}

	paint() { this.ctx.info(`Lv ${this.level} · ♥ ${this.p.hp}/${this.p.maxHp} · ${Math.floor(this.time)} s`); }

	pointerMove() { this.mouseAim = true; }

	nearest() {
		let best = null, d = Infinity;
		for (const e of this.enemies) { const k = Math.hypot(e.x - this.p.x, e.y - this.p.y); if (k < d) { d = k; best = e; } }
		return best;
	}

	spawn() {
		const t = this.time;
		const roll = Math.random();
		const kind = t > 40 && roll < 0.15 ? 'tank' : t > 15 && roll < 0.4 ? 'dart' : 'grunt';
		const side = (Math.random() * 4) | 0;
		const x = side === 0 ? -20 : side === 1 ? W + 20 : Math.random() * W;
		const y = side === 2 ? -20 : side === 3 ? H + 20 : Math.random() * H;
		const k = KINDS[kind];
		this.enemies.push({ x, y, kind, hp: k.hp + Math.floor(t / 60), r: k.r, speed: k.speed * (1 + t / 240), hit: 0 });
	}

	step(dt) {
		const p = this.p;
		this.time += dt;
		const input = this.ctx.input;
		let { x: mx, y: my } = input.axis();
		// touch: walk toward a held finger
		if (this.pointer.down && !mx && !my) {
			const dx = this.pointer.x - p.x, dy = this.pointer.y - p.y, d = Math.hypot(dx, dy);
			if (d > 12) { mx = dx / d; my = dy / d; }
		}
		const len = Math.hypot(mx, my) || 1;
		p.x = Math.max(12, Math.min(W - 12, p.x + (mx / len) * p.speed * dt));
		p.y = Math.max(12, Math.min(H - 12, p.y + (my / len) * p.speed * dt));
		p.hurt = Math.max(0, p.hurt - dt);
		// aim: the mouse if it moved, otherwise the nearest enemy
		let aim = null;
		if (this.mouseAim && !this.pointer.down) aim = Math.atan2(this.pointer.y - p.y, this.pointer.x - p.x);
		else { const n = this.nearest(); if (n) aim = Math.atan2(n.y - p.y, n.x - p.x); }
		p.aim = aim ?? p.aim ?? 0;
		p.cool -= dt;
		if (aim !== null && p.cool <= 0 && this.enemies.length) {
			p.cool = p.rate;
			for (let i = 0; i < p.spread; i++) {
				const a = aim + (i - (p.spread - 1) / 2) * 0.14;
				this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 1 });
			}
			this.ctx.audio.play('laser');
		}
		this.spawnT -= dt;
		if (this.spawnT <= 0) {
			this.spawnT = Math.max(0.18, 1.1 - this.time / 90);
			this.spawn();
			if (this.time > 30 && Math.random() < 0.3) this.spawn();
		}
		for (const b of this.bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
		for (const e of this.enemies) {
			const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
			e.x += (dx / d) * e.speed * dt;
			e.y += (dy / d) * e.speed * dt;
			e.hit = Math.max(0, e.hit - dt);
			for (const b of this.bullets) {
				if (b.life <= 0 || Math.hypot(b.x - e.x, b.y - e.y) > e.r + 3) continue;
				b.life = 0;
				e.hp -= p.damage;
				e.hit = 0.08;
				e.x -= (dx / d) * 6; e.y -= (dy / d) * 6;
				if (e.hp <= 0) this.kill(e);
			}
			if (!e.dead && d < e.r + 10 && p.hurt <= 0) {
				p.hp--;
				p.hurt = 1;
				e.dead = true;
				this.ctx.audio.play('hit');
				this.fx.shake.kick(7);
				this.fx.flash.trigger('#fb7185', 0.25);
				if (p.hp <= 0) return this.finish({ win: false, title: 'Overrun!', message: `Survived ${Math.floor(this.time)} s with ${this.kills} kills.`, score: this.score });
			}
		}
		// enemies keep a little apart so the swarm spreads out
		for (let i = 0; i < this.enemies.length; i++) for (let j = i + 1; j < this.enemies.length; j++) {
			const a = this.enemies[i], b = this.enemies[j];
			const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
			if (d < min && d > 0) { const k = (min - d) / d / 2; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
		}
		this.enemies = this.enemies.filter((e) => !e.dead);
		this.bullets = this.bullets.filter((b) => b.life > 0 && b.x > -10 && b.x < W + 10 && b.y > -10 && b.y < H + 10);
		for (const gm of this.gems) {
			const dx = p.x - gm.x, dy = p.y - gm.y, d = Math.hypot(dx, dy);
			if (d < 90) { gm.x += (dx / d) * 300 * dt; gm.y += (dy / d) * 300 * dt; }
			if (d < 14) { gm.taken = true; this.gain(gm.v); }
		}
		this.gems = this.gems.filter((gm) => !gm.taken);
		this.score = this.kills * 10 + Math.floor(this.time) * 5 + (this.bonus ?? 0);
		this.ctx.score(this.score);
		this.paint();
	}

	kill(e) {
		e.dead = true;
		this.kills++;
		this.bonus = (this.bonus ?? 0) + KINDS[e.kind].points;
		this.ctx.audio.play('pop');
		this.fx.particles.burst(e.x, e.y, { count: 10, color: KINDS[e.kind].color, speed: 150, life: 0.4, size: 3 });
		this.gems.push({ x: e.x, y: e.y, v: e.kind === 'tank' ? 5 : 1 });
	}

	gain(v) {
		this.xp += v;
		this.ctx.audio.play('coin');
		const need = 6 + this.level * 4;
		if (this.xp >= need) {
			this.xp -= need;
			this.level++;
			const [name, apply] = UPGRADES[this.upgradeIndex++ % UPGRADES.length];
			apply(this.p);
			this.ctx.audio.play('powerup');
			this.popup(name, this.p.x, this.p.y - 30, { color: '#a7f3d0', size: 20 });
		}
	}

	draw(g) {
		g.fillStyle = '#0b0f1e';
		g.fillRect(0, 0, W, H);
		g.strokeStyle = 'rgba(99,102,241,0.12)';
		g.lineWidth = 1;
		for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
		for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
		for (const gm of this.gems) {
			g.fillStyle = gm.v > 1 ? '#fde047' : '#34d399';
			g.save(); g.translate(gm.x, gm.y); g.rotate(Math.PI / 4); g.fillRect(-4, -4, 8, 8); g.restore();
		}
		for (const e of this.enemies) circle(g, e.x, e.y, e.r, e.hit > 0 ? '#ffffff' : KINDS[e.kind].color);
		g.fillStyle = '#e0f2fe';
		for (const b of this.bullets) g.fillRect(b.x - 2, b.y - 2, 4, 4);
		const p = this.p;
		if (p.hurt <= 0 || Math.floor(p.hurt * 10) % 2) {
			circle(g, p.x, p.y, 11, '#38bdf8');
			g.strokeStyle = '#e0f2fe';
			g.lineWidth = 3;
			g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(p.aim) * 18, p.y + Math.sin(p.aim) * 18); g.stroke();
		}
		const need = 6 + this.level * 4;
		fillRound(g, W / 2 - 150, H - 18, 300, 8, 4, 'rgba(255,255,255,0.1)');
		fillRound(g, W / 2 - 150, H - 18, Math.max(8, (300 * this.xp) / need), 8, 4, '#34d399');
		text(g, `${this.kills} kills`, W - 14, 18, { size: 13, align: 'right', color: '#cbd5e1' });
	}
}
