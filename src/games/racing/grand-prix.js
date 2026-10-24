// Grand Prix 3D: three laps of a flowing circuit against three computer drivers, rendered
// with WAMR3D. The road, curbs and trees are InstancedMeshes built from a spline; cars
// drive on a 2D physics model on the ground plane; a chase camera follows you, and a
// minimap shows the whole field.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic } from '../../engine/materials.js';
import { Particles } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const CONTROL = [[0, 0], [60, -10], [110, 20], [120, 80], [80, 120], [30, 100], [0, 140], [-60, 150], [-110, 110], [-100, 50], [-50, 30], [-60, -30]];
const HALF = 7; // road half-width
const LAPS = 3;
const COLORS = [0xef4444, 0x3b82f6, 0xfacc15, 0x22c55e];

function loop(points, per = 24) {
	const out = [];
	const n = points.length;
	for (let i = 0; i < n; i++) {
		const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
		for (let k = 0; k < per; k++) {
			const t = k / per, t2 = t * t, t3 = t2 * t;
			const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
			out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
		}
	}
	// tangents and curvature for the AI
	for (let i = 0; i < out.length; i++) {
		const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length];
		out[i].yaw = Math.atan2(b.z - a.z, b.x - a.x);
	}
	for (let i = 0; i < out.length; i++) {
		const a = out[i].yaw, b = out[(i + 6) % out.length].yaw;
		out[i].bend = Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
	}
	return out;
}

const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), c3 = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);

export default class GrandPrix extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x93c5fd, fov: 62, far: 420, fog: { color: 0x93c5fd, near: 90, far: 300 }, bloom: false, shadows: { extent: 60 } });
		const s = this.stage;
		s.addLights({ sky: 0xe0f2fe, ground: 0x365314, intensity: 1.2, sunIntensity: 2, sunPosition: [40, 80, 30] });
		this.track = loop(CONTROL);
		const n = this.track.length;
		const grass = s.mesh(geo.plane(1, 1), standard(0x4d7c0f, { roughness: 1 }));
		grass.rotation.x = -Math.PI / 2;
		grass.scale.set(600, 600, 1);
		grass.position.y = -0.05;
		// road segments, curbs, and the start line
		const road = new THREE.InstancedMesh(geo.box(1, 1, 1), s.own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 })), n);
		const curbs = new THREE.InstancedMesh(geo.box(1, 1, 1), s.own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })), n * 2);
		for (let i = 0; i < n; i++) {
			const a = this.track[i], b = this.track[(i + 1) % n];
			const len = Math.hypot(b.x - a.x, b.z - a.z);
			const yaw = Math.atan2(b.z - a.z, b.x - a.x);
			q4.setFromAxisAngle(up, -yaw);
			p3.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
			s3.set(len + 0.6, 0.1, HALF * 2);
			m4.compose(p3, q4, s3);
			road.setMatrixAt(i, m4);
			road.setColorAt(i, c3.set(i < 2 ? 0xf8fafc : 0x3f3f46));
			for (const side of [-1, 1]) {
				const nx = -Math.sin(yaw) * side, nz = Math.cos(yaw) * side;
				p3.set((a.x + b.x) / 2 + nx * (HALF + 0.6), 0.06, (a.z + b.z) / 2 + nz * (HALF + 0.6));
				s3.set(len + 0.6, 0.18, 1.2);
				m4.compose(p3, q4, s3);
				const k = i * 2 + (side > 0 ? 1 : 0);
				curbs.setMatrixAt(k, m4);
				curbs.setColorAt(k, c3.set(Math.floor(i / 2) % 2 ? 0xdc2626 : 0xf8fafc));
			}
		}
		for (const mesh of [road, curbs]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; s.scene.add(mesh); }
		this.trees(s);
		// start gantry
		const gantry = new THREE.Group();
		for (const side of [-1, 1]) { const post = s.mesh(geo.box(0.6, 6, 0.6), standard(0x334155), gantry); post.position.set(0, 3, side * (HALF + 1.5)); }
		const beam = s.mesh(geo.box(0.8, 1.2, HALF * 2 + 4), standard(0x0f172a), gantry);
		beam.position.y = 6;
		this.lights = [0, 1, 2].map((i) => { const l = s.mesh(geo.sphere(0.35, 12, 8), basic(0x7f1d1d), gantry); l.position.set(-0.45, 6, (i - 1) * 1.4); return l; });
		const t0 = this.track[0];
		gantry.position.set(t0.x, 0, t0.z);
		gantry.rotation.y = -t0.yaw;
		s.scene.add(gantry);
		this.carMeshes = COLORS.map((color) => this.carMesh(color));
		this.particles = new Particles(s, { capacity: 200 });
		// HUD and minimap
		this.hud = h('div.hud-3d', h('span'), h('span'), h('span'));
		this.map = h('canvas', { width: 160, height: 160, style: { position: 'absolute', right: '14px', bottom: '14px', zIndex: 2, borderRadius: '12px', background: 'rgba(8,10,20,0.55)', pointerEvents: 'none' } });
		this.callout = h('div');
		this.ctx.root.append(this.hud, this.map, this.callout);
		this.mapG = this.map.getContext('2d');
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.touch = null;
		this.ctx.input.on(root, 'pointerdown', (e) => { this.touch = e.clientX; this.touchStart = e.clientX; });
		this.ctx.input.on(root, 'pointermove', (e) => { if (this.touch != null) this.touch = e.clientX; });
		this.ctx.input.on(window, 'pointerup', () => { this.touch = null; });
		this.reset();
	}

	trees(s) {
		const n = 160;
		const trunks = new THREE.InstancedMesh(geo.cylinder(0.25, 0.35, 2, 6), standard(0x78350f), n);
		const tops = new THREE.InstancedMesh(geo.cone(1.8, 4, 8), standard(0x166534, { roughness: 0.9 }), n);
		let k = 0, guard = 0;
		while (k < n && guard++ < 4000) {
			const x = -180 + Math.random() * 360, z = -100 + Math.random() * 330;
			if (this.track.some((t) => Math.hypot(t.x - x, t.z - z) < HALF + 6)) continue;
			const sc = 0.8 + Math.random() * 0.8;
			q4.identity();
			m4.compose(p3.set(x, 1 * sc, z), q4, s3.set(sc, sc, sc));
			trunks.setMatrixAt(k, m4);
			m4.compose(p3.set(x, 3.5 * sc, z), q4, s3.set(sc, sc, sc));
			tops.setMatrixAt(k, m4);
			k++;
		}
		trunks.count = tops.count = k;
		trunks.instanceMatrix.needsUpdate = tops.instanceMatrix.needsUpdate = true;
		s.scene.add(trunks, tops);
	}

	carMesh(color) {
		const s = this.stage, g = new THREE.Group();
		const body = s.mesh(geo.box(3.6, 0.6, 1.6), standard(color, { metalness: 0.3, roughness: 0.35 }), g);
		body.position.y = 0.55;
		const nose = s.mesh(geo.box(1.2, 0.35, 1.0), standard(color, { metalness: 0.3, roughness: 0.35 }), g);
		nose.position.set(2.1, 0.45, 0);
		const cockpit = s.mesh(geo.box(1.0, 0.5, 0.8), standard(0x111827, { roughness: 0.2 }), g);
		cockpit.position.set(-0.2, 1.0, 0);
		const wing = s.mesh(geo.box(0.4, 0.12, 2.2), standard(0x111827), g);
		wing.position.set(-1.9, 1.15, 0);
		for (const [x, z] of [[1.3, 0.95], [1.3, -0.95], [-1.3, 0.95], [-1.3, -0.95]]) {
			const w = s.mesh(geo.cylinder(0.42, 0.42, 0.4, 14), standard(0x111111, { roughness: 0.8 }), g);
			w.rotation.x = Math.PI / 2;
			w.position.set(x, 0.42, z);
		}
		s.scene.add(g);
		return g;
	}

	reset() {
		this.running = false;
		const t0 = this.track[0];
		const fx = Math.cos(t0.yaw), fz = Math.sin(t0.yaw), nx = -fz, nz = fx;
		// grid: two by two behind the line, the player starts last
		this.cars = COLORS.map((_, i) => {
			const row = 1 + Math.floor(i / 2), side = i % 2 ? 1 : -1;
			const ai = i !== 3;
			return { ai, x: t0.x - fx * row * 7 + nx * side * 3, z: t0.z - fz * row * 7 + nz * side * 3, yaw: t0.yaw, speed: 0, progress: -row * 7, index: 0, lap: 0, done: false, skill: 0.9 + i * 0.04 + (this.ctx.settings.difficulty === 'hard' ? 0.06 : this.ctx.settings.difficulty === 'easy' ? -0.08 : 0), steer: 0 };
		});
		this.me = this.cars[3];
		this.time = 0;
		this.countdown = 3.5;
		this.finishOrder = [];
		this.cam = { x: this.me.x - fx * 12, y: 6, z: this.me.z - fz * 12 };
		this.ctx.score(0);
		for (const l of this.lights) l.material = basic(0x7f1d1d);
		this.layoutCars();
	}

	nearestIndex(car) {
		const n = this.track.length;
		let best = car.index, d = Infinity;
		for (let k = -12; k <= 24; k++) {
			const i = (car.index + k + n) % n;
			const t = this.track[i];
			const dd = (t.x - car.x) ** 2 + (t.z - car.z) ** 2;
			if (dd < d) { d = dd; best = i; }
		}
		return { i: best, d: Math.sqrt(d) };
	}

	drive(car, dt, throttle, brake, steer) {
		const near = this.nearestIndex(car);
		const n = this.track.length;
		let di = near.i - car.index;
		if (di < -n / 2) { di += n; car.lap++; }
		if (di > n / 2) { di -= n; car.lap--; }
		car.index = near.i;
		car.offroad = near.d > HALF + 1;
		const top = (car.offroad ? 22 : 52) * (car.ai ? car.skill : 1);
		if (throttle) car.speed += 26 * dt;
		if (brake) car.speed -= 45 * dt;
		car.speed -= car.speed * (car.offroad ? 1.2 : 0.12) * dt;
		car.speed = Math.max(-8, Math.min(top, car.speed));
		car.steer += (steer - car.steer) * Math.min(1, dt * 8);
		car.yaw += car.steer * dt * (1.9 - Math.min(1, Math.abs(car.speed) / 60) * 0.8) * Math.min(1, Math.abs(car.speed) / 8) * Math.sign(car.speed || 1);
		car.x += Math.cos(car.yaw) * car.speed * dt;
		car.z += Math.sin(car.yaw) * car.speed * dt;
		// barriers well off the track
		if (near.d > HALF + 14) {
			const t = this.track[near.i];
			const k = (HALF + 14) / near.d;
			car.x = t.x + (car.x - t.x) * k;
			car.z = t.z + (car.z - t.z) * k;
			car.speed *= 0.5;
			if (car === this.me) { this.ctx.audio.play('thud'); this.shake = 0.4; }
		}
		car.total = car.lap * n + car.index;
	}

	think(car) {
		const n = this.track.length;
		const look = this.track[(car.index + 6 + Math.round(car.speed / 8)) % n];
		let want = Math.atan2(look.z - car.z, look.x - car.x) - car.yaw;
		want = Math.atan2(Math.sin(want), Math.cos(want));
		const bend = this.track[(car.index + 4) % n].bend;
		const target = 52 * car.skill * (1 - Math.min(0.55, bend * 0.9));
		return { throttle: car.speed < target, brake: car.speed > target + 4, steer: Math.max(-1, Math.min(1, want * 2.5)) };
	}

	update(dt) {
		this.particles.update(dt);
		if (this.running) {
			if (this.countdown > 0) {
				const before = Math.ceil(this.countdown);
				this.countdown -= dt;
				const after = Math.ceil(this.countdown);
				if (after !== before && after >= 1 && after <= 3) {
					this.lights[3 - after].material = basic(0xef4444);
					this.ctx.audio.play('tick');
				}
				if (this.countdown <= 0) { for (const l of this.lights) l.material = basic(0x22c55e); this.ctx.audio.play('go'); this.callout.replaceChildren(h('div.big-callout', 'GO!')); }
			} else {
				this.time += dt;
				const input = this.ctx.input;
				let steer = input.axis().x;
				if (this.touch != null) steer = Math.max(-1, Math.min(1, (this.touch - this.touchStart) / 80));
				const throttle = input.isDown('up') || this.touch != null || (!input.isDown('down') && this.ctx.settings.auto !== 'off');
				for (const car of this.cars) {
					if (car.done) { this.drive(car, dt, false, true, 0); continue; }
					if (car.ai) { const a = this.think(car); this.drive(car, dt, a.throttle, a.brake, a.steer); }
					else this.drive(car, dt, throttle, input.isDown('down'), steer);
					if (car.lap >= LAPS && !car.done) {
						car.done = true;
						this.finishOrder.push(car);
						if (car === this.me) return this.finishRace();
					}
				}
				this.collide();
				if (this.me.offroad && this.me.speed > 10 && Math.random() < 0.4) this.particles.emit(this.me.x, 0.3, this.me.z, { count: 1, color: 0xa16207, speed: 1.5, size: 0.2, life: 0.6, gravity: -2, up: 1 });
			}
		}
		this.layoutCars();
		this.chase(dt);
		this.paintHud();
	}

	collide() {
		for (let i = 0; i < this.cars.length; i++) for (let j = i + 1; j < this.cars.length; j++) {
			const a = this.cars[i], b = this.cars[j];
			const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 3.2;
			if (d < min && d > 0) {
				const k = (min - d) / d / 2;
				a.x -= dx * k; a.z -= dz * k; b.x += dx * k; b.z += dz * k;
				const avg = (a.speed + b.speed) / 2;
				a.speed = a.speed * 0.8 + avg * 0.2; b.speed = b.speed * 0.8 + avg * 0.2;
				if (a === this.me || b === this.me) this.ctx.audio.play('hit');
			}
		}
	}

	position() {
		return 1 + this.cars.filter((c) => c !== this.me && (c.done || c.total > this.me.total)).length;
	}

	finishRace() {
		const place = this.finishOrder.indexOf(this.me) + 1;
		const score = (5 - place) * 500 + Math.max(0, Math.round(300 - this.time) * 5);
		this.ctx.score(score);
		const ord = ['1st', '2nd', '3rd', '4th'][place - 1];
		this.finish({ win: place === 1, title: place === 1 ? 'Victory!' : `${ord} place`, message: `Three laps in ${this.time.toFixed(1)} s.`, score });
	}

	layoutCars() {
		this.cars.forEach((car, i) => {
			const m = this.carMeshes[i];
			m.position.set(car.x, 0, car.z);
			m.rotation.y = -car.yaw;
			m.rotation.x = car.offroad ? Math.sin(performance.now() / 40) * 0.02 : 0;
		});
	}

	chase(dt) {
		const me = this.me, cam = this.stage.camera;
		const fx = Math.cos(me.yaw), fz = Math.sin(me.yaw);
		const tx = me.x - fx * 11, tz = me.z - fz * 11;
		this.cam.x = damp(this.cam.x, tx, 0.12, dt);
		this.cam.z = damp(this.cam.z, tz, 0.12, dt);
		this.cam.y = damp(this.cam.y, 4.2, 0.1, dt);
		this.shake = Math.max(0, (this.shake ?? 0) - dt);
		const sh = this.shake * 0.6;
		cam.position.set(this.cam.x + (Math.random() - 0.5) * sh, this.cam.y + (Math.random() - 0.5) * sh, this.cam.z);
		cam.lookAt(me.x + fx * 6, 1.2, me.z + fz * 6);
	}

	paintHud() {
		const me = this.me;
		this.hud.children[0].textContent = `Lap ${Math.min(LAPS, Math.max(1, me.lap + 1))}/${LAPS}`;
		this.hud.children[1].textContent = `Position ${this.position()}/4`;
		this.hud.children[2].textContent = `${Math.round(Math.abs(me.speed) * 5)} km/h · ${this.time.toFixed(1)} s`;
		// minimap
		const g = this.mapG;
		g.clearRect(0, 0, 160, 160);
		const sx = (x) => 80 + x * 0.55, sz = (z) => 20 + z * 0.55 + 10;
		g.strokeStyle = 'rgba(255,255,255,0.7)';
		g.lineWidth = 5;
		g.beginPath();
		this.track.forEach((t, i) => (i ? g.lineTo(sx(t.x), sz(t.z)) : g.moveTo(sx(t.x), sz(t.z))));
		g.closePath();
		g.stroke();
		this.cars.forEach((c, i) => {
			g.fillStyle = `#${COLORS[i].toString(16).padStart(6, '0')}`;
			g.beginPath(); g.arc(sx(c.x), sz(c.z), c === me ? 5 : 4, 0, Math.PI * 2); g.fill();
		});
	}

	render() { this.stage.render(); }

	dispose() {
		this.stage.dispose();
		for (const el of [this.hud, this.map, this.callout]) el.remove();
	}
}
