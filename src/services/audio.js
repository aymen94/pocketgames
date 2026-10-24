import { store } from './storage.js';

let context = null;
let master = null;
let unlocked = false;

function ctx() {
	if (!context) {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext;
		if (!AudioContextClass) return null;
		context = new AudioContextClass();
		master = context.createGain();
		master.gain.value = 0.35;
		master.connect(context.destination);
	}
	if (context.state === 'suspended') context.resume().catch(() => {});
	return context;
}

function tone({ freq = 440, to = null, type = 'square', duration = 0.12, volume = 0.5, delay = 0 }) {
	const ac = ctx();
	if (!ac) return;
	const start = ac.currentTime + delay;
	const osc = ac.createOscillator();
	const gain = ac.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, start);
	if (to) osc.frequency.exponentialRampToValueAtTime(to, start + duration);
	gain.gain.setValueAtTime(volume, start);
	gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
	osc.connect(gain).connect(master);
	osc.start(start);
	osc.stop(start + duration + 0.02);
}

function noise({ duration = 0.15, volume = 0.4, filter = 1200, delay = 0 }) {
	const ac = ctx();
	if (!ac) return;
	const start = ac.currentTime + delay;
	const length = Math.floor(ac.sampleRate * duration);
	const buffer = ac.createBuffer(1, length, ac.sampleRate);
	const data = buffer.getChannelData(0);
	for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
	const source = ac.createBufferSource();
	source.buffer = buffer;
	const band = ac.createBiquadFilter();
	band.type = 'lowpass';
	band.frequency.value = filter;
	const gain = ac.createGain();
	gain.gain.value = volume;
	source.connect(band).connect(gain).connect(master);
	source.start(start);
}

const effects = {
	click: () => tone({ freq: 660, type: 'triangle', duration: 0.05, volume: 0.25 }),
	move: () => tone({ freq: 320, type: 'triangle', duration: 0.06, volume: 0.3 }),
	blip: () => tone({ freq: 880, type: 'square', duration: 0.06, volume: 0.2 }),
	hit: () => tone({ freq: 220, to: 110, type: 'square', duration: 0.1, volume: 0.35 }),
	bounce: () => tone({ freq: 520, to: 380, type: 'sine', duration: 0.09, volume: 0.45 }),
	shoot: () => tone({ freq: 900, to: 200, type: 'sawtooth', duration: 0.12, volume: 0.18 }),
	explode: () => noise({ duration: 0.35, volume: 0.5, filter: 900 }),
	crash: () => { noise({ duration: 0.5, volume: 0.6, filter: 600 }); tone({ freq: 120, to: 40, type: 'sawtooth', duration: 0.4, volume: 0.3 }); },
	score: () => { tone({ freq: 660, type: 'triangle', duration: 0.08 }); tone({ freq: 990, type: 'triangle', duration: 0.12, delay: 0.07 }); },
	coin: () => { tone({ freq: 988, type: 'square', duration: 0.06, volume: 0.2 }); tone({ freq: 1319, type: 'square', duration: 0.14, volume: 0.2, delay: 0.06 }); },
	flip: () => noise({ duration: 0.06, volume: 0.25, filter: 3000 }),
	place: () => tone({ freq: 180, type: 'sine', duration: 0.12, volume: 0.6 }),
	swoosh: () => noise({ duration: 0.25, volume: 0.25, filter: 2000 }),
	jump: () => tone({ freq: 300, to: 700, type: 'square', duration: 0.12, volume: 0.2 }),
	error: () => tone({ freq: 160, type: 'sawtooth', duration: 0.18, volume: 0.25 }),
	// arcade and 3D effects
	laser: () => tone({ freq: 1400, to: 300, type: 'square', duration: 0.09, volume: 0.14 }),
	zap: () => { tone({ freq: 2000, to: 600, type: 'sawtooth', duration: 0.07, volume: 0.12 }); noise({ duration: 0.05, volume: 0.15, filter: 5000 }); },
	powerup: () => [440, 554, 659, 880].forEach((f, i) => tone({ freq: f, type: 'square', duration: 0.07, volume: 0.16, delay: i * 0.05 })),
	levelup: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.12, volume: 0.35, delay: i * 0.07 })),
	tick: () => tone({ freq: 1200, type: 'sine', duration: 0.03, volume: 0.25 }),
	go: () => { tone({ freq: 880, type: 'square', duration: 0.25, volume: 0.22 }); tone({ freq: 1320, type: 'triangle', duration: 0.25, volume: 0.2 }); },
	thud: () => { tone({ freq: 140, to: 50, type: 'sine', duration: 0.18, volume: 0.7 }); noise({ duration: 0.08, volume: 0.2, filter: 400 }); },
	splash: () => { noise({ duration: 0.45, volume: 0.35, filter: 1800 }); tone({ freq: 600, to: 200, type: 'sine', duration: 0.2, volume: 0.15 }); },
	cheer: () => { noise({ duration: 0.9, volume: 0.3, filter: 2600 }); noise({ duration: 0.7, volume: 0.2, filter: 1200, delay: 0.15 }); },
	buzzer: () => { tone({ freq: 110, type: 'sawtooth', duration: 0.6, volume: 0.3 }); tone({ freq: 116, type: 'square', duration: 0.6, volume: 0.15 }); },
	swish: () => { noise({ duration: 0.18, volume: 0.3, filter: 4500 }); tone({ freq: 1800, to: 2600, type: 'sine', duration: 0.12, volume: 0.06 }); },
	pop: () => tone({ freq: 700, to: 1200, type: 'sine', duration: 0.06, volume: 0.35 }),
	card: () => noise({ duration: 0.04, volume: 0.3, filter: 6000 }),
	chip: () => { tone({ freq: 2400, type: 'triangle', duration: 0.04, volume: 0.15 }); tone({ freq: 3100, type: 'triangle', duration: 0.05, volume: 0.1, delay: 0.03 }); },
	roll: () => { noise({ duration: 0.8, volume: 0.25, filter: 300 }); tone({ freq: 60, type: 'sine', duration: 0.8, volume: 0.25 }); },
	boost: () => tone({ freq: 200, to: 900, type: 'sawtooth', duration: 0.35, volume: 0.12 }),
	shatter: () => { noise({ duration: 0.3, volume: 0.4, filter: 7000 }); [1800, 2400, 3000].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.08, volume: 0.07, delay: i * 0.03 })); },
	select: () => tone({ freq: 520, to: 780, type: 'triangle', duration: 0.07, volume: 0.25 }),
	// a pitched note: `play('note', hz)` (Echo Pads and other musical games)
	note: (freq = 440) => tone({ freq, type: 'triangle', duration: 0.3, volume: 0.4 }),
	stack: (n = 0) => { tone({ freq: 260 + Math.min(n, 30) * 22, type: 'triangle', duration: 0.1, volume: 0.45 }); noise({ duration: 0.05, volume: 0.15, filter: 1500 }); },
	win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.18, delay: i * 0.1 })),
	lose: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'triangle', duration: 0.2, delay: i * 0.12 })),
};

// ---------------------------------------------------------------- samples

// effect name -> [file in public/sounds, gain, synth fallback]
const SAMPLES = {
	coin: ['coin', 1.3], score: ['score', 1.1], win: ['win', 1.1], levelup: ['levelup', 1.1], lose: ['lose', 1.1],
	jump: ['jump', 1.2], spinjump: ['spinjump', 1.1, 'jump'], explode: ['explode', 1.2], blast: ['blast', 1.2, 'explode'],
	crash: ['crash', 1.2], laser: ['laser', 0.7], shoot: ['laser', 0.7], powerup: ['powerup', 1.1], hit: ['hit', 1.2],
	blockhit: ['blockhit', 1.0, 'hit'], click: ['click', 1.4], select: ['select', 1.0], pop: ['pop', 1.0],
	bonus: ['bonus', 1.0, 'coin'], pickup: ['pickup', 1.3, 'coin'], sparkle: ['sparkle', 0.9, 'powerup'],
	treasure: ['treasure', 1.0, 'win'], record: ['record', 1.1, 'levelup'], punch: ['punch', 1.1, 'thud'],
	opener: ['opener', 0.9, 'go'], whip: ['whip', 1.0, 'swoosh'], lifelost: ['lifelost', 1.0, 'lose'],
	gameover: ['gameover', 1.0, 'lose'], bomb: ['bomb', 1.2, 'explode'],
};
const buffers = new Map(); // file -> AudioBuffer | Promise | null (failed)
const lastPlayed = new Map();

function loadSample(file) {
	if (buffers.has(file)) return;
	const ac = ctx();
	if (!ac) return;
	const pending = fetch(`${import.meta.env.BASE_URL}sounds/${file}.mp3`)
		.then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
		.then((data) => new Promise((resolve, reject) => ac.decodeAudioData(data, resolve, reject)))
		.then((buffer) => { buffers.set(file, buffer); })
		.catch(() => { buffers.set(file, null); });
	buffers.set(file, pending);
}

/** Plays a decoded sample; false when it is not ready (the caller then synthesizes). */
function playSample(name, arg) {
	const entry = SAMPLES[name];
	if (!entry) return false;
	const [file, gain] = entry;
	const buffer = buffers.get(file);
	if (!(buffer instanceof AudioBuffer)) {
		loadSample(file);
		return false;
	}
	const ac = ctx();
	const now = ac.currentTime;
	// the same sample re-triggered within 40 ms would only add noise
	if (now - (lastPlayed.get(name) ?? -1) < 0.04) return true;
	lastPlayed.set(name, now);
	const source = ac.createBufferSource();
	source.buffer = buffer;
	// a little pitch variety keeps repeated effects from sounding mechanical
	source.playbackRate.value = typeof arg === 'number' ? arg : 0.96 + Math.random() * 0.08;
	const level = ac.createGain();
	level.gain.value = gain;
	source.connect(level).connect(master);
	source.start();
	return true;
}

/** Decodes every sample in the background, once the audio context exists. */
function warmUp() {
	const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 300));
	const files = [...new Set(Object.values(SAMPLES).map(([file]) => file))];
	const next = () => {
		const file = files.shift();
		if (!file) return;
		loadSample(file);
		idle(next);
	};
	idle(next);
}

export const audio = {
	get enabled() { return store.sound; },
	set enabled(on) { store.sound = on; if (on) this.unlock(); },
	/** Plays a named effect when sound is on; `arg` varies some (e.g. stack height). Unknown names are ignored. */
	play(name, arg) {
		if (!store.sound) return;
		try {
			if (playSample(name, typeof arg === 'number' && name !== 'stack' ? arg : undefined)) return;
			(effects[name] ?? effects[SAMPLES[name]?.[2]])?.(arg);
		} catch { /* audio is best effort */ }
	},
	/** Called from the first pointer or key press so later effects can start. */
	unlock() {
		if (!store.sound || unlocked) return;
		unlocked = true;
		ctx();
		warmUp();
	},
};
