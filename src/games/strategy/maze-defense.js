// Maze Defense: a tower defense with no fixed road. Creeps walk the shortest route from
// the gate on the left to the exit on the right, and every tower you build is a wall they
// must go around, so you shape the maze. You may never seal the route completely.
// Creeps steer by a flow field (one BFS from the exit), rebuilt only when a tower changes.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text, colors } from '../core/canvas.js';

const COLS = 17, ROWS = 11, CELL = 40;
const TOP = 30, W = COLS * CELL, H = ROWS * CELL + TOP;
const ENTRY = { x: 0, y: 5 }, EXIT = { x: COLS - 1, y: 5 };
const WAVES = 20;

const TOWERS = {
	wall: { name: 'Wall', cost: 4, range: 0, rate: 0, dmg: 0, color: '#78716c' },
	dart: { name: 'Dart', cost: 15, range: 2.6, rate: 0.45, dmg: 4, color: '#38bdf8' },
	frost: { name: 'Frost', cost: 25, range: 2.2, rate: 0.8, dmg: 1, slow: 0.5, color: '#a5f3fc' },
	cannon: { name: 'Cannon', cost: 40, range: 3.2, rate: 1.4, dmg: 12, splash: 1.1, color: '#f97316' },
};

export default class MazeDefense extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.toolChoice = tool.choice([...Object.entries(TOWERS).map(([k, t]) => [k, `${t.name} ${t.cost}`]), ['sell', 'Sell']], 'dart', (v) => { this.tool = v; });
		this.waveBtn = tool.button('Send wave', () => this.sendWave(), { primary: true });
		return tool.bar(this.toolChoice.el, this.waveBtn);
	}

	reset() {
		super.reset();
		this.tool = 'dart';
		this.toolChoice?.set('dart');
		this.grid = new Array(COLS * ROWS).fill(null);
		this.creeps = [];
		this.shots = [];
		this.gold = 80;
		this.lives = 20;
		this.wave = 0;
		this.spawnLeft = 0;
		this.spawnTimer = 0;
		this.score = 0;
		this.autoTimer = 0;
		this.flow = this.buildFlow(this.grid);
		this.ctx.score(0);
		this.hud();
	}

	hud() { this.ctx.info(`Wave ${this.wave}/${WAVES} · Gold ${this.gold} · Lives ${this.lives}`); }

	buildFlow(grid) {
		const d = new Int16Array(COLS * ROWS).fill(-1);
		const exit = EXIT.y * COLS + EXIT.x;
		d[exit] = 0;
		const queue = [exit];
		for (let q = 0; q < queue.length; q++) {
			const i = queue[q], x = i % COLS, y = Math.floor(i / COLS);
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nx = x + dx, ny = y + dy, j = ny * COLS + nx;
				if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || d[j] >= 0 || grid[j]) continue;
				d[j] = d[i] + 1;
				queue.push(j);
			}
		}
		return d;
	}

	pointerDown(p, e) {
		if (!this.running || this.paused) return;
		const x = Math.floor(p.x / CELL), y = Math.floor((p.y - TOP) / CELL);
		if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
		const i = y * COLS + x;
		if (this.tool === 'sell' || e?.button === 2) return this.sell(i);
		if (this.grid[i]) return this.ctx.audio.play('error');
		if ((x === ENTRY.x && y === ENTRY.y) || (x === EXIT.x && y === EXIT.y)) return this.ctx.audio.play('error');
		const spec = TOWERS[this.tool];
		if (this.gold < spec.cost) { this.popup('Not enough gold', p.x, p.y, { color: '#fca5a5', size: 14 }); return this.ctx.audio.play('error'); }
		// a creep standing on the cell blocks building there
		if (this.creeps.some((c) => Math.floor(c.x) === x && Math.floor(c.y) === y)) return this.ctx.audio.play('error');
		const trial = this.grid.slice();
		trial[i] = { kind: this.tool };
		const flow = this.buildFlow(trial);
		const entry = ENTRY.y * COLS + ENTRY.x;
		// every creep must still reach the exit
		if (flow[entry] < 0 || this.creeps.some((c) => flow[Math.floor(c.y) * COLS + Math.floor(c.x)] < 0)) {
			this.popup('Path blocked!', p.x, p.y, { color: '#fca5a5', size: 16 });
			return this.ctx.audio.play('error');
		}
		this.grid[i] = { kind: this.tool, ...spec, cool: 0, angle: 0 };
		this.flow = flow;
		this.gold -= spec.cost;
		this.ctx.audio.play('place');
		this.burst((x + 0.5) * CELL, TOP + (y + 0.5) * CELL, { count: 8, color: spec.color, speed: 80, life: 0.35, size: 3 });
		this.hud();
	}

	sell(i) {
		const t = this.grid[i];
		if (!t) return;
		this.grid[i] = null;
		this.gold += Math.floor(t.cost / 2);
		this.flow = this.buildFlow(this.grid);
		this.ctx.audio.play('coin');
		this.hud();
	}

	sendWave() {
		if (!this.running || this.spawnLeft > 0 || this.wave >= WAVES) return;
		this.wave++;
		this.spawnLeft = 6 + this.wave * 2;
		this.spawnTimer = 0;
		this.autoTimer = 0;
		this.ctx.fx.banner(`Wave ${this.wave}`);
		this.ctx.audio.play('go');
		this.hud();
	}

	spawn() {
		const boss = this.wave % 5 === 0 && this.spawnLeft === 1;
		const fast = this.wave >= 3 && Math.random() < 0.3;
		const hp = (8 + this.wave * this.wave * 0.9 + this.wave * 4) * (boss ? 8 : fast ? 0.6 : 1);
		this.creeps.push({ x: ENTRY.x + 0.5, y: ENTRY.y + 0.5, hp, max: hp, speed: (fast ? 2.4 : 1.5) * (boss ? 0.6 : 1), slow: 0, boss, fast, bounty: boss ? 40 : fast ? 3 : 2 + Math.floor(this.wave / 4) });
	}

	step(dt) {
		if (this.spawnLeft > 0) {
			this.spawnTimer -= dt;
			if (this.spawnTimer <= 0) { this.spawn(); this.spawnLeft--; this.spawnTimer = 0.7; }
		} else if (!this.creeps.length) {
			if (this.wave >= WAVES) {
				this.ctx.audio.play('win');
				this.ctx.fx.confetti({ count: 80 });
				return this.finish({ win: true, title: 'The maze held!', message: `All ${WAVES} waves stopped with ${this.lives} lives left.`, score: this.score + this.lives * 20 });
			}
			// the next wave starts by itself after a breather
			this.autoTimer += dt;
			if (this.wave > 0 && this.autoTimer > 8) this.sendWave();
		}
		for (const c of this.creeps) {
			const cx = Math.floor(c.x), cy = Math.floor(c.y);
			const here = this.flow[cy * COLS + cx];
			let tx = cx, ty = cy;
			if (here === 0) { c.hp = -1; c.escaped = true; continue; }
			let best = here;
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nx = cx + dx, ny = cy + dy;
				if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
				const v = this.flow[ny * COLS + nx];
				if (v >= 0 && v < best) { best = v; tx = nx; ty = ny; }
			}
			// head for the centre of the next cell
			const gx = tx + 0.5, gy = ty + 0.5;
			const dx = gx - c.x, dy = gy - c.y, len = Math.hypot(dx, dy) || 1;
			const speed = c.speed * (c.slow > 0 ? 0.5 : 1);
			c.slow -= dt;
			c.x += (dx / len) * Math.min(len, speed * dt);
			c.y += (dy / len) * Math.min(len, speed * dt);
			c.progress = here;
		}
		for (const c of this.creeps) if (c.escaped) {
			this.lives -= c.boss ? 5 : 1;
			this.ctx.audio.play('lifelost');
			this.fx.flash.trigger('#ef4444', 0.2);
			this.hud();
			if (this.lives <= 0) {
				this.ctx.audio.play('lose');
				return this.finish({ win: false, title: 'The creeps broke through', message: `You held until wave ${this.wave}.`, score: this.score });
			}
		}
		this.creeps = this.creeps.filter((c) => c.hp > 0);
		for (let i = 0; i < this.grid.length; i++) {
			const t = this.grid[i];
			if (!t || !t.rate) continue;
			t.cool -= dt;
			if (t.cool > 0) continue;
			const tx = (i % COLS) + 0.5, ty = Math.floor(i / COLS) + 0.5;
			let target = null;
			for (const c of this.creeps) if (Math.hypot(c.x - tx, c.y - ty) <= t.range && (!target || c.progress < target.progress)) target = c;
			if (!target) continue;
			t.cool = t.rate;
			t.angle = Math.atan2(target.y - ty, target.x - tx);
			this.shots.push({ x: tx, y: ty, target, t, speed: t.kind === 'cannon' ? 7 : 12 });
			this.ctx.audio.play(t.kind === 'cannon' ? 'thud' : t.kind === 'frost' ? 'zap' : 'tick');
		}
		for (const s of this.shots) {
			const dx = s.target.x - s.x, dy = s.target.y - s.y, d = Math.hypot(dx, dy);
			if (d < 0.2 || s.target.hp <= 0) { s.done = true; if (s.target.hp > 0) this.impact(s); continue; }
			s.x += (dx / d) * s.speed * dt;
			s.y += (dy / d) * s.speed * dt;
		}
		this.shots = this.shots.filter((s) => !s.done);
	}

	impact(s) {
		const t = s.t;
		const victims = t.splash ? this.creeps.filter((c) => Math.hypot(c.x - s.target.x, c.y - s.target.y) <= t.splash) : [s.target];
		if (t.splash) this.fx.particles.ring(s.target.x * CELL, TOP + s.target.y * CELL, { color: '#fdba74', radius: t.splash * CELL });
		for (const c of victims) {
			c.hp -= t.dmg;
			if (t.slow) c.slow = 1.6;
			if (c.hp <= 0) {
				this.gold += c.bounty;
				this.score += c.boss ? 100 : 10;
				this.ctx.score(this.score);
				this.burst(c.x * CELL, TOP + c.y * CELL, { count: c.boss ? 30 : 10, color: c.boss ? '#c084fc' : '#a3e635', speed: 120, life: 0.45, size: 3 });
				this.ctx.audio.play('pop');
				this.hud();
			}
		}
	}

	draw(g) {
		g.fillStyle = '#1c1917';
		g.fillRect(0, 0, W, H);
		text(g, `Gold ${this.gold}   ·   Lives ${this.lives}   ·   Wave ${this.wave}/${WAVES}${!this.spawnLeft && !this.creeps.length && this.wave < WAVES ? (this.wave ? `   ·   next in ${Math.max(0, Math.ceil(8 - this.autoTimer))}s` : '   ·   build, then Send wave') : ''}`, W / 2, 16, { size: 14, color: '#fde68a' });
		for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
			const i = y * COLS + x, px = x * CELL, py = TOP + y * CELL;
			g.fillStyle = (x + y) % 2 ? '#3f6212' : '#4d7c0f';
			g.fillRect(px, py, CELL, CELL);
			// faint route shading from the flow field
			if (!this.grid[i] && this.flow[i] >= 0) { g.fillStyle = `rgba(254,243,199,${0.05 + 0.1 * (1 - this.flow[i] / 60)})`; g.fillRect(px, py, CELL, CELL); }
		}
		for (const [p, label, c] of [[ENTRY, 'IN', '#22c55e'], [EXIT, 'OUT', '#ef4444']]) { fillRound(g, p.x * CELL + 3, TOP + p.y * CELL + 3, CELL - 6, CELL - 6, 8, c); text(g, label, (p.x + 0.5) * CELL, TOP + (p.y + 0.5) * CELL, { size: 12 }); }
		for (let i = 0; i < this.grid.length; i++) {
			const t = this.grid[i];
			if (!t) continue;
			const cx = (i % COLS + 0.5) * CELL, cy = TOP + (Math.floor(i / COLS) + 0.5) * CELL;
			fillRound(g, cx - CELL / 2 + 2, cy - CELL / 2 + 2, CELL - 4, CELL - 4, 6, '#57534e');
			if (t.kind === 'wall') { fillRound(g, cx - 14, cy - 14, 28, 28, 4, '#a8a29e'); continue; }
			circle(g, cx, cy, 13, t.color);
			g.strokeStyle = '#0c0a09';
			g.lineWidth = t.kind === 'cannon' ? 7 : 4;
			g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t.angle) * 17, cy + Math.sin(t.angle) * 17); g.stroke();
		}
		for (const c of this.creeps) {
			const x = c.x * CELL, y = TOP + c.y * CELL, r = c.boss ? 14 : c.fast ? 7 : 10;
			circle(g, x, y, r, c.boss ? '#a855f7' : c.fast ? '#facc15' : '#84cc16');
			if (c.slow > 0) { g.strokeStyle = '#a5f3fc'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r + 2, 0, Math.PI * 2); g.stroke(); }
			fillRound(g, x - 12, y - r - 7, 24, 4, 2, '#1c1917');
			fillRound(g, x - 12, y - r - 7, 24 * Math.max(0, c.hp / c.max), 4, 2, '#4ade80');
		}
		for (const s of this.shots) circle(g, s.x * CELL, TOP + s.y * CELL, s.t.kind === 'cannon' ? 5 : 3, s.t.kind === 'frost' ? '#cffafe' : '#fef3c7');
		// range preview under the pointer
		const px = Math.floor(this.pointer.x / CELL), py = Math.floor((this.pointer.y - TOP) / CELL);
		if (px >= 0 && py >= 0 && px < COLS && py < ROWS && this.tool !== 'sell') {
			const spec = TOWERS[this.tool];
			g.strokeStyle = colors.accent;
			g.lineWidth = 2;
			g.strokeRect(px * CELL + 1, TOP + py * CELL + 1, CELL - 2, CELL - 2);
			if (spec.range) { g.globalAlpha = 0.15; circle(g, (px + 0.5) * CELL, TOP + (py + 0.5) * CELL, spec.range * CELL, colors.accent); g.globalAlpha = 1; }
		}
	}
}
