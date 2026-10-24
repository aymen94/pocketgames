// Pixel Peaks: a tile platformer with three hand-built levels, one-way platforms,
// critters to stomp, spikes, pits, gems and coyote-time jumping.

import { Game } from '../core/game.js';
import { Surface, fillRound, circle, text, colors } from '../core/canvas.js';
import { rectsOverlap } from '../core/physics.js';
import { CanvasFx, ease } from '../core/fx.js';

const T = 32, VIEW_W = 640, VIEW_H = 13 * T;
const GRAVITY = 1900, JUMP = 640, RUN = 230, ACCEL = 1800;
const PW = 20, PH = 28;

// # ground  = one-way platform  ^ spikes  * gem  E critter  P start  F flag
const LEVELS = [
	[
		'',
		'',
		'',
		'.....................*.*.*',
		'....................=======..................*.*',
		'...........*.................................=====',
		'.........=====.........*.......*',
		'.....................=====...=====.......*..............*',
		'.......*.............................=====...........====',
		'..P...........E..........^^.......E..................E........F',
		'###########..#######..#######..##########...######..#############',
		'###########..#######..#######..##########...######..#############',
		'###########..#######..#######..##########...######..#############',
	],
	[
		'',
		'..........................................*.*',
		'.........................................=====',
		'...................*.*..............*.................*',
		'..................=====...........=====.............=====',
		'.........*',
		'.......=====.............*.*....................*.*',
		'.......................=======..............=========',
		'....*.........................*.......*...........................*',
		'..P.............E........=====...=====........^^^.E.....^^.....E......F.',
		'##########...##########..................###############################',
		'##########...##########..................###############################',
		'##########...##########..................###############################',
	],
	[
		'',
		'.......................................*',
		'......................................===.............*.*.*',
		'.............*.*.....................................=======',
		'............=====.............*.*',
		'.........................=====.====........*',
		'......*.................................=======.................*',
		'....=====........*.*......................................=====.........*',
		'................=====...........E...............*......................====',
		'..P.....E..........^^^.........#####........E......====.......E....^^...E....F..',
		'############...############...#########...#######.........######################',
		'############...############...#########...#######.........######################',
		'############...############...#########...#######.........######################',
	],
];

export default class PixelPeaks extends Game {
	static realtime = true;

	async init() {
		// dev builds expose the open game for automated play-testing
		if (import.meta.env?.DEV) window.__pgGame = this;
		this.surface = new Surface(this.ctx.root, VIEW_W, VIEW_H);
		this.fx = new CanvasFx(400);
		this.pollen = Array.from({ length: 26 }, () => ({ x: Math.random() * VIEW_W, y: Math.random() * VIEW_H, s: 1 + Math.random() * 2, p: Math.random() * 6 }));
		this.mountains = Array.from({ length: 12 }, (_, i) => ({ x: i * 160 + Math.random() * 60, h: 120 + Math.random() * 120 }));
		this.reset();
	}

	reset() {
		this.running = false;
		this.levelIndex = 0;
		this.gems = 0;
		this.lives = 3;
		this.load();
		this.ctx.score(0);
	}

	load() {
		const rows = LEVELS[this.levelIndex];
		const width = Math.max(...rows.map((r) => r.length)) + 2;
		this.cols = width;
		this.map = rows.map((r) => r.padEnd(width, '.').split(''));
		this.items = [];
		this.critters = [];
		for (let r = 0; r < this.map.length; r++) for (let c = 0; c < width; c++) {
			const ch = this.map[r][c];
			if (ch === 'P') this.startPos = { x: c * T + (T - PW) / 2, y: r * T + T - PH };
			else if (ch === '*') this.items.push({ x: c * T + T / 2, y: r * T + T / 2, taken: false });
			else if (ch === 'E') this.critters.push({ x: c * T + 4, y: r * T + T - 20, w: 24, h: 20, vx: -50, alive: true, squash: 0 });
			else if (ch === 'F') this.flag = { x: c * T, y: r * T };
			else continue;
			this.map[r][c] = '.';
		}
		this.levelGems = this.items.length;
		this.fx?.clear();
		this.spawn();
		this.banner = 1.8;
		this.info();
	}

	spawn() {
		this.p = { x: this.startPos.x, y: this.startPos.y, vx: 0, vy: 0, ground: false, coyote: 0, buffer: 0, face: 1, hurt: 0 };
		this.camX = 0;
	}

	info() {
		const got = this.items.filter((i) => i.taken).length;
		this.ctx.info(`Level ${this.levelIndex + 1}/${LEVELS.length} · ${'♥'.repeat(this.lives)} · gems ${got}/${this.levelGems}`);
	}

	tile(c, r) {
		if (c < 0 || c >= this.cols) return '#';
		if (r < 0 || r >= this.map.length) return '.';
		return this.map[r][c];
	}

	handleInput({ type, action }) {
		if (action !== 'up' && action !== 'action') return;
		if (type === 'down') this.p.buffer = 0.12;
		else if (this.p.vy < -200) this.p.vy *= 0.5; // short hop when released early
	}

	update(dt) {
		if (this.banner > 0) this.banner -= dt;
		this.fx.update(dt);
		for (const q of this.pollen) { q.p += dt; q.x -= dt * 8; q.y += Math.sin(q.p) * dt * 6; if (q.x < -5) q.x = VIEW_W + 5; }
		if (!this.running) return;
		const p = this.p, input = this.ctx.input;
		p.squash = Math.max(0, (p.squash ?? 0) - dt * 6);
		if (p.ground && Math.abs(p.vx) > 40) p.run = (p.run ?? 0) + dt * Math.abs(p.vx) * 0.06;
		const dir = input.axis().x;
		const target = dir * RUN;
		p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), ACCEL * dt * (p.ground ? 1 : 0.7));
		if (dir) p.face = dir;
		p.coyote = p.ground ? 0.1 : p.coyote - dt;
		p.buffer -= dt;
		if (p.buffer > 0 && p.coyote > 0) {
			p.vy = -JUMP;
			p.buffer = 0;
			p.coyote = 0;
			p.squash = -1;
			this.ctx.audio.play('jump');
			this.fx.particles.burst(p.x + PW / 2, p.y + PH, { count: 8, color: '#e9d5ff', speed: 80, angle: Math.PI / 2, spread: 2.8, life: 0.35, shape: 'dust', size: 3 });
		}
		p.vy = Math.min(p.vy + GRAVITY * dt, 900);
		if (p.hurt > 0) p.hurt -= dt;

		// horizontal, then vertical, each resolved against the tiles
		// each pass decides its direction from the velocity before resolving: zeroing it on the
		// first tile must not flip how the next overlapped tile is resolved
		p.x += p.vx * dt;
		const vx = p.vx;
		for (const [c, r] of this.overlapping(p)) {
			if (this.tile(c, r) !== '#') continue;
			if (vx > 0) p.x = c * T - PW; else if (vx < 0) p.x = c * T + T;
			p.vx = 0;
		}
		const prevBottom = p.y + PH;
		p.y += p.vy * dt;
		const wasAir = !p.ground;
		const fall = p.vy;
		p.ground = false;
		for (const [c, r] of this.overlapping(p)) {
			const t = this.tile(c, r);
			const top = r * T;
			if (t === '#' || (t === '=' && fall > 0 && prevBottom <= top + 1)) {
				if (fall > 0) {
					p.y = top - PH;
					p.ground = true;
					// a firm landing squashes the runner and puffs dust
					if (wasAir && fall > 380) {
						p.squash = Math.min(1, fall / 800);
						this.fx.particles.burst(p.x + PW / 2, top, { count: 10, color: '#e9d5ff', speed: 110, angle: -Math.PI / 2, spread: 2.9, life: 0.35, shape: 'dust', size: 3.5 });
					}
				}
				else if (fall < 0 && t === '#') p.y = top + T;
				p.vy = 0;
			}
		}

		const box = { x: p.x, y: p.y, w: PW, h: PH };
		for (const [c, r] of this.overlapping(p)) {
			if (this.tile(c, r) === '^' && rectsOverlap(box, { x: c * T + 4, y: r * T + 14, w: T - 8, h: T - 14 })) return this.hurt();
		}
		if (p.y > this.map.length * T + 60) return this.hurt();

		for (const item of this.items) {
			if (!item.taken && Math.abs(item.x - (p.x + PW / 2)) < 20 && Math.abs(item.y - (p.y + PH / 2)) < 22) {
				item.taken = true;
				this.gems++;
				this.ctx.score(this.gems);
				this.ctx.audio.play('pickup');
				this.fx.particles.burst(item.x, item.y, { count: 14, colors: ['#22d3ee', '#ffffff', '#a5f3fc'], speed: 130, life: 0.5, shape: 'star', size: 3.5, glow: true });
				this.fx.particles.ring(item.x, item.y, { color: '#22d3ee', radius: 22, life: 0.35 });
				this.fx.popups.add('+1', item.x, item.y - 10, { color: '#a5f3fc', size: 15, life: 0.6, rise: 24 });
				this.info();
			}
		}
		for (const e of this.critters) {
			if (!e.alive) { e.squash += dt; continue; }
			e.x += e.vx * dt;
			const ahead = e.vx > 0 ? e.x + e.w : e.x;
			const c = Math.floor(ahead / T), r = Math.floor((e.y + e.h - 1) / T);
			const wall = this.tile(c, r) === '#';
			const floor = this.tile(c, r + 1);
			if (wall || (floor !== '#' && floor !== '=')) e.vx = -e.vx;
			if (rectsOverlap(box, e)) {
				if (p.vy > 0 && prevBottom <= e.y + 8) {
					e.alive = false;
					p.vy = -JUMP * 0.6;
					this.ctx.audio.play('punch');
					this.fx.particles.burst(e.x + e.w / 2, e.y + e.h / 2, { count: 16, colors: ['#f97316', '#fde047', '#ffffff'], speed: 160, life: 0.45, shape: 'star', size: 3.5 });
					this.fx.particles.burst(e.x + e.w / 2, e.y + e.h, { count: 6, color: '#ffffff', speed: 40, life: 0.6, shape: 'smoke', size: 6, grow: 10 });
					this.fx.shake.kick(3);
				} else if (p.hurt <= 0) return this.hurt();
			}
		}
		if (this.flag && p.x + PW > this.flag.x + 8 && p.x < this.flag.x + T && p.y + PH > this.flag.y - T * 2) {
			this.ctx.audio.play('levelup');
			this.fx.particles.confetti(VIEW_W, { count: 80, colors: ['#fde047', '#22d3ee', '#f472b6', '#a78bfa'] });
			this.levelIndex++;
			if (this.levelIndex >= LEVELS.length) {
				this.levelIndex = LEVELS.length - 1;
				return this.finish({ win: true, title: 'Summit reached!', message: `You crossed every peak with ${this.gems} gems.`, score: this.gems });
			}
			this.load();
			return;
		}
		const maxCam = this.cols * T - VIEW_W;
		this.camX = Math.max(0, Math.min(maxCam, this.camX + (p.x - this.camX - VIEW_W * 0.4) * Math.min(1, dt * 6)));
	}

	overlapping(p) {
		const out = [];
		for (let r = Math.floor(p.y / T); r <= Math.floor((p.y + PH - 1) / T); r++) {
			for (let c = Math.floor(p.x / T); c <= Math.floor((p.x + PW - 1) / T); c++) out.push([c, r]);
		}
		return out;
	}

	hurt() {
		this.lives--;
		this.ctx.audio.play('lifelost');
		const p = this.p;
		this.fx.particles.burst(p.x + PW / 2, p.y + PH / 2, { count: 18, colors: ['#fde047', '#ef4444', '#ffffff'], speed: 200, life: 0.6, shape: 'square', size: 4, gravity: 400 });
		this.fx.flash.trigger('#ef4444', 0.3);
		this.fx.shake.kick(8);
		if (this.lives <= 0) {
			this.info();
			return this.finish({ win: false, title: 'Out of lives', message: `You reached level ${this.levelIndex + 1} with ${this.gems} gems.`, score: this.gems });
		}
		this.spawn();
		this.p.hurt = 1.2;
		this.info();
	}

	render() {
		const s = this.surface, g = s.g;
		const sky = g.createLinearGradient(0, 0, 0, VIEW_H);
		sky.addColorStop(0, '#6d28d9');
		sky.addColorStop(0.7, '#c084fc');
		sky.addColorStop(1, '#fbcfe8');
		g.fillStyle = sky;
		g.fillRect(0, 0, VIEW_W, VIEW_H);
		circle(g, 520, 80, 34, 'rgba(255,247,214,0.9)');
		for (const [layer, color, speed] of [[0, 'rgba(76,29,149,0.45)', 0.2], [1, 'rgba(59,7,100,0.55)', 0.45]]) {
			g.fillStyle = color;
			for (const m of this.mountains) {
				const x = ((m.x + layer * 80 - this.camX * speed) % (12 * 160) + 12 * 160) % (12 * 160) - 160;
				g.beginPath();
				g.moveTo(x - 140, VIEW_H);
				g.lineTo(x, VIEW_H - m.h - layer * 40);
				g.lineTo(x + 140, VIEW_H);
				g.fill();
			}
		}
		this.fx.shake.apply(g);
		// drifting pollen catches the light
		for (const q of this.pollen) circle(g, q.x, q.y, q.s, 'rgba(255, 255, 255, 0.45)');
		g.save();
		g.translate(-Math.round(this.camX), 0);
		const c0 = Math.floor(this.camX / T), c1 = c0 + Math.ceil(VIEW_W / T) + 1;
		for (let r = 0; r < this.map.length; r++) for (let c = c0; c <= c1; c++) {
			const t = this.tile(c, r);
			const x = c * T, y = r * T;
			if (t === '#') {
				g.fillStyle = '#7c4a24';
				g.fillRect(x, y, T, T);
				if (this.tile(c, r - 1) !== '#') {
					g.fillStyle = '#4ade80';
					g.fillRect(x, y, T, 9);
					g.fillStyle = '#22c55e';
					g.fillRect(x, y + 7, T, 3);
				} else {
					g.fillStyle = 'rgba(0,0,0,0.12)';
					g.fillRect(x + 6, y + 10, 6, 4);
					g.fillRect(x + 20, y + 22, 5, 4);
				}
			} else if (t === '=') {
				fillRound(g, x, y, T, 12, 3, '#d6a35c');
				g.fillStyle = '#a16207';
				g.fillRect(x, y + 9, T, 3);
			} else if (t === '^') {
				g.fillStyle = '#e2e8f0';
				for (let k = 0; k < 3; k++) {
					g.beginPath();
					g.moveTo(x + k * 10.6, y + T);
					g.lineTo(x + k * 10.6 + 5.3, y + 14);
					g.lineTo(x + (k + 1) * 10.6, y + T);
					g.fill();
				}
			}
		}
		const time = performance.now() / 1000;
		for (const item of this.items) {
			if (item.taken) continue;
			const y = item.y + Math.sin(time * 3 + item.x) * 3;
			g.fillStyle = '#22d3ee';
			g.beginPath(); g.moveTo(item.x, y - 9); g.lineTo(item.x + 8, y); g.lineTo(item.x, y + 9); g.lineTo(item.x - 8, y); g.fill();
			g.fillStyle = 'rgba(255,255,255,0.7)';
			g.fillRect(item.x - 2, y - 5, 3, 4);
		}
		for (const e of this.critters) {
			if (!e.alive && e.squash > 0.4) continue;
			const squash = e.alive ? 1 : 0.35;
			fillRound(g, e.x, e.y + e.h * (1 - squash), e.w, e.h * squash, 9, '#f97316');
			if (e.alive) {
				const look = e.vx > 0 ? 3 : -3;
				circle(g, e.x + 8 + look, e.y + 8, 3.5, '#fff');
				circle(g, e.x + 16 + look, e.y + 8, 3.5, '#fff');
				circle(g, e.x + 8 + look * 1.3, e.y + 8, 1.6, '#111');
				circle(g, e.x + 16 + look * 1.3, e.y + 8, 1.6, '#111');
			}
		}
		if (this.flag) {
			g.fillStyle = '#e2e8f0';
			g.fillRect(this.flag.x + 14, this.flag.y - T * 2, 4, T * 3);
			g.fillStyle = colors.amber;
			g.beginPath(); g.moveTo(this.flag.x + 18, this.flag.y - T * 2); g.lineTo(this.flag.x + 42, this.flag.y - T * 2 + 10 + Math.sin(time * 5) * 2); g.lineTo(this.flag.x + 18, this.flag.y - T * 2 + 20); g.fill();
		}
		const p = this.p;
		if (p.hurt <= 0 || Math.floor(p.hurt * 10) % 2 === 0) {
			// squash on landing (positive), stretch while jumping (negative), feet that run
			const sq = p.squash ?? 0;
			const sx = 1 + sq * 0.25, sy = 1 - sq * 0.25;
			g.save();
			g.translate(p.x + PW / 2, p.y + PH);
			g.scale(sx, sy);
			const stride = p.ground && Math.abs(p.vx) > 40 ? Math.sin(p.run ?? 0) * 4 : 0;
			g.fillStyle = '#7c2d12';
			g.fillRect(-7 + stride, -4, 6, 4);
			g.fillRect(1 - stride, -4, 6, 4);
			fillRound(g, -PW / 2, -PH, PW, PH - 3, 6, '#fde047');
			g.fillStyle = '#ef4444';
			g.fillRect(-PW / 2, -PH + 12, PW, 4);
			// the scarf flutters behind
			g.fillRect(-p.face * (PW / 2 + 6), -PH + 12 + Math.sin(this.banner + (p.run ?? 0) * 2) * 2, 8, 3);
			circle(g, p.face * 4, -PH + 8, 2.5, '#1e293b');
			circle(g, p.face * 4 - 6 * Math.sign(p.face), -PH + 8, 2.5, '#1e293b');
			g.restore();
		}
		this.fx.draw(g);
		g.restore();
		g.restore();
		this.fx.flash.draw(g, VIEW_W, VIEW_H);
		if (this.banner > 0) text(g, `Level ${this.levelIndex + 1}`, VIEW_W / 2, VIEW_H / 3, { size: 40, weight: 900, color: `rgba(255,255,255,${Math.min(1, this.banner)})` });
	}

	dispose() {
		this.surface.dispose();
	}
}
