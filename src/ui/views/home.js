// Home (#koti): the thesis ("same data centre, different town, different story"), a town search, the chosen town's own
// numbers (two possible benefits beside two possible drawbacks, never a verdict), the interactive map of Finland, a
// "same data centre, many towns" comparison, the brief's numbers, the three pillars and the real projects.
// DOM order = visual order on every screen size: text → search → town card + start button → map.
import { h, icon } from '../dom.js';
import { store } from '../../store.js';
import { t, L, locale } from '../../i18n.js';
import { go } from '../router.js';
import { fmtNum, fmtPct, fmtRange, fmtDate } from '../format.js';
import * as F from '../format.js';
import { kindChip } from '../components/chips.js';
import { mountMapFinland } from '../components/mapFinland.js';
import { term, autoTerms } from '../components/term.js';
import * as Model from '../../model/model.js';
import * as Coef from '../../model/coefficients.js';
import {
  PROJECTS, FACTS, STATUSES, townByCode, townName, townCombobox, projectCard, sectionHead, fmtEurRange,
  projectsInTown, loadProject, statusIcon, statusText, kids, withFocus, say, scrollBehavior,
} from '../pages/common.js';

// Towns for the "same data centre, different town" strip: tiny without a network → small → medium → big cities.
const COMPARE_TOWNS = ['785', '075', '205', '398', '837', '091'];
const FIRST_PROJECTS = 6;
const NARROW = '(max-width: 979px)';

const coefTyp = (key, fallback) => {
  const c = (Coef.COEF || {})[key];
  return c && Number.isFinite(c.typ) && c.typ > 0 ? c.typ : fallback;
};

const simCache = new Map();
function simFor(code, design) {
  const key = `${code}|${design.sizeMW}|${design.cooling}|${design.site}|${design.distanceM}`;
  if (simCache.has(key)) return simCache.get(key);
  let res = null;
  try {
    const town = townByCode(code);
    if (town && typeof Model.simulate === 'function') res = Model.simulate({ ...design, heatReuse: true }, town, {});
  } catch (e) { console.warn('simulate failed', e); }
  simCache.set(key, res);
  return res;
}
const hl = (res, key) => res?.metrics?.[key]?.headline || null;
const scale = (r, k) => (r && Number.isFinite(k) && k > 0 ? { low: r.low * k, typ: r.typ * k, high: r.high * k } : null);
const per = (r, denom) => (r && denom > 0 ? scale(r, 1 / denom) : null);
const comp = (res, metric, key) => {
  const list = res?.metrics?.[metric]?.comparisons;
  return Array.isArray(list) ? list.find((c) => c && c.key === key) || null : null;
};

/** District heat as the statistics see it: 'stats' | 'statsEstimate' | 'local' | 'notInStats' (+ demand in GWh/yr). */
function dhInfo(town, meta = {}) {
  const d = town?.districtHeat || {};
  let status = typeof meta.dhStatus === 'string' ? meta.dhStatus : null;
  if (!status) status = !d.has ? 'notInStats' : d.local ? 'local' : (d.estimated || !(d.demandGWh > 0)) ? 'statsEstimate' : 'stats';
  const fromModel = Number.isFinite(meta.demandGWh) && meta.demandGWh > 0 ? meta.demandGWh : null;
  const demand = status === 'notInStats' ? null : fromModel ?? (d.demandGWh > 0 ? d.demandGWh : null);
  const estimated = status === 'statsEstimate' || status === 'local' || (status !== 'notInStats' && !!meta.dhEstimated);
  return { status, demand, estimated };
}

/** Everything the town card and the comparison need for one town. Shares are fractions (1 = 100 %, 2 = 2 ×). */
function figures(code, design) {
  const town = townByCode(code);
  const res = simFor(code, design);
  if (!town || !res) return null;
  const dh = dhInfo(town, res.meta?.town || {});
  const elComp = comp(res, 'electricity', 'townHomes');
  const waterComp = comp(res, 'water', 'pctTown');
  const pitchComp = comp(res, 'land', 'pitches');
  const land = hl(res, 'land');
  return {
    town, dh,
    heat: dh.demand ? per(hl(res, 'heatUsed'), dh.demand) : null,
    jobsShare: per(hl(res, 'jobsPermanent'), town.unemployed),
    tax: hl(res, 'propertyTax'),
    taxShare: per(hl(res, 'propertyTax'), town.propertyTax?.revenueEur),
    // electricity of the data centre ÷ electricity of all the town's homes (a multiple)
    el: elComp ? scale(elComp, 1) : per(scale(hl(res, 'electricity'), 1e6 / coefTyp('home.electricity', 5000)), town.households),
    // water of the data centre ÷ water used by the town's residents (model gives % or, above 200 %, times)
    water: waterComp ? scale(waterComp, waterComp.times ? 1 : 0.01)
      : per(hl(res, 'water'), (town.population || 0) * coefTyp('water.perPerson', 60)),
    land,
    pitches: pitchComp ? scale(pitchComp, 1) : per(land, coefTyp('land.footballPitch', 0.714)),
    trucks: hl(res, 'trucks'),
  };
}

const X = ' ×';
const fmtInt = typeof F.fmtInt === 'function' ? F.fmtInt
  : (v) => (Number.isFinite(v) ? fmtNum(Math.round(v), { sig: Math.abs(v) >= 100 ? 2 : 3 }) : '–');
const join = (a, b) => (a === b ? a : `${a}–${b}`);
/** Counts of things: whole numbers from 10 up, one decimal below that. */
const countRange = (r) => (r.high >= 10 ? join(fmtInt(r.low), fmtInt(r.high)) : fmtRange(r.low, r.high));
const pctRange = (r) => (fmtPct(r.low) === fmtPct(r.high) ? fmtPct(r.typ) : `${fmtNum(r.low * 100)}–${fmtPct(r.high)}`);
const timesRange = (r) => `${fmtRange(r.low, r.high)}${X}`;
/** A share as a percentage, or as "× times" once it is 2-fold or more. */
const shareText = (r) => (r.typ >= 2 ? timesRange(r) : pctRange(r));
/** A tax rate exactly as the council set it, always two decimals: 1 → "1,00 %", 1.25 → "1,25 %". */
const ratePct = (pct) => {
  const n = new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pct);
  return locale() === 'fi-FI' ? `${n} %` : `${n}%`;
};

export function mount(el) {
  const st = store.get();
  let code = townByCode(st.townCode) ? st.townCode : '837';
  let map = null;
  let compareMetric = 'heat';
  let showAllProjects = false;
  const cleanups = [];

  // ---------- hero: text → search → town card + start button → map ----------
  const live = h('div', { class: 'town-card' });
  const cta = h('button', { type: 'button', class: 'btn btn--primary btn--big home-cta', onclick: () => go('simulaattori', { townCode: code }) });
  const combo = townCombobox({ onSelect: (c) => select(c, { zoom: true }) });

  const heroText = h('div', { class: 'home-hero__text' },
    h('p', { class: 'eyebrow' }, t('home.eyebrow')),
    h('h1', { class: 'home-hero__title', id: 'home-title', tabindex: '-1' }, t('app.name')),
    h('p', { class: 'home-hero__tagline' }, taglineNodes()),
    h('p', { class: 'home-hero__promise' }, t('home.promise')));
  const heroSearch = h('div', { class: 'home-hero__search' }, combo.el, h('p', { class: 'home-hero__hint' }, t('home.compareHint')));
  const heroCard = h('div', { class: 'home-hero__card' }, live, cta);
  const mapBox = h('div', { class: 'home-hero__map' });
  const hero = h('section', { class: 'home-hero', 'aria-labelledby': 'home-title' },
    h('div', { class: 'home-hero__inner' }, heroText, heroSearch, heroCard, mapBox));

  function taglineNodes() {
    // "Sama datakeskus, eri kunta, eri tarina." with the middle phrase emphasised.
    const tag = t('app.tagline');
    const parts = tag.split(/,\s*/);
    if (parts.length !== 3) return tag;
    return [parts[0], ', ', h('em', null, parts[1]), ', ', parts[2]];
  }

  const item = (label, value, sub, extra) => h('div', { class: 'teaser__item' },
    h('dt', null, label),
    h('dd', null,
      value ? h('span', { class: 'teaser__v' }, value) : null,
      sub ? h('span', { class: 'teaser__s' }, sub) : null,
      extra || null));

  function teaserFor(f, town, design) {
    const mw = fmtNum(design.sizeMW, { digits: 1 });
    const heat = item(t('home.teaserHeat'),
      f.heat ? shareText(f.heat) : null,
      f.heat ? (f.dh.estimated ? t('home.teaserHeatOfEst') : t('home.teaserHeatOf'))
        : f.dh.status === 'notInStats' ? t('home.teaserHeatNotInStats') : t('common.unknown'));
    const taxSub = f.taxShare
      ? (f.taxShare.typ >= 2 ? t('home.teaserTaxTimes', { x: fmtRange(f.taxShare.low, f.taxShare.high) }) : t('home.teaserTaxOf', { pct: pctRange(f.taxShare) }))
      : null;
    const tax = item(t('home.teaserTax'), f.tax ? fmtEurRange(f.tax.low, f.tax.high) : '–', taxSub);
    const land = item(t('home.teaserLand'),
      f.land ? `${fmtRange(f.land.low, f.land.high)} ha` : '–',
      f.pitches ? t('home.teaserLandOf', { n: countRange(f.pitches) }) : null,
      design.site === 'forest' ? h('span', { class: 'teaser__s teaser__flag' }, t('home.teaserForest')) : null);
    const trucks = item(t('home.teaserTrucks'), f.trucks ? countRange(f.trucks) : '–', t('home.teaserTrucksOf'));
    return h('div', { class: 'teaser' },
      h('p', { class: 'teaser__h' }, kindChip('calculated'), h('span', null, autoTerms(t('home.sameDc', { mw }), ['MW']))),
      h('div', { class: 'teaser__cols' },
        h('div', { class: 'teaser__col' },
          h('p', { class: 'teaser__colh' }, h('span', { class: 'teaser__mark', 'aria-hidden': 'true' }, '+'), t('home.teaserGood')),
          h('dl', { class: 'teaser__list' }, heat, tax)),
        h('div', { class: 'teaser__col' },
          h('p', { class: 'teaser__colh' }, h('span', { class: 'teaser__mark', 'aria-hidden': 'true' }, '−'), t('home.teaserBad')),
          h('dl', { class: 'teaser__list' }, land, trucks))),
      h('a', {
        href: '#simulaattori', class: 'teaser__guess', 'data-fk': 'guess-jobs',
        onclick: (e) => { e.preventDefault(); go('simulaattori', { townCode: code, simStep: 3 }); },
      }, icon('question', { size: 18 }), h('span', null, t('home.guessJobs')), icon('arrowRight', { size: 16 })),
      h('p', { class: 'teaser__note' }, t('home.teaserNoteA'), term('vaihteluvali', t('home.teaserNoteRange')), t('home.teaserNoteB')));
  }

  function bannerFor(here) {
    if (!here.length) return null;
    return h('div', { class: 'town-banner' },
      h('p', { class: 'town-banner__h' }, here.length === 1 ? t('home.realHere1') : t('home.realHereN', { n: here.length })),
      h('ul', { class: 'town-banner__list' }, here.map((p) => h('li', { class: 'town-banner__item' },
        h('p', { class: 'town-banner__text' }, statusIcon(p.status, 14), ' ', h('strong', null, L(p.name)), ` · ${statusText(p)}`),
        p.preset ? h('button', {
          type: 'button', class: 'btn btn--small btn--primary town-banner__btn', 'data-fk': `banner-${p.id}`,
          'aria-label': `${t('home.seeProject')}: ${L(p.name)}`, onclick: () => loadProject(p),
        }, t('home.seeProject'), icon('arrowRight', { size: 16 })) : null))));
  }

  function renderTownCard() {
    const town = townByCode(code);
    const design = store.get().design;
    cta.replaceChildren(...kids(town ? t('home.ctaTown', { town: townName(town) }) : t('home.cta'), icon('arrowRight', { size: 20 })));
    if (!town) { live.replaceChildren(h('p', { class: 'muted' }, t('home.pick'))); return; }
    const f = figures(code, design);
    const dh = f ? f.dh : dhInfo(town);
    const stat = (value, label) => h('div', { class: 'town-card__stat' }, h('span', { class: 'town-card__v' }, value), h('span', { class: 'town-card__l' }, label));
    withFocus(live, () => live.replaceChildren(...kids(
      h('p', { class: 'town-card__eyebrow' }, t('home.selected')),
      h('h2', { class: 'town-card__name', id: 'town-card-name' }, townName(town)),
      bannerFor(projectsInTown(code)),
      h('div', { class: 'town-card__stats' },
        town.population != null ? stat(fmtNum(town.population, { sig: 3 }), t('home.residents')) : null,
        town.unemployed != null ? stat(fmtNum(town.unemployed, { sig: 3 }), t('home.unemployed')) : null,
        dh.demand
          ? stat([fmtNum(dh.demand, { sig: 2 }), ' ', term('GWh', 'GWh')], [term('kaukolampo', dh.status === 'local' ? t('home.dhLocal') : dh.estimated ? t('home.dhEst') : t('home.dh'))])
          : h('div', { class: 'town-card__stat town-card__stat--wide' }, h('span', { class: 'town-card__l' }, t('home.noDh'))),
        Number.isFinite(town.propertyTax?.generalRatePct) ? stat(ratePct(town.propertyTax.generalRatePct), [term('kiinteistovero', t('home.taxRate'))]) : null),
      f ? teaserFor(f, town, design) : null,
      h('p', { class: 'town-card__src' }, t('home.townSourcesNote')))));
  }

  /**
   * After a choice, bring the town card into view. One column (phones, tablets): always, card at the top of the screen.
   * Two columns: after a search, when the card does not fit below the fold; after a map click, only when the card's
   * top is out of sight (the map is next to it and should not jump away from the pointer).
   */
  function revealCard(from) {
    const r = live.getBoundingClientRect();
    const vh = window.innerHeight;
    const behavior = scrollBehavior();
    if (window.matchMedia?.(NARROW).matches) { live.scrollIntoView({ behavior, block: 'start' }); return; }
    if (from === 'search' && (r.bottom > vh || r.top < 64)) live.scrollIntoView({ behavior, block: 'start' });
    else if (r.top < 64 || r.top > vh - 120) live.scrollIntoView({ behavior, block: 'nearest' });
  }

  // ---------- comparison strip ----------
  const cmpBody = h('div', { class: 'cmp__body', id: 'cmp-body' });
  const cmpSeg = h('div', { class: 'seg cmp__seg', role: 'radiogroup', 'aria-label': t('home.cmpLabel') });
  const CMP = [
    { k: 'heat', label: 'home.cmpHeat', pick: (f) => f.heat, est: (f) => f.dh.estimated, none: (f) => (f.dh.status === 'notInStats' ? t('home.cmpNoNet') : t('common.unknown')) },
    { k: 'jobs', label: 'home.cmpJobs', pick: (f) => f.jobsShare },
    { k: 'tax', label: 'home.cmpTax', pick: (f) => f.taxShare },
    { k: 'el', label: 'home.cmpEl', pick: (f) => f.el, times: true },
    { k: 'water', label: 'home.cmpWater', pick: (f) => f.water },
  ];
  function renderCmpSeg() {
    const pickTab = (k) => { compareMetric = k; renderCmpSeg(); renderCompare(); cmpSeg.querySelector('[aria-checked="true"]')?.focus(); };
    cmpSeg.replaceChildren(...CMP.map((c, i) => h('button', {
      type: 'button', role: 'radio', class: 'seg__opt', 'aria-checked': String(compareMetric === c.k), tabindex: compareMetric === c.k ? '0' : '-1',
      'aria-controls': 'cmp-body', 'data-fk': `cmp-${c.k}`,
      onclick: () => { compareMetric = c.k; renderCmpSeg(); renderCompare(); },
      onkeydown: (e) => {
        const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (d) { e.preventDefault(); pickTab(CMP[(i + d + CMP.length) % CMP.length].k); }
        else if (e.key === 'Home') { e.preventDefault(); pickTab(CMP[0].k); }
        else if (e.key === 'End') { e.preventDefault(); pickTab(CMP[CMP.length - 1].k); }
      },
    }, t(c.label))));
  }
  function cmpNote(design) {
    const mw = fmtNum(design.sizeMW, { digits: 1 });
    if (compareMetric === 'el') return t('home.cmpNote.el', { mw, kwh: fmtNum(coefTyp('home.electricity', 5000), { sig: 3 }) });
    if (compareMetric === 'water') return t('home.cmpNote.water', { mw, m3: fmtNum(coefTyp('water.perPerson', 60), { sig: 3 }), cooling: t(`home.cool.${design.cooling}`) });
    return t(`home.cmpNote.${compareMetric}`, { mw });
  }
  function renderCompare() {
    const design = store.get().design;
    const def = CMP.find((c) => c.k === compareMetric) || CMP[0];
    const codes = [...COMPARE_TOWNS];
    if (code && !codes.includes(code)) codes.push(code);
    const rows = codes.map((c) => ({ c, f: figures(c, design) })).filter((x) => x.f);
    const maxHigh = Math.max(0.0001, ...rows.map((x) => def.pick(x.f)?.high || 0));
    const axisMax = niceMax(maxHigh);
    const asTimes = def.times || axisMax >= 2;
    const tick = (v) => (asTimes ? `${fmtNum(v)}${X}` : fmtPct(v));
    const fmtVal = (v) => (def.times ? timesRange(v) : shareText(v));
    const ticks = [0, axisMax / 2, axisMax];
    withFocus(cmpBody, () => cmpBody.replaceChildren(...kids(
      h('div', { class: 'cmp__axis', 'aria-hidden': 'true' },
        h('span', { class: 'cmp__axis-spacer' }),
        h('div', { class: 'cmp__axis-track' }, ticks.map((v) => h('span', { class: 'cmp__tick', style: { left: `${(v / axisMax) * 100}%` } }, tick(v)))),
        h('span', { class: 'cmp__axis-spacer cmp__axis-spacer--r' })),
      h('ul', { class: 'cmp__rows' }, rows.map(({ c, f }) => {
        const v = def.pick(f);
        const isSel = c === code;
        const pop = f.town.population != null ? t('search.residents', { n: fmtNum(f.town.population, { sig: 2 }) }) : '';
        const est = !!(v && def.est && def.est(f));
        let bar;
        let label;
        if (!v) {
          label = def.none ? def.none(f) : t('common.unknown');
          bar = h('div', { class: 'cmp__track' }, h('span', { class: 'cmp__none' }, label));
        } else {
          const lo = Math.min(100, (v.low / axisMax) * 100);
          const hi = Math.min(100, (v.high / axisMax) * 100);
          const ty = Math.min(100, (v.typ / axisMax) * 100);
          bar = h('div', { class: 'cmp__track' },
            h('span', { class: 'cmp__band', style: { left: `${lo}%`, width: `${Math.max(0.6, hi - lo)}%` } }),
            h('span', { class: 'cmp__dot', style: { left: `${ty}%` } }));
          label = fmtVal(v);
        }
        return h('li', { class: ['cmp__row', isSel && 'is-selected'] },
          h('button', {
            type: 'button', class: 'cmp__name', 'data-fk': `cmp-town-${c}`, 'aria-pressed': String(isSel),
            onclick: () => select(c, { zoom: true, reveal: false }),
            'aria-label': `${townName(f.town)}: ${label}${est ? ` (${t('home.cmpEst')})` : ''}`,
          }, h('span', { class: 'cmp__town' }, townName(f.town)), h('span', { class: 'cmp__pop' }, pop)),
          bar,
          h('span', { class: 'cmp__val' }, v ? label : '–', est ? h('span', { class: 'cmp__est' }, t('home.cmpEst')) : null));
      })),
      h('p', { class: 'cmp__note' }, kindChip('calculated'), h('span', null, cmpNote(design))))));
  }
  const compare = h('section', { class: 'container home-cmp', 'aria-labelledby': 'cmp-title' },
    h('div', { class: 'home-cmp__grid' },
      h('div', { class: 'home-cmp__text' },
        sectionHead({ eyebrow: t('home.howTitle'), title: t('home.cmpTitle', { mw: fmtNum(store.get().design.sizeMW, { sig: 3 }) }), id: 'cmp-title' }),
        h('p', null, t('home.how')),
        h('p', { class: 'muted home-cmp__noscore' }, icon('info', { size: 16 }), ' ', t('home.noScore'))),
      h('div', { class: 'cmp panel' }, cmpSeg, cmpBody)));

  // ---------- brief numbers (date and label from the 'ek-pipeline' fact) ----------
  const pipe = FACTS().find((x) => x.id === 'ek-pipeline') || null;
  const pipeSrc = pipe?.source || null;
  const numbers = h('section', { class: 'home-numbers', 'aria-labelledby': 'num-title' },
    h('div', { class: 'container home-numbers__inner' },
      h('h2', { id: 'num-title', class: 'home-numbers__title' }, t('home.numbersTitle')),
      h('dl', { class: 'home-numbers__grid' },
        num('~40', t('home.numOperating'), 'operating'),
        num('14', t('home.numConstruction'), 'construction'),
        num('~130', t('home.numPending'), 'planned')),
      h('p', { class: 'home-numbers__caveat' }, t('home.numCaveat')),
      h('p', { class: 'home-numbers__src' }, kindChip(pipe?.kind || 'measured'), ' ',
        h('a', { href: pipeSrc?.url || 'https://www.inderes.fi/analyst-comments/case-datakeskukset-rakentamisen-kylmakaynnistajana', target: '_blank', rel: 'noopener noreferrer' },
          t('home.numSource', { date: pipeSrc?.date ? fmtDate(pipeSrc.date) : '' }).replace(/\s+\(/, ' (').replace(/\s{2,}/g, ' ')))));
  function num(v, label, status) {
    return h('div', { class: `home-num home-num--${status}` }, h('dt', null, label), h('dd', null, v));
  }

  // ---------- pillars ----------
  const pillar = (n, iconName, title, text, route) => h('a', {
    href: `#${route}`, class: 'pillar', onclick: (e) => { e.preventDefault(); go(route); },
  }, h('span', { class: 'pillar__n', 'aria-hidden': 'true' }, n), h('span', { class: 'pillar__icon', 'aria-hidden': 'true' }, icon(iconName, { size: 26 })),
  h('span', { class: 'pillar__title' }, title), h('span', { class: 'pillar__text' }, text),
  h('span', { class: 'pillar__go', 'aria-hidden': 'true' }, icon('arrowRight', { size: 20 })));
  const pillars = h('section', { class: 'container home-pillars', 'aria-labelledby': 'pillars-title' },
    h('h2', { id: 'pillars-title' }, t('home.pillarsTitle')),
    h('div', { class: 'pillars' },
      pillar('1', 'question', t('home.p1t'), t('home.p1'), 'aiheet'),
      pillar('2', 'play', t('home.p2t'), t('home.p2'), 'simulaattori'),
      pillar('3', 'ruler', t('home.p3t'), t('home.p3'), 'lahteet')));

  // ---------- real projects: the chosen town's first, never hidden behind "show all" ----------
  const allProjects = PROJECTS();
  const byStatus = (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
  const projGrid = h('div', { class: 'project-grid' });
  const onFocusMap = (p) => {
    if (p.townCode) select(String(p.townCode).padStart(3, '0'), { zoom: true, reveal: false });
    mapBox.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
  };
  const allBtn = h('button', {
    type: 'button', class: 'btn home-projects__all', hidden: true,
    onclick: () => {
      const before = [...projGrid.children].filter((c) => !c.hidden).length;
      showAllProjects = true;
      renderProjects();
      projGrid.children[before]?.querySelector('button')?.focus();
    },
  }, t('home.allProjects', { n: allProjects.length }));
  const projects = h('section', { class: 'container home-projects', 'aria-labelledby': 'proj-title' },
    sectionHead({ title: t('home.projectsTitle'), lead: t('home.projectsLead'), id: 'proj-title' }),
    projGrid,
    allBtn,
    h('p', { class: 'home-projects__more' }, h('a', { href: '#suomi', onclick: (e) => { e.preventDefault(); go('suomi'); } }, t('home.allFinland'), ' ', icon('arrowRight', { size: 16 }))));
  function renderProjects() {
    const here = projectsInTown(code);
    const ids = new Set(here.map((p) => p.id));
    const list = [...here, ...allProjects.filter((p) => !ids.has(p.id)).sort(byStatus)];
    const visible = showAllProjects ? list.length : Math.max(FIRST_PROJECTS, here.length);
    withFocus(projects, () => {
      projGrid.replaceChildren(...kids(list.map((p, i) => {
        const card = projectCard(p, { onFocusMap: p.townCode ? onFocusMap : null, here: ids.has(p.id) });
        card.hidden = i >= visible;
        return card;
      })));
      allBtn.hidden = visible >= list.length;
    });
  }

  el.append(hero, compare, numbers, pillars, projects);

  // ---------- behaviour ----------
  /** Choose a town. zoom: zoom the map to it; reveal: 'search' | 'map' | false — scroll the town card into view. */
  function select(c, { zoom = false, reveal = 'search', quiet = false } = {}) {
    const town = townByCode(c);
    if (!town) return;
    code = c;
    if (store.get().townCode !== c) store.set({ townCode: c });
    combo.setValue(c);
    map?.update({ selectedCode: c });
    if (zoom) map?.zoomTo(c);
    renderTownCard();
    renderCompare();
    renderProjects();
    if (quiet) return;
    if (reveal) revealCard(reveal);
    say(t('home.chosen', { town: townName(town) }));
  }

  map = mountMapFinland(mapBox, {
    selectedCode: code,
    onSelect: (c) => select(c, { reveal: 'map' }),
    showProjects: true,
    legend: true,
  });
  renderTownCard();
  renderCmpSeg();
  renderProjects();
  cmpBody.append(h('p', { class: 'muted' }, '…'));
  const cmpTimer = setTimeout(renderCompare, 30); // after first paint: several model runs
  cleanups.push(() => clearTimeout(cmpTimer));

  cleanups.push(store.subscribe((s2, p) => {
    if (s2.townCode !== p.townCode && s2.townCode !== code && townByCode(s2.townCode)) select(s2.townCode, { quiet: true });
  }));
  return () => { cleanups.forEach((fn) => fn()); map?.destroy(); };
}

function niceMax(v) {
  const steps = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.6, 0.8, 1, 2, 4, 5, 10, 20, 40, 50, 100, 200, 500, 1000];
  return steps.find((s) => s >= v) || Math.pow(10, Math.ceil(Math.log10(v)));
}
