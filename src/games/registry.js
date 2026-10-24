// Every game PocketGames ships, with the metadata the dashboard and the game screen need.
// Game code is loaded on demand: each `load` is a separate chunk, precached for offline play.
//
// Fields: id, title, blurb, categories, art (thumbnail colors and icon), three (uses WAMR3D),
// popularity (curated, 0–100), isNew, instructions, controls, touch ('dpad' | 'lr' | 'lra' |
// null — on-screen buttons on touch screens), pausable, settings, score ({ label,
// lowerIsBetter, format }), load.

import { EXTRA_GAMES } from './registry-extra.js';

export const CATEGORIES = [
	{ id: 'arcade', label: 'Arcade' },
	{ id: 'puzzle', label: 'Puzzle' },
	{ id: 'strategy', label: 'Strategy' },
	{ id: 'cards', label: 'Cards' },
	{ id: 'board', label: 'Board Games' },
	{ id: 'racing', label: 'Racing & Cars' },
	{ id: 'ball', label: 'Ball Games' },
	{ id: 'sports', label: 'Sports' },
	{ id: 'platformer', label: 'Platformers' },
	{ id: 'action', label: 'Action' },
	{ id: 'brain', label: 'Brain Training' },
	{ id: 'classic', label: 'Classic Games' },
	{ id: 'fluid', label: 'Fluids & Physics' },
	{ id: 'simulation', label: 'Simulation' },
];

const difficulty = (fallback = 'normal') => ({
	key: 'difficulty', label: 'Difficulty', default: fallback,
	options: [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']],
});

const seconds = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const GAMES = [
	// ------------------------------------------------------------ arcade
	{
		id: 'serpent', title: 'Serpent', blurb: 'Eat, grow longer and never bite your own tail.',
		categories: ['arcade', 'classic'], art: { from: '#10b981', to: '#0e7490', icon: 'snake' }, popularity: 92,
		instructions: ['Steer the serpent to the glowing fruit.', 'Each fruit makes you longer and faster.', 'Hitting yourself (or a wall, in Walls mode) ends the run.'],
		controls: 'Arrow keys / WASD, or swipe', touch: 'dpad', pausable: true,
		settings: [
			{ key: 'speed', label: 'Speed', default: 'normal', options: [['slow', 'Relaxed'], ['normal', 'Normal'], ['fast', 'Fast']] },
			{ key: 'walls', label: 'Edges', default: 'wrap', options: [['wrap', 'Wrap around'], ['solid', 'Solid walls']] },
		],
		score: { label: 'Score' }, load: () => import('./arcade/serpent.js'),
	},
	{
		id: 'paddle-duel', title: 'Paddle Duel', blurb: 'A fast table-tennis duel against an adaptive rival.',
		categories: ['arcade', 'classic', 'ball', 'sports'], art: { from: '#6366f1', to: '#0f172a', icon: 'paddle' }, popularity: 78,
		instructions: ['Move your paddle (left) to return the ball.', 'Hitting with the paddle edge sends sharper angles.', 'First to the target score wins.'],
		controls: 'Up/Down or W/S, mouse or drag', touch: null, pausable: true,
		settings: [difficulty(), { key: 'target', label: 'Points to win', default: '7', options: [['5', '5'], ['7', '7'], ['11', '11']] }],
		score: { label: 'Points' }, load: () => import('./arcade/paddle-duel.js'),
	},
	{
		id: 'brick-breaker', title: 'Brick Breaker', blurb: 'Bounce the ball, smash every brick, catch the power-ups.',
		categories: ['arcade', 'ball', 'classic'], art: { from: '#f472b6', to: '#7c3aed', icon: 'bricks' }, popularity: 88,
		instructions: ['Move the paddle to keep the ball in play.', 'Clear all bricks to reach the next level.', 'Catch falling capsules: wide paddle, multi-ball, slow ball.'],
		controls: 'Mouse / drag, or Left/Right. Space launches.', touch: null, pausable: true,
		settings: [{ key: 'lives', label: 'Lives', default: '3', options: [['3', '3'], ['5', '5']] }],
		score: { label: 'Score' }, load: () => import('./arcade/brick-breaker.js'),
	},
	{
		id: 'star-defender', title: 'Star Defender', blurb: 'Hold the line against descending drone fleets.',
		categories: ['arcade', 'action'], art: { from: '#0ea5e9', to: '#1e1b4b', icon: 'ship' }, popularity: 85,
		instructions: ['Move your ship and fire up at the drone formation.', 'Drones drop bolts; shields absorb a few hits.', 'Clear a wave to face a faster one. Do not let them land.'],
		controls: 'Left/Right to move, Space to fire (hold for auto-fire)', touch: 'lra', pausable: true,
		settings: [difficulty()], score: { label: 'Score' }, load: () => import('./arcade/star-defender.js'),
	},
	{
		id: 'sky-hopper', title: 'Sky Hopper', blurb: 'Flap a paper plane through the gaps between cloud towers.',
		categories: ['arcade'], art: { from: '#38bdf8', to: '#f0abfc', icon: 'plane' }, popularity: 83,
		instructions: ['Tap, click or press Space to lift the plane.', 'Glide through the gaps between towers.', 'Each tower passed scores a point.'],
		controls: 'Space / click / tap', touch: null, pausable: true,
		settings: [{ key: 'gap', label: 'Gap size', default: 'normal', options: [['wide', 'Wide'], ['normal', 'Normal'], ['tight', 'Tight']] }],
		score: { label: 'Gates' }, load: () => import('./arcade/sky-hopper.js'),
	},
	{
		id: 'mole-bonk', title: 'Mole Bonk', blurb: 'Bonk the moles before they duck back down. Spare the bunnies!',
		categories: ['arcade', 'brain'], art: { from: '#a3e635', to: '#15803d', icon: 'mole' }, popularity: 70,
		instructions: ['Tap moles as they pop up for points.', 'Golden moles are worth triple.', 'Hitting a bunny costs points. Score as much as you can before time runs out.'],
		controls: 'Click / tap, or number keys 1–9', touch: null, pausable: true,
		settings: [{ key: 'time', label: 'Round length', default: '45', options: [['30', '30 s'], ['45', '45 s'], ['60', '60 s']] }],
		score: { label: 'Score' }, load: () => import('./arcade/mole-bonk.js'),
	},
	{
		id: 'neon-runner', title: 'Neon Runner', blurb: 'Dash down a glowing 3D track, switching lanes and leaping barriers.',
		categories: ['arcade', 'action'], art: { from: '#8b5cf6', to: '#0f172a', icon: 'runner' }, three: true, popularity: 94, isNew: true,
		instructions: ['Switch lanes to dodge blocks and collect orbs.', 'Jump over low barriers.', 'The track speeds up the further you run.'],
		controls: 'Left/Right to change lane, Up/Space to jump, or swipe', touch: 'dpad', pausable: true,
		settings: [], score: { label: 'Distance' }, load: () => import('./arcade/neon-runner.js'),
	},

	{
		id: 'nova-blaster', title: 'Nova Blaster', blurb: 'Blast through asteroid storms and drone squadrons in full 3D.',
		categories: ['arcade', 'action'], art: { from: '#7c3aed', to: '#020617', icon: 'nova' }, three: true, popularity: 93, isNew: true,
		instructions: ['Steer your ship and fire at the asteroids and drones rushing at you.', 'Big rocks take several hits; drones shoot back.', 'Catch golden crystals for triple shot. Three hits and your hull breaks.'],
		controls: 'Arrows / WASD to fly, Space to fire, or drag (auto-fire while touching)', touch: 'lra', pausable: true,
		settings: [], score: { label: 'Score' }, load: () => import('./arcade/nova-blaster.js'),
	},
	{
		id: 'skyline-stack', title: 'Skyline Stack', blurb: 'Drop sliding slabs to build the tallest tower. Perfect drops sparkle.',
		categories: ['arcade', 'puzzle'], art: { from: '#f472b6', to: '#312e81', icon: 'stack' }, three: true, popularity: 89, isNew: true,
		instructions: ['A slab slides back and forth over the tower.', 'Drop it: whatever hangs over the edge is sliced off.', 'Perfect drops keep the full size; a streak of them grows it back.'],
		controls: 'Tap, click or Space', touch: null, pausable: true,
		settings: [], score: { label: 'Height' }, load: () => import('./arcade/skyline-stack.js'),
	},
	{
		id: 'voxel-breaker', title: 'Voxel Breaker', blurb: 'Smash a 3D wall of voxels one glowing bounce at a time.',
		categories: ['arcade', 'ball', 'action'], art: { from: '#22d3ee', to: '#1e1b4b', icon: 'voxel' }, three: true, popularity: 86, isNew: true,
		instructions: ['Bounce the ball off your paddle into the voxel wall.', 'Each hit knocks one block off a column; taller columns take more hits.', 'Clear the field to reach the next level. Do not let the ball past you.'],
		controls: 'Mouse / drag or Left/Right, Space or tap to launch', touch: null, pausable: true,
		settings: [], score: { label: 'Score' }, load: () => import('./arcade/voxel-breaker.js'),
	},

	// ------------------------------------------------------------ puzzle
	{
		id: 'number-merge', title: 'Number Merge', blurb: 'Slide the board and merge matching numbers to reach 2048.',
		categories: ['puzzle', 'brain'], art: { from: '#fbbf24', to: '#ea580c', icon: 'merge' }, popularity: 90, resumable: true,
		instructions: ['Every move slides all tiles in one direction.', 'Two equal tiles that meet merge into their sum.', 'Reach 2048 to win; the game ends when no move is left.'],
		controls: 'Arrow keys / WASD, or swipe', touch: null, pausable: false,
		settings: [{ key: 'size', label: 'Board', default: '4', options: [['4', '4 × 4'], ['5', '5 × 5'], ['3', '3 × 3 (hard)']] }],
		score: { label: 'Score' }, load: () => import('./puzzle/number-merge.js'),
	},
	{
		id: 'block-drop', title: 'Block Drop', blurb: 'Rotate falling pieces and complete lines to clear them.',
		categories: ['puzzle', 'classic', 'arcade'], art: { from: '#22d3ee', to: '#4338ca', icon: 'blocks' }, popularity: 95,
		instructions: ['Move and rotate the falling pieces.', 'Fill a whole row to clear it; several at once score more.', 'The pace rises every 10 lines. Do not let the stack reach the top.'],
		controls: 'Left/Right move, Up rotate, Down soft drop, Space hard drop', touch: 'dpad', pausable: true,
		settings: [{ key: 'start', label: 'Starting level', default: '1', options: [['1', '1'], ['5', '5'], ['10', '10']] }],
		score: { label: 'Score' }, load: () => import('./puzzle/block-drop.js'),
	},
	{
		id: 'minefield', title: 'Minefield', blurb: 'Uncover the field using number clues without setting off a mine.',
		categories: ['puzzle', 'classic', 'brain'], art: { from: '#64748b', to: '#0f172a', icon: 'mine' }, popularity: 80, resumable: false,
		instructions: ['Reveal a cell; numbers count the mines in the 8 cells around it.', 'Right-click or long-press (or use Flag mode) to flag a mine.', 'Reveal every safe cell to win. The first click is always safe.'],
		controls: 'Click to reveal, right-click / long-press to flag', touch: null, pausable: true,
		settings: [{ key: 'level', label: 'Field', default: 'easy', options: [['easy', 'Easy 9 × 9'], ['medium', 'Medium 12 × 12'], ['hard', 'Hard 16 × 16']] }],
		score: { label: 'Time', lowerIsBetter: true, format: seconds }, load: () => import('./puzzle/minefield.js'),
	},
	{
		id: 'sudoku', title: 'Sudoku', blurb: 'Fill the grid so every row, column and box holds 1 to 9.',
		categories: ['puzzle', 'brain', 'classic'], art: { from: '#a78bfa', to: '#312e81', icon: 'sudoku' }, popularity: 86, resumable: true,
		instructions: ['Each row, column and 3 × 3 box must contain 1–9 once.', 'Select a cell, then a number. Notes mode pencils in candidates.', 'Mistakes are highlighted. Every puzzle has exactly one solution.'],
		controls: 'Click a cell, then 1–9 (keyboard or pad). Arrows move.', touch: null, pausable: true,
		settings: [{ key: 'level', label: 'Difficulty', default: 'easy', options: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']] }],
		score: { label: 'Time', lowerIsBetter: true, format: seconds }, load: () => import('./puzzle/sudoku.js'),
	},
	{
		id: 'memory-match', title: 'Memory Match', blurb: 'Flip cards two at a time and find every matching pair.',
		categories: ['puzzle', 'brain', 'cards'], art: { from: '#fb7185', to: '#9d174d', icon: 'memory' }, popularity: 74,
		instructions: ['Flip two cards per turn.', 'Matching pairs stay face up.', 'Clear the board in as few moves as you can.'],
		controls: 'Click / tap cards', touch: null, pausable: false,
		settings: [{ key: 'pairs', label: 'Pairs', default: '8', options: [['6', '6 pairs'], ['8', '8 pairs'], ['12', '12 pairs']] }],
		score: { label: 'Moves', lowerIsBetter: true }, load: () => import('./puzzle/memory-match.js'),
	},
	{
		id: 'slide-puzzle', title: 'Slide Puzzle', blurb: 'Slide the numbered tiles back into order.',
		categories: ['puzzle', 'brain', 'classic'], art: { from: '#2dd4bf', to: '#115e59', icon: 'slide' }, popularity: 62, resumable: true,
		instructions: ['Tap a tile next to the gap to slide it.', 'Put the tiles in order, left to right, top to bottom.', 'Fewer moves is better.'],
		controls: 'Click / tap tiles, or arrow keys', touch: null, pausable: false,
		settings: [{ key: 'size', label: 'Board', default: '4', options: [['3', '3 × 3'], ['4', '4 × 4'], ['5', '5 × 5']] }],
		score: { label: 'Moves', lowerIsBetter: true }, load: () => import('./puzzle/slide-puzzle.js'),
	},
	{
		id: 'pixel-logic', title: 'Pixel Logic', blurb: 'Use row and column clues to paint the hidden picture.',
		categories: ['puzzle', 'brain'], art: { from: '#f59e0b', to: '#7c2d12', icon: 'nonogram' }, popularity: 66, isNew: true, resumable: true,
		instructions: ['Numbers give the runs of filled cells in each row and column, in order.', 'Fill cells that must be painted; mark the ones that must stay empty.', 'Solve the grid when every row and column matches its clues.'],
		controls: 'Click to fill, right-click / Mark mode to cross out. Drag to paint.', touch: null, pausable: false,
		settings: [{ key: 'size', label: 'Grid', default: '8', options: [['5', '5 × 5'], ['8', '8 × 8'], ['10', '10 × 10']] }],
		score: { label: 'Time', lowerIsBetter: true, format: seconds }, load: () => import('./puzzle/pixel-logic.js'),
	},

	{
		id: 'marble-maze', title: 'Marble Maze', blurb: 'Tilt a wooden labyrinth to roll the marble past the holes.',
		categories: ['puzzle', 'ball', 'brain'], art: { from: '#d97706', to: '#451a03', icon: 'maze' }, three: true, popularity: 82, isNew: true,
		instructions: ['Tilt the board to roll the marble.', 'Avoid the holes, collect the gems and reach the glowing goal.', 'You have five marbles for four boards.'],
		controls: 'Arrow keys / WASD, or drag to tilt', touch: 'dpad', pausable: true,
		settings: [], score: { label: 'Gems' }, load: () => import('./puzzle/marble-maze.js'),
	},

	// ------------------------------------------------------------ strategy & board
	{
		id: 'chess', title: 'Chess', blurb: 'The full game of chess against a computer opponent.',
		categories: ['strategy', 'board', 'classic', 'brain'], art: { from: '#e2e8f0', to: '#334155', icon: 'chess' }, popularity: 91, resumable: true,
		instructions: ['You play White. Select a piece, then a highlighted square.', 'Castling, en passant and promotion are supported.', 'Checkmate the black king to win.'],
		controls: 'Click / tap to select and move', touch: null, pausable: false,
		settings: [difficulty(), { key: 'mode', label: 'Opponent', default: 'cpu', options: [['cpu', 'Computer'], ['local', 'Two players']] }],
		score: null, load: () => import('./strategy/chess.js'),
	},
	{
		id: 'checkers', title: 'Checkers', blurb: 'Jump and crown your way across the board.',
		categories: ['strategy', 'board', 'classic'], art: { from: '#ef4444', to: '#1f2937', icon: 'checkers' }, popularity: 72,
		instructions: ['Move diagonally forward onto dark squares.', 'Captures are mandatory, and multiple jumps chain.', 'Reach the far row to crown a king. Capture or block every enemy piece to win.'],
		controls: 'Click / tap a piece, then its destination', touch: null, pausable: false,
		settings: [difficulty(), { key: 'mode', label: 'Opponent', default: 'cpu', options: [['cpu', 'Computer'], ['local', 'Two players']] }],
		score: null, load: () => import('./strategy/checkers.js'),
	},
	{
		id: 'tic-tac-toe', title: 'Tic-Tac-Toe', blurb: 'Three in a row on a 3 × 3 grid. Can you beat the perfect AI?',
		categories: ['board', 'classic', 'strategy'], art: { from: '#38bdf8', to: '#1d4ed8', icon: 'ttt' }, popularity: 68,
		instructions: ['Take turns placing X and O.', 'Three of yours in a row, column or diagonal wins.', 'On Hard the computer never loses.'],
		controls: 'Click / tap, or keys 1–9', touch: null, pausable: false,
		settings: [difficulty(), { key: 'mode', label: 'Opponent', default: 'cpu', options: [['cpu', 'Computer'], ['local', 'Two players']] }],
		score: { label: 'Wins' }, load: () => import('./strategy/tic-tac-toe.js'),
	},
	{
		id: 'four-in-a-row', title: 'Four in a Row', blurb: 'Drop discs into the grid and connect four before your rival.',
		categories: ['board', 'strategy', 'classic'], art: { from: '#facc15', to: '#dc2626', icon: 'four' }, popularity: 79,
		instructions: ['Drop a disc into any column that has space.', 'Line up four of your discs in any direction.', 'Block your opponent from doing the same.'],
		controls: 'Click / tap a column, or keys 1–7', touch: null, pausable: false,
		settings: [difficulty(), { key: 'mode', label: 'Opponent', default: 'cpu', options: [['cpu', 'Computer'], ['local', 'Two players']] }],
		score: null, load: () => import('./strategy/four-in-a-row.js'),
	},
	{
		id: 'reversi', title: 'Reversi', blurb: 'Outflank and flip your opponent’s discs to take the board.',
		categories: ['board', 'strategy', 'classic'], art: { from: '#22c55e', to: '#14532d', icon: 'reversi' }, popularity: 64,
		instructions: ['Place a disc so it sandwiches enemy discs in a line.', 'Every sandwiched disc flips to your colour.', 'If you cannot move, you pass. Most discs at the end wins.'],
		controls: 'Click / tap a highlighted square', touch: null, pausable: false,
		settings: [difficulty(), { key: 'mode', label: 'Opponent', default: 'cpu', options: [['cpu', 'Computer'], ['local', 'Two players']] }],
		score: { label: 'Discs' }, load: () => import('./strategy/reversi.js'),
	},
	{
		id: 'fleet-strike', title: 'Fleet Strike', blurb: 'Hide your fleet and hunt the enemy ships across the sea.',
		categories: ['strategy', 'board'], art: { from: '#0ea5e9', to: '#0c4a6e', icon: 'fleet' }, popularity: 69,
		instructions: ['Your fleet is placed for you (tap Shuffle to rearrange).', 'Fire at the enemy grid; the computer fires back.', 'Sink all five enemy ships first.'],
		controls: 'Click / tap the enemy grid', touch: null, pausable: false,
		settings: [difficulty()], score: { label: 'Shots', lowerIsBetter: true }, load: () => import('./strategy/fleet-strike.js'),
	},
	{
		id: 'tower-guard', title: 'Tower Guard', blurb: 'Build towers along the path and stop every wave of invaders.',
		categories: ['strategy', 'action'], art: { from: '#f97316', to: '#422006', icon: 'tower' }, popularity: 81, isNew: true,
		instructions: ['Pick a tower type and tap a grass tile to build it.', 'Enemies follow the road; each one that escapes costs a life.', 'Earn coins from kills, upgrade towers by tapping them, survive 15 waves.'],
		controls: 'Click / tap to build and upgrade', touch: null, pausable: true,
		settings: [difficulty()], score: { label: 'Waves' }, load: () => import('./strategy/tower-guard.js'),
	},

	// ------------------------------------------------------------ cards
	{
		id: 'klondike', title: 'Klondike Solitaire', blurb: 'The classic patience game: build the foundations from Ace to King.',
		categories: ['cards', 'classic'], art: { from: '#16a34a', to: '#14532d', icon: 'cardsK' }, popularity: 89, resumable: true,
		instructions: ['Build tableau columns down in alternating colours.', 'Move Aces up to the foundations and build each suit to King.', 'Tap the stock to draw. Tap a card to auto-move it.'],
		controls: 'Drag cards, or tap to auto-move', touch: null, pausable: false,
		settings: [{ key: 'draw', label: 'Draw', default: '1', options: [['1', 'One card'], ['3', 'Three cards']] }],
		score: { label: 'Moves', lowerIsBetter: true }, load: () => import('./cards/klondike.js'),
	},
	{
		id: 'spider', title: 'Spider Solitaire', blurb: 'Arrange runs from King down to Ace to clear all eight suits.',
		categories: ['cards', 'classic'], art: { from: '#334155', to: '#020617', icon: 'spider' }, popularity: 76, resumable: true,
		instructions: ['Build down regardless of suit; only same-suit runs move together.', 'A full King-to-Ace run of one suit is cleared.', 'Tap the stock to deal a new row (every column needs a card).'],
		controls: 'Drag runs, or tap to auto-move', touch: null, pausable: false,
		settings: [{ key: 'suits', label: 'Suits', default: '1', options: [['1', 'One suit'], ['2', 'Two suits'], ['4', 'Four suits']] }],
		score: { label: 'Moves', lowerIsBetter: true }, load: () => import('./cards/spider.js'),
	},
	{
		id: 'blackjack', title: 'Blackjack', blurb: 'Beat the dealer to 21 without going bust.',
		categories: ['cards', 'classic'], art: { from: '#b91c1c', to: '#1c1917', icon: 'cardsBJ' }, popularity: 77,
		instructions: ['Place a bet, then Hit for cards or Stand.', 'Double down on your first two cards. Blackjack pays 3:2.', 'The dealer draws to 17. Grow your chips as high as you can.'],
		controls: 'Buttons, or H (hit), S (stand), D (double)', touch: null, pausable: false,
		settings: [], score: { label: 'Chips' }, load: () => import('./cards/blackjack.js'),
	},

	// ------------------------------------------------------------ racing & cars
	{
		id: 'traffic-rush', title: 'Traffic Rush', blurb: 'Weave through highway traffic in 3D at ever-rising speed.',
		categories: ['racing', 'arcade', 'action'], art: { from: '#f43f5e', to: '#1e293b', icon: 'car' }, three: true, popularity: 87, isNew: true,
		instructions: ['Steer between lanes to avoid the traffic.', 'Near misses earn bonus points.', 'Speed rises over time; one crash ends the run.'],
		controls: 'Left/Right or A/D, or tap the sides', touch: 'lr', pausable: true,
		settings: [{ key: 'traffic', label: 'Traffic', default: 'normal', options: [['light', 'Light'], ['normal', 'Normal'], ['heavy', 'Heavy']] }],
		score: { label: 'Score' }, load: () => import('./racing/traffic-rush.js'),
	},
	{
		id: 'circuit-racer', title: 'Circuit Racer', blurb: 'Top-down arcade racing: three laps against three rivals.',
		categories: ['racing', 'sports'], art: { from: '#eab308', to: '#1f2937', icon: 'race' }, popularity: 73,
		instructions: ['Accelerate, brake and steer around the circuit.', 'Stay on the asphalt: the grass slows you down.', 'Finish three laps ahead of the rivals.'],
		controls: 'Up accelerate, Down brake, Left/Right steer', touch: 'dpad', pausable: true,
		settings: [{ key: 'track', label: 'Track', default: 'oval', options: [['oval', 'Speed Oval'], ['hairpin', 'Hairpin Park'], ['figure', 'Twin Loop']] }, difficulty()],
		score: { label: 'Best lap', lowerIsBetter: true, format: (s) => `${s.toFixed(2)} s` }, load: () => import('./racing/circuit-racer.js'),
	},
	{
		id: 'park-it', title: 'Park It', blurb: 'Precision parking challenges: slot the car without a scratch.',
		categories: ['racing', 'brain'], art: { from: '#14b8a6', to: '#134e4a', icon: 'parking' }, popularity: 60,
		instructions: ['Drive into the glowing bay and stop inside it.', 'Touching cars or walls costs a life of the level.', 'Eight levels, each tighter than the last.'],
		controls: 'Up/Down drive and reverse, Left/Right steer', touch: 'dpad', pausable: true,
		settings: [], score: { label: 'Stars' }, load: () => import('./racing/park-it.js'),
	},

	// ------------------------------------------------------------ ball & sports
	{
		id: 'hoop-shot', title: 'Hoop Shot', blurb: 'Swipe to shoot baskets in a 3D arena before the clock runs out.',
		categories: ['sports', 'ball'], art: { from: '#fb923c', to: '#7c2d12', icon: 'hoop' }, three: true, popularity: 84,
		instructions: ['Swipe up (or drag and release) to shoot; aim with the swipe direction.', 'A longer swipe throws harder.', 'Swish streaks double your points. Score as many as you can in 60 seconds.'],
		controls: 'Swipe / drag up to shoot', touch: null, pausable: true,
		settings: [{ key: 'time', label: 'Clock', default: '60', options: [['45', '45 s'], ['60', '60 s'], ['90', '90 s']] }],
		score: { label: 'Points' }, load: () => import('./sports/hoop-shot.js'),
	},
	{
		id: 'penalty-kicks', title: 'Penalty Kicks', blurb: 'A five-round shootout: shoot past the keeper, then save theirs.',
		categories: ['sports', 'ball'], art: { from: '#22c55e', to: '#064e3b', icon: 'soccer' }, three: true, popularity: 82,
		instructions: ['When shooting, tap where in the goal to aim, then the power meter sets the strength.', 'When defending, tap left, centre or right to dive.', 'After five rounds each, the most goals wins (then sudden death).'],
		controls: 'Click / tap', touch: null, pausable: true,
		settings: [difficulty()], score: { label: 'Goals' }, load: () => import('./sports/penalty-kicks.js'),
	},
	{
		id: 'bowling', title: 'Strike Lane', blurb: 'Ten frames of 3D bowling: aim, spin and knock down the pins.',
		categories: ['sports', 'ball'], art: { from: '#60a5fa', to: '#1e3a8a', icon: 'bowling' }, three: true, popularity: 75,
		instructions: ['Drag to position the ball, then swipe forward to roll.', 'Curve your swipe to add hook.', 'Standard ten-pin scoring with strikes and spares.'],
		controls: 'Drag / swipe, or Left/Right then Space', touch: null, pausable: true,
		settings: [], score: { label: 'Score' }, load: () => import('./sports/bowling.js'),
	},
	{
		id: 'pool', title: 'Pocket Pool', blurb: 'Clear the table of nine balls in as few shots as possible.',
		categories: ['sports', 'ball', 'classic'], art: { from: '#059669', to: '#022c22', icon: 'pool' }, popularity: 71,
		instructions: ['Drag back from the cue ball to aim and set power, then release.', 'Pot all nine balls. Potting the cue ball adds two penalty shots.', 'Fewer shots is better.'],
		controls: 'Drag from the cue ball and release', touch: null, pausable: false,
		settings: [], score: { label: 'Shots', lowerIsBetter: true }, load: () => import('./sports/pool.js'),
	},
	{
		id: 'mini-golf', title: 'Mini Golf', blurb: 'Nine playful holes of 3D putting with ramps and bumpers.',
		categories: ['sports', 'ball'], art: { from: '#4ade80', to: '#166534', icon: 'golf' }, three: true, popularity: 80, isNew: true,
		instructions: ['Drag back from the ball to aim and set power, then release.', 'Bank shots off the walls around obstacles.', 'Sink the ball in the cup in as few strokes as you can.'],
		controls: 'Drag and release', touch: null, pausable: false,
		settings: [], score: { label: 'Strokes', lowerIsBetter: true }, load: () => import('./sports/mini-golf.js'),
	},

	{
		id: 'neon-hockey', title: 'Neon Hockey', blurb: 'Air hockey on a glowing 3D table. First to seven wins.',
		categories: ['sports', 'ball', 'action'], art: { from: '#ec4899', to: '#0c0a29', icon: 'hockey' }, three: true, popularity: 85, isNew: true,
		instructions: ['Move your mallet (blue) on your half of the table.', 'Hit the puck into the computer’s goal; defend yours.', 'First to seven goals wins the match.'],
		controls: 'Mouse / finger, or arrow keys', touch: null, pausable: true,
		settings: [difficulty()], score: { label: 'Goals' }, load: () => import('./sports/neon-hockey.js'),
	},

	// ------------------------------------------------------------ platformer
	{
		id: 'pixel-peaks', title: 'Pixel Peaks', blurb: 'Run, jump and collect gems across hand-built mountain levels.',
		categories: ['platformer', 'action', 'arcade'], art: { from: '#c084fc', to: '#3b0764', icon: 'platform' }, popularity: 77, isNew: true,
		instructions: ['Run and jump across platforms to the flag.', 'Collect gems; stomp critters from above.', 'Spikes and pits cost a life.'],
		controls: 'Left/Right to run, Up/Space to jump', touch: 'lra', pausable: true,
		settings: [], score: { label: 'Gems' }, load: () => import('./platform/pixel-peaks.js'),
	},
	// the games added after the first 38 live in registry-extra.js
	...EXTRA_GAMES,
];

export const gameById = new Map(GAMES.map((g) => [g.id, g]));
export const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label ?? id;
