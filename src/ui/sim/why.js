// "Miksi?" drawer content for one metric, in reading order: the result now (and the project's own figure when a real
// project is loaded), a plain explanation, the formula, every input coefficient at its own precision (range, evidence,
// sources under "Lähteet (n)") with a control to pin it, the town context / notes, and related facts from sources.
import { h, icon } from '../dom.js';
import { t, L } from '../../i18n.js';
import { fmtCoef } from '../format.js';
import { store } from '../../store.js';
import { COEF } from '../../model/coefficients.js';
import * as factsMod from '../../content/facts.js';
import { openDrawer } from '../components/drawer.js';
import { factCard } from '../components/factCard.js';
import { sourceLink } from '../components/sourceLink.js';
import { kindChip, confidenceChip } from '../components/chips.js';
import { segmented } from './controls.js';
import { valueAt, headline, isZero, fmtRangeUnit, fmtValUnit, themeVar } from './compute.js';
import { plainWhy } from './plain.js';
import { autoTerms } from '../components/term.js';

const WHY_TERMS = ['PUE', 'kayttoaste', 'itTeho', 'GWh', 'TWh', 'polttoaineteho', 'UPS', 'huipputeho', 'sahkoliittyma', 'lampopumppu', 'kaukolampo', 'hukkalampo', 'varavoima', 'kiinteistovero', 'sahkovero', 'YVA', 'desibeli', 'vaihtokierros', 'haihdutusjaahdytys', 'nestejaahdytys', 'vapaajaahdytys'];
import { declaredFor, declaredLabel, fmtDeclared } from './results.js';

const FACTS = () => (Array.isArray(factsMod.FACTS) ? factsMod.FACTS : []);
const coefOf = (k) => (COEF && COEF[k]) || null;

/** Share units ('osuus …' / 'share …') are shown as per cent: 0,45 → "45 %"; the rest of the unit stays ("45 % asukkaista"). */
function shareUnit(c) {
  const u = L(c.unit) || '';
  const m = /^\s*(osuus|share)\b\s*(.*)$/i.exec(u);
  if (!m) return null;
  const rest = m[2].replace(/^\(0[–-]1\)\s*/, '').trim();
  return rest;
}

function coefValue(c, v) {
  if (!Number.isFinite(v)) return '–';
  const rest = shareUnit(c);
  if (rest != null) {
    const pct = fmtCoef(Math.round(v * 100 * 1e4) / 1e4);
    const sign = L({ fi: `${pct} %`, en: `${pct}%` });
    return rest ? `${sign} ${rest}` : sign;
  }
  const u = L(c.unit);
  if (u === '%') return L({ fi: `${fmtCoef(v)} %`, en: `${fmtCoef(v)}%` });
  return `${fmtCoef(v)}${u ? ` ${u}` : ''}`;
}

export function createWhy(ctx) {
  let close = null;
  let metricKey = null;
  let nowEl = null;
  let segs = [];
  let resetBtn = null;

  function resultNow() {
    const m = ctx.sim()?.metrics?.[metricKey];
    if (!m) return h('p', { class: 'muted' }, t('sim.error'));
    const yi = Math.floor(ctx.year());
    const now = valueAt(m, yi);
    const useHl = isZero(now);
    const v = useHl ? headline(m) : now;
    const dec = declaredFor({ ...m, key: metricKey }, store.get());
    const decInfo = dec ? declaredLabel(dec) : null;
    return h('div', { class: 'why-now', style: `--theme: var(${themeVar(m.theme)})` },
      dec ? h('p', { class: 'why-now__declared' }, kindChip(decInfo.kind, { compact: true }), h('strong', null, `${decInfo.label}: `),
        fmtDeclared(dec, m.unit), decInfo.fact?.source ? [' ', sourceLink(decInfo.fact.source)] : null) : null,
      h('p', { class: 'why-now__label' }, t('sim.why.now'), ' · ', useHl && headline(m).when ? L(headline(m).when) : t('sim.results.now', { y: yi })),
      h('p', { class: 'why-now__value' }, fmtRangeUnit(v.low, v.high, m.unit)),
      fmtRangeUnit(v.low, v.high, m.unit).includes('–') ? h('p', { class: 'why-now__typ' }, t('sim.results.typical', { typ: fmtValUnit(v.typ, m.unit) })) : null,
      fmtRangeUnit(v.low, v.high, m.unit).includes('–') ? h('p', { class: 'why-now__range' }, t('sim.why.rangeNote')) : null,
      h('p', { class: 'why-now__chips' }, kindChip(m.kind || 'calculated'), m.confidence ? confidenceChip(m.confidence) : null));
  }

  function setOverride(k, v) {
    const o = { ...(store.get().overrides || {}) };
    if (v === 'range') delete o[k]; else o[k] = v;
    store.set({ overrides: o });
  }

  function body(m) {
    segs = [];
    nowEl = h('div', { class: 'why-now-wrap', 'aria-live': 'polite' }, resultNow());
    const inputs = [...new Set(Array.isArray(m.inputs) ? m.inputs : [])];
    const overrides = store.get().overrides || {};
    resetBtn = h('button', { type: 'button', class: 'btn btn--small', onclick: () => {
      const o = { ...(store.get().overrides || {}) };
      inputs.forEach((k) => delete o[k]);
      store.set({ overrides: o });
    } }, t('sim.why.reset'));

    const coefCards = inputs.map((k) => {
      const c = coefOf(k);
      if (!c) return h('div', { class: 'why-coef why-coef--missing' }, h('p', { class: 'why-coef__title' }, k), h('p', { class: 'muted' }, t('sim.why.missingCoef')));
      const ranged = [c.low, c.typ, c.high].every(Number.isFinite) && !(c.low === c.typ && c.typ === c.high);
      const seg = ranged ? segmented({
        label: `${t('sim.why.use')}: ${L(c.title)}`, className: 'sim-seg--why',
        options: [
          { value: 'range', label: t('sim.why.useRange') },
          { value: 'low', label: t('sim.why.useLow'), sub: coefValue(c, c.low) },
          { value: 'typ', label: t('sim.why.useTyp'), sub: coefValue(c, c.typ) },
          { value: 'high', label: t('sim.why.useHigh'), sub: coefValue(c, c.high) },
        ],
        value: overrides[k] || 'range', onChange: (v) => setOverride(k, v),
      }) : null;
      if (seg) { seg._key = k; segs.push(seg); }
      const sources = c.sources || [];
      return h('div', { class: 'why-coef' },
        h('div', { class: 'why-coef__head' },
          h('p', { class: 'why-coef__title' }, L(c.title) || k),
          c.confidence ? confidenceChip(c.confidence) : null),
        c.explain ? h('p', { class: 'why-coef__explain' }, L(c.explain)) : null,
        [c.low, c.typ, c.high].some(Number.isFinite) ? h('p', { class: 'why-coef__values' },
          ranged
            ? t('sim.why.lowTypHigh', { low: coefValue(c, c.low), typ: coefValue(c, c.typ), high: coefValue(c, c.high) })
            : coefValue(c, c.typ)) : null,
        seg ? h('div', { class: 'why-coef__use' }, h('span', { class: 'why-coef__uselabel' }, `${t('sim.why.use')}:`), seg) : null,
        c.note ? h('p', { class: 'why-coef__note' }, L(c.note)) : null,
        sources.length ? h('details', { class: 'why-coef__sources' },
          h('summary', null, L({ fi: `Lähteet (${sources.length})`, en: `Sources (${sources.length})` })),
          h('div', { class: 'why-coef__srclist' }, sources.map((s) => sourceLink(s)))) : null);
    });

    const related = FACTS().filter((f) => (f.usedIn || []).includes(m.key));
    const plain = plainWhy(m.key);
    // glossary links at the first mention in the drawer's plain text and formula
    const seen = new Set();
    const words = (text) => { try { return autoTerms(text, WHY_TERMS, seen); } catch { return [text]; } };

    return [
      nowEl,
      plain ? h('section', { class: 'why-sec why-sec--plain' }, h('h3', null, icon('info', { size: 18 }), L({ fi: 'Lyhyesti', en: 'In short' })), h('p', { class: 'why-plain' }, ...words(plain))) : null,
      m.formula && L(m.formula) ? h('section', { class: 'why-sec' }, h('h3', null, icon('calc', { size: 18 }), t('sim.why.formula')), h('p', { class: 'why-formula' }, ...words(L(m.formula)))) : null,
      h('section', { class: 'why-sec' },
        h('div', { class: 'why-sec__row' }, h('h3', null, icon('ruler', { size: 18 }), t('sim.why.inputs')), resetBtn),
        h('p', { class: 'why-sec__lead' }, inputs.length ? t('sim.why.inputsLead') : t('sim.why.noInputs')),
        inputs.length ? h('p', { class: 'why-sec__lead why-sec__pinnote' }, L({
          fi: 'Jos lukitset oletuksen arvoon Tyypillinen, tulos voi poiketa hieman kortin ”tyypillisesti”-luvusta. Kortin luku on 400 laskentakierroksen keskimmäinen tulos, ei laskelma pelkillä tyypillisillä arvoilla.',
          en: 'If you pin an assumption to Typical, the result can differ slightly from the card’s “typically” figure. That figure is the middle result of 400 calculation runs, not a calculation with typical values only.',
        })) : null,
        h('div', { class: 'why-coefs' }, coefCards)),
      m.townContext ? h('section', { class: 'why-sec' }, h('h3', null, icon('map', { size: 18 }), t('sim.why.town')), h('p', null, L(m.townContext))) : null,
      m.notes ? h('section', { class: 'why-sec' }, h('h3', null, icon('info', { size: 18 }), t('sim.why.notes')), h('p', null, L(m.notes))) : null,
      related.length ? h('section', { class: 'why-sec' }, h('h3', null, icon('ruler', { size: 18 }), t('sim.why.facts')),
        h('div', { class: 'why-facts' }, related.map((f) => factCard(f, { compact: true })))) : null,
    ];
  }

  function refreshReset() {
    if (!resetBtn) return;
    const o = store.get().overrides || {};
    resetBtn.hidden = !segs.some((s) => o[s._key]);
  }

  function open(key) {
    const m = ctx.sim()?.metrics?.[key];
    if (!m) return;
    metricKey = key;
    close = openDrawer({
      title: h('span', { class: 'why-title' }, h('span', { class: 'why-title__eyebrow' }, t('sim.why.title')), h('span', null, L(m.title) || key)),
      body: body({ ...m, key }),
      onClose: () => { close = null; metricKey = null; },
    });
    close.panel.classList.add('drawer--why');
    refreshReset();
  }

  function update() {
    if (!close || !metricKey) return;
    nowEl?.replaceChildren(resultNow());
    const o = store.get().overrides || {};
    for (const s of segs) s.set(o[s._key] || 'range');
    refreshReset();
  }

  return { open, update, close: () => close?.(true), isOpen: () => !!close };
}
