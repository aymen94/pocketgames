// A requestAnimationFrame loop with delta time in seconds, clamped so a tab coming back
// from the background does not teleport everything.

export class Loop {
	constructor(step, { maxDelta = 1 / 20 } = {}) {
		this.step = step;
		this.maxDelta = maxDelta;
		this.frame = 0;
		this.last = 0;
		this.running = false;
		this.tick = this.tick.bind(this);
	}

	start() {
		if (this.running) return;
		this.running = true;
		this.last = performance.now();
		this.frame = requestAnimationFrame(this.tick);
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this.frame);
	}

	tick(now) {
		if (!this.running) return;
		const dt = Math.min((now - this.last) / 1000, this.maxDelta);
		this.last = now;
		this.step(dt, now / 1000);
		if (this.running) this.frame = requestAnimationFrame(this.tick);
	}
}
