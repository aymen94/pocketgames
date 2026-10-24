// Water Flow: arrange planks and open gates so the water from the tap reaches the cup.
// The water is a particle liquid that pours, pools and splashes; fire pits boil it away
// and anything that falls off the bottom is lost. Fill the cup to the line to win.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { Liquid } from './liquid.js';
import { fillRound, text, colors } from '../core/canvas.js';
import { LEVELS } from './water-levels.js';

const W = 640, H = 520;
const deg = Math.PI / 180;


export default class WaterFlow extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.tapBtn = tool.button('Open tap', () => this.openTap(), { primary: true });
		this.levelLabel = tool.label('');
		return tool.bar(this.levelLabel, this.tapBtn, tool.button('Retry level', () => this.loadLevel(this.level)), tool.button('Rotate ⟳', () => this.rotateSelected(15)), tool.button('Hint', () => this.showHint(), { title: 'Show a layout that works (−50 points)' }));
	}

	setup() {
		this.liquid = new Liquid(360, { radius: 4.2, width: W, height: H + 40 });
	}

	reset() {
		super.reset();
		this.level = 0;
		this.total = 0;
		this.loadLevel(0);
	}

	restore(data) {
		this.level = Math.min(LEVELS.length - 1, data.level ?? 0);
		this.total = data.score ?? 0;
		this.loadLevel(this.level);
	}

	loadLevel(i) {
		this.level = i;
		const L = LEVELS[i];
		this.L = L;
		this.planks = L.planks.map((p) => ({ ...p }));
		this.gates = (L.gates ?? []).map(([ax, ay, bx, by]) => ({ ax, ay, bx, by, off: false, thick: 4 }));
		this.fires = L.fires ?? [];
		this.flowing = false;
		this.emitted = 0;
		this.emitCarry = 0;
		this.state = 'arrange'; // arrange | flowing | won | failed
		this.stateTime = 0;
		this.selected = null;
		this.hintShown = false;
		this.hintUntil = 0;
		this.liquid.clear();
		this.buildSegments();
		this.tapBtn.disabled = false;
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${L.name}`;
		this.ctx.info(`Fill the cup to ${Math.round(L.need * 100)}%`);
		this.ctx.score(this.total);
		this.ctx.saveProgress({ level: i, score: this.total });
	}

	buildSegments() {
		const L = this.L, c = L.cup;
		const segs = [];
		for (const [ax, ay, bx, by] of L.walls ?? []) segs.push({ ax, ay, bx, by, thick: 4 });
		segs.push({ ax: c.x, ay: c.y, bx: c.x, by: c.y + c.h, thick: 4 }, { ax: c.x, ay: c.y + c.h, bx: c.x + c.w, by: c.y + c.h, thick: 4 }, { ax: c.x + c.w, ay: c.y + c.h, bx: c.x + c.w, by: c.y, thick: 4 });
		for (const g of this.gates) segs.push(g);
		for (const p of this.planks) {
			p.seg = { thick: 5 };
			this.placePlank(p);
			segs.push(p.seg);
		}
		this.liquid.segments = segs;
	}

	placePlank(p) {
		const dx = Math.cos(p.a * deg) * p.len / 2, dy = Math.sin(p.a * deg) * p.len / 2;
		Object.assign(p.seg, { ax: p.x - dx, ay: p.y - dy, bx: p.x + dx, by: p.y + dy });
	}

	showHint() {
		if (!this.running || this.state !== 'arrange') return;
		if (!this.hintShown) {
			this.total = Math.max(0, this.total - 50);
			this.ctx.score(this.total);
		}
		this.hintShown = true;
		this.hintUntil = performance.now() + 3500;
		this.ctx.audio.play('sparkle');
	}

	openTap() {
		if (!this.running || this.state !== 'arrange') return;
		this.state = 'flowing';
		this.tapBtn.disabled = true;
		this.ctx.audio.play('splash');
	}

	rotateSelected(by) {
		const p = this.selected ?? this.planks[0];
		if (!p) return;
		p.a = (p.a + by + 360) % 360;
		this.placePlank(p);
		this.ctx.audio.play('click');
	}

	pick(p) {
		for (const plank of this.planks) {
			const s = plank.seg;
			const abx = s.bx - s.ax, aby = s.by - s.ay;
			const t = Math.max(0, Math.min(1, ((p.x - s.ax) * abx + (p.y - s.ay) * aby) / (abx * abx + aby * aby)));
			if (Math.hypot(p.x - (s.ax + abx * t), p.y - (s.ay + aby * t)) < 16) return { kind: 'plank', plank };
		}
		for (const g of this.gates) {
			const mx = (g.ax + g.bx) / 2, my = (g.ay + g.by) / 2;
			if (Math.abs(p.x - mx) < Math.abs(g.bx - g.ax) / 2 + 10 && Math.abs(p.y - my) < 18) return { kind: 'gate', gate: g };
		}
		return null;
	}

	pointerDown(p) {
		if (!this.running) return;
		const hit = this.pick(p);
		this.drag = null;
		if (hit?.kind === 'plank') {
			this.selected = hit.plank;
			this.drag = { plank: hit.plank, ox: p.x - hit.plank.x, oy: p.y - hit.plank.y, sx: p.x, sy: p.y, moved: false };
		} else if (hit?.kind === 'gate') {
			hit.gate.off = !hit.gate.off;
			this.ctx.audio.play(hit.gate.off ? 'whip' : 'thud');
		}
	}

	pointerMove(p) {
		const d = this.drag;
		if (!d || !p.down) return;
		if (Math.hypot(p.x - d.sx, p.y - d.sy) > 6) d.moved = true;
		if (!d.moved || d.plank.lock === 'turn') return;
		d.plank.x = Math.max(20, Math.min(W - 20, p.x - d.ox));
		d.plank.y = Math.max(20, Math.min(H - 20, p.y - d.oy));
		this.placePlank(d.plank);
	}

	pointerUp() {
		const d = this.drag;
		if (d && !d.moved) this.rotateSelected(15);
		this.drag = null;
	}

	key(action, event) {
		const k = event?.key;
		if (action === 'action') return this.openTap();
		if (k === 'q' || k === 'Q') this.rotateSelected(-15);
		if (k === 'e' || k === 'E' || k === 'r' || k === 'R') this.rotateSelected(15);
		const p = this.selected;
		if (p && p.lock !== 'turn' && action && action !== 'action') {
			p.x += action === 'left' ? -10 : action === 'right' ? 10 : 0;
			p.y += action === 'up' ? -10 : action === 'down' ? 10 : 0;
			this.placePlank(p);
		}
	}

	countCup() {
		const { x, y, alive, count } = this.liquid;
		const c = this.L.cup;
		let n = 0;
		for (let i = 0; i < count; i++) if (alive[i] && x[i] > c.x && x[i] < c.x + c.w && y[i] > c.y - 4 && y[i] < c.y + c.h) n++;
		return n;
	}

	step(dt) {
		const L = this.L, liq = this.liquid;
		this.stateTime += dt;
		if (this.state === 'flowing' && this.emitted < L.source.total) {
			this.emitCarry += dt * 70;
			while (this.emitCarry >= 1 && this.emitted < L.source.total) {
				this.emitCarry -= 1;
				liq.add(L.source.x + (Math.random() - 0.5) * 9, L.source.y + 14 + Math.random() * 4, (Math.random() - 0.5) * 10, 380);
				this.emitted++;
			}
		}
		liq.step(Math.min(dt, 1 / 40), 2);
		// fires boil the water away; the bottom edge swallows it
		for (let i = 0; i < liq.count; i++) {
			if (!liq.alive[i]) continue;
			const x = liq.x[i], y = liq.y[i];
			if (y > H + 20) { liq.kill(i); continue; }
			for (const f of this.fires) {
				if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) {
					liq.kill(i);
					if (Math.random() < 0.3) this.fx.particles.burst(x, y, { count: 2, color: '#e2e8f0', speed: 40, angle: -Math.PI / 2, spread: 1, life: 0.8, shape: 'smoke', size: 5, grow: 8, gravity: -60 });
					break;
				}
			}
		}
		if (this.state !== 'flowing') return;
		const inCup = this.countCup();
		const total = L.source.total;
		this.fill = inCup / total;
		const alive = liq.living;
		if (this.emitted >= total) {
			if (this.fill >= L.need) {
				this.settle = (this.settle ?? 0) + dt;
				if (this.settle > 1.2) this.win();
			} else this.settle = 0;
			// lost too much to ever make it, or everything has come to rest short of the line
			const possible = inCup + (alive - inCup);
			if (possible / total < L.need || (this.stateTime > 4 && this.quiet() && this.fill < L.need)) this.fail();
		} else if ((total - this.emitted + alive) / total < L.need) this.fail();
	}

	quiet() {
		const liq = this.liquid;
		let energy = 0, n = 0;
		for (let i = 0; i < liq.count; i++) if (liq.alive[i]) { energy += liq.vx[i] ** 2 + liq.vy[i] ** 2; n++; }
		this.quietTime = n === 0 || energy / n < 400 ? (this.quietTime ?? 0) + 1 / 60 : 0;
		return this.quietTime > 1.5;
	}

	win() {
		this.state = 'won';
		const bonus = Math.round(this.fill * 100);
		this.total += 100 + bonus;
		this.ctx.score(this.total);
		this.ctx.audio.play('levelup');
		const c = this.L.cup;
		this.burst(c.x + c.w / 2, c.y, { count: 40, colors: ['#93c5fd', '#ffffff', '#fde047'], speed: 220, angle: -Math.PI / 2, spread: 1.6, life: 0.9, shape: 'star', size: 5, gravity: 300 });
		this.popup(`+${100 + bonus}`, c.x + c.w / 2, c.y - 20, { color: '#fde047', size: 26 });
		setTimeout(() => {
			if (!this.surface || !this.running) return;
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Master plumber!', message: `All ${LEVELS.length} levels flowing.`, score: this.total });
			this.loadLevel(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1400);
	}

	fail() {
		this.state = 'failed';
		this.ctx.audio.play('lifelost');
		this.fx.flash.trigger('#fb7185', 0.2);
		setTimeout(() => { if (this.surface && this.running && this.state === 'failed') this.loadLevel(this.level); }, 1800);
	}

	draw(g) {
		const L = this.L;
		const bg = g.createLinearGradient(0, 0, 0, H);
		bg.addColorStop(0, '#0f172a');
		bg.addColorStop(1, '#1e293b');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		g.strokeStyle = 'rgba(148,163,184,0.06)';
		g.lineWidth = 1;
		for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
		for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
		// fires
		const t = performance.now() / 1000;
		for (const f of this.fires) {
			const grad = g.createLinearGradient(0, f.y, 0, f.y + f.h);
			grad.addColorStop(0, 'rgba(251,113,133,0.15)');
			grad.addColorStop(1, 'rgba(249,115,22,0.75)');
			g.fillStyle = grad;
			g.fillRect(f.x, f.y, f.w, f.h);
			g.fillStyle = '#fb923c';
			for (let x = f.x + 6; x < f.x + f.w - 4; x += 14) {
				const fh = 8 + Math.sin(t * 9 + x) * 4;
				g.beginPath();
				g.moveTo(x - 5, f.y + f.h);
				g.quadraticCurveTo(x, f.y + f.h - fh * 2.2, x + 5, f.y + f.h);
				g.fill();
			}
		}
		// cup with the fill line
		const c = L.cup;
		g.fillStyle = 'rgba(52,211,153,0.08)';
		g.fillRect(c.x, c.y, c.w, c.h);
		const lineY = c.y + c.h - Math.min(c.h, (L.need * L.source.total * 75) / c.w);
		g.strokeStyle = 'rgba(52,211,153,0.6)';
		g.setLineDash([5, 5]);
		g.beginPath(); g.moveTo(c.x, lineY); g.lineTo(c.x + c.w, lineY); g.stroke();
		g.setLineDash([]);
		// liquid
		this.liquid.draw(g, ['rgba(59,130,246,0.95)']);
		// static walls and cup
		g.lineCap = 'round';
		for (const s of this.liquid.segments) {
			if (this.planks.some((p) => p.seg === s) || this.gates.includes(s)) continue;
			g.strokeStyle = '#94a3b8';
			g.lineWidth = 8;
			g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
		}
		for (const gate of this.gates) {
			g.strokeStyle = gate.off ? 'rgba(251,191,36,0.25)' : '#fbbf24';
			g.lineWidth = 8;
			g.setLineDash(gate.off ? [6, 8] : []);
			g.beginPath(); g.moveTo(gate.ax, gate.ay); g.lineTo(gate.bx, gate.by); g.stroke();
			g.setLineDash([]);
		}
		for (const p of this.planks) {
			const s = p.seg;
			g.strokeStyle = p === this.selected ? colors.accent : '#c08a54';
			g.lineWidth = 10;
			g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke();
			g.fillStyle = p.lock === 'turn' ? '#f8fafc' : '#7c4a24';
			g.beginPath(); g.arc(p.x, p.y, 4, 0, Math.PI * 2); g.fill();
		}
		// hint: ghost planks where a working layout puts them
		if (performance.now() < this.hintUntil) {
			g.save();
			g.globalAlpha = 0.45;
			g.strokeStyle = '#fde047';
			g.setLineDash([8, 6]);
			g.lineWidth = 8;
			for (const h of L.hint) {
				const dx = Math.cos(h.a * deg) * h.len / 2, dy = Math.sin(h.a * deg) * h.len / 2;
				g.beginPath(); g.moveTo(h.x - dx, h.y - dy); g.lineTo(h.x + dx, h.y + dy); g.stroke();
			}
			g.restore();
		}
		// tap
		const s = L.source;
		fillRound(g, s.x - 18, s.y - 14, 36, 22, 6, '#cbd5e1');
		fillRound(g, s.x - 6, s.y + 4, 12, 12, 3, this.state === 'flowing' ? '#60a5fa' : '#64748b');
		// progress bar
		const fill = this.fill ?? 0;
		fillRound(g, 12, 12, 160, 14, 7, 'rgba(255,255,255,0.08)');
		fillRound(g, 12, 12, Math.max(14, 160 * Math.min(1, fill / L.need)), 14, 7, fill >= L.need ? '#34d399' : '#60a5fa');
		text(g, `${Math.round(fill * 100)}% / ${Math.round(L.need * 100)}%`, 180, 19, { size: 12, align: 'left', color: '#e2e8f0' });
		if (this.state === 'arrange' && this.running) text(g, 'Drag planks, tap to rotate, click gates. Then open the tap!', W / 2, H - 14, { size: 13, color: 'rgba(226,232,240,0.75)' });
		if (this.state === 'failed') text(g, 'Too much water lost. Try again!', W / 2, H / 2, { size: 26, color: '#fb7185', weight: 900 });
		if (this.state === 'won') text(g, 'Cup filled!', W / 2, H / 2, { size: 30, color: '#34d399', weight: 900 });
	}
}
