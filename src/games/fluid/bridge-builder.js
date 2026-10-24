// Bridge Builder: join the anchors with road, wood and steel beams, then send the truck
// across. Beams flex under load and snap when stretched too far (their colour shows the
// strain while testing). Stay within budget; cheaper bridges score more.

import { CanvasGame } from '../kit/canvasGame.js';
import { tool } from '../kit/toolbar.js';
import { fillRound, circle, text } from '../core/canvas.js';
import { Bridge, MATERIALS, MAX_BEAM } from './bridge-physics.js';
import { LEVELS } from './bridge-levels.js';

const W = 800, H = 500, SNAP = 10;

export default class BridgeBuilder extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	buildToolbar() {
		this.material = 'road';
		this.mode = 'build';
		this.materialPick = tool.choice([['road', 'Road'], ['wood', 'Wood'], ['steel', 'Steel']], 'road', (m) => { this.material = m; this.mode = 'build'; this.modePick.set('build'); });
		this.modePick = tool.choice([['build', 'Build'], ['erase', 'Erase']], 'build', (m) => { this.mode = m; this.selected = -1; });
		this.testBtn = tool.button('Test', () => this.toggleTest(), { primary: true });
		this.levelLabel = tool.label('');
		this.costLabel = tool.label('');
		return tool.bar(this.levelLabel, this.materialPick.el, this.modePick.el, this.costLabel, this.testBtn, tool.button('Undo', () => this.undo()), tool.button('Clear', () => this.load(this.level)));
	}

	reset() {
		super.reset();
		this.score = 0;
		this.ctx.score(0);
		this.load(0);
	}

	restore(data) {
		this.score = data.score ?? 0;
		this.ctx.score(this.score);
		this.load(Math.min(LEVELS.length - 1, data.level ?? 0));
	}

	load(i) {
		this.level = i;
		this.L = LEVELS[i];
		this.bridge = new Bridge(this.L);
		this.selected = -1;
		this.testing = false;
		this.result = null;
		this.history = [];
		this.testBtn.textContent = 'Test';
		this.levelLabel.textContent = `Level ${i + 1}/${LEVELS.length} · ${this.L.name}`;
		this.paintCost();
		this.ctx.info('Click a joint, then click where the beam should go');
		this.ctx.saveProgress({ level: i, score: this.score });
	}

	paintCost() {
		const c = this.bridge.cost();
		this.costLabel.textContent = `$${c} / $${this.L.budget}`;
		this.costLabel.style.color = c > this.L.budget ? 'var(--color-danger)' : '';
	}

	snap(p) {
		const near = this.bridge.nodes.findIndex((n) => Math.hypot(n.ox - p.x, n.oy - p.y) < 12);
		if (near >= 0) return { node: near, x: this.bridge.nodes[near].ox, y: this.bridge.nodes[near].oy };
		return { node: -1, x: Math.round(p.x / SNAP) * SNAP, y: Math.round(p.y / SNAP) * SNAP };
	}

	/** Where a beam from the selected joint toward p would end (clamped to the maximum length). */
	target(p) {
		const s = this.snap(p);
		if (this.selected < 0) return s;
		const a = this.bridge.nodes[this.selected];
		const dx = s.x - a.ox, dy = s.y - a.oy, d = Math.hypot(dx, dy);
		if (d <= MAX_BEAM || s.node >= 0) return { ...s, ok: d <= MAX_BEAM };
		const k = MAX_BEAM / d;
		return { node: -1, x: Math.round((a.ox + dx * k) / SNAP) * SNAP, y: Math.round((a.oy + dy * k) / SNAP) * SNAP, ok: true };
	}

	pointerDown(p, e) {
		if (!this.running || this.testing) return;
		if (this.mode === 'erase' || e.button === 2) return this.eraseAt(p);
		const s = this.snap(p);
		if (this.selected < 0) {
			if (s.node >= 0) { this.selected = s.node; this.ctx.audio.play('select'); }
			return;
		}
		if (s.node === this.selected) { this.selected = -1; return; }
		const t = this.target(p);
		if (t.ok === false || t.y > 470 || t.y < 40) { this.ctx.audio.play('error'); return; }
		const b = this.bridge;
		const before = { nodes: b.nodes.length, beams: b.beams.length };
		const end = t.node >= 0 ? t.node : b.node(t.x, t.y);
		const beam = b.beam(this.selected, end, this.material);
		if (!beam) {
			b.nodes.length = before.nodes;
			this.ctx.audio.play('error');
			return;
		}
		this.history.push(before);
		this.selected = end;
		this.ctx.audio.play('place');
		this.paintCost();
	}

	eraseAt(p) {
		const b = this.bridge;
		let best = -1, bestD = 10;
		b.beams.forEach((m, i) => {
			const a = b.nodes[m.a], c = b.nodes[m.b];
			const abx = c.ox - a.ox, aby = c.oy - a.oy;
			const t = Math.max(0, Math.min(1, ((p.x - a.ox) * abx + (p.y - a.oy) * aby) / (abx * abx + aby * aby)));
			const d = Math.hypot(p.x - (a.ox + abx * t), p.y - (a.oy + aby * t));
			if (d < bestD) { bestD = d; best = i; }
		});
		if (best < 0) return;
		b.beams.splice(best, 1);
		this.prune();
		this.history = [];
		this.ctx.audio.play('flip');
		this.paintCost();
	}

	/** Removes free joints that no beam uses any more (remapping beam indices). */
	prune() {
		const b = this.bridge;
		const used = new Set(b.beams.flatMap((m) => [m.a, m.b]));
		const map = [];
		const nodes = [];
		b.nodes.forEach((n, i) => { if (n.fixed || used.has(i)) { map[i] = nodes.length; nodes.push(n); } });
		b.nodes = nodes;
		for (const m of b.beams) { m.a = map[m.a]; m.b = map[m.b]; }
		this.selected = -1;
	}

	undo() {
		if (this.testing || !this.history.length) return;
		const h = this.history.pop();
		this.bridge.beams.length = h.beams;
		this.bridge.nodes.length = h.nodes;
		this.selected = -1;
		this.paintCost();
	}

	key(action, event) {
		if (action === 'action') this.toggleTest();
		if (event?.key === 'z') this.undo();
	}

	toggleTest() {
		if (!this.running) return;
		if (this.testing) {
			this.testing = false;
			this.result = null;
			this.bridge.restore();
			this.testBtn.textContent = 'Test';
			return;
		}
		if (this.bridge.cost() > this.L.budget) { this.ctx.audio.play('error'); this.ctx.fx.nope(this.costLabel); return; }
		this.testing = true;
		this.selected = -1;
		this.testBtn.textContent = 'Stop';
		this.bridge.startTest(this.L.truck ?? 3);
		this.brokenCount = 0;
		this.acc = 0;
		this.ctx.audio.play('go');
	}

	step(dt) {
		if (!this.testing || this.result) return;
		const b = this.bridge;
		// fixed 1/60 s steps: the same timing the level checker used
		this.acc = Math.min((this.acc ?? 0) + dt, 0.1);
		while (this.acc >= 1 / 60) { b.step(1 / 60); this.acc -= 1 / 60; }
		const broken = b.beams.filter((m) => m.broken).length;
		if (broken > this.brokenCount) {
			this.brokenCount = broken;
			this.ctx.audio.play('crash');
			this.fx.shake.kick(5);
		}
		const done = b.truck.done;
		if (done === 'pass') this.pass();
		else if (done === 'fall') {
			this.result = 'fall';
			this.ctx.audio.play('splash');
			setTimeout(() => { if (this.running && this.result === 'fall') this.toggleTest(); }, 1800);
		}
	}

	pass() {
		this.result = 'pass';
		const saved = this.L.budget - this.bridge.cost();
		const gain = 200 + saved * 2;
		this.score += gain;
		this.ctx.score(this.score);
		this.ctx.audio.play('levelup');
		this.ctx.fx.confetti({ count: 50 });
		this.popup(`+${gain}`, W / 2, 120, { color: '#fde047', size: 30 });
		setTimeout(() => {
			if (!this.running) return;
			if (this.level + 1 >= LEVELS.length) return this.finish({ win: true, title: 'Chief engineer!', message: 'Every truck made it across.', score: this.score });
			this.load(this.level + 1);
			this.ctx.fx.banner(`Level ${this.level + 1}`);
		}, 1600);
	}

	draw(g) {
		const L = this.L, b = this.bridge;
		const sky = g.createLinearGradient(0, 0, 0, H);
		sky.addColorStop(0, '#7dd3fc');
		sky.addColorStop(1, '#e0f2fe');
		g.fillStyle = sky;
		g.fillRect(0, 0, W, H);
		const t = performance.now() / 1000;
		g.fillStyle = '#2563eb';
		g.beginPath();
		g.moveTo(0, H);
		for (let x = 0; x <= W; x += 20) g.lineTo(x, 470 + Math.sin(x * 0.03 + t * 2) * 4);
		g.lineTo(W, H);
		g.fill();
		g.fillStyle = '#78716c';
		g.fillRect(0, L.top, L.left, H - L.top);
		g.fillRect(L.right, L.top, W - L.right, H - L.top);
		g.fillStyle = '#65a30d';
		g.fillRect(0, L.top - 6, L.left, 8);
		g.fillRect(L.right, L.top - 6, W - L.right, 8);
		if (L.pillar) { g.fillStyle = '#78716c'; g.fillRect(L.pillar[0] - 20, L.pillar[1], 40, H - L.pillar[1]); }
		// beams: the simulated shape while testing, the design otherwise
		const pos = (n) => (this.testing ? [n.x, n.y] : [n.ox, n.oy]);
		g.lineCap = 'round';
		for (const m of b.beams) {
			if (m.broken) continue;
			const [ax, ay] = pos(b.nodes[m.a]), [bx, by] = pos(b.nodes[m.b]);
			const mat = MATERIALS[m.material];
			let color = mat.color;
			if (this.testing) {
				const s = Math.min(1, m.stress);
				color = `rgb(${Math.round(80 + 175 * s)},${Math.round(200 - 160 * s)},${Math.round(90 - 60 * s)})`;
			}
			g.strokeStyle = color;
			g.lineWidth = mat.width;
			g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
		}
		b.nodes.forEach((n, i) => {
			const [x, y] = pos(n);
			circle(g, x, y, n.fixed ? 7 : 4.5, n.fixed ? '#dc2626' : '#1f2937');
			if (i === this.selected) { g.strokeStyle = '#fde047'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.stroke(); }
		});
		if (!this.testing && this.selected >= 0 && this.mode === 'build') {
			const a = b.nodes[this.selected], tg = this.target(this.pointer);
			g.strokeStyle = tg.ok === false ? 'rgba(220,38,38,0.7)' : 'rgba(15,23,42,0.45)';
			g.setLineDash([6, 6]);
			g.lineWidth = MATERIALS[this.material].width;
			g.beginPath(); g.moveTo(a.ox, a.oy); g.lineTo(tg.x, tg.y); g.stroke();
			g.setLineDash([]);
		}
		const tr = b.truck;
		if (tr) {
			const [w1, w2] = tr.wheels;
			const ang = Math.atan2(w2.y - w1.y, w2.x - w1.x);
			g.save();
			g.translate((w1.x + w2.x) / 2, (w1.y + w2.y) / 2);
			g.rotate(ang);
			fillRound(g, -44, -40, 62, 30, 5, '#f59e0b');
			fillRound(g, 18, -32, 26, 22, 5, '#ef4444');
			fillRound(g, 24, -28, 14, 9, 2, '#bae6fd');
			g.restore();
			for (const w of tr.wheels) { circle(g, w.x, w.y, w.r, '#111827'); circle(g, w.x, w.y, 5, '#9ca3af'); }
		} else {
			fillRound(g, 26, L.top - 50, 62, 30, 5, '#f59e0b');
			fillRound(g, 88, L.top - 42, 26, 22, 5, '#ef4444');
			circle(g, 40, L.top - 14, 14, '#111827');
			circle(g, 100, L.top - 14, 14, '#111827');
		}
		text(g, 'Red joints are anchors. Road beams carry the truck; wood and steel hold them up.', W / 2, 18, { size: 12, color: 'rgba(15,23,42,0.7)' });
		if (this.result === 'fall') text(g, 'Splash! Strengthen the bridge.', W / 2, 80, { size: 26, color: '#1e3a8a', weight: 900 });
	}
}
