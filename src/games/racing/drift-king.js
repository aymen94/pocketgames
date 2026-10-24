// Drift King: slide a rear-wheel-drive car sideways around a twisting circuit. Drift
// points build while the car is sideways at speed and bank when you straighten out;
// hitting the grass or a wall loses the combo. Three laps against the clock.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text } from '../core/canvas.js';
import { Particles2D } from '../core/fx.js';

const W = 800, H = 520, TRACK_W = 120;
// circuit centreline (closed), smoothed into a spline at load
const POINTS = [[400, 140], [760, 120], [1000, 260], [980, 520], [760, 600], [680, 820], [900, 980], [700, 1140], [360, 1080], [180, 880], [320, 700], [160, 520], [120, 300]];

function spline(points, per = 14) {
	const out = [];
	const n = points.length;
	for (let i = 0; i < n; i++) {
		const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
		for (let k = 0; k < per; k++) {
			const t = k / per, t2 = t * t, t3 = t2 * t;
			out.push([
				0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
				0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
			]);
		}
	}
	return out;
}

export default class DriftKing extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	setup() {
		this.line = spline(POINTS);
		this.marks = [];
		this.smoke = new Particles2D(300); // world-space tyre smoke
	}

	reset() {
		super.reset();
		const [a, b] = [this.line[0], this.line[1]];
		this.car = { x: a[0], y: a[1], a: Math.atan2(b[1] - a[1], b[0] - a[0]), vx: 0, vy: 0, steer: 0 };
		this.cam = { x: a[0], y: a[1] };
		this.progress = 0;
		this.lap = 1;
		this.time = 0;
		this.score = 0;
		this.combo = 0;
		this.comboMult = 1;
		this.marks = [];
		this.lastIndex = 0;
		this.ctx.score(0);
	}

	/** Nearest centreline sample and the distance to it. */
	nearest(x, y) {
		let best = 0, d = Infinity;
		const n = this.line.length;
		// search around the last known index for speed, falling back to everything
		for (let k = -30; k <= 30; k++) {
			const i = (this.lastIndex + k + n) % n;
			const [px, py] = this.line[i];
			const dd = (px - x) ** 2 + (py - y) ** 2;
			if (dd < d) { d = dd; best = i; }
		}
		if (d > 300 * 300) for (let i = 0; i < n; i++) { const [px, py] = this.line[i]; const dd = (px - x) ** 2 + (py - y) ** 2; if (dd < d) { d = dd; best = i; } }
		return { i: best, d: Math.sqrt(d) };
	}

	tick(dt) { this.smoke.update(dt); }

	step(dt) {
		const c = this.car, input = this.ctx.input;
		this.time += dt;
		let steer = input.axis().x;
		let throttle = input.isDown('up') ? 1 : 0;
		const brake = input.isDown('down');
		const handbrake = input.isDown('action');
		if (this.pointer.down) {
			// touch: steer toward the finger relative to the car on screen, always on the gas
			const sx = this.pointer.x - W / 2, sy = this.pointer.y - H / 2;
			let d = Math.atan2(sy, sx) - c.a;
			d = Math.atan2(Math.sin(d), Math.cos(d));
			steer = Math.max(-1, Math.min(1, d * 2));
			throttle = 1;
		}
		c.steer += (steer - c.steer) * Math.min(1, dt * 10);
		const fx = Math.cos(c.a), fy = Math.sin(c.a);
		let vf = c.vx * fx + c.vy * fy; // forward speed
		let vl = -c.vx * fy + c.vy * fx; // sideways speed
		const near = this.nearest(c.x, c.y);
		this.lastIndex = near.i;
		const offTrack = near.d > TRACK_W / 2;
		const engine = offTrack ? 240 : 420;
		if (throttle) vf += engine * dt;
		if (brake) vf -= (vf > 0 ? 700 : 250) * dt;
		vf *= 1 - (offTrack ? 1.6 : 0.35) * dt;
		vf = Math.max(-120, Math.min(520, vf));
		// grip: strong normally, weak with the handbrake or when already sliding hard
		const slide = Math.abs(vl) / (Math.abs(vf) + 40);
		const grip = handbrake ? 1.2 : slide > 0.35 ? 3.2 : 9;
		vl *= Math.exp(-grip * dt);
		// steering turns faster at speed, and more when sliding (counter-steer catches it)
		const turn = c.steer * Math.min(1, Math.abs(vf) / 160) * (2.6 + (handbrake ? 1.2 : 0)) * Math.sign(vf || 1);
		c.a += turn * dt;
		// power oversteer: throttle mid-corner kicks the tail out
		if (throttle && Math.abs(c.steer) > 0.5 && vf > 220) vl += -c.steer * 120 * dt * (handbrake ? 2 : 1);
		c.vx = fx * vf - fy * vl;
		c.vy = fy * vf + fx * vl;
		c.x += c.vx * dt;
		c.y += c.vy * dt;
		// walls well outside the track push back
		if (near.d > TRACK_W / 2 + 70) {
			const [px, py] = this.line[near.i];
			const nx = (c.x - px) / near.d, ny = (c.y - py) / near.d;
			c.x = px + nx * (TRACK_W / 2 + 70);
			c.y = py + ny * (TRACK_W / 2 + 70);
			c.vx *= 0.4; c.vy *= 0.4;
			this.breakCombo('Wall!');
			this.ctx.audio.play('thud');
		}
		// drift scoring
		const speed = Math.hypot(c.vx, c.vy);
		const angle = Math.abs(Math.atan2(vl, Math.abs(vf)));
		if (!offTrack && speed > 160 && angle > 0.25) {
			this.combo += angle * speed * dt * 0.4;
			this.drifting = 0.25;
			if (Math.random() < 0.6) {
				for (const side of [-1, 1]) this.marks.push([c.x - fx * 16 + fy * 9 * side, c.y - fy * 16 - fx * 9 * side]);
				if (this.marks.length > 900) this.marks.splice(0, 2);
				this.smoke.burst(c.x - fx * 18, c.y - fy * 18, { count: 1, color: '#e5e7eb', speed: 30, life: 0.7, shape: 'smoke', size: 6, grow: 14 });
			}
			this.comboMult = 1 + Math.min(4, Math.floor(this.combo / 400));
		} else {
			this.drifting = Math.max(0, (this.drifting ?? 0) - dt);
			if (this.drifting <= 0 && this.combo > 0) this.bank();
		}
		if (offTrack && this.combo > 0) this.breakCombo('Off track');
		// laps: progress along the centreline
		const n = this.line.length;
		let di = near.i - (this.prevIndex ?? 0);
		if (di < -n / 2) di += n;
		if (di > n / 2) di -= n;
		this.prevIndex = near.i;
		this.progress += di;
		if (this.progress >= n * this.lap) {
			this.lap++;
			this.ctx.audio.play('levelup');
			if (this.lap > 3) {
				if (this.combo > 0) this.bank();
				return this.finish({ win: true, title: 'Finish!', message: `Three laps in ${this.fmt(this.time)}.`, score: this.score });
			}
			this.ctx.fx.banner(`Lap ${this.lap}`);
		}
		this.cam.x += (c.x + c.vx * 0.3 - this.cam.x) * Math.min(1, dt * 4);
		this.cam.y += (c.y + c.vy * 0.3 - this.cam.y) * Math.min(1, dt * 4);
		this.ctx.info(`Lap ${Math.min(3, this.lap)}/3 · ${this.fmt(this.time)}`);
	}

	fmt(t) { return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`; }

	bank() {
		const points = Math.round(this.combo * this.comboMult);
		this.score += points;
		this.ctx.score(this.score);
		if (points > 50) {
			this.popup(`+${points}`, W / 2, H / 2 - 60, { color: '#fde047', size: 20 + Math.min(16, points / 100) });
			this.ctx.audio.play('coin');
		}
		this.combo = 0;
		this.comboMult = 1;
	}

	breakCombo(why) {
		if (this.combo > 30) this.popup(why, W / 2, H / 2 - 60, { color: '#fb7185', size: 20 });
		this.combo = 0;
		this.comboMult = 1;
	}

	draw(g) {
		g.fillStyle = '#3f6212';
		g.fillRect(0, 0, W, H);
		g.save();
		g.translate(W / 2 - this.cam.x, H / 2 - this.cam.y);
		const line = this.line;
		const path = () => { g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
		g.lineJoin = 'round';
		path(); g.strokeStyle = '#a16207'; g.lineWidth = TRACK_W + 140; g.stroke();
		path(); g.strokeStyle = '#e5e7eb'; g.lineWidth = TRACK_W + 14; g.setLineDash([22, 22]); g.stroke(); g.setLineDash([]);
		path(); g.strokeStyle = '#dc2626'; g.lineWidth = TRACK_W + 14; g.setLineDash([22, 22]); g.lineDashOffset = 22; g.stroke(); g.setLineDash([]); g.lineDashOffset = 0;
		path(); g.strokeStyle = '#374151'; g.lineWidth = TRACK_W; g.stroke();
		// start line
		const [sx, sy] = line[0], [tx, ty] = line[1];
		const a = Math.atan2(ty - sy, tx - sx);
		g.save(); g.translate(sx, sy); g.rotate(a);
		for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#111' : '#fff'; g.fillRect(-4, -TRACK_W / 2 + i * (TRACK_W / 8), 8, TRACK_W / 8); }
		g.restore();
		g.fillStyle = 'rgba(17,24,39,0.35)';
		for (const [x, y] of this.marks) g.fillRect(x - 2, y - 2, 4, 4);
		this.smoke.draw(g);
		const c = this.car;
		g.save();
		g.translate(c.x, c.y);
		g.rotate(c.a);
		fillRound(g, -20, -11, 40, 22, 6, '#f43f5e');
		fillRound(g, -4, -9, 14, 18, 4, '#1f2937');
		fillRound(g, 14, -8, 5, 16, 2, '#fde68a');
		g.restore();
		g.restore();
		if (this.combo > 10) text(g, `DRIFT ${Math.round(this.combo)} ×${this.comboMult}`, W / 2, 40, { size: 24, color: '#fde047', weight: 900 });
		const speed = Math.hypot(c.vx, c.vy);
		text(g, `${Math.round(speed * 0.4)} km/h`, W - 16, H - 18, { size: 16, align: 'right' });
	}
}
