// A game card for the dashboard grids and rails.

import { h, icon } from './dom.js';
import { gameArt } from './art.js';
import { categoryLabel } from '../games/registry.js';
import { store } from '../services/storage.js';
import { audio } from '../services/audio.js';

export function formatScore(game, value) {
	if (value == null || !game.score) return null;
	return game.score.format && typeof value === 'number' ? game.score.format(value) : String(value);
}

export function gameCard(game, { compact = false, progress = null } = {}) {
	const fav = store.isFavorite(game.id);
	const best = formatScore(game, store.best(game.id));
	const favButton = h('button.card-fav', {
		type: 'button',
		'aria-pressed': String(fav),
		'aria-label': fav ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`,
		html: fav ? icon.heartFill : icon.heart,
		onclick: (e) => {
			e.preventDefault();
			e.stopPropagation();
			const added = store.toggleFavorite(game.id);
			audio.play(added ? 'pop' : 'click');
		},
	});
	return h(`a.game-card${compact ? '.compact' : ''}`, { href: `#/play/${game.id}`, dataset: { id: game.id }, 'aria-label': `Play ${game.title}` },
		h('div.card-art', { html: gameArt(game) },
			h('div.card-badges',
				game.three && h('span.badge.badge-3d', { title: 'Rendered in 3D with WAMR3D', html: `${icon.cube}<span>3D</span>` }),
				game.isNew && h('span.badge.badge-new', 'New'),
				progress && h('span.badge.badge-resume', 'Saved'),
			),
			h('span.card-play', { html: icon.play }),
		),
		favButton,
		h('div.card-body',
			h('h3.card-title', game.title),
			!compact && h('p.card-blurb', game.blurb),
			h('div.card-meta',
				h('span.card-cat', categoryLabel(game.categories[0])),
				best && h('span.card-best', { title: `Your best ${game.score.label.toLowerCase()}`, html: `${icon.trophy}<span>${best}</span>` }),
			),
		),
	);
}
