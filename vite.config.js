import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Lists every file under `dir`, as forward-slash paths relative to it. */
function listFiles(dir, root = dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).replaceAll('\\', '/')];
	});
}

/**
 * Emits `sw.js` with the full list of built files, so every game (including the
 * lazily loaded chunks and the WAMR3D WebAssembly module) is precached for offline play.
 */
function serviceWorker() {
	return {
		name: 'pocketgames-service-worker',
		apply: 'build',
		generateBundle(_options, bundle) {
			const publicFiles = listFiles('public');
			const files = [...Object.keys(bundle), ...publicFiles].filter((f) => f !== 'sw.js').sort();
			const hash = createHash('sha256');
			for (const name of files) hash.update(name);
			for (const name of publicFiles) hash.update(readFileSync(join('public', name)));
			for (const chunk of Object.values(bundle)) hash.update(chunk.type === 'chunk' ? chunk.code : chunk.source);
			const version = hash.digest('hex').slice(0, 12);
			const template = readFileSync('src/pwa/sw-template.js', 'utf8');
			const source = template
				.replace('__VERSION__', version)
				.replace('__ASSETS__', JSON.stringify(['./', ...files.map((f) => `./${f}`)]));
			this.emitFile({ type: 'asset', fileName: 'sw.js', source });
		},
	};
}

export default defineConfig({
	// Relative base by default: the app works from any sub-path (and offline) thanks to hash routing.
	// Set BASE_PATH (e.g. BASE_PATH=/pocketgames/) to build for a fixed sub-path instead.
	base: process.env.BASE_PATH || './',
	build: {
		target: 'es2022',
		chunkSizeWarningLimit: 800,
	},
	plugins: [serviceWorker()],
});
