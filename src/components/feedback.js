// Press feedback for every button: a ripple from the pointer, added by one delegated
// listener so components do not each need their own.

import { reducedMotion } from '../games/core/fx.js';

export function startButtonFeedback() {
	document.addEventListener('pointerdown', (event) => {
		const button = event.target.closest?.('.btn, .icon-btn, .chip');
		if (!button || button.disabled || reducedMotion()) return;
		const rect = button.getBoundingClientRect();
		const size = Math.max(rect.width, rect.height) * 2;
		const ripple = document.createElement('span');
		ripple.className = 'ripple';
		ripple.style.width = ripple.style.height = `${size}px`;
		ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
		ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
		button.appendChild(ripple);
		ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
	}, { passive: true });
}
