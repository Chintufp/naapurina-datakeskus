// Topics (#aiheet): the 7 THEMES as tabs. Each theme: lead, a three-line "in brief" box, body (glossary terms explained
// inline), what residents ask, possible benefits / drawbacks / uncertain (order alternates by theme so neither side
// always comes first), related "sources disagree" cards (only when there are some), and — folded away until opened —
// numbers with sources (FACTS), real viewpoints via the persona lenses and words explained; plus a hand-off to the
// simulator with that theme highlighted.
import { h, icon } from '../dom.js';
import { store } from '../../store.js';
import { t, L } from '../../i18n.js';
import { go } from '../router.js';
import { factCard } from '../components/factCard.js';
import { sourceLink } from '../components/sourceLink.js';
import { autoTerms } from '../components/term.js';
import { kindChip, KINDS } from '../components/chips.js';
import * as Glossary from '../../content/glossary.js';
import * as Personas from '../../content/personas.js';
import { THEMES, FACTS, DEBATES, THEME_HUE, THEME_ICON, arr, debateCard, kids, withFocus } from '../pages/common.js';

// Plain-language terms that are explained on first mention wherever they appear in a topic (besides the theme's own).
const EXTRA_TERMS = ['GWh', 'desibeli', 'YVA', 'polttoaineteho', 'itTeho', 'MW'];

export function mount(el) {
  const themes = THEMES();
  if (!themes.length) {
    el.append(h('section', { class: 'page' }, h('h1', null, t('nav.topics')), h('p', null, t('topics.missing'))));
    return () => {};
  }
  let current = themes.some((x) => x.key === store.get().topic) ? store.get().topic : themes[0].key;
  let showAllFacts = false;
  const openSecs = new Set(); // which folded sections the reader has opened (kept while switching topics)

  const tabs = h('div', { class: 'topic-tabs', role: 'tablist', 'aria-label': t('topics.choose') });
  const panel = h('section', { class: 'topic-panel', role: 'tabpanel', tabindex: '-1' });

  function renderTabs() {
    tabs.replaceChildren(...themes.map((th, i) => h('button', {
      type: 'button', role: 'tab', id: `tab-${th.key}`, class: 'topic-tab', 'aria-controls': 'topic-panel',
      'aria-selected': String(th.key === current), tabindex: th.key === current ? '0' : '-1',
      style: { '--hue': THEME_HUE[th.key] || 'var(--accent)' },
      onclick: () => select(th.key),
      onkeydown: (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
        let next = null;
        if (keys[e.key]) next = themes[(i + keys[e.key] + themes.length) % themes.length];
        else if (e.key === 'Home') next = themes[0];
        else if (e.key === 'End') next = themes[themes.length - 1];
        if (!next) return;
        e.preventDefault();
        select(next.key);
        tabs.querySelector(`#tab-${next.key}`)?.focus();
      },
    },
    h('span', { class: 'topic-tab__icon', 'aria-hidden': 'true' }, icon(th.icon || THEME_ICON[th.key] || 'info', { size: 22 })),
    h('span', { class: 'topic-tab__title' }, L(th.title)))));
  }

  function select(key, { scroll = false } = {}) {
    if (key === current) return;
    current = key;
    showAllFacts = false;
    store.set({ topic: key });
    renderTabs();
    renderPanel();
    if (scroll) {
      panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      panel.focus({ preventScroll: true });
    }
  }

  function listCol(kind, items, words) {
    return h('div', { class: `bdu bdu--${kind}` },
      h('h3', { class: 'bdu__h' }, h('span', { class: 'bdu__mark', 'aria-hidden': 'true' }, kind === 'benefits' ? '+' : kind === 'drawbacks' ? '−' : '?'), t(`topics.${kind}`)),
      h('ul', { class: 'bdu__list' }, arr(items).map((it) => h('li', { class: 'bdu__item' },
        h('p', null, words(L(it.text))),
        it.source ? h('div', { class: 'bdu__src' }, sourceLink(it.source)) : h('p', { class: 'bdu__src bdu__src--none' }, t('topics.noSource'))))));
  }

  /** A section folded into <details>, closed until the reader opens it. */
  function folded(key, title, count, ...content) {
    const d = h('details', { class: 'topic-sec topic-fold', 'data-sec': key, open: openSecs.has(key) },
      h('summary', { class: 'topic-fold__sum', 'data-fk': `fold-${key}` },
        h('h3', { class: 'topic-sec__h topic-fold__h' }, title),
        count ? h('span', { class: 'topic-fold__n' }, t('topics.count', { n: count })) : null),
      h('div', { class: 'topic-fold__body' }, ...content));
    d.addEventListener('toggle', () => { if (d.open) openSecs.add(key); else openSecs.delete(key); });
    return d;
  }

  function renderPanel() {
    const i = themes.findIndex((x) => x.key === current);
    const th = themes[i];
    const hue = THEME_HUE[th.key] || 'var(--accent)';
    const seen = new Set();
    const termKeys = arr(th.terms);
    const glossary = Glossary.GLOSSARY || {};
    const wordKeys = [...new Set([...termKeys, ...EXTRA_TERMS])];
    const words = (text) => autoTerms(text, wordKeys, seen);

    // benefits / drawbacks / uncertain — alternate which side leads
    const cols = i % 2 === 0 ? ['benefits', 'drawbacks', 'uncertain'] : ['drawbacks', 'benefits', 'uncertain'];

    const facts = FACTS().filter((f) => f.theme === th.key);
    const shownFacts = showAllFacts ? facts : facts.slice(0, 6);
    const debates = DEBATES().filter((d) => d.theme === th.key);
    const metrics = new Set(arr(th.metrics));
    const personas = arr(Personas.PERSONAS).filter((p) => arr(p.cares).some((m) => metrics.has(m)) && arr(p.voices).length);

    const prev = themes[(i - 1 + themes.length) % themes.length];
    const next = themes[(i + 1) % themes.length];

    const summary = arr(th.summary).filter((x) => L(x));
    const shownTerms = termKeys.filter((k) => glossary[k]);

    panel.id = 'topic-panel';
    panel.setAttribute('aria-labelledby', `tab-${th.key}`);
    panel.style.setProperty('--hue', hue);
    withFocus(panel, () => panel.replaceChildren(...kids(
      h('header', { class: 'topic-hero' },
        h('span', { class: 'topic-hero__icon', 'aria-hidden': 'true' }, icon(th.icon || THEME_ICON[th.key] || 'info', { size: 34 })),
        h('div', { class: 'topic-hero__text' },
          h('h2', { class: 'topic-hero__title' }, L(th.title)),
          th.lead ? h('p', { class: 'topic-hero__lead' }, L(th.lead)) : null)),
      summary.length ? h('section', { class: 'topic-brief', 'aria-labelledby': 'topic-brief-h' },
        h('h3', { class: 'topic-brief__h', id: 'topic-brief-h' }, t('topics.brief')),
        h('ul', { class: 'topic-brief__list' }, summary.map((x) => h('li', null, words(L(x)))))) : null,
      h('div', { class: 'topic-intro' },
        h('div', { class: 'topic-body' }, arr(th.body).map((p) => h('p', null, words(L(p))))),
        h('aside', { class: 'topic-asks' },
          h('h3', null, icon('question', { size: 20 }), ' ', t('topics.asks')),
          h('ul', null, arr(th.questions).map((q) => h('li', null, L(q)))),
          h('button', { type: 'button', class: 'btn btn--primary topic-try', 'data-fk': 'topic-try', onclick: () => go('simulaattori', { focusTheme: th.key }) },
            icon('play', { size: 16 }), t('topics.try')),
          h('p', { class: 'topic-try__hint' }, t('topics.tryHint')))),
      h('section', { class: 'topic-sec', 'aria-labelledby': 'bdu-h' },
        h('h3', { id: 'bdu-h', class: 'sr-only' }, `${t('topics.benefits')}, ${t('topics.drawbacks')}, ${t('topics.uncertain')}`),
        h('div', { class: 'bdu-grid' }, cols.map((k) => listCol(k, th[k], words))),
        h('p', { class: 'bdu-note' }, icon('info', { size: 15 }), ' ', t('topics.balanceNote'))),
      debates.length ? h('section', { class: 'topic-sec' },
        h('h3', { class: 'topic-sec__h' }, t('topics.debate')),
        h('div', { class: 'debate-list' }, debates.map(debateCard))) : null,
      folded('numbers', t('topics.keyNumbers'), facts.length,
        facts.length ? h('div', { class: 'fact-grid' }, shownFacts.map((f) => factCard(f))) : h('p', { class: 'muted' }, t('topics.noFacts')),
        facts.length > 6 ? h('button', {
          type: 'button', class: 'btn btn--small topic-more', 'aria-expanded': String(showAllFacts), 'data-fk': 'topic-more',
          onclick: () => { showAllFacts = !showAllFacts; renderPanel(); },
        }, showAllFacts ? t('topics.fewer') : t('topics.more', { n: facts.length })) : null),
      personas.length ? folded('voices', t('topics.voices'), personas.length,
        h('p', { class: 'muted topic-sec__lead' }, L(Personas.PERSONA_NOTE) || t('topics.voicesNote')),
        h('div', { class: 'voice-grid' }, personas.map((p) => h('article', { class: 'voice' },
          h('div', { class: 'voice__who' },
            h('span', { class: 'voice__icon', 'aria-hidden': 'true' }, icon(p.icon || 'people', { size: 20 })),
            h('div', null, h('p', { class: 'voice__name' }, L(p.name)), h('p', { class: 'voice__role' }, L(p.who)))),
          p.says ? h('p', { class: 'voice__says' }, L({ fi: '”', en: '“' }), L(p.says), '”') : null,
          h('ul', { class: 'voice__list' }, arr(p.voices).map((v) => h('li', null,
            kindChip(KINDS.includes(v.kind) ? v.kind : 'opinion'), ' ', L(v.summary), v.source ? h('div', { class: 'voice__src' }, sourceLink(v.source)) : null))))))) : null,
      shownTerms.length ? folded('terms', t('topics.terms'), shownTerms.length,
        h('dl', { class: 'glossary' }, shownTerms.map((k) => h('div', { class: 'glossary__item' },
          h('dt', null, L(glossary[k].term)), h('dd', null, L(glossary[k].plain)))))) : null,
      h('nav', { class: 'topic-pager', 'aria-label': t('topics.choose') },
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => select(prev.key, { scroll: true }) }, '← ', h('span', { class: 'sr-only' }, `${t('topics.prev')}: `), L(prev.title)),
        h('button', { type: 'button', class: 'btn btn--ghost', onclick: () => select(next.key, { scroll: true }) }, h('span', { class: 'sr-only' }, `${t('topics.next')}: `), L(next.title), ' →')))));
  }

  el.append(h('div', { class: 'page topics-page' },
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, t('topics.eyebrow')),
      h('h1', null, t('topics.title')),
      h('p', { class: 'lead' }, t('topics.lead'))),
    tabs, panel));
  renderTabs();
  renderPanel();
  return () => {};
}
