// A stable-fluids solver (semi-Lagrangian advection, Jacobi pressure projection) on a
// collocated grid with solid cells, vorticity confinement and three dye channels.
// Unconditionally stable, so it stays smooth at any frame rate; the grid size and the
// number of pressure iterations are the quality knobs. All fields are Float32Arrays
// allocated once; a step allocates nothing.
//
// Units: one grid cell is 1; velocities are cells per second.

export class FluidGrid {
	constructor(nx, ny, { iterations = 18 } = {}) {
		this.nx = nx;
		this.ny = ny;
		this.sx = nx + 2;
		this.iterations = iterations;
		const n = (nx + 2) * (ny + 2);
		this.size = n;
		const f = () => new Float32Array(n);
		this.u = f(); this.v = f(); this.u0 = f(); this.v0 = f();
		this.r = f(); this.g = f(); this.b = f(); this.tmp = f();
		this.p = f(); this.div = f(); this.curl = f();
		this.solid = new Uint8Array(n);
		this.viscosity = 0;
		this.diffusion = 0;
		this.fade = 0.25; // dye lost per second (fraction)
		this.vorticity = 8;
		this.walls();
	}

	/** Marks the outer border solid. */
	walls() {
		const { nx, ny, sx, solid } = this;
		for (let i = 0; i < nx + 2; i++) { solid[i] = 1; solid[i + (ny + 1) * sx] = 1; }
		for (let j = 0; j < ny + 2; j++) { solid[j * sx] = 1; solid[nx + 1 + j * sx] = 1; }
	}

	clearDye() { this.r.fill(0); this.g.fill(0); this.b.fill(0); }
	clearFlow() { this.u.fill(0); this.v.fill(0); this.p.fill(0); }
	clearSolids() { this.solid.fill(0); this.walls(); }

	index(x, y) { return (Math.floor(x) + 1) + (Math.floor(y) + 1) * this.sx; }
	inside(x, y) { return x >= 0 && y >= 0 && x < this.nx && y < this.ny; }

	/** Sets a disc of cells solid (or clears it), in grid units. */
	paintSolid(cx, cy, radius, value = 1) {
		const { nx, ny, sx, solid } = this;
		const r2 = radius * radius;
		for (let j = Math.max(0, Math.floor(cy - radius)); j <= Math.min(ny - 1, Math.ceil(cy + radius)); j++) {
			for (let i = Math.max(0, Math.floor(cx - radius)); i <= Math.min(nx - 1, Math.ceil(cx + radius)); i++) {
				const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
				if (dx * dx + dy * dy > r2) continue;
				const k = i + 1 + (j + 1) * sx;
				solid[k] = value;
				if (value) { this.u[k] = this.v[k] = this.r[k] = this.g[k] = this.b[k] = 0; }
			}
		}
	}

	/** Adds velocity (du, dv) and dye (rgb 0..1 × amount) in a soft disc around (cx, cy). */
	splat(cx, cy, radius, du, dv, rgb = null, amount = 1) {
		const { nx, ny, sx, solid } = this;
		const r2 = radius * radius;
		const reach = radius * 2;
		for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(ny - 1, Math.ceil(cy + reach)); j++) {
			for (let i = Math.max(0, Math.floor(cx - reach)); i <= Math.min(nx - 1, Math.ceil(cx + reach)); i++) {
				const k = i + 1 + (j + 1) * sx;
				if (solid[k]) continue;
				const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
				const w = Math.exp(-(dx * dx + dy * dy) / r2);
				if (w < 0.01) continue;
				this.u[k] += du * w;
				this.v[k] += dv * w;
				if (rgb) {
					this.r[k] += rgb[0] * amount * w;
					this.g[k] += rgb[1] * amount * w;
					this.b[k] += rgb[2] * amount * w;
				}
			}
		}
	}

	/** Adds a swirl around (cx, cy): tangential velocity falling off with distance. */
	swirl(cx, cy, radius, strength) {
		const { nx, ny, sx, solid } = this;
		for (let j = Math.max(0, Math.floor(cy - radius)); j <= Math.min(ny - 1, Math.ceil(cy + radius)); j++) {
			for (let i = Math.max(0, Math.floor(cx - radius)); i <= Math.min(nx - 1, Math.ceil(cx + radius)); i++) {
				const k = i + 1 + (j + 1) * sx;
				if (solid[k]) continue;
				const dx = i + 0.5 - cx, dy = j + 0.5 - cy;
				const d = Math.hypot(dx, dy);
				if (d > radius || d < 0.5) continue;
				const w = (1 - d / radius) * strength / d;
				this.u[k] += -dy * w;
				this.v[k] += dx * w;
			}
		}
	}

	/** Bilinear sample of field `f` at grid position (x, y) (cell centres at i + 0.5). */
	sample(f, x, y) {
		const { nx, ny, sx } = this;
		x = Math.min(Math.max(x - 0.5, 0), nx - 1.001);
		y = Math.min(Math.max(y - 0.5, 0), ny - 1.001);
		const i = x | 0, j = y | 0, s = x - i, t = y - j;
		const k = i + 1 + (j + 1) * sx;
		return (f[k] * (1 - s) + f[k + 1] * s) * (1 - t) + (f[k + sx] * (1 - s) + f[k + sx + 1] * s) * t;
	}

	step(dt) {
		this.confine(dt);
		if (this.viscosity > 0) {
			this.diffuse(this.u, this.u0, this.viscosity * dt);
			this.diffuse(this.v, this.v0, this.viscosity * dt);
		}
		this.project();
		this.u0.set(this.u);
		this.v0.set(this.v);
		this.advect(this.u, this.u0, dt);
		this.advect(this.v, this.v0, dt);
		this.zeroSolids(this.u);
		this.zeroSolids(this.v);
		this.project();
		const keep = Math.max(0, 1 - this.fade * dt);
		for (const d of [this.r, this.g, this.b]) {
			if (this.diffusion > 0) this.diffuse(d, this.tmp, this.diffusion * dt);
			this.tmp.set(d);
			this.advect(d, this.tmp, dt);
			if (keep < 1) for (let k = 0; k < this.size; k++) d[k] *= keep;
			this.zeroSolids(d);
		}
	}

	zeroSolids(f) {
		const s = this.solid;
		for (let k = 0; k < this.size; k++) if (s[k]) f[k] = 0;
	}

	advect(d, d0, dt) {
		const { nx, ny, sx, u, v, solid } = this;
		for (let j = 1; j <= ny; j++) {
			for (let i = 1; i <= nx; i++) {
				const k = i + j * sx;
				if (solid[k]) continue;
				// trace back from the cell centre (grid position i - 0.5, j - 0.5)
				d[k] = this.sample(d0, i - 0.5 - dt * u[k], j - 0.5 - dt * v[k]);
			}
		}
	}

	diffuse(x, x0, amount) {
		const { nx, ny, sx, solid } = this;
		x0.set(x);
		const a = amount * 40;
		const denom = 1 + 4 * a;
		for (let it = 0; it < 6; it++) {
			for (let j = 1; j <= ny; j++) {
				for (let i = 1; i <= nx; i++) {
					const k = i + j * sx;
					if (solid[k]) continue;
					const c = x[k];
					const l = solid[k - 1] ? c : x[k - 1], rr = solid[k + 1] ? c : x[k + 1];
					const t = solid[k - sx] ? c : x[k - sx], b = solid[k + sx] ? c : x[k + sx];
					x[k] = (x0[k] + a * (l + rr + t + b)) / denom;
				}
			}
		}
	}

	project() {
		const { nx, ny, sx, u, v, p, div, solid } = this;
		for (let j = 1; j <= ny; j++) {
			for (let i = 1; i <= nx; i++) {
				const k = i + j * sx;
				if (solid[k]) { div[k] = 0; continue; }
				// solid neighbours contribute zero normal velocity
				const ul = solid[k - 1] ? 0 : u[k - 1], ur = solid[k + 1] ? 0 : u[k + 1];
				const vt = solid[k - sx] ? 0 : v[k - sx], vb = solid[k + sx] ? 0 : v[k + sx];
				div[k] = -0.5 * (ur - ul + vb - vt);
			}
		}
		for (let it = 0; it < this.iterations; it++) {
			for (let j = 1; j <= ny; j++) {
				for (let i = 1; i <= nx; i++) {
					const k = i + j * sx;
					if (solid[k]) continue;
					const c = p[k];
					const l = solid[k - 1] ? c : p[k - 1], rr = solid[k + 1] ? c : p[k + 1];
					const t = solid[k - sx] ? c : p[k - sx], b = solid[k + sx] ? c : p[k + sx];
					p[k] = (div[k] + l + rr + t + b) * 0.25;
				}
			}
		}
		for (let j = 1; j <= ny; j++) {
			for (let i = 1; i <= nx; i++) {
				const k = i + j * sx;
				if (solid[k]) continue;
				const c = p[k];
				const l = solid[k - 1] ? c : p[k - 1], rr = solid[k + 1] ? c : p[k + 1];
				const t = solid[k - sx] ? c : p[k - sx], b = solid[k + sx] ? c : p[k + sx];
				u[k] -= 0.5 * (rr - l);
				v[k] -= 0.5 * (b - t);
			}
		}
	}

	/** Vorticity confinement: puts back the small swirls numerical diffusion smooths away. */
	confine(dt) {
		const eps = this.vorticity;
		if (eps <= 0) return;
		const { nx, ny, sx, u, v, curl, solid } = this;
		for (let j = 1; j <= ny; j++) {
			for (let i = 1; i <= nx; i++) {
				const k = i + j * sx;
				curl[k] = 0.5 * ((v[k + 1] - v[k - 1]) - (u[k + sx] - u[k - sx]));
			}
		}
		for (let j = 2; j < ny; j++) {
			for (let i = 2; i < nx; i++) {
				const k = i + j * sx;
				if (solid[k]) continue;
				const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]));
				const gy = 0.5 * (Math.abs(curl[k + sx]) - Math.abs(curl[k - sx]));
				const len = Math.hypot(gx, gy) + 1e-5;
				const w = curl[k];
				u[k] += dt * eps * (gy / len) * w;
				v[k] -= dt * eps * (gx / len) * w;
			}
		}
	}
}
