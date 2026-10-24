// The contract every PocketGames game follows. The game screen (components/gameScreen.js)
// drives it: `init` once, `start` when the player presses Play, `update`/`render` every
// frame for real-time games, `pause`/`resume` when the tab or the pause menu asks, `reset`
// for restarts and setting changes, and `dispose` when the player leaves.
//
// The context passed to the constructor gives each game what it needs without importing
// the app: its DOM root, settings, input, audio, the HUD and the game-over screen.
//
//   ctx.root            the element to draw into
//   ctx.settings        current values of the game's settings
//   ctx.input           an Input (engine/input.js), cleaned up automatically
//   ctx.audio.play(n)   sound effects (respects mute)
//   ctx.score(n)        shows the score in the header
//   ctx.info(text)      a short status line in the header (turn, level, lives…)
//   ctx.over(result)    ends the round: { win, title, message, score, lowerIsBetter, record }
//   ctx.saveProgress(d) / ctx.loadProgress()   resumable state for "Continue playing"
//   ctx.best()          the stored best score

export class Game {
	/** Real-time games get `update(dt)` and `render()` from the shared loop. */
	static realtime = false;

	constructor(ctx) {
		this.ctx = ctx;
		this.running = false;
		this.paused = false;
	}

	async init() {}
	start() { this.running = true; this.paused = false; }
	pause() { this.paused = true; }
	resume() { this.paused = false; }
	update(_dt) {}
	render() {}
	/** Receives { type: 'down' | 'up', action, event } from the keyboard and the touch pad. */
	handleInput(_input) {}
	reset() {}
	dispose() {}

	/** Ends the round once; later calls are ignored until the next start. */
	finish(result) {
		if (!this.running) return;
		this.running = false;
		this.ctx.over(result);
	}
}
