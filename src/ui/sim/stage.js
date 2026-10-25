// Step 4: the stage — living town scene, the "what is happening now" caption, running totals (scene counters) and the
// timeline (play/pause, speed, scrubber with phase bands and event markers). At year 30 a recap card with the totals.
// Also: presentation mode (button or F; Esc exits), "Copy link", and a compact fixed player bar that appears after the
// first Play while the stage is scrolled out of view.
// Running totals start when the data centre opens (meta.hallOnline / openYear), never during construction, and are put
// in the town's own scale (share of the town's homes, € per resident). While playing, each frame moves only the scene and
// the year marker; the text around them (caption, totals, badge, read-outs) is rebuilt at most 4 times a second, and only
// when it changes.
import { h, icon, replace, withFocus, announce } from '../dom.js';
import { t, L } from '../../i18n.js';
import * as F from '../format.js';
import { store } from '../../store.js';
import { createScene } from '../scene.js';
import * as COEFS from '../../model/coefficients.js';
import { kindChip } from '../components/chips.js';
import { segmented, prefersReducedMotion } from './controls.js';
import { phaseAt, phaseLabel, seasonLabel, valueAt, fmtRangeUnit, fmtEurRange as eurRangeCompat, hasDH, townSize, operationStart, comparison } from './compute.js';
import { townName } from './townCard.js';
import * as projectsMod from '../../content/projects.js';

const LAST = 30;
/** While playing, the text outside the scene is refreshed at most this often (ms). */
const TEXT_MS = 250;
/** Below this scene width the scene is asked to show at most two labels at a time (state.maxLabels). */
const SMALL_PX = 600;
/** Running totals that only start with the first heat to the network (later than the opening). */
const HEAT_KEYS = new Set(['heatUsed', 'heatPumpElectricity', 'co2HeatAvoided']);
const { fmtNum } = F;
const fmtEurRange = F.fmtEurRange || ((lo, hi) => eurRangeCompat(lo, hi));
const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const num = (v) => (Number.isFinite(v) ? v : 0);
/** Event years can be fractional (1,5): one decimal, never rounded to 2 significant figures. */
const fmtYear = (y) => fmtNum(y, { digits: 1 });
/** District heat one home uses a year, MWh (the model's sourced coefficient; 11 MWh if it is missing). */
const heatPerHomeMWh = () => num(COEFS.COEF?.['heat.perHome']?.typ) || 11;

const isTyping = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || ''));

/** "a–b" (one number when both ends round the same) + unit. */
function rangeText(low, high, unit, opts) {
  const a = fmtNum(low, opts); const b = fmtNum(high, opts);
  const r = a === b ? a : `${a}–${b}`;
  return unit ? `${r} ${unit}` : r;
}

/** Energy total in GWh → "6,4–9,3 TWh" or "120–180 GWh". */
function energyText(low, high) {
  return Math.max(low, high) >= 1000 ? rangeText(low / 1000, high / 1000, 'TWh') : rangeText(low, high, 'GWh');
}

/** "14–25 %" / "14–25%". */
function pctText(low, high) {
  const r = rangeText(low, high);
  return L({ fi: `${r} %`, en: `${r}%` });
}

/** Text and attribute writes that skip the DOM when nothing changed. */
function setText(el, s) { if (el._txt !== s) { el._txt = s; el.textContent = s; } }
function setAttr(el, k, v) { if (el.getAttribute(k) !== v) el.setAttribute(k, v); }

export function createStage(ctx) {
  const root = h('section', { class: 'sim-panel sim-stage', 'data-step': '4', 'aria-labelledby': 'sim-stage-title' });

  // --- scene ---
  const sceneBox = h('div', { class: 'sim-stage__scene' });
  const badgeYear = h('span', { class: 'sim-badge__year' });
  const badgePhase = h('span', { class: 'sim-badge__phase' });
  const badge = h('div', { class: 'sim-badge', 'aria-hidden': 'true' }, badgeYear, badgePhase);
  const sceneWrap = h('div', { class: 'sim-stage__scenewrap' }, sceneBox, badge);
  let scene = null;
  try { scene = createScene(sceneBox); } catch (err) {
    console.error('scene failed', err);
    sceneBox.append(h('div', { class: 'sim-stage__nosscene' }));
  }

  // --- caption ---
  const capMain = h('p', { class: 'sim-caption__main' });
  const capEvent = h('p', { class: 'sim-caption__event', role: 'status' });
  const capNext = h('p', { class: 'sim-caption__next', hidden: true });
  const capPreview = h('p', { class: 'sim-caption__preview', hidden: true });
  // Running totals as text: for screen readers (the scene's counters are aria-hidden), and visible on a narrow stage.
  const capCounters = h('ul', { class: 'sim-counters' });
  const caption = h('div', { class: 'sim-caption' }, capMain, capEvent, capNext, capPreview, capCounters);

  // --- recap at year 30 ---
  const recapList = h('ul', { class: 'sim-recap__list' });
  const recap = h('div', { class: 'sim-recap', hidden: true },
    h('div', { class: 'sim-recap__head' }, h('h3', { class: 'sim-recap__title' }, t('sim.recap.title')), kindChip('calculated')),
    h('p', { class: 'sim-recap__lead' }, t('sim.recap.lead')),
    recapList,
    h('button', { type: 'button', class: 'btn btn--primary sim-recap__cta', 'data-fk': 'sim-recap-cta', onclick: () => { store.set({ simStep: 5 }); ctx.scrollToStep(5); } },
      t('sim.recap.cta'), icon('arrowRight', { size: 16 })));

  // Caption and recap: under the scene in the normal layout (the wrapper is display: contents); in presentation mode on a
  // wide screen they form a column beside the scene, and on a narrower one a strip above the timeline. Never over the picture.
  const side = h('div', { class: 'sim-stage__side' }, caption, recap);

  // --- controls ---
  const playBtn = h('button', {
    type: 'button', class: 'sim-play', 'data-fk': 'sim-play',
    onclick: () => { if (ctx.isPlaying()) ctx.pause(); else { ctx.play(); keepSceneInView(); } },
  });
  // one button cycles the speed 1× → 2× → 4× (fewer controls than a three-way switch)
  const speedText = h('span', null);
  const speedSeg = h('button', {
    type: 'button', class: 'btn btn--ghost btn--small sim-speed', 'data-fk': 'sim-speed',
    onclick: () => { const v = store.get().speed || 2; ctx.setSpeed(v === 1 ? 2 : v === 2 ? 4 : 1); },
  }, speedText);
  speedSeg.set = (v) => {
    speedText.textContent = `${v}×`;
    speedSeg.setAttribute('aria-label', `${t('sim.speed')}: ${v}×`);
    speedSeg.title = t('sim.speed');
  };
  const yearOut = h('span', { class: 'sim-stage__year', 'aria-hidden': 'true' });

  // --- tools: copy link, presentation mode ---
  const shareStatus = h('p', { class: 'sim-share__status', role: 'status' });
  const shareInput = h('input', { class: 'sim-input sim-share__input', type: 'text', readonly: true, hidden: true, 'aria-label': t('sim.share.label') });
  const shareBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--small sim-share', 'data-fk': 'sim-share', onclick: () => share() },
    icon('link', { size: 16 }), t('sim.share'));
  const presentLabel = h('span', null, t('sim.present'));
  const presentBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--small sim-present', 'data-fk': 'sim-present', onclick: () => setPresenting(!presenting) },
    h('span', { class: 'sim-present__icon', 'aria-hidden': 'true' }), presentLabel);
  const tools = h('div', { class: 'sim-stage__tools' }, shareBtn, presentBtn, shareStatus, shareInput);

  // --- timeline track (custom slider) ---
  const phasesEl = h('div', { class: 'tl__phases', 'aria-hidden': 'true' });
  const progress = h('div', { class: 'tl__progress', 'aria-hidden': 'true' });
  const thumb = h('div', { class: 'tl__thumb', 'aria-hidden': 'true' });
  const track = h('div', {
    class: 'tl__track', role: 'slider', tabindex: '0', 'aria-label': t('sim.timeline'),
    'aria-valuemin': '0', 'aria-valuemax': String(LAST), 'aria-valuenow': '0',
  }, phasesEl, progress, thumb);
  const eventsEl = h('div', { class: 'tl__events', role: 'group', 'aria-label': t('sim.events') });
  const ticks = h('div', { class: 'tl__ticks', 'aria-hidden': 'true' },
    [0, 5, 10, 15, 20, 25, 30].map((v) => h('span', { style: { left: `${(v / LAST) * 100}%` } }, String(v))));
  const legend = h('ul', { class: 'tl__legend' });
  const timeline = h('div', { class: 'tl' }, eventsEl, track, ticks, legend);

  const controls = h('div', { class: 'sim-stage__controls' },
    h('p', { class: 'sim-panel__eyebrow sim-stage__eyebrow' }, h('span', { class: 'sim-panel__num' }, '4'), t('sim.step.4')),
    playBtn, yearOut, h('span', { class: 'sim-stage__spacer' }), speedSeg); // no separate restart: Play at the end starts again, and the timeline can be dragged

  root.append(
    h('h2', { class: 'sr-only', id: 'sim-stage-title' }, t('sim.stage.title')),
    sceneWrap,
    side,
    controls,
    timeline,
    tools);

  // --- mini player (fixed) ---
  const miniPlay = h('button', { type: 'button', class: 'sim-play sim-play--mini', 'data-fk': 'sim-play-mini', onclick: () => (ctx.isPlaying() ? ctx.pause() : ctx.play()) });
  const miniText = h('span', { class: 'sim-mini__text' });
  const miniBar = h('span', { class: 'sim-mini__bar' }, h('span', { class: 'sim-mini__fill' }));
  const mini = h('div', { class: 'sim-mini', 'aria-label': t('sim.mini'), role: 'region', hidden: true },
    miniPlay, h('button', { type: 'button', class: 'sim-mini__jump', onclick: () => root.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' }) }, miniText, miniBar));
  let io = null;
  let lastState = null;
  let stageInView = true;
  let presenting = false;
  let destroyed = false;
  let narrow = false;
  let small = false;
  // Below this stage width the scene draws its counters as a tall stacked box that hides event labels and signs,
  // so the totals go in a text list under the caption instead (wide screens keep them in the scene; presentation mode
  // shows them as large text beside or under the scene, so the picture stays uncovered).
  const NARROW_PX = 820;
  const setNarrow = () => {
    const w = sceneWrap.clientWidth || 600;
    const n = w < NARROW_PX;
    const s = w < SMALL_PX;
    if (n === narrow && s === small) return false;
    narrow = n;
    small = s;
    root.classList.toggle('is-narrow', n);
    lastCountersKey = '';
    return true;
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => {
    const w = track.clientWidth || 600;
    if (track.clientWidth && track.clientWidth !== trackW) { trackW = track.clientWidth; if (sim) placeMarker(ctx.year()); }
    if (sim && Math.abs(Math.max(0.6, (30 / w) * LAST) - groupThr) > 0.25) { renderStructure(lastState, sim); renderCaption(true); }
    if (setNarrow() && sim) renderYear(ctx.year(), true);
    if (!mini.hidden) padForMini(true);
  }) : null;
  ro?.observe(track);
  ro?.observe(sceneWrap);
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => { stageInView = e.isIntersecting; syncMini(); }, { threshold: 0.15 });
    io.observe(sceneWrap);
  }

  /** Mini player: only after the first Play and while the stage is off-screen. While it shows, the page gets room below. */
  function padForMini(on) {
    const body = document.body; const html = document.documentElement;
    if (on) {
      const hgt = `${Math.ceil(mini.offsetHeight + 24)}px`;
      body.style.paddingBottom = hgt;
      html.style.scrollPaddingBottom = hgt;
    } else {
      body.style.paddingBottom = '';
      html.style.scrollPaddingBottom = '';
    }
  }
  function syncMini() {
    const played = !!(store.get().simUi || {}).played;
    const show = !destroyed && played && !stageInView && !presenting;
    if (mini.hidden === !show) return;
    mini.hidden = !show;
    if (show) miniBar.firstChild.style.transform = `scaleX(${clamp01(ctx.year() / LAST).toFixed(4)})`;
    padForMini(show);
  }

  /**
   * After Play (the stage's own button): if the sticky header or step bar covers part of the scene, or the scene runs off
   * the bottom of the window, scroll so the whole scene sits just under them. On phones the step bar stops sticking while
   * the time-lapse plays (sim.css, .sim-page.is-stage-playing), so only the header counts there.
   */
  function keepSceneInView() {
    if (presenting || destroyed) return;
    // desktop layout: the stage scrolls inside its own column (views/sim.js .is-shell), not the page
    if (root.closest('.sim-page.is-shell')) {
      const col = root.closest('.sim-center');
      const cr = col?.getBoundingClientRect();
      const r = sceneWrap.getBoundingClientRect();
      if (col && (r.top < cr.top || r.bottom > cr.bottom)) col.scrollTo({ top: Math.max(0, col.scrollTop + r.top - cr.top - 4), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    let top = 0;
    for (const el of [document.querySelector('.site-header'), root.closest('.sim-page')?.querySelector('.sim-steps')]) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      if (cs.position !== 'sticky' && cs.position !== 'fixed') continue;
      top = Math.max(top, (parseFloat(cs.top) || 0) + el.offsetHeight);
    }
    const r = sceneWrap.getBoundingClientRect();
    if (r.top >= top - 1 && r.bottom <= window.innerHeight + 1) return;
    window.scrollBy({ top: r.top - top - 8, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  // --- pointer + keyboard on the track ---
  let dragging = false;
  const yearFromX = (clientX) => {
    const r = track.getBoundingClientRect();
    return Math.max(0, Math.min(LAST, ((clientX - r.left) / Math.max(1, r.width)) * LAST));
  };
  track.addEventListener('pointerdown', (e) => {
    dragging = true;
    track.setPointerCapture?.(e.pointerId);
    ctx.pause();
    ctx.setYear(yearFromX(e.clientX), { user: true });
    track.focus({ preventScroll: true });
  });
  track.addEventListener('pointermove', (e) => { if (dragging) ctx.setYear(yearFromX(e.clientX), { user: true }); });
  const endDrag = () => { if (dragging) { dragging = false; ctx.commitYear(); } };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('keydown', (e) => {
    const y = ctx.year();
    let n = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') n = Math.floor(y) + 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') n = Math.ceil(y) - 1;
    else if (e.key === 'PageUp') n = Math.floor(y) + 5;
    else if (e.key === 'PageDown') n = Math.ceil(y) - 5;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = LAST;
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); ctx.isPlaying() ? ctx.pause() : ctx.play(); return; }
    if (n == null) return;
    e.preventDefault();
    ctx.pause();
    ctx.setYear(Math.max(0, Math.min(LAST, n)), { user: true });
    ctx.commitYear();
  });

  // --- presentation mode: button or F toggles, Esc exits ---
  function setPresenting(on) {
    if (on === presenting) return;
    presenting = on;
    const page = root.closest('.sim-page');
    page?.classList.toggle('is-presenting', on);
    presentLabel.textContent = on ? t('sim.present.exit') : t('sim.present');
    presentBtn.classList.toggle('is-on', on);
    syncMini();
    announce(t(on ? 'sim.present.on' : 'sim.present.off'));
    if (on) {
      requestAnimationFrame(() => root.scrollIntoView({ behavior: 'auto', block: 'start' }));
    }
    lastCountersKey = '';
    renderCaption(true);
    renderYear(ctx.year(), true);
  }
  const onKey = (e) => {
    if (destroyed || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape' && presenting) { setPresenting(false); return; }
    if ((e.key === 'f' || e.key === 'F') && !isTyping(e.target) && !document.querySelector('.drawer.is-open')) {
      e.preventDefault();
      setPresenting(!presenting);
    }
  };
  document.addEventListener('keydown', onKey);

  // --- copy link ---
  function share() {
    const s = store.get();
    const url = ctx.share ? ctx.share() : location.href;
    shareInput.value = url;
    const okText = t(s.presetId ? 'sim.share.copiedProject' : 'sim.share.copied');
    const fallback = () => {
      shareInput.hidden = false;
      shareStatus.textContent = t('sim.share.fallback');
      try { shareInput.focus({ preventScroll: true }); shareInput.select(); } catch { /* ignore */ }
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => { shareInput.hidden = true; shareStatus.textContent = okText; }, fallback);
        return;
      }
    } catch { /* fall through */ }
    fallback();
  }

  // --- events ---
  let sim = null;
  let groups = [];
  /** Fractional year when the first hall opens (set with the structure). */
  let openAt = null;

  /** When the data centre opens: the first hall online, else meta.openYear, else the start of the operation phase. */
  function openedAt() {
    const m = sim?.meta || {};
    const on = Array.isArray(m.hallOnline) ? m.hallOnline.filter(Number.isFinite) : [];
    if (on.length) return Math.min(...on);
    if (Number.isFinite(m.openYear)) return m.openYear;
    return sim?.phases?.length ? operationStart(sim) : null;
  }
  /** When a running total starts growing: at the opening, and heat totals at the first heat to the network. */
  function seriesStart(k) {
    const o = Number.isFinite(openAt) ? openAt : 0;
    const hs = sim?.meta?.heatStartYear;
    return HEAT_KEYS.has(k) && Number.isFinite(hs) ? Math.max(o, hs) : o;
  }
  const townNum = (k) => {
    const v = sim?.meta?.town?.[k] ?? ctx.town()?.[k];
    return Number.isFinite(v) && v > 0 ? v : null;
  };

  let groupThr = 0.6;
  function groupEvents(events) {
    const w = track.clientWidth || 600;
    groupThr = Math.max(0.6, (30 / w) * LAST);
    const out = [];
    for (const e of events || []) {
      const g = out.find((x) => Math.abs(x.items[0].year - e.year) < groupThr);
      if (g) g.items.push(e); else out.push({ year: e.year, items: [e] });
    }
    return out;
  }

  function renderStructure(state, s) {
    sim = s;
    lastState = state;
    const phases = s?.phases || [];
    replace(phasesEl, ...phases.map((p) => h('span', {
      class: `tl__phase tl__phase--${p.key}`,
      style: { left: `${(p.start / LAST) * 100}%`, width: `${(Math.max(0, Math.min(LAST, p.end) - p.start) / LAST) * 100}%` },
    })));
    const seen = new Set();
    replace(legend, ...phases.filter((p) => { if (seen.has(p.key)) return false; seen.add(p.key); return true; }).map((p) => {
      const all = phases.filter((x) => x.key === p.key);
      const a = Math.min(...all.map((x) => x.start)); const b = Math.max(...all.map((x) => x.end));
      return h('li', { class: `tl__legend-item tl__legend-item--${p.key}` }, h('i', { 'aria-hidden': 'true' }),
        h('span', null, phaseLabel(p.key)), h('span', { class: 'muted' }, t('sim.phase.range', { a: fmtYear(a), b: fmtYear(Math.min(LAST, b)) })));
    }));
    // Pixel grouping is only for the markers; the caption works from the event years themselves.
    openAt = openedAt();
    groups = groupEvents(s?.events);
    replace(eventsEl, ...groups.map((g) => {
      const label = g.items.map((e) => `${t('sim.year', { y: fmtYear(e.year) })}: ${L(e.title)}`).join('; ');
      const b = h('button', {
        type: 'button', class: 'tl__event', style: { left: `${(Math.min(LAST, g.year) / LAST) * 100}%` }, 'aria-label': label, title: label,
        onclick: () => { ctx.pause(); ctx.setYear(g.year, { user: true }); ctx.commitYear(); renderCaption(true); },
      }, h('span', { class: 'tl__diamond', 'aria-hidden': 'true' }));
      g.btn = b;
      return b;
    }));
    lastCaptionKey = '';
    lastRecapKey = '';
  }

  // --- what is happening now ---
  /** The events at the latest event year ≤ y (several can share a year), while that year is less than 1,5 years ago. */
  function eventsNow(y) {
    const evs = sim?.events || [];
    let last = null;
    for (const e of evs) if (e.year <= y + 1e-3) last = e.year;
    if (last == null || y - last >= 1.5) return [];
    return evs.filter((e) => Math.abs(e.year - last) < 1e-6);
  }
  const nextEvent = (y) => (sim?.events || []).find((e) => e.year > y + 1e-3) || null;
  /** Key of the latest event with year ≤ y and less than a year ago (for the scene's event moments). */
  function eventKeyAt(y) {
    let key = null;
    for (const e of sim?.events || []) if (e.year <= y + 1e-3 && y - e.year < 1) key = e.key || null;
    return key;
  }

  /**
   * Running total of a cumulative series at a fractional year. The model's totals run through the end of each year; within
   * a year the total grows only from the moment the series starts (the opening, the first heat), so nothing is counted
   * while the site is still being built.
   */
  function cumAt(k, y) {
    const s = sim?.cumulative?.[k];
    if (!s?.typ) return null;
    const start = seriesStart(k);
    if (y < start) return { low: 0, typ: 0, high: 0 };
    const i = Math.max(0, Math.min(LAST, Math.floor(y)));
    const a = Math.max(i, start);
    const f = y <= a ? 0 : Math.min(1, (y - a) / Math.max(1e-6, i + 1 - a));
    const pick = (arr) => {
      const prev = i > 0 ? num(arr?.[i - 1]) : 0;
      const cur = num(arr?.[i]);
      return prev + f * (cur - prev);
    };
    return { low: pick(s.low || s.typ), typ: pick(s.typ), high: pick(s.high || s.typ) };
  }

  /**
   * Heat to the network in year yi (null: once fully running) as homes' yearly heat: { homes, pct } where pct is the share
   * of the town's homes (null when the number of households is unknown). Uses the model's own "homes" comparison (the same
   * draws as the result card), scaled to the year; falls back to the heat-per-home coefficient.
   */
  function heatHomes(yi) {
    const hu = sim?.metrics?.heatUsed;
    const hd = hu?.headline;
    if (!hu || !hd) return null;
    const v = yi == null ? hd : valueAt(hu, yi);
    if (!(v?.high > 0)) return null;
    const c = comparison(hu, 'homes');
    const sum = (o) => num(o.low) + num(o.typ) + num(o.high);
    let lo; let hi;
    if (c && Number.isFinite(c.low) && Number.isFinite(c.high) && sum(hd) > 0) {
      const f = yi == null ? 1 : sum(v) / sum(hd);
      lo = c.low * f; hi = c.high * f;
    } else {
      const per = heatPerHomeMWh();
      lo = (v.low * 1000) / per; hi = (v.high * 1000) / per;
    }
    const hh = townNum('households');
    return { homes: { low: lo, high: hi }, pct: hh ? { low: (lo / hh) * 100, high: (hi / hh) * 100 } : null };
  }

  /** "14–25 % kunnan kotien lämmöstä tänä vuonna" (now) or "… joka vuosi, kun datakeskus on täysin käytössä" (recap). */
  function heatComp(yi, final) {
    const hs = heatHomes(final ? null : yi);
    if (!hs) return '';
    let share;
    if (!hs.pct) {
      const n = rangeText(hs.homes.low, hs.homes.high);
      share = L({ fi: `${n} kodin lämpö`, en: `the heat of ${n} homes` });
    } else if (hs.pct.low >= 100) {
      share = L({ fi: 'enemmän lämpöä kuin kunnan kodit tarvitsevat', en: 'more heat than all the town’s homes use' });
    } else {
      // above 100 % the rest goes to other buildings on the network: the share of homes stops at 100 %
      const p = pctText(hs.pct.low, Math.min(100, hs.pct.high));
      share = L({ fi: `${p} kunnan kotien lämmöstä`, en: `${p} of the town’s home heating` });
    }
    return final
      ? L({ fi: `≈ ${share} joka vuosi täydellä teholla`, en: `≈ ${share} every year at full capacity` })
      : L({ fi: `≈ ${share} tänä vuonna`, en: `≈ ${share} this year` });
  }

  /** Property tax so far per resident: "≈ 40–80 € asukasta kohden". */
  function taxPerResident(tx) {
    const pop = townNum('population');
    if (!pop || tx.high / pop < 1) return ''; // not yet a euro each: no comparison
    const v = fmtEurRange(tx.low / pop, tx.high / pop);
    return L({ fi: `≈ ${v} asukasta kohden`, en: `≈ ${v} per resident` });
  }

  /** Once fully running, the yearly property tax against the town's current property-tax income (no fractional years). */
  function taxYearly() {
    const hd = sim?.metrics?.propertyTax?.headline;
    const rev = townNum('revenue');
    if (!hd || !rev || !(hd.high > 0)) return '';
    if ((num(hd.typ) / rev) * 100 >= 200) {
      const x = rangeText(hd.low / rev, hd.high / rev);
      return L({ fi: `≈ ${x} kertaa kunnan nykyiset kiinteistöverotulot joka vuosi täydellä teholla`, en: `≈ ${x} times the town’s current property-tax income every year at full capacity` });
    }
    const p = pctText((hd.low / rev) * 100, (hd.high / rev) * 100);
    return L({ fi: `≈ ${p} lisää kunnan kiinteistöverotuloihin joka vuosi täydellä teholla`, en: `≈ ${p} on top of the town’s property-tax income every year at full capacity` });
  }

  /**
   * Up to three running totals in the current language: { name, amount, comp?, comp2? } ("Lämpöä kaukolämpöön",
   * "noin 130–160 GWh", "≈ 14–25 % kunnan kotien lämmöstä tänä vuonna"). `final` gives the recap's wording (year 30).
   * Electricity and heat are guess targets, so they wait for the reveal. Nothing counts before the opening.
   */
  function counterParts(y, final = false) {
    if (!sim?.cumulative) return [];
    const meta = sim.meta || {};
    const out = [];
    const revealed = ctx.revealed();
    const yi = Math.max(0, Math.min(LAST - 1, Math.floor(y)));
    const el = cumAt('electricity', y);
    if (revealed && el && el.high > 0) {
      out.push({ name: t('sim.count.electricity'), amount: t('sim.count.about', { v: energyText(el.low, el.high) }) });
      if (meta.heatReuseOn) {
        const hu = cumAt('heatUsed', y);
        if (hu && hu.high > 0) out.push({ name: t('sim.count.heat'), amount: t('sim.count.about', { v: energyText(hu.low, hu.high) }), comp: heatComp(yi, final) });
      } else if (meta.heatReuseOn === false) {
        out.push({ name: t('sim.count.heatOff'), amount: t('sim.count.heatOffValue') });
      }
    }
    const tx = cumAt('propertyTax', y);
    if (tx && tx.high > 0) {
      out.push({ name: t('sim.count.tax'), amount: t('sim.count.about', { v: fmtEurRange(tx.low, tx.high) }), comp: taxPerResident(tx), comp2: final ? taxYearly() : '' });
    }
    return out.slice(0, 3);
  }
  /** Scene counters: the short amount as the value, the name and comparison as the (wrapping) label. */
  const toHud = (parts) => parts.map((p) => ({ label: p.comp ? `${p.name} ${p.comp}` : p.name, value: p.amount }));
  /** Text list: the name as the label, amount and comparison as the value. */
  const fullCounters = (parts) => parts.map((p) => ({ label: p.name, value: p.comp ? `${p.amount} ${p.comp}` : p.amount }));

  let lastCaptionKey = '';
  let lastRecapKey = '';
  let lastCountersKey = '';

  function renderCaption(force = false) {
    const y = ctx.year();
    const yi = Math.floor(y);
    const now = eventsNow(y);
    const next = nextEvent(y);
    const revealed = ctx.revealed();
    const key = `${yi}|${now[0]?.year ?? ''}|${next?.year ?? ''}|${store.get().lang}|${revealed ? 1 : 0}`;
    if (!force && key === lastCaptionKey) return;
    lastCaptionKey = key;
    const ph = phaseAt(sim?.phases, y);
    const m = sim?.metrics || {};
    let detail = '';
    if (ph.phase === 'planning') detail = t('sim.caption.planning');
    else if (ph.phase === 'construction') {
      const tr = valueAt(m.trucks, yi); const wk = valueAt(m.jobsConstruction, yi);
      detail = t('sim.caption.construction', { trucks: fmtRangeUnit(tr.low, tr.high, ''), workers: fmtRangeUnit(wk.low, wk.high, '') });
    } else if (revealed) {
      // electricity and heat are guess targets: their numbers wait until the guesses are revealed
      const el = valueAt(m.electricity, yi); const ht = valueAt(m.heatUsed, yi);
      detail = ht.typ > 0 && m.heatUsed
        ? t('sim.caption.operationHeat', { el: fmtRangeUnit(el.low, el.high, m.electricity?.unit), heat: fmtRangeUnit(ht.low, ht.high, m.heatUsed?.unit) })
        : m.electricity ? t('sim.caption.operation', { el: fmtRangeUnit(el.low, el.high, m.electricity?.unit) }) : '';
    }
    replace(capMain, h('strong', null, `${townName(ctx.town())} · ${t('sim.year', { y: yi })} · ${phaseLabel(ph.phase)}`), detail ? `: ${detail}` : '');
    if (now.length) {
      capEvent.hidden = false;
      replace(capEvent, h('span', { class: 'tl__diamond tl__diamond--inline', 'aria-hidden': 'true' }),
        ...now.map((e, i) => [i ? ' · ' : '', h('strong', null, L(e.title)), e.text && i === now.length - 1 ? ` – ${L(e.text)}` : '']).flat());
    } else {
      capEvent.hidden = true;
      replace(capEvent);
    }
    capNext.hidden = !next;
    capNext.textContent = next ? t('sim.caption.next', { title: L(next.title), y: fmtYear(next.year) }) : '';
    const nowSet = new Set(now);
    for (const g of groups) g.btn?.classList.toggle('is-current', g.items.some((e) => nowSet.has(e)));
  }

  /** Recap card at the end of the 30 years (not in a preview). */
  function renderRecap(y) {
    const show = !!sim && y >= LAST - 1e-6 && !ctx.isPreview();
    const key = show ? `${store.get().lang}|${ctx.revealed() ? 1 : 0}|${sim.meta?.design?.sizeMW}` : 'off';
    if (key === lastRecapKey) return;
    lastRecapKey = key;
    recap.hidden = !show;
    root.classList.toggle('has-recap', show);
    if (show) {
      replace(recapList, ...counterParts(LAST, true).map((p) => h('li', { class: 'sim-recap__item' },
        h('span', { class: 'sim-recap__label' }, p.name),
        h('span', { class: 'sim-recap__value' }, p.amount),
        ...[p.comp, p.comp2].filter(Boolean).map((c) => h('span', { class: 'sim-recap__comp' }, c)))));
    }
  }

  function sceneState(y, counters) {
    const st = store.get();
    const town = ctx.town();
    const ph = phaseAt(sim?.phases, y);
    const yi = Math.floor(y);
    const m = sim?.metrics || {};
    const meta = sim?.meta || {};
    const des = st.design || {};
    const workers = ph.phase === 'construction' ? valueAt(m.jobsConstruction, yi).typ : ph.phase === 'operation' ? valueAt(m.jobsPermanent, yi).typ : 0;
    const dhStatus = meta.town?.dhStatus;
    const metaKnown = typeof meta.heatReuseOn === 'boolean';
    const heatReuse = metaKnown ? meta.heatReuseOn : !!des.heatReuse && hasDH(town);
    const hasDistrictHeat = metaKnown ? (meta.heatReuseOn || (dhStatus ? dhStatus !== 'notInStats' : hasDH(town))) : hasDH(town);
    const demand = meta.town?.demandGWh;
    const open = !Number.isFinite(openAt) || y >= openAt;
    // a real project that has not published its use of waste heat (preset.assumedKeys, C1): the scene marks 'heat to the air' as an assumption
    const pre = st.presetId && typeof projectsMod.projectById === 'function' ? projectsMod.projectById(st.presetId)?.preset : null;
    const heatAssumed = Array.isArray(pre?.assumedKeys) && pre.assumedKeys.includes('heatReuse');
    const out = {
      year: y, phase: ph.phase, phaseProgress: ph.progress,
      sizeMW: des.sizeMW, cooling: des.cooling, heatReuse, hasDistrictHeat,
      site: des.site, distanceM: des.distanceM, townSize: townSize(town),
      season: ((y % 1) + 1) % 1,
      trucksPerDay: valueAt(m.trucks, yi).typ, workers,
      lang: st.lang, reducedMotion: mqReduce ? mqReduce.matches : prefersReducedMotion(), highlight: ctx.highlight(),
      townName: townName(town),
      eventKey: eventKeyAt(y),
      heatHomesShare: open && heatReuse && Number.isFinite(demand) && demand > 0 ? clamp01(valueAt(m.heatUsed, yi).typ / demand) : 0,
      staff: open ? valueAt(m.jobsPermanent, yi).typ : 0,
      counters,
      presentation: presenting,
      playing: ctx.isPlaying(),
      // C4: the town's own scale and the opening time (the scene falls back to townSize when these are missing)
      town: { population: townNum('population'), households: townNum('households') },
      openedAt: Number.isFinite(openAt) ? openAt : null,
      // a phone-sized scene: at most two labels at a time (honoured by the scene when it supports it)
      maxLabels: small ? 2 : null,
      heatAssumed,
    };
    if (dhStatus) out.dhStatus = dhStatus;
    if (meta.halls) out.halls = meta.halls;
    if (Array.isArray(meta.hallBuild) && meta.hallBuild.length) {
      out.hallStates = meta.hallBuild.map((b) => clamp01((y - b.start) / Math.max(1e-6, b.end - b.start)));
    }
    return out;
  }

  let lastTextAt = -1e9;
  let trackW = 0;
  /** The scene's counters (same array until the text changes, so the scene's HUD is not rebuilt every frame). */
  let hud = [];
  const mqReduce = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  /**
   * Called every animation frame while playing, and on any change while paused. Each frame moves the scene and the year
   * marker; the text (badge, read-outs, caption, totals, recap) follows at most every TEXT_MS while playing, at once
   * otherwise (scrubbing, pause, the end).
   */
  function renderYear(y, force = false) {
    placeMarker(y);
    const now = performance.now();
    if (force || !ctx.isPlaying() || now - lastTextAt >= TEXT_MS) {
      lastTextAt = now;
      renderText(y);
    }
    if (scene) {
      try { scene.update(sceneState(y, hud)); } catch (err) { console.error('scene.update failed', err); scene = null; }
    }
  }

  /** The year marker: thumb and progress move with transforms only (no layout per frame). */
  function placeMarker(y) {
    const f = clamp01(y / LAST);
    if (!trackW) trackW = track.clientWidth;
    thumb.style.transform = `translate(${(f * trackW).toFixed(1)}px, -50%) translateX(-50%)`;
    progress.style.transform = `scaleX(${f.toFixed(4)})`;
  }

  function renderText(y) {
    const yi = Math.floor(y);
    const ph = phaseAt(sim?.phases, y);
    setAttr(track, 'aria-valuenow', String(Math.round(y * 10) / 10));
    setAttr(track, 'aria-valuetext', t('sim.timeline.value', { y: yi, phase: phaseLabel(ph.phase) }));
    const yearText = t('sim.year', { y: yi });
    setText(badgeYear, yearText);
    setText(badgePhase, `${phaseLabel(ph.phase)} · ${seasonLabel(y)}`);
    setText(yearOut, `${yearText} / ${LAST}`);
    setText(miniText, `${yearText} · ${phaseLabel(ph.phase)}`);
    if (!mini.hidden) miniBar.firstChild.style.transform = `scaleX(${clamp01(y / LAST).toFixed(4)})`;
    if (!capPreview.hidden && !ctx.isPreview()) capPreview.hidden = true; // the user scrubbed: no longer a preview
    renderCaption();
    renderRecap(y);
    const parts = counterParts(y);
    const ck = JSON.stringify(parts);
    if (ck !== lastCountersKey) {
      lastCountersKey = ck;
      replace(capCounters, ...fullCounters(parts).map((c) => h('li', { class: 'sim-counters__item' },
        h('span', { class: 'sim-counters__label' }, `${c.label}: `), h('span', { class: 'sim-counters__value' }, c.value))));
      // On a narrower stage and in presentation mode the totals are text beside or under the scene, so the picture stays uncovered.
      hud = narrow || presenting ? [] : toHud(parts);
    }
  }

  function setPlaying(on) {
    // The visible label switches Toista / Tauko (no aria-pressed); data-fk keeps focus if the content is rebuilt.
    withFocus(root, () => replace(playBtn, icon(on ? 'pause' : 'play', { size: 24 }), h('span', { class: 'sim-play__label' }, on ? t('sim.pause') : t('sim.play'))));
    withFocus(mini, () => replace(miniPlay, icon(on ? 'pause' : 'play', { size: 20 }), h('span', { class: 'sr-only' }, on ? t('sim.pause') : t('sim.play'))));
    root.classList.toggle('is-playing', on);
    // the page knows the time-lapse is playing: on phones the step bar then stops sticking over the scene (sim.css)
    root.closest('.sim-page')?.classList.toggle('is-stage-playing', on);
  }

  function update(state, s, { structural }) {
    if (structural) renderStructure(state, s);
    speedSeg.set(state.speed || 2);
    const ui = state.simUi || {};
    capPreview.hidden = !!ui.played || !ctx.isPreview();
    if (!capPreview.hidden) capPreview.textContent = t('sim.preview', { y: Math.floor(ctx.year()) });
    if (structural) { shareInput.hidden = true; shareStatus.textContent = ''; }
    setNarrow();
    lastRecapKey = '';
    lastCountersKey = '';
    renderCaption(true);
    renderYear(ctx.year(), true);
    syncMini();
  }

  setPlaying(false);
  document.body.append(mini);

  return {
    el: root, update, renderYear, setPlaying,
    isPresenting: () => presenting,
    destroy() {
      destroyed = true;
      document.removeEventListener('keydown', onKey);
      root.closest('.sim-page')?.classList.remove('is-presenting', 'is-stage-playing');
      io?.disconnect();
      ro?.disconnect();
      padForMini(false);
      mini.remove();
      try { scene?.destroy(); } catch { /* ignore */ }
    },
  };
}
