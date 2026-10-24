// Collision detection and tiny physics helpers shared by the arcade, ball and racing games.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Axis-aligned rectangles { x, y, w, h } overlap. */
export function rectsOverlap(a, b) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circlesOverlap(ax, ay, ar, bx, by, br) {
	const dx = ax - bx, dy = ay - by, r = ar + br;
	return dx * dx + dy * dy < r * r;
}

/**
 * Circle against rectangle. Returns null, or the contact normal { nx, ny, depth } pointing
 * from the rectangle toward the circle.
 */
export function circleRect(cx, cy, r, rect) {
	const px = clamp(cx, rect.x, rect.x + rect.w);
	const py = clamp(cy, rect.y, rect.y + rect.h);
	let dx = cx - px, dy = cy - py;
	const d2 = dx * dx + dy * dy;
	if (d2 > r * r) return null;
	if (d2 === 0) {
		// centre inside: push out along the shallowest side
		const left = cx - rect.x, right = rect.x + rect.w - cx, top = cy - rect.y, bottom = rect.y + rect.h - cy;
		const m = Math.min(left, right, top, bottom);
		if (m === left) return { nx: -1, ny: 0, depth: r + left };
		if (m === right) return { nx: 1, ny: 0, depth: r + right };
		if (m === top) return { nx: 0, ny: -1, depth: r + top };
		return { nx: 0, ny: 1, depth: r + bottom };
	}
	const d = Math.sqrt(d2);
	dx /= d; dy /= d;
	return { nx: dx, ny: dy, depth: r - d };
}

/** Reflects velocity (vx, vy) about normal (nx, ny) with restitution `e`, only if moving into it. */
export function reflect(body, nx, ny, e = 1) {
	const dot = body.vx * nx + body.vy * ny;
	if (dot >= 0) return false;
	body.vx -= (1 + e) * dot * nx;
	body.vy -= (1 + e) * dot * ny;
	return true;
}

/** Elastic collision of two equal-mass discs { x, y, vx, vy, r }; returns the impact speed. */
export function collideDiscs(a, b, e = 0.95) {
	const dx = b.x - a.x, dy = b.y - a.y;
	const dist = Math.hypot(dx, dy);
	const min = a.r + b.r;
	if (dist >= min || dist === 0) return 0;
	const nx = dx / dist, ny = dy / dist;
	const overlap = (min - dist) / 2;
	a.x -= nx * overlap; a.y -= ny * overlap;
	b.x += nx * overlap; b.y += ny * overlap;
	const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
	if (rel <= 0) return 0;
	const impulse = ((1 + e) * rel) / 2;
	a.vx -= impulse * nx; a.vy -= impulse * ny;
	b.vx += impulse * nx; b.vy += impulse * ny;
	return rel;
}

/** Closest point on segment AB to P, and whether a disc of radius r at P touches it. */
export function circleSegment(px, py, r, ax, ay, bx, by) {
	const abx = bx - ax, aby = by - ay;
	const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
	const cx = ax + abx * t, cy = ay + aby * t;
	const dx = px - cx, dy = py - cy;
	const d = Math.hypot(dx, dy);
	if (d >= r || d === 0) return null;
	return { nx: dx / d, ny: dy / d, depth: r - d };
}
