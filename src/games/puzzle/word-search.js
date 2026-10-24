// Word Search: find the hidden words in a grid of letters. Words run in any of eight
// directions; drag from the first letter to the last to circle one. Beat the clock.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { WORDS } from './balloon-words.js';

const W = 600, H = 700;
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
const MARK = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee', '#a3e635', '#f97316', '#e879f9'];

export function buildGrid(size, words, dirs) {
	for (let attempt = 0; attempt < 50; attempt++) {
		const grid = Array.from({ length: size }, () => Array(size).fill(''));
		const placed = [];
		let ok = true;
		for (const word of words) {
			let done = false;
			for (let t = 0; t < 300 && !done; t++) {
				const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
				const r = Math.floor(Math.random() * size), c = Math.floor(Math.random() * size);
				const er = r + dr * (word.length - 1), ec = c + dc * (word.length - 1);
				if (er < 0 || er >= size || ec < 0 || ec >= size) continue;
				let fits = true;
				for (let i = 0; i < word.length; i++) {
					const cell = grid[r + dr * i][c + dc * i];
					if (cell && cell !== word[i]) { fits = false; break; }
				}
				if (!fits) continue;
				for (let i = 0; i < word.length; i++) grid[r + dr * i][c + dc * i] = word[i];
				placed.push({ word, r, c, er, ec, found: false });
				done = true;
			}
			if (!done) { ok = false; break; }
		}
		if (!ok) continue;
		const abc = 'ABCDEFGHIJKLMNOPRSTUW';
		for (const row of grid) for (let c = 0; c < size; c++) if (!row[c]) row[c] = abc[Math.floor(Math.random() * abc.length)];
		return { grid, placed };
	}
	return null;
}

export default class WordSearch extends CanvasGame {
	static W = W;
	static H = H;
	static realtime = true;

	reset() {
		super.reset();
		const d = this.ctx.settings.difficulty ?? 'normal';
		this.size = d === 'easy' ? 9 : d === 'hard' ? 13 : 11;
		const count = d === 'easy' ? 6 : d === 'hard' ? 10 : 8;
		const dirs = d === 'easy' ? DIRS.slice(0, 3) : DIRS;
		const cats = Object.keys(WORDS);
		this.category = cats[Math.floor(Math.random() * cats.length)];
		const pool = WORDS[this.category].filter((w) => w.length <= this.size).sort(() => Math.random() - 0.5).slice(0, count);
		const built = buildGrid(this.size, pool.sort((a, b) => b.length - a.length), dirs) ?? buildGrid(this.size, pool.slice(0, 4), DIRS.slice(0, 2));
		this.grid = built.grid;
		this.words = built.placed;
		this.cell = Math.floor(560 / this.size);
		this.ox = (W - this.cell * this.size) / 2;
		this.oy = 20;
		this.sel = null;
		this.time = 0;
		this.ctx.score(0);
		this.ctx.info(`Theme: ${this.category}`);
	}

	at(p) {
		const c = Math.floor((p.x - this.ox) / this.cell), r = Math.floor((p.y - this.oy) / this.cell);
		return r >= 0 && r < this.size && c >= 0 && c < this.size ? { r, c } : null;
	}

	pointerDown(p) {
		if (!this.running) return;
		const a = this.at(p);
		if (a) this.sel = { a, b: a };
	}

	pointerMove(p) {
		if (!this.sel) return;
		const b = this.at(p);
		if (!b) return;
		// snap to the nearest of the eight directions
		const dr = b.r - this.sel.a.r, dc = b.c - this.sel.a.c;
		const len = Math.max(Math.abs(dr), Math.abs(dc));
		if (!len) { this.sel.b = this.sel.a; return; }
		const ang = Math.round(Math.atan2(dr, dc) / (Math.PI / 4)) * (Math.PI / 4);
		const sr = Math.round(Math.sin(ang)), sc = Math.round(Math.cos(ang));
		let r = this.sel.a.r + sr * len, c = this.sel.a.c + sc * len;
		while (r < 0 || r >= this.size || c < 0 || c >= this.size) { r -= sr; c -= sc; }
		this.sel.b = { r, c };
	}

	pointerUp() {
		const s = this.sel;
		this.sel = null;
		if (!s || !this.running) return;
		const hit = this.words.find((w) => !w.found && ((w.r === s.a.r && w.c === s.a.c && w.er === s.b.r && w.ec === s.b.c) || (w.er === s.a.r && w.ec === s.a.c && w.r === s.b.r && w.c === s.b.c)));
		if (!hit) { if (s.a.r !== s.b.r || s.a.c !== s.b.c) this.ctx.audio.play('error'); return; }
		hit.found = true;
		hit.color = MARK[this.words.filter((w) => w.found).length % MARK.length];
		this.ctx.audio.play('score');
		const mx = this.ox + ((hit.c + hit.ec) / 2 + 0.5) * this.cell, my = this.oy + ((hit.r + hit.er) / 2 + 0.5) * this.cell;
		this.burst(mx, my, { count: 20, color: hit.color, speed: 160, life: 0.6, shape: 'star', size: 4 });
		const left = this.words.filter((w) => !w.found).length;
		if (!left) {
			this.ctx.audio.play('win');
			this.ctx.fx.confetti({ count: 70 });
			const t = Math.round(this.time);
			setTimeout(() => this.finish({ win: true, title: 'All words found!', message: `Found ${this.words.length} words in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}.`, score: t, lowerIsBetter: true }), 800);
		}
	}

	step(dt) {
		this.time += dt;
		this.ctx.score(Math.floor(this.time));
	}

	draw(g) {
		g.fillStyle = '#fefce8';
		g.fillRect(0, 0, W, H);
		const { cell, ox, oy, size } = this;
		fillRound(g, ox - 8, oy - 8, cell * size + 16, cell * size + 16, 14, '#fff');
		const stroke = (a, b, color, alpha) => {
			g.save();
			g.globalAlpha = alpha;
			g.strokeStyle = color;
			g.lineCap = 'round';
			g.lineWidth = cell * 0.78;
			g.beginPath();
			g.moveTo(ox + (a.c + 0.5) * cell, oy + (a.r + 0.5) * cell);
			g.lineTo(ox + (b.c + 0.5) * cell, oy + (b.r + 0.5) * cell);
			g.stroke();
			g.restore();
		};
		for (const w of this.words) if (w.found) stroke({ r: w.r, c: w.c }, { r: w.er, c: w.ec }, w.color, 0.45);
		if (this.sel) stroke(this.sel.a, this.sel.b, colors.accent, 0.5);
		for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) text(g, this.grid[r][c], ox + (c + 0.5) * cell, oy + (r + 0.5) * cell + 1, { size: cell * 0.55, color: '#1c1917' });
		// the word list
		const listY = oy + cell * size + 26;
		const cols = 3, colW = (W - 40) / cols;
		this.words.forEach((w, i) => {
			const x = 20 + (i % cols) * colW + colW / 2, y = listY + Math.floor(i / cols) * 26;
			text(g, w.word, x, y, { size: 16, color: w.found ? '#a8a29e' : '#1c1917' });
			if (w.found) { g.strokeStyle = w.color; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w.word.length * 5.5, y); g.lineTo(x + w.word.length * 5.5, y); g.stroke(); }
		});
	}
}
