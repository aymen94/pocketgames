// Fluid Playground: an interactive stable-fluids sandbox. Drag to stir coloured dye into
// the flow, draw walls, drop spinning vortices and directional jets, and tune force,
// viscosity, fade and swirl. Tracer particles ride the velocity field on top of the dye.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { FluidGrid } from './solver.js';
import { qualityProfile, onGraphicsChange } from '../../services/graphics.js';

const W = 800, H = 500;
const GRIDS = { low: [96, 60, 10], medium: [144, 90, 16], high: [200, 125, 22] };
const COLORS = ['#ff4d6d', '#ffb703', '#4cc9f0', '#80ffdb', '#b388ff', '#ffffff'];
const hex = (c) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
const hsl = (h) => {
	const f = (n) => { const k = (n + h * 12) % 12; return 0.5 - 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
	return [f(0), f(8), f(4)];
};

export default class FluidPlayground extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.mode = 'paint';
		this.color = 'rainbow';
		this.force = 1;
		this.modes = tool.choice([['paint', 'Stir'], ['wall', 'Wall'], ['erase', 'Erase'], ['vortex', 'Vortex'], ['jet', 'Jet']], this.mode, (m) => { this.mode = m; });
		this.swatch = tool.swatches(COLORS, null, (c) => { this.color = c; this.rainbow.setAttribute('aria-pressed', 'false'); });
		this.rainbow = tool.button('Rainbow', () => { this.color = 'rainbow'; this.swatch.set(null); this.rainbow.setAttribute('aria-pressed', 'true'); }, { pressed: true });
		this.pauseBtn = tool.button('Pause', () => this.togglePause(), { pressed: false });
		return tool.bar(
			this.modes.el,
			tool.group(this.rainbow, this.swatch.el),
			tool.range('Force', { min: 0.3, max: 3, step: 0.1, value: 1, format: (v) => `${v.toFixed(1)}×` }, (v) => { this.force = v; }),
			tool.range('Viscosity', { min: 0, max: 1, step: 0.01, value: 0, format: (v) => v.toFixed(2) }, (v) => { this.grid.viscosity = v * v * 0.6; }),
			tool.range('Fade', { min: 0, max: 1, step: 0.01, value: 0.25, format: (v) => v.toFixed(2) }, (v) => { this.grid.fade = v; }),
			tool.range('Swirl', { min: 0, max: 30, step: 1, value: 8, format: (v) => String(v) }, (v) => { this.grid.vorticity = v; }),
			tool.group(this.pauseBtn, tool.button('Clear dye', () => this.grid.clearDye()), tool.button('Reset', () => this.resetWorld())),
		);
	}

	setup() {
		this.configure();
		// 'Match graphics' follows the quality setting live; the tank restarts at the new detail
		this.unsubscribeQuality = onGraphicsChange(() => {
			if (this.ctx.settings.quality === 'auto') this.configure();
		});
	}

	teardown() {
		this.unsubscribeQuality?.();
	}

	/** (Re)builds the grid and tracers for the quality and tracer settings. */
	configure() {
		this.configKey = `${this.ctx.settings.quality}:${this.ctx.settings.tracers}`;
		const quality = this.ctx.settings.quality === 'auto' ? qualityProfile().fluid : this.ctx.settings.quality;
		const [nx, ny, iterations] = GRIDS[quality] ?? GRIDS.medium;
		this.grid = new FluidGrid(nx, ny, { iterations });
		this.cell = W / nx;
		this.image = new ImageData(nx, ny);
		this.buffer = document.createElement('canvas');
		this.buffer.width = nx;
		this.buffer.height = ny;
		this.bg = this.buffer.getContext('2d');
		this.glow = document.createElement('canvas');
		this.glow.width = Math.ceil(nx / 4);
		this.glow.height = Math.ceil(ny / 4);
		this.glowG = this.glow.getContext('2d');
		const count = { few: 600, normal: 1800, many: 4000 }[this.ctx.settings.tracers] ?? 1800;
		this.tracers = new Float32Array(Math.round(count * Math.max(0.5, qualityProfile().particles)) * 3);
		this.seedTracers();
		this.hue = 0;
		this.frozen = false;
		this.resetWorld();
	}

	seedTracers() {
		const t = this.tracers;
		for (let i = 0; i < t.length; i += 3) {
			t[i] = Math.random() * this.grid.nx;
			t[i + 1] = Math.random() * this.grid.ny;
			t[i + 2] = Math.random();
		}
	}

	resetWorld() {
		const g = this.grid;
		g.clearDye();
		g.clearFlow();
		g.clearSolids();
		this.vortices = [];
		this.jets = [];
		// a starter scene: two jets facing each other and a pillar
		const { nx, ny } = g;
		this.jets.push({ x: nx * 0.08, y: ny * 0.35, dx: 1, dy: 0.15, color: hex('#4cc9f0') });
		this.jets.push({ x: nx * 0.92, y: ny * 0.65, dx: -1, dy: -0.15, color: hex('#ff4d6d') });
		g.paintSolid(nx * 0.5, ny * 0.5, ny * 0.09);
		this.seedTracers();
	}

	reset() {
		super.reset();
		if (this.configKey !== `${this.ctx.settings.quality}:${this.ctx.settings.tracers}`) this.configure();
		this.ctx.info('Drag to stir the fluid');
	}

	start() {
		super.start();
		this.frozen = false;
		this.pauseBtn.setAttribute('aria-pressed', 'false');
	}

	togglePause() {
		this.frozen = !this.frozen;
		this.pauseBtn.setAttribute('aria-pressed', String(this.frozen));
		this.pauseBtn.textContent = this.frozen ? 'Resume' : 'Pause';
	}

	toGrid(p) { return { x: p.x / this.cell, y: p.y / this.cell }; }

	dyeColor() {
		if (this.color !== 'rainbow') return hex(this.color);
		return hsl(this.hue);
	}

	pointerDown(p) {
		const q = this.toGrid(p);
		this.last = q;
		if (this.mode === 'vortex') {
			const near = this.vortices.findIndex((v) => Math.hypot(v.x - q.x, v.y - q.y) < 5);
			if (near >= 0) this.vortices.splice(near, 1);
			else this.vortices.push({ x: q.x, y: q.y, dir: this.pointer.button === 2 ? -1 : 1, spin: 0 });
			this.ctx.audio.play('pop');
		} else if (this.mode === 'jet') {
			this.jetStart = q;
		} else this.paintAt(q, q);
	}

	pointerMove(p) {
		if (!p.down || !this.last) return;
		const q = this.toGrid(p);
		if (this.mode === 'paint' || this.mode === 'wall' || this.mode === 'erase') this.paintAt(this.last, q);
		this.last = q;
	}

	pointerUp(p) {
		const q = this.toGrid(p);
		if (this.mode === 'jet' && this.jetStart) {
			const dx = q.x - this.jetStart.x, dy = q.y - this.jetStart.y;
			const len = Math.hypot(dx, dy);
			if (len > 2) {
				if (this.jets.length >= 6) this.jets.shift();
				this.jets.push({ x: this.jetStart.x, y: this.jetStart.y, dx: dx / len, dy: dy / len, color: this.dyeColor() });
				this.ctx.audio.play('swoosh');
			} else {
				// a click on a jet removes it
				const near = this.jets.findIndex((j) => Math.hypot(j.x - q.x, j.y - q.y) < 5);
				if (near >= 0) this.jets.splice(near, 1);
			}
		}
		this.jetStart = null;
		this.last = null;
	}

	paintAt(a, b) {
		const g = this.grid;
		const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
		const radius = Math.max(2.2, g.ny * 0.035);
		for (let s = 1; s <= steps; s++) {
			const x = a.x + ((b.x - a.x) * s) / steps, y = a.y + ((b.y - a.y) * s) / steps;
			if (this.mode === 'wall') g.paintSolid(x, y, radius * 0.8, 1);
			else if (this.mode === 'erase') g.paintSolid(x, y, radius * 1.4, 0);
		}
		if (this.mode === 'paint') {
			const dx = b.x - a.x, dy = b.y - a.y;
			const k = 38 * this.force;
			g.splat(b.x, b.y, radius, dx * k, dy * k, this.dyeColor(), 1.6 * this.force);
			if (dx === 0 && dy === 0) g.splat(b.x, b.y, radius * 1.3, 0, 0, this.dyeColor(), 1.2);
		}
	}

	tick(dt) {
		if (this.frozen || !this.grid) return;
		this.hue = (this.hue + dt * 0.12) % 1;
		const g = this.grid;
		for (const j of this.jets) g.splat(j.x + j.dx * 1.5, j.y + j.dy * 1.5, 2, j.dx * 160 * this.force * dt * 5, j.dy * 160 * this.force * dt * 5, j.color, 3 * dt * 5);
		for (const v of this.vortices) { v.spin += dt * v.dir * 4; g.swirl(v.x, v.y, g.ny * 0.16, 60 * v.dir * dt * this.force); }
		g.step(Math.min(dt, 1 / 30));
		// tracers ride the flow; ones that stall or hit a wall respawn
		const t = this.tracers;
		for (let i = 0; i < t.length; i += 3) {
			const x = t[i], y = t[i + 1];
			const u = g.sample(g.u, x, y), v = g.sample(g.v, x, y);
			t[i] = x + u * dt;
			t[i + 1] = y + v * dt;
			t[i + 2] -= dt * 0.25;
			if (t[i + 2] <= 0 || !g.inside(t[i], t[i + 1]) || g.solid[g.index(t[i], t[i + 1])]) {
				t[i] = Math.random() * g.nx;
				t[i + 1] = Math.random() * g.ny;
				t[i + 2] = 0.6 + Math.random() * 0.4;
			}
		}
	}

	draw(g) {
		const grid = this.grid;
		const { nx, ny, sx, r, g: gr, b, solid } = grid;
		const data = this.image.data;
		for (let j = 0; j < ny; j++) {
			for (let i = 0; i < nx; i++) {
				const k = i + 1 + (j + 1) * sx;
				const o = (i + j * nx) * 4;
				if (solid[k]) { data[o] = 46; data[o + 1] = 54; data[o + 2] = 92; data[o + 3] = 255; continue; }
				// soft saturation: dense dye glows toward white instead of clipping
				const rr = 1 - Math.exp(-r[k] * 1.4), gg = 1 - Math.exp(-gr[k] * 1.4), bb = 1 - Math.exp(-b[k] * 1.4);
				const lift = Math.max(0, (rr + gg + bb) / 3 - 0.75) * 120;
				data[o] = 8 + rr * 240 + lift;
				data[o + 1] = 10 + gg * 240 + lift;
				data[o + 2] = 22 + bb * 240 + lift;
				data[o + 3] = 255;
			}
		}
		this.bg.putImageData(this.image, 0, 0);
		g.imageSmoothingEnabled = true;
		g.imageSmoothingQuality = 'high';
		g.drawImage(this.buffer, 0, 0, W, H);
		if (qualityProfile().bloom || this.ctx.settings.quality === 'high') {
			// glow: the dye downsampled to a tiny canvas and stretched back additively, a
			// cheap blur that costs two drawImage calls
			this.glowG.drawImage(this.buffer, 0, 0, this.glow.width, this.glow.height);
			g.save();
			g.globalCompositeOperation = 'lighter';
			g.globalAlpha = 0.32;
			g.drawImage(this.glow, 0, 0, W, H);
			g.restore();
		}
		// tracers: two batched paths (bright and dim), no per-particle state changes
		const t = this.tracers, c = this.cell;
		g.save();
		g.globalCompositeOperation = 'lighter';
		for (const [min, max, alpha] of [[0.1, 0.5, 0.25], [0.5, 9, 0.55]]) {
			g.beginPath();
			for (let i = 0; i < t.length; i += 3) {
				const a = t[i + 2];
				if (a >= min && a < max) g.rect(t[i] * c, t[i + 1] * c, 1.6, 1.6);
			}
			g.fillStyle = `rgba(255,255,255,${alpha})`;
			g.fill();
		}
		g.restore();
		// jets and vortices
		for (const j of this.jets) {
			const x = j.x * c, y = j.y * c;
			g.save();
			g.translate(x, y);
			g.rotate(Math.atan2(j.dy, j.dx));
			g.fillStyle = `rgb(${j.color.map((v) => Math.round(v * 255)).join(',')})`;
			g.strokeStyle = 'rgba(255,255,255,0.85)';
			g.lineWidth = 2;
			g.beginPath();
			g.moveTo(-10, -8); g.lineTo(10, -4); g.lineTo(10, 4); g.lineTo(-10, 8); g.closePath();
			g.fill(); g.stroke();
			g.restore();
		}
		for (const v of this.vortices) {
			const x = v.x * c, y = v.y * c;
			g.save();
			g.translate(x, y);
			g.rotate(v.spin);
			g.strokeStyle = 'rgba(255,255,255,0.8)';
			g.lineWidth = 2;
			for (let a = 0; a < 3; a++) {
				g.beginPath();
				g.arc(0, 0, 12, (a * Math.PI * 2) / 3, (a * Math.PI * 2) / 3 + 1.4);
				g.stroke();
			}
			g.restore();
		}
		if (this.jetStart && this.pointer.down) {
			g.strokeStyle = 'rgba(255,255,255,0.8)';
			g.setLineDash([6, 6]);
			g.lineWidth = 2;
			g.beginPath();
			g.moveTo(this.jetStart.x * c, this.jetStart.y * c);
			g.lineTo(this.pointer.x, this.pointer.y);
			g.stroke();
			g.setLineDash([]);
		}
		if (this.frozen) {
			g.fillStyle = 'rgba(0,0,0,0.35)';
			g.fillRect(W - 96, 10, 86, 26);
			g.fillStyle = '#fff';
			g.font = '800 13px system-ui';
			g.textAlign = 'center';
			g.textBaseline = 'middle';
			g.fillText('PAUSED', W - 53, 23);
		}
	}
}
