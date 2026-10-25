// Step 2: design choices in plain words. Every change recomputes instantly (memoised model run).
import { h, replace } from '../dom.js';
import { t, L } from '../../i18n.js';
import * as F from '../format.js';
import { store } from '../../store.js';
import * as M from '../../model/model.js';
import { segmented, termAny, termIf, rafThrottle } from './controls.js';
import { designOptions, comparison, headline } from './compute.js';
import { townName, dhStatusOf } from './townCard.js';

const { fmtNum } = F;
const fmtCoef = F.fmtCoef || ((v) => fmtNum(v, { digits: 2 }));
const fmtRange = F.fmtRange || ((a, b) => `${fmtNum(a)}–${fmtNum(b)}`);

// Size: any IT load within sizeRange on a log slider; quick picks stay as shortcuts.
const SIZE_RANGE = { min: 5, max: 1000, ...(M.DESIGN_OPTIONS?.sizeRange || {}) };
const SIZE_STEPS = 1000;
const LN_MIN = Math.log(SIZE_RANGE.min);
const LN_SPAN = Math.log(SIZE_RANGE.max) - LN_MIN;
const clampMW = (v) => Math.max(SIZE_RANGE.min, Math.min(SIZE_RANGE.max, v));
/** Round a slider value to something a person would say: 0,5 MW steps below 20, 1 MW below 100, then 5 MW. */
const unitOf = (v) => (v < 20 ? 0.5 : v < 100 ? 1 : 5);
const niceMW = (v) => { const c = clampMW(v); const u = unitOf(c); return clampMW(Math.round(c / u) * u); };
const posOf = (mw) => Math.round(((Math.log(clampMW(Number(mw) || SIZE_RANGE.min)) - LN_MIN) / LN_SPAN) * SIZE_STEPS);
const mwOf = (p) => niceMW(Math.exp(LN_MIN + (p / SIZE_STEPS) * LN_SPAN));
/** About 5 % per arrow press (25 % per Page key), always moving at least one rounding unit. */
function stepMW(cur, factor) {
  let next = niceMW(cur * factor);
  if (next === niceMW(cur)) next = niceMW(cur + (factor > 1 ? unitOf(cur) : -unitOf(cur)));
  return next;
}
const mwText = (mw) => `${fmtCoef(mw)} MW`;

export function createDesignPanel(ctx) {
  const opts = designOptions();
  const root = h('section', { class: 'sim-panel sim-design', 'data-step': '2', 'aria-labelledby': 'sim-design-title' });
  const setDesign = (patch) => {
    const st = store.get();
    store.setDesign(patch);
    if ((st.simStep || 1) < 2) store.set({ simStep: 2 });
  };

  const field = (id, labelNode, help, control, extra) => h('div', { class: 'sim-field' },
    h('div', { class: 'sim-field__label', id }, labelNode),
    help ? h('p', { class: 'sim-field__help' }, help) : null,
    control, extra || null);

  // size: exact IT load (log slider) + quick picks
  const sizeOut = h('output', { class: 'sim-field__value', for: 'sim-size', 'aria-live': 'off' });
  const sizeInput = h('input', {
    type: 'range', id: 'sim-size', class: 'rail-size__range', min: 0, max: SIZE_STEPS, step: 1, value: posOf(store.get().design.sizeMW),
    'aria-labelledby': 'sim-f-size', 'aria-describedby': 'sim-f-size-help',
  });
  const pushSize = rafThrottle((v) => setDesign({ sizeMW: v }));
  function showSize(mw) {
    sizeOut.textContent = mwText(mw);
    sizeInput.setAttribute('aria-valuetext', sizeOut.textContent);
    sizeSeg.set(mw);
  }
  sizeInput.addEventListener('input', () => {
    const v = mwOf(Number(sizeInput.value));
    showSize(v);
    pushSize(v);
  });
  sizeInput.addEventListener('change', () => pushSize.flush());
  sizeInput.addEventListener('keydown', (e) => {
    const cur = Number(store.get().design.sizeMW) || SIZE_RANGE.min;
    const moves = { ArrowRight: 1.05, ArrowUp: 1.05, ArrowLeft: 1 / 1.05, ArrowDown: 1 / 1.05, PageUp: 1.25, PageDown: 0.8 };
    let next = null;
    if (e.key in moves) next = stepMW(cur, moves[e.key]);
    else if (e.key === 'Home') next = SIZE_RANGE.min;
    else if (e.key === 'End') next = SIZE_RANGE.max;
    if (next == null) return;
    e.preventDefault();
    pushSize.cancel();
    sizeInput.value = posOf(next);
    showSize(next);
    setDesign({ sizeMW: next });
  });
  const sizeSeg = segmented({
    labelledby: 'sim-f-size-quick', className: 'sim-seg--4',
    options: opts.sizes.map((s) => ({ value: s.mw, label: t(`sim.size.${s.key}`), sub: mwText(s.mw) })),
    value: store.get().design.sizeMW, onChange: (v) => setDesign({ sizeMW: v }),
  });
  const sizeHint = h('p', { class: 'sim-field__hint', 'aria-live': 'polite' });
  const itLabel = L({ fi: 'IT-teho', en: 'IT load' });
  const sizeLabel = h('span', null, termIf(['itTeho'], itLabel) || itLabel, ' (MW)');

  // cooling
  const coolSeg = segmented({
    labelledby: 'sim-f-cool', className: 'sim-seg--3',
    options: opts.cooling.map((c) => ({ value: c, label: t(`sim.cooling.${c}`) })),
    value: store.get().design.cooling, onChange: (v) => setDesign({ cooling: v }),
  });
  const coolHelp = h('p', { class: 'sim-field__hint' });

  // heat reuse: available everywhere; a town that is not in the statistics gets a note instead of a locked control
  const heatSeg = segmented({
    labelledby: 'sim-f-heat', className: 'sim-seg--2',
    options: [{ value: true, label: t('sim.heat.on') }, { value: false, label: t('sim.heat.off') }],
    value: !!store.get().design.heatReuse, onChange: (v) => setDesign({ heatReuse: v }),
  });
  const heatNote = h('p', { class: 'sim-field__note', hidden: true });

  // site
  const siteSeg = segmented({
    labelledby: 'sim-f-site', className: 'sim-seg--3',
    options: opts.site.map((s) => ({ value: s, label: t(`sim.site.${s}`) })),
    value: store.get().design.site, onChange: (v) => setDesign({ site: v }),
  });
  const siteHelp = h('p', { class: 'sim-field__hint' });

  // distance
  const d = opts.distance;
  const distOut = h('output', { class: 'sim-field__value', for: 'sim-distance', 'aria-live': 'off' });
  const distInput = h('input', {
    type: 'range', id: 'sim-distance', min: d.min, max: d.max, step: d.step || 50, value: store.get().design.distanceM,
    'aria-describedby': 'sim-f-dist-help',
  });
  const pushDistance = rafThrottle((v) => setDesign({ distanceM: v }));
  distInput.addEventListener('input', () => {
    const v = Number(distInput.value);
    distOut.textContent = t('sim.design.distanceValue', { m: fmtNum(v, { sig: 3 }) });
    distInput.setAttribute('aria-valuetext', distOut.textContent);
    pushDistance(v);
  });
  distInput.addEventListener('change', () => pushDistance.flush());

  root.append(
    h('div', { class: 'sim-panel__head' },
      h('p', { class: 'sim-panel__eyebrow' }, h('span', { class: 'sim-panel__num' }, '2'), t('sim.design.title')),
      h('h2', { class: 'sr-only', id: 'sim-design-title' }, t('sim.design.title'))),
    h('div', { class: 'sim-field rail-size' },
      h('div', { class: 'sim-field__row' },
        h('div', { class: 'sim-field__label', id: 'sim-f-size' }, sizeLabel), sizeOut),
      h('p', { class: 'sim-field__help', id: 'sim-f-size-help' }, t('sim.design.sizeHelp')),
      sizeInput,
      h('div', { class: 'sim-field__scale', 'aria-hidden': 'true' }, h('span', null, mwText(SIZE_RANGE.min)), h('span', null, mwText(SIZE_RANGE.max))),
      h('p', { class: 'sr-only', id: 'sim-f-size-quick' }, L({ fi: 'Pikavalinnat', en: 'Quick picks' })),
      sizeSeg,
      sizeHint),
    field('sim-f-cool', t('sim.design.cooling'), t('sim.design.coolingHelp'), coolSeg, coolHelp),
    field('sim-f-heat', termAny(['hukkalämpö', 'hukkalampo', 'wasteHeat', 'waste-heat'], t('sim.design.heat')), t('sim.design.heatHelp'), heatSeg, heatNote),
    field('sim-f-site', t('sim.design.site'), t('sim.design.siteHelp'), siteSeg, siteHelp),
    h('div', { class: 'sim-field' },
      h('div', { class: 'sim-field__row' },
        h('label', { class: 'sim-field__label', for: 'sim-distance', id: 'sim-f-dist' }, t('sim.design.distance')), distOut),
      h('p', { class: 'sim-field__help', id: 'sim-f-dist-help' }, t('sim.design.distanceHelp')),
      distInput,
      h('div', { class: 'sim-field__scale', 'aria-hidden': 'true' }, h('span', null, `${fmtNum(d.min, { sig: 3 })} m`), h('span', null, `${fmtNum(d.max, { sig: 3 })} m`))));

  const COOL_TERMS = {
    air: ['vapaajäähdytys', 'vapaajaahdytys', 'freeCooling', 'free-cooling'],
    evaporative: ['haihdutusjäähdytys', 'haihdutusjaahdytys', 'evaporativeCooling', 'evaporative-cooling'],
    liquid: ['nestejäähdytys', 'nestejaahdytys', 'liquidCooling', 'liquid-cooling'],
  };
  function coolTerms(c) {
    const tm = termIf(COOL_TERMS[c] || []);
    return [t(`sim.cooling.${c}.help`), tm ? [' ', h('span', { class: 'sim-field__term' }, tm)] : null];
  }

  // The "as much electricity as N homes" hint answers guess 2, so it waits until the guesses are revealed.
  // Before that the hint shows the grid connection, which is not a guess question.
  let lastSim = null;
  function renderHint() {
    const sim = lastSim;
    let text = '';
    if (ctx.revealed()) {
      const homes = comparison(sim?.metrics?.electricity, 'homes');
      if (homes) text = t('sim.design.sizeHint', { range: fmtRange(homes.low, homes.high) });
    } else if (sim?.metrics?.gridPeak) {
      const gp = headline(sim.metrics.gridPeak);
      if (gp.high > 0) {
        const r = fmtRange(gp.low, gp.high);
        text = L({ fi: `Sähköliittymän huipputeho: noin ${r} MW.`, en: `Peak grid connection: about ${r} MW.` });
      }
    }
    sizeHint.textContent = text;
    sizeHint.hidden = !text;
  }
  const unsub = store.subscribe((s, prev) => { if (s.simUi !== prev.simUi) renderHint(); });

  function update(state, sim) {
    const des = state.design || {};
    lastSim = sim;
    if (document.activeElement !== sizeInput) sizeInput.value = posOf(des.sizeMW);
    showSize(Number(des.sizeMW));
    renderHint();

    coolSeg.set(des.cooling);
    replace(coolHelp, ...[coolTerms(des.cooling)].flat(3).filter(Boolean));

    const town = ctx.town();
    heatSeg.setDisabled(true, false);
    heatSeg.set(!!des.heatReuse);
    const notInStats = town && dhStatusOf(town) === 'notInStats';
    heatNote.hidden = !notInStats;
    if (notInStats) {
      const name = townName(town);
      heatNote.textContent = L({
        fi: `${name}: ei Energiateollisuuden kaukolämpötilastossa. Pieni paikallinen verkko voi silti olla – kysy kunnasta. Jos valitset ${t('sim.heat.on')}, laskemme arvioidulla lämmöntarpeella.`,
        en: `${name}: not in Finnish Energy’s district-heating statistics. A small local network may still exist – ask the municipality. If you choose “${t('sim.heat.on')}”, we calculate with an estimated heat demand.`,
      });
    }

    siteSeg.set(des.site);
    siteHelp.textContent = t(`sim.site.${des.site}.help`);

    if (document.activeElement !== distInput) distInput.value = des.distanceM;
    distOut.textContent = t('sim.design.distanceValue', { m: fmtNum(Number(des.distanceM), { sig: 3 }) });
    distInput.setAttribute('aria-valuetext', distOut.textContent);
  }

  return { el: root, update, destroy: () => { pushDistance.cancel(); pushSize.cancel(); unsub(); } };
}
