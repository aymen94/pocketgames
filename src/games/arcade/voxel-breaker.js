// Voxel Breaker: brick breaking on a 3D field (WAMR3D). Every voxel in the wall is one
// instance of a single InstancedMesh, so hundreds of coloured blocks are one draw call;
// each hit knocks the top voxel off a column in a burst of debris.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette, themed } from '../../engine/materials.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { circleRect, reflect, clamp } from '../core/physics.js';
import { h } from '../../components/dom.js';

const COLS = 11, ROWS = 7, MAX_H = 3, CELL = 0.9, FIELD_W = 11, FIELD_D = 15, R = 0.22, PADDLE_Z = 6.2;
const matrix = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3(), col = new THREE.Color();
const HUES = [0.95, 0.05, 0.12, 0.3, 0.5, 0.62, 0.75];

export default class VoxelBreaker extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x070b1d, fov: 50, far: 120, fog: { color: 0x070b1d, near: 22, far: 45 }, bloom: { strength: 0.6, radius: 0.4, threshold: 0.8 } });
		this.stage.addLights({ sky: 0xc7d2fe, ground: 0x111133, intensity: 0.9, sunIntensity: 1.6, sunPosition: [-4, 10, 8] });
		this.hud = h('div.hud-3d', h('span'));
		this.hint = h('div.hint-3d', 'Move with the mouse, a finger or arrows · tap / Space to launch');
		this.callout = h('div');
		this.ctx.root.append(this.hud, this.hint, this.callout);
		this.build();
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		const follow = (e) => { const p = this.stage.pointOnGround(e, 0); if (p) this.pointerX = p.x; };
		this.ctx.input.on(root, 'pointermove', follow);
		this.ctx.input.on(root, 'pointerdown', (e) => { follow(e); this.launch(); });
		this.reset();
	}

	build() {
		const s = this.stage;
		s.camera.position.set(0, 11, 13.5);
		s.camera.lookAt(0, 0, -0.5);
		const floor = s.mesh(geo.box(FIELD_W + 0.4, 0.2, FIELD_D + 0.4), standard(0x0f172a, { roughness: 0.35, metalness: 0.4 }));
		floor.position.y = -0.1;
		const grid = new THREE.GridHelper(FIELD_D, 15, 0x312e81, 0x1e1b4b);
		grid.position.y = 0.01;
		grid.scale.x = FIELD_W / FIELD_D;
		s.scene.add(grid);
		for (const x of [-1, 1]) {
			const wall = s.mesh(geo.box(0.25, 0.5, FIELD_D + 0.4), themed('secondary', { glow: 1 }));
			wall.position.set(x * (FIELD_W / 2 + 0.12), 0.25, 0);
		}
		const back = s.mesh(geo.box(FIELD_W + 0.5, 0.5, 0.25), themed('secondary', { glow: 1 }));
		back.position.set(0, 0.25, -FIELD_D / 2 - 0.12);

		// the whole voxel wall: one instanced mesh
		this.voxels = new THREE.InstancedMesh(geo.box(CELL * 0.94, 0.5, CELL * 0.94), s.own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 })), COLS * ROWS * MAX_H);
		this.voxels.frustumCulled = false;
		s.scene.add(this.voxels);

		this.paddle = s.mesh(geo.capsule(0.28, 1.8), themed('primary', { glow: 0.9, roughness: 0.3 }));
		this.paddle.rotation.z = Math.PI / 2;
		this.ballMesh = s.mesh(geo.sphere(R, 24, 16), standard(0xffffff, { emissive: 0xfff7cc, emissiveIntensity: 1, roughness: 0.2 }));
		this.ballLight = new THREE.PointLight(0xfff1c1, 4, 5);
		s.scene.add(this.ballLight);
		this.particles = new Particles(s, { capacity: 700, geometry: geo.box(1, 1, 1), additive: false });
		this.sparks = new Particles(s, { capacity: 300 });
		this.shake = new Shake();
	}

	reset() {
		this.running = false;
		this.level = 0;
		this.score = 0;
		this.lives = 3;
		this.paddleX = 0;
		this.pointerX = null;
		this.buildLevel();
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	buildLevel() {
		// column heights follow a different pattern each level
		const patterns = [
			(r) => (r < 2 ? 2 : 1),
			(r, c) => 1 + ((r + c) % 3 === 0 ? 2 : (r + c) % 2),
			(r, c) => Math.max(1, 3 - Math.abs(c - 5) / 2 - r / 3) | 0,
			(r, c) => (c % 2 === r % 2 ? 3 : 1),
		];
		const pattern = patterns[this.level % patterns.length];
		this.cells = [];
		for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
			const height = clamp(Math.round(pattern(r, c)) + Math.floor(this.level / patterns.length), 1, MAX_H);
			this.cells.push({ r, c, height, x: (c - (COLS - 1) / 2) * CELL, z: -FIELD_D / 2 + 1.2 + r * CELL, hue: HUES[r % HUES.length] });
		}
		this.particles.clear();
		this.paintVoxels();
		this.resetBall();
		this.paintHud();
	}

	paintVoxels() {
		let i = 0;
		for (const cell of this.cells) {
			for (let k = 0; k < cell.height; k++) {
				pos.set(cell.x, 0.25 + k * 0.5, cell.z);
				quat.identity();
				scl.set(1, 1, 1);
				matrix.compose(pos, quat, scl);
				this.voxels.setMatrixAt(i, matrix);
				this.voxels.setColorAt(i, col.setHSL(cell.hue, 0.75, 0.42 + k * 0.1));
				i++;
			}
		}
		this.voxels.count = i;
		this.voxels.instanceMatrix.needsUpdate = true;
		if (this.voxels.instanceColor) this.voxels.instanceColor.needsUpdate = true;
	}

	resetBall() {
		this.ball = { x: this.paddleX, z: PADDLE_Z - 0.6, vx: 0, vz: 0, stuck: true };
	}

	paintHud() {
		this.hud.firstChild.textContent = `Level ${this.level + 1} · ${'♥'.repeat(Math.max(0, this.lives))}`;
	}

	launch() {
		if (!this.running || this.paused || !this.ball.stuck) return;
		this.ball.stuck = false;
		const speed = 9 + this.level * 0.6;
		const a = (Math.random() - 0.5) * 0.6;
		this.ball.vx = Math.sin(a) * speed;
		this.ball.vz = -Math.cos(a) * speed;
		this.hint.hidden = true;
		this.ctx.audio.play('boost');
	}

	handleInput({ type, action }) {
		if (type === 'down' && (action === 'action' || action === 'up')) this.launch();
	}

	update(dt) {
		this.particles.update(dt);
		this.sparks.update(dt);
		this.shake.update(dt);
		const cam = this.stage.camera;
		cam.position.set(this.paddleX * 0.15 + this.shake.x, 11 + this.shake.y, 13.5);
		cam.lookAt(this.paddleX * 0.1, 0, -0.5);
		if (this.running) {
			const axis = this.ctx.input.axis().x;
			if (axis) { this.pointerX = null; this.paddleX += axis * 12 * dt; }
			else if (this.pointerX !== null) this.paddleX = damp(this.paddleX, this.pointerX, 0.3, dt);
			this.paddleX = clamp(this.paddleX, -FIELD_W / 2 + 1.2, FIELD_W / 2 - 1.2);
			this.step(dt);
		}
		this.paddle.position.set(this.paddleX, 0.3, PADDLE_Z);
		const b = this.ball;
		if (b.stuck) { b.x = this.paddleX; b.z = PADDLE_Z - 0.6; }
		this.ballMesh.position.set(b.x, R + 0.05, b.z);
		if (!b.stuck) { this.trail ??= new Trail3D(this.sparks, { color: 0xfff1c1, rate: 60, size: 0.07, life: 0.25 }); this.trail.update(b.x, R + 0.05, b.z, dt); }
		this.ballLight.position.set(b.x, 1, b.z);
	}

	step(dt) {
		const b = this.ball;
		if (b.stuck) return;
		const steps = 5, h = dt / steps;
		for (let s = 0; s < steps; s++) {
			b.x += b.vx * h; b.z += b.vz * h;
			if (Math.abs(b.x) > FIELD_W / 2 - R) { b.x = Math.sign(b.x) * (FIELD_W / 2 - R); b.vx = -b.vx; this.ctx.audio.play('blip'); }
			if (b.z < -FIELD_D / 2 + R) { b.z = -FIELD_D / 2 + R; b.vz = Math.abs(b.vz); this.ctx.audio.play('blip'); }
			// paddle: a capsule along x
			if (b.vz > 0 && Math.abs(b.z - PADDLE_Z) < R + 0.28 && Math.abs(b.x - this.paddleX) < 1.2) {
				const offset = clamp((b.x - this.paddleX) / 1.2, -1, 1);
				const speed = Math.min(Math.hypot(b.vx, b.vz) * 1.01, 15);
				b.vx = Math.sin(offset * 1.0) * speed;
				b.vz = -Math.cos(offset * 1.0) * speed;
				b.z = PADDLE_Z - R - 0.28;
				this.ctx.audio.play('bounce');
				this.sparks.emit(b.x, 0.3, b.z, { count: 10, color: palette.blue, speed: 3, size: 0.06, life: 0.3, gravity: -4 });
			}
			for (const cell of this.cells) {
				if (cell.height <= 0) continue;
				const hit = circleRect(b.x, b.z, R, { x: cell.x - CELL / 2, y: cell.z - CELL / 2, w: CELL, h: CELL });
				if (!hit) continue;
				b.x += hit.nx * hit.depth; b.z += hit.ny * hit.depth;
				const body = { vx: b.vx, vy: b.vz };
				reflect(body, hit.nx, hit.ny);
				b.vx = body.vx; b.vz = body.vy;
				this.knock(cell);
				break;
			}
		}
		if (b.z > FIELD_D / 2 + 1) {
			this.lives--;
			this.shake.kick(0.7);
			this.ctx.audio.play('lose');
			this.paintHud();
			if (this.lives <= 0) return this.finish({ win: false, message: `You reached level ${this.level + 1}.`, score: this.score });
			this.resetBall();
		}
	}

	knock(cell) {
		const top = 0.25 + (cell.height - 1) * 0.5;
		cell.height--;
		this.score += 10;
		this.ctx.score(this.score);
		this.particles.emit(cell.x, top, cell.z, { count: 16, color: new THREE.Color().setHSL(cell.hue, 0.75, 0.5).getHex(), speed: 5, size: 0.12, life: 0.9, gravity: -14, up: 3 });
		this.sparks.emit(cell.x, top, cell.z, { count: 8, color: 0xfff1c1, speed: 4, size: 0.07, life: 0.25, gravity: 0 });
		this.shake.kick(0.18);
		this.ctx.audio.play(cell.height ? 'hit' : 'shatter');
		this.paintVoxels();
		if (this.cells.every((c) => c.height <= 0)) {
			this.level++;
			this.score += 250;
			this.ctx.score(this.score);
			this.ctx.audio.play('levelup');
			this.callout.replaceChildren(h('div.big-callout', `Level ${this.level + 1}`));
			this.buildLevel();
		}
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		for (const el of [this.hud, this.hint, this.callout]) el.remove();
	}
}
