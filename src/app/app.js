// The PocketGames application: hash routing between the dashboard and a game, the
// dashboard sections, search and category filters, and where the app controls live:
// in the centre of the header on the dashboard, in the game header while a game is open.

import { h, icon, iconButton } from '../components/dom.js';
import { gameCard } from '../components/gameCard.js';
import { GameScreen } from '../components/gameScreen.js';
import { GAMES, CATEGORIES, gameById, categoryLabel } from '../games/registry.js';
import { store } from '../services/storage.js';
import { audio } from '../services/audio.js';
import { pwa } from '../services/pwa.js';
import { QUALITY, BACKENDS, graphicsSettings, setGraphicsSettings } from '../services/graphics.js';
import { themePicker, themeOptions } from '../components/themePicker.js';

const featuredPool = GAMES.filter((g) => g.three);

/** The featured game changes daily, cycling through the 3D showcase games. */
function featuredGame() {
	const day = Math.floor(Date.now() / 86400000);
	return featuredPool[day % featuredPool.length];
}

function normalize(text) {
	return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matches(game, query) {
	if (!query) return true;
	const haystack = normalize([game.title, game.blurb, ...game.categories.map(categoryLabel), game.three ? '3d' : ''].join(' '));
	return normalize(query).split(/\s+/).every((word) => haystack.includes(word));
}

export class App {
	constructor(root) {
		this.root = root;
		this.query = '';
		this.category = 'all';
		this.screen = null;
		// set once a 3D game has started the engine, so the footer can name the backend
		this.engineUsed = false;
		this.build();
		store.subscribe(() => { if (!this.screen) this.renderSections(); });
		pwa.subscribe((status) => this.renderStatus(status));
		window.addEventListener('hashchange', () => this.route());
		this.route();
	}

	// ------------------------------------------------------------ layout

	build() {
		this.search = h('input.search-input', {
			type: 'search', placeholder: 'Search games…', 'aria-label': 'Search games', autocomplete: 'off',
			oninput: () => { this.query = this.search.value.trim(); this.renderSections(); },
			onkeydown: (e) => { if (e.key === 'Enter') this.browse.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
		});
		this.status = h('div.status-pill', { role: 'status', 'aria-live': 'polite' });
		this.installButton = h('button.btn.small.install', { type: 'button', hidden: true, onclick: () => pwa.install(), html: `${icon.download}<span>Install</span>` });
		this.soundButton = iconButton(audio.enabled ? 'soundOn' : 'soundOff', 'Toggle sound', () => {
			audio.enabled = !audio.enabled;
			this.soundButton.innerHTML = audio.enabled ? icon.soundOn : icon.soundOff;
		});

		// the app controls: centred in the dashboard header; while a game is open the status,
		// install and app settings move into its header (it has its own sound and theme)
		this.appSettingsButton = iconButton('settings', 'Settings', () => this.openSettings());
		this.gameSettingsButton = iconButton('cube', 'App & graphics settings', () => this.openSettings());
		this.controls = h('div.hero-controls', this.status, this.installButton, this.soundButton, themePicker().el, this.appSettingsButton);

		this.topbar = h('header.topbar',
			h('a.brand', { href: '#/', 'aria-label': 'PocketGames home' },
				h('span.brand-mark', { html: '<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><rect x="2" y="6" width="28" height="20" rx="9" fill="url(#bm)"/><path d="M9 13v6M6 16h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="21" cy="14" r="1.9" fill="#fff"/><circle cx="24.5" cy="18" r="1.9" fill="#fde047"/></svg>' }),
				h('span.brand-name', 'Pocket', h('b', 'Games')),
			),
			this.controls,
		);

		const featured = featuredGame();
		this.chips = h('div.chips', { role: 'toolbar', 'aria-label': 'Categories' });
		this.heroPanel = h('div.hero-panel',
			h('label.search', { html: icon.search }, this.search),
			this.chips,
		);
		this.heroEl = h('section.hero',
			h('div.hero-copy',
				h('p.eyebrow', 'Free browser games for everyone'),
				h('h1', 'Play Instantly.', h('br'), h('span.gradient-text', 'No Downloads.')),
				h('p.hero-text', 'Classic arcade, puzzle, strategy, card, racing, ball and sports games, right in your browser. No installation, no account: just click and play.'),
				h('div.hero-actions',
					h('a.btn.primary.large', { href: `#/play/${featured.id}`, html: `${icon.play}<span>Play ${featured.title}</span>` }),
					h('button.btn.ghost.large', { type: 'button', onclick: () => this.browse.scrollIntoView({ behavior: 'smooth' }) }, 'Browse all games'),
				),
				h('ul.hero-stats',
					h('li', h('strong', String(GAMES.length)), h('span', 'games')),
					h('li', h('strong', String(GAMES.filter((g) => g.three).length)), h('span', '3D games')),
					h('li', h('strong', '0'), h('span', 'downloads')),
				),
			),
			this.heroPanel,
		);

		this.results = h('div.game-grid');
		this.resultsTitle = h('h2', 'All games');
		this.resultsCount = h('span.count');
		this.browse = h('section.section.browse', { id: 'browse' },
			h('div.section-head', h('div', this.resultsTitle, this.resultsCount)),
			this.results,
		);
		this.rails = h('div.rails');

		this.dashboard = h('main.dashboard', this.heroEl, this.rails, this.browse,
			h('footer.footer',
				h('p', h('strong', 'PocketGames'), ' · Play Instantly. No Downloads.'),
				h('p.muted', 'Everything runs in your browser. Favorites, scores and saved games stay on this device. After the first visit the games are cached and play offline.'),
				h('p.muted.engine-line'),
			),
		);
		this.gameView = h('div.game-view', { hidden: true });
		this.root.replaceChildren(this.topbar, this.dashboard, this.gameView);
		this.renderChips();
		this.renderSections();
	}

	renderChips() {
		const chip = (id, label) => h('button.chip', {
			type: 'button',
			'aria-pressed': String(this.category === id),
			onclick: () => { this.category = id; audio.play('select'); this.renderChips(); this.renderSections(); },
		}, label);
		this.chips.replaceChildren(chip('all', 'All'), chip('favorites', '♥ Favorites'), chip('3d', '3D'), ...CATEGORIES.map((c) => chip(c.id, c.label)));
	}

	rail(title, games, options = {}) {
		if (games.length === 0) return null;
		return h('section.section.rail-section',
			h('div.section-head', h('h2', title), options.note && h('span.count', options.note)),
			h('div.rail', games.map((g) => gameCard(g, { compact: true, progress: options.progress?.(g) }))),
		);
	}

	renderSections() {
		const filtering = this.query !== '' || this.category !== 'all';
		const state = store.state;

		// rails are hidden while searching so the results come first
		if (filtering) {
			this.rails.replaceChildren();
		} else {
			const saved = GAMES.filter((g) => g.resumable && store.progress(g.id));
			const recent = state.recent.map((id) => gameById.get(id)).filter(Boolean);
			const favorites = state.favorites.map((id) => gameById.get(id)).filter(Boolean);
			const popular = [...GAMES].sort((a, b) => (b.popularity + (state.plays[b.id] ?? 0) * 2) - (a.popularity + (state.plays[a.id] ?? 0) * 2)).slice(0, 10);
			const fresh = GAMES.filter((g) => g.isNew);
			this.rails.replaceChildren(...[
				this.rail('Continue playing', saved, { progress: () => true, note: 'Saved on this device' }),
				this.rail('Recently played', recent),
				this.rail('Your favorites', favorites),
				this.rail('Popular', popular, { note: 'Staff picks and your most played' }),
				this.rail('New & featured', fresh),
			].filter(Boolean));
		}

		let list = GAMES.filter((g) => matches(g, this.query));
		if (this.category === 'favorites') list = list.filter((g) => store.isFavorite(g.id));
		else if (this.category === '3d') list = list.filter((g) => g.three);
		else if (this.category !== 'all') list = list.filter((g) => g.categories.includes(this.category));

		const label = this.category === 'all' ? 'All games' : this.category === 'favorites' ? 'Favorites' : this.category === '3d' ? '3D games' : categoryLabel(this.category);
		this.resultsTitle.textContent = this.query ? `Results for “${this.query}”` : label;
		this.resultsCount.textContent = `${list.length} ${list.length === 1 ? 'game' : 'games'}`;
		this.results.replaceChildren(...(list.length
			? list.map((g, i) => { const card = gameCard(g); card.style.setProperty('--i', i); return card; })
			: [h('div.empty', h('p', this.category === 'favorites' ? 'No favorites yet. Tap the heart on any game to keep it here.' : 'No games match your search.'),
				h('button.btn.small', { type: 'button', onclick: () => { this.query = ''; this.search.value = ''; this.category = 'all'; this.renderChips(); this.renderSections(); } }, 'Show all games'))]));
	}

	renderStatus({ online, offlineReady, installable }) {
		let text, cls;
		if (!online) { text = offlineReady ? 'Offline · games cached' : 'Offline'; cls = 'offline'; }
		else if (offlineReady) { text = 'Offline ready'; cls = 'ready'; }
		else { text = 'Online'; cls = 'online'; }
		this.status.className = `status-pill ${cls}`;
		this.status.title = offlineReady ? 'All games are cached on this device and play without a connection.' : online ? 'Games will be cached for offline play once the app has finished installing.' : 'You are offline. Games already cached still work.';
		this.status.innerHTML = `${online ? (offlineReady ? icon.check : icon.online) : icon.offline}<span>${text}</span>`;
		this.installButton.hidden = !installable;
	}

	// ------------------------------------------------------------ engine line

	/** Names the WAMR3D backend in the footer once a 3D game has started the engine. */
	async showEngineLine() {
		if (!this.engineUsed) return;
		const { backendName, backendLabel, engineError } = await import('../engine/wamr3d.js');
		const line = this.dashboard.querySelector('.engine-line');
		if (backendName()) {
			this.backend = backendLabel(backendName());
			line.textContent = `3D rendered with WAMR3D on ${this.backend} · ${QUALITY[graphicsSettings().quality].label} quality.`;
		} else if (engineError()) {
			this.backend = 'unavailable';
			line.textContent = graphicsSettings().backend !== 'auto'
				? `The ${BACKENDS[graphicsSettings().backend].label} engine is unavailable here: choose Auto in settings (gear icon).`
				: '3D graphics are unavailable in this browser; the 2D games still work.';
		}
	}

	// ------------------------------------------------------------ settings

	openSettings() {
		const current = graphicsSettings();
		const choice = { ...current };
		const group = (title, name, options, selected) => h('fieldset.choice-group',
			h('legend', title),
			Object.entries(options).map(([value, info]) => h('label.choice',
				h('input', { type: 'radio', name, value, checked: value === selected, onchange: () => { choice[name] = value; audio.play('select'); } }),
				h('span.choice-body', h('strong', info.label), h('small', info.note)),
			)),
		);
		const webgpu = 'gpu' in navigator;
		const themes = themeOptions({ legend: 'Colour theme (applies instantly)' });
		const close = () => { themes.dispose(); dialog.remove(); document.removeEventListener('keydown', onKey); };
		const onKey = (e) => { if (e.key === 'Escape') close(); };
		const sound = h('input', { type: 'checkbox', checked: audio.enabled, onchange: () => {
			audio.enabled = sound.checked;
			this.soundButton.innerHTML = audio.enabled ? icon.soundOn : icon.soundOff;
			audio.play('select');
		} });
		const dialog = h('div.modal', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Settings', onclick: (e) => { if (e.target === dialog) close(); } },
			h('form.panel.settings-panel', {
				onsubmit: (e) => {
					e.preventDefault();
					if (choice.quality === current.quality && choice.backend === current.backend) return close();
					// quality applies live (resolution, effects, shadows, particles, simulations);
					// the backend is fixed when the GPU context is created, so only it reloads
					const changed = setGraphicsSettings(choice);
					if (changed.backend) return location.reload();
					this.showEngineLine();
					close();
				},
			},
			h('div.modal-head', h('h2', 'Settings'), iconButton('close', 'Close', close)),
			themes.el,
			group('Graphics quality', 'quality', QUALITY, current.quality),
			group('Rendering engine', 'backend', BACKENDS, current.backend),
			h('p.muted.engine-status', `WAMR3D is drawing with ${this.backend ?? 'not started yet'}. WebGPU ${webgpu ? 'is' : 'is not'} exposed by this browser.`),
			h('label.field', h('span', 'Sound effects'), sound),
			h('p.muted', 'Themes and graphics quality apply immediately. Changing the rendering engine reloads PocketGames to restart the renderer; your theme, scores and saved games are kept.'),
			h('div.panel-actions', h('button.btn.ghost', { type: 'button', onclick: close }, 'Cancel'), h('button.btn.primary', { type: 'submit' }, 'Apply')),
			),
		);
		document.addEventListener('keydown', onKey);
		document.body.appendChild(dialog);
		dialog.querySelector('input:checked')?.focus();
	}

	// ------------------------------------------------------------ routing

	route() {
		const match = location.hash.match(/^#\/play\/([\w-]+)/);
		const meta = match && gameById.get(match[1]);
		if (meta) this.openGame(meta);
		else this.showDashboard();
	}

	openGame(meta) {
		if (this.screen?.meta === meta) return;
		this.closeGame();
		this.dashboardScroll = window.scrollY;
		this.dashboard.hidden = true;
		this.topbar.hidden = true;
		this.gameView.hidden = false;
		document.body.classList.add('in-game');
		document.title = `${meta.title} · PocketGames`;
		this.screen = new GameScreen(meta, { onExit: () => { location.hash = '#/'; } });
		if (meta.three) this.engineUsed = true;
		this.screen.header.querySelector('.game-actions')?.prepend(this.status, this.installButton, this.gameSettingsButton);
		this.gameView.replaceChildren(this.screen.el);
		window.scrollTo(0, 0);
		this.screen.open();
	}

	closeGame() {
		if (!this.screen) return;
		this.screen.dispose();
		this.screen = null;
		this.gameView.replaceChildren();
	}

	showDashboard() {
		const wasInGame = Boolean(this.screen);
		this.closeGame();
		document.body.classList.remove('in-game');
		document.title = 'PocketGames · Play Instantly. No Downloads.';
		this.gameView.hidden = true;
		this.dashboard.hidden = false;
		if (wasInGame) {
			this.dashboard.classList.remove('entering');
			void this.dashboard.offsetWidth;
			this.dashboard.classList.add('entering');
		}
		this.topbar.hidden = false;
		// bring the status and install controls back from the game header
		this.controls.prepend(this.status, this.installButton);
		// sound may have been toggled from the game header
		this.soundButton.innerHTML = audio.enabled ? icon.soundOn : icon.soundOff;
		this.renderSections();
		if (wasInGame) window.scrollTo(0, this.dashboardScroll ?? 0);
		this.showEngineLine();
	}
}
