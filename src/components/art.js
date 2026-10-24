// Game thumbnails as inline SVG scenes over the game's gradient: crisp at any size, no
// image downloads, and cheap enough that a grid of a hundred cards costs nothing to draw.
// Every scene is drawn in a 160 × 100 box, the cards' own 16:10 shape, so nothing is
// cropped; the scenes live in ./art/ (helpers in ./art/kit.js).

import { CLASSIC } from './art/scenes-classic.js';
import { ACTION } from './art/scenes-action.js';
import { NEW } from './art/scenes-new.js';

const SCENES = { ...CLASSIC, ...ACTION, ...NEW };
const cache = new Map();

/**
 * The thumbnail SVG markup for a game: its scene by id, or (for a game without one) the
 * square `art.svg` from its registry entry, centred in the card.
 */
export function gameArt(game) {
	let markup = cache.get(game.id);
	if (markup) return markup;
	const { from, to } = game.art;
	const id = `g-${game.id}`;
	const u = (name) => `${id}-${name}`;
	const scene = SCENES[game.id];
	const body = scene ? scene(u) : `<g transform="translate(30 0)">${game.art.svg ?? ''}</g>`;
	markup = `<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<radialGradient id="${id}-l" cx="0.25" cy="0.15" r="0.95"><stop offset="0" stop-color="#fff" stop-opacity="0.3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.28"/></radialGradient></defs>
<rect width="160" height="100" fill="url(#${id})"/><rect width="160" height="100" fill="url(#${id}-l)"/>
<g>${body}</g><rect width="160" height="100" fill="url(#${id}-v)"/></svg>`;
	cache.set(game.id, markup);
	return markup;
}
