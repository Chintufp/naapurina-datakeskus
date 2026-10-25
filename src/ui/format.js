// Number formatting for people, not engineers.
// Ranges are rounded to 2 significant figures so they never look more precise than they are.
// Exceptions: fmtCoef shows a model coefficient exactly as stored (so a reader can check it against the source),
// fmtInt shows whole things (generators, people), fmtEurRange keeps one unit for a euro range.
import { locale, t, L } from '../i18n.js';

/** Round to `sig` significant figures (default 2). 0 stays 0. */
export function roundSig(v, sig = 2) {
  if (!Number.isFinite(v) || v === 0) return v;
  const p = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

/** Locale number, e.g. 12 300 (fi) / 12,300 (en). */
export function fmtNum(v, { sig = 2, digits } = {}) {
  if (v == null || !Number.isFinite(v)) return '–';
  const val = digits != null ? v : roundSig(v, sig);
  const maxDigits = digits != null ? digits : (Math.abs(val) < 1 ? 2 : Math.abs(val) < 10 ? 1 : 0);
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: maxDigits }).format(val);
}

/** "220–510" with both ends rounded the same way; collapses to one number when they round equal. */
export function fmtRange(low, high, opts = {}) {
  const a = fmtNum(low, opts);
  const b = fmtNum(high, opts);
  return a === b ? a : `${a}–${b}`;
}

/**
 * A coefficient exactly as stored in the model (no significant-figure rounding), up to 4 decimals:
 * 1.15 → "1,15", 0.0224 → "0,0224", 5000 → "5 000" (fi) / "5,000" (en).
 * Values too small for 4 decimals keep 2 significant figures so they never show as 0.
 */
export function fmtCoef(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  const tiny = v !== 0 && Math.abs(v) < 0.0001;
  const nf = new Intl.NumberFormat(locale(), tiny ? { maximumSignificantDigits: 2 } : { maximumFractionDigits: 4 });
  return nf.format(v);
}

/** A whole number of things (machines, people, trucks): 6.9 → "7"; from 100 up rounded to 2 significant figures ("1 200"). */
export function fmtInt(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  let r = Math.round(v);
  if (Math.abs(r) >= 100) r = roundSig(r, 2);
  return new Intl.NumberFormat(locale(), { maximumFractionDigits: 0 }).format(r || 0);   // r || 0 avoids "-0"
}

/** Big euro amounts in words: 1,2 milj. € / €1.2 million */
export function fmtEur(v, { sig = 2 } = {}) {
  if (v == null || !Number.isFinite(v)) return '–';
  const fi = locale() === 'fi-FI';
  const abs = Math.abs(v);
  if (abs >= 1e9) return fi ? `${fmtNum(v / 1e9, { sig })} mrd. €` : `€${fmtNum(v / 1e9, { sig })} billion`;
  if (abs >= 1e6) return fi ? `${fmtNum(v / 1e6, { sig })} milj. €` : `€${fmtNum(v / 1e6, { sig })} million`;
  return fi ? `${fmtNum(v, { sig })} €` : `€${fmtNum(v, { sig })}`;
}

/** A euro range with one unit: "180–370 milj. €" / "€180–370 million"; equal ends collapse to one number. */
export function fmtEurRange(low, high, { sig = 2 } = {}) {
  const lo = Number.isFinite(low) ? low : null;
  const hi = Number.isFinite(high) ? high : null;
  if (lo == null && hi == null) return '–';
  if (lo == null || hi == null) return fmtEur(lo ?? hi, { sig });
  const fi = locale() === 'fi-FI';
  const top = Math.max(Math.abs(lo), Math.abs(hi));
  const [div, fiUnit, enUnit] = top >= 1e9 ? [1e9, ' mrd. €', ' billion'] : top >= 1e6 ? [1e6, ' milj. €', ' million'] : [1, ' €', ''];
  const a = fmtNum(lo / div, { sig });
  const b = fmtNum(hi / div, { sig });
  const num = a === b ? a : `${a}–${b}`;
  return fi ? `${num}${fiUnit}` : `€${num}${enUnit}`;
}

/** Percentage from a fraction: 0.43 → "43 %" (fi) / "43%" (en) */
export function fmtPct(fraction, opts = {}) {
  const n = fmtNum(fraction * 100, opts);
  return locale() === 'fi-FI' ? `${n} %` : `${n}%`;
}

/** Date "2026-07-23" → "23.7.2026" / "23 Jul 2026" */
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 7 ? iso + '-01' : iso);
  if (Number.isNaN(+d)) return iso;
  if (iso.length === 7) return new Intl.DateTimeFormat(locale(), { month: 'numeric', year: 'numeric' }).format(d);
  return new Intl.DateTimeFormat(locale(), locale() === 'fi-FI' ? { day: 'numeric', month: 'numeric', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Fill a bilingual template like { fi: 'noin {typ} kotia', en: 'about {typ} homes' } with formatted numbers.
 * Placeholders: {low} {typ} {high} {value} and {range} (= low–high, one number when both ends round equal).
 * values.format: 'int' → whole numbers (fmtInt), 'eur' → euros in words (fmtEur / fmtEurRange), otherwise fmtNum(v, opts).
 * A literal "{low}–{high}" whose ends round to the same text becomes that single number ("noin 170 autoa").
 */
export function fillTemplate(tpl, values = {}, opts = {}) {
  const v = values || {};
  const fmt = v.format === 'int' ? fmtInt : v.format === 'eur' ? (x) => fmtEur(x, opts) : (x) => fmtNum(x, opts);
  const range = () => {
    if (v.format === 'eur') return fmtEurRange(v.low, v.high, opts);
    const a = fmt(v.low);
    const b = fmt(v.high);
    return a === b ? a : `${a}–${b}`;
  };
  const pair = () => {
    if (v.format === 'eur') return fmtEurRange(v.low, v.high, opts);
    const a = fmt(v.low);
    const b = fmt(v.high);
    if (a !== b) return `${a}–${b}`;
    return Number.isFinite(v.typ) ? fmt(v.typ) : a;
  };
  return L(tpl)
    .replace(/\{low\}\s?[–-]\s?\{high\}/g, pair)
    .replace(/\{(low|typ|high|value|range)\}/g, (_, k) => (k === 'range' ? range() : fmt(v[k])));
}

/** Unit-aware range string for a metric headline, e.g. "220–510 GWh/v". */
export function fmtMetricRange(metric, which = metric.headline) {
  return `${fmtRange(which.low, which.high)} ${L(metric.unit)}`.trim();
}

export { t, L };
