// Dev harness for the town scene: every state field as a control. Also scriptable for screenshots:
//   window.H.set({ phase: 'operation', cooling: 'evaporative' })   window.H.width(390)   window.H.theme('dark')
//   window.H.preset('halls-expansion')   window.H.presets()   window.H.genTest()   window.H.rafCalls()
import { createScene } from '../scene.js';
import { EVENT_KEYS } from './layout.js';

// Count requestAnimationFrame callbacks (for the idle test: 0 callbacks while the scene is still).
// Installed before the scene starts, so the scene's own loop goes through it.
let rafN = 0;
const raf0 = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = (cb) => raf0((ts) => { rafN++; cb(ts); });

const METRICS = ['', 'electricity', 'gridPeak', 'heatAvailable', 'heatUsed', 'water', 'noise', 'co2Electricity', 'co2HeatAvoided',
  'co2Construction', 'jobsConstruction', 'jobsPermanent', 'jobsIndirect', 'propertyTax', 'electricityTax', 'investment', 'trucks',
  'land', 'backupPower', 'eWaste'];

// Sample counters for the harness only (illustrative strings; in the app the simulator formats real model output).
const SAMPLE_COUNTERS = {
  fi: [
    { label: 'Kaukolämpöä koteihin tähän mennessä', value: '1,1–1,7 TWh' },
    { label: 'Kiinteistöveroa kunnalle tähän mennessä', value: '18–27 milj. €' },
    { label: 'Hiilidioksidia vältetty', value: '41 000–88 000 t' },
  ],
  en: [
    { label: 'District heat to homes so far', value: '1.1–1.7 TWh' },
    { label: 'Property tax to the town so far', value: '€18–27 million' },
    { label: 'CO₂ avoided so far', value: '41,000–88,000 t' },
  ],
};

const BASE = {
  year: 6.2, phase: 'operation', phaseProgress: 0.5, sizeMW: 50, cooling: 'air', heatReuse: true, hasDistrictHeat: true,
  site: 'industrial', distanceM: 800, townSize: 'medium', season: 0.05, trucksPerDay: 60, workers: 250, lang: 'fi',
  reducedMotion: null, highlight: null, townName: null,
  halls: null, hallStates: null, dhStatus: null, eventKey: null, heatHomesShare: null, staff: null,
  counters: null, presentation: false, playing: false, town: null,
};
const state = { ...BASE };

/** Presets for the states added in round 1 (each starts from BASE; language and motion setting are kept). */
const PRESETS = {
  default: {},
  'halls-expansion': { phase: 'operation', sizeMW: 500, year: 8.3, season: 0.3, halls: 3, hallStates: [1, 0.5, 0] },
  'halls-expansion-early': { phase: 'operation', sizeMW: 500, year: 7.2, season: 0.55, halls: 3, hallStates: [1, 0.15, 0] },
  'halls-two-done': { phase: 'operation', sizeMW: 500, year: 11, season: 0.6, halls: 3, hallStates: [1, 1, 0.8], cooling: 'evaporative' },
  'halls-one': { phase: 'operation', sizeMW: 50, halls: 1, hallStates: [1] },
  'halls-construction': { phase: 'construction', phaseProgress: 0.55, sizeMW: 500, year: 4, season: 0.4, halls: 3, hallStates: [0.6, 0, 0] },
  'event-zoning': { phase: 'planning', year: 0.3, season: 0.35, eventKey: 'zoning' },
  'event-eia': { phase: 'planning', year: 0.6, season: 0.6, sizeMW: 500, eventKey: 'eia' },
  'event-permit': { phase: 'planning', year: 1.1, season: 0.1, sizeMW: 150, eventKey: 'permit' },
  'event-zoningDecision': { phase: 'planning', year: 1.3, season: 0.3, eventKey: 'zoningDecision' },
  'event-opening': { phase: 'operation', year: 3.5, season: 0.9, eventKey: 'opening' },
  'event-heatFirst': { phase: 'operation', year: 4.1, season: 0.1, heatReuse: true, eventKey: 'heatFirst' },
  'event-refresh': { phase: 'operation', year: 9.2, season: 0.25, eventKey: 'refresh' },
  'event-endOfLife': { phase: 'operation', year: 24.1, season: 0.6, eventKey: 'endOfLife' },
  'town-warm-60': { phase: 'operation', year: 8, season: 0.02, heatReuse: true, heatHomesShare: 0.6 },
  'town-warm-20': { phase: 'operation', year: 8, season: 0.02, heatReuse: true, heatHomesShare: 0.2 },
  'staff-40': { phase: 'operation', year: 8, season: 0.5, staff: 40 },
  'staff-120': { phase: 'operation', year: 8, season: 0.05, sizeMW: 150, staff: 120 },
  counters: { phase: 'operation', year: 12, season: 0.05, counters: 'sample', presentation: false },
  presentation: { phase: 'operation', year: 12, season: 0.05, counters: 'sample', presentation: true },
  'dh-notInStats-air': { phase: 'operation', year: 8, season: 0.05, hasDistrictHeat: false, heatReuse: false, dhStatus: 'notInStats' },
  'dh-notInStats-reuse': { phase: 'operation', year: 8, season: 0.05, hasDistrictHeat: false, heatReuse: true, dhStatus: 'notInStats' },
  // town templates at one fixed scale (state.town.population, contract C4): Vaala ≈ 2 500, Helsinki ≈ 690 000 residents
  'town-village-500': { phase: 'operation', sizeMW: 500, year: 8, season: 0.55, town: { population: 2500, households: 1300 } },
  'town-city-500': { phase: 'operation', sizeMW: 500, year: 8, season: 0.55, town: { population: 690000, households: 370000 } },
  'town-village-50': { phase: 'operation', sizeMW: 50, year: 8, season: 0.55, town: { population: 2500, households: 1300 } },
  'town-small-150': { phase: 'operation', sizeMW: 150, year: 8, season: 0.55, town: { population: 9500, households: 4300 } },
  'town-regional-150': { phase: 'operation', sizeMW: 150, year: 8, season: 0.55, town: { population: 70000, households: 36000 } },
  'town-city-50': { phase: 'operation', sizeMW: 50, year: 8, season: 0.55, town: { population: 260000, households: 150000 } },
  'construction-peak-500': { phase: 'construction', phaseProgress: 0.55, sizeMW: 500, year: 3.5, season: 0.5, workers: 750, halls: 3, hallStates: [0.7, 0.2, 0] },
  'story-500': { phase: 'operation', sizeMW: 500, year: 9.4, season: 0.04, halls: 3, hallStates: [1, 1, 0.45], heatReuse: true,
    heatHomesShare: 0.6, staff: 90, counters: 'sample', eventKey: null },
};

const frame = document.getElementById('frame');
const aria = document.getElementById('aria');
const scene = createScene(frame);

const CONTROLS = [
  ['phase', 'select', ['planning', 'construction', 'operation']],
  ['phaseProgress', 'range', [0, 1, 0.01]],
  ['year', 'range', [0, 30, 0.01]],
  ['season', 'range', [0, 1, 0.01]],
  ['sizeMW', 'select', [10, 50, 150, 500]],
  ['cooling', 'select', ['air', 'evaporative', 'liquid']],
  ['heatReuse', 'select', [true, false]],
  ['hasDistrictHeat', 'select', [true, false]],
  ['dhStatus', 'select', [null, 'stats', 'statsEstimate', 'local', 'notInStats', 'default']],
  ['site', 'select', ['industrial', 'forest', 'field']],
  ['distanceM', 'range', [200, 3000, 50]],
  ['townSize', 'select', ['small', 'medium', 'large']],
  ['town', 'select', [null, { population: 2500 }, { population: 9500 }, { population: 70000 }, { population: 260000 }, { population: 690000 }]],
  ['trucksPerDay', 'range', [0, 200, 1]],
  ['workers', 'range', [0, 1500, 10]],
  ['halls', 'select', [null, 1, 2, 3]],
  ['hallStates', 'select', [null, [1], [0.5], [1, 1], [1, 0.5], [1, 0.5, 0], [1, 0.15, 0], [1, 1, 0.8], [1, 1, 1], [0.6, 0, 0], [0, 0, 0]]],
  ['eventKey', 'select', [null, ...EVENT_KEYS]],
  ['heatHomesShare', 'select', [null, 0, 0.2, 0.4, 0.6, 0.8, 1]],
  ['staff', 'select', [null, 0, 5, 40, 90, 120, 300]],
  ['counters', 'select', [null, 'sample']],
  ['presentation', 'select', [false, true]],
  ['playing', 'select', [null, false, true]],
  ['lang', 'select', ['fi', 'en']],
  ['reducedMotion', 'select', [null, true, false]],
  ['highlight', 'select', METRICS],
];

const controls = document.getElementById('controls');
const inputs = {};
function addSelect(labelText, opts, onChange) {
  const label = document.createElement('label');
  const name = document.createElement('span');
  name.textContent = labelText;
  const el = document.createElement('select');
  for (const o of opts) el.append(Object.assign(document.createElement('option'), { value: o, textContent: o }));
  el.addEventListener('change', () => onChange(el.value));
  label.append(name, el);
  controls.append(label);
  return el;
}
addSelect('preset', Object.keys(PRESETS), (v) => preset(v));
for (const [key, kind, opts] of CONTROLS) {
  const label = document.createElement('label');
  const name = document.createElement('span');
  label.append(name);
  let el;
  if (kind === 'select') {
    el = document.createElement('select');
    for (const o of opts) {
      const op = document.createElement('option');
      op.value = JSON.stringify(o === '' ? null : o);
      op.textContent = o === '' || o === null ? '(none)' : Array.isArray(o) ? `[${o.join(', ')}]` : typeof o === 'object' ? JSON.stringify(o) : String(o);
      el.append(op);
    }
    el.addEventListener('change', () => set({ [key]: JSON.parse(el.value) }));
  } else {
    el = document.createElement('input');
    el.type = 'range';
    [el.min, el.max, el.step] = opts;
    el.addEventListener('input', () => set({ [key]: +el.value }));
  }
  inputs[key] = { el, name, kind };
  label.append(el);
  controls.append(label);
}
// theme + width + auto time
addSelect('theme', ['auto', 'light', 'dark'], (v) => theme(v));
addSelect('width', ['full', 1280, 960, 640, 390, 360], (v) => width(v));
addSelect('animate time', ['off', 'season', 'year'], (v) => { auto = v; startTick(); });
let auto = 'off';

function syncControls() {
  for (const [key, { el, name, kind }] of Object.entries(inputs)) {
    const v = state[key];
    name.textContent = `${key}: ${typeof v === 'number' ? Math.round(v * 100) / 100 : Array.isArray(v) ? `[${v.join(', ')}]` : v && typeof v === 'object' ? JSON.stringify(v) : v}`;
    if (kind === 'select') el.value = JSON.stringify(v ?? null);
    else el.value = v;
  }
}

/** The state the scene gets: 'sample' counters become the sample list in the current language. */
function sceneState() {
  return { ...state, counters: state.counters === 'sample' ? SAMPLE_COUNTERS[state.lang] : state.counters };
}

function set(patch) {
  Object.assign(state, patch);
  scene.update(sceneState());
  syncControls();
  aria.textContent = 'aria-label: ' + (scene.el?.getAttribute('aria-label') || '');
}
function preset(name) {
  const p = PRESETS[name];
  if (!p) throw new Error(`unknown preset: ${name}`);
  const keep = { lang: state.lang, reducedMotion: state.reducedMotion };
  for (const k of Object.keys(state)) delete state[k];
  set({ ...BASE, ...keep, ...p });
}
function theme(v) {
  if (v === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', v);
}
function width(v) {
  frame.style.maxWidth = v === 'full' ? '' : v + 'px';
}
/** Trigger the yearly generator test run: step into the next year of operation. */
function genTest() {
  const y = Math.floor(state.year);
  set({ phase: 'operation', year: y + 0.98 });
  set({ year: y + 1.02 });
}

// "animate time" ticks only while switched on, so an idle harness makes no animation-frame requests of its own
let last = 0;
let ticking = false;
function tick(ts) {
  if (auto === 'off') { ticking = false; last = 0; return; }
  const dt = last ? Math.min(0.1, (ts - last) / 1000) : 0;
  last = ts;
  if (auto === 'season') set({ season: (state.season + dt * 0.05) % 1 });
  if (auto === 'year') set({ year: (state.year + dt * 0.4) % 30, season: ((state.year + dt * 0.4) % 1) });
  requestAnimationFrame(tick);
}
function startTick() {
  if (ticking || auto === 'off') return;
  ticking = true;
  requestAnimationFrame(tick);
}

window.H = { set, preset, presets: () => Object.keys(PRESETS), theme, width, genTest, state, scene, rafCalls: () => rafN };
set({});
