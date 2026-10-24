# PocketGames

**Play Instantly. No Downloads.**

Free browser games for everyone: 100 arcade, puzzle, strategy, card, board, racing, ball,
sports, platform, brain-training, fluid and simulation games, 16 of them in 3D. No
installation, no account: just click and play. Frontend only (Vite + vanilla JavaScript);
3D is rendered with [WAMR3D](https://github.com/aymen94/wamr3d) through its Three.js-compatible
`wamr3d/compat` API. Three.js itself is not used.

## Game library

`src/games/registry.js` lists the first 38 games and spreads `EXTRA_GAMES` from
`src/games/registry-extra.js` (every game added since) into `GAMES`: 100 distinct entries,
each with an id, categories, thumbnail art, instructions, settings, a score format and a
lazy `load()`. Grouped by their first category:

- **Arcade** (18): Serpent, Paddle Duel, Brick Breaker, Star Defender, Sky Hopper, Mole Bonk, Neon Runner (3D), Nova Blaster (3D), Skyline Stack (3D), Voxel Breaker (3D), Rock Drift, Rhythm Tap, Sky Strike, Neon Pinball, City Shield, Bubble Burst, Neon Trails, Hyper Tunnel (3D).
- **Puzzle** (18): Number Merge, Block Drop, Minefield, Sudoku, Memory Match, Slide Puzzle, Pixel Logic, Marble Maze (3D), Code Breaker, Balloon Words, Word Search, Lights Off, Pipe Network, Crate Pusher, Zen Tiles, Gem Cascade, Jigsaw, Peg Jump.
- **Strategy** (11): Chess, Checkers, Fleet Strike, Tower Guard, Nim, Dots & Boxes, Mancala, Five in a Row, Hex, Squad Tactics, Maze Defense.
- **Cards** (7): Klondike Solitaire, Spider Solitaire, Blackjack, FreeCell, Pyramid, Crazy Eights, Video Poker.
- **Board Games** (3): Tic-Tac-Toe, Four in a Row, Reversi.
- **Racing & Cars** (6): Traffic Rush (3D), Circuit Racer, Park It, Drift King, Hill Rider, Grand Prix 3D.
- **Sports** (13): Hoop Shot (3D), Penalty Kicks (3D), Strike Lane (3D), Pocket Pool, Mini Golf (3D), Neon Hockey (3D), Tennis, Table Tennis 3D, Beach Volley, Fairway Golf, Darts 301, Longbow, Curling 3D.
- **Platformers** (2): Pixel Peaks, Wall Climber.
- **Action** (1): Swarm Survivor.
- **Brain Training** (3): Echo Pads, Reflex, Make 24.
- **Fluids & Physics** (14): Fluid Playground, Sand Box, Water Flow, Liquid Sort, Fluid Maze, Dig Flow, Magnet Lab, Gravity Well, Chain Reaction, Domino Cascade, Bridge Builder, Marble Run, Moon Lander, Ripple Pond (3D).
- **Simulation** (4): Life Lab, Ant Colony, Ecosystem, Tiny Town.

### Fluids and simulations

The fluid and physics games share engines in `src/games/fluid/`, all plain JavaScript on
preallocated typed arrays (no per-frame allocation):

- `solver.js`: stable fluids (semi-Lagrangian advection, Jacobi pressure projection,
  vorticity confinement, three dye channels, solid cells). Fluid Playground.
- `powder.js`: a falling-sand cellular automaton (sand, water, stone, fire, wood, oil, lava,
  acid, plants, steam) drawn through one ImageData. Sand Box and Dig Flow.
- `liquid.js`: particle liquid (double density relaxation, an SPH approximation, with a
  spatial hash and segment colliders). Water Flow and Fluid Maze.
- `bridge-physics.js`: Verlet beams and joints for Bridge Builder.

Grid resolution, pressure iterations and particle counts follow the graphics quality
(`qualityProfile().fluid` / `.particles`). Levels that a checker verified as solvable live in
DOM-free `*-levels.js` modules. The cellular and agent simulations (Life Lab, Ant Colony,
Ecosystem, Tiny Town) are in `src/games/sim/` and use the same typed-array + ImageData approach.

### Adding a game

Most new 2D games extend `CanvasGame` (`src/games/kit/canvasGame.js`): it creates the scaled
canvas, an optional themed toolbar (`kit/toolbar.js`), pointer events in logical units,
keyboard actions, `CanvasFx` effects and, for turn-based games, a redraw loop that only runs
while something animates; `dispose()` releases all of it. 3D games extend `Game` and build on
`Stage3D` (`engine/stage.js`): shared geometries and materials come from `engine/materials.js`
and are never disposed by a game, while anything a game creates itself is registered with
`stage.own()` and released by `stage.dispose()` together with the scene. Register the game by
appending an entry to `registry-extra.js`; the build adds its chunk to the offline cache.

## Scripts

```sh
npm install
npm run dev       # development server
npm run build     # production build in dist/ (also emits the service worker)
npm run preview   # serve the production build
npm run icons     # regenerate the PNG app icons from scripts/make-icons.mjs
```

The build uses a relative base, so `dist/` works from any sub-path on any static host.
Set `BASE_PATH=/some/path/` to build for a fixed sub-path instead.

## Graphics settings

The gear icon on the home screen chooses:

- **Quality**: Minimum (0.75× resolution, no anti-aliasing, shadows or bloom, 40% particles,
  coarse simulations), Medium (up to 1.5× resolution with anti-aliasing, 75% particles) or
  High (up to 2× resolution, anti-aliasing, WAMR3D bloom, shadows on stages that opt in,
  full particles and the finest simulations).
- **Rendering engine**: Auto (WebGPU, falling back to WebGL 2), WebGPU only, or WebGL 2 only.

The levels are defined once in `src/services/graphics.js`. The renderer, `Stage3D`, 2D
canvases, particle effects and simulations read `qualityProfile()` and follow
`onGraphicsChange()`, so a quality change applies immediately without reloading. Only an
engine change reloads, because WAMR3D fixes the backend when the GPU context is created.
MSAA is fixed then as well, so a stage that wants anti-aliasing without it (or behind
post-processing, whose targets are single-sampled) adds an FXAA pass instead.

## Themes

The palette button next to the gear (on the home screen and in every game's header) and
the settings panel switch the whole site between Midnight, Neon Arcade, Cyberpunk, Emerald,
Sunset, Light, Monochrome and Custom. Custom takes one accent colour plus a Dark, Graphite
or Light base and derives hover, active, focus, surfaces and text from it, checking WCAG
contrast as it goes.

- Tokens live in `src/styles/themes.css` as CSS custom properties under `[data-theme]` on
  `<html>`; derived tokens (soft fills, glows, glass, scrims) are mixed with `color-mix()`.
  All UI styles in `main.css` and the DOM games use the tokens.
- `src/services/theme.js` is the theme manager: it lists themes, applies and persists the
  choice (its own `pocketgames:theme` key, independent of graphics settings and scores),
  builds the Custom tokens and notifies listeners. An inline script in `index.html` restores
  the saved theme before first paint, so there is no flash of the default.
- Themes change instantly, never reload, and never touch game state. 2D games pick up
  `colors.accent*` from `games/core/canvas.js`; 3D games use `themed()` materials from
  `engine/materials.js` for trim and accents. Game pieces (cards, chess men, team colours)
  keep fixed colours so they stay recognisable.

## Effects

Games share effect utilities instead of carrying their own:

- `src/games/core/fx.js`: pooled 2D particles in several shapes (sparks, debris, confetti,
  stars, rings, smoke, dust), floating score text, trails, flashes, shake, tweens/easing and
  an `Animator` that only runs while something animates (for turn-based canvas games).
- `src/components/fxLayer.js`: an overlay on every game screen, exposed as `ctx.fx`
  (bursts at elements, banners, confetti, flashes, shake, "nope" wiggles).
- `src/engine/effects.js`: instanced 3D particles, `Trail3D`, starfields and camera shake.
- `src/games/core/cards.js`: card dealing, gliding moves and flips for the solitaires.

Particle counts follow the quality setting, and `prefers-reduced-motion` turns off shake,
reduces particles and shortens animations.

## Sound

Effects play recorded samples and fall back to Web Audio synthesis until a sample has loaded, or for effects without one. Samples load after the first user gesture and are precached for offline play.

## Offline

The service worker precaches the app shell, every game chunk and the WAMR3D WebAssembly
module. The first visit needs a connection; after the worker has installed ("Offline ready"
in the top bar) every game plays offline. The service worker only runs in production builds.

## Structure

```text
src/
  app/          dashboard, routing, settings panel
  styles/       themes.css (design tokens per theme) and main.css
  components/   game cards, thumbnails, the game screen (header, overlays, touch pad)
  engine/       WAMR3D init and shared renderer, Stage3D, materials, effects, loop, input
  games/        registry.js + registry-extra.js, core/ (game contract, canvas, grid, AI,
                physics, cards, timers), kit/ (CanvasGame base and toolbar), fluid/ (fluid
                engines and fluid games), sim/ (simulations), and one module per game,
                grouped by category
  hero/         the dashboard's 3D hero scene
  services/     storage, audio (samples + synthesis), graphics settings, theme manager, PWA
  pwa/          service worker template
```

Every game implements the contract in `src/games/core/game.js` and is lazy-loaded from
`src/games/registry.js`.
