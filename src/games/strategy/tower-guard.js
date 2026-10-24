// Tower Guard: build and upgrade towers beside a winding road to stop 15 waves.

import { Game } from '../core/game.js';
import { Surface, circle, fillRound, text, colors } from '../core/canvas.js';
import { h } from '../../components/dom.js';
import { CanvasFx, ease } from '../core/fx.js';

const T = 32, COLS = 20, ROWS = 14, W = COLS * T, H = ROWS * T;
const WAYPOINTS = [[-1, 2], [6, 2], [6, 10], [12, 10], [12, 4], [17, 4], [17, 12], [20, 12]];
const TOWERS = {
	arrow: { name: 'Arrow', cost: 50, color: '#60a5fa', range: 3.2, rate: 0.55, damage: 14, speed: 520 },
	cannon: { name: 'Cannon', cost: 90, color: '#f97316', range: 2.8, rate: 1.4, damage: 34, speed: 300, splash: 1.1 },
	frost: { name: 'Frost', cost: 70, color: '#67e8f9', range: 2.5, rate: 0.9, damage: 5, speed: 420, slow: 0.5 },
};
const LEVELS = { easy: { hp: 0.8, coins: 140 }, normal: { hp: 1, coins: 120 }, hard: { hp: 1.3, coins: 100 } };
const WAVES = 15;

function pathCells() {
	const cells = new Set();
	for (let k = 0; k < WAYPOINTS.length - 1; k++) {
		const [ax, ay] = WAYPOINTS[k], [bx, by] = WAYPOINTS[k + 1];
		const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
		for (let s = 0; s <= steps; s++) {
			const x = ax + Math.sign(bx - ax) * s, y = ay + Math.sign(by - ay) * s;
			if (x >= 0 && x < COLS) cells.add(y * COLS + x);
		}
	}
	return cells;
}

export default class TowerGuard extends Game {
	static realtime = true;

	async init() {
		this.surface = new Surface(this.ctx.root, W, H + 70);
		this.road = pathCells();
		this.segments = [];
		let total = 0;
		for (let k = 0; k < WAYPOINTS.length - 1; k++) {
			const [ax, ay] = WAYPOINTS[k], [bx, by] = WAYPOINTS[k + 1];
			const length = Math.hypot(bx - ax, by - ay) * T;
			this.segments.push({ ax: ax * T + T / 2, ay: ay * T + T / 2, bx: bx * T + T / 2, by: by * T + T / 2, start: total, length });
			total += length;
		}
		this.pathLength = total;
		this.decor = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 4 }));
		this.fx = new CanvasFx(500);
		this.time = 0;
		this.ctx.input.on(this.surface.canvas, 'click', (e) => this.click(this.surface.local(e)));
		this.reset();
	}

	reset() {
		this.running = false;
		this.tuning = LEVELS[this.ctx.settings.difficulty] ?? LEVELS.normal;
		this.coins = this.tuning.coins;
		this.lives = 20;
		this.wave = 0;
		this.towers = [];
		this.fx?.clear();
		this.enemies = [];
		this.shots = [];
		this.effects = [];
		this.queue = [];
		this.spawnTimer = 0;
		this.breakTimer = 6;
		this.build = 'arrow';
		this.selected = null;
		this.ctx.score(0);
		this.status();
	}

	status() {
		this.ctx.info(`Wave ${Math.min(this.wave, WAVES)}/${WAVES} · ♥ ${this.lives} · ◉ ${this.coins}`);
	}

	posAt(distance) {
		const seg = this.segments.find((s) => distance <= s.start + s.length) ?? this.segments.at(-1);
		const t = Math.min(1, (distance - seg.start) / seg.length);
		return { x: seg.ax + (seg.bx - seg.ax) * t, y: seg.ay + (seg.by - seg.ay) * t };
	}

	startWave() {
		this.wave++;
		const n = 6 + this.wave * 2;
		const scale = (1 + this.wave * 0.28) * this.tuning.hp;
		this.queue = [];
		for (let i = 0; i < n; i++) {
			const brute = this.wave >= 3 && i % 4 === 3;
			const runner = this.wave >= 2 && i % 5 === 1;
			const boss = this.wave % 5 === 0 && i === n - 1;
			const hp = Math.round((boss ? 400 : brute ? 90 : runner ? 28 : 40) * scale);
			this.queue.push({ hp, max: hp, speed: boss ? 34 : brute ? 38 : runner ? 92 : 58, reward: boss ? 60 : brute ? 9 : 5, size: boss ? 14 : brute ? 11 : runner ? 7 : 9, color: boss ? '#e11d48' : brute ? '#a855f7' : runner ? '#facc15' : '#f87171' });
		}
		this.spawnTimer = 0;
		this.ctx.score(this.wave - 1);
		this.ctx.audio.play('opener');
		if (this.wave % 5 === 0) this.ctx.fx.banner(`Wave ${this.wave}: boss!`);
		this.status();
	}

	click({ x, y }) {
		if (!this.running || this.paused) return;
		if (y > H) return this.clickToolbar(x);
		const cx = Math.floor(x / T), cy = Math.floor(y / T), key = cy * COLS + cx;
		const tower = this.towers.find((t) => t.cx === cx && t.cy === cy);
		if (tower) {
			if (this.selected === tower) return this.upgrade(tower);
			this.selected = tower;
			return;
		}
		this.selected = null;
		if (this.road.has(key)) return;
		const def = TOWERS[this.build];
		if (this.coins < def.cost) return this.ctx.audio.play('error');
		this.coins -= def.cost;
		this.towers.push({ type: this.build, cx, cy, x: cx * T + T / 2, y: cy * T + T / 2, level: 1, cooldown: 0, angle: 0, spent: def.cost, built: this.time, kick: 0 });
		// construction: dust and a pop as the tower rises
		this.fx.particles.burst(cx * T + T / 2, cy * T + T - 4, { count: 14, color: '#d6b37a', speed: 90, angle: -Math.PI / 2, spread: 2.8, life: 0.5, shape: 'dust', size: 4 });
		this.fx.popups.add(`-${def.cost}`, cx * T + T / 2, cy * T, { color: '#fde047', size: 13, life: 0.7 });
		this.ctx.audio.play('place');
		this.status();
	}

	upgradeCost(tower) {
		return Math.round(TOWERS[tower.type].cost * 0.8 * tower.level);
	}

	upgrade(tower) {
		if (tower.level >= 3) return;
		const cost = this.upgradeCost(tower);
		if (this.coins < cost) return this.ctx.audio.play('error');
		this.coins -= cost;
		tower.level++;
		tower.built = this.time;
		this.fx.particles.burst(tower.x, tower.y, { count: 22, colors: ['#fde047', '#ffffff', TOWERS[tower.type].color], speed: 150, life: 0.7, shape: 'star', size: 4, gravity: 120 });
		this.fx.particles.ring(tower.x, tower.y, { color: '#fde047', radius: 34 });
		this.fx.popups.add(`LV ${tower.level}`, tower.x, tower.y - 18, { color: '#fde047', size: 15 });
		tower.spent += cost;
		this.ctx.audio.play('coin');
		this.status();
	}

	sell(tower) {
		this.coins += Math.floor(tower.spent * 0.6);
		this.towers = this.towers.filter((t) => t !== tower);
		this.selected = null;
		this.ctx.audio.play('swoosh');
		this.status();
	}

	toolbar() {
		const buttons = Object.entries(TOWERS).map(([key, def], i) => ({ key, x: 12 + i * 128, w: 120, label: `${def.name} ◉${def.cost}`, color: def.color }));
		buttons.push({ key: 'wave', x: W - 150, w: 138, label: this.queue.length || this.enemies.length ? 'Wave in progress' : `Send wave ${this.wave + 1} ▸` });
		return buttons;
	}

	clickToolbar(x) {
		if (this.selected) {
			if (x >= 12 && x < 212) return this.upgrade(this.selected);
			if (x >= 220 && x < 340) return this.sell(this.selected);
			this.selected = null;
		}
		for (const b of this.toolbar()) {
			if (!b.w || x < b.x || x > b.x + b.w) continue;
			if (b.key === 'wave') {
				if (!this.queue.length && !this.enemies.length && this.wave < WAVES) this.startWave();
			} else {
				this.build = b.key;
				this.ctx.audio.play('click');
			}
		}
	}

	update(dt) {
		this.time += dt;
		this.fx.update(dt);
		for (const e of this.effects) e.t -= dt;
		this.effects = this.effects.filter((e) => e.t > 0);
		for (const t of this.towers) t.kick = Math.max(0, t.kick - dt * 6);
		for (const e of this.enemies) if (e.flash > 0) e.flash -= dt * 6;
		if (!this.running) return;
		// waves start by themselves after a short break
		if (!this.queue.length && !this.enemies.length && this.wave < WAVES) {
			this.breakTimer -= dt;
			if (this.breakTimer <= 0) { this.startWave(); this.breakTimer = 8; }
		}
		if (this.queue.length) {
			this.spawnTimer -= dt;
			if (this.spawnTimer <= 0) {
				this.enemies.push({ ...this.queue.shift(), d: 0, slow: 0 });
				this.spawnTimer = 0.75;
			}
		}
		for (const e of this.enemies) {
			if (e.slow > 0) e.slow -= dt;
			e.d += e.speed * (e.slow > 0 ? 0.5 : 1) * dt;
			const p = this.posAt(e.d);
			e.x = p.x; e.y = p.y;
			if (e.d >= this.pathLength) {
				e.gone = true;
				this.lives -= e.size >= 14 ? 5 : 1;
				// a breach: the gate flashes red
				this.fx.flash.trigger('#ef4444', 0.25);
				this.fx.shake.kick(e.size >= 14 ? 8 : 3);
				this.fx.popups.add(`-${e.size >= 14 ? 5 : 1} ♥`, W - 40, 12 * T, { color: '#fca5a5', size: 16 });
				this.ctx.audio.play('error');
				this.status();
			}
		}
		this.enemies = this.enemies.filter((e) => !e.gone && e.hp > 0);
		if (this.lives <= 0) {
			return this.finish({ win: false, title: 'The gate fell', message: `You held out for ${this.wave - 1} ${this.wave - 1 === 1 ? 'wave' : 'waves'}.`, score: Math.max(0, this.wave - 1) });
		}

		for (const t of this.towers) {
			const def = TOWERS[t.type];
			t.cooldown -= dt;
			const range = def.range * T * (1 + (t.level - 1) * 0.15);
			let target = null;
			for (const e of this.enemies) {
				if (Math.hypot(e.x - t.x, e.y - t.y) <= range && (!target || e.d > target.d)) target = e;
			}
			if (!target) continue;
			t.angle = Math.atan2(target.y - t.y, target.x - t.x);
			if (t.cooldown > 0) continue;
			t.cooldown = def.rate / (1 + (t.level - 1) * 0.25);
			this.shots.push({ x: t.x, y: t.y, target, type: t.type, damage: def.damage * (1 + (t.level - 1) * 0.6), speed: def.speed });
			t.kick = 1;
			// muzzle flash at the barrel tip
			this.fx.particles.burst(t.x + Math.cos(t.angle) * 16, t.y + Math.sin(t.angle) * 16, { count: t.type === 'cannon' ? 8 : 3, color: def.color, speed: 80, angle: t.angle, spread: 0.9, life: 0.18, shape: 'spark', size: 2.5, glow: true });
			if (t.type === 'arrow') this.ctx.audio.play('blip');
			else if (t.type === 'frost') this.ctx.audio.play('zap');
		}

		for (const s of this.shots) {
			const dx = s.target.x - s.x, dy = s.target.y - s.y;
			const dist = Math.hypot(dx, dy);
			const step = s.speed * dt;
			if (dist <= step || s.target.hp <= 0) {
				s.done = true;
				if (s.target.hp > 0 || s.type === 'cannon') this.impact(s);
			} else {
				s.x += (dx / dist) * step;
				s.y += (dy / dist) * step;
				// trails: smoke behind shells, a glint behind arrows and frost
				if (Math.random() < 0.6) this.fx.particles.burst(s.x, s.y, { count: 1, color: s.type === 'cannon' ? '#64748b' : TOWERS[s.type].color, speed: 8, life: s.type === 'cannon' ? 0.45 : 0.18, shape: s.type === 'cannon' ? 'smoke' : 'dot', size: s.type === 'cannon' ? 4 : 2, grow: 6, glow: s.type !== 'cannon' });
			}
		}
		this.shots = this.shots.filter((s) => !s.done);

		if (this.wave >= WAVES && !this.queue.length && !this.enemies.length) {
			this.ctx.score(WAVES);
			this.finish({ win: true, title: 'Kingdom saved!', message: `All ${WAVES} waves repelled with ${this.lives} lives to spare.`, score: WAVES });
		}
	}

	impact(s) {
		const def = TOWERS[s.type];
		const hit = (e, damage) => {
			if (e.hp <= 0) return;
			e.hp -= damage;
			e.flash = 1;
			if (def.slow) { e.slow = 1.5; this.fx.particles.burst(e.x, e.y, { count: 5, color: '#cffafe', speed: 50, life: 0.4, shape: 'star', size: 2.5 }); }
			if (e.hp <= 0) {
				this.coins += e.reward;
				this.status();
				this.effects.push({ x: e.x, y: e.y, t: 0.3, color: e.color, r: e.size * 2 });
				this.fx.particles.burst(e.x, e.y, { count: e.size >= 14 ? 30 : 12, colors: [e.color, '#ffffff'], speed: 150, life: 0.5, shape: 'square', size: 3.5, gravity: 220 });
				this.fx.particles.burst(e.x, e.y, { count: 3, color: '#fde047', speed: 60, angle: -Math.PI / 2, spread: 1, life: 0.6, shape: 'dot', size: 3, gravity: 150 });
				this.fx.popups.add(`+${e.reward}`, e.x, e.y - 10, { color: '#fde047', size: 12, life: 0.6, rise: 22 });
				if (e.size >= 14) { this.fx.shake.kick(6); this.ctx.audio.play('blast'); }
			}
		};
		if (def.splash) {
			const x = s.target.x, y = s.target.y;
			this.effects.push({ x, y, t: 0.25, color: '#fdba74', r: def.splash * T });
			this.ctx.audio.play('explode');
			this.fx.particles.burst(x, y, { count: 14, colors: ['#fdba74', '#fde047', '#ffffff'], speed: 160, life: 0.4, shape: 'spark', size: 3, glow: true });
			this.fx.shake.kick(2);
			for (const e of this.enemies) if (Math.hypot(e.x - x, e.y - y) <= def.splash * T) hit(e, s.damage);
		} else hit(s.target, s.damage);
	}

	render() {
		const g = this.surface.g;
		const fx = this.fx;
		fx.shake.apply(g);
		g.fillStyle = '#3f7d3a';
		g.fillRect(-8, -8, W + 16, H + 16);
		for (const d of this.decor) circle(g, d.x, d.y, d.r, 'rgba(25,60,25,0.35)');
		for (const key of this.road) {
			const x = (key % COLS) * T, y = Math.floor(key / COLS) * T;
			g.fillStyle = '#d6b37a';
			g.fillRect(x, y, T, T);
		}
		g.strokeStyle = 'rgba(120,80,40,0.35)';
		g.setLineDash([6, 8]);
		g.lineWidth = 2;
		g.beginPath();
		for (const seg of this.segments) { g.moveTo(seg.ax, seg.ay); g.lineTo(seg.bx, seg.by); }
		g.stroke();
		g.setLineDash([]);

		for (const t of this.towers) {
			const def = TOWERS[t.type];
			if (t === this.selected) {
				g.fillStyle = 'rgba(255,255,255,0.12)';
				g.beginPath(); g.arc(t.x, t.y, def.range * T * (1 + (t.level - 1) * 0.15), 0, Math.PI * 2); g.fill();
			}
			// towers spring up when built or upgraded; barrels recoil on each shot
			const grow = ease.outBack(Math.min(1, (this.time - t.built) / 0.4));
			g.save();
			g.translate(t.x, t.y);
			g.scale(grow, grow);
			fillRound(g, -13, -13, 26, 26, 6, '#334155');
			circle(g, 0, 0, 9, def.color);
			g.strokeStyle = def.color;
			g.lineWidth = 5;
			const reach = 14 - t.kick * 4;
			g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(t.angle) * reach, Math.sin(t.angle) * reach); g.stroke();
			g.restore();
			for (let k = 0; k < t.level; k++) circle(g, t.x - 8 + k * 8, t.y + 16, 2.5, '#fde047');
		}
		for (const e of this.enemies) {
			circle(g, e.x, e.y + 2, e.size, 'rgba(0,0,0,0.25)');
			circle(g, e.x, e.y, e.size, e.flash > 0 ? '#ffffff' : e.slow > 0 ? '#93c5fd' : e.color);
			g.fillStyle = '#111';
			g.fillRect(e.x - 12, e.y - e.size - 7, 24, 4);
			g.fillStyle = '#4ade80';
			g.fillRect(e.x - 12, e.y - e.size - 7, 24 * Math.max(0, e.hp / e.max), 4);
		}
		for (const s of this.shots) circle(g, s.x, s.y, s.type === 'cannon' ? 5 : 3, TOWERS[s.type].color);
		for (const fx of this.effects) {
			g.globalAlpha = fx.t * 3;
			circle(g, fx.x, fx.y, fx.r * (1.2 - fx.t * 2), fx.color);
		}
		g.globalAlpha = 1;
		fx.draw(g);
		fillRound(g, W - 34, 12 * T + 4, 30, 24, 4, '#78350f');
		text(g, 'GATE', W - 19, 12 * T + 16, { size: 8 });

		// toolbar
		g.fillStyle = colors.panel;
		g.fillRect(0, H, W, 70);
		if (this.selected) {
			const t = this.selected, def = TOWERS[t.type];
			const up = t.level < 3 ? `Upgrade ◉${this.upgradeCost(t)}` : 'Max level';
			fillRound(g, 12, H + 16, 200, 38, 10, t.level < 3 && this.coins >= this.upgradeCost(t) ? colors.blue : colors.line);
			text(g, up, 112, H + 35, { size: 14 });
			fillRound(g, 220, H + 16, 120, 38, 10, '#7f1d1d');
			text(g, `Sell ◉${Math.floor(t.spent * 0.6)}`, 280, H + 35, { size: 14 });
			text(g, `${def.name} tower · level ${t.level}`, 470, H + 35, { size: 14, color: colors.muted });
			g.restore();
			fx.flash.draw(g, W, H);
			return;
		}
		for (const b of this.toolbar()) {
			if (!b.w) continue;
			const active = b.key === this.build;
			const affordable = b.key === 'wave' || this.coins >= TOWERS[b.key].cost;
			fillRound(g, b.x, H + 16, b.w, 38, 10, active ? '#26306a' : colors.panel2);
			if (active) { g.strokeStyle = b.color; g.lineWidth = 2; g.stroke(); }
			if (b.color) circle(g, b.x + 16, H + 35, 7, b.color);
			text(g, b.label, b.x + (b.color ? 70 : b.w / 2), H + 35, { size: 13, color: affordable ? colors.text : colors.muted });
		}
		if (this.running && this.wave === 0) text(g, 'Pick a tower below, then tap grass to build. Tap a tower to upgrade.', W / 2, 20, { size: 13, color: '#fff' });
		g.restore();
		fx.flash.draw(g, W, H);
	}

	dispose() {
		this.surface.dispose();
	}
}
