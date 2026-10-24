// Thumbnails for the first 38 games (arcade, puzzle, board, cards, racing, sports,
// platform). Each scene draws over the game's gradient in a 160 × 100 box; see kit.js.

import { WHITE, INK, tone, txt, shadow, sphere, vgrad, tile, card, cardBack, stars, neon, sparkle, speed } from './kit.js';

const grid = (x0, y0, cols, rows, size, color, width = 0.6) => {
	let d = '';
	for (let c = 0; c <= cols; c++) d += `M${x0 + c * size} ${y0} V${y0 + rows * size} `;
	for (let r = 0; r <= rows; r++) d += `M${x0} ${y0 + r * size} H${x0 + cols * size} `;
	return `<path d="${d}" stroke="${color}" stroke-width="${width}"/>`;
};

export const CLASSIC = {
	serpent: (u) => grid(0, 0, 16, 10, 10, 'rgba(255,255,255,0.08)') +
		`<path d="M22 78 H62 Q72 78 72 68 V44 Q72 34 82 34 H118" stroke="#15803d" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
		`<path d="M22 78 H62 Q72 78 72 68 V44 Q72 34 82 34 H118" stroke="#4ade80" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="0.1 9"/>` +
		`<circle cx="122" cy="34" r="9" fill="#22c55e"/><circle cx="125" cy="30" r="2.6" fill="${WHITE}"/><circle cx="125.8" cy="30" r="1.3" fill="${INK}"/><path d="M131 35 l6 -1 M131 35 l6 2" stroke="#ef4444" stroke-width="1.5"/>` +
		sphere(u, 'apple', 140, 72, 7, '#ef4444') + `<path d="M140 65 q2 -5 6 -5" stroke="#15803d" stroke-width="2" fill="none"/>`,

	'paddle-duel': () => `<rect x="10" y="8" width="140" height="84" rx="6" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.25)"/><path d="M80 12 V88" stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="5 5"/>` +
		txt(60, 30, 16, '3', 'rgba(255,255,255,0.7)') + txt(100, 30, 16, '2', 'rgba(255,255,255,0.7)') +
		neon('M24 38 V64', '#60a5fa', 5) + neon('M136 48 V74', '#f472b6', 5) +
		`<circle cx="98" cy="58" r="5" fill="#fde047"/><path d="M93 56 L62 44" stroke="#fde047" stroke-width="4" stroke-linecap="round" opacity="0.35"/>`,

	'brick-breaker': (u) => [0, 1, 2, 3].map((r) => Array.from({ length: 7 }, (_, c) => (r === 3 && (c === 2 || c === 3)) ? '' : tile(14 + c * 19, 10 + r * 10, 17, 8, ['#f43f5e', '#f59e0b', '#22c55e', '#38bdf8'][r], 2)).join('')).join('') +
		`<path d="M94 80 L74 54 L58 64" stroke="${WHITE}" stroke-width="1" stroke-dasharray="2 3" fill="none" opacity="0.7"/>` + sphere(u, 'b', 58, 63, 4.5, '#e2e8f0') +
		tile(80, 84, 34, 6, '#e2e8f0', 3) + `<rect x="58" y="42" width="5" height="3" fill="#22c55e" transform="rotate(30 60 43)"/><rect x="66" y="46" width="4" height="3" fill="#22c55e"/>`,

	'star-defender': () => stars(40, 3) + [0, 1].map((r) => [0, 1, 2, 3, 4].map((c) => {
		const x = 38 + c * 21, y = 14 + r * 16, col = r ? '#a3e635' : '#f472b6';
		return `<path d="M${x} ${y} h10 v3 h3 v5 h-3 v3 h-2 v-3 h-6 v3 h-2 v-3 h-3 v-5 h3 z" fill="${col}"/><rect x="${x + 2}" y="${y + 3}" width="2" height="2" fill="${INK}"/><rect x="${x + 6}" y="${y + 3}" width="2" height="2" fill="${INK}"/>`;
	}).join('')).join('') +
		neon('M80 72 V46', '#fde047', 2) + `<path d="M80 66 L90 88 H70 Z" fill="#e0f2fe"/><path d="M80 66 L84 80 H76 Z" fill="#38bdf8"/><path d="M70 88 L64 92 V84 Z M90 88 L96 92 V84 Z" fill="#94a3b8"/><path d="M76 90 L80 98 L84 90 Z" fill="#fb923c"/>`,

	'sky-hopper': (u) => `<ellipse cx="34" cy="22" rx="16" ry="6" fill="#fff" opacity="0.8"/><ellipse cx="128" cy="16" rx="13" ry="5" fill="#fff" opacity="0.7"/>` +
		[[52, 0, 34], [52, 66, 100], [112, 0, 22], [112, 54, 100]].map(([x, y0, y1]) => `<rect x="${x}" y="${y0}" width="18" height="${y1 - y0}" fill="#22c55e"/><rect x="${x - 3}" y="${y0 ? y0 : y1 - 7}" width="24" height="7" rx="2" fill="#16a34a"/>`).join('') +
		`<g transform="rotate(-12 86 50)"><path d="M72 50 L100 46 L104 50 L100 54 Z" fill="${WHITE}"/><path d="M84 49 L92 38 L96 38 L92 49 Z M84 51 L92 62 L96 62 L92 51 Z" fill="#ef4444"/><path d="M72 50 L68 44 L74 44 Z" fill="#ef4444"/></g>` + speed(70, 54, 3, 14),

	'mole-bonk': (u) => `<rect x="0" y="62" width="160" height="38" fill="#4d7c0f"/>` + [36, 80, 124].map((x) => `<ellipse cx="${x}" cy="78" rx="17" ry="6" fill="#1c1917"/>`).join('') +
		`<path d="M66 78 Q66 44 80 44 Q94 44 94 78 Z" fill="#92400e"/><ellipse cx="80" cy="60" rx="7" ry="5" fill="#fcd34d" opacity="0.4"/><circle cx="74" cy="56" r="2.6" fill="${INK}"/><circle cx="86" cy="56" r="2.6" fill="${INK}"/><ellipse cx="80" cy="63" rx="4" ry="3" fill="#fb7185"/>` +
		`<g transform="rotate(-35 116 40)"><rect x="110" y="14" width="34" height="16" rx="4" fill="#ef4444"/><rect x="124" y="30" width="6" height="34" rx="2" fill="#a16207"/></g>` +
		sparkle(98, 46, 5, '#fde047') + txt(130, 74, 13, '+10', '#fde047'),

	'neon-runner': () => `<path d="M0 66 H160" stroke="#c084fc" stroke-width="1" opacity="0.6"/><path d="M80 34 L10 100 M80 34 L150 100 M80 34 L56 100 M80 34 L104 100" stroke="#c4b5fd" stroke-width="1.2" opacity="0.7"/>` +
		[48, 58, 72, 92].map((y) => `<path d="M${80 - (y - 34) * 1.06} ${y} H${80 + (y - 34) * 1.06}" stroke="#a78bfa" stroke-width="0.8" opacity="0.5"/>`).join('') +
		`<circle cx="80" cy="30" r="16" fill="#f472b6" opacity="0.5"/><path d="M64 34 H96" stroke="#fde047" stroke-width="1.5"/>` +
		`<rect x="84" y="58" width="14" height="12" fill="#f43f5e"/><rect x="62" y="48" width="9" height="8" fill="#f43f5e" opacity="0.8"/>` +
		`<rect x="70" y="76" width="16" height="16" rx="3" fill="#22d3ee"/><rect x="72" y="78" width="12" height="3" fill="#fff" opacity="0.5"/>` + sparkle(110, 52, 4, '#fde047'),

	'nova-blaster': (u) => stars(45, 7) + sphere(u, 'p', 132, 24, 16, '#d97706', { shine: 0.4 }) + `<ellipse cx="132" cy="24" rx="26" ry="5" fill="none" stroke="#fcd34d" stroke-width="1.4" opacity="0.7"/>` +
		`<path d="M44 26 l8 -4 l6 6 l-2 8 l-9 2 l-6 -6 z" fill="#78716c"/><circle cx="50" cy="20" r="11" fill="#fb923c" opacity="0.35"/>` + sparkle(50, 22, 7, '#fde68a') +
		neon('M64 66 L52 36', '#7dd3fc', 2) + `<g transform="rotate(-20 72 76)"><path d="M72 58 L82 86 L72 80 L62 86 Z" fill="#e0f2fe"/><path d="M72 64 L76 76 H68 Z" fill="#38bdf8"/><path d="M68 84 L72 94 L76 84 Z" fill="#fb923c"/></g>`,

	'skyline-stack': () => `<path d="M0 100 V72 h12 v-14 h10 v20 h8 v-28 h12 v34 h10 V60 h14 v40 Z M112 100 V66 h12 v-20 h10 v28 h12 v-12 h14 v38 Z" fill="rgba(15,23,42,0.45)"/>` +
		[0, 1, 2, 3, 4, 5].map((i) => {
			const w = 46 - i * 2, x = 80 - w / 2 + (i % 2 ? 2 : -2), y = 86 - i * 12, c = ['#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'][i];
			return `<rect x="${x}" y="${y}" width="${w}" height="11" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="3" fill="#fff" opacity="0.35"/><rect x="${x + w - 6}" y="${y}" width="6" height="11" fill="#000" opacity="0.15"/>`;
		}).join('') +
		`<rect x="62" y="8" width="38" height="11" fill="#fde047"/><path d="M58 13 h-8 M108 13 h-8" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,

	'voxel-breaker': () => [0, 1, 2, 3].map((r) => Array.from({ length: 8 }, (_, c) => {
		const x = 22 + c * 15 + r * 2, y = 12 + r * 9, h = `hsl(${190 + r * 35 + c * 6} 85% ${60 - r * 4}%)`;
		return `<path d="M${x} ${y} h13 l3 -3 h-13 z" fill="${h}" opacity="0.8"/><rect x="${x}" y="${y}" width="13" height="8" fill="${h}"/><path d="M${x + 13} ${y} l3 -3 v8 l-3 3 z" fill="#000" opacity="0.25"/>`;
	}).join('')).join('') + `<circle cx="72" cy="66" r="5" fill="${WHITE}"/><circle cx="72" cy="66" r="9" fill="#fff" opacity="0.2"/><rect x="56" y="84" width="40" height="7" rx="3" fill="#60a5fa"/><rect x="56" y="84" width="40" height="2.5" rx="1" fill="#fff" opacity="0.5"/>`,

	'number-merge': () => `<rect x="38" y="6" width="84" height="88" rx="8" fill="#a8743f" opacity="0.55"/>` +
		[[2, '#eee4da', '#776e65'], [4, '#ede0c8', '#776e65'], [8, '#f2b179', WHITE], [16, '#f59563', WHITE], [32, '#f67c5f', WHITE], [64, '#f65e3b', WHITE], [128, '#edcf72', WHITE], [256, '#edcc61', WHITE], ['', '#cdc1b4', ''], [2, '#eee4da', '#776e65'], [512, '#edc850', WHITE], [2048, '#edc22e', WHITE]].map(([v, bg, fg], i) => {
			const x = 42 + (i % 4) * 20, y = 10 + Math.floor(i / 4) * 28;
			return `<rect x="${x}" y="${y}" width="18" height="24" rx="3" fill="${bg}"/>${v ? txt(x + 9, y + 16, String(v).length > 3 ? 6 : String(v).length > 2 ? 7.5 : 10, v, fg) : ''}`;
		}).join('') + sparkle(126, 76, 6, '#fde68a'),

	'block-drop': () => `<rect x="50" y="4" width="60" height="92" rx="3" fill="rgba(0,0,0,0.35)" stroke="rgba(255,255,255,0.3)"/>` +
		[[0, 8, '#22d3ee'], [1, 8, '#22d3ee'], [2, 8, '#22d3ee'], [3, 8, '#22d3ee'], [4, 8, '#f59e0b'], [4, 7, '#f59e0b'], [5, 8, '#f59e0b'], [0, 7, '#a855f7'], [1, 7, '#a855f7'], [1, 6, '#a855f7'], [2, 7, '#22c55e'], [3, 7, '#22c55e'], [3, 6, '#22c55e'], [5, 7, '#ef4444'], [5, 6, '#ef4444'], [4, 6, '#ef4444'], [0, 6, '#3b82f6'], [0, 5, '#3b82f6']]
			.map(([c, r, col]) => tile(51 + c * 9.6, 4 + r * 10.2, 9, 9.6, col, 1.5)).join('') +
		[[2, 1], [3, 1], [4, 1], [3, 2]].map(([c, r]) => tile(51 + c * 9.6, 4 + r * 10.2, 9, 9.6, '#facc15', 1.5)).join('') +
		`<path d="M80 36 V48" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 2" opacity="0.6"/>`,

	minefield: () => Array.from({ length: 30 }, (_, i) => {
		const c = i % 6, r = Math.floor(i / 6), x = 32 + c * 16, y = 6 + r * 18, open = [7, 8, 13, 14, 15, 19, 20, 21, 25, 26].includes(i);
		const n = { 8: [1, '#2563eb'], 14: [2, '#16a34a'], 15: [1, '#2563eb'], 20: [3, '#dc2626'], 21: [1, '#2563eb'], 26: [2, '#16a34a'] }[i];
		return open ? `<rect x="${x}" y="${y}" width="15" height="17" fill="#e2e8f0"/>${n ? txt(x + 7.5, y + 13, 11, n[0], n[1]) : ''}` : tile(x, y, 15, 16, '#94a3b8', 1.5);
	}).join('') +
		`<path d="M54 26 V14 L62 17 L54 20" fill="#ef4444" stroke="#1e293b" stroke-width="1.2"/><circle cx="104" cy="88" r="5" fill="${INK}"/><path d="M104 80 V96 M96 88 H112 M98 82 L110 94 M110 82 L98 94" stroke="${INK}" stroke-width="1.6"/><circle cx="102" cy="86" r="1.4" fill="#fff"/>`,

	sudoku: () => `<rect x="34" y="4" width="92" height="92" rx="3" fill="${WHITE}"/><rect x="65" y="35" width="30" height="31" fill="#ddd6fe"/><rect x="75" y="45" width="10" height="10" fill="#a78bfa"/>` +
		grid(34, 4, 9, 9, 10.2, '#c4b5fd', 0.5) + `<path d="M64.7 4 V96 M95.3 4 V96 M34 34.7 H126 M34 65.3 H126" stroke="#4c1d95" stroke-width="1.6"/>` +
		[[0, 0, 5], [1, 2, 3], [3, 0, 7], [2, 4, 9], [4, 5, 1], [5, 3, 8], [6, 1, 6], [8, 2, 2], [7, 7, 4], [2, 8, 7], [4, 6, 3], [8, 8, 9], [0, 6, 2], [6, 7, 5], [3, 5, 4]]
			.map(([c, r, n]) => txt(39.1 + c * 10.2, 12 + r * 10.2, 7.5, n, '#3b0764')).join('') + txt(80, 53, 7.5, '6', WHITE),

	'memory-match': () => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
		const x = 22 + (i % 4) * 30, y = 8 + Math.floor(i / 4) * 44;
		if (i === 1 || i === 6) return `<rect x="${x}" y="${y}" width="26" height="38" rx="4" fill="${WHITE}" stroke="#fde047" stroke-width="2"/>${txt(x + 13, y + 26, 20, '★', '#f59e0b')}`;
		return `<rect x="${x}" y="${y}" width="26" height="38" rx="4" fill="#be123c" stroke="#fda4af" stroke-width="1.2"/><circle cx="${x + 13}" cy="${y + 19}" r="6" fill="none" stroke="#fda4af" stroke-width="1.2"/>`;
	}).join('') + sparkle(60, 50, 5, '#fde047') + sparkle(108, 56, 4, '#fde047'),

	'slide-puzzle': () => `<rect x="38" y="4" width="84" height="92" rx="6" fill="rgba(0,0,0,0.3)"/>` + Array.from({ length: 16 }, (_, i) => {
		if (i === 11) return '';
		const x = 42 + (i % 4) * 20, y = 8 + Math.floor(i / 4) * 22, n = i > 11 ? i : i + 1;
		return tile(x, y, 18, 19, i % 2 ? '#5eead4' : '#99f6e4', 3) + txt(x + 9, y + 14, 10, n, '#115e59');
	}).join('') + `<path d="M108 52 h8 M114 49 l3 3 l-3 3" stroke="#fff" stroke-width="1.5" fill="none"/>`,

	'pixel-logic': () => `<rect x="48" y="22" width="72" height="72" fill="${WHITE}"/>` + [[0, 1, 1, 0, 1, 1], [1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 0], [0, 0, 1, 1, 0, 0], [0, 0, 0, 0, 0, 0]].map((row, r) => row.map((v, c) => v ? `<rect x="${48 + c * 12}" y="${22 + r * 12}" width="12" height="12" fill="#e11d48"/>` : r === 5 && c % 2 ? `<path d="M${51 + c * 12} ${25 + r * 12} l6 6 M${57 + c * 12} ${25 + r * 12} l-6 6" stroke="#94a3b8" stroke-width="1"/>` : '').join('')).join('') +
		grid(48, 22, 6, 6, 12, '#cbd5e1', 0.5) +
		['2 2', '6', '6', '4', '2', '0'].map((s, r) => txt(38, 31 + r * 12, 7, s, WHITE)).join('') + ['2', '4', '5', '5', '4', '2'].map((s, c) => txt(54 + c * 12, 16, 7, s, WHITE)).join(''),

	'marble-maze': (u) => `<g transform="skewX(-8)"><rect x="40" y="8" width="96" height="84" rx="6" fill="#b45309"/><rect x="44" y="12" width="88" height="76" rx="4" fill="#d97706"/>` +
		`<path d="M44 34 H104 M70 34 V56 M90 56 H132 M44 72 H84" stroke="#78350f" stroke-width="5"/></g>` +
		`<circle cx="112" cy="24" r="5" fill="${INK}"/><circle cx="62" cy="62" r="5" fill="${INK}"/><circle cx="110" cy="76" r="6" fill="none" stroke="#4ade80" stroke-width="2.5"/>` + sphere(u, 'm', 58, 22, 6, '#cbd5e1'),

	chess: () => `<g transform="translate(80 92) scale(1 0.42) rotate(45)">` + Array.from({ length: 36 }, (_, i) => `<rect x="${-54 + (i % 6) * 18}" y="${-54 + Math.floor(i / 6) * 18}" width="18" height="18" fill="${(i % 6 + Math.floor(i / 6)) % 2 ? '#78350f' : '#fde68a'}"/>`).join('') + '</g>' +
		shadow(64, 70, 14, 3.5) + `<path d="M54 70 H74 L71 62 H57 Z M57 62 L60 40 H68 L71 62 Z" fill="${WHITE}" stroke="#94a3b8"/><circle cx="64" cy="34" r="7" fill="${WHITE}" stroke="#94a3b8"/><path d="M64 14 V28 M58 20 H70" stroke="${WHITE}" stroke-width="4"/>` +
		shadow(104, 76, 13, 3.5) + `<path d="M94 76 H114 L111 68 H97 Z" fill="#1e293b"/><path d="M98 68 Q96 52 102 44 Q100 38 106 36 L114 44 L110 50 L104 48 Q110 58 110 68 Z" fill="#1e293b" stroke="#475569"/><circle cx="106" cy="42" r="1.3" fill="#fff"/>`,

	checkers: () => `<g transform="translate(80 52) scale(1 0.55) rotate(45)">` + Array.from({ length: 25 }, (_, i) => `<rect x="${-45 + (i % 5) * 18}" y="${-45 + Math.floor(i / 5) * 18}" width="18" height="18" fill="${(i % 5 + Math.floor(i / 5)) % 2 ? '#1c1917' : '#f5f5f4'}"/>`).join('') + '</g>' +
		[[56, 44, '#dc2626'], [80, 58, '#1c1917'], [104, 44, '#1c1917'], [80, 30, '#dc2626']].map(([x, y, c]) => `<ellipse cx="${x}" cy="${y + 3}" rx="10" ry="5" fill="${tone(c, -0.4)}"/><ellipse cx="${x}" cy="${y}" rx="10" ry="5" fill="${c}" stroke="${tone(c, 0.35)}" stroke-width="1"/>`).join('') +
		`<ellipse cx="56" cy="38" rx="10" ry="5" fill="#dc2626" stroke="#fca5a5"/><path d="M50 37 l2 -5 l4 3 l4 -3 l2 5 z" fill="#fde047"/>`,

	'tic-tac-toe': () => `<path d="M64 10 V90 M96 10 V90 M42 36 H118 M42 64 H118" stroke="rgba(255,255,255,0.5)" stroke-width="4" stroke-linecap="round"/>` +
		[[52, 22], [80, 50], [108, 78]].map(([x, y]) => neon(`M${x - 7} ${y - 7} L${x + 7} ${y + 7} M${x + 7} ${y - 7} L${x - 7} ${y + 7}`, '#f472b6', 3.5)).join('') +
		`<circle cx="108" cy="22" r="8" stroke="#fde047" stroke-width="3.5" fill="none"/><circle cx="52" cy="78" r="8" stroke="#fde047" stroke-width="3.5" fill="none"/>` + neon('M44 14 L116 86', WHITE, 2),

	'four-in-a-row': (u) => `<rect x="30" y="18" width="100" height="78" rx="6" fill="#1d4ed8"/><rect x="30" y="18" width="100" height="4" rx="2" fill="#60a5fa"/>` +
		Array.from({ length: 24 }, (_, i) => {
			const c = i % 6, r = Math.floor(i / 6), x = 40 + c * 16, y = 32 + r * 18;
			const v = { 18: 1, 19: 2, 20: 1, 21: 1, 22: 2, 14: 2, 15: 1, 16: 2, 10: 1, 11: 2, 4: 1 }[i];
			return `<circle cx="${x}" cy="${y}" r="6.5" fill="${v === 1 ? '#ef4444' : v === 2 ? '#facc15' : '#0b1020'}"/>`;
		}).join('') + sphere(u, 'd', 104, 8, 7, '#ef4444') + `<path d="M104 18 V24" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 2"/>`,

	reversi: (u) => `<rect x="36" y="6" width="88" height="88" rx="4" fill="#166534"/>` + grid(36, 6, 4, 4, 22, '#14532d', 1.2) +
		[[1, 1, 1], [2, 1, 0], [1, 2, 0], [2, 2, 1], [3, 1, 0], [0, 2, 1]].map(([c, r, w]) => shadow(47 + c * 22, 21 + r * 22, 8, 2.5) + sphere(u, `d${c}${r}`, 47 + c * 22, 17 + r * 22, 8.5, w ? '#f8fafc' : '#1e293b', { shine: w ? 0.6 : 0.4 })).join('') +
		`<g transform="rotate(-25 91 61)"><ellipse cx="91" cy="61" rx="9" ry="3" fill="#f8fafc"/><ellipse cx="91" cy="64" rx="9" ry="3" fill="#1e293b"/></g><path d="M100 50 q8 4 4 12" stroke="#fde047" stroke-width="1.5" fill="none"/>`,

	'fleet-strike': () => `<rect x="0" y="0" width="160" height="100" fill="#075985" opacity="0.4"/>` + grid(10, 6, 14, 9, 10, 'rgba(255,255,255,0.15)') +
		`<path d="M30 66 H96 L88 78 H38 Z" fill="#cbd5e1"/><rect x="44" y="56" width="30" height="10" fill="#94a3b8"/><rect x="54" y="46" width="10" height="10" fill="#64748b"/><rect x="58" y="36" width="2" height="10" fill="#475569"/><path d="M80 60 h10" stroke="#475569" stroke-width="3"/>` +
		`<path d="M20 84 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" stroke="#bae6fd" stroke-width="2" fill="none" opacity="0.8"/>` +
		`<circle cx="118" cy="34" r="12" fill="#f97316" opacity="0.4"/><circle cx="118" cy="34" r="6" fill="#fde047"/><path d="M118 18 V50 M102 34 H134" stroke="#ef4444" stroke-width="1.5"/><circle cx="118" cy="34" r="10" fill="none" stroke="#ef4444" stroke-width="1.5"/>` +
		`<circle cx="136" cy="72" r="3" fill="#fff" opacity="0.9"/><circle cx="136" cy="72" r="6" fill="none" stroke="#fff" opacity="0.5"/>`,

	'tower-guard': () => `<rect x="0" y="0" width="160" height="100" fill="#3f6212" opacity="0.4"/><path d="M-4 30 H60 V74 H118 V40 H164" stroke="#d6b88a" stroke-width="14" fill="none" stroke-linejoin="round"/>` +
		`<rect x="72" y="22" width="20" height="30" fill="#e7e5e4"/><path d="M70 22 V14 h5 v4 h4 v-4 h6 v4 h4 v-4 h5 V22 Z" fill="#e7e5e4"/><rect x="79" y="38" width="6" height="14" rx="3" fill="#57534e"/><path d="M82 4 V14" stroke="#57534e" stroke-width="1.5"/><path d="M82 4 l10 3 l-10 3" fill="#3b82f6"/>` +
		`<path d="M92 30 L118 66" stroke="#fde047" stroke-width="1.5" stroke-dasharray="3 2"/>` +
		[[26, 30, '#ef4444'], [60, 52, '#a855f7'], [118, 66, '#ef4444']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="${c}"/><circle cx="${x + 2}" cy="${y - 1.5}" r="1.4" fill="#fff"/>`).join('') +
		`<rect x="126" y="76" width="14" height="14" fill="#e7e5e4"/><path d="M124 76 l9 -8 l9 8 z" fill="#b91c1c"/>`,

	klondike: () => [0, 1, 2, 3, 4].map((c) => Array.from({ length: c + 1 }, (_, k) => k < c ? cardBack(18 + c * 25, 30 + k * 6, 22, 31) : card(18 + c * 25, 30 + k * 6, 22, 31, ['K', 'Q', '7', 'J', '9'][c], ['s', 'h', 'c', 'd', 's'][c])).join('')).join('') +
		card(130, 8, 22, 31, 'A', 'h') + `<rect x="130" y="44" width="22" height="31" rx="3" fill="none" stroke="rgba(255,255,255,0.5)" stroke-dasharray="3 2"/>${txt(141, 64, 10, 'A', 'rgba(255,255,255,0.5)')}` + cardBack(18, 4, 22, 22),

	spider: () => [0, 1, 2, 3].map((c) => ['K', 'Q', 'J', '10', '9'].slice(0, 3 + c % 2 + 1).map((rk, k) => card(22 + c * 24, 8 + k * 12, 22, 31, rk, 's')).join('')).join('') +
		`<path d="M118 0 L118 22" stroke="#e2e8f0" stroke-width="0.8"/><circle cx="118" cy="30" r="7" fill="${INK}"/><circle cx="118" cy="22" r="4.5" fill="${INK}"/><path d="M112 27 L102 20 L98 26 M112 31 L100 32 L96 38 M113 35 L104 42 L102 48 M124 27 L134 20 L138 26 M124 31 L136 32 L140 38 M123 35 L132 42 L134 48" stroke="${INK}" stroke-width="2" fill="none"/><circle cx="116" cy="21" r="1" fill="#ef4444"/><circle cx="120" cy="21" r="1" fill="#ef4444"/>` +
		`<path d="M128 60 L152 96 M128 60 L160 70 M128 60 L148 100 M136 72 Q144 70 148 78 M140 82 Q148 80 154 86" stroke="rgba(255,255,255,0.35)" stroke-width="0.8" fill="none"/>`,

	blackjack: () => `<ellipse cx="80" cy="110" rx="110" ry="60" fill="#047857" opacity="0.6"/><path d="M14 96 Q80 40 146 96" stroke="#fde68a" stroke-width="1" fill="none" opacity="0.6"/>` +
		card(48, 18, 30, 44, 'A', 's', -8) + card(74, 20, 30, 44, 'K', 'h', 7) +
		`<rect x="58" y="70" width="40" height="15" rx="7" fill="${INK}" opacity="0.7"/>${txt(78, 81.5, 11, '21!', '#fde047')}` +
		[0, 1, 2, 3].map((i) => `<ellipse cx="124" cy="${80 - i * 4}" rx="11" ry="4" fill="${i % 2 ? '#ef4444' : '#f8fafc'}" stroke="#7f1d1d" stroke-width="0.8" stroke-dasharray="3 2"/>`).join('') +
		`<ellipse cx="136" cy="88" rx="10" ry="4" fill="#2563eb" stroke="#bfdbfe" stroke-width="0.8" stroke-dasharray="3 2"/>`,

	'traffic-rush': () => `<path d="M48 0 L20 100 H140 L112 0 Z" fill="#334155"/><path d="M48 0 L20 100 M112 0 L140 100" stroke="#e2e8f0" stroke-width="2"/><path d="M69 0 L60 100 M91 0 L100 100" stroke="#fde047" stroke-width="1.5" stroke-dasharray="8 8"/>` +
		[[86, 14, '#3b82f6', 12, 18], [58, 34, '#22c55e', 16, 24], [104, 44, '#a855f7', 18, 26]].map(([x, y, c, w, h]) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}"/><rect x="${x - w / 2 + 2}" y="${y + h * 0.6}" width="${w - 4}" height="${h * 0.2}" rx="1" fill="#0f172a" opacity="0.7"/>`).join('') +
		`<rect x="69" y="64" width="22" height="32" rx="5" fill="#ef4444"/><rect x="72" y="70" width="16" height="7" rx="2" fill="#0f172a"/><rect x="72" y="86" width="16" height="5" rx="1" fill="#0f172a" opacity="0.6"/><rect x="70" y="63" width="5" height="2" fill="#fde047"/><rect x="85" y="63" width="5" height="2" fill="#fde047"/>`,

	'circuit-racer': () => `<path d="M24 50 C24 18 60 14 80 30 C100 46 136 12 140 46 C144 80 104 88 80 74 C56 60 24 84 24 50 Z" fill="none" stroke="#374151" stroke-width="18"/><path d="M24 50 C24 18 60 14 80 30 C100 46 136 12 140 46 C144 80 104 88 80 74 C56 60 24 84 24 50 Z" fill="none" stroke="#f8fafc" stroke-width="1" stroke-dasharray="5 5"/>` +
		`<path d="M15 50 h18" stroke="#fff" stroke-width="4" stroke-dasharray="3 3"/><path d="M15 53 h18" stroke="#111" stroke-width="3" stroke-dasharray="3 3" stroke-dashoffset="3"/>` +
		`<g transform="rotate(-30 58 22)"><rect x="50" y="18" width="16" height="9" rx="2.5" fill="#ef4444"/><rect x="58" y="19.5" width="4" height="6" fill="#0f172a"/></g><g transform="rotate(40 116 30)"><rect x="108" y="26" width="16" height="9" rx="2.5" fill="#3b82f6"/></g>` +
		`<path d="M136 64 V44" stroke="#fff" stroke-width="1.5"/><path d="M136 44 h10 v7 h-10" fill="#fff"/><path d="M136 44 h3.3 v3.5 h3.3 v-3.5 h3.4 v3.5 h-3.4 v3.5 h-3.3 v-3.5 h-3.3z" fill="#111"/>`,

	'park-it': () => `<rect x="0" y="0" width="160" height="100" fill="#334155" opacity="0.5"/>` + [24, 52, 80, 108, 136].map((x) => `<path d="M${x} 10 V56" stroke="#f8fafc" stroke-width="2"/>`).join('') +
		`<rect x="28" y="14" width="20" height="36" rx="4" fill="#22c55e"/><rect x="112" y="14" width="20" height="36" rx="4" fill="#a855f7"/><rect x="84" y="12" width="20" height="40" rx="3" fill="#fde047" opacity="0.3" stroke="#fde047" stroke-width="1.5" stroke-dasharray="4 2"/>` +
		`<g transform="rotate(-20 82 70)"><rect x="72" y="56" width="20" height="34" rx="5" fill="#ef4444"/><rect x="74" y="60" width="16" height="7" rx="2" fill="#0f172a"/></g><path d="M100 64 Q102 52 96 46" stroke="#fde047" stroke-width="2" fill="none" stroke-dasharray="3 2"/><path d="M93 47 l3 -3 l2 4" fill="none" stroke="#fde047" stroke-width="2"/>` +
		`<rect x="128" y="64" width="20" height="20" rx="4" fill="#2563eb"/>${txt(138, 79, 15, 'P')}`,

	'hoop-shot': (u) => `<rect x="70" y="0" width="4" height="100" fill="#64748b"/><rect x="40" y="8" width="64" height="40" rx="3" fill="${WHITE}" stroke="#cbd5e1"/><rect x="60" y="24" width="24" height="18" fill="none" stroke="#ef4444" stroke-width="2.5"/>` +
		`<ellipse cx="72" cy="46" rx="16" ry="4" fill="none" stroke="#ea580c" stroke-width="3"/><path d="M57 47 L62 66 H82 L87 47 M62 48 L66 66 M72 50 V66 M82 48 L78 66 M58 54 H86 M60 60 H84" stroke="#f8fafc" stroke-width="1" fill="none"/>` +
		`<path d="M20 92 Q40 20 66 34" stroke="#fff" stroke-width="1.2" fill="none" stroke-dasharray="3 3" opacity="0.7"/>` + sphere(u, 'bb', 118, 70, 14, '#f97316') + `<path d="M104 70 H132 M118 56 V84 M108 60 Q118 70 108 80 M128 60 Q118 70 128 80" stroke="#7c2d12" stroke-width="1.2" fill="none"/>`,

	'penalty-kicks': (u) => `<rect x="0" y="62" width="160" height="38" fill="#16a34a"/><path d="M0 74 H160 M0 88 H160" stroke="#22c55e" stroke-width="6"/><rect x="26" y="10" width="108" height="56" fill="none" stroke="${WHITE}" stroke-width="4"/>` +
		grid(28, 12, 13, 7, 8, 'rgba(255,255,255,0.3)') +
		`<g transform="rotate(-28 70 42)"><circle cx="70" cy="22" r="6" fill="#fcd9b6"/><rect x="64" y="28" width="12" height="20" rx="3" fill="#f59e0b"/><path d="M64 32 L52 26 M76 32 L88 24 M66 48 L62 62 M74 48 L80 62" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/><circle cx="51" cy="25" r="3" fill="#22c55e"/><circle cx="89" cy="23" r="3" fill="#22c55e"/></g>` +
		sphere(u, 'ball', 114, 28, 8, '#f8fafc') + `<path d="M114 24 l3 2 l-1 4 h-4 l-1 -4 z" fill="${INK}"/>` + speed(106, 34, 3, 12) + shadow(80, 92, 10, 2),

	bowling: (u) => `<path d="M60 0 L30 100 H130 L100 0 Z" fill="#d4a373"/><path d="M60 0 L30 100 M100 0 L130 100" stroke="#92400e" stroke-width="2"/><path d="M72 0 L66 100 M88 0 L94 100" stroke="#b45309" stroke-width="0.6" opacity="0.6"/>` +
		[[80, 12], [74, 18], [86, 18], [68, 24], [80, 24], [92, 24]].map(([x, y]) => `<ellipse cx="${x}" cy="${y + 8}" rx="3.5" ry="1" fill="#000" opacity="0.3"/><path d="M${x - 2.6} ${y + 8} Q${x - 3.6} ${y} ${x - 1.4} ${y - 3} Q${x} ${y - 7} ${x + 1.4} ${y - 3} Q${x + 3.6} ${y} ${x + 2.6} ${y + 8} Z" fill="${WHITE}"/><path d="M${x - 2} ${y - 2} h4" stroke="#ef4444" stroke-width="1.2"/>`).join('') +
		sphere(u, 'ball', 80, 74, 14, '#1d4ed8') + `<circle cx="76" cy="69" r="1.6" fill="${INK}"/><circle cx="82" cy="68" r="1.6" fill="${INK}"/><circle cx="79" cy="74" r="1.8" fill="${INK}"/>`,

	pool: (u) => `<rect x="10" y="12" width="140" height="76" rx="10" fill="#78350f"/><rect x="18" y="20" width="124" height="60" rx="4" fill="#047857"/>` + [[18, 20], [80, 18], [142, 20], [18, 80], [80, 82], [142, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#0b0f0a"/>`).join('') +
		[[100, 50, '#facc15'], [107, 46, '#2563eb'], [107, 54, '#ef4444'], [114, 42, '#7c3aed'], [114, 50, '#111827'], [114, 58, '#f97316']].map(([x, y, c], i) => sphere(u, `p${i}`, x, y, 4, c)).join('') +
		sphere(u, 'cue', 50, 50, 4, '#f8fafc') + `<path d="M8 66 L44 53" stroke="#fde68a" stroke-width="3" stroke-linecap="round"/><path d="M8 66 L16 63" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/><path d="M56 50 H94" stroke="#fff" stroke-width="0.8" stroke-dasharray="2 2"/>`,

	'mini-golf': (u) => `<path d="M10 70 Q20 30 80 34 Q144 36 150 66 Q154 92 80 92 Q8 92 10 70 Z" fill="#22c55e" stroke="#15803d" stroke-width="4"/>` +
		`<rect x="56" y="38" width="16" height="24" fill="#b91c1c"/><path d="M52 40 L64 28 L76 40 Z" fill="#7f1d1d"/><g transform="rotate(20 64 34)"><path d="M64 34 L64 14 M64 34 L84 34 M64 34 L64 54 M64 34 L44 34" stroke="#e2e8f0" stroke-width="3"/></g>` +
		`<ellipse cx="124" cy="66" rx="6" ry="2.5" fill="#052e16"/><path d="M124 66 V30" stroke="${WHITE}" stroke-width="2"/><path d="M124 30 L140 35 L124 40 Z" fill="#facc15"/>` +
		sphere(u, 'gb', 30, 74, 4, '#f8fafc') + `<path d="M34 72 Q80 84 118 68" stroke="#fff" stroke-width="1" stroke-dasharray="2 3" fill="none" opacity="0.8"/>`,

	'neon-hockey': () => `<rect x="14" y="8" width="132" height="84" rx="14" fill="#0b1026"/>` + neon('M28 8 H132 Q146 8 146 22 V78 Q146 92 132 92 H28 Q14 92 14 78 V22 Q14 8 28 8 Z', '#a855f7', 2) +
		`<path d="M80 8 V92" stroke="#334155" stroke-width="1.5"/><circle cx="80" cy="50" r="14" fill="none" stroke="#334155" stroke-width="1.5"/>` + neon('M14 38 V62', '#60a5fa', 4) + neon('M146 38 V62', '#f472b6', 4) +
		`<circle cx="40" cy="54" r="11" fill="#60a5fa"/><circle cx="40" cy="54" r="5" fill="#bfdbfe"/><circle cx="122" cy="42" r="11" fill="#f472b6"/><circle cx="122" cy="42" r="5" fill="#fbcfe8"/>` +
		`<circle cx="92" cy="58" r="6" fill="#fde047"/><path d="M86 60 L58 66" stroke="#fde047" stroke-width="5" stroke-linecap="round" opacity="0.3"/>`,

	'pixel-peaks': () => `<path d="M0 70 L30 36 L52 58 L84 20 L118 56 L140 40 L160 58 V100 H0 Z" fill="rgba(255,255,255,0.15)"/>` +
		Array.from({ length: 16 }, (_, i) => tile(i * 10, 86, 10, 14, '#a16207', 0)).join('') + Array.from({ length: 16 }, (_, i) => `<rect x="${i * 10}" y="86" width="10" height="3" fill="#4ade80"/>`).join('') +
		[0, 1, 2].map((i) => tile(56 + i * 10, 58, 10, 10, '#d97706', 1)).join('') + tile(116, 42, 10, 10, '#facc15', 1) + txt(121, 50.5, 8, '?', '#92400e') +
		`<rect x="28" y="70" width="10" height="16" rx="2" fill="#ef4444"/><rect x="28" y="66" width="10" height="7" rx="2" fill="#fcd9b6"/><rect x="34" y="68" width="2" height="2" fill="${INK}"/><rect x="26" y="64" width="13" height="3" fill="#b91c1c"/>` +
		[70, 82, 94].map((x) => `<ellipse cx="${x}" cy="48" rx="3" ry="4" fill="#fde047" stroke="#ca8a04"/>`).join('') + `<path d="M146 86 V54" stroke="#e2e8f0" stroke-width="2"/><path d="M146 54 L132 59 L146 64 Z" fill="#22c55e"/>`,
};
