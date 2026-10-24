// Nova Blaster: a 3D space shooter (WAMR3D). Asteroids and drones rush toward your ship;
// lasers glow (bloom on High quality), hits throw instanced particle bursts and shake the
// camera, and warp streaks race past as one instanced draw.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette, themed } from '../../engine/materials.js';
import { Particles, Shake, starfield } from '../../engine/effects.js';
import { h } from '../../components/dom.js';
import { clamp } from '../core/physics.js';

const BOUND_X = 6, BOUND_Y = 3.4, FAR = -120, STREAKS = 90;
const matrix = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();

export default class NovaBlaster extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x03040d, fov: 62, far: 260, fog: { color: 0x03040d, near: 60, far: 130 }, bloom: { strength: 0.6, radius: 0.35, threshold: 0.82 } });
		this.stage.addLights({ sky: 0x9db4ff, ground: 0x1a1030, intensity: 0.8, sunIntensity: 1.6, sunPosition: [4, 6, 8] });
		this.hud = h('div.hud-3d', h('span'), h('span'));
		this.callout = h('div');
		this.ctx.root.append(this.hud, this.callout);
		this.build();
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => { this.pointer = this.toPlane(e); this.firing = true; });
		this.ctx.input.on(root, 'pointermove', (e) => { if (this.firing || e.pointerType === 'mouse') this.pointer = this.toPlane(e); });
		this.ctx.input.on(window, 'pointerup', () => { this.firing = false; });
		this.reset();
	}

	toPlane(e) {
		// where the pointer ray crosses the ship's plane (z = 0)
		const { raycaster, camera, renderer } = this.stage;
		const rect = renderer.domElement.getBoundingClientRect();
		raycaster.setFromCamera({ x: ((e.clientX - rect.left) / rect.width) * 2 - 1, y: -((e.clientY - rect.top) / rect.height) * 2 + 1 }, camera);
		const { origin, direction } = raycaster.ray;
		const t = -origin.z / direction.z;
		return { x: origin.x + direction.x * t, y: origin.y + direction.y * t };
	}

	build() {
		const s = this.stage;
		s.camera.position.set(0, 1.4, 9);
		s.camera.lookAt(0, 0, -20);
		starfield(s, { count: 900, radius: 200, size: 0.45 });
		this.planet = s.mesh(geo.sphere(26, 48, 32), standard(0x6d28d9, { roughness: 0.8, emissive: 0x1e0b4b, emissiveIntensity: 0.6 }));
		this.planet.position.set(-60, -22, -170);
		const ringGeo = s.own(new THREE.RingGeometry(34, 46, 64));
		const ring = s.mesh(ringGeo, basic(0xc4b5fd, { transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
		ring.position.copy(this.planet.position);
		ring.rotation.set(1.2, 0.3, 0);

		// warp streaks: thin bright boxes in one instanced draw, recycled along z
		this.streakMesh = new THREE.InstancedMesh(geo.box(0.03, 0.03, 1), s.own(new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })), STREAKS);
		this.streakMesh.frustumCulled = false;
		s.scene.add(this.streakMesh);
		this.streaks = Array.from({ length: STREAKS }, () => this.newStreak(FAR * Math.random()));

		// the ship
		this.ship = new THREE.Group();
		const hull = standard(0xe2e8f0, { roughness: 0.3, metalness: 0.6 });
		// the ship's trim wears the site theme's accent
		const accent = themed('primary', { glow: 0.4, roughness: 0.3, metalness: 0.4 });
		const body = s.mesh(geo.cone(0.45, 2.2, 6), hull, this.ship);
		body.rotation.x = -Math.PI / 2;
		const wing = s.mesh(geo.box(2.6, 0.08, 0.8), accent, this.ship);
		wing.position.set(0, -0.05, 0.45);
		for (const x of [-1.3, 1.3]) {
			const fin = s.mesh(geo.box(0.08, 0.5, 0.7), accent, this.ship);
			fin.position.set(x, 0.18, 0.5);
		}
		const cockpit = s.mesh(geo.sphere(0.28, 16, 10), standard(0x22d3ee, { roughness: 0.1, metalness: 0.2, emissive: 0x0e7490, emissiveIntensity: 0.6 }), this.ship);
		cockpit.position.set(0, 0.22, -0.2);
		cockpit.scale.set(1, 0.7, 1.6);
		this.flame = s.mesh(geo.cone(0.28, 1.1, 10), basic(0xfb923c, { transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }), this.ship);
		this.flame.rotation.x = Math.PI / 2;
		this.flame.position.z = 1.55;
		const engineLight = new THREE.PointLight(0xfb923c, 3, 4);
		engineLight.position.z = 1.6;
		this.ship.add(engineLight);
		s.scene.add(this.ship);
		this.shieldMat = s.own(new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
		this.shieldMesh = s.mesh(geo.sphere(1.6, 24, 16), this.shieldMat, this.ship);

		// pools
		const rock = [standard(0x8b7355, { roughness: 0.95, flatShading: true }), standard(0x6b7280, { roughness: 0.9, flatShading: true }), standard(0x9a6b4f, { roughness: 0.95, flatShading: true })];
		this.rocks = Array.from({ length: 26 }, (_, i) => ({ mesh: this.hide(s.mesh(geo.icosa(1, 0), rock[i % 3])), active: false }));
		const droneBody = standard(0x1f2937, { roughness: 0.4, metalness: 0.7 });
		const droneEye = standard(palette.coral, { emissive: palette.coral, emissiveIntensity: 1.2 });
		this.drones = Array.from({ length: 8 }, () => {
			const g = new THREE.Group();
			s.mesh(geo.octa(0.7), droneBody, g).scale.set(1.4, 0.6, 1);
			s.mesh(geo.torus(0.8, 0.06, 6, 24), droneEye, g).rotation.x = Math.PI / 2;
			s.mesh(geo.sphere(0.22, 12, 8), droneEye, g).position.z = 0.45;
			s.scene.add(g);
			return { mesh: this.hide(g), active: false };
		});
		this.laserMat = basic(0x7dd3fc);
		this.bolts = Array.from({ length: 40 }, () => ({ mesh: this.hide(s.mesh(geo.box(0.07, 0.07, 1.4), this.laserMat)), active: false }));
		this.enemyBoltMat = basic(0xfb7185);
		this.enemyBolts = Array.from({ length: 30 }, () => ({ mesh: this.hide(s.mesh(geo.sphere(0.16, 10, 8), this.enemyBoltMat)), active: false }));
		this.powerMesh = this.hide(s.mesh(geo.octa(0.45), standard(palette.amber, { emissive: palette.amber, emissiveIntensity: 1 })));
		this.particles = new Particles(s, { capacity: 600 });
		this.shake = new Shake();
	}

	hide(mesh) { mesh.visible = false; return mesh; }

	newStreak(z) {
		return { x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 24, z, len: 2 + Math.random() * 6 };
	}

	take(pool) {
		const item = pool.find((p) => !p.active);
		if (!item) return null;
		item.active = true;
		item.mesh.visible = true;
		return item;
	}

	release(item) {
		item.active = false;
		item.mesh.visible = false;
	}

	reset() {
		this.running = false;
		for (const pool of [this.rocks, this.drones, this.bolts, this.enemyBolts]) for (const it of pool) this.release(it);
		this.power = null;
		this.powerMesh.visible = false;
		this.particles.clear();
		this.ship.position.set(0, -1, 0);
		this.ship.rotation.set(0, 0, 0);
		this.ship.visible = true;
		this.shipPos = { x: 0, y: -1 };
		this.pointer = null;
		this.firing = false;
		this.cooldown = 0;
		this.spawnRock = 1;
		this.spawnDrone = 6;
		this.time = 0;
		this.score = 0;
		this.scoreFloat = 0;
		this.hull = 3;
		this.invulnerable = 0;
		this.triple = 0;
		this.speed = 32;
		this.ctx.score(0);
		this.paintHud();
	}

	paintHud() {
		this.hud.children[0].textContent = `Hull ${'■'.repeat(Math.max(0, this.hull))}${'□'.repeat(Math.max(0, 3 - this.hull))}`;
		this.hud.children[1].textContent = this.triple > 0 ? `Triple shot ${Math.ceil(this.triple)}s` : 'Hold Space or touch to fire';
	}

	pop(text) { this.callout.replaceChildren(h('div.big-callout', text)); }

	fire() {
		if (this.cooldown > 0) return;
		this.cooldown = 0.14;
		const spreads = this.triple > 0 ? [-0.12, 0, 0.12] : [0];
		for (const sx of spreads) {
			const b = this.take(this.bolts);
			if (!b) break;
			Object.assign(b, { x: this.shipPos.x, y: this.shipPos.y, z: -1.4, vx: sx * 40, vy: 0 });
			b.mesh.position.set(b.x, b.y, b.z);
			b.mesh.rotation.y = -sx;
		}
		this.ctx.audio.play('laser');
		// muzzle flash at the nose
		this.particles.emit(this.shipPos.x, this.shipPos.y + 0.1, -1.3, { count: 4, color: 0xbae6fd, speed: 2.5, size: 0.08, life: 0.12, gravity: 0 });
	}

	explode(x, y, z, tint, big = false) {
		this.particles.emit(x, y, z, { count: big ? 70 : 34, color: tint, speed: big ? 14 : 9, size: big ? 0.3 : 0.2, life: 0.9, gravity: 0 });
		this.particles.emit(x, y, z, { count: big ? 30 : 14, color: 0xfff1c1, speed: 4, size: 0.4, life: 0.4, gravity: 0 });
		this.shake.kick(big ? 0.9 : 0.35);
		this.ctx.audio.play(big ? 'explode' : 'shatter');
	}

	update(dt) {
		this.time += dt;
		this.planet.rotation.y += dt * 0.02;
		// warp streaks
		const streakSpeed = this.running ? this.speed * 2.2 : 30;
		this.streaks.forEach((st, i) => {
			st.z += streakSpeed * dt;
			if (st.z > 12) Object.assign(st, this.newStreak(FAR));
			pos.set(st.x, st.y, st.z);
			quat.identity();
			scl.set(1, 1, st.len);
			matrix.compose(pos, quat, scl);
			this.streakMesh.setMatrixAt(i, matrix);
		});
		this.streakMesh.instanceMatrix.needsUpdate = true;
		this.particles.update(dt);
		this.flame.scale.set(1, 0.8 + Math.random() * 0.5, 1);
		this.shake.update(dt);
		const cam = this.stage.camera;
		cam.position.set(this.shipPos.x * 0.35 + this.shake.x, 1.4 + this.shipPos.y * 0.25 + this.shake.y, 9);
		cam.lookAt(this.shipPos.x * 0.2, this.shipPos.y * 0.2, -20);
		if (!this.running) return;

		this.speed = Math.min(32 + this.time * 0.6, 60);
		const input = this.ctx.input;
		const axis = input.axis();
		if (axis.x || axis.y) { this.pointer = null; this.shipPos.x += axis.x * 9 * dt; this.shipPos.y -= axis.y * 7 * dt; }
		else if (this.pointer) {
			this.shipPos.x = damp(this.shipPos.x, this.pointer.x, 0.2, dt);
			this.shipPos.y = damp(this.shipPos.y, this.pointer.y + 0.6, 0.2, dt);
		}
		this.shipPos.x = clamp(this.shipPos.x, -BOUND_X, BOUND_X);
		this.shipPos.y = clamp(this.shipPos.y, -BOUND_Y, BOUND_Y);
		this.ship.position.set(this.shipPos.x, this.shipPos.y, 0);
		this.ship.rotation.z = damp(this.ship.rotation.z, -axis.x * 0.5 - (this.pointer ? (this.pointer.x - this.shipPos.x) * 0.15 : 0), 0.15, dt);
		this.cooldown -= dt;
		if (input.isDown('action') || this.firing) this.fire();
		if (this.triple > 0) { this.triple -= dt; this.paintHud(); }
		if (this.invulnerable > 0) {
			this.invulnerable -= dt;
			this.ship.visible = Math.floor(this.invulnerable * 12) % 2 === 0;
			if (this.invulnerable <= 0) this.ship.visible = true;
		}
		this.shieldMat.opacity = Math.max(0, this.shieldMat.opacity - dt * 1.5);

		// spawning
		this.spawnRock -= dt;
		if (this.spawnRock <= 0) {
			this.spawnRock = Math.max(0.22, 0.75 - this.time * 0.006);
			const r = this.take(this.rocks);
			if (r) {
				const size = 0.6 + Math.random() * 1.3;
				Object.assign(r, { x: (Math.random() - 0.5) * BOUND_X * 2.4, y: (Math.random() - 0.5) * BOUND_Y * 2.4, z: FAR, size, hp: size > 1.4 ? 3 : size > 0.9 ? 2 : 1, spin: [Math.random() - 0.5, Math.random() - 0.5].map((v) => v * 3), drift: (Math.random() - 0.5) * 2 });
				r.mesh.scale.setScalar(size);
			}
		}
		this.spawnDrone -= dt;
		if (this.spawnDrone <= 0) {
			this.spawnDrone = Math.max(2.5, 7 - this.time * 0.05);
			const d = this.take(this.drones);
			if (d) Object.assign(d, { x: (Math.random() - 0.5) * 8, y: Math.random() * 3, z: FAR * 0.6, hp: 4, phase: Math.random() * 6, shot: 1.5 });
		}

		const move = this.speed * dt;
		for (const b of this.bolts) {
			if (!b.active) continue;
			b.z -= 90 * dt;
			b.x += b.vx * dt;
			b.mesh.position.set(b.x, b.y, b.z);
			if (b.z < FAR) this.release(b);
		}
		for (const r of this.rocks) {
			if (!r.active) continue;
			r.z += move;
			r.x += r.drift * dt;
			r.mesh.position.set(r.x, r.y, r.z);
			r.mesh.rotation.x += r.spin[0] * dt;
			r.mesh.rotation.y += r.spin[1] * dt;
			if (this.hitByBolt(r.x, r.y, r.z, r.size * 0.95)) {
				r.hp--;
				this.particles.emit(r.x, r.y, r.z + r.size, { count: 8, color: 0xfde68a, speed: 6, size: 0.12, life: 0.3, gravity: 0 });
				this.ctx.audio.play('hit');
				if (r.hp <= 0) {
					this.release(r);
					this.addScore(Math.round(10 * r.size + 5));
					this.explode(r.x, r.y, r.z, 0xfb923c, r.size > 1.4);
					if (Math.random() < 0.08 && !this.power) this.power = { x: r.x, y: r.y, z: r.z };
					continue;
				}
			}
			if (r.z > -1 && r.z < 1.5 && Math.hypot(r.x - this.shipPos.x, r.y - this.shipPos.y) < r.size * 0.8 + 0.9) {
				this.release(r);
				this.explode(r.x, r.y, r.z, 0xfb923c);
				this.damage();
			}
			if (r.z > 14) this.release(r);
		}
		for (const d of this.drones) {
			if (!d.active) continue;
			d.z = Math.min(d.z + move * 0.6, -26);
			d.phase += dt;
			d.x += Math.sin(d.phase * 1.3) * 3 * dt;
			d.y = clamp(d.y + Math.cos(d.phase) * 2 * dt, -BOUND_Y, BOUND_Y);
			d.mesh.position.set(d.x, d.y, d.z);
			d.mesh.rotation.z = Math.sin(d.phase * 2) * 0.4;
			d.shot -= dt;
			if (d.shot <= 0 && d.z > -60) {
				d.shot = 1.6 + Math.random();
				const eb = this.take(this.enemyBolts);
				if (eb) {
					const dx = this.shipPos.x - d.x, dy = this.shipPos.y - d.y, dz = -d.z;
					const len = Math.hypot(dx, dy, dz);
					Object.assign(eb, { x: d.x, y: d.y, z: d.z, vx: (dx / len) * 26, vy: (dy / len) * 26, vz: (dz / len) * 26 });
					this.ctx.audio.play('zap');
				}
			}
			if (this.hitByBolt(d.x, d.y, d.z, 1.1)) {
				d.hp--;
				this.ctx.audio.play('hit');
				if (d.hp <= 0) {
					this.release(d);
					this.addScore(100);
					this.explode(d.x, d.y, d.z, palette.coral, true);
					this.pop('+100');
				}
			}
		}
		for (const eb of this.enemyBolts) {
			if (!eb.active) continue;
			eb.x += eb.vx * dt; eb.y += eb.vy * dt; eb.z += eb.vz * dt;
			eb.mesh.position.set(eb.x, eb.y, eb.z);
			if (Math.abs(eb.z) < 0.8 && Math.hypot(eb.x - this.shipPos.x, eb.y - this.shipPos.y) < 0.9) {
				this.release(eb);
				this.damage();
			} else if (eb.z > 12) this.release(eb);
		}
		if (this.power) {
			const p = this.power;
			p.z += move * 0.7;
			this.powerMesh.visible = true;
			this.powerMesh.position.set(p.x, p.y, p.z);
			this.powerMesh.rotation.y += dt * 4;
			if (Math.abs(p.z) < 1.2 && Math.hypot(p.x - this.shipPos.x, p.y - this.shipPos.y) < 1.3) {
				this.triple = 10;
				this.power = null;
				this.powerMesh.visible = false;
				this.ctx.audio.play('powerup');
				this.particles.emit(this.shipPos.x, this.shipPos.y, 0, { count: 30, color: palette.amber, speed: 5, size: 0.15, life: 0.6, gravity: 0 });
				this.pop('Triple shot!');
			} else if (p.z > 12) { this.power = null; this.powerMesh.visible = false; }
		}
		// distance score
		this.addScore(0, dt * 4);
	}

	hitByBolt(x, y, z, radius) {
		for (const b of this.bolts) {
			if (!b.active) continue;
			if (Math.abs(b.z - z) < radius + 0.7 && Math.hypot(b.x - x, b.y - y) < radius) {
				this.release(b);
				return true;
			}
		}
		return false;
	}

	addScore(points, fraction = 0) {
		this.scoreFloat = (this.scoreFloat ?? 0) + fraction;
		const whole = Math.floor(this.scoreFloat);
		this.scoreFloat -= whole;
		this.score += points + whole;
		this.ctx.score(this.score);
	}

	damage() {
		if (this.invulnerable > 0) return;
		this.hull--;
		this.invulnerable = 1.6;
		this.shieldMat.opacity = 0.6;
		this.shake.kick(1);
		this.ctx.audio.play('crash');
		this.paintHud();
		if (this.hull <= 0) {
			this.explode(this.shipPos.x, this.shipPos.y, 0, palette.blue, true);
			this.ship.visible = false;
			this.finish({ win: false, title: 'Ship destroyed', message: `You survived ${Math.floor(this.time)} seconds of deep space.`, score: this.score });
		}
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.callout.remove();
	}
}
