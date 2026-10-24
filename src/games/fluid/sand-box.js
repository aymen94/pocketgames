// Sand Box: paint sand, water, stone, fire, wood, oil, plants, acid and lava and watch
// them interact. Flip gravity, change the brush, pause, or clear the box.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { Powder, M, MATERIALS } from './powder.js';
import { qualityLevel } from '../../services/graphics.js';

const W = 800, H = 500;
const SIZES = { ultralow: [120, 75], low: [160, 100], medium: [200, 125], high: [260, 162], ultra: [320, 200] };
const PALETTE = [M.SAND, M.WATER, M.STONE, M.WOOD, M.FIRE, M.OIL, M.PLANT, M.ACID, M.LAVA, M.EMPTY];

export default class SandBox extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.material = M.SAND;
		this.brush = 4;
		this.frozen = false;
		const hexOf = (c) => `rgb(${c.join(',')})`;
		this.picker = tool.choice(PALETTE.map((m) => [String(m), m === M.EMPTY ? 'Eraser' : MATERIALS[m].name]), String(this.material), (v) => { this.material = +v; });
		// colour chips on the material buttons
		for (const b of this.picker.el.querySelectorAll('button')) {
			const m = +b.dataset.value;
			if (m !== M.EMPTY) b.style.boxShadow = `inset 0 -3px 0 ${hexOf(MATERIALS[m].color)}`;
		}
		this.gravityBtn = tool.button('Gravity ↓', () => {
			this.sim.gravity *= -1;
			this.gravityBtn.textContent = this.sim.gravity > 0 ? 'Gravity ↓' : 'Gravity ↑';
			this.ctx.audio.play('swoosh');
		});
		this.pauseBtn = tool.button('Pause', () => {
			this.frozen = !this.frozen;
			this.pauseBtn.textContent = this.frozen ? 'Resume' : 'Pause';
			this.pauseBtn.setAttribute('aria-pressed', String(this.frozen));
		}, { pressed: false });
		return tool.bar(
			this.picker.el,
			tool.range('Brush', { min: 1, max: 12, step: 1, value: this.brush, format: (v) => String(v) }, (v) => { this.brush = v; }),
			tool.group(this.gravityBtn, this.pauseBtn, tool.button('Clear', () => this.sim.clear()), tool.button('Demo', () => this.demo())),
		);
	}

	setup() {
		const [w, h] = SIZES[qualityLevel()] ?? SIZES.medium;
		this.sim = new Powder(w, h);
		this.cell = W / w;
		this.buffer = document.createElement('canvas');
		this.buffer.width = w;
		this.buffer.height = h;
		this.bg = this.buffer.getContext('2d');
		this.time = 0;
	}

	reset() {
		super.reset();
		this.sim.clear();
		this.sim.gravity = 1;
		if (this.gravityBtn) this.gravityBtn.textContent = 'Gravity ↓';
		this.demo();
		this.ctx.info('Paint with the mouse or a finger');
	}

	/** A starter scene: a wooden shelf, a pool, a sand pile and a lava pocket. */
	demo() {
		const s = this.sim, { w, h } = s;
		s.clear();
		for (let x = 0; x < w; x++) for (let y = h - 4; y < h; y++) s.set(x, y, M.STONE);
		for (let x = Math.floor(w * 0.1); x < w * 0.42; x++) for (let y = Math.floor(h * 0.45); y < h * 0.45 + 3; y++) s.set(x, y, M.WOOD);
		for (let x = Math.floor(w * 0.55); x < w * 0.95; x++) for (let y = Math.floor(h * 0.75); y < h - 4; y++) s.set(x, y, M.WATER);
		for (let y = Math.floor(h * 0.6); y < h - 4; y++) s.set(Math.floor(w * 0.55) - 1, y, M.STONE);
		for (let x = Math.floor(w * 0.15); x < w * 0.35; x++) for (let y = Math.floor(h * 0.3); y < h * 0.45; y++) if (Math.random() < 0.8) s.set(x, y, M.SAND);
		for (let x = Math.floor(w * 0.6); x < w * 0.7; x++) s.set(x, Math.floor(h * 0.74), M.PLANT);
	}

	pointerDown(p) { this.last = { x: p.x / this.cell, y: p.y / this.cell }; this.paintLine(this.last, this.last); }
	pointerMove(p) {
		if (!p.down || !this.last) return;
		const q = { x: p.x / this.cell, y: p.y / this.cell };
		this.paintLine(this.last, q);
		this.last = q;
	}
	pointerUp() { this.last = null; }

	paintLine(a, b) {
		const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
		const m = this.material;
		const solid = m === M.STONE || m === M.WOOD || m === M.PLANT || m === M.EMPTY;
		for (let i = 0; i <= steps; i++) {
			const x = a.x + ((b.x - a.x) * i) / steps, y = a.y + ((b.y - a.y) * i) / steps;
			this.sim.paint(x, y, this.brush, m, { replace: m === M.EMPTY || m === M.FIRE ? true : solid, chance: solid ? 1 : 0.35 });
		}
	}

	tick(dt) {
		this.time += dt;
		// keep painting while the pointer is held still
		if (this.pointer.down && this.last && this.running && this.material !== M.STONE && this.material !== M.WOOD) this.paintLine(this.last, this.last);
		if (!this.frozen && this.running && !this.paused) this.sim.step();
	}

	draw(g) {
		this.bg.putImageData(this.sim.paintImage(this.time), 0, 0);
		g.imageSmoothingEnabled = false;
		g.drawImage(this.buffer, 0, 0, W, H);
		// brush outline
		const p = this.pointer;
		g.strokeStyle = 'rgba(255,255,255,0.5)';
		g.lineWidth = 1.5;
		g.beginPath();
		g.arc(p.x, p.y, this.brush * this.cell, 0, Math.PI * 2);
		g.stroke();
		const c = this.sim.counts;
		this.ctx.info(`Sand ${c[M.SAND]} · Water ${c[M.WATER]} · Fire ${c[M.FIRE]}${this.frozen ? ' · paused' : ''}`);
	}
}
