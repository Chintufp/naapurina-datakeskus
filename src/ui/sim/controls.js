// Small accessible controls shared by the simulator panels.
import { h, icon } from '../dom.js';
import { GLOSSARY } from '../../content/glossary.js';
import { term } from '../components/term.js';
import { L } from '../../i18n.js';

/**
 * Segmented control = radiogroup of buttons with roving tabindex and arrow keys.
 * options: [{ value, label (string|Node), sub?, disabled?, title? }]
 * Returns the element with .set(value) and .setDisabled(value, bool).
 */
export function segmented({ label, labelledby, options, value, onChange, className = '' }) {
  const btns = [];
  const root = h('div', { class: ['seg', 'sim-seg', className], role: 'radiogroup', 'aria-label': labelledby ? null : label, 'aria-labelledby': labelledby || null });
  function select(v, focus = false) {
    btns.forEach((b) => {
      const on = b._value === v;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus();
    });
    if (!btns.some((b) => b._value === v) && btns[0]) btns.find((b) => !b.disabled)?.setAttribute('tabindex', '0');
  }
  options.forEach((o) => {
    const b = h('button', {
      type: 'button', class: 'seg__opt', role: 'radio', 'aria-checked': 'false', disabled: !!o.disabled, title: o.title || null,
      onclick: () => { if (b.disabled) return; select(o.value); onChange?.(o.value); },
    }, h('span', { class: 'seg__label' }, o.label), o.sub ? h('span', { class: 'seg__sub' }, o.sub) : null);
    b._value = o.value;
    btns.push(b);
    root.append(b);
  });
  root.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const enabled = btns.filter((b) => !b.disabled);
    const i = enabled.indexOf(document.activeElement);
    const next = enabled[(i + keys[e.key] + enabled.length) % enabled.length];
    if (next) { select(next._value, true); onChange?.(next._value); }
  });
  select(value);
  root.set = (v) => select(v);
  root.setDisabled = (v, dis) => { const b = btns.find((x) => x._value === v); if (b) b.disabled = !!dis; };
  return root;
}

/** Glossary term by the first key that exists in GLOSSARY (keys differ in spelling across areas); plain text otherwise. */
export function termAny(keys, label) {
  const list = Array.isArray(keys) ? keys : [keys];
  const found = list.find((k) => GLOSSARY && GLOSSARY[k]);
  if (found) {
    try { return term(found, label); } catch { /* fall through */ }
  }
  return h('span', null, label);
}

/** Tiny "source" mark: an info icon linking to the source, with the name in the tooltip. */
export function sourceMark(src, text) {
  if (!src) return null;
  const name = typeof src.name === 'string' ? src.name : (L(src.name) || '');
  const attrs = { class: 'src-mark', title: text || name, 'aria-label': text || name };
  return src.url
    ? h('a', { ...attrs, href: src.url, target: '_blank', rel: 'noopener noreferrer' }, icon('info', { size: 14 }))
    : h('span', attrs, icon('info', { size: 14 }));
}

/** Throttle a function to at most once per animation frame (latest args win). */
export function rafThrottle(fn) {
  let id = 0; let args = null;
  const run = () => { id = 0; fn(...args); };
  const throttled = (...a) => { args = a; if (!id) id = requestAnimationFrame(run); };
  throttled.cancel = () => { if (id) cancelAnimationFrame(id); id = 0; };
  throttled.flush = () => { if (id) { cancelAnimationFrame(id); run(); } };
  return throttled;
}

export const prefersReducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/** Glossary term element, or null when none of the keys exists (label defaults to the glossary's own term). */
export function termIf(keys, label) {
  const list = Array.isArray(keys) ? keys : [keys];
  const found = list.find((k) => GLOSSARY && GLOSSARY[k]);
  if (!found) return null;
  try { return term(found, label); } catch { return null; }
}
