// The dashboard hero: a floating arcade of game objects (balls, dice, cards, a pin, a
// pawn, a toy car) drifting over a neon grid, rendered with WAMR3D. It follows the
// pointer a little and only animates while visible and while no game is open.

import { THREE } from '../engine/wamr3d.js';

export { backendName, backendLabel } from '../engine/wamr3d.js';
import { Stage3D, damp } from '../engine/stage.js';
import { Loop } from '../engine/loop.js';
import { geo, standard, basic, palette, themed } from '../engine/materials.js';
import { theme, themeColors } from '../services/theme.js';
import { reducedMotion } from '../games/core/fx.js';

function lathe(stage, profile, segments = 24) {
	const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
	return stage.own(new THREE.LatheGeometry(points, segments));
}

function makePin(stage) {
	const group = new THREE.Group();
	const body = lathe(stage, [[0, 0], [0.22, 0.02], [0.3, 0.35], [0.24, 0.75], [0.12, 1.0], [0.11, 1.12], [0.17, 1.32], [0.12, 1.5], [0, 1.54]]);
	stage.mesh(body, standard(palette.white, { roughness: 0.3 }), group);
	const stripe = stage.mesh(geo.cylinder(0.122, 0.122, 0.07, 24), standard(palette.coral), group);
	stripe.position.y = 1.08;
	return group;
}

function makePawn(stage) {
	const group = new THREE.Group();
	const body = lathe(stage, [[0, 0], [0.42, 0], [0.42, 0.1], [0.3, 0.2], [0.18, 0.55], [0.14, 0.8], [0.24, 0.86], [0.12, 0.92], [0, 0.92]]);
	stage.mesh(body, standard(palette.violet, { roughness: 0.25, metalness: 0.3 }), group);
	const head = stage.mesh(geo.sphere(0.22), standard(palette.violet, { roughness: 0.25, metalness: 0.3 }), group);
	head.position.y = 1.08;
	return group;
}

function makeDie(stage) {
	const group = new THREE.Group();
	stage.mesh(geo.box(1, 1, 1), standard(palette.white, { roughness: 0.35 }), group);
	const pip = standard(0x111833);
	const faces = [
		[[0, 0]],
		[[-0.22, -0.22], [0.22, 0.22]],
		[[-0.22, -0.22], [0, 0], [0.22, 0.22]],
	];
	// three visible faces: +z shows one pip, +x two, +y three
	const place = (points, apply) => points.forEach(([a, b]) => {
		const dot = stage.mesh(geo.sphere(0.09, 12, 8), pip, group);
		apply(dot, a, b);
		dot.scale.set(1, 1, 0.35);
	});
	place(faces[0], (d, a, b) => d.position.set(a, b, 0.5));
	place(faces[1], (d, a, b) => { d.position.set(0.5, a, b); d.rotation.y = Math.PI / 2; });
	place(faces[2], (d, a, b) => { d.position.set(a, 0.5, b); d.rotation.x = Math.PI / 2; });
	return group;
}

function makeCard(stage, color) {
	const group = new THREE.Group();
	stage.mesh(geo.box(0.9, 1.26, 0.03), standard(palette.white, { roughness: 0.4 }), group);
	const back = stage.mesh(geo.box(0.8, 1.16, 0.01), standard(color, { roughness: 0.5 }), group);
	back.position.z = -0.02;
	const suit = stage.mesh(geo.octa(0.2), standard(palette.coral, { roughness: 0.3 }), group);
	suit.position.z = 0.03;
	suit.scale.set(1, 1.3, 0.15);
	return group;
}

function makeCar(stage) {
	const group = new THREE.Group();
	const paint = standard(palette.amber, { roughness: 0.25, metalness: 0.35 });
	const body = stage.mesh(geo.box(1.6, 0.36, 0.8), paint, group);
	body.position.y = 0.3;
	const cabin = stage.mesh(geo.box(0.8, 0.3, 0.7), standard(0x1e293b, { roughness: 0.15, metalness: 0.5 }), group);
	cabin.position.set(-0.1, 0.62, 0);
	const tyre = standard(0x111111, { roughness: 0.8 });
	for (const [x, z] of [[-0.5, 0.42], [0.5, 0.42], [-0.5, -0.42], [0.5, -0.42]]) {
		const wheel = stage.mesh(geo.cylinder(0.2, 0.2, 0.14, 18), tyre, group);
		wheel.position.set(x, 0.2, z);
		wheel.rotation.x = Math.PI / 2;
	}
	return group;
}

function makeBasketball(stage) {
	const group = new THREE.Group();
	stage.mesh(geo.sphere(0.6, 32, 20), standard(0xf97316, { roughness: 0.7 }), group);
	const seam = standard(0x3b1606, { roughness: 0.9 });
	const ring = stage.mesh(geo.torus(0.6, 0.018, 6, 48), seam, group);
	ring.rotation.x = Math.PI / 2;
	stage.mesh(geo.torus(0.6, 0.018, 6, 48), seam, group);
	const side = stage.mesh(geo.torus(0.6, 0.018, 6, 48), seam, group);
	side.rotation.y = Math.PI / 2;
	return group;
}

export class Hero {
	static async create(container) {
		const stage = await Stage3D.create(container, { background: palette.night, fov: 42, fog: { color: palette.night, near: 14, far: 34 } });
		return new Hero(stage, container);
	}

	constructor(stage, container) {
		this.stage = stage;
		this.container = container;
		this.pointer = { x: 0, y: 0 };
		this.look = { x: 0, y: 0 };
		this.items = [];
		this.visible = true;
		this.build();
		this.applyTheme(themeColors());
		this.offTheme = theme.subscribe((colors) => { this.applyTheme(colors); if (!this.loop.running) this.stage.render(); });
		this.loop = new Loop((dt, t) => this.frame(dt, t));
		this.onPointer = (e) => {
			const rect = container.getBoundingClientRect();
			this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			this.pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
		};
		window.addEventListener('pointermove', this.onPointer, { passive: true });
		this.observer = new IntersectionObserver(([entry]) => {
			this.visible = entry.isIntersecting;
			if (this.visible && this.active && !reducedMotion()) this.loop.start();
			else this.loop.stop();
		});
		this.observer.observe(container);
	}

	build() {
		const { scene, camera } = this.stage;
		camera.position.set(0, 1.6, 11);
		camera.lookAt(0, 0.4, 0);
		this.stage.hemi.intensity = 0.9;
		const rim = new THREE.PointLight(palette.violet, 40, 30);
		this.rim = rim;
		rim.position.set(-6, 4, -2);
		const key = new THREE.PointLight(palette.blue, 30, 30);
		this.key = key;
		key.position.set(6, 2, 4);
		scene.add(rim, key);

		// the floor and its neon grid take the theme's colours (see applyTheme)
		this.floorMat = this.stage.own(new THREE.MeshBasicMaterial({ color: 0x0d1328 }));
		const floor = this.stage.mesh(geo.plane(60, 60), this.floorMat);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -2.62;

		// a glowing ring behind everything
		const halo = this.stage.mesh(geo.torus(4.2, 0.05, 8, 96), themed('primary', { basic: true }));
		halo.position.set(1.8, 0.6, -5);
		this.halo = halo;

		const soccer = this.stage.mesh(geo.icosa(0.55, 1), standard(palette.white, { roughness: 0.5, flatShading: true }));
		const items = [
			[makeBasketball(this.stage), [3.6, 1.2, 0], 0.9],
			[soccer, [-3.8, -0.6, 1], 1.1],
			[makeDie(this.stage), [1.2, -1.1, 2], 0.7],
			[makeCard(this.stage, palette.blue), [-1.6, 1.7, -1], 0.6],
			[makeCard(this.stage, palette.violet), [-0.9, 1.4, -1.6], 0.5],
			[makePin(this.stage), [5.4, -1.6, -1.5], 1.3],
			[makePawn(this.stage), [-5.4, 0.9, -2], 1.2],
			[makeCar(this.stage), [0.4, 2.4, -3], 0.9],
			[this.stage.mesh(geo.torus(0.4, 0.14, 12, 32), standard(palette.mint, { roughness: 0.3 })), [-2.6, -1.8, 2.5], 1.0],
			[this.stage.mesh(geo.octa(0.5), standard(palette.amber, { roughness: 0.2, metalness: 0.4, emissive: palette.amber, emissiveIntensity: 0.25 })), [2.8, -1.9, 3], 0.8],
			[this.stage.mesh(geo.capsule(0.22, 0.6), standard(palette.pink, { roughness: 0.3 })), [-4.6, 2.6, -4], 1.0],
		];
		for (const [object, [x, y, z], speed] of items) {
			if (!object.parent) scene.add(object);
			object.position.set(x, y, z);
			object.rotation.set(Math.random() * 3, Math.random() * 3, Math.random());
			this.items.push({ object, base: { x, y, z }, speed, phase: Math.random() * Math.PI * 2, spin: 0.2 + Math.random() * 0.5 });
		}
	}

	/** Background, fog, lights and grid in the site theme's colours. */
	applyTheme(c) {
		const { scene } = this.stage;
		const bg = new THREE.Color(c.background || '#0b1020');
		const light = c.scheme === 'light';
		scene.background.copy(bg);
		scene.fog.color.copy(bg);
		this.floorMat.color.copy(bg).offsetHSL(0, 0, light ? -0.04 : 0.02);
		this.rim.color.set(c.secondary || '#8b5cf6');
		this.key.color.set(c.primary || '#4f8cff');
		if (this.grid) {
			// Theme input fires continuously while the native colour control is dragged.
			// Reuse the grid and its geometry; rebuilding it on every input stalls the UI.
			this.grid.material[0].color.set(c.secondary || '#8b5cf6');
			this.grid.material[1].color.set(c.border || '#26305e');
		} else {
			const lines = new THREE.Color(c.border || '#26305e');
			this.grid = new THREE.GridHelper(60, 40, new THREE.Color(c.secondary || '#8b5cf6'), lines);
			this.grid.position.y = -2.6;
			scene.add(this.grid);
		}
	}

	frame(dt, t) {
		this.look.x = damp(this.look.x, this.pointer.x, 0.04, dt);
		this.look.y = damp(this.look.y, this.pointer.y, 0.04, dt);
		const { camera } = this.stage;
		camera.position.set(this.look.x * 1.6, 1.6 - this.look.y * 0.8, 11);
		camera.lookAt(0, 0.4, 0);
		for (const item of this.items) {
			const o = item.object;
			o.position.y = item.base.y + Math.sin(t * item.speed + item.phase) * 0.35;
			o.rotation.y += dt * item.spin;
			o.rotation.x += dt * item.spin * 0.4;
		}
		this.halo.rotation.z = t * 0.1;
		this.grid.position.z = (t * 1.2) % 1.5;
		this.stage.render();
	}

	/** Shows the hero (again): takes the shared canvas back and animates while visible. */
	activate() {
		this.active = true;
		this.stage.attach();
		// reduced motion: one still frame instead of the floating animation
		if (reducedMotion()) this.frame(0, 0);
		else if (this.visible) this.loop.start();
	}

	deactivate() {
		this.active = false;
		this.loop.stop();
		this.stage.detach();
	}

	dispose() {
		this.deactivate();
		this.observer.disconnect();
		this.offTheme();
		window.removeEventListener('pointermove', this.onPointer);
		this.stage.dispose();
	}
}
