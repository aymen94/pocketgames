// A DOM grid board: square cells laid out by CSS grid, sized to the game area. Used by
// the cell-based games (Minefield, Sudoku, Tic-Tac-Toe, Pixel Logic…) that read better as
// crisp, accessible buttons than as pixels.

export class Grid {
	constructor(root, rows, cols, { className = '', onCell = null, onContext = null, gap = 4 } = {}) {
		this.rows = rows;
		this.cols = cols;
		this.wrap = document.createElement('div');
		this.wrap.className = 'grid-wrap';
		this.el = document.createElement('div');
		this.el.className = `grid-board ${className}`;
		this.el.style.setProperty('--rows', rows);
		this.el.style.setProperty('--cols', cols);
		this.el.style.setProperty('--gap', `${gap}px`);
		this.cells = [];
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const cell = document.createElement('button');
				cell.type = 'button';
				cell.className = 'grid-cell';
				cell.dataset.r = r;
				cell.dataset.c = c;
				this.el.appendChild(cell);
				this.cells.push(cell);
			}
		}
		if (onCell) this.el.addEventListener('click', (e) => {
			const cell = e.target.closest('.grid-cell');
			if (cell) onCell(+cell.dataset.r, +cell.dataset.c, e);
		});
		if (onContext) this.el.addEventListener('contextmenu', (e) => {
			const cell = e.target.closest('.grid-cell');
			if (!cell) return;
			e.preventDefault();
			onContext(+cell.dataset.r, +cell.dataset.c, e);
		});
		this.wrap.appendChild(this.el);
		root.appendChild(this.wrap);
		this.observer = new ResizeObserver(() => this.fit());
		this.observer.observe(root);
		this.root = root;
		this.fit();
	}

	cell(r, c) {
		return this.cells[r * this.cols + c];
	}

	/** Largest square cells that fit the root, leaving room for `extra` pixels of chrome. */
	fit(extra = 0) {
		const rect = this.root.getBoundingClientRect();
		const gap = parseFloat(this.el.style.getPropertyValue('--gap'));
		const size = Math.floor(Math.min((rect.width - 16 - gap * (this.cols - 1)) / this.cols, (rect.height - 16 - extra - gap * (this.rows - 1)) / this.rows));
		this.el.style.setProperty('--cell', `${Math.max(14, Math.min(size, 96))}px`);
	}

	dispose() {
		this.observer.disconnect();
		this.wrap.remove();
	}
}

/** Neighbours of (r, c) inside a rows × cols board, 8-connected unless `four`. */
export function neighbours(r, c, rows, cols, four = false) {
	const out = [];
	for (let dr = -1; dr <= 1; dr++) {
		for (let dc = -1; dc <= 1; dc++) {
			if (dr === 0 && dc === 0) continue;
			if (four && dr !== 0 && dc !== 0) continue;
			const nr = r + dr, nc = c + dc;
			if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push([nr, nc]);
		}
	}
	return out;
}
