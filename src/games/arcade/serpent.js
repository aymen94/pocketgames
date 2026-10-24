// Serpent: the classic snake game on a 20 × 20 grid. The body glides between cells
// (interpolated from the previous step), fruit pops with sparks, and a crash scatters
// the segments.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, glow, colors } from '../core/canvas.js';
import { CanvasFx, ease } from '../core/fx.js';

const N = 20;
const CELL = 24;
const SPEEDS = { slow: 7, normal: 9.5, fast: 13 };
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const FRUIT = ['#fbbf24', '#fb7185', '#a3e635', '#f472b6'];

export default class Serpent extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, N * CELL, N * CELL);
		this.fx = new CanvasFx(300);
		this.ctx.input.swipe(this.surface.canvas, (dir) => this.turn(dir));
		this.reset();
	}

	reset() {
		this.running = false;
		const mid = Math.floor(N / 2);
		this.snake = [[mid, mid], [mid - 1, mid], [mid - 2, mid]];
		this.prev = this.snake.map(([x, y]) => [x, y]);
		this.dir = 'right';
		this.queue = [];
		this.timer = 0;
		this.score = 0;
		this.rate = SPEEDS[this.ctx.settings.speed] ?? SPEEDS.normal;
		this.time = 0;
		this.dead = null;
		this.grow = 0;
		this.fx.clear();
		this.placeFood();
		this.ctx.score(0);
	}

	placeFood() {
		const taken = new Set(this.snake.map(([x, y]) => x + y * N));
		let spot;
		do spot = Math.floor(Math.random() * N * N); while (taken.has(spot));
		this.food = { x: spot % N, y: Math.floor(spot / N), born: this.time, color: FRUIT[Math.floor(Math.random() * FRUIT.length)] };
	}

	turn(dir) {
		if (!this.running || this.paused) return;
		const last = this.queue.at(-1) ?? this.dir;
		const [dx, dy] = DIRS[dir], [lx, ly] = DIRS[last];
		if ((dx === -lx && dy === -ly) || dir === last) return;
		if (this.queue.length < 3) this.queue.push(dir);
	}

	handleInput({ type, action }) {
		if (type === 'down' && DIRS[action]) this.turn(action);
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		if (this.grow > 0) this.grow = Math.max(0, this.grow - dt * 3);
		if (!this.running) return;
		this.timer += dt;
		const step = 1 / this.rate;
		while (this.timer >= step && this.running) {
			this.timer -= step;
			this.advance();
		}
	}

	advance() {
		if (this.queue.length) this.dir = this.queue.shift();
		const [dx, dy] = DIRS[this.dir];
		let [x, y] = this.snake[0];
		x += dx; y += dy;
		if (this.ctx.settings.walls === 'solid') {
			if (x < 0 || y < 0 || x >= N || y >= N) return this.die();
		} else {
			x = (x + N) % N;
			y = (y + N) % N;
		}
		const eating = x === this.food.x && y === this.food.y;
		// the tail moves away this step unless we grow, so it is not an obstacle
		const body = eating ? this.snake : this.snake.slice(0, -1);
		if (body.some(([bx, by]) => bx === x && by === y)) return this.die();
		this.prev = this.snake.map(([px, py]) => [px, py]);
		this.snake.unshift([x, y]);
		if (eating) {
			// the new tail segment starts where the old tail was
			this.prev.push(this.prev.at(-1));
			this.eat();
			if (this.snake.length === N * N) return this.finish({ win: true, title: 'Perfect!', message: 'You filled the whole board.', score: this.score });
			this.placeFood();
		} else {
			this.snake.pop();
		}
	}

	eat() {
		const { x, y, color } = this.food;
		const cx = x * CELL + CELL / 2, cy = y * CELL + CELL / 2;
		this.score += 10;
		this.ctx.score(this.score);
		this.ctx.audio.play('coin');
		this.rate = Math.min(this.rate + 0.15, 22);
		this.grow = 1;
		this.fx.particles.burst(cx, cy, { count: 16, colors: [color, '#ffffff'], speed: 170, life: 0.5, size: 3, shape: 'spark', glow: true });
		this.fx.particles.ring(cx, cy, { color, radius: 30 });
		this.fx.popups.add('+10', cx, cy - 10, { color, size: 16 });
	}

	die() {
		this.ctx.audio.play('crash');
		this.dead = this.snake[0];
		const t = this.timer * this.rate;
		this.snake.forEach(([sx, sy], i) => {
			if (i % 2) return;
			const p = this.segmentPos(i, t);
			this.fx.particles.burst(p.x, p.y, { count: 3, colors: [this.segmentColor(i), '#ffffff'], speed: 180, life: 0.8, size: 5, shape: 'square', gravity: 300, drag: 1 });
		});
		this.fx.shake.kick(9);
		this.fx.flash.trigger('#fb7185', 0.35);
		this.finish({ win: false, message: `Your serpent grew to ${this.snake.length} segments.`, score: this.score });
	}

	segmentColor(i) {
		const t = i / Math.max(1, this.snake.length - 1);
		return `hsl(${160 - t * 30} 70% ${62 - t * 22}%)`;
	}

	/** Pixel centre of segment i, interpolated `t` (0..1) of the way from its previous cell. */
	segmentPos(i, t) {
		const [x, y] = this.snake[i];
		const [px, py] = this.prev[i] ?? this.snake[i];
		// wrapping through an edge: no interpolation across the board
		const k = Math.abs(x - px) > 1 || Math.abs(y - py) > 1 ? 1 : t;
		return { x: (px + (x - px) * k) * CELL + CELL / 2, y: (py + (y - py) * k) * CELL + CELL / 2 };
	}

	render() {
		const s = this.surface, g = s.g;
		const fx = this.fx;
		s.clear(colors.bg);
		fx.shake.apply(g);
		// checkerboard with a slow diagonal shimmer
		for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
			const wave = Math.sin(this.time * 1.5 - (x + y) * 0.35) * 0.5 + 0.5;
			g.fillStyle = (x + y) % 2 === 0 ? `rgba(30, 45, 90, ${0.35 + wave * 0.15})` : `rgba(20, 30, 64, ${0.25 + wave * 0.1})`;
			g.fillRect(x * CELL, y * CELL, CELL, CELL);
		}
		if (this.ctx.settings.walls === 'solid') {
			g.strokeStyle = colors.accent3;
			g.lineWidth = 3;
			g.strokeRect(1.5, 1.5, N * CELL - 3, N * CELL - 3);
		}
		// fruit: springs in when placed, then pulses
		const f = this.food;
		const age = Math.max(0, Math.min(1, (this.time - f.born) / 0.35));
		const pulse = ease.outBack(age) * (1 + Math.sin(this.time * 6) * 0.08);
		const fx0 = f.x * CELL + CELL / 2, fy0 = f.y * CELL + CELL / 2;
		glow(g, fx0, fy0, CELL * 1.3, `${f.color}66`);
		circle(g, fx0, fy0, CELL * 0.36 * pulse, f.color);
		circle(g, fx0 - 3, fy0 - 4, CELL * 0.1 * pulse, 'rgba(255,255,255,0.7)');

		const t = this.running ? Math.min(1, this.timer * this.rate) : 1;
		const len = this.snake.length;
		if (!this.dead) {
			// a soft glow under the body, then the segments from tail to head
			const head = this.segmentPos(0, t);
			glow(g, head.x, head.y, CELL * 1.6, 'rgba(52, 211, 153, 0.25)');
			for (let i = len - 1; i >= 0; i--) {
				const p = this.segmentPos(i, t);
				const bulge = i === 0 ? 1 + this.grow * 0.25 : 1 - (i / len) * 0.25;
				const size = (CELL - 4) * bulge;
				fillRound(g, p.x - size / 2, p.y - size / 2, size, size, 7, this.segmentColor(i));
			}
			const [dx, dy] = DIRS[this.dir];
			for (const side of [-1, 1]) {
				const ex = head.x + dx * 4 + -dy * side * 5, ey = head.y + dy * 4 + dx * side * 5;
				circle(g, ex, ey, 3.2, '#fff');
				circle(g, ex + dx * 1.2, ey + dy * 1.2, 1.6, '#0b1020');
			}
		}
		fx.draw(g);
		g.restore();
		fx.flash.draw(g, s.width, s.height);
	}

	dispose() {
		this.surface.dispose();
	}
}
