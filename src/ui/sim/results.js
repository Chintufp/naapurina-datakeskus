// Results column: persona lens, theme groups and metric cards. Each card reads top to bottom:
//   plain sentence → range ("tyypillisesti …") → band chart with a year cursor → first comparison → "Lisää" (closed).
// With a real project loaded, the project's own published figure is the headline (with its own trust label and
// source) and our generic calculation sits below it. Cards update in place when the year changes.
import { h, icon, replace, withFocus } from '../dom.js';
import { t, L } from '../../i18n.js';
import { fillTemplate, fmtNum } from '../format.js';
import { store } from '../../store.js';
import * as themesMod from '../../content/themes.js';
import * as personasMod from '../../content/personas.js';
import * as projectsMod from '../../content/projects.js';
import * as factsMod from '../../content/facts.js';
import * as chipsMod from '../components/chips.js';
import { sourceLink } from '../components/sourceLink.js';
import { bandChartInteractive } from '../components/charts.js';
import { autoTerms } from '../components/term.js';
import { segmented } from './controls.js';
import { metricKeysByTheme, themeKeys, valueAt, headline, isZero, fmtRangeUnit, fmtValUnit, themeVar, nonZeroSpan, presetDeclared, runSim, designOptions } from './compute.js';
import { guessTargets, guessFeedback } from './guessPanel.js';
import * as modelMod from '../../model/model.js';
import { plainLines, plainUses, heatPumpNote, noiseNightSentence } from './plain.js';

const { kindChip, confidenceChip } = chipsMod;
const assumptionChip = chipsMod.assumptionChip || (() => h('span', { class: 'chip chip--assumed' }, L({ fi: 'Oletus', en: 'Assumption' })));

// ---------- a real project's assumed design choices (preset.assumedKeys, contract C1) ----------
/** Cards that depend on each design choice. sizeMW: every card. */
const ASSUMED_DEPS = {
  cooling: ['electricity', 'gridPeak', 'heatAvailable', 'heatPumpElectricity', 'heatUsed', 'water', 'co2Electricity', 'co2HeatAvoided', 'electricityTax'],
  heatReuse: ['heatUsed', 'heatPumpElectricity', 'co2HeatAvoided'],
  site: ['land'],
  distanceM: ['noise'],
};
const ASSUMED_NAME = {
  sizeMW: { fi: 'koko (MW)', en: 'size (MW)' },
  cooling: { fi: 'jäähdytystapa', en: 'cooling' },
  heatReuse: { fi: 'hukkalämmön käyttö', en: 'use of waste heat' },
  site: { fi: 'alueen tyyppi', en: 'type of site' },
  distanceM: { fi: 'etäisyys lähimpiin koteihin', en: 'distance to the nearest homes' },
};
/** The design keys the loaded project has not published ([] when no project, or none listed). */
export function assumedKeys(state) {
  if (!state?.presetId || typeof projectsMod.projectById !== 'function') return [];
  const keys = projectsMod.projectById(state.presetId)?.preset?.assumedKeys;
  return Array.isArray(keys) ? keys.filter((k) => ASSUMED_NAME[k]) : [];
}
const dependsOnAssumed = (metricKey, keys) => keys.includes('sizeMW') || keys.some((k) => (ASSUMED_DEPS[k] || []).includes(metricKey));

// town-scale comparisons for the 'Suurimmat yllätykset' box: [metric, comparison]
const SURPRISES = [['electricity', 'townHomes'], ['heatAvailable', 'pctTownDH'], ['water', 'pctTown'], ['jobsPermanent', 'pctUnemployed'], ['propertyTax', 'pctTownRevenue']];

// glossary words linked on the cards (first mention in each text)
const TERMS_TITLE = ['huipputeho'];
const TERMS_RANGE = ['GWh', 'CO2', 'polttoaineteho', 'vaihtokierros'];
const TERMS_TEXT = ['kaukolampo', 'hukkalampo', 'lampopumppu', 'desibeli', 'polttoaineteho', 'PUE', 'UPS', 'kayttoaste', 'TWh', 'GWh', 'varavoima', 'kiinteistovero', 'sahkovero', 'YVA', 'vapaajaahdytys', 'haihdutusjaahdytys', 'nestejaahdytys', 'CO2'];
/** Text with glossary links; rebuilt only when the text changes (cards update every frame while playing). */
function setTermText(el, text, keys) {
  if (el._termText === text) return;
  el._termText = text;
  try { el.replaceChildren(...autoTerms(text, keys)); } catch { el.textContent = text; }
}

export const KEY_METRICS = ['electricity', 'heatUsed', 'water', 'noise', 'jobsPermanent', 'land'];
/** Totals and one-offs: always shown as their headline. */
const ALWAYS_HEADLINE = new Set(['co2Construction', 'investment', 'eWaste']);
/** Non-zero only while building. */
const CONSTRUCTION_ONLY = new Set(['jobsConstruction', 'co2Construction', 'investment']);
/** Headline is a construction peak, not full operation. */
const PEAK_HEADLINE = new Set(['jobsConstruction', 'trucks']);
/** Comparisons that do not depend on the headline value (no "at full operation" label needed). */
const SELF_DESCRIBED = new Set(['trucks', 'noise']);

const THEMES = () => (Array.isArray(themesMod.THEMES) ? themesMod.THEMES : []);
export const PERSONAS = () => (Array.isArray(personasMod.PERSONAS) ? personasMod.PERSONAS : []);
export const themeTitle = (key) => { const th = THEMES().find((x) => x.key === key); return th ? L(th.title) : t(`sim.theme.${key}`); };
export const themeIcon = (key) => THEMES().find((x) => x.key === key)?.icon || ({ energy: 'bolt', environment: 'drop', jobs: 'people', traffic: 'truck', land: 'map', safety: 'shield', future: 'clock' }[key] || 'info');

function personaById(id) {
  if (!id) return null;
  return personasMod.personaById ? personasMod.personaById(id) : PERSONAS().find((p) => p.id === id) || null;
}

const factById = (id) => (id && typeof factsMod.factById === 'function' ? factsMod.factById(id) : null);
const fin = (v) => Number.isFinite(v);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const KINDS = ['measured', 'estimate', 'calculated', 'opinion'];
/** A persona voice's trust label: its own kind, its fact's kind, or a viewpoint (contract C2). */
const voiceKind = (v) => [v?.kind, factById(v?.factId)?.kind].find((k) => KINDS.includes(k)) || 'opinion';

// ---------- a real project's own figures (preset.declared, SPEC interfaces §8) ----------

/** The project's published figure for this metric: metric.declared, or (if the view did not pass presetId) the preset's. */
export function declaredFor(m, state) {
  if (!m) return null;
  return m.declared || presetDeclared(state?.presetId)?.[m.key] || null;
}

/** { low, typ, high, upTo } of a declared figure, with missing ends filled from typ. */
export function declaredValue(d) {
  const typ = fin(d?.typ) ? d.typ : fin(d?.high) ? d.high : d?.low;
  return { low: fin(d?.low) ? d.low : typ, typ, high: fin(d?.high) ? d.high : typ, upTo: !!d?.upTo };
}

/** "4 000–5 000 m³/v" or "enintään 8,8 ha". */
export function fmtDeclared(d, unit) {
  const v = declaredValue(d);
  return v.upTo ? t('sim.results.max', { v: fmtValUnit(v.high, unit) }) : fmtRangeUnit(v.low, v.high, unit);
}

/** The label of a declared figure from its fact's kind: 'Raportoitu' (measured) or 'Hankkeen ilmoittama arvio'. */
export function declaredLabel(d) {
  const fact = factById(d?.factId);
  const kind = fact?.kind || 'estimate';
  const label = kind === 'measured' ? L({ fi: 'Hankkeesta raportoitu luku', en: 'Figure reported for the project' }) : L({ fi: 'Hankkeen ilmoittama arvio', en: 'The project’s own estimate' });
  return { fact, kind, label };
}

/** A comparison template with "enintään" before the number when the declared value is an upper bound. */
function upToTemplate(text, upTo) {
  if (!upTo) return text;
  const mx = { fi: 'enintään {typ}', en: 'up to {typ}' };
  const swap = (s, l) => String(s || '').replace(/\{low\}\s?[–-]\s?\{high\}|\{range\}/g, mx[l]);
  return typeof text === 'object' ? { fi: swap(text.fi, 'fi'), en: swap(text.en, 'en') } : swap(text, 'fi');
}

/** One comparison: plain text, or the project's own figure first and the generic calculation after it. */
function comparisonNodes(c, dec, seen = new Set()) {
  const dc = dec?.comparisons?.[c.key];
  if (!dc) return autoTerms(fillTemplate(c.text, c), TERMS_TEXT, seen);
  const { fact, kind, label } = declaredLabel(dc);
  const dv = declaredValue(dc);
  return [
    kindChip(kind, { compact: true }), ' ',
    h('strong', null, `${label}: `), fillTemplate(upToTemplate(c.text, dv.upTo), { ...c, low: dv.low, typ: dv.typ, high: dv.high }), ' ',
    fact?.source ? sourceLink(fact.source) : null,
    h('span', { class: 'mcard__generic-inline' }, `${L({ fi: 'Yleinen laskelma', en: 'Generic calculation' })}: ${fillTemplate(c.text, c)}`),
  ];
}

export function createResults(ctx) {
  const root = h('section', { class: 'sim-results', 'aria-labelledby': 'sim-results-title' });
  const personaRow = h('div', { class: 'sim-persona-row' });
  const personaPanel = h('div', { class: 'sim-persona', hidden: true });
  const banners = h('div', { class: 'sim-banners' });
  const assumeEl = h('div', { class: 'sim-assume', hidden: true });
  const surpriseEl = h('section', { class: 'sim-surprise', hidden: true, 'aria-live': 'polite' });
  const groupsEl = h('div', { class: 'sim-groups' });
  const viewSeg = segmented({
    label: t('sim.results.view'), className: 'sim-seg--view',
    options: [{ value: false, label: t('sim.results.key') }, { value: true, label: t('sim.results.all') }],
    value: !!store.get().simUi?.showAll,
    onChange: (v) => store.set({ simUi: { ...(store.get().simUi || {}), showAll: v } }),
  });

  root.append(
    h('div', { class: 'sim-results__head' },
      h('div', null,
        h('h2', { class: 'sim-results__title', id: 'sim-results-title' }, t('sim.results.title')),
        h('p', { class: 'sim-results__lead' }, t('sim.results.lead'))),
      viewSeg),
    assumeEl,
    surpriseEl,
    h('div', { class: 'sim-persona-wrap' },
      h('p', { class: 'sim-persona-row__label', id: 'sim-persona-label' }, icon('people', { size: 16 }), t('sim.persona.title')),
      personaRow, personaPanel),
    banners, groupsEl);

  let cards = [];
  let pendingFocus = null; // selector to focus after the next render (when the focused control disappears)

  // ---------- persona lens ----------
  function renderPersonas(state) {
    const sel = state.persona;
    const list = PERSONAS();
    // one drop-down instead of a row of seven buttons
    const select = h('select', {
      class: 'sim-input sim-pselect', 'aria-labelledby': 'sim-persona-label', 'data-fk': 'persona-select',
      onchange: (e) => store.set({ persona: e.target.value || null }),
    }, [{ id: null }, ...list].map((p) => h('option', { value: p.id || '' }, p.id ? L(p.name) : t('sim.persona.none'))));
    select.value = sel || '';
    replace(personaRow, select);
    const p = personaById(sel);
    if (!p) { personaPanel.hidden = true; replace(personaPanel); return; }
    personaPanel.hidden = false;
    const sim = ctx.sim();
    replace(personaPanel,
      h('div', { class: 'sim-persona__top' },
        h('span', { class: 'sim-persona__avatar', 'aria-hidden': 'true' }, icon(p.icon || 'people', { size: 26 })),
        h('div', null,
          h('p', { class: 'sim-persona__tag' }, kindChip('opinion', { compact: true }), t('sim.persona.illustrative')),
          h('h3', { class: 'sim-persona__name' }, L(p.name)),
          p.who ? h('p', { class: 'sim-persona__who' }, L(p.who)) : null),
        h('button', {
          type: 'button', class: 'btn btn--ghost btn--small sim-persona__close', 'aria-label': t('sim.persona.close'), 'data-fk': 'persona-close',
          onclick: () => { pendingFocus = '[data-fk="persona-select"]'; store.set({ persona: null }); },
        }, icon('close', { size: 16 }))),
      p.says ? h('blockquote', { class: 'sim-persona__says' }, state.lang === 'en' ? `“${L(p.says)}”` : `”${L(p.says)}”`) : null,
      (p.cares || []).length ? h('p', { class: 'sim-persona__cares' }, h('span', { class: 'muted' }, `${t('sim.persona.cares')}: `),
        (p.cares || []).map((k) => sim?.metrics?.[k]).filter(Boolean).map((m) => h('span', { class: 'sim-tag' }, L(m.title)))) : null,
      (p.asks || []).length ? h('div', { class: 'sim-persona__asks' }, h('h4', null, t('sim.persona.asks')),
        h('ul', null, (p.asks || []).map((q) => h('li', null, L(q))))) : null,
      (p.voices || []).length ? h('div', { class: 'sim-persona__voices' }, h('h4', null, t('sim.persona.voices')),
        h('ul', null, (p.voices || []).map((v) => h('li', null,
          h('p', null, kindChip(voiceKind(v)), ' ', L(v.summary)), v.source ? sourceLink(v.source) : null)))) : null);
  }

  // ---------- banners ----------
  function renderBanners(state) {
    const n = Object.keys(state.overrides || {}).length;
    const out = [];
    if (n) {
      out.push(h('div', { class: 'sim-banner sim-banner--pins' }, icon('info', { size: 18 }),
        h('span', null, n === 1 ? t('sim.results.overrides1') : t('sim.results.overrides', { n })),
        h('button', { type: 'button', class: 'btn btn--small', onclick: () => store.set({ overrides: {} }) }, t('sim.results.resetAll'))));
    }
    if (state.focusTheme && themeKeys().includes(state.focusTheme)) {
      out.push(h('div', { class: 'sim-banner sim-banner--focus', style: `--theme: var(${themeVar(state.focusTheme)})` },
        h('span', { class: 'sim-mark', 'aria-hidden': 'true' }),
        h('span', null, t('sim.results.focus', { theme: themeTitle(state.focusTheme) })),
        h('button', { type: 'button', class: 'btn btn--small', onclick: () => store.set({ focusTheme: null }) }, t('sim.results.clearFocus'))));
    }
    // one notice and one button for all the hidden results (not two buttons on every hidden card)
    if (guessTargets().length && !ctx.revealed()) {
      out.push(h('div', { class: 'sim-banner sim-banner--guess' }, icon('question', { size: 18 }),
        h('span', null, L({ fi: 'Osa luvuista on piilotettu, jotta voit ensin arvata (vaihe 3).', en: 'Some numbers are hidden so that you can guess first (step 3).' })),
        h('button', {
          type: 'button', class: 'btn btn--small', 'data-fk': 'reveal-show',
          onclick: () => store.set({ simUi: { ...(store.get().simUi || {}), revealed: true } }),
        }, t('sim.guess.show'))));
    }
    replace(banners, ...out);
    renderAssumed(state);
  }

  /** A real project with unpublished design choices: say so at the top, before any number. */
  function renderAssumed(state) {
    const keys = assumedKeys(state);
    const sig = keys.length ? `${state.presetId}|${keys.join(',')}|${state.design?.sizeMW}|${state.lang}` : '';
    if (assumeEl._sig === sig) return;
    assumeEl._sig = sig;
    if (!keys.length) { assumeEl.hidden = true; replace(assumeEl); return; }
    const mw = state.design?.sizeMW;
    const mwText = fin(mw) ? fmtNum(mw) : '';
    const sizeAssumed = keys.includes('sizeMW');
    const others = keys.filter((k) => k !== 'sizeMW').map((k) => L(ASSUMED_NAME[k]));
    const list = others.join(', ');
    const sizes = designOptions().sizes.map((s) => s.mw).filter((v) => fin(v));
    withFocus(assumeEl, () => replace(assumeEl,
      h('p', { class: 'sim-assume__head' }, assumptionChip(),
        h('strong', null, sizeAssumed
          ? L({ fi: 'Hankkeen kokoa ei ole julkaistu.', en: 'The project’s size has not been published.' })
          : L({ fi: 'Osa valinnoista on oletuksia.', en: 'Some choices are assumptions.' }))),
      sizeAssumed ? h('p', null, L({ fi: `Luvut ovat esimerkki ${mwText} MW:n datakeskukselle.`, en: `The numbers are an example for a ${mwText} MW data centre.` })) : null,
      others.length ? h('p', null, sizeAssumed
        ? L({ fi: `Myös nämä ovat oletuksia, ei hankkeen julkaisemia tietoja: ${list}.`, en: `These are also assumptions, not published by the project: ${list}.` })
        : L({ fi: `Nämä ovat oletuksia, ei hankkeen julkaisemia tietoja: ${list}.`, en: `These are assumptions, not published by the project: ${list}.` })) : null,
      h('p', { class: 'sim-assume__note' }, L({ fi: 'Oletukseen perustuvissa korteissa on merkki Oletus.', en: 'Cards that rest on an assumption are marked Assumption.' })),
      sizeAssumed && sizes.length ? h('div', { class: 'sim-assume__sizes', role: 'group', 'aria-label': L({ fi: 'Kokeile toista kokoa', en: 'Try another size' }) },
        h('span', null, L({ fi: 'Kokeile toista kokoa:', en: 'Try another size:' })),
        sizes.map((v) => h('button', {
          type: 'button', class: 'btn btn--small', 'data-fk': `assume-size-${v}`, 'aria-pressed': v === mw ? 'true' : 'false',
          // keeps the project loaded: only its unpublished size changes
          onclick: () => store.set({ design: { ...(store.get().design || {}), sizeMW: v } }),
        }, `${fmtNum(v)} MW`))) : null));
    assumeEl.hidden = false;
  }

  // ---------- cards ----------
  function actualFor(metricKey, state) {
    if (!state.presetId || !projectsMod.projectById) return [];
    const p = projectsMod.projectById(state.presetId);
    if (!p) return [];
    return (p.actualFacts || []).map((id) => factById(id)).filter((f) => f && (f.usedIn || []).includes(metricKey));
  }

  /** Which value the card shows in year y, and the label above it (SPEC: the label always matches the number). */
  function yearView(m, y, hasSeries) {
    const yi = Math.max(0, Math.floor(y));
    const hl = headline(m);
    const hlWhen = hl.when ? L(hl.when) : '';
    const span = hasSeries ? nonZeroSpan(m) : null;
    if (ALWAYS_HEADLINE.has(m.key) || !span) return { mode: 'headline', v: hl, label: hlWhen ? cap(hlWhen) : '' };
    if (yi < span.first) return { mode: 'later', v: hl, notYet: t('sim.results.notYet', { y: yi }), label: hlWhen };
    const years = (a, b) => (a === b ? L({ fi: `vuonna ${a}`, en: `year ${a}` }) : L({ fi: `vuodet ${a}–${b}`, en: `years ${a}–${b}` }));
    if (yi > span.last) {
      const label = CONSTRUCTION_ONLY.has(m.key)
        ? L({ fi: `Rakentamisen aikana (${years(span.first, span.last)}):`, en: `During construction (${years(span.first, span.last)}):` })
        : (span.first === span.last ? L({ fi: `Vuonna ${span.first}:`, en: `In year ${span.first}:` }) : L({ fi: `Vuosina ${span.first}–${span.last}:`, en: `In years ${span.first}–${span.last}:` }));
      return { mode: 'past', v: hl, label };
    }
    const now = valueAt(m, yi);
    if (isZero(now)) {
      const typ = m.series.typ;
      let c = yi + 1;
      while (c < typ.length && !(Math.abs(typ[c] || 0) > 1e-9)) c++;
      if (c < typ.length) return { mode: 'next', v: valueAt(m, c), label: L({ fi: `Seuraavaksi vuonna ${c}:`, en: `Next in year ${c}:` }) };
      return { mode: 'headline', v: hl, label: hlWhen ? cap(hlWhen) : '' };
    }
    return { mode: 'now', v: now, label: t('sim.results.now', { y: yi }) };
  }

  /** Noise card with a persona selected whose home distance is known (personas.js distanceM, contract C2):
   *  the operating noise at that home, calculated with the model. null when the persona gives no distance. */
  function personaNoiseLine(state) {
    const p = personaById(state.persona);
    const d = Number(p?.distanceM);
    if (!p || !fin(d) || d <= 0) return null;
    let v = null;
    try { v = runSim(ctx.town(), { ...(state.design || {}), distanceM: d }, state.overrides)?.result?.metrics?.noise?.headline || null; } catch { v = null; }
    if (!v || !fin(v.low) || !fin(v.high)) return null;
    const name = L(p.name);
    const dist = fmtNum(d);
    const r = fmtRangeUnit(v.low, v.high, { fi: 'dB', en: 'dB' });
    const same = Math.round(d) === Math.round(Number(state.design?.distanceM));
    return h('div', { class: 'mcard__persona' },
      icon(p.icon || 'people', { size: 18 }),
      h('p', null,
        h('strong', null, L({ fi: `${name}: kotona noin ${dist} metrin päässä melu olisi käytön aikana noin ${r}.`, en: `${name}: at home about ${dist} m away, the noise once running would be about ${r}.` })),
        ' ', noiseNightSentence(v),
        same ? null : ` ${L({ fi: `Yllä oleva luku on laskettu ${fmtNum(state.design?.distanceM)} metrin etäisyydelle.`, en: `The number above is for ${fmtNum(state.design?.distanceM)} m.` })}`));
  }

  function makeCard(m, state, { highlight = false } = {}) {
    const sim = ctx.sim();
    const resolveT = (g) => { try { return typeof modelMod.resolveGuessTarget === 'function' ? (modelMod.resolveGuessTarget(g, ctx.town(), state.design) || g) : g; } catch { return g; } };
    const target = guessTargets().map(resolveT).find((g) => g.metric === m.key);
    const hidden = target && !ctx.revealed();
    const theme = m.theme || Object.entries(metricKeysByTheme()).find(([, ks]) => ks.includes(m.key))?.[0];
    const title = L(m.title) || m.key;
    const art = h('article', {
      class: ['mcard', highlight && 'is-highlight', hidden && 'is-hidden'], 'data-metric': m.key,
      style: `--theme: var(${themeVar(theme)})`,
    });
    const setHL = (on) => ctx.setHoverHighlight(on ? m.key : null);
    art.addEventListener('mouseenter', () => setHL(true));
    art.addEventListener('mouseleave', () => setHL(false));
    art.addEventListener('focusin', () => setHL(true));
    art.addEventListener('focusout', (e) => { if (!art.contains(e.relatedTarget)) setHL(false); });

    const assumed = assumedKeys(state);
    const head = h('header', { class: 'mcard__head' }, h('span', { class: 'sim-mark', 'aria-hidden': 'true' }), h('h4', { class: 'mcard__title' }, ...autoTerms(title, TERMS_TITLE)),
      dependsOnAssumed(m.key, assumed) ? assumptionChip() : null);
    if (hidden) {
      replace(art, head,
        h('p', { class: 'mcard__cover' }, icon('question', { size: 20 }), t('sim.guess.hidden')));
      return { el: art, update() {} };
    }

    const dec = declaredFor(m, state);
    const when = h('p', { class: 'mcard__when' });
    const plain = h('p', { class: 'mcard__plain' });
    // noise: the first sentence (the 50 dB night guideline) stays large, the other guidelines go in a short list
    const guides = h('ul', { class: 'mcard__guides', hidden: true });
    const plainCtx = { sim, assumed: new Set(assumed) };
    if (m.key === 'heatUsed' && plainCtx.assumed.has('heatReuse') && sim?.meta?.heatReuseOn === false) {
      // the project has not said where its heat goes: what it would warm if connected to district heating
      try {
        const alt = runSim(ctx.town(), { ...(state.design || {}), heatReuse: true }, state.overrides)?.result?.metrics?.heatUsed;
        const homes = (alt?.comparisons || []).find((c) => c && c.key === 'homes');
        plainCtx.heatAlt = homes && homes.high > 0 ? homes : null;
      } catch { plainCtx.heatAlt = null; }
    }
    function setPlain(v) {
      const lines = plainLines(m, v, plainCtx);
      const multi = m.key === 'noise' && lines.length > 1;
      setTermText(plain, multi ? lines[0] : lines.join(' '), TERMS_TEXT);
      plain.hidden = !lines.length;
      const rest = multi ? lines.slice(1) : [];
      const sig = rest.join('|');
      if (guides._sig !== sig) {
        guides._sig = sig;
        replace(guides, ...rest.map((x) => h('li', null, x)));
      }
      guides.hidden = !rest.length;
    }
    const personaLine = m.key === 'noise' ? personaNoiseLine(state) : null;
    const range = h('span', { class: 'mcard__range' });
    const typ = h('span', { class: 'mcard__typ' });
    const valueEl = h('p', { class: 'mcard__value' }, range, typ);
    const s = m.series || {};
    const hasSeries = Array.isArray(s.typ) && s.typ.length > 1;
    const chart = hasSeries ? bandChartInteractive({
      years: sim.years, low: s.low || s.typ, typ: s.typ, high: s.high || s.typ, phases: sim.phases, cursorYear: ctx.year(),
      label: t('sim.results.chart', { title }), height: 52,
      fmtRange: (a, b) => fmtRangeUnit(a, b, m.unit), fmtValue: (v) => fmtValUnit(v, m.unit),
      typLabel: (v) => t('sim.results.typical', { typ: v }),
      yearLabel: (y) => t('sim.results.tooltip', { y }),
      maxLabel: (mx) => fmtValUnit(mx, m.unit),
    }) : null;

    // the project's own figure as the headline, our calculation below it
    let decBlock = null;
    let generic = null;
    if (dec) {
      const { fact, kind, label } = declaredLabel(dec);
      generic = h('span', null);
      decBlock = [
        h('p', { class: 'mcard__declabel' }, kindChip(kind), h('span', null, label)),
        h('p', { class: 'mcard__value' }, h('span', { class: 'mcard__range' }, fmtDeclared(dec, m.unit))),
        fact?.source ? h('p', { class: 'mcard__src' }, sourceLink(fact.source)) : null,
        h('p', { class: 'mcard__generic' }, kindChip('calculated', { compact: true }),
          h('span', null, `${L({ fi: 'Yleinen laskelma tämän kokoiselle', en: 'Generic calculation for this size' })}: `), generic),
        dec.note ? h('p', { class: 'mcard__diff' }, h('strong', null, `${L({ fi: 'Miksi eroavat', en: 'Why they differ' })}: `), L(dec.note)) : null,
      ];
    }

    // comparisons: the first one stays visible, the rest go under "Lisää"
    const used = plainUses(m.key);
    const comps = (Array.isArray(m.comparisons) ? m.comparisons : [])
      .filter((c) => c && c.text && fin(c.typ) && !used.includes(c.key));
    const fullLabel = h('p', { class: 'mcard__full', hidden: true });
    const comp1 = h('p', { class: 'mcard__comp1' });
    // heatUsed: the first line is the heat pumps' electricity; noise: the guideline is already in the plain sentence
    const noFirst = m.key === 'heatUsed' || m.key === 'noise';
    const restComps = noFirst ? comps : comps.slice(1);
    const firstComp = noFirst ? null : comps[0] || null;
    const seen = new Set(); // each glossary word is linked once in the card's comparisons and notes
    if (firstComp) replace(comp1, ...comparisonNodes(firstComp, dec, seen)); else comp1.hidden = true;

    const moreLabel = h('p', { class: 'mcard__full', hidden: true });
    const actual = actualFor(m.key, state);
    const moreItems = [
      restComps.length ? moreLabel : null,
      restComps.length ? h('ul', { class: 'mcard__comps' }, restComps.map((c) => h('li', null, ...comparisonNodes(c, dec, seen)))) : null,
      m.townContext ? h('p', { class: 'mcard__town' }, icon('map', { size: 14 }), h('span', null, ...autoTerms(L(m.townContext), TERMS_TEXT, seen))) : null,
      m.notes ? h('p', { class: 'mcard__notes' }, ...autoTerms(L(m.notes), TERMS_TEXT, seen)) : null,
      actual.length ? h('div', { class: 'mcard__actual' },
        h('p', { class: 'mcard__actualh' }, t('sim.results.actual')),
        actual.map((f) => h('p', null, kindChip(f.kind || 'measured', { compact: true }), h('span', null, L(f.claim)), f.source ? sourceLink(f.source) : null))) : null,
    ].filter(Boolean);
    const more = moreItems.length ? h('details', { class: 'mcard__more' }, h('summary', null, L({ fi: 'Lisää', en: 'More' })), ...moreItems) : null;
    const fb = target && ctx.revealed() ? guessFeedback(target, sim, state.guesses?.[target.key]) : null;

    if (!dec) head.append(when);
    replace(art, head,
      plain,
      guides,
      ...(decBlock || [valueEl]),
      personaLine,
      chart,
      fullLabel, comp1,
      more,
      fb,
      h('footer', { class: 'mcard__foot' },
        h('span', { class: 'mcard__chips' }, kindChip(m.kind || 'calculated'), m.confidence ? confidenceChip(m.confidence) : null),
        h('button', { type: 'button', class: 'btn btn--small mcard__why', 'data-fk': `why-${m.key}`, onclick: () => ctx.openWhy(m.key), 'aria-label': `${t('common.why')} ${title}` }, icon('question', { size: 16 }), t('common.why'))));

    /** Label over the comparisons (visible one and those under 'Lisää'); '' hides it. */
    function setCompLabel(text, overFirst) {
      fullLabel.textContent = text;
      moreLabel.textContent = text;
      fullLabel.hidden = !text || !overFirst || comp1.hidden;
      moreLabel.hidden = !text;
    }

    function update(y) {
      const hl = headline(m);
      if (dec) {
        // the declared figure is the headline; the generic line shows our calculation at full operation
        generic.textContent = fmtRangeUnit(hl.low, hl.high, m.unit);
        // the comparisons belong to our calculation, not to the project's figure
        // (a comparison the project itself published carries its own label instead)
        const own = (c) => !!dec.comparisons?.[c.key];
        setCompLabel(L({ fi: 'Yleisestä laskelmasta:', en: 'From the generic calculation:' }), !(firstComp && own(firstComp)));
        if (!restComps.some((c) => !own(c))) moreLabel.hidden = true;
        setPlain(declaredValue(dec));
        chart?.setCursor(y);
        return;
      }
      const yv = yearView(m, y, hasSeries);
      const v = yv.v;
      const rText = fmtRangeUnit(v.low, v.high, m.unit);
      setTermText(range, rText, TERMS_RANGE);
      // the unit is already in the range; only euros keep theirs ("1,2 milj. €")
      const typText = /€/.test(L(m.unit) || '') ? fmtValUnit(v.typ, m.unit) : fmtNum(v.typ);
      typ.textContent = fin(v.typ) && rText.includes('–') ? ` ${t('sim.results.typical', { typ: typText })}` : '';
      replace(when,
        yv.notYet ? h('span', { class: 'mcard__notyet' }, yv.notYet) : null,
        yv.label ? h('span', null, yv.label) : null);
      art.classList.toggle('is-later', yv.mode === 'later');
      setPlain(v);
      if (m.key === 'heatUsed') {
        const note = heatPumpNote(sim, v);
        setTermText(comp1, note, TERMS_TEXT);
        comp1.hidden = !note;
      }
      // comparisons are calculated at the headline: say so when the number shown is a different year's
      const differs = (yv.mode === 'now' || yv.mode === 'next') && hl.typ > 0 && Math.abs(v.typ - hl.typ) / hl.typ > 0.05;
      if (differs && !SELF_DESCRIBED.has(m.key)) {
        const hlRange = fmtRangeUnit(hl.low, hl.high, m.unit);
        const n = Math.ceil(sim?.meta?.fullCapacityYear ?? sim?.meta?.openYear ?? 0);
        fullLabel.textContent = PEAK_HEADLINE.has(m.key) && hl.when
          ? `${cap(L(hl.when))}: ${hlRange}`
          : L({ fi: `Täydessä käytössä (vuodesta ${n}): ${hlRange}`, en: `At full operation (from year ${n}): ${hlRange}` });
        // the heat-pump line is scaled to the value shown, so only the comparisons under 'Lisää' need the label there
        setCompLabel(fullLabel.textContent, m.key !== 'heatUsed');
      } else {
        setCompLabel('', false);
      }
      chart?.setCursor(y);
    }
    update(ctx.year());
    return { el: art, update };
  }

  function group(key, title, cardsList, { iconName, highlight = false, persona = false } = {}) {
    if (!cardsList.length) return null;
    return h('section', { class: ['sim-group', highlight && 'is-highlight', persona && 'sim-group--persona'], style: `--theme: var(${themeVar(key)})` },
      h('h3', { class: 'sim-group__title' },
        persona ? icon(iconName || 'people', { size: 18 }) : h('span', { class: 'sim-group__mark', 'aria-hidden': 'true' }, icon(iconName || 'info', { size: 16 })),
        title),
      h('div', { class: 'sim-group__cards' }, cardsList.map((c) => c.el)));
  }

  function renderCards(state) {
    const sim = ctx.sim();
    if (!sim) { replace(groupsEl, h('p', { class: 'sim-error' }, t('sim.error'))); cards = []; return; }
    const showAll = !!state.simUi?.showAll;
    const p = personaById(state.persona);
    const cares = (p?.cares || []).filter((k) => sim.metrics[k]);
    const byTheme = metricKeysByTheme();
    const focus = state.focusTheme;
    cards = [];
    const sections = [];
    if (cares.length) {
      const cs = cares.map((k) => makeCard(sim.metrics[k], state, { highlight: true }));
      cards.push(...cs);
      sections.push(group('persona', t('sim.results.personaGroup', { name: L(p.name) }), cs, { iconName: p.icon, persona: true }));
    }
    let order = themeKeys();
    if (focus && order.includes(focus)) order = [focus, ...order.filter((k) => k !== focus)];
    for (const th of order) {
      const keys = (byTheme[th] || []).filter((k) => sim.metrics[k] && !cares.includes(k) && (showAll || KEY_METRICS.includes(k) || th === focus));
      const cs = keys.map((k) => makeCard({ ...sim.metrics[k], key: sim.metrics[k].key || k }, state, { highlight: th === focus }));
      cards.push(...cs);
      sections.push(group(th, themeTitle(th), cs, { iconName: themeIcon(th), highlight: th === focus }));
    }
    replace(groupsEl, ...sections.filter(Boolean));
  }

  function renderStructure(state) {
    withFocus(root, () => { renderPersonas(state); renderCards(state); });
    if (pendingFocus) {
      const el = root.querySelector(pendingFocus);
      pendingFocus = null;
      el?.focus?.({ preventScroll: true });
    }
  }

  function update(state, sim, { structural }) {
    viewSeg.set(!!state.simUi?.showAll);
    renderBanners(state);
    if (structural) renderStructure(state);
    renderSurprises(ctx.year());
  }

  // ---------- "Suurimmat yllätykset": after the run ends, the 3 biggest town-scale comparisons in large type ----------
  let surpriseSig = '';
  function renderSurprises(y) {
    const sim = ctx.sim();
    const last = sim?.years?.length ? sim.years[sim.years.length - 1] : 30;
    const show = !!sim && Number(y) >= last - 1e-6;
    const sig = show ? `${sim.meta?.town?.name || ''}|${JSON.stringify(store.get().design || {})}|${ctx.revealed() ? 1 : 0}|${store.get().lang}` : '';
    if (sig === surpriseSig) return;
    surpriseSig = sig;
    if (!show) { surpriseEl.hidden = true; replace(surpriseEl); return; }
    const items = [];
    const hiddenByGuess = (key) => !ctx.revealed() && guessTargets().some((g) => g.metric === key);
    for (const [mk, ck] of SURPRISES) {
      const m = sim.metrics?.[mk];
      const c = (m?.comparisons || []).find((x) => x && x.key === ck);
      if (!m || !c || !fin(c.typ) || !(c.typ > 0) || hiddenByGuess(mk)) continue;
      const tpl = L(c.text) || '';
      const ph = /\{range\}|\{low\}\s?[–-]\s?\{high\}|\{typ\}/.exec(tpl);
      if (!ph) continue;
      // how big it is against the town: "times" values as they are, per cents ÷ 100
      const size = c.times ? c.typ : c.typ / 100;
      items.push({ size, m, c, before: tpl.slice(0, ph.index), ph: ph[0], after: tpl.slice(ph.index + ph[0].length) });
    }
    items.sort((a, b) => b.size - a.size);
    const top = items.slice(0, 3);
    if (!top.length) { surpriseEl.hidden = true; replace(surpriseEl); return; }
    const town = sim.meta?.town?.name ? L(sim.meta.town.name) : '';
    replace(surpriseEl,
      h('h3', { class: 'sim-surprise__title' }, icon('info', { size: 18 }),
        town ? L({ fi: `Suurimmat yllätykset: ${town}`, en: `Biggest surprises in ${town}` }) : L({ fi: 'Suurimmat yllätykset', en: 'Biggest surprises' })),
      h('ol', { class: 'sim-surprise__list' }, top.map((x) => h('li', null,
        h('span', { class: 'sim-surprise__metric' }, L(x.m.title)),
        h('span', { class: 'sim-surprise__text' },
          fillTemplate(x.before, x.c),
          h('strong', { class: 'sim-surprise__big' }, fillTemplate(x.ph, x.c)),
          fillTemplate(x.after, x.c))))),
      h('p', { class: 'sim-surprise__foot' }, kindChip('calculated'),
        L({ fi: 'Täydessä käytössä, verrattuna kunnan omiin lukuihin. Tarkemmin korteissa alla.', en: 'At full operation, compared with the town’s own figures. Details in the cards below.' })));
    surpriseEl.hidden = false;
  }

  function setYear(y) { for (const c of cards) c.update(y); renderSurprises(y); }

  return { el: root, update, setYear };
}
