// Simulator helpers: memoised model runs, safe accessors and formatting.
// The model is built in parallel by another area, so everything here is defensive about missing fields.
import * as modelMod from '../../model/model.js';
import * as projectsMod from '../../content/projects.js';
import { L, t, locale } from '../../i18n.js';
import { fmtNum, roundSig } from '../format.js';

const { simulate, DESIGN_OPTIONS, METRIC_KEYS, THEME_KEYS } = modelMod;

const cache = new Map();
const CACHE_MAX = 60;

function key(town, design, overrides, presetId) {
  const d = design || {};
  const o = overrides || {};
  const ok = Object.keys(o).sort().map((k) => `${k}=${o[k]}`).join(',');
  return `${town?.code ?? 'avg'}|${d.sizeMW}|${d.cooling}|${d.heatReuse ? 1 : 0}|${d.site}|${d.distanceM}|${ok}|${presetId || ''}`;
}

/** The figures a real project has published (projects.js preset.declared), per metric key, or null. */
export function presetDeclared(presetId) {
  if (!presetId || typeof projectsMod.projectById !== 'function') return null;
  const dec = projectsMod.projectById(presetId)?.preset?.declared;
  return dec && typeof dec === 'object' ? dec : null;
}

/** Memoised simulate(). presetId (optional) adds the project's published figures as opts.declared. Returns { result, error }. Never throws. */
export function runSim(town, design, overrides, presetId) {
  const k = key(town, design, overrides, presetId);
  if (cache.has(k)) {
    const v = cache.get(k);
    cache.delete(k); cache.set(k, v); // LRU touch
    return v;
  }
  let v;
  try {
    const opts = { overrides: { ...(overrides || {}) } };
    const declared = presetDeclared(presetId);
    if (declared) opts.declared = declared;
    // one mark per real model run (cache misses), so a performance check can count them
    try { performance.mark('nd:simulate'); } catch { /* no User Timing (node, old browsers) */ }
    const result = simulate({ ...design }, town || null, opts);
    v = { result: normaliseResult(result), error: null };
  } catch (err) {
    console.error('simulate failed', err);
    v = { result: null, error: err };
  }
  cache.set(k, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return v;
}

const YEARS = Array.from({ length: 31 }, (_, i) => i);

function normaliseResult(r) {
  if (!r || typeof r !== 'object') return null;
  const years = Array.isArray(r.years) && r.years.length ? r.years : YEARS;
  const phases = Array.isArray(r.phases) && r.phases.length ? r.phases : [{ key: 'operation', start: 0, end: 30 }];
  const events = Array.isArray(r.events) ? [...r.events].filter((e) => Number.isFinite(e?.year)).sort((a, b) => a.year - b.year) : [];
  const metrics = r.metrics && typeof r.metrics === 'object' ? r.metrics : {};
  return { ...r, years, phases, events, metrics };
}

export const themeKeys = () => (Array.isArray(THEME_KEYS) && THEME_KEYS.length ? THEME_KEYS : ['energy', 'environment', 'jobs', 'traffic', 'land', 'safety', 'future']);

/** Metric keys in theme order, as given by the model. */
export function metricKeysByTheme() {
  const out = {};
  for (const th of themeKeys()) out[th] = (METRIC_KEYS && METRIC_KEYS[th]) || [];
  return out;
}

export const designOptions = () => ({
  sizes: DESIGN_OPTIONS?.sizes?.length ? DESIGN_OPTIONS.sizes : [{ key: 'small', mw: 10 }, { key: 'medium', mw: 50 }, { key: 'large', mw: 150 }, { key: 'giant', mw: 500 }],
  cooling: DESIGN_OPTIONS?.cooling?.length ? DESIGN_OPTIONS.cooling : ['air', 'evaporative', 'liquid'],
  site: DESIGN_OPTIONS?.site?.length ? DESIGN_OPTIONS.site : ['industrial', 'forest', 'field'],
  distance: { min: 200, max: 3000, step: 50, ...(DESIGN_OPTIONS?.distance || {}) },
});

const num = (v) => (Number.isFinite(v) ? v : 0);

/** Value of a metric in a given (integer) year: { low, typ, high }. */
export function valueAt(metric, year) {
  const s = metric?.series;
  if (!s) return { low: 0, typ: 0, high: 0 };
  const i = Math.max(0, Math.min((s.typ?.length ?? 31) - 1, Math.floor(year)));
  return { low: num(s.low?.[i]), typ: num(s.typ?.[i]), high: num(s.high?.[i]) };
}

export const isZero = (v) => !v || (Math.abs(v.high) < 1e-9 && Math.abs(v.typ) < 1e-9);

export function headline(metric) {
  const hl = metric?.headline;
  if (hl && [hl.low, hl.typ, hl.high].some(Number.isFinite)) return { low: num(hl.low), typ: num(hl.typ), high: num(hl.high), when: hl.when || null };
  // fallback: the largest typical value in the series
  const s = metric?.series;
  if (!s?.typ) return { low: 0, typ: 0, high: 0, when: null };
  let best = 0;
  s.typ.forEach((v, i) => { if (num(v) > num(s.typ[best])) best = i; });
  return { ...valueAt(metric, best), when: null };
}

/** First and last year index with a non-zero typical value, or null when the series is all zero. */
export function nonZeroSpan(metric) {
  const typ = metric?.series?.typ;
  if (!Array.isArray(typ)) return null;
  let first = -1;
  let last = -1;
  typ.forEach((v, i) => { if (Math.abs(num(v)) > 1e-9) { if (first < 0) first = i; last = i; } });
  return first < 0 ? null : { first, last };
}

/** True when the metric's series is a one-off (non-zero only in a short window). */
export function isOneOff(metric) {
  const typ = metric?.series?.typ;
  if (!typ) return false;
  const nz = typ.filter((v) => num(v) > 0).length;
  return nz > 0 && nz <= 2;
}

// ---------- formatting ----------

const isEuro = (unit) => /€/.test(L(unit) || '');

/** "1,2–3,4 milj. €/v" style range for a metric unit, euro-aware. */
export function fmtRangeUnit(low, high, unit) {
  const u = L(unit) || '';
  if (isEuro(unit)) return fmtEurRange(low, high, u.replace('€', '').trim());
  const a = fmtNum(low);
  const b = fmtNum(high);
  const r = a === b ? a : `${a}–${b}`;
  return u ? `${r} ${u}` : r;
}

/** One value with unit, euro-aware. */
export function fmtValUnit(v, unit) {
  const u = L(unit) || '';
  if (isEuro(unit)) return fmtEurRange(v, v, u.replace('€', '').trim());
  return u ? `${fmtNum(v)} ${u}` : fmtNum(v);
}

function eurScale(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return [1e9, 'bn'];
  if (a >= 1e6) return [1e6, 'm'];
  return [1, ''];
}

export function fmtEurRange(low, high, suffix = '') {
  const [div, sc] = eurScale(Math.max(Math.abs(low || 0), Math.abs(high || 0)));
  const a = fmtNum(low / div);
  const b = fmtNum(high / div);
  const r = a === b ? a : `${a}–${b}`;
  const fi = locale() === 'fi-FI';
  if (fi) {
    const word = sc === 'bn' ? ' mrd. €' : sc === 'm' ? ' milj. €' : ' €';
    return `${r}${word}${suffix}`;
  }
  const word = sc === 'bn' ? ' billion' : sc === 'm' ? ' million' : '';
  return `€${r}${word}${suffix}`;
}

export const fmtCount = (v) => fmtNum(roundSig(v, 2));

// ---------- town & scene helpers ----------

export function townSize(town) {
  const p = town?.population;
  if (!Number.isFinite(p)) return 'medium';
  if (p < 15000) return 'small';
  if (p < 80000) return 'medium';
  return 'large';
}

// No town → the model's documented "average Finnish town", which has a district-heating network.
export const hasDH = (town) => (town ? !!town.districtHeat?.has : true);

/** District-heat status, as the model uses it: 'stats' | 'statsEstimate' | 'local' | 'notInStats' | 'default'. */
export function dhStatus(town) {
  if (typeof modelMod.districtHeatStatus === 'function') {
    try { return modelMod.districtHeatStatus(town || null); } catch { /* fall through */ }
  }
  if (!town) return 'default';
  const dh = town.districtHeat;
  if (!dh?.has) return 'notInStats';
  if (dh.local) return 'local';
  return dh.estimated ? 'statsEstimate' : 'stats';
}

/** Phase at a fractional year → { phase, progress, index }. */
export function phaseAt(phases, y) {
  if (!phases?.length) return { phase: 'operation', progress: 0, index: 0 };
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const last = i === phases.length - 1;
    if (y >= p.start && (y < p.end || last)) {
      const len = Math.max(1e-6, p.end - p.start);
      return { phase: p.key, progress: Math.max(0, Math.min(1, (y - p.start) / len)), index: i };
    }
  }
  return { phase: phases[0].key, progress: 0, index: 0 };
}

export function operationStart(sim) {
  const op = sim?.phases?.find((p) => p.key === 'operation');
  return op ? op.start : 4;
}

export function phaseLabel(key) {
  const k = `sim.phase.${key}`;
  const s = t(k);
  return s === k ? key : s;
}

export function seasonLabel(frac) {
  // 0 = midwinter. 0..1 → winter, spring, summer, autumn centred so that 0 and 1 are winter.
  const q = Math.floor((((frac % 1) + 1) % 1 + 0.125) * 4) % 4;
  return t(`sim.season.${q}`);
}

export const themeVar = (theme) => ({
  energy: '--c-energy', environment: '--c-water', jobs: '--c-jobs', traffic: '--c-traffic',
  land: '--c-land', safety: '--c-safety', future: '--c-future', heat: '--c-heat',
}[theme] || '--accent');

/** Pick a comparison from a metric by key (or the first one). */
export function comparison(metric, ckey) {
  const list = Array.isArray(metric?.comparisons) ? metric.comparisons : [];
  if (ckey) return list.find((c) => c.key === ckey) || null;
  return list[0] || null;
}
