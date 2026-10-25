// Small, quiet charts for uncertainty. Hand-written SVG + HTML labels (text never stretched).
//   bandChart({ years, low, typ, high, cursorYear?, phases?, width?, height?, label }) → SVG element
//       p10–p90 band + typical line over years, one axis, optional cursor and phase shading.
//   bandChartInteractive({ ...same, fmtRange(lo, hi), fmtValue(v), yearLabel(y) }) → HTMLElement with .setCursor(year)
//       adds x-axis ticks, a recessive max label, and a hover/focus tooltip (arrow keys move it). For screen readers
//       it is a slider over the years: aria-valuenow is the year and aria-valuetext says "Vuosi 12: 280–420 GWh/v".
//   rangeStrip({ min, max, scale, low, typ, high, guess?, fmt, labels, animate? }) → HTMLElement
//       one horizontal axis (log or linear): calculated band + typical tick + optional guess marker.
//       animate: the band grows out from the typical value once (not with reduced motion).
// Rules (dataviz): one axis, thin marks, band at low opacity behind a 2px typical line, hairline recessive axes,
// all text in ink tokens, values never colour-only.
import { h, s, replace } from '../dom.js';
import { lang } from '../../i18n.js';

const finite = (v) => (Number.isFinite(v) ? v : 0);

/** Short axis label: FI 100, 1 t., 10 t., 100 t., 1 milj.; EN 100, 1k, 10k, 100k, 1M. Below 1 000 the normal label. */
function shortNum(v, fmt) {
  const a = Math.abs(v);
  if (!(a >= 1000)) return fmt(v);
  const en = lang() === 'en';
  const [d, sfx] = a >= 1e9 ? [1e9, en ? 'bn' : ' mrd.'] : a >= 1e6 ? [1e6, en ? 'M' : ' milj.'] : [1e3, en ? 'k' : ' t.'];
  const n = Math.round((v / d) * 10) / 10;
  const txt = en ? String(n) : String(n).replace('.', ',');
  return `${txt}${sfx}`;
}

function geometry({ years, low, typ, high, width, height, pad = 4 }) {
  const n = Math.max(2, years?.length || typ?.length || 2);
  const max = Math.max(1e-9, ...high.map(finite), ...typ.map(finite));
  const yMax = max * 1.08;
  const x = (i) => (i / (n - 1)) * width;
  const y = (v) => height - 1 - (finite(v) / yMax) * (height - 1 - pad);
  const bandD = `M${low.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join('L')}` +
    `L${high.map((_, j) => { const i = high.length - 1 - j; return `${x(i).toFixed(2)},${y(high[i]).toFixed(2)}`; }).join('L')}Z`;
  const lineD = `M${typ.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join('L')}`;
  return { n, max, yMax, x, y, bandD, lineD };
}

/** Static SVG band chart (contract shape). */
export function bandChart({ years, low, typ, high, cursorYear, phases, width = 300, height = 56, label = '' }) {
  const g = geometry({ years, low, typ, high, width, height });
  const yearX = (yr) => (yr / (g.n - 1)) * width;
  return s('svg', {
    viewBox: `0 0 ${width} ${height}`, width: '100%', height, role: 'img', 'aria-label': label,
    preserveAspectRatio: 'none', class: 'band-svg', focusable: 'false',
  },
  (phases || []).filter((p) => p.key === 'construction').map((p) =>
    s('rect', { class: 'band-svg__phase', x: yearX(p.start), y: 0, width: Math.max(0, yearX(p.end) - yearX(p.start)), height })),
  s('line', { class: 'band-svg__base', x1: 0, x2: width, y1: height - 0.5, y2: height - 0.5, 'vector-effect': 'non-scaling-stroke' }),
  s('path', { class: 'band-svg__band', d: g.bandD }),
  s('path', { class: 'band-svg__line', d: g.lineD, 'vector-effect': 'non-scaling-stroke' }),
  cursorYear != null ? s('line', { class: 'band-svg__cursor', x1: yearX(cursorYear), x2: yearX(cursorYear), y1: 0, y2: height, 'vector-effect': 'non-scaling-stroke' }) : null);
}

/** Band chart with axis ticks, max label and an accessible hover/focus tooltip. */
export function bandChartInteractive(opts) {
  const { years, low, typ, high, cursorYear = 0, phases, label = '', height = 56,
    fmtRange = (a, b) => `${a}–${b}`, fmtValue = (v) => String(v), yearLabel = (y) => `${y}`, maxLabel = null, typLabel = (v) => v } = opts;
  const W = 300;
  const g = geometry({ years, low, typ, high, width: W, height });
  const last = g.n - 1;
  const svg = bandChart({ years, low, typ, high, phases, width: W, height, label: '' });
  svg.setAttribute('aria-hidden', 'true');

  const cursor = h('div', { class: 'bc__cursor', 'aria-hidden': 'true' });
  const hoverLine = h('div', { class: 'bc__hover', 'aria-hidden': 'true', hidden: true });
  const dot = h('div', { class: 'bc__dot', 'aria-hidden': 'true', hidden: true });
  const tip = h('div', { class: 'bc__tip', 'aria-hidden': 'true', hidden: true });
  const plot = h('div', { class: 'bc__plot', style: { height: `${height}px` } }, svg, cursor, hoverLine, dot,
    maxLabel ? h('span', { class: 'bc__max' }, maxLabel(g.max)) : null);
  const ticks = h('div', { class: 'bc__axis', 'aria-hidden': 'true' },
    [0, 10, 20, 30].filter((v) => v <= last).map((v) => h('span', { style: { left: `${(v / last) * 100}%` } }, String(v))));
  const root = h('div', {
    class: 'bc', tabindex: '0', role: 'slider', 'aria-label': label, 'aria-orientation': 'horizontal',
    'aria-valuemin': '0', 'aria-valuemax': String(last),
  }, plot, ticks, tip);

  let tipYear = null;
  let cur = cursorYear;

  function pct(yr) { return `${(Math.max(0, Math.min(last, yr)) / last) * 100}%`; }

  /** "Vuosi 12: 280–420 GWh/v" for the year a screen reader is on. */
  function announceYear(yr) {
    const y = Math.max(0, Math.min(last, Math.round(yr)));
    root.setAttribute('aria-valuenow', String(y));
    root.setAttribute('aria-valuetext', `${yearLabel(y)}: ${fmtRange(finite(low[y]), finite(high[y]))}`);
  }

  function setCursor(yr) {
    cur = yr;
    cursor.style.left = pct(yr);
    if (tipYear == null) announceYear(Math.floor(yr));
  }

  function showTip(yr) {
    yr = Math.max(0, Math.min(last, Math.round(yr)));
    tipYear = yr;
    const lo = finite(low[yr]); const ty = finite(typ[yr]); const hi = finite(high[yr]);
    replace(tip, 
      h('span', { class: 'bc__tip-year' }, yearLabel(yr)),
      h('strong', { class: 'bc__tip-val' }, fmtRange(lo, hi)),
      ty || hi ? h('span', { class: 'bc__tip-typ' }, typLabel(fmtValue(ty))) : null);
    tip.hidden = false;
    announceYear(yr);
    hoverLine.hidden = false;
    dot.hidden = false;
    hoverLine.style.left = pct(yr);
    dot.style.left = pct(yr);
    dot.style.top = `${(g.y(ty) / height) * 100}%`;
    // keep the tooltip inside the chart box
    const w = root.clientWidth || 1;
    const tw = tip.offsetWidth || 120;
    const px = (yr / last) * w;
    tip.style.left = `${Math.max(0, Math.min(w - tw, px - tw / 2))}px`;
  }
  function hideTip() { tip.hidden = true; hoverLine.hidden = true; dot.hidden = true; tipYear = null; announceYear(Math.floor(cur)); }

  plot.addEventListener('pointermove', (e) => {
    const r = plot.getBoundingClientRect();
    showTip(((e.clientX - r.left) / Math.max(1, r.width)) * last);
  });
  plot.addEventListener('pointerleave', () => { if (document.activeElement !== root) hideTip(); });
  root.addEventListener('focus', () => showTip(Math.floor(cur)));
  root.addEventListener('blur', hideTip);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      showTip((tipYear ?? Math.floor(cur)) + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (e.key === 'Home') { e.preventDefault(); showTip(0); }
    else if (e.key === 'End') { e.preventDefault(); showTip(last); }
    else if (e.key === 'Escape') hideTip();
  });

  setCursor(cursorYear);
  root.setCursor = setCursor;
  return root;
}

/** Horizontal strip on one axis: calculated band (low–high), typical tick and an optional guess marker. */
export function rangeStrip({ min, max, scale = 'log', low, typ, high, guess = null, fmt = String, labels = {}, animate = false }) {
  const lo0 = scale === 'log' ? Math.max(1, Math.min(min || 1, low > 0 ? low : Infinity, guess > 0 ? guess : Infinity)) : Math.min(min, low, guess ?? Infinity);
  const hi0 = Math.max(max, high || 0, guess || 0);
  const f = scale === 'log'
    ? (v) => (Math.log10(Math.max(lo0, v)) - Math.log10(lo0)) / Math.max(1e-9, Math.log10(hi0) - Math.log10(lo0))
    : (v) => (v - lo0) / Math.max(1e-9, hi0 - lo0);
  const p = (v) => `${Math.max(0, Math.min(1, f(v))) * 100}%`;

  const ticks = [];
  if (scale === 'log') {
    for (let e = Math.ceil(Math.log10(lo0)); e <= Math.floor(Math.log10(hi0)); e++) ticks.push(10 ** e);
  } else {
    for (let i = 0; i <= 4; i++) ticks.push(lo0 + ((hi0 - lo0) * i) / 4);
  }
  if (ticks.length > 5) {
    const keep = ticks.filter((_, i) => i % 2 === (ticks.length - 1) % 2);
    ticks.length = 0; ticks.push(...keep);
  }
  const bandLeft = Math.max(0, Math.min(1, f(Math.max(lo0, low))));
  const bandRight = Math.max(0, Math.min(1, f(Math.max(lo0, high))));

  const bandStyle = { left: `${bandLeft * 100}%`, width: `${Math.max(0.8, (bandRight - bandLeft) * 100)}%` };
  const band = h('span', { class: 'strip__band', style: bandStyle, title: labels.calc || '' });
  let reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no window */ }
  if (animate && !reduce && typeof requestAnimationFrame === 'function') {
    // start as a sliver at the typical value, then grow to the full band
    band.style.left = p(Math.max(lo0, typ));
    band.style.width = '0.8%';
    requestAnimationFrame(() => requestAnimationFrame(() => { band.style.left = bandStyle.left; band.style.width = bandStyle.width; }));
  }

  return h('div', { class: ['strip', animate && 'strip--animate'] },
    h('div', { class: 'strip__track' },
      ticks.map((v) => h('span', { class: 'strip__grid', style: { left: p(v) } })),
      band,
      h('span', { class: 'strip__typ', style: { left: p(Math.max(lo0, typ)) } }),
      guess != null ? h('span', { class: 'strip__guess', style: { left: p(guess) }, title: labels.guess || '' }) : null),
    // On a narrow strip (results.css container query) every other tick is dropped and the labels get short forms
    // ("1 milj." / "1M"), so "100 000" and "1 000 000" never run together.
    h('div', { class: 'strip__axis', 'aria-hidden': 'true' },
      ticks.map((v, i) => h('span', {
        class: ['strip__tick', i === 0 && 'is-first', i === ticks.length - 1 && 'is-last', ticks.length >= 5 && i % 2 === 1 && 'is-alt'],
        style: { left: p(v) },
      }, h('span', { class: 'strip__tl' }, fmt(v)), h('span', { class: 'strip__ts' }, shortNum(v, fmt))))),
    h('div', { class: 'strip__legend' },
      h('span', { class: 'strip__key strip__key--calc' }, h('i', { 'aria-hidden': 'true' }), labels.calc || ''),
      guess != null ? h('span', { class: 'strip__key strip__key--guess' }, h('i', { 'aria-hidden': 'true' }), labels.guess || '') : null));
}
