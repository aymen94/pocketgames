// Thumbnails for the puzzle, board, card, brain, sports and simulation games added last.

import { WHITE, INK, tone, txt, shadow, sphere, spheres, tile, card, neon, sparkle, speed } from './kit.js';

const PEG = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316'];

export const NEW = {
	'code-breaker': (u) => `<rect x="30" y="6" width="100" height="88" rx="8" fill="#2a211a"/><rect x="38" y="12" width="66" height="14" rx="7" fill="#1c1917"/>` + [0, 1, 2, 3].map((i) => txt(48 + i * 15, 23, 10, '?', '#a8957f')).join('') +
		[[0, 1, 2, 3, [2, 1, 0, 0]], [1, 4, 2, 0, [2, 2, 1, 0]], [1, 2, 4, 0, [2, 2, 2, 2]]].map((row, r) => {
			const y = 40 + r * 19, marks = row[4];
			return row.slice(0, 4).map((c, i) => sphere(u, `p${r}${i}`, 48 + i * 15, y, 6, PEG[c], { shine: 0.6 })).join('') +
				marks.map((m, k) => m ? `<circle cx="${112 + (k % 2) * 7}" cy="${y - 4 + Math.floor(k / 2) * 7}" r="2.5" fill="${m === 2 ? WHITE : 'none'}" stroke="${WHITE}" stroke-width="1"/>` : `<circle cx="${112 + (k % 2) * 7}" cy="${y - 4 + Math.floor(k / 2) * 7}" r="1.2" fill="#57534e"/>`).join('');
		}).join('') + sparkle(126, 78, 4, '#fde047'),

	'balloon-words': () => [[34, 26, '#ef4444'], [52, 18, '#f97316'], [70, 24, '#eab308'], [92, 16, '#22c55e'], [110, 24, '#3b82f6'], [126, 20, '#a855f7']].map(([x, y, c], i) => i === 5 ? `<path d="M${x - 6} ${y} l3 -4 l3 4 l3 -5 l3 5" stroke="${c}" stroke-width="2" fill="none"/>` : `<path d="M${x} ${y + 12} Q${x + 3} ${y + 26} 80 ${46}" stroke="rgba(15,23,42,0.4)" fill="none"/><ellipse cx="${x}" cy="${y}" rx="8" ry="10" fill="${c}"/><ellipse cx="${x - 3}" cy="${y - 4}" rx="2" ry="3" fill="#fff" opacity="0.5"/>`).join('') +
		`<rect x="72" y="44" width="16" height="9" rx="2" fill="#92400e"/>` +
		['P', '', 'Z', 'Z', '', 'E'].map((ch, i) => `<rect x="${30 + i * 17}" y="80" width="13" height="2.5" rx="1" fill="#0c4a6e"/>${ch ? txt(36.5 + i * 17, 76, 13, ch, '#0c4a6e') : ''}`).join(''),

	'word-search': () => `<rect x="30" y="4" width="100" height="92" rx="8" fill="${WHITE}"/>` +
		'CATSPYDOGXRWOLFEBEARMLIONQ'.split('').slice(0, 25).map((ch, i) => txt(42 + (i % 5) * 19, 22 + Math.floor(i / 5) * 18, 11, ch, '#44403c')).join('') +
		`<path d="M42 18 H80" stroke="#f472b6" stroke-width="13" stroke-linecap="round" opacity="0.4"/><path d="M118 36 L118 90" stroke="#60a5fa" stroke-width="13" stroke-linecap="round" opacity="0.4"/><path d="M42 54 L99 90" stroke="#34d399" stroke-width="13" stroke-linecap="round" opacity="0.4"/>` +
		`<g transform="rotate(-30 140 74)"><circle cx="140" cy="66" r="10" fill="none" stroke="${INK}" stroke-width="3"/><rect x="138" y="76" width="4" height="14" rx="2" fill="${INK}"/></g>`,

	'lights-off': () => `<rect width="160" height="100" fill="#0a0a14" opacity="0.5"/>` + Array.from({ length: 20 }, (_, i) => {
		const c = i % 5, r = Math.floor(i / 5), x = 36 + c * 18, y = 10 + r * 20, on = [1, 5, 6, 7, 11, 13, 17, 18, 19].includes(i);
		return (on ? `<circle cx="${x + 7}" cy="${y + 8}" r="13" fill="#fde047" opacity="0.25"/>` : '') + tile(x, y, 15, 16, on ? '#fde047' : '#272340', 4);
	}).join('') + `<circle cx="133" cy="72" r="9" fill="${WHITE}"/><path d="M128 80 L133 92 L138 80" fill="${WHITE}"/><path d="M130 82 h6 M130 85 h6" stroke="#94a3b8"/>`,

	'pipe-network': () => {
		const S = 24, X = 32, Y = 14;
		const pipe = (c, r, d, wet, turn = 0) => {
			const x = X + c * S, y = Y + r * S;
			return `<rect x="${x + 1}" y="${y + 1}" width="${S - 2}" height="${S - 2}" rx="4" fill="#292524"/><g transform="translate(${x} ${y}) rotate(${turn} 12 12)"><path d="${d}" stroke="#57534e" stroke-width="9" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${wet ? '#38bdf8' : '#0c0a09'}" stroke-width="5" stroke-linecap="round" fill="none"/></g>`;
		};
		const H = 'M0 12 H24', V = 'M12 0 V24', ES = 'M12 24 V12 H24', WN = 'M0 12 H12 V0', WS = 'M0 12 H12 V24', NE = 'M12 0 V12 H24';
		// the wet path: pump → right → down → right → right → tap; one dry tile still to turn
		return pipe(0, 0, H, true) + pipe(1, 0, WS, true) + pipe(1, 1, V, true) + pipe(1, 2, NE, true) + pipe(2, 2, H, true) + pipe(3, 2, WN, true) + pipe(3, 1, V, false, 90) + pipe(4, 1, H, false) +
			pipe(2, 0, H, false) + pipe(3, 0, ES, false) + pipe(0, 1, V, false) + pipe(0, 2, ES, false) + pipe(2, 1, H, false) + pipe(4, 0, WS, false) + pipe(4, 2, H, false) +
			`<circle cx="${X - 6}" cy="${Y + 12}" r="9" fill="#0ea5e9" stroke="#e0f2fe" stroke-width="1.5"/><path d="M${X - 10} ${Y + 12} q4 -6 8 0 q-4 6 -8 0" fill="#e0f2fe"/>` +
			`<path d="M${X + 96} ${Y + 40} a11 11 0 1 1 -4 -16" stroke="#fde047" stroke-width="2" fill="none"/><path d="M${X + 88} ${Y + 22} l5 2 l-3 4" stroke="#fde047" stroke-width="2" fill="none"/>` +
			`<path d="M${X + 3 * S + 12} ${Y + 3 * S} v8" stroke="#94a3b8" stroke-width="4"/>` + Array.from({ length: 3 }, (_, i) => `<circle cx="${X + 3 * S + 12}" cy="${Y + 3 * S + 12 + i * 4}" r="${1.8 - i * 0.3}" fill="#38bdf8"/>`).join('');
	},

	'crate-pusher': () => `<rect x="20" y="6" width="120" height="88" fill="#d6d3d1"/>` + Array.from({ length: 12 }, (_, i) => tile(20 + i * 10, 6, 10, 10, '#78716c', 1)).join('') + Array.from({ length: 8 }, (_, i) => tile(20, 16 + i * 10, 10, 10, '#78716c', 1) + tile(130, 16 + i * 10, 10, 10, '#78716c', 1)).join('') +
		`<circle cx="112" cy="66" r="8" fill="none" stroke="#dc2626" stroke-width="2.5"/><circle cx="112" cy="40" r="8" fill="none" stroke="#dc2626" stroke-width="2.5"/>` +
		[[72, 54, '#b45309', '#fcd34d'], [100, 28, '#16a34a', '#bbf7d0']].map(([x, y, c, l]) => `<rect x="${x}" y="${y}" width="24" height="24" rx="3" fill="${c}"/><rect x="${x + 4}" y="${y + 4}" width="16" height="16" fill="none" stroke="${l}" stroke-width="2"/><path d="M${x + 4} ${y + 4} l16 16" stroke="${l}" stroke-width="2"/>`).join('') +
		`<circle cx="56" cy="66" r="9" fill="#4f8cff"/><circle cx="59" cy="63" r="2" fill="#fff"/><circle cx="59" cy="69" r="2" fill="#fff"/><path d="M64 62 l5 0 M64 70 l5 0" stroke="#4f8cff" stroke-width="3" stroke-linecap="round"/><path d="M98 66 h8 m-3 -3 l3 3 l-3 3" stroke="#334155" stroke-width="1.5" fill="none"/>`,

	'zen-tiles': () => {
		const t = (x, y, g, c) => `<rect x="${x + 3}" y="${y + 4}" width="20" height="27" rx="3" fill="#78716c"/><rect x="${x}" y="${y}" width="20" height="27" rx="3" fill="#fafaf9" stroke="#d6d3d1" stroke-width="0.6"/>${txt(x + 10, y + 19, 14, g, c)}`;
		const row0 = [['♥', '#e11d48'], ['❄', '#0ea5e9'], ['♣', '#16a34a'], ['★', '#eab308'], ['♪', '#7c3aed'], ['☾', '#6366f1']];
		return row0.map(([g, c], i) => t(20 + i * 21, 60, g, c)).join('') + row0.slice(1, 5).map(([g, c], i) => t(35 + i * 21, 36, ['☀', '♠', '✿', '⚓'][i], ['#f59e0b', '#1e293b', '#db2777', '#1d4ed8'][i])).join('') +
			t(56, 12, '♥', '#e11d48') + t(77, 12, '★', '#eab308') + `<rect x="54" y="10" width="24" height="31" rx="4" fill="none" stroke="#fde047" stroke-width="2"/>` + sparkle(140, 20, 5, '#fde047');
	},

	'gem-cascade': () => {
		const gem = (x, y, k) => {
			const c = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7'][k];
			const shapes = [`M${x} ${y - 8} L${x + 8} ${y} L${x} ${y + 8} L${x - 8} ${y} Z`, `M${x - 7} ${y - 5} L${x} ${y - 9} L${x + 7} ${y - 5} V${y + 5} L${x} ${y + 9} L${x - 7} ${y + 5} Z`, `M${x - 7} ${y - 7} H${x + 7} V${y + 7} H${x - 7} Z`, `M${x} ${y - 8} L${x + 8} ${y + 7} H${x - 8} Z`, `M${x - 4} ${y - 8} H${x + 4} L${x + 8} ${y} L${x} ${y + 8} L${x - 8} ${y} Z`];
			return `<path d="${shapes[k]}" fill="${c}" stroke="${tone(c, 0.4)}" stroke-width="1"/><path d="M${x - 3} ${y - 4} l3 -2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>`;
		};
		const layout = [[0, 1, 2, 3, 4, 0], [3, 2, 2, 2, 1, 4], [1, 4, 0, 3, 3, 2], [2, 0, 1, 4, 0, 1]];
		return `<rect x="26" y="6" width="108" height="88" rx="6" fill="rgba(0,0,0,0.25)"/>` + layout.map((row, r) => row.map((k, c) => gem(38 + c * 17, 17 + r * 22, k)).join('')).join('') +
			`<rect x="56" y="30" width="56" height="18" rx="6" fill="none" stroke="#fff" stroke-width="1.5"/>` + sparkle(72, 32, 5) + sparkle(100, 46, 4) + txt(84, 90, 9, '+60', '#fde047');
	},

	jigsaw: () => {
		const piece = (x, y, c, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot} 16 16)"><path d="M0 0 H12 C12 -6 20 -6 20 0 H32 V12 C38 12 38 20 32 20 V32 H20 C20 26 12 26 12 32 H0 V20 C6 20 6 12 0 12 Z" fill="${c}" stroke="#fff" stroke-width="1.2"/></g>`;
		return `<rect x="22" y="12" width="74" height="76" rx="3" fill="rgba(0,0,0,0.25)"/>` + piece(26, 16, '#7dd3fc') + piece(58, 16, '#fde68a') + piece(26, 50, '#4ade80') +
			`<path d="M28 40 L40 30 L52 38 L56 34" stroke="#166534" stroke-width="2" fill="none"/><circle cx="74" cy="28" r="5" fill="#fbbf24"/>` + piece(108, 46, '#a78bfa', 18) + piece(112, 8, '#38bdf8', -12) +
			`<path d="M94 74 q8 6 14 -2" stroke="#fff" stroke-width="1.5" stroke-dasharray="2 2" fill="none"/>`;
	},

	'peg-jump': (u) => {
		const holes = [], pegs = [];
		for (let i = 0; i < 49; i++) {
			const c = i % 7, r = Math.floor(i / 7);
			if (!((r >= 2 && r <= 4) || (c >= 2 && c <= 4))) continue;
			((c === 3 && r === 3) || (c === 3 && r === 1) ? holes : pegs).push([50 + c * 10, 20 + r * 10]);
		}
		return `<circle cx="80" cy="50" r="46" fill="#7c4a2a"/>` + holes.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.5" fill="#2b1a10"/>`).join('') + spheres(u, 'peg', '#f59e0b', pegs, 4, { shine: 0.7 }) +
			`<path d="M80 30 Q92 34 80 48" stroke="#fde047" stroke-width="2" fill="none"/><path d="M78 46 l2 3 l3 -2" stroke="#fde047" stroke-width="2" fill="none"/>`;
	},

	nim: () => [1, 3, 5, 7].map((n, r) => Array.from({ length: n }, (_, i) => {
		const x = 80 - (n - 1) * 7 + i * 14, y = 12 + r * 22, gone = r === 3 && i >= 5;
		return gone ? '' : `<rect x="${x - 1.8}" y="${y}" width="3.6" height="17" rx="1" fill="#f5deb3"/><ellipse cx="${x}" cy="${y}" rx="3" ry="4" fill="#dc2626"/>`;
	}).join('')).join('') + `<g transform="rotate(50 128 84)"><rect x="126" y="76" width="3.6" height="17" rx="1" fill="#f5deb3"/><ellipse cx="128" cy="76" rx="3" ry="4" fill="#dc2626"/></g><g transform="rotate(-70 140 76)"><rect x="138" y="68" width="3.6" height="17" rx="1" fill="#f5deb3"/><ellipse cx="140" cy="68" rx="3" ry="4" fill="#dc2626"/></g>` +
		`<path d="M118 74 q4 -6 10 -4" stroke="#fde047" stroke-width="1.4" fill="none"/>`,

	'dots-boxes': () => {
		const P = (c, r) => [42 + c * 25, 12 + r * 25];
		const line = (a, b, col) => `<path d="M${P(...a).join(' ')} L${P(...b).join(' ')}" stroke="${col}" stroke-width="4" stroke-linecap="round"/>`;
		return `<rect x="42" y="12" width="25" height="25" fill="#bfdbfe"/><rect x="67" y="37" width="25" height="25" fill="#fecdd3"/><rect x="42" y="37" width="25" height="25" fill="#bfdbfe"/>` + txt(54.5, 29, 8, 'YOU', '#3b82f6') + txt(54.5, 54, 8, 'YOU', '#3b82f6') + txt(79.5, 54, 8, 'CPU', '#f43f5e') +
			[[[0, 0], [1, 0]], [[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 1], [1, 1]], [[0, 1], [0, 2]], [[0, 2], [1, 2]], [[1, 1], [1, 2]], [[2, 0], [3, 0]]].map(([a, b]) => line(a, b, '#3b82f6')).join('') +
			[[[1, 1], [2, 1]], [[2, 1], [2, 2]], [[1, 2], [2, 2]], [[3, 0], [3, 1]], [[2, 2], [3, 2]]].map(([a, b]) => line(a, b, '#f43f5e')).join('') +
			`<path d="M${P(2, 0).join(' ')} L${P(2, 1).join(' ')}" stroke="#3b82f6" stroke-width="4" stroke-dasharray="3 3" opacity="0.6"/>` +
			Array.from({ length: 16 }, (_, i) => `<circle cx="${P(i % 4, Math.floor(i / 4))[0]}" cy="${P(i % 4, Math.floor(i / 4))[1]}" r="3.2" fill="${INK}"/>`).join('');
	},

	mancala: () => `<rect x="8" y="22" width="144" height="58" rx="29" fill="#92400e"/><rect x="12" y="26" width="136" height="50" rx="25" fill="#b45309"/>` +
		`<ellipse cx="26" cy="51" rx="9" ry="20" fill="#78350f"/><ellipse cx="134" cy="51" rx="9" ry="20" fill="#78350f"/>` +
		[0, 1, 2, 3, 4, 5].map((i) => [38, 64].map((y) => `<circle cx="${48 + i * 13}" cy="${y}" r="5.6" fill="#78350f"/>`).join('')).join('') +
		Array.from({ length: 40 }, (_, k) => { const pit = k % 12, i = pit % 6, y = pit < 6 ? 38 : 64, a = k * 2.4; return `<circle cx="${(48 + i * 13 + Math.cos(a) * 2.6).toFixed(1)}" cy="${(y + Math.sin(a) * 2.6).toFixed(1)}" r="1.5" fill="hsl(${(k * 47) % 360} 75% 62%)"/>`; }).join('') +
		Array.from({ length: 14 }, (_, k) => `<circle cx="${131 + (k % 2) * 5}" cy="${38 + Math.floor(k / 2) * 4}" r="1.6" fill="hsl(${(k * 61) % 360} 75% 62%)"/>`).join('') + txt(80, 94, 9, '+ capture', '#fde68a'),

	'five-in-a-row': (u) => `<rect x="20" y="0" width="120" height="100" fill="#e7c48a"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M${28 + i * 13} 4 V96 M24 ${8 + i * 11} H136" stroke="#7c5a2e" stroke-width="0.6"/>`).join('') +
		[[1, 7], [2, 6], [3, 5], [4, 4], [5, 3]].map(([c, r], i) => sphere(u, `b${i}`, 28 + c * 13, 8 + r * 11, 5, '#262626', { shine: 0.45 })).join('') +
		[[3, 3], [5, 5], [4, 6], [6, 4], [2, 4]].map(([c, r], i) => sphere(u, `w${i}`, 28 + c * 13, 8 + r * 11, 5, '#f8fafc', { shine: 0.3 })).join('') +
		neon('M41 85 L93 41', '#4f8cff', 2.5),

	hex: () => Array.from({ length: 36 }, (_, i) => {
		const r = Math.floor(i / 6), c = i % 6, x = 38 + c * 14 + r * 7, y = 16 + r * 12.2;
		const blue = [[0, 1], [1, 1], [2, 2], [3, 2], [4, 3], [5, 3]].some(([rr, cc]) => rr === r && cc === c) && r < 6 ? 0 : 1;
		const orange = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 1]].some(([rr, cc]) => rr === r && cc === c);
		const fill = !blue ? '#3b82f6' : orange ? '#f97316' : '#334155';
		return `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${(x + Math.cos(Math.PI / 6 + (k * Math.PI) / 3) * 7.6).toFixed(1)},${(y + Math.sin(Math.PI / 6 + (k * Math.PI) / 3) * 7.6).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="#1e293b" stroke-width="1"/>`;
	}).join('') + `<path d="M24 12 L56 86" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/><path d="M110 12 L142 86" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/><path d="M34 4 H112 M70 96 H146" stroke="#f97316" stroke-width="4" stroke-linecap="round"/>`,

	'squad-tactics': () => `<rect width="160" height="100" fill="#15803d" opacity="0.5"/>` + Array.from({ length: 10 }, (_, i) => `<path d="M${i * 16 + 8} 0 V100 M0 ${i * 16 + 2} H160" stroke="rgba(0,0,0,0.12)" stroke-width="0.8"/>`).join('') +
		[[56, 34], [56, 50], [72, 50], [40, 50], [56, 66]].map(([x, y]) => `<rect x="${x - 8}" y="${y - 8}" width="16" height="16" fill="#93c5fd" opacity="0.4"/>`).join('') +
		`<rect x="88" y="54" width="14" height="12" rx="4" fill="#57534e"/>` +
		[[56, 50, '#3b82f6', '⚔'], [32, 70, '#22c55e', '➶'], [32, 30, '#e879f9', '✚']].map(([x, y, c, g]) => `<circle cx="${x}" cy="${y + 2}" r="9" fill="#000" opacity="0.25"/><circle cx="${x}" cy="${y}" r="9" fill="${c}" stroke="#fff" stroke-width="1.4"/>${txt(x, y + 4, 10, g)}`).join('') +
		[[118, 36, '#84cc16', 'g'], [128, 62, '#ef4444', 'B'], [104, 80, '#f59e0b', 's']].map(([x, y, c, g]) => `<circle cx="${x}" cy="${y}" r="8.5" fill="${c}" stroke="#7f1d1d" stroke-width="1.4"/>${txt(x, y + 3.5, 10, g, INK)}<rect x="${x - 8}" y="${y + 11}" width="16" height="2.4" rx="1" fill="#f87171"/>`).join('') +
		`<path d="M66 46 L108 38" stroke="#fde047" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M104 35 l5 3 l-5 3" stroke="#fde047" stroke-width="1.5" fill="none"/>${txt(112, 26, 9, '-5', '#fca5a5')}`,

	'maze-defense': () => `<rect width="160" height="100" fill="#4d7c0f" opacity="0.6"/><path d="M4 50 H34 V18 H70 V82 H106 V30 H134 V50 H156" stroke="#fef3c7" stroke-width="10" fill="none" opacity="0.35" stroke-linejoin="round"/>` +
		[[52, 34], [52, 52], [52, 70], [88, 18], [88, 36], [88, 56], [120, 64], [120, 82], [20, 30], [20, 70]].map(([x, y], i) => `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="2" fill="#57534e"/>` + (i % 3 === 2 ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" rx="1" fill="#a8a29e"/>` : `<circle cx="${x}" cy="${y}" r="4.5" fill="${['#38bdf8', '#f97316', '#a5f3fc'][i % 3]}"/>`)).join('') +
		[[34, 40, '#84cc16'], [64, 82, '#facc15'], [106, 44, '#a855f7']].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`).join('') +
		`<path d="M88 56 L104 46" stroke="#fef3c7" stroke-width="1.4"/><rect x="2" y="44" width="10" height="12" rx="2" fill="#22c55e"/><rect x="148" y="44" width="10" height="12" rx="2" fill="#ef4444"/>`,

	freecell: () => [0, 1, 2, 3].map((i) => i < 2 ? card(22 + i * 30, 6, 24, 33, ['7', 'Q'][i], ['s', 'd'][i]) : `<rect x="${22 + i * 30}" y="6" width="24" height="33" rx="3" fill="none" stroke="rgba(255,255,255,0.45)" stroke-dasharray="3 2"/>`).join('') +
		[0, 1, 2, 3].map((c) => [0, 1, 2].map((k) => card(22 + c * 30, 46 + k * 11, 24, 33, [['K', 'Q', 'J'], ['9', '8', '7'], ['6', '5', '4'], ['10', '9', '8']][c][k], [['s', 'h', 'c'], ['d', 'c', 'h'], ['h', 's', 'd'], ['c', 'h', 's']][c][k])).join('')).join(''),

	pyramid: () => [[0, 'K', 'h'], [1, '6', 's'], [1, '7', 'd'], [2, '4', 'c'], [2, '9', 'h'], [2, 'Q', 's'], [3, 'A', 'd'], [3, '5', 'c'], [3, '8', 's'], [3, '2', 'h']].map(([r, rk, st], i, arr) => {
		const idx = arr.slice(0, i).filter(([rr]) => rr === r).length;
		return card(80 - 10 + (idx - r / 2) * 22, 6 + r * 17, 20, 28, rk, st);
	}).join('') + `<path d="M58 30 Q70 44 98 30" stroke="#fde047" stroke-width="1.5" fill="none" stroke-dasharray="2 2"/>${txt(80, 98, 9, '6 + 7 = 13', '#fecaca')}`,

	'crazy-eights': () => card(40, 26, 30, 44, '3', 'c', -18) + card(56, 20, 30, 44, '8', 'h', -4) + card(74, 22, 30, 44, '8', 's', 10) + card(90, 28, 30, 44, 'J', 'd', 22) +
		`<circle cx="128" cy="24" r="13" fill="${WHITE}"/>${txt(128, 30, 17, '♥', '#e11d48')}<path d="M118 36 l-6 8" stroke="#fff" stroke-width="1.5"/>` + txt(30, 22, 18, '8', '#fde047') + sparkle(44, 12, 4, '#fde047'),

	'video-poker': () => `<rect x="12" y="4" width="136" height="92" rx="10" fill="#0f0c2e" stroke="#818cf8" stroke-width="1.5"/>` + txt(80, 18, 10, 'ROYAL FLUSH', '#fde047') +
		['10', 'J', 'Q', 'K', 'A'].map((rk, i) => card(20 + i * 24.5, 26, 21, 31, rk, 'h')).join('') +
		[0, 1, 2, 3, 4].map((i) => `<rect x="${21 + i * 24.5}" y="62" width="19" height="7" rx="2" fill="#4f8cff"/>${txt(30.5 + i * 24.5, 67.5, 5, 'HELD')}`).join('') +
		`<rect x="30" y="76" width="100" height="13" rx="4" fill="#312e81"/>${txt(80, 86, 9, 'WIN 4000', '#fde047')}`,

	'echo-pads': () => [['#22c55e', Math.PI], ['#ef4444', -Math.PI / 2], ['#eab308', 0], ['#3b82f6', Math.PI / 2]].map(([c, a0], i) => {
		const lit = i === 1, a1 = a0 + Math.PI / 2 - 0.08, s = a0 + 0.08, R = 42, r = 15, cx = 80, cy = 50;
		const p = (a, rad) => `${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`;
		return `<path d="M${p(s, r)} L${p(s, R)} A${R} ${R} 0 0 1 ${p(a1, R)} L${p(a1, r)} A${r} ${r} 0 0 0 ${p(s, r)} Z" fill="${lit ? c : tone(c, -0.45)}"/>` + (lit ? `<circle cx="${(cx + Math.cos(a0 + 0.78) * 28).toFixed(1)}" cy="${(cy + Math.sin(a0 + 0.78) * 28).toFixed(1)}" r="16" fill="#fff" opacity="0.25"/>` : '');
	}).join('') + `<circle cx="80" cy="50" r="13" fill="#111827"/>${txt(80, 55, 13, '7')}` +
		`<path d="M128 26 q6 4 0 8 M134 22 q10 8 0 16" stroke="#fff" stroke-width="1.6" fill="none"/><path d="M26 70 v-10 l6 -2 v10" stroke="#fff" stroke-width="1.6" fill="none"/><circle cx="24" cy="70" r="2.5" fill="#fff"/><circle cx="30" cy="68" r="2.5" fill="#fff"/>`,

	reflex: () => `<rect x="0" y="0" width="80" height="100" fill="#b91c1c" opacity="0.6"/><rect x="80" y="0" width="80" height="100" fill="#16a34a" opacity="0.6"/>` +
		`<circle cx="62" cy="54" r="30" fill="${WHITE}"/><circle cx="62" cy="54" r="25" fill="#f1f5f9" stroke="#cbd5e1"/><rect x="56" y="16" width="12" height="7" rx="2" fill="${WHITE}"/><path d="M62 54 L62 34 M62 54 L76 60" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="62" cy="54" r="3" fill="#ef4444"/>` +
		`<path d="M118 14 L102 52 H116 L106 88 L136 42 H120 L130 14 Z" fill="#fde047" stroke="#ca8a04" stroke-width="1.5"/>` + txt(112, 98, 11, '187 ms', WHITE),

	'make-24': () => [['8', 22], ['3', 50], ['8', 78], ['3', 106]].map(([n, x], i) => `<rect x="${x}" y="14" width="24" height="34" rx="5" fill="${i === 0 ? '#fde68a' : WHITE}"/>${txt(x + 12, 38, 20, n, INK)}`).join('') +
		[['+', 40], ['−', 62], ['×', 84], ['÷', 106]].map(([o, x]) => `<rect x="${x}" y="56" width="18" height="16" rx="4" fill="${o === '×' ? '#4f8cff' : '#334155'}"/>${txt(x + 9, 68.5, 12, o)}`).join('') +
		txt(80, 94, 18, '= 24', '#fde047'),

	'wall-climber': () => `<rect x="0" y="0" width="24" height="100" fill="#334155"/><rect x="136" y="0" width="24" height="100" fill="#334155"/>` + Array.from({ length: 8 }, (_, i) => `<path d="M0 ${i * 14 + 4} H24 M136 ${i * 14 + 10} H160" stroke="#1e293b" stroke-width="2"/>`).join('') +
		`<path d="M24 30 l9 4 l-9 4 l9 4 l-9 4 l9 4 l-9 4" fill="#e2e8f0"/><g transform="rotate(${20} 104 40)"><circle cx="104" cy="40" r="9" fill="#94a3b8"/>${Array.from({ length: 8 }, (_, k) => { const a = (k / 8) * Math.PI * 2; return `<path d="M${(104 + Math.cos(a) * 9).toFixed(1)} ${(40 + Math.sin(a) * 9).toFixed(1)} l${(Math.cos(a + 0.6) * 5).toFixed(1)} ${(Math.sin(a + 0.6) * 5).toFixed(1)}" stroke="#94a3b8" stroke-width="3"/>`; }).join('')}<circle cx="104" cy="40" r="3" fill="#475569"/></g>` +
		`<path d="M32 76 Q70 20 128 30" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/><circle cx="126" cy="30" r="8" fill="${INK}"/><rect x="118" y="27" width="16" height="4" fill="#f43f5e"/><circle cx="122" cy="30" r="1.6" fill="#fff"/>` +
		`<circle cx="74" cy="22" r="4" fill="#fde047"/><path d="M0 88 Q40 80 80 88 T160 86 V100 H0 Z" fill="#f97316"/><path d="M0 92 Q40 86 80 92 T160 90" stroke="#fde047" stroke-width="1.5" fill="none"/>`,

	tennis: (u) => `<path d="M38 18 H122 L150 96 H10 Z" fill="#1d4ed8"/><path d="M38 18 H122 L150 96 H10 Z M46 18 L22 96 M114 18 L138 96 M32 52 H128 M80 52 V96" stroke="${WHITE}" stroke-width="1.4" fill="none"/>` +
		`<path d="M20 58 H140" stroke="#e2e8f0" stroke-width="4"/><path d="M20 58 v-6 M140 58 v-6" stroke="#94a3b8" stroke-width="2"/>` +
		`<g transform="rotate(-35 126 78)"><ellipse cx="126" cy="66" rx="9" ry="12" fill="none" stroke="#f43f5e" stroke-width="3"/><path d="M119 66 h14 M126 55 v22 M120 60 h12 M120 72 h12" stroke="#fde68a" stroke-width="0.6"/><rect x="124" y="78" width="4" height="16" rx="2" fill="#1e293b"/></g>` +
		sphere(u, 'ball', 84, 36, 6, '#d9f99d') + `<path d="M79 33 q5 3 10 0" stroke="#fff" stroke-width="1" fill="none"/>` + shadow(80, 46, 5, 1.5) + speed(78, 36, 2, 12),

	'table-tennis': (u) => `<path d="M42 30 H118 L146 82 H14 Z" fill="#1d4ed8"/><path d="M42 30 H118 L146 82 H14 Z M80 30 V82" stroke="${WHITE}" stroke-width="1.4" fill="none"/><path d="M14 82 V88 H146 V82" fill="#1e3a8a"/>` +
		`<path d="M26 54 H134" stroke="#e2e8f0" stroke-width="2"/><rect x="26" y="46" width="108" height="8" fill="#e2e8f0" opacity="0.4"/>` +
		`<ellipse cx="36" cy="80" rx="13" ry="15" fill="#ef4444" stroke="#7f1d1d"/><rect x="33" y="92" width="6" height="12" rx="2" fill="#92400e"/>` +
		`<ellipse cx="122" cy="20" rx="8" ry="9" fill="#1e293b"/><rect x="120" y="28" width="4" height="8" fill="#92400e"/>` + sphere(u, 'ball', 92, 40, 4, '#fff7ed') + `<path d="M50 72 Q70 30 90 40" stroke="#fff" stroke-width="1" stroke-dasharray="2 3" fill="none"/>`,

	'beach-volley': (u) => `<circle cx="132" cy="18" r="10" fill="#fef08a"/><rect x="0" y="54" width="160" height="10" fill="#0ea5e9"/><rect x="0" y="64" width="160" height="36" fill="#fcd34d"/>` +
		`<rect x="78" y="40" width="4" height="42" fill="#e5e7eb"/><path d="M60 40 H100" stroke="#f8fafc" stroke-width="2"/><rect x="60" y="40" width="40" height="10" fill="none" stroke="#f8fafc" stroke-dasharray="2 2"/>` +
		`<path d="M22 84 A16 16 0 0 1 54 84 Z" fill="#4f8cff"/><circle cx="46" cy="76" r="3" fill="#fff"/><circle cx="47" cy="76" r="1.5" fill="${INK}"/>` +
		`<path d="M106 84 A16 16 0 0 1 138 84 Z" fill="#f97316"/><circle cx="114" cy="76" r="3" fill="#fff"/><circle cx="113" cy="76" r="1.5" fill="${INK}"/>` +
		sphere(u, 'ball', 58, 26, 8, '#f8fafc') + `<path d="M52 22 q6 6 12 0 M54 32 q4 -6 10 -2" stroke="#f59e0b" stroke-width="1.4" fill="none"/>` + shadow(58, 86, 7, 2),

	'fairway-golf': (u) => `<path d="M0 66 Q30 50 60 62 T120 56 T160 60 V100 H0 Z" fill="#65a30d"/><path d="M0 66 Q30 50 60 62 T120 56 T160 60" stroke="#84cc16" stroke-width="2" fill="none"/>` +
		`<path d="M56 62 Q64 66 74 62 Q66 68 56 62 Z" fill="#fde68a"/><path d="M84 64 Q96 70 104 62 L104 66 Q96 74 84 68 Z" fill="#38bdf8"/>` +
		`<ellipse cx="136" cy="57" rx="10" ry="2.5" fill="#4ade80"/><path d="M138 57 V24" stroke="${WHITE}" stroke-width="1.6"/><path d="M138 24 L152 29 L138 34 Z" fill="#ef4444"/>` +
		`<path d="M20 62 Q70 -6 130 50" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>` + sphere(u, 'ball', 20, 60, 3.5, '#f8fafc') +
		`<g transform="rotate(-30 16 60)"><path d="M16 60 V30" stroke="#94a3b8" stroke-width="1.6"/><path d="M14 60 h8 v3 h-8 z" fill="#64748b"/></g>` + txt(76, 16, 8, 'WIND →', '#e0f2fe'),

	darts: () => {
		const seg = Math.PI / 10;
		let board = '';
		for (let i = 0; i < 20; i++) {
			const a0 = -Math.PI / 2 - seg / 2 + i * seg, a1 = a0 + seg, dark = i % 2 === 0;
			for (const [r0, r1, c] of [[4, 22, dark ? '#111' : '#f5f0dc'], [22, 25, dark ? '#dc2626' : '#16a34a'], [25, 36, dark ? '#111' : '#f5f0dc'], [36, 40, dark ? '#dc2626' : '#16a34a']]) {
				const p = (a, r) => `${(70 + Math.cos(a) * r).toFixed(1)} ${(50 + Math.sin(a) * r).toFixed(1)}`;
				board += `<path d="M${p(a0, r0)} L${p(a0, r1)} A${r1} ${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0} ${r0} 0 0 0 ${p(a0, r0)} Z" fill="${c}"/>`;
			}
		}
		const dart = (x, y, a) => `<g transform="rotate(${a} ${x} ${y})"><path d="M${x} ${y} L${x + 22} ${y}" stroke="#a3a3a3" stroke-width="2"/><path d="M${x + 20} ${y} l8 -5 v10 z" fill="#3b82f6"/><circle cx="${x}" cy="${y}" r="1.5" fill="#fde047"/></g>`;
		return `<circle cx="70" cy="50" r="46" fill="#111"/>` + board + `<circle cx="70" cy="50" r="4" fill="#16a34a"/><circle cx="70" cy="50" r="1.8" fill="#dc2626"/>` + dart(70, 50, -20) + dart(76, 26, -10) + dart(92, 60, 15) + txt(136, 30, 13, '301', '#fde047') + txt(136, 46, 8, 'T20!', '#4ade80');
	},

	longbow: () => `<rect x="0" y="84" width="160" height="16" fill="#22c55e"/><path d="M28 18 Q54 50 28 82" stroke="#78350f" stroke-width="4" fill="none"/><path d="M28 18 L16 50 L28 82" stroke="#e5e7eb" stroke-width="1"/>` +
		`<path d="M16 50 L70 42" stroke="#78350f" stroke-width="2"/><path d="M72 42 l-6 -3 v6 z" fill="#9ca3af"/><path d="M16 50 l-6 -3 l3 3 l-3 3 z" fill="#ef4444"/>` +
		`<path d="M76 40 Q104 28 126 46" stroke="#fff" stroke-width="1" stroke-dasharray="2 3" fill="none"/>` +
		`<rect x="130" y="40" width="3" height="44" fill="#92400e"/>` + [[1, '#f8fafc'], [0.75, '#111827'], [0.5, '#3b82f6'], [0.32, '#ef4444'], [0.15, '#facc15']].map(([k, c]) => `<ellipse cx="132" cy="48" rx="${6 * k + 2}" ry="${22 * k}" fill="${c}"/>`).join('') +
		`<path d="M132 48 L116 52" stroke="#78350f" stroke-width="2"/><path d="M116 52 l-5 -3 l2 3 l-2 3 z" fill="#ef4444"/>` +
		`<ellipse cx="96" cy="16" rx="6" ry="8" fill="#a855f7"/><path d="M96 24 q2 6 -1 10" stroke="#475569" fill="none"/><ellipse cx="112" cy="22" rx="5" ry="7" fill="#f59e0b"/>`,

	curling: (u) => `<rect width="160" height="100" fill="#e2e8f0"/><g transform="translate(80 40) scale(1 0.45)">` + [[44, '#2563eb'], [30, '#f8fafc'], [16, '#dc2626'], [5, '#f8fafc']].map(([r, c]) => `<circle r="${r}" fill="${c}"/>`).join('') + `</g><path d="M0 40 H160" stroke="#94a3b8" stroke-width="0.8"/><path d="M80 0 V100" stroke="#cbd5e1" stroke-width="0.8"/>` +
		[[66, 38, '#dc2626'], [96, 46, '#facc15'], [82, 80, '#dc2626']].map(([x, y, c], i) => `<ellipse cx="${x}" cy="${y + 4}" rx="11" ry="5" fill="#475569"/><ellipse cx="${x}" cy="${y}" rx="11" ry="5.5" fill="#6b7280"/><ellipse cx="${x}" cy="${y - 1.5}" rx="7" ry="3.2" fill="${c}"/><rect x="${x - 1.5}" y="${y - 6}" width="3" height="5" fill="${tone(c, -0.3)}"/>`).join('') +
		`<path d="M82 74 Q80 60 74 50" stroke="#475569" stroke-width="1" stroke-dasharray="2 2" fill="none"/><g transform="rotate(-25 118 76)"><rect x="116" y="50" width="3" height="34" fill="#1e3a8a"/><rect x="108" y="84" width="20" height="6" rx="2" fill="#1e3a8a"/></g>`,

	'life-lab': () => {
		const cells = [[2, 1], [3, 2], [1, 3], [2, 3], [3, 3], [9, 2], [10, 2], [11, 2], [9, 3], [10, 1], [6, 6], [7, 6], [6, 7], [7, 7], [12, 6], [13, 7], [14, 5], [14, 6], [14, 7], [3, 8], [4, 8], [5, 8]];
		return `<rect width="160" height="100" fill="#080c18" opacity="0.6"/>` + Array.from({ length: 17 }, (_, i) => `<path d="M${i * 10} 0 V100" stroke="rgba(255,255,255,0.05)"/>`).join('') + Array.from({ length: 11 }, (_, i) => `<path d="M0 ${i * 10} H160" stroke="rgba(255,255,255,0.05)"/>`).join('') +
			cells.map(([c, r], i) => `<rect x="${c * 10 + 1}" y="${r * 10 + 1}" width="8" height="8" rx="1.5" fill="${i < 5 ? '#fde68a' : i < 10 ? '#4f8cff' : i < 14 ? '#34d399' : '#f472b6'}"/>`).join('') +
			`<path d="M40 40 l8 8" stroke="#fde68a" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M46 49 l3 -1 l-1 -3" stroke="#fde68a" stroke-width="1.5" fill="none"/>`;
	},

	'ant-colony': () => `<rect x="0" y="0" width="160" height="24" fill="#65a30d" opacity="0.6"/><rect x="0" y="24" width="160" height="76" fill="#78350f"/><path d="M60 24 Q80 8 100 24 Z" fill="#a16207"/>` +
		`<path d="M80 24 V40 Q80 48 70 52 L40 60 M80 40 Q88 50 110 52 L130 70 M70 52 Q66 66 72 80 L96 86" stroke="#3b1d0e" stroke-width="7" fill="none" stroke-linecap="round"/>` +
		`<ellipse cx="40" cy="62" rx="12" ry="7" fill="#3b1d0e"/><ellipse cx="132" cy="72" rx="12" ry="7" fill="#3b1d0e"/><ellipse cx="98" cy="86" rx="13" ry="7" fill="#3b1d0e"/>` +
		[[36, 62], [42, 61], [46, 63], [128, 72], [134, 71]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#bef264"/>`).join('') + [[92, 86], [98, 84], [104, 87]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="1.4" fill="#f5f5f4"/>`).join('') +
		[[80, 32], [74, 50], [90, 48], [104, 52], [56, 56], [68, 72], [120, 60]].map(([x, y], i) => `<g transform="rotate(${i * 50} ${x} ${y})"><ellipse cx="${x - 2.5}" cy="${y}" rx="1.8" ry="1.3" fill="#111"/><ellipse cx="${x}" cy="${y}" rx="1.4" ry="1.1" fill="#111"/><ellipse cx="${x + 2.4}" cy="${y}" rx="1.5" ry="1.2" fill="#111"/><path d="M${x - 1} ${y - 2} l-1 -2 M${x + 1} ${y - 2} l1 -2 M${x - 1} ${y + 2} l-1 2 M${x + 1} ${y + 2} l1 2" stroke="#111" stroke-width="0.6"/></g>`).join('') +
		`<circle cx="140" cy="14" r="7" fill="#84cc16"/><path d="M100 18 Q120 10 134 14" stroke="#f97316" stroke-width="2" fill="none" opacity="0.7" stroke-dasharray="2 2"/>`,

	ecosystem: () => `<rect x="0" y="0" width="160" height="72" fill="#65a30d" opacity="0.5"/>` + Array.from({ length: 26 }, (_, i) => `<path d="M${(i * 31) % 160} ${16 + (i * 17) % 52} l2 -5 l2 5" stroke="#3f6212" stroke-width="1.2" fill="none"/>`).join('') +
		[[40, 36], [62, 50], [84, 30], [30, 58]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="6" ry="4.5" fill="#f5f5f4"/><circle cx="${x + 5}" cy="${y - 3}" r="3.4" fill="#f5f5f4"/><path d="M${x + 4} ${y - 6} l-1 -6 M${x + 6.5} ${y - 6} l1 -6" stroke="#f5f5f4" stroke-width="1.6" stroke-linecap="round"/><circle cx="${x + 6}" cy="${y - 3.5}" r="0.8" fill="${INK}"/>`).join('') +
		`<g transform="translate(118 40)"><ellipse cx="0" cy="0" rx="11" ry="6" fill="#ea580c"/><path d="M8 -4 l9 -3 l-3 7 z" fill="#ea580c"/><path d="M9 -6 l1 -6 l3 5 M13 -7 l2 -6 l2 6" fill="#ea580c"/><circle cx="13" cy="-3" r="1" fill="${INK}"/><path d="M-10 0 q-10 -4 -14 2 q6 4 12 2" fill="#fdba74"/></g>` +
		`<rect x="0" y="72" width="160" height="28" fill="#0f172a"/><path d="M8 94 L28 84 L48 88 L68 78 L88 86 L108 80 L128 90 L150 84" stroke="#f5f5f4" stroke-width="2" fill="none"/><path d="M8 96 L28 94 L48 92 L68 94 L88 90 L108 92 L128 88 L150 90" stroke="#fb923c" stroke-width="2" fill="none"/>`,

	'tiny-town': () => `<rect width="160" height="100" fill="#4d7c0f" opacity="0.5"/><rect x="0" y="50" width="160" height="12" fill="#4b5563"/><path d="M4 56 H156" stroke="#fde68a" stroke-dasharray="6 5"/><rect x="74" y="0" width="12" height="50" fill="#4b5563"/>` +
		[[20, 34, '#60a5fa'], [42, 30, '#fbbf24'], [100, 34, '#60a5fa']].map(([x, y, c]) => `<rect x="${x}" y="${y}" width="16" height="16" fill="${c}"/><path d="M${x - 3} ${y} L${x + 8} ${y - 9} L${x + 19} ${y} Z" fill="#b91c1c"/><rect x="${x + 6}" y="${y + 8}" width="5" height="8" fill="#1f2937"/>`).join('') +
		`<rect x="122" y="22" width="24" height="28" fill="#f472b6"/><rect x="122" y="22" width="24" height="6" fill="#fdf2f8"/><rect x="130" y="38" width="8" height="12" fill="#1f2937"/>` +
		`<rect x="22" y="70" width="34" height="22" fill="#a16207"/><rect x="44" y="62" width="6" height="10" fill="#57534e"/><circle cx="47" cy="56" r="4" fill="#9ca3af" opacity="0.6"/><circle cx="51" cy="48" r="5" fill="#9ca3af" opacity="0.4"/>` +
		`<rect x="96" y="66" width="44" height="28" rx="4" fill="#22c55e"/><circle cx="108" cy="78" r="6" fill="#15803d"/><circle cx="126" cy="82" r="7" fill="#166534"/><circle cx="96" cy="16" r="6" fill="#15803d"/><circle cx="60" cy="14" r="5" fill="#166534"/>` + txt(144, 12, 8, '$', '#fde047'),
};
