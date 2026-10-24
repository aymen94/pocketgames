// Hyper Tunnel: race down a neon tube in 3D (WAMR3D). Steer around the inside of the
// tunnel to dodge the barriers; the whole tube rolls so your ship always rides the floor.
// The tunnel walls and barriers are two InstancedMeshes, recycled ring by ring.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D } from '../../engine/stage.js';
import { geo, basic, standard } from '../../engine/materials.js';
import { Particles } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const R = 4, SEG = 18, RINGS = 44, GAP = 2.2, MAX_BLOCKS = RINGS * 4;
const TAU = Math.PI * 2;
const m4 = new THREE.Matrix4(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion(), s3 = new THREE.Vector3(), c3 = new THREE.Color(), zAxis = new THREE.Vector3(0, 0, 1);

export default class HyperTunnel extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x05010f, fov: 70, far: 140, fog: { color: 0x05010f, near: 30, far: 95 }, bloom: { strength: 0.9, radius: 0.5, threshold: 0.5 } });
		const s = this.stage;
		s.camera.position.set(0, -R + 1.7, 5);
		s.camera.lookAt(0, -R + 1.2, -12);
		this.tube = new THREE.Group();
		s.scene.add(this.tube);
		this.tiles = new THREE.InstancedMesh(geo.box(1, 1, 1), s.own(new THREE.MeshBasicMaterial({ color: 0xffffff })), SEG * RINGS);
		this.tiles.frustumCulled = false;
		this.tube.add(this.tiles);
		this.blocks = new THREE.InstancedMesh(geo.box(1, 1, 1), s.own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x220011, emissiveIntensity: 1 })), MAX_BLOCKS);
		this.blocks.frustumCulled = false;
		this.tube.add(this.blocks);
		this.orbs = new THREE.InstancedMesh(geo.octa(0.35), s.own(new THREE.MeshBasicMaterial({ color: 0xfde047 })), RINGS);
		this.orbs.frustumCulled = false;
		this.tube.add(this.orbs);
		// the ship
		this.ship = new THREE.Group();
		const hull = s.mesh(geo.cone(0.45, 1.6, 4), standard(0xe0f2fe, { metalness: 0.5, roughness: 0.25 }), this.ship);
		hull.rotation.x = -Math.PI / 2;
		const glowMesh = s.mesh(geo.sphere(0.22, 10, 8), basic(0x22d3ee), this.ship);
		glowMesh.position.z = 0.8;
		this.ship.position.set(0, -R + 0.75, 0);
		s.scene.add(this.ship);
		s.scene.add(new THREE.PointLight(0x22d3ee, 30, 14));
		this.particles = new Particles(s, { capacity: 260 });
		this.hud = h('div.hud-3d', h('span'), h('span'));
		this.hint = h('div.hint-3d', 'Left / Right (or drag) to steer');
		this.ctx.root.append(this.hud, this.hint);
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => { this.drag = e.clientX; });
		this.ctx.input.on(root, 'pointermove', (e) => { if (this.drag != null) { this.steer += (e.clientX - this.drag) * 0.012; this.drag = e.clientX; } });
		this.ctx.input.on(window, 'pointerup', () => { this.drag = null; });
		this.reset();
	}

	reset() {
		this.running = false;
		this.angle = 0; // player's angle around the tube (0 = floor)
		this.steer = 0;
		this.speed = 18;
		this.distance = 0;
		this.orbsTaken = 0;
		this.score = 0;
		this.crashed = false;
		this.rings = [];
		for (let i = 0; i < RINGS; i++) this.rings.push(this.makeRing(-i * GAP, i));
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	makeRing(z, index) {
		const ring = { z, index, blocks: [], orb: null };
		// the first stretch is empty so the player can settle in
		if (index > 8 && index % 2 === 0) {
			const difficulty = Math.min(1, this.distance / 2500);
			const n = 1 + Math.floor(Math.random() * (1 + difficulty * 3));
			const start = Math.floor(Math.random() * SEG);
			for (let k = 0; k < n; k++) ring.blocks.push((start + k * (Math.random() < 0.5 ? 1 : 3)) % SEG);
			// keep at least a few sectors open
			ring.blocks = [...new Set(ring.blocks)].slice(0, SEG - 6);
		}
		if (index > 4 && Math.random() < 0.3) {
			let sector;
			do { sector = Math.floor(Math.random() * SEG); } while (ring.blocks.includes(sector));
			ring.orb = sector;
		}
		return ring;
	}

	sectorOf(angle) { return ((Math.round((angle / TAU) * SEG) % SEG) + SEG) % SEG; }

	update(dt) {
		this.particles.update(dt);
		const input = this.ctx.input;
		if (this.running && !this.crashed) {
			const axis = input.axis().x;
			if (axis || this.steer) this.hint.hidden = true;
			this.angle += (axis * 3.4 * dt) + this.steer;
			this.steer = 0;
			this.speed = Math.min(46, this.speed + dt * 0.45);
			const step = this.speed * dt;
			this.distance += step;
			for (const r of this.rings) r.z += step;
			const mine = this.sectorOf(this.angle);
			for (const r of this.rings) {
				// the ring crosses the ship (z = 0) this frame
				if (r.z >= 0 && r.z - step < 0) {
					if (r.blocks.includes(mine)) return this.crash();
					if (r.orb === mine) { r.orb = null; this.orbsTaken++; this.ctx.audio.play('coin'); this.particles.emit(0, -R + 0.8, 0, { count: 16, color: 0xfde047, speed: 3, size: 0.08, life: 0.5, gravity: 0 }); }
				}
			}
			// recycle rings that passed the camera
			for (let i = 0; i < this.rings.length; i++) {
				const r = this.rings[i];
				if (r.z > 6) {
					const far = Math.min(...this.rings.map((q) => q.z));
					this.rings[i] = this.makeRing(far - GAP, r.index + RINGS);
				}
			}
			this.score = Math.floor(this.distance / 2) + this.orbsTaken * 50;
			this.ctx.score(this.score);
			if (Math.random() < 0.5) this.particles.emit(0, -R + 0.75, 1, { count: 1, color: 0x22d3ee, speed: 0.4, size: 0.06, life: 0.4, gravity: 0 });
		}
		this.layout();
		this.hud.children[0].textContent = `${Math.floor(this.distance)} m`;
		this.hud.children[1].textContent = `Speed ${Math.round(this.speed * 3.6)} km/h · orbs ${this.orbsTaken}`;
	}

	layout() {
		// roll the tube so the player's sector is the floor
		this.tube.rotation.z = -this.angle;
		const t = performance.now() / 1000;
		let tile = 0, block = 0, orb = 0;
		const arc = (TAU * R) / SEG;
		for (const r of this.rings) {
			for (let k = 0; k < SEG; k++) {
				const a = (k / SEG) * TAU - Math.PI / 2;
				p3.set(Math.cos(a) * R, Math.sin(a) * R, r.z);
				q4.setFromAxisAngle(zAxis, a + Math.PI / 2);
				s3.set(arc * 0.92, 0.12, GAP * 0.85);
				m4.compose(p3, q4, s3);
				this.tiles.setMatrixAt(tile, m4);
				const fade = Math.max(0.15, 1 - (-r.z) / 95);
				c3.setHSL(0.64 + 0.16 * Math.sin(r.index * 0.16 + t * 0.8), 0.95, (k % 2 ? 0.14 : 0.24) * fade);
				this.tiles.setColorAt(tile++, c3);
				if (r.blocks.includes(k) && block < MAX_BLOCKS) {
					p3.set(Math.cos(a) * (R - 0.7), Math.sin(a) * (R - 0.7), r.z);
					s3.set(arc * 0.9, 1.3, 0.6);
					m4.compose(p3, q4, s3);
					this.blocks.setMatrixAt(block, m4);
					this.blocks.setColorAt(block++, c3.setHSL(0.95, 0.9, 0.55));
				}
				if (r.orb === k) {
					p3.set(Math.cos(a) * (R - 0.9), Math.sin(a) * (R - 0.9), r.z);
					q4.setFromAxisAngle(zAxis, t * 3);
					s3.set(1, 1, 1);
					m4.compose(p3, q4, s3);
					this.orbs.setMatrixAt(orb++, m4);
				}
			}
		}
		this.tiles.instanceMatrix.needsUpdate = true;
		if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
		this.blocks.count = block;
		this.blocks.instanceMatrix.needsUpdate = true;
		if (this.blocks.instanceColor) this.blocks.instanceColor.needsUpdate = true;
		this.orbs.count = orb;
		this.orbs.instanceMatrix.needsUpdate = true;
		this.ship.rotation.z = Math.sin(t * 6) * 0.05;
	}

	crash() {
		this.crashed = true;
		this.ctx.audio.play('crash');
		this.particles.emit(0, -R + 0.8, 0, { count: 80, colors: [0xf472b6, 0xffffff, 0x22d3ee], speed: 7, size: 0.12, life: 1, gravity: -4 });
		this.ship.visible = false;
		setTimeout(() => { this.ship.visible = true; }, 1800);
		this.finish({ win: false, title: 'Crashed!', message: `You flew ${Math.floor(this.distance)} m and grabbed ${this.orbsTaken} orbs.`, score: this.score });
	}

	render() { this.stage.render(); }

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.hint.remove();
	}
}
