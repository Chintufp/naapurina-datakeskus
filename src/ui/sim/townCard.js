// Step 1: the town card — key facts about the chosen municipality, a searchable town picker and real-project presets.
import { h, icon, replace, withFocus } from '../dom.js';
import { t, L, locale } from '../../i18n.js';
import * as F from '../format.js';
import { store } from '../../store.js';
import { go, projectToken, simEntryFields } from '../router.js';
import * as towns from '../../data/towns.js';
import * as projects from '../../content/projects.js';
import * as facts from '../../content/facts.js';
import { sourceLink } from '../components/sourceLink.js';
import { kindChip } from '../components/chips.js';
import { sourceMark } from './controls.js';
import * as M from '../../model/model.js';

const { fmtNum, fmtPct } = F;
const fmtCoef = F.fmtCoef || ((v) => fmtNum(v, { digits: 2 }));
const fmtDate = F.fmtDate || ((d) => d);

const TOWNS = () => (Array.isArray(towns.TOWNS) ? towns.TOWNS : []);
const PROJECTS = () => (Array.isArray(projects.PROJECTS) ? projects.PROJECTS : []);
const META = () => towns.TOWNS_META || { sources: [] };

// The five design keys a project preset sets (a preset also carries assumed, mwBasis and declared, which are not design).
const DESIGN_KEYS = ['sizeMW', 'cooling', 'heatReuse', 'site', 'distanceM'];
const STATUS_ORDER = { operating: 0, construction: 1, planned: 2, halted: 3 };

/** Projects in a municipality, operating first (content's projectsInTown when it exists). */
function projectsIn(code) {
  if (code == null) return [];
  if (typeof projects.projectsInTown === 'function') {
    try { return projects.projectsInTown(code) || []; } catch { /* fall through */ }
  }
  return PROJECTS().filter((p) => p.townCode === code)
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
}

/**
 * Load a real project: its town, its five design values, no overrides, and a fresh start (same as a project deep link):
 * playback stops, the preview year, step 1, the view scrolls to the real-project card and the address shows #hanke-<id>.
 */
export function loadProject(p) {
  if (!p) return;
  const st = store.get();
  const pre = p.preset || {};
  const design = { ...st.design };
  for (const k of DESIGN_KEYS) if (pre[k] !== undefined) design[k] = pre[k];
  store.set({
    townCode: p.townCode || st.townCode, presetId: p.id, design, overrides: {},
    ...simEntryFields('project', projectToken(p.id)),
  });
}

/** District-heat status as the model uses it: stats | statsEstimate | local | notInStats | default. */
export function dhStatusOf(town) {
  if (typeof M.districtHeatStatus === 'function') {
    try { const s = M.districtHeatStatus(town); if (s) return s; } catch { /* fall through */ }
  }
  if (!town) return 'default';
  const dh = town.districtHeat || {};
  if (dh.has === true && dh.local === true) return 'local';
  if (dh.has === true) return dh.estimated || !Number.isFinite(dh.demandGWh) ? 'statsEstimate' : 'stats';
  return 'notInStats';
}

const statusText = (p) => (p.statusNote ? L(p.statusNote) : (p.status ? t(`sim.status.${p.status}`) : ''));
/** "Name (Operator)", but no nested brackets when the operator name already has some. */
function nameWithOperator(p) {
  const name = h('strong', null, L(p.name));
  const op = p.operator ? String(p.operator) : '';
  if (!op) return [name];
  return /[()]/.test(op) ? [name, ` · ${op}`] : [name, ` (${op})`];
}

const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function metaSource(re) {
  const list = META().sources || [];
  return list.find((s) => re.test(`${s.name} ${s.url || ''}`)) || list.find((s) => s.type === 'statistics') || list[0] || null;
}

export function townName(town) {
  if (!town) return t('sim.town.average');
  return L(town.name) || town.name?.fi || town.code;
}

export function createTownCard(ctx) {
  const titleId = 'sim-town-title';
  const root = h('section', { class: 'sim-panel sim-town', 'data-step': '1', 'aria-labelledby': titleId });
  let pickerOpen = false;
  let activeIdx = -1;
  let matches = [];

  // --- picker (combobox over TOWNS) ---
  const listId = 'sim-town-list';
  const input = h('input', {
    type: 'text', class: 'sim-input', id: 'sim-town-input', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId,
    'aria-autocomplete': 'list', autocomplete: 'off', spellcheck: 'false', placeholder: t('sim.town.searchPh'),
  });
  const list = h('ul', { class: 'sim-combo__list', id: listId, role: 'listbox', 'aria-label': t('sim.town.search') });
  const count = h('p', { class: 'sim-combo__count muted', 'aria-live': 'polite' });

  // Real projects: the chosen town's own projects first.
  const projectSelect = h('select', { class: 'sim-input sim-select', id: 'sim-project-select' });
  const projOption = (p) => h('option', { value: p.id }, `${L(p.name)}${p.status ? ` · ${t(`sim.status.${p.status}`)}` : ''}`);
  function fillProjectSelect(code) {
    const here = projectsIn(code);
    const ids = new Set(here.map((p) => p.id));
    const rest = PROJECTS().filter((p) => !ids.has(p.id));
    replace(projectSelect,
      h('option', { value: '' }, t('sim.town.projectsPh')),
      here.length ? h('optgroup', { label: L({ fi: 'Tässä kunnassa', en: 'In this town' }) }, here.map(projOption)) : null,
      here.length && rest.length ? h('optgroup', { label: L({ fi: 'Muut hankkeet', en: 'Other projects' }) }, rest.map(projOption)) : rest.map(projOption));
  }
  fillProjectSelect(store.get().townCode);
  projectSelect.addEventListener('change', () => {
    const p = PROJECTS().find((x) => x.id === projectSelect.value);
    if (!p) return;
    loadProject(p);
    closePicker(true);
  });

  const picker = h('div', { class: 'sim-combo', hidden: true },
    h('label', { class: 'sim-label', for: 'sim-town-input' }, t('sim.town.search')),
    h('div', { class: 'sim-combo__field' }, icon('search', { size: 18 }), input),
    count,
    list,
    h('div', { class: 'sim-combo__more' },
      PROJECTS().length ? h('label', { class: 'sim-label', for: 'sim-project-select' }, t('sim.town.projects')) : null,
      PROJECTS().length ? projectSelect : null,
      h('a', { class: 'sim-link', href: '#koti', onclick: (e) => { e.preventDefault(); go('koti'); } }, icon('map', { size: 16 }), t('sim.town.map'))));

  const changeBtn = h('button', { type: 'button', class: 'btn btn--small sim-town__change', 'aria-expanded': 'false', onclick: () => (pickerOpen ? closePicker(true) : openPicker()) },
    icon('search', { size: 16 }), t('sim.town.change'));

  function filter() {
    const q = fold(input.value.trim());
    const all = TOWNS();
    if (!q) matches = [...all].sort((a, b) => (b.population || 0) - (a.population || 0)).slice(0, 40);
    else {
      const starts = []; const contains = [];
      for (const tw of all) {
        const names = [tw.name?.fi, tw.name?.sv, tw.name?.en].map(fold);
        if (names.some((n) => n.startsWith(q))) starts.push(tw);
        else if (names.some((n) => n.includes(q))) contains.push(tw);
      }
      matches = [...starts.sort((a, b) => fold(a.name?.fi).localeCompare(fold(b.name?.fi))), ...contains].slice(0, 60);
    }
    activeIdx = matches.length ? 0 : -1;
    renderList();
  }
  function renderList() {
    replace(list, ...matches.map((tw, i) => h('li', {
      id: `sim-town-opt-${tw.code}`, role: 'option', class: ['sim-combo__opt', i === activeIdx && 'is-active'], 'aria-selected': i === activeIdx ? 'true' : 'false',
      onmousedown: (e) => e.preventDefault(), onclick: () => choose(tw),
    }, h('span', { class: 'sim-combo__name' }, townName(tw)),
    Number.isFinite(tw.population) ? h('span', { class: 'sim-combo__pop' }, fmtNum(tw.population, { sig: 2 })) : null)));
    count.textContent = matches.length ? t('sim.town.results', { n: matches.length }) : t('sim.town.noResults');
    input.setAttribute('aria-activedescendant', activeIdx >= 0 ? `sim-town-opt-${matches[activeIdx].code}` : '');
    const act = list.children[activeIdx];
    if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function choose(tw) {
    const st = store.get();
    store.set({ townCode: tw.code, presetId: null, simStep: (st.simStep || 1) <= 1 ? 2 : st.simStep });
    closePicker(true);
  }
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (matches.length) { activeIdx = (activeIdx + 1) % matches.length; renderList(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (matches.length) { activeIdx = (activeIdx - 1 + matches.length) % matches.length; renderList(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[activeIdx]) choose(matches[activeIdx]); }
    else if (e.key === 'Escape') { e.preventDefault(); closePicker(true); }
  });

  function openPicker() {
    pickerOpen = true;
    picker.hidden = false;
    changeBtn.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-expanded', 'true');
    input.value = '';
    projectSelect.value = '';
    filter();
    input.focus();
  }
  function closePicker(focusBtn) {
    pickerOpen = false;
    picker.hidden = true;
    changeBtn.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-expanded', 'false');
    if (focusBtn) changeBtn.focus({ preventScroll: true });
  }

  // --- banner + facts + preset ---
  const head = h('div', { class: 'sim-panel__head' });
  const bannerEl = h('div', { class: 'rail-realproj', hidden: true });
  const factsEl = h('dl', { class: 'sim-town__facts' });
  const presetEl = h('div', { class: 'sim-preset rail-preset' });
  root.append(head, bannerEl, factsEl, picker, presetEl);

  function row(label, value, src, extra) {
    return h('div', { class: 'sim-town__row' },
      h('dt', null, label),
      h('dd', null, h('span', { class: 'sim-town__val' }, value), extra || null,
        src ? sourceMark(src, t('sim.town.source', { name: L(src.name) })) : null));
  }

  // "A real project in this town" — only while no project is loaded.
  function renderBanner(state, town) {
    const here = !state.presetId && town ? projectsIn(town.code).slice(0, 3) : [];
    bannerEl.hidden = !here.length;
    if (!here.length) { replace(bannerEl); return; }
    const loadLabel = L({ fi: 'Lataa hanke', en: 'Load this project' });
    const loadBtn = (p) => h('button', {
      type: 'button', class: 'btn btn--small btn--primary rail-realproj__btn', 'data-fk': `load-${p.id}`,
      'aria-label': `${loadLabel}: ${L(p.name)}`, onclick: () => loadProject(p),
    }, icon('arrowRight', { size: 16 }), loadLabel);
    const line = (p) => {
      const note = statusText(p);
      return [...nameWithOperator(p), note ? ` · ${note}` : ''];
    };
    withFocus(bannerEl, () => {
      if (here.length === 1) {
        replace(bannerEl,
          h('p', { class: 'rail-realproj__text' },
            h('span', null, `${L({ fi: 'Todellinen hanke tässä kunnassa', en: 'A real project in this town' })}: `, ...line(here[0]))),
          loadBtn(here[0]));
      } else {
        replace(bannerEl,
          h('p', { class: 'rail-realproj__text' }, L({ fi: 'Todellisia hankkeita tässä kunnassa:', en: 'Real projects in this town:' })),
          h('ul', { class: 'rail-realproj__list' }, here.map((p) => h('li', null, h('span', null, ...line(p)), loadBtn(p)))));
      }
    });
  }

  function update(state) {
    const town = ctx.town();
    replace(head,
      h('p', { class: 'sim-panel__eyebrow' }, h('span', { class: 'sim-panel__num' }, '1'), t('sim.town.title')),
      h('div', { class: 'sim-town__titlebar' },
        h('h2', { class: 'sim-town__name', id: titleId }, townName(town)),
        changeBtn));
    const statSrc = metaSource(/tilasto|statistic|stat\.fi/i);
    const dhSrc = metaSource(/energiateollisuus|kaukol|district|energia\.fi/i);
    const taxSrc = metaSource(/vero|tax/i);
    if (!town) {
      replace(factsEl, h('p', { class: 'muted' }, t('sim.town.unknown')));
    } else {
      const dh = town.districtHeat || {};
      const dhs = dhStatusOf(town);
      // has:false only means "not in Finnish Energy's statistics" — never state "no network" as a fact.
      const dhText = dhs === 'local'
        ? L({ fi: 'Kyllä, paikallinen verkko', en: 'Yes, a local network' })
        : dhs === 'notInStats'
          ? L({ fi: 'Ei tilastossa (paikallinen verkko mahdollinen)', en: 'Not in the statistics (a local network is possible)' })
          : dh.has === true
            ? (Number.isFinite(dh.demandGWh) ? t('sim.town.dhYesDemand', { gwh: fmtNum(dh.demandGWh) }) : t('sim.town.dhYes'))
            : t('sim.town.dhUnknown');
      const unemp = Number.isFinite(town.unemployed)
        ? `${fmtNum(town.unemployed)}${Number.isFinite(town.unemploymentPct) ? ` (${fmtPct(town.unemploymentPct / 100, { sig: 2 })})` : ''}`
        : (Number.isFinite(town.unemploymentPct) ? fmtPct(town.unemploymentPct / 100) : t('common.unknown'));
      const rate = town.propertyTax?.generalRatePct;
      replace(factsEl,
        row(t('sim.town.population'), Number.isFinite(town.population) ? fmtNum(town.population, { sig: 3 }) : t('common.unknown'), statSrc),
        row(t('sim.town.households'), Number.isFinite(town.households) ? fmtNum(town.households, { sig: 2 }) : t('common.unknown'), statSrc),
        row(t('sim.town.unemployed'), unemp, statSrc),
        row(t('sim.town.dh'), dhText, dhSrc, dh.has === true && dh.estimated ? h('span', { class: 'sim-tag' }, t('sim.town.estimate')) : null),
        row(t('sim.town.taxRate'), Number.isFinite(rate) ? `${rate.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : t('common.unknown'), taxSrc));
    }
    renderBanner(state, town);
    fillProjectSelect(town ? town.code : null);
    renderPreset(state);
  }

  // --- preset panel: status-aware and compact ---
  const VISIBLE_FACTS = 3;
  function factLine(f) {
    const src = f.source;
    return h('li', { class: 'rail-fact' },
      h('div', { class: 'rail-fact__meta' },
        f.kind ? kindChip(f.kind) : null,
        src ? h('span', { class: 'rail-fact__src' },
          src.url
            ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, L(src.name),
              h('span', { class: 'sr-only' }, ` ${t('common.newTab')}`))
            : L(src.name),
          src.date ? ` · ${fmtDate(src.date)}` : '') : null),
      h('p', { class: 'rail-fact__claim' }, L(f.claim)));
  }

  /** "Koko laskelmassa: 212 MW IT-tehoa" + where the number comes from (preset.mwBasis). */
  function sizeLine(p, state) {
    const pre = p.preset || {};
    if (!Number.isFinite(pre.sizeMW)) return null;
    // An unpublished size can be changed from the results banner (the project stays loaded): show the size in use.
    const cur = state?.design?.sizeMW;
    if (Array.isArray(pre.assumedKeys) && pre.assumedKeys.includes('sizeMW') && Number.isFinite(cur) && cur !== pre.sizeMW) {
      return h('p', { class: 'rail-preset__size' },
        h('strong', null, `${L({ fi: 'Koko laskelmassa', en: 'Size in the calculation' })}: `),
        `${fmtCoef(cur)} MW ${L({ fi: 'IT-tehoa', en: 'IT load' })} `,
        L({ fi: '(oletus; kokoa ei ole julkaistu).', en: '(an assumption; no size has been published).' }));
    }
    const mw = `${fmtCoef(pre.sizeMW)} MW`;
    const stated = Number.isFinite(p.mw) ? `${fmtCoef(p.mw)} MW` : null;
    const div = fmtCoef(1.25);
    let basis;
    if (!stated) {
      basis = L({ fi: '(oletuksemme, kokoa ei ole julkaistu).', en: '(our assumption; no size has been published).' });
    } else if (pre.mwBasis === 'it') {
      basis = L({ fi: '(hankkeen oma luku).', en: '(the project’s own figure).' });
    } else if (pre.mwBasis === 'total') {
      basis = L({ fi: `. Hanke ilmoittaa koko laitokselle ${stated}; palvelimille arvioitu ${fmtCoef(p.mw)} ÷ ${div}.`,
        en: `. The project states ${stated} for the whole site; servers estimated as ${fmtCoef(p.mw)} ÷ ${div}.` });
    } else if (pre.mwBasis === 'unknown') {
      basis = L({ fi: '. Lähde ei kerro, onko luku palvelinten vai koko laitoksen teho.', en: '. The source does not say whether this is server power or the whole site’s power.' });
    } else {
      basis = p.mw === pre.sizeMW ? '.' : L({ fi: `. Hankkeen ilmoittama koko: ${stated}.`, en: `. Size stated by the project: ${stated}.` });
    }
    return h('p', { class: 'rail-preset__size' },
      h('strong', null, `${L({ fi: 'Koko laskelmassa', en: 'Size in the calculation' })}: `),
      `${mw} ${L({ fi: 'IT-tehoa', en: 'IT load' })}`, basis.startsWith('.') ? basis : ` ${basis}`);
  }

  function renderPreset(state) {
    const p = state.presetId && projects.projectById ? projects.projectById(state.presetId) : null;
    if (!p) { replace(presetEl); presetEl.hidden = true; return; }
    presetEl.hidden = false;
    const factList = (p.actualFacts || []).map((id) => facts.factById?.(id)).filter(Boolean);
    // Never "what really happened" for a project that is not built: planned / building projects have reported plans.
    const happened = p.status === 'operating' || p.status === 'halted';
    const heading = happened
      ? L({ fi: 'Mitä on tapahtunut?', en: 'What has happened?' })
      : L({ fi: 'Mitä hankkeesta on kerrottu?', en: 'What has the project reported?' });
    const lead = L({
      fi: `Merkki kertoo, onko tieto ${t('kind.measured').toLowerCase()}, ${t('kind.estimate').toLowerCase()} vai ${t('kind.opinion').toLowerCase()}.`,
      en: `The label says whether it is ${t('kind.measured').toLowerCase()}, an ${t('kind.estimate').toLowerCase()} or a ${t('kind.opinion').toLowerCase()}.`,
    });
    const first = factList.slice(0, VISIBLE_FACTS);
    const rest = factList.slice(VISIBLE_FACTS);
    const sources = p.sources || [];
    const pre = p.preset || {};
    const body = h('div', { class: 'rail-preset__body' });
    const more = rest.length || sources.length || p.summary
      ? h('details', { class: 'rail-preset__more' },
        h('summary', { 'data-fk': 'preset-more' }, rest.length
          ? L({ fi: `Näytä kaikki ${factList.length}`, en: `Show all ${factList.length}` })
          : L({ fi: 'Lisää hankkeesta', en: 'More about the project' })),
        rest.length ? h('ul', { class: 'rail-facts' }, rest.map(factLine)) : null,
        p.summary ? h('p', { class: 'sim-preset__summary' }, L(p.summary)) : null,
        sources.length ? h('div', { class: 'sim-preset__sources' }, sources.map((s) => sourceLink(s))) : null)
      : null;
    // Collapsed: the first three facts are clamped to two lines; "show all" opens the rest and the full texts.
    more?.addEventListener('toggle', () => body.classList.toggle('is-expanded', more.open));
    replace(body,
      h('h4', { class: 'rail-preset__heading' }, heading),
      h('p', { class: 'rail-preset__lead' }, lead),
      first.length ? h('ul', { class: 'rail-facts' }, first.map(factLine)) : h('p', { class: 'muted sim-small' }, t('sim.preset.none')),
      more);
    withFocus(presetEl, () => replace(presetEl,
      h('div', { class: 'sim-preset__head' },
        h('div', { class: 'rail-preset__top' },
          h('p', { class: 'sim-preset__label' }, t('sim.preset.label'), p.status ? h('span', { class: 'sim-tag' }, t(`sim.status.${p.status}`)) : null),
          h('button', { type: 'button', class: 'btn btn--ghost btn--small rail-preset__clear', 'data-fk': 'preset-clear', onclick: () => store.set({ presetId: null }) },
            icon('close', { size: 14 }), t('sim.preset.clear'))),
        h('h3', { class: 'sim-preset__name' }, L(p.name)),
        p.statusNote ? h('p', { class: 'rail-preset__status' }, L(p.statusNote)) : null,
        sizeLine(p, state),
        pre.assumed ? h('details', { class: 'rail-preset__assumed' },
          h('summary', { 'data-fk': 'preset-assumed' }, h('strong', null, `${t('sim.preset.assumed')}: `), h('span', null, L(pre.assumed)))) : null),
      body));
  }

  return { el: root, update, focusPicker: openPicker, presetEl };
}
