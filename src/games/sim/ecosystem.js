// Ecosystem: a meadow of grass, rabbits and foxes. Rabbits graze and breed; foxes hunt
// rabbits and breed when well fed; grass regrows. Left alone, the populations boom and
// crash. Keep both species alive as long as you can by planting grass, releasing animals
// and calling a rainstorm. A live graph tracks the populations.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { circle, text } from '../core/canvas.js';

const W = 800, H = 560, FIELD_H = 440, CELL = 10, GW = W / CELL, GH = FIELD_H / CELL;
const DAY = 6; // seconds per day

export default class Ecosystem extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.toolChoice = tool.choice([['grass', 'Plant grass'], ['rabbit', 'Rabbit'], ['fox', 'Fox']], 'grass', (v) => { this.tool = v; });
		this.rainBtn = tool.button('Rain', () => this.rain(), { title: 'Grass grows fast for a while (recharges)' });
		return tool.bar(this.toolChoice.el, this.rainBtn, tool.choice([['1', '1×'], ['2', '2×'], ['4', '4×']], '1', (v) => { this.timeScale = Number(v); }).el);
	}

	setup() {
		this.grass = new Float32Array(GW * GH);
		this.img = new ImageData(GW, GH);
		this.off = document.createElement('canvas');
		this.off.width = GW; this.off.height = GH;
		this.offG = this.off.getContext('2d');
		this.tool = 'grass';
		this.timeScale = 1;
	}

	reset() {
		super.reset();
		for (let i = 0; i < this.grass.length; i++) this.grass[i] = Math.random() < 0.6 ? 0.5 + Math.random() * 0.5 : Math.random() * 0.2;
		this.animals = [];
		for (let i = 0; i < 40; i++) this.add('rabbit', Math.random() * W, Math.random() * FIELD_H);
		for (let i = 0; i < 6; i++) this.add('fox', Math.random() * W, Math.random() * FIELD_H);
		this.time = 0;
		this.rainT = 0;
		this.rainCharge = 1;
		this.history = [];
		this.sampleT = 0;
		this.budget = { rabbit: 10, fox: 3 };
		this.events = 0;
		this.nextEvent = DAY * 8;
		this.effect = null;
		this.ctx.score(0);
	}

	add(kind, x, y) {
		const fox = kind === 'fox';
		this.animals.push({ kind, x, y, a: Math.random() * Math.PI * 2, energy: fox ? 60 : 30, age: 0, cool: fox ? 6 : 3, speed: fox ? 48 : 40, dead: false });
	}

	rain() {
		if (!this.running || this.rainCharge < 1) return this.ctx.audio.play('error');
		this.rainT = 8;
		this.rainCharge = 0;
		this.ctx.audio.play('splash');
	}

	pointerDown(p) {
		if (!this.running || p.y > FIELD_H) return;
		if (this.tool === 'grass') return this.plant(p);
		if (this.budget[this.tool] <= 0) { this.popup('Wait for more', p.x, p.y, { size: 14, color: '#fca5a5' }); return this.ctx.audio.play('error'); }
		this.budget[this.tool]--;
		const n = this.tool === 'rabbit' ? 2 : 1;
		for (let i = 0; i < n; i++) this.add(this.tool, p.x + (Math.random() - 0.5) * 10, p.y + (Math.random() - 0.5) * 10);
		this.ctx.audio.play('pop');
	}

	pointerMove(p) { if (this.pointer.down && this.tool === 'grass' && p.y < FIELD_H) this.plant(p); }

	plant(p) {
		const gx = Math.floor(p.x / CELL), gy = Math.floor(p.y / CELL);
		for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
			const xx = gx + x, yy = gy + y;
			if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && x * x + y * y <= 5) this.grass[yy * GW + xx] = Math.max(this.grass[yy * GW + xx], 0.35);
		}
	}

	count(kind) { let n = 0; for (const a of this.animals) if (a.kind === kind) n++; return n; }

	step(dt) {
		dt *= this.timeScale;
		const sub = Math.ceil(this.timeScale);
		for (let k = 0; k < sub; k++) this.simulate(dt / sub);
		const rabbits = this.count('rabbit'), foxes = this.count('fox');
		this.sampleT += dt;
		if (this.sampleT > 0.5) { this.sampleT = 0; this.history.push([rabbits, foxes]); if (this.history.length > 200) this.history.shift(); }
		const days = Math.floor(this.time / DAY);
		this.ctx.score(days);
		this.ctx.info(`Day ${days + 1} · ${rabbits} rabbits · ${foxes} foxes`);
		if (!rabbits || !foxes) {
			this.ctx.audio.play('lose');
			this.finish({ win: days >= 30, title: !rabbits ? 'The rabbits died out' : 'The foxes died out', message: `The meadow stayed balanced for ${days} days.`, score: days });
		}
	}

	simulate(dt) {
		this.time += dt;
		if (this.time >= this.nextEvent) this.event();
		if (this.effect && this.time > this.effect.until) this.effect = null;
		const drought = this.effect?.kind === 'drought', winter = this.effect?.kind === 'winter';
		const growth = (this.rainT > 0 ? 0.45 : drought ? 0 : 0.05) * dt;
		if (this.rainT > 0) this.rainT -= dt;
		else this.rainCharge = Math.min(1, this.rainCharge + dt / 40);
		this.rainBtn.disabled = this.rainCharge < 1;
		// grass spreads from healthy neighbours
		const g = this.grass;
		for (let i = 0; i < g.length; i++) {
			if (g[i] > 0.05) g[i] = Math.min(1, g[i] + growth * (0.4 + g[i]));
			else if (Math.random() < dt * 0.2) {
				const n = (g[i - 1] ?? 0) + (g[i + 1] ?? 0) + (g[i - GW] ?? 0) + (g[i + GW] ?? 0);
				if (n > 1.5) g[i] = 0.1;
			}
		}
		// release budget refills slowly
		if (Math.random() < dt / 8) this.budget.rabbit = Math.min(10, this.budget.rabbit + 1);
		if (Math.random() < dt / 20) this.budget.fox = Math.min(3, this.budget.fox + 1);
		const rabbits = this.animals.filter((a) => a.kind === 'rabbit' && !a.dead);
		const born = [];
		// births slow down as a species nears what the meadow can carry
		let nRabbits = rabbits.length, nFoxes = this.animals.length - rabbits.length;
		for (const a of this.animals) {
			if (a.dead) continue;
			a.age += dt;
			a.cool -= dt;
			a.energy -= dt * (a.kind === 'fox' ? 2.6 : 1.9) * (winter ? 1.5 : 1);
			let target = null;
			if (a.kind === 'rabbit') {
				const gi = Math.min(GH - 1, Math.max(0, Math.floor(a.y / CELL))) * GW + Math.min(GW - 1, Math.max(0, Math.floor(a.x / CELL)));
				if (g[gi] > 0.2 && a.energy < 45) { const bite = Math.min(g[gi], dt * 1.2); g[gi] -= bite; a.energy += bite * 18; a.grazing = true; } else a.grazing = false;
				// flee the nearest fox
				let fox = null, fd = 110;
				for (const f of this.animals) if (f.kind === 'fox' && !f.dead) { const d = Math.hypot(f.x - a.x, f.y - a.y); if (d < fd) { fd = d; fox = f; } }
				a.fleeing = Boolean(fox);
				if (fox) a.a = Math.atan2(a.y - fox.y, a.x - fox.x);
				if (a.energy > 40 && a.cool <= 0) { a.cool = 8 + Math.random() * 4; if (Math.random() < 1 - nRabbits / 220) { a.energy -= 18; nRabbits++; born.push(['rabbit', a.x, a.y]); } }
				if (a.age > 70) a.dead = true;
			} else {
				let prey = null, pd = 100;
				for (const r of rabbits) { if (r.dead) continue; const d = Math.hypot(r.x - a.x, r.y - a.y); if (d < pd) { pd = d; prey = r; } }
				if (prey && a.energy < 70) {
					target = prey;
					a.a = Math.atan2(prey.y - a.y, prey.x - a.x);
					if (pd < 8) { prey.dead = true; a.energy += 22; }
				}
				if (a.energy > 62 && a.cool <= 0) { a.cool = 16 + Math.random() * 8; if (Math.random() < 1 - nFoxes / 36) { a.energy -= 30; nFoxes++; born.push(['fox', a.x, a.y]); } }
				if (a.age > 110) a.dead = true;
			}
			if (a.energy <= 0) a.dead = true;
			if (!target && Math.random() < dt * 1.5) a.a += (Math.random() - 0.5) * 1.6;
			const speed = a.speed * (a.grazing && !a.fleeing ? 0.25 : 1) * (target ? 1.15 : 1) * (a.fleeing ? 1.2 : 1);
			a.x += Math.cos(a.a) * speed * dt;
			a.y += Math.sin(a.a) * speed * dt;
			if (a.x < 4 || a.x > W - 4) { a.a = Math.PI - a.a; a.x = Math.max(4, Math.min(W - 4, a.x)); }
			if (a.y < 4 || a.y > FIELD_H - 4) { a.a = -a.a; a.y = Math.max(4, Math.min(FIELD_H - 4, a.y)); }
		}
		for (const [k, x, y] of born) this.add(k, x, y);
		this.animals = this.animals.filter((a) => !a.dead);
	}

	/** Trouble arrives more and more often: the player has to react to keep the balance. */
	event() {
		this.events++;
		this.nextEvent = this.time + DAY * Math.max(4, 9 - this.events * 0.5);
		const kind = ['drought', 'winter', 'migration', 'disease'][Math.floor(Math.random() * 4)];
		if (kind === 'migration') { for (let i = 0; i < 4 + this.events; i++) this.add('fox', Math.random() * W, Math.random() < 0.5 ? 6 : FIELD_H - 6); }
		else if (kind === 'disease') { for (const a of this.animals) if (a.kind === 'rabbit' && Math.random() < 0.35) a.dead = true; }
		else this.effect = { kind, until: this.time + DAY * (kind === 'drought' ? 4 : 3) };
		this.ctx.fx.banner({ drought: 'Drought! The grass stops growing', winter: 'Harsh winter! Everyone gets hungry', migration: 'Foxes are moving in!', disease: 'Disease strikes the rabbits!' }[kind]);
		this.ctx.audio.play('buzzer');
	}

	draw(g) {
		// the meadow: one pixel per grass cell, scaled up smoothly
		const d = this.img.data;
		for (let i = 0, p = 0; i < this.grass.length; i++, p += 4) {
			const v = this.grass[i];
			d[p] = 120 - v * 70; d[p + 1] = 98 + v * 90; d[p + 2] = 50 + v * 10; d[p + 3] = 255;
		}
		this.offG.putImageData(this.img, 0, 0);
		g.drawImage(this.off, 0, 0, W, FIELD_H);
		if (this.rainT > 0) {
			g.strokeStyle = 'rgba(191,219,254,0.5)';
			g.lineWidth = 1;
			g.beginPath();
			const t = performance.now() / 1000;
			for (let i = 0; i < 90; i++) { const x = (i * 97 + t * 300) % W, y = (i * 53 + t * 700) % FIELD_H; g.moveTo(x, y); g.lineTo(x - 4, y + 12); }
			g.stroke();
		}
		for (const a of this.animals) {
			if (a.kind === 'rabbit') { circle(g, a.x, a.y, 4.5, '#f5f5f4'); circle(g, a.x + Math.cos(a.a) * 4, a.y + Math.sin(a.a) * 4 - 2, 2, '#e7e5e4'); }
			else { circle(g, a.x, a.y, 6.5, '#ea580c'); circle(g, a.x + Math.cos(a.a) * 6, a.y + Math.sin(a.a) * 6, 3, '#fdba74'); }
		}
		// population graph
		g.fillStyle = '#0f172a';
		g.fillRect(0, FIELD_H, W, H - FIELD_H);
		const hist = this.history, max = Math.max(20, ...hist.map(([r, f]) => Math.max(r, f * 4)));
		for (const [idx, color, k] of [[0, '#f5f5f4', 1], [1, '#fb923c', 4]]) {
			g.strokeStyle = color;
			g.lineWidth = 2;
			g.beginPath();
			hist.forEach((s, i) => { const x = 10 + (i / 200) * (W - 160), y = H - 12 - (s[idx] * k / max) * (H - FIELD_H - 30); i ? g.lineTo(x, y) : g.moveTo(x, y); });
			g.stroke();
		}
		const days = Math.floor(this.time / DAY);
		text(g, `Day ${days + 1}`, W - 140, FIELD_H + 22, { size: 16, align: 'left', color: '#e2e8f0' });
		text(g, `● rabbits ${this.count('rabbit')}`, W - 140, FIELD_H + 48, { size: 13, align: 'left', color: '#f5f5f4' });
		text(g, `● foxes ${this.count('fox')} (×4)`, W - 140, FIELD_H + 70, { size: 13, align: 'left', color: '#fb923c' });
		text(g, `Release: ${this.budget.rabbit} pairs · ${this.budget.fox} foxes`, W - 140, FIELD_H + 94, { size: 11, align: 'left', color: '#94a3b8' });
		const status = this.rainT > 0 ? 'Rain!' : this.effect ? { drought: 'Drought', winter: 'Harsh winter' }[this.effect.kind] : '';
		if (status) text(g, status, W - 140, FIELD_H + 112, { size: 12, align: 'left', color: this.rainT > 0 ? '#93c5fd' : '#fca5a5' });
	}
}
