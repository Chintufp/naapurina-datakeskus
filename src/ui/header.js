// Site header: brand, navigation, larger-text toggle, FI/EN switch. Sticky; on narrow screens the nav collapses behind a
// menu button. Re-renders keep keyboard focus on the same control (data-fk keys), so pressing "EN" leaves focus on the
// language switch.
import { h, s } from './dom.js';
import * as D from './dom.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { go, ROUTES } from './router.js';

const NAV = [['simulaattori', 'nav.sim'], ['aiheet', 'nav.topics'], ['lahteet', 'nav.facts'], ['suomi', 'nav.finland'], ['menetelma', 'nav.method']];

/** Keep focus on the control with the same data-fk key after a re-render (dom.js withFocus, or the same idea here). */
const withFocus = typeof D.withFocus === 'function' ? D.withFocus : (root, render) => {
  const active = document.activeElement;
  const key = active && root.contains(active) ? active.closest('[data-fk]')?.getAttribute('data-fk') : null;
  const out = render();
  if (key) {
    const next = [...root.querySelectorAll('[data-fk]')].find((x) => x.getAttribute('data-fk') === key);
    if (next && next !== document.activeElement) next.focus({ preventScroll: true });
  }
  return out;
};

/** Small brand mark: a house and a data hall side by side ("next door"). Decorative. */
function brandMark() {
  return s('svg', { viewBox: '0 0 32 32', width: 30, height: 30, class: 'brand__mark', 'aria-hidden': 'true' },
    s('rect', { x: 0, y: 0, width: 32, height: 32, rx: 8, class: 'brand__bg' }),
    s('path', { d: 'M6 24V15l5-4.2 5 4.2v9z', class: 'brand__house' }),
    s('rect', { x: 18.5, y: 12, width: 8, height: 12, rx: 1, class: 'brand__hall' }),
    s('path', { d: 'M20.5 15.5h4M20.5 18.5h4M20.5 21.5h4', class: 'brand__lines' }),
    s('path', { d: 'M3.5 24.5h25', class: 'brand__ground' }));
}

/** <html data-text-size> — main.js owns this; setting it here too keeps the toggle working on its own. */
function applyTextSize(size) {
  const v = size === 'large' ? 'large' : 'normal';
  if (document.documentElement.getAttribute('data-text-size') !== v) document.documentElement.setAttribute('data-text-size', v);
}

export function mountHeader(el) {
  let open = false;
  let unsub = null;

  const setOpen = (v, { focusButton = false } = {}) => {
    open = v;
    el.classList.toggle('is-menu-open', open);
    const btn = el.querySelector('.menu-btn');
    if (btn) {
      btn.setAttribute('aria-expanded', String(open));
      btn.setAttribute('aria-label', open ? t('hdr.menuClose') : t('hdr.menu'));
      if (focusButton) btn.focus();
    }
  };

  const build = () => {
    const { view, lang, textSize } = store.get();
    const large = textSize === 'large';
    const langBtn = (code, label) => h('button', {
      type: 'button', class: 'lang-switch__opt', lang: code, 'aria-pressed': String(lang === code), 'data-fk': `lang-${code}`,
      'aria-label': code === 'fi' ? 'Suomeksi' : 'In English',
      onclick: () => { if (lang !== code) store.set({ lang: code }); },
    }, label);
    const textBtn = h('button', {
      type: 'button', class: 'text-size', 'aria-pressed': String(large), 'data-fk': 'text-size', title: t('hdr.textSize'),
      onclick: () => {
        const next = large ? 'normal' : 'large';
        applyTextSize(next);
        store.set({ textSize: next });
        // With larger text the navigation can fold behind the menu button: open it so the toggle stays in reach.
        const again = el.querySelector('.text-size');
        if (again && !again.getClientRects().length) { setOpen(true); again.focus({ preventScroll: true }); }
      },
    }, h('span', { class: 'text-size__glyph', 'aria-hidden': 'true' }, h('span', { class: 'text-size__a' }, 'A'), h('span', { class: 'text-size__a text-size__a--big' }, 'A')),
    h('span', { class: 'text-size__label' }, t('hdr.textSize')));

    el.replaceChildren(
      h('div', { class: 'site-header__inner' },
        h('a', { href: '#koti', class: 'brand', 'data-fk': 'nav-koti', 'aria-label': `${t('app.name')} – ${t('hdr.home')}`, onclick: (e) => { e.preventDefault(); setOpen(false); go('koti'); } },
          brandMark(), h('span', { class: 'brand__name' }, t('app.name'))),
        h('button', {
          type: 'button', class: 'menu-btn', 'aria-expanded': String(open), 'aria-controls': 'site-nav', 'data-fk': 'menu',
          'aria-label': open ? t('hdr.menuClose') : t('hdr.menu'),
          onclick: () => setOpen(!open),
        }, h('span', { class: 'menu-btn__bars', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')), h('span', { class: 'menu-btn__text' }, t('hdr.menu'))),
        h('div', { class: 'site-header__panel', id: 'site-nav' },
          h('nav', { class: 'site-nav', 'aria-label': t('nav.menu') },
            NAV.map(([route, key]) => h('a', {
              href: `#${route}`, class: ['site-nav__link', view === route && 'is-active', route === 'simulaattori' && 'site-nav__link--sim'],
              'aria-current': view === route ? 'page' : null, 'data-fk': `nav-${route}`,
              onclick: (e) => { e.preventDefault(); setOpen(false); go(route); },
            }, t(key)))),
          h('div', { class: 'site-header__tools' },
            textBtn,
            h('div', { class: 'lang-switch', role: 'group', 'aria-label': t('hdr.lang') }, langBtn('fi', 'FI'), langBtn('en', 'EN'))))));
    el.classList.toggle('is-menu-open', open);
    applyTextSize(textSize);
  };
  const render = () => withFocus(el, build);

  const onKey = (e) => {
    if (e.key === 'Escape' && open) setOpen(false, { focusButton: true });
  };
  // composedPath() is fixed when the event starts, so a header button that re-rendered itself (language, text size)
  // still counts as "inside" even though it is no longer in the document.
  const onDocClick = (e) => { if (open && !e.composedPath().includes(el)) setOpen(false); };
  const mq = window.matchMedia('(min-width: 980px)');
  const onMq = () => { if (mq.matches && open) setOpen(false); };

  render();
  document.addEventListener('keydown', onKey);
  document.addEventListener('click', onDocClick);
  mq.addEventListener?.('change', onMq);
  unsub = store.subscribe((st, p) => {
    if (st.view !== p.view) open = false;
    if (st.view !== p.view || st.lang !== p.lang || st.textSize !== p.textSize) render();
  });
  return () => { unsub?.(); document.removeEventListener('keydown', onKey); document.removeEventListener('click', onDocClick); mq.removeEventListener?.('change', onMq); };
}
export { ROUTES };
