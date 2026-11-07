const MIN_TOP = 150;
const MIN_BOTTOM = 130;
const STEP = 24;

/**
 * Divisor arrastável entre dois painéis empilhados de uma grade.
 * Cada painel pode crescer só até a altura do seu próprio conteúdo
 * (o "limite natural") e encolher até um mínimo.
 */
export function initSplitter({ grid, top, bottom, handle, desktop, watch = [] }) {
  let custom = null;

  const gap = () => parseFloat(getComputedStyle(grid).rowGap) || 0;

  function naturalSizes() {
    grid.classList.add('measuring');
    const sizes = { top: top.offsetHeight, bottom: bottom.offsetHeight };
    grid.classList.remove('measuring');
    return sizes;
  }

  function limits() {
    const total = grid.clientHeight - gap();
    const natural = naturalSizes();
    const hi = Math.max(MIN_TOP, Math.min(natural.top, total - MIN_BOTTOM));
    const lo = Math.min(hi, Math.max(MIN_TOP, total - natural.bottom));
    return { lo, hi };
  }

  function syncAria() {
    if (!desktop.matches) return;
    const { lo, hi } = limits();
    handle.setAttribute('aria-valuemin', Math.round(lo));
    handle.setAttribute('aria-valuemax', Math.round(hi));
    handle.setAttribute('aria-valuenow', Math.round(top.offsetHeight));
  }

  function reset() {
    custom = null;
    grid.style.removeProperty('--rows');
    syncAria();
  }

  function apply(height) {
    if (!desktop.matches) return reset();
    const { lo, hi } = limits();
    custom = Math.min(hi, Math.max(lo, height));
    grid.style.setProperty('--rows', `${custom}px minmax(0, 1fr)`);
    syncAria();
  }

  const refit = () => { if (custom !== null) apply(custom); };

  let startY = 0;
  let startH = 0;

  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    startY = event.clientY;
    startH = top.offsetHeight;
    handle.setPointerCapture(event.pointerId);
    handle.classList.add('drag');
    document.body.classList.add('resizing');
    event.preventDefault();
  });
  handle.addEventListener('pointermove', (event) => {
    if (!handle.hasPointerCapture(event.pointerId)) return;
    apply(startH + event.clientY - startY);
  });
  const stop = (event) => {
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    handle.classList.remove('drag');
    document.body.classList.remove('resizing');
  };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
  handle.addEventListener('dblclick', reset);
  handle.addEventListener('focus', syncAria);
  handle.addEventListener('keydown', (event) => {
    const now = top.offsetHeight;
    const { lo, hi } = limits();
    if (event.key === 'ArrowUp') apply(now - STEP);
    else if (event.key === 'ArrowDown') apply(now + STEP);
    else if (event.key === 'Home') apply(lo);
    else if (event.key === 'End') apply(hi);
    else if (event.key === 'Escape') reset();
    else return;
    event.preventDefault();
  });

  window.addEventListener('resize', refit);
  desktop.addEventListener('change', () => (desktop.matches ? refit() : reset()));
  const observer = new MutationObserver(refit);
  watch.forEach((node) => observer.observe(node, { childList: true, subtree: true }));
}
