export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
// Gravity-ish feel: slow → fast → slow. Good for physical flip animations.
export const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function applyTheme(theme = {}) {
  const root = document.documentElement.style;
  if (theme.cardBg) root.setProperty('--card-bg', theme.cardBg);
  if (theme.cardFg) root.setProperty('--card-fg', theme.cardFg);
  if (theme.accent) root.setProperty('--accent', theme.accent);
  if (theme.pageBg) root.setProperty('--page-bg', theme.pageBg);
}

export function showStatus(msg, { error = false, ms = 2400 } = {}) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('error', !!error);
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}
