// Shared geometries and materials. Games ask for them by parameters and get the same
// instance back, so a scene with fifty identical boxes uploads one box. These are never
// disposed by a stage: they live for the whole session and cost a few kilobytes.

import { THREE } from './wamr3d.js';
import { theme, themeColors } from '../services/theme.js';

const geometries = new Map();
const materials = new Map();

function cached(map, key, make) {
	let value = map.get(key);
	if (value === undefined) map.set(key, (value = make()));
	return value;
}

export const geo = {
	box: (w = 1, h = 1, d = 1) => cached(geometries, `box:${w}:${h}:${d}`, () => new THREE.BoxGeometry(w, h, d)),
	sphere: (r = 1, ws = 24, hs = 16) => cached(geometries, `sphere:${r}:${ws}:${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
	cylinder: (rt = 1, rb = 1, h = 1, s = 24) => cached(geometries, `cyl:${rt}:${rb}:${h}:${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
	cone: (r = 1, h = 1, s = 20) => cached(geometries, `cone:${r}:${h}:${s}`, () => new THREE.ConeGeometry(r, h, s)),
	plane: (w = 1, h = 1) => cached(geometries, `plane:${w}:${h}`, () => new THREE.PlaneGeometry(w, h)),
	torus: (r = 1, t = 0.3, rs = 12, ts = 32) => cached(geometries, `torus:${r}:${t}:${rs}:${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)),
	icosa: (r = 1, d = 0) => cached(geometries, `ico:${r}:${d}`, () => new THREE.IcosahedronGeometry(r, d)),
	octa: (r = 1) => cached(geometries, `octa:${r}`, () => new THREE.OctahedronGeometry(r)),
	capsule: (r = 0.5, l = 1) => cached(geometries, `capsule:${r}:${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 12)),
	circle: (r = 1, s = 32) => cached(geometries, `circle:${r}:${s}`, () => new THREE.CircleGeometry(r, s)),
	ring: (ri = 0.5, ro = 1, s = 32) => cached(geometries, `ring:${ri}:${ro}:${s}`, () => new THREE.RingGeometry(ri, ro, s)),
};

/** A shared standard material. `opts` may set roughness, metalness, emissive, transparent, opacity. */
export function standard(color, opts = {}) {
	const key = `std:${color}:${JSON.stringify(opts)}`;
	return cached(materials, key, () => {
		const { emissive, emissiveIntensity, ...rest } = opts;
		const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...rest });
		if (emissive !== undefined) material.emissive = new THREE.Color(emissive);
		if (emissiveIntensity !== undefined) material.emissiveIntensity = emissiveIntensity;
		return material;
	});
}

/** A shared unlit material, for glowing details and backdrops. */
export function basic(color, opts = {}) {
	return cached(materials, `basic:${color}:${JSON.stringify(opts)}`, () => new THREE.MeshBasicMaterial({ color, ...opts }));
}

/** The PocketGames palette, used by the hero and the 3D games so they read as one product. */
export const palette = {
	night: 0x0b1020,
	deep: 0x111833,
	blue: 0x4f8cff,
	violet: 0x8b5cf6,
	pink: 0xf472b6,
	amber: 0xfbbf24,
	mint: 0x34d399,
	coral: 0xfb7185,
	white: 0xf4f6ff,
	grass: 0x3fae5a,
	wood: 0xc08a54,
	asphalt: 0x2a2f3a,
};

// ---------------------------------------------------------------- theme-aware materials

const themedMaterials = [];
const ROLES = { primary: 'primary', secondary: 'secondary', tertiary: 'tertiary', highlight: 'primaryHover' };

/**
 * A shared material whose colour (and glow) follows the site theme: neon trim, accents
 * and UI-like details. Game pieces keep their fixed colours so games stay readable.
 * `glow` sets the emissive strength; `basic: true` makes it unlit.
 */
export function themed(role = 'primary', { glow = 0, basic: unlit = false, ...opts } = {}) {
	const key = `themed:${role}:${glow}:${unlit}:${JSON.stringify(opts)}`;
	return cached(materials, key, () => {
		const material = unlit
			? new THREE.MeshBasicMaterial({ color: 0xffffff, ...opts })
			: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1, ...opts });
		const entry = { material, role, glow, unlit };
		themedMaterials.push(entry);
		tint(entry, themeColors());
		return material;
	});
}

function tint({ material, role, glow, unlit }, colors) {
	const value = colors[ROLES[role] ?? 'primary'];
	if (!value) return;
	material.color.set(value);
	if (!unlit && glow) {
		material.emissive = material.emissive ?? new THREE.Color();
		material.emissive.set(value);
		material.emissiveIntensity = glow;
	}
}

/** The current theme accent as a THREE.Color, for lights and particles. */
export function themeColor(role = 'primary', target = new THREE.Color()) {
	return target.set(themeColors()[ROLES[role] ?? 'primary'] || '#4f8cff');
}

theme.subscribe((colors) => { for (const entry of themedMaterials) tint(entry, colors); });
