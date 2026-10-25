// All of Finland (#suomi): every real project on the map by status; a log slider for total data-centre capacity (IT
// load) with sourced reference marks (FINLAND_REFERENCES, each with the figure the source stated and what it measures)
// and a live one-line headline; finlandScenario() results as cards plus one range chart that puts the electricity in
// national context; the national debates.
import { h, icon } from '../dom.js';
import { t, L } from '../../i18n.js';
import { fmtNum, fmtPct } from '../format.js';
import { kindChip, confidenceChip } from '../components/chips.js';
import { sourceLink } from '../components/sourceLink.js';
import { mountMapFinland } from '../components/mapFinland.js';
import { term } from '../components/term.js';
import * as Model from '../../model/model.js';
import * as Coef from '../../model/coefficients.js';
import {
  PROJECTS, DEBATES, STATUSES, statusIcon, townByCode, townName, arr, debateCard, loadProject, fmtEurRange, kids, fmtCoef,
  statusText, copyLinkControl, projectLink,
} from '../pages/common.js';

const MIN = 0.1;
const MAX = 10;
const toGW = (v) => MIN * Math.pow(MAX / MIN, v / 1000);
const toV = (gw) => Math.round((Math.log(gw / MIN) / Math.log(MAX / MIN)) * 1000);
const roundGW = (gw) => (gw < 1 ? Math.round(gw * 20) / 20 : gw < 3 ? Math.round(gw * 10) / 10 : Math.round(gw * 4) / 4);
const DEBATE_IDS = ['electricity-prices', 'grid-queue', 'security-ownership', 'tax-policy', 'future-demand'];

// Fallback references (same sources as the model's) in case the model does not export them.
const FALLBACK_REFS = [
  { key: 'today', gw: 0.3, title: { fi: 'Nykyiset datakeskukset', en: "Today's data centres" }, source: { name: 'Yle', type: 'news', date: '2025-11-05', url: 'https://yle.fi/a/74-20192344' } },
  { key: 'fdca2030', gw: 2.5, title: { fi: 'Alan skenaario 2030', en: 'Industry scenario for 2030' }, source: { name: 'Yle', type: 'news', date: '2025-11-05', url: 'https://yle.fi/a/74-20192344' } },
];

/** A share (fraction) as "13–21 %"; collapses to one number when both ends round the same. */
function pctRange(v) {
  const a = fmtNum(v.low * 100);
  const b = fmtPct(v.high);
  return a === fmtNum(v.high * 100) ? b : `${a}–${b}`;
}

function fmtValue(v, which) {
  const x = v[which];
  if (v.format === 'pct') return fmtPct(x);
  return fmtNum(x);
}
function rangeText(v) {
  if (v.format === 'eur') return fmtEurRange(v.low, v.high);
  if (v.format === 'pct') {
    const a = fmtNum(v.low * 100);
    const b = fmtPct(v.high);
    return a === fmtNum(v.high * 100) ? b : `${a}–${b}`;
  }
  const a = fmtNum(v.low);
  const b = fmtNum(v.high);
  return a === b ? a : `${a}–${b}`;
}
function fillPct(tpl, v) {
  if (v.format === 'eur') return null; // the card already shows the euro range in words
  const mul = v.format === 'pct' ? 100 : 1;
  return L(tpl).replace(/\{(low|typ|high)\}/g, (_, k) => fmtNum(v[k] * mul));
}

export function mount(el) {
  const projects = PROJECTS();
  const refs = arr(Model.FINLAND_REFERENCES).length ? Model.FINLAND_REFERENCES : FALLBACK_REFS;
  let gw = 2.5;
  let map = null;
  let selectedProject = null;

  // ---------- map + project list ----------
  const mapBox = h('div', { class: 'fin-map__map' });
  const plist = h('div', { class: 'fin-plist' });
  function renderPList() {
    const active = document.activeElement?.closest?.('[data-fk]')?.getAttribute('data-fk');
    plist.replaceChildren(...kids(STATUSES.map((st) => {
      const ps = projects.filter((p) => p.status === st);
      if (!ps.length) return null;
      return h('section', { class: 'fin-plist__group' },
        h('h3', { class: 'fin-plist__h' }, statusIcon(st, 16), ' ', t(`status.${st}`), h('span', { class: 'fin-plist__n' }, ` · ${ps.length}`)),
        h('ul', null, ps.map((p) => h('li', null, h('button', {
          type: 'button', class: ['fin-plist__item', selectedProject === p.id && 'is-selected'], 'aria-pressed': String(selectedProject === p.id),
          'data-fk': `plist-${p.id}`, onclick: () => focusProject(p),
        },
        h('span', { class: 'fin-plist__name' }, L(p.name)),
        h('span', { class: 'fin-plist__meta' }, [p.municipality || townName(townByCode(p.townCode)), p.mw ? `${fmtNum(p.mw, { sig: 3 })} MW` : null].filter(Boolean).join(' · ')))))));
    })));
    if (active) plist.querySelector(`[data-fk="${active}"]`)?.focus({ preventScroll: true });
  }
  const detail = h('div', { class: 'fin-detail', 'aria-live': 'polite' });
  function renderDetail() {
    const p = projects.find((x) => x.id === selectedProject);
    if (!p) { detail.replaceChildren(); detail.hidden = true; return; }
    detail.hidden = false;
    const src = arr(p.sources)[0];
    detail.replaceChildren(...kids(
      h('p', { class: 'fin-detail__status' }, statusIcon(p.status, 16), ' ', statusText(p), p.mw ? ` · ${fmtNum(p.mw, { sig: 3 })} MW` : ''),
      h('h3', null, L(p.name)),
      p.summary ? h('p', null, L(p.summary)) : null,
      src ? sourceLink(src) : null,
      h('div', { class: 'fin-detail__actions' },
        p.preset ? h('button', { type: 'button', class: 'btn btn--small btn--primary', onclick: () => loadProject(p) }, t('home.tryThis'), icon('arrowRight', { size: 16 })) : null,
        copyLinkControl(() => projectLink(p)))));
  }
  function focusProject(p) {
    selectedProject = p.id;
    const code = p.townCode ? String(p.townCode).padStart(3, '0') : null;
    map?.update({ selectedCode: code });
    if (code) map?.zoomTo(code);
    renderPList();
    renderDetail();
  }

  // ---------- slider ----------
  // A reference point is placed by its IT load (gw); its label shows the figure the source stated (gwStated) and what
  // that figure measures (basis: average draw, grid connection or scenario).
  const stated = (r) => (Number.isFinite(r.gwStated) ? r.gwStated : r.gw);
  const basisText = (r) => (r.basis ? t(`fin.basis.${r.basis}`) : '');
  const gwText = (v) => `${fmtNum(v, { sig: 2 })} GW`;
  const readout = h('p', { class: 'fin-readout' });
  const headline = h('p', { class: 'fin-headline' });
  const slider = h('input', {
    type: 'range', min: 0, max: 1000, step: 1, value: toV(gw), id: 'fin-gw', class: 'fin-slider__input',
    oninput: (e) => { gw = roundGW(toGW(+e.target.value)); update(); },
  });
  const marks = h('div', { class: 'fin-marks' }, refs.map((r, i) => h('button', {
    type: 'button', class: ['fin-mark', i > 0 && Math.abs(toV(r.gw) - toV(refs[i - 1].gw)) < 90 && 'is-low'], style: { left: `${(toV(r.gw) / 1000) * 100}%` },
    onclick: () => { gw = r.gw; slider.value = toV(gw); update(); slider.focus(); },
    'aria-label': `${L(r.title)}: ${gwText(stated(r))}${basisText(r) ? ` (${basisText(r)})` : ''}`,
  }, h('span', { class: 'fin-mark__tick', 'aria-hidden': 'true' }), h('span', { class: 'fin-mark__label' }, gwText(stated(r))))));
  const scaleTicks = h('div', { class: 'fin-scale', 'aria-hidden': 'true' }, [0.1, 0.3, 1, 3, 10].map((v) => h('span', { style: { left: `${(toV(v) / 1000) * 100}%` } }, fmtNum(v))));
  const refList = h('ol', { class: 'fin-refs' }, refs.map((r) => h('li', { class: 'fin-ref' },
    h('button', { type: 'button', class: 'fin-ref__gw', onclick: () => { gw = r.gw; slider.value = toV(gw); update(); } }, gwText(stated(r))),
    h('div', null,
      h('p', { class: 'fin-ref__title' }, L(r.title), r.year ? h('span', { class: 'muted' }, ` · ${r.year}`) : null),
      r.text ? h('p', { class: 'fin-ref__text' }, L(r.text)) : null,
      r.basis ? h('p', { class: 'fin-ref__basis' }, t('fin.basisLine', { gw: fmtNum(stated(r), { sig: 2 }), basis: basisText(r), it: fmtNum(r.gw, { sig: 2 }) })) : null,
      r.source ? sourceLink(r.source) : null))));

  // ---------- results ----------
  const cards = h('div', { class: 'fin-cards' });
  const chart = h('figure', { class: 'fin-chart panel' });
  const notes = h('p', { class: 'fin-notes' });

  function card(key, v) {
    const coef = Coef.COEF || {};
    return h('article', { class: 'fin-card' },
      h('div', { class: 'fin-card__labels' }, kindChip('calculated'), v.confidence ? confidenceChip(v.confidence) : null),
      h('h3', { class: 'fin-card__title' }, L(v.title) || t(`fin.k.${key}`)),
      h('p', { class: 'fin-card__value' }, h('span', { class: 'fin-card__num' }, rangeText(v)), v.format !== 'pct' && v.format !== 'eur' && L(v.unit) ? h('span', { class: 'fin-card__unit' }, ` ${L(v.unit)}`) : null),
      h('p', { class: 'fin-card__typ' }, t('fin.typical', { v: v.format === 'eur' ? fmtEurRange(v.typ, v.typ) : `${fmtValue(v, 'typ')}${v.format === 'num' ? ` ${L(v.unit)}` : ''}` })),
      key !== 'electricityTWh' && v.text && fillPct(v.text, v) ? h('p', { class: 'fin-card__text' }, fillPct(v.text, v)) : null,
      h('details', { class: 'why' },
        h('summary', null, t('common.why')),
        v.formula ? h('p', { class: 'why__formula' }, L(v.formula)) : null,
        arr(v.inputs).length ? h('ul', { class: 'why__inputs' }, arr(v.inputs).map((k) => {
          const c = coef[k];
          if (!c) return null;
          const range = c.low === c.high ? fmtCoef(c.typ) : `${fmtCoef(c.low)}–${fmtCoef(c.high)}`;
          return h('li', null, h('strong', null, L(c.title)), `: ${range} ${L(c.unit)}`.trimEnd());
        })) : null,
        arr(v.sources).length ? h('ul', { class: 'src-list' }, arr(v.sources).map((s) => h('li', null, sourceLink(s)))) : null));
  }

  function renderChart(res) {
    const coef = Coef.COEF || {};
    const e = res.electricityTWh;
    const fi25 = coef['finland.consumption2025'];
    const fc = coef['finland.forecast2030'];
    const ol3 = coef['finland.ol3'];
    const rows = [
      e && { key: 'dc', label: t('fin.row.dc'), low: e.low, typ: e.typ, high: e.high, accent: true, src: null },
      ol3 && { key: 'ol3', label: t('fin.row.ol3'), low: ol3.low, typ: ol3.typ, high: ol3.high, src: ol3.sources?.[0] },
      fi25 && { key: 'fi25', label: t('fin.row.fi2025'), low: fi25.low, typ: fi25.typ, high: fi25.high, src: fi25.sources?.[0] },
      fc && { key: 'fc', label: t('fin.row.fingrid2030'), low: fc.low, typ: null, high: fc.high, src: fc.sources?.[0] },
    ].filter(Boolean);
    const maxV = Math.max(...rows.map((r) => r.high));
    const step = maxV > 200 ? 50 : 25;
    const axisMax = Math.ceil((maxV * 1.04) / step) * step;
    const ticks = [];
    for (let v = 0; v <= axisMax; v += step) ticks.push(v);
    const x = (v) => `${(v / axisMax) * 100}%`;
    chart.replaceChildren(
      h('figcaption', { class: 'fin-chart__cap' }, h('span', { class: 'fin-chart__title' }, t('fin.chartTitle')), h('span', { class: 'fin-chart__unit' }, ' · TWh/v'.replace('/v', L({ fi: '/v', en: '/yr' })))),
      h('div', { class: 'fin-chart__plot' },
        h('div', { class: 'fin-chart__axis', 'aria-hidden': 'true' }, h('span'), h('div', { class: 'fin-chart__ticks' }, ticks.map((v) => h('span', { class: 'fin-chart__tick', style: { left: x(v) } }, fmtNum(v))))),
        h('ul', { class: 'fin-chart__rows' }, rows.map((r) => {
          const one = r.low === r.high;
          const sig = r.accent ? 2 : 3;
          const valText = one ? fmtNum(r.low, { sig: 3 }) : `${fmtNum(r.low, { sig })}–${fmtNum(r.high, { sig })}`;
          return h('li', { class: ['fin-chart__row', r.accent && 'is-accent'] },
            h('span', { class: 'fin-chart__label' }, r.label, h('span', { class: 'fin-chart__val' }, ` ${valText} TWh`)),
            h('span', { class: 'fin-chart__track' },
              ticks.map((v) => h('span', { class: 'fin-chart__grid', style: { left: x(v) } })),
              one ? null : h('span', { class: 'fin-chart__band', style: { left: x(r.low), width: `calc(${x(r.high)} - ${x(r.low)})` } }),
              r.typ != null ? h('span', { class: 'fin-chart__dot', style: { left: x(r.typ) }, title: valText }) : null));
        }))),
      h('p', { class: 'fin-chart__note' }, t('fin.chartNote')),
      h('ul', { class: 'src-list fin-chart__src' }, rows.filter((r) => r.src).map((r) => h('li', null, sourceLink(r.src)))));
  }

  function update() {
    readout.replaceChildren(h('span', { class: 'fin-readout__gw' }, `${fmtNum(gw, { sig: 2 })} GW`), h('span', { class: 'fin-readout__mw' }, ` = ${fmtNum(gw * 1000, { sig: 2 })} MW `), h('span', { class: 'fin-readout__mw' }, term('itTeho', L({ fi: 'IT-tehoa', en: 'IT load' }))));
    marks.querySelectorAll('.fin-mark').forEach((m, i) => m.classList.toggle('is-active', Math.abs(refs[i].gw - gw) < 0.001));
    let res = null;
    try { res = typeof Model.finlandScenario === 'function' ? Model.finlandScenario(gw) : null; } catch (err) { console.warn(err); }
    const share = res?.shareOfFinland;
    const shareText = share && Number.isFinite(share.low) ? t('fin.headline', { range: pctRange(share) }) : '';
    slider.setAttribute('aria-valuetext', `${t('fin.gwLong', { v: fmtNum(gw, { sig: 2 }), mw: fmtNum(gw * 1000, { sig: 2 }) })}${shareText ? `: ${shareText}` : ''}`);
    headline.replaceChildren(...kids(shareText ? [kindChip('calculated'), h('strong', { class: 'fin-headline__v' }, shareText)] : null));
    headline.hidden = !shareText;
    if (!res) { cards.replaceChildren(h('p', { class: 'muted' }, t('fin.noModel'))); chart.replaceChildren(); return; }
    const order = arr(res.order).length ? res.order : Object.keys(res).filter((k) => res[k] && typeof res[k] === 'object' && 'typ' in res[k]);
    cards.replaceChildren(...kids(order.filter((k) => res[k]).map((k) => card(k, res[k]))));
    renderChart(res);
    notes.replaceChildren(...kids(icon('info', { size: 16 }), ' ', L(res.notes)));
  }

  const debates = DEBATES().filter((d) => DEBATE_IDS.includes(d.id));

  el.append(h('div', { class: 'page fin-page' },
    h('header', { class: 'page-head' },
      h('p', { class: 'eyebrow' }, t('fin.eyebrow')),
      h('h1', null, t('fin.title')),
      h('p', { class: 'lead' }, t('fin.lead'))),
    h('section', { class: 'page-section', 'aria-labelledby': 'fin-map-h' },
      h('header', { class: 'section-head' }, h('h2', { id: 'fin-map-h' }, t('fin.mapTitle')), h('p', { class: 'lead' }, t('fin.mapLead'))),
      h('div', { class: 'fin-map' }, mapBox, h('div', { class: 'fin-map__side' }, detail, plist))),
    h('section', { class: 'page-section fin-scenario', 'aria-labelledby': 'fin-sl-h' },
      h('header', { class: 'section-head' }, h('h2', { id: 'fin-sl-h' }, t('fin.sliderTitle'))),
      h('div', { class: 'fin-slider panel' },
        h('label', { for: 'fin-gw', class: 'fin-slider__label' }, t('fin.sliderLabel'), h('span', { class: 'fin-slider__unit' }, ' · GW = 1 000 ', term('MW', 'MW'))),
        readout,
        h('div', { class: 'fin-slider__track' }, slider, marks, scaleTicks),
        headline,
        h('h3', { class: 'fin-refs__h' }, t('fin.refs')),
        refList),
      h('header', { class: 'section-head fin-results-head' }, h('h2', null, t('fin.resultsTitle')), h('p', { class: 'lead' }, t('fin.resultsLead'))),
      chart,
      cards,
      notes),
    debates.length ? h('section', { class: 'page-section', 'aria-labelledby': 'fin-deb-h' },
      h('header', { class: 'section-head' }, h('h2', { id: 'fin-deb-h' }, t('fin.debatesTitle'))),
      h('div', { class: 'debate-list' }, debates.map(debateCard))) : null));

  map = mountMapFinland(mapBox, { showProjects: true, legend: true, compact: true, onSelect: (c) => { const p = projects.find((x) => String(x.townCode).padStart(3, '0') === c); if (p) focusProject(p); }, onProjectSelect: (p) => focusProject(p) });
  renderPList();
  renderDetail();
  update();
  return () => map?.destroy();
}
