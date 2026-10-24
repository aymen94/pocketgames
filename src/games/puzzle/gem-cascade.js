// Gem Cascade: swap two neighbouring gems to line up three or more of a kind. Matches
// clear, the gems above fall and cascades score more. A line of four makes a line-blaster
// gem, five a colour bomb. Reach the target score before the moves run out.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { ease } from '../core/fx.js';

const N = 8, CELL = 62, W = N * CELL + 40, H = N * CELL + 110;
const OX = 20, OY = 90;
const GEMS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];
const SHAPES = ['diamond', 'circle', 'square', 'tri', 'hex', 'star'];

export default class GemCascade extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.level = 0;
		this.score = 0;
		this.ctx.score(0);
		this.newLevel();
	}

	newLevel() {
		this.target = 1500 + this.level * 1200;
		this.movesLeft = 25;
		this.levelScore = 0;
		this.board = [];
		for (let r = 0; r < N; r++) {
			const row = [];
			for (let c = 0; c < N; c++) {
				let t;
				do { t = Math.floor(Math.random() * GEMS.length); } while ((c >= 2 && row[c - 1].t === t && row[c - 2].t === t) || (r >= 2 && this.board[r - 1][c].t === t && this.board[r - 2][c].t === t));
				row.push({ t, special: null, y: r - N - 1, scale: 1 });
			}
			this.board.push(row);
		}
		if (!this.hasMove()) return this.newLevel();
		this.selected = null;
		this.phase = 'fall';
		this.combo = 0;
		this.info();
		this.wake();
	}

	info() { this.ctx.info(`Level ${this.level + 1} · ${this.levelScore}/${this.target} · ${this.movesLeft} moves`); }

	findMatches() {
		const hit = new Set(), groups = [];
		for (const horizontal of [true, false]) {
			for (let a = 0; a < N; a++) {
				let run = [];
				for (let b = 0; b <= N; b++) {
					const r = horizontal ? a : b, c = horizontal ? b : a;
					const cell = b < N ? this.board[r][c] : null;
					if (cell && run.length && cell.t === this.board[run[0][0]][run[0][1]].t && cell.t >= 0) run.push([r, c]);
					else {
						if (run.length >= 3) { groups.push(run); for (const [rr, cc] of run) hit.add(rr * N + cc); }
						run = cell && cell.t >= 0 ? [[r, c]] : [];
					}
				}
			}
		}
		return { hit, groups };
	}

	hasMove() {
		for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
			const r2 = r + dr, c2 = c + dc;
			if (r2 >= N || c2 >= N) continue;
			this.swapCells(r, c, r2, c2);
			const ok = this.findMatches().hit.size > 0;
			this.swapCells(r, c, r2, c2);
			if (ok) return true;
		}
		return false;
	}

	swapCells(r1, c1, r2, c2) {
		const t = this.board[r1][c1];
		this.board[r1][c1] = this.board[r2][c2];
		this.board[r2][c2] = t;
	}

	at(p) {
		const c = Math.floor((p.x - OX) / CELL), r = Math.floor((p.y - OY) / CELL);
		return r >= 0 && r < N && c >= 0 && c < N ? [r, c] : null;
	}

	pointerDown(p) {
		if (!this.running || this.phase !== 'idle') return;
		const cell = this.at(p);
		if (!cell) return;
		this.dragFrom = { cell, x: p.x, y: p.y };
		if (this.selected && Math.abs(this.selected[0] - cell[0]) + Math.abs(this.selected[1] - cell[1]) === 1) {
			this.trySwap(this.selected, cell);
			this.dragFrom = null;
			return;
		}
		this.selected = cell;
		this.ctx.audio.play('select');
	}

	pointerMove(p) {
		const d = this.dragFrom;
		if (!d || this.phase !== 'idle') return;
		const dx = p.x - d.x, dy = p.y - d.y;
		if (Math.hypot(dx, dy) < CELL * 0.4) return;
		const [r, c] = d.cell;
		const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
		this.dragFrom = null;
		if (to[0] >= 0 && to[0] < N && to[1] >= 0 && to[1] < N) this.trySwap(d.cell, to);
	}

	pointerUp() { this.dragFrom = null; }

	trySwap(a, b) {
		this.selected = null;
		this.swapAnim = { a, b, t: 0, back: false };
		this.phase = 'swap';
		this.ctx.audio.play('swoosh');
	}

	busy() { return this.phase !== 'idle' || this.board.some((row) => row.some((g) => g.scale !== 1)); }

	tick(dt) {
		if (this.phase === 'swap') {
			const s = this.swapAnim;
			s.t += dt / 0.16;
			if (s.t < 1) return;
			const [[r1, c1], [r2, c2]] = [s.a, s.b];
			this.swapCells(r1, c1, r2, c2);
			const bombs = [this.board[r1][c1], this.board[r2][c2]].filter((g) => g.special === 'bomb');
			if (s.back) { this.phase = 'idle'; return; }
			if (bombs.length) {
				// a colour bomb clears every gem of the colour it was swapped with
				const other = bombs[0] === this.board[r1][c1] ? this.board[r2][c2] : this.board[r1][c1];
				const kill = new Set();
				for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (this.board[r][c].t === other.t || this.board[r][c] === bombs[0]) kill.add(r * N + c);
				this.movesLeft--;
				this.combo = 0;
				this.ctx.audio.play('blast');
				this.fx.flash.trigger('#ffffff', 0.4);
				this.clear(kill, []);
				return;
			}
			if (!this.findMatches().hit.size) {
				// no match: animate back; the board swaps back when that animation ends
				this.ctx.audio.play('error');
				this.swapAnim = { a: s.a, b: s.b, t: 0, back: true };
				return;
			}
			this.movesLeft--;
			this.combo = 0;
			this.lastSwap = s.b;
			this.resolve();
		} else if (this.phase === 'clear') {
			this.clearT -= dt;
			for (const row of this.board) for (const g of row) if (g.dying) g.scale = Math.max(0, g.scale - dt * 6);
			if (this.clearT <= 0) this.collapse();
		} else if (this.phase === 'fall') {
			let moving = false;
			this.board.forEach((row, r) => row.forEach((g) => {
				if (g.y < r) { g.v = (g.v ?? 0) + dt * 40; g.y = Math.min(r, g.y + g.v * dt); moving = true; } else g.v = 0;
			}));
			if (!moving) this.resolve();
		} else {
			for (const row of this.board) for (const g of row) if (g.scale !== 1 && !g.dying) g.scale = Math.min(1, g.scale + dt * 5);
		}
	}

	resolve() {
		const { hit, groups } = this.findMatches();
		if (!hit.size) return this.settle();
		this.combo++;
		const spawn = [];
		for (const group of groups) {
			if (group.length >= 4) {
				const pick = group.find(([r, c]) => this.lastSwap && this.lastSwap[0] === r && this.lastSwap[1] === c) ?? group[1];
				spawn.push({ at: pick, t: this.board[pick[0]][pick[1]].t, special: group.length >= 5 ? 'bomb' : group[0][0] === group[1][0] ? 'row' : 'col' });
			}
		}
		// specials caught in a match fire along their line
		const extra = [...hit];
		for (let i = 0; i < extra.length; i++) {
			const r = Math.floor(extra[i] / N), c = extra[i] % N, g = this.board[r][c];
			if (g.special === 'row' || g.special === 'col') {
				const dir = g.special;
				g.special = null;
				this.ctx.audio.play('zap');
				for (let k = 0; k < N; k++) {
					const id = dir === 'row' ? r * N + k : k * N + c;
					if (!hit.has(id)) { hit.add(id); extra.push(id); }
				}
			}
		}
		this.clear(hit, spawn);
	}

	clear(hit, spawn) {
		const gained = hit.size * 20 * this.combo || hit.size * 20;
		this.score += gained;
		this.levelScore += gained;
		this.ctx.score(this.score);
		this.ctx.audio.play('stack', this.combo * 3);
		let sx = 0, sy = 0;
		for (const id of hit) {
			const r = Math.floor(id / N), c = id % N, g = this.board[r][c];
			g.dying = true;
			sx += c; sy += r;
			this.burst(OX + (c + 0.5) * CELL, OY + (r + 0.5) * CELL, { count: 6, color: GEMS[g.t] ?? '#fff', speed: 130, life: 0.45, size: 3, shape: 'square' });
		}
		this.popup(`+${gained}`, OX + (sx / hit.size + 0.5) * CELL, OY + (sy / hit.size + 0.5) * CELL, { color: '#fde047', size: 18 + Math.min(14, this.combo * 3) });
		if (this.combo > 1) this.fx.shake.kick(2 + this.combo);
		this.spawn = spawn;
		this.phase = 'clear';
		this.clearT = 0.18;
		this.info();
	}

	collapse() {
		for (const s of this.spawn) {
			const g = this.board[s.at[0]][s.at[1]];
			Object.assign(g, { t: s.t, special: s.special, dying: false, scale: 0.2 });
		}
		for (let c = 0; c < N; c++) {
			const keep = [];
			for (let r = N - 1; r >= 0; r--) if (!this.board[r][c].dying) keep.push(this.board[r][c]);
			let missing = 0;
			for (let r = N - 1; r >= 0; r--) {
				const g = keep.shift();
				if (g) { this.board[r][c] = g; }
				else { missing++; this.board[r][c] = { t: Math.floor(Math.random() * GEMS.length), special: null, y: -missing, scale: 1 }; }
			}
		}
		this.board.forEach((row, r) => row.forEach((g) => { if (g.y === undefined || g.y > r) g.y = r; }));
		this.phase = 'fall';
	}

	settle() {
		this.phase = 'idle';
		this.lastSwap = null;
		if (this.levelScore >= this.target) {
			this.ctx.audio.play('levelup');
			this.ctx.fx.confetti({ count: 60 });
			this.ctx.fx.banner(`Level ${this.level + 2}`);
			this.score += this.movesLeft * 50;
			this.ctx.score(this.score);
			this.level++;
			this.phase = 'wait';
			setTimeout(() => { if (this.running) this.newLevel(); }, 900);
			return;
		}
		if (this.movesLeft <= 0) {
			this.ctx.audio.play('lose');
			return this.finish({ win: this.level > 0, title: 'Out of moves', message: `You reached level ${this.level + 1}.`, score: this.score });
		}
		if (!this.hasMove()) {
			this.ctx.fx.banner('No moves: reshuffling');
			const all = this.board.flat().sort(() => Math.random() - 0.5);
			this.board = Array.from({ length: N }, (_, r) => all.slice(r * N, r * N + N).map((g) => Object.assign(g, { y: r })));
			if (this.findMatches().hit.size) return this.resolve();
			if (!this.hasMove()) return this.newLevel();
		}
		this.info();
	}

	drawGem(g, gem, x, y, size) {
		const s = size * (gem.scale ?? 1);
		if (s <= 0.5) return;
		const color = GEMS[gem.t] ?? '#fff';
		g.save();
		g.translate(x, y);
		if (gem.special === 'bomb') {
			const grad = g.createRadialGradient(-s * 0.1, -s * 0.1, 2, 0, 0, s * 0.42);
			grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#a5b4fc'); grad.addColorStop(1, '#312e81');
			g.fillStyle = grad;
			g.beginPath(); g.arc(0, 0, s * 0.4, 0, Math.PI * 2); g.fill();
			g.restore();
			return;
		}
		g.fillStyle = color;
		g.beginPath();
		const shape = SHAPES[gem.t], R = s * 0.38;
		if (shape === 'circle') g.arc(0, 0, R, 0, Math.PI * 2);
		else if (shape === 'square') g.roundRect(-R * 0.85, -R * 0.85, R * 1.7, R * 1.7, 6);
		else {
			const pts = shape === 'diamond' ? 4 : shape === 'tri' ? 3 : shape === 'hex' ? 6 : 10;
			for (let i = 0; i < pts; i++) {
				const a = -Math.PI / 2 + (i / pts) * Math.PI * 2, rr = shape === 'star' && i % 2 ? R * 0.5 : R * (shape === 'tri' ? 1.1 : 1);
				g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr + (shape === 'tri' ? R * 0.15 : 0));
			}
			g.closePath();
		}
		g.fill();
		g.fillStyle = 'rgba(255,255,255,0.35)';
		g.beginPath(); g.ellipse(-R * 0.25, -R * 0.35, R * 0.35, R * 0.18, -0.5, 0, Math.PI * 2); g.fill();
		if (gem.special === 'row' || gem.special === 'col') {
			g.strokeStyle = '#fff';
			g.lineWidth = 3;
			g.beginPath();
			if (gem.special === 'row') { g.moveTo(-R, 0); g.lineTo(R, 0); } else { g.moveTo(0, -R); g.lineTo(0, R); }
			g.stroke();
		}
		g.restore();
	}

	draw(g) {
		g.fillStyle = '#1e1b4b';
		g.fillRect(0, 0, W, H);
		const progress = Math.min(1, this.levelScore / this.target);
		fillRound(g, 20, 20, W - 40, 18, 9, '#312e81');
		fillRound(g, 20, 20, (W - 40) * progress, 18, 9, colors.accent);
		text(g, `Level ${this.level + 1}  ·  ${this.levelScore} / ${this.target}`, W / 2, 29, { size: 12 });
		text(g, `${this.movesLeft} moves`, W / 2, 62, { size: 18, color: this.movesLeft <= 5 ? '#fca5a5' : '#e0e7ff' });
		g.save();
		g.beginPath(); g.rect(OX, OY, N * CELL, N * CELL); g.clip();
		for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) fillRound(g, OX + c * CELL + 2, OY + r * CELL + 2, CELL - 4, CELL - 4, 10, (r + c) % 2 ? '#27245a' : '#2e2a66');
		if (this.selected) fillRound(g, OX + this.selected[1] * CELL + 2, OY + this.selected[0] * CELL + 2, CELL - 4, CELL - 4, 10, 'rgba(255,255,255,0.22)');
		const s = this.phase === 'swap' ? this.swapAnim : null;
		const k = s ? ease.inOutCubic(Math.min(1, s.t)) : 0;
		this.board.forEach((row, r) => row.forEach((gem, c) => {
			let x = c, y = gem.y ?? r;
			if (s && s.a[0] === r && s.a[1] === c) { x += (s.b[1] - c) * k; y += (s.b[0] - r) * k; }
			else if (s && s.b[0] === r && s.b[1] === c) { x += (s.a[1] - c) * k; y += (s.a[0] - r) * k; }
			this.drawGem(g, gem, OX + (x + 0.5) * CELL, OY + (y + 0.5) * CELL, CELL);
		}));
		g.restore();
	}
}
