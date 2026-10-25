// Hash router with bare tokens (#simulaattori). Bare tokens are the only hash form that survives
// when the app is published as a claude.ai artifact, so no "#/path" or "#key=value" here.
//
// Deep links are bare tokens too (characters a–z, 0–9 and "-" only). They open the simulator:
//   #hanke-jarvenpaa-dc                  a real project from content/projects.js (its town and preset)
//   #kunta-494                           a municipality by its 3-digit Statistics Finland code
//   #s-837-150-liquid-h0-forest-500      a scenario: s-<town>-<MW 2–1000>-<air|evaporative|liquid>-<h1|h0 heat reuse>-<industrial|forest|field>-<metres 50–10000>
// A deep link opens the simulator afresh (simEntryFields: playback stopped, preview year, step 1) and stays in the address
// bar; the simulator replaces it with #simulaattori once the user changes what the link describes, so reloading then
// keeps the user's later changes. go('simulaattori', { presetId, … }) from another page does the same as #hanke-<id>.
//
// Nothing here touches window/location/history at import time, so node can import this module (router.test.mjs).
import { store } from '../store.js';
import * as Towns from '../data/towns.js';
import * as Projects from '../content/projects.js';

export const ROUTES = ['koti', 'simulaattori', 'aiheet', 'lahteet', 'suomi', 'menetelma'];

const COOLINGS = ['air', 'evaporative', 'liquid'];
const SITES = ['industrial', 'forest', 'field'];
const MW_MIN = 2;
const MW_MAX = 1000;
const DIST_MIN = 50;
const DIST_MAX = 10000;

// Namespace imports with fallbacks: the data and content files may change shape while other areas work on them.
const townByCode = (code) => {
  try {
    if (typeof Towns.townByCode === 'function') return Towns.townByCode(code) || null;
    return (Towns.TOWNS || []).find((t) => t.code === code) || null;
  } catch { return null; }
};
const projectById = (id) => {
  try {
    if (typeof Projects.projectById === 'function') return Projects.projectById(id) || null;
    return (Projects.PROJECTS || []).find((p) => p.id === id) || null;
  } catch { return null; }
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const code3 = (code) => String(code ?? '').trim().padStart(3, '0');

/** 'hanke-<projectId>' */
export const projectToken = (id) => `hanke-${id}`;

/** 'kunta-<3-digit code>' */
export const townToken = (code) => `kunta-${code3(code)}`;

/** 's-<code>-<mw>-<cooling>-<h1|h0>-<site>-<distanceM>' for the current town and design. */
export function scenarioToken({ townCode, design } = {}) {
  const d = { ...store.DEFAULT_STATE.design, ...(design || {}) };
  const mw = Math.round(clamp(Number(d.sizeMW) || store.DEFAULT_STATE.design.sizeMW, MW_MIN, MW_MAX));
  const cooling = COOLINGS.includes(d.cooling) ? d.cooling : 'air';
  const site = SITES.includes(d.site) ? d.site : 'industrial';
  const dist = Math.round(clamp(Number(d.distanceM) || store.DEFAULT_STATE.design.distanceM, DIST_MIN, DIST_MAX));
  return `s-${code3(townCode ?? store.DEFAULT_STATE.townCode)}-${mw}-${cooling}-${d.heatReuse ? 'h1' : 'h0'}-${site}-${dist}`;
}

/** Full link to share: the current address without its hash + '#' + token. */
export function shareUrl(token) {
  const href = typeof location !== 'undefined' ? location.href : '';
  return `${href.split('#')[0]}#${token}`;
}

/** The design a project's preset describes, with defaults for anything missing and the size kept inside 2–1000 MW. */
function presetDesign(preset) {
  const def = store.DEFAULT_STATE.design;
  const p = preset || {};
  const size = Number(p.sizeMW);
  const dist = Number(p.distanceM);
  return {
    sizeMW: Number.isFinite(size) && size > 0 ? clamp(size, MW_MIN, MW_MAX) : def.sizeMW,
    cooling: COOLINGS.includes(p.cooling) ? p.cooling : def.cooling,
    heatReuse: typeof p.heatReuse === 'boolean' ? p.heatReuse : def.heatReuse,
    site: SITES.includes(p.site) ? p.site : def.site,
    distanceM: Number.isFinite(dist) && dist > 0 ? clamp(dist, DIST_MIN, DIST_MAX) : def.distanceM,
  };
}

const SCENARIO_RE = /^s-(\d{3})-(\d{1,4})-(air|evaporative|liquid)-(h[01])-(industrial|forest|field)-(\d{2,5})$/;

/**
 * Read a deep-link token. Returns { view: 'simulaattori', patch } for a valid project, town or scenario token, otherwise null.
 * Route names (koti, simulaattori, …) are not deep links and also return null.
 */
export function parseToken(token) {
  if (typeof token !== 'string') return null;
  const tok = token.trim().replace(/^#/, '').toLowerCase();
  if (!tok || tok.length > 120 || !/^[a-z0-9-]+$/.test(tok) || ROUTES.includes(tok)) return null;

  if (tok.startsWith('hanke-')) {
    const p = projectById(tok.slice(6));
    if (!p) return null;
    const town = p.townCode != null ? townByCode(code3(p.townCode)) : null;
    if (!town) return null;
    return {
      view: 'simulaattori',
      patch: { townCode: town.code ?? code3(p.townCode), presetId: p.id, design: presetDesign(p.preset), overrides: {}, year: 0, playing: false, simUi: {} },
    };
  }

  let m = /^kunta-(\d{3})$/.exec(tok);
  if (m) {
    const town = townByCode(m[1]);
    return town ? { view: 'simulaattori', patch: { townCode: town.code ?? m[1], presetId: null } } : null;
  }

  m = SCENARIO_RE.exec(tok);
  if (m) {
    const [, code, mwS, cooling, heat, site, distS] = m;
    const mw = Number(mwS);
    const dist = Number(distS);
    if (!Number.isInteger(mw) || mw < MW_MIN || mw > MW_MAX) return null;
    if (!Number.isInteger(dist) || dist < DIST_MIN || dist > DIST_MAX) return null;
    const town = townByCode(code);
    if (!town) return null;
    return {
      view: 'simulaattori',
      patch: { townCode: town.code ?? code, presetId: null, design: { sizeMW: mw, cooling, heatReuse: heat === 'h1', site, distanceM: dist }, overrides: {} },
    };
  }
  return null;
}

export function currentRoute() {
  const token = location.hash.replace(/^#/, '');
  return ROUTES.includes(token) ? token : 'koti';
}

let entrySeq = 0;
/**
 * Store fields for opening the simulator afresh from a deep link or a real project: playback stopped, back to year 0
 * (the simulator shows the preview year), step 1, and simEntry { kind: 'project' | 'town' | 'scenario', token, n } so the
 * simulator scrolls to the town card or the real-project card and keeps the token in the address bar.
 * A project also clears simUi (guesses not revealed); a town or scenario link keeps the guesses but not "played".
 */
export function simEntryFields(kind, token) {
  const ui = store.get().simUi || {};
  return {
    year: 0, playing: false, simStep: 1,
    simUi: kind === 'project' ? {} : { ...ui, played: false },
    simEntry: { kind, token, n: ++entrySeq },
  };
}

const entryKind = (tok) => (tok.startsWith('hanke-') ? 'project' : tok.startsWith('kunta-') ? 'town' : 'scenario');

/** Navigate to a view. Optional extra state is merged into the store first. A project patch (presetId) opens it afresh as #hanke-<id>. */
export function go(view, patch = {}) {
  const project = view === 'simulaattori' && typeof patch?.presetId === 'string' && patch.presetId ? projectToken(patch.presetId) : null;
  store.set({ ...patch, ...(project ? simEntryFields('project', project) : null), view });
  const target = project || view;
  if (location.hash.replace(/^#/, '') !== target) history.pushState(null, '', `#${target}`);
  window.scrollTo(0, 0);
}

export function startRouter() {
  const sync = () => {
    const tok = location.hash.replace(/^#/, '').trim().toLowerCase();
    const deep = parseToken(tok);
    if (deep) {
      store.set({ ...deep.patch, ...simEntryFields(entryKind(tok), tok), view: deep.view });
      if (location.hash !== `#${tok}`) history.replaceState(null, '', `#${tok}`);
      return;
    }
    if (store.get().view !== currentRoute()) store.set({ view: currentRoute() });
  };
  window.addEventListener('hashchange', sync);
  window.addEventListener('popstate', sync);
  sync();
}
