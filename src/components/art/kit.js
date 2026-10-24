// Drawing helpers for the game thumbnails. Every scene is SVG markup in a 160 × 100 box
// (the 16:10 shape of a game card), with the subject kept inside x 16…144 so the 4:3
// compact cards, which crop the sides, still show all of it. `u(name)` makes ids unique
// per game, so gradients never collide when a hundred cards share one page.

export const WHITE = '#ffffff';
export const INK = '#0f172a';

/** Mixes a #rrggbb colour toward black (k < 0) or white (k > 0). */
export function tone(hex, k) {
	const n = parseInt(hex.slice(1), 16);
	const mix = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
	const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
	return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Bold centred text. */
export const txt = (x, y, size, value, fill = WHITE, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="800" font-family="system-ui,Segoe UI,sans-serif" text-anchor="middle" fill="${fill}" ${extra}>${value}</text>`;

/** A soft contact shadow. */
export const shadow = (cx, cy, rx, ry = rx * 0.3, opacity = 0.3) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${opacity}"/>`;

/** A shaded sphere (balls, marbles, planets). */
export function sphere(u, key, cx, cy, r, color, { shine = 0.85 } = {}) {
	const id = u(key);
	return `<radialGradient id="${id}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="${shine}"/><stop offset="0.28" stop-color="${color}"/><stop offset="1" stop-color="${tone(color, -0.45)}"/></radialGradient><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`;
}

/** Many spheres of one colour sharing a single gradient: `pts` is [[cx, cy], …]. */
export function spheres(u, key, color, pts, r, { shine = 0.85 } = {}) {
	const id = u(key);
	return `<radialGradient id="${id}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="${shine}"/><stop offset="0.28" stop-color="${color}"/><stop offset="1" stop-color="${tone(color, -0.45)}"/></radialGradient>` + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id})"/>`).join('');
}

/** A vertical linear gradient definition; returns [defs, fillUrl]. */
export function vgrad(u, key, top, bottom) {
	const id = u(key);
	return [`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`, `url(#${id})`];
}

/** A rounded box with a lighter top face, for tiles, bricks and buttons. */
export const tile = (x, y, w, h, color, r = 3) => `<rect x="${x}" y="${y + 1.5}" width="${w}" height="${h}" rx="${r}" fill="${tone(color, -0.35)}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${color}"/><rect x="${x + 1.5}" y="${y + 1}" width="${w - 3}" height="${Math.min(3, h / 4)}" rx="${r / 2}" fill="#fff" opacity="0.3"/>`;

const SUIT = { s: ['♠', '#1e293b'], h: ['♥', '#e11d48'], d: ['♦', '#e11d48'], c: ['♣', '#1e293b'] };

/** A playing card, face up. `rot` turns it around its centre. */
export function card(x, y, w, h, rank, suit, rot = 0) {
	const [glyph, color] = SUIT[suit];
	const t = rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : '';
	return `<g${t}><rect x="${x + 1}" y="${y + 2}" width="${w}" height="${h}" rx="${w * 0.12}" fill="#000" opacity="0.25"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.12}" fill="#fdfdfd" stroke="#cbd5e1" stroke-width="0.6"/>${txt(x + w * 0.2, y + h * 0.24, w * 0.26, rank, color)}${txt(x + w * 0.2, y + h * 0.42, w * 0.22, glyph, color)}${txt(x + w * 0.58, y + h * 0.76, w * 0.5, glyph, color)}</g>`;
}

/** A playing card, face down. */
export function cardBack(x, y, w, h, rot = 0, color = '#3a4fd6') {
	const t = rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : '';
	return `<g${t}><rect x="${x + 1}" y="${y + 2}" width="${w}" height="${h}" rx="${w * 0.12}" fill="#000" opacity="0.25"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w * 0.12}" fill="${color}" stroke="#fff" stroke-width="1.4"/><rect x="${x + w * 0.16}" y="${y + w * 0.16}" width="${w * 0.68}" height="${h - w * 0.32}" rx="${w * 0.06}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="0.8"/><path d="M${x + w / 2} ${y + h * 0.35} l${w * 0.14} ${h * 0.15} l${-w * 0.14} ${h * 0.15} l${-w * 0.14} ${-h * 0.15} z" fill="#fff" opacity="0.5"/></g>`;
}

/** A field of small stars. */
export function stars(n, seed = 1, color = WHITE) {
	let s = seed * 9301 + 49297, out = '';
	const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
	for (let i = 0; i < n; i++) out += `<circle cx="${(rnd() * 160).toFixed(1)}" cy="${(rnd() * 100).toFixed(1)}" r="${(0.4 + rnd() * 0.9).toFixed(2)}" fill="${color}" opacity="${(0.4 + rnd() * 0.6).toFixed(2)}"/>`;
	return out;
}

/** A glowing stroke (neon lines): a wide faint copy under a crisp one. */
export const neon = (d, color, width = 3) => `<path d="${d}" stroke="${color}" stroke-width="${width * 3}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.25"/><path d="${d}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;

/** A four-point sparkle. */
export const sparkle = (x, y, r, color = WHITE) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${color}"/>`;

/** Motion lines trailing to the left of (x, y). */
export const speed = (x, y, n = 3, len = 16, color = WHITE) => Array.from({ length: n }, (_, i) => `<path d="M${x - 4} ${y - (n - 1) * 3 + i * 6} h${-len + i * 3}" stroke="${color}" stroke-width="2" stroke-linecap="round" opacity="${0.7 - i * 0.15}"/>`).join('');
