// Everything PocketGames remembers lives in one localStorage record: favorites, recently
// played games, play counts, best scores, settings and saved progress. Reads and writes
// are wrapped so a private window or blocked storage only means nothing is remembered.

const KEY = 'pocketgames:v1';
const listeners = new Set();

function blank() {
	return { favorites: [], recent: [], plays: {}, best: {}, settings: { sound: true, games: {}, graphics: { quality: 'medium', backend: 'auto' } }, progress: {} };
}

function load() {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return blank();
		const data = { ...blank(), ...JSON.parse(raw) };
		data.settings = { ...blank().settings, ...data.settings };
		return data;
	} catch {
		return blank();
	}
}

const state = load();

function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// storage full or unavailable: keep playing with in-memory state
	}
	for (const fn of listeners) fn(state);
}

export const store = {
	get state() { return state; },
	save,
	subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

	isFavorite: (id) => state.favorites.includes(id),
	toggleFavorite(id) {
		const i = state.favorites.indexOf(id);
		if (i >= 0) state.favorites.splice(i, 1);
		else state.favorites.unshift(id);
		save();
		return i < 0;
	},

	recordPlay(id) {
		state.recent = [id, ...state.recent.filter((r) => r !== id)].slice(0, 12);
		state.plays[id] = (state.plays[id] ?? 0) + 1;
		save();
	},

	best: (id) => state.best[id] ?? null,
	/** Stores `score` if it beats the best; `lowerIsBetter` for times and move counts. Returns true on a new record. */
	submitScore(id, score, lowerIsBetter = false) {
		const best = state.best[id];
		const better = best == null || (lowerIsBetter ? score < best : score > best);
		if (better) {
			state.best[id] = score;
			save();
		}
		return better;
	},

	get sound() { return state.settings.sound; },
	set sound(on) { state.settings.sound = on; save(); },

	gameSettings: (id) => state.settings.games[id] ?? {},
	setGameSettings(id, values) { state.settings.games[id] = values; save(); },

	progress: (id) => state.progress[id] ?? null,
	saveProgress(id, data) {
		if (data == null) delete state.progress[id];
		else state.progress[id] = { data, at: Date.now() };
		save();
	},
};
