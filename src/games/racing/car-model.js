// A low-poly car built from shared WAMR3D geometry, used by Traffic Rush and the hero.

import { THREE } from '../../engine/wamr3d.js';
import { geo, standard, basic } from '../../engine/materials.js';

/** A car facing -z, about 1.8 wide and 4 long, sitting on y = 0. */
export function makeCar(stage, color, { parent = stage.scene, lights = false } = {}) {
	const car = new THREE.Group();
	const paint = standard(color, { roughness: 0.3, metalness: 0.4 });
	const glass = standard(0x111827, { roughness: 0.1, metalness: 0.6 });
	const tyre = standard(0x0b0b0f, { roughness: 0.9 });
	const body = stage.mesh(geo.box(1.8, 0.55, 4), paint, car);
	body.position.y = 0.55;
	const cabin = stage.mesh(geo.box(1.5, 0.5, 2), glass, car);
	cabin.position.set(0, 1.07, 0.25);
	const roof = stage.mesh(geo.box(1.45, 0.08, 1.7), paint, car);
	roof.position.set(0, 1.36, 0.3);
	for (const [x, z] of [[-0.85, -1.3], [0.85, -1.3], [-0.85, 1.3], [0.85, 1.3]]) {
		const wheel = stage.mesh(geo.cylinder(0.36, 0.36, 0.3, 14), tyre, car);
		wheel.position.set(x, 0.36, z);
		wheel.rotation.z = Math.PI / 2;
	}
	const tail = basic(0xff2d55);
	for (const x of [-0.6, 0.6]) {
		const light = stage.mesh(geo.box(0.4, 0.14, 0.05), tail, car);
		light.position.set(x, 0.65, 2.01);
	}
	if (lights) {
		const head = basic(0xfff7d6);
		for (const x of [-0.6, 0.6]) {
			const light = stage.mesh(geo.box(0.36, 0.14, 0.05), head, car);
			light.position.set(x, 0.62, -2.01);
		}
	}
	parent.add(car);
	return car;
}
