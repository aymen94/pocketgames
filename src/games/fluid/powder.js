// A falling-sand cellular automaton: every cell holds one material and a few bytes of
// state in flat typed arrays, updated in place once per frame and drawn through a single
// ImageData. Materials interact: water douses fire into steam, lava and water make
// stone, fire spreads through wood, oil and plants, acid eats through most things,
// plants creep into water.

export const M = { EMPTY: 0, SAND: 1, WATER: 2, STONE: 3, FIRE: 4, WOOD: 5, OIL: 6, SMOKE: 7, STEAM: 8, PLANT: 9, ACID: 10, LAVA: 11, DIRT: 12 };

// kind: 0 empty, 1 powder, 2 liquid, 3 solid, 4 gas, 5 fire. density orders powders and liquids.
export const MATERIALS = [
	{ name: 'Empty', kind: 0, density: 0, color: [10, 12, 24] },
	{ name: 'Sand', kind: 1, density: 5, color: [226, 192, 122], vary: 22 },
	{ name: 'Water', kind: 2, density: 3, color: [56, 130, 246], vary: 10, spread: 5 },
	{ name: 'Stone', kind: 3, density: 9, color: [120, 124, 140], vary: 16 },
	{ name: 'Fire', kind: 5, density: 0, color: [255, 120, 30], vary: 40 },
	{ name: 'Wood', kind: 3, density: 9, color: [138, 90, 50], vary: 14, burns: 0.012 },
	{ name: 'Oil', kind: 2, density: 2, color: [88, 60, 40], vary: 8, spread: 3, burns: 0.25 },
	{ name: 'Smoke', kind: 4, density: 0, color: [70, 70, 80], vary: 14 },
	{ name: 'Steam', kind: 4, density: 0, color: [190, 210, 235], vary: 12 },
	{ name: 'Plant', kind: 3, density: 9, color: [52, 190, 90], vary: 30, burns: 0.06 },
	{ name: 'Acid', kind: 2, density: 3, color: [150, 255, 60], vary: 20, spread: 3 },
	{ name: 'Lava', kind: 2, density: 6, color: [255, 90, 20], vary: 40, spread: 1 },
	{ name: 'Dirt', kind: 3, density: 9, color: [110, 74, 46], vary: 18 },
];

const KIND = Uint8Array.from(MATERIALS, (m) => m.kind);
const DENSITY = Uint8Array.from(MATERIALS, (m) => m.density);
const SPREAD = Uint8Array.from(MATERIALS, (m) => m.spread ?? 0);
const BURNS = Float32Array.from(MATERIALS, (m) => m.burns ?? 0);

export class Powder {
	constructor(w, h) {
		this.w = w;
		this.h = h;
		const n = w * h;
		this.type = new Uint8Array(n);
		this.shade = new Uint8Array(n); // per-cell colour variation
		this.life = new Uint8Array(n);
		this.stamp = new Uint8Array(n); // which tick last moved the cell
		this.tickId = 1;
		this.gravity = 1; // 1 down, -1 up
		this.image = new ImageData(w, h);
		this.counts = new Uint32Array(MATERIALS.length);
	}

	clear() {
		this.type.fill(0);
		this.life.fill(0);
	}

	inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
	get(x, y) { return this.inside(x, y) ? this.type[x + y * this.w] : M.STONE; }

	set(x, y, t) {
		if (!this.inside(x, y)) return;
		const k = x + y * this.w;
		this.type[k] = t;
		this.shade[k] = (Math.random() * 255) | 0;
		this.life[k] = t === M.FIRE ? 30 + ((Math.random() * 40) | 0) : t === M.SMOKE || t === M.STEAM ? 80 + ((Math.random() * 80) | 0) : 0;
	}

	/** Paints a disc of material; `replace` false only fills empty cells. */
	paint(cx, cy, radius, t, { replace = false, chance = 1 } = {}) {
		const r2 = radius * radius;
		for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
			for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
				if ((x - cx) ** 2 + (y - cy) ** 2 > r2 || !this.inside(x, y)) continue;
				if (Math.random() > chance) continue;
				const cur = this.type[x + y * this.w];
				if (t === M.EMPTY || replace || cur === M.EMPTY) this.set(x, y, t);
			}
		}
	}

	swap(a, b) {
		const { type, shade, life, stamp } = this;
		let t = type[a]; type[a] = type[b]; type[b] = t;
		t = shade[a]; shade[a] = shade[b]; shade[b] = t;
		t = life[a]; life[a] = life[b]; life[b] = t;
		stamp[a] = stamp[b] = this.tickId;
	}

	/** Can a cell of type `t` move into cell k (empty, or a lighter fluid it sinks through)? */
	canEnter(t, k) {
		const o = this.type[k];
		if (o === M.EMPTY) return true;
		const ko = KIND[o];
		if (ko === 4) return KIND[t] !== 4 && KIND[t] !== 5; // anything heavy displaces gas
		if (ko === 2 && (KIND[t] === 1 || KIND[t] === 2)) return DENSITY[t] > DENSITY[o];
		return false;
	}

	step() {
		this.tickId = (this.tickId % 250) + 1;
		const { w, h } = this;
		const down = this.gravity;
		this.counts.fill(0);
		// sweep against gravity so falling cells move once; alternate direction per row
		for (let i = 0; i < h; i++) {
			const y = down > 0 ? h - 1 - i : i;
			const flip = (this.tickId + y) & 1;
			for (let j = 0; j < w; j++) {
				const x = flip ? j : w - 1 - j;
				const k = x + y * w;
				const t = this.type[k];
				this.counts[t]++;
				if (t === M.EMPTY || this.stamp[k] === this.tickId) continue;
				switch (KIND[t]) {
					case 1: this.powder(x, y, k, t, down); break;
					case 2: this.liquid(x, y, k, t, down); break;
					case 4: this.gas(x, y, k, t, -down); break;
					case 5: this.fire(x, y, k); break;
					case 3: if (t === M.PLANT) this.plant(x, y, k); break;
				}
			}
		}
	}

	tryMove(k, x, y, t) {
		if (!this.inside(x, y)) return false;
		const n = x + y * this.w;
		if (!this.canEnter(t, n)) return false;
		this.swap(k, n);
		return true;
	}

	powder(x, y, k, t, dy) {
		if (this.tryMove(k, x, y + dy, t)) return;
		const s = Math.random() < 0.5 ? 1 : -1;
		if (this.tryMove(k, x + s, y + dy, t)) return;
		this.tryMove(k, x - s, y + dy, t);
	}

	liquid(x, y, k, t, dy) {
		if (t === M.ACID && this.corrode(x, y, k)) return;
		if (t === M.LAVA) {
			if (this.react(x, y, k)) return;
			if (Math.random() < 0.6) return; // lava is sluggish
		}
		if (t === M.WATER || t === M.OIL) this.douse(x, y, k, t);
		if (this.type[k] !== t) return;
		if (this.tryMove(k, x, y + dy, t)) return;
		const s = Math.random() < 0.5 ? 1 : -1;
		if (this.tryMove(k, x + s, y + dy, t)) return;
		if (this.tryMove(k, x - s, y + dy, t)) return;
		// spread sideways up to `spread` cells
		const reach = SPREAD[t];
		let cx = x, cur = k;
		for (let i = 0; i < reach; i++) {
			const nx = cx + s;
			if (!this.inside(nx, y)) break;
			const n = nx + y * this.w;
			if (this.type[n] !== M.EMPTY && !(KIND[this.type[n]] === 4)) break;
			this.swap(cur, n);
			cur = n;
			cx = nx;
			// fall off a ledge as soon as possible
			if (this.inside(cx, y + dy) && this.type[cx + (y + dy) * this.w] === M.EMPTY) break;
		}
	}

	gas(x, y, k, t, dy) {
		const life = this.life[k];
		if (life <= 1) {
			// steam sometimes condenses back to water
			if (t === M.STEAM && Math.random() < 0.3) this.set(x, y, M.WATER);
			else this.type[k] = M.EMPTY;
			return;
		}
		this.life[k] = life - 1;
		const s = Math.random() < 0.5 ? 1 : -1;
		const r = Math.random();
		if (r < 0.7 && this.gasMove(k, x + (r < 0.2 ? s : 0), y + dy)) return;
		this.gasMove(k, x + s, y);
	}

	gasMove(k, x, y) {
		if (!this.inside(x, y)) return false;
		const n = x + y * this.w;
		if (this.type[n] !== M.EMPTY) return false;
		this.swap(k, n);
		return true;
	}

	fire(x, y, k) {
		const life = this.life[k];
		if (life <= 1) { this.set(x, y, Math.random() < 0.5 ? M.SMOKE : M.EMPTY); return; }
		this.life[k] = life - 1;
		// ignite neighbours; water nearby puts the fire out
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (!dx && !dy) continue;
				const nx = x + dx, ny = y + dy;
				if (!this.inside(nx, ny)) continue;
				const n = nx + ny * this.w;
				const o = this.type[n];
				if (o === M.WATER) { this.set(x, y, M.STEAM); this.set(nx, ny, M.STEAM); return; }
				if (BURNS[o] > 0 && Math.random() < BURNS[o]) { this.set(nx, ny, M.FIRE); this.stamp[n] = this.tickId; }
			}
		}
		// flames flicker upward
		if (Math.random() < 0.4) {
			const s = ((Math.random() * 3) | 0) - 1;
			this.gasMove(k, x + s, y - this.gravity);
		}
	}

	/** Water meeting lava makes stone and steam; water next to fire is handled by fire. */
	douse(x, y, k, t) {
		if (t !== M.WATER) return;
		for (const [dx, dy] of NEIGHBOURS) {
			const nx = x + dx, ny = y + dy;
			if (!this.inside(nx, ny)) continue;
			const n = nx + ny * this.w;
			if (this.type[n] === M.LAVA) { this.set(nx, ny, M.STONE); this.set(x, y, M.STEAM); return; }
		}
	}

	/** Lava ignites flammables and melts sand into... more lava, slowly. */
	react(x, y, k) {
		for (const [dx, dy] of NEIGHBOURS) {
			const nx = x + dx, ny = y + dy;
			if (!this.inside(nx, ny)) continue;
			const n = nx + ny * this.w;
			const o = this.type[n];
			if (BURNS[o] > 0 && Math.random() < 0.2) this.set(nx, ny, M.FIRE);
			else if (o === M.EMPTY && Math.random() < 0.004) this.set(nx, ny, M.SMOKE);
		}
		return false;
	}

	corrode(x, y, k) {
		for (const [dx, dy] of NEIGHBOURS) {
			const nx = x + dx, ny = y + dy;
			if (!this.inside(nx, ny)) continue;
			const o = this.type[nx + ny * this.w];
			if (o === M.EMPTY || o === M.ACID || KIND[o] === 4 || o === M.FIRE) continue;
			const chance = o === M.STONE ? 0.01 : o === M.WATER ? 0 : 0.2;
			if (Math.random() < chance) {
				this.set(nx, ny, Math.random() < 0.3 ? M.SMOKE : M.EMPTY);
				if (Math.random() < 0.4) this.set(x, y, M.EMPTY);
				return true;
			}
		}
		return false;
	}

	plant(x, y, k) {
		if (Math.random() > 0.04) return;
		const [dx, dy] = NEIGHBOURS[(Math.random() * 4) | 0];
		const nx = x + dx, ny = y + dy;
		if (this.inside(nx, ny) && this.type[nx + ny * this.w] === M.WATER) this.set(nx, ny, M.PLANT);
	}

	/** Fills the ImageData with every cell's colour. `bg` is the empty colour. */
	paintImage(time = 0) {
		const { type, shade, life, w, h } = this;
		const data = this.image.data;
		const flick = (time * 20) | 0;
		for (let k = 0, n = w * h; k < n; k++) {
			const t = type[k];
			const m = MATERIALS[t];
			const o = k * 4;
			const c = m.color;
			let v = m.vary ? ((shade[k] / 255) - 0.5) * m.vary : 0;
			if (t === M.FIRE) {
				const heat = life[k] / 70;
				data[o] = 255; data[o + 1] = 60 + heat * 170 + v; data[o + 2] = 20 + heat * 40; data[o + 3] = 255;
				continue;
			}
			if (t === M.LAVA) v += ((shade[k] + flick * 7) % 40) - 20;
			if (t === M.EMPTY) {
				data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
				continue;
			}
			if (KIND[t] === 4) {
				// gases fade with their life
				const a = Math.min(1, life[k] / 90);
				data[o] = 10 + (c[0] - 10) * a + v; data[o + 1] = 12 + (c[1] - 12) * a + v; data[o + 2] = 24 + (c[2] - 24) * a + v; data[o + 3] = 255;
				continue;
			}
			data[o] = c[0] + v; data[o + 1] = c[1] + v; data[o + 2] = c[2] + v; data[o + 3] = 255;
		}
		return this.image;
	}
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
