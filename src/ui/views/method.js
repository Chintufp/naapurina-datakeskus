// Method (#menetelma): how the calculation works in plain words, an example from a real model run, what "MW" means,
// waste heat in three parts, the formula of every metric (taken from simulate()), what we deliberately do not
// calculate, data sources and licences, limitations, accessibility, how Despro could develop this further, and an
// update log.
import { h, icon } from '../dom.js';
import { store } from '../../store.js';
import { t, L } from '../../i18n.js';
import { go } from '../router.js';
import { fmtNum, fmtPct, fmtDate, fmtMetricRange } from '../format.js';
import { kindChip, confidenceChip } from '../components/chips.js';
import { sourceLink } from '../components/sourceLink.js';
import { term, autoTerms } from '../components/term.js';
import * as Model from '../../model/model.js';
import * as Coef from '../../model/coefficients.js';
import * as Towns from '../../data/towns.js';
import { townByCode, townName, arr, THEMES, THEME_HUE, FACTS, PROJECTS, fmtCoef, scrollBehavior } from '../pages/common.js';
import * as C from '../pages/methodContent.js';

const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
const WORDS = ['GWh', 'desibeli', 'YVA', 'polttoaineteho', 'itTeho', 'sahkoliittyma', 'lampopumppu', 'kaukolampo'];

export function mount(el) {
  const st = store.get();
  const town = townByCode(st.townCode) || townByCode('837');
  const design = st.design;
  let res = null;
  let resHeat = null;
  try {
    if (typeof Model.simulate === 'function') {
      res = Model.simulate(design, town, {});
      // the heat example always has heat reuse on, so all three parts have a value
      resHeat = design.heatReuse ? res : Model.simulate({ ...design, heatReuse: true }, town, {});
    }
  } catch (e) { console.warn(e); }
  const COEF = Coef.COEF || {};
  const mw = fmtNum(design.sizeMW, { digits: 1 });
  const seen = new Set();
  const words = (text) => autoTerms(text, WORDS, seen); // each term explained at its first mention on the page

  const sections = [
    ['m-how', L({ fi: 'Laskenta lyhyesti', en: 'The calculation in brief' })],
    ['m-mw', L(C.MW_BASIS.title)],
    ['m-heat', L(C.HEAT_SPLIT.title)],
    ['m-formulas', t('m.formulasTitle')],
    ['m-not', L({ fi: 'Mitä emme laske', en: 'What we do not calculate' })],
    ['m-data', t('m.dataTitle')],
    ['m-limits', L({ fi: 'Rajoitukset', en: 'Limitations' })],
    ['m-access', L(C.ACCESSIBILITY.title)],
    ['m-develop', L({ fi: 'Näin tätä voisi kehittää', en: 'How this could be developed' })],
    ['m-log', t('m.logTitle')],
  ];
  const sec = (id, ...children) => h('section', { class: 'm-sec', 'aria-labelledby': `${id}-h` },
    h('h2', { id: `${id}-h`, tabindex: '-1', class: 'anchor-target' }, sections.find((x) => x[0] === id)[1]), ...children);

  // ---------- 1. how ----------
  const example = (() => {
    const m = res?.metrics?.electricity;
    if (!m) return null;
    const hd = m.headline;
    const max = hd.high * 1.25;
    const x = (v) => `${(v / max) * 100}%`;
    return h('figure', { class: 'm-example panel' },
      h('figcaption', null, h('span', { class: 'eyebrow' }, t('m.example')), ' ', t('m.exampleText', { mw, town: townName(town) })),
      h('div', { class: 'm-example__bar', role: 'img', 'aria-label': `${fmtMetricRange(m)} (p10–p90), ${L({ fi: 'tyypillisesti', en: 'typically' })} ${fmtNum(hd.typ)} ${L(m.unit)}` },
        h('span', { class: 'm-example__band', style: { left: x(hd.low), width: `calc(${x(hd.high)} - ${x(hd.low)})` } }),
        h('span', { class: 'm-example__dot', style: { left: x(hd.typ) } }),
        h('span', { class: 'm-example__lbl m-example__lbl--low', style: { left: x(hd.low) } }, h('b', null, fmtNum(hd.low)), h('span', null, L({ fi: '10 % tuloksista alle', en: '10% of results below' }))),
        h('span', { class: 'm-example__lbl m-example__lbl--typ', style: { left: x(hd.typ) } }, h('b', null, fmtNum(hd.typ)), h('span', null, L({ fi: 'tyypillinen', en: 'typical' }))),
        h('span', { class: 'm-example__lbl m-example__lbl--high', style: { left: x(hd.high) } }, h('b', null, fmtNum(hd.high)), h('span', null, L({ fi: '10 % tuloksista yli', en: '10% of results above' })))),
      h('p', { class: 'm-example__res' }, kindChip('calculated'), ' ', h('strong', null, words(fmtMetricRange(m))), ' ', L(hd.when)));
  })();

  const how = sec('m-how',
    h('p', { class: 'lead' }, L(C.INTRO)),
    h('ol', { class: 'm-steps' }, C.STEPS.map((s, i) => h('li', { class: 'm-step' },
      h('span', { class: 'm-step__n', 'aria-hidden': 'true' }, String(i + 1)),
      h('span', { class: 'm-step__icon', 'aria-hidden': 'true' }, icon(s.icon, { size: 22 })),
      h('h3', null, i === 2 ? L({ fi: `${res?.meta?.samples || 400} laskentaa`, en: `${res?.meta?.samples || 400} calculations` }) : L(s.title)),
      h('p', null, words(L(s.text)))))),
    example,
    h('p', null, words(L(C.TOWN_DATA))),
    h('div', { class: 'm-why' }, h('p', null, icon('info', { size: 16 }), ' ', L(C.WHY_RANGES)), sourceLink(C.WHY_RANGES_SOURCE)),
    h('div', { class: 'm-labels' },
      h('h3', { class: 'm-labels__h' }, t('facts.labelsTitle')),
      C.LABEL_KINDS.map((k) => h('p', { class: 'm-labels__item' }, kindChip(k), h('span', null, C.kindHelp(k)))),
      h('p', { class: 'm-labels__rule' }, L(C.LABEL_RULE))));

  // ---------- coefficient line (used by several sections): inputs as stored, never rounded ----------
  const coefLine = (k) => {
    const c = COEF[k];
    if (!c) return h('li', null, k);
    const range = c.low === c.high ? fmtCoef(c.typ) : `${fmtCoef(c.low)} / ${fmtCoef(c.typ)} / ${fmtCoef(c.high)}`;
    return h('li', { class: 'm-coef' },
      h('span', { class: 'm-coef__t' }, L(c.title)),
      h('span', { class: 'm-coef__v' }, `${range} ${L(c.unit)}`.trim()),
      c.confidence ? confidenceChip(c.confidence) : null,
      c.note ? h('span', { class: 'm-coef__note' }, L(c.note)) : null,
      arr(c.sources)[0] ? h('span', { class: 'm-coef__src' }, sourceLink(arr(c.sources)[0])) : null);
  };

  // ---------- MW means IT load ----------
  const gp = COEF.gridPeakRatio || { low: 1.2, typ: 1.25, high: 1.4 };
  const mwVars = {
    low: fmtCoef(gp.low), high: fmtCoef(gp.high), typ: fmtCoef(gp.typ),
    ex1: fmtNum(100 * gp.low, { sig: 3 }), ex2: fmtNum(100 * gp.high, { sig: 3 }),
  };
  const mwSec = sec('m-mw',
    h('p', null, words(fill(L(C.MW_BASIS.text), mwVars))),
    h('p', null, fill(L(C.MW_BASIS.projects), mwVars)),
    COEF.gridPeakRatio ? h('ul', { class: 'm-coefs m-coefs--box' }, coefLine('gridPeakRatio')) : null);

  // ---------- waste heat in three parts ----------
  const cap = COEF['heat.capture'];
  const capText = cap ? (cap.low === cap.high ? fmtPct(cap.typ) : `${fmtNum(cap.low * 100)}–${fmtPct(cap.high)}`) : L({ fi: 'suurin osa', en: 'most' });
  const hm = resHeat?.metrics || {};
  const newHeatModel = !!hm.heatPumpElectricity; // the three-part split exists in the model
  const heatSec = sec('m-heat',
    h('p', null, L(C.HEAT_SPLIT.lead)),
    h('ol', { class: 'm-heat' }, C.HEAT_SPLIT.parts.map((p, i) => {
      const m = newHeatModel ? hm[p.key] : null;
      return h('li', { class: 'm-heat__part' },
        h('span', { class: 'm-heat__n', 'aria-hidden': 'true' }, String(i + 1)),
        h('div', null,
          h('h3', { class: 'm-heat__t' }, L(p.title)),
          h('p', null, words(fill(L(p.text), { cap: capText }))),
          m?.headline ? h('p', { class: 'm-heat__ex' }, kindChip('calculated', { compact: true }), ' ',
            L({ fi: `Esimerkki (${mw} MW, kunta: ${townName(town)}): `, en: `Example (${mw} MW, town: ${townName(town)}): ` }),
            h('strong', null, fmtMetricRange(m)), ' ', L(m.headline.when)) : null));
    })),
    h('ul', { class: 'src-list m-src' }, arr(C.HEAT_SPLIT.sources || [C.HEAT_SPLIT.source]).filter(Boolean).map((x) => h('li', null, sourceLink(x)))));

  // ---------- formulas ----------
  const themes = THEMES();
  const metricKeys = Model.METRIC_KEYS || {};
  const formulas = sec('m-formulas',
    h('p', null, t('m.formulasLead', { mw, town: townName(town) })),
    res ? h('div', { class: 'm-formulas' }, Object.entries(metricKeys).map(([theme, keys]) => {
      const th = themes.find((x) => x.key === theme);
      const ms = arr(keys).map((k) => res.metrics?.[k]).filter(Boolean);
      if (!ms.length) return null;
      return h('div', { class: 'm-theme', style: { '--hue': THEME_HUE[theme] || 'var(--accent)' } },
        h('h3', { class: 'm-theme__h' }, th ? L(th.title) : theme),
        ms.map((m) => h('details', { class: 'm-metric' },
          h('summary', null,
            h('span', { class: 'm-metric__t' }, L(m.title)),
            h('span', { class: 'm-metric__r' }, fmtMetricRange(m))),
          h('div', { class: 'm-metric__body' },
            h('p', { class: 'm-metric__f' }, h('strong', null, L({ fi: 'Kaava: ', en: 'Formula: ' })), L(m.formula)),
            h('div', { class: 'm-metric__chips' }, kindChip(m.kind || 'calculated'), m.confidence ? confidenceChip(m.confidence) : null),
            arr(m.inputs).length ? h('div', null, h('p', { class: 'm-metric__sub' }, t('m.inputs')), h('ul', { class: 'm-coefs' }, arr(m.inputs).map(coefLine))) : null,
            m.townContext ? h('p', { class: 'm-metric__ctx' }, icon('map', { size: 15 }), ' ', L(m.townContext)) : null,
            m.notes ? h('p', { class: 'm-metric__note' }, L(m.notes)) : null))));
    })) : h('p', { class: 'muted' }, t('m.noModel')),
    h('p', null, h('a', { href: '#lahteet', onclick: (e) => { e.preventDefault(); go('lahteet'); } }, t('m.coefLink'), ' ', icon('arrowRight', { size: 15 }))));

  // ---------- 3. not calculated ----------
  const not = sec('m-not',
    h('p', null, L({ fi: 'Laskemme vain sen, minkä voi perustella lähteillä. Nämä asiat ovat tärkeitä, mutta niistä näytämme näkemyksiä ja avoimia kysymyksiä, emme lukuja.', en: 'We only calculate what can be backed by sources. These things matter, but for them we show viewpoints and open questions, not numbers.' })),
    h('ul', { class: 'm-not' }, C.NOT_CALCULATED.map((n) => h('li', null, h('h3', null, L(n.title)), h('p', null, L(n.text))))),
    h('p', null, h('a', { href: '#lahteet', onclick: (e) => { e.preventDefault(); go('lahteet'); } }, L({ fi: 'Katso ”Tätä ei tiedä kukaan” ja ”Lähteet ovat eri mieltä”', en: 'See “Nobody knows this” and “Sources disagree”' }), ' ', icon('arrowRight', { size: 15 }))));

  // ---------- 4. data & licences ----------
  const meta = Towns.TOWNS_META || {};
  const fieldYears = meta.fieldYears || {};
  const useOf = (fields) => arr(fields).map((f) => {
    const map = {
      population: { fi: 'väkiluku', en: 'population' }, households: { fi: 'kotitaloudet', en: 'households' }, employed: { fi: 'työlliset', en: 'employed' },
      unemploymentPct: { fi: 'työttömyysaste', en: 'unemployment rate' }, unemployed: { fi: 'työttömät', en: 'unemployed' }, jobs: { fi: 'työpaikat', en: 'jobs' },
      propertyTax: { fi: 'kiinteistövero', en: 'property tax' }, districtHeat: { fi: 'kaukolämpö', en: 'district heat' },
      centroid: { fi: 'kartan pisteet', en: 'map points' }, map: { fi: 'kuntarajat', en: 'municipal borders' },
    };
    const yr = fieldYears[f];
    return `${L(map[f] || { fi: f, en: f })}${yr ? ` ${yr}` : ''}`;
  }).join(', ');
  const dataRows = [
    ...arr(meta.sources).map((s) => ({ name: s.name, url: s.url, use: useOf(s.fields), licence: localLicence(s.licence), date: s.date })),
    ...C.EXTRA_DATA.map((d) => ({ name: L(d.name), url: d.url, use: L(d.use), licence: L(d.licence), date: d.date, toSources: d.toSources })),
  ];
  const data = sec('m-data',
    h('div', { class: 'coef-wrap' }, h('table', { class: 'coef m-data' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, t('m.dName')), h('th', { scope: 'col' }, t('m.dUse')), h('th', { scope: 'col' }, t('m.dLicence')), h('th', { scope: 'col' }, t('m.dDate')))),
      h('tbody', null, dataRows.map((r) => h('tr', null,
        h('th', { scope: 'row', 'data-label': t('m.dName') }, r.url ? h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.name, ' ', icon('link', { size: 13 }))
          : r.toSources ? h('a', { href: '#lahteet', onclick: (e) => { e.preventDefault(); go('lahteet'); } }, r.name) : r.name),
        h('td', { 'data-label': t('m.dUse') }, r.use || '–'),
        h('td', { 'data-label': t('m.dLicence') }, r.licence),
        h('td', { 'data-label': t('m.dDate') }, r.date ? fmtDate(r.date) : '–')))))),
    arr(meta.notes).length ? h('details', { class: 'm-notes' }, h('summary', null, L({ fi: 'Huomioita kuntatiedoista', en: 'Notes on the town data' })),
      h('ul', null, arr(meta.notes).map((n) => h('li', null, plainNote(L(n)))))) : null);

  // ---------- 5. limitations ----------
  const limits = sec('m-limits', h('ul', { class: 'm-limits' }, C.LIMITATIONS.map((x) => h('li', null, L(x)))));

  // ---------- accessibility: what is done, what is known to be missing (no conformance claim) ----------
  const access = sec('m-access',
    h('p', null, L(C.ACCESSIBILITY.done)),
    h('p', null, L(C.ACCESSIBILITY.gaps)));

  // ---------- 6. develop ----------
  const develop = sec('m-develop',
    h('p', { class: 'lead' }, L(C.DEVELOP_LEAD).split(/(OAS|YVA|EIA)/).map((part) => (part === 'OAS' ? term('OAS', 'OAS') : part === 'YVA' || part === 'EIA' ? term('YVA', part) : part))),
    h('ol', { class: 'm-flow' }, C.DEVELOP.map((d, i) => h('li', { class: 'm-flow__step' },
      h('span', { class: 'm-flow__icon', 'aria-hidden': 'true' }, icon(d.icon, { size: 22 })),
      h('div', null, h('h3', null, h('span', { class: 'm-flow__n' }, `${i + 1}. `), L(d.title)), h('p', null, L(d.text)))))),
    h('div', { class: 'm-proposal' },
      h('h3', { class: 'm-proposal__h' }, L(C.WHO_PAYS.title), ' ', h('span', { class: 'm-proposal__tag' }, L({ fi: 'Ehdotus', en: 'Proposal' }))),
      h('p', null, L(C.WHO_PAYS.text))),
    h('p', { class: 'm-tech' }, L(C.TECH)));

  // ---------- 7. log ----------
  const counts = L({
    fi: `Sisältö nyt: ${FACTS().length} faktakorttia, ${PROJECTS().length} hanketta, ${Object.keys(COEF).length} kerrointa, ${arr(Towns.TOWNS).length} kuntaa.`,
    en: `Content now: ${FACTS().length} fact cards, ${PROJECTS().length} projects, ${Object.keys(COEF).length} coefficients, ${arr(Towns.TOWNS).length} municipalities.`,
  });
  const log = sec('m-log',
    h('ol', { class: 'm-log' }, C.LOG.map((e) => h('li', null, h('time', { datetime: e.date }, fmtDate(e.date)), h('p', null, L(e.text))))),
    h('p', { class: 'muted' }, counts));

  // ---------- TOC ----------
  const toc = h('nav', { class: 'm-toc', 'aria-label': t('m.toc') },
    h('p', { class: 'm-toc__h' }, t('m.toc')),
    h('ol', null, sections.map(([id, label]) => h('li', null, h('button', {
      type: 'button', class: 'm-toc__link',
      onclick: () => { const tgt = document.getElementById(`${id}-h`); tgt?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); tgt?.focus({ preventScroll: true }); },
    }, label)))));

  el.append(h('div', { class: 'page method-page' },
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, t('m.eyebrow')),
      h('h1', null, t('m.title'))),
    h('div', { class: 'm-layout' }, toc, h('div', { class: 'm-main' }, how, mwSec, heatSec, formulas, not, data, limits, access, develop, log))));
  return () => {};
}

// The town-data notes are written for developers too ("(has: true)", "null if …"); show them without field names.
function plainNote(text) {
  return String(text)
    .replace(/\s*\((?:has|estimated|null|demandGWh|revenueEur|residentsSharePct)\b[^)]*\)/g, '')
    .replace(/^residentsSharePct = /, '')
    .replace(/^has: false tarkoittaa/, '”Ei tilastossa” tarkoittaa')
    .replace(/^has: false means/, '“Not in the statistics” means')
    .replace(/\bnull, jos\b/, 'Tieto puuttuu, jos')
    .replace(/\bnull if\b/, 'Missing if')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

// Town-data licences are plain Finnish strings in TOWNS_META ("Lähde: Verohallinto"); show "Source: …" in English.
function localLicence(v) {
  if (!v) return '–';
  if (typeof v !== 'string') return L(v);
  return v.replace(/^Lähde:\s*/, (m) => (L({ fi: m, en: 'Source: ' })));
}
