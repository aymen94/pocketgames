// Magnet Lab levels (720 × 480). Each `hint` is a magnet layout found by simulating the
// stream; `need` sits below what it collects, so every level is solvable.

export const LEVELS = [
	{ name: 'Bend It', magnets: 1, emitter: { x: 60, y: 240, dx: 1, dy: 0 }, target: { x: 360, y: 80, r: 30 }, need: 0.8, walls: [], hint: [{ x: 301, y: 285, sign: -1 }] },
	{ name: 'Around the Block', magnets: 2, emitter: { x: 60, y: 120, dx: 1, dy: 0 }, target: { x: 120, y: 380, r: 30 }, need: 0.75, walls: [[250, 40, 250, 300]], hint: [{ x: 64, y: 175, sign: 1 }, { x: 173, y: 243, sign: 1 }] },
	{ name: 'Push Back', magnets: 2, emitter: { x: 360, y: 40, dx: 0, dy: 1 }, target: { x: 600, y: 400, r: 30 }, need: 0.75, walls: [[260, 300, 460, 300], [520, 250, 520, 480]], hint: [{ x: 399, y: 67, sign: 1 }, { x: 580, y: 296, sign: 1 }] },
	{ name: 'Over the Wall', magnets: 2, emitter: { x: 40, y: 350, dx: 1, dy: 0 }, target: { x: 600, y: 360, r: 32 }, need: 0.3, walls: [[320, 180, 320, 480]], hint: [{ x: 20, y: 305, sign: 1 }, { x: 574, y: 287, sign: 1 }] },
	{ name: 'Boomerang', magnets: 2, emitter: { x: 40, y: 140, dx: 1, dy: 0 }, target: { x: 70, y: 320, r: 32 }, need: 0.45, walls: [[0, 230, 300, 230]], hint: [{ x: 533, y: 71, sign: -1 }, { x: 561, y: 239, sign: -1 }] },
	{ name: 'Needle Eye', magnets: 3, emitter: { x: 60, y: 420, dx: 1, dy: -0.3 }, target: { x: 640, y: 80, r: 24 }, need: 0.6, walls: [[300, 0, 300, 200], [300, 280, 300, 480], [500, 120, 720, 120]], hint: [{ x: 170, y: 87, sign: -1 }, { x: 112, y: 314, sign: 1 }, { x: 516, y: 115, sign: 1 }] },
];
