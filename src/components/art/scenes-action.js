// Thumbnails for the fluid and physics games and the later arcade and racing games.

import { WHITE, INK, tone, txt, shadow, sphere, spheres, tile, stars, neon, sparkle, speed } from './kit.js';

/** Overlapping translucent blobs, for liquids. */
const blobs = (pts, color, r = 4) => pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${r + (i % 3) * 0.6}" fill="${color}" opacity="0.85"/>`).join('');

export const ACTION = {
	'fluid-playground': (u) => {
		const swirl = (d, c, w, o) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" opacity="${o}"/>`;
		return `<rect width="160" height="100" fill="#0b1026" opacity="0.55"/>` +
			swirl('M10 70 C40 20 70 90 92 52 S126 14 150 40', '#f43f5e', 16, 0.35) + swirl('M10 70 C40 20 70 90 92 52 S126 14 150 40', '#fb7185', 7, 0.9) +
			swirl('M14 86 C48 56 76 100 104 70 S140 64 154 78', '#38bdf8', 13, 0.35) + swirl('M14 86 C48 56 76 100 104 70 S140 64 154 78', '#7dd3fc', 5, 0.9) +
			swirl('M84 46 C70 30 96 18 108 30 C120 44 100 60 90 50 C84 44 92 36 98 40', '#fde047', 4, 0.95) +
			swirl('M20 28 C34 14 50 30 40 40', '#a78bfa', 5, 0.8) + sparkle(130, 20, 4, '#fff') + sparkle(30, 56, 3, '#fff') +
			`<circle cx="98" cy="40" r="3" fill="#fff"/><path d="M110 76 l6 -10 l4 3 z" fill="#fff" opacity="0.8"/>`;
	},

	'sand-box': () => {
		// one path per material keeps a few hundred pixels to a handful of elements
		const paths = {};
		const put = (x, y, c) => { paths[c] = (paths[c] ?? '') + `M${x} ${y}h4v4h-4z`; };
		for (let x = 0; x < 160; x += 4) {
			const sand = 78 - Math.max(0, 22 - Math.abs(x - 52) * 0.6), water = x > 92 ? 70 : 200;
			for (let y = sand; y < 100; y += 4) put(x, y, (x + y) % 12 ? '#fbbf24' : '#f59e0b');
			for (let y = water; y < sand && y < 100; y += 4) put(x, y, (x + y) % 8 ? '#3b82f6' : '#60a5fa');
		}
		for (let x = 104; x < 132; x += 4) for (let y = 30; y < 46; y += 4) put(x, y, '#78716c');
		for (let i = 0; i < 8; i++) put(112 + (i % 3) * 4, 18 - i * 2, ['#ef4444', '#f97316', '#fde047'][i % 3]);
		for (let i = 0; i < 9; i++) put(48 + (i % 2) * 4, 8 + i * 5, '#fbbf24');
		return Object.entries(paths).map(([c, d]) => `<path d="${d}" fill="${c}"/>`).join('') + `<path d="M44 0 h16 v6 h-16z" fill="#a16207"/>`;
	},

	'water-flow': () => `<path d="M14 0 V22 Q14 30 22 30 H58" stroke="#94a3b8" stroke-width="10" fill="none"/>` +
		`<rect x="40" y="40" width="54" height="7" rx="3" fill="#a16207" transform="rotate(14 67 43)"/><rect x="98" y="58" width="6" height="22" rx="2" fill="#e11d48"/>` +
		blobs([[60, 30], [65, 33], [70, 37], [74, 40], [80, 47], [86, 49], [90, 52], [92, 58], [94, 64], [96, 70], [94, 76], [100, 82], [106, 84], [112, 86], [118, 86], [124, 85], [116, 82], [122, 80]], '#38bdf8', 3.4) +
		`<path d="M108 64 V92 H140 V64" stroke="${WHITE}" stroke-width="3" fill="none"/><rect x="110" y="80" width="28" height="11" fill="#38bdf8" opacity="0.6"/>${txt(124, 74, 9, '★', '#fde047')}`,

	'liquid-sort': (u) => [['#ef4444', '#3b82f6', '#22c55e', '#ef4444'], ['#3b82f6', '#22c55e', '#facc15', '#3b82f6'], ['#facc15', '#facc15', '#22c55e'], ['#a855f7', '#a855f7', '#a855f7', '#a855f7'], []].map((layers, i) => {
		const x = 22 + i * 26, tilt = i === 2 ? ' transform="rotate(-28 110 40)"' : '';
		const xx = i === 2 ? 104 : x, yy = i === 2 ? 12 : 22;
		return `<g${tilt}>${layers.map((c, k) => `<rect x="${xx + 1}" y="${yy + 62 - (k + 1) * 14}" width="14" height="14.5" fill="${c}"/>`).join('')}<path d="M${xx} ${yy} V${yy + 56} Q${xx} ${yy + 64} ${xx + 8} ${yy + 64} Q${xx + 16} ${yy + 64} ${xx + 16} ${yy + 56} V${yy}" stroke="#e2e8f0" stroke-width="1.6" fill="rgba(255,255,255,0.08)"/><rect x="${xx + 3}" y="${yy + 4}" width="2.5" height="48" rx="1" fill="#fff" opacity="0.35"/></g>`;
	}).join('') + `<path d="M98 38 Q124 40 128 66" stroke="#facc15" stroke-width="3.5" fill="none"/>`,

	'fluid-maze': () => `<rect x="14" y="8" width="132" height="84" rx="4" fill="rgba(0,0,0,0.3)"/>` +
		`<path d="M14 8 H146 V92 H14 Z M14 32 H96 M40 56 H146 M14 76 H104" stroke="#94a3b8" stroke-width="5" fill="none"/>` +
		blobs([[24, 18], [32, 20], [40, 18], [48, 20], [56, 19], [64, 21], [72, 19], [80, 20], [88, 22], [100, 22], [108, 28], [112, 36], [114, 44], [104, 46], [94, 46], [84, 46], [74, 46], [64, 46], [54, 46], [44, 46], [30, 48], [26, 60], [32, 66], [44, 66], [56, 66], [68, 66], [80, 66], [92, 66], [104, 66], [116, 68], [124, 76]], '#38bdf8', 3.4) +
		`<rect x="116" y="78" width="24" height="12" rx="2" fill="#22c55e" opacity="0.7"/>${txt(128, 88, 9, 'GOAL', WHITE)}`,

	'dig-flow': () => `<rect x="0" y="22" width="160" height="78" fill="#92400e"/><rect x="0" y="22" width="160" height="5" fill="#65a30d"/>` +
		Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 37) % 160}" cy="${34 + (i * 23) % 62}" r="1.5" fill="#78350f"/>`).join('') +
		`<path d="M44 22 V40 Q44 52 58 52 H86 Q100 52 100 66 V84" stroke="#3b1d0e" stroke-width="13" fill="none" stroke-linecap="round"/>` +
		blobs([[44, 26], [45, 34], [46, 42], [52, 50], [62, 52], [72, 52], [82, 52], [92, 55], [98, 62], [100, 70], [100, 78]], '#38bdf8', 3.4) +
		`<rect x="30" y="4" width="28" height="16" rx="3" fill="#64748b"/><rect x="34" y="10" width="20" height="8" fill="#38bdf8"/><path d="M88 84 h24 l-3 12 h-18 z" fill="#cbd5e1"/><rect x="91" y="88" width="18" height="6" fill="#38bdf8"/>` +
		`<g transform="rotate(30 128 40)"><rect x="126" y="24" width="3" height="24" fill="#a16207"/><path d="M120 22 h16 l-3 6 h-10 z" fill="#94a3b8"/></g>`,

	'magnet-lab': (u) => `<path d="M24 22 Q24 62 54 62 Q84 62 84 22" stroke="#ef4444" stroke-width="13" fill="none"/><path d="M24 22 v-8 M84 22 v-8" stroke="#e2e8f0" stroke-width="13"/>` + txt(24, 18, 8, 'N', INK) + txt(84, 18, 8, 'S', INK) +
		[0, 1, 2].map((i) => `<path d="M30 ${30 + i * 8} Q54 ${4 - i * 6} 78 ${30 + i * 8}" stroke="#93c5fd" stroke-width="0.8" fill="none" stroke-dasharray="2 2" opacity="0.8"/>`).join('') +
		`<path d="M20 86 Q70 96 96 70 T138 40" stroke="#fde047" stroke-width="1.5" fill="none" stroke-dasharray="3 3"/>` + sphere(u, 'ball', 96, 70, 6, '#cbd5e1') +
		`<circle cx="138" cy="40" r="10" fill="none" stroke="#4ade80" stroke-width="3"/><circle cx="138" cy="40" r="4" fill="#4ade80"/>`,

	'gravity-well': (u) => stars(30, 11) + `<circle cx="78" cy="54" r="30" fill="none" stroke="#60a5fa" stroke-width="0.8" opacity="0.5"/><circle cx="78" cy="54" r="21" fill="none" stroke="#60a5fa" stroke-width="0.8" opacity="0.7"/>` +
		sphere(u, 'planet', 78, 54, 13, '#3b82f6', { shine: 0.5 }) + sphere(u, 'small', 132, 74, 6, '#f97316', { shine: 0.5 }) +
		`<path d="M14 90 Q30 40 64 30 Q100 22 108 46 Q114 66 132 24" stroke="#fde047" stroke-width="1.6" fill="none" stroke-dasharray="3 3"/>` + `<circle cx="14" cy="90" r="4" fill="#f8fafc"/>` +
		`<circle cx="134" cy="20" r="9" fill="none" stroke="#4ade80" stroke-width="2.5"/>` + sparkle(134, 20, 3, '#4ade80'),

	'chain-reaction': () => [[40, 40, 24, '#f472b6'], [78, 60, 20, '#a78bfa'], [110, 34, 18, '#38bdf8'], [128, 72, 12, '#fde047'], [56, 80, 10, '#34d399']].map(([x, y, r, c]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.35"/><circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="2"/>`).join('') +
		[[18, 20, '#fb7185'], [146, 18, '#22d3ee'], [22, 74, '#facc15'], [150, 92, '#f472b6'], [96, 90, '#a3e635'], [92, 12, '#c084fc']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c}"/>`).join('') + sparkle(40, 40, 6) + sparkle(110, 34, 5),

	'domino-cascade': () => `<rect x="0" y="80" width="160" height="20" fill="rgba(0,0,0,0.25)"/>` + [0, 1, 2, 3, 4, 5, 6].map((i) => {
		const x = 18 + i * 19, a = i < 3 ? 62 : i === 3 ? 32 : 0;
		return `<g transform="rotate(${a} ${x + 9} 80)"><rect x="${x}" y="44" width="9" height="36" rx="2" fill="#f8fafc" stroke="${INK}" stroke-width="1"/><path d="M${x} 62 h9" stroke="${INK}" stroke-width="1"/><circle cx="${x + 4.5}" cy="52" r="1.5" fill="${INK}"/><circle cx="${x + 4.5}" cy="71" r="1.5" fill="${INK}"/></g>`;
	}).join('') + `<path d="M70 40 q8 -10 18 -4" stroke="#fde047" stroke-width="1.5" fill="none"/><path d="M86 33 l3 3 l-4 1" stroke="#fde047" stroke-width="1.5" fill="none"/>` +
		`<path d="M138 80 V58 l12 -6 v28 z" fill="#facc15"/>${txt(144, 72, 8, '★', '#92400e')}`,

	'bridge-builder': () => `<path d="M0 46 H36 V100 H0 Z M124 46 H160 V100 H124 Z" fill="#78350f"/><path d="M0 46 H36 M124 46 H160" stroke="#65a30d" stroke-width="4"/><rect x="36" y="80" width="88" height="20" fill="#0ea5e9" opacity="0.8"/>` +
		`<path d="M36 50 H124 M36 50 L58 72 L80 50 L102 72 L124 50 M58 72 H102" stroke="#b45309" stroke-width="3" fill="none"/>` + [36, 58, 80, 102, 124].map((x, i) => `<circle cx="${x}" cy="${i % 2 ? 72 : 50}" r="2.6" fill="#e2e8f0" stroke="${INK}"/>`).join('') +
		`<rect x="62" y="34" width="26" height="12" rx="2" fill="#f59e0b"/><rect x="80" y="30" width="10" height="10" rx="2" fill="#f59e0b"/><rect x="82" y="32" width="6" height="4" fill="#bae6fd"/><circle cx="68" cy="47" r="3.5" fill="${INK}"/><circle cx="84" cy="47" r="3.5" fill="${INK}"/>`,

	'marble-run': (u) => `<path d="M14 18 L70 32 M70 32 L64 36 M140 40 L84 56 M84 56 L90 60 M20 64 L76 80 L150 86" stroke="#e2e8f0" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M14 22 L70 36 M140 44 L84 60" stroke="#94a3b8" stroke-width="1.5"/>` +
		sphere(u, 'm1', 36, 17, 5, '#f43f5e') + sphere(u, 'm2', 110, 42, 5, '#3b82f6') + sphere(u, 'm3', 58, 69, 5, '#facc15') +
		`<path d="M128 70 h18 v14 h-18 z" fill="#22c55e" opacity="0.5" stroke="#22c55e"/>${txt(137, 80, 8, 'END')}` + speed(30, 17, 2, 10),

	'moon-lander': () => stars(40, 5) + `<circle cx="134" cy="18" r="9" fill="#93c5fd" opacity="0.8"/><path d="M0 80 L20 72 L36 82 L60 70 L84 70 L100 84 L124 74 L160 86 V100 H0 Z" fill="#9ca3af"/><circle cx="30" cy="88" r="3" fill="#6b7280"/><circle cx="120" cy="90" r="4" fill="#6b7280"/>` +
		`<rect x="60" y="68" width="24" height="3" fill="#22c55e"/>` +
		`<g transform="rotate(8 74 44)"><path d="M66 40 h16 l3 10 h-22 z" fill="#e5e7eb"/><circle cx="74" cy="34" r="8" fill="#cbd5e1"/><circle cx="74" cy="34" r="4" fill="#38bdf8"/><path d="M66 50 L60 58 M82 50 L88 58" stroke="#e5e7eb" stroke-width="2"/><path d="M70 50 L74 64 L78 50 Z" fill="#fb923c"/><path d="M72 50 L74 58 L76 50 Z" fill="#fde047"/></g>`,

	'ripple-pond': (u) => `<ellipse cx="80" cy="54" rx="74" ry="40" fill="#0ea5e9" opacity="0.6"/>` + [8, 16, 24, 32].map((r, i) => `<ellipse cx="66" cy="52" rx="${r * 1.6}" ry="${r * 0.8}" fill="none" stroke="#e0f2fe" stroke-width="${1.6 - i * 0.3}" opacity="${0.9 - i * 0.2}"/>`).join('') +
		`<ellipse cx="124" cy="70" rx="14" ry="6" fill="#16a34a"/><path d="M124 70 L136 66" stroke="#0ea5e9" stroke-width="2"/><ellipse cx="34" cy="78" rx="10" ry="4" fill="#22c55e"/><circle cx="36" cy="76" r="2.5" fill="#f472b6"/>` +
		`<ellipse cx="112" cy="40" rx="9" ry="5" fill="#facc15"/><circle cx="118" cy="34" r="5" fill="#facc15"/><path d="M122 34 l5 1 l-5 1.5 z" fill="#f97316"/><circle cx="119" cy="33" r="1" fill="${INK}"/>` + `<circle cx="66" cy="52" r="3" fill="#fff"/>`,

	'rock-drift': () => stars(36, 13) + [[40, 34, 16], [118, 70, 12], [130, 22, 8], [26, 80, 7]].map(([x, y, r], i) => `<path d="${Array.from({ length: 9 }, (_, k) => { const a = (k / 9) * Math.PI * 2, rr = r * (0.8 + ((k * 7 + i) % 4) * 0.08); return `${k ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }).join(' ')} Z" fill="#44403c" stroke="#e7e5e4" stroke-width="1.6"/>`).join('') +
		`<g transform="rotate(-35 82 62)"><path d="M82 50 L92 74 L82 68 L72 74 Z" fill="#1e3a8a" stroke="#93c5fd" stroke-width="1.6"/><path d="M78 72 L82 82 L86 72" fill="#fb923c"/></g>` +
		[[74, 46], [66, 38], [58, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fde047"/>`).join(''),

	'swarm-survivor': () => `<rect width="160" height="100" fill="#1e1b4b" opacity="0.5"/>` + Array.from({ length: 22 }, (_, i) => {
		const a = i * 0.55, r = 30 + (i % 4) * 9, x = 80 + Math.cos(a) * r * 1.5, y = 50 + Math.sin(a) * r * 0.85;
		return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${3 + (i % 3)}" fill="${['#ef4444', '#a855f7', '#f97316'][i % 3]}"/><circle cx="${(x + 1).toFixed(1)}" cy="${(y - 1).toFixed(1)}" r="1" fill="#fff"/>`;
	}).join('') + `<circle cx="80" cy="50" r="22" fill="#38bdf8" opacity="0.15" stroke="#38bdf8" stroke-dasharray="3 3"/>` +
		[0, 1, 2, 3].map((k) => { const a = k * 1.57 + 0.4; return `<circle cx="${(80 + Math.cos(a) * 16).toFixed(1)}" cy="${(50 + Math.sin(a) * 16).toFixed(1)}" r="2.5" fill="#fde047"/>`; }).join('') +
		`<circle cx="80" cy="50" r="7" fill="#e0f2fe"/><circle cx="80" cy="50" r="4" fill="#0ea5e9"/>`,

	'rhythm-tap': () => `<rect x="36" y="0" width="88" height="100" fill="rgba(0,0,0,0.35)"/>` + [0, 1, 2, 3].map((i) => `<path d="M${47 + i * 22} 0 V100" stroke="rgba(255,255,255,0.12)" stroke-width="20"/>`).join('') +
		[[0, 20, '#f472b6'], [1, 46, '#22d3ee'], [2, 8, '#fde047'], [3, 32, '#a3e635'], [2, 62, '#fde047'], [0, 70, '#f472b6']].map(([l, y, c]) => `<rect x="${39 + l * 22}" y="${y}" width="16" height="8" rx="3" fill="${c}"/>`).join('') +
		neon('M36 80 H124', WHITE, 2) + `<circle cx="47" cy="80" r="11" fill="#f472b6" opacity="0.35"/>` + sparkle(47, 80, 7) + txt(140, 30, 10, '×4', '#fde047') + `<path d="M140 62 V44 l10 -3 v15" stroke="#fff" stroke-width="2" fill="none"/><circle cx="138" cy="62" r="3" fill="#fff"/><circle cx="148" cy="57" r="3" fill="#fff"/>`,

	'sky-strike': () => `<ellipse cx="30" cy="30" rx="18" ry="7" fill="#fff" opacity="0.5"/><ellipse cx="130" cy="64" rx="22" ry="8" fill="#fff" opacity="0.4"/>` +
		[[52, 18], [80, 10], [108, 18]].map(([x, y]) => `<path d="M${x} ${y + 12} L${x - 10} ${y} L${x} ${y + 3} L${x + 10} ${y} Z" fill="#ef4444"/><rect x="${x - 1.5}" y="${y}" width="3" height="10" fill="#7f1d1d"/>`).join('') +
		[[74, 56], [86, 56], [74, 44], [86, 44]].map(([x, y]) => `<rect x="${x - 1}" y="${y}" width="2.4" height="7" rx="1" fill="#fde047"/>`).join('') +
		`<circle cx="108" cy="24" r="9" fill="#f97316" opacity="0.5"/>` + sparkle(108, 24, 6, '#fde047') +
		`<path d="M80 62 L84 74 L100 80 L84 82 L82 92 L78 92 L76 82 L60 80 L76 74 Z" fill="#e2e8f0"/><path d="M80 62 L82 72 H78 Z" fill="#38bdf8"/><path d="M78 92 L80 99 L82 92" fill="#fb923c"/>`,

	'neon-pinball': (u) => `<rect x="28" y="2" width="104" height="96" rx="20" fill="#0a0620"/>` + neon('M28 98 V24 Q28 4 48 4 H112 Q132 4 132 24 V98', '#c084fc', 2) +
		[[60, 30, '#e879f9'], [100, 30, '#22d3ee'], [80, 48, '#fde047']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="10" fill="${c}" opacity="0.25"/><circle cx="${x}" cy="${y}" r="7" fill="${c}"/><circle cx="${x}" cy="${y}" r="3" fill="#fff"/>`).join('') +
		`<path d="M44 82 L70 92" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M116 82 L90 92" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>` + sphere(u, 'ball', 92, 66, 4.5, '#e2e8f0') +
		[44, 52, 108, 116].map((x) => `<rect x="${x - 2}" y="56" width="4" height="10" rx="1" fill="#f472b6"/>`).join(''),

	'city-shield': () => stars(20, 17) + `<path d="M0 100 V84 h12 v-10 h10 v14 h10 v-18 h12 v20 h14 v-8 h12 v10 h18 v-16 h12 v12 h14 v-14 h12 v18 h14 v-6 h10 V100 Z" fill="#1e293b"/>` +
		Array.from({ length: 14 }, (_, i) => `<rect x="${6 + i * 11}" y="${88 + (i % 3) * 3}" width="2" height="2" fill="#fde047"/>`).join('') +
		[[20, 0, 58, 54], [120, 0, 98, 40], [150, 0, 130, 30]].map(([x0, y0, x1, y1]) => `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#f87171" stroke-width="1.6"/><circle cx="${x1}" cy="${y1}" r="2.2" fill="#fecaca"/>`).join('') +
		`<path d="M80 84 L66 48" stroke="#a3e635" stroke-width="1" stroke-dasharray="2 2"/><circle cx="64" cy="46" r="14" fill="#fde047" opacity="0.5"/><circle cx="64" cy="46" r="8" fill="#fef9c3"/><path d="M74 84 h12 l-6 -8 z" fill="#a3e635"/>`,

	'bubble-burst': (u) => {
		const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7'];
		const groups = COLORS.map(() => []);
		for (let r = 0; r < 4; r++) for (let c = 0; c < 9 - (r % 2); c++) {
			if ((r === 3 && c > 5) || (r === 2 && c === 7)) continue;
			groups[(r * 3 + c * 2) % 5].push([20 + c * 15 + (r % 2) * 7.5, 9 + r * 13]);
		}
		return groups.map((pts, i) => spheres(u, `b${i}`, COLORS[i], pts, 7, { shine: 0.7 })).join('') +
			`<path d="M80 86 L104 64 L94 48" stroke="#fff" stroke-width="1" stroke-dasharray="2 3" fill="none"/>` + sphere(u, 'shot', 80, 86, 7, '#3b82f6', { shine: 0.7 }) +
			`<path d="M70 96 Q80 78 90 96" fill="#64748b"/>` + sparkle(122, 52, 4);
	},

	'neon-trails': () => `<rect width="160" height="100" fill="#030712" opacity="0.6"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M${i * 20} 0 V100 M0 ${i * 12.5} H160" stroke="#0e7490" stroke-width="0.4" opacity="0.6"/>`).join('') +
		neon('M14 80 H62 V30 H100 V54', '#22d3ee', 2.5) + neon('M150 16 H116 V70 H70 V94', '#f472b6', 2.5) + neon('M146 92 V80 H128', '#a3e635', 2.5) +
		`<rect x="96" y="52" width="8" height="8" rx="1" fill="#e0f2fe"/><rect x="66" y="90" width="8" height="8" rx="1" fill="#fce7f3"/>` + sparkle(100, 64, 4, '#22d3ee'),

	'hyper-tunnel': () => `<rect width="160" height="100" fill="#05010f" opacity="0.5"/>` + [46, 34, 24, 15, 8].map((r, i) => `<ellipse cx="80" cy="46" rx="${r * 1.6}" ry="${r}" fill="none" stroke="hsl(${280 + i * 20} 90% 62%)" stroke-width="${3.5 - i * 0.5}"/>`).join('') +
		Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<path d="M${(80 + Math.cos(a) * 12).toFixed(1)} ${(46 + Math.sin(a) * 7.5).toFixed(1)} L${(80 + Math.cos(a) * 80).toFixed(1)} ${(46 + Math.sin(a) * 50).toFixed(1)}" stroke="#a78bfa" stroke-width="0.5" opacity="0.5"/>`; }).join('') +
		`<rect x="100" y="20" width="14" height="8" fill="#f43f5e"/><rect x="56" y="62" width="12" height="7" fill="#f43f5e"/><circle cx="96" cy="58" r="3" fill="#fde047"/>` +
		`<path d="M80 74 L90 88 H70 Z" fill="#e0f2fe"/><path d="M76 88 L80 96 L84 88" fill="#22d3ee"/>`,

	'drift-king': () => `<path d="M-10 92 C40 92 60 30 100 26 S170 40 170 40" stroke="#374151" stroke-width="30" fill="none"/><path d="M-10 92 C40 92 60 30 100 26 S170 40 170 40" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="6 6" fill="none"/>` +
		`<path d="M30 80 Q46 76 56 62" stroke="#111827" stroke-width="3" fill="none" opacity="0.6"/><path d="M38 86 Q54 82 62 68" stroke="#111827" stroke-width="3" fill="none" opacity="0.6"/>` +
		[[34, 74, 9], [26, 80, 11], [44, 70, 7]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#e5e7eb" opacity="0.45"/>`).join('') +
		`<g transform="rotate(-62 74 54)"><rect x="62" y="46" width="26" height="15" rx="4" fill="#f43f5e"/><rect x="73" y="48" width="9" height="11" rx="2" fill="#1f2937"/><rect x="86" y="47" width="2" height="4" fill="#fde047"/><rect x="86" y="56" width="2" height="4" fill="#fde047"/></g>` + txt(112, 86, 10, 'DRIFT ×3', '#fde047'),

	'hill-rider': () => `<path d="M0 74 Q30 50 60 68 T120 60 T170 62 V100 H0 Z" fill="#78350f"/><path d="M0 74 Q30 50 60 68 T120 60 T170 62" stroke="#a3e635" stroke-width="3" fill="none"/>` +
		`<circle cx="138" cy="20" r="10" fill="#fde68a" opacity="0.8"/>` +
		`<g transform="rotate(-14 80 44)"><circle cx="64" cy="54" r="9" fill="none" stroke="#111827" stroke-width="4"/><circle cx="96" cy="54" r="9" fill="none" stroke="#111827" stroke-width="4"/><path d="M64 54 L76 42 H90 L96 54 M76 42 L80 52 H90" stroke="#ef4444" stroke-width="3" fill="none"/><path d="M80 40 L76 26" stroke="#2563eb" stroke-width="5" stroke-linecap="round"/><circle cx="76" cy="20" r="6" fill="#f43f5e"/><rect x="70" y="18" width="10" height="3" fill="#1e293b"/><path d="M78 30 L90 38" stroke="#2563eb" stroke-width="3"/></g>` + speed(54, 44, 3, 12),

	'grand-prix': () => `<rect x="0" y="0" width="160" height="40" fill="#38bdf8" opacity="0.5"/><path d="M0 40 H160 V100 H0 Z" fill="#166534"/><path d="M50 40 L0 100 H160 L110 40 Z" fill="#3f3f46"/>` +
		`<path d="M50 40 L0 100" stroke="#ef4444" stroke-width="6" stroke-dasharray="6 6"/><path d="M110 40 L160 100" stroke="#ef4444" stroke-width="6" stroke-dasharray="6 6"/><path d="M80 40 V100" stroke="#f8fafc" stroke-width="1" stroke-dasharray="5 5"/>` +
		`<rect x="54" y="6" width="52" height="14" rx="3" fill="#111827"/>` + [0, 1, 2, 3, 4].map((i) => `<circle cx="${62 + i * 9}" cy="13" r="3.4" fill="${i < 5 ? '#22c55e' : '#334155'}"/>`).join('') +
		`<g transform="translate(80 78)"><path d="M-6 -16 h12 l4 22 h-20 z" fill="#ef4444"/><rect x="-18" y="2" width="36" height="5" rx="1" fill="#111827"/><rect x="-18" y="-20" width="36" height="4" rx="1" fill="#111827"/><rect x="-22" y="-6" width="9" height="14" rx="2" fill="#111827"/><rect x="13" y="-6" width="9" height="14" rx="2" fill="#111827"/><circle cx="0" cy="-6" r="3.5" fill="#fde047"/></g>` +
		`<g transform="translate(98 50) scale(0.45)"><path d="M-6 -16 h12 l4 22 h-20 z" fill="#3b82f6"/><rect x="-22" y="-6" width="9" height="14" rx="2" fill="#111827"/><rect x="13" y="-6" width="9" height="14" rx="2" fill="#111827"/></g>`,
};
