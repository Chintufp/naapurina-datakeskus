// Entry point: mounts the header and swaps the main view when the route changes.
// Accessibility scaffold: a polite live region (#app-live, see announce() in dom.js), a page title per view,
// focus moved to the new view's heading after navigation, and <html data-text-size> from store.textSize.
import { store } from './store.js';
import { startRouter } from './ui/router.js';
import { mountHeader } from './ui/header.js';
import { mountFooter } from './ui/footer.js';
import * as home from './ui/views/home.js';
import * as sim from './ui/views/sim.js';
import * as topics from './ui/views/topics.js';
import * as facts from './ui/views/facts.js';
import * as finland from './ui/views/finland.js';
import * as method from './ui/views/method.js';
import { h, announce } from './ui/dom.js';
import { t } from './i18n.js';

const VIEWS = { koti: home, simulaattori: sim, aiheet: topics, lahteet: facts, suomi: finland, menetelma: method };
const VIEW_NAME = { koti: 'nav.home', simulaattori: 'nav.sim', aiheet: 'nav.topics', lahteet: 'nav.facts', suomi: 'nav.finland', menetelma: 'nav.method' };

const app = document.getElementById('app');
// The skip link must not change the hash: the router would read "#main" as an unknown route and go home.
const skip = h('a', {
  class: 'skip-link', href: '#main',
  onclick: (e) => { e.preventDefault(); main.focus({ preventScroll: true }); main.scrollIntoView({ block: 'start' }); },
}, t('a11y.skip'));
const headerEl = h('header', { class: 'site-header' });
const main = h('main', { id: 'main', class: 'site-main', tabindex: '-1' });
const footerEl = h('footer', { class: 'site-footer' });
const live = h('div', { id: 'app-live', class: 'sr-only', 'aria-live': 'polite' });
app.append(skip, headerEl, main, footerEl, live);

mountHeader(headerEl);
mountFooter(footerEl);

const viewName = (view) => t(VIEW_NAME[view] || 'nav.home');

function applyTextSize(state) {
  document.documentElement.dataset.textSize = state.textSize === 'large' ? 'large' : 'normal';
}

/** After navigating, put the keyboard and screen-reader user at the new view's heading. */
function focusView(view) {
  const h1 = main.querySelector('h1');
  const target = h1 || main;
  if (h1 && !h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  announce(viewName(view));
}

let booted = false;
let current = null;   // { view, lang, unmount }
function render(state) {
  document.documentElement.lang = state.lang;
  document.title = state.view === 'koti' || !VIEW_NAME[state.view] ? t('app.name') : `${viewName(state.view)} – ${t('app.name')}`;
  skip.textContent = t('a11y.skip');
  if (current && current.view === state.view && current.lang === state.lang) return;
  const viewChanged = !current || current.view !== state.view;
  if (current?.unmount) current.unmount();
  main.replaceChildren();
  const mod = VIEWS[state.view] || home;
  const unmount = mod.mount(main);
  current = { view: state.view, lang: state.lang, unmount };
  if (booted && viewChanged) focusView(state.view);
}

applyTextSize(store.get());
store.subscribe((state, prev) => {
  if (state.textSize !== prev.textSize) applyTextSize(state);
  if (state.view !== prev.view || state.lang !== prev.lang) render(state);
});
startRouter();
render(store.get());
booted = true;
