// The living town scene (SPEC §7): a side view of a small Finnish town and the data-centre plot,
// drawn on a Canvas 2D at devicePixelRatio. createScene(container) → { update(state), destroy() }.
//
// Layers (src/ui/scene/*): sky + season → far landscape → site land → town → plot + data centre →
// effects (power line, heat pipe, water, traffic, noise) → event moments → highlight spotlight → labels.
// Static layers (sky for the season; land, town, plot, road, trees) are cached in offscreen canvases and rebuilt only
// when the picture's inputs change: at once for design / phase / size / theme changes, and at most every ~150 ms (longer
// on a slow device) for the inputs that drift while the timeline plays (season, build progress, cars, heated homes).
// The labels are a cached layer too. Moving parts (fans, plume, trucks, heat dots, crane, snow, clouds) are drawn every
// frame; when frames take over ~33 ms the animation is capped at about 30 fps.
// A DOM overlay (top-left) holds the phase chip and up to three counters (state.counters); state.presentation
// scales the chip, counters and labels ×1.4 and hides minor labels.
// The loop pauses when the tab is hidden or the scene is off-screen, and stops when the timeline is paused
// (state.playing === false) and no update has come for 5 s (WCAG 2.2.2); the next update() restarts it.
// Reduced motion = one still frame per state.
import { h } from './dom.js';
import { readPalette } from './scene/colors.js';
import { normalize, computeLayout, PUBLIC_EVENTS } from './scene/layout.js';
import { seasonInfo, clamp, smooth } from './scene/util.js';
import { drawSkyStatic, drawAurora, drawClouds, drawSnowfall, drawBirds } from './scene/sky.js';
import { drawFarLand, drawSiteLand, drawRoad } from './scene/land.js';
import { townPlan, drawTownBack, drawTownFront, drawTownSmoke } from './scene/town.js';
import { drawPlotStatic, drawPlotDynamic, drawPlotAir, carCount } from './scene/datacentre.js';
import {
  powerGeometry, drawPowerStatic, drawPowerPlanned, drawPowerFlow, heatPipeGeometry, drawHeatPipeStatic, drawHeatFlow,
  drawHeatPulse, waterGeometry, drawWaterStatic, drawWaterFlow, drawTraffic, drawNoise, drawDistance,
  drawRefreshTruck, drawPublicEvent,
} from './scene/effects.js';
import { regions, highlightTarget, drawSpotlight, collectLabels, drawLabels, distanceLabel } from './scene/labels.js';
import { TXT, tr, ariaSummary } from './scene/text.js';

const STILL_T = 3.3;   // the moment shown when motion is reduced
const IDLE_MS = 5000;  // paused timeline + no update for this long → the ambient animation stops
const HUD_INSET = 8;   // .scene__hud top / left in scene.css
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function createScene(container, options = {}) {
  const showLabels = options.labels !== false;
  const canvas = h('canvas', { class: 'scene__canvas', 'aria-hidden': 'true' });
  const chip = h('div', { class: 'scene__chip' });
  const counters = h('ul', { class: 'scene__counters' });
  const hud = h('div', { class: 'scene__hud', 'aria-hidden': 'true' }, chip, counters);
  const note = h('div', { class: 'scene__note', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'scene__stage' }, canvas, hud, note);
  const root = h('div', { class: 'scene', role: 'img', 'aria-label': '' }, stage);
  container.append(root);
  const ctx = canvas.getContext('2d');

  const mqReduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const mqDark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  let P = readPalette();
  let paletteVersion = 0;
  let raw = {};
  let st = normalize(raw, !!mqReduce?.matches);
  let size = { w: 0, h: 0, dpr: 1 };
  let visible = true;
  let destroyed = false;
  let running = false;
  let idle = false;
  let lastUpdateAt = 0;
  let rafId = 0;
  let pendingDraw = 0;
  let clock = 0;
  let lastTs = 0;
  let geomDirty = true;
  let geomKey = '';
  let G = null;
  // cached static layers: 'hard' inputs (design, phase, size, theme) rebuild them at once; 'soft' ones that drift
  // while the timeline plays (season, build progress, cars, heated homes) at most every softGap() ms
  let cache = { hard: '', soft: '', at: -1e9, sky: null, world: null };
  let labelLayer = { key: '', canvas: null };
  let genPuffUntil = -10;   // far in the past, so the first new year of operation always gets its test run
  let lastOpYear = null;
  let evStart = 0;
  let hudBox = null;
  // frame pacing: moving averages of the scene's own drawing time and of the time between animation frames;
  // when frames take over ~33 ms (or the scene alone is costly) the animation is capped at about 30 fps
  const perf = { renderMs: 0, intervalMs: 16.7, frames: 0, capped: false, fastSince: 0, lastRaf: 0, rebuilds: 0, rebuildMs: 0 };

  /* ---------- geometry ---------- */

  const q = (v, n) => Math.round(v * n);

  /** Everything the layout, the town plan and the highlight regions depend on (not the season or the year). */
  function geometryKey() {
    return [size.w, size.h, paletteVersion, st.phase, q(st.phaseProgress, 48), st.sizeMW, st.cooling, st.heatReuse,
      st.hasDistrictHeat, st.site, Math.round(st.distanceM), st.townKind, st.highlight, st.halls || '',
      st.hallStates ? st.hallStates.map((v) => q(v, 48)).join(',') : '', carCount(st) ?? '',
      st.heatHomesShare == null ? '' : q(st.heatHomesShare, 60)].join('|');
  }

  function buildGeometry() {
    const L = computeLayout(st, size.w, size.h);
    const S = seasonInfo(st.season);
    const plan = townPlan(L, st);
    const power = powerGeometry(L);
    const pipe = st.phase === 'operation' && st.heatReuse ? heatPipeGeometry(L, plan) : null;
    const water = st.phase === 'operation' && st.cooling === 'evaporative' ? waterGeometry(L, plan) : null;
    G = { L, S, P, st, plan, power, pipe, water, genPuff: 0 };
    G.R = regions(G);
    G.hl = highlightTarget(st);
    geomDirty = false;
    geomKey = geometryKey();
  }

  function cacheSigs() {
    return {
      hard: [size.w, size.h, size.dpr, paletteVersion, st.phase, st.sizeMW, st.cooling, st.heatReuse, st.hasDistrictHeat,
        st.site, Math.round(st.distanceM), st.townKind, G.hl, st.halls || ''].join('|'),
      soft: [q(G.S.s, 96), q(st.phaseProgress, 48), st.hallStates ? st.hallStates.map((v) => q(v, 48)).join(',') : '',
        carCount(st) ?? '', G.plan.warmOn ? q(st.heatHomesShare, 60) : ''].join('|'),
    };
  }

  /** Minimum time between rebuilds for drifting inputs while the timeline plays (longer on a slow device). */
  const softGap = () => Math.max(150, perf.rebuildMs * 10);

  function makeLayer() {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(size.w * size.dpr));
    c.height = Math.max(1, Math.round(size.h * size.dpr));
    return c;
  }

  function worldTransform(c) {
    const { L } = G;
    const k = L.k * size.dpr;
    c.setTransform(k, 0, 0, k, -L.view.x0 * k, 0);
  }

  function rebuildCaches(sig) {
    const t0 = now();
    const { L, S, plan, power, pipe, water, hl } = G;
    const sky = cache.sky && cache.sky.width === Math.round(size.w * size.dpr) && cache.sky.height === Math.round(size.h * size.dpr) ? cache.sky : makeLayer();
    const world = cache.world && cache.world.width === sky.width && cache.world.height === sky.height ? cache.world : makeLayer();
    const a = sky.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0);
    a.clearRect(0, 0, sky.width, sky.height);
    worldTransform(a);
    drawSkyStatic(a, L, P, S);

    const b = world.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, world.width, world.height);
    worldTransform(b);
    drawFarLand(b, L, P, S);
    drawSiteLand(b, L, P, S, st, 'back');
    drawTownBack(b, L, P, S, plan);
    if (st.phase === 'planning') drawPowerPlanned(b, L, P, power);
    else drawPowerStatic(b, L, P, S, st, power, st.phase === 'operation' || st.phaseProgress > 0.6);
    b.save();
    b.translate(L.plot.x, L.plot.y);
    b.scale(L.plot.s, L.plot.s);
    drawPlotStatic(b, L, P, S, st);
    b.restore();
    if (water) drawWaterStatic(b, P, water, hl === 'water');
    drawRoad(b, L, P, S, st);
    drawTownFront(b, L, P, S, plan);
    if (pipe) drawHeatPipeStatic(b, P, pipe, hl === 'heat');
    drawDistance(b, L, P, plan.homeRight);
    drawSiteLand(b, L, P, S, st, 'front');
    const ms = now() - t0;
    perf.rebuilds++;
    perf.rebuildMs = perf.rebuildMs ? perf.rebuildMs * 0.7 + ms * 0.3 : ms;
    cache = { ...sig, at: now(), sky, world };
  }

  /* ---------- HUD (chip + counters) ---------- */

  /**
   * Box of the chip + counters (stage pixels), so canvas labels keep clear of them. Kept up to date by a
   * ResizeObserver, which reports after layout: reading it never forces a layout in the middle of a frame.
   */
  function readHud(entries) {
    // the observer's own sizes (no layout read); the HUD sits HUD_INSET px from the top-left corner (scene.css)
    const e = entries && entries[entries.length - 1];
    const bs = e && e.borderBoxSize && (e.borderBoxSize[0] || e.borderBoxSize);
    const w = bs ? bs.inlineSize : hud.offsetWidth, hh = bs ? bs.blockSize : hud.offsetHeight;
    const next = w && hh && (chip.textContent || counters.childElementCount)
      ? { x: HUD_INSET - 2, y: HUD_INSET - 2, w: Math.round(w) + 4, h: Math.round(hh) + 4 } : null;
    if (JSON.stringify(next) !== JSON.stringify(hudBox)) {
      hudBox = next;
      if (!running) requestStill();
    }
  }
  const hudRo = typeof ResizeObserver === 'function' ? new ResizeObserver(readHud) : null;
  hudRo?.observe(hud);

  let lastCounters = '';
  function renderCounters(list) {
    const key = JSON.stringify(list);
    if (key === lastCounters) return;
    lastCounters = key;
    counters.replaceChildren(...list.map((c) => h('li', { class: 'scene__counter' },
      h('span', { class: 'scene__counter-label' }, c.label),
      h('span', { class: 'scene__counter-value' }, c.value))));
  }

  /* ---------- labels (cached layer) ---------- */

  /** Labels change far less often than the picture moves: they are laid out and drawn into a layer only on change. */
  function drawLabelLayer(hl, ev, noFade) {
    const compact = size.w < 600;   // narrow stage: at most two labels, never over the building, events fade
    let labels = collectLabels(G, hl, G.R);
    if (compact && ev && !noFade) {
      const a = 1 - smooth(1.7, 2.3, ev.age);
      for (const l of labels) if (l.id === 'event' || l.fork) l.alpha = a;
      labels = labels.filter((l) => !(l.alpha <= 0.02));   // a faded label frees its place for the next one
    }
    const dist = distanceLabel(G);
    const r = (v) => Math.round(v * 4);
    const key = JSON.stringify([labels.map((l) => [l.id, l.text, r(l.x), r(l.y), l.prio, l.below ? 1 : 0, l.alpha == null ? 16 : Math.round(l.alpha * 16)]),
      dist ? [dist.text, r(dist.x), r(dist.y)] : 0, hudBox, size.w, size.h, size.dpr, paletteVersion, st.presentation, st.lang, r(G.L.view.x0), r(G.L.k)]);
    let c = labelLayer.canvas;
    if (!c || c.width !== canvas.width || c.height !== canvas.height) { c = labelLayer.canvas = makeLayer(); labelLayer.key = ''; }
    if (key !== labelLayer.key) {
      const lc = c.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.clearRect(0, 0, c.width, c.height);
      lc.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      drawLabels(lc, G, labels, dist, { avoid: hudBox ? [hudBox] : [], compact });
      labelLayer.key = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(c, 0, 0);
  }

  /* ---------- frame ---------- */

  function render(t, settle = false) {
    if (destroyed || size.w < 10 || size.h < 10) return;
    if (geomDirty || !G) buildGeometry();
    const sig = cacheSigs();
    if (sig.hard !== cache.hard || (sig.soft !== cache.soft && (!running || st.playing !== true || now() - cache.at >= softGap()))) rebuildCaches(sig);
    const { L, S, plan, power, pipe, water, hl } = G;
    const still = st.reducedMotion || settle;
    const ev = st.eventKey ? { key: st.eventKey, age: Math.max(0, t - evStart), still } : null;

    // generator test run once a year (and always visible when backup power is highlighted)
    let genPuff = st.reducedMotion ? 0 : clamp((genPuffUntil - clock) / 0.8, 0, 1);
    if (hl === 'gens' && st.phase === 'operation') genPuff = Math.max(genPuff, 0.85);
    G.genPuff = genPuff;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache.sky, 0, 0);
    worldTransform(ctx);
    drawAurora(ctx, L, P, S, t);
    drawClouds(ctx, L, P, S, t);
    drawBirds(ctx, L, P, S, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cache.world, 0, 0);
    worldTransform(ctx);

    const heatShare = pipe ? 0.4 + 0.6 * S.w : 0;
    drawTownSmoke(ctx, L, P, S, plan, t, heatShare);
    ctx.save();
    ctx.translate(L.plot.x, L.plot.y);
    ctx.scale(L.plot.s, L.plot.s);
    drawPlotDynamic(ctx, L, P, S, st, t, ev);
    ctx.restore();
    drawPlotAir(ctx, L, P, S, st, t, { water: hl === 'water', genPuff });
    if (st.phase === 'operation') drawPowerFlow(ctx, L, P, power, t, hl === 'power');
    if (pipe) drawHeatFlow(ctx, P, pipe, t, 0.15 + 0.85 * S.w, hl === 'heat');
    if (pipe && ev && ev.key === 'heatFirst') drawHeatPulse(ctx, P, pipe, ev.age, still);
    if (water) drawWaterFlow(ctx, P, water, t, hl === 'water');
    drawTraffic(ctx, L, P, st, t, hl === 'road');
    if (ev && ev.key === 'refresh' && st.phase === 'operation') drawRefreshTruck(ctx, L, P, ev.age, still);
    if (ev && PUBLIC_EVENTS.includes(ev.key)) drawPublicEvent(ctx, L, P, S, plan, t, still);
    if (hl === 'noise') drawNoise(ctx, L, P, st, t, true);
    drawSnowfall(ctx, L, P, S, t);

    if (hl && G.R[hl]) {
      const hue = { power: P.cEnergy, heat: P.cHeat, water: P.cWater, noise: P.ink2, site: P.cFuture, workers: P.cJobs, staff: P.cJobs, hall: P.accent, road: P.cTraffic, land: P.cLand, gens: P.cSafety }[hl] || P.accent;
      drawSpotlight(ctx, L, P, G.R[hl], hue, t, still);
      // redraw the emphasised moving parts on top of the dimmed picture
      if (hl === 'noise') drawNoise(ctx, L, P, st, t, true);
      if (hl === 'heat' && pipe) { drawHeatPipeStatic(ctx, P, pipe, true); drawHeatFlow(ctx, P, pipe, t, 0.15 + 0.85 * S.w, true); }
      if (hl === 'water' && water) { drawWaterStatic(ctx, P, water, true); drawWaterFlow(ctx, P, water, t, true); }
      if (hl === 'power' && st.phase === 'operation') drawPowerFlow(ctx, L, P, power, t, true);
      if (hl === 'road') drawTraffic(ctx, L, P, st, t, true);
    }

    if (showLabels) drawLabelLayer(hl, ev, st.reducedMotion);   // (a settled still frame keeps the faded state)
  }

  /* ---------- loop control ---------- */

  /** Cap at ~30 fps when the page's frames take over ~33 ms or the scene alone costs more than ~9 ms a frame;
   *  lift the cap after 3 s of quick frames. */
  function pace(ts) {
    if (perf.lastRaf) perf.intervalMs = perf.intervalMs * 0.92 + Math.min(250, ts - perf.lastRaf) * 0.08;
    perf.lastRaf = ts;
    if (++perf.frames < 20) return;
    const slow = perf.intervalMs > 33 || perf.renderMs > 9;
    if (!perf.capped && slow) { perf.capped = true; perf.fastSince = 0; }
    else if (perf.capped) {
      const fast = perf.intervalMs < 20 && perf.renderMs < 4;
      if (!fast) perf.fastSince = 0;
      else if (!perf.fastSince) perf.fastSince = ts;
      else if (ts - perf.fastSince > 3000) perf.capped = false;
    }
  }

  function loop(ts) {
    if (!running) return;
    pace(ts);
    // capped: skip this animation frame if the last drawn one was less than ~30 ms ago
    if (perf.capped && lastTs && ts - lastTs < 30) { rafId = requestAnimationFrame(loop); return; }
    const dt = lastTs ? Math.min(0.1, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    clock += dt;
    // paused timeline and nothing new for a while: settle on a still frame and stop (WCAG 2.2.2)
    if (st.playing === false && now() - lastUpdateAt > IDLE_MS) {
      idle = true;
      running = false;
      render(clock, true);
      return;
    }
    const t0 = now();
    render(clock);
    const ms = now() - t0;
    perf.renderMs = perf.renderMs ? perf.renderMs * 0.9 + ms * 0.1 : ms;
    rafId = requestAnimationFrame(loop);
  }

  function shouldRun() {
    return !destroyed && visible && !document.hidden && !st.reducedMotion && !idle && size.w > 0;
  }

  function sync() {
    if (shouldRun()) {
      if (!running) { running = true; lastTs = 0; rafId = requestAnimationFrame(loop); }
    } else {
      if (running) { running = false; cancelAnimationFrame(rafId); }
      requestStill();
    }
  }

  function requestStill() {
    if (pendingDraw || destroyed) return;
    pendingDraw = requestAnimationFrame(() => {
      pendingDraw = 0;
      if (!running) render(st.reducedMotion ? STILL_T : clock, idle);
    });
  }

  /* ---------- observers ---------- */

  function resize(w, hgt) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.round(w); hgt = Math.round(hgt);
    if (w === size.w && hgt === size.h && dpr === size.dpr) return;
    size = { w, h: hgt, dpr };
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(hgt * dpr));
    geomDirty = true;
    cache.hard = '';
    sync();
    if (!running) render(st.reducedMotion ? STILL_T : clock, idle);
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver((entries) => {
    const r = entries[0].contentRect;
    resize(r.width, r.height);
  }) : null;
  ro?.observe(stage);

  const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    sync();
  }) : null;
  io?.observe(root);

  const onVisibility = () => sync();
  document.addEventListener('visibilitychange', onVisibility);

  const onTheme = () => {
    P = readPalette();
    paletteVersion++;
    geomDirty = true;
    if (!running) requestStill();
  };
  mqDark?.addEventListener?.('change', onTheme);
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(onTheme) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  const onReduce = () => { if (raw.reducedMotion == null) update(raw); };
  mqReduce?.addEventListener?.('change', onReduce);
  document.fonts?.ready?.then(() => { if (!destroyed) { cache.hard = ''; labelLayer.key = ''; if (!running) requestStill(); } });

  // initial size (ResizeObserver also fires once on observe)
  const rect = stage.getBoundingClientRect();
  if (rect.width) resize(rect.width, rect.height);

  /* ---------- API ---------- */

  let lastAria = '';
  function update(state = {}) {
    if (destroyed) return;
    raw = state || {};
    const next = normalize(raw, !!mqReduce?.matches);
    // a generator test puff each new year of operation
    const yInt = Math.floor(next.year);
    if (next.phase === 'operation') {
      if (lastOpYear !== null && yInt !== lastOpYear && clock - genPuffUntil > 4) genPuffUntil = clock + 2;
      lastOpYear = yInt;
    } else lastOpYear = null;
    if (next.eventKey !== st.eventKey) evStart = clock;
    st = next;
    // most updates while playing only move the year and the season: keep the layout and the town plan then
    if (G && !geomDirty && geometryKey() === geomKey) { G.st = st; G.S = seasonInfo(st.season); G.hl = highlightTarget(st); }
    else geomDirty = true;
    lastUpdateAt = now();
    idle = false;
    const S = seasonInfo(st.season);
    const aria = ariaSummary(st, S);
    if (aria !== lastAria) { root.setAttribute('aria-label', aria); lastAria = aria; }
    root.lang = st.lang;
    const chipText = `${tr(TXT.phase[st.phase], st.lang)} · ${tr(TXT.season[S.name], st.lang)}`;
    if (chip.textContent !== chipText) chip.textContent = chipText;
    chip.dataset.phase = st.phase;
    renderCounters(st.counters);
    if (root.classList.contains('scene--presentation') !== st.presentation) root.classList.toggle('scene--presentation', st.presentation);
    const noteText = tr(TXT.note, st.lang);
    if (note.textContent !== noteText) note.textContent = noteText;
    sync();
    if (!running) requestStill();
  }

  function destroy() {
    destroyed = true;
    running = false;
    cancelAnimationFrame(rafId);
    if (pendingDraw) cancelAnimationFrame(pendingDraw);
    ro?.disconnect();
    hudRo?.disconnect();
    io?.disconnect();
    mo?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    mqDark?.removeEventListener?.('change', onTheme);
    mqReduce?.removeEventListener?.('change', onReduce);
    root.remove();
  }

  /** Frame-pacing numbers, for performance checks (harness, tests). */
  function stats() {
    const r1 = (v) => Math.round(v * 10) / 10;
    return { renderMs: r1(perf.renderMs), intervalMs: r1(perf.intervalMs), capped: perf.capped, rebuilds: perf.rebuilds, rebuildMs: r1(perf.rebuildMs) };
  }

  update({});
  return { update, destroy, stats, el: root };
}
