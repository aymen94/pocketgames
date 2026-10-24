// An effects overlay above a game's play area. Every game gets it as `ctx.fx`: DOM games
// (Sudoku, Minefield, Memory…) use it for bursts and popups at element positions; canvas
// and 3D games use it for banners, confetti and screen feedback. It animates only while
// something is on screen, and is removed with the game.

import { h } from './dom.js';
import { CanvasFx, Animator, reducedMotion } from '../games/core/fx.js';
import { themeColors } from '../services/theme.js';
import { canvasPixelRatio, onGraphicsChange } from '../services/graphics.js';

export class FxLayer {
	constructor(stage, area) {
		this.stage = stage;
		this.area = area;
		this.canvas = h('canvas.fx-layer', { 'aria-hidden': 'true' });
		this.flashEl = h('div.fx-flash', { 'aria-hidden': 'true' });
		stage.append(this.canvas, this.flashEl);
		this.g = this.canvas.getContext('2d');
		this.fx = new CanvasFx(500);
		this.animator = new Animator((dt) => this.frame(dt), () => this.fx.busy);
		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(stage);
		this.unsubscribeQuality = onGraphicsChange(() => this.resize());
		this.resize();
	}

	resize() {
		const rect = this.stage.getBoundingClientRect();
		// the overlay draws only transient effects: never sharper than 2×
		const dpr = Math.min(canvasPixelRatio(), 2);
		this.width = rect.width;
		this.height = rect.height;
		this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
		this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
		this.canvas.style.width = `${rect.width}px`;
		this.canvas.style.height = `${rect.height}px`;
		this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	frame(dt) {
		this.fx.update(dt);
		this.g.clearRect(0, 0, this.width, this.height);
		this.fx.draw(this.g);
	}

	// ------------------------------------------------------------ coordinates

	/** Client coordinates → layer coordinates. */
	local(clientX, clientY) {
		const rect = this.stage.getBoundingClientRect();
		return { x: clientX - rect.left, y: clientY - rect.top };
	}

	/** The centre of an element, in layer coordinates. */
	centre(el) {
		const r = el.getBoundingClientRect();
		return this.local(r.left + r.width / 2, r.top + r.height / 2);
	}

	/** A point in a Surface's logical units, in layer coordinates. */
	fromSurface(surface, x, y) {
		const r = surface.canvas.getBoundingClientRect();
		return this.local(r.left + (x / surface.width) * r.width, r.top + (y / surface.height) * r.height);
	}

	// ------------------------------------------------------------ effects

	/** Particles at `at` ({x, y} layer point, or an element); options as Particles2D.burst. */
	burst(at, options = {}) {
		const p = at instanceof Element ? this.centre(at) : at;
		this.fx.particles.burst(p.x, p.y, options);
		this.animator.wake();
	}

	ring(at, options = {}) {
		const p = at instanceof Element ? this.centre(at) : at;
		this.fx.particles.ring(p.x, p.y, { color: themeColors().primary, ...options });
		this.animator.wake();
	}

	text(label, at, options = {}) {
		const p = at instanceof Element ? this.centre(at) : at;
		this.fx.popups.add(label, p.x, p.y, options);
		this.animator.wake();
	}

	confetti(options = {}) {
		const c = themeColors();
		this.fx.particles.confetti(this.width, { colors: [c.primary, c.secondary, c.tertiary, c.warning, c.success], ...options });
		this.animator.wake();
	}

	/** A big centred word that pops in and floats away (GO!, LEVEL 2…). */
	banner(label) {
		this.stage.querySelector('.fx-banner')?.remove();
		const el = h('div.fx-banner', label);
		this.stage.appendChild(el);
		el.addEventListener('animationend', () => el.remove(), { once: true });
	}

	/** Shakes the whole play area (CSS); nothing with reduced motion. */
	shake(px = 6) {
		if (reducedMotion()) return;
		const el = this.area;
		el.style.setProperty('--shake', `${px}px`);
		el.classList.remove('fx-shake');
		void el.offsetWidth;
		el.classList.add('fx-shake');
		el.addEventListener('animationend', () => el.classList.remove('fx-shake'), { once: true });
	}

	flash(color = themeColors().primary, alpha = 0.3) {
		const el = this.flashEl;
		el.style.background = color;
		el.style.setProperty('--flash-alpha', reducedMotion() ? alpha * 0.4 : alpha);
		el.classList.remove('on');
		void el.offsetWidth;
		el.classList.add('on');
	}

	/** "Not allowed" wiggle on an element (an invalid move or wrong answer). */
	nope(el) {
		if (!el) return;
		el.classList.remove('fx-nope');
		void el.offsetWidth;
		el.classList.add('fx-nope');
		el.addEventListener('animationend', () => el.classList.remove('fx-nope'), { once: true });
	}

	/** A springy emphasis pulse on an element (a match, a placed tile). */
	pulse(el) {
		if (!el) return;
		el.classList.remove('fx-pulse');
		void el.offsetWidth;
		el.classList.add('fx-pulse');
		el.addEventListener('animationend', () => el.classList.remove('fx-pulse'), { once: true });
	}

	clear() {
		this.fx.clear();
		this.g.clearRect(0, 0, this.width, this.height);
		this.stage.querySelector('.fx-banner')?.remove();
	}

	dispose() {
		this.animator.stop();
		this.observer.disconnect();
		this.unsubscribeQuality();
		this.canvas.remove();
		this.flashEl.remove();
		this.stage.querySelector('.fx-banner')?.remove();
	}
}
