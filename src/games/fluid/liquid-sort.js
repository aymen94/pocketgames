// Liquid Sort: pour coloured layers between tubes until every tube holds a single colour.
// A layer pours onto the same colour or into an empty tube, as much as fits. Each level
// is shuffled at random and checked by a solver before it is dealt, so it is always
// solvable; levels add colours as you go.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, text } from '../core/canvas.js';
import { ease } from '../core/fx.js';

const W = 640, H = 520, CAP = 4;
const PAINTS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#f8fafc', '#78350f'];

function canPour(tubes, a, b) {
	if (a === b) return 0;
	const from = tubes[a], to = tubes[b];
	if (!from.length || to.length >= CAP) return 0;
	const color = from[from.length - 1];
	if (to.length && to[to.length - 1] !== color) return 0;
	let run = 0;
	for (let i = from.length - 1; i >= 0 && from[i] === color; i--) run++;
	// pouring a whole single-colour tube into an empty one is a pointless move
	if (!to.length && run === from.length) return 0;
	return Math.min(run, CAP - to.length);
}

function solved(tubes) {
	return tubes.every((t) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0])));
}

/** Depth-first search with a visited set; returns true if the position can be solved. */
function solvable(start, limit = 20000) {
	const seen = new Set();
	const stack = [start.map((t) => t.slice())];
	while (stack.length) {
		const tubes = stack.pop();
		if (solved(tubes)) return true;
		const key = tubes.map((t) => t.join('')).sort().join('|');
		if (seen.has(key)) continue;
		seen.add(key);
		if (seen.size > limit) return false;
		for (let a = 0; a < tubes.length; a++) for (let b = 0; b < tubes.length; b++) {
			const n = canPour(tubes, a, b);
			if (!n) continue;
			const next = tubes.map((t) => t.slice());
			for (let i = 0; i < n; i++) next[b].push(next[a].pop());
			stack.push(next);
		}
	}
	return false;
}

function deal(colorCount, empties) {
	for (let attempt = 0; attempt < 12; attempt++) {
		const pool = [];
		for (let c = 0; c < colorCount; c++) for (let i = 0; i < CAP; i++) pool.push(c);
		for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
		const tubes = [];
		for (let c = 0; c < colorCount; c++) tubes.push(pool.slice(c * CAP, c * CAP + CAP));
		for (let e = 0; e < empties; e++) tubes.push([]);
		if (!solved(tubes) && solvable(tubes)) return tubes;
	}
	// fall back to an easy deal (always solvable): one extra empty tube
	return deal(Math.max(2, colorCount - 1), empties);
}

export default class LiquidSort extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.undoBtn = tool.button('Undo', () => this.undo());
		this.levelLabel = tool.label('');
		return tool.bar(this.levelLabel, this.undoBtn, tool.button('Restart level', () => this.startLevel(this.level, this.initial)), tool.button('Extra tube', () => this.addTube(), { title: 'Add an empty tube (costs 50 points)' }));
	}

	reset() {
		super.reset();
		this.level = 0;
		this.score = 0;
		this.ctx.score(0);
		this.startLevel(0);
	}

	restore(data) {
		this.level = data.level ?? 0;
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.startLevel(this.level, data.tubes);
	}

	startLevel(level, tubes = null) {
		this.level = level;
		const colours = Math.min(PAINTS.length, 3 + Math.floor(level * 0.75));
		const empties = level < 2 ? 2 : 2;
		this.initial = tubes ? tubes.map((t) => t.slice()) : deal(colours, empties);
		this.tubes = this.initial.map((t) => t.slice());
		this.history = [];
		this.selected = -1;
		this.moves = 0;
		this.anim = null;
		this.extraUsed = false;
		this.layout();
		this.levelLabel.textContent = `Level ${level + 1}`;
		this.ctx.info('Tap a tube, then the tube to pour into');
		this.ctx.saveProgress({ level, score: this.score, tubes: this.initial });
		this.wake();
	}

	addTube() {
		if (!this.running || this.extraUsed || this.anim) return;
		this.extraUsed = true;
		this.tubes.push([]);
		this.initial.push([]);
		this.score = Math.max(0, this.score - 50);
		this.ctx.score(this.score);
		this.layout();
		this.ctx.audio.play('pop');
		this.wake();
	}

	layout() {
		const n = this.tubes.length;
		const perRow = n > 8 ? Math.ceil(n / 2) : n;
		const rows = Math.ceil(n / perRow);
		const tw = 46, th = 170, gapX = Math.min(70, (W - 40) / perRow);
		this.slots = this.tubes.map((_, i) => {
			const r = Math.floor(i / perRow), c = i % perRow;
			const inRow = Math.min(perRow, n - r * perRow);
			const x0 = W / 2 - ((inRow - 1) * gapX) / 2;
			return { x: x0 + c * gapX - tw / 2, y: rows === 1 ? 190 : 70 + r * 230, w: tw, h: th };
		});
	}

	hitTube(p) {
		return this.slots.findIndex((s) => p.x > s.x - 10 && p.x < s.x + s.w + 10 && p.y > s.y - 30 && p.y < s.y + s.h + 10);
	}

	pointerDown(p) {
		if (!this.running || this.anim) return;
		const i = this.hitTube(p);
		if (i < 0) { this.selected = -1; return; }
		if (this.selected < 0) {
			if (!this.tubes[i].length) return this.ctx.audio.play('error');
			this.selected = i;
			this.ctx.audio.play('select');
			return;
		}
		if (i === this.selected) { this.selected = -1; return; }
		const n = canPour(this.tubes, this.selected, i);
		if (!n) {
			this.ctx.audio.play('error');
			this.selected = this.tubes[i].length ? i : -1;
			return;
		}
		this.pour(this.selected, i, n);
	}

	key(action, event) {
		const n = Number(event?.key);
		if (n >= 1 && n <= this.tubes.length) {
			const s = this.slots[n - 1];
			this.pointerDown({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
		}
		if (event?.key === 'z' || event?.key === 'u') this.undo();
	}

	pour(a, b, n) {
		const color = this.tubes[a][this.tubes[a].length - 1];
		this.history.push(this.tubes.map((t) => t.slice()));
		this.anim = { a, b, n, color, t: 0 };
		this.selected = -1;
		this.moves++;
		this.ctx.audio.play('splash');
	}

	undo() {
		if (!this.running || this.anim || !this.history.length) return;
		this.tubes = this.history.pop();
		this.moves++;
		this.ctx.audio.play('swoosh');
		this.wake();
	}

	busy() { return Boolean(this.anim); }

	tick(dt) {
		const a = this.anim;
		if (!a) return;
		a.t += dt / 0.75;
		// liquid moves across in the middle of the animation
		if (a.t >= 0.55 && !a.done) {
			a.done = true;
			for (let i = 0; i < a.n; i++) this.tubes[a.b].push(this.tubes[a.a].pop());
			const s = this.slots[a.b];
			this.burst(s.x + s.w / 2, s.y + s.h - this.tubes[a.b].length * (s.h - 14) / CAP, { count: 10, color: PAINTS[a.color], speed: 90, life: 0.5, shape: 'dot', size: 3, gravity: 200 });
			const t = this.tubes[a.b];
			if (t.length === CAP && t.every((c) => c === t[0])) {
				this.ctx.audio.play('chip');
				this.burst(s.x + s.w / 2, s.y - 10, { count: 24, colors: [PAINTS[a.color], '#ffffff'], speed: 160, angle: -Math.PI / 2, spread: 1.6, life: 0.7, shape: 'star', size: 4, gravity: 220 });
			}
		}
		if (a.t >= 1) {
			this.anim = null;
			if (solved(this.tubes)) this.levelDone();
		}
	}

	levelDone() {
		const gain = 100 + Math.max(0, 60 - this.moves) * 2;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		this.ctx.fx.confetti({ count: 60 });
		this.popup(`+${gain}`, W / 2, 90, { color: '#fde047', size: 30 });
		const next = this.level + 1;
		if (next >= 12) {
			setTimeout(() => this.finish({ win: true, title: 'Perfectly sorted!', message: 'All 12 levels sorted.', score: this.score }), 900);
			return;
		}
		setTimeout(() => { if (this.running) { this.startLevel(next); this.ctx.fx.banner(`Level ${next + 1}`); } }, 1100);
	}

	draw(g) {
		const bg = g.createRadialGradient(W / 2, H * 0.35, 40, W / 2, H / 2, W * 0.7);
		bg.addColorStop(0, '#1e1b4b');
		bg.addColorStop(1, '#0b1020');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		const a = this.anim;
		this.tubes.forEach((tube, i) => {
			const s = this.slots[i];
			let x = s.x, y = s.y, tilt = 0;
			if (i === this.selected) y -= 22;
			if (a && i === a.a) {
				// lift, swing over the target, tilt, and come back
				const to = this.slots[a.b];
				const k = a.t < 0.3 ? ease.outCubic(a.t / 0.3) : a.t > 0.8 ? 1 - ease.inOutCubic((a.t - 0.8) / 0.2) : 1;
				x = s.x + (to.x + (to.x > s.x ? -26 : 26) - s.x) * k;
				y = s.y - 70 * k;
				tilt = (to.x > s.x ? 1 : -1) * 1.0 * k;
			}
			this.drawTube(g, tube, x, y, s.w, s.h, tilt, i);
			if (a && i === a.a && a.t > 0.3 && a.t < 0.8) {
				// the stream
				const to = this.slots[a.b];
				const sx = x + s.w / 2 + (to.x > s.x ? 30 : -30), sy = y + 20;
				g.strokeStyle = PAINTS[a.color];
				g.lineWidth = 6;
				g.lineCap = 'round';
				g.beginPath();
				g.moveTo(sx, sy);
				g.lineTo(to.x + to.w / 2, to.y + to.h - this.tubes[a.b].length * ((to.h - 14) / CAP));
				g.stroke();
			}
			text(g, String(i + 1), s.x + s.w / 2, s.y + s.h + 18, { size: 12, color: 'rgba(255,255,255,0.35)' });
		});
		text(g, `Moves ${this.moves}`, W - 16, 22, { size: 14, align: 'right', color: 'rgba(255,255,255,0.7)' });
	}

	drawTube(g, tube, x, y, w, h, tilt, index) {
		g.save();
		g.translate(x + w / 2, y + h / 2);
		g.rotate(tilt);
		g.translate(-w / 2, -h / 2);
		// glass
		g.fillStyle = 'rgba(255,255,255,0.06)';
		g.beginPath();
		g.roundRect(0, 0, w, h, [6, 6, w / 2, w / 2]);
		g.fill();
		g.save();
		g.clip();
		const layer = (h - 14) / CAP;
		tube.forEach((c, j) => {
			const ly = h - (j + 1) * layer;
			const grad = g.createLinearGradient(0, 0, w, 0);
			grad.addColorStop(0, PAINTS[c]);
			grad.addColorStop(0.45, shade(PAINTS[c], 30));
			grad.addColorStop(1, shade(PAINTS[c], -25));
			g.fillStyle = grad;
			g.fillRect(0, ly, w, layer + 1);
			if (j === tube.length - 1) {
				// a wobbly meniscus on the top layer
				g.fillStyle = 'rgba(255,255,255,0.25)';
				g.fillRect(0, ly, w, 3);
			}
		});
		g.restore();
		g.strokeStyle = index === this.selected ? '#fde047' : 'rgba(255,255,255,0.45)';
		g.lineWidth = 2.5;
		g.beginPath();
		g.roundRect(0, 0, w, h, [6, 6, w / 2, w / 2]);
		g.stroke();
		g.fillStyle = 'rgba(255,255,255,0.18)';
		g.fillRect(7, 10, 5, h - 30);
		g.restore();
		if (tube.length === CAP && tube.every((c) => c === tube[0]) && !tilt) fillRound(g, x + w / 2 - 12, y - 14, 24, 8, 4, 'rgba(255,255,255,0.6)');
	}
}

function shade(hex, amount) {
	const n = parseInt(hex.slice(1), 16);
	const r = Math.max(0, Math.min(255, (n >> 16) + amount)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount)), b = Math.max(0, Math.min(255, (n & 255) + amount));
	return `rgb(${r},${g},${b})`;
}
