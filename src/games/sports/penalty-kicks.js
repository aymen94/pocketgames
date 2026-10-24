// Penalty Kicks: a 3D shootout (WAMR3D). Take a kick (aim, then time the power meter),
// then dive to save the computer's kick. Five rounds each, then sudden death.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { pointerNdc } from '../../engine/input.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const GOAL_W = 7.32, GOAL_H = 2.44, SPOT = 11;
const SKILL = { easy: { guess: 0.33, reach: 1.6 }, normal: { guess: 0.48, reach: 2.0 }, hard: { guess: 0.62, reach: 2.4 } };

export default class PenaltyKicks extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x1e3a5f, fov: 50, far: 200, fog: { color: 0x1e3a5f, near: 40, far: 120 } });
		this.stage.addLights({ sky: 0xe0f2fe, ground: 0x14532d, intensity: 1.2, sunIntensity: 1.8, sunPosition: [-6, 14, 10] });
		this.style = h('style', PK_CSS);
		this.board = h('div.pk-board');
		this.prompt = h('div.hint-3d');
		this.meter = h('div.pk-meter', h('div.pk-fill'));
		this.callout = h('div');
		this.ctx.root.append(this.style, this.board, this.prompt, this.meter, this.callout);
		this.build();
		this.ctx.input.on(this.ctx.root, 'pointerdown', (e) => this.tap(e));
		this.reset();
	}

	build() {
		const s = this.stage;
		for (let i = 0; i < 12; i++) {
			const stripe = s.mesh(geo.box(60, 0.02, 5), standard(i % 2 ? 0x2f8f46 : 0x35a050, { roughness: 1 }));
			stripe.position.set(0, -0.01, 22 - i * 5);
		}
		const lineMat = basic(0xf8fafc);
		const line = (w, d, x, z) => { const m = s.mesh(geo.box(w, 0.025, d), lineMat); m.position.set(x, 0.005, z); };
		line(40, 0.12, 0, 0);
		line(16.5 * 2, 0.12, 0, 16.5);
		line(0.12, 16.5, -16.5, 8.25);
		line(0.12, 16.5, 16.5, 8.25);
		line(18.3, 0.12, 0, 5.5);
		line(0.12, 5.5, -9.15, 2.75);
		line(0.12, 5.5, 9.15, 2.75);
		const spot = s.mesh(geo.circle(0.12, 16), lineMat);
		spot.rotation.x = -Math.PI / 2;
		spot.position.set(0, 0.02, SPOT);

		const post = standard(0xffffff, { roughness: 0.3 });
		for (const x of [-GOAL_W / 2, GOAL_W / 2]) s.mesh(geo.cylinder(0.06, 0.06, GOAL_H, 12), post).position.set(x, GOAL_H / 2, 0);
		const bar = s.mesh(geo.cylinder(0.06, 0.06, GOAL_W + 0.12, 12), post);
		bar.rotation.z = Math.PI / 2;
		bar.position.set(0, GOAL_H, 0);
		const netMat = standard(0xffffff, { wireframe: true, transparent: true, opacity: 0.5 });
		const back = s.mesh(s.own(new THREE.PlaneGeometry(GOAL_W, GOAL_H, 24, 8)), netMat);
		this.net = back;
		back.position.set(0, GOAL_H / 2, -1.6);
		const roof = s.mesh(s.own(new THREE.PlaneGeometry(GOAL_W, 1.6, 24, 6)), netMat);
		roof.rotation.x = Math.PI / 2;
		roof.position.set(0, GOAL_H, -0.8);
		for (const x of [-GOAL_W / 2, GOAL_W / 2]) {
			const side = s.mesh(s.own(new THREE.PlaneGeometry(1.6, GOAL_H, 6, 8)), netMat);
			side.rotation.y = Math.PI / 2;
			side.position.set(x, GOAL_H / 2, -0.8);
		}
		// crowd stand
		const stand = s.mesh(geo.box(70, 10, 6), standard(0x1e293b, { roughness: 1 }));
		stand.position.set(0, 3, -16);
		for (let i = 0; i < 90; i++) {
			const fan = s.mesh(geo.sphere(0.35, 8, 6), standard([0xf472b6, 0xfbbf24, 0x60a5fa, 0xf8fafc, 0x34d399][i % 5], { roughness: 0.8 }));
			fan.position.set(-30 + (i % 30) * 2 + Math.random(), 4 + Math.floor(i / 30) * 2.2, -12.8 - Math.floor(i / 30) * 1.2);
		}

		this.keeper = new THREE.Group();
		// the kit changes colour between attack and defence, so it is not a shared material
		this.kit = s.own(new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }));
		const skin = standard(0xd6a77a, { roughness: 0.7 });
		s.mesh(geo.capsule(0.28, 0.8), this.kit, this.keeper).position.y = 1.0;
		s.mesh(geo.sphere(0.2, 16, 12), skin, this.keeper).position.y = 1.72;
		for (const side of [-1, 1]) {
			const arm = s.mesh(geo.capsule(0.09, 0.6), this.kit, this.keeper);
			arm.position.set(side * 0.42, 1.45, 0);
			arm.rotation.z = side * 0.5;
			const glove = s.mesh(geo.sphere(0.12, 10, 8), standard(0x111827), this.keeper);
			glove.position.set(side * 0.62, 1.85, 0);
			const leg = s.mesh(geo.capsule(0.1, 0.55), standard(0x111827), this.keeper);
			leg.position.set(side * 0.15, 0.35, 0);
		}
		this.keeper.position.set(0, 0, 0.3);
		s.scene.add(this.keeper);

		this.ball = new THREE.Group();
		s.mesh(geo.icosa(0.11, 1), standard(0xf8fafc, { roughness: 0.4, flatShading: true }), this.ball);
		s.scene.add(this.ball);
		this.marker = s.mesh(geo.ring(0.12, 0.2, 24), basic(0xfbbf24));
		this.particles = new Particles(s, { capacity: 500 });
		this.shake = new Shake();
		this.trail = new Trail3D(this.particles, { color: 0xffffff, rate: 50, size: 0.05, life: 0.3 });
		this.ripple = 0;
		this.marker.visible = false;
	}

	reset() {
		this.running = false;
		clearTimeout(this.timer);
		this.round = 0;
		this.results = { you: [], cpu: [] };
		this.skill = SKILL[this.ctx.settings.difficulty] ?? SKILL.normal;
		this.camZ = SPOT + 4;
		this.beginShot();
		this.paintBoard();
		this.ctx.score(0);
	}

	goals(side) { return this.results[side].filter(Boolean).length; }

	paintBoard() {
		const row = (label, list) => {
			const n = Math.max(5, list.length + (list.length >= 5 ? 1 : 0));
			return h('div.pk-row', h('span', label), ...Array.from({ length: n }, (_, i) => h(`i${i < list.length ? (list[i] ? '.goal' : '.miss') : ''}`)));
		};
		this.board.replaceChildren(row('You', this.results.you), row('CPU', this.results.cpu));
		this.ctx.info(`Round ${Math.min(this.round + 1, 99)} · ${this.goals('you')} – ${this.goals('cpu')}`);
	}

	say(text) { this.prompt.textContent = text; this.prompt.hidden = !text; }
	pop(text) { this.callout.replaceChildren(h('div.big-callout', text)); }

	// ------------------------------------------------------------ phases

	beginShot() {
		this.phase = 'aim';
		this.ballState = { x: 0, y: 0.11, z: SPOT, flying: false };
		this.ball.position.set(0, 0.11, SPOT);
		this.keeperTarget = { x: 0, y: 0, tilt: 0 };
		this.kit.color.set(0xfacc15);
		this.meter.hidden = true;
		this.marker.visible = false;
		this.say('Tap the goal where you want to shoot');
	}

	beginSave() {
		this.phase = 'save';
		this.ballState = { x: 0, y: 0.11, z: SPOT, flying: false };
		this.ball.position.set(0, 0.11, SPOT);
		this.keeperTarget = { x: 0, y: 0, tilt: 0 };
		this.kit.color.set(0x60a5fa);
		this.marker.visible = false;
		this.dive = null;
		this.say('Your save! Tap left, middle or right to dive');
		this.saveClock = 1.6;
	}

	tap(e) {
		if (!this.running || this.paused) return;
		if (this.phase === 'aim') {
			const p = this.goalPoint(e);
			if (!p) return;
			this.aim = { x: Math.max(-GOAL_W / 2 - 1.2, Math.min(GOAL_W / 2 + 1.2, p.x)), y: Math.max(0.15, Math.min(GOAL_H + 0.8, p.y)) };
			this.marker.position.set(this.aim.x, this.aim.y, 0.05);
			this.marker.visible = true;
			this.phase = 'power';
			this.power = 0;
			this.powerDir = 1;
			this.meter.hidden = false;
			this.say('Tap again to set the power');
			this.ctx.audio.play('click');
		} else if (this.phase === 'power') {
			this.kick(this.aim, this.power, true);
		} else if (this.phase === 'save' && !this.dive) {
			const rect = this.ctx.root.getBoundingClientRect();
			const third = (e.clientX - rect.left) / rect.width;
			this.dive = third < 0.36 ? -1 : third > 0.64 ? 1 : 0;
			this.ctx.audio.play('swoosh');
		}
	}

	handleInput({ type, action }) {
		if (type !== 'down' || this.phase !== 'save' || this.dive) return;
		if (action === 'left') this.dive = -1;
		else if (action === 'right') this.dive = 1;
		else if (action === 'down' || action === 'up') this.dive = 0;
	}

	goalPoint(e) {
		const { camera, raycaster, renderer } = this.stage;
		const ndc = pointerNdc(e, renderer.domElement);
		raycaster.setFromCamera(ndc, camera);
		const { origin, direction } = raycaster.ray;
		if (Math.abs(direction.z) < 1e-6) return null;
		const t = -origin.z / direction.z;
		return t > 0 ? { x: origin.x + direction.x * t, y: origin.y + direction.y * t } : null;
	}

	kick(target, power, byPlayer) {
		this.meter.hidden = true;
		this.phase = 'flight';
		this.say('');
		// over-hit kicks fly high and wide, soft ones are slow
		const wild = Math.max(0, power - 0.82) * 4;
		const tx = target.x + (Math.random() - 0.5) * (0.4 + wild * 1.2);
		const ty = target.y + (Math.random() - 0.3) * (0.2 + wild * 1.6) + wild * 0.6;
		const duration = 1.05 - Math.min(power, 1) * 0.55;
		this.ballState = { x: 0, y: 0.11, z: SPOT, flying: true, t: 0, duration, tx, ty, byPlayer, power };
		this.ctx.audio.play('thud');
		const inside = Math.abs(tx) < GOAL_W / 2 - 0.1 && ty < GOAL_H - 0.08;
		if (byPlayer) {
			// the keeper guesses a side; a correct guess saves anything in reach
			const zone = tx < -1.2 ? -1 : tx > 1.2 ? 1 : 0;
			const guess = Math.random() < this.skill.guess ? zone : [-1, 0, 1][Math.floor(Math.random() * 3)];
			const reach = this.skill.reach * (power < 0.4 ? 1.3 : 1);
			const diveX = guess * 2.4;
			this.saved = inside && guess === zone && Math.abs(tx - diveX) < reach && ty < 2.3;
			this.keeperTarget = { x: this.saved ? Math.max(-3, Math.min(3, tx * 0.85)) : diveX, y: guess ? 0.5 : 0.1, tilt: -guess * 1.2 };
		} else {
			const zone = tx < -1.2 ? -1 : tx > 1.2 ? 1 : 0;
			const choice = this.dive ?? 0;
			const corner = ty > 1.8 && zone !== 0;
			this.saved = inside && choice === zone && Math.random() < (corner ? 0.6 : 0.88);
			this.keeperTarget = { x: this.saved ? tx * 0.85 : choice * 2.4, y: choice ? 0.5 : 0.1, tilt: -choice * 1.2 };
		}
		this.onTarget = inside;
	}

	cpuKick() {
		const corner = Math.random() < 0.6;
		const side = Math.random() < 0.5 ? -1 : 1;
		const target = { x: corner ? side * (2.4 + Math.random() * 0.9) : (Math.random() - 0.5) * 2.2, y: 0.3 + Math.random() * 1.9 };
		this.kick(target, 0.45 + Math.random() * 0.45, false);
	}

	resolve() {
		const b = this.ballState;
		const goal = this.onTarget && !this.saved;
		const side = b.byPlayer ? 'you' : 'cpu';
		if (goal) {
			// the net bulges and the crowd's confetti flies
			this.ripple = 1;
			this.particles.emit(b.x, b.y, -1, { count: 60, colors: b.byPlayer ? [0xfbbf24, 0x34d399, 0xffffff, 0x60a5fa] : [0x94a3b8, 0x64748b], speed: 4, size: 0.07, life: 1.2, gravity: -5, up: 2 });
			this.shake.kick(b.byPlayer ? 0.35 : 0.2);
		} else if (this.saved) {
			this.particles.emit(b.x, b.y, 0.6, { count: 30, colors: [0xffffff, 0xfde047], speed: 4.5, size: 0.05, life: 0.4, gravity: -6 });
			this.shake.kick(0.4);
		} else {
			this.particles.emit(b.x, 0.1, b.z, { count: 16, colors: [0x2f8f46, 0x7c4a24], speed: 2, size: 0.06, life: 0.6, gravity: -9, up: 1.5 });
		}
		this.results[side].push(goal);
		this.ctx.score(this.goals('you'));
		if (b.byPlayer) this.pop(goal ? 'GOAL!' : this.saved ? 'Saved!' : 'Missed!');
		else this.pop(goal ? 'They score' : this.saved ? 'GREAT SAVE!' : 'Off target!');
		this.ctx.audio.play(goal ? (b.byPlayer ? 'cheer' : 'buzzer') : this.saved && !b.byPlayer ? 'cheer' : 'thud');
		this.paintBoard();
		this.timer = setTimeout(() => this.next(b.byPlayer), 1500);
	}

	next(wasPlayer) {
		if (!this.running) return;
		if (wasPlayer) return this.beginSave();
		this.round++;
		const you = this.goals('you'), cpu = this.goals('cpu');
		const left = Math.max(0, 5 - this.round);
		let over = false;
		if (this.round < 5) over = you > cpu + left || cpu > you + left;
		else over = you !== cpu;
		if (over) {
			const won = you > cpu;
			return this.finish({ win: won, title: won ? 'You win the shootout!' : 'Shootout lost', message: `Final score ${you} – ${cpu}${this.round > 5 ? ' after sudden death' : ''}.`, score: you });
		}
		if (this.round === 5) this.pop('Sudden death!');
		this.beginShot();
	}

	update(dt) {
		const k = this.keeper;
		k.position.x = damp(k.position.x, this.keeperTarget.x, 0.14, dt);
		k.position.y = damp(k.position.y, this.keeperTarget.y, 0.14, dt);
		k.rotation.z = damp(k.rotation.z, this.keeperTarget.tilt, 0.14, dt);
		this.camZ = damp(this.camZ, this.phase === 'flight' ? SPOT + 2.5 : SPOT + 4, 0.05, dt);
		this.particles.update(dt);
		this.shake.update(dt);
		this.ripple = Math.max(0, this.ripple - dt * 1.5);
		this.net.position.z = -1.6 - Math.sin(this.ripple * Math.PI * 3) * this.ripple * 0.35;
		this.stage.camera.position.set(this.shake.x, 1.7 + this.shake.y, this.camZ);
		this.stage.camera.lookAt(0, 1.1, 0);
		if (!this.running) return;
		if (this.phase === 'aim' || this.phase === 'power') {
			// the keeper sways on his line while you aim
			this.keeperTarget.x = Math.sin(performance.now() / 600) * 0.5;
		}
		if (this.phase === 'power') {
			this.power += this.powerDir * dt * 1.25;
			if (this.power > 1) { this.power = 1; this.powerDir = -1; }
			if (this.power < 0) { this.power = 0; this.powerDir = 1; }
			const fill = this.meter.firstChild;
			fill.style.height = `${this.power * 100}%`;
			fill.style.background = this.power > 0.82 ? '#ef4444' : this.power > 0.45 ? '#34d399' : '#fbbf24';
		}
		if (this.phase === 'save') {
			this.saveClock -= dt;
			if (this.saveClock <= 0) this.cpuKick();
		}
		const b = this.ballState;
		if (b.flying) {
			b.t += dt / b.duration;
			const t = Math.min(b.t, 1);
			const arc = Math.sin(t * Math.PI) * (0.4 + b.power * 0.3);
			b.x = b.tx * t;
			b.z = SPOT * (1 - t);
			b.y = 0.11 + (b.ty - 0.11) * t + arc;
			if (this.saved && t > 0.92) {
				// parried away
				b.flying = false;
				this.ball.position.set(b.x, b.y, 0.6);
				this.resolve();
				return;
			}
			this.ball.position.set(b.x, b.y, b.z - (t >= 1 && this.onTarget ? 0.9 : 0));
			this.ball.rotation.x -= dt * 20;
			this.trail.update(b.x, b.y, b.z, dt, 0.5 + b.power);
			if (b.t >= 1) {
				b.flying = false;
				this.resolve();
			}
		}
	}

	render() {
		this.stage.render();
	}

	dispose() {
		clearTimeout(this.timer);
		this.stage.dispose();
		for (const el of [this.style, this.board, this.prompt, this.meter, this.callout]) el.remove();
	}
}

const PK_CSS = `
.pk-board { position: absolute; left: 14px; top: 12px; z-index: 2; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: 14px; background: rgba(11,16,32,0.7); pointer-events: none; }
.pk-row { display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 0.85rem; }
.pk-row span { width: 36px; }
.pk-row i { width: 14px; height: 14px; border-radius: 50%; background: rgba(255,255,255,0.15); }
.pk-row i.goal { background: #34d399; }
.pk-row i.miss { background: #fb7185; }
.pk-meter { position: absolute; right: 18px; top: 50%; transform: translateY(-50%); z-index: 2; width: 18px; height: 180px; border-radius: 10px; background: rgba(11,16,32,0.7); border: 2px solid rgba(255,255,255,0.4); display: flex; align-items: flex-end; overflow: hidden; pointer-events: none; }
.pk-fill { width: 100%; height: 0; }
`;
