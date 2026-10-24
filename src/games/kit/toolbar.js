// Small DOM controls for the toolbars of sandbox and builder games (Fluid Playground, Sand
// Box, Bridge Builder…). Styled with the theme tokens so they follow every site theme.

import { h } from '../../components/dom.js';

export const tool = {
	bar: (...children) => h('div.kit-toolbar', { role: 'toolbar' }, ...children),
	group: (...children) => h('div.kit-group', ...children),
	label: (text) => h('span.kit-label', text),

	button(label, onclick, { title = label, pressed = null, primary = false } = {}) {
		const b = h(`button.kit-btn${primary ? '.primary' : ''}`, { type: 'button', title, onclick: (e) => { e.preventDefault(); onclick(b); } }, label);
		if (pressed !== null) b.setAttribute('aria-pressed', String(pressed));
		return b;
	},

	/** A row of mutually exclusive buttons. Returns { el, set(value) }. */
	choice(options, value, onchange, { label = '' } = {}) {
		const buttons = options.map(([v, text, title]) => {
			const b = h('button.kit-btn', { type: 'button', title: title ?? text, 'aria-pressed': String(v === value), onclick: (e) => { e.preventDefault(); set(v); onchange(v); } }, text);
			b.dataset.value = v;
			return b;
		});
		const set = (v) => { for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.value === String(v))); };
		return { el: h('div.kit-group', label && h('span.kit-label', label), ...buttons), set };
	},

	/** A labelled slider. `format` shows the value next to it. */
	range(label, { min = 0, max = 1, step = 0.01, value = 0.5, format = null } = {}, oninput) {
		const out = h('span.kit-value', format ? format(value) : '');
		const input = h('input.kit-range', { type: 'range', min, max, step, value, 'aria-label': label, oninput: () => { const v = +input.value; if (format) out.textContent = format(v); oninput(v); } });
		return h('label.kit-group', h('span.kit-label', label), input, format && out);
	},

	/** Colour swatches. Returns { el, set(color) }. */
	swatches(colors, value, onpick) {
		const buttons = colors.map((c) => h('button.kit-swatch', { type: 'button', title: c, 'aria-label': `Colour ${c}`, style: { background: c }, 'aria-pressed': String(c === value), onclick: (e) => { e.preventDefault(); set(c); onpick(c); } }));
		const set = (c) => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(colors[i] === c)));
		return { el: h('div.kit-group', ...buttons), set };
	},
};

export const KIT_CSS = `
.kit-layout { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; padding: 8px; box-sizing: border-box; }
.kit-host { position: relative; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.kit-toolbar { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 14px; background: var(--color-surface); border: 1px solid var(--color-border); color: var(--color-text); font-size: 0.82rem; max-width: 100%; box-sizing: border-box; }
.kit-group { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.kit-label { color: var(--color-text-muted); font-weight: 700; margin-right: 2px; }
.kit-value { min-width: 2.4em; color: var(--color-text-soft); font-variant-numeric: tabular-nums; font-weight: 700; }
.kit-btn { min-height: 30px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--color-border); background: var(--color-surface-2); color: var(--color-text); font: inherit; font-weight: 700; cursor: pointer; touch-action: manipulation; }
.kit-btn:hover { border-color: var(--color-border-strong); background: var(--color-surface-hover); }
.kit-btn[aria-pressed='true'], .kit-btn.primary { background: var(--color-primary); border-color: transparent; color: var(--color-on-primary); }
.kit-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.kit-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid var(--color-border); cursor: pointer; padding: 0; }
.kit-swatch[aria-pressed='true'] { border-color: var(--color-text); box-shadow: 0 0 0 2px var(--color-primary); }
.kit-range { width: 86px; accent-color: var(--color-primary); }
.kit-panel { display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--color-text); }
@media (max-width: 560px) { .kit-toolbar { gap: 4px 8px; padding: 4px 6px; font-size: 0.75rem; } .kit-btn { min-height: 28px; padding: 0 7px; } .kit-range { width: 64px; } }
`;
