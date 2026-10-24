// Jigsaw: piece together a freshly painted landscape. Every picture is generated, and
// every piece has real tabs and blanks. Drag pieces into the frame; they snap into place
// when they are close. Each piece is rendered to its own small canvas once, so dragging
// stays smooth even with 48 pieces.

import { CanvasGame } from '../kit/canvasGame.js';
import { text, colors } from '../core/canvas.js';

const W = 900, H = 640;
const PW = 520, PH = 360;
const FX = (W - PW) / 2, FY = 24;

function paint(seed) {
	let s = seed;
	const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	const c = document.createElement('canvas');
	c.width = PW; c.height = PH;
	const g = c.getContext('2d');
	const hue = rnd() * 360;
	const sky = g.createLinearGradient(0, 0, 0, PH);
	sky.addColorStop(0, `hsl(${hue} 70% 55%)`);
	sky.addColorStop(0.55, `hsl(${(hue + 40) % 360} 85% 75%)`);
	sky.addColorStop(1, `hsl(${(hue + 70) % 360} 80% 82%)`);
	g.fillStyle = sky;
	g.fillRect(0, 0, PW, PH);
	const sx = 80 + rnd() * 360, sy = 60 + rnd() * 80;
	const sun = g.createRadialGradient(sx, sy, 6, sx, sy, 70);
	sun.addColorStop(0, '#fffbe6'); sun.addColorStop(0.35, '#fde68a'); sun.addColorStop(1, 'rgba(253,230,138,0)');
	g.fillStyle = sun;
	g.fillRect(0, 0, PW, PH);
	for (let i = 0; i < 6; i++) {
		g.fillStyle = 'rgba(255,255,255,0.75)';
		const cx = rnd() * PW, cy = 30 + rnd() * 120;
		for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(cx + k * 18, cy + (k % 2) * 6, 26, 14, 0, 0, Math.PI * 2); g.fill(); }
	}
	for (let layer = 0; layer < 4; layer++) {
		const base = 170 + layer * 45;
		g.fillStyle = `hsl(${(hue + 180 + layer * 15) % 360} ${35 + layer * 10}% ${55 - layer * 11}%)`;
		g.beginPath();
		g.moveTo(0, PH);
		let y = base;
		for (let x = 0; x <= PW; x += 20) { y += (rnd() - 0.5) * (40 - layer * 6); y = Math.max(base - 70, Math.min(base + 30, y)); g.lineTo(x, y); }
		g.lineTo(PW, PH);
		g.fill();
		if (layer >= 2) {
			for (let t = 0; t < 10; t++) {
				const tx = rnd() * PW, ty = base + 10 + rnd() * 40, th = 26 + rnd() * 20;
				g.fillStyle = `hsl(${(hue + 120) % 360} 45% ${18 + layer * 4}%)`;
				g.beginPath(); g.moveTo(tx, ty - th); g.lineTo(tx - th * 0.35, ty); g.lineTo(tx + th * 0.35, ty); g.fill();
			}
		}
	}
	const lake = g.createLinearGradient(0, PH - 60, 0, PH);
	lake.addColorStop(0, `hsla(${(hue + 200) % 360} 70% 60% / 0.85)`);
	lake.addColorStop(1, `hsla(${(hue + 220) % 360} 70% 35% / 0.9)`);
	g.fillStyle = lake;
	g.beginPath(); g.ellipse(PW * (0.3 + rnd() * 0.4), PH - 20, 200, 44, 0, 0, Math.PI * 2); g.fill();
	for (let i = 0; i < 40; i++) { g.fillStyle = `hsl(${rnd() * 360} 90% 65%)`; g.beginPath(); g.arc(rnd() * PW, PH - 40 + rnd() * 36, 2.5, 0, Math.PI * 2); g.fill(); }
	return c;
}

/** Traces one piece outline. `edges` = [top, right, bottom, left], each -1, 0 or 1. */
function outline(g, x, y, w, h, edges) {
	const side = (x0, y0, x1, y1, e) => {
		if (!e) return g.lineTo(x1, y1);
		const dx = x1 - x0, dy = y1 - y0, nx = -dy, ny = dx; // normal points outward for clockwise tracing
		const p = (t, n) => [x0 + dx * t + nx * n * e, y0 + dy * t + ny * n * e];
		g.lineTo(...p(0.36, 0));
		g.bezierCurveTo(...p(0.40, -0.02), ...p(0.30, -0.22), ...p(0.50, -0.24));
		g.bezierCurveTo(...p(0.70, -0.22), ...p(0.60, -0.02), ...p(0.64, 0));
		g.lineTo(x1, y1);
	};
	g.beginPath();
	g.moveTo(x, y);
	side(x, y, x + w, y, edges[0]);
	side(x + w, y, x + w, y + h, edges[1]);
	side(x + w, y + h, x, y + h, edges[2]);
	side(x, y + h, x, y, edges[3]);
	g.closePath();
}

export default class Jigsaw extends CanvasGame {
	static W = W;
	static H = H;
	static realtime = true;

	reset() {
		super.reset();
		const [cols, rows] = { small: [4, 3], medium: [6, 4], large: [8, 6] }[this.ctx.settings.pieces ?? 'medium'] ?? [6, 4];
		this.cols = cols; this.rows = rows;
		this.pw = PW / cols; this.ph = PH / rows;
		this.image = paint(1 + Math.floor(Math.random() * 1e9));
		const hor = [], ver = [];
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { hor.push(Math.random() < 0.5 ? 1 : -1); ver.push(Math.random() < 0.5 ? 1 : -1); }
		const pad = Math.max(this.pw, this.ph) * 0.3;
		this.pad = pad;
		this.pieces = [];
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			// the tab between two pieces is "out" for one and "in" for the other
			const edges = [r === 0 ? 0 : -ver[(r - 1) * cols + c], c === cols - 1 ? 0 : hor[r * cols + c], r === rows - 1 ? 0 : ver[r * cols + c], c === 0 ? 0 : -hor[r * cols + c - 1]];
			const canvas = document.createElement('canvas');
			const scale = 2;
			canvas.width = (this.pw + pad * 2) * scale; canvas.height = (this.ph + pad * 2) * scale;
			const g = canvas.getContext('2d');
			g.scale(scale, scale);
			outline(g, pad, pad, this.pw, this.ph, edges);
			g.save();
			g.clip();
			g.drawImage(this.image, -c * this.pw + pad, -r * this.ph + pad);
			g.restore();
			g.strokeStyle = 'rgba(255,255,255,0.55)';
			g.lineWidth = 1.2;
			g.stroke();
			const hx = FX + c * this.pw, hy = FY + r * this.ph;
			let x, y;
			do { x = 10 + Math.random() * (W - this.pw - 20); y = FY + PH + 20 + Math.random() * (H - FY - PH - this.ph - 30); if (Math.random() < 0.5) { y = 10 + Math.random() * (H - this.ph - 20); x = Math.random() < 0.5 ? 6 + Math.random() * (FX - this.pw - 12) : FX + PW + 6 + Math.random() * (FX - this.pw - 12); } } while (Number.isNaN(x));
			this.pieces.push({ r, c, hx, hy, x, y, canvas, placed: false });
		}
		this.pieces.sort(() => Math.random() - 0.5);
		this.drag = null;
		this.time = 0;
		this.ctx.score(0);
		this.ctx.info(`${cols * rows} pieces`);
	}

	pointerDown(p) {
		if (!this.running) return;
		for (let i = this.pieces.length - 1; i >= 0; i--) {
			const pc = this.pieces[i];
			if (pc.placed) continue;
			if (p.x >= pc.x && p.x <= pc.x + this.pw && p.y >= pc.y && p.y <= pc.y + this.ph) {
				this.pieces.splice(i, 1);
				this.pieces.push(pc);
				this.drag = { pc, dx: p.x - pc.x, dy: p.y - pc.y };
				this.ctx.audio.play('card');
				return;
			}
		}
	}

	pointerMove(p) {
		const d = this.drag;
		if (!d) return;
		d.pc.x = Math.max(-this.pw / 2, Math.min(W - this.pw / 2, p.x - d.dx));
		d.pc.y = Math.max(-this.ph / 2, Math.min(H - this.ph / 2, p.y - d.dy));
	}

	pointerUp() {
		const d = this.drag;
		this.drag = null;
		if (!d || !this.running) return;
		const pc = d.pc;
		if (Math.hypot(pc.x - pc.hx, pc.y - pc.hy) < Math.min(this.pw, this.ph) * 0.3) {
			pc.x = pc.hx; pc.y = pc.hy; pc.placed = true;
			// placed pieces sit under the loose ones
			this.pieces.splice(this.pieces.indexOf(pc), 1);
			this.pieces.unshift(pc);
			this.ctx.audio.play('place');
			this.burst(pc.x + this.pw / 2, pc.y + this.ph / 2, { count: 10, color: colors.accent, speed: 90, life: 0.4, shape: 'star', size: 3 });
			const left = this.pieces.filter((q) => !q.placed).length;
			this.ctx.info(left ? `${left} pieces left` : 'Complete!');
			if (!left) {
				this.ctx.audio.play('win');
				this.ctx.fx.confetti({ count: 90 });
				const t = Math.round(this.time);
				setTimeout(() => this.finish({ win: true, title: 'Picture complete!', message: `${this.cols * this.rows} pieces in ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}.`, score: t, lowerIsBetter: true }), 1200);
			}
		} else this.ctx.audio.play('flip');
	}

	step(dt) {
		this.time += dt;
		this.ctx.score(Math.floor(this.time));
	}

	draw(g) {
		g.fillStyle = '#3b2f2a';
		g.fillRect(0, 0, W, H);
		g.fillStyle = '#2a201c';
		g.fillRect(FX - 6, FY - 6, PW + 12, PH + 12);
		if (this.ctx.settings.ghost !== 'off') { g.globalAlpha = 0.18; g.drawImage(this.image, FX, FY); g.globalAlpha = 1; }
		g.strokeStyle = 'rgba(255,255,255,0.15)';
		g.strokeRect(FX, FY, PW, PH);
		const pad = this.pad;
		for (const pc of this.pieces) {
			const lifted = this.drag?.pc === pc;
			if (lifted) { g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 16; g.shadowOffsetY = 6; }
			g.drawImage(pc.canvas, pc.x - pad, pc.y - pad, this.pw + pad * 2, this.ph + pad * 2);
			if (lifted) g.restore();
		}
		if (!this.pieces.some((q) => !q.placed) && this.image) text(g, 'Complete!', W / 2, FY + PH + 50, { size: 28, color: '#fde68a' });
	}

	teardown() { this.pieces = []; this.image = null; }
}
