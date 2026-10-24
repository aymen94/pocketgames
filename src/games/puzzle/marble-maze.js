// Marble Maze: tilt a wooden labyrinth in 3D (WAMR3D) to roll a glossy marble past the
// holes to the glowing goal. Rolling physics run in the board's plane; the board, marble
// and lights are real 3D objects that tilt with your input.

import { Game } from '../core/game.js';
import { THREE } from '../../engine/wamr3d.js';
import { Stage3D, damp } from '../../engine/stage.js';
import { geo, standard, basic, palette } from '../../engine/materials.js';
import { Particles, Shake, Trail3D } from '../../engine/effects.js';
import { ease } from '../core/fx.js';
import { circleRect, clamp } from '../core/physics.js';
import { h } from '../../components/dom.js';
import { formatTime } from '../core/timer.js';

const R = 0.3, TILT = 0.2, G = 22, HOLE = 0.36;
// # wall, . floor, O hole, S start, G goal, * gem (every level checked to be solvable)
const LEVELS = [
	['#########', '#S..*...#', '#######.#', '#...*...#', '#.#######', '#.....*.#', '#######.#', '#G......#', '#########'],
	['###########', '#S..O..*..#', '#.###.###.#', '#...O.#.O.#', '###.#.#.###', '#*..#.....#', '#.O.###.#.#', '#.......#G#', '###########'],
	['###########', '#S.O...O.*#', '#..#.O.#..#', '#O...#...O#', '#..O.*.O..#', '#.#.O...#.#', '#*..O.O...#', '#O..#G#..O#', '###########'],
	['#############', '#S#........*#', '#.#.#.###.#.#', '#...#.O..O#.#', '#####.#.###.#', '#O*...#...O.#', '#.#####.#.#.#', '#...O...#..G#', '#############'],
];

export default class MarbleMaze extends Game {
	static realtime = true;

	async init() {
		this.stage = await Stage3D.create(this.ctx.root, { background: 0x0f172a, fov: 45, far: 120, bloom: { strength: 0.55, radius: 0.4, threshold: 0.8 }, shadows: { extent: 7 } });
		this.stage.addLights({ sky: 0xfef3c7, ground: 0x1e293b, intensity: 1.0, sunIntensity: 2.0, sunPosition: [-4, 12, 6] });
		this.hud = h('div.hud-3d', h('span'), h('span'));
		this.callout = h('div');
		this.hint = h('div.hint-3d', 'Arrow keys or drag to tilt the board');
		this.ctx.root.append(this.hud, this.callout, this.hint);
		this.board = new THREE.Group();
		this.stage.scene.add(this.board);
		const lamp = new THREE.PointLight(0xffffff, 30, 30);
		lamp.position.set(3, 8, 6);
		this.stage.scene.add(lamp);
		this.particles = new Particles(this.stage, { capacity: 400 });
		this.trail = new Trail3D(this.particles, { color: 0x93c5fd, rate: 30, size: 0.05, life: 0.4 });
		this.shake = new Shake();
		this.intro = 0;
		const root = this.ctx.root;
		root.style.touchAction = 'none';
		this.ctx.input.on(root, 'pointerdown', (e) => { this.drag = { x: e.clientX, y: e.clientY }; this.dragTilt = { x: 0, z: 0 }; });
		this.ctx.input.on(root, 'pointermove', (e) => {
			if (!this.drag) return;
			const rect = root.getBoundingClientRect();
			this.dragTilt = { x: clamp((e.clientX - this.drag.x) / (rect.width * 0.25), -1, 1), z: clamp((e.clientY - this.drag.y) / (rect.height * 0.25), -1, 1) };
		});
		this.ctx.input.on(window, 'pointerup', () => { this.drag = null; this.dragTilt = null; });
		this.reset();
	}

	reset() {
		this.running = false;
		this.levelIndex = 0;
		this.lives = 5;
		this.gems = 0;
		this.time = 0;
		this.load();
		this.ctx.score(0);
		this.hint.hidden = false;
	}

	clearBoard() {
		const objects = [];
		this.board.traverse((o) => { if (o !== this.board) objects.push(o); });
		for (let i = objects.length - 1; i >= 0; i--) objects[i].dispose();
	}

	load() {
		this.clearBoard();
		this.particles.clear();
		const grid = LEVELS[this.levelIndex];
		const rows = grid.length, cols = grid[0].length;
		this.ox = -cols / 2 + 0.5;
		this.oz = -rows / 2 + 0.5;
		const s = this.stage, b = this.board;
		const floor = s.mesh(geo.box(1, 1, 1), standard(0xd9a066, { roughness: 0.6 }), b);
		floor.scale.set(cols, 0.3, rows);
		floor.position.y = -0.15;
		const frame = s.mesh(geo.box(1, 1, 1), standard(0x7c4a24, { roughness: 0.7 }), b);
		frame.scale.set(cols + 0.6, 0.5, rows + 0.6);
		frame.position.y = -0.45;
		const wallMat = standard(0x9a5b2b, { roughness: 0.55 });
		this.walls = [];
		this.holes = [];
		this.gemList = [];
		for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
			const ch = grid[r][c];
			const x = c + this.ox, z = r + this.oz;
			if (ch === '#') {
				const wall = s.mesh(geo.box(1, 0.5, 1), wallMat, b);
				wall.position.set(x, 0.25, z);
				this.walls.push({ x: x - 0.5, y: z - 0.5, w: 1, h: 1 });
			} else if (ch === 'O') {
				const hole = s.mesh(geo.circle(0.42, 28), basic(0x020617), b);
				hole.rotation.x = -Math.PI / 2;
				hole.position.set(x, 0.005, z);
				const rim = s.mesh(geo.ring(0.42, 0.48, 28), standard(0x5b3a1a), b);
				rim.rotation.x = -Math.PI / 2;
				rim.position.set(x, 0.006, z);
				this.holes.push({ x, z });
			} else if (ch === 'S') this.startPos = { x, z };
			else if (ch === 'G') {
				this.goal = { x, z };
				this.goalRing = s.mesh(geo.torus(0.36, 0.06, 10, 32), standard(palette.mint, { emissive: palette.mint, emissiveIntensity: 1.4 }), b);
				this.goalRing.rotation.x = Math.PI / 2;
				this.goalRing.position.set(x, 0.08, z);
				const pad = s.mesh(geo.circle(0.36, 28), basic(0x065f46), b);
				pad.rotation.x = -Math.PI / 2;
				pad.position.set(x, 0.004, z);
			} else if (ch === '*') {
				const gem = s.mesh(geo.octa(0.18), standard(palette.amber, { emissive: palette.amber, emissiveIntensity: 0.9, metalness: 0.3, roughness: 0.2 }), b);
				gem.position.set(x, 0.35, z);
				this.gemList.push({ x, z, mesh: gem, taken: false });
			}
		}
		this.marble = s.mesh(geo.sphere(R, 32, 20), standard(0x60a5fa, { roughness: 0.08, metalness: 0.55 }), b);
		this.spawn();
		this.tilt = { x: 0, z: 0 };
		const span = Math.max(cols, rows);
		this.stage.camera.position.set(0, span * 1.25, span * 0.62);
		this.stage.camera.lookAt(0, 0, 0.3);
		this.banner(`Level ${this.levelIndex + 1}`);
		this.intro = 1;
		this.camBase = this.stage.camera.position.clone();
		this.paintHud();
	}

	spawn() {
		this.ball = { x: this.startPos.x, z: this.startPos.z, vx: 0, vz: 0, falling: 0 };
		this.marble.position.set(this.ball.x, R, this.ball.z);
	}

	banner(text) { this.callout.replaceChildren(h('div.big-callout', text)); }

	paintHud() {
		this.hud.children[0].textContent = `Level ${this.levelIndex + 1}/${LEVELS.length} · ${'●'.repeat(this.lives)}`;
		this.hud.children[1].textContent = `Gems ${this.gems} · ${formatTime(this.time)}`;
	}

	update(dt) {
		this.particles.update(dt);
		if (this.goalRing) {
			this.goalRing.rotation.z += dt * 2;
			this.goalRing.position.y = 0.1 + Math.sin(performance.now() / 300) * 0.04;
		}
		for (const g of this.gemList) if (!g.taken) g.mesh.rotation.y += dt * 2.5;
		if (this.running && Math.random() < dt * 8 && this.goal) {
			this.particles.emit(this.goal.x, 0.2, this.goal.z, { count: 2, color: palette.mint, speed: 0.6, size: 0.06, life: 1, gravity: 1.5, up: 1 });
		}

		// tilt follows the keys or the drag, smoothly
		const axis = this.ctx.input.axis();
		const want = this.dragTilt ?? { x: axis.x, z: axis.y };
		this.tilt.x = damp(this.tilt.x, want.x * TILT, 0.12, dt);
		this.tilt.z = damp(this.tilt.z, want.z * TILT, 0.12, dt);
		this.board.rotation.z = -this.tilt.x;
		this.board.rotation.x = this.tilt.z;
		// a new board swings in and settles
		if (this.intro > 0) {
			this.intro = Math.max(0, this.intro - dt * 1.4);
			const k = ease.outBack(1 - this.intro);
			this.board.rotation.y = (1 - k) * Math.PI * 0.6;
			this.board.scale.setScalar(0.6 + 0.4 * Math.min(1, k));
		}
		this.shake.update(dt);
		if (this.camBase) this.stage.camera.position.set(this.camBase.x + this.shake.x, this.camBase.y + this.shake.y, this.camBase.z);
		if (!this.running) return;
		if (axis.x || axis.y || this.dragTilt) this.hint.hidden = true;
		this.time += dt;
		this.paintHud();

		const b = this.ball;
		if (b.falling) {
			b.falling += dt;
			this.marble.position.y = R - b.falling * b.falling * 6;
			this.marble.scale.setScalar(Math.max(0.2, 1 - b.falling));
			if (b.falling > 0.7) {
				this.marble.scale.setScalar(1);
				this.lives--;
				this.paintHud();
				if (this.lives <= 0) return this.finish({ win: false, title: 'Out of marbles', message: `You reached level ${this.levelIndex + 1}.`, record: false });
				this.spawn();
			}
			return;
		}
		const steps = 4, h = dt / steps;
		for (let s = 0; s < steps; s++) {
			b.vx += Math.sin(this.tilt.x) * G * h;
			b.vz += Math.sin(this.tilt.z) * G * h;
			b.vx *= 1 - 0.6 * h;
			b.vz *= 1 - 0.6 * h;
			b.x += b.vx * h;
			b.z += b.vz * h;
			for (const w of this.walls) {
				const hit = circleRect(b.x, b.z, R, w);
				if (!hit) continue;
				b.x += hit.nx * hit.depth;
				b.z += hit.ny * hit.depth;
				const dot = b.vx * hit.nx + b.vz * hit.ny;
				if (dot < 0) {
					if (dot < -2.5) { this.ctx.audio.play('thud'); this.particles.emit(b.x - hit.nx * R, 0.2, b.z - hit.ny * R, { count: 5, color: 0xfde68a, speed: 1.5, size: 0.05, life: 0.3, gravity: -4 }); }
					b.vx -= 1.45 * dot * hit.nx;
					b.vz -= 1.45 * dot * hit.ny;
				}
			}
		}
		this.marble.position.set(b.x, R, b.z);
		this.trail.update(b.x, 0.1, b.z, dt, Math.min(1.5, Math.hypot(b.vx, b.vz) / 3));
		this.marble.rotation.z -= (b.vx * dt) / R;
		this.marble.rotation.x += (b.vz * dt) / R;

		for (const hole of this.holes) {
			if (Math.hypot(b.x - hole.x, b.z - hole.z) < HOLE) {
				b.falling = 0.0001;
				b.x = hole.x; b.z = hole.z;
				this.marble.position.set(b.x, R, b.z);
				this.ctx.audio.play('lifelost');
				this.banner('Oops!');
				this.shake.kick(0.25);
				this.particles.emit(hole.x, 0.2, hole.z, { count: 24, colors: [0x93c5fd, 0xffffff], speed: 2.2, size: 0.06, life: 0.5, gravity: -6, up: 1.5 });
				return;
			}
		}
		for (const g of this.gemList) {
			if (!g.taken && Math.hypot(b.x - g.x, b.z - g.z) < 0.45) {
				g.taken = true;
				g.mesh.visible = false;
				this.gems++;
				this.ctx.score(this.gems);
				this.ctx.audio.play('coin');
				this.particles.emit(g.x, 0.35, g.z, { count: 20, color: palette.amber, speed: 2.5, size: 0.07, life: 0.6, gravity: -2 });
			}
		}
		if (Math.hypot(b.x - this.goal.x, b.z - this.goal.z) < 0.35) {
			this.ctx.audio.play('levelup');
			this.particles.emit(this.goal.x, 0.3, this.goal.z, { count: 80, color: palette.mint, speed: 4, size: 0.1, life: 1, gravity: -3, up: 2 });
			this.levelIndex++;
			if (this.levelIndex >= LEVELS.length) {
				this.levelIndex = LEVELS.length - 1;
				return this.finish({ win: true, title: 'Maze master!', message: `All ${LEVELS.length} boards in ${formatTime(this.time)} with ${this.gems} gems.`, score: this.gems });
			}
			this.load();
		}
	}

	render() {
		this.stage.render();
	}

	dispose() {
		this.stage.dispose();
		for (const el of [this.hud, this.callout, this.hint]) el.remove();
	}
}
