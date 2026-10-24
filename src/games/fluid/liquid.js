// Particle liquid for the fluid puzzles: double density relaxation (a particle-based
// SPH approximation: pressure and near-pressure from neighbour density, plus viscosity)
// with a spatial hash, plus collisions against line segments. Cheap enough for ~800
// particles at 60 fps; drawn as overlapping soft blobs on a low-resolution layer so the
// drops merge into a single body of water.

const hit = { nx: 0, ny: 0, depth: 0 };

/** Disc against segment, writing the push-out into the shared `hit` (no allocation). */
function touch(px, py, r, ax, ay, bx, by) {
	const abx = bx - ax, aby = by - ay;
	let t = ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1);
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	const dx = px - (ax + abx * t), dy = py - (ay + aby * t);
	const d2 = dx * dx + dy * dy;
	if (d2 >= r * r || d2 === 0) return false;
	const d = Math.sqrt(d2);
	hit.nx = dx / d; hit.ny = dy / d; hit.depth = r - d;
	return true;
}

export class Liquid {
	constructor(capacity, { radius = 4, width = 640, height = 520, gravity = 900 } = {}) {
		this.capacity = capacity;
		this.radius = radius;
		this.width = width;
		this.height = height;
		this.gravity = { x: 0, y: gravity };
		this.x = new Float32Array(capacity); this.y = new Float32Array(capacity);
		this.vx = new Float32Array(capacity); this.vy = new Float32Array(capacity);
		this.px = new Float32Array(capacity); this.py = new Float32Array(capacity);
		this.alive = new Uint8Array(capacity);
		this.tag = new Uint8Array(capacity); // colour index / user data
		this.count = 0; // high-water mark of used slots
		this.h = radius * 4; // interaction distance
		this.stiffness = 0.25;
		this.nearStiffness = 0.5;
		this.rest = 1.6;
		this.cols = Math.ceil(width / this.h) + 2;
		this.rows = Math.ceil(height / this.h) + 2;
		this.head = new Int32Array(this.cols * this.rows);
		this.next = new Int32Array(capacity);
		this.segments = []; // { ax, ay, bx, by } collision walls
		this.viscosity = 0.05;
		this.layerScale = 0.5;
		this.layer = null;
	}

	clear() { this.alive.fill(0); this.count = 0; }

	add(x, y, vx = 0, vy = 0, tag = 0) {
		let i = -1;
		for (let k = 0; k < this.capacity; k++) if (!this.alive[k]) { i = k; break; }
		if (i < 0) return -1;
		this.alive[i] = 1;
		this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.tag[i] = tag;
		this.count = Math.max(this.count, i + 1);
		return i;
	}

	kill(i) { this.alive[i] = 0; }

	get living() { let n = 0; for (let i = 0; i < this.count; i++) n += this.alive[i]; return n; }

	step(dt, substeps = 2) {
		const h = dt / substeps;
		for (let s = 0; s < substeps; s++) this.substep(h);
	}

	substep(dt) {
		const { x, y, vx, vy, px, py, alive, count, gravity } = this;
		for (let i = 0; i < count; i++) {
			if (!alive[i]) continue;
			vx[i] += gravity.x * dt;
			vy[i] += gravity.y * dt;
			px[i] = x[i]; py[i] = y[i];
			x[i] += vx[i] * dt;
			y[i] += vy[i] * dt;
		}
		this.relax(dt);
		this.collide();
		// velocities from the corrected positions
		const inv = 1 / dt;
		for (let i = 0; i < count; i++) {
			if (!alive[i]) continue;
			vx[i] = (x[i] - px[i]) * inv;
			vy[i] = (y[i] - py[i]) * inv;
			// clamp extreme speeds so a squeeze never explodes
			const sp = vx[i] * vx[i] + vy[i] * vy[i];
			if (sp > 640000) { const k = 800 / Math.sqrt(sp); vx[i] *= k; vy[i] *= k; }
		}
	}

	hash() {
		const { x, y, alive, count, head, next, cols, rows, h } = this;
		head.fill(-1);
		for (let i = 0; i < count; i++) {
			if (!alive[i]) continue;
			const cx = Math.min(cols - 1, Math.max(0, ((x[i] / h) | 0) + 1));
			const cy = Math.min(rows - 1, Math.max(0, ((y[i] / h) | 0) + 1));
			const c = cx + cy * cols;
			next[i] = head[c];
			head[c] = i;
		}
	}

	/**
	 * Double density relaxation (Clavet et al. 2005): each particle measures its density
	 * and near-density from neighbours inside `h`; pressure pushes neighbours apart when
	 * the density is above rest and pulls them together below it, and the near-pressure
	 * stops clumping. Neighbours also blend velocities for viscosity.
	 */
	relax(dt) {
		this.hash();
		const { x, y, vx, vy, alive, count, head, next, cols, rows, h } = this;
		const f = Math.min(2, dt * 60), f2 = f * f * h * 0.5;
		const K = this.stiffness, KN = this.nearStiffness, REST = this.rest, visc = this.viscosity;
		const nb = this.nb ??= new Int32Array(64), nq = this.nq ??= new Float32Array(64);
		for (let i = 0; i < count; i++) {
			if (!alive[i]) continue;
			const cx = Math.min(cols - 1, Math.max(0, ((x[i] / h) | 0) + 1));
			const cy = Math.min(rows - 1, Math.max(0, ((y[i] / h) | 0) + 1));
			let n = 0, rho = 0, near = 0;
			for (let oy = -1; oy <= 1 && n < 64; oy++) {
				const ry = cy + oy;
				if (ry < 0 || ry >= rows) continue;
				for (let ox = -1; ox <= 1 && n < 64; ox++) {
					const rx = cx + ox;
					if (rx < 0 || rx >= cols) continue;
					for (let j = head[rx + ry * cols]; j !== -1 && n < 64; j = next[j]) {
						if (j === i) continue;
						const dx = x[j] - x[i], dy = y[j] - y[i];
						const d2 = dx * dx + dy * dy;
						if (d2 >= h * h) continue;
						const q = 1 - Math.sqrt(d2) / h;
						rho += q * q;
						near += q * q * q;
						nb[n] = j; nq[n] = q; n++;
					}
				}
			}
			const P = K * (rho - REST), PN = KN * near;
			let sx = 0, sy = 0;
			for (let m = 0; m < n; m++) {
				const j = nb[m], q = nq[m];
				let dx = x[j] - x[i], dy = y[j] - y[i];
				const d = Math.hypot(dx, dy) || 1e-3;
				dx /= d; dy /= d;
				const D = f2 * (P * q + PN * q * q);
				x[j] += dx * D * 0.5; y[j] += dy * D * 0.5;
				sx -= dx * D * 0.5; sy -= dy * D * 0.5;
				if (visc > 0 && j > i) {
					// viscosity as a position offset (velocities are rebuilt from positions)
					const mvx = (vx[j] - vx[i]) * visc * q * dt, mvy = (vy[j] - vy[i]) * visc * q * dt;
					sx += mvx; sy += mvy;
					x[j] -= mvx; y[j] -= mvy;
				}
			}
			x[i] += sx; y[i] += sy;
		}
	}

	collide() {
		const { x, y, alive, count, segments, radius } = this;
		for (let i = 0; i < count; i++) {
			if (!alive[i]) continue;
			for (const s of segments) {
				if (s.off) continue;
				// quick reject by bounding box
				if (x[i] < Math.min(s.ax, s.bx) - radius - 8 || x[i] > Math.max(s.ax, s.bx) + radius + 8) continue;
				if (y[i] < Math.min(s.ay, s.by) - radius - 8 || y[i] > Math.max(s.ay, s.by) + radius + 8) continue;
				if (!touch(x[i], y[i], radius + (s.thick ?? 3), s.ax, s.ay, s.bx, s.by)) continue;
				x[i] += hit.nx * hit.depth;
				y[i] += hit.ny * hit.depth;
				// friction along the surface
				const tx = -hit.ny, ty = hit.nx;
				const vt = (x[i] - this.px[i]) * tx + (y[i] - this.py[i]) * ty;
				x[i] -= tx * vt * 0.04;
				y[i] -= ty * vt * 0.04;
			}
			if (x[i] < radius) x[i] = radius;
			if (x[i] > this.width - radius) x[i] = this.width - radius;
			if (y[i] < radius) y[i] = radius;
		}
	}

	/** Draws the liquid onto `g` (logical units). `colors` maps tag → CSS colour. */
	draw(g, colors = ['#3b82f6']) {
		if (!this.layer) {
			this.layer = document.createElement('canvas');
			this.layer.width = Math.ceil(this.width * this.layerScale);
			this.layer.height = Math.ceil(this.height * this.layerScale);
			this.lg = this.layer.getContext('2d');
		}
		const lg = this.lg, s = this.layerScale, r = this.radius * 2.1 * s;
		lg.clearRect(0, 0, this.layer.width, this.layer.height);
		for (let c = 0; c < colors.length; c++) {
			lg.fillStyle = colors[c];
			lg.beginPath();
			for (let i = 0; i < this.count; i++) {
				if (!this.alive[i] || this.tag[i] !== c) continue;
				const X = this.x[i] * s, Y = this.y[i] * s;
				lg.moveTo(X + r, Y);
				lg.arc(X, Y, r, 0, Math.PI * 2);
			}
			lg.fill();
		}
		g.save();
		g.imageSmoothingEnabled = true;
		g.globalAlpha = 0.92;
		g.drawImage(this.layer, 0, 0, this.width, this.height);
		// highlights on the fastest drops
		g.globalAlpha = 0.5;
		g.globalCompositeOperation = 'lighter';
		g.fillStyle = 'rgba(200,230,255,0.5)';
		g.beginPath();
		for (let i = 0; i < this.count; i++) {
			if (!this.alive[i]) continue;
			if (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] < 40000) continue;
			g.rect(this.x[i] - 1, this.y[i] - 1, 2, 2);
		}
		g.fill();
		g.restore();
	}
}
