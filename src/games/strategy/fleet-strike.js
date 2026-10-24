// Fleet Strike: hidden fleets on two 10 × 10 seas. The computer hunts at random on Easy,
// follows up hits on Normal, and on Hard aims where the remaining ships most likely fit.

import { Game } from '../core/game.js';
import { h } from '../../components/dom.js';
import { think } from '../core/ai.js';

const N = 10;
const FLEET = [['Carrier', 5], ['Battleship', 4], ['Cruiser', 3], ['Submarine', 3], ['Destroyer', 2]];

function placeFleet() {
	const owner = new Array(N * N).fill(-1);
	const ships = [];
	FLEET.forEach(([name, size], id) => {
		while (true) {
			const horizontal = Math.random() < 0.5;
			const r = Math.floor(Math.random() * (horizontal ? N : N - size + 1));
			const c = Math.floor(Math.random() * (horizontal ? N - size + 1 : N));
			const cells = Array.from({ length: size }, (_, k) => (horizontal ? r * N + c + k : (r + k) * N + c));
			if (cells.some((i) => owner[i] >= 0)) continue;
			for (const i of cells) owner[i] = id;
			ships.push({ name, size, cells, hits: 0 });
			break;
		}
	});
	return { owner, ships, shots: new Array(N * N).fill(0) }; // shots: 0 none, 1 miss, 2 hit
}

export default class FleetStrike extends Game {
	async init() {
		this.style = h('style', FLEET_CSS);
		this.message = h('p.game-message');
		this.enemyEl = h('div.fleet-grid.enemy');
		this.homeEl = h('div.fleet-grid.home');
		this.shuffleButton = h('button.btn.small', { type: 'button', onclick: () => this.shuffle() }, '⟳ Shuffle my fleet');
		this.enemyStatus = h('div.fleet-status');
		this.homeStatus = h('div.fleet-status');
		this.layout = h('div.fleet-layout',
			h('div.fleet-side', h('h3', 'Enemy waters'), this.enemyEl, this.enemyStatus),
			h('div.fleet-side', h('h3', 'Your fleet'), this.homeEl, this.homeStatus),
		);
		this.column = h('div.game-column', this.layout, this.message, h('div.game-toolbar', this.shuffleButton));
		this.ctx.root.append(this.style, this.column);
		this.enemyCells = this.cells(this.enemyEl, (i) => this.fire(i));
		this.homeCells = this.cells(this.homeEl, null);
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(this.ctx.root);
		this.reset();
	}

	cells(parent, onClick) {
		return Array.from({ length: N * N }, (_, i) => {
			const el = h(onClick ? 'button.fleet-cell' : 'div.fleet-cell', onClick ? { type: 'button', onclick: () => onClick(i) } : {});
			parent.appendChild(el);
			return el;
		});
	}

	fit() {
		const rect = this.ctx.root.getBoundingClientRect();
		const wide = rect.width > rect.height * 1.1;
		const cell = wide ? Math.min((rect.width - 90) / (2 * N), (rect.height - 160) / N) : Math.min((rect.width - 30) / N, (rect.height - 230) / (2 * N));
		this.layout.style.setProperty('--fcell', `${Math.max(14, Math.min(Math.floor(cell), 40))}px`);
		this.layout.classList.toggle('wide', wide);
	}

	reset() {
		this.running = false;
		this.cancel?.();
		this.enemy = placeFleet();
		this.home = placeFleet();
		this.shots = 0;
		this.turn = 'player';
		this.targets = [];
		this.shuffleButton.disabled = false;
		this.message.textContent = 'Fire at the enemy waters.';
		this.ctx.score(0);
		this.fit();
		this.paint();
	}

	shuffle() {
		if (this.shots > 0) return;
		this.home = placeFleet();
		this.ctx.audio.play('swoosh');
		this.paint();
	}

	fire(i) {
		if (!this.running || this.turn !== 'player' || this.enemy.shots[i]) return;
		this.shuffleButton.disabled = true;
		this.shots++;
		this.ctx.score(this.shots);
		const result = this.shoot(this.enemy, i);
		this.message.textContent = result.sunk ? `You sank their ${result.sunk}!` : result.hit ? 'Hit!' : 'Miss.';
		this.paint();
		if (this.enemy.ships.every((s) => s.hits === s.size)) {
			return setTimeout(() => this.finish({ win: true, title: 'Victory at sea!', message: `You sank the enemy fleet in ${this.shots} shots.`, score: this.shots }), 600);
		}
		this.turn = 'cpu';
		this.cancel = think(() => this.cpuTurn(), 650);
	}

	shoot(board, i) {
		const id = board.owner[i];
		const el = (board === this.enemy ? this.enemyCells : this.homeCells)[i];
		const fx = this.ctx.fx;
		if (id < 0) {
			board.shots[i] = 1;
			this.ctx.audio.play('splash');
			// a splash: rings and droplets
			fx.ring(el, { color: '#7dd3fc', radius: 26, life: 0.5 });
			fx.burst(el, { count: 8, colors: ['#bae6fd', '#ffffff'], speed: 110, angle: -Math.PI / 2, spread: 1.6, life: 0.45, shape: 'dot', size: 2.5, gravity: 400 });
			return { hit: false };
		}
		board.shots[i] = 2;
		const ship = board.ships[id];
		ship.hits++;
		const sunk = ship.hits === ship.size;
		this.ctx.audio.play(sunk ? 'blast' : 'explode');
		fx.burst(el, { count: sunk ? 10 : 18, colors: ['#f97316', '#fde047', '#ffffff'], speed: 170, life: 0.6, shape: 'spark', size: 3, glow: true });
		fx.burst(el, { count: 6, color: '#334155', speed: 40, angle: -Math.PI / 2, spread: 1, life: 0.9, shape: 'smoke', size: 7, grow: 12 });
		if (sunk) {
			// every section of the sunk ship goes up in turn
			const cells = board === this.enemy ? this.enemyCells : this.homeCells;
			ship.cells.forEach((k, n) => setTimeout(() => fx.burst(cells[k], { count: 14, colors: ['#ef4444', '#f97316', '#fde047'], speed: 200, life: 0.7, shape: 'spark', size: 3.5, glow: true }), n * 90));
			fx.shake(board === this.home ? 9 : 6);
			fx.banner(board === this.enemy ? `${ship.name} sunk!` : `Lost the ${ship.name}`);
		} else fx.shake(3);
		return { hit: true, sunk: sunk ? ship.name : null, ship };
	}

	cpuTurn() {
		if (!this.running) return;
		const target = this.choose();
		const result = this.shoot(this.home, target);
		if (result.hit && !result.sunk) this.targets.push(target);
		if (result.sunk) this.targets = this.targets.filter((t) => !result.ship.cells.includes(t));
		this.message.textContent = result.sunk ? `They sank your ${result.sunk}!` : result.hit ? 'The enemy hit your ship!' : 'The enemy missed.';
		this.paint();
		if (this.home.ships.every((s) => s.hits === s.size)) {
			return setTimeout(() => this.finish({ win: false, title: 'Fleet lost', message: 'The enemy sank all your ships.', record: false }), 600);
		}
		this.turn = 'player';
	}

	choose() {
		const shots = this.home.shots;
		const free = [...Array(N * N).keys()].filter((i) => !shots[i]);
		const level = this.ctx.settings.difficulty;
		if (level === 'easy') return free[Math.floor(Math.random() * free.length)];
		// follow up unsunk hits: extend a line of two hits, else try their neighbours
		if (this.targets.length) {
			const options = [];
			for (const t of this.targets) {
				for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
					const r = Math.floor(t / N) + dr, c = (t % N) + dc;
					if (r < 0 || r >= N || c < 0 || c >= N) continue;
					const i = r * N + c;
					if (shots[i]) continue;
					const back = (Math.floor(t / N) - dr) * N + (t % N) - dc;
					const inLine = this.targets.includes(back);
					options.push({ i, w: inLine ? 3 : 1 });
				}
			}
			if (options.length) {
				const best = Math.max(...options.map((o) => o.w));
				const top = options.filter((o) => o.w === best);
				return top[Math.floor(Math.random() * top.length)].i;
			}
		}
		if (level === 'normal') {
			const parity = free.filter((i) => (Math.floor(i / N) + (i % N)) % 2 === 0);
			const pool = parity.length ? parity : free;
			return pool[Math.floor(Math.random() * pool.length)];
		}
		// hard: probability density of where the remaining ships could lie
		const density = new Array(N * N).fill(0);
		for (const ship of this.home.ships) {
			if (ship.hits === ship.size) continue;
			for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const horizontal of [true, false]) {
				const cells = [];
				for (let k = 0; k < ship.size; k++) {
					const rr = horizontal ? r : r + k, cc = horizontal ? c + k : c;
					if (rr >= N || cc >= N) break;
					cells.push(rr * N + cc);
				}
				if (cells.length === ship.size && cells.every((i) => shots[i] === 0)) for (const i of cells) density[i]++;
			}
		}
		const best = Math.max(...free.map((i) => density[i]));
		const top = free.filter((i) => density[i] === best);
		return top[Math.floor(Math.random() * top.length)];
	}

	paint() {
		this.enemyCells.forEach((el, i) => {
			const s = this.enemy.shots[i];
			const ship = this.enemy.ships[this.enemy.owner[i]];
			el.className = `fleet-cell${s === 1 ? ' miss' : s === 2 ? ` hit${ship.hits === ship.size ? ' sunk' : ''}` : ''}`;
		});
		this.homeCells.forEach((el, i) => {
			const s = this.home.shots[i];
			const id = this.home.owner[i];
			const ship = this.home.ships[id];
			el.className = `fleet-cell${id >= 0 ? ' ship' : ''}${s === 1 ? ' miss' : s === 2 ? ` hit${ship.hits === ship.size ? ' sunk' : ''}` : ''}`;
		});
		const remaining = (fleet) => fleet.ships.filter((s) => s.hits < s.size).length;
		this.enemyStatus.textContent = `${remaining(this.enemy)} of 5 ships afloat`;
		this.homeStatus.textContent = `${remaining(this.home)} of 5 ships afloat`;
		this.ctx.info(this.turn === 'player' ? 'Your shot' : 'Enemy is aiming…');
	}

	dispose() {
		this.cancel?.();
		this.observer.disconnect();
		this.column.remove();
		this.style.remove();
	}
}

const FLEET_CSS = `
.fleet-layout { display: flex; flex-direction: column; gap: 16px; align-items: center; }
.fleet-layout.wide { flex-direction: row; gap: 28px; }
.fleet-side { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.fleet-side h3 { font-size: 0.9rem; color: var(--color-text-soft); text-transform: uppercase; letter-spacing: 0.1em; }
.fleet-status { font-size: 0.8rem; color: var(--color-text-muted); }
.fleet-grid { display: grid; grid-template-columns: repeat(10, var(--fcell)); gap: 2px; padding: 6px; border-radius: 12px; background: linear-gradient(180deg, #0c4a6e, #082f49); box-shadow: 0 16px 40px -16px var(--color-shadow); transition: box-shadow 0.3s; }
.fleet-cell { width: var(--fcell); height: var(--fcell); padding: 0; border: 0; border-radius: 3px; background: #075985; position: relative; background-image: linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%); background-size: 300% 100%; animation: fleet-water 6s linear infinite; }
@keyframes fleet-water { to { background-position: -300% 0; } }
.enemy.fleet-grid { box-shadow: 0 0 0 2px var(--color-primary), 0 16px 40px -16px var(--color-primary-glow); }
.enemy .fleet-cell { cursor: crosshair; }
.enemy .fleet-cell:hover:not(.miss):not(.hit) { background: #0ea5e9; }
.fleet-cell.ship { background: #94a3b8; }
.fleet-cell.miss::after { content: ''; position: absolute; inset: 35%; border-radius: 50%; background: rgba(255,255,255,0.6); animation: fleet-mark 0.3s cubic-bezier(.34,1.56,.64,1); }
@keyframes fleet-mark { from { transform: scale(2.4); opacity: 0; } }
.fleet-cell.hit { background: #f97316; animation: fleet-hit 0.8s ease-out; }
@keyframes fleet-hit { 0% { background: #fde047; transform: scale(1.3); } }
.fleet-cell.hit::after { content: '✕'; position: absolute; inset: 0; display: grid; place-items: center; color: #fff; font-weight: 900; font-size: calc(var(--fcell) * 0.6); }
.fleet-cell.sunk { background: #b91c1c; }
`;
