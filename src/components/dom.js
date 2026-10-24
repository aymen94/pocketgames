// A tiny element builder and the interface icons, so components stay plain JavaScript.

/**
 * h('button.btn.primary', { onclick, title }, 'Play', child…)
 * Attributes starting with "on" become listeners; `html` sets innerHTML; `dataset` and
 * `style` objects are merged; false/null children are skipped.
 */
export function h(selector, attrs = {}, ...children) {
	const [tag, ...classes] = selector.split('.');
	const el = document.createElement(tag || 'div');
	if (classes.length) el.className = classes.join(' ');
	if (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
		children.unshift(attrs);
		attrs = {};
	}
	for (const [key, value] of Object.entries(attrs)) {
		if (value == null || value === false) continue;
		if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
		else if (key === 'html') el.innerHTML = value;
		else if (key === 'dataset') Object.assign(el.dataset, value);
		else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
		else if (key === 'class') el.className += ` ${value}`;
		else el.setAttribute(key, value === true ? '' : value);
	}
	append(el, children);
	return el;
}

function append(el, children) {
	for (const child of children.flat(Infinity)) {
		if (child == null || child === false) continue;
		el.append(child instanceof Node ? child : document.createTextNode(String(child)));
	}
}

const svg = (body, fill = false) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icon = {
	back: svg('<path d="M15 18l-6-6 6-6"/>'),
	play: svg('<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/>', true),
	pause: svg('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>', true),
	restart: svg('<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 3v6h6"/>'),
	soundOn: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
	soundOff: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
	settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
	expand: svg('<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>'),
	help: svg('<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>'),
	heart: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
	heartFill: svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>', true),
	search: svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
	offline: svg('<path d="M1 1l22 22M16.7 11.1A11 11 0 0 1 19 12.5M5 12.5a11 11 0 0 1 5.2-2.4M10.7 5A16 16 0 0 1 22.6 9M1.4 9a16 16 0 0 1 4.4-2.7M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>'),
	online: svg('<path d="M5 12.5a11 11 0 0 1 14 0M1.4 9a16 16 0 0 1 21.2 0M8.5 16.1a6 6 0 0 1 7 0M12 20h.01"/>'),
	download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
	check: svg('<path d="M20 6L9 17l-5-5"/>'),
	trophy: svg('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'),
	cube: svg('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>'),
	close: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
	up: svg('<path d="M18 15l-6-6-6 6"/>'),
	down: svg('<path d="M6 9l6 6 6-6"/>'),
	left: svg('<path d="M15 18l-6-6 6-6"/>'),
	right: svg('<path d="M9 18l6-6-6-6"/>'),
	bolt: svg('<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>', true),
};

export function iconButton(name, label, onclick, extra = '') {
	return h(`button.icon-btn${extra ? `.${extra}` : ''}`, { type: 'button', title: label, 'aria-label': label, onclick, html: icon[name] });
}
