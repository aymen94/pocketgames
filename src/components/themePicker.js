// The theme picker: a compact palette button that opens a popover of named themes and
// the Custom accent controls. The same option list is reused inside the settings
// dialog. Changes apply instantly through services/theme.js; nothing reloads.

import { h } from './dom.js';
import { THEMES, CUSTOM_BASES, theme, customTokens } from '../services/theme.js';
import { audio } from '../services/audio.js';

let uid = 0;

/** The radio list of themes plus the Custom controls, kept in sync with the theme state. */
export function themeOptions({ legend = 'Theme', onChange } = {}) {
	const name = `theme-${++uid}`;
	const radios = new Map();
	const list = h('fieldset.theme-list', h('legend', legend),
		THEMES.map((t) => {
			const swatch = h('span.swatch', { 'aria-hidden': 'true', dataset: { theme: t.id } });
			const input = h('input', {
				type: 'radio', name, value: t.id,
				onchange: () => {
					if (t.id === 'custom') theme.setCustom({});
					else theme.setTheme(t.id);
					audio.play('select');
					onChange?.();
				},
			});
			radios.set(t.id, { input, swatch });
			return h('label.theme-option', input, h('span.theme-option-body', swatch, h('span', t.label)));
		}),
	);

	const colorId = `${name}-accent`;
	let accentFrame = 0;
	const color = h('input.color-input', {
		id: colorId, type: 'color', value: theme.state.accent,
		oninput: () => {
			// Native colour controls can emit input events faster than a frame. Apply
			// only the latest value once per frame so theme listeners stay responsive.
			if (accentFrame) cancelAnimationFrame(accentFrame);
			accentFrame = requestAnimationFrame(() => {
				accentFrame = 0;
				theme.setCustom({ accent: color.value });
			});
		},
	});
	const bases = h('div.base-choices', { role: 'radiogroup', 'aria-label': 'Custom background' },
		CUSTOM_BASES.map((b) => h('label', h('input', {
			type: 'radio', name: `${name}-base`, value: b.id, checked: theme.state.base === b.id,
			onchange: () => { theme.setCustom({ base: b.id }); audio.play('select'); },
		}), h('span', b.label))),
	);
	const custom = h('div.custom-controls',
		h('label', { for: colorId }, 'Accent colour', color),
		h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', fontSize: '0.85rem', fontWeight: '700' } }, h('span', 'Background'), bases),
	);

	const sync = () => {
		const state = theme.state;
		for (const [id, { input }] of radios) input.checked = id === state.id;
		custom.hidden = state.id !== 'custom';
		if (document.activeElement !== color) color.value = state.accent;
		for (const input of bases.querySelectorAll('input')) input.checked = input.value === state.base;
		// the Custom swatch previews the custom colours whichever theme is active
		const tokens = customTokens(state.accent, state.base);
		const { swatch } = radios.get('custom');
		for (const [key, value] of Object.entries(tokens)) swatch.style.setProperty(key, value);
	};
	sync();
	const off = theme.subscribe(sync);
	const el = h('div.theme-options', list, custom);
	return { el, dispose: () => { if (accentFrame) cancelAnimationFrame(accentFrame); off(); } };
}

/** The palette button with its popover; place it next to the settings gear. */
export function themePicker() {
	const button = h('button.icon-btn', {
		type: 'button', title: 'Theme', 'aria-label': 'Choose colour theme', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
		html: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2.2a1.8 1.8 0 0 0-1.3 3.1A1.6 1.6 0 0 1 12 22z"/><circle cx="7.5" cy="10.5" r="1.3" fill="currentColor"/><circle cx="12" cy="7" r="1.3" fill="currentColor"/><circle cx="16.5" cy="10.5" r="1.3" fill="currentColor"/></svg>`,
	}, h('span.theme-dot', { 'aria-hidden': 'true' }));
	const wrap = h('div.theme-picker', button);
	let pop = null, options = null;

	const close = (focusButton = true) => {
		if (!pop) return;
		pop.remove();
		options.dispose();
		pop = options = null;
		button.setAttribute('aria-expanded', 'false');
		document.removeEventListener('pointerdown', outside, true);
		document.removeEventListener('keydown', onKey, true);
		if (focusButton) button.focus();
	};
	const outside = (e) => { if (!wrap.contains(e.target)) close(false); };
	const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
	const open = () => {
		options = themeOptions({ legend: 'Colour theme' });
		pop = h('div.theme-pop', { role: 'dialog', 'aria-label': 'Colour theme' }, options.el);
		wrap.appendChild(pop);
		// keep the popover on screen wherever the button sits (header centre, phone widths)
		// layout sizes, not getBoundingClientRect: the open animation is still scaling it
		const right = wrap.getBoundingClientRect().right, left = right - pop.offsetWidth;
		const dx = left < 8 ? 8 - left : right > innerWidth - 8 ? innerWidth - 8 - right : 0;
		if (dx) pop.style.translate = `${dx}px 0`;
		button.setAttribute('aria-expanded', 'true');
		document.addEventListener('pointerdown', outside, true);
		document.addEventListener('keydown', onKey, true);
		pop.querySelector('input:checked')?.focus();
		audio.play('click');
	};
	button.addEventListener('click', () => (pop ? close() : open()));
	return { el: wrap, close: () => close(false) };
}

