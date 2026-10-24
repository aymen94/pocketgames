// Tennis: a top-down match against the computer with a real ball height, bounce and
// shadow. Move to the ball and your player swings by itself; where the ball meets the
// racket decides the angle, and holding Space (or a second finger) hits a lob. Tennis
// scoring: 15, 30, 40, deuce and advantage; first to the set number of games wins.

import { CanvasGame } from '../kit/canvasGame.js';
import { fillRound, circle, text, colors } from '../core/canvas.js';

const W = 480, H = 720;
const CX = W / 2, COURT_W = 300, COURT_H = 600, TOPY = (H - COURT_H) / 2, NET = H / 2;
const G = 900; // gravity on the ball's height, px/s²
const POINTS = ['0', '15', '30', '40'];

export default class Tennis extends CanvasGame {
	static realtime = true;
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.games = [0, 0];
		this.points = [0, 0];
		this.target = Number(this.ctx.settings.games ?? 3);
		this.server = 0;
		this.me = { x: CX, y: TOPY + COURT_H - 10, swing: 0 };
		this.cpu = { x: CX, y: TOPY + 10, swing: 0 };
		this.ctx.score(0);
		this.serve();
	}

	serve() {
		const s = this.server === 0 ? this.me : this.cpu;
		s.x = CX + (Math.random() - 0.5) * 80;
		this.ball = { x: s.x, y: s.y + (this.server === 0 ? -20 : 20), z: 40, vx: 0, vy: 0, vz: 0, bounces: 0, last: this.server, live: false, wait: 1 };
		this.status();
	}

	status() {
		const [a, b] = this.points;
		let call;
		if (a >= 3 && b >= 3) call = a === b ? 'Deuce' : a > b ? 'Advantage you' : 'Advantage computer';
		else call = `${POINTS[Math.min(a, 3)]} – ${POINTS[Math.min(b, 3)]}`;
		this.call = call;
		this.ctx.info(`Games ${this.games[0]}–${this.games[1]} · ${call}`);
	}

	/** Launches the ball from (x, y) to land near (tx, ty), with a flat or lobbed arc. */
	hit(from, tx, ty, lob = false, speed = 1) {
		const b = this.ball;
		const dist = Math.hypot(tx - b.x, ty - b.y);
		const time = (lob ? 1.25 : 0.8) * Math.max(0.6, dist / 520) / speed;
		b.vx = (tx - b.x) / time;
		b.vy = (ty - b.y) / time;
		// solve z(t) = z0 + vz t - G t²/2 = 0 at t = time
		b.vz = (0.5 * G * time * time - b.z) / time;
		b.last = from;
		b.bounces = 0;
		b.live = true;
		b.wait = 0;
		this.ctx.audio.play('bounce');
	}

	key(action) { if (action === 'action') this.lob = true; }
	keyUp(action) { if (action === 'action') this.lob = false; }

	step(dt) {
		const b = this.ball, me = this.me, cpu = this.cpu, input = this.ctx.input;
		// you: keyboard or follow the pointer
		const speed = 260;
		let mx = input.axis().x, my = input.axis().y;
		if (this.pointer.down) {
			const dx = this.pointer.x - me.x, dy = this.pointer.y - me.y, d = Math.hypot(dx, dy);
			if (d > 6) { mx = dx / d; my = dy / d; }
		}
		me.x = Math.max(CX - COURT_W / 2 - 50, Math.min(CX + COURT_W / 2 + 50, me.x + mx * speed * dt));
		me.y = Math.max(NET + 30, Math.min(H - 10, me.y + my * speed * dt));
		// computer: run to where the ball will be when it reaches its side
		const skill = { easy: 0.6, normal: 0.85, hard: 1.05 }[this.ctx.settings.difficulty ?? 'normal'] ?? 0.85;
		let tx = CX, ty = TOPY + 20;
		if (b.live && b.vy < 0) { const t = Math.max(0, (cpu.y - b.y) / b.vy); tx = b.x + b.vx * t; ty = TOPY + 10; }
		const cdx = tx - cpu.x, cdy = ty - cpu.y, cd = Math.hypot(cdx, cdy);
		if (cd > 4) { cpu.x += (cdx / cd) * 250 * skill * dt; cpu.y += (cdy / cd) * 250 * skill * dt; }
		me.swing = Math.max(0, me.swing - dt * 4);
		cpu.swing = Math.max(0, cpu.swing - dt * 4);

		if (!b.live) {
			b.wait -= dt;
			if (b.wait <= 0) {
				// serve diagonally into the opponent's half
				const s = this.server === 0 ? me : cpu;
				b.x = s.x; b.y = s.y + (this.server === 0 ? -20 : 20); b.z = 40;
				const side = s.x < CX ? 1 : -1;
				this.hit(this.server, CX + side * (40 + Math.random() * 70), this.server === 0 ? TOPY + COURT_H * 0.3 : TOPY + COURT_H * 0.7, false, 0.95);
				(this.server === 0 ? me : cpu).swing = 1;
			}
			return;
		}
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		b.vz -= G * dt;
		b.z += b.vz * dt;
		if (b.z <= 0) {
			b.z = 0;
			b.bounces++;
			this.fx.particles.ring(b.x, b.y, { color: '#ffffff', radius: 10, life: 0.3, width: 2 });
			const inside = Math.abs(b.x - CX) <= COURT_W / 2 && b.y >= TOPY && b.y <= TOPY + COURT_H;
			const rightHalf = b.last === 0 ? b.y < NET : b.y > NET;
			if (b.bounces === 1 && (!inside || !rightHalf)) return this.point(1 - b.last, inside ? 'Wrong side' : 'Out!');
			if (b.bounces >= 2) return this.point(b.last, 'Winner!');
			b.vz = Math.abs(b.vz) * 0.62;
			this.ctx.audio.play('tick');
		}
		// the net
		if ((b.y - NET) * (b.y - b.vy * dt - NET) < 0 && b.z < 14) return this.point(1 - b.last, 'Into the net');
		// returns: the ball reaches a player's racket while low enough
		for (const [who, pl] of [[0, me], [1, cpu]]) {
			if (b.last === who || b.z > 70) continue;
			if (Math.abs(b.y - pl.y) < 22 && Math.abs(b.x - pl.x) < 34) {
				if (who === 1 && Math.random() > 0.5 + skill * 0.45) continue; // a miss
				const offset = (b.x - pl.x) / 34; // -1..1 across the racket
				const depth = who === 0 ? TOPY + 40 + Math.random() * 120 : TOPY + COURT_H - 40 - Math.random() * 120;
				let aim = CX + offset * COURT_W * 0.45;
				if (who === 1) aim = CX + (Math.random() - 0.5) * COURT_W * (0.5 + skill * 0.4);
				const lob = who === 0 ? this.lob || (this.pointer.down && this.multi) : Math.random() < 0.15;
				this.hit(who, Math.max(CX - COURT_W / 2 + 12, Math.min(CX + COURT_W / 2 - 12, aim)), depth, lob, who === 0 ? 1.05 : 0.9 + skill * 0.15);
				pl.swing = 1;
				this.burst(b.x, b.y - b.z, { count: 6, color: '#d9f99d', speed: 80, life: 0.25, size: 2 });
				break;
			}
		}
		if (b.y < -60 || b.y > H + 60 || b.x < -60 || b.x > W + 60) this.point(b.bounces ? b.last : 1 - b.last, b.bounces ? 'Winner!' : 'Out!');
	}

	pointerDown(p, e) { this.multi = e?.isPrimary === false; }

	point(winner, why) {
		this.ball.live = false;
		this.points[winner]++;
		this.ctx.audio.play(winner === 0 ? 'score' : 'hit');
		this.popup(why, CX, NET, { color: winner === 0 ? '#bef264' : '#fca5a5', size: 22 });
		const [a, b] = this.points;
		if ((a >= 4 || b >= 4) && Math.abs(a - b) >= 2) {
			this.games[a > b ? 0 : 1]++;
			this.points = [0, 0];
			this.server = 1 - this.server;
			this.ctx.score(this.games[0]);
			this.ctx.fx.banner(`Game ${a > b ? 'you' : 'computer'} · ${this.games[0]}–${this.games[1]}`);
			if (this.games[0] >= this.target || this.games[1] >= this.target) {
				const win = this.games[0] > this.games[1];
				this.ctx.audio.play(win ? 'cheer' : 'lose');
				if (win) this.ctx.fx.confetti({ count: 70 });
				return this.finish({ win, title: win ? 'Game, set and match!' : 'The computer takes the set', message: `Games ${this.games[0]}–${this.games[1]}.`, score: this.games[0] * 10 - this.games[1] * 5 + (win ? 50 : 0) });
			}
		}
		this.serve();
		this.ball.wait = 1.2;
	}

	player(g, pl, color, facing) {
		circle(g, pl.x + 3, pl.y + 4, 12, 'rgba(0,0,0,0.25)');
		circle(g, pl.x, pl.y, 12, color);
		circle(g, pl.x, pl.y - 2, 6, '#fcd9b6');
		g.save();
		g.translate(pl.x + 12, pl.y);
		g.rotate(facing * (-0.6 + pl.swing * 1.8));
		g.strokeStyle = '#1f2937';
		g.lineWidth = 3;
		g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -16 * facing); g.stroke();
		g.strokeStyle = '#f8fafc';
		g.lineWidth = 2;
		g.beginPath(); g.ellipse(0, -24 * facing, 7, 9, 0, 0, Math.PI * 2); g.stroke();
		g.restore();
	}

	draw(g) {
		g.fillStyle = '#166534';
		g.fillRect(0, 0, W, H);
		fillRound(g, CX - COURT_W / 2 - 20, TOPY - 20, COURT_W + 40, COURT_H + 40, 6, '#1d4ed8');
		g.strokeStyle = '#f8fafc';
		g.lineWidth = 3;
		g.strokeRect(CX - COURT_W / 2, TOPY, COURT_W, COURT_H);
		g.beginPath();
		g.moveTo(CX - COURT_W / 2, TOPY + COURT_H * 0.25); g.lineTo(CX + COURT_W / 2, TOPY + COURT_H * 0.25);
		g.moveTo(CX - COURT_W / 2, TOPY + COURT_H * 0.75); g.lineTo(CX + COURT_W / 2, TOPY + COURT_H * 0.75);
		g.moveTo(CX, TOPY + COURT_H * 0.25); g.lineTo(CX, TOPY + COURT_H * 0.75);
		g.stroke();
		// net
		g.fillStyle = 'rgba(15,23,42,0.6)';
		g.fillRect(CX - COURT_W / 2 - 24, NET - 3, COURT_W + 48, 6);
		g.fillStyle = '#f8fafc';
		g.fillRect(CX - COURT_W / 2 - 24, NET - 4, COURT_W + 48, 2);
		this.player(g, this.cpu, '#f97316', -1);
		const b = this.ball;
		circle(g, b.x, b.y, 5, 'rgba(0,0,0,0.3)');
		circle(g, b.x, b.y - b.z, 5 + b.z * 0.02, '#d9f99d');
		this.player(g, this.me, colors.accent, 1);
		fillRound(g, 8, 8, 128, 46, 10, 'rgba(0,0,0,0.45)');
		text(g, `You   ${this.games[0]}`, 18, 22, { size: 14, align: 'left' });
		text(g, `CPU   ${this.games[1]}`, 18, 42, { size: 14, align: 'left', color: '#fdba74' });
		text(g, this.call, W - 12, 22, { size: 14, align: 'right' });
	}
}
