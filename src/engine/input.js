// Keyboard and pointer helpers shared by every game. Each game gets its own `Input`
// through the game context; `dispose()` removes every listener it added, so closing a game
// never leaves handlers behind on `window`.

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space']);

/** Normalizes keys to short action names, so WASD and arrows behave the same. */
export function keyAction(event) {
	switch (event.key) {
		case 'ArrowUp': case 'w': case 'W': return 'up';
		case 'ArrowDown': case 's': case 'S': return 'down';
		case 'ArrowLeft': case 'a': case 'A': return 'left';
		case 'ArrowRight': case 'd': case 'D': return 'right';
		case ' ': case 'Enter': return 'action';
		default: return null;
	}
}

export class Input {
	constructor() {
		this.held = new Set();
		this.listeners = [];
		this.handlers = { down: [], up: [] };
		this.enabled = true;
		this.on(window, 'keydown', (e) => this.key(e, true));
		this.on(window, 'keyup', (e) => this.key(e, false));
		this.on(window, 'blur', () => this.held.clear());
	}

	/** Adds a listener that `dispose()` removes. */
	on(target, type, fn, options) {
		target.addEventListener(type, fn, options);
		this.listeners.push(() => target.removeEventListener(type, fn, options));
		return fn;
	}

	key(event, down) {
		if (!this.enabled) return;
		const tag = event.target?.tagName;
		if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
		const action = keyAction(event);
		if (GAME_KEYS.has(event.key)) event.preventDefault();
		this.press(action, down, event);
	}

	/** Feeds an action as if its key changed state; used by the on-screen touch pad. */
	press(action, down, event = null) {
		if (down) {
			const repeat = event?.repeat ?? false;
			if (action) this.held.add(action);
			for (const fn of this.handlers.down) fn(action, event, repeat);
		} else {
			if (action) this.held.delete(action);
			for (const fn of this.handlers.up) fn(action, event);
		}
	}

	/** Called with (action, event, repeat) on key down; `action` is null for unmapped keys. */
	onDown(fn) { this.handlers.down.push(fn); }
	onUp(fn) { this.handlers.up.push(fn); }
	isDown(action) { return this.held.has(action); }

	/** Horizontal and vertical axes from the held actions, each -1, 0 or 1. */
	axis() {
		return {
			x: (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0),
			y: (this.held.has('down') ? 1 : 0) - (this.held.has('up') ? 1 : 0),
		};
	}

	/** Calls `fn(direction)` for swipes ('up', 'down', 'left', 'right') and `tap` for short taps on `element`. */
	swipe(element, fn, tap) {
		let start = null;
		this.on(element, 'pointerdown', (e) => { start = { x: e.clientX, y: e.clientY, t: performance.now() }; });
		this.on(element, 'pointerup', (e) => {
			if (!start) return;
			const dx = e.clientX - start.x, dy = e.clientY - start.y;
			const distance = Math.hypot(dx, dy);
			if (distance < 18) tap?.(e);
			else if (Math.abs(dx) > Math.abs(dy)) fn(dx > 0 ? 'right' : 'left');
			else fn(dy > 0 ? 'down' : 'up');
			start = null;
		});
	}

	dispose() {
		for (const off of this.listeners) off();
		this.listeners = [];
		this.handlers = { down: [], up: [] };
		this.held.clear();
	}
}

/** Pointer position in normalized device coordinates (-1..1) over `element`, for raycasting. */
export function pointerNdc(event, element, target = { x: 0, y: 0 }) {
	const rect = element.getBoundingClientRect();
	target.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
	target.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
	return target;
}
