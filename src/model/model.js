// Impact model for "Naapurina datakeskus" (SPEC §5).
// Pure and deterministic: the same design + town + options always give the same result.
// How it works, in plain words:
//   1. Every uncertain coefficient (COEF, low < high) is drawn 400 times from a triangular distribution
//      (low, typical, high) with a seeded random-number generator. A user override pins it to one value.
//      Wide ranges (low > 0 and high at least 3 × low, e.g. jobs per MW 0.25–0.8) are drawn in log space:
//      the triangle is built on ln(low), ln(typ), ln(high) and the draw is exponentiated. A skewed linear
//      triangle would put the middle result well above the typical value; in log space it sits near it.
//      Every draw still uses exactly one uniform random number per coefficient, in a fixed order, so
//      different designs share the same random numbers and pinning one coefficient leaves the others alone.
//   2. For each of the 400 draws we calculate every metric for every year 0–30.
//   3. We report the 10th percentile as `low`, the median as `typ` and the 90th percentile as `high`.
//      So 80 % of the calculations fall inside the low–high band. When a metric is simply (one value per draw) ×
//      (a factor for the year), e.g. electricity × the share of the year in operation, its yearly percentiles are
//      the full-capacity percentiles × that factor; this is exact and saves sorting 400 values for every year.
// MW always means IT load (server capacity). The grid connection and the site's total use are derived from it.
import { COEF, UNCERTAIN_KEYS, SRC } from './coefficients.js';

// ------------------------------------------------------------------ public constants

export const DESIGN_OPTIONS = {
  // quick picks; any size within sizeRange works (simulate clamps to 2–1000 MW)
  sizes: [{ key: 'small', mw: 10 }, { key: 'medium', mw: 50 }, { key: 'large', mw: 150 }, { key: 'giant', mw: 500 }],
  sizeRange: { min: 5, max: 1000 },
  cooling: ['air', 'evaporative', 'liquid'],
  site: ['industrial', 'forest', 'field'],
  distance: { min: 200, max: 3000, step: 50 },
};

export const THEME_KEYS = ['energy', 'environment', 'jobs', 'traffic', 'land', 'safety', 'future'];

export const METRIC_KEYS = {
  energy: ['electricity', 'gridPeak', 'heatAvailable', 'heatPumpElectricity', 'heatUsed'],
  environment: ['water', 'noise', 'co2Electricity', 'co2HeatAvoided', 'co2Construction'],
  jobs: ['jobsConstruction', 'jobsPermanent', 'jobsIndirect', 'propertyTax', 'electricityTax', 'investment'],
  traffic: ['trucks'],
  land: ['land'],
  safety: ['backupPower'],
  future: ['eWaste'],
};

/** metricKey → themeKey */
export const METRIC_THEME = Object.fromEntries(Object.entries(METRIC_KEYS).flatMap(([th, ks]) => ks.map((k) => [k, th])));

/**
 * Used when no town is chosen (town = null). An illustrative medium-sized Finnish town built from national averages:
 * about 2 residents per household; unemployment about 11 %; property tax ≈ €440 per resident (Verohallinto 2026:
 * €2.44 billion / 5.6 million residents) at the 2026 national average general rate 1.18 %; district heat for about
 * half of the residents (3.0 million of 5.6 million live in district-heated buildings, Energiateollisuus 2024) at
 * 5.9 MWh per resident, of which residential buildings use 54 % → about 110 GWh.
 */
export const DEFAULT_TOWN = {
  code: '000',
  name: { fi: 'esimerkkikunta', sv: 'exempelkommun', en: 'an example town' },
  population: 20000, households: 10000, employed: 8900, unemployed: 1100, unemploymentPct: 11, jobs: 8000,
  propertyTax: { generalRatePct: 1.18, revenueEur: 8700000 },
  districtHeat: { has: true, demandGWh: 110, residentsSharePct: 50, seller: null, estimated: true },
  centroid: null,
  isDefault: true,
  note: {
    fi: 'Kuvitteellinen keskikokoinen kunta (20 000 asukasta), jonka luvut on johdettu koko maan keskiarvoista.',
    en: 'An imaginary medium-sized town (20,000 residents) whose figures are derived from national averages.',
  },
};

export const GUESS_TARGETS = [
  {
    key: 'jobs', metric: 'jobsPermanent', comparison: null, min: 1, max: 2000, scale: 'log',
    question: { fi: 'Montako pysyvää työpaikkaa datakeskus tuo, kun se on valmis?', en: 'How many permanent jobs will the data centre bring once it is running?' },
    unit: { fi: 'työpaikkaa', en: 'jobs' },
  },
  {
    key: 'homesElectricity', metric: 'electricity', comparison: 'homes', min: 100, max: 1000000, scale: 'log',
    question: { fi: 'Kuinka monen kodin sähkönkulutusta datakeskuksen sähkönkulutus vastaa?', en: 'How many homes use as much electricity as the data centre?' },
    unit: { fi: 'kotia', en: 'homes' },
  },
  {
    key: 'homesHeat', metric: 'heatUsed', comparison: 'homes', min: 10, max: 1000000, scale: 'log',
    question: { fi: 'Kuinka monta kotia datakeskuksen hukkalämmöllä lämmitettäisiin kunnassasi?', en: 'How many homes in your town would the data centre’s waste heat warm?' },
    unit: { fi: 'kotia', en: 'homes' },
    // Used when heat reuse is off or the town's network is not in the statistics: ask about the potential instead.
    fallback: {
      metric: 'heatAvailable', comparison: 'homes',
      question: { fi: 'Kuinka monta kotia datakeskuksen hukkalämmöllä voisi lämmittää, jos sille olisi käyttöä?', en: 'How many homes could the data centre’s waste heat warm if there were a use for it?' },
    },
  },
];

/** District-heat statuses for which the heat question asks about real use (not the potential). */
const KNOWN_DH = new Set(['stats', 'statsEstimate', 'local', 'default']);

/** Returns the guess target to use for this town + design (homesHeat falls back to the potential when heat cannot be used). */
export function resolveGuessTarget(target, town, design) {
  if (!target || !target.fallback) return target;
  const t = normalizeTown(town);
  const usable = !!(design && design.heatReuse) && KNOWN_DH.has(t.dhStatus);
  return usable ? target : { ...target, ...target.fallback, usesFallback: true };
}

/**
 * District-heat status of a town, as the model uses it:
 * 'stats' (network in Finnish Energy's statistics), 'statsEstimate' (in the statistics, demand estimated),
 * 'local' (verified small local network added by hand), 'notInStats' (has: false — no network in the statistics;
 * a small local one may still exist) or 'default' (no town chosen).
 */
export function districtHeatStatus(town) {
  return normalizeTown(town).dhStatus;
}

// ------------------------------------------------------------------ helpers

const YEARS = Array.from({ length: 31 }, (_, i) => i);
const N_YEARS = YEARS.length;
const HORIZON = 31; // the last year interval is [30, 31)
const LOG_RATIO = 3; // ranges with high / low ≥ 3 are sampled in log space

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inverse-CDF sample from a triangular(low, mode, high) distribution. */
function triangular(u, lo, mode, hi) {
  if (hi <= lo) return mode;
  const fc = (mode - lo) / (hi - lo);
  return u < fc ? lo + Math.sqrt(u * (hi - lo) * (mode - lo)) : hi - Math.sqrt((1 - u) * (hi - lo) * (hi - mode));
}

const LEVELS = ['low', 'typ', 'high'];

/** Draw `n` coefficient sets. Every uncertain key gets one uniform number per draw in a fixed order, so different
 *  designs share the same random numbers (a fair comparison between designs). Wide ranges are drawn in log space. */
function drawSamples(n, seed, overrides) {
  const rand = mulberry32(seed);
  const out = new Array(n);
  const pinned = {};
  for (const [k, lvl] of Object.entries(overrides || {})) {
    if (COEF[k] && LEVELS.includes(lvl)) pinned[k] = COEF[k][lvl];
  }
  // Fixed (and pinned) values live on a shared prototype; each draw only owns its uncertain values.
  const fixed = {};
  for (const k of Object.keys(COEF)) fixed[k] = k in pinned ? pinned[k] : COEF[k].typ;
  const free = UNCERTAIN_KEYS.map((k) => {
    const c = COEF[k];
    const log = c.low > 0 && c.high / c.low >= LOG_RATIO;
    return log
      ? { k, pin: k in pinned, log, lo: Math.log(c.low), mode: Math.log(c.typ), hi: Math.log(c.high) }
      : { k, pin: k in pinned, log, lo: c.low, mode: c.typ, hi: c.high };
  });
  for (let i = 0; i < n; i++) {
    const s = Object.create(fixed);
    for (const f of free) {
      const u = rand(); // always drawn, so pinning one key does not change the others
      if (f.pin) continue;
      const v = triangular(u, f.lo, f.mode, f.hi);
      s[f.k] = f.log ? Math.exp(v) : v;
    }
    out[i] = s;
  }
  return out;
}

/** The draws depend only on (n, seed, overrides), so they are reused while the user changes the design.
 *  Draws are never modified after they are made. */
const SAMPLE_CACHE = new Map();
function cachedSamples(n, seed, overrides) {
  const pins = Object.keys(overrides || {}).filter((k) => COEF[k] && LEVELS.includes(overrides[k])).sort().map((k) => `${k}=${overrides[k]}`).join(',');
  const key = `${n}|${seed}|${pins}`;
  let s = SAMPLE_CACHE.get(key);
  if (!s) {
    s = drawSamples(n, seed, overrides);
    SAMPLE_CACHE.set(key, s);
    if (SAMPLE_CACHE.size > 12) SAMPLE_CACHE.delete(SAMPLE_CACHE.keys().next().value);
  }
  return s;
}

function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const i = Math.floor(pos);
  const f = pos - i;
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * f : sorted[i];
}

let SORT_BUF = new Float64Array(0);
/** p10 / p50 / p90 of an array (typed or plain); sorts a reused buffer instead of allocating one. */
function pct3(arr) {
  if (SORT_BUF.length !== arr.length) SORT_BUF = new Float64Array(arr.length);
  SORT_BUF.set(arr);
  const s = SORT_BUF.sort();
  return { low: clean(quantile(s, 0.1)), typ: clean(quantile(s, 0.5)), high: clean(quantile(s, 0.9)) };
}

const clean = (v) => (Number.isFinite(v) ? v : 0);

const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));

function roundSig(v, sig = 2) {
  if (!Number.isFinite(v) || v === 0) return 0;
  const p = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(v))));
  return Math.round(v * p) / p;
}

const NF_CACHE = new Map();
function numberFormat(lang, digits) {
  const key = `${lang}${digits}`;
  let f = NF_CACHE.get(key);
  if (!f) { f = new Intl.NumberFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { maximumFractionDigits: digits }); NF_CACHE.set(key, f); }
  return f;
}
/** Plain number for text written by the model itself (town context etc.), 2 significant figures. */
function nf(v, lang) {
  const r = roundSig(v);
  const digits = Math.abs(r) < 1 ? 2 : Math.abs(r) < 10 ? 1 : 0;
  return numberFormat(lang, digits).format(r);
}
/** Inputs and legal values at their own precision (up to 4 decimals, no rounding to 2 significant figures):
 *  1.25 → "1,25", 2.24 → "2,24", 22.5 → "22,5". */
function nfx(v, lang) {
  return numberFormat(lang, 4).format(v);
}
const bi = (fn) => ({ fi: fn('fi'), en: fn('en') });
const clone = typeof structuredClone === 'function' ? structuredClone : (v) => JSON.parse(JSON.stringify(v));

// ------------------------------------------------------------------ town

const MWH_PER_RESIDENT = 5.9; // district heat per resident in a district-heated building (town-data fallback)
const RESIDENTIAL_SHARE = 0.54; // residential buildings' share of all district heat (Energiateollisuus 2024)
/** Estimated district-heat demand (GWh/yr) when `share` of the residents live on the network. */
const demandFromResidents = (population, share) => (population * share * MWH_PER_RESIDENT) / RESIDENTIAL_SHARE / 1000;

function normalizeTown(town) {
  const t = town || DEFAULT_TOWN;
  const isDefault = !town || !!t.isDefault;
  const nameObj = t.name || DEFAULT_TOWN.name;
  const name = { fi: nameObj.fi || nameObj.en || '', en: nameObj.en || nameObj.fi || '' };
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const population = num(t.population);
  const households = num(t.households);
  const employed = num(t.employed);
  let unemployed = num(t.unemployed);
  const upct = num(t.unemploymentPct);
  if (unemployed == null && upct != null && employed != null && upct < 100) unemployed = (employed * upct) / (100 - upct);
  const pt = t.propertyTax || {};
  const rateKnown = num(pt.generalRatePct) != null && pt.generalRatePct > 0;
  const rate = rateKnown ? pt.generalRatePct : 1.18;
  const revenue = num(pt.revenueEur);
  const dh = t.districtHeat || {};
  const hasDH = dh.has === true;
  let demandGWh = num(dh.demandGWh);
  const demandKnown = demandGWh != null && demandGWh > 0;
  let dhEstimated = !!dh.estimated;
  let dhStatus;
  if (isDefault) dhStatus = 'default';
  else if (hasDH && dh.local === true) dhStatus = 'local';
  else if (hasDH) dhStatus = dhEstimated || !demandKnown ? 'statsEstimate' : 'stats';
  else dhStatus = 'notInStats'; // has: false only means "not in Finnish Energy's statistics"
  // Demand drawn per sample from heat.localNetworkShare: no network in the statistics, or a local one of unknown size.
  const demandSampled = dhStatus === 'notInStats' || (dhStatus === 'local' && !demandKnown);
  if (demandSampled) {
    demandGWh = population != null ? demandFromResidents(population, COEF['heat.localNetworkShare'].typ) : 0;
    dhEstimated = true;
  } else if (hasDH && !demandKnown) {
    // Unknown demand: residents in district-heated buildings × 5.9 MWh, residential = 54 % of all district heat.
    const share = num(dh.residentsSharePct) != null ? dh.residentsSharePct / 100 : 0.5;
    demandGWh = population != null ? demandFromResidents(population, share) : 110;
    dhEstimated = true;
  }
  return {
    name, isDefault, population, households, employed, unemployed, rate, rateKnown, revenue,
    hasDH, dhStatus, demandSampled, demandGWh: demandGWh || 0, dhEstimated, seller: dh.seller || null,
  };
}

// ------------------------------------------------------------------ timeline

/** Phases scale with size. Durations are illustrative: planning 3 years with an EIA, 2 years from 30 MW, otherwise
 *  1 year; construction as in the Järvenpää EIA (earthworks under a year, then about 1.5 years). Large sites are
 *  built hall by hall like Microsoft's capital-region sites. Halls: 1 below 120 MW, 2 from 120 MW, 3 from 300 MW,
 *  built one after another 2 years apart. */
function buildTimeline(mw) {
  const fuel = mw * COEF['backup.fuelPerMW'].typ;
  const needsEIA = fuel >= COEF['backup.eiaFuelMW'].typ; // at least 300 MW of fuel power: YVA-laki 252/2017, liite 1, 7a
  const needsPermit = fuel >= COEF['backup.permitFuelMW'].typ; // 50 MW or more: environmental permit
  const needsRegistration = !needsPermit && fuel >= 1; // 1–50 MW: registered (VNA 1065/2017)
  const plan = needsEIA ? 3 : mw >= 30 ? 2 : 1;
  const build = mw >= 300 ? 2.5 : mw >= 100 ? 2 : mw >= 30 ? 1.5 : 1;
  const halls = mw >= 300 ? 3 : mw >= 120 ? 2 : 1;
  const gap = 2;
  const open = plan + build;
  const online = Array.from({ length: halls }, (_, k) => open + gap * k);
  const share = 1 / halls;
  const windows = [{ a: plan, b: open, share }];
  for (let k = 1; k < halls; k++) windows.push({ a: online[k] - gap, b: online[k], share });
  const lastOnline = online[halls - 1];
  const refreshEvery = COEF['ewaste.refreshYears'].typ;
  const refreshes = [];
  for (let y = open + refreshEvery; y < 30; y += refreshEvery) refreshes.push(y);
  const endOfLife = Math.min(29, open + 20);
  return { fuel, needsEIA, needsPermit, needsRegistration, plan, build, open, online, share, windows, lastOnline, halls, refreshes, endOfLife, refreshEvery };
}

function shapeAt(t, w, peakPos) {
  if (t < w.a || t > w.b) return 0;
  const x = (t - w.a) / (w.b - w.a);
  return x <= peakPos ? 0.4 + 0.6 * (x / peakPos) : 1 - 0.5 * ((x - peakPos) / (1 - peakPos));
}

/** Year-interval factors that depend only on the design. */
function yearFactors(tl, heatStart) {
  const f = {
    opFrac: new Float64Array(N_YEARS), capEnd: new Float64Array(N_YEARS), taxCap: new Float64Array(N_YEARS),
    heatFrac: new Float64Array(N_YEARS), heatTime: new Float64Array(N_YEARS), spread: new Float64Array(N_YEARS),
    work: new Float64Array(N_YEARS), truck: new Float64Array(N_YEARS), building: new Uint8Array(N_YEARS),
    landOn: new Uint8Array(N_YEARS), refresh: new Uint8Array(N_YEARS), refreshCap: new Float64Array(N_YEARS),
  };
  for (let y = 0; y < N_YEARS; y++) {
    for (const on of tl.online) {
      f.opFrac[y] += tl.share * overlap(y, y + 1, on, HORIZON);
      if (on < y + 1) f.capEnd[y] += tl.share;
      if (Math.ceil(on) <= y) f.taxCap[y] += tl.share; // property tax is set by the situation on 1 January
      if (heatStart != null) f.heatFrac[y] += tl.share * overlap(y, y + 1, Math.max(on, heatStart), HORIZON);
    }
    if (heatStart != null) f.heatTime[y] = overlap(y, y + 1, heatStart, HORIZON);
    let work = 0;
    let truck = 0;
    for (const w of tl.windows) {
      f.spread[y] += (w.share * overlap(y, y + 1, w.a, w.b)) / (w.b - w.a);
      if (overlap(y, y + 1, w.a, w.b) > 0) f.building[y] = 1;
      for (let m = 0.05; m < 1; m += 0.1) {
        work = Math.max(work, shapeAt(y + m, w, 0.5));
        truck = Math.max(truck, shapeAt(y + m, w, 0.25));
      }
    }
    f.work[y] = work;
    f.truck[y] = truck;
    f.landOn[y] = y + 1 > tl.plan ? 1 : 0;
  }
  for (const r of tl.refreshes) f.refresh[Math.floor(r)] = 1;
  for (let y = 0; y < N_YEARS; y++) f.refreshCap[y] = f.refresh[y] ? f.capEnd[y] : 0;
  return f;
}

// ------------------------------------------------------------------ metric definitions (text)

const UNITS = {
  gwh: { fi: 'GWh/v', en: 'GWh/yr' }, mw: { fi: 'MW', en: 'MW' }, m3: { fi: 'm³/v', en: 'm³/yr' }, db: { fi: 'dB', en: 'dB' },
  tyr: { fi: 't CO₂/v', en: 't CO₂/yr' }, t: { fi: 't CO₂', en: 't CO₂' }, people: { fi: 'henkeä', en: 'people' },
  jobs: { fi: 'työpaikkaa', en: 'jobs' }, eurYr: { fi: '€/v', en: '€/yr' }, eur: { fi: '€', en: '€' },
  perDay: { fi: 'raskasta ajoneuvoa/pv', en: 'heavy vehicles/day' }, ha: { fi: 'ha', en: 'ha' },
  mwFuel: { fi: 'MW polttoainetehoa', en: 'MW of fuel power' }, tCycle: { fi: 't / vaihtokierros', en: 't per refresh' },
};

// The unit already says "/v" (per year), so these never repeat "vuodessa".
const WHEN = {
  op: { fi: 'kun datakeskus on täysin käytössä', en: 'once fully running' },
  opNow: { fi: 'kun kaikki salit ovat käytössä', en: 'once all halls are running' },
  peak: { fi: 'rakentamisen vilkkaimpana aikana', en: 'at the busiest time of construction' },
  total: { fi: 'yhteensä koko rakentamisen aikana', en: 'in total over the whole construction' },
  noise: { fi: 'lähimmissä kodeissa, kun datakeskus on käytössä', en: 'at the nearest homes once the data centre is running' },
  notInUse: { fi: 'nyt ei käytössä', en: 'not in use now' },
};

const TITLES = {
  electricity: { fi: 'Sähkönkulutus', en: 'Electricity use' },
  gridPeak: { fi: 'Sähköliittymän huipputeho', en: 'Peak grid connection' },
  heatAvailable: { fi: 'Palvelimista talteen saatava lämpö', en: 'Heat captured from the servers' },
  heatPumpElectricity: { fi: 'Lämpöpumppujen sähkö', en: 'Heat-pump electricity' },
  heatUsed: { fi: 'Lämpöä kaukolämpöön', en: 'Heat delivered to district heating' },
  water: { fi: 'Vedenkulutus', en: 'Water use' },
  noise: { fi: 'Melu lähimmissä kodeissa', en: 'Noise at the nearest homes' },
  co2Electricity: { fi: 'Sähkön hiilidioksidipäästöt', en: 'CO₂ from electricity' },
  co2HeatAvoided: { fi: 'Lämmityksen vältetyt päästöt', en: 'CO₂ avoided in heating' },
  co2Construction: { fi: 'Rakentamisen päästöt', en: 'CO₂ from construction' },
  jobsConstruction: { fi: 'Rakentajia työmaalla', en: 'Construction workers on site' },
  jobsPermanent: { fi: 'Pysyvät työpaikat', en: 'Permanent jobs' },
  jobsIndirect: { fi: 'Välilliset työpaikat', en: 'Indirect jobs' },
  propertyTax: { fi: 'Kiinteistövero kunnalle', en: 'Property tax to the town' },
  electricityTax: { fi: 'Sähkövero valtiolle', en: 'Electricity tax to the state' },
  investment: { fi: 'Investointi', en: 'Investment' },
  trucks: { fi: 'Raskas liikenne', en: 'Heavy traffic' },
  land: { fi: 'Pinta-ala', en: 'Land area' },
  backupPower: { fi: 'Varavoimakoneet', en: 'Backup generators' },
  eWaste: { fi: 'Vaihdettava elektroniikka', en: 'Electronics replaced' },
};

/** Running totals (through the end of each year) are reported for these metrics. */
const CUMULATIVE_KEYS = ['electricity', 'heatUsed', 'heatPumpElectricity', 'propertyTax', 'co2Electricity', 'co2HeatAvoided'];

/** Comparisons counted in whole units (machines): their percentiles are rounded to whole numbers. */
const WHOLE_COMPS = new Set(['backupPower.generators']);

// ------------------------------------------------------------------ simulate

const ALL_KEYS = Object.values(METRIC_KEYS).flat();

/** Metrics whose yearly value is (one value per draw) × (a factor that depends only on the year, ≥ 0).
 *  Their yearly percentiles are the headline percentiles × that factor, which is exact, so they need no
 *  per-year storage or sorting. metric → yearFactors() field. */
const SEPARABLE = {
  electricity: 'opFrac', gridPeak: 'capEnd', heatAvailable: 'opFrac', water: 'opFrac', co2Electricity: 'opFrac',
  co2Construction: 'spread', jobsConstruction: 'work', propertyTax: 'taxCap', electricityTax: 'opFrac',
  investment: 'spread', land: 'landOn', backupPower: 'capEnd', eWaste: 'refreshCap',
};
/** The other metrics are stored per draw and year. */
const YEARLY_KEYS = ['heatPumpElectricity', 'heatUsed', 'noise', 'co2HeatAvoided', 'jobsPermanent', 'jobsIndirect', 'trucks'];

/** Comparisons computed per draw: [metric, comparison key, store field, town figure it needs (or null)].
 *  A comparison whose town figure is missing (e.g. no household count) is left out. */
const COMP_DEFS = [
  ['electricity', 'homes', 'elHomes', null],
  ['electricity', 'pctFinland', 'elPctFinland', null],
  ['electricity', 'townHomes', 'elTownHomes', 'households'],
  ['gridPeak', 'pctOL3', 'gpPctOL3', null],
  ['heatAvailable', 'homes', 'haHomes', null],
  ['heatAvailable', 'pctTownDH', 'haPctTownDH', 'townDemand'],
  ['heatPumpElectricity', 'avgMW', 'hpAvgMW', null],
  ['heatPumpElectricity', 'pctOfDc', 'hpPctOfDc', null],
  ['heatUsed', 'homes', 'huHomes', null],
  ['heatUsed', 'pctTownDH', 'huPctTownDH', 'townDemand'],
  ['water', 'residents', 'waResidents', null],
  ['water', 'pctTown', 'waPctTown', 'population'],
  ['noise', 'construction', 'noConstruction', null],
  ['noise', 'guideNight', 'noGuideNight', null],
  ['noise', 'guideDay', 'noGuideDay', null],
  ['noise', 'guideNatureNight', 'noGuideNature', null],
  ['co2Electricity', 'net', 'ceNet', null],
  ['co2HeatAvoided', 'heatPumpCo2', 'chHeatPumpCo2', null],
  ['co2Construction', 'yearsOfElectricity', 'ccYears', null],
  ['jobsConstruction', 'carsPerDay', 'jcCarsPerDay', null],
  ['jobsPermanent', 'pctUnemployed', 'jpPctUnemployed', 'unemployed'],
  ['jobsIndirect', 'pctUnemployed', 'jiPctUnemployed', 'unemployed'],
  ['propertyTax', 'pctTownRevenue', 'ptPctRevenue', 'revenue'],
  ['propertyTax', 'perResident', 'ptPerResident', 'population'],
  ['electricityTax', 'vsPropertyTax', 'etVsPropertyTax', null],
  ['investment', 'buildings', 'inBuildings', null],
  ['trucks', 'operation', 'trOperation', null],
  ['land', 'pitches', 'laPitches', null],
  ['backupPower', 'generators', 'bpGenerators', null],
  ['backupPower', 'diesel', 'bpDiesel', null],
  ['backupPower', 'testCo2', 'bpTestCo2', null],
  ['eWaste', 'perYear', 'ewPerYear', null],
];

/** Work buffers, reused between calls (every element is overwritten by each run, nothing is kept in a result). */
let STORE = null;
function storeFor(n) {
  if (STORE && STORE.n === n) return STORE;
  const series = {};
  const head = {};
  for (const k of YEARLY_KEYS) series[k] = new Float64Array(n * N_YEARS);
  for (const k of ALL_KEYS) head[k] = new Float64Array(n);
  const cmp = {};
  for (const def of COMP_DEFS) cmp[def[2]] = new Float64Array(n);
  STORE = { n, series, head, cmp, col: new Float64Array(n), prev: new Float64Array(n) };
  return STORE;
}

/** All metrics of one draw `c`: headline values, comparisons and the yearly series that are not separable. */
function runSample(i, c, P, S) {
  const MW = P.MW;
  const F = P.F;
  const cop = c[P.copKey];
  const itFull = MW * c.utilisation * 8.76; // GWh of server energy per year at full capacity
  const elFull = itFull * c[P.pueKey];
  const capturedFull = itFull * c['heat.capture']; // lukewarm heat from the servers, no heat-pump electricity
  const potentialFull = ((capturedFull * cop) / (cop - 1)) * c['heat.usableShare']; // deliverable incl. heat-pump electricity
  const demand = P.demandSampled ? P.demandPerShare * c['heat.localNetworkShare'] : P.demandFixed;
  const capDH = demand * c['heat.maxCoverage'];
  const heatUsedFull = P.reuseOn ? Math.min(potentialFull, capDH) : 0;
  const hpElecFull = heatUsedFull / cop;
  const waterFull = itFull * c[P.wueKey] * 1000; // GWh × L/kWh → m³
  const grid = c['grid.co2'];
  const avoidPerGWh = c['heat.co2Replaced'] - grid / cop; // t per GWh of heat delivered (GWh × g/kWh = t)
  const noiseFull = c['noise.opRef'] + P.sizeDb - P.logDist;
  const noiseHead = Math.max(20, noiseFull);
  const noiseCon = Math.max(20, c['noise.constructionLwa'] - 20 * Math.log10(P.distanceM) - 8);
  const co2ConTotal = MW * c['construction.co2PerMW'];
  const workersPeak = Math.max(15, MW * c['jobs.constructionPerMW']);
  const permPerCap = MW * c['jobs.permanentPerMW'];
  const permFull = Math.max(5, permPerCap);
  const mult = c['jobs.indirectMultiplier'];
  const propFull = MW * c['tax.propertyPerMW'] * P.rateRatio;
  const taxRate = c['tax.electricity'];
  const investTotal = MW * c['investment.perMW'] * 1e6;
  const sizeScale = P.sizeScale;
  const trucksPeak = Math.max(5, c['traffic.constructionTrucksPer100MW'] * sizeScale);
  const trucksOp = Math.max(1, c['traffic.operationTrucksPer100MW'] * sizeScale);
  const landHa = MW * c['land.perMW'];
  const backupFull = MW * c['backup.fuelPerMW'];
  const ewasteFull = MW * c['ewaste.perMW'];
  const gridPeak = MW * c.gridPeakRatio;

  // headline (steady state / peak / total); for SEPARABLE metrics also the per-draw value of the yearly series
  const h = S.head;
  h.electricity[i] = elFull;
  h.gridPeak[i] = gridPeak;
  h.heatAvailable[i] = capturedFull;
  h.heatPumpElectricity[i] = hpElecFull;
  h.heatUsed[i] = heatUsedFull;
  h.water[i] = waterFull;
  h.noise[i] = noiseHead;
  h.co2Electricity[i] = elFull * grid;
  h.co2HeatAvoided[i] = heatUsedFull * avoidPerGWh;
  h.co2Construction[i] = co2ConTotal;
  h.jobsConstruction[i] = workersPeak;
  h.jobsPermanent[i] = permFull;
  h.jobsIndirect[i] = permFull * mult;
  h.propertyTax[i] = propFull;
  h.electricityTax[i] = elFull * 1e6 * taxRate;
  h.investment[i] = investTotal;
  h.trucks[i] = trucksPeak;
  h.land[i] = landHa;
  h.backupPower[i] = backupFull;
  h.eWaste[i] = ewasteFull;

  // comparisons (per draw, then percentiles); a missing town figure gives 0 here and the comparison is left out
  const m = S.cmp;
  const homes = (elFull * 1e6) / c['home.electricity'];
  m.elHomes[i] = homes;
  m.elPctFinland[i] = (elFull / (c['finland.consumption2025'] * 1000)) * 100;
  m.elTownHomes[i] = P.households ? homes / P.households : 0;
  m.gpPctOL3[i] = (gridPeak / c['finland.ol3Capacity']) * 100;
  m.haHomes[i] = (potentialFull * 1000) / c['heat.perHome'];
  m.haPctTownDH[i] = P.townDemand > 0 ? (potentialFull / P.townDemand) * 100 : 0;
  m.hpAvgMW[i] = hpElecFull / 8.76;
  m.hpPctOfDc[i] = (hpElecFull / Math.max(elFull, 1e-9)) * 100;
  m.huHomes[i] = (heatUsedFull * 1000) / c['heat.perHome'];
  m.huPctTownDH[i] = P.townDemand > 0 ? (heatUsedFull / P.townDemand) * 100 : 0;
  m.waResidents[i] = waterFull / c['water.perPerson'];
  m.waPctTown[i] = P.population ? (waterFull / (P.population * c['water.perPerson'])) * 100 : 0;
  m.noConstruction[i] = noiseCon;
  m.noGuideNight[i] = c['noise.guideNight'];
  m.noGuideDay[i] = c['noise.guideDay'];
  m.noGuideNature[i] = c['noise.guideNatureNight'];
  m.ceNet[i] = elFull * grid - heatUsedFull * avoidPerGWh;
  m.chHeatPumpCo2[i] = hpElecFull * grid;
  m.ccYears[i] = co2ConTotal / Math.max(elFull * grid, 1e-9);
  m.jcCarsPerDay[i] = Math.max(15, 240 * sizeScale); // Järvenpää: up to 240 cars/day at 100 MW
  m.jpPctUnemployed[i] = P.unemployed ? (permFull / P.unemployed) * 100 : 0;
  m.jiPctUnemployed[i] = P.unemployed ? ((permFull * mult) / P.unemployed) * 100 : 0;
  m.ptPctRevenue[i] = P.revenue ? (propFull / P.revenue) * 100 : 0;
  m.ptPerResident[i] = P.population ? propFull / P.population : 0;
  m.etVsPropertyTax[i] = (elFull * 1e6 * taxRate) / Math.max(propFull, 1);
  m.inBuildings[i] = investTotal * (1 - c['investment.itShare']);
  m.trOperation[i] = trucksOp;
  m.laPitches[i] = landHa / c['land.footballPitch'];
  m.bpGenerators[i] = Math.ceil(backupFull / c['backup.generatorSize'] - 1e-9); // whole machines
  m.bpDiesel[i] = MW * c['backup.dieselPerMW'];
  m.bpTestCo2[i] = MW * c['backup.testCo2PerMW'];
  m.ewPerYear[i] = ewasteFull / c['ewaste.refreshYears'];

  // yearly series of the metrics that are not SEPARABLE
  const sr = S.series;
  const sHp = sr.heatPumpElectricity, sHu = sr.heatUsed, sNo = sr.noise, sCh = sr.co2HeatAvoided;
  const sJp = sr.jobsPermanent, sJi = sr.jobsIndirect, sTr = sr.trucks;
  const capEnd = F.capEnd, heatFrac = F.heatFrac, heatTime = F.heatTime, building = F.building, truck = F.truck;
  const reuseOn = P.reuseOn;
  const base = i * N_YEARS;
  for (let y = 0; y < N_YEARS; y++) {
    const cap = capEnd[y];
    const hUsed = reuseOn ? Math.min(potentialFull * heatFrac[y], capDH * heatTime[y]) : 0;
    const p = cap > 0 ? Math.max(5, permPerCap * cap) : 0;
    const noiseOp = cap > 0 ? (cap === 1 ? noiseHead : Math.max(20, noiseFull + 10 * Math.log10(Math.max(cap, 1e-3)))) : 0;
    const j = base + y;
    sHp[j] = hUsed / cop;
    sHu[j] = hUsed;
    sNo[j] = Math.max(noiseOp, building[y] ? noiseCon : 0);
    sCh[j] = hUsed * avoidPerGWh;
    sJp[j] = p;
    sJi[j] = p * mult;
    sTr[j] = Math.max(trucksPeak * truck[y], cap > 0 ? trucksOp * cap : 0);
  }
}

/** p10 / p50 / p90 of a stored metric for every year. Years where every draw is 0, or equal to the year before,
 *  skip the sort. */
function seriesPercentiles(s, n, col, prev) {
  const low = new Array(N_YEARS);
  const typ = new Array(N_YEARS);
  const high = new Array(N_YEARS);
  let havePrev = false;
  for (let y = 0; y < N_YEARS; y++) {
    let zero = true;
    let same = havePrev;
    for (let i = 0; i < n; i++) {
      const v = s[i * N_YEARS + y];
      col[i] = v;
      if (v !== 0) zero = false;
      if (same && v !== prev[i]) same = false;
    }
    if (zero) { low[y] = 0; typ[y] = 0; high[y] = 0; havePrev = false; continue; }
    if (same) { low[y] = low[y - 1]; typ[y] = typ[y - 1]; high[y] = high[y - 1]; continue; }
    const p = pct3(col);
    low[y] = p.low; typ[y] = p.typ; high[y] = p.high;
    prev.set(col);
    havePrev = true;
  }
  return { low, typ, high };
}

/** Yearly percentiles of a SEPARABLE metric: headline percentiles × the year factor. */
function scaledSeries(hl, factor) {
  const low = new Array(N_YEARS);
  const typ = new Array(N_YEARS);
  const high = new Array(N_YEARS);
  for (let y = 0; y < N_YEARS; y++) {
    const f = factor[y];
    low[y] = f ? hl.low * f : 0; typ[y] = f ? hl.typ * f : 0; high[y] = f ? hl.high * f : 0;
  }
  return { low, typ, high };
}

/** Running total through the end of each year for a stored metric: per draw, then p10 / p50 / p90 per year. */
function cumulativePercentiles(s, n, col, run) {
  const low = new Array(N_YEARS);
  const typ = new Array(N_YEARS);
  const high = new Array(N_YEARS);
  run.fill(0);
  for (let y = 0; y < N_YEARS; y++) {
    let zero = true;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const v = s[i * N_YEARS + y];
      if (v !== 0) { run[i] += v; changed = true; }
      col[i] = run[i];
      if (run[i] !== 0) zero = false;
    }
    if (zero) { low[y] = 0; typ[y] = 0; high[y] = 0; continue; }
    if (!changed) { low[y] = low[y - 1]; typ[y] = typ[y - 1]; high[y] = high[y - 1]; continue; }
    const p = pct3(col);
    low[y] = p.low; typ[y] = p.typ; high[y] = p.high;
  }
  return { low, typ, high };
}

/** Running total of a SEPARABLE metric: headline percentiles × the running sum of the year factor. */
function scaledCumulative(hl, factor) {
  const sums = new Float64Array(N_YEARS);
  let acc = 0;
  for (let y = 0; y < N_YEARS; y++) { acc += factor[y]; sums[y] = acc; }
  return scaledSeries(hl, sums);
}

/**
 * @param {{sizeMW:number, cooling:'air'|'evaporative'|'liquid', heatReuse:boolean, site:'industrial'|'forest'|'field', distanceM:number}} design
 * @param {object|null} town  a TOWNS entry, or null for DEFAULT_TOWN
 * @param {{overrides?:Object<string,'low'|'typ'|'high'>, samples?:number, seed?:number, declared?:object}} opts
 *   declared: values a real project has published, per metric key (SPEC interfaces §8). They are copied to
 *   metrics[key].declared for display and never change any calculation.
 */
export function simulate(design, town, opts = {}) {
  const d = normalizeDesign(design);
  const T = normalizeTown(town);
  const n = Math.max(20, Math.min(4000, Math.round(opts.samples || 400)));
  const seed = Number.isFinite(opts.seed) ? opts.seed : 1;
  const samples = cachedSamples(n, seed, opts.overrides);
  const MW = d.sizeMW;
  const tl = buildTimeline(MW);
  // A town outside Finnish Energy's statistics may still have a small local network: reuse stays possible.
  const reuseOn = d.heatReuse && (T.hasDH || T.dhStatus === 'notInStats');
  const heatStart = reuseOn ? tl.open + 1 : null; // pipe + heat-pump plant: first heat about a year after opening (assumption)
  const pueKey = `pue.${d.cooling}`;
  const wueKey = `wue.${d.cooling}`;
  const copKey = d.cooling === 'liquid' ? 'heat.copLiquid' : 'heat.cop';
  const F = yearFactors(tl, heatStart);
  const P = {
    MW, F, reuseOn, copKey, pueKey, wueKey,
    rateRatio: T.rate / COEF['tax.propertyRateRef'].typ,
    demandSampled: T.demandSampled,
    demandPerShare: T.demandSampled && T.population != null ? demandFromResidents(T.population, 1) : 0,
    demandFixed: T.demandSampled ? 0 : T.demandGWh,
    townDemand: T.demandSampled ? 0 : T.demandGWh, // fixed demand for comparisons (none when it is drawn per sample)
    households: T.households || 0, population: T.population || 0, unemployed: T.unemployed || 0, revenue: T.revenue || 0,
    logDist: 20 * Math.log10(d.distanceM / 350), sizeDb: 10 * Math.log10(MW / 100), distanceM: d.distanceM, sizeScale: Math.sqrt(MW / 100),
  };
  const S = storeFor(n);
  for (let i = 0; i < n; i++) runSample(i, samples[i], P, S);

  // ---- percentiles
  const have = { households: P.households > 0, townDemand: P.townDemand > 0, population: P.population > 0, unemployed: P.unemployed > 0, revenue: P.revenue > 0 };
  const compVals = {};
  for (const [metric, ck, field, needs] of COMP_DEFS) {
    if (needs && !have[needs]) continue;
    const p = pct3(S.cmp[field]);
    (compVals[metric] ||= {})[ck] = WHOLE_COMPS.has(`${metric}.${ck}`) ? { low: Math.round(p.low), typ: Math.round(p.typ), high: Math.round(p.high) } : p;
  }
  const ctx = { d, T, tl, reuseOn, heatStart, copKey, pueKey, wueKey };
  const metrics = {};
  const headPct = {};
  for (const key of ALL_KEYS) {
    const hl = pct3(S.head[key]);
    headPct[key] = hl;
    const yearly = SEPARABLE[key] ? scaledSeries(hl, F[SEPARABLE[key]]) : seriesPercentiles(S.series[key], n, S.col, S.prev);
    const m = describe(key, yearly, hl, compVals[key] || {}, ctx);
    const dec = opts.declared && opts.declared[key];
    if (dec != null) m.declared = clone(dec);
    metrics[key] = m;
  }

  // ---- running totals through the end of each year
  const cumulative = {};
  for (const key of CUMULATIVE_KEYS) {
    cumulative[key] = SEPARABLE[key] ? scaledCumulative(headPct[key], F[SEPARABLE[key]]) : cumulativePercentiles(S.series[key], n, S.col, S.prev);
  }

  const assumptions = [...new Set(Object.values(metrics).flatMap((m) => m.inputs))];
  return {
    years: YEARS.slice(),
    phases: [
      { key: 'planning', start: 0, end: tl.plan },
      { key: 'construction', start: tl.plan, end: tl.open },
      { key: 'operation', start: tl.open, end: 30 },
    ],
    events: buildEvents(d, T, tl, reuseOn, heatStart),
    metrics,
    cumulative,
    assumptions,
    meta: {
      design: d,
      town: {
        name: T.name, isDefault: T.isDefault, hasDistrictHeat: T.hasDH, demandGWh: T.demandGWh, dhEstimated: T.dhEstimated,
        rate: T.rate, rateKnown: T.rateKnown, dhStatus: T.dhStatus, population: T.population, households: T.households,
        revenue: T.revenue, seller: T.seller,
      },
      samples: n, seed,
      needsEIA: tl.needsEIA, needsPermit: tl.needsPermit, needsRegistration: tl.needsRegistration, fuelPowerMW: tl.fuel,
      openYear: tl.open, fullCapacityYear: tl.lastOnline, heatStartYear: heatStart, heatReuseOn: reuseOn,
      halls: tl.halls,
      hallBuild: tl.windows.map((w) => ({ start: w.a, end: w.b })),
      hallOnline: tl.online.slice(),
      expansions: tl.windows.slice(1).map((w) => ({ start: w.a, end: w.b })),
      refreshYears: tl.refreshes.slice(),
    },
  };
}

function normalizeDesign(design = {}) {
  const mw = Number.isFinite(design.sizeMW) && design.sizeMW > 0 ? design.sizeMW : 50;
  const sizeMW = Math.max(2, Math.min(1000, mw));
  const cooling = DESIGN_OPTIONS.cooling.includes(design.cooling) ? design.cooling : 'air';
  const site = DESIGN_OPTIONS.site.includes(design.site) ? design.site : 'industrial';
  const dm = Number.isFinite(design.distanceM) ? design.distanceM : 800;
  const distanceM = Math.max(50, Math.min(10000, dm));
  return { sizeMW, cooling, heatReuse: design.heatReuse !== false, site, distanceM };
}

// ------------------------------------------------------------------ noise vs the guideline values

const NOISE_GUIDES = [
  ['day', 'noise.guideDay'], ['night', 'noise.guideNight'], ['nightNew', 'noise.guideNightNew'],
  ['holidayDay', 'noise.guideNatureDay'], ['holidayNight', 'noise.guideNatureNight'],
];

/**
 * Operating noise at the homes (outdoors, dB) compared with the outdoor guideline values of VNp 993/1992 — never with
 * indoor sounds. `range` = { low, typ, high } in dB; the ends are rounded to whole dB as the card shows them.
 * Returns { values, tonalPenalty, range, checks: { [guide]: { limit, over: 'all'|'top'|'none', diffTyp, tonalRisk } },
 * overNight, text: {fi,en} }. over 'all' = even the low end is above the limit; 'top' = only the upper end is.
 * tonalRisk = the upper end is within the 5 dB tonal/impulsive correction of the limit (or above it).
 */
export function noiseGuidelines(range) {
  const r = (v) => (Number.isFinite(v) ? Math.round(v) : 0);
  const lo = r(range && range.low);
  const typ = Math.max(lo, r(range && range.typ));
  const hi = Math.max(typ, r(range && range.high));
  const penalty = COEF['noise.tonalPenalty'] ? COEF['noise.tonalPenalty'].typ : 5;
  const values = {};
  const checks = {};
  for (const [k, coefKey] of NOISE_GUIDES) {
    const limit = COEF[coefKey].typ;
    values[k] = limit;
    checks[k] = { limit, over: lo > limit ? 'all' : hi > limit ? 'top' : 'none', diffTyp: typ - limit, tonalRisk: hi + penalty > limit };
  }
  const N = values.night;
  const nightC = checks.night;
  const rangeTxt = lo === hi ? `${lo} dB` : `${lo}–${hi} dB`;
  const below = N - typ;
  const lead = nightC.over === 'all'
    ? { fi: `Koko arvioitu väli (${rangeTxt}) on yli asuinalueen yöohjearvon ${N} dB.`, en: `The whole estimated range (${rangeTxt}) is above the ${N} dB night guideline for homes.` }
    : nightC.over === 'top'
      ? { fi: `Arvion yläpää (${hi} dB) on yli asuinalueen yöohjearvon ${N} dB.`, en: `The top of the estimate (${hi} dB) is above the ${N} dB night guideline for homes.` }
      : below > 0
        ? { fi: `Arvio on noin ${below} dB alle asuinalueen yöohjearvon ${N} dB.`, en: `The estimate is about ${below} dB below the ${N} dB night guideline for homes.` }
        : { fi: `Arvio on asuinalueen yöohjearvon ${N} dB tasolla.`, en: `The estimate is at the ${N} dB night guideline for homes.` };
  const status = (c) => (c.over === 'all'
    ? { fi: 'ylittyy koko välillä', en: 'exceeded across the whole range' }
    : c.over === 'top' ? { fi: 'ylittyy välin yläpäässä', en: 'exceeded at the top of the range' } : { fi: 'ei ylity', en: 'not exceeded' });
  const sNew = status(checks.nightNew);
  const sHol = status(checks.holidayNight);
  const strict = {
    fi: `Tiukemmat yöohjearvot: uudet asuinalueet ${values.nightNew} dB (${sNew.fi}), loma-asunnot ja luonnonsuojelualueet taajamien ulkopuolella ${values.holidayNight} dB (${sHol.fi}).`,
    en: `Stricter night guidelines: new residential areas ${values.nightNew} dB (${sNew.en}), holiday homes and nature reserves outside towns ${values.holidayNight} dB (${sHol.en}).`,
  };
  const parts = [lead, strict];
  if (nightC.tonalRisk) parts.push({ fi: `Jos humina on kapeakaistaista (esimerkiksi tasainen vinkuna), tasoon lisätään ${penalty} dB ennen vertaamista ohjearvoon.`, en: `If the hum is tonal (for example a steady whine), ${penalty} dB is added to the level before it is compared with the guideline.` });
  const overNight = nightC.over !== 'none';
  if (overNight) parts.push({ fi: 'Luvan saaminen edellyttäisi todennäköisesti meluntorjuntaa ja tarkkaa melumallinnusta.', en: 'Getting a permit would probably require noise abatement and detailed noise modelling.' });
  return {
    values, tonalPenalty: penalty, range: { low: lo, typ, high: hi }, checks, overNight,
    text: { fi: parts.map((p) => p.fi).join(' '), en: parts.map((p) => p.en).join(' ') },
  };
}

/** A noise range (dB) moved from one distance to another with the model's own distance rule (−20 × log10 of the ratio). */
export function noiseAtDistance(range, fromM, toM) {
  if (!range || !(fromM > 0) || !(toM > 0)) return range || null;
  const shift = -20 * Math.log10(toM / fromM);
  const at = (v) => (Number.isFinite(v) ? Math.max(20, v + shift) : v);
  return { low: at(range.low), typ: at(range.typ), high: at(range.high) };
}

// ------------------------------------------------------------------ texts per metric

const COOL_FI ={ air: 'ulkoilmajäähdytys', evaporative: 'haihdutusjäähdytys', liquid: 'nestejäähdytys' };
const COOL_EN = { air: 'outdoor-air cooling', evaporative: 'evaporative cooling', liquid: 'liquid cooling' };

function describe(key, series, headline, cv, ctx) {
  const { d, T, tl, reuseOn, copKey, pueKey: pue, wueKey: wue } = ctx;
  // Finnish never inflects the town's name: town context starts "Muhos: …", comparisons say "kunnan …".
  const nameFi = T.isDefault ? 'Esimerkkikunta' : T.name.fi;
  const inTown = T.isDefault ? 'in the example town' : `in ${T.name.en}`;
  const kunnan = T.isDefault ? 'esimerkkikunnan' : 'kunnan';
  const kunnassa = T.isDefault ? 'esimerkkikunnassa' : 'kunnassa';
  const comps = [];
  /** Adds a comparison unless all its values are 0. `times`: text used when a percentage reaches 200 % or more. */
  const add = (ck, text, { format, times } = {}) => {
    const v = cv[ck];
    if (!v) return;
    if (Math.abs(v.low) < 1e-12 && Math.abs(v.typ) < 1e-12 && Math.abs(v.high) < 1e-12) return;
    let c = { key: ck, text, low: v.low, typ: v.typ, high: v.high };
    if (format) c.format = format;
    if (times && v.typ >= 200) c = { ...c, text: times, low: v.low / 100, typ: v.typ / 100, high: v.high / 100, times: true };
    comps.push(c);
  };
  const m = {
    key, theme: METRIC_THEME[key], title: TITLES[key], unit: UNITS.gwh, kind: 'calculated', confidence: 'medium',
    series, headline: { ...headline, when: WHEN.op }, comparisons: comps,
    formula: { fi: '', en: '' }, inputs: [], drivers: [], townContext: null, notes: null,
  };
  const coolFi = COOL_FI[d.cooling];
  const coolEn = COOL_EN[d.cooling];
  const mwFi = `${nfx(d.sizeMW, 'fi')} MW`;
  const mwEn = `${nfx(d.sizeMW, 'en')} MW`;
  const itFi = `IT-teho (palvelinten teho, ${mwFi})`;
  const itEn = `IT load (server capacity, ${mwEn})`;
  const liquid = d.cooling === 'liquid';
  const copRange = liquid ? { fi: '4–6', en: '4–6' } : { fi: '3–5', en: '3–5' };
  const sampledInputs = T.demandSampled ? ['heat.localNetworkShare'] : [];
  const fullYear = Math.round(tl.lastOnline); // a whole timeline year ("vuonna 10", never "vuonna 9,5")
  const phased = tl.halls > 1
    ? { fi: ` Näin suuri datakeskus rakennetaan ${tl.halls} vaiheessa, sali kerrallaan: täysi teho noin vuonna ${fullYear}.`, en: ` A site this big is built in ${tl.halls} phases, one hall at a time: full capacity around year ${fullYear}.` }
    : { fi: '', en: '' };
  const est = (l) => (T.dhEstimated ? (l === 'fi' ? ' (arvio)' : ' (estimate)') : '');
  const seller = T.seller ? ` (${T.seller})` : '';
  const notInStatsFi = `${nameFi}: ei kaukolämpöverkkoa Energiateollisuuden tilastossa. Pieni paikallinen verkko voi silti olla – kysy kunnasta.`;
  const notInStatsEn = `No district-heating network ${inTown} appears in Finnish Energy’s statistics. A small local network may still exist – ask the municipality.`;
  const localFi = `${nameFi}: paikallinen lämpöverkko${seller}, jonka kulutusta ei ole Energiateollisuuden tilastossa.`;
  const localEn = `There is a local heating network ${inTown}${seller}; its use is not in Finnish Energy’s statistics.`;
  const estimateFi = 'Laskemme lämmön käytön arvioidulla tarpeella (asukkaat × 5,9 MWh, verkon piirissä 10–50 % asukkaista).';
  const estimateEn = 'We calculate heat use from an estimated demand (residents × 5.9 MWh, with 10–50% of residents on the network).';

  switch (key) {
    case 'electricity':
      m.unit = UNITS.gwh;
      m.formula = { fi: `${itFi} × käyttöaste × PUE (${coolFi}) × 8 760 tuntia. Avausvuonna lasketaan vain osa vuodesta.${phased.fi}`, en: `${itEn} × utilisation × PUE (${coolEn}) × 8,760 hours. Only part of the opening year counts.${phased.en}` };
      m.inputs = ['utilisation', pue, 'home.electricity', 'finland.consumption2025'];
      m.drivers = ['utilisation', pue];
      add('homes', { fi: '{range} kodin sähkönkulutus', en: 'the electricity of {range} homes' }, { format: 'int' });
      add('pctFinland', { fi: '{range} % koko Suomen sähkönkulutuksesta (2025)', en: '{range}% of all electricity used in Finland (2025)' });
      add('townHomes', { fi: `{range} kertaa niin paljon kuin ${kunnassa} on kotitalouksia`, en: `{range} times the number of households ${inTown}` });
      if (T.households) m.townContext = bi((l) => (l === 'fi' ? `${nameFi}: noin ${nf(T.households, l)} kotitaloutta.` : `There are about ${nf(T.households, l)} households ${inTown}.`));
      m.notes = { fi: 'Vertailukoti ei lämmitä sähköllä (5 000 kWh/v). Sähkölämmitteinen omakotitalo käyttää noin 18 000 kWh. Luku ei sisällä lämpöpumppujen sähköä: jos hukkalämpö menee kaukolämpöön, lämpöpumput käyttävät lisäksi sähköä (ks. Lämpöpumppujen sähkö). Sähkön hintavaikutusta ei lasketa: yhden datakeskuksen vaikutusta hintaan ei voi luotettavasti arvioida.', en: 'The comparison home is not heated with electricity (5,000 kWh/yr). An electrically heated house uses about 18,000 kWh. This does not include the heat pumps’ electricity: if the waste heat goes to district heating, the heat pumps use extra electricity (see Heat-pump electricity). We do not calculate an effect on electricity prices: one data centre’s effect on prices cannot be estimated reliably.' };
      break;
    case 'gridPeak':
      m.unit = UNITS.mw;
      m.headline.when = WHEN.opNow;
      m.formula = { fi: `${itFi} × 1,2–1,4 (jäähdytys ja muu tekniikka huipulla).`, en: `${itEn} × 1.2–1.4 (cooling and other systems at peak).` };
      m.inputs = ['gridPeakRatio', 'finland.ol3Capacity'];
      m.drivers = ['gridPeakRatio'];
      add('pctOL3', { fi: '{range} % Olkiluoto 3:n tehosta (noin 1 600 MW)', en: '{range}% of Olkiluoto 3’s output (about 1,600 MW)' });
      m.notes = { fi: 'Yli noin 100 MW:n liittymä tehdään yleensä suoraan Fingridin kantaverkkoon, ja sitä varten voidaan tarvita uusia voimajohtoja. Lämpöpumppujen sähkö ei sisälly tähän (ks. Lämpöpumppujen sähkö). Olkiluoto 3:n nimellisteho on noin 1 600 MW.', en: 'A connection above about 100 MW is usually made directly to Fingrid’s main grid and may need new power lines. The heat pumps’ electricity is not included here (see Heat-pump electricity). Olkiluoto 3’s rated output is about 1,600 MW.' };
      m.confidence = 'medium';
      break;
    case 'heatAvailable':
      m.unit = UNITS.gwh;
      m.formula = liquid
        ? { fi: `${itFi} × käyttöaste × 8 760 h × talteen saatava osuus (90–97 %). Lähes kaikki palvelinten sähkö muuttuu lämmöksi. Nestejäähdytyksen lämpö on lämpimämpää kuin ilmajäähdytyksen (noin 45–60 °C), mutta kaukolämpöön se nostetaan silti lämpöpumpulla, joka käyttää sähköä. Tämä luku ei sisällä lämpöpumppujen sähköä.`, en: `${itEn} × utilisation × 8,760 h × share that can be captured (90–97%). Almost all the servers’ electricity turns into heat. Liquid-cooling heat is warmer than air-cooling heat (about 45–60 °C), but a heat pump still raises it to district-heating temperature, using electricity. This figure does not include the heat pumps’ electricity.` }
        : { fi: `${itFi} × käyttöaste × 8 760 h × talteen saatava osuus (90–97 %). Lähes kaikki palvelinten sähkö muuttuu lämmöksi. Lämpö on haaleaa (noin 25–40 °C), joten kaukolämpöön se nostetaan lämpöpumpulla, joka käyttää sähköä. Tämä luku ei sisällä lämpöpumppujen sähköä.`, en: `${itEn} × utilisation × 8,760 h × share that can be captured (90–97%). Almost all the servers’ electricity turns into heat. The heat is lukewarm (about 25–40 °C), so a heat pump raises it to district-heating temperature, using electricity. This figure does not include the heat pumps’ electricity.` };
      m.inputs = ['utilisation', 'heat.capture', copKey, 'heat.usableShare', 'heat.perHome'];
      m.drivers = ['utilisation', 'heat.capture'];
      add('homes', { fi: 'lämpöpumppujen avulla riittäisi {range} kodin lämmitykseen, jos kaikelle käyttökelpoiselle lämmölle olisi käyttäjä', en: 'with heat pumps, enough to heat {range} homes if all the usable heat had a user' }, { format: 'int' });
      add('pctTownDH', { fi: `lämpöpumppujen avulla {range} % ${kunnan} kaukolämmön tarpeesta`, en: `with heat pumps, {range}% of the district heat used ${inTown}` },
        { times: { fi: `lämpöpumppujen avulla {range} kertaa ${kunnan} kaukolämmön tarve`, en: `with heat pumps, {range} times the district heat used ${inTown}` } });
      if (T.dhStatus === 'notInStats') {
        m.townContext = { fi: `${notInStatsFi} Lämmölle voi löytyä myös muu käyttäjä, esimerkiksi kasvihuone tai teollisuus.`, en: `${notInStatsEn} The heat could also have another user, such as a greenhouse or industry.` };
      } else if (T.demandSampled) {
        m.townContext = { fi: `${localFi} Sen tarvetta ei tiedetä.`, en: `${localEn} Its demand is not known.` };
      } else {
        m.townContext = bi((l) => (l === 'fi' ? `${nameFi}: kaukolämpöä käytetään noin ${nf(T.demandGWh, l)} GWh vuodessa${est(l)}.` : `About ${nf(T.demandGWh, l)} GWh of district heat a year is used ${inTown}${est(l)}.`));
      }
      m.notes = { fi: `Kesällä lämpöä tarvitaan vähän, joten vertailu kotien määrään käyttää vain vuoden aikana käyttökelpoista osuutta. Vertailut sisältävät lämpöpumppujen sähkön. Nestejäähdytyksestä saadaan lämpimämpää vettä, joten lämpöpumppu tarvitsee vähemmän sähköä (lämpökerroin noin 4–6, ilma- ja haihdutusjäähdytyksessä noin 3–5).`, en: 'Little heat is needed in summer, so the comparison with homes uses only the share usable over a year. The comparisons include the heat pumps’ electricity. Liquid cooling gives warmer water, so the heat pump needs less electricity (COP about 4–6; air and evaporative cooling about 3–5).' };
      break;
    case 'heatPumpElectricity':
      m.unit = UNITS.gwh;
      m.confidence = 'weak';
      m.formula = { fi: `Kaukolämpöön menevä lämpö ÷ lämpöpumpun lämpökerroin (COP ${copRange.fi}, ${coolFi}). Lämpöpumppu nostaa haalean lämmön kaukolämmön lämpötilaan ja käyttää siihen sähköä: esimerkiksi COP 3,5 tarkoittaa, että noin 29 % (1 / 3,5) toimitetusta lämmöstä on lämpöpumpun sähköä.`, en: `Heat delivered to district heating ÷ heat-pump efficiency (COP ${copRange.en}, ${coolEn}). The heat pump raises the lukewarm heat to district-heating temperature and uses electricity to do so: for example, COP 3.5 means about 29% (1 / 3.5) of the delivered heat is the heat pump’s electricity.` };
      m.inputs = ['utilisation', 'heat.capture', copKey, 'heat.usableShare', 'heat.maxCoverage', ...sampledInputs];
      m.drivers = [copKey, 'heat.usableShare', 'heat.maxCoverage', ...sampledInputs];
      add('avgMW', { fi: 'keskimäärin {range} MW sähkötehoa', en: 'on average {range} MW of electrical power' });
      add('pctOfDc', { fi: '{range} % datakeskuksen omasta sähköstä', en: '{range}% of the data centre’s own electricity' });
      m.notes = { fi: 'Lämpöpumppulaitoksen omistaa ja sitä käyttää usein kaukolämpöyhtiö: esimerkiksi Microsoftin Espoon ja Kirkkonummen datakeskusten hukkalämpö on tarkoitus hyödyntää Fortumin omissa lämpöpumppulaitoksissa (Fortum 6.5.2026). Siksi tätä sähköä ei ole laskettu datakeskuksen sähkönkulutukseen eikä sen sähköliittymään. Kun hukkalämpö johdetaan ilmaan, lämpöpumppuja ei tarvita ja luku on 0.', en: 'The heat-pump plant is often owned and run by the district-heating company: for example, the waste heat of Microsoft’s Espoo and Kirkkonummi data centres is to be used in Fortum’s own heat-pump plants (Fortum, 6 May 2026). So this electricity is not counted in the data centre’s electricity use or its grid connection. When the waste heat is released into the air, no heat pumps are needed and the figure is 0.' };
      if (!reuseOn) {
        m.headline.when = WHEN.notInUse;
        m.townContext = { fi: 'Lämpö johdetaan ilmaan, joten lämpöpumppuja ei tarvita.', en: 'The heat is released into the air, so no heat pumps are needed.' };
      }
      break;
    case 'heatUsed':
      m.unit = UNITS.gwh;
      m.confidence = T.demandSampled ? 'weak' : 'medium';
      m.formula = {
        fi: `Pienempi näistä: (talteen saatu lämpö + lämpöpumppujen sähkö) × vuoden aikana hyödynnettävä osuus, tai ${kunnan} kaukolämmön tarve × suurin osuus, jonka yksi lähde on Suomessa kattanut (60–80 %). Luku sisältää lämpöpumppujen sähkön.${T.demandSampled ? ' Tarve on arvio: asukkaat × verkon piirissä oleva osuus (10–50 %) × 5,9 MWh ÷ 0,54 (asuinrakennusten osuus kaukolämmöstä).' : ''} Ensimmäinen lämpö noin vuoden kuluttua avaamisesta, kun putki ja lämpöpumppulaitos ovat valmiit.`,
        en: `The smaller of: (captured heat + heat-pump electricity) × share usable over a year, or the district-heat demand ${inTown} × the largest share one source has covered in Finland (60–80%). Includes the heat pumps’ electricity.${T.demandSampled ? ' The demand is an estimate: residents × share on the network (10–50%) × 5.9 MWh ÷ 0.54 (residential share of district heat).' : ''} First heat about a year after opening, once the pipe and heat-pump plant are ready.`,
      };
      m.inputs = ['utilisation', 'heat.capture', copKey, 'heat.usableShare', 'heat.maxCoverage', 'heat.perHome', ...sampledInputs];
      m.drivers = ['heat.capture', copKey, 'heat.usableShare', 'heat.maxCoverage', ...sampledInputs];
      add('homes', { fi: 'lämmittää {range} kotia', en: 'heats {range} homes' }, { format: 'int' });
      add('pctTownDH', { fi: `{range} % ${kunnan} kaukolämmöstä`, en: `{range}% of the district heat used ${inTown}` },
        { times: { fi: `{range} kertaa ${kunnan} kaukolämmön tarve`, en: `{range} times the district heat used ${inTown}` } });
      if (!d.heatReuse) {
        const chose = { fi: 'Tässä suunnitelmassa hukkalämpö johdetaan ilmaan. Siksi kaukolämpöön ei mene lämpöä.', en: 'In this design the waste heat is released into the air, so no heat goes to district heating.' };
        m.townContext = T.dhStatus === 'notInStats' ? { fi: `${notInStatsFi} ${chose.fi}`, en: `${notInStatsEn} ${chose.en}` } : chose;
      } else if (T.dhStatus === 'notInStats') {
        m.townContext = { fi: `${notInStatsFi} ${estimateFi}`, en: `${notInStatsEn} ${estimateEn}` };
      } else if (T.demandSampled) {
        m.townContext = { fi: `${localFi} ${estimateFi}`, en: `${localEn} ${estimateEn}` };
      } else {
        m.townContext = bi((l) => (l === 'fi' ? `${nameFi}: kaukolämpöä käytetään noin ${nf(T.demandGWh, l)} GWh vuodessa${est(l)}${seller}. Siitä yksi datakeskus voi käytännössä kattaa enintään noin 60–80 %.` : `About ${nf(T.demandGWh, l)} GWh of district heat a year is used ${inTown}${est(l)}${seller}. One data centre can in practice cover at most about 60–80% of it.`));
      }
      m.notes = { fi: 'Esimerkkejä: Mäntsälässä datakeskuksen lämpö kattaa jopa 72 % kunnan kaukolämmöstä (Nebiuksen mukaan); Haminassa suunnitelma oli noin 80 %. Lämpöpumppujen sähkö näkyy myös omana lukunaan. Lämmön hinnasta ja siitä, kuka lämpöpumput maksaa, sovitaan hankekohtaisesti.', en: 'Examples: in Mäntsälä the data centre’s heat covers up to 72% of the town’s district heat (according to Nebius); in Hamina the plan was about 80%. The heat pumps’ electricity is also shown as its own figure. The price of the heat and who pays for the heat pumps are agreed project by project.' };
      if (!reuseOn) m.headline.when = WHEN.notInUse;
      break;
    case 'water': {
      m.unit = UNITS.m3;
      m.confidence = COEF[wue].confidence;
      m.formula = { fi: `${itFi} × käyttöaste × 8 760 h × vettä litraa kilowattituntia kohden (${coolFi}).`, en: `${itEn} × utilisation × 8,760 h × litres of water per kWh (${coolEn}).` };
      m.inputs = ['utilisation', wue, 'water.perPerson'];
      m.drivers = [wue];
      add('residents', { fi: 'yhtä paljon kuin {range} asukasta käyttää', en: 'as much as {range} residents use' }, { format: 'int' });
      add('pctTown', { fi: `{range} % ${kunnan} asukkaiden vedenkäytöstä`, en: `{range}% of the water used by residents ${inTown}` },
        { times: { fi: `{range} kertaa ${kunnan} asukkaiden vedenkäyttö`, en: `{range} times the water used by residents ${inTown}` } });
      if (T.population) {
        const use = T.population * COEF['water.perPerson'].typ;
        // millions in words for big towns: "16 milj. m³", not "16 000 000 m³"
        const vol = (l) => (use >= 1e6 ? (l === 'fi' ? `${nf(use / 1e6, l)} milj. m³` : `${nf(use / 1e6, l)} million m³`) : `${nf(use, l)} m³`);
        m.townContext = bi((l) => (l === 'fi' ? `${nameFi}: noin ${nf(T.population, l)} asukasta; he käyttävät vettä noin ${vol(l)} vuodessa.` : `About ${nf(T.population, l)} people live ${inTown}; they use about ${vol(l)} of water a year.`));
      }
      m.notes = d.cooling === 'evaporative'
        ? { fi: 'Suomessa vettä haihdutetaan vain lämpimimpinä tunteina, joten kulutus vaihtelee säiden mukaan vuodesta toiseen. Haihdutusjäähdytyksestä on vain ulkomaista aineistoa. Vesi otetaan yleensä kunnan vesijohdosta, joten kunnan vesihuollon kapasiteetti pitää tarkistaa.', en: 'In Finland water is evaporated only in the warmest hours, so use varies with the weather from year to year. There is only foreign data on evaporative cooling. The water usually comes from the municipal supply, so the capacity of the municipal water supply must be checked.' }
        : { fi: 'Ulkoilma- ja nestejäähdytyksessä vettä kuluu lähinnä talous- ja käyttövedeksi, esimerkiksi henkilökunnalle, ei jäähdytykseen. Esimerkki: Järvenpään 100–130 MW:n datakeskus käyttäisi YVA-selostuksen mukaan noin 4 000–5 000 m³ vettä vuodessa, eikä sen jäähdytysjärjestelmässä käytetä vettä. Lisäksi alueella varastoidaan sammutusvettä.', en: 'With outdoor-air and liquid cooling, water is used mainly as domestic and service water, for example by staff, not for cooling. Example: according to its EIA report, the 100–130 MW Järvenpää data centre would use about 4,000–5,000 m³ of water a year, and its cooling system uses no water. Firefighting water is also stored on site.' };
      break;
    }
    case 'noise':
      m.unit = UNITS.db;
      m.confidence = 'weak';
      m.headline.when = WHEN.noise;
      m.formula = { fi: `Vertailutaso (100 MW, kodit 350 m päässä, suomalaiset YVA-mallinnukset) + 10 × log10(IT-teho / 100 MW) − 20 × log10(etäisyys / 350 m). IT-teho (palvelinten teho) nyt ${mwFi}, etäisyys ${nfx(d.distanceM, 'fi')} m. Rakentamisen aikana: työmaan äänitehotaso − 20 × log10(etäisyys) − 8.`, en: `Reference level (100 MW, homes 350 m away, Finnish EIA modelling) + 10 × log10(IT load / 100 MW) − 20 × log10(distance / 350 m). IT load (server capacity) now ${mwEn}, distance ${nfx(d.distanceM, 'en')} m. During construction: site sound power − 20 × log10(distance) − 8.` };
      m.inputs = ['noise.opRef', 'noise.constructionLwa', 'noise.guideNight', 'noise.guideNightNew', 'noise.guideDay', 'noise.guideNatureNight', 'noise.guideNatureDay', 'noise.tonalPenalty'];
      m.drivers = ['noise.opRef'];
      // Outdoor level vs the outdoor guideline values (VNp 993/1992), for the plain-language line on the card.
      m.guidelines = noiseGuidelines(headline);
      add('construction', { fi: 'rakentamisen aikana päivisin jopa {range} dB (väliaikaista)', en: 'during construction up to {range} dB by day (temporary)' });
      add('guideNight', { fi: `ohjearvo asuinalueella yöllä {typ} dB (uusilla alueilla ${COEF['noise.guideNightNew'].typ} dB)`, en: `guideline for residential areas at night {typ} dB (${COEF['noise.guideNightNew'].typ} dB in new areas)` });
      add('guideDay', { fi: 'ohjearvo asuinalueella päivällä {typ} dB', en: 'guideline for residential areas by day {typ} dB' });
      add('guideNatureNight', { fi: 'ohjearvo loma-asunnoilla ja luonnonsuojelualueilla yöllä {typ} dB', en: 'guideline for holiday homes and nature reserves at night {typ} dB' });
      m.townContext = { fi: `Lähimmät kodit ${nfx(d.distanceM, 'fi')} metrin päässä.`, en: `Nearest homes ${nfx(d.distanceM, 'en')} metres away.` };
      m.notes = { fi: 'Yksinkertaistettu arvio. Todellisissa hankkeissa melu mallinnetaan tapauskohtaisesti maaston, rakennusten ja meluesteiden mukaan. Laaja kampus ei ole lähellä pistemäinen melulähde, joten kaava on lähietäisyydellä karkea. Jos melu on kapeakaistaista (esimerkiksi tasainen vinkuna) tai iskumaista, mittaus- tai laskentatulokseen lisätään 5 dB ennen vertaamista ohjearvoon (VNp 993/1992). Jäähdyttimien tasainen humina voi tuntua häiritsevältä hiljaisella alueella, vaikka ohjearvo ei ylittyisi. Varavoimakoneiden koekäytöt ja pitkä sähkökatko nostavat melua hetkellisesti (Järvenpää: koko vuorokauden katkossa jopa 53 dB).', en: 'A simplified estimate. Real projects model noise case by case with terrain, buildings and noise barriers. A large campus is not a point source close up, so the formula is rough near it. If the noise is narrow-band (for example a steady whine) or impulsive, 5 dB is added to the measured or calculated level before comparing it with the guideline (Government Decision 993/1992). The steady hum of coolers can feel disturbing in a quiet area even below the guideline. Generator tests and a long blackout raise noise briefly (Järvenpää: up to 53 dB in a day-long blackout).' };
      break;
    case 'co2Electricity':
      m.unit = UNITS.tyr;
      m.formula = { fi: 'Sähkönkulutus × Suomessa käytetyn sähkön keskimääräiset päästöt (26–40 g CO₂/kWh vuosina 2023–2025).', en: 'Electricity use × average emissions of electricity used in Finland (26–40 g CO₂/kWh in 2023–2025).' };
      m.inputs = ['utilisation', pue, 'grid.co2', 'heat.co2Replaced'];
      m.drivers = ['grid.co2'];
      add('net', { fi: 'kun vältetyt lämmityksen päästöt vähennetään: {range} t vuodessa', en: 'after subtracting the heating emissions avoided: {range} t a year' });
      m.notes = { fi: 'Suomen sähkö on jo hyvin vähäpäästöistä, ja moni datakeskus ostaa päästötöntä sähköä sopimuksella. Toisaalta uusi suuri kulutus voi hidastaa fossiilisen tuotannon alasajoa muualla. Emme oleta päästöjen muuttuvan tulevina vuosina.', en: 'Finnish electricity is already very low-carbon, and many data centres buy zero-carbon power by contract. On the other hand, large new demand can slow the phase-out of fossil generation elsewhere. We assume emissions stay at today’s level.' };
      break;
    case 'co2HeatAvoided':
      m.unit = UNITS.tyr;
      m.confidence = 'weak';
      m.formula = { fi: 'Kaukolämpöön menevä lämpö × korvattavan lämmön päästöt − lämpöpumppujen sähkön päästöt. Korvattavan lämmön päästöt vaihtelevat: puu 0, Suomen kaukolämmön keskiarvo 73, maakaasu noin 224 g CO₂/kWh.', en: 'Heat delivered to district heating × emissions of the heat it replaces − emissions of the heat pumps’ electricity. The replaced heat varies: wood 0, Finnish district-heat average 73, natural gas about 224 g CO₂/kWh.' };
      m.inputs = ['heat.co2Replaced', copKey, 'grid.co2', 'heat.maxCoverage', 'heat.usableShare', ...sampledInputs];
      m.drivers = ['heat.co2Replaced'];
      add('heatPumpCo2', { fi: 'lämpöpumppujen sähkön päästöt {range} t vuodessa (vähennetty)', en: 'emissions of the heat pumps’ electricity {range} t a year (subtracted)' });
      m.notes = { fi: 'Jos hukkalämpö korvaa puuta, päästöt voivat jopa kasvaa hieman lämpöpumppujen sähkön takia (luku voi olla negatiivinen). Esimerkki: Mäntsälässä lämmityksen päästöt laskivat 54 % vuonna 2024 (Nebiuksen mukaan).', en: 'If the waste heat replaces wood, emissions can even rise slightly because of the heat pumps’ electricity (the number can be negative). Example: in Mäntsälä heating emissions fell by 54% in 2024 (according to Nebius).' };
      if (!reuseOn) m.headline.when = WHEN.notInUse;
      break;
    case 'co2Construction':
      m.unit = UNITS.t;
      m.headline.when = WHEN.total;
      m.formula = { fi: `${itFi} × rakentamisen päästöt megawattia kohden. Jaettu rakentamisvuosille.`, en: `${itEn} × construction emissions per megawatt. Spread over the construction years.` };
      m.confidence = 'weak';
      m.inputs = ['construction.co2PerMW', 'grid.co2'];
      m.drivers = ['construction.co2PerMW'];
      add('yearsOfElectricity', { fi: 'karkeasti {range} vuoden sähkön päästöjen verran (rakentamisen päästöt tunnetaan huonosti)', en: 'roughly {range} years of electricity emissions (construction emissions are poorly known)' });
      m.notes = { fi: 'Rakentamisen päästöistä on vähän julkista tietoa. Arviot vaihtelevat noin 100:sta 1 800 tonniin megawattia kohden sen mukaan, mitä niihin lasketaan (Järvenpään YVA, Schneider Electric, ICEF), joten väli on leveä. Luku sisältää rakennuksen, sähkö-, jäähdytys- ja varavoimalaitteet sekä rakentamisen. Se ei sisällä palvelinten valmistusta, jonka päästöt ovat karkean arvion mukaan vielä suuremmat ja toistuvat jokaisessa laitevaihdossa. Metsäalueella myös puuston hiilivarasto pienenee (Järvenpää 8,8 ha: noin 3 100 t).', en: 'There is little public data on construction emissions. Estimates range from about 100 to 1,800 tonnes per megawatt depending on what they include (Järvenpää EIA, Schneider Electric, ICEF), so the range is wide. The figure covers the building, the power, cooling and backup equipment and the construction work. It does not include making the servers, whose emissions are by a rough estimate even larger and repeat at every refresh. On a forest site the trees’ carbon store also shrinks (Järvenpää 8.8 ha: about 3,100 t).' };
      break;
    case 'jobsConstruction':
      m.unit = UNITS.people;
      m.confidence = 'weak';
      m.headline.when = WHEN.peak;
      m.formula = { fi: `${itFi} × rakentajia megawattia kohden (vähintään 15 henkeä). Määrä vaihtelee rakentamisen aikana ja on suurimmillaan keskivaiheilla.`, en: `${itEn} × workers per megawatt (at least 15 people). The number changes during construction and peaks in the middle.` };
      m.inputs = ['jobs.constructionPerMW'];
      m.drivers = ['jobs.constructionPerMW'];
      add('carsPerDay', { fi: 'työmatkaliikennettä noin {typ} henkilöautoa päivässä', en: 'commuting traffic of about {typ} cars a day' }, { format: 'int' });
      m.notes = { fi: 'Luvut perustuvat suurelta osin hankkeiden ja yhtiöiden arvioihin. Suuri osa rakentajista tulee yleensä muualta, mikä lisää majoituksen ja palvelujen kysyntää. Alaraja 15 henkeä on oma oletuksemme pienille työmaille.', en: 'The figures are largely project and company estimates. Many workers usually come from elsewhere, which raises demand for housing and services. The 15-person minimum is our own assumption for small sites.' };
      break;
    case 'jobsPermanent':
      m.unit = UNITS.jobs;
      m.headline.when = WHEN.opNow;
      m.formula = { fi: `${itFi} × pysyviä työpaikkoja megawattia kohden (vähintään 5, koska valvonta toimii ympäri vuorokauden).`, en: `${itEn} × permanent jobs per megawatt (at least 5, because monitoring runs around the clock).` };
      m.inputs = ['jobs.permanentPerMW'];
      m.drivers = ['jobs.permanentPerMW'];
      add('pctUnemployed', { fi: `{range} % ${kunnan} työttömien määrästä`, en: `{range}% of the number of unemployed people ${inTown}` },
        { times: { fi: `{range} kertaa ${kunnan} työttömien määrä`, en: `{range} times the number of unemployed people ${inTown}` } });
      if (T.unemployed) m.townContext = bi((l) => (l === 'fi' ? `${nameFi}: noin ${nf(T.unemployed, l)} työtöntä.` : `There are about ${nf(T.unemployed, l)} unemployed people ${inTown}.`));
      m.notes = { fi: 'Kaikki työpaikat eivät mene paikallisille: osa vaatii erityisosaamista. Alaraja 5 on oma oletuksemme.', en: 'Not all jobs go to local people: some need special skills. The minimum of 5 is our own assumption.' };
      break;
    case 'jobsIndirect':
      m.unit = UNITS.jobs;
      m.confidence = 'weak';
      m.headline.when = WHEN.opNow;
      m.formula = { fi: 'Pysyvät työpaikat × välillisten työpaikkojen kerroin (0,6–4,3).', en: 'Permanent jobs × indirect-jobs multiplier (0.6–4.3).' };
      m.inputs = ['jobs.permanentPerMW', 'jobs.indirectMultiplier'];
      m.drivers = ['jobs.indirectMultiplier'];
      add('pctUnemployed', { fi: `{range} % ${kunnan} työttömien määrästä`, en: `{range}% of the number of unemployed people ${inTown}` },
        { times: { fi: `{range} kertaa ${kunnan} työttömien määrä`, en: `{range} times the number of unemployed people ${inTown}` } });
      m.notes = { fi: 'Heikko arvio: kertoimet ovat yhtiöiden ja selvitysten arvioita, ja välilliset työpaikat voivat syntyä myös muualle kuin omaan kuntaan.', en: 'A weak estimate: the multipliers come from companies and studies, and indirect jobs may appear outside your own town.' };
      break;
    case 'propertyTax': {
      m.unit = UNITS.eurYr;
      m.confidence = 'weak';
      m.headline.when = WHEN.opNow;
      const ref = COEF['tax.propertyRateRef'].typ;
      m.formula = { fi: `${itFi} × kiinteistövero megawattia kohden (hankeyhtiöiden Rambollin selvitykseen perustuva Mikkelin arvio) × ${kunnan} oma yleinen kiinteistöveroprosentti (${nfx(T.rate, 'fi')} %) / ${nfx(ref, 'fi')} %. Vero maksetaan rakennuksista; palvelimia ei veroteta. Vero alkaa valmistumista seuraavana vuonna.`, en: `${itEn} × property tax per megawatt (the developers’ Mikkeli estimate based on a Ramboll study) × the town’s own general property tax rate (${nfx(T.rate, 'en')}%) / ${nfx(ref, 'en')}%. The tax is paid on the buildings; servers are not taxed. It starts the year after completion.` };
      m.inputs = ['tax.propertyPerMW', 'tax.propertyRateRef'];
      m.drivers = ['tax.propertyPerMW'];
      add('pctTownRevenue', { fi: `{range} % lisää ${kunnan} nykyisiin kiinteistöverotuloihin`, en: `{range}% on top of the current property-tax income ${inTown}` },
        { times: { fi: `{range} kertaa ${kunnan} nykyiset kiinteistöverotulot`, en: `{range} times the current property-tax income ${inTown}` } });
      add('perResident', { fi: 'noin {range} asukasta kohden vuodessa', en: 'about {range} per resident a year' }, { format: 'eur' });
      m.townContext = bi((l) => {
        const rev = T.revenue ? (l === 'fi' ? ` Kunta saa kiinteistöveroa nyt noin ${nf(T.revenue / 1e6, l)} milj. € vuodessa.` : ` The town now gets about €${nf(T.revenue / 1e6, l)} million a year in property tax.`) : '';
        if (l === 'fi') {
          const rate = T.rateKnown ? `yleinen kiinteistöveroprosentti on ${nfx(T.rate, l)} %` : 'kunnan veroprosenttia ei tiedetä, joten käytämme koko maan keskiarvoa 1,18 %';
          return `${nameFi}: ${rate}.${rev}`;
        }
        const rate = T.rateKnown ? `The general property tax rate ${inTown} is ${nfx(T.rate, l)}%` : `The rate ${inTown} is not known, so we use the national average of 1.18%`;
        return `${rate}.${rev}`;
      });
      m.notes = { fi: 'Kiinteistövero menee kunnalle. Rakennuksen verotusarvo pienenee iän myötä; sitä ei ole mallinnettu. Haminan todellisia verotuloja Googlelta ei ole julkaistu. Kunnat voivat saada myös kertaluonteisia maankäyttökorvauksia (esim. Muhos).', en: 'Property tax goes to the town. A building’s tax value falls with age; this is not modelled. Hamina’s actual tax income from Google has not been published. Towns may also get one-off land-use payments (e.g. Muhos).' };
      break;
    }
    case 'electricityTax': {
      m.unit = UNITS.eurYr;
      m.confidence = 'strong';
      const cents = COEF['tax.electricity'].typ * 100;
      m.formula = { fi: `Sähkönkulutus × sähkövero ${nfx(cents, 'fi')} snt/kWh (veroluokka I, 1.7.2026 alkaen). Vero menee valtiolle, ei kunnalle.`, en: `Electricity use × electricity tax ${nfx(cents, 'en')} c/kWh (class I since 1 July 2026). The tax goes to the state, not the town.` };
      m.inputs = ['utilisation', pue, 'tax.electricity'];
      m.drivers = ['tax.electricity'];
      add('vsPropertyTax', { fi: '{range} kertaa niin paljon kuin kunnalle maksettava kiinteistövero', en: '{range} times the property tax paid to the town' });
      m.notes = { fi: 'Ennen 1.7.2026 datakeskukset maksoivat vain 0,05 snt/kWh. Hallitus luopui suunnitellusta enintään 30 milj. euron tuesta budjettiriihessä 1.9.2026 (Turun Sanomat 1.9.2026, Uusi Suomi 2.9.2026).', en: 'Before 1 July 2026 data centres paid only 0.05 c/kWh. The government dropped the planned support of up to €30 million in its budget session on 1 Sept 2026 (Turun Sanomat, 1 Sept 2026; Uusi Suomi, 2 Sept 2026).' };
      break;
    }
    case 'investment':
      m.unit = UNITS.eur;
      m.headline.when = WHEN.total;
      m.formula = { fi: `${itFi} × investointi megawattia kohden. Jaettu rakentamisvuosille.`, en: `${itEn} × investment per megawatt. Spread over the construction years.` };
      m.inputs = ['investment.perMW', 'investment.itShare'];
      m.drivers = ['investment.perMW'];
      add('buildings', { fi: 'josta rakennuksiin ja tekniikkaan noin {range} (loppu mahdollisesti laitteita)', en: 'of which about {range} goes to buildings and systems (any rest is equipment)' }, { format: 'eur' });
      m.notes = { fi: 'Investointiluvut kattavat pääosin rakennukset sekä sähkö- ja jäähdytystekniikan; vuokralaisten palvelimet tulevat usein lisäksi ja ostetaan yleensä ulkomailta. Paikallisesti näkyy lähinnä rakentaminen.', en: 'The investment figures mostly cover buildings, power and cooling systems; tenants’ servers often come on top and are usually bought from abroad. Locally, mainly the construction is visible.' };
      break;
    case 'trucks':
      m.unit = UNITS.perDay;
      m.confidence = 'weak';
      m.headline.when = WHEN.peak;
      m.formula = { fi: `Raskaat ajoneuvot 100 MW:n työmaalla (40–100/pv) × √(IT-teho / 100 MW); IT-teho (palvelinten teho) nyt ${mwFi}. Neliöjuuri, koska isot alueet rakennetaan vaiheittain. Vähintään 5/pv. Käytön aikana muutama ajoneuvo päivässä.`, en: `Heavy vehicles at a 100 MW site (40–100/day) × √(IT load / 100 MW); IT load (server capacity) now ${mwEn}. Square root, because large sites are built in phases. At least 5/day. During operation a few vehicles a day.` };
      m.inputs = ['traffic.constructionTrucksPer100MW', 'traffic.operationTrucksPer100MW'];
      m.drivers = ['traffic.constructionTrucksPer100MW'];
      // The noun comes before the number, so the sentence stays correct when the range collapses to "1".
      add('operation', { fi: 'käytön aikana raskaita ajoneuvoja {range} päivässä', en: 'heavy vehicles during operation: {range} a day' }, { format: 'int' });
      m.notes = { fi: 'Vilkkainta on maanrakennusvaiheessa, joka kestää usein noin puoli vuotta. Lisäksi työmatkaliikenne (Järvenpää: jopa 240 henkilöautoa päivässä). Skaalaus kokoon on oma oletuksemme.', en: 'Busiest during the earthworks, which often last about half a year. Plus commuter traffic (Järvenpää: up to 240 cars a day). The scaling with size is our own assumption.' };
      break;
    case 'land':
      m.unit = UNITS.ha;
      m.headline.when = { fi: 'rakentamisen alusta lähtien', en: 'from the start of construction' };
      m.formula = { fi: `${itFi} × hehtaaria megawattia kohden (tiiviistä rakennuksesta laajaan kampukseen).`, en: `${itEn} × hectares per megawatt (from a compact building to a wide campus).` };
      m.inputs = ['land.perMW', 'land.footballPitch'];
      m.drivers = ['land.perMW'];
      add('pitches', { fi: '{range} jalkapallokentän verran', en: 'the size of {range} football pitches' });
      m.townContext = {
        industrial: { fi: 'Paikkana on teollisuusalue: maa on jo rakennettua, joten luontoa menetetään vähän.', en: 'The site is an industrial area: the land is already built on, so little nature is lost.' },
        forest: { fi: 'Paikkana on metsä: puusto kaadetaan ja hiilivarasto pienenee. Esimerkiksi Muhoksella ja Kajaanissa metsää raivattiin ennen kuin ympäristövaikutusten arviointi (YVA) oli valmis. Lupa- ja valvontavirasto kehotti 6.10.2026 keskeyttämään työt, kunnes YVA on tehty.', en: 'You chose a forest: the trees are cut down and the carbon store shrinks. For example, in Muhos and Kajaani forest was cleared before the environmental impact assessment (EIA) was finished. On 6 Oct 2026 the Finnish Supervisory Agency asked for the work to stop until the EIA is done.' },
        field: { fi: 'Paikkana on pelto: viljelysmaata jää pois käytöstä, ja maisema muuttuu avoimesta rakennetuksi.', en: 'The site is farmland: farmland goes out of use and an open landscape becomes built-up.' },
      }[d.site];
      m.notes = { fi: 'Luonto- ja maisema-arvoja ei lasketa numeroina; ne selvitetään kaavoituksessa ja YVA:ssa. Joillekin hankkeille on ostettu paljon enemmän maata kuin rakennukset tarvitsevat (esim. Google Muhos ja Kajaani noin 1 400 ha).', en: 'Nature and landscape values are not calculated as numbers; they are studied in zoning and the EIA. Some projects have bought much more land than the buildings need (e.g. Google Muhos and Kajaani about 1,400 ha).' };
      break;
    case 'backupPower':
      m.unit = UNITS.mwFuel;
      m.headline.when = WHEN.opNow;
      m.formula = { fi: `${itFi} × varavoimakoneiden polttoaineteho megawattia kohden.`, en: `${itEn} × generator fuel power per megawatt.` };
      m.inputs = ['backup.fuelPerMW', 'backup.generatorSize', 'backup.dieselPerMW', 'backup.testCo2PerMW', 'backup.eiaFuelMW', 'backup.permitFuelMW'];
      m.drivers = ['backup.fuelPerMW'];
      add('generators', { fi: 'dieselgeneraattoreita noin {range}', en: 'diesel generators: about {range}' }, { format: 'int' });
      add('diesel', { fi: 'dieseliä varastossa noin {typ} tonnia (vuorokauden tarve)', en: 'about {typ} tonnes of diesel stored (one day’s need)' });
      add('testCo2', { fi: 'koekäyttöjen päästöt noin {typ} t CO₂ vuodessa', en: 'test runs emit about {typ} t CO₂ a year' });
      {
        const caseFi = 'Viranomainen voi vaatia YVA:n myös tapauskohtaisesti, jos vaikutukset ovat todennäköisesti merkittäviä.';
        const caseEn = 'The authority can also require an EIA case by case if significant impacts are likely.';
        m.townContext = tl.needsEIA
          ? { fi: 'Polttoaineteho on vähintään 300 MW, joten hankkeesta tehdään ympäristövaikutusten arviointi (YVA). Jos töihin ryhdytään ennen arviointia, viranomainen voi vaatia keskeyttämään ne. Varavoima vaatii myös ympäristöluvan.', en: 'The fuel power is at least 300 MW, so the project needs an environmental impact assessment (EIA). If work starts before the assessment, the authority can require it to stop. The backup power also needs an environmental permit.' }
          : tl.needsPermit
            ? { fi: `Vähintään 50 MW:n polttoaineteho vaatii ympäristöluvan. ${caseFi}`, en: `At least 50 MW of fuel power needs an environmental permit. ${caseEn}` }
            : { fi: `1–50 MW:n polttolaitokset rekisteröidään (VNA 1065/2017). ${caseFi}`, en: `Combustion plants of 1–50 MW are registered (Decree 1065/2017). ${caseEn}` };
      }
      m.notes = { fi: 'Generaattorit käyvät vain koekäytöissä ja sähkökatkoissa; kantaverkon katkot ovat keskimäärin 2–3 minuuttia vuodessa. Riskejä ovat polttoainevuodot ja tulipalossa sammutusvesien valuminen ympäristöön; akustot (litiumioni) vaativat paloturvallisuussuunnittelua.', en: 'The generators run only in tests and blackouts; main-grid outages average 2–3 minutes a year. Risks include fuel leaks and firefighting water running off in a fire; lithium-ion batteries need fire-safety planning.' };
      break;
    case 'eWaste':
      m.unit = UNITS.tCycle;
      m.confidence = 'weak';
      m.headline.when = { fi: `kerralla, kun laitteet vaihdetaan (noin ${nf(tl.refreshEvery, 'fi')} vuoden välein)`, en: `at each equipment refresh (about every ${nf(tl.refreshEvery, 'en')} years)` };
      m.formula = { fi: `${itFi} × elektroniikkaa megawattia kohden vaihtokierroksella. Aikajanalla vaihdot näkyvät piikkeinä.`, en: `${itEn} × electronics per megawatt per refresh. Refreshes show as spikes on the timeline.` };
      m.inputs = ['ewaste.perMW', 'ewaste.refreshYears'];
      m.drivers = ['ewaste.perMW'];
      add('perYear', { fi: 'keskimäärin {range} tonnia vuodessa', en: 'on average {range} tonnes a year' });
      m.notes = { fi: 'Määrä riippuu laitteista: tiheät tekoälyräkit painavat noin 11–13 tonnia megawattia kohden, tavalliset palvelinsalit enemmän. Järvenpään YVA arvioi pienemmän määrän (3–4 t/MW), joten väli on leveä. Laitteet kierrätetään tai käytetään uudelleen; tavoite on usein 100 %. Laitteiden valmistuksen päästöjä ei ole laskettu tähän.', en: 'The amount depends on the hardware: dense AI racks weigh about 11–13 tonnes per megawatt, ordinary server halls more. The Järvenpää EIA estimates less (3–4 t/MW), so the range is wide. The equipment is recycled or reused; the target is often 100%. The emissions of making the equipment are not included here.' };
      break;
    default:
      break;
  }
  if (!m.inputs.length) m.inputs = ['utilisation'];
  return m;
}

// ------------------------------------------------------------------ events

function buildEvents(d, T, tl, reuseOn, heatStart) {
  const ev = [];
  const push = (year, key, title, text) => ev.push({ year: Math.round(year * 100) / 100, key, title, text });
  push(0, 'zoning', { fi: 'Kaavoitus ja osallistuminen alkaa', en: 'Zoning and public participation begin' },
    tl.needsEIA
      ? { fi: 'Kunta julkaisee osallistumis- ja arviointisuunnitelman (OAS). Asukkaat voivat kysyä ja antaa mielipiteensä.', en: 'The town publishes a participation and assessment plan (OAS). Residents can ask questions and give their views.' }
      : { fi: 'Kunta julkaisee osallistumis- ja arviointisuunnitelman (OAS). Asukkaat voivat kysyä ja antaa mielipiteensä. Viranomainen voi vaatia myös ympäristövaikutusten arvioinnin (YVA) tapauskohtaisesti.', en: 'The town publishes a participation and assessment plan (OAS). Residents can ask questions and give their views. The authority can also require an environmental impact assessment (EIA) case by case.' });
  if (tl.needsEIA) {
    push(0.3, 'eia', { fi: 'Ympäristövaikutusten arviointi (YVA)', en: 'Environmental impact assessment (EIA)' },
      { fi: 'Varavoimakoneiden polttoaineteho on vähintään 300 MW, joten tehdään YVA: vaikutukset selvitetään ja asukkaille järjestetään yleisötilaisuuksia. Jos töihin ryhdytään ennen arviointia, viranomainen voi keskeyttää ne: esimerkiksi Muhoksella ja Kajaanissa Lupa- ja valvontavirasto kehotti 6.10.2026 keskeyttämään valmistelutyöt, kunnes YVA on tehty.', en: 'The generators’ fuel power is at least 300 MW, so an EIA is required: impacts are studied and public events are held for residents. If work starts before the assessment, the authority can halt it: for example, in Muhos and Kajaani the Finnish Supervisory Agency asked on 6 Oct 2026 for preparatory work to stop until the EIA is done.' });
  }
  if (tl.needsPermit) {
    push(Math.max(0.5, tl.plan - 0.5), 'permit', { fi: 'Ympäristölupa haetaan', en: 'Environmental permit applied for' },
      { fi: 'Vähintään 50 MW:n varavoima vaatii ympäristöluvan. Lupaviranomainen asettaa ehdot esimerkiksi melulle ja päästöille.', en: 'Backup power of at least 50 MW needs an environmental permit. The authority sets conditions, e.g. for noise and emissions.' });
  } else if (tl.needsRegistration) {
    push(Math.max(0.5, tl.plan - 0.5), 'permit', { fi: 'Varavoima rekisteröidään', en: 'Backup power registered' },
      { fi: '1–50 MW:n polttolaitokset rekisteröidään ympäristönsuojelulain mukaan (VNA 1065/2017). Asetus asettaa vaatimukset esimerkiksi päästöille.', en: 'Combustion plants of 1–50 MW are registered under the Environmental Protection Act (Decree 1065/2017). The decree sets requirements, e.g. for emissions.' });
  }
  push(Math.max(0.2, tl.plan - 0.2), 'zoningDecision', { fi: 'Kaava hyväksytään', en: 'Zoning plan approved' },
    { fi: 'Valtuusto päättää kaavasta. Päätöksestä voi valittaa, mikä voi viivästyttää hanketta.', en: 'The council decides on the plan. The decision can be appealed, which can delay the project.' });
  push(tl.plan, 'constructionStart', { fi: 'Rakentaminen alkaa', en: 'Construction starts' },
    { fi: d.site === 'forest' ? 'Metsä raivataan ja maanrakennus alkaa. Raskasta liikennettä ja melua on eniten nyt.' : 'Maanrakennus alkaa. Raskasta liikennettä ja melua on eniten nyt.', en: d.site === 'forest' ? 'The forest is cleared and earthworks begin. Heavy traffic and noise are at their highest now.' : 'Earthworks begin. Heavy traffic and noise are at their highest now.' });
  push(tl.plan + (tl.open - tl.plan) / 2, 'constructionPeak', { fi: 'Rakentamisen huippu', en: 'Construction peak' },
    { fi: 'Työmaalla on eniten ihmisiä. Majoitus ja palvelut ovat kovalla käytöllä.', en: 'The most people are on site. Housing and services are in high demand.' });
  push(tl.open, 'opening', { fi: 'Datakeskus avataan', en: 'The data centre opens' },
    { fi: tl.halls > 1 ? 'Ensimmäinen sali käynnistyy. Seuraavat salit rakennetaan käytön rinnalla.' : 'Palvelimet käynnistyvät ja sähkönkulutus alkaa.', en: tl.halls > 1 ? 'The first hall starts up. The next halls are built alongside operation.' : 'The servers start and electricity use begins.' });
  for (let k = 1; k < tl.online.length; k++) {
    push(tl.online[k], 'expansion', { fi: `Sali ${k + 1} valmistuu`, en: `Hall ${k + 1} completed` },
      { fi: 'Lisää palvelimia otetaan käyttöön, ja sähkönkulutus kasvaa.', en: 'More servers start up and electricity use grows.' });
  }
  if (reuseOn && heatStart != null && heatStart < 30) {
    push(heatStart, 'heatFirst', { fi: 'Ensimmäinen lämpö kaukolämpöverkkoon', en: 'First heat to the district-heating network' },
      { fi: 'Putki ja lämpöpumppulaitos ovat valmiit. Datakeskuksen lämpö alkaa lämmittää koteja.', en: 'The pipe and heat-pump plant are ready. The data centre’s heat starts warming homes.' });
  } else if (!reuseOn) {
    push(tl.open + 0.1, 'heatWasted', { fi: 'Lämpö johdetaan ilmaan', en: 'Heat released into the air' },
      T.dhStatus === 'notInStats'
        ? { fi: 'Kaukolämpöverkkoa ei ole Energiateollisuuden tilastossa, joten lämpö johdetaan ilmaan, ellei sille löydy käyttäjää.', en: 'There is no district-heating network in Finnish Energy’s statistics, so the heat is released into the air unless a user is found.' }
        : { fi: 'Tässä suunnitelmassa hukkalämpö johdetaan ilmaan, joten se jää käyttämättä.', en: 'In this design the waste heat is released into the air, so it goes unused.' });
  }
  for (const r of tl.refreshes) {
    push(r, 'refresh', { fi: 'Laitteet vaihdetaan', en: 'Equipment refresh' },
      { fi: 'Palvelimet vaihdetaan uusiin. Vanhat kierrätetään tai käytetään uudelleen.', en: 'The servers are replaced. The old ones are recycled or reused.' });
  }
  push(tl.endOfLife, 'endOfLife', { fi: 'Päätös tulevaisuudesta', en: 'Decision on the future' },
    { fi: 'Laitoksen suunniteltu käyttöikä on noin 15–20 vuotta (Järvenpään YVA). Silloin tekniset järjestelmät (UPS, jäähdytys, varavoima) uusitaan, jos toimintaa jatketaan. Rakennus voidaan myös ottaa muuhun käyttöön tai purkaa.', en: 'The plant’s design life is about 15–20 years (Järvenpää EIA). By then the technical systems (UPS, cooling, backup power) are renewed if operation continues. The building can also be put to another use or demolished.' });
  return ev.sort((a, b) => a.year - b.year);
}

// ------------------------------------------------------------------ All of Finland

// The slider is IT load (server capacity). References stated on another basis are converted to it.
const TODAY_GW_IT = Math.round((0.3 / (COEF.utilisation.typ * COEF['pue.air'].typ)) * 100) / 100; // ≈ 0.37
const SIGNED_GW_IT = Math.round((3 / COEF.gridPeakRatio.typ) * 10) / 10; // ≈ 2.4

export const FINLAND_REFERENCES = [
  {
    key: 'today', gw: TODAY_GW_IT, gwStated: 0.3, basis: 'averageDraw', year: 2025,
    title: { fi: 'Nykyiset datakeskukset', en: 'Today’s data centres' },
    text: {
      fi: `Ylen mukaan (5.11.2025) Suomen datakeskukset käyttävät sähköä noin 300 MW:n teholla. Luku on sähkön käyttöä, ei palvelinten tehoa; oletamme sen keskimääräiseksi. Palvelinten tehoksi muutettuna: 300 MW ÷ (käyttöaste ${nfx(COEF.utilisation.typ, 'fi')} × PUE ${nfx(COEF['pue.air'].typ, 'fi')}) ≈ ${nfx(TODAY_GW_IT, 'fi')} GW.`,
      en: `According to Yle (5 Nov 2025), Finland’s data centres use about 300 MW of electricity. That is electricity use, not server capacity; we take it as an average. Converted to server (IT) capacity: 300 MW ÷ (utilisation ${nfx(COEF.utilisation.typ, 'en')} × PUE ${nfx(COEF['pue.air'].typ, 'en')}) ≈ ${nfx(TODAY_GW_IT, 'en')} GW.`,
    },
    source: SRC.yleDc,
  },
  {
    key: 'fdca2030', gw: 2.5, gwStated: 2.5, basis: 'scenario', year: 2030,
    title: { fi: 'Datakeskusyhdistyksen skenaario 2030', en: 'Data Centre Association scenario for 2030' },
    text: {
      fi: 'Suomen datakeskusyhdistyksen mukaan 2 500 MW on mahdollinen jo vuonna 2030 (Yle 5.11.2025). Lähde ei kerro, onko luku palvelinten tehoa vai sähköliittymää; käytämme sitä sellaisenaan palvelinten tehona.',
      en: 'The Finnish Data Center Association says 2,500 MW is possible as early as 2030 (Yle, 5 Nov 2025). The source does not say whether this is server capacity or grid connection; we use it as server capacity as it is.',
    },
    source: SRC.yleDc,
  },
  {
    key: 'fingridSigned', gw: SIGNED_GW_IT, gwStated: 3, basis: 'grid', year: 2026,
    title: { fi: 'Allekirjoitetut liittymissopimukset', en: 'Signed grid connection agreements' },
    text: {
      fi: `Fingridin mukaan liittymissopimuksen allekirjoittaneiden datakeskushankkeiden suunniteltu kokonaisteho oli kesäkuun 2026 lopussa yli 3 GW. Pidämme lukua sähköliittymän tehona; palvelinten tehoksi muutettuna noin 3 GW ÷ ${nfx(COEF.gridPeakRatio.typ, 'fi')} ≈ ${nfx(SIGNED_GW_IT, 'fi')} GW. Kaikki hankkeet eivät välttämättä toteudu.`,
      en: `According to Fingrid, the planned total capacity of data-centre projects with signed connection agreements was over 3 GW at the end of June 2026. We treat it as grid-connection capacity; converted to server capacity about 3 GW ÷ ${nfx(COEF.gridPeakRatio.typ, 'en')} ≈ ${nfx(SIGNED_GW_IT, 'en')} GW. Not all projects may be built.`,
    },
    source: SRC.fingridH1,
  },
];

/**
 * National scenario: totalGW = total IT load (server capacity) of all data centres in Finland.
 * Returns { totalGW, electricityTWh, shareOfFinland, shareOfForecast2030, olkiluoto3, heatTWh, heatPumpTWh,
 *           heatShareOfDistrictHeat, electricityTaxEur, order, references, assumptions, notes }.
 * Each value: { low, typ, high, format: 'num'|'pct'|'eur', unit, title, text, formula, inputs, confidence, sources }.
 * 'pct' values are fractions (0.25 = 25 %), ready for fmtPct().
 */
export function finlandScenario(totalGW, opts = {}) {
  const gw = Number.isFinite(totalGW) && totalGW > 0 ? totalGW : 0;
  const n = Math.max(20, Math.min(4000, Math.round(opts.samples || 400)));
  const samples = cachedSamples(n, Number.isFinite(opts.seed) ? opts.seed : 1, opts.overrides);
  const A = { twh: [], share: [], fc: [], ol3: [], heat: [], hp: [], heatShare: [], tax: [] };
  for (const c of samples) {
    const it = gw * c.utilisation * 8.76; // TWh of server energy
    const twh = it * c['pue.air'];
    const cop = c['heat.cop'];
    const heat = ((it * c['heat.capture'] * cop) / (cop - 1)) * c['heat.usableShare']; // incl. heat-pump electricity
    A.twh.push(twh);
    A.share.push(twh / c['finland.consumption2025']);
    A.fc.push(twh / c['finland.forecast2030']);
    A.ol3.push(twh / c['finland.ol3']);
    A.heat.push(heat);
    A.hp.push(heat / cop);
    A.heatShare.push(heat / c['finland.districtHeat']);
    A.tax.push(twh * 1e9 * c['tax.electricity']);
  }
  const R = (arr, extra) => ({ ...pct3(arr), ...extra });
  const out = {
    totalGW: gw,
    electricityTWh: R(A.twh, {
      format: 'num', unit: { fi: 'TWh/v', en: 'TWh/yr' }, title: { fi: 'Datakeskusten sähkönkulutus', en: 'Data centres’ electricity use' },
      text: { fi: '{low}–{high} TWh sähköä vuodessa', en: '{low}–{high} TWh of electricity a year' },
      formula: { fi: 'IT-teho (palvelinten teho) × käyttöaste × PUE × 8 760 tuntia. Oletamme ulkoilmajäähdytyksen kaltaisen tehokkuuden. Ei sisällä lämpöpumppujen sähköä.', en: 'IT load (server capacity) × utilisation × PUE × 8,760 hours. We assume efficiency similar to outdoor-air cooling. Does not include the heat pumps’ electricity.' },
      inputs: ['utilisation', 'pue.air'], confidence: 'medium', sources: [SRC.euEed, SRC.nebiusHeat, SRC.msEfficiency],
    }),
    shareOfFinland: R(A.share, {
      format: 'pct', unit: { fi: '%', en: '%' }, title: { fi: 'Osuus Suomen sähkönkulutuksesta', en: 'Share of Finland’s electricity use' },
      text: { fi: '{low}–{high} % Suomen sähkönkulutuksesta vuonna 2025 (84,5 TWh)', en: '{low}–{high}% of Finland’s electricity use in 2025 (84.5 TWh)' },
      formula: { fi: 'Datakeskusten sähkö / Suomen kulutus 2025.', en: 'Data centres’ electricity / Finland’s use in 2025.' },
      inputs: ['finland.consumption2025'], confidence: 'medium', sources: [SRC.fingridH1],
    }),
    shareOfForecast2030: R(A.fc, {
      format: 'pct', unit: { fi: '%', en: '%' }, title: { fi: 'Osuus Fingridin vuoden 2030 ennusteesta', en: 'Share of Fingrid’s 2030 forecast' },
      text: { fi: '{low}–{high} % Fingridin ennustamasta kulutuksesta 2030 (106–123 TWh)', en: '{low}–{high}% of the use Fingrid forecasts for 2030 (106–123 TWh)' },
      formula: { fi: 'Datakeskusten sähkö / Fingridin ennuste 2030.', en: 'Data centres’ electricity / Fingrid’s 2030 forecast.' },
      inputs: ['finland.forecast2030'], confidence: 'medium', sources: [SRC.fingridForecast],
    }),
    olkiluoto3: R(A.ol3, {
      format: 'num', unit: { fi: 'kertaa OL3', en: '× OL3' }, title: { fi: 'Verrattuna Olkiluoto 3:een', en: 'Compared with Olkiluoto 3' },
      text: { fi: '{low}–{high} kertaa Olkiluoto 3:n vuosituotanto (10,4 TWh vuonna 2025)', en: '{low}–{high} times Olkiluoto 3’s annual output (10.4 TWh in 2025)' },
      formula: { fi: 'Datakeskusten sähkö / OL3:n tuotanto 2025.', en: 'Data centres’ electricity / OL3’s output in 2025.' },
      inputs: ['finland.ol3'], confidence: 'medium', sources: [SRC.tvo],
    }),
    heatTWh: R(A.heat, {
      format: 'num', unit: { fi: 'TWh/v', en: 'TWh/yr' }, title: { fi: 'Hyödynnettävissä oleva hukkalämpö', en: 'Usable waste heat' },
      text: { fi: '{low}–{high} TWh lämpöä vuodessa, jos kaikki hyödynnettäisiin (sisältää lämpöpumppujen sähkön)', en: '{low}–{high} TWh of heat a year if all of it were used (includes the heat pumps’ electricity)' },
      formula: { fi: 'Palvelinten sähkö × talteen saatava osuus × lämpöpumpun lisäys × vuoden aikana hyödynnettävä osuus. Luku sisältää lämpöpumppujen sähkön.', en: 'Server electricity × captured share × heat-pump boost × share usable over a year. Includes the heat pumps’ electricity.' },
      inputs: ['heat.capture', 'heat.cop', 'heat.usableShare'], confidence: 'weak', sources: [SRC.kamk, SRC.fortum],
    }),
    heatPumpTWh: R(A.hp, {
      format: 'num', unit: { fi: 'TWh/v', en: 'TWh/yr' }, title: { fi: 'Lämpöpumppujen sähkö', en: 'Heat-pump electricity' },
      text: { fi: '{low}–{high} TWh sähköä vuodessa lämpöpumpuille, jos kaikki käyttökelpoinen lämpö hyödynnettäisiin', en: '{low}–{high} TWh of electricity a year for heat pumps if all the usable heat were used' },
      formula: { fi: 'Hyödynnettävä hukkalämpö ÷ lämpöpumpun lämpökerroin (COP 3–5). Tämä sähkö tulee datakeskusten oman sähkönkulutuksen lisäksi; sen käyttää usein kaukolämpöyhtiön lämpöpumppulaitos.', en: 'Usable waste heat ÷ heat-pump efficiency (COP 3–5). This electricity comes on top of the data centres’ own use; it is often used by the district-heating company’s heat-pump plant.' },
      inputs: ['heat.cop', 'heat.capture', 'heat.usableShare'], confidence: 'weak', sources: [SRC.nebiusHeat, SRC.kamk, SRC.calefa],
    }),
    heatShareOfDistrictHeat: R(A.heatShare, {
      format: 'pct', unit: { fi: '%', en: '%' }, title: { fi: 'Verrattuna Suomen kaukolämpöön', en: 'Compared with Finland’s district heat' },
      text: { fi: '{low}–{high} % Suomen kaukolämmön kulutuksesta (32,7 TWh vuonna 2024)', en: '{low}–{high}% of Finland’s district heat use (32.7 TWh in 2024)' },
      formula: { fi: 'Hyödynnettävä hukkalämpö / Suomen kaukolämpö 2024.', en: 'Usable waste heat / Finland’s district heat in 2024.' },
      inputs: ['finland.districtHeat'], confidence: 'weak', sources: [SRC.energiateollisuus],
    }),
    electricityTaxEur: R(A.tax, {
      format: 'eur', unit: { fi: '€/v', en: '€/yr' }, title: { fi: 'Sähkövero valtiolle', en: 'Electricity tax to the state' },
      text: { fi: 'sähköveroa valtiolle {low}–{high} € vuodessa', en: '€{low}–{high} a year in electricity tax to the state' },
      formula: { fi: 'Sähkönkulutus × 2,24 snt/kWh (veroluokka I, 1.7.2026 alkaen).', en: 'Electricity use × 2.24 c/kWh (class I since 1 July 2026).' },
      inputs: ['tax.electricity'], confidence: 'strong', sources: [SRC.veroSahko, SRC.vavm],
    }),
  };
  out.order = ['electricityTWh', 'shareOfFinland', 'shareOfForecast2030', 'olkiluoto3', 'heatTWh', 'heatPumpTWh', 'heatShareOfDistrictHeat', 'electricityTaxEur'];
  out.references = FINLAND_REFERENCES;
  out.assumptions = ['utilisation', 'pue.air', 'heat.capture', 'heat.cop', 'heat.usableShare', 'finland.consumption2025', 'finland.forecast2030', 'finland.ol3', 'finland.districtHeat', 'tax.electricity'];
  out.notes = {
    fi: 'Liukusäädin kertoo palvelinten yhteenlasketun tehon (IT-teho). Viitepisteet on muutettu samaan perustaan; kunkin lähteen oma luku ja muunnos on kerrottu. Hukkalämmön osuus on teoreettinen yläraja: lämpö syntyy usein muualla kuin siellä, missä sitä tarvitaan. Sähkön hintavaikutusta emme laske: arviot vaihtelevat (AFRY: noin 10 % korkeampi keskihinta 2 500 MW:lla; Energiateollisuus pitää huolta liioiteltuna).',
    en: 'The slider is the total server capacity (IT load). The reference points are converted to the same basis; each source’s own figure and the conversion are given. The heat share is a theoretical maximum: heat is often produced far from where it is needed. We do not calculate a price effect: estimates differ (AFRY: about 10% higher average price with 2,500 MW; Finnish Energy considers the worry exaggerated).',
  };
  return out;
}
