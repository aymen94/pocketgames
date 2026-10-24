// Effects for the 2D games, drawn inside each game's own canvas: pooled particles in
// several shapes, floating text, trails, tweens, flashes and shake. Everything is
// allocation-free per frame, scales with the graphics quality setting and calms down
// when the player prefers reduced motion.

import { qualityProfile } from '../../services/graphics.js';

const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
export const reducedMotion = () => Boolean(motionQuery?.matches);

/** How many particles to spawn relative to the request: quality × motion preference. */
export function effectScale() {
	return qualityProfile().particles * (reducedMotion() ? 0.35 : 1);
}

// ---------------------------------------------------------------- easing and tweens

export const ease = {
	linear: (t) => t,
	outQuad: (t) => 1 - (1 - t) * (1 - t),
	outCubic: (t) => 1 - (1 - t) ** 3,
	inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
	outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
	outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
	outBounce: (t) => {
		const n = 7.5625, d = 2.75;
		if (t < 1 / d) return n * t * t;
		if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
		if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
		return n * (t -= 2.625 / d) * t + 0.984375;
	},
};

export const lerp = (a, b, t) => a + (b - a) * t;
/** Frame-rate independent smoothing toward a target. */
export const approach = (value, target, rate, dt) => target + (value - target) * Math.exp(-rate * dt);

/**
 * Animates numeric properties of plain objects. `to(target, { x: 10 }, 0.2, ease.outCubic)`
 * returns a promise-like handle; `update(dt)` advances every tween. Reduced motion jumps
 * straight to the end values.
 */
export class Tweens {
	constructor() { this.list = []; }
	to(target, props, duration = 0.25, easing = ease.outCubic, { delay = 0, onDone = null } = {}) {
		if (reducedMotion()) duration = Math.min(duration, 0.05);
		const from = {};
		for (const key of Object.keys(props)) from[key] = target[key];
		const tween = { target, from, props, duration: Math.max(1e-4, duration), easing, t: -delay, onDone };
		this.list.push(tween);
		return tween;
	}
	cancel(target) { this.list = this.list.filter((t) => t.target !== target); }
	update(dt) {
		if (!this.list.length) return;
		let alive = 0;
		for (const tw of this.list) {
			tw.t += dt;
			if (tw.t < 0) { this.list[alive++] = tw; continue; }
			const k = tw.easing(Math.min(1, tw.t / tw.duration));
			for (const key in tw.props) tw.target[key] = tw.from[key] + (tw.props[key] - tw.from[key]) * k;
			if (tw.t >= tw.duration) tw.onDone?.();
			else this.list[alive++] = tw;
		}
		this.list.length = alive;
	}
	get active() { return this.list.length > 0; }
	clear() { this.list.length = 0; }
}

// ---------------------------------------------------------------- particles

const TAU = Math.PI * 2;

/**
 * Pooled particles. Shapes: 'dot', 'spark' (streak along velocity), 'square' (debris),
 * 'confetti' (fluttering paper), 'star', 'ring' (expanding outline), 'smoke' (soft,
 * growing) and 'dust' (small, short). Glowing shapes draw additively.
 */
export class Particles2D {
	constructor(capacity = 400) {
		this.pool = Array.from({ length: capacity }, () => ({ alive: false }));
		this.count = 0;
	}

	spawn() {
		for (const p of this.pool) if (!p.alive) return p;
		// pool full: recycle the oldest-looking one
		let oldest = this.pool[0];
		for (const p of this.pool) if (p.life / p.max < oldest.life / oldest.max) oldest = p;
		return oldest;
	}

	/**
	 * burst(x, y, { count, colors, speed, angle, spread, life, gravity, size, shape, drag, glow, spin })
	 * `angle` (radians) and `spread` aim the burst; the default is a full circle.
	 */
	burst(x, y, { count = 16, colors = ['#ffffff'], color, speed = 160, angle = 0, spread = TAU, life = 0.7, gravity = 0, size = 3, shape = 'dot', drag = 1.5, glow = false, grow = 0 } = {}) {
		const palette = color ? [color] : colors;
		const n = Math.max(1, Math.round(count * effectScale()));
		for (let i = 0; i < n; i++) {
			const p = this.spawn();
			const a = angle + (Math.random() - 0.5) * spread;
			const v = speed * (0.35 + Math.random() * 0.65);
			p.alive = true;
			p.x = x; p.y = y;
			p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
			p.life = p.max = life * (0.65 + Math.random() * 0.35);
			p.size = size * (0.6 + Math.random() * 0.8);
			p.color = palette[(Math.random() * palette.length) | 0];
			p.shape = shape; p.gravity = gravity; p.drag = drag; p.glow = glow; p.grow = grow;
			p.rot = Math.random() * TAU; p.spin = (Math.random() - 0.5) * 12; p.phase = Math.random() * TAU;
		}
	}

	/** An expanding ring, for impacts, landings and pickups. */
	ring(x, y, { color = '#ffffff', radius = 40, life = 0.45, width = 3 } = {}) {
		const p = this.spawn();
		Object.assign(p, { alive: true, x, y, vx: 0, vy: 0, life, max: life, size: radius, color, shape: 'ring', gravity: 0, drag: 0, glow: true, grow: 0, width, rot: 0, spin: 0 });
	}

	/** Paper confetti raining from the top edge across `width`. */
	confetti(width, { colors = ['#f472b6', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa'], count = 80, top = -10 } = {}) {
		const n = Math.round(count * effectScale());
		for (let i = 0; i < n; i++) {
			const p = this.spawn();
			Object.assign(p, {
				alive: true, x: Math.random() * width, y: top - Math.random() * 120, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120,
				life: 3, max: 3, size: 4 + Math.random() * 4, color: colors[(Math.random() * colors.length) | 0], shape: 'confetti',
				gravity: 60, drag: 0.6, glow: false, grow: 0, rot: Math.random() * TAU, spin: (Math.random() - 0.5) * 10, phase: Math.random() * TAU,
			});
		}
	}

	update(dt) {
		let n = 0;
		for (const p of this.pool) {
			if (!p.alive) continue;
			p.life -= dt;
			if (p.life <= 0) { p.alive = false; continue; }
			n++;
			const k = Math.exp(-p.drag * dt);
			p.vx *= k; p.vy = p.vy * k + p.gravity * dt;
			if (p.shape === 'confetti') p.vx += Math.sin((p.phase += dt * 5)) * 30 * dt;
			p.x += p.vx * dt; p.y += p.vy * dt;
			p.rot += p.spin * dt;
			if (p.grow) p.size += p.grow * dt;
		}
		this.count = n;
	}

	draw(g) {
		if (!this.count) return;
		g.save();
		for (const p of this.pool) {
			if (!p.alive) continue;
			const t = p.life / p.max;
			g.globalAlpha = p.shape === 'confetti' ? Math.min(1, t * 3) : t;
			g.globalCompositeOperation = p.glow ? 'lighter' : 'source-over';
			g.fillStyle = g.strokeStyle = p.color;
			switch (p.shape) {
				case 'spark': {
					g.lineWidth = p.size * 0.6;
					g.lineCap = 'round';
					g.beginPath();
					g.moveTo(p.x, p.y);
					g.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
					g.stroke();
					break;
				}
				case 'square': case 'confetti': {
					g.save();
					g.translate(p.x, p.y);
					g.rotate(p.rot);
					const flip = p.shape === 'confetti' ? Math.abs(Math.cos(p.rot * 1.3)) : 1;
					g.fillRect(-p.size / 2, (-p.size / 2) * flip * 0.6, p.size, p.size * flip * 0.6 + (p.shape === 'square' ? p.size * 0.4 : 0));
					g.restore();
					break;
				}
				case 'star': {
					g.save();
					g.translate(p.x, p.y);
					g.rotate(p.rot);
					g.beginPath();
					for (let i = 0; i < 10; i++) {
						const r = i % 2 ? p.size * 0.45 : p.size;
						g.lineTo(Math.cos((i / 10) * TAU) * r, Math.sin((i / 10) * TAU) * r);
					}
					g.fill();
					g.restore();
					break;
				}
				case 'ring': {
					g.lineWidth = (p.width ?? 3) * t;
					g.beginPath();
					g.arc(p.x, p.y, p.size * (1 - t * t) + 2, 0, TAU);
					g.stroke();
					break;
				}
				case 'smoke': {
					g.globalAlpha = t * 0.35;
					g.beginPath();
					g.arc(p.x, p.y, p.size * (1.6 - t), 0, TAU);
					g.fill();
					break;
				}
				default: {
					g.beginPath();
					g.arc(p.x, p.y, p.size * (p.shape === 'dust' ? t : 0.4 + t * 0.6), 0, TAU);
					g.fill();
				}
			}
		}
		g.restore();
	}

	clear() { for (const p of this.pool) p.alive = false; this.count = 0; }
	get active() { return this.count > 0; }
}

// ---------------------------------------------------------------- text, trails, flash, shake

/** Floating text ("+10", "PERFECT!") that rises, pops in and fades. */
export class Popups {
	constructor() { this.items = []; }
	add(text, x, y, { color = '#ffffff', size = 18, life = 0.9, rise = 40 } = {}) {
		this.items.push({ text, x, y, color, size, life, max: life, rise });
		if (this.items.length > 24) this.items.shift();
	}
	update(dt) {
		let n = 0;
		for (const it of this.items) { it.life -= dt; if (it.life > 0) this.items[n++] = it; }
		this.items.length = n;
	}
	draw(g) {
		if (!this.items.length) return;
		g.save();
		g.textAlign = 'center';
		g.textBaseline = 'middle';
		for (const it of this.items) {
			const t = 1 - it.life / it.max;
			const scale = t < 0.15 ? ease.outBack(t / 0.15) : 1;
			g.globalAlpha = t > 0.65 ? 1 - (t - 0.65) / 0.35 : 1;
			g.font = `900 ${it.size * scale}px system-ui, sans-serif`;
			g.lineWidth = 4;
			g.strokeStyle = 'rgba(0,0,0,0.45)';
			const y = it.y - it.rise * ease.outCubic(t);
			g.strokeText(it.text, it.x, y);
			g.fillStyle = it.color;
			g.fillText(it.text, it.x, y);
		}
		g.restore();
	}
	clear() { this.items.length = 0; }
}

/** A fading polyline behind a moving object (balls, cars, planes). */
export class Trail {
	constructor(length = 14) {
		this.xs = new Float32Array(length);
		this.ys = new Float32Array(length);
		this.length = length;
		this.size = 0;
		this.head = 0;
	}
	push(x, y) {
		this.xs[this.head] = x;
		this.ys[this.head] = y;
		this.head = (this.head + 1) % this.length;
		this.size = Math.min(this.size + 1, this.length);
	}
	reset() { this.size = 0; }
	draw(g, color, width = 6, { glow = true } = {}) {
		if (this.size < 2) return;
		g.save();
		g.globalCompositeOperation = glow ? 'lighter' : 'source-over';
		g.strokeStyle = color;
		g.lineCap = 'round';
		for (let i = 1; i < this.size; i++) {
			const a = (this.head - this.size + i - 1 + this.length) % this.length;
			const b = (a + 1) % this.length;
			const t = i / this.size;
			g.globalAlpha = t * 0.6;
			g.lineWidth = width * t;
			g.beginPath();
			g.moveTo(this.xs[a], this.ys[a]);
			g.lineTo(this.xs[b], this.ys[b]);
			g.stroke();
		}
		g.restore();
	}
}

/** A full-surface colour flash for hits and level-ups. */
export class Flash {
	constructor() { this.t = 0; this.color = '#ffffff'; this.alpha = 0.3; }
	trigger(color = '#ffffff', alpha = 0.3) {
		if (reducedMotion()) alpha *= 0.4;
		this.color = color; this.alpha = alpha; this.t = 1;
	}
	update(dt) { this.t = Math.max(0, this.t - dt * 3); }
	draw(g, w, h) {
		if (this.t <= 0) return;
		g.save();
		g.globalAlpha = this.alpha * this.t;
		g.fillStyle = this.color;
		g.fillRect(0, 0, w, h);
		g.restore();
	}
}

/** Canvas shake: `kick(px)`, then wrap drawing in `apply(g)` … `g.restore()`. None with reduced motion. */
export class Shake2D {
	constructor() { this.power = 0; this.x = 0; this.y = 0; }
	kick(px) { if (!reducedMotion()) this.power = Math.max(this.power, px); }
	update(dt) {
		this.power = Math.max(0, this.power - dt * 40);
		this.x = (Math.random() * 2 - 1) * this.power;
		this.y = (Math.random() * 2 - 1) * this.power;
	}
	apply(g) {
		g.save();
		g.translate(this.x, this.y);
	}
}

/**
 * Bundles the common effects for a canvas game: one call each to update and draw.
 *   const fx = new CanvasFx(); fx.particles.burst(...); fx.popups.add(...)
 *   update: fx.update(dt)   draw: fx.shake.apply(g) … world … fx.draw(g); g.restore(); fx.flash.draw(g, w, h)
 */
export class CanvasFx {
	constructor(capacity = 400) {
		this.particles = new Particles2D(capacity);
		this.popups = new Popups();
		this.flash = new Flash();
		this.shake = new Shake2D();
		this.tweens = new Tweens();
	}
	update(dt) {
		this.particles.update(dt);
		this.popups.update(dt);
		this.flash.update(dt);
		this.shake.update(dt);
		this.tweens.update(dt);
	}
	draw(g) {
		this.particles.draw(g);
		this.popups.draw(g);
	}
	get busy() {
		return this.particles.active || this.popups.items.length > 0 || this.flash.t > 0 || this.shake.power > 0 || this.tweens.active;
	}
	clear() {
		this.particles.clear();
		this.popups.clear();
		this.tweens.clear();
		this.flash.t = 0;
		this.shake.power = 0;
	}
}

/**
 * Keeps a turn-based canvas game animating only while it has something to animate:
 * `wake()` starts a requestAnimationFrame loop that calls `frame(dt)` until `busy()` is false.
 */
export class Animator {
	constructor(frame, busy) {
		this.frame = frame;
		this.busy = busy;
		this.id = 0;
		this.last = 0;
		this.tick = (now) => {
			// rAF timestamps can precede the performance.now() taken in wake(): never step backwards
			const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
			this.last = now;
			this.frame(dt);
			this.id = this.busy() ? requestAnimationFrame(this.tick) : 0;
		};
	}
	wake() {
		if (this.id) return;
		this.last = performance.now();
		this.id = requestAnimationFrame(this.tick);
	}
	stop() {
		cancelAnimationFrame(this.id);
		this.id = 0;
	}
}
