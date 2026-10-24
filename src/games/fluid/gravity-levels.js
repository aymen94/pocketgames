// Gravity Well levels (720 × 480) and the shared probe physics, so a level checker can
// simulate exactly what the game does. Planets pull with G·mass/d²; rocks only destroy.

export const G = 20000;
export const LEVELS = [
	{ name: 'First Orbit', shots: 4, start: { x: 80, y: 400 }, target: { x: 620, y: 90, r: 26 }, planets: [{ x: 360, y: 250, r: 40, m: 90 }], rocks: [] },
	{ name: 'Slingshot', shots: 4, start: { x: 80, y: 240 }, target: { x: 640, y: 240, r: 24 }, planets: [{ x: 360, y: 240, r: 52, m: 140 }], rocks: [] },
	{ name: 'Twin Suns', shots: 4, start: { x: 60, y: 420 }, target: { x: 660, y: 420, r: 24 }, planets: [{ x: 250, y: 260, r: 36, m: 110 }, { x: 470, y: 260, r: 36, m: 110 }], rocks: [{ x: 360, y: 420, r: 30 }] },
	{ name: 'Asteroid Belt', shots: 5, start: { x: 60, y: 60 }, target: { x: 660, y: 420, r: 24 }, planets: [{ x: 420, y: 160, r: 44, m: 160 }], rocks: [{ x: 300, y: 300, r: 22 }, { x: 360, y: 340, r: 18 }, { x: 420, y: 380, r: 22 }, { x: 240, y: 250, r: 18 }] },
	{ name: 'Around the Back', shots: 5, start: { x: 360, y: 440 }, target: { x: 360, y: 60, r: 24 }, planets: [{ x: 360, y: 240, r: 60, m: 200 }], rocks: [{ x: 360, y: 140, r: 26 }] },
	{ name: 'Gauntlet', shots: 6, start: { x: 50, y: 240 }, target: { x: 680, y: 90, r: 22 }, planets: [{ x: 220, y: 120, r: 34, m: 110 }, { x: 400, y: 340, r: 40, m: 140 }, { x: 560, y: 180, r: 30, m: 100 }], rocks: [{ x: 320, y: 220, r: 20 }, { x: 480, y: 260, r: 18 }] },
];

/** Advances a probe { x, y, vx, vy } by dt; returns 'crash', 'lost', 'goal' or null. */
export function stepProbe(p, L, dt) {
	for (const pl of L.planets) {
		const dx = pl.x - p.x, dy = pl.y - p.y;
		const d2 = dx * dx + dy * dy;
		const d = Math.sqrt(d2);
		if (d < pl.r + 5) return 'crash';
		const a = (G * pl.m) / d2;
		p.vx += (dx / d) * a * dt;
		p.vy += (dy / d) * a * dt;
	}
	p.x += p.vx * dt;
	p.y += p.vy * dt;
	for (const r of L.rocks) if (Math.hypot(r.x - p.x, r.y - p.y) < r.r + 5) return 'crash';
	if (p.x < -200 || p.y < -200 || p.x > 920 || p.y > 680) return 'lost';
	if (Math.hypot(L.target.x - p.x, L.target.y - p.y) < L.target.r) return 'goal';
	return null;
}

export const MAX_SPEED = 420;
/** Launch velocity from a slingshot pull (dx, dy = start − pointer). */
export function launch(dx, dy) {
	const k = 2.6;
	let vx = dx * k, vy = dy * k;
	const s = Math.hypot(vx, vy);
	if (s > MAX_SPEED) { vx *= MAX_SPEED / s; vy *= MAX_SPEED / s; }
	return { vx, vy };
}
