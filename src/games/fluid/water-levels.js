// Water Flow levels (640 × 520 logical units). Every level's `hint` is a plank layout
// that was verified by simulating the liquid, and `need` sits about ten points below what
// that layout delivers, so each level is solvable with room to spare. Planks start flat,
// away from the solution; `lock: 'turn'` planks rotate but cannot be moved.

const flat = (hint, offsets) => hint.map((h, i) => ({ x: h.x + offsets[i][0], y: h.y + offsets[i][1], a: 0, len: h.len, lock: h.lock }));

const raw = [
	{ name: 'First Pour', source: { x: 110, y: 40, total: 240 }, need: 0.5, cup: { x: 440, y: 400, w: 150, h: 100 },
		hint: [{ x: 160, y: 170, a: 15, len: 260 }, { x: 400, y: 300, a: 30, len: 200 }], offsets: [[0, 0], [0, 0]] },
	{ name: 'Gatekeeper', source: { x: 120, y: 30, total: 260 }, need: 0.6, cup: { x: 370, y: 380, w: 120, h: 100 },
		walls: [[70, 20, 70, 190], [170, 20, 170, 190]], gates: [[70, 190, 170, 190]], fires: [{ x: 40, y: 470, w: 220, h: 50 }],
		hint: [{ x: 237, y: 256, a: 30, len: 300 }], offsets: [[230, -60]] },
	{ name: 'Over the Fire', source: { x: 80, y: 40, total: 260 }, need: 0.6, cup: { x: 500, y: 380, w: 110, h: 110 },
		fires: [{ x: 230, y: 300, w: 150, h: 36 }],
		hint: [{ x: 94, y: 84, a: 30, len: 160 }, { x: 292, y: 247, a: 15, len: 160 }, { x: 435, y: 344, a: 30, len: 120 }], offsets: [[60, 80], [30, -40], [0, -120]] },
	{ name: 'Uphill Thinking', source: { x: 570, y: 30, total: 280 }, need: 0.45, cup: { x: 30, y: 330, w: 130, h: 90 },
		walls: [[320, 380, 320, 520]], fires: [{ x: 330, y: 480, w: 300, h: 40 }],
		hint: [{ x: 492, y: 129, a: 150, len: 220 }, { x: 280, y: 230, a: 165, len: 200 }, { x: 597, y: 340, a: 0, len: 140 }], offsets: [[-40, 80], [-120, -100], [-160, 40]] },
	{ name: 'Zigzag', source: { x: 320, y: 30, total: 300 }, need: 0.35, cup: { x: 30, y: 430, w: 110, h: 80 },
		fires: [{ x: 0, y: 200, w: 40, h: 160 }, { x: 600, y: 160, w: 40, h: 240 }, { x: 180, y: 470, w: 460, h: 50 }],
		hint: [{ x: 322, y: 138, a: 0, len: 160 }, { x: 370, y: 170, a: 180, len: 160 }, { x: 218, y: 298, a: 135, len: 160 }], offsets: [[120, 160], [-160, 80], [200, 80]] },
	{ name: 'Split Decision', source: { x: 320, y: 30, total: 300 }, need: 0.35, cup: { x: 480, y: 440, w: 130, h: 70 },
		walls: [[320, 120, 230, 170], [320, 120, 410, 170]], gates: [[190, 260, 270, 260], [370, 260, 450, 260]], fires: [{ x: 120, y: 440, w: 160, h: 40 }],
		hint: [{ x: 220, y: 310, a: 0, len: 180, lock: 'turn' }, { x: 366, y: 428, a: 30, len: 180 }], offsets: [[0, 0], [-240, -60]] },
	{ name: 'Needle', source: { x: 60, y: 40, total: 260 }, need: 0.15, cup: { x: 300, y: 450, w: 64, h: 60 },
		fires: [{ x: 0, y: 490, w: 290, h: 30 }, { x: 374, y: 490, w: 266, h: 30 }],
		hint: [{ x: 154, y: 148, a: 15, len: 220 }, { x: 269, y: 265, a: 30, len: 160 }, { x: 434, y: 339, a: 135, len: 140 }], offsets: [[300, 0], [200, -60], [-260, 0]] },
	{ name: 'The Long Way', source: { x: 60, y: 30, total: 320 }, need: 0.37, cup: { x: 520, y: 330, w: 100, h: 90 },
		walls: [[300, 0, 300, 230], [440, 420, 640, 420]], fires: [{ x: 0, y: 480, w: 640, h: 40 }],
		hint: [{ x: 93, y: 107, a: 15, len: 200 }, { x: 380, y: 285, a: 15, len: 270 }, { x: 136, y: 360, a: 90, len: 160 }, { x: 520, y: 177, a: 135, len: 120 }], offsets: [[60, 120], [-160, 120], [300, 0], [-120, 120]] },
];

export const LEVELS = raw.map(({ hint, offsets, ...level }) => ({ ...level, hint, planks: flat(hint, offsets) }));
