// Life Lab: a cellular-automaton laboratory. Paint cells, stamp classic patterns, switch
// between rule sets (Life, HighLife, Day & Night, Seeds, Maze) and watch them evolve. In
// Challenge mode you get a small budget of cells: place them so the colony is as big as
// possible after 200 generations. The grid is two Uint8Arrays drawn through ImageData.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { text, colors } from '../core/canvas.js';
import { qualityProfile } from '../../services/graphics.js';

const W = 800, H = 520;
const RULES = {
	life: { name: 'Life', born: [3], survive: [2, 3] },
	highlife: { name: 'HighLife', born: [3, 6], survive: [2, 3] },
	daynight: { name: 'Day & Night', born: [3, 6, 7, 8], survive: [3, 4, 6, 7, 8] },
	seeds: { name: 'Seeds', born: [2], survive: [] },
	maze: { name: 'Maze', born: [3], survive: [1, 2, 3, 4, 5] },
};
const PATTERNS = {
	glider: ['.O.', '..O', 'OOO'],
	spaceship: ['.O..O', 'O....', 'O...O', 'OOOO.'],
	pulsar: ['..OOO...OOO..', '.............', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '..OOO...OOO..', '.............', '..OOO...OOO..', 'O....O.O....O', 'O....O.O....O', 'O....O.O....O', '.............', '..OOO...OOO..'],
	gun: ['........................O...........', '......................O.O...........', '............OO......OO............OO', '...........O...O....OO............OO', 'OO........O.....O...OO..............', 'OO........O...O.OO....O.O...........', '..........O.....O.......O...........', '...........O...O....................', '............OO......................'],
	acorn: ['.O.....', '...O...', 'OO..OOO'],
};
// targets checked by simulation: one R-pentomino (5 cells) gives 120, two give 347, acorn + R-pentomino (12) 321, three R-pentominoes (15) 414
const CHALLENGES = [{ budget: 6, target: 60 }, { budget: 10, target: 200 }, { budget: 12, target: 280 }, { budget: 15, target: 380 }, { budget: 16, target: 400 }];
const GENS = 200;

export default class LifeLab extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.ruleChoice = tool.choice(Object.entries(RULES).map(([k, r]) => [k, r.name]), 'life', (v) => { this.rule = v; this.compileRule(); });
		this.toolChoice = tool.choice([['draw', 'Draw'], ['erase', 'Erase'], ...Object.keys(PATTERNS).map((k) => [k, k[0].toUpperCase() + k.slice(1)])], 'draw', (v) => { this.tool = v; });
		this.playBtn = tool.button('Run', () => this.toggleRun(), { primary: true });
		return tool.bar(this.playBtn, tool.button('Step', () => this.stepOnce()), tool.button('Random', () => this.randomize()), tool.button('Clear', () => this.clear()), this.ruleChoice.el, this.toolChoice.el, tool.range('Speed', { min: 2, max: 60, step: 1, value: 15, format: (v) => `${v}/s` }, (v) => { this.speed = v; }));
	}

	setup() {
		const q = qualityProfile();
		this.cell = q.detail < 0.8 ? 8 : 5;
		this.cols = Math.floor(W / this.cell);
		this.rows = Math.floor(H / this.cell);
		this.a = new Uint8Array(this.cols * this.rows);
		this.b = new Uint8Array(this.cols * this.rows);
		this.age = new Uint8Array(this.cols * this.rows);
		this.img = new ImageData(this.cols, this.rows);
		this.off = document.createElement('canvas');
		this.off.width = this.cols;
		this.off.height = this.rows;
		this.offG = this.off.getContext('2d');
		this.speed = 15;
		this.tool = 'draw';
		this.rule = 'life';
		this.compileRule();
	}

	compileRule() {
		const r = RULES[this.rule];
		this.born = new Uint8Array(9); this.keep = new Uint8Array(9);
		for (const n of r.born) this.born[n] = 1;
		for (const n of r.survive) this.keep[n] = 1;
	}

	challenge() { return this.ctx.settings.mode === 'challenge'; }

	reset() {
		super.reset();
		this.a.fill(0); this.age.fill(0);
		this.gen = 0;
		this.acc = 0;
		this.level = 0;
		this.totalScore = 0;
		this.ctx.score(0);
		if (this.challenge()) this.startChallenge();
		else { this.running0 = false; this.randomize(0.18, true); this.ctx.info('Paint cells, stamp patterns, press Run'); }
		this.updateButtons();
	}

	startChallenge() {
		const c = CHALLENGES[this.level];
		this.a.fill(0); this.age.fill(0);
		this.gen = 0;
		this.budget = c.budget;
		this.running0 = false;
		this.rule = 'life';
		this.ruleChoice.set('life');
		this.compileRule();
		this.tool = 'draw';
		this.toolChoice.set('draw');
		this.ctx.info(`Challenge ${this.level + 1}/${CHALLENGES.length}: place ${c.budget} cells, reach ${c.target} alive after ${GENS} generations`);
	}

	updateButtons() { this.playBtn.textContent = this.running0 ? 'Pause' : 'Run'; }

	toggleRun() {
		if (!this.running) return;
		this.running0 = !this.running0;
		this.updateButtons();
		this.ctx.audio.play('click');
	}

	population() { let n = 0; for (let i = 0; i < this.a.length; i++) n += this.a[i]; return n; }

	randomize(density = 0.2, quiet = false) {
		if (this.challenge()) return;
		for (let i = 0; i < this.a.length; i++) { this.a[i] = Math.random() < density ? 1 : 0; this.age[i] = 0; }
		this.gen = 0;
		if (!quiet) this.ctx.audio.play('swoosh');
	}

	clear() {
		if (this.challenge()) return this.startChallenge();
		this.a.fill(0); this.age.fill(0);
		this.gen = 0;
		this.running0 = false;
		this.updateButtons();
	}

	stepOnce() {
		const { cols, rows, a, b, born, keep, age } = this;
		for (let y = 0; y < rows; y++) {
			const up = ((y - 1 + rows) % rows) * cols, mid = y * cols, down = ((y + 1) % rows) * cols;
			for (let x = 0; x < cols; x++) {
				const l = (x - 1 + cols) % cols, r = (x + 1) % cols;
				const n = a[up + l] + a[up + x] + a[up + r] + a[mid + l] + a[mid + r] + a[down + l] + a[down + x] + a[down + r];
				const i = mid + x;
				const alive = a[i] ? keep[n] : born[n];
				b[i] = alive;
				age[i] = alive ? Math.min(255, age[i] + 1) : 0;
			}
		}
		this.a = b; this.b = a;
		this.gen++;
		if (this.challenge() && this.gen >= GENS) this.judge();
	}

	judge() {
		this.running0 = false;
		this.updateButtons();
		const pop = this.population(), c = CHALLENGES[this.level];
		const ok = pop >= c.target;
		this.totalScore += pop;
		this.ctx.score(this.totalScore);
		this.ctx.audio.play(ok ? 'levelup' : 'lose');
		this.ctx.fx.banner(`${pop} alive · target ${c.target}`);
		if (!ok) return setTimeout(() => this.finish({ win: this.level > 0, title: 'Colony too small', message: `${pop} cells alive after ${GENS} generations (needed ${c.target}).`, score: this.totalScore }), 1200);
		this.level++;
		if (this.level >= CHALLENGES.length) { this.ctx.fx.confetti({ count: 80 }); return setTimeout(() => this.finish({ win: true, title: 'Master of Life!', message: 'Every challenge beaten.', score: this.totalScore }), 1200); }
		setTimeout(() => { if (this.running) this.startChallenge(); }, 1500);
	}

	paint(p) {
		const cx = Math.floor(p.x / this.cell), cy = Math.floor(p.y / this.cell);
		if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
		const i = cy * this.cols + cx;
		if (this.challenge()) {
			if (this.gen > 0 || this.running0) return;
			if (this.a[i]) { this.a[i] = 0; this.budget++; return; }
			if (this.budget <= 0) return this.ctx.audio.play('error');
			this.a[i] = 1; this.budget--;
			this.ctx.audio.play('tick');
			return;
		}
		if (this.tool === 'draw' || this.tool === 'erase') {
			for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
				const x = (cx + dx + this.cols) % this.cols, y = (cy + dy + this.rows) % this.rows;
				this.a[y * this.cols + x] = this.tool === 'draw' ? 1 : 0;
			}
			return;
		}
		const pat = PATTERNS[this.tool];
		pat.forEach((row, ry) => [...row].forEach((ch, rx) => {
			const x = (cx + rx) % this.cols, y = (cy + ry) % this.rows;
			this.a[y * this.cols + x] = ch === 'O' ? 1 : 0;
		}));
		this.ctx.audio.play('place');
	}

	pointerDown(p) { if (this.running) this.paint(p); }
	pointerMove(p) { if (this.running && this.pointer.down && (this.tool === 'draw' || this.tool === 'erase') && !this.challenge()) this.paint(p); }

	key(action) { if (action === 'action') this.toggleRun(); }

	step(dt) {
		if (!this.running0) return;
		this.acc += dt * this.speed;
		let n = 0;
		while (this.acc >= 1 && n < 4) { this.acc -= 1; this.stepOnce(); n++; }
		if (this.acc > 4) this.acc = 0;
		if (!this.challenge()) this.ctx.score(this.gen);
	}

	draw(g) {
		const { cols, rows, a, age, img } = this;
		const data = img.data;
		const accent = colors.accent;
		const ar = parseInt(accent.slice(1, 3), 16) || 79, ag = parseInt(accent.slice(3, 5), 16) || 140, ab = parseInt(accent.slice(5, 7), 16) || 255;
		for (let i = 0, p = 0; i < cols * rows; i++, p += 4) {
			if (a[i]) {
				// young cells are bright, old ones settle into the theme colour
				const k = Math.min(1, age[i] / 30);
				data[p] = 255 * (1 - k) + ar * k; data[p + 1] = 240 * (1 - k) + ag * k; data[p + 2] = 160 * (1 - k) + ab * k; data[p + 3] = 255;
			} else { data[p] = 8; data[p + 1] = 12; data[p + 2] = 24; data[p + 3] = 255; }
		}
		this.offG.putImageData(img, 0, 0);
		g.imageSmoothingEnabled = false;
		g.drawImage(this.off, 0, 0, cols * this.cell, rows * this.cell);
		g.imageSmoothingEnabled = true;
		if (this.cell >= 5) {
			g.strokeStyle = 'rgba(255,255,255,0.035)';
			g.lineWidth = 1;
			g.beginPath();
			for (let x = 0; x <= cols; x += 5) { g.moveTo(x * this.cell, 0); g.lineTo(x * this.cell, rows * this.cell); }
			for (let y = 0; y <= rows; y += 5) { g.moveTo(0, y * this.cell); g.lineTo(cols * this.cell, y * this.cell); }
			g.stroke();
		}
		const pop = this.population();
		const label = this.challenge() ? `Gen ${this.gen}/${GENS} · alive ${pop} · target ${CHALLENGES[this.level]?.target ?? '-'} · cells left ${this.budget}` : `${RULES[this.rule].name} · gen ${this.gen} · alive ${pop}`;
		g.fillStyle = 'rgba(0,0,0,0.55)';
		g.fillRect(0, H - 26, W, 26);
		text(g, label, 10, H - 13, { size: 13, align: 'left', color: '#e2e8f0' });
		if (this.challenge() && this.gen === 0 && !this.running0) text(g, 'Click to place cells, then press Run (Space)', W - 10, H - 13, { size: 13, align: 'right', color: '#fde68a' });
	}
}
