// State normalisation + world layout. The scene is drawn in a "world" 640 units wide;
// the ground sits a fixed distance from the bottom, extra height (phones) becomes sky.
import { clamp, fract, logNorm } from './util.js';

const PHASES = ['planning', 'construction', 'operation'];
const COOLING = ['air', 'evaporative', 'liquid'];
const SITES = ['industrial', 'forest', 'field'];
const TOWNS = ['small', 'medium', 'large'];
const DH_STATUSES = ['stats', 'statsEstimate', 'local', 'notInStats', 'default'];
export const EVENT_KEYS = ['zoning', 'eia', 'permit', 'zoningDecision', 'constructionStart', 'constructionPeak', 'opening',
  'expansion', 'heatFirst', 'heatWasted', 'refresh', 'endOfLife'];
/** Events that are drawn as residents at a notice board (a public event). */
export const PUBLIC_EVENTS = ['zoning', 'eia', 'permit', 'zoningDecision'];

const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);

/** halls (1–3) and hallStates (0..1 per hall) when the caller gives them; null = derive from sizeMW and the phase. */
function hallFields(st) {
  const n = num(st.halls, NaN);
  let halls = Number.isFinite(n) ? clamp(Math.round(n), 1, 3) : null;
  let states = Array.isArray(st.hallStates) && st.hallStates.length
    ? st.hallStates.slice(0, 3).map((v) => clamp(num(v, 0), 0, 1))
    : null;
  if (states && !halls) halls = states.length;
  if (states && states.length !== halls) {
    states = states.slice(0, halls);
    while (states.length < halls) states.push(0);
  }
  return { halls, hallStates: states };
}

/** Up to three on-stage counters, as plain strings (the caller formats and translates them). */
function counterList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c === 'object' && (c.label != null || c.value != null))
    .slice(0, 3)
    .map((c) => ({ label: c.label == null ? '' : String(c.label), value: c.value == null ? '' : String(c.value) }));
}

/**
 * The town template, drawn at one fixed scale for every town: 'village' (< 5 000 residents), 'smallTown'
 * (5 000–30 000), 'regional' (regional centre, 30 000–150 000) or 'city' (> 150 000). Uses the population when the
 * caller gives it (state.town.population, or state.population), else the coarse townSize.
 */
export const TOWN_KINDS = ['village', 'smallTown', 'regional', 'city'];
export function townKindFor(pop, townSize) {
  if (Number.isFinite(pop) && pop > 0) return pop < 5000 ? 'village' : pop < 30000 ? 'smallTown' : pop < 150000 ? 'regional' : 'city';
  return { small: 'smallTown', medium: 'regional', large: 'city' }[townSize] || 'regional';
}

/** Defensive defaults: the scene must never throw on a partial state. */
export function normalize(st = {}, prefersReduced = false) {
  const year = num(st.year, 0);
  const pop = num(st.town && typeof st.town === 'object' ? st.town.population : NaN, num(st.population, NaN));
  let townSize = st.townSize;
  if (!TOWNS.includes(townSize)) {
    townSize = !Number.isFinite(pop) ? 'medium' : pop < 15000 ? 'small' : pop < 80000 ? 'medium' : 'large';
  }
  const townKind = TOWN_KINDS.includes(st.townKind) ? st.townKind : townKindFor(pop, townSize);
  const dhStatus = DH_STATUSES.includes(st.dhStatus) ? st.dhStatus : null;
  const reuseWanted = st.heatReuse !== false;
  // hasDistrictHeat = "draw a heating plant". A town missing from the district-heat statistics may still have a
  // local plant: when the heat is reused there, the plant is drawn and labelled as uncertain.
  const hasDistrictHeat = st.hasDistrictHeat !== false || (dhStatus === 'notInStats' && reuseWanted);
  const { halls, hallStates } = hallFields(st);
  const share = num(st.heatHomesShare, NaN);
  const staff = num(st.staff, NaN);
  return {
    year,
    phase: PHASES.includes(st.phase) ? st.phase : 'planning',
    phaseProgress: clamp(num(st.phaseProgress, 0.5), 0, 1),
    sizeMW: clamp(num(st.sizeMW, 50), 1, 2000),
    cooling: COOLING.includes(st.cooling) ? st.cooling : 'air',
    heatReuse: reuseWanted && hasDistrictHeat,
    heatReuseChosen: reuseWanted,
    heatAssumed: !!st.heatAssumed,
    hasDistrictHeat,
    dhStatus,
    plantUncertain: hasDistrictHeat && dhStatus === 'notInStats',
    site: SITES.includes(st.site) ? st.site : 'industrial',
    distanceM: clamp(num(st.distanceM, 800), 50, 20000),
    townSize,
    townKind,
    townName: st.townName ?? null,
    season: Number.isFinite(+st.season) && st.season !== null ? fract(+st.season) : fract(year),
    trucksPerDay: Math.max(0, num(st.trucksPerDay, 0)),
    workers: Math.max(0, num(st.workers, 0)),
    lang: st.lang === 'en' ? 'en' : 'fi',
    reducedMotion: st.reducedMotion == null ? prefersReduced : !!st.reducedMotion,
    highlight: st.highlight || null,
    halls,
    hallStates,
    eventKey: EVENT_KEYS.includes(st.eventKey) ? st.eventKey : null,
    heatHomesShare: Number.isFinite(share) ? clamp(share, 0, 1) : null,
    staff: Number.isFinite(staff) ? Math.max(0, staff) : null,
    counters: counterList(st.counters),
    presentation: !!st.presentation,
    playing: st.playing == null ? null : !!st.playing,
  };
}

export const WORLD_W = 520;
/** The town's edge toward the site (the nearest homes, or the heating plant). The same for every town template. */
export const TOWN_RIGHT = 196;

/**
 * Compute world positions for everything. Wpx/Hpx = canvas size in CSS pixels.
 * One fixed scale for every town and every size: a house is always about 20 units wide, a storey 5.4 units, and the
 * data centre grows with its power (log), so a 500 MW campus dwarfs a village and sits at the edge of a city.
 */
export function computeLayout(st, Wpx, Hpx) {
  const narrow = Wpx < 560;
  const townRight = TOWN_RIGHT;

  const d = logNorm(st.distanceM, 200, 3000);   // 0 = 200 m, 1 = 3 km (log)
  const sz = logNorm(st.sizeMW, 5, 1000);       // 0 = 5 MW, 1 = 1 000 MW (log)
  const g = Math.pow(sz, 1.5);                  // 10 MW ≈ 0.05, 50 MW ≈ 0.28, 150 MW ≈ 0.51, 500 MW ≈ 0.81
  const s0 = 1 - 0.36 * d;

  // data-centre plot in local units (scaled by s); the caller may fix the number of halls (built in phases)
  // 10 MW ≈ two houses long and one house high; 500 MW ≈ a whole village long and as high as a five-storey block
  const halls = st.halls || (st.sizeMW >= 300 ? 3 : st.sizeMW >= 120 ? 2 : 1);
  const hallTotal = 34 + 190 * g;
  const gap = halls > 1 ? 7 : 0;
  const hallW = (hallTotal - gap * (halls - 1)) / halls;
  const hallH = 12 + 28 * g;
  const depth = 12 + 22 * g;
  const hallX = 10;
  const gensX = hallX + hallTotal + depth * 0.6 + 6;
  const gensN = Math.max(2, Math.round(2 + 8 * g));
  const gensW = 16 + 4 * Math.ceil(gensN / 2);
  const subX = gensX + gensW + 6;
  const subW = 26;
  const plotW = subX + subW + 6;

  const plotLeft = townRight + 26 + d * 118;
  // a big campus far away may reach past the usual world width: the world grows (the camera zooms out) instead
  const worldW = Math.max(WORLD_W, plotLeft + plotW * s0 + 10);
  // phones: zoom in on the part between the town's edge and the plot (the story), crop the rest
  // the visible world width grows with the canvas: small canvases zoom in, big ones show the whole town
  // (16:9 canvases need at least ~410 units so the crane and the vapour plume still fit under the top edge)
  // A big campus far away zooms out a little (up to a limit), so a fair piece of the town stays in the picture too.
  const homeRight = st.hasDistrictHeat ? townRight - 42 : townRight;
  const plotVis = plotLeft + plotW * s0 * (narrow ? 0.7 : 0.88) + 14;   // the plot's right part may be cropped
  const needTown = narrow ? 80 : 130;                           // world units of town kept left of the nearest homes
  const baseVW = narrow ? 360 : clamp(410 + (Wpx - 560) * 0.3, 410, worldW);
  const VW = Math.min(worldW, Math.max(baseVW, Math.min(narrow ? 390 : 560, plotVis - (homeRight - needTown))));
  let view = { x0: 0, x1: worldW };
  if (VW < worldW) {
    // keep at least the nearest homes and most of the plot in view
    const x0 = Math.max(0, Math.min(plotVis - VW, homeRight - 40));
    view = { x0, x1: x0 + VW };
  }
  const k = Wpx / (view.x1 - view.x0);
  const Hw = Hpx / k;
  const yB = Hw - 60;          // ground line of the town's front row
  const roadY = Hw - 31;       // centre of the foreground road
  const yH = Hw - 172;         // horizon
  const s = 1 - 0.36 * d;                       // farther → smaller (perspective)
  const base = yB - d * 34;                     // farther → higher up (toward the horizon)
  const toWorld = (lx, ly = 0) => [plotLeft + lx * s, base + ly * s];

  return {
    narrow, view, k, Hw, yB, roadY, yH, d, sz, townRight,
    plot: { x: plotLeft, y: base, s, w: plotW * s, plotW, halls, hallTotal, hallW, hallH, depth, hallX, gap, gensX, gensN, gensW, subX, subW },
    toWorld,
    gateX: plotLeft + 4 * s,
    // nearest homes (front row ends at townRight)
    homeX: townRight,
  };
}
