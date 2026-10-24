// A Canvas 2D surface with a fixed logical size, scaled to fit its container at the
// device pixel ratio the graphics quality allows. Games draw in logical units and read pointer positions in them.

import { theme, themeColors } from '../../services/theme.js';
import { canvasPixelRatio, onGraphicsChange } from '../../services/graphics.js';

export class Surface {
	constructor(root, width, height, { className = 'game-canvas', fit = 'contain' } = {}) {
		this.root = root;
		this.width = width;
		this.height = height;
		this.fit = fit;
		this.canvas = document.createElement('canvas');
		this.canvas.className = className;
		this.g = this.canvas.getContext('2d');
		root.appendChild(this.canvas);
		this.scale = 1;
		this.observer = new ResizeObserver(() => this.resize());
		this.observer.observe(root);
		this.unsubscribeQuality = onGraphicsChange(() => this.resize());
		this.resize();
	}

	/** Changes the logical size, e.g. when a setting changes the board. */
	setSize(width, height) {
		this.width = width;
		this.height = height;
		this.resize();
	}

	resize() {
		const rect = this.root.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) return;
		const scale = Math.min(rect.width / this.width, rect.height / this.height);
		const dpr = canvasPixelRatio();
		this.scale = scale;
		this.canvas.style.width = `${Math.floor(this.width * scale)}px`;
		this.canvas.style.height = `${Math.floor(this.height * scale)}px`;
		this.canvas.width = Math.floor(this.width * scale * dpr);
		this.canvas.height = Math.floor(this.height * scale * dpr);
		this.g.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
		this.onResize?.();
	}

	/** A pointer event's position in logical units. */
	local(event) {
		const rect = this.canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * this.width,
			y: ((event.clientY - rect.top) / rect.height) * this.height,
		};
	}

	clear(color) {
		const g = this.g;
		if (color) {
			g.fillStyle = color;
			g.fillRect(0, 0, this.width, this.height);
		} else {
			g.clearRect(0, 0, this.width, this.height);
		}
	}

	dispose() {
		this.observer.disconnect();
		this.unsubscribeQuality();
		this.canvas.remove();
	}
}

// ---------------------------------------------------------------- drawing helpers

export function roundRect(g, x, y, w, h, r) {
	g.beginPath();
	g.roundRect(x, y, w, h, r);
}

export function fillRound(g, x, y, w, h, r, color) {
	g.fillStyle = color;
	roundRect(g, x, y, w, h, r);
	g.fill();
}

export function circle(g, x, y, r, color) {
	// easing overshoot can briefly give a tiny negative radius, which arc() rejects
	if (!(r > 0)) return;
	g.fillStyle = color;
	g.beginPath();
	g.arc(x, y, r, 0, Math.PI * 2);
	g.fill();
}

export function text(g, value, x, y, { size = 16, color = '#f4f6ff', align = 'center', baseline = 'middle', weight = 700, font = 'system-ui, sans-serif' } = {}) {
	g.fillStyle = color;
	g.font = `${weight} ${size}px ${font}`;
	g.textAlign = align;
	g.textBaseline = baseline;
	g.fillText(value, x, y);
}

/** A soft radial glow, for balls, lights and pickups. */
export function glow(g, x, y, r, color) {
	const gradient = g.createRadialGradient(x, y, 0, x, y, r);
	gradient.addColorStop(0, color);
	gradient.addColorStop(1, 'rgba(0,0,0,0)');
	g.fillStyle = gradient;
	g.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * Shared colours of the 2D games. The game-world palette (bg, panel, blue, amber…) is
 * fixed so boards and pieces stay recognisable in every theme; `accent`, `accent2`,
 * `accent3` and `highlight` follow the site theme for selections, glows and UI chrome.
 */
export const colors = {
	accent: '#4f8cff',
	accent2: '#8b5cf6',
	accent3: '#f472b6',
	highlight: '#6ea0ff',
	bg: '#0b1020',
	panel: '#141b36',
	panel2: '#1b2447',
	line: '#2a3563',
	text: '#f4f6ff',
	muted: '#8d97c4',
	blue: '#4f8cff',
	violet: '#8b5cf6',
	pink: '#f472b6',
	amber: '#fbbf24',
	mint: '#34d399',
	coral: '#fb7185',
	cyan: '#22d3ee',
};

function followTheme(c = themeColors()) {
	if (!c.primary) return;
	colors.accent = c.primary;
	colors.accent2 = c.secondary;
	colors.accent3 = c.tertiary;
	colors.highlight = c.primaryHover;
}
followTheme();
theme.subscribe(followTheme);
