// Reusable side drawer (used by the simulator's "Why?" and anywhere else that needs a focused side panel).
//   openDrawer({ title: string|Node, body: Node|Node[], onClose? }) → close()
// Focus-trapped, Esc and backdrop close it, focus returns to the element that opened it, page scroll is locked,
// and only one drawer is open at a time. close.panel / close.body expose the elements for in-place updates.
import { h, icon, replace } from '../dom.js';
import { t } from '../../i18n.js';

let current = null;
let uid = 0;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), summary';

const reducedMotion = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

export function openDrawer({ title, body, onClose } = {}) {
  if (current) current(true);
  const prevFocus = document.activeElement;
  const titleId = `drawer-title-${++uid}`;
  let closed = false;

  const closeBtn = h('button', { class: 'drawer__close btn btn--ghost', type: 'button', 'aria-label': t('common.close') }, icon('close', { size: 22 }));
  const heading = h('h2', { class: 'drawer__title', id: titleId }, title);
  const bodyEl = h('div', { class: 'drawer__body' }, body);
  const panel = h('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('div', { class: 'drawer__head' }, heading, closeBtn),
    bodyEl);
  const backdrop = h('div', { class: 'drawer-backdrop', 'aria-hidden': 'true' });

  const prevOverflow = document.documentElement.style.overflow;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;

  function focusables() {
    return [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) { e.preventDefault(); panel.focus(); return; }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }
  function onFocusIn(e) {
    if (!panel.contains(e.target)) (focusables()[0] || panel).focus();
  }

  function close(immediate = false) {
    if (closed) return;
    closed = true;
    if (current === close) current = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn);
    document.documentElement.style.overflow = prevOverflow;
    document.documentElement.style.paddingRight = '';
    const done = () => { backdrop.remove(); panel.remove(); };
    if (immediate || reducedMotion()) done();
    else {
      panel.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      setTimeout(done, 220);
    }
    if (!immediate) returnTarget(prevFocus)?.focus?.({ preventScroll: true });
    try { onClose?.(); } catch (err) { console.error(err); }
  }

  closeBtn.addEventListener('click', () => close());
  backdrop.addEventListener('click', () => close());

  document.body.append(backdrop, panel);
  document.documentElement.style.overflow = 'hidden';
  if (scrollbar > 0) document.documentElement.style.paddingRight = `${scrollbar}px`;
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocusIn);
  // next frame: animate in
  requestAnimationFrame(() => { panel.classList.add('is-open'); backdrop.classList.add('is-open'); });
  closeBtn.focus({ preventScroll: true });

  current = close;
  close.panel = panel;
  close.body = bodyEl;
  close.setTitle = (v) => replace(heading, v);
  return close;
}

/** The opener, or (when pinning re-rendered it) the new element with the same classes and aria-label. */
function returnTarget(el) {
  if (!el || document.contains(el)) return el;
  const label = el.getAttribute?.('aria-label');
  const cls = [...(el.classList || [])].map((c) => `.${CSS.escape(c)}`).join('');
  if (!label || !cls) return null;
  return [...document.querySelectorAll(cls)].find((x) => x.getAttribute('aria-label') === label) || null;
}

/** Close whichever drawer is open (e.g. when a view unmounts). */
export function closeDrawer() { if (current) current(true); }
