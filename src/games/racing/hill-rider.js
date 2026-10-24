// Hill Rider: ride a dirt bike over endless rolling hills. Gas and brake drive the rear
// wheel; in the air, lean to land on both wheels. Land on your head and it is over;
// grab fuel cans to keep going and coins for points. The hills get steeper with distance.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, circle } from '../core/canvas.js';

const W = 800, H = 500, GRAVITY = 900, WHEEL = 16;

function ground(x) {
	const k = Math.min(1, Math.max(0, x - 400) / 8000);
	return 360 - Math.sin(x * 0.004) * (40 + k * 60) - Math.sin(x * 0.0113 + 1.3) * (20 + k * 60) - Math.sin(x * 0.027 + 0.4) * (6 + k * 26);
}

export default class HillRider extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		const x = 200;
		// three points: rear wheel, front wheel, rider's head (a rigid triangle of springs)
		this.pts = [
			{ x, y: ground(x) - WHEEL - 2, px: x, py: ground(x) - WHEEL - 2, r: WHEEL },
			{ x: x + 56, y: ground(x + 56) - WHEEL - 2, px: x + 56, py: ground(x + 56) - WHEEL - 2, r: WHEEL },
			{ x: x + 22, y: ground(x) - 70, px: x + 22, py: ground(x) - 70, r: 9 },
		];
		this.links = [[0, 1], [0, 2], [1, 2]].map(([a, b]) => ({ a, b, rest: Math.hypot(this.pts[a].x - this.pts[b].x, this.pts[a].y - this.pts[b].y) }));
		this.fuel = 100;
		this.coins = 0;
		this.distance = 0;
		this.score = 0;
		this.spin = 0;
		this.air = 0;
		this.flips = 0;
		this.cam = x;
		this.items = [];
		this.nextItem = 600;
		this.dead = false;
		this.ctx.score(0);
	}

	spawnItems(upto) {
		while (this.nextItem < upto) {
			const x = this.nextItem;
			if (Math.floor(x / 600) % 3 === 2) this.items.push({ x, kind: 'fuel' });
			else for (let i = 0; i < 4; i++) this.items.push({ x: x + i * 34, kind: 'coin' });
			this.nextItem += 420 + Math.random() * 300;
		}
		this.items = this.items.filter((it) => it.x > this.cam - 400 && !it.taken);
	}

	angle() { const [a, b] = this.pts; return Math.atan2(b.y - a.y, b.x - a.x); }

	step(dt) {
		if (this.dead) return;
		const input = this.ctx.input;
		let gas = input.isDown('right') || input.isDown('up');
		let brake = input.isDown('left') || input.isDown('down');
		if (this.pointer.down) { gas = this.pointer.x > W / 2; brake = !gas; }
		if (this.fuel <= 0) gas = false;
		const sub = 6, h = Math.min(dt, 1 / 30) / sub;
		const [rear, front, head] = this.pts;
		for (let s = 0; s < sub; s++) {
			for (const p of this.pts) {
				const vx = (p.x - p.px) * 0.999, vy = (p.y - p.py) * 0.999;
				p.px = p.x; p.py = p.y;
				p.x += vx; p.y += vy + GRAVITY * h * h;
			}
			const grounded = [false, false];
			for (let it = 0; it < 4; it++) {
				for (const l of this.links) {
					const a = this.pts[l.a], b = this.pts[l.b];
					const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
					const k = ((d - l.rest) / d) * 0.5;
					a.x += dx * k; a.y += dy * k; b.x -= dx * k; b.y -= dy * k;
				}
				for (let i = 0; i < 2; i++) {
					const p = this.pts[i];
					const depth = p.y + p.r - ground(p.x);
					if (depth > 0) { p.y -= depth; grounded[i] = true; }
				}
			}
			// rolling resistance on wheels that touch the ground
			for (let i = 0; i < 2; i++) if (grounded[i]) { const p = this.pts[i]; p.px += (p.x - p.px) * 0.004; }
			// drive: the rear wheel pushes along the slope when touching
			const ang = this.angle();
			if (grounded[0]) {
				const push = gas ? 520 : brake ? -380 : 0;
				rear.x += Math.cos(ang) * push * h * h; rear.y += Math.sin(ang) * push * h * h;
				if (brake && !gas) { rear.px += (rear.x - rear.px) * 0.05; front.px += (front.x - front.px) * 0.05; }
			}
			// lean in the air: spin the bike about its centre of mass (no net push)
			const lean = (gas ? 1 : 0) - (brake ? 1 : 0);
			if (lean && !grounded[0] && !grounded[1]) {
				const cx = (rear.x + front.x + head.x) / 3, cy = (rear.y + front.y + head.y) / 3;
				const torque = 2.6 * lean * h;
				for (const p of this.pts) {
					const dx = p.x - cx, dy = p.y - cy;
					// rotating backward (wheelie) on gas, forward on brake
					p.x += -dy * -torque * 0.5; p.y += dx * -torque * 0.5;
				}
			}
			this.grounded = grounded[0] || grounded[1];
		}
		if (gas) this.fuel = Math.max(0, this.fuel - dt * 4.5);
		// flips: track rotation while airborne
		const ang = this.angle();
		if (!this.grounded) {
			this.air += dt;
			let d = ang - (this.lastAng ?? ang);
			d = Math.atan2(Math.sin(d), Math.cos(d));
			this.spin += d;
			if (Math.abs(this.spin) > Math.PI * 2 * 0.92) { this.flips++; this.spin = 0; this.score += 250; this.popup('FLIP! +250', W / 2, 120, { color: '#fde047', size: 26 }); this.ctx.audio.play('powerup'); }
		} else {
			if (this.air > 1) { this.score += Math.round(this.air * 40); this.popup(`Air ${this.air.toFixed(1)} s`, W / 2, 150, { color: '#a7f3d0', size: 18 }); }
			this.air = 0;
			this.spin = 0;
		}
		this.lastAng = ang;
		// head hits the ground
		if (head.y + head.r > ground(head.x)) return this.crash('Ouch! You landed on your head.');
		if (this.fuel <= 0 && Math.abs(rear.x - rear.px) < 0.02 && this.grounded) return this.crash('Out of fuel.');
		this.distance = Math.max(this.distance, (rear.x - 200) / 10);
		this.cam += (rear.x + 200 - this.cam) * Math.min(1, dt * 3);
		this.spawnItems(this.cam + W);
		for (const it of this.items) {
			if (it.taken) continue;
			const iy = ground(it.x) - 40;
			if (this.pts.some((p) => Math.hypot(p.x - it.x, p.y - iy) < p.r + 12)) {
				it.taken = true;
				if (it.kind === 'fuel') { this.fuel = 100; this.ctx.audio.play('powerup'); }
				else { this.coins++; this.ctx.audio.play('coin'); }
			}
		}
		this.score = Math.max(this.score, 0);
		const total = Math.floor(this.distance) + this.coins * 20 + this.flips * 250;
		this.ctx.score(Math.max(total, this.score));
		this.ctx.info(`${Math.floor(this.distance)} m · coins ${this.coins} · flips ${this.flips}`);
	}

	crash(message) {
		this.dead = true;
		this.ctx.audio.play('crash');
		this.fx.shake.kick(8);
		const total = Math.floor(this.distance) + this.coins * 20 + this.flips * 250;
		this.finish({ win: false, title: 'Wipeout!', message: `${message} You rode ${Math.floor(this.distance)} m.`, score: total });
	}

	draw(g) {
		const sky = g.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#fb923c');
		sky.addColorStop(1, '#fde68a');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		const ox = this.cam - W / 2 - 100;
		// distant hills (parallax)
		g.fillStyle = '#c2410c';
		g.beginPath(); g.moveTo(0, H);
		for (let x = 0; x <= W; x += 20) g.lineTo(x, 260 - Math.sin((x + ox * 0.3) * 0.006) * 40);
		g.lineTo(W, H); g.fill();
		g.save();
		g.translate(-ox, 0);
		g.fillStyle = '#78350f';
		g.beginPath(); g.moveTo(ox, H);
		for (let x = ox; x <= ox + W + 20; x += 10) g.lineTo(x, ground(x));
		g.lineTo(ox + W + 20, H); g.fill();
		g.strokeStyle = '#65a30d';
		g.lineWidth = 6;
		g.beginPath();
		for (let x = ox; x <= ox + W + 20; x += 10) (x === ox ? g.moveTo(x, ground(x)) : g.lineTo(x, ground(x)));
		g.stroke();
		for (let m = Math.ceil(ox / 1000) * 1000; m < ox + W; m += 1000) { text(g, `${(m - 200) / 10} m`, m, ground(m) + 30, { size: 12, color: '#fde68a' }); }
		for (const it of this.items) {
			if (it.taken) continue;
			const y = ground(it.x) - 40;
			if (it.kind === 'coin') circle(g, it.x, y, 9, '#facc15');
			else { fillRound(g, it.x - 10, y - 13, 20, 26, 4, '#dc2626'); text(g, 'F', it.x, y, { size: 12 }); }
		}
		const [rear, front, head] = this.pts;
		g.strokeStyle = '#1f2937';
		g.lineWidth = 6;
		g.beginPath(); g.moveTo(rear.x, rear.y); g.lineTo((rear.x + front.x) / 2, (rear.y + front.y) / 2 - 14); g.lineTo(front.x, front.y); g.stroke();
		g.strokeStyle = '#2563eb';
		g.lineWidth = 7;
		g.beginPath(); g.moveTo((rear.x + front.x) / 2, (rear.y + front.y) / 2 - 12); g.lineTo(head.x, head.y + 10); g.stroke();
		circle(g, head.x, head.y, head.r, '#f43f5e');
		for (const w of [rear, front]) { circle(g, w.x, w.y, w.r, '#111827'); circle(g, w.x, w.y, 5, '#9ca3af'); }
		g.restore();
		fillRound(g, 14, 14, 150, 14, 7, 'rgba(0,0,0,0.25)');
		fillRound(g, 14, 14, Math.max(14, 1.5 * this.fuel), 14, 7, this.fuel > 25 ? '#16a34a' : '#dc2626');
		text(g, 'FUEL', 172, 21, { size: 11, align: 'left', color: '#7c2d12' });
	}
}
