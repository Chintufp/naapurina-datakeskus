// Simulator view (#simulaattori): a guided workspace.
//   step bar (1 town → 2 design → 3 guess → 4 run time → 5 your view), sticky under the header, with a one-line instruction
//   left rail: town card, design choices, guesses · centre: scene + timeline · right: persona lens + results
//   below: your view. DOM order (rail → centre → right → your view) is also the visual order at every width,
//   and a "Seuraava: <step> →" button follows the town card, the design panel, the guesses and the stage.
//
// Flow:
//   - First load: the step bar, town card, design and guesses render first. The model run, the stage, the results and
//     "your view" follow after the first paint, in short tasks; a "Lasketaan…" placeholder holds their place.
//   - A design change re-runs the model at once, then at most once per SIM_GAP_MS while a slider is dragged.
//   - The step bar follows the panel at the reading line while scrolling (IntersectionObserver), as well as clicks.
//   - Desktop (flow.css): the stage stays in view beside the rail while the reader works through steps 2–3.
//   - A deep link or a loaded project (store.simEntry, from router.js) stops playback, goes back to the preview year at
//     step 1, scrolls to the town card or the real-project card and keeps the link in the address bar until the user
//     changes what it describes.
// Contract: export mount(el) → returns an unmount function.
import { h, icon, replace, announce } from '../dom.js';
import { t, L } from '../../i18n.js';
import { store } from '../../store.js';
import * as towns from '../../data/towns.js';
import * as personasMod from '../../content/personas.js';
import * as projectsMod from '../../content/projects.js';
import { projectToken, townToken, scenarioToken, shareUrl } from '../router.js';
import { closeDrawer } from '../components/drawer.js';
import { runSim, operationStart, metricKeysByTheme } from '../sim/compute.js';
import { prefersReducedMotion } from '../sim/controls.js';
import { createTownCard, townName } from '../sim/townCard.js';
import { createDesignPanel } from '../sim/designPanel.js';
import { createGuessPanel } from '../sim/guessPanel.js';
import { createStage } from '../sim/stage.js';
import { createResults, KEY_METRICS } from '../sim/results.js';
import { createWhy } from '../sim/why.js';
import { createYourView } from '../sim/yourView.js';

const LAST = 30;
// Base pace at speed 1. The default speed 2 with the slow-downs near events, the faster steady years and the holds
// below gives a full run of about 18–24 s (checked for 10–1000 MW, with and without heat reuse).
const SECONDS_PER_YEAR = 0.9;
const HOLD_KEYS = new Set(['opening', 'heatFirst', 'expansion', 'endOfLife']);
const HOLD_MS = 1200;
// Keys that need a new model run. While a slider is dragged the run (and the re-render) happens at most once per gap.
const SIM_KEYS = ['townCode', 'design', 'overrides', 'presetId', 'simEntry'];
const SIM_GAP_MS = 160;
// The reading line for the step bar: this share of the visible height below the sticky header and step bar.
const READ_LINE = 0.3;

// The last store.simEntry this module has acted on; kept across remounts so an entry is handled once.
let seenEntry = 0;

function getTown(code) {
  try { return (towns.townByCode && towns.townByCode(code)) || null; } catch { return null; }
}

/** Where the preview starts: the year after the data centre reaches full capacity. */
function previewYear(sim) {
  const full = sim?.meta?.fullCapacityYear;
  const base = Number.isFinite(full) ? full : operationStart(sim) + 1;
  return Math.min(LAST, Math.ceil(base) + 1);
}

/** Does the address-bar token still describe the state? (Then it can stay; otherwise the address becomes #simulaattori.) */
function tokenStillValid(tok, state) {
  if (tok.startsWith('hanke-')) return state.presetId === tok.slice(6);
  if (tok.startsWith('kunta-')) return !state.presetId && tok === townToken(state.townCode);
  if (tok.startsWith('s-')) return !state.presetId && tok === scenarioToken({ townCode: state.townCode, design: state.design });
  return true;
}

function createStepBar(ctx) {
  const items = [1, 2, 3, 4, 5].map((n) => {
    const b = h('button', { type: 'button', class: 'sim-steps__btn', onclick: () => { store.set({ simStep: n }); ctx.scrollToStep(n); } },
      h('span', { class: 'sim-steps__num', 'aria-hidden': 'true' }, String(n)),
      h('span', { class: 'sim-steps__label' }, t(`sim.step.${n}`)),
      h('span', { class: 'sr-only' }, ` (${t('sim.stepOf', { n })})`));
    return { n, li: h('li', { class: 'sim-steps__item' }, b), b };
  });
  const compact = h('p', { class: 'sim-steps__compact', 'aria-hidden': 'true' });
  const hint = h('p', { class: 'sim-steps__hint-text' });
  const live = h('div', { class: 'sim-steps__hint-live', 'aria-live': 'polite' }, hint);
  // No "Next" button here: the steps themselves are buttons, and each panel ends with its own "Next: …".
  const el = h('nav', { class: 'sim-steps', 'aria-label': t('sim.steps.label') },
    h('ol', { class: 'sim-steps__list' }, items.map((i) => i.li)),
    h('div', { class: 'sim-steps__hint' }, compact, live));
  /** quiet: the step changed because the reader scrolled, so the hint is not read out (aria-current still changes). */
  function update(state, { quiet = false } = {}) {
    const cur = state.simStep || 1;
    for (const i of items) {
      i.li.classList.toggle('is-current', i.n === cur);
      i.li.classList.toggle('is-done', i.n < cur);
      if (i.n === cur) i.b.setAttribute('aria-current', 'step'); else i.b.removeAttribute('aria-current');
    }
    compact.textContent = t('sim.steps.compact', { n: cur, name: t(`sim.step.${cur}`) });
    live.setAttribute('aria-live', quiet ? 'off' : 'polite');
    hint.textContent = t(`sim.step.${cur}.hint`);
  }
  return { el, update };
}

export function mount(el) {
  let dead = false;
  let ready = false;          // the model run, stage, results and your view are built
  let sim = null;
  let simError = null;
  let town = null;
  let playing = false;
  let raf = 0;
  let lastT = 0;
  let holdUntil = 0;
  let hoverHL = null;
  let lastIntYear = -1;
  let yearF = 0;
  let preview = false;
  let stage = null;
  let results = null;
  let why = null;
  let yourView = null;
  const timers = new Set();
  const later = (fn, ms = 0) => { const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms); timers.add(id); return id; };

  const st0 = store.get();
  town = getTown(st0.townCode);
  // A deep link, or a project opened from another page, that this view has not acted on yet (router.js sets it).
  const entry0 = st0.simEntry && st0.simEntry.n !== seenEntry ? st0.simEntry : null;
  if (entry0) seenEntry = entry0.n;

  const ctx = {
    sim: () => sim,
    town: () => town,
    year: () => yearF,
    isPlaying: () => playing,
    isPreview: () => preview,
    revealed: () => {
      const ui = store.get().simUi || {};
      return !!(ui.revealed || ui.locked);
    },
    highlight: () => {
      if (hoverHL) return hoverHL;
      const s = store.get();
      const p = s.persona && (personasMod.personaById ? personasMod.personaById(s.persona) : null);
      if (p?.cares?.length) return p.cares[0];
      if (s.focusTheme) {
        const ks = metricKeysByTheme()[s.focusTheme] || [];
        return ks.find((k) => KEY_METRICS.includes(k)) || ks[0] || null;
      }
      return null;
    },
    setHoverHighlight(k) {
      if (hoverHL === k) return;
      hoverHL = k;
      if (!playing && stage) stage.renderYear(yearF);
    },
    play,
    pause,
    restart() { if (!stage) return; pause(); setYear(0, { user: true }); commitYear(); play(); },
    setSpeed(v) { store.set({ speed: v }); },
    setYear,
    commitYear,
    openWhy: (k) => why?.open(k),
    scrollToStep,
    /** Link that reopens this view: the project when one is loaded, otherwise the town and design. */
    share() {
      const s = store.get();
      const token = s.presetId ? projectToken(s.presetId) : scenarioToken({ townCode: s.townCode, design: s.design });
      return shareUrl(token);
    },
  };

  // ----- build: first paint = intro, step bar, rail; the centre and right columns wait for the model -----
  const steps = createStepBar(ctx);
  const townCard = createTownCard(ctx);
  const design = createDesignPanel(ctx);
  const guess = createGuessPanel(ctx);

  /** "Seuraava: <next step> →" after panel n. */
  const nextButton = (n) => h('button', {
    type: 'button', class: 'btn btn--small sim-next', 'data-fk': `sim-next-${n}`,
    onclick: () => { store.set({ simStep: n + 1 }); scrollToStep(n + 1); },
  }, t('sim.nextStep', { step: t(`sim.step.${n + 1}`) }), icon('arrowRight', { size: 16 }));

  const calcText = () => L({ fi: 'Lasketaan…', en: 'Calculating…' });
  const waitStage = h('div', { class: 'flow-wait flow-wait--stage', role: 'status' },
    h('span', { class: 'flow-wait__spin', 'aria-hidden': 'true' }), h('span', null, calcText()));
  const waitResults = h('div', { class: 'flow-wait flow-wait--results', 'aria-hidden': 'true' }, h('span', null, calcText()));
  const errorBox = h('div', { class: 'sim-error', role: 'alert', hidden: true }, icon('info', { size: 18 }), t('sim.error'));
  const railEl = h('div', { class: 'sim-rail' }, townCard.el, nextButton(1), design.el, nextButton(2), guess.el, nextButton(3));
  const stickyEl = h('div', { class: 'sim-sticky' }, waitStage);
  const centerEl = h('div', { class: 'sim-center' }, stickyEl);
  const rightEl = h('div', { class: 'sim-right' }, waitResults);
  const gridEl = h('div', { class: 'sim-grid' }, railEl, centerEl, rightEl);
  const root = h('div', { class: 'sim-page is-calculating' },
    h('header', { class: 'sim-intro' },
      h('h1', { class: 'sim-intro__title' }, t('sim.title')),
      h('p', { class: 'sim-intro__lead' }, t('sim.lead'))),
    steps.el,
    errorBox,
    gridEl);
  el.append(root);

  // Desktop "app" layout (flow.css .is-shell): the grid fills the window under the step bar and each column scrolls on
  // its own, so the rail, the stage and the results do not move together. "Your view" (step 5) then ends the results
  // column; elsewhere it sits under the grid.
  const shellMQ = window.matchMedia('(min-width: 1100px) and (min-height: 640px)');
  const COLS = [railEl, centerEl, rightEl];
  const isShell = () => root.classList.contains('is-shell') && !root.classList.contains('is-presenting');
  /** Scroll only the column that holds target (never the page, which scrollIntoView would also move). */
  function scrollInColumn(target, { behavior = 'auto', block = 'start' } = {}) {
    const col = COLS.find((c) => c.contains(target));
    if (!col) return;
    const cr = col.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    let top;
    if (block === 'nearest') {
      if (r.top >= cr.top && r.bottom <= cr.bottom) return;
      top = col.scrollTop + (r.top < cr.top || r.height > cr.height ? r.top - cr.top - 8 : r.bottom - cr.bottom + 8);
    } else top = col.scrollTop + r.top - cr.top - 4;
    col.scrollTo({ top: Math.max(0, Math.round(top)), behavior });
  }
  function applyShell() {
    const on = shellMQ.matches;
    root.classList.toggle('is-shell', on);
    if (yourView) {
      const home = on ? rightEl : root;
      if (yourView.el.parentNode !== home) home.append(yourView.el);
    }
  }
  applyShell();
  shellMQ.addEventListener('change', () => { applyShell(); setHeaderVar(); });

  // sticky offsets follow the real header and step-bar heights; the stage is sticky (desktop) only when it fits,
  // or (flow.css) on desktop screens at least 800 px high
  const header = document.querySelector('.site-header');
  let headerH = 0;
  let stepsH = 0;
  const setHeaderVar = () => {
    headerH = header ? header.offsetHeight : 0;
    stepsH = steps.el.offsetHeight;
    root.style.setProperty('--sim-header-h', `${headerH}px`);
    root.style.setProperty('--sim-steps-h', `${stepsH}px`);
    // desktop layout: the grid ends at the bottom of the window (measured from the page top, so scrolling does not change it)
    if (isShell()) root.style.setProperty('--sim-shell-h', `${Math.max(480, Math.floor(window.innerHeight - (gridEl.getBoundingClientRect().top + window.scrollY) - 12))}px`);
    const stickyH = stickyEl.offsetHeight;
    stickyEl.classList.toggle('is-fit', stickyH + headerH + stepsH + 24 <= window.innerHeight);
    // Room under the rail (flow.css, desktop): the stuck stage stays whole while the guess panel sits at the top of the
    // screen and while the end of the rail is read (a stage taller than the space under the bars would otherwise be pushed up).
    const railEnd = railEl.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(railEl).paddingBottom) || 0);
    const fromGuess = stickyH - (railEnd - guess.el.getBoundingClientRect().top);
    const fromScreen = stickyH + headerH + stepsH + 12 - window.innerHeight;
    const room = Math.max(0, Math.ceil(Math.max(fromGuess, fromScreen) / 8) * 8);
    if (room !== stageRoom) { stageRoom = room; root.style.setProperty('--flow-stage-room', `${room}px`); }
    if (ready) setupStepObserver();
  };
  let stageRoom = -1;
  /** How far down the sticky header and step bar reach (on phones the step bar stops sticking while the time-lapse plays). */
  function stickyBottom() {
    let bottom = 0;
    for (const node of [header, steps.el]) {
      if (!node) continue;
      const cs = getComputedStyle(node);
      if (cs.position === 'sticky' || cs.position === 'fixed') bottom = Math.max(bottom, (parseFloat(cs.top) || 0) + node.offsetHeight);
    }
    return bottom;
  }
  /** Where a scrolled-to panel's top goes: just under the sticky header and step bar. */
  const barOffset = () => stickyBottom() + 12;
  setHeaderVar();
  let ro = null;
  if ('ResizeObserver' in window) {
    ro = new ResizeObserver(setHeaderVar);
    if (header) ro.observe(header);
    ro.observe(steps.el);
    ro.observe(stickyEl);
    ro.observe(guess.el);
  }
  window.addEventListener('resize', setHeaderVar);

  // ----- time -----
  function setYear(y, { user = false } = {}) {
    if (!stage) return;
    yearF = Math.max(0, Math.min(LAST, y));
    if (user) preview = false;
    stage.renderYear(yearF);
    const yi = Math.floor(yearF);
    if (yi !== lastIntYear) {
      lastIntYear = yi;
      results?.setYear(yearF);
      why?.update();
    }
    // reveal guesses once the data centre is running in playback
    const ui = store.get().simUi || {};
    if (playing && !ui.revealed && !ui.locked && yearF >= operationStart(sim)) {
      store.set({ simUi: { ...ui, revealed: true } });
    }
  }
  function commitYear() { if (store.get().year !== yearF) store.set({ year: yearF }); }

  /** Pace multiplier at year y: slow within ±0,35 years of an event, faster in steady operation years. */
  function pace(y) {
    const evs = sim?.events || [];
    let near = false;
    for (const e of evs) {
      const d = Math.abs(e.year - y);
      if (d <= 0.35) return 0.35;
      if (d <= 1) near = true;
    }
    if (near) return 1;
    const meta = sim?.meta || {};
    const opStart = operationStart(sim);
    const online = Array.isArray(meta.hallOnline) && meta.hallOnline.length ? Math.max(...meta.hallOnline)
      : Number.isFinite(meta.fullCapacityYear) ? meta.fullCapacityYear : opStart;
    return y >= opStart && y >= online ? 1.75 : 1;
  }

  function tick(now) {
    if (dead || !playing) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    if (now < holdUntil) { raf = requestAnimationFrame(tick); return; } // a short pause at a key moment
    let next = yearF + (dt / SECONDS_PER_YEAR) * (store.get().speed || 2) * pace(yearF);
    const hold = (sim?.events || []).find((e) => HOLD_KEYS.has(e.key) && e.year > yearF && e.year <= next && e.year < LAST);
    if (hold) { next = hold.year; holdUntil = now + HOLD_MS; }
    if (next >= LAST) {
      setYear(LAST);
      pause();
      const s = store.get();
      if ((s.simStep || 1) <= 4) { holdStep(); store.set({ simStep: 5 }); }
      return;
    }
    const before = Math.floor(yearF);
    setYear(next);
    if (Math.floor(next) !== before) commitYear();
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (playing || !sim || !stage) return;
    const s = store.get();
    const ui = s.simUi || {};
    if (preview || yearF >= LAST - 1e-6) setYear(0, { user: true });
    preview = false;
    playing = true;
    holdUntil = 0;
    stage.setPlaying(true);
    store.set({ playing: true, simUi: { ...ui, played: true }, simStep: Math.max(s.simStep || 1, 4) });
    lastT = performance.now();
    if (prefersReducedMotion()) {
      // still advance, but in whole-year steps so nothing animates continuously (no holds)
      const step = () => {
        if (dead || !playing) return;
        if (yearF >= LAST) { pause(); return; }
        setYear(Math.floor(yearF) + 1);
        commitYear();
        if (yearF >= LAST) {
          pause();
          if ((store.get().simStep || 1) <= 4) { holdStep(); store.set({ simStep: 5 }); }
          return;
        }
        raf = setTimeout(step, (SECONDS_PER_YEAR * 1000) / (store.get().speed || 2));
      };
      raf = setTimeout(step, 50);
    } else raf = requestAnimationFrame(tick);
  }
  /** Stop the clock without saving the year (a new project or link resets the year itself). */
  function stopPlayback() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(raf); clearTimeout(raf);
    stage?.setPlaying(false);
    if (store.get().playing) store.set({ playing: false });
  }
  function pause() {
    if (!playing) return;
    stopPlayback();
    commitYear();
    stage?.renderYear(yearF);
  }

  // ----- scrolling -----
  // While the page scrolls because of a click (step bar, Next, a link), the reading line does not change the step.
  let stepLock = false;
  let lockTimer = 0;
  const unlockLater = (ms) => { clearTimeout(lockTimer); lockTimer = setTimeout(() => { stepLock = false; }, ms); };
  // The reader's own scrolling moves the step; a layout change alone (the recap appearing, text growing while the
  // time-lapse plays) does not, so a finished run keeps step 5 and a playing one keeps step 4.
  let lastScrollAt = -1e9;
  // Right after the run ends the step stays at 5 even if the page shifts (the recap appears, scroll anchoring moves the page).
  let stepHoldUntil = 0;
  const holdStep = () => { stepHoldUntil = performance.now() + 1500; };
  const onScroll = () => { lastScrollAt = performance.now(); if (stepLock) unlockLater(200); };
  window.addEventListener('scroll', onScroll, { passive: true });
  // In the desktop layout the columns scroll, not the page: the column scrolled last decides the step.
  let lastCol = null;
  const onColScroll = (e) => {
    onScroll();
    lastCol = e.currentTarget;
    if (isShell() && !stepRaf) stepRaf = requestAnimationFrame(checkStep);
  };
  for (const c of COLS) c.addEventListener('scroll', onColScroll, { passive: true });
  const smoothBehavior = () => (prefersReducedMotion() ? 'auto' : 'smooth');
  /** The step of the panel at a third of the way down a column (the results column has only step 5). */
  function stepInColumn(col) {
    const cr = col.getBoundingClientRect();
    const line = cr.top + cr.height * 0.33;
    let n = 0;
    col.querySelectorAll('[data-step]').forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.height && r.top <= line && r.bottom >= line) n = Number(p.dataset.step);
    });
    return n;
  }

  function scrollToY(y, smooth) {
    stepLock = true;
    unlockLater(450);
    window.scrollTo({ top: Math.max(0, Math.round(y)), behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }
  const pageTop = (node) => node.getBoundingClientRect().top + window.scrollY;

  /**
   * Scroll panel n to just under the sticky bars. Step 4 goes to the top of the centre column, which is where the stage
   * sits when it is not stuck (sticky) beside the rail. { ifHidden: true } (the guess panel's "Aja aikaa"): only when the
   * stage's picture is not already in view, so on desktop the guesses stay beside the playing scene.
   */
  function scrollToStep(n, { ifHidden = false } = {}) {
    const target = n === 4 ? centerEl : root.querySelector(`[data-step="${n}"]`);
    if (!target) return;
    if (isShell()) {
      // the stage is always in view; the other panels scroll inside their own column
      if (n === 4) { if (!ifHidden) centerEl.scrollTo({ top: 0, behavior: smoothBehavior() }); return; }
      stepLock = true;
      unlockLater(600);
      scrollInColumn(target, { behavior: smoothBehavior() });
      return;
    }
    setHeaderVar();
    if (n === 4 && ifHidden && stage) {
      const r = stage.el.getBoundingClientRect();
      if (r.top >= stickyBottom() - 2 && r.top + Math.min(r.height, 360) <= window.innerHeight) return;
    }
    scrollToY(pageTop(target) - barOffset(), true);
  }

  /** After a deep link or a loaded project: the town card, or the real-project card when it would not fit below it. */
  function scrollToEntry(entry) {
    if (dead) return;
    if (isShell()) {
      // every column back to its top (the results' assumption banner is first there); the project card into view
      lastEntryAt = performance.now();
      stepLock = true;
      unlockLater(450);
      window.scrollTo({ top: 0 });
      for (const c of COLS) c.scrollTo({ top: 0 });
      const card = entry.kind === 'project' ? townCard.presetEl : null;
      if (card && !card.hidden) scrollInColumn(card, { block: 'nearest' });
      return;
    }
    setHeaderVar();
    const off = barOffset();
    let y = pageTop(townCard.el) - off;
    const card = entry.kind === 'project' ? townCard.presetEl : null;
    if (card && !card.hidden) {
      const r = card.getBoundingClientRect();
      const cardBottom = r.bottom + window.scrollY;
      if (cardBottom - y > window.innerHeight - off + 12) y = r.top + window.scrollY - off;
      // beside the rail (desktop), the results' assumption banner ('the size has not been published') starts in view too
      const as = rightEl.querySelector('.sim-assume:not([hidden])');
      if (as && rightEl.getBoundingClientRect().left >= railEl.getBoundingClientRect().right - 1) {
        const at = as.getBoundingClientRect().top + window.scrollY - off;
        if (at < y && r.top + window.scrollY - at < window.innerHeight * 0.5) y = Math.max(0, at);
      }
    }
    lastEntryAt = performance.now();
    scrollToY(y, false);
  }
  let lastEntryAt = -1e9;

  // ----- step bar from the reading line -----
  let stepIO = null;
  let ioKey = '';
  let stepRaf = 0;
  let quietStep = false;
  const besideRail = () => centerEl.getBoundingClientRect().left >= railEl.getBoundingClientRect().right - 1;
  const readLine = () => { const off = headerH + stepsH; return off + (window.innerHeight - off) * READ_LINE; };
  /** The step of the panel at the reading line. Beside the rail the stage stays in view, so there the rail decides. */
  function stepAtLine() {
    const line = readLine();
    const hits = [];
    root.querySelectorAll('[data-step]').forEach((p) => {
      const r = p.getBoundingClientRect();
      if (r.height && r.top <= line && r.bottom >= line) hits.push(Number(p.dataset.step));
    });
    const others = hits.filter((n) => n !== 4);
    if (others.length) return Math.min(...others);
    return hits.includes(4) && !besideRail() ? 4 : 0;
  }
  function checkStep() {
    stepRaf = 0;
    if (dead || stepLock || stage?.isPresenting?.()) return;
    // while the time-lapse plays the step stays at 4 (the stage's own Play button may scroll the scene into view)
    if (playing || performance.now() < stepHoldUntil || performance.now() - lastScrollAt > 600) return;
    const n = isShell() ? (lastCol ? stepInColumn(lastCol) : 0) : stepAtLine();
    if (!n || n === (store.get().simStep || 1)) return;
    quietStep = true;
    try { store.set({ simStep: n }); } finally { quietStep = false; }
  }
  function setupStepObserver() {
    if (!('IntersectionObserver' in window)) return;
    const line = Math.round(readLine());
    const vh = window.innerHeight;
    const key = `${line}|${vh}`;
    if (key === ioKey && stepIO) return;
    ioKey = key;
    stepIO?.disconnect();
    // A 1 px band at the reading line. The extra thresholds keep it working where rootMargin is ignored (cross-origin frames).
    stepIO = new IntersectionObserver(() => { if (!stepRaf) stepRaf = requestAnimationFrame(checkStep); }, {
      rootMargin: `-${line}px 0px -${Math.max(0, vh - line - 1)}px 0px`,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    root.querySelectorAll('[data-step]').forEach((p) => stepIO.observe(p));
  }

  // ----- address bar -----
  let addrRaf = 0;
  function queueAddress(entryToken) {
    cancelAnimationFrame(addrRaf);
    addrRaf = requestAnimationFrame(() => {
      if (dead) return;
      try {
        const cur = location.hash.replace(/^#/, '');
        if (entryToken) {
          if (cur !== entryToken) history.replaceState(null, '', `#${entryToken}`);
        } else if (/^(hanke|kunta|s)-/.test(cur) && !tokenStillValid(cur, store.get())) {
          history.replaceState(null, '', '#simulaattori');
        }
      } catch { /* sandboxed history: leave the address as it is */ }
    });
  }

  // ----- render -----
  function renderSteps(state) {
    steps.update(state, { quiet: quietStep });
    root.querySelectorAll('[data-step]').forEach((p) => p.classList.toggle('is-current-step', Number(p.dataset.step) === (state.simStep || 1)));
  }

  /** Before the model has run: the step bar and the rail only. */
  function renderLight(state, changed) {
    const all = !changed;
    const has = (...ks) => all || ks.some((k) => changed.has(k));
    if (has('townCode')) town = getTown(state.townCode);
    if (has('simStep')) renderSteps(state);
    if (has('townCode', 'presetId')) townCard.update(state);
    if (has('townCode', 'design', 'overrides', 'presetId')) design.update(state, sim);
    if (has('townCode', 'design', 'overrides', 'presetId', 'guesses', 'simUi')) guess.update(state, sim);
  }

  function renderAll(state, changed) {
    const all = !changed;
    const has = (...ks) => all || ks.some((k) => changed.has(k));
    const simChanged = has(...SIM_KEYS);
    if (simChanged) {
      town = getTown(state.townCode);
      ({ result: sim, error: simError } = runSim(town, state.design, state.overrides, state.presetId));
      lastSimAt = performance.now();
      // still previewing: move the preview to the new design's first full-capacity year
      if (preview && !playing) yearF = previewYear(sim);
    }
    // a new project or deep link: stop the clock and start again from the preview year
    const entry = has('simEntry') && state.simEntry && state.simEntry.n !== seenEntry ? state.simEntry : null;
    if (entry) {
      seenEntry = entry.n;
      stopPlayback();
      preview = true;
      yearF = previewYear(sim);
      holdUntil = 0;
    }
    errorBox.hidden = !simError;
    if (has('simStep')) renderSteps(state);
    // a project whose size is an assumption can change size from the results banner: the rail card follows
    if (has('townCode', 'presetId') || (state.presetId && has('design'))) townCard.update(state);
    if (simChanged) design.update(state, sim);
    if (simChanged || has('guesses', 'simUi')) guess.update(state, sim);
    const resStruct = simChanged || has('persona', 'focusTheme', 'presetId', 'simUi', 'guesses');
    if (resStruct || has('overrides')) results.update(state, sim, { structural: resStruct });
    if (simChanged || has('speed', 'simUi', 'persona', 'focusTheme')) stage.update(state, sim, { structural: simChanged });
    if (simChanged || has('priorities', 'question', 'persona')) yourView.update(state, sim, { structural: simChanged || has('priorities') });
    if (simChanged) why.update();
    lastIntYear = Math.floor(yearF);
    if (entry) {
      queueAddress(entry.token);
      requestAnimationFrame(() => scrollToEntry(entry));
      const p = entry.kind === 'project' && projectsMod.projectById ? projectsMod.projectById(state.presetId) : null;
      const name = p ? L(p.name) : townName(town);
      announce(p ? L({ fi: `Hanke avattu: ${name}`, en: `Project opened: ${name}` }) : L({ fi: `Avattu: ${name}`, en: `Opened: ${name}` }));
    } else if (has('townCode', 'presetId', 'design')) queueAddress(null);
  }

  // The first render: the rail now; the model and the rest after the first paint, in three short tasks.
  renderLight(st0, null);
  if (entry0) requestAnimationFrame(() => scrollToEntry(entry0));

  let dirty = null;     // keys changed before the rest was built
  let lastSimAt = -1e9;
  let started = false;
  const kick = () => { if (!started && !dead) { started = true; later(buildStage); } };
  requestAnimationFrame(kick);
  later(kick, 1000); // a background tab gets no animation frames

  function buildStage() {
    const s = store.get();
    town = getTown(s.townCode);
    ({ result: sim, error: simError } = runSim(town, s.design, s.overrides, s.presetId));
    lastSimAt = performance.now();
    // Start somewhere alive: if the user has never played, preview the year after full capacity.
    yearF = Number.isFinite(s.year) ? Math.max(0, Math.min(LAST, s.year)) : 0;
    preview = false;
    if (!s.simUi?.played && yearF === 0) {
      yearF = previewYear(sim);
      preview = true;
    }
    lastIntYear = Math.floor(yearF);
    stage = createStage(ctx);
    replace(stickyEl, stage.el, nextButton(4));
    errorBox.hidden = !simError;
    design.update(s, sim);
    guess.update(s, sim);
    stage.update(s, sim, { structural: true });
    later(buildResults);
  }
  function buildResults() {
    const s = store.get();
    results = createResults(ctx);
    why = createWhy(ctx);
    replace(rightEl, results.el);
    results.update(s, sim, { structural: true });
    // a project opened on first load: once the results (and their assumption banner) exist, place the page again,
    // (this follows the first paint within a moment, before the reader has had time to scroll)
    if (entry0 && performance.now() - lastEntryAt < 2500) requestAnimationFrame(() => scrollToEntry(entry0));
    later(buildYourView);
  }
  function buildYourView() {
    const s = store.get();
    yourView = createYourView(ctx);
    root.append(yourView.el);
    applyShell();
    yourView.update(s, sim, { structural: true });
    why.update();
    root.classList.remove('is-calculating');
    ready = true;
    renderSteps(s);
    if (dirty) { const ch = dirty; dirty = null; renderAll(store.get(), ch); }
    setHeaderVar();
    setupStepObserver();
  }

  // Model runs: the first change runs at once; more changes within SIM_GAP_MS wait for one run at the end of the gap.
  let simQueued = null;
  let simTimer = 0;
  function queueSim(changed) {
    simQueued = simQueued ? new Set([...simQueued, ...changed]) : new Set(changed);
    if (simTimer) return;
    const wait = lastSimAt + SIM_GAP_MS - performance.now();
    if (wait <= 0) flushSim();
    else simTimer = setTimeout(flushSim, wait);
  }
  function flushSim() {
    clearTimeout(simTimer);
    simTimer = 0;
    if (dead || !simQueued) return;
    const ch = simQueued;
    simQueued = null;
    renderAll(store.get(), ch);
  }

  const unsub = store.subscribe((state, prev) => {
    // prev.view is not the simulator: this is the change that mounted the view, and mount already used this state
    if (dead || state.view !== 'simulaattori' || prev.view !== 'simulaattori' || state.lang !== prev.lang) return;
    const changed = new Set(Object.keys(state).filter((k) => state[k] !== prev[k]));
    changed.delete('year'); changed.delete('playing');
    if (!changed.size) return;
    if (!ready) {
      renderLight(state, changed);
      dirty = dirty ? new Set([...dirty, ...changed]) : changed;
      return;
    }
    if (changed.has('simEntry')) {
      // a project or link: at once, with anything still waiting
      const ch = simQueued ? new Set([...simQueued, ...changed]) : changed;
      simQueued = null; clearTimeout(simTimer); simTimer = 0;
      renderAll(state, ch);
    } else if (SIM_KEYS.some((k) => changed.has(k))) {
      // at most one model run per gap while a slider is dragged; while it waits, the rail answers at once
      queueSim(changed);
      if (simTimer) renderLight(state, new Set([...changed].filter((k) => k === 'simStep' || k === 'townCode' || k === 'presetId')));
    } else {
      renderAll(state, changed);
    }
  });

  const onVis = () => { if (document.hidden && playing) pause(); };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    dead = true;
    playing = false;
    cancelAnimationFrame(raf); clearTimeout(raf);
    cancelAnimationFrame(stepRaf); cancelAnimationFrame(addrRaf);
    clearTimeout(simTimer); clearTimeout(lockTimer);
    for (const id of timers) clearTimeout(id);
    unsub();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('resize', setHeaderVar);
    window.removeEventListener('scroll', onScroll);
    for (const c of COLS) c.removeEventListener('scroll', onColScroll);
    ro?.disconnect();
    stepIO?.disconnect();
    why?.close();
    closeDrawer();
    stage?.destroy();
    design.destroy?.();
    guess.destroy?.();
    yourView?.destroy?.();
    const finalYear = preview ? 0 : yearF;
    queueMicrotask(() => {
      try { if (store.get().year !== finalYear || store.get().playing) store.set({ year: finalYear, playing: false }); } catch { /* ignore */ }
    });
  };
}
