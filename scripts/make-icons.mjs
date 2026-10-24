// Renders the PocketGames app icons as PNGs (no dependencies): the same design as
// public/icons/icon.svg, drawn with signed-distance shapes and 4× supersampling.
// Usage: node scripts/make-icons.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}
function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const [r, g, b, a] = pixel(x, y);
			const o = y * (size * 4 + 1) + 1 + x * 4;
			raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const roundRect = (x, y, cx, cy, hw, hh, r) => {
	const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
	return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r;
};
const capsule = (x, y, ax, ay, bx, by, r) => {
	const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
	const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
	return Math.hypot(px - dx * t, py - dy * t) - r;
};

/** Colour of the 512-unit design at (x, y); `maskable` fills the whole square. */
function design(x, y, maskable) {
	const bg = [11, 16, 32];
	if (!maskable && roundRect(x, y, 256, 256, 256, 256, 112) > 0) return null;
	const s = maskable ? 0.8 : 1, ox = 256 - 256 * s;
	const u = (x - ox) / s, v = (y - ox) / s;
	if (roundRect(u, v, 256, 256, 200, 120, 120) <= 0) {
		const t = Math.max(0, Math.min(1, (u + v - 192) / 640));
		let col = [79 + (139 - 79) * t, 140 + (92 - 140) * t, 255 + (246 - 255) * t];
		if (capsule(u, v, 168, 216, 168, 296, 15) <= 0 || capsule(u, v, 128, 256, 208, 256, 15) <= 0) col = [255, 255, 255];
		if (Math.hypot(u - 336, v - 230) <= 24) col = [255, 255, 255];
		if (Math.hypot(u - 384, v - 282) <= 24) col = [253, 224, 71];
		return col;
	}
	return bg;
}

function render(size, maskable) {
	const k = 512 / size, ss = 4;
	return png(size, (px, py) => {
		let r = 0, g = 0, b = 0, a = 0;
		for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
			const c = design((px + (i + 0.5) / ss) * k, (py + (j + 0.5) / ss) * k, maskable);
			if (!c) continue;
			r += c[0]; g += c[1]; b += c[2]; a++;
		}
		const n = ss * ss;
		return a ? [Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / n) * 255)] : [0, 0, 0, 0];
	});
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, false));
writeFileSync('public/icons/icon-512.png', render(512, false));
writeFileSync('public/icons/maskable-512.png', render(512, true));
console.log('icons written to public/icons');
