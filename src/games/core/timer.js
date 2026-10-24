// Timers driven by the game's own update calls, so they stop when the game pauses.

export class Stopwatch {
	constructor() { this.time = 0; }
	update(dt) { this.time += dt; }
	reset() { this.time = 0; }
	get seconds() { return Math.floor(this.time); }
	toString() { return formatTime(this.time); }
}

export class Countdown {
	constructor(seconds) { this.total = seconds; this.left = seconds; }
	update(dt) { this.left = Math.max(0, this.left - dt); return this.left === 0; }
	reset(seconds = this.total) { this.total = seconds; this.left = seconds; }
	get done() { return this.left === 0; }
}

/**
 * A wall-clock stopwatch for turn-based puzzles without a frame loop. It pauses with the
 * game and calls `onTick(text)` once per second.
 */
export class PuzzleClock {
	constructor(onTick) {
		this.onTick = onTick;
		this.elapsed = 0;
		this.since = null;
		this.id = 0;
	}
	start() {
		if (this.since !== null) return;
		this.since = performance.now();
		this.id = setInterval(() => this.onTick(formatTime(this.time)), 1000);
		this.onTick(formatTime(this.time));
	}
	stop() {
		if (this.since === null) return;
		this.elapsed += (performance.now() - this.since) / 1000;
		this.since = null;
		clearInterval(this.id);
	}
	reset() { this.stop(); this.elapsed = 0; }
	get time() { return this.elapsed + (this.since === null ? 0 : (performance.now() - this.since) / 1000); }
}

export function formatTime(seconds) {
	const s = Math.floor(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
