// Wall Climber: a ninja bounds up an endless shaft by jumping from wall to wall. Tap (or
// press Space) to leap across; hold on a wall and you slowly slide. Dodge spikes and
// saws, grab coins, and keep ahead of the rising lava. The shaft is generated in chunks.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, circle, text, glow } from '../core/canvas.js';

const W = 420, H = 680;
const WALL = 46, LEFT = WALL, RIGHT = W - WALL, R = 13;

export default class WallClimber extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.p = { x: LEFT + R, y: H - 160, vx: 0, vy: 0, side: -1, onWall: true };
		this.cam = 0; // world y at the top of the screen (world y grows downward, so climbing makes y negative)
		this.lava = H + 300;
		this.hazards = [];
		this.coins = [];
		this.genTo = H;
		this.height = 0;
		this.coinCount = 0;
		this.trail = [];
		this.generate(-H * 2);
		this.ctx.score(0);
		this.ctx.info('Tap / Space to jump between the walls');
	}

	generate(upTo) {
		while (this.genTo > upTo) {
			this.genTo -= 140 + Math.random() * 60;
			const y = this.genTo;
			const level = Math.min(1, -y / 12000);
			const roll = Math.random();
			if (y > H - 300) continue;
			if (roll < 0.55) {
				// a spike strip on one wall
				const side = Math.random() < 0.5 ? -1 : 1;
				this.hazards.push({ kind: 'spike', side, y, h: 50 + Math.random() * (40 + level * 70) });
			} else if (roll < 0.8 && -y > 1200) {
				// a saw drifting across the shaft
				this.hazards.push({ kind: 'saw', x: W / 2, y, base: W / 2, amp: 70 + level * 50, speed: 1.2 + Math.random() * (1 + level), phase: Math.random() * 6 });
			}
			if (Math.random() < 0.6) this.coins.push({ x: LEFT + 30 + Math.random() * (RIGHT - LEFT - 60), y: y - 70, taken: false });
		}
	}

	key(action) { if (action === 'action' || action === 'up') this.jump(); }
	pointerDown() { this.jump(); }

	jump() {
		const p = this.p;
		if (!this.running || !p.onWall) return;
		p.onWall = false;
		p.vx = -p.side * 560;
		p.vy = -620;
		this.ctx.audio.play('jump');
		this.burst(p.x, p.y - this.cam, { count: 8, color: '#e2e8f0', speed: 90, angle: p.side < 0 ? 0 : Math.PI, spread: 1.2, life: 0.3, size: 2.5 });
	}

	step(dt) {
		const p = this.p;
		if (p.onWall) {
			p.vy = Math.min(p.vy + 300 * dt, 40); // a slow slide
		} else {
			p.vy += 1500 * dt;
			p.x += p.vx * dt;
			if (p.x <= LEFT + R) { this.stick(-1); }
			else if (p.x >= RIGHT - R) { this.stick(1); }
		}
		p.y += p.vy * dt;
		if (p.onWall) p.x = p.side < 0 ? LEFT + R : RIGHT - R;
		this.trail.push([p.x, p.y]);
		if (this.trail.length > 10) this.trail.shift();
		// the camera follows the climber upward only
		const want = p.y - H * 0.6;
		if (want < this.cam) this.cam += (want - this.cam) * Math.min(1, dt * 6);
		// lava rises, faster the higher you are
		const climbed = Math.max(0, (H - 160 - p.y));
		this.lava -= (38 + Math.min(70, climbed / 120)) * dt;
		this.lava = Math.min(this.lava, this.cam + H + 120);
		this.generate(this.cam - H);
		const t = performance.now() / 1000;
		for (const hz of this.hazards) {
			if (hz.kind === 'saw') hz.x = hz.base + Math.sin(t * hz.speed + hz.phase) * hz.amp;
			if (this.hits(hz)) return this.die(hz.kind === 'saw' ? 'Sliced by a saw' : 'Spiked');
		}
		for (const c of this.coins) {
			if (!c.taken && Math.hypot(c.x - p.x, c.y - p.y) < R + 10) {
				c.taken = true;
				this.coinCount++;
				this.ctx.audio.play('coin');
				this.burst(c.x, c.y - this.cam, { count: 10, color: '#fde047', speed: 100, life: 0.4, shape: 'star', size: 3 });
			}
		}
		if (p.y + R > this.lava) return this.die('Caught by the lava');
		if (p.y - this.cam > H + 40) return this.die('Fell');
		this.hazards = this.hazards.filter((hz) => hz.y < this.cam + H + 200);
		this.coins = this.coins.filter((c) => c.y < this.cam + H + 100);
		this.height = Math.max(this.height, Math.floor(climbed / 10));
		this.ctx.score(this.height + this.coinCount * 10);
	}

	stick(side) {
		const p = this.p;
		p.onWall = true;
		p.side = side;
		p.vx = 0;
		p.vy = Math.min(p.vy, 0) * 0.15;
		this.ctx.audio.play('tick');
	}

	hits(hz) {
		const p = this.p;
		if (hz.kind === 'spike') {
			const x = hz.side < 0 ? LEFT : RIGHT;
			return Math.abs(p.x - x) < R + 14 && p.y + R > hz.y && p.y - R < hz.y + hz.h;
		}
		return Math.hypot(p.x - hz.x, p.y - hz.y) < R + 18;
	}

	die(reason) {
		this.ctx.audio.play('crash');
		this.fx.shake.kick(10);
		this.burst(this.p.x, this.p.y - this.cam, { count: 40, colors: ['#f43f5e', '#fde047', '#ffffff'], speed: 220, life: 0.8, shape: 'spark', size: 3 });
		const score = this.height + this.coinCount * 10;
		this.finish({ win: false, title: reason, message: `You climbed ${this.height} m and grabbed ${this.coinCount} coins.`, score });
	}

	draw(g) {
		const cam = this.cam;
		const bg = g.createLinearGradient(0, 0, 0, H);
		bg.addColorStop(0, '#1e1b4b');
		bg.addColorStop(1, '#0f172a');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		// parallax bricks in the back
		g.fillStyle = 'rgba(255,255,255,0.03)';
		for (let y = -((cam * 0.5) % 40) - 40; y < H; y += 40) for (let x = (y / 40) % 2 ? 0 : 30; x < W; x += 60) g.fillRect(x + LEFT, y, 54, 34);
		// walls with moving mortar lines
		for (const [x0] of [[0], [RIGHT]]) {
			g.fillStyle = '#334155';
			g.fillRect(x0, 0, WALL, H);
			g.fillStyle = '#1e293b';
			for (let y = -((cam) % 36) - 36; y < H; y += 36) g.fillRect(x0, y, WALL, 3);
		}
		for (const hz of this.hazards) {
			const y = hz.y - cam;
			if (y < -200 || y > H + 200) continue;
			if (hz.kind === 'spike') {
				const x = hz.side < 0 ? LEFT : RIGHT;
				g.fillStyle = '#e2e8f0';
				g.beginPath();
				for (let k = 0; k <= hz.h; k += 12) { g.moveTo(x, y + k); g.lineTo(x - hz.side * 16, y + k + 6); g.lineTo(x, y + k + 12); }
				g.fill();
			} else {
				const spin = performance.now() / 80;
				g.save();
				g.translate(hz.x, y);
				g.rotate(spin);
				g.fillStyle = '#94a3b8';
				g.beginPath();
				for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const r = k % 2 ? 13 : 19; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
				g.fill();
				circle(g, 0, 0, 5, '#475569');
				g.restore();
			}
		}
		for (const c of this.coins) if (!c.taken) { glow(g, c.x, c.y - cam, 18, 'rgba(253,224,71,0.35)'); circle(g, c.x, c.y - cam, 7, '#fde047'); }
		// the climber
		const p = this.p;
		this.trail.forEach(([x, y], i) => circle(g, x, y - cam, R * (i / this.trail.length) * 0.8, `rgba(56,189,248,${(i / this.trail.length) * 0.3})`));
		circle(g, p.x, p.y - cam, R, '#0f172a');
		fillRound(g, p.x - R, p.y - cam - 4, R * 2, 6, 3, '#f43f5e');
		circle(g, p.x + (p.onWall ? -p.side : Math.sign(p.vx)) * 5, p.y - cam - 1, 2.5, '#ffffff');
		// lava
		const ly = this.lava - cam;
		if (ly < H) {
			const lg = g.createLinearGradient(0, ly, 0, H);
			lg.addColorStop(0, '#f97316');
			lg.addColorStop(1, '#7f1d1d');
			g.fillStyle = lg;
			g.beginPath();
			g.moveTo(0, H);
			const t = performance.now() / 300;
			for (let x = 0; x <= W; x += 20) g.lineTo(x, ly + Math.sin(x * 0.05 + t) * 5);
			g.lineTo(W, H);
			g.fill();
			glow(g, W / 2, ly, 220, 'rgba(249,115,22,0.25)');
		}
		text(g, `${this.height} m`, W / 2, 26, { size: 22 });
		text(g, `● ${this.coinCount}`, W - WALL - 8, 26, { size: 15, align: 'right', color: '#fde047' });
	}
}
