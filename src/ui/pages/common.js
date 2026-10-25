// Shared building blocks for the pages UI (home, topics, sources, All of Finland, method).
// Content modules are imported as namespaces so a missing export (another area still working) never breaks loading.
import { h, s, icon } from '../dom.js';
import * as D from '../dom.js';
import { t, L } from '../../i18n.js';
import { fmtNum, fmtEur } from '../format.js';
import * as F from '../format.js';
import { sourceLink } from '../components/sourceLink.js';
import { autoTerms } from '../components/term.js';
import { CARD_TERMS } from '../components/factCard.js';
import { store } from '../../store.js';
import { go } from '../router.js';
import * as R from '../router.js';
import * as Facts from '../../content/facts.js';
import * as Projects from '../../content/projects.js';
import * as Themes from '../../content/themes.js';
import * as Towns from '../../data/towns.js';

export const arr = (x) => (Array.isArray(x) ? x : []);
export const FACTS = () => arr(Facts.FACTS);
export const DEBATES = () => arr(Facts.DEBATES);
export const UNKNOWNS = () => arr(Facts.UNKNOWNS);
export const PROJECTS = () => arr(Projects.PROJECTS);
export const THEMES = () => arr(Themes.THEMES);
export const TOWNS = () => arr(Towns.TOWNS);
export const townByCode = (code) => {
  if (typeof Towns.townByCode === 'function') return Towns.townByCode(code);
  return TOWNS().find((x) => x.code === code) || null;
};
export const townName = (town) => (town ? L(town.name) : '');
const code3 = (c) => (c == null ? '' : String(c).padStart(3, '0'));

/** Children for a native replaceChildren()/append(): drops null, undefined, false and '' (the DOM would print "null"). */
export const kids = (...xs) => xs.flat(Infinity).filter((x) => x != null && x !== false && x !== '');

/** A coefficient exactly as stored (up to 4 decimals, no significant-figure rounding): 1.15 → "1,15". */
export const fmtCoef = typeof F.fmtCoef === 'function'
  ? F.fmtCoef
  : (v) => (v == null || !Number.isFinite(v) ? '–' : F.fmtNum(v, { digits: 4 }));

/** Keep keyboard focus on the "same" control across a re-render (controls carry data-fk keys). */
export const withFocus = typeof D.withFocus === 'function' ? D.withFocus : (root, render) => {
  const active = document.activeElement;
  const holder = root && active && root.contains(active) ? active.closest('[data-fk]') : null;
  const key = holder ? holder.getAttribute('data-fk') : null;
  const out = render();
  if (key) {
    const next = [...root.querySelectorAll('[data-fk]')].find((x) => x.getAttribute('data-fk') === key);
    if (next && next !== document.activeElement) next.focus({ preventScroll: true });
  }
  return out;
};

/** Tell screen-reader users what changed: the app-wide live region (#app-live) when it exists, else a pages one. */
export function say(text) {
  if (!text) return;
  if (typeof D.announce === 'function' && document.getElementById('app-live')) { D.announce(text); return; }
  let el = document.getElementById('pages-live');
  if (!el) {
    el = h('div', { id: 'pages-live', class: 'sr-only', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 60);
}

export const prefersReducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const scrollBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');

/** Real projects in one municipality, ordered operating → construction → planned → halted. */
export function projectsInTown(code) {
  const c = code3(code);
  if (!c) return [];
  if (typeof Projects.projectsInTown === 'function') {
    try { return arr(Projects.projectsInTown(c)); } catch { /* fall through */ }
  }
  return PROJECTS().filter((p) => code3(p.townCode) === c)
    .sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
}

/** Status in words: the project's own note when there is one ("keskeytetty 10/2026 …"), else the status name. */
export const statusText = (p) => (p?.statusNote ? L(p.statusNote) : t(`status.${p?.status}`));

/** Shareable link to a project (bare hash token, e.g. #hanke-google-muhos). */
const projectToken = typeof R.projectToken === 'function' ? R.projectToken : (id) => `hanke-${id}`;
const shareUrl = typeof R.shareUrl === 'function' ? R.shareUrl : (token) => `${location.href.split('#')[0]}#${token}`;
export const projectLink = (p) => shareUrl(projectToken(p.id));

/** Theme key → identity hue token (identity only, never good/bad). */
export const THEME_HUE = {
  energy: 'var(--c-energy)', environment: 'var(--c-water)', jobs: 'var(--c-jobs)', traffic: 'var(--c-traffic)',
  land: 'var(--c-land)', safety: 'var(--c-safety)', future: 'var(--c-future)',
};
export const THEME_ICON = { energy: 'bolt', environment: 'drop', jobs: 'coin', traffic: 'truck', land: 'tree', safety: 'shield', future: 'clock' };
export const themeByKey = (key) => THEMES().find((x) => x.key === key) || null;
export const themeTitle = (key) => { const th = themeByKey(key); return th ? L(th.title) : key; };

/** Project status: order, colour token (categorical identity) and a shape (secondary encoding so colour is never alone). */
export const STATUSES = ['operating', 'construction', 'planned', 'halted'];
export const STATUS_COLOR = { operating: 'var(--accent)', construction: 'var(--heat)', planned: 'var(--c-jobs)', halted: 'var(--ink-2)' };

/** Status glyph as SVG children centred on (cx, cy) with radius r. Used on the map and in legends. */
export function statusGlyph(status, cx, cy, r) {
  const col = STATUS_COLOR[status] || 'var(--ink-2)';
  if (status === 'construction') {
    const a = r * 0.92;
    return s('rect', { x: cx - a, y: cy - a, width: a * 2, height: a * 2, rx: r * 0.2, fill: col, class: 'glyph' });
  }
  if (status === 'planned') return s('circle', { cx, cy, r: r * 0.8, fill: 'var(--surface)', stroke: col, 'stroke-width': r * 0.45, class: 'glyph' });
  if (status === 'halted') {
    return s('g', { class: 'glyph' },
      s('circle', { cx, cy, r, fill: col }),
      s('path', { d: `M${cx - r * 0.5} ${cy - r * 0.5}L${cx + r * 0.5} ${cy + r * 0.5}M${cx + r * 0.5} ${cy - r * 0.5}L${cx - r * 0.5} ${cy + r * 0.5}`, stroke: 'var(--surface)', 'stroke-width': r * 0.32, 'stroke-linecap': 'round' }));
  }
  return s('circle', { cx, cy, r, fill: col, class: 'glyph' });
}
export function statusIcon(status, size = 14) {
  return s('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': 'true', class: 'status-icon' }, statusGlyph(status, 8, 8, 5.5));
}
export function statusChip(status) {
  return h('span', { class: `chip chip--status chip--status-${status}` }, statusIcon(status, 13), h('span', null, t(`status.${status}`)));
}

/** Euro range in words with one shared unit: "0,25–0,75 milj. €" / "€0.25–0.75 million". */
export function fmtEurRange(low, high) {
  if (low == null || high == null || !Number.isFinite(low) || !Number.isFinite(high)) return '–';
  const fi = store.get().lang === 'fi';
  const m = Math.max(Math.abs(low), Math.abs(high));
  const [div, fiU, enU] = m >= 1e9 ? [1e9, ' mrd. €', ' billion'] : m >= 2e5 ? [1e6, ' milj. €', ' million'] : [1, ' €', ''];
  const sig = { sig: 2 };
  const a = fmtNum(low / div, sig);
  const b = fmtNum(high / div, sig);
  const num = a === b ? a : `${a}–${b}`;
  return fi ? `${num}${fiU}` : `€${num}${enU}`;
}

export function sectionHead({ eyebrow, title, lead, id, level = 2 }) {
  return h('header', { class: 'section-head' },
    eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
    h(`h${level}`, { id: id || null }, title),
    lead ? h('p', { class: 'lead' }, lead) : null);
}

/** Navigate to the simulator with a real project's preset loaded (the same patch as a #hanke-<id> link). */
export function loadProject(p) {
  const preset = p.preset || {};
  const design = { ...store.get().design };
  for (const k of ['sizeMW', 'cooling', 'heatReuse', 'site', 'distanceM']) if (preset[k] != null) design[k] = preset[k];
  const patch = { presetId: p.id, design, overrides: {}, year: 0, playing: false, simUi: {} };
  if (p.townCode) patch.townCode = code3(p.townCode);
  go('simulaattori', patch);
}

/**
 * "Copy link" control: copies `getUrl()` with the Clipboard API inside the click; if that is blocked (for example in
 * an embedded frame), shows the link in a read-only field, selects it and asks the user to press Ctrl+C.
 */
export function copyLinkControl(getUrl, { label = t('home.copyLink'), fk } = {}) {
  const status = h('span', { class: 'copy-link__status', role: 'status' });
  const field = h('input', {
    type: 'text', class: 'copy-link__field', readonly: true, hidden: true, 'aria-label': t('home.linkLabel'),
    onfocus: (e) => e.target.select(),
  });
  let timer = 0;
  const done = (msg) => {
    status.textContent = msg;
    clearTimeout(timer);
    timer = setTimeout(() => { status.textContent = ''; }, 6000);
  };
  const btn = h('button', {
    type: 'button', class: 'btn btn--small btn--ghost copy-link__btn', 'data-fk': fk || null,
    onclick: async () => {
      const url = getUrl();
      let ok = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(url);
          ok = true;
        }
      } catch { ok = false; }
      if (ok) { field.hidden = true; done(t('home.linkCopied')); return; }
      field.value = url;
      field.hidden = false;
      field.focus();
      field.select();
      done(t('home.linkSelect'));
    },
  }, icon('link', { size: 16 }), label);
  return h('div', { class: 'copy-link' }, btn, field, status);
}

export function projectCard(p, { onFocusMap, here = false } = {}) {
  const town = p.townCode ? townByCode(p.townCode) : null;
  const sizeText = p.mw ? t('home.mw', { n: fmtNum(p.mw, { sig: 3 }) }) : t('home.mwUnknown');
  const src = arr(p.sources)[0];
  return h('article', { class: ['project-card', here && 'is-here'], id: `project-${p.id}` },
    h('div', { class: 'project-card__top' }, statusChip(p.status), h('span', { class: 'project-card__size' }, sizeText)),
    here ? h('p', { class: 'project-card__here' }, icon('map', { size: 14 }), t('home.inTown')) : null,
    h('h3', { class: 'project-card__name' }, L(p.name)),
    h('p', { class: 'project-card__where' }, icon('map', { size: 15 }), ' ', p.municipality || townName(town),
      p.operator ? h('span', { class: 'muted' }, ` · ${p.operator}`) : null),
    p.statusNote ? h('p', { class: 'project-card__status-note' }, L(p.statusNote)) : null,
    p.summary ? h('p', { class: 'project-card__summary' }, L(p.summary)) : null,
    p.investmentEur ? h('p', { class: 'project-card__meta' }, t('home.investment', { v: fmtEur(p.investmentEur) })) : null,
    src ? h('div', { class: 'project-card__source' }, sourceLink(src)) : null,
    h('div', { class: 'project-card__actions' },
      p.preset ? h('button', { type: 'button', class: 'btn btn--small btn--primary', 'data-fk': `proj-try-${p.id}`, onclick: () => loadProject(p) }, t('home.tryThis'), icon('arrowRight', { size: 16 })) : null,
      onFocusMap ? h('button', { type: 'button', class: 'btn btn--small btn--ghost', 'data-fk': `proj-map-${p.id}`, onclick: () => onFocusMap(p) }, icon('map', { size: 16 }), townName(town) || p.municipality) : null,
      copyLinkControl(() => projectLink(p), { fk: `proj-copy-${p.id}` })));
}

export function debateCard(d) {
  const positions = arr(d.positions);
  const seen = new Set(); // explain each technical word once per card
  const words = (text) => autoTerms(text, CARD_TERMS, seen);
  return h('article', { class: 'debate', id: `debate-${d.id}` },
    h('div', { class: 'debate__head' },
      d.theme ? h('span', { class: 'theme-tag', style: { '--hue': THEME_HUE[d.theme] || 'var(--accent)' } }, themeTitle(d.theme)) : null,
      h('h3', { class: 'debate__q' }, L(d.question))),
    h('div', { class: 'debate__positions', style: { '--n': Math.max(1, Math.min(positions.length, 3)) } },
      positions.map((p, i) => h('div', { class: 'debate__pos' },
        h('p', { class: 'debate__label' }, icon('bubble', { size: 15 }), ' ', t('facts.position', { n: String.fromCharCode(65 + i) })),
        h('p', { class: 'debate__summary' }, words(L(p.summary))),
        p.source ? h('div', { class: 'debate__source' }, sourceLink(p.source)) : null))),
    d.whyTheyDiffer ? h('div', { class: 'debate__why' }, h('p', { class: 'debate__why-h' }, icon('question', { size: 16 }), ' ', t('facts.whyDiffer')), h('p', null, words(L(d.whyTheyDiffer)))) : null);
}

export function unknownCard(u) {
  const seen = new Set();
  const words = (text) => autoTerms(text, CARD_TERMS, seen);
  return h('article', { class: 'unknown', id: `unknown-${u.id}` },
    h('div', { class: 'unknown__mark', 'aria-hidden': 'true' }, '?'),
    h('div', { class: 'unknown__body' },
      u.theme ? h('span', { class: 'theme-tag', style: { '--hue': THEME_HUE[u.theme] || 'var(--accent)' } }, themeTitle(u.theme)) : null,
      h('h3', { class: 'unknown__q' }, L(u.question)),
      u.why ? h('p', null, h('strong', null, `${t('facts.why')}: `), words(L(u.why))) : null,
      u.whatWouldHelp ? h('p', null, h('strong', null, `${t('facts.wouldHelp')}: `), words(L(u.whatWouldHelp))) : null,
      arr(u.sources).length ? h('ul', { class: 'src-list' }, arr(u.sources).map((x) => h('li', null, sourceLink(x)))) : null));
}

/** Strip accents for forgiving search: "jyvaskyla" finds Jyväskylä. */
export const fold = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

let comboSeq = 0;
/**
 * Accessible town search combobox (WAI-ARIA 1.2 combobox + listbox).
 * opts: { onSelect(code), label }
 * The field starts empty (the page shows the selected town elsewhere), so typing a name always searches for that name.
 * After a choice it shows the chosen name; focusing the field again selects that text, so typing replaces it.
 * A clear button (×) empties the field and puts the cursor back in it.
 * Returns { el, setValue(code), focus() }.
 */
export function townCombobox({ onSelect, label } = {}) {
  const id = `town-cb-${++comboSeq}`;
  const listId = `${id}-list`;
  let results = [];
  let active = -1;
  const input = h('input', {
    id, type: 'text', class: 'combo__input', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
    'aria-controls': listId, autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', enterkeyhint: 'search',
    placeholder: t('search.placeholder'),
  });
  const clearBtn = h('button', {
    type: 'button', class: 'combo__clear', 'aria-label': t('search.clear'), title: t('search.clear'), hidden: true,
    onmousedown: (e) => e.preventDefault(), // keep focus in the field
    onclick: () => {
      input.value = '';
      delete input.dataset.dirty;
      close();
      status.textContent = '';
      syncClear();
      input.focus();
    },
  }, h('span', { 'aria-hidden': 'true' }, '×'));
  const list = h('ul', { id: listId, role: 'listbox', class: 'combo__list', hidden: true, 'aria-label': label || t('search.label') });
  const status = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const all = TOWNS().slice().sort((a, b) => L(a.name).localeCompare(L(b.name), 'fi'));

  const syncClear = () => { clearBtn.hidden = !input.value; input.classList.toggle('has-clear', !!input.value); };
  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const selectAll = () => { try { input.select(); input.setSelectionRange(0, input.value.length); } catch { /* not focusable now */ } };
  const choose = (town) => {
    input.value = L(town.name);
    delete input.dataset.dirty;
    syncClear();
    close();
    onSelect && onSelect(town.code);
    // Touch screens: close the on-screen keyboard so the result is visible. Elsewhere keep focus with the name
    // selected, so typing a new name replaces it.
    if (window.matchMedia?.('(pointer: coarse)').matches) input.blur();
    else selectAll();
  };
  const highlight = (i) => {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', String(j === i)));
    if (i >= 0 && list.children[i]) {
      input.setAttribute('aria-activedescendant', list.children[i].id);
      list.children[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  };
  const search = () => {
    const q = fold(input.value.trim());
    if (!q) { close(); status.textContent = ''; return; }
    const starts = [];
    const contains = [];
    for (const tw of all) {
      const names = [tw.name?.fi, tw.name?.sv, tw.name?.en].filter(Boolean).map(fold);
      if (names.some((n) => n.startsWith(q))) starts.push(tw);
      else if (names.some((n) => n.includes(q))) contains.push(tw);
    }
    results = [...starts, ...contains].slice(0, 8);
    list.replaceChildren(...kids(results.length ? results.map((tw, i) => h('li', {
      id: `${id}-opt-${i}`, role: 'option', class: 'combo__opt', 'aria-selected': 'false',
      onmousedown: (e) => e.preventDefault(), onclick: () => choose(tw),
    }, h('span', { class: 'combo__name' }, L(tw.name)),
    tw.population != null ? h('span', { class: 'combo__meta' }, t('search.residents', { n: fmtNum(tw.population, { sig: 2 }) })) : null))
      : [h('li', { class: 'combo__empty', role: 'presentation' }, t('search.none'))]));
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    status.textContent = results.length ? t('search.count', { n: results.length }) : t('search.none');
    highlight(results.length ? 0 : -1);
  };
  input.addEventListener('input', () => { input.dataset.dirty = '1'; syncClear(); search(); });
  // A chosen name (not typed by hand) is selected as a whole on focus and on every click, so the next keystroke replaces
  // it instead of appending to it ("TampereMuhos"). Once the user types, clicks place the caret as usual.
  const chosenShown = () => !!input.value && !input.dataset.dirty;
  input.addEventListener('focus', () => {
    if (input.value && input.dataset.dirty) { search(); return; }
    if (input.value) selectAll();
  });
  // Clicking inside an existing selection would collapse it to a caret once the click is over: keep it selected.
  input.addEventListener('mousedown', (e) => {
    if (document.activeElement === input && chosenShown()) { e.preventDefault(); selectAll(); }
  });
  input.addEventListener('click', () => {
    if (chosenShown()) setTimeout(() => { if (chosenShown() && document.activeElement === input) selectAll(); }, 0);
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (list.hidden) search();
      else if (results.length) highlight((active + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (results.length) highlight((active - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (!list.hidden && active >= 0 && results[active]) { e.preventDefault(); choose(results[active]); }
    } else if (e.key === 'Escape') {
      if (!list.hidden) { e.preventDefault(); close(); } else { input.value = ''; delete input.dataset.dirty; syncClear(); }
    }
  });
  /** Show a chosen town's name in the field (after a choice on the map, for example). '' or null empties it. */
  const setValue = (code) => {
    const tw = code ? townByCode(code) : null;
    const next = tw ? L(tw.name) : '';
    if (input.value !== next) input.value = next;
    delete input.dataset.dirty;
    syncClear();
    if (next && document.activeElement === input) selectAll();
  };
  const el = h('div', { class: 'combo' },
    h('label', { for: id, class: 'combo__label' }, label || t('search.label')),
    h('div', { class: 'combo__field' }, h('span', { class: 'combo__icon', 'aria-hidden': 'true' }, icon('search', { size: 18 })), input, clearBtn),
    list, status);
  return { el, setValue, focus: () => input.focus() };
}
