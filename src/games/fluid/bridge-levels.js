// Bridge Builder levels (800 × 500). `left`/`right` are the cliff edges, `top` the road
// height; anchors are the fixed joints you can build from.

const level = (name, left, right, budget, extra = {}) => ({
	name, left, right, top: 300, budget,
	anchors: [[left, 300], [left, 380], [right, 300], [right, 380], ...(extra.anchors ?? [])],
	...extra,
});

export const LEVELS = [
	level('Little Gap', 300, 460, 120),
	level('Creek', 260, 520, 180),
	level('River', 220, 580, 240),
	level('Pillar', 160, 640, 330, { pillar: [400, 420], anchors: [[400, 420]] }),
	level('Canyon', 140, 660, 350, { truck: 4 }),
	level('Long Haul', 100, 700, 400, { pillar: [400, 440], anchors: [[400, 440]], truck: 4 }),
];
