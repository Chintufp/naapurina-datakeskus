// Small DOM helpers. No framework: views build elements with h() and replace what they own.
//
//   h('button', { class: 'btn', onclick: fn, 'aria-label': 'x' }, 'Text', childEl)
//   s('circle', { cx: 4, cy: 4, r: 3 })      // SVG element
//   withFocus(root, () => rebuild())         // re-render and give focus back to the control with the same data-fk key
//   announce('Aiheet')                        // polite screen-reader message through #app-live
//   html`<b>${userText}</b>` is NOT provided on purpose — always build nodes or use textContent so content is escaped.

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el, attrs) {
  if (!attrs) return el;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // only for trusted, static markup (icons)
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Create an HTML element. */
export function h(tag, attrs, ...children) {
  return append(apply(document.createElement(tag), attrs), children);
}

/** Create an SVG element. */
export function s(tag, attrs, ...children) {
  return append(apply(document.createElementNS(SVG_NS, tag), attrs), children);
}

/** Remove all children and append new ones. */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/**
 * Re-render without losing the keyboard user's place.
 * Controls that get rebuilt carry a stable key, e.g. h('button', { 'data-fk': 'persona-aleksi' }).
 * If focus is inside `root` on (or inside) such an element, the element with the same key gets focus back after render().
 *   withFocus(panel, () => panel.replaceChildren(...build()))
 */
export function withFocus(root, render) {
  let key = null;
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  if (root && active && active !== document.body && root.contains(active)) {
    const holder = active.closest('[data-fk]');
    if (holder && root.contains(holder)) key = holder.getAttribute('data-fk');
  }
  const out = render();
  if (key != null) {
    const sel = `[data-fk="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(key) : key.replace(/["\\]/g, '\\$&')}"]`;
    const next = root.querySelector(sel);
    if (next && next !== document.activeElement && typeof next.focus === 'function') next.focus({ preventScroll: true });
  }
  return out;
}

/** Say something to screen-reader users through the polite live region #app-live (created by main.js). */
export function announce(text) {
  const el = typeof document !== 'undefined' ? document.getElementById('app-live') : null;
  if (!el) return;
  const msg = text == null ? '' : String(text);
  if (el.textContent === msg && msg) {
    // The same words again: clear first so screen readers notice the change.
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 60);
  } else {
    el.textContent = msg;
  }
}

/** Inline SVG icon from a small built-in set (24×24, stroke = currentColor). */
const ICONS = {
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11v6M8 15h2M12 15h2"/>',
  bubble: '<path d="M4 5h16v11H9l-5 4z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 9h2M9 13h6M9 17h6"/>',
  link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flame: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-6 2 1 3 2 3 4 0-3-1-5 0-8z"/>',
  drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  tree: '<path d="M12 3 6 13h4l-3 5h10l-3-5h4z"/><path d="M12 18v3"/>',
  people: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M14 20c0-2.5 1.5-4.5 3.5-4.5S21 17.5 21 20"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7.5 7 9 4-1.5 7-5 7-9V6z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  coin: '<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v10c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 16.5v.5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
};
export function icon(name, { size = 18, label } = {}) {
  const el = s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'icon', 'aria-hidden': label ? null : 'true', role: label ? 'img' : null, 'aria-label': label || null,
  });
  el.innerHTML = ICONS[name] || ICONS.info;
  if (name === 'play') el.setAttribute('fill', 'currentColor');
  return el;
}
export const ICON_NAMES = Object.keys(ICONS);
