// Sources (#lahteet): the four trust labels explained (measured, estimate, calculated, viewpoint); the fact library with
// search and filters; "sources disagree" (DEBATES side by side); "nobody knows" (UNKNOWNS); the full coefficient table
// from COEF, every coefficient printed exactly as stored.
// In-page navigation uses buttons + scrollIntoView, never href="#id" (bare hash tokens are routes in this app).
import { h, icon } from '../dom.js';
import { t, L } from '../../i18n.js';
import { kindChip, confidenceChip } from '../components/chips.js';
import { sourceLink } from '../components/sourceLink.js';
import { factCard } from '../components/factCard.js';
import * as Coef from '../../model/coefficients.js';
import { FACTS, DEBATES, UNKNOWNS, THEMES, arr, debateCard, unknownCard, fold, kids, fmtCoef, scrollBehavior } from '../pages/common.js';
import { LABEL_KINDS, LABEL_RULE, kindHelp } from '../pages/methodContent.js';

const SRC_TYPES = ['authority', 'statistics', 'research', 'industry', 'company', 'news', 'ngo', 'politics', 'resident'];

export function mount(el) {
  const facts = FACTS();
  const filters = { q: '', theme: '', kind: '', type: '' };
  const FIRST = 12;
  let showAll = false;
  let showAllCoef = false;
  let timer = 0;

  // ---------- head + labels ----------
  const labelCard = (kind) => h('div', { class: `label-card label-card--${kind}` },
    kindChip(kind), h('p', null, kindHelp(kind)));
  const jump = (id, label) => h('button', { type: 'button', class: 'jump__btn', onclick: () => { const tgt = document.getElementById(id); tgt?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); tgt?.focus({ preventScroll: true }); } }, label);

  const head = h('header', { class: 'page-head facts-head' },
    h('p', { class: 'eyebrow' }, t('facts.eyebrow')),
    h('h1', null, t('facts.title')),
    h('p', { class: 'lead' }, t('facts.lead')),
    h('section', { class: 'labels', 'aria-labelledby': 'labels-h' },
      h('h2', { id: 'labels-h', class: 'labels__h' }, t('facts.labelsTitle')),
      h('div', { class: 'labels__grid' }, LABEL_KINDS.map(labelCard)),
      h('p', { class: 'labels__rule' }, L(LABEL_RULE)),
      h('div', { class: 'label-card label-card--conf' },
        h('div', { class: 'label-card__chips' }, confidenceChip('strong'), confidenceChip('medium'), confidenceChip('weak')),
        h('p', null, h('strong', null, `${t('facts.strengthTitle')}. `), t('facts.strengthText'), ' ', t('facts.companyNote')))),
    h('nav', { class: 'jump', 'aria-label': t('m.toc') },
      jump('lib-h', t('facts.libraryTitle')), jump('deb-h', t('facts.debatesTitle')),
      jump('unk-h', t('facts.unknownsTitle')), jump('coef-h', t('facts.coefTitle'))));

  // ---------- library ----------
  const themes = THEMES();
  const select = (label, key, options) => {
    const id = `flt-${key}`;
    return h('div', { class: 'flt' },
      h('label', { for: id, class: 'flt__label' }, label),
      h('select', { id, class: 'flt__select', onchange: (e) => { filters[key] = e.target.value; renderList(); } },
        h('option', { value: '' }, t('facts.all')),
        options.map(([v, l]) => h('option', { value: v }, l))));
  };
  const usedTypes = SRC_TYPES.filter((ty) => facts.some((f) => f.source?.type === ty));
  const searchInput = h('input', {
    id: 'flt-q', type: 'search', class: 'flt__input', placeholder: t('facts.searchPh'), autocomplete: 'off',
    oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => { filters.q = e.target.value; renderList(); }, 120); },
  });
  const kindSeg = h('div', { class: 'seg', role: 'radiogroup', 'aria-labelledby': 'flt-kind-l' });
  // Facts are measured, estimates or viewpoints; "calculated" belongs to the model's own numbers, not to the library.
  const KINDS = [['', t('facts.all')], ['measured', t('kind.measured')], ['estimate', t('kind.estimate')], ['opinion', t('kind.opinion')]];
  const renderKindSeg = () => kindSeg.replaceChildren(...kids(KINDS.map(([v, l], i) => h('button', {
    type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String(filters.kind === v), tabindex: filters.kind === v ? '0' : '-1',
    onclick: () => { filters.kind = v; renderKindSeg(); renderList(); },
    onkeydown: (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      filters.kind = KINDS[(i + d + KINDS.length) % KINDS.length][0];
      renderKindSeg(); renderList();
      kindSeg.querySelector('[aria-checked="true"]')?.focus();
    },
  }, l))));
  const count = h('p', { class: 'lib__count', 'aria-live': 'polite' });
  const list = h('div', { class: 'fact-grid lib__list' });
  const clearBtn = h('button', {
    type: 'button', class: 'btn btn--small btn--ghost', onclick: () => {
      Object.assign(filters, { q: '', theme: '', kind: '', type: '' });
      searchInput.value = '';
      library.querySelectorAll('select').forEach((s) => { s.value = ''; });
      renderKindSeg(); renderList();
    },
  }, t('facts.clear'));

  function matches(f) {
    if (filters.theme && f.theme !== filters.theme) return false;
    if (filters.kind && f.kind !== filters.kind) return false;
    if (filters.type && f.source?.type !== filters.type) return false;
    if (filters.q.trim()) {
      const hay = fold([f.claim?.fi, f.claim?.en, f.note?.fi, f.note?.en, L(f.source?.name), f.source?.name?.fi, f.source?.name?.en].filter(Boolean).join(' '));
      return fold(filters.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
    }
    return true;
  }
  const moreBtn = h('button', { type: 'button', class: 'btn lib__more', onclick: () => { showAll = true; renderList(); list.children[FIRST]?.querySelector('a, button')?.focus(); } });
  function renderList() {
    const res = facts.filter(matches);
    const filtered = !!(filters.q || filters.theme || filters.kind || filters.type);
    count.textContent = res.length === 1 ? t('facts.count1') : t('facts.count', { n: res.length });
    clearBtn.hidden = !filtered;
    const shown = filtered || showAll ? res : res.slice(0, FIRST);
    moreBtn.hidden = shown.length >= res.length;
    moreBtn.textContent = t('facts.showAll', { n: res.length });
    list.replaceChildren(...kids(res.length ? shown.map((f) => factCard(f, { showTheme: true })) : [h('p', { class: 'muted lib__none' }, t('facts.none'))]));
  }

  const library = h('section', { class: 'page-section', 'aria-labelledby': 'lib-h' },
    h('h2', { id: 'lib-h', tabindex: '-1', class: 'anchor-target' }, t('facts.libraryTitle')),
    h('div', { class: 'lib__filters' },
      h('div', { class: 'flt flt--search' },
        h('label', { for: 'flt-q', class: 'flt__label' }, t('facts.search')),
        h('div', { class: 'flt__field' }, h('span', { class: 'flt__icon', 'aria-hidden': 'true' }, icon('search', { size: 18 })), searchInput)),
      select(t('facts.theme'), 'theme', themes.map((th) => [th.key, L(th.title)])),
      h('div', { class: 'flt' }, h('span', { id: 'flt-kind-l', class: 'flt__label' }, t('facts.kind')), kindSeg),
      select(t('facts.srcType'), 'type', usedTypes.map((ty) => [ty, t(`src.${ty}`)]))),
    h('div', { class: 'lib__bar' }, count, clearBtn),
    list, moreBtn);

  // ---------- debates, unknowns ----------
  const debates = h('section', { class: 'page-section', 'aria-labelledby': 'deb-h' },
    h('header', { class: 'section-head' },
      h('h2', { id: 'deb-h', tabindex: '-1', class: 'anchor-target' }, t('facts.debatesTitle')),
      h('p', { class: 'lead' }, t('facts.debatesLead'))),
    h('div', { class: 'debate-list' }, DEBATES().map(debateCard)));
  const unknowns = h('section', { class: 'page-section', 'aria-labelledby': 'unk-h' },
    h('header', { class: 'section-head' },
      h('h2', { id: 'unk-h', tabindex: '-1', class: 'anchor-target' }, t('facts.unknownsTitle')),
      h('p', { class: 'lead' }, t('facts.unknownsLead'))),
    h('div', { class: 'unknown-grid' }, UNKNOWNS().map(unknownCard)));

  // ---------- coefficients ----------
  const COEF = Coef.COEF || {};
  // Inputs are printed as stored (1,15 – not 1,2): only results are rounded.
  const num = (v) => (v == null || !Number.isFinite(v) ? '–' : fmtCoef(v));
  const rows = Object.entries(COEF).map(([key, c], i) => h('tr', { id: `coef-${key.replace(/\./g, '-')}`, hidden: i >= 10 },
    h('th', { scope: 'row', 'data-label': t('facts.cTitle') },
      h('span', { class: 'coef__title' }, L(c.title) || key),
      c.explain ? h('span', { class: 'coef__explain' }, L(c.explain)) : null,
      c.note ? h('span', { class: 'coef__note' }, L(c.note)) : null),
    h('td', { class: 'num', 'data-label': t('facts.cLow') }, num(c.low)),
    h('td', { class: 'num coef__typ', 'data-label': t('facts.cTyp') }, num(c.typ)),
    h('td', { class: 'num', 'data-label': t('facts.cHigh') }, num(c.high)),
    h('td', { 'data-label': t('facts.cUnit') }, L(c.unit) || '–'),
    h('td', { 'data-label': t('facts.cConf') }, c.confidence ? confidenceChip(c.confidence) : '–'),
    h('td', { 'data-label': t('facts.cSources') }, h('ul', { class: 'src-list src-list--tight' }, arr(c.sources).map((s) => h('li', null, sourceLink(s)))))));
  const coef = h('section', { class: 'page-section', 'aria-labelledby': 'coef-h' },
    h('header', { class: 'section-head' },
      h('h2', { id: 'coef-h', tabindex: '-1', class: 'anchor-target' }, t('facts.coefTitle')),
      h('p', { class: 'lead' }, t('facts.coefLead'))),
    h('div', { class: 'coef-wrap' },
      h('table', { class: 'coef' },
        h('caption', { class: 'sr-only' }, t('facts.coefTitle')),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col' }, t('facts.cTitle')), h('th', { scope: 'col', class: 'num' }, t('facts.cLow')),
          h('th', { scope: 'col', class: 'num' }, t('facts.cTyp')), h('th', { scope: 'col', class: 'num' }, t('facts.cHigh')),
          h('th', { scope: 'col' }, t('facts.cUnit')), h('th', { scope: 'col' }, t('facts.cConf')), h('th', { scope: 'col' }, t('facts.cSources')))),
        h('tbody', null, rows))),
    rows.length > 10 ? h('button', {
      type: 'button', class: 'btn lib__more', 'aria-expanded': 'false',
      onclick: (e) => {
        showAllCoef = !showAllCoef;
        rows.forEach((r, i) => { r.hidden = !showAllCoef && i >= 10; });
        e.currentTarget.setAttribute('aria-expanded', String(showAllCoef));
        e.currentTarget.textContent = showAllCoef ? t('topics.fewer') : t('facts.showAllCoef', { n: rows.length });
      },
    }, t('facts.showAllCoef', { n: rows.length })) : null);

  el.append(h('div', { class: 'page facts-page' }, head, library, debates, unknowns, coef));
  renderKindSeg();
  renderList();
  return () => clearTimeout(timer);
}
