// Longbow: side-view archery across a meadow. Drag back to draw the bow (the farther, the
// stronger), release to loose. Arrows fly in an arc, drift with the wind and stick where
// they land. Pop balloons, hit swinging targets and bullseyes; each stage gives ten arrows.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 900, H = 500, GROUND = 440, G = 380;
const BOW = { x: 70, y: GROUND - 70 };
const STAGES = 5, ARROWS = 10;

export default class Longbow extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.stage = 0;
		this.ending = false;
		this.score = 0;
		this.ctx.score(0);
		this.loadStage();
	}

	loadStage() {
		this.arrows = ARROWS;
		this.flying = [];
		this.stuck = [];
		this.draw0 = null;
		this.wind = (Math.random() - 0.5) * (20 + this.stage * 22);
		this.targets = [];
		const n = 4 + this.stage;
		for (let i = 0; i < n; i++) {
			const kind = i % 3 === 0 ? 'bull' : i % 3 === 1 ? 'balloon' : this.stage >= 1 ? 'swing' : 'balloon';
			const x = 330 + Math.random() * 520, y = kind === 'bull' ? GROUND - 40 : 120 + Math.random() * 220;
			this.targets.push({ kind, x, y, baseY: y, r: kind === 'bull' ? 34 : kind === 'balloon' ? 16 : 20, phase: Math.random() * 6, hit: false, color: ['#ef4444', '#f59e0b', '#3b82f6', '#a855f7', '#22c55e'][i % 5] });
		}
		this.ctx.info(`Stage ${this.stage + 1}/${STAGES} · ${this.arrows} arrows`);
	}

	pointerDown(p) {
		if (!this.running || this.arrows <= 0) return;
		this.draw0 = { sx: p.x, sy: p.y, x: p.x, y: p.y };
		this.ctx.audio.play('tick');
	}

	pointerMove(p) { if (this.draw0) { this.draw0.x = p.x; this.draw0.y = p.y; } }

	vector() {
		const d = this.draw0;
		const dx = d.sx - d.x, dy = d.sy - d.y, len = Math.min(150, Math.hypot(dx, dy));
		if (len < 8) return null;
		const a = Math.atan2(dy, dx);
		return { a, power: len, vx: Math.cos(a) * len * 5.4, vy: Math.sin(a) * len * 5.4 };
	}

	pointerUp() {
		if (!this.draw0) return;
		const v = this.vector();
		this.draw0 = null;
		if (!v || !this.running) return;
		this.arrows--;
		this.flying.push({ x: BOW.x + Math.cos(v.a) * 30, y: BOW.y + Math.sin(v.a) * 30, vx: v.vx, vy: v.vy, angle: v.a });
		this.ctx.audio.play('whip');
		this.ctx.info(`Stage ${this.stage + 1}/${STAGES} · ${this.arrows} arrows`);
	}

	key(action) {
		// keyboard: Space draws at a fixed angle that Up/Down adjust
		if (action === 'action' && !this.draw0) { this.kbAngle ??= -0.5; this.kbPower = 0; this.draw0 = { sx: 0, sy: 0, x: 0, y: 0, keyboard: true }; }
	}
	keyUp(action) { if (action === 'action' && this.draw0?.keyboard) this.pointerUp(); }

	step(dt) {
		const t = performance.now() / 1000;
		if (this.draw0?.keyboard) {
			const ax = this.ctx.input.axis();
			this.kbAngle = Math.max(-1.4, Math.min(0.3, this.kbAngle + ax.y * dt * 1.2));
			this.kbPower = Math.min(150, this.kbPower + dt * 120);
			this.draw0.x = -Math.cos(this.kbAngle) * this.kbPower;
			this.draw0.y = -Math.sin(this.kbAngle) * this.kbPower;
		}
		for (const tg of this.targets) {
			if (tg.kind === 'balloon' && !tg.hit) tg.y = tg.baseY + Math.sin(t * 1.3 + tg.phase) * 18;
			if (tg.kind === 'swing') tg.x += Math.sin(t * 1.6 + tg.phase) * 50 * dt;
		}
		for (const a of this.flying) {
			a.vy += G * dt;
			a.vx += this.wind * dt;
			a.x += a.vx * dt;
			a.y += a.vy * dt;
			a.angle = Math.atan2(a.vy, a.vx);
			const tipX = a.x + Math.cos(a.angle) * 22, tipY = a.y + Math.sin(a.angle) * 22;
			for (const tg of this.targets) {
				if (tg.hit) continue;
				const d = Math.hypot(tipX - tg.x, tipY - tg.y);
				if (tg.kind === 'bull' ? Math.abs(tipX - tg.x) < 6 && Math.abs(tipY - tg.y) < tg.r : d < tg.r) {
					let pts;
					if (tg.kind === 'bull') {
						const off = Math.abs(tipY - tg.y) / tg.r;
						pts = off < 0.2 ? 100 : off < 0.45 ? 60 : off < 0.7 ? 40 : 20;
						a.dead = true;
						this.stuck.push({ x: tg.x - Math.cos(a.angle) * 16, y: tipY - Math.sin(a.angle) * 22, angle: a.angle, on: tg });
						if (pts === 100) { tg.hit = true; this.ctx.audio.play('cheer'); }
						else this.ctx.audio.play('thud');
					} else {
						tg.hit = true;
						pts = tg.kind === 'balloon' ? 30 : 50;
						this.ctx.audio.play(tg.kind === 'balloon' ? 'pop' : 'hit');
						this.burst(tg.x, tg.y, { count: 20, color: tg.color, speed: 160, life: 0.5, shape: 'square', size: 3 });
					}
					this.score += pts;
					this.ctx.score(this.score);
					this.popup(`+${pts}`, tg.x, tg.y - tg.r - 12, { color: '#fde047', size: 20 });
					if (a.dead) break;
				}
			}
			if (!a.dead && tipY >= GROUND) { a.dead = true; this.stuck.push({ x: a.x, y: a.y, angle: a.angle }); this.ctx.audio.play('tick'); }
			if (a.x > W + 50 || a.x < -50) a.dead = true;
		}
		this.flying = this.flying.filter((a) => !a.dead);
		// a stage ends when every target is done or the last arrow lands
		const cleared = this.targets.every((tg) => tg.hit || tg.kind === 'bull' && this.stuck.some((s) => s.on === tg));
		if (!this.flying.length && (cleared || this.arrows <= 0) && !this.ending) {
			this.ending = true;
			const bonus = cleared ? this.arrows * 20 : 0;
			if (bonus) { this.score += bonus; this.ctx.score(this.score); this.popup(`Arrows left +${bonus}`, W / 2, 120, { color: '#bef264', size: 22 }); }
			this.ctx.audio.play(cleared ? 'levelup' : 'score');
			setTimeout(() => {
				this.ending = false;
				if (!this.running) return;
				this.stage++;
				if (this.stage >= STAGES) return this.finish({ win: true, title: 'Tournament over', message: `You scored ${this.score} points across ${STAGES} stages.`, score: this.score });
				this.loadStage();
				this.ctx.fx.banner(`Stage ${this.stage + 1}`);
			}, 1200);
		}
	}

	drawArrow(g, x, y, angle) {
		g.save();
		g.translate(x, y);
		g.rotate(angle);
		g.strokeStyle = '#78350f'; g.lineWidth = 2.5;
		g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.stroke();
		g.fillStyle = '#9ca3af';
		g.beginPath(); g.moveTo(26, 0); g.lineTo(19, -4); g.lineTo(19, 4); g.fill();
		g.fillStyle = '#ef4444';
		g.beginPath(); g.moveTo(-22, 0); g.lineTo(-28, -5); g.lineTo(-16, 0); g.lineTo(-28, 5); g.fill();
		g.restore();
	}

	draw(g) {
		const sky = g.createLinearGradient(0, 0, 0, GROUND);
		sky.addColorStop(0, '#60a5fa'); sky.addColorStop(1, '#dbeafe');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#4ade80';
		g.fillRect(0, GROUND, W, H - GROUND);
		g.fillStyle = '#22c55e';
		g.fillRect(0, GROUND, W, 5);
		for (const tg of this.targets) {
			if (tg.kind === 'bull') {
				g.fillStyle = '#92400e'; g.fillRect(tg.x - 3, tg.y, 6, GROUND - tg.y);
				for (const [k, c] of [[1, '#f8fafc'], [0.75, '#111827'], [0.5, '#3b82f6'], [0.32, '#ef4444'], [0.15, '#facc15']]) { g.fillStyle = c; g.beginPath(); g.ellipse(tg.x, tg.y, 9 * k + 3, tg.r * k, 0, 0, Math.PI * 2); g.fill(); }
			} else if (!tg.hit) {
				if (tg.kind === 'balloon') {
					g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
					g.beginPath(); g.moveTo(tg.x, tg.y + tg.r); g.lineTo(tg.x + 4, tg.y + tg.r + 40); g.stroke();
					g.fillStyle = tg.color; g.beginPath(); g.ellipse(tg.x, tg.y, tg.r * 0.85, tg.r, 0, 0, Math.PI * 2); g.fill();
					circle(g, tg.x - 5, tg.y - 6, 4, 'rgba(255,255,255,0.5)');
				} else {
					g.strokeStyle = '#78350f'; g.lineWidth = 2;
					g.beginPath(); g.moveTo(tg.x, 0); g.lineTo(tg.x, tg.y - tg.r); g.stroke();
					circle(g, tg.x, tg.y, tg.r, '#fef3c7');
					circle(g, tg.x, tg.y, tg.r * 0.6, '#dc2626');
					circle(g, tg.x, tg.y, tg.r * 0.25, '#fef3c7');
				}
			}
		}
		for (const s of this.stuck) this.drawArrow(g, s.x, s.y, s.angle);
		for (const a of this.flying) this.drawArrow(g, a.x, a.y, a.angle);
		// archer and bow
		fillRound(g, BOW.x - 30, BOW.y - 10, 16, 80, 6, '#1e3a8a');
		circle(g, BOW.x - 22, BOW.y - 22, 12, '#fcd9b6');
		const v = this.draw0 ? this.vector() : null;
		const a = v ? v.a : -0.3, pull = v ? v.power / 150 : 0;
		g.save();
		g.translate(BOW.x, BOW.y);
		g.rotate(a);
		g.strokeStyle = '#78350f'; g.lineWidth = 5;
		g.beginPath(); g.arc(0, 0, 40, -1.2, 1.2); g.stroke();
		g.strokeStyle = '#e5e7eb'; g.lineWidth = 1.5;
		g.beginPath(); g.moveTo(Math.cos(-1.2) * 40, Math.sin(-1.2) * 40); g.lineTo(-pull * 30 + 14, 0); g.lineTo(Math.cos(1.2) * 40, Math.sin(1.2) * 40); g.stroke();
		g.restore();
		if (v) {
			this.drawArrow(g, BOW.x + Math.cos(a) * (12 - pull * 30), BOW.y + Math.sin(a) * (12 - pull * 30), a);
			// a short preview of the first part of the flight
			g.fillStyle = colors.accent;
			let x = BOW.x, y = BOW.y, vx = v.vx, vy = v.vy;
			for (let k = 0; k < 12; k++) { for (let s = 0; s < 3; s++) { vy += G / 60; vx += this.wind / 60; x += vx / 60; y += vy / 60; } g.globalAlpha = 1 - k / 12; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); }
			g.globalAlpha = 1;
		}
		// HUD
		fillRound(g, W - 200, 12, 188, 64, 12, 'rgba(15,23,42,0.55)');
		text(g, `Stage ${this.stage + 1}/${STAGES}  ·  ${this.score} pts`, W - 106, 32, { size: 14 });
		const wind = Math.round(this.wind / 5);
		text(g, `Wind ${wind > 0 ? '→' : wind < 0 ? '←' : '·'} ${Math.abs(wind)}`, W - 106, 56, { size: 14, color: '#bfdbfe' });
		for (let i = 0; i < this.arrows; i++) fillRound(g, 16 + i * 10, 16, 4, 30, 2, '#78350f');
	}
}
