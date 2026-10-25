// App state: one plain object, shallow-merged with set(), observed with subscribe().
// Components read store.get() and re-render what they own when notified.
//
// Remembered between visits (localStorage, always in try/catch, validated on load):
//   'nd.lang', 'nd.town'  – language and town
//   'nd.state'            – JSON of PERSISTED_KEYS (design, presetId, guesses, priorities, question, speed, textSize)
// Nothing else is stored. When storage is blocked the app simply starts from the defaults.

const listeners = new Set();

const DEFAULT_STATE = {
  lang: 'fi',                // 'fi' | 'en'
  view: 'koti',              // route token: koti | simulaattori | aiheet | lahteet | suomi | menetelma
  townCode: '837',           // Statistics Finland municipality code (837 = Tampere)
  presetId: null,            // id from content/projects.js when a real project preset is loaded
  design: {
    sizeMW: 50,              // IT capacity, MW
    cooling: 'air',          // 'air' | 'evaporative' | 'liquid'
    heatReuse: true,         // waste heat to district heating (only possible if the town has a network)
    site: 'industrial',      // 'industrial' | 'forest' | 'field'
    distanceM: 800,          // distance from the site to the nearest homes, metres
  },
  overrides: {},             // { coefKey: 'low' | 'typ' | 'high' } — user-pinned assumptions
  simStep: 1,                // simulator guide step: 1 town, 2 design, 3 guess, 4 run time, 5 your view
  year: 0,                   // timeline position (float, years since project start)
  playing: false,
  speed: 2,                  // timeline playback multiplier (1 | 2 | 4)
  guesses: {},               // { [guessKey]: number }
  persona: null,             // persona id from content/personas.js, or null
  priorities: {},            // { [themeKey]: 0..3 } importance chosen in "your view"
  question: '',              // the user's own question for a residents' meeting
  topic: null,               // selected theme on the topics page
  focusTheme: null,          // theme key the simulator should highlight (set by the topics page before go('simulaattori'))
  textSize: 'normal',        // 'normal' | 'large' — main.js sets <html data-text-size>
};

/** Keys saved to localStorage 'nd.state'. */
export const PERSISTED_KEYS = ['design', 'presetId', 'guesses', 'priorities', 'question', 'speed', 'textSize'];
const STATE_KEY = 'nd.state';

/** localStorage, or null when it does not exist (node) or is blocked (private mode, sandbox). */
function storage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch { return null; }
}

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const KEY_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);

// Validators return the cleaned value, or undefined to keep the default.
const VALIDATE = {
  design(v) {
    if (!isObj(v)) return undefined;
    const d = { ...DEFAULT_STATE.design };
    const size = num(v.sizeMW, 2, 1000);
    if (size !== undefined) d.sizeMW = size;
    if (['air', 'evaporative', 'liquid'].includes(v.cooling)) d.cooling = v.cooling;
    if (typeof v.heatReuse === 'boolean') d.heatReuse = v.heatReuse;
    if (['industrial', 'forest', 'field'].includes(v.site)) d.site = v.site;
    const dist = num(v.distanceM, 50, 10000);
    if (dist !== undefined) d.distanceM = dist;
    return d;
  },
  presetId(v) {
    if (v === null) return null;
    return typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined;
  },
  guesses(v) {
    if (!isObj(v)) return undefined;
    const out = {};
    for (const [k, x] of Object.entries(v)) if (KEY_RE.test(k) && typeof x === 'number' && Number.isFinite(x)) out[k] = x;
    return out;
  },
  priorities(v) {
    if (!isObj(v)) return undefined;
    const out = {};
    for (const [k, x] of Object.entries(v)) if (KEY_RE.test(k) && Number.isInteger(x) && x >= 0 && x <= 3) out[k] = x;
    return out;
  },
  question(v) { return typeof v === 'string' ? v.slice(0, 4000) : undefined; },
  speed(v) { return num(v, 0.25, 16); },
  textSize(v) { return v === 'normal' || v === 'large' ? v : undefined; },
};

let state = structuredClone(DEFAULT_STATE);

function load() {
  const ls = storage();
  if (!ls) return;
  try {
    const lang = ls.getItem('nd.lang');
    if (lang === 'fi' || lang === 'en') state.lang = lang;
    const town = ls.getItem('nd.town');
    if (town && /^\d{1,3}$/.test(town)) state.townCode = town.padStart(3, '0');
  } catch { /* storage unavailable: keep defaults */ }
  try {
    const raw = ls.getItem(STATE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (isObj(saved)) {
      for (const k of PERSISTED_KEYS) {
        if (!(k in saved)) continue;
        const v = VALIDATE[k](saved[k]);
        if (v !== undefined) state[k] = v;
      }
    }
  } catch { /* unreadable or blocked: keep defaults */ }
}

function save() {
  const ls = storage();
  if (!ls) return;
  try {
    const out = {};
    for (const k of PERSISTED_KEYS) out[k] = state[k];
    ls.setItem(STATE_KEY, JSON.stringify(out));
  } catch { /* full or blocked: ignore */ }
}

load();

export const store = {
  get: () => state,
  /** Shallow-merge `patch` into state. Nested objects (design, overrides, guesses, priorities) must be passed whole. */
  set(patch) {
    const prev = state;
    state = { ...state, ...patch };
    const ls = storage();
    if (ls) {
      try {
        if (patch.lang) ls.setItem('nd.lang', patch.lang);
        if (patch.townCode) ls.setItem('nd.town', patch.townCode);
      } catch { /* ignore */ }
    }
    if (PERSISTED_KEYS.some((k) => k in patch && patch[k] !== prev[k])) save();
    for (const fn of listeners) fn(state, prev);
  },
  /** Convenience for nested design changes: store.setDesign({ sizeMW: 150 }) */
  setDesign(patch) { store.set({ design: { ...state.design, ...patch }, presetId: null }); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Back to the defaults, keeping the language, the current view and the text size (an accessibility choice). */
  reset() { store.set(structuredClone({ ...DEFAULT_STATE, lang: state.lang, view: state.view, textSize: state.textSize })); },
  DEFAULT_STATE,
};
