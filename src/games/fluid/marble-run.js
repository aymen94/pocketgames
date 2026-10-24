// Marble Run: draw ramps with a limited supply of ink, then release the marbles and watch
// them roll, bounce and knock into each other on the way to the cup. Spikes pop them;
// pegs and walls get in the way. Save ink for a better score.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text } from '../core/canvas.js';
import { collideDiscs } from '../core/physics.js';

const W = 640, H = 520, R = 9, GRAVITY = 900;
const COLORS = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee', '#a3e635'];

const LEVELS = [
	{ name: 'First Ramp', ink: 600, marbles: 8, need: 6, hopper: 100, cup: { x: 480, w: 110, y: 440 }, walls: [], pegs: [], spikes: [] },
	{ name: 'Peg Garden', ink: 700, marbles: 8, need: 6, hopper: 540, cup: { x: 60, w: 100, y: 440 }, walls: [], pegs: [[320, 220], [360, 260], [280, 260], [320, 300], [240, 300], [400, 300]], spikes: [] },
	{ name: 'Spike Pit', ink: 750, marbles: 8, need: 5, hopper: 90, cup: { x: 500, w: 100, y: 440 }, walls: [], pegs: [], spikes: [[180, 490, 300]] },
	{ name: 'Over the Wall', ink: 900, marbles: 8, need: 5, hopper: 80, cup: { x: 500, w: 100, y: 440 }, walls: [[340, 180, 340, 520]], pegs: [], spikes: [[0, 490, 330]] },
	{ name: 'Switchbacks', ink: 1000, marbles: 10, need: 7, hopper: 320, cup: { x: 270, w: 100, y: 440 }, walls: [[150, 140, 490, 140], [150, 300, 490, 300]], pegs: [], spikes: [[0, 490, 260], [380, 490, 260]] },
	{ name: 'Gauntlet', ink: 1000, marbles: 10, need: 6, hopper: 560, cup: { x: 40, w: 90, y: 440 }, walls: [[420, 80, 420, 260], [220, 200, 220, 420]], pegs: [[320, 320], [520, 360], [120, 260]], spikes: [[140, 490, 500]] },
];

export default class MarbleRun extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.goBtn = tool.button('Release', () => this.release(), { primary: true });
		this.levelLabel = tool.label('');
		this.inkLabel = tool.label('');
		return tool.bar(this.levelLabel, this.inkLabel, this.goBtn, tool.button('Undo line', () => this.undo()), tool.button('Clear lines', () => this.clearLines()));
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	load(i) {
		this.level = i;
		this.L = LEVELS[i];
		this.lines = []; // each a polyline [x0, y0, x1, y1, …]
		this.stroke = null;
		this.clearRun();
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${this.L.name}`;
		this.paintInk();
		this.ctx.info(`Get ${this.L.need} of ${this.L.marbles} marbles into the cup`);
	}

	clearRun() {
		this.balls = [];
		this.state = 'draw';
		this.released = 0;
		this.home = 0;
		this.goBtn.disabled = false;
	}

	inkUsed() {
		let n = 0;
		for (const l of this.lines) for (let i = 2; i < l.length; i += 2) n += Math.hypot(l[i] - l[i - 2], l[i + 1] - l[i - 1]);
		return n;
	}

	paintInk() {
		const left = Math.max(0, Math.round(this.L.ink - this.inkUsed()));
		this.inkLabel.textContent = `Ink ${left}`;
	}

	undo() { if (this.state === 'draw') { this.lines.pop(); this.paintInk(); } }
	clearLines() { if (this.state === 'draw') { this.lines = []; this.paintInk(); } }

	pointerDown(p) {
		if (!this.running) return;
		if (this.state !== 'draw') { this.clearRun(); }
		this.stroke = [p.x, p.y];
		this.lines.push(this.stroke);
	}

	pointerMove(p) {
		const s = this.stroke;
		if (!s || !p.down) return;
		const lx = s[s.length - 2], ly = s[s.length - 1];
		const d = Math.hypot(p.x - lx, p.y - ly);
		if (d < 10) return;
		const left = this.L.ink - this.inkUsed();
		if (left <= 0) return;
		const k = Math.min(1, left / d);
		s.push(lx + (p.x - lx) * k, ly + (p.y - ly) * k);
		this.paintInk();
	}

	pointerUp() {
		if (this.stroke && this.stroke.length < 4) this.lines.pop();
		this.stroke = null;
		this.paintInk();
	}

	key(action) { if (action === 'action') this.release(); }

	release() {
		if (!this.running || this.state !== 'draw') return;
		this.state = 'rolling';
		this.goBtn.disabled = true;
		this.spawnTimer = 0;
		this.idle = 0;
		this.ctx.audio.play('roll');
	}

	segments() {
		const segs = [];
		for (const l of this.lines) for (let i = 2; i < l.length; i += 2) segs.push([l[i - 2], l[i - 1], l[i], l[i + 1]]);
		for (const w of this.L.walls) segs.push(w);
		const c = this.L.cup;
		segs.push([c.x, c.y - 50, c.x, c.y + 40], [c.x, c.y + 40, c.x + c.w, c.y + 40], [c.x + c.w, c.y + 40, c.x + c.w, c.y - 50]);
		// the hopper's funnel
		const hx = this.L.hopper;
		segs.push([hx - 34, 10, hx - 12, 46], [hx + 34, 10, hx + 12, 46]);
		return segs;
	}

	step(dt) {
		if (this.state !== 'rolling') return;
		const L = this.L;
		this.spawnTimer -= dt;
		if (this.released < L.marbles && this.spawnTimer <= 0) {
			this.spawnTimer = 0.55;
			this.balls.push({ x: L.hopper + (Math.random() - 0.5) * 4, y: 24, vx: 0, vy: 0, r: R, color: COLORS[this.released % COLORS.length], alive: true, home: false });
			this.released++;
		}
		const segs = this.segments();
		const sub = 4, h = Math.min(dt, 1 / 30) / sub;
		for (let s = 0; s < sub; s++) {
			for (const b of this.balls) {
				if (!b.alive) continue;
				b.vy += GRAVITY * h;
				b.x += b.vx * h; b.y += b.vy * h;
				for (const [ax, ay, bx, by] of segs) this.collideSeg(b, ax, ay, bx, by);
				for (const [px, py] of L.pegs) {
					const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
					if (d < R + 10 && d > 0) {
						const nx = dx / d, ny = dy / d;
						b.x = px + nx * (R + 10); b.y = py + ny * (R + 10);
						const dot = b.vx * nx + b.vy * ny;
						if (dot < 0) { b.vx -= 1.6 * dot * nx; b.vy -= 1.6 * dot * ny; if (dot < -150) this.ctx.audio.play('bounce'); }
					}
				}
				if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx) * 0.5; }
				if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx) * 0.5; }
				for (const [sx, sy, sw] of L.spikes) {
					if (b.x > sx && b.x < sx + sw && b.y > sy - 14) this.pop(b);
				}
				if (b.y > H + 30) b.alive = false;
			}
			for (let i = 0; i < this.balls.length; i++) for (let j = i + 1; j < this.balls.length; j++) {
				const a = this.balls[i], c = this.balls[j];
				if (a.alive && c.alive) collideDiscs(a, c, 0.6);
			}
		}
		const c = L.cup;
		let moving = 0;
		this.home = 0;
		for (const b of this.balls) {
			if (!b.alive) continue;
			if (b.x > c.x && b.x < c.x + c.w && b.y > c.y - 50 && b.y < c.y + 40) {
				this.home++;
				if (!b.home) { b.home = true; this.ctx.audio.play('coin'); this.fx.particles.burst(b.x, b.y, { count: 8, color: b.color, speed: 100, life: 0.4, size: 3 }); }
			} else if (Math.hypot(b.vx, b.vy) > 12) moving++;
		}
		if (this.released >= L.marbles) {
			this.idle = moving === 0 ? this.idle + dt : 0;
			if (this.idle > 1.2 || this.balls.every((b) => !b.alive || b.home)) this.judge();
		}
	}

	collideSeg(b, ax, ay, bx, by) {
		const abx = bx - ax, aby = by - ay;
		const t = Math.max(0, Math.min(1, ((b.x - ax) * abx + (b.y - ay) * aby) / (abx * abx + aby * aby || 1)));
		const cx = ax + abx * t, cy = ay + aby * t;
		const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
		const r = b.r + 2;
		if (d >= r || d === 0) return;
		const nx = dx / d, ny = dy / d;
		b.x = cx + nx * r; b.y = cy + ny * r;
		const vn = b.vx * nx + b.vy * ny;
		if (vn < 0) {
			b.vx -= 1.3 * vn * nx; b.vy -= 1.3 * vn * ny;
			// rolling friction
			b.vx *= 0.998; b.vy *= 0.998;
			if (vn < -260) this.ctx.audio.play('bounce');
		}
	}

	pop(b) {
		b.alive = false;
		this.ctx.audio.play('pop');
		this.fx.particles.burst(b.x, b.y, { count: 14, color: b.color, speed: 160, life: 0.5, shape: 'square', size: 3, gravity: 400 });
	}

	judge() {
		const L = this.L;
		if (this.home >= L.need) {
			this.state = 'won';
			const ink = Math.round(L.ink - this.inkUsed());
			const gain = this.home * 30 + Math.round(ink / 5);
			this.score += gain;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.popup(`${this.home} home · +${gain}`, W / 2, H / 2, { color: '#fde047', size: 26 });
			setTimeout(() => {
				if (!this.running) return;
				if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Marble architect!', message: 'Every run completed.', score: this.score });
				this.load(this.level + 1);
				this.ctx.fx.banner(`Level ${this.level + 1}`);
			}, 1500);
		} else {
			this.state = 'missed';
			this.ctx.audio.play('lifelost');
			setTimeout(() => { if (this.running && this.state === 'missed') this.clearRun(); }, 1500);
		}
	}

	draw(g) {
		const L = this.L;
		const bg = g.createLinearGradient(0, 0, 0, H);
		bg.addColorStop(0, '#312e81');
		bg.addColorStop(1, '#1e1b4b');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		// hopper
		g.strokeStyle = '#a5b4fc';
		g.lineWidth = 5;
		g.beginPath(); g.moveTo(L.hopper - 34, 10); g.lineTo(L.hopper - 12, 46); g.moveTo(L.hopper + 34, 10); g.lineTo(L.hopper + 12, 46); g.stroke();
		// cup
		const c = L.cup;
		g.fillStyle = 'rgba(52,211,153,0.12)';
		g.fillRect(c.x, c.y - 50, c.w, 90);
		g.strokeStyle = '#34d399';
		g.lineWidth = 5;
		g.beginPath(); g.moveTo(c.x, c.y - 50); g.lineTo(c.x, c.y + 40); g.lineTo(c.x + c.w, c.y + 40); g.lineTo(c.x + c.w, c.y - 50); g.stroke();
		g.strokeStyle = '#94a3b8';
		g.lineWidth = 7;
		g.lineCap = 'round';
		for (const [ax, ay, bx, by] of L.walls) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
		for (const [px, py] of L.pegs) circle(g, px, py, 10, '#e2e8f0');
		for (const [sx, sy, sw] of L.spikes) {
			g.fillStyle = '#f43f5e';
			g.beginPath();
			for (let x = sx; x < sx + sw; x += 16) { g.moveTo(x, sy + 16); g.lineTo(x + 8, sy - 6); g.lineTo(x + 16, sy + 16); }
			g.fill();
		}
		// drawn ramps
		g.strokeStyle = '#fde68a';
		g.lineWidth = 4;
		g.lineJoin = 'round';
		for (const l of this.lines) {
			if (l.length < 4) continue;
			g.beginPath();
			g.moveTo(l[0], l[1]);
			for (let i = 2; i < l.length; i += 2) g.lineTo(l[i], l[i + 1]);
			g.stroke();
		}
		for (const b of this.balls) {
			if (!b.alive) continue;
			circle(g, b.x, b.y, b.r, b.color);
			circle(g, b.x - 3, b.y - 3, 3, 'rgba(255,255,255,0.6)');
		}
		fillRound(g, 12, H - 26, 160, 14, 7, 'rgba(255,255,255,0.1)');
		fillRound(g, 12, H - 26, Math.max(14, (160 * this.home) / L.need), 14, 7, this.home >= L.need ? '#34d399' : '#60a5fa');
		text(g, `${this.home} / ${L.need}`, 182, H - 19, { size: 12, align: 'left' });
		if (this.state === 'draw' && this.running && !this.lines.length) text(g, 'Drag to draw ramps, then press Release', W / 2, H / 2, { size: 16, color: 'rgba(226,232,240,0.6)' });
		if (this.state === 'missed') text(g, 'Not enough made it. Redraw and try again!', W / 2, H / 2, { size: 22, color: '#fca5a5', weight: 900 });
	}
}
