// Balloon Words: guess the hidden word one letter at a time. Each wrong letter pops one of
// six balloons; solve as many words in a row as you can before they are all gone. Solving
// a word refills one balloon.

import { CanvasGame } from '../kit/canvasGame.js';
import { circle, fillRound, text, colors } from '../core/canvas.js';

const W = 560, H = 600;
const MAX = 6;
const KEYS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const BALLOON = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'];

export const WORDS = {
	Animals: 'BADGER BEAVER CAMEL DOLPHIN FALCON GIRAFFE HAMSTER JAGUAR KOALA LOBSTER MEERKAT OCTOPUS OSTRICH PANTHER PELICAN PENGUIN RABBIT SALMON SPARROW TORTOISE WALRUS ZEBRA OTTER LIZARD'.split(' '),
	Food: 'AVOCADO BISCUIT BROCCOLI CARROT CHEESE COCONUT CUSTARD GARLIC LASAGNE MANGO MUFFIN NOODLE OLIVE PANCAKE PEPPER PICKLE POPCORN PRETZEL PUMPKIN RADISH SPINACH TOMATO WAFFLE YOGURT'.split(' '),
	Space: 'ASTEROID COMET CRATER ECLIPSE GALAXY GRAVITY JUPITER METEOR NEBULA ORBIT PLANET QUASAR ROCKET SATURN SHUTTLE STARDUST TELESCOPE URANUS VENUS ZENITH'.split(' '),
	Things: 'ANCHOR BACKPACK BLANKET CANDLE COMPASS CRAYON GUITAR HAMMER HELMET KETTLE LADDER LANTERN MAGNET MIRROR NOTEBOOK PADDLE PILLOW SCISSORS TRUMPET UMBRELLA WALLET WHISTLE'.split(' '),
	Places: 'ARCTIC BEACH CANYON CASTLE DESERT FOREST GLACIER HARBOR ISLAND JUNGLE LAGOON LIBRARY MARKET MEADOW MUSEUM ORCHARD PRAIRIE STADIUM SUMMIT TUNNEL VALLEY VOLCANO'.split(' '),
};

export default class BalloonWords extends CanvasGame {
	static W = W;
	static H = H;

	reset() {
		super.reset();
		this.solved = 0;
		this.balloons = MAX;
		this.used = new Set();
		this.ctx.score(0);
		this.nextWord();
	}

	nextWord() {
		const cats = Object.keys(WORDS);
		let cat, word;
		do {
			cat = cats[Math.floor(Math.random() * cats.length)];
			word = WORDS[cat][Math.floor(Math.random() * WORDS[cat].length)];
		} while (this.used.has(word) && this.used.size < 60);
		this.used.add(word);
		this.category = cat;
		this.word = word;
		this.guessed = new Set();
		this.wrong = new Set();
		this.ctx.info(`Category: ${cat}`);
		this.wake();
	}

	guess(letter) {
		if (!this.running || this.guessed.has(letter) || this.wrong.has(letter) || this.between) return;
		if (this.word.includes(letter)) {
			this.guessed.add(letter);
			this.ctx.audio.play('pop');
			const n = this.word.length, step = Math.min(44, (W - 40) / n), x0 = W / 2 - ((n - 1) * step) / 2;
			[...this.word].forEach((c, i) => { if (c === letter) this.burst(x0 + i * step, 300, { count: 8, color: colors.accent, speed: 90, life: 0.4, shape: 'star', size: 3 }); });
			if ([...this.word].every((c) => this.guessed.has(c))) {
				this.solved++;
				this.balloons = Math.min(MAX, this.balloons + 1);
				this.ctx.score(this.solved);
				this.ctx.audio.play('score');
				this.popup('Solved!', W / 2, 240, { color: '#fde047', size: 28 });
				this.between = true;
				setTimeout(() => { this.between = false; if (this.running) this.nextWord(); }, 1000);
			}
		} else {
			this.wrong.add(letter);
			const i = this.balloons - 1;
			this.balloons--;
			this.ctx.audio.play('blast');
			const [bx, by] = this.balloonPos(i);
			this.burst(bx, by, { count: 22, color: BALLOON[i], speed: 180, life: 0.5, shape: 'square', size: 3 });
			this.fx.shake.kick(4);
			if (this.balloons <= 0) {
				for (const c of this.word) this.guessed.add(c);
				this.ctx.audio.play('lose');
				setTimeout(() => this.finish({ win: this.solved > 0, title: 'Out of balloons', message: `The word was ${this.word}. You solved ${this.solved} ${this.solved === 1 ? 'word' : 'words'}.`, score: this.solved }), 1100);
			}
		}
		this.wake();
	}

	balloonPos(i) {
		const t = performance.now() / 1000;
		return [W / 2 - 125 + i * 50, 120 + Math.sin(t * 1.5 + i) * 6];
	}

	keyRects() {
		const rects = [];
		KEYS.forEach((row, r) => {
			const kw = 48, x0 = W / 2 - (row.length * kw) / 2;
			[...row].forEach((c, i) => rects.push({ c, x: x0 + i * kw + 2, y: 400 + r * 56, w: kw - 4, h: 50 }));
		});
		return rects;
	}

	pointerDown(p) {
		const k = this.keyRects().find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
		if (k) this.guess(k.c);
	}

	key(action, event) {
		const k = event?.key?.toUpperCase();
		if (k && k.length === 1 && k >= 'A' && k <= 'Z') this.guess(k);
	}

	busy() { return this.running; }

	draw(g) {
		const bg = g.createLinearGradient(0, 0, 0, H);
		bg.addColorStop(0, '#7dd3fc');
		bg.addColorStop(0.6, '#e0f2fe');
		bg.addColorStop(1, '#bae6fd');
		g.fillStyle = bg;
		g.fillRect(0, 0, W, H);
		// balloons tied to a basket
		for (let i = 0; i < this.balloons; i++) {
			const [x, y] = this.balloonPos(i);
			g.strokeStyle = 'rgba(30,41,59,0.5)';
			g.lineWidth = 1;
			g.beginPath(); g.moveTo(x, y + 26); g.quadraticCurveTo(x + 6, y + 60, W / 2, 200); g.stroke();
			g.fillStyle = BALLOON[i];
			g.beginPath(); g.ellipse(x, y, 20, 26, 0, 0, Math.PI * 2); g.fill();
			circle(g, x - 7, y - 9, 5, 'rgba(255,255,255,0.45)');
		}
		fillRound(g, W / 2 - 24, 196, 48, 26, 6, '#92400e');
		text(g, this.category, W / 2, 252, { size: 15, color: '#0c4a6e' });
		const n = this.word.length, step = Math.min(44, (W - 40) / n), x0 = W / 2 - ((n - 1) * step) / 2;
		[...this.word].forEach((c, i) => {
			const x = x0 + i * step;
			fillRound(g, x - step / 2 + 3, 322, step - 6, 4, 2, '#0c4a6e');
			if (this.guessed.has(c)) text(g, c, x, 300, { size: 30, color: this.balloons > 0 ? '#0f172a' : '#b91c1c' });
		});
		for (const k of this.keyRects()) {
			const hit = this.guessed.has(k.c), miss = this.wrong.has(k.c);
			fillRound(g, k.x, k.y, k.w, k.h, 9, hit ? colors.accent : miss ? '#94a3b8' : '#ffffff');
			text(g, k.c, k.x + k.w / 2, k.y + k.h / 2 + 1, { size: 20, color: hit ? '#ffffff' : miss ? '#e2e8f0' : '#0f172a' });
		}
		text(g, `Solved ${this.solved}`, 16, 20, { size: 15, align: 'left', color: '#0c4a6e' });
	}
}
