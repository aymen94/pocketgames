// The base of the canvas games added after the first 38. It wires the pieces every one of
// them needs: a Surface with a fixed logical size (optionally under a toolbar), CanvasFx,
// pointer events in logical units, keyboard actions, and a redraw loop for turn-based
// games that runs only while something animates. Everything it creates is released in
// `dispose()`, so a game only cleans up what it adds itself (in `teardown()`).
//
// Subclasses set `static W`, `static H`, `static realtime`, and implement any of:
//   setup()               once, after the surface exists (build state that survives resets)
//   reset()               a fresh round (call super.reset() first)
//   step(dt)              real-time logic, only while running and not paused
//   tick(dt)              every frame, even when paused or over (ambient animation)
//   draw(g)               paint the world in logical units
//   busy()                turn-based games: true while their own animation runs
//   pointerDown/Move/Up(p, event)   p = { x, y } in logical units
//   key(action, event)    key/touch-pad presses while playing
//   teardown()            release what the game added itself

import { Game } from '../core/game.js';
import { Surface } from '../core/canvas.js';
import { CanvasFx, Animator } from '../core/fx.js';
import { h } from '../../components/dom.js';
import { KIT_CSS } from './toolbar.js';

let styleRefs = 0;
let styleEl = null;

/** The kit's shared stylesheet, added once while any kit game is open. */
export function useKitStyle() {
	if (styleRefs++ === 0) {
		styleEl = h('style', { 'data-kit': '' }, KIT_CSS);
		document.head.appendChild(styleEl);
	}
	let released = false;
	return () => {
		if (released) return;
		released = true;
		if (--styleRefs === 0) { styleEl.remove(); styleEl = null; }
	};
}

export class CanvasGame extends Game {
	static W = 480;
	static H = 640;

	async init() {
		const { W, H } = this.constructor;
		this.W = W;
		this.H = H;
		// dev builds expose the open game for automated play-testing
		if (import.meta.env?.DEV) window.__pgGame = this;
		this.releaseStyle = useKitStyle();
		this.kitRoot = h('div.kit-layout');
		this.kitHost = h('div.kit-host');
		this.toolbar = this.buildToolbar?.() ?? null;
		if (this.toolbar) this.kitRoot.append(this.toolbar);
		this.kitRoot.append(this.kitHost);
		this.ctx.root.appendChild(this.kitRoot);
		this.surface = new Surface(this.kitHost, W, H);
		this.g = this.surface.g;
		this.fx = new CanvasFx(this.constructor.particles ?? 400);
		this.pointer = { x: W / 2, y: H / 2, down: false };

		const canvas = this.surface.canvas;
		const input = this.ctx.input;
		input.on(canvas, 'pointerdown', (e) => {
			e.preventDefault();
			canvas.setPointerCapture?.(e.pointerId);
			Object.assign(this.pointer, this.surface.local(e), { down: true, button: e.button });
			this.pointerDown?.(this.pointer, e);
			this.wake();
		});
		input.on(canvas, 'pointermove', (e) => {
			Object.assign(this.pointer, this.surface.local(e));
			this.pointerMove?.(this.pointer, e);
			this.wake();
		});
		const up = (e) => {
			if (!this.pointer.down) return;
			Object.assign(this.pointer, this.surface.local(e), { down: false });
			this.pointerUp?.(this.pointer, e);
			this.wake();
		};
		input.on(canvas, 'pointerup', up);
		input.on(canvas, 'pointercancel', up);
		input.on(canvas, 'contextmenu', (e) => e.preventDefault());

		if (!this.constructor.realtime) {
			this.animator = new Animator((dt) => {
				this.fx.update(dt);
				this.tick?.(dt);
				this.render();
			}, () => this.fx.busy || Boolean(this.busy?.()));
		}
		this.surface.onResize = () => this.render();
		await this.setup?.();
		this.reset();
	}

	/** Turn-based games: redraw now and keep animating while busy. */
	wake() {
		if (this.animator) {
			this.render();
			this.animator.wake();
		}
	}

	reset() {
		this.running = false;
		this.paused = false;
		this.fx?.clear();
	}

	start() {
		super.start();
		this.wake();
	}

	handleInput({ type, action, event, repeat }) {
		if (type === 'down' && this.running && !this.paused) this.key?.(action, event, repeat);
		if (type === 'up') this.keyUp?.(action, event);
		this.wake();
	}

	update(dt) {
		this.fx.update(dt);
		this.tick?.(dt);
		if (this.running && !this.paused) this.step?.(dt);
	}

	render() {
		if (!this.surface) return;
		const g = this.g;
		g.save();
		this.fx.shake.apply(g);
		this.draw?.(g);
		this.fx.draw(g);
		g.restore();
		g.restore();
		this.fx.flash.draw(g, this.W, this.H);
	}

	/** Particles in logical units. */
	burst(x, y, options) { this.fx.particles.burst(x, y, options); this.wake(); }
	popup(text, x, y, options) { this.fx.popups.add(text, x, y, options); this.wake(); }

	dispose() {
		this.running = false;
		this.animator?.stop();
		this.teardown?.();
		this.surface?.dispose();
		this.kitRoot?.remove();
		this.releaseStyle?.();
		this.surface = null;
	}
}
