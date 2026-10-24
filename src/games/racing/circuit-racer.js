// Circuit Racer: top-down arcade racing, three laps against three computer drivers that
// follow the racing line and slow for corners.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, text, colors } from '../core/canvas.js';
import { collideDiscs } from '../core/physics.js';
import { CanvasFx, Trail, ease } from '../core/fx.js';

const W = 900, H = 600, WIDTH = 74, LAPS = 3;
const RIVALS = { easy: 0.78, normal: 0.9, hard: 1.0 };

function catmull(points, samples = 10) {
	const out = [];
	const n = points.length;
	for (let i = 0; i < n; i++) {
		const [p0, p1, p2, p3] = [points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]];
		for (let k = 0; k < samples; k++) {
			const t = k / samples, t2 = t * t, t3 = t2 * t;
			out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t3)));
		}
	}
	return out;
}

const TRACKS = {
	oval: () => Array.from({ length: 96 }, (_, i) => {
		const t = (i / 96) * Math.PI * 2;
		const c = Math.cos(t), s = Math.sin(t);
		return [450 + 370 * Math.sign(c) * Math.abs(c) ** 0.7, 300 + 215 * Math.sign(s) * Math.abs(s) ** 0.7];
	}),
	hairpin: () => catmull([[110, 470], [110, 170], [230, 80], [370, 130], [400, 320], [500, 420], [620, 330], [620, 150], [760, 90], [820, 260], [780, 500], [600, 535], [300, 540]]),
	figure: () => Array.from({ length: 120 }, (_, i) => {
		const t = (i / 120) * Math.PI * 2 + Math.PI / 2;
		const d = 1 + Math.sin(t) ** 2;
		return [450 + (390 * Math.cos(t)) / d, 300 + (420 * Math.sin(t) * Math.cos(t)) / d];
	}),
};

export default class CircuitRacer extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(500);
		// skid marks persist on an offscreen layer so thousands cost nothing per frame
		this.marks = document.createElement('canvas');
		this.marks.width = W;
		this.marks.height = H;
		this.markG = this.marks.getContext('2d');
		this.reset();
	}

	reset() {
		this.running = false;
		this.line = (TRACKS[this.ctx.settings.track] ?? TRACKS.oval)();
		this.n = this.line.length;
		const [sx, sy] = this.line[0], [nx, ny] = this.line[1];
		const heading = Math.atan2(ny - sy, nx - sx);
		const skill = RIVALS[this.ctx.settings.difficulty] ?? 0.9;
		const paint = [colors.blue, colors.amber, colors.mint, colors.pink];
		this.cars = paint.map((color, i) => {
			// a two-by-two grid behind the start line
			const back = 34 + Math.floor(i / 2) * 46, side = (i % 2 ? 1 : -1) * 18;
			return {
				color, player: i === 0, x: sx - Math.cos(heading) * back - Math.sin(heading) * side, y: sy - Math.sin(heading) * back + Math.cos(heading) * side,
				a: heading, v: 0, vx: 0, vy: 0, r: 13, seg: this.n - 2, lap: 0, half: false, progress: 0,
				skill: i === 0 ? 1 : skill * (0.95 + i * 0.03), lapStart: 0, best: null, done: false, finishTime: 0,
			};
		});
		this.player = this.cars[0];
		this.time = 0;
		this.countdown = 3.2;
		this.fx?.clear();
		this.markG?.clearRect(0, 0, W, H);
		for (const car of this.cars) { car.trail = new Trail(12); car.lastSkid = null; }
		this.lastBeep = 4;
		this.ctx.info(`Lap 1/${LAPS}`);
		this.ctx.score('–');
	}

	nearest(car) {
		let best = car.seg, bestD = Infinity;
		for (let k = -6; k <= 12; k++) {
			const i = (car.seg + k + this.n) % this.n;
			const [x, y] = this.line[i];
			const d = (x - car.x) ** 2 + (y - car.y) ** 2;
			if (d < bestD) { bestD = d; best = i; }
		}
		return { i: best, d: Math.sqrt(bestD) };
	}

	update(dt) {
		this.fx.update(dt);
		if (!this.running) return;
		if (this.countdown > 0) {
			this.countdown -= dt;
			const beep = Math.ceil(this.countdown);
			if (beep !== this.lastBeep) { this.lastBeep = beep; this.ctx.audio.play(beep > 0 ? 'tick' : 'go'); }
			if (this.countdown > 0) return;
		}
		this.time += dt;
		const input = this.ctx.input;
		for (const car of this.cars) {
			const near = this.nearest(car);
			const offTrack = near.d > WIDTH / 2;
			let throttle, steer;
			if (car.player && !car.done) {
				throttle = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
				steer = input.axis().x;
			} else {
				// drivers aim a few points ahead and lift for sharp corners
				const look = (near.i + 6) % this.n, far = (near.i + 14) % this.n;
				const [tx, ty] = this.line[look];
				const want = Math.atan2(ty - car.y, tx - car.x);
				let diff = want - car.a;
				diff = Math.atan2(Math.sin(diff), Math.cos(diff));
				steer = Math.max(-1, Math.min(1, diff * 3));
				const [ax, ay] = this.line[near.i], [fx, fy] = this.line[far];
				const bend = Math.abs(Math.atan2(Math.sin(Math.atan2(fy - ty, fx - tx) - Math.atan2(ty - ay, tx - ax)), Math.cos(Math.atan2(fy - ty, fx - tx) - Math.atan2(ty - ay, tx - ax))));
				const target = 300 * car.skill * (1 - Math.min(bend, 1.2) * 0.42);
				throttle = car.done ? -0.3 : car.v < target ? 1 : -0.4;
			}
			const top = offTrack ? 120 : 310 * car.skill;
			if (throttle > 0) car.v += 260 * throttle * dt;
			else if (throttle < 0) car.v += (car.v > 0 ? 420 : 160) * throttle * dt;
			car.v -= car.v * (offTrack ? 2.2 : 0.45) * dt;
			car.v = Math.max(-90, Math.min(top + (car.v > top ? (car.v - top) * 0.9 : 0), car.v));
			const grip = Math.min(1, Math.abs(car.v) / 90);
			car.a += steer * 2.6 * grip * dt * Math.sign(car.v || 1);
			car.vx += (Math.cos(car.a) * car.v - car.vx) * Math.min(1, dt * 8);
			car.vy += (Math.sin(car.a) * car.v - car.vy) * Math.min(1, dt * 8);
			car.x += car.vx * dt;
			car.y += car.vy * dt;
			car.x = Math.max(10, Math.min(W - 10, car.x));
			car.y = Math.max(10, Math.min(H - 10, car.y));
			car.trail.push(car.x, car.y);
			// hard cornering leaves rubber on the track; the grass throws up dust
			const sliding = Math.abs(steer) > 0.6 && Math.abs(car.v) > 170 && !offTrack;
			if (sliding) {
				const mg = this.markG;
				mg.strokeStyle = 'rgba(20, 20, 24, 0.22)';
				mg.lineWidth = 3;
				for (const side of [-1, 1]) {
					const wx = car.x - Math.cos(car.a) * 10 - Math.sin(car.a) * 7 * side, wy = car.y - Math.sin(car.a) * 10 + Math.cos(car.a) * 7 * side;
					if (car.lastSkid) { mg.beginPath(); mg.moveTo(car.lastSkid[side > 0 ? 1 : 0][0], car.lastSkid[side > 0 ? 1 : 0][1]); mg.lineTo(wx, wy); mg.stroke(); }
					(car.nextSkid ??= [[0, 0], [0, 0]])[side > 0 ? 1 : 0] = [wx, wy];
				}
				car.lastSkid = car.nextSkid.map((p) => p.slice());
				if (car.player && Math.random() < 0.3) this.fx.particles.burst(car.x, car.y, { count: 1, color: '#e5e7eb', speed: 20, life: 0.5, shape: 'smoke', size: 5, grow: 12 });
			} else car.lastSkid = null;
			if (offTrack && Math.abs(car.v) > 40 && Math.random() < 0.5) {
				this.fx.particles.burst(car.x - Math.cos(car.a) * 12, car.y - Math.sin(car.a) * 12, { count: 1, colors: ['#a16207', '#65a30d'], speed: 40, life: 0.5, shape: 'dust', size: 3 });
			}

			// lap counting: halfway checkpoint, then crossing the start segment
			const prev = car.seg;
			car.seg = near.i;
			if (car.seg > this.n * 0.4 && car.seg < this.n * 0.6) car.half = true;
			if (car.half && prev > this.n * 0.8 && car.seg < this.n * 0.2) {
				car.half = false;
				car.lap++;
				const lapTime = this.time - car.lapStart;
				car.lapStart = this.time;
				if (car.lap >= 1 && (car.best === null || lapTime < car.best)) car.best = lapTime;
				if (car.player) {
					this.ctx.audio.play('score');
					this.ctx.score(car.best);
					const label = car.lap >= LAPS ? 'FINISH!' : car.lap === LAPS - 1 ? 'FINAL LAP' : `LAP ${car.lap + 1}`;
					this.fx.popups.add(label, W / 2, H / 2 - 40, { color: car.lap >= LAPS ? '#fde047' : '#ffffff', size: 40, life: 1.3, rise: 20 });
					if (car.best === lapTime && car.lap > 1) this.fx.popups.add(`Best lap ${lapTime.toFixed(2)} s`, W / 2, H / 2 + 10, { color: colors.mint, size: 20, life: 1.3 });
				}
				if (car.lap >= LAPS && !car.done) { car.done = true; car.finishTime = this.time; }
			}
			car.progress = car.lap * this.n + (car.half || car.seg < this.n * 0.5 ? car.seg : car.seg - this.n);
		}
		for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
			const a = this.cars[i], b = this.cars[j];
			const hit = collideDiscs(a, b, 0.4);
			if (hit > 40) {
				a.v *= 0.85; b.v *= 0.85;
				if (a.player || b.player) {
					this.ctx.audio.play('punch');
					this.fx.particles.burst((a.x + b.x) / 2, (a.y + b.y) / 2, { count: 14, colors: ['#fde047', '#ffffff', '#fb923c'], speed: 200, life: 0.35, shape: 'spark', size: 2.5, glow: true });
					this.fx.shake.kick(Math.min(6, hit / 30));
				}
			}
		}
		const place = this.place();
		this.ctx.info(`Lap ${Math.min(this.player.lap + 1, LAPS)}/${LAPS} · P${place} · ${this.time.toFixed(1)} s`);
		if (this.player.done) {
			const won = place === 1;
			this.finish({ win: won, title: won ? 'Victory!' : `Finished P${place}`, message: `Race time ${this.player.finishTime.toFixed(2)} s · best lap ${this.player.best.toFixed(2)} s.`, score: this.player.best });
		}
	}

	place() {
		const p = this.player;
		const key = (c) => (c.done ? 1e9 - c.finishTime : c.progress);
		return 1 + this.cars.filter((c) => c !== p && key(c) > key(p)).length;
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear('#3f7d3a');
		this.fx.shake.apply(g);
		g.fillStyle = 'rgba(0,0,0,0.06)';
		for (let x = 0; x < W; x += 40) g.fillRect(x, 0, 20, H);
		const path = () => {
			g.beginPath();
			this.line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
			g.closePath();
		};
		g.lineJoin = g.lineCap = 'round';
		path(); g.strokeStyle = '#e11d48'; g.lineWidth = WIDTH + 10; g.stroke();
		path(); g.strokeStyle = '#f8fafc'; g.setLineDash([16, 16]); g.stroke(); g.setLineDash([]);
		path(); g.strokeStyle = '#3b3f4a'; g.lineWidth = WIDTH; g.stroke();
		path(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; g.setLineDash([14, 18]); g.stroke(); g.setLineDash([]);
		// start line, checkered
		const [sx, sy] = this.line[0], [nx, ny] = this.line[1];
		const a = Math.atan2(ny - sy, nx - sx);
		g.save();
		g.translate(sx, sy);
		g.rotate(a);
		for (let k = 0; k < 8; k++) for (let j = 0; j < 2; j++) {
			g.fillStyle = (k + j) % 2 ? '#111' : '#fff';
			g.fillRect(j * 6 - 6, -WIDTH / 2 + k * (WIDTH / 8), 6, WIDTH / 8);
		}
		g.restore();

		g.drawImage(this.marks, 0, 0, W, H);
		for (const car of this.cars) car.trail?.draw(g, car.color, 8);
		for (const car of this.cars) {
			g.save();
			g.translate(car.x, car.y);
			g.rotate(car.a);
			fillRound(g, -14, -9, 30, 18, 6, 'rgba(0,0,0,0.3)');
			fillRound(g, -15, -10, 30, 20, 6, car.color);
			fillRound(g, 0, -7, 9, 14, 3, '#1e293b');
			g.fillStyle = 'rgba(255,255,255,0.4)';
			g.fillRect(-12, -2, 9, 4);
			g.restore();
			if (car.player) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(car.x, car.y, 20, 0, Math.PI * 2); g.stroke(); }
		}
		this.fx.draw(g);
		g.restore();
		if (this.running && this.countdown > 0) {
			// a start gantry: three reds light one by one, then all go green
			const lit = Math.min(3, Math.floor(3.2 - this.countdown) + 1);
			fillRound(g, W / 2 - 100, H / 2 - 50, 200, 70, 18, 'rgba(17, 24, 39, 0.9)');
			for (let k = 0; k < 3; k++) {
				const on = k < lit;
				circle(g, W / 2 - 60 + k * 60, H / 2 - 15, 20, on ? '#ef4444' : '#374151');
				if (on) circle(g, W / 2 - 60 + k * 60, H / 2 - 15, 26, 'rgba(239, 68, 68, 0.25)');
			}
		} else if (this.running && this.time < 0.9) {
			const k = ease.outBack(Math.min(1, this.time * 4));
			g.save();
			g.translate(W / 2, H / 2);
			g.scale(k, k);
			fillRound(g, -100, -50, 200, 70, 18, 'rgba(17, 24, 39, 0.9)');
			for (let j = 0; j < 3; j++) circle(g, -60 + j * 60, -15, 20, '#22c55e');
			g.restore();
			text(g, 'GO!', W / 2, H / 2 + 60, { size: 54, weight: 900, color: colors.mint });
		}
	}

	dispose() {
		this.surface.dispose();
	}
}
