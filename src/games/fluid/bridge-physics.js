// Bridge physics: Verlet nodes joined by beams (distance constraints solved iteratively)
// that snap when stretched or squashed too far, and a two-wheeled truck whose wheels roll
// on road beams and the cliff tops, pressing down on whatever they stand on. No DOM, so
// the level checker runs the same code as the game.

export const MATERIALS = {
	road: { cost: 2, strength: 0.022, color: '#475569', width: 8 },
	wood: { cost: 1, strength: 0.03, color: '#c08a54', width: 5 },
	steel: { cost: 3, strength: 0.05, color: '#94a3b8', width: 5 },
};
export const MAX_BEAM = 130;
const GRAVITY = 600;

export class Bridge {
	constructor(level) {
		this.level = level;
		this.nodes = []; // { x, y, px, py, fixed }
		this.beams = []; // { a, b, rest, material, broken, stress }
		this.stiffness = 0.3; // fraction of each beam's error fixed per iteration: beams flex under load
		this.peak = 0;
		for (const [x, y] of level.anchors) this.node(x, y, true);
		const { left, right, top } = level;
		this.ground = [[0, top, left, top], [left, top, left, 560], [right, top, 800, top], [right, top, right, 560]];
		if (level.pillar) {
			const [x, y] = level.pillar;
			this.ground.push([x - 20, y, x + 20, y], [x - 20, y, x - 20, 560], [x + 20, y, x + 20, 560]);
		}
	}

	node(x, y, fixed = false) {
		const found = this.nodes.findIndex((n) => Math.hypot(n.x - x, n.y - y) < 6);
		if (found >= 0) return found;
		this.nodes.push({ x, y, px: x, py: y, fixed, ox: x, oy: y });
		return this.nodes.length - 1;
	}

	beam(a, b, material) {
		if (a === b) return null;
		if (this.beams.some((m) => (m.a === a && m.b === b) || (m.a === b && m.b === a))) return null;
		const na = this.nodes[a], nb = this.nodes[b];
		const rest = Math.hypot(na.x - nb.x, na.y - nb.y);
		if (rest > MAX_BEAM + 0.5 || rest < 10) return null;
		const beam = { a, b, rest, material, broken: false, stress: 0 };
		this.beams.push(beam);
		return beam;
	}

	cost() {
		return Math.round(this.beams.reduce((sum, m) => sum + m.rest * MATERIALS[m.material].cost, 0) / 10);
	}

	/** Back to the drawn shape (after a failed test). */
	restore() {
		for (const n of this.nodes) { n.x = n.px = n.ox; n.y = n.py = n.oy; }
		for (const m of this.beams) { m.broken = false; m.stress = 0; }
		this.truck = null;
	}

	startTest(mass = 3) {
		const y = this.level.top - 16;
		this.truck = {
			wheels: [{ x: 40, y, px: 40, py: y, r: 14 }, { x: 100, y, px: 100, py: y, r: 14 }],
			mass, speed: 70, length: 60, done: false,
		};
	}

	step(dt) {
		const g = GRAVITY * dt * dt;
		for (const n of this.nodes) {
			if (n.fixed) continue;
			const vx = (n.x - n.px) * 0.995, vy = (n.y - n.py) * 0.995;
			n.px = n.x; n.py = n.y;
			n.x += vx; n.y += vy + g;
		}
		const t = this.truck;
		if (t) {
			for (const w of t.wheels) {
				let vx = w.x - w.px, vy = w.y - w.py;
				w.px = w.x; w.py = w.y;
				// the motor pulls toward cruising speed while on the ground
				if (w.grounded) vx += (t.speed * dt - vx) * 0.25;
				w.x += vx; w.y += vy + g;
				w.grounded = false;
			}
		}
		for (let it = 0; it < 12; it++) {
			this.solveBeams(it === 11);
			if (t) this.solveTruck();
		}
		if (t && !t.done) {
			if (t.wheels[0].x > Math.min(this.level.right + 120, 760)) t.done = 'pass';
			else if (t.wheels.some((w) => w.y > 560)) t.done = 'fall';
		}
	}

	solveBeams(measure) {
		const nodes = this.nodes;
		for (const m of this.beams) {
			if (m.broken) continue;
			const a = nodes[m.a], b = nodes[m.b];
			const dx = b.x - a.x, dy = b.y - a.y;
			const d = Math.hypot(dx, dy) || 1e-6;
			const diff = (d - m.rest) / d;
			if (measure) {
				m.stress = Math.abs(d - m.rest) / m.rest / MATERIALS[m.material].strength;
				if (m.stress > this.peak) this.peak = m.stress;
				if (m.stress > 1 && !this.unbreakable) { m.broken = true; continue; }
			}
			const wa = a.fixed ? 0 : 1, wb = b.fixed ? 0 : 1;
			const sum = (wa + wb) / this.stiffness;
			if (!sum) continue;
			a.x += dx * diff * (wa / sum); a.y += dy * diff * (wa / sum);
			b.x -= dx * diff * (wb / sum); b.y -= dy * diff * (wb / sum);
		}
	}

	solveTruck() {
		const t = this.truck;
		const [w1, w2] = t.wheels;
		// axle
		const dx = w2.x - w1.x, dy = w2.y - w1.y;
		const d = Math.hypot(dx, dy) || 1e-6;
		const k = ((d - t.length) / d) * 0.5;
		w1.x += dx * k; w1.y += dy * k; w2.x -= dx * k; w2.y -= dy * k;
		for (const w of t.wheels) {
			for (const [ax, ay, bx, by] of this.ground) this.collideStatic(w, ax, ay, bx, by);
			for (const m of this.beams) {
				if (m.broken || m.material !== 'road') continue;
				this.collideBeam(w, m, t.mass);
			}
		}
	}

	collideStatic(w, ax, ay, bx, by) {
		const abx = bx - ax, aby = by - ay;
		let s = ((w.x - ax) * abx + (w.y - ay) * aby) / (abx * abx + aby * aby);
		s = Math.max(0, Math.min(1, s));
		const cx = ax + abx * s, cy = ay + aby * s;
		const ex = w.x - cx, ey = w.y - cy;
		const dist = Math.hypot(ex, ey);
		if (dist >= w.r || dist === 0) return;
		const push = (w.r - dist) / dist;
		w.x += ex * push; w.y += ey * push;
		if (ey < 0) w.grounded = true;
	}

	collideBeam(w, m, mass) {
		const a = this.nodes[m.a], b = this.nodes[m.b];
		const abx = b.x - a.x, aby = b.y - a.y;
		const len2 = abx * abx + aby * aby || 1;
		let s = ((w.x - a.x) * abx + (w.y - a.y) * aby) / len2;
		if (s < 0 || s > 1) return;
		const cx = a.x + abx * s, cy = a.y + aby * s;
		const ex = w.x - cx, ey = w.y - cy;
		const dist = Math.hypot(ex, ey);
		if (dist >= w.r || dist === 0) return;
		// only from above: wheels should not snag on a beam's underside
		if (ey > 0) return;
		const pen = w.r - dist, nx = ex / dist, ny = ey / dist;
		// split the correction by inverse mass: heavy wheel, light beam ends
		const iw = 1 / mass, ia = a.fixed ? 0 : (1 - s) , ib = b.fixed ? 0 : s;
		const total = iw + ia * (1 - s) + ib * s || 1;
		const lambda = pen / total;
		w.x += nx * lambda * iw; w.y += ny * lambda * iw;
		a.x -= nx * lambda * ia * (1 - s); a.y -= ny * lambda * ia * (1 - s);
		b.x -= nx * lambda * ib * s; b.y -= ny * lambda * ib * s;
		w.grounded = true;
	}
}
