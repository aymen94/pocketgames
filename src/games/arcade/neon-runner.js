// Neon Runner: a 3D endless runner on three lanes, rendered with WAMR3D. The world
// streams toward the camera; obstacles, orbs and arches are pooled and recycled.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette, themed, themeColor } from '../../engine/materials.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const LANES = [-2.2, 0, 2.2];
const FAR = -110;
const JUMP_V = 9.5, GRAVITY = 26;

export default class NeonRunner extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x070a1a, fov: 62, far: 160, fog: { color: 0x070a1a, near: 30, far: 105 } });
		this.hud = h('div.hud-3d', h('span', 'Orbs 0'));
		this.hint = h('div.hint-3d', 'Swipe or use arrows · Up / Space to jump');
		this.ctx.root.append(this.hud, this.hint);
		this.build();
		this.ctx.input.swipe(this.ctx.root, (dir) => this.command(dir), () => this.command('up'));
		this.reset();
	}

	build() {
		const { scene, camera } = this.stage;
		camera.position.set(0, 3.4, 6.5);
		camera.lookAt(0, 1, -8);
		this.stage.hemi.intensity = 0.6;

		const track = this.stage.mesh(geo.box(7.2, 0.2, 240), standard(0x0e1330, { roughness: 0.4, metalness: 0.3 }));
		track.position.set(0, -0.1, -100);
		for (const x of [-3.6, 3.6]) {
			const edge = this.stage.mesh(geo.box(0.12, 0.12, 240), themed('secondary', { basic: true }));
			edge.position.set(x, 0.05, -100);
		}
		this.grid = new THREE.GridHelper(240, 80, 0x3b2a7a, 0x1a1f4a);
		this.grid.position.set(0, -0.6, -100);
		scene.add(this.grid);

		// lane dashes and arches give a sense of speed; both recycle along z
		this.dashes = [];
		for (let i = 0; i < 24; i++) for (const x of [-1.1, 1.1]) {
			const dash = this.stage.mesh(geo.box(0.07, 0.03, 1.6), basic(0x2c3a80));
			dash.position.set(x, 0.02, -i * 5);
			this.dashes.push(dash);
		}
		this.arches = [];
		const archMat = standard(palette.pink, { emissive: palette.pink, emissiveIntensity: 0.9, roughness: 0.3 });
		const archGeometry = this.stage.own(new THREE.TorusGeometry(4.6, 0.08, 6, 48, Math.PI));
		for (let i = 0; i < 6; i++) {
			const arch = this.stage.mesh(archGeometry, archMat);
			arch.position.set(0, 0, -i * 20);
			this.arches.push(arch);
		}

		// the runner: a glowing crystal with an orbiting ring
		this.player = new THREE.Group();
		const core = this.stage.mesh(geo.octa(0.5), themed('primary', { glow: 0.6, roughness: 0.2, metalness: 0.4, flatShading: true }), this.player);
		core.position.y = 0.6;
		core.scale.set(0.8, 1.15, 0.8);
		this.core = core;
		this.ring = this.stage.mesh(geo.torus(0.62, 0.04, 6, 36), basic(palette.mint), this.player);
		this.ring.position.y = 0.6;
		this.ring.rotation.x = Math.PI / 2;
		this.shadow = this.stage.mesh(geo.circle(0.5, 24), basic(0x000000, { transparent: true, opacity: 0.45 }));
		this.shadow.rotation.x = -Math.PI / 2;
		this.shadow.position.y = 0.01;
		scene.add(this.player);
		const glow = new THREE.PointLight(palette.blue, 12, 8);
		glow.position.y = 1;
		this.player.add(glow);
		this.glow = glow;
		this.particles = new Particles(this.stage, { capacity: 500 });
		this.shake = new Shake();
		this.trail = new Trail3D(this.particles, { color: themeColor('primary').getHex(), rate: 45, size: 0.09, life: 0.3 });
		this.onTheme();

		// pools
		this.blockMat = standard(palette.coral, { emissive: palette.coral, emissiveIntensity: 0.35, roughness: 0.35 });
		this.barMat = standard(palette.amber, { emissive: palette.amber, emissiveIntensity: 0.45, roughness: 0.35 });
		this.orbMat = standard(palette.mint, { emissive: palette.mint, emissiveIntensity: 0.9, roughness: 0.2 });
		this.pool = { block: [], bar: [], orb: [] };
		for (let i = 0; i < 18; i++) this.pool.block.push(this.makeItem('block', this.stage.mesh(geo.box(1.7, 2.2, 1.2), this.blockMat)));
		for (let i = 0; i < 8; i++) this.pool.bar.push(this.makeItem('bar', this.stage.mesh(geo.box(1.9, 0.7, 0.5), this.barMat)));
		for (let i = 0; i < 30; i++) this.pool.orb.push(this.makeItem('orb', this.stage.mesh(geo.icosa(0.3, 0), this.orbMat)));
	}

	makeItem(kind, mesh) {
		mesh.visible = false;
		return { kind, mesh, active: false, lane: 0, z: 0 };
	}

	take(kind) {
		const item = this.pool[kind].find((i) => !i.active);
		if (!item) return null;
		item.active = true;
		item.mesh.visible = true;
		return item;
	}

	place(kind, lane, z) {
		const item = this.take(kind);
		if (!item) return;
		item.lane = lane;
		item.z = z;
		const y = kind === 'block' ? 1.1 : kind === 'bar' ? 0.35 : 0.9;
		item.mesh.position.set(LANES[lane], y, z);
	}

	/** Theme changes retint the light, the trail and the speed lines. */
	onTheme() {
		this.glow.color.copy(themeColor('primary'));
		this.trail.color = themeColor('primary').getHex();
	}

	reset() {
		this.running = false;
		this.particles.clear();
		this.fov = 62;
		this.stage.camera.fov = 62;
		this.stage.camera.updateProjectionMatrix();
		for (const list of Object.values(this.pool)) for (const item of list) { item.active = false; item.mesh.visible = false; }
		this.lane = 1;
		this.x = 0;
		this.y = 0;
		this.vy = 0;
		this.speed = 15;
		this.distance = 0;
		this.orbs = 0;
		this.nextRow = 30;
		this.crashed = false;
		this.time = 0;
		this.player.position.set(0, 0, 0);
		this.player.rotation.set(0, 0, 0);
		this.hud.firstChild.textContent = 'Orbs 0';
		this.hint.hidden = false;
		this.ctx.score(0);
		// a few safe orbs to start with
		for (let i = 0; i < 5; i++) this.place('orb', 1, -20 - i * 3);
	}

	start() {
		super.start();
		setTimeout(() => { this.hint.hidden = true; }, 2500);
	}

	command(dir) {
		if (!this.running || this.paused) return;
		if (dir === 'left' && this.lane > 0) { this.lane--; this.ctx.audio.play('move'); }
		else if (dir === 'right' && this.lane < 2) { this.lane++; this.ctx.audio.play('move'); }
		else if ((dir === 'up' || dir === 'action') && this.y <= 0.001) { this.vy = JUMP_V; this.ctx.audio.play('jump'); }
	}

	handleInput({ type, action, repeat }) {
		if (type === 'down' && !repeat && action) this.command(action);
	}

	spawnRow(z) {
		const r = Math.random();
		const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
		if (r < 0.32) {
			this.place('block', lanes[0], z);
			this.orbLine(lanes[1], z);
		} else if (r < 0.6) {
			this.place('block', lanes[0], z);
			this.place('block', lanes[1], z);
			this.orbLine(lanes[2], z);
		} else if (r < 0.8) {
			for (const lane of [0, 1, 2]) this.place('bar', lane, z);
			this.place('orb', lanes[0], z);
		} else {
			this.place('bar', lanes[0], z);
			this.place('block', lanes[1], z);
			this.orbLine(lanes[2], z);
		}
	}

	orbLine(lane, z) {
		for (let i = 0; i < 4; i++) this.place('orb', lane, z + i * 2.5);
	}

	update(dt) {
		this.time += dt;
		this.ring.rotation.z += dt * 3;
		this.core.rotation.y += dt * 2;
		this.particles.update(dt);
		this.shake.update(dt);
		this.stage.camera.position.set(this.x * 0.4 + this.shake.x, 3.4 + this.shake.y, 6.5);
		this.stage.camera.lookAt(this.x * 0.2, 1, -8);
		if (!this.running) return;
		const move = this.speed * dt;
		this.speed = Math.min(15 + this.distance / 60, 42);
		this.distance += move;
		this.ctx.score(Math.floor(this.distance) + this.orbs * 10);

		this.x = damp(this.x, LANES[this.lane], 0.22, dt);
		this.vy -= GRAVITY * dt;
		const airborne = this.y > 0;
		this.y = Math.max(0, this.y + this.vy * dt);
		if (this.y === 0) {
			if (airborne && this.vy < -4) {
				// landing: a ring of dust and a squash
				this.particles.emit(this.x, 0.1, 0, { count: 18, color: themeColor('secondary').getHex(), speed: 3, size: 0.07, life: 0.35, gravity: 0, spread: 0.1 });
				this.squash = 1;
				this.ctx.audio.play('thud');
			}
			this.vy = 0;
		}
		this.squash = Math.max(0, (this.squash ?? 0) - dt * 5);
		this.core.scale.set(0.8 * (1 + this.squash * 0.25), 1.15 * (1 - this.squash * 0.3), 0.8 * (1 + this.squash * 0.25));
		this.trail.update(this.x, this.y + 0.6, 0.4, dt, 0.6 + this.speed / 40);
		// the field of view widens with speed
		const fov = 62 + (this.speed - 15) * 0.4;
		if (Math.abs(fov - this.fov) > 0.15) {
			this.fov = fov;
			this.stage.camera.fov = fov;
			this.stage.camera.updateProjectionMatrix();
		}
		this.player.position.set(this.x, this.y, 0);
		this.player.rotation.z = (LANES[this.lane] - this.x) * -0.25;
		this.shadow.position.x = this.x;
		this.shadow.scale.setScalar(1 - Math.min(this.y / 4, 0.6));


		this.grid.position.z = -100 + (this.distance % 3);
		for (const d of this.dashes) { d.position.z += move; if (d.position.z > 6) d.position.z -= 120; }
		for (const a of this.arches) { a.position.z += move; if (a.position.z > 8) a.position.z -= 120; }

		this.nextRow -= move;
		if (this.nextRow <= 0) {
			this.spawnRow(FAR);
			this.nextRow = Math.max(11, 22 - this.distance / 200) + Math.random() * 6;
		}

		for (const list of Object.values(this.pool)) {
			for (const item of list) {
				if (!item.active) continue;
				item.z += move;
				item.mesh.position.z = item.z;
				if (item.kind === 'orb') item.mesh.rotation.y += dt * 3;
				if (item.z > 8) { item.active = false; item.mesh.visible = false; continue; }
				if (Math.abs(item.z) > 0.8 || Math.abs(LANES[item.lane] - this.x) > 1.2) continue;
				if (item.kind === 'orb') {
					item.active = false;
					item.mesh.visible = false;
					this.orbs++;
					this.hud.firstChild.textContent = `Orbs ${this.orbs}`;
					this.ctx.audio.play('pickup');
					this.particles.emit(LANES[item.lane], item.mesh.position.y, 0.2, { count: 16, colors: [palette.mint, 0xffffff], speed: 3.5, size: 0.08, life: 0.45, gravity: 0 });
				} else if (item.kind === 'block' || this.y < 0.75) {
					return this.crash();
				}
			}
		}
	}

	crash() {
		this.ctx.audio.play('blast');
		this.player.rotation.x = -0.6;
		this.particles.emit(this.x, this.y + 0.7, 0, { count: 70, colors: [palette.coral, themeColor('primary').getHex(), 0xffffff], speed: 9, size: 0.14, life: 0.9, gravity: -8, up: 2 });
		this.shake.kick(0.9);
		const score = Math.floor(this.distance) + this.orbs * 10;
		this.finish({ win: false, title: 'Wipe out!', message: `${Math.floor(this.distance)} m run and ${this.orbs} orbs collected.`, score });
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.hud.remove();
		this.hint.remove();
	}
}
