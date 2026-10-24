// The screen around every game: header with score and controls, the play area, the
// intro / pause / game-over / settings overlays, the on-screen touch pad, and the game's
// lifecycle (load, init, start, pause, reset, dispose). Games never touch any of this.

import { gameArt } from './art.js';
import { h, icon, iconButton } from './dom.js';
import { formatScore } from './gameCard.js';
import { Loop } from '../engine/loop.js';
import { Input } from '../engine/input.js';
import { audio } from '../services/audio.js';
import { store } from '../services/storage.js';
import { categoryLabel } from '../games/registry.js';
import { FxLayer } from './fxLayer.js';
import { themePicker } from './themePicker.js';
import { theme } from '../services/theme.js';
import { reducedMotion } from '../games/core/fx.js';
import '../styles/game-screen.css';

/** The shortest time the loading card shows, so quick loads read as a transition, not a flash. */
const MIN_LOADING = 900;

const coarse = () => window.matchMedia('(pointer: coarse)').matches;

export class GameScreen {
	constructor(meta, { onExit }) {
		this.meta = meta;
		this.onExit = onExit;
		this.game = null;
		this.state = 'loading'; // loading | intro | playing | paused | over | error
		this.loop = null;
		this.input = new Input();
		this.input.enabled = false;
		this.settings = this.readSettings();
		this.build();
	}

	readSettings() {
		const saved = store.gameSettings(this.meta.id);
		const values = {};
		for (const s of this.meta.settings ?? []) values[s.key] = s.options.some(([v]) => v === saved[s.key]) ? saved[s.key] : s.default;
		return values;
	}

	// ------------------------------------------------------------ DOM

	build() {
		const m = this.meta;
		this.scoreValue = h('strong', '0');
		this.bestValue = h('strong', '–');
		this.infoValue = h('span.hud-info');
		this.soundButton = iconButton(audio.enabled ? 'soundOn' : 'soundOff', 'Toggle sound', () => this.toggleSound());
		this.pauseButton = iconButton('pause', 'Pause (Esc)', () => this.togglePause());
		if (m.pausable === false) this.pauseButton.hidden = true;

		const hasScore = Boolean(m.score);
		this.scoreChip = hasScore ? h('div.hud-chip', h('span', m.score.label), this.scoreValue) : null;
		this.bestChip = hasScore ? h('div.hud-chip.best', { html: icon.trophy }, this.bestValue) : null;
		this.picker = themePicker();
		this.header = h('header.game-header',
			iconButton('back', 'Back to games', () => this.exit(), 'back-btn'),
			h('div.game-title', h('h1', m.title), h('span', categoryLabel(m.categories[0]))),
			h('div.hud',
				this.scoreChip,
				this.bestChip,
				this.infoValue,
			),
			h('div.game-actions',
				this.pauseButton,
				iconButton('restart', 'Restart', () => this.restart()),
				this.soundButton,
				this.picker.el,
				(m.settings?.length ?? 0) > 0 && iconButton('settings', 'Settings', () => this.showSettings()),
				iconButton('help', 'How to play', () => this.showHelp()),
				document.fullscreenEnabled && iconButton('expand', 'Fullscreen', () => this.toggleFullscreen(), 'fullscreen-btn'),
			),
		);

		this.area = h('div.game-area', { tabindex: '-1' });
		this.overlay = h('div.overlay', { hidden: true });
		this.pad = this.buildTouchPad(m.touch);
		this.stage = h('div.game-stage', this.area, this.overlay);
		this.el = h('section.game-screen', { 'aria-label': m.title }, this.header, this.stage, this.pad);
		this.fx = new FxLayer(this.stage, this.area);
		this.shown = 0;
		this.updateBest();
	}

	buildTouchPad(kind) {
		if (!kind) return null;
		const button = (action, name, cls = '') => {
			const b = h(`button.pad-btn${cls}`, { type: 'button', 'aria-label': action, html: icon[name] });
			const down = (e) => { e.preventDefault(); b.classList.add('down'); this.input.press(action, true); };
			const up = (e) => { e.preventDefault(); if (!b.classList.contains('down')) return; b.classList.remove('down'); this.input.press(action, false); };
			b.addEventListener('pointerdown', down);
			b.addEventListener('pointerup', up);
			b.addEventListener('pointerleave', up);
			b.addEventListener('pointercancel', up);
			return b;
		};
		let content;
		if (kind === 'dpad') {
			content = [h('div.pad-cross', button('up', 'up', '.u'), button('left', 'left', '.l'), button('right', 'right', '.r'), button('down', 'down', '.d'))];
		} else {
			content = [h('div.pad-row', button('left', 'left'), button('right', 'right')), kind === 'lra' && h('div.pad-row', button('action', 'bolt', '.action'))];
		}
		const pad = h('div.touch-pad', ...content);
		pad.hidden = !coarse();
		return pad;
	}

	// ------------------------------------------------------------ lifecycle

	async open() {
		// a short loading card: it stays at least MIN_LOADING so a fast load does not flash,
		// then the bar fills and the intro rises in its place
		const started = performance.now();
		const bar = h('div.loading-bar', h('span'));
		const tip = this.meta.instructions?.[0];
		this.showOverlay(h('div.panel.loading.game-loading',
			h('div.loading-art', { html: gameArt(this.meta) }),
			h('h2', this.meta.title),
			bar,
			h('p.loading-status', `Loading ${this.meta.three ? '3D scene' : 'game'}…`),
			tip && h('p.loading-tip', h('strong', 'Tip: '), tip),
		));
		try {
			const module = await this.meta.load();
			const GameClass = module.default;
			this.game = new GameClass(this.context());
			this.realtime = GameClass.realtime;
			await this.game.init();
			if (this.closed) return this.game.dispose();
			const wait = MIN_LOADING - (performance.now() - started);
			if (wait > 0) await new Promise((r) => setTimeout(r, wait));
			bar.classList.add('done');
			await new Promise((r) => setTimeout(r, reducedMotion() ? 0 : 260));
			if (this.closed) return this.game.dispose();
		} catch (error) {
			console.error(error);
			if (this.closed) return;
			this.state = 'error';
			const graphics = this.meta.three;
			this.showOverlay(h('div.panel',
				h('h2', graphics ? '3D graphics unavailable' : 'Could not start the game'),
				h('p', graphics
					? 'This game needs WebGPU or WebGL 2, which this browser or device did not provide. All the 2D games still work.'
					: 'Something went wrong while loading. If you are offline, this game may not have been cached yet.'),
				h('p.muted', String(error?.message ?? error)),
				h('div.panel-actions', h('button.btn.primary', { type: 'button', onclick: () => this.exit() }, 'Back to games')),
			));
			return;
		}

		this.input.onDown((action, event, repeat) => {
			if (event && (event.key === 'Escape' || event.key === 'p' || event.key === 'P') && !repeat) {
				if (this.state === 'playing' || this.state === 'paused') this.togglePause();
				return;
			}
			// Space starts from the intro (Enter already activates the focused button)
			if (this.state === 'intro' && event?.key === ' ' && !repeat) {
				const saved = this.game.restore && store.progress(this.meta.id);
				this.play(Boolean(saved));
				return;
			}
			if (this.state === 'playing') this.game.handleInput({ type: 'down', action, event, repeat });
		});
		this.input.onUp((action, event) => {
			if (this.state === 'playing') this.game.handleInput({ type: 'up', action, event });
		});
		this.input.on(document, 'visibilitychange', () => { if (document.hidden && this.state === 'playing') this.pause(); });
		this.input.on(document, 'fullscreenchange', () => this.el.classList.toggle('is-fullscreen', document.fullscreenElement === this.el));
		this.input.on(window, 'pointerdown', () => audio.unlock(), { once: true });
		this.input.enabled = true;
		// theme changes repaint turn-based boards and let games retint their own accents
		this.offTheme = theme.subscribe((colors) => {
			this.game?.onTheme?.(colors);
			if (!this.realtime && this.state !== 'loading') this.game?.render();
		});

		if (this.realtime) {
			this.loop = new Loop((dt) => {
				// games keep animating effects after the round ends (their logic checks `running`)
				if (this.state === 'playing' || this.state === 'over') this.game.update(dt);
				this.game.render();
			});
		}
		store.recordPlay(this.meta.id);
		this.showIntro();
		this.game.render();
	}

	context() {
		const meta = this.meta;
		return {
			id: meta.id,
			meta,
			root: this.area,
			settings: this.settings,
			input: this.input,
			audio,
			score: (value) => this.setScore(value),
			fx: this.fx,
			info: (text) => { this.infoValue.textContent = text ?? ''; },
			best: () => store.best(meta.id),
			over: (result) => this.over(result),
			saveProgress: (data) => store.saveProgress(meta.id, data),
			loadProgress: () => store.progress(meta.id)?.data ?? null,
		};
	}

	play(resumeSaved) {
		this.hideOverlay();
		if (resumeSaved) {
			this.game.reset();
			this.game.restore(store.progress(this.meta.id).data);
		}
		this.state = 'playing';
		this.stage.classList.remove('is-paused');
		this.game.start();
		this.loop?.start();
		this.area.focus({ preventScroll: true });
		audio.play('opener');
		if (this.realtime && this.meta.pausable !== false) this.fx.banner('GO!');
	}

	pause() {
		if (this.state !== 'playing' || this.meta.pausable === false) return;
		this.state = 'paused';
		this.stage.classList.add('is-paused');
		this.game.pause();
		this.loop?.stop();
		this.pauseButton.innerHTML = icon.play;
		this.showOverlay(h('div.panel',
			h('h2', 'Paused'),
			h('div.panel-actions',
				h('button.btn.primary', { type: 'button', onclick: () => this.resume() }, 'Resume'),
				h('button.btn', { type: 'button', onclick: () => this.restart() }, 'Restart'),
				h('button.btn.ghost', { type: 'button', onclick: () => this.exit() }, 'Quit'),
			),
		));
	}

	resume() {
		if (this.state !== 'paused') return;
		this.hideOverlay();
		this.state = 'playing';
		this.stage.classList.remove('is-paused');
		this.pauseButton.innerHTML = icon.pause;
		this.game.resume();
		this.loop?.start();
	}

	togglePause() {
		if (this.state === 'playing') this.pause();
		else if (this.state === 'paused') this.resume();
	}

	restart() {
		if (!this.game || this.state === 'loading' || this.state === 'error') return;
		this.loop?.stop();
		this.pauseButton.innerHTML = icon.pause;
		this.fx.clear();
		this.game.reset();
		this.resetHud();
		this.play(false);
	}

	resetHud() {
		cancelAnimationFrame(this.countId);
		this.shown = 0;
		this.beaten = false;
		this.scoreValue.textContent = '0';
		this.infoValue.textContent = '';
		this.bestChip?.classList.remove('beaten');
	}

	/** Shows the score, counting up smoothly and bumping the chip when it rises. */
	setScore(value) {
		const meta = this.meta;
		if (typeof value !== 'number' || meta.score?.format) {
			cancelAnimationFrame(this.countId);
			this.scoreValue.textContent = formatScore(meta, value) ?? String(value);
			this.shown = typeof value === 'number' ? value : 0;
			return;
		}
		const from = this.shown;
		this.target = value;
		if (value === from) return;
		if (value > from && performance.now() - (this.lastBump ?? 0) > 350) {
			this.lastBump = performance.now();
			this.scoreChip?.classList.remove('bump');
			void this.scoreChip?.offsetWidth;
			this.scoreChip?.classList.add('bump');
		}
		// a newly beaten record lights up the trophy chip once per game
		const best = store.best(meta.id);
		if (!this.beaten && meta.score && !meta.score.lowerIsBetter && best != null && value > best) {
			this.beaten = true;
			this.bestChip?.classList.add('beaten');
			audio.play('sparkle');
		}
		if (reducedMotion() || Math.abs(value - from) <= 1) {
			this.shown = value;
			this.scoreValue.textContent = String(value);
			return;
		}
		cancelAnimationFrame(this.countId);
		const start = performance.now(), duration = 320;
		const step = (now) => {
			const t = Math.min(1, (now - start) / duration);
			this.shown = Math.round(from + (this.target - from) * (1 - (1 - t) ** 3));
			this.scoreValue.textContent = String(this.shown);
			if (t < 1) this.countId = requestAnimationFrame(step);
		};
		this.countId = requestAnimationFrame(step);
	}

	over({ win = null, title, message = '', score = null, record = true } = {}) {
		this.state = 'over';
		const meta = this.meta;
		let newBest = false;
		// a zero on a higher-is-better game is not worth keeping as a record
		if (!meta.score?.lowerIsBetter && !(score > 0)) record = false;
		if (meta.score && score != null && record) newBest = store.submitScore(meta.id, score, meta.score.lowerIsBetter);
		this.updateBest();
		if (this.game.restore) store.saveProgress(meta.id, null);
		// celebrate or commiserate before the result card rises
		if (win === false) {
			audio.play('gameover');
			this.fx.shake(8);
			this.fx.flash(getComputedStyle(document.documentElement).getPropertyValue('--color-danger').trim() || '#fb7185', 0.25);
		} else {
			audio.play(newBest ? 'record' : 'win');
			if (win === true || newBest) this.fx.confetti({ count: newBest ? 140 : 90 });
		}
		// keep drawing a moment so the last frame (explosion, final ball) settles
		setTimeout(() => { if (this.state === 'over') this.loop?.stop(); }, 2000);
		const best = formatScore(meta, store.best(meta.id));
		this.showOverlay(h(`div.panel.result${win === true ? '.win' : win === false ? '.lose' : ''}`,
			h('h2', title ?? (win ? 'You win!' : win === false ? 'Game over' : 'Finished')),
			message && h('p', message),
			meta.score && score != null && h('div.result-score',
				h('div', h('span', meta.score.label), this.countUp(score)),
				best && h('div', h('span', 'Best'), h('strong', best)),
			),
			newBest && h('p.record', { html: `${icon.trophy} New personal best!` }),
			h('div.panel-actions',
				h('button.btn.primary', { type: 'button', onclick: () => this.restart() }, 'Play again'),
				h('button.btn.ghost', { type: 'button', onclick: () => this.exit() }, 'All games'),
			),
		));
	}

	/** The result score, counting up from zero as the card appears. */
	countUp(score) {
		const meta = this.meta;
		const el = h('strong', formatScore(meta, score));
		if (typeof score !== 'number' || meta.score.format || reducedMotion() || score <= 0) return el;
		const start = performance.now() + 250, duration = Math.min(1200, 400 + score * 4);
		const step = (now) => {
			const t = Math.max(0, Math.min(1, (now - start) / duration));
			el.textContent = String(Math.round(score * (1 - (1 - t) ** 3)));
			if (t < 1 && el.isConnected) requestAnimationFrame(step);
		};
		el.textContent = '0';
		requestAnimationFrame(step);
		return el;
	}

	exit() {
		if (this.leaving) return;
		this.leaving = true;
		this.picker.close();
		if (reducedMotion()) return this.onExit();
		this.el.classList.add('leaving');
		setTimeout(() => this.onExit(), 170);
	}

	dispose() {
		this.closed = true;
		this.loop?.stop();
		cancelAnimationFrame(this.countId);
		this.offTheme?.();
		this.picker.close();
		this.fx.dispose();
		this.input.dispose();
		try { this.game?.dispose(); } catch (error) { console.error(error); }
		if (document.fullscreenElement === this.el) document.exitFullscreen().catch(() => {});
		this.el.remove();
	}

	// ------------------------------------------------------------ overlays

	showOverlay(content) {
		this.overlay.replaceChildren(content);
		this.overlay.hidden = false;
		this.input.enabled = this.state !== 'loading';
		content.querySelector('.btn.primary')?.focus({ preventScroll: true });
	}

	hideOverlay() {
		this.overlay.hidden = true;
		this.overlay.replaceChildren();
	}

	intro(extra) {
		const m = this.meta;
		return h('div.panel.intro',
			h('h2', m.title),
			h('p.lead', m.blurb),
			h('ul.howto', m.instructions.map((line) => h('li', line))),
			h('p.controls', h('strong', 'Controls: '), m.controls),
			extra,
		);
	}

	showIntro() {
		this.state = 'intro';
		const saved = this.game.restore && store.progress(this.meta.id);
		const actions = h('div.panel-actions',
			saved && h('button.btn.primary', { type: 'button', onclick: () => this.play(true) }, 'Continue'),
			h(`button.btn${saved ? '' : '.primary'}`, { type: 'button', onclick: () => { if (saved) store.saveProgress(this.meta.id, null); this.play(false); } }, saved ? 'New game' : 'Play'),
			(this.meta.settings?.length ?? 0) > 0 && h('button.btn.ghost', { type: 'button', onclick: () => this.showSettings() }, 'Settings'),
		);
		this.showOverlay(this.intro(actions));
	}

	showHelp() {
		if (this.state === 'loading' || this.state === 'error') return;
		const was = this.state;
		if (was === 'playing') {
			if (this.meta.pausable === false) {
				// turn-based games just show the help over the board, nothing to freeze
				const close = h('button.btn.primary', { type: 'button', onclick: () => this.hideOverlay() }, 'Back to game');
				this.showOverlay(this.intro(h('div.panel-actions', close)));
				return;
			}
			this.pause();
		}
		let action;
		if (was === 'intro') action = h('button.btn.primary', { type: 'button', onclick: () => this.showIntro() }, 'Got it');
		else if (was === 'over') action = h('button.btn.primary', { type: 'button', onclick: () => this.restart() }, 'Play again');
		else action = h('button.btn.primary', { type: 'button', onclick: () => this.resume() }, 'Resume');
		this.showOverlay(this.intro(h('div.panel-actions', action)));
	}

	showSettings() {
		if (this.state === 'loading' || this.state === 'error') return;
		const wasPlaying = this.state === 'playing';
		if (wasPlaying) this.pause();
		const fields = (this.meta.settings ?? []).map((s) => {
			const select = h('select', { name: s.key }, s.options.map(([value, label]) => h('option', { value, selected: this.settings[s.key] === value }, label)));
			return h('label.field', h('span', s.label), select);
		});
		const form = h('form.panel.settings', {
			onsubmit: (e) => {
				e.preventDefault();
				const data = new FormData(form);
				const changed = (this.meta.settings ?? []).some((s) => data.get(s.key) !== this.settings[s.key]);
				for (const s of this.meta.settings ?? []) this.settings[s.key] = data.get(s.key);
				store.setGameSettings(this.meta.id, { ...this.settings });
				if (changed) {
					if (this.game.restore) store.saveProgress(this.meta.id, null);
					this.fx.clear();
					this.game.reset();
					this.resetHud();
					this.game.render();
					this.showIntro();
				} else if (wasPlaying) this.resume();
				else this.showIntro();
			},
		},
		h('h2', 'Settings'),
		fields,
		h('label.field', h('span', 'Sound effects'), h('input', { type: 'checkbox', name: 'sound', checked: audio.enabled, onchange: () => this.toggleSound() })),
		h('p.muted', 'Changing a setting starts a new game.'),
		h('div.panel-actions', h('button.btn.primary', { type: 'submit' }, 'Apply')),
		);
		this.showOverlay(form);
	}

	toggleSound() {
		audio.enabled = !audio.enabled;
		this.soundButton.innerHTML = audio.enabled ? icon.soundOn : icon.soundOff;
		audio.play('click');
	}

	toggleFullscreen() {
		if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
		else this.el.requestFullscreen?.().catch(() => {});
	}

	updateBest() {
		if (!this.meta.score) return;
		this.bestValue.textContent = formatScore(this.meta, store.best(this.meta.id)) ?? '–';
	}
}
