// Block Drop: falling four-block pieces on a 10 × 20 well. Seven-piece bags, a ghost
// preview, wall kicks, lock delay and auto-repeat that also works with the touch pad.

import { Game } from '../core/game.js';
import { Surface, fillRound, text, colors } from '../core/canvas.js';
import { CanvasFx } from '../core/fx.js';

const COLS = 10, ROWS = 20, C = 28, SIDE = 150;
const W = COLS * C + SIDE, H = ROWS * C;
const PIECES = {
	I: { color: '#22d3ee', cells: [[0, 1], [1, 1], [2, 1], [3, 1]], size: 4 },
	O: { color: '#fbbf24', cells: [[1, 0], [2, 0], [1, 1], [2, 1]], size: 4 },
	T: { color: '#a78bfa', cells: [[1, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
	S: { color: '#34d399', cells: [[1, 0], [2, 0], [0, 1], [1, 1]], size: 3 },
	Z: { color: '#fb7185', cells: [[0, 0], [1, 0], [1, 1], [2, 1]], size: 3 },
	J: { color: '#60a5fa', cells: [[0, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
	L: { color: '#fb923c', cells: [[2, 0], [0, 1], [1, 1], [2, 1]], size: 3 },
};
const LINE_POINTS = [0, 100, 300, 500, 800];

export default class BlockDrop extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H);
		this.fx = new CanvasFx(500);
		this.locked = [];
		this.interval = 0.8;
		this.ctx.input.swipe(this.surface.canvas, (dir) => {
			if (dir === 'left' || dir === 'right') this.shift(dir === 'left' ? -1 : 1);
			else if (dir === 'down') this.hardDrop();
			else this.rotate();
		}, () => this.rotate());
		this.reset();
	}

	reset() {
		this.running = false;
		this.well = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
		this.bag = [];
		this.queue = [this.draw(), this.draw()];
		this.score = 0;
		this.lines = 0;
		this.startLevel = +this.ctx.settings.start || 1;
		this.level = this.startLevel;
		this.flash = [];
		this.locked = [];
		this.fx.clear();
		this.repeat = { left: 0, right: 0, down: 0 };
		this.spawn();
		this.ctx.score(0);
		this.info();
	}

	info() {
		this.ctx.info(`Level ${this.level} · ${this.lines} lines`);
	}

	draw() {
		if (!this.bag.length) this.bag = Object.keys(PIECES).sort(() => Math.random() - 0.5);
		return this.bag.pop();
	}

	spawn() {
		const type = this.queue.shift();
		this.queue.push(this.draw());
		const def = PIECES[type];
		this.piece = { type, cells: def.cells.map(([x, y]) => [x, y]), size: def.size, x: 3, y: type === 'I' ? -1 : 0 };
		this.fall = 0;
		this.lock = 0;
		if (!this.fits(this.piece.cells, this.piece.x, this.piece.y)) {
			this.ctx.audio.play('crash');
			this.finish({ win: false, title: 'Stacked out', message: `${this.lines} lines cleared, level ${this.level}.`, score: this.score });
		}
	}

	fits(cells, px, py) {
		for (const [x, y] of cells) {
			const cx = px + x, cy = py + y;
			if (cx < 0 || cx >= COLS || cy >= ROWS) return false;
			if (cy >= 0 && this.well[cy][cx]) return false;
		}
		return true;
	}

	shift(dx) {
		if (!this.running || this.paused) return false;
		const p = this.piece;
		if (!this.fits(p.cells, p.x + dx, p.y)) return false;
		p.x += dx;
		this.lock = 0;
		this.ctx.audio.play('move');
		return true;
	}

	rotate() {
		if (!this.running || this.paused || this.piece.type === 'O') return;
		const p = this.piece, n = p.size - 1;
		const turned = p.cells.map(([x, y]) => [n - y, x]);
		for (const kick of [0, -1, 1, -2, 2]) {
			if (this.fits(turned, p.x + kick, p.y)) {
				p.cells = turned;
				p.x += kick;
				this.lock = 0;
				this.ctx.audio.play('blip');
				return;
			}
		}
	}

	softDrop() {
		const p = this.piece;
		if (this.fits(p.cells, p.x, p.y + 1)) {
			p.y++;
			this.score += 1;
			this.ctx.score(this.score);
			this.fall = 0;
			return true;
		}
		return false;
	}

	hardDrop() {
		if (!this.running || this.paused) return;
		const p = this.piece;
		let dropped = 0;
		const from = p.y;
		while (this.fits(p.cells, p.x, p.y + 1)) { p.y++; dropped++; }
		this.score += dropped * 2;
		this.ctx.audio.play('thud');
		// a light streak along the drop and a puff where it lands
		const color = PIECES[p.type].color;
		for (const [x, y] of p.cells) {
			const cx = (p.x + x) * C + C / 2;
			for (let k = from + y; k < p.y + y; k += 2) this.fx.particles.burst(cx, k * C + C / 2, { count: 1, color, speed: 10, life: 0.25, shape: 'dot', size: 4, glow: true });
		}
		const bottom = Math.max(...p.cells.map(([, y]) => y)) + p.y;
		this.fx.particles.burst((p.x + 1.5) * C, (bottom + 1) * C, { count: 10, color: '#c7d2fe', speed: 120, angle: -Math.PI / 2, spread: 2.6, life: 0.35, shape: 'dust', size: 3 });
		if (dropped > 4) this.fx.shake.kick(4);
		this.settle();
	}

	ghostY() {
		const p = this.piece;
		let y = p.y;
		while (this.fits(p.cells, p.x, y + 1)) y++;
		return y;
	}

	settle() {
		const p = this.piece;
		for (const [x, y] of p.cells) {
			if (p.y + y < 0) {
				this.ctx.audio.play('crash');
				return this.finish({ win: false, title: 'Stacked out', message: `${this.lines} lines cleared, level ${this.level}.`, score: this.score });
			}
			this.well[p.y + y][p.x + x] = PIECES[p.type].color;
			this.locked.push({ x: p.x + x, y: p.y + y, t: 0.25 });
		}
		const full = [];
		for (let r = 0; r < ROWS; r++) if (this.well[r].every(Boolean)) full.push(r);
		if (full.length) {
			// each cleared row bursts into debris of its own colours
			for (const r of full) for (let c = 0; c < COLS; c++) {
				this.fx.particles.burst(c * C + C / 2, r * C + C / 2, { count: 3, colors: [this.well[r][c], '#ffffff'], speed: 160, life: 0.7, shape: 'square', size: 4, gravity: 420 });
			}
			this.locked = [];
			const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'BLOCK BUSTER!'];
			this.fx.popups.add(`${names[full.length]} +${LINE_POINTS[full.length] * this.level}`, (COLS * C) / 2, full[0] * C, { color: full.length >= 4 ? '#fde047' : '#ffffff', size: full.length >= 4 ? 24 : 18, life: 1.1 });
			if (full.length >= 4) { this.fx.particles.confetti(COLS * C, { count: 60 }); this.fx.shake.kick(7); this.fx.flash.trigger('#fde047', 0.25); }
			else this.fx.shake.kick(2 + full.length);
			for (const r of full) { this.well.splice(r, 1); this.well.unshift(new Array(COLS).fill(null)); }
			this.flash = full.map((r) => ({ r, t: 0.25 }));
			this.lines += full.length;
			this.score += LINE_POINTS[full.length] * this.level;
			const level = this.startLevel + Math.floor(this.lines / 10);
			if (level > this.level) { this.ctx.audio.play('levelup'); this.fx.popups.add(`LEVEL ${level}`, (COLS * C) / 2, H / 2, { color: colors.accent, size: 30, life: 1.4 }); }
			this.level = level;
			this.ctx.audio.play(full.length >= 4 ? 'bonus' : 'score');
			this.info();
		}
		this.ctx.score(this.score);
		this.spawn();
	}

	handleInput({ type, action, repeat }) {
		if (type !== 'down' || repeat) return;
		if (action === 'left') { this.shift(-1); this.repeat.left = 0.17; }
		else if (action === 'right') { this.shift(1); this.repeat.right = 0.17; }
		else if (action === 'down') { this.softDrop(); this.repeat.down = 0.05; }
		else if (action === 'up') this.rotate();
		else if (action === 'action') this.hardDrop();
	}

	update(dt) {
		for (const f of this.flash) f.t -= dt;
		this.flash = this.flash.filter((f) => f.t > 0);
		for (const l of this.locked) l.t -= dt;
		this.locked = this.locked.filter((l) => l.t > 0);
		this.fx.update(dt);
		if (!this.running) return;
		const input = this.ctx.input;
		// auto-repeat for held keys and held touch buttons alike
		for (const [action, dx] of [['left', -1], ['right', 1]]) {
			if (!input.isDown(action)) continue;
			this.repeat[action] -= dt;
			if (this.repeat[action] <= 0) { this.shift(dx); this.repeat[action] = 0.05; }
		}
		if (input.isDown('down')) {
			this.repeat.down -= dt;
			if (this.repeat.down <= 0) { this.softDrop(); this.repeat.down = 0.04; }
		}
		const interval = Math.max(0.05, 0.8 * Math.pow(0.86, this.level - 1));
		this.interval = interval;
		const p = this.piece;
		if (this.fits(p.cells, p.x, p.y + 1)) {
			this.fall += dt;
			if (this.fall >= interval) { this.fall = 0; p.y++; }
		} else {
			this.lock += dt;
			if (this.lock >= 0.5) this.settle();
		}
	}

	cell(g, x, y, color, alpha = 1) {
		g.globalAlpha = alpha;
		fillRound(g, x * C + 1, y * C + 1, C - 2, C - 2, 5, color);
		g.fillStyle = 'rgba(255,255,255,0.22)';
		g.fillRect(x * C + 4, y * C + 3, C - 8, 3);
		g.globalAlpha = 1;
	}

	render() {
		const s = this.surface, g = s.g;
		s.clear(colors.bg);
		const fx = this.fx;
		fx.shake.apply(g);
		g.fillStyle = '#0f1730';
		g.fillRect(0, 0, COLS * C, H);
		g.strokeStyle = 'rgba(255,255,255,0.04)';
		for (let x = 1; x < COLS; x++) { g.beginPath(); g.moveTo(x * C, 0); g.lineTo(x * C, H); g.stroke(); }
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.well[r][c]) this.cell(g, c, r, this.well[r][c]);
		for (const l of this.locked) { g.fillStyle = `rgba(255,255,255,${l.t * 2.4})`; fillRound(g, l.x * C + 1, l.y * C + 1, C - 2, C - 2, 5, `rgba(255,255,255,${l.t * 2.4})`); }
		for (const f of this.flash) { g.fillStyle = `rgba(255,255,255,${f.t * 3})`; g.fillRect(0, f.r * C, COLS * C, C); }
		const p = this.piece;
		if (p) {
			const color = PIECES[p.type].color;
			const gy = this.ghostY();
			for (const [x, y] of p.cells) if (gy + y >= 0) this.cell(g, p.x + x, gy + y, color, 0.18);
			// glide between rows: offset by how far the fall timer has run
			const glide = this.running && this.fits(p.cells, p.x, p.y + 1) ? Math.min(1, this.fall / this.interval) : 0;
			g.save();
			g.translate(0, glide * C * 0.9);
			for (const [x, y] of p.cells) if (p.y + y >= 0) this.cell(g, p.x + x, p.y + y, color);
			g.restore();
		}
		const sx = COLS * C + 16;
		text(g, 'NEXT', sx, 24, { size: 13, color: colors.muted, align: 'left' });
		this.queue.forEach((type, i) => {
			const def = PIECES[type];
			for (const [x, y] of def.cells) fillRound(g, sx + 10 + x * 20, 44 + i * 74 + y * 20, 18, 18, 4, def.color);
		});
		const stats = [['SCORE', this.score], ['LINES', this.lines], ['LEVEL', this.level]];
		stats.forEach(([label, value], i) => {
			text(g, label, sx, 220 + i * 62, { size: 13, color: colors.muted, align: 'left' });
			text(g, String(value), sx, 246 + i * 62, { size: 24, align: 'left' });
		});
		fx.draw(g);
		g.restore();
		fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
