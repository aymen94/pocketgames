// Squad Tactics: a turn-based skirmish on a grid. Each of your three heroes may move, then
// act (attack or heal) once per turn. The raiders move after you and chase the weakest
// hero in reach. Clear a wave to heal up and face a bigger one.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text, colors } from '../core/canvas.js';

const COLS = 12, ROWS = 8, CELL = 56;
const W = COLS * CELL, H = ROWS * CELL + 40;

const KINDS = {
	knight: { name: 'Knight', hp: 14, move: 3, min: 1, range: 1, dmg: [4, 6], color: '#3b82f6', glyph: '⚔' },
	archer: { name: 'Archer', hp: 9, move: 3, min: 2, range: 4, dmg: [3, 4], color: '#22c55e', glyph: '➶' },
	healer: { name: 'Healer', hp: 8, move: 4, min: 1, range: 1, dmg: [1, 2], heal: 5, color: '#e879f9', glyph: '✚' },
	goblin: { name: 'Goblin', hp: 7, move: 4, min: 1, range: 1, dmg: [2, 4], color: '#84cc16', glyph: 'g', foe: true },
	slinger: { name: 'Slinger', hp: 5, move: 3, min: 2, range: 3, dmg: [2, 3], color: '#f59e0b', glyph: 's', foe: true },
	brute: { name: 'Brute', hp: 15, move: 2, min: 1, range: 1, dmg: [4, 6], color: '#ef4444', glyph: 'B', foe: true },
};

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const roll = ([a, b]) => a + Math.floor(Math.random() * (b - a + 1));

export default class SquadTactics extends CanvasGame {
	static W = W;
	static H = H;

	buildToolbar() {
		this.endBtn = tool.button('End turn', () => this.endTurn(), { primary: true });
		this.waveLabel = tool.label('');
		return tool.bar(this.waveLabel, this.endBtn);
	}

	reset() {
		super.reset();
		clearTimeout(this.timer);
		this.shot = null;
		this.wave = 0;
		this.kills = 0;
		this.units = [this.unit('knight', 1, 3), this.unit('archer', 0, 4), this.unit('healer', 0, 2)];
		this.ctx.score(0);
		this.nextWave();
	}

	unit(kind, x, y) {
		const k = KINDS[kind];
		return { kind, ...k, x, y, max: k.hp, moved: false, acted: false, dx: x, dy: y, flash: 0 };
	}

	nextWave() {
		this.wave++;
		this.waveLabel.textContent = `Wave ${this.wave}`;
		this.rocks = new Set();
		for (let i = 0; i < 10 + Math.floor(Math.random() * 6); i++) {
			const x = 3 + Math.floor(Math.random() * 6), y = Math.floor(Math.random() * ROWS);
			if (!this.unitAt(x, y)) this.rocks.add(y * COLS + x);
		}
		const foes = Math.min(9, 2 + this.wave);
		const kinds = ['goblin', 'goblin', 'slinger', 'brute'];
		for (let i = 0; i < foes; i++) {
			let x, y;
			do { x = COLS - 1 - Math.floor(Math.random() * 3); y = Math.floor(Math.random() * ROWS); } while (this.unitAt(x, y) || this.rocks.has(y * COLS + x));
			const kind = this.wave < 2 && kinds[i % 4] === 'brute' ? 'goblin' : kinds[Math.floor(Math.random() * Math.min(4, 2 + this.wave))];
			this.units.push(this.unit(kind, x, y));
		}
		this.startPlayerTurn();
	}

	heroes() { return this.units.filter((u) => !u.foe && u.hp > 0); }
	foes() { return this.units.filter((u) => u.foe && u.hp > 0); }
	unitAt(x, y) { return this.units.find((u) => u.hp > 0 && u.x === x && u.y === y); }
	blocked(x, y, mover) { return x < 0 || y < 0 || x >= COLS || y >= ROWS || this.rocks.has(y * COLS + x) || (this.unitAt(x, y) && this.unitAt(x, y) !== mover); }

	/** Cells reachable within the unit's move, walking around rocks and other units. */
	reach(u) {
		const out = new Map([[u.y * COLS + u.x, 0]]);
		const queue = [[u.x, u.y, 0]];
		while (queue.length) {
			const [x, y, d] = queue.shift();
			if (d >= u.move) continue;
			for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nx = x + dx, ny = y + dy, key = ny * COLS + nx;
				if (this.blocked(nx, ny, u) || out.has(key)) continue;
				out.set(key, d + 1);
				queue.push([nx, ny, d + 1]);
			}
		}
		return out;
	}

	targets(u, from = u) {
		const list = u.heal ? this.units.filter((t) => !t.foe && t.hp > 0 && t !== u && t.hp < t.max && dist(from, t) <= 1) : [];
		const enemies = this.units.filter((t) => t.hp > 0 && t.foe !== u.foe && dist(from, t) >= u.min && dist(from, t) <= u.range);
		return [...list, ...enemies];
	}

	startPlayerTurn() {
		this.phase = 'player';
		for (const u of this.heroes()) { u.moved = false; u.acted = false; }
		this.selected = null;
		this.endBtn.disabled = false;
		this.ctx.info('Your turn: pick a hero');
		this.wake();
	}

	cellAt(p) {
		const x = Math.floor(p.x / CELL), y = Math.floor((p.y - 40) / CELL);
		return x >= 0 && y >= 0 && x < COLS && y < ROWS ? { x, y } : null;
	}

	pointerDown(p) {
		if (!this.running || this.phase !== 'player' || this.busy()) return;
		const cell = this.cellAt(p);
		if (!cell) return;
		const there = this.unitAt(cell.x, cell.y);
		const sel = this.selected;
		if (sel && !sel.acted && there && this.targets(sel).includes(there)) return this.act(sel, there);
		if (there && !there.foe) {
			if (there === sel && sel.moved && !sel.acted) { sel.acted = true; this.selected = null; this.afterAction(); return; }
			if (there.acted) return this.ctx.audio.play('error');
			this.selected = there;
			this.ctx.audio.play('select');
			this.ctx.info(`${there.name}: ${there.moved ? 'choose a target, or click it again to wait' : 'move, or act from here'}`);
			return;
		}
		if (sel && !sel.moved && !there && this.reach(sel).has(cell.y * COLS + cell.x)) {
			this.walk(sel, cell.x, cell.y);
			sel.moved = true;
			this.ctx.audio.play('move');
			if (!this.targets(sel).length) { sel.acted = true; this.selected = null; this.afterAction(); }
			return;
		}
		this.selected = null;
	}

	walk(u, x, y) { u.dx = u.x; u.dy = u.y; u.x = x; u.y = y; u.walk = 0; }

	act(u, t) {
		u.moved = true;
		u.acted = true;
		const [cx, cy] = this.px(t);
		if (u.heal && !t.foe) {
			t.hp = Math.min(t.max, t.hp + u.heal);
			this.popup(`+${u.heal}`, cx, cy - 20, { color: '#86efac', size: 20 });
			this.ctx.audio.play('powerup');
			this.burst(cx, cy, { count: 14, color: '#86efac', speed: 80, life: 0.6, shape: 'star', size: 3, gravity: -60 });
		} else this.hit(u, t);
		this.selected = null;
		this.afterAction();
	}

	hit(u, t) {
		const dmg = roll(u.dmg);
		t.hp -= dmg;
		t.flash = 1;
		const [cx, cy] = this.px(t);
		this.popup(`-${dmg}`, cx, cy - 20, { color: '#fca5a5', size: 22 });
		this.ctx.audio.play(u.range > 1 ? 'shoot' : 'hit');
		if (u.range > 1) { const [ux, uy] = this.px(u); this.shot = { x0: ux, y0: uy, x1: cx, y1: cy, t: 0 }; }
		this.burst(cx, cy, { count: 10, color: '#fde68a', speed: 120, life: 0.4, size: 3 });
		if (t.hp <= 0) {
			this.ctx.audio.play('explode');
			this.burst(cx, cy, { count: 24, color: t.color, speed: 160, life: 0.6, shape: 'square', size: 4 });
			if (t.foe) { this.kills++; this.ctx.score(this.kills * 10 + (this.wave - 1) * 50); }
		}
	}

	afterAction() {
		if (!this.foes().length) return this.waveCleared();
		if (this.heroes().every((u) => u.acted)) this.endTurn();
		else this.ctx.info('Pick another hero, or End turn');
	}

	waveCleared() {
		this.phase = 'between';
		this.ctx.audio.play('levelup');
		this.ctx.fx.banner(`Wave ${this.wave} cleared!`);
		for (const u of this.heroes()) u.hp = Math.min(u.max, u.hp + Math.ceil(u.max / 2));
		this.units = this.heroes();
		// fallen heroes return at half strength between waves
		for (const kind of ['knight', 'archer', 'healer']) if (!this.units.some((u) => u.kind === kind)) { const u = this.unit(kind, 0, 1 + this.units.length * 2); u.hp = Math.ceil(u.max / 2); this.units.push(u); }
		this.units.forEach((u, i) => { u.x = u.dx = i === 0 ? 1 : 0; u.y = u.dy = 2 + i; });
		this.ctx.score(this.kills * 10 + this.wave * 50);
		this.timer = setTimeout(() => { if (this.running) this.nextWave(); }, 1200);
	}

	endTurn() {
		if (!this.running || this.phase !== 'player') return;
		this.phase = 'enemy';
		this.selected = null;
		this.endBtn.disabled = true;
		this.ctx.info('Raiders are moving…');
		this.queue = this.foes();
		this.timer = setTimeout(() => this.enemyStep(), 300);
	}

	enemyStep() {
		if (!this.running) return;
		const u = this.queue.shift();
		if (!u) return this.startPlayerTurn();
		if (u.hp > 0 && this.heroes().length) {
			const reach = this.reach(u);
			let best = null;
			for (const [key] of reach) {
				const spot = { x: key % COLS, y: Math.floor(key / COLS) };
				const ts = this.heroes().filter((t) => dist(spot, t) >= u.min && dist(spot, t) <= u.range);
				const nearest = Math.min(...this.heroes().map((t) => dist(spot, t)));
				const weakest = ts.length ? Math.min(...ts.map((t) => t.hp)) : 99;
				const score = (ts.length ? 100 - weakest * 3 : -nearest) + (u.range > 1 ? nearest : 0) * 0.3;
				if (!best || score > best.score) best = { spot, score, ts };
			}
			if (best && (best.spot.x !== u.x || best.spot.y !== u.y)) { this.walk(u, best.spot.x, best.spot.y); this.ctx.audio.play('move'); }
			if (best?.ts.length) {
				const t = best.ts.sort((a, b) => a.hp - b.hp)[0];
				this.timer = setTimeout(() => { if (!this.running) return; this.hit(u, t); this.wake(); this.checkLoss(); this.timer = setTimeout(() => this.enemyStep(), 380); }, 280);
				this.wake();
				return;
			}
		}
		this.wake();
		this.timer = setTimeout(() => this.enemyStep(), 200);
	}

	checkLoss() {
		if (this.heroes().length) return;
		clearTimeout(this.timer);
		this.queue = [];
		this.ctx.audio.play('lose');
		this.finish({ win: false, title: 'Squad defeated', message: `You held out until wave ${this.wave} and defeated ${this.kills} raiders.`, score: this.kills * 10 + (this.wave - 1) * 50 });
	}

	px(u) {
		let x = u.x, y = u.y;
		if (u.walk !== undefined && u.walk < 1) { x = u.dx + (u.x - u.dx) * u.walk; y = u.dy + (u.y - u.dy) * u.walk; }
		return [(x + 0.5) * CELL, 40 + (y + 0.5) * CELL];
	}

	busy() { return this.units.some((u) => (u.walk !== undefined && u.walk < 1) || u.flash > 0) || Boolean(this.shot) || this.phase === 'enemy'; }

	tick(dt) {
		for (const u of this.units) {
			if (u.walk !== undefined && u.walk < 1) u.walk = Math.min(1, u.walk + dt * 5);
			if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 3);
		}
		if (this.shot && (this.shot.t += dt * 5) >= 1) this.shot = null;
		this.units = this.units.filter((u) => u.hp > 0 || u.flash > 0);
	}

	draw(g) {
		g.fillStyle = '#14532d';
		g.fillRect(0, 0, W, H);
		fillRound(g, 0, 0, W, 36, 0, '#0b1f12');
		const sel = this.selected;
		const reach = sel && !sel.moved ? this.reach(sel) : null;
		for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
			const key = y * COLS + x, px = x * CELL, py = 40 + y * CELL;
			g.fillStyle = (x + y) % 2 ? '#166534' : '#15803d';
			g.fillRect(px, py, CELL, CELL);
			if (reach?.has(key) && !this.unitAt(x, y)) { g.fillStyle = 'rgba(147,197,253,0.35)'; g.fillRect(px + 2, py + 2, CELL - 4, CELL - 4); }
			if (this.rocks.has(key)) { fillRound(g, px + 6, py + 10, CELL - 12, CELL - 16, 12, '#57534e'); fillRound(g, px + 12, py + 14, CELL - 26, 8, 4, '#a8a29e'); }
		}
		const tg = sel && !sel.acted ? this.targets(sel) : [];
		for (const u of this.units) {
			const [cx, cy] = this.px(u);
			const dim = !u.foe && this.phase === 'player' && u.acted;
			if (tg.includes(u)) { g.strokeStyle = u.foe ? '#fca5a5' : '#86efac'; g.lineWidth = 3; g.strokeRect(cx - CELL / 2 + 3, cy - CELL / 2 + 3, CELL - 6, CELL - 6); }
			if (u === sel) { g.strokeStyle = colors.accent; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, CELL * 0.44, 0, Math.PI * 2); g.stroke(); }
			g.globalAlpha = u.hp <= 0 ? u.flash : dim ? 0.55 : 1;
			circle(g, cx, cy + 3, CELL * 0.34, 'rgba(0,0,0,0.3)');
			circle(g, cx, cy, CELL * 0.34, u.flash > 0 ? '#ffffff' : u.color);
			text(g, u.glyph, cx, cy + 1, { size: 22, color: u.foe ? '#111827' : '#ffffff' });
			fillRound(g, cx - 20, cy + 22, 40, 5, 2, '#111827');
			fillRound(g, cx - 20, cy + 22, 40 * Math.max(0, u.hp / u.max), 5, 2, u.foe ? '#f87171' : '#4ade80');
			g.globalAlpha = 1;
		}
		if (this.shot) {
			const s = this.shot, k = s.t;
			circle(g, s.x0 + (s.x1 - s.x0) * k, s.y0 + (s.y1 - s.y0) * k, 4, '#fde68a');
		}
		const info = sel ? `${sel.name} · HP ${sel.hp}/${sel.max} · move ${sel.move} · range ${sel.min > 1 ? `${sel.min}–` : ''}${sel.range}${sel.heal ? ' · heals' : ''}` : `Wave ${this.wave} · ${this.foes().length} raiders left`;
		text(g, info, 12, 19, { size: 14, align: 'left', color: '#d1fae5' });
		text(g, this.phase === 'enemy' ? 'Raiders’ turn' : 'Your turn', W - 12, 19, { size: 14, align: 'right', color: this.phase === 'enemy' ? '#fca5a5' : '#bbf7d0' });
	}

	teardown() { clearTimeout(this.timer); }
}
