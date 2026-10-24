// Skyline Stack: drop sliding slabs onto the tower (WAMR3D). Whatever overhangs is sliced
// off and tumbles away; perfect drops ring with sparks and keep the slab whole. The sky
// colour drifts as the tower climbs.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard } from '../../engine/materials.js';
import { Particles, Shake } from '../../engine/effects.js';
import { h } from '../../components/dom.js';

const H = 0.45, START = 3, PERFECT = 0.09;
const colorFor = (n) => new THREE.Color().setHSL(((n * 0.035) % 1 + 1) % 1, 0.65, 0.58).getHex();

export default class SkylineStack extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x1e1b4b, fov: 40, far: 200, fog: { color: 0x1e1b4b, near: 25, far: 70 }, bloom: { strength: 0.5, radius: 0.4, threshold: 0.8 } });
		this.stage.addLights({ sky: 0xffffff, ground: 0x312e81, intensity: 1.1, sunIntensity: 1.8, sunPosition: [5, 12, 3] });
		this.callout = h('div');
		this.hint = h('div.hint-3d', 'Tap or press Space to drop the slab');
		this.ctx.root.append(this.callout, this.hint);
		this.group = new THREE.Group();
		this.stage.scene.add(this.group);
		this.particles = new Particles(this.stage, { capacity: 300 });
		this.shake = new Shake();
		this.sky = new THREE.Color();
		this.ctx.input.on(this.ctx.root, 'pointerdown', () => this.drop());
		this.reset();
	}

	clearTower() {
		const objects = [];
		this.group.traverse((o) => { if (o !== this.group) objects.push(o); });
		for (let i = objects.length - 1; i >= 0; i--) objects[i].dispose();
	}

	slab(x, y, z, w, d, color) {
		const mesh = this.stage.mesh(geo.box(1, 1, 1), standard(color, { roughness: 0.45, metalness: 0.1 }), this.group);
		mesh.scale.set(w, H, d);
		mesh.position.set(x, y, z);
		return mesh;
	}

	reset() {
		this.running = false;
		this.clearTower();
		this.particles.clear();
		this.debris = [];
		this.level = 0;
		this.combo = 0;
		this.top = { x: 0, z: 0, w: START, d: START };
		// a tall plinth to stand the tower on
		const base = this.slab(0, -2.5, 0, START, START, 0x312e81);
		base.scale.y = 5;
		this.slab(0, H / 2, 0, START, START, colorFor(0));
		this.camY = 4;
		this.spawn();
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	spawn() {
		this.level++;
		this.axis = this.level % 2 ? 'x' : 'z';
		const t = this.top;
		this.moving = { mesh: this.slab(t.x, H / 2 + this.level * H, t.z, t.w, t.d, colorFor(this.level)), offset: -4.5, dir: 1, speed: Math.min(3.2 + this.level * 0.08, 7) };
		this.place();
	}

	place() {
		const m = this.moving, t = this.top;
		m.mesh.position.x = this.axis === 'x' ? t.x + m.offset : t.x;
		m.mesh.position.z = this.axis === 'z' ? t.z + m.offset : t.z;
	}

	handleInput({ type, action, repeat }) {
		if (type === 'down' && !repeat && (action === 'action' || action === 'down')) this.drop();
	}

	drop() {
		if (!this.running || this.paused || !this.moving) return;
		this.hint.hidden = true;
		const m = this.moving, t = this.top;
		const size = this.axis === 'x' ? t.w : t.d;
		let delta = m.offset;
		const y = H / 2 + this.level * H;
		const color = colorFor(this.level);
		if (Math.abs(delta) >= size) {
			// missed completely: the slab falls with the debris
			this.debris.push({ mesh: m.mesh, vy: 0, spin: (Math.random() - 0.5) * 2, vx: this.axis === 'x' ? Math.sign(delta) * 1.5 : 0, vz: this.axis === 'z' ? Math.sign(delta) * 1.5 : 0 });
			this.moving = null;
			this.shake.kick(0.6);
			this.ctx.audio.play('thud');
			return this.finish({ win: false, title: 'Tower topped out', message: `You stacked ${this.level - 1} ${this.level - 1 === 1 ? 'slab' : 'slabs'}.`, score: this.level - 1 });
		}
		if (Math.abs(delta) < PERFECT) {
			delta = 0;
			this.combo++;
			// a run of perfect drops widens the slab a little
			if (this.combo >= 4) {
				if (this.axis === 'x') t.w = Math.min(START, t.w + 0.15); else t.d = Math.min(START, t.d + 0.15);
			}
			m.mesh.scale.set(t.w, H, t.d);
			m.mesh.position.set(t.x, y, t.z);
			this.ctx.audio.play('stack', 10 + this.combo);
			for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
				this.particles.emit(t.x + (cx * t.w) / 2, y, t.z + (cz * t.d) / 2, { count: 6, color: 0xffffff, speed: 2.5, size: 0.08, life: 0.6, gravity: 2 });
			}
			this.pop(this.combo > 1 ? `Perfect ×${this.combo}` : 'Perfect!');
			if (this.combo >= 3) this.shake.kick(0.15);
		} else {
			this.combo = 0;
			const keep = size - Math.abs(delta);
			const cut = Math.abs(delta);
			const sign = Math.sign(delta);
			if (this.axis === 'x') {
				const centre = t.x + delta / 2;
				m.mesh.scale.set(keep, H, t.d);
				m.mesh.position.set(centre, y, t.z);
				const piece = this.slab(centre + sign * (keep / 2 + cut / 2), y, t.z, cut, t.d, color);
				this.debris.push({ mesh: piece, vy: 0, vx: sign * 1.2, vz: 0, spin: sign * -1.5, axis: 'z' });
				t.x = centre; t.w = keep;
			} else {
				const centre = t.z + delta / 2;
				m.mesh.scale.set(t.w, H, keep);
				m.mesh.position.set(t.x, y, centre);
				const piece = this.slab(t.x, y, centre + sign * (keep / 2 + cut / 2), t.w, cut, color);
				this.debris.push({ mesh: piece, vy: 0, vx: 0, vz: sign * 1.2, spin: sign * 1.5, axis: 'x' });
				t.z = centre; t.d = keep;
			}
			this.ctx.audio.play('stack', Math.max(0, this.level % 12));
		}
		this.particles.emit(t.x, y - H / 2, t.z, { count: 10, color, speed: 1.6, size: 0.07, life: 0.5, gravity: -3, spread: 0.2 });
		this.ctx.score(this.level);
		if (this.level % 10 === 0) {
			this.ctx.audio.play('levelup');
			this.ctx.fx.confetti({ count: 60 });
			this.ctx.fx.banner(`${this.level} floors!`);
		}
		this.spawn();
	}

	pop(text) { this.callout.replaceChildren(h('div.big-callout', text)); }

	update(dt) {
		this.particles.update(dt);
		this.shake.update(dt);
		for (const d of this.debris) {
			d.vy -= 14 * dt;
			d.mesh.position.x += d.vx * dt;
			d.mesh.position.z += d.vz * dt;
			d.mesh.position.y += d.vy * dt;
			if (d.axis === 'x') d.mesh.rotation.x += d.spin * dt; else d.mesh.rotation.z += d.spin * dt;
		}
		for (const d of this.debris) if (d.mesh.position.y < this.camY - 30) { d.mesh.dispose(); d.gone = true; }
		this.debris = this.debris.filter((d) => !d.gone);

		const targetY = this.level * H + 3.2;
		this.camY = damp(this.camY, targetY, 0.06, dt);
		const cam = this.stage.camera;
		cam.position.set(9 + this.shake.x, this.camY + 6 + this.shake.y, 9);
		cam.lookAt(0, this.camY - 2.2, 0);
		this.sky.setHSL(((0.68 + this.level * 0.012) % 1), 0.55, Math.max(0.08, 0.2 - this.level * 0.0015));
		this.stage.scene.background.copy(this.sky);
		this.stage.scene.fog.color.copy(this.sky);

		if (!this.running || !this.moving) return;
		const m = this.moving;
		m.offset += m.dir * m.speed * dt;
		if (m.offset > 5.5) { m.offset = 5.5; m.dir = -1; }
		if (m.offset < -5.5) { m.offset = -5.5; m.dir = 1; }
		this.place();
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		this.callout.remove();
		this.hint.remove();
	}
}
