// Rhythm Tap: notes fall down four lanes to the beat; hit each one as it crosses the line.
// Timing is judged in milliseconds (Perfect, Good, Miss); streaks build a combo
// multiplier, misses drain the meter. Every song is generated from a seed, so each
// difficulty plays the same chart every time.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, text } from '../core/canvas.js';

const W = 480, H = 640, LINE = 560, LANES = 4, LANE_W = 90, X0 = (W - LANES * LANE_W) / 2;
const KEYS = [['d', 'ArrowLeft'], ['f', 'ArrowDown'], ['j', 'ArrowUp'], ['k', 'ArrowRight']];
const COLORS = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24'];
const SONGS = { easy: { bpm: 96, density: 0.55, eighths: 0 }, normal: { bpm: 118, density: 0.75, eighths: 0.2 }, hard: { bpm: 140, density: 0.9, eighths: 0.45 } };
const LENGTH = 64; // beats
const SPEED = 420; // px per second
const PERFECT = 0.05, GOOD = 0.11;

function chart(kind) {
	const song = SONGS[kind] ?? SONGS.normal;
	let seed = kind.length * 7919 + 17;
	const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
	const beat = 60 / song.bpm;
	const notes = [];
	let last = 0;
	for (let b = 4; b < LENGTH; b++) {
		const steps = rnd() < song.eighths ? [0, 0.5] : [0];
		for (const s of steps) {
			if (rnd() > song.density) continue;
			let lane = (last + 1 + Math.floor(rnd() * 3)) % LANES;
			notes.push({ t: (b + s) * beat, lane, state: 'live' });
			// the odd chord on strong beats
			if (b % 8 === 0 && s === 0 && kind !== 'easy') notes.push({ t: (b + s) * beat, lane: (lane + 2) % LANES, state: 'live' });
			last = lane;
		}
	}
	return { notes, beat, end: LENGTH * beat + 1.5 };
}

export default class RhythmTap extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		const c = chart(this.ctx.settings.difficulty ?? 'normal');
		this.notes = c.notes;
		this.beat = c.beat;
		this.end = c.end;
		this.time = -2; // a two-second count-in
		this.score = 0;
		this.combo = 0;
		this.best = 0;
		this.health = 1;
		this.hits = { perfect: 0, good: 0, miss: 0 };
		this.flashes = [0, 0, 0, 0];
		this.lastBeat = -1;
		this.judgement = null;
		this.ctx.score(0);
	}

	key(action, event) {
		const k = event?.key;
		if (!k) return;
		const lane = KEYS.findIndex((pair) => pair.includes(k) || pair.includes(k.toLowerCase()));
		if (lane >= 0 && !event.repeat) this.hit(lane);
	}

	pointerDown(p) {
		const lane = Math.floor((p.x - X0) / LANE_W);
		if (lane >= 0 && lane < LANES) this.hit(lane);
	}

	hit(lane) {
		if (!this.running) return;
		this.flashes[lane] = 1;
		let best = null, err = Infinity;
		for (const n of this.notes) {
			if (n.state !== 'live' || n.lane !== lane) continue;
			const e = Math.abs(n.t - this.time);
			if (e < err) { err = e; best = n; }
			if (n.t > this.time + GOOD) break;
		}
		if (!best || err > GOOD) { this.ctx.audio.play('tick'); return; }
		best.state = 'hit';
		const perfect = err <= PERFECT;
		this.hits[perfect ? 'perfect' : 'good']++;
		this.combo++;
		this.best = Math.max(this.best, this.combo);
		const mult = 1 + Math.min(3, Math.floor(this.combo / 10));
		this.score += (perfect ? 100 : 50) * mult;
		this.health = Math.min(1, this.health + 0.02);
		this.ctx.score(this.score);
		this.ctx.audio.play(perfect ? 'blip' : 'click');
		this.judgement = { text: perfect ? 'PERFECT' : 'GOOD', color: perfect ? '#fde047' : '#93c5fd', t: 0.5 };
		const x = X0 + lane * LANE_W + LANE_W / 2;
		this.fx.particles.burst(x, LINE, { count: perfect ? 14 : 8, color: COLORS[lane], speed: 180, angle: -Math.PI / 2, spread: 2.2, life: 0.4, size: 3, glow: true });
	}

	step(dt) {
		this.time += dt;
		for (let i = 0; i < LANES; i++) this.flashes[i] = Math.max(0, this.flashes[i] - dt * 6);
		if (this.judgement) this.judgement.t -= dt;
		// a soft metronome on every beat
		const b = Math.floor(this.time / this.beat);
		if (b !== this.lastBeat && this.time >= 0 && b < LENGTH) { this.lastBeat = b; if (b % 4 === 0) this.ctx.audio.play('tick'); }
		for (const n of this.notes) {
			if (n.state === 'live' && this.time - n.t > GOOD) {
				n.state = 'miss';
				this.hits.miss++;
				this.combo = 0;
				this.health -= 0.08;
				this.judgement = { text: 'MISS', color: '#fb7185', t: 0.5 };
				if (this.health <= 0) return this.finish({ win: false, title: 'Out of rhythm', message: `Best combo ${this.best}.`, score: this.score });
			}
		}
		if (this.time >= this.end) {
			const total = this.notes.length;
			const acc = (this.hits.perfect + this.hits.good * 0.5) / total;
			const grade = acc > 0.95 ? 'S' : acc > 0.85 ? 'A' : acc > 0.7 ? 'B' : acc > 0.5 ? 'C' : 'D';
			this.finish({ win: true, title: `Grade ${grade}`, message: `${Math.round(acc * 100)}% accuracy · best combo ${this.best} · ${this.hits.perfect} perfect, ${this.hits.miss} missed.`, score: this.score });
		}
	}

	draw(g) {
		const bg = g.createLinearGradient(0, 0, 0, H);
		bg.addColorStop(0, '#1e1b4b');
		bg.addColorStop(1, '#020617');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		// pulsing beat glow
		const phase = this.time > 0 ? 1 - ((this.time / this.beat) % 1) : 0;
		g.fillStyle = `rgba(139,92,246,${0.08 * phase})`;
		g.fillRect(0, 0, W, H);
		for (let i = 0; i < LANES; i++) {
			const x = X0 + i * LANE_W;
			g.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
			g.fillRect(x, 0, LANE_W, H);
			if (this.flashes[i] > 0) {
				const grad = g.createLinearGradient(0, LINE, 0, LINE - 220);
				grad.addColorStop(0, `${COLORS[i]}88`);
				grad.addColorStop(1, `${COLORS[i]}00`);
				g.globalAlpha = this.flashes[i];
				g.fillStyle = grad;
				g.fillRect(x, LINE - 220, LANE_W, 220);
				g.globalAlpha = 1;
			}
		}
		for (const n of this.notes) {
			if (n.state !== 'live') continue;
			const y = LINE - (n.t - this.time) * SPEED;
			if (y < -30) break;
			if (y > H + 30) continue;
			fillRound(g, X0 + n.lane * LANE_W + 8, y - 12, LANE_W - 16, 24, 10, COLORS[n.lane]);
			fillRound(g, X0 + n.lane * LANE_W + 14, y - 8, LANE_W - 28, 6, 3, 'rgba(255,255,255,0.5)');
		}
		g.fillStyle = 'rgba(255,255,255,0.85)';
		g.fillRect(X0, LINE - 2, LANES * LANE_W, 4);
		for (let i = 0; i < LANES; i++) {
			g.strokeStyle = COLORS[i];
			g.lineWidth = 3;
			g.beginPath(); g.roundRect(X0 + i * LANE_W + 8, LINE - 14, LANE_W - 16, 28, 10); g.stroke();
			text(g, KEYS[i][0].toUpperCase(), X0 + i * LANE_W + LANE_W / 2, LINE + 40, { size: 16, color: 'rgba(255,255,255,0.5)' });
		}
		if (this.time < 0) text(g, String(Math.ceil(-this.time)), W / 2, H / 2 - 60, { size: 64, weight: 900 });
		if (this.judgement && this.judgement.t > 0) text(g, this.judgement.text, W / 2, LINE - 120, { size: 30, color: this.judgement.color, weight: 900 });
		if (this.combo >= 5) text(g, `${this.combo} combo · ×${1 + Math.min(3, Math.floor(this.combo / 10))}`, W / 2, 40, { size: 18, color: '#e9d5ff' });
		fillRound(g, 16, 70, 10, 300, 5, 'rgba(255,255,255,0.1)');
		fillRound(g, 16, 70 + 300 * (1 - Math.max(0, this.health)), 10, Math.max(10, 300 * Math.max(0, this.health)), 5, this.health > 0.3 ? '#34d399' : '#fb7185');
	}
}
