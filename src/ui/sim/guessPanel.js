// Step 3: guess first. Three questions with log sliders; after locking (or skipping, or running time) every guess is shown
// beside the calculated range with a neutral sentence. No judging words, no score.
// The reveal happens in place: the page does not jump away, and a "Run time" button takes the reader on when they are ready.
import { h, icon, replace, withFocus } from '../dom.js';
import { t, L } from '../../i18n.js';
import { fmtNum, fmtRange, roundSig } from '../format.js';
import { store } from '../../store.js';
import * as M from '../../model/model.js';
import { rangeStrip } from '../components/charts.js';
import { rafThrottle, prefersReducedMotion } from './controls.js';
import { comparison, headline } from './compute.js';

const GUESS_TARGETS = M.GUESS_TARGETS;
export const guessTargets = () => (Array.isArray(GUESS_TARGETS) ? GUESS_TARGETS.filter((g) => g && g.key && g.metric) : []);

/** The question actually asked for this town and design (e.g. the heat question asks about the potential when there is no use for it). */
function resolveTarget(target, town, design) {
  if (typeof M.resolveGuessTarget !== 'function') return target;
  try { return M.resolveGuessTarget(target, town, design) || target; } catch { return target; }
}

const STEPS = 1000;
function bounds(target) {
  const log = target.scale !== 'linear';
  const lo = log ? Math.max(1, target.min || 1) : (target.min || 0);
  const hi = Math.max(lo * 10, target.max || 1000);
  return { log, lo, hi };
}
/** Slider position → a whole number (people, homes): 2 significant figures, never below 1. */
const toValue = (target, p) => {
  const { log, lo, hi } = bounds(target);
  const v = log ? lo * (hi / lo) ** (p / STEPS) : lo + ((hi - lo) * p) / STEPS;
  return Math.max(1, Math.round(roundSig(v, 2)));
};
const toPos = (target, v) => {
  const { log, lo, hi } = bounds(target);
  if (!Number.isFinite(v)) return STEPS / 2;
  const p = log ? (Math.log(Math.max(lo, v) / lo) / Math.log(hi / lo)) * STEPS : ((v - lo) / (hi - lo)) * STEPS;
  return Math.max(0, Math.min(STEPS, Math.round(p)));
};
/** Guesses are whole things; older saved guesses may not be. */
const fmtGuess = (v) => fmtNum(Math.max(1, Math.round(v)));

/** The calculated {low, typ, high} that a guess target is compared with. */
export function guessTruth(target, sim) {
  const m = sim?.metrics?.[target.metric];
  if (!m) return null;
  if (target.comparison) {
    const c = comparison(m, target.comparison);
    if (c) return { low: c.low, typ: c.typ, high: c.high };
  }
  const hl = headline(m);
  return { low: hl.low, typ: hl.typ, high: hl.high };
}

const unitOf = (target) => (target.unit ? L(target.unit) : '');
const withUnit = (v, u) => (u ? `${v} ${u}` : v);

/** How close a guess is, in plain words. Neutral: no score, no right or wrong. */
function closeness(guess, truth) {
  if (!Number.isFinite(guess) || !truth || !(truth.typ > 0)) return '';
  if (guess >= truth.low && guess <= truth.high) return L({ fi: 'Arvauksesi osui laskelman välille.', en: 'Your guess falls within the calculated range.' });
  const r = guess / truth.typ;
  if (r >= 1.5) return L({ fi: `Arvauksesi oli noin ${fmtNum(r)} kertaa laskelman tyypillinen arvo.`, en: `Your guess was about ${fmtNum(r)} times the calculation’s typical value.` });
  if (r > 1) return L({ fi: 'Arvauksesi oli vähän laskelman väliä suurempi.', en: 'Your guess was a little above the calculated range.' });
  if (r >= 0.4 && r <= 0.6) return L({ fi: 'Arvauksesi oli noin puolet laskelman tyypillisestä arvosta.', en: 'Your guess was about half the calculation’s typical value.' });
  if (r > 0.6) return L({ fi: 'Arvauksesi oli vähän laskelman väliä pienempi.', en: 'Your guess was a little below the calculated range.' });
  return L({ fi: `Laskelman tyypillinen arvo oli noin ${fmtNum(1 / r)} kertaa arvauksesi.`, en: `The calculation’s typical value was about ${fmtNum(1 / r)} times your guess.` });
}

/** One line of context per question, so the number means something. */
function contextLine(target) {
  if (target.key === 'jobs') return L({ fi: 'Valmis datakeskus työllistää vähän ihmisiä kokoonsa nähden.', en: 'A finished data centre employs few people for its size.' });
  if (target.key === 'homesElectricity') return L({ fi: 'Vertailu on koko vuoden sähkömäärä. Datakeskus käyttää sähköä ympäri vuorokauden, joka päivä.', en: 'The comparison is a whole year’s electricity. A data centre uses power around the clock, every day.' });
  if (target.key === 'homesHeat') {
    return target.usesFallback
      ? L({ fi: 'Tämä on lämmön määrä, jolle pitäisi löytyä käyttäjä. Ilman käyttäjää lämpö johdetaan ilmaan.', en: 'This is the heat that would need a user. Without one, the heat goes into the air.' })
      : L({ fi: 'Kaukolämpöverkko ottaa lämpöä vain sen verran kuin kodit ja muut rakennukset tarvitsevat.', en: 'A district-heating network takes only as much heat as homes and other buildings need.' });
  }
  return '';
}

/** Strip + neutral sentence for one guess (used by the guess panel and by metric cards). opts.animate grows the band once. */
export function guessFeedback(target, sim, guess, opts = {}) {
  const truth = guessTruth(target, sim);
  if (!truth) return null;
  const u = unitOf(target);
  const { log, lo, hi } = bounds(target);
  const range = withUnit(fmtRange(truth.low, truth.high), u);
  const has = Number.isFinite(guess);
  const sentence = has
    ? L({ fi: `Arvasit ${withUnit(fmtGuess(guess), u)}. Laskelma täydessä käytössä: ${range}.`, en: `You guessed ${withUnit(fmtGuess(guess), u)}. The calculation once fully running: ${range}.` })
    : L({ fi: `Et arvannut. Laskelma täydessä käytössä: ${range}.`, en: `No guess. The calculation once fully running: ${range}.` });
  const near = has ? closeness(Math.max(1, Math.round(guess)), truth) : '';
  return h('div', { class: 'sim-guessfb' },
    h('p', { class: 'sim-guessfb__text' }, sentence),
    near ? h('p', { class: 'sim-guessfb__near' }, near) : null,
    rangeStrip({
      min: lo, max: hi, scale: log ? 'log' : 'linear', low: truth.low, typ: truth.typ, high: truth.high,
      guess: has ? Math.max(1, Math.round(guess)) : null, fmt: (v) => fmtNum(v), animate: !!opts.animate,
      labels: { calc: t('sim.guess.calcMark'), guess: t('sim.guess.yourMark') },
    }));
}

export function createGuessPanel(ctx) {
  const root = h('section', { class: 'sim-panel sim-guess', 'data-step': '3', 'aria-labelledby': 'sim-guess-title' });
  const items = [];
  const listEl = h('div', { class: 'sim-guess__list' });
  const lockBtn = h('button', { type: 'button', class: 'btn btn--primary', 'data-fk': 'guess-lock', onclick: () => lock() }, icon('check', { size: 18 }), t('sim.guess.lock'));
  const skipBtn = h('button', { type: 'button', class: 'btn btn--ghost', 'data-fk': 'guess-skip', onclick: () => skip() }, t('sim.guess.skip'));
  const unlockBtn = h('button', { type: 'button', class: 'btn btn--small', 'data-fk': 'guess-unlock', onclick: () => unlock() }, t('sim.guess.unlock'));
  const runBtn = h('button', {
    type: 'button', class: 'btn btn--primary rail-guess__run', 'data-fk': 'guess-run',
    // play first (on phones the step bar then stops sticking), then bring the stage into view if it is not already
    onclick: () => { ctx.play?.(); ctx.scrollToStep?.(4, { ifHidden: true }); },
  }, icon('play', { size: 20 }), L({ fi: 'Aja aikaa', en: 'Run time' }));
  const lockedNote = h('p', { class: 'sim-guess__locked' }, icon('check', { size: 16 }), t('sim.guess.locked'));
  const actions = h('div', { class: 'sim-guess__actions' });
  let animateNext = false;

  const pending = {};
  const pushGuess = rafThrottle(() => {
    const st = store.get();
    const add = { ...pending };
    for (const k of Object.keys(pending)) delete pending[k];
    store.set({ guesses: { ...(st.guesses || {}), ...add }, simStep: Math.max(st.simStep || 1, 3) });
  });

  guessTargets().forEach((target, i) => {
    const id = `sim-guess-${target.key}`;
    const out = h('output', { class: 'sim-guess__value', for: id });
    const input = h('input', { type: 'range', id, min: 0, max: STEPS, step: 1, value: STEPS / 2, 'aria-describedby': `${id}-out` });
    out.id = `${id}-out`;
    const qText = h('span', null, L(target.question));
    const fb = h('div', { class: 'sim-guess__fb' });
    input.addEventListener('input', () => {
      const v = toValue(target, Number(input.value));
      out.textContent = t('sim.guess.your', { v: withUnit(fmtGuess(v), unitOf(target)) });
      out.classList.remove('is-empty');
      input.setAttribute('aria-valuetext', out.textContent);
      pending[target.key] = v;
      pushGuess();
    });
    const scale = bounds(target);
    const el = h('div', { class: 'sim-guess__item' },
      h('label', { class: 'sim-guess__q', for: id }, h('span', { class: 'sim-guess__n', 'aria-hidden': 'true' }, String(i + 1)), qText),
      input,
      h('div', { class: 'sim-field__scale', 'aria-hidden': 'true' }, h('span', null, fmtNum(scale.lo)), h('span', null, fmtNum(scale.hi))),
      out, fb);
    items.push({ target, input, out, fb, el, qText });
    listEl.append(el);
  });

  root.append(
    h('div', { class: 'sim-panel__head' },
      h('p', { class: 'sim-panel__eyebrow' }, h('span', { class: 'sim-panel__num' }, '3'), t('sim.guess.title')),
      h('h2', { class: 'sr-only', id: 'sim-guess-title' }, t('sim.guess.title')),
      h('p', { class: 'sim-panel__lead' }, t('sim.guess.lead'))),
    listEl, actions);

  // Keep the reader where they are; bring the first answer into view only if it is off screen.
  function showReveal() {
    const run = () => {
      const first = listEl.querySelector('.sim-guessfb');
      if (!first || typeof window === 'undefined') return;
      const r = first.getBoundingClientRect();
      const top = 140; // room for the sticky header and step bar
      if (r.top < top || r.top > window.innerHeight - 120) {
        first.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else run();
  }

  const simUi = () => store.get().simUi || {};
  function lock() {
    pushGuess.flush();
    const st = store.get();
    animateNext = !ctx.revealed();
    store.set({ simUi: { ...simUi(), locked: true, revealed: true }, simStep: Math.max(st.simStep || 1, 3) });
    unlockBtn.focus({ preventScroll: true });
    showReveal();
  }
  function skip() {
    const st = store.get();
    animateNext = !ctx.revealed();
    store.set({ simUi: { ...simUi(), revealed: true }, simStep: Math.max(st.simStep || 1, 3) });
    runBtn.focus({ preventScroll: true });
    showReveal();
  }
  function unlock() {
    store.set({ simUi: { ...simUi(), locked: false } });
    lockBtn.focus({ preventScroll: true });
  }

  function update(state, sim) {
    const ui = state.simUi || {};
    const locked = !!ui.locked;
    const revealed = ctx.revealed();
    const town = ctx.town();
    const animate = revealed && animateNext;
    animateNext = false;
    for (const it of items) {
      const tg = resolveTarget(it.target, town, state.design);
      it.qText.textContent = L(tg.question);
      const g = state.guesses?.[it.target.key];
      if (document.activeElement !== it.input) it.input.value = toPos(it.target, g);
      it.input.disabled = locked;
      if (Number.isFinite(g)) {
        it.out.textContent = t('sim.guess.your', { v: withUnit(fmtGuess(g), unitOf(it.target)) });
        it.out.classList.remove('is-empty');
      } else {
        it.out.textContent = t('sim.guess.move');
        it.out.classList.add('is-empty');
      }
      it.input.setAttribute('aria-valuetext', it.out.textContent);
      if (revealed) {
        const fb = guessFeedback(tg, sim, g, { animate });
        const ctxText = contextLine(tg);
        replace(it.fb, fb || '', fb && ctxText ? h('p', { class: 'rail-guess__context' }, ctxText) : '');
      } else replace(it.fb);
    }
    withFocus(actions, () => replace(actions, ...(locked
      ? [lockedNote, unlockBtn, runBtn]
      : revealed ? [lockBtn, runBtn] : [lockBtn, skipBtn])));
    root.classList.toggle('is-locked', locked);
    root.classList.toggle('is-revealed', revealed);
  }

  return { el: root, update, destroy: () => pushGuess.cancel() };
}
