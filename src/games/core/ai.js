// Basic game AI shared by the board games: negamax search with alpha-beta pruning over
// any game described by a few functions, plus small helpers for randomness.

/**
 * Finds the best move for the side to move.
 *   moves(state)        legal moves
 *   apply(state, move)  the next state (a new object)
 *   evaluate(state)     score from the point of view of the side to move
 *   terminal(state)     optional: true when the game is over (evaluate then scores it)
 *   noMoves(state, d)   optional: the score when the side to move has no move (mate, stalemate)
 * Returns { move, score }. Moves are shuffled first so equal choices vary between games.
 */
export function negamax(state, depth, game, alpha = -Infinity, beta = Infinity) {
	if (depth === 0 || game.terminal?.(state)) return { move: null, score: game.evaluate(state, depth) };
	const moves = game.order ? game.order(state, game.moves(state)) : shuffle(game.moves(state));
	if (moves.length === 0) return { move: null, score: game.noMoves ? game.noMoves(state, depth) : game.evaluate(state, depth) };
	let best = { move: moves[0], score: -Infinity };
	for (const move of moves) {
		const next = game.apply(state, move);
		// a side that must pass keeps the turn: games signal it with `next.sameSide`
		const child = negamax(next, depth - 1, game, next.sameSide ? alpha : -beta, next.sameSide ? beta : -alpha);
		const score = next.sameSide ? child.score : -child.score;
		if (score > best.score) best = { move, score };
		if (score > alpha) alpha = score;
		if (alpha >= beta) break;
	}
	return best;
}

export function shuffle(list) {
	const a = list.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));

/** Runs `fn` after a short "thinking" pause so AI moves are visible, unless cancelled. */
export function think(fn, ms = 380) {
	const id = setTimeout(fn, ms);
	return () => clearTimeout(id);
}
