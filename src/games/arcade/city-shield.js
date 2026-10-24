// City Shield: incoming warheads streak toward six cities. Click to fire an interceptor
// from the nearest battery with ammo; it bursts where you aimed and the blast destroys
// anything inside it. Later waves bring faster warheads that split mid-flight.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text } from '../core/canvas.js';

const W = 800, H = 520, GROUND = 480;
const BATTERIES = [60, 400, 740];
const CITIES = [150, 230, 310, 490, 570, 650];

export default class CityShield extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.score = 0;
		this.wave = 0;
		this.cities = CITIES.map((x) => ({ x, alive: true }));
		this.batteries = BATTERIES.map((x) => ({ x, ammo: 10, alive: true }));
		this.missiles = [];
		this.shots = [];
		this.blasts = [];
		this.ctx.score(0);
		this.startWave();
	}

	startWave() {
		this.wave++;
		for (const b of this.batteries) { b.ammo = 10; b.alive = true; }
		this.toLaunch = 8 + this.wave * 3;
		this.launchT = 1.2;
		this.between = false;
		this.ctx.info(`Wave ${this.wave}`);
		if (this.wave > 1) this.ctx.fx.banner(`Wave ${this.wave}`);
	}

	targets() {
		return [...this.cities.filter((c) => c.alive).map((c) => c.x), ...this.batteries.filter((b) => b.alive).map((b) => b.x)];
	}

	launch(x = Math.random() * W, y = -10, split = this.wave >= 3 && Math.random() < 0.2) {
		const ts = this.targets();
		if (!ts.length) return;
		const tx = ts[(Math.random() * ts.length) | 0];
		const speed = 40 + this.wave * 8 + Math.random() * 20;
		const d = Math.hypot(tx - x, GROUND - y);
		this.missiles.push({ sx: x, sy: y, x, y, tx, ty: GROUND, vx: ((tx - x) / d) * speed, vy: ((GROUND - y) / d) * speed, split: split ? 140 + Math.random() * 120 : 0 });
	}

	pointerDown(p) { this.fire(p.x, Math.min(p.y, GROUND - 30)); }
	key(action) { if (action === 'action') this.fire(this.pointer.x, Math.min(this.pointer.y, GROUND - 30)); }

	fire(x, y) {
		if (!this.running) return;
		const live = this.batteries.filter((b) => b.alive && b.ammo > 0);
		if (!live.length) { this.ctx.audio.play('error'); return; }
		const b = live.reduce((a, c) => (Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a));
		b.ammo--;
		const d = Math.hypot(x - b.x, y - GROUND);
		this.shots.push({ x: b.x, y: GROUND - 10, tx: x, ty: y, vx: ((x - b.x) / d) * 520, vy: ((y - GROUND) / d) * 520 });
		this.ctx.audio.play('shoot');
	}

	step(dt) {
		if (!this.between && this.toLaunch > 0) {
			this.launchT -= dt;
			if (this.launchT <= 0) {
				this.launchT = Math.max(0.35, 1.6 - this.wave * 0.12) * (0.5 + Math.random());
				this.launch();
				this.toLaunch--;
			}
		}
		for (const s of this.shots) {
			s.x += s.vx * dt; s.y += s.vy * dt;
			if ((s.vy < 0 && s.y <= s.ty) || Math.hypot(s.x - s.tx, s.y - s.ty) < 8) {
				s.done = true;
				this.blasts.push({ x: s.tx, y: s.ty, r: 0, t: 0, chain: 0 });
				this.ctx.audio.play('explode');
			}
		}
		this.shots = this.shots.filter((s) => !s.done);
		for (const b of this.blasts) { b.t += dt; b.r = b.t < 0.5 ? b.t * 90 : Math.max(0, 45 - (b.t - 0.9) * 90); }
		this.blasts = this.blasts.filter((b) => b.t < 1.4);
		for (const m of this.missiles) {
			m.x += m.vx * dt; m.y += m.vy * dt;
			if (m.split && m.y > m.split) {
				m.dead = true;
				for (let k = 0; k < 3; k++) this.launch(m.x, m.y, false);
				continue;
			}
			for (const b of this.blasts) {
				if (b.r > 0 && Math.hypot(m.x - b.x, m.y - b.y) < b.r) {
					m.dead = true;
					this.score += 25 * (1 + b.chain);
					this.ctx.score(this.score);
					this.blasts.push({ x: m.x, y: m.y, r: 0, t: 0.2, chain: b.chain + 1 });
					this.fx.particles.burst(m.x, m.y, { count: 8, colors: ['#fde047', '#fb923c'], speed: 120, life: 0.4, size: 2, glow: true });
					break;
				}
			}
			if (!m.dead && m.y >= GROUND) {
				m.dead = true;
				this.impact(m.x);
			}
		}
		this.missiles = this.missiles.filter((m) => !m.dead);
		if (!this.cities.some((c) => c.alive)) return this.finish({ win: false, title: 'The cities have fallen', message: `You held out for ${this.wave - 1} waves.`, score: this.score });
		if (!this.between && this.toLaunch <= 0 && !this.missiles.length && !this.blasts.length) this.endWave();
	}

	impact(x) {
		this.blasts.push({ x, y: GROUND, r: 0, t: 0.3, chain: 0, enemy: true });
		this.ctx.audio.play('crash');
		this.fx.shake.kick(6);
		for (const c of this.cities) if (c.alive && Math.abs(c.x - x) < 30) { c.alive = false; this.fx.particles.burst(c.x, GROUND - 10, { count: 30, colors: ['#fb923c', '#94a3b8'], speed: 160, angle: -Math.PI / 2, spread: 2, life: 0.8, shape: 'square', size: 3, gravity: 300 }); }
		for (const b of this.batteries) if (b.alive && Math.abs(b.x - x) < 30) b.alive = false;
	}

	endWave() {
		this.between = true;
		const cities = this.cities.filter((c) => c.alive).length;
		const ammo = this.batteries.reduce((n, b) => n + (b.alive ? b.ammo : 0), 0);
		const bonus = cities * 100 + ammo * 5;
		this.score += bonus;
		this.ctx.score(this.score);
		this.popup(`Wave cleared +${bonus}`, W / 2, H / 2 - 40, { color: '#a7f3d0', size: 26 });
		this.ctx.audio.play('levelup');
		// every third wave rebuilds one lost city
		if (this.wave % 3 === 0) { const lost = this.cities.find((c) => !c.alive); if (lost) lost.alive = true; }
		setTimeout(() => { if (this.running) this.startWave(); }, 1800);
	}

	draw(g) {
		const sky = g.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#020617');
		sky.addColorStop(1, '#312e81');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#1e293b';
		g.fillRect(0, GROUND, W, H - GROUND);
		for (const c of this.cities) {
			if (c.alive) {
				g.fillStyle = '#38bdf8';
				for (let i = 0; i < 4; i++) g.fillRect(c.x - 22 + i * 11, GROUND - 14 - ((i * 7) % 12), 9, 14 + ((i * 7) % 12));
			} else {
				g.fillStyle = '#475569';
				g.fillRect(c.x - 22, GROUND - 5, 44, 5);
			}
		}
		for (const b of this.batteries) {
			g.fillStyle = b.alive ? '#a3e635' : '#475569';
			g.beginPath(); g.moveTo(b.x - 24, GROUND); g.lineTo(b.x, GROUND - 24); g.lineTo(b.x + 24, GROUND); g.fill();
			if (b.alive) text(g, String(b.ammo), b.x, GROUND + 18, { size: 13, color: b.ammo ? '#ecfccb' : '#f87171' });
		}
		g.lineWidth = 2;
		for (const m of this.missiles) {
			g.strokeStyle = 'rgba(248,113,113,0.6)';
			g.beginPath(); g.moveTo(m.sx, m.sy); g.lineTo(m.x, m.y); g.stroke();
			g.fillStyle = '#fecaca';
			g.fillRect(m.x - 2, m.y - 2, 4, 4);
		}
		for (const s of this.shots) {
			g.strokeStyle = 'rgba(190,242,100,0.7)';
			g.beginPath(); g.moveTo(s.x - s.vx * 0.05, s.y - s.vy * 0.05); g.lineTo(s.x, s.y); g.stroke();
			g.strokeStyle = 'rgba(255,255,255,0.5)';
			g.beginPath(); g.moveTo(s.tx - 5, s.ty - 5); g.lineTo(s.tx + 5, s.ty + 5); g.moveTo(s.tx + 5, s.ty - 5); g.lineTo(s.tx - 5, s.ty + 5); g.stroke();
		}
		g.save();
		g.globalCompositeOperation = 'lighter';
		for (const b of this.blasts) {
			if (b.r <= 0) continue;
			const grad = g.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
			grad.addColorStop(0, b.enemy ? 'rgba(251,113,133,0.9)' : 'rgba(255,255,255,0.9)');
			grad.addColorStop(0.5, b.enemy ? 'rgba(249,115,22,0.6)' : 'rgba(253,224,71,0.6)');
			grad.addColorStop(1, 'rgba(0,0,0,0)');
			g.fillStyle = grad;
			g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
		}
		g.restore();
		const p = this.pointer;
		g.strokeStyle = 'rgba(255,255,255,0.6)';
		g.lineWidth = 1.5;
		g.beginPath(); g.arc(p.x, p.y, 10, 0, Math.PI * 2); g.moveTo(p.x - 16, p.y); g.lineTo(p.x + 16, p.y); g.moveTo(p.x, p.y - 16); g.lineTo(p.x, p.y + 16); g.stroke();
		fillRound(g, W / 2 - 70, 8, 140, 22, 11, 'rgba(15,23,42,0.6)');
		text(g, `Incoming ${this.toLaunch + this.missiles.length}`, W / 2, 19, { size: 12, color: '#fecaca' });
	}
}
