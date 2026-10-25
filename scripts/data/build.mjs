// Builds src/data/towns.js and src/data/mapPaths.js from the raw files in data-raw/.
//   node scripts/data/fetch.mjs                     (downloads, once)
//   python -I scripts/data/xlsx2json.py data-raw/KL_Vuositaulukot_25.xlsx data-raw/KL_Vuositaulukot_25.json
//   node scripts/data/build.mjs [--budget 300000]   (writes the two modules and prints a summary)
// Node built-ins only. Every number written comes from a downloaded file; derivations are listed in TOWNS_META.notes.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTopology, effectiveAreas, simplifyArc, ringArea, polylabel, pointInPolygon } from './geo.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = (f) => join(APP, 'data-raw', f);
const readJSON = (f) => JSON.parse(readFileSync(RAW(f), 'utf8'));
const argBudget = process.argv.indexOf('--budget');
const PATH_BUDGET = argBudget > 0 ? Number(process.argv[argBudget + 1]) : 300000; // bytes for paths + outline
const GENERATED = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- geometry
const geo = readJSON('kunta1000k_2026.3067.geojson');
const features = geo.features.map((f) => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  return {
    code: String(f.properties.kunta).padStart(3, '0'),
    nimi: f.properties.nimi, namn: f.properties.namn, name: f.properties.name,
    polygons: polys.map((poly) => poly.map((ring) => ring.map(([x, y]) => [Math.round(x), Math.round(y)]))),
  };
});

let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
for (const f of features) for (const poly of f.polygons) for (const [x, y] of poly[0]) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const PAD = 10, WIDTH = 800;
const SCALE = (WIDTH - 2 * PAD) / (maxX - minX); // SVG units per metre
const HEIGHT = Math.ceil((maxY - minY) * SCALE + 2 * PAD);
// integer tenths of an SVG unit; y flipped so north is up
const proj = ([x, y]) => [Math.round(((x - minX) * SCALE + PAD) * 10), Math.round(((maxY - y) * SCALE + PAD) * 10)];

const topo = buildTopology(features);
const arcAreas = topo.arcs.map((a) => effectiveAreas(a));

// Rings that only touch the sea/foreign border (all arcs single-use) and are tiny are dropped (small islets),
// except the largest ring of each municipality.
const MIN_ISLAND_M2 = 1.5e6;
const ringsByFeature = new Map();
for (const r of topo.rings) {
  r.areaM2 = Math.abs(ringArea(r.pts));
  r.isolated = r.arcs.every((a) => topo.arcUse[a.arc] === 1);
  if (!ringsByFeature.has(r.fid)) ringsByFeature.set(r.fid, []);
  ringsByFeature.get(r.fid).push(r);
}
for (const list of ringsByFeature.values()) {
  const biggest = list.filter((r) => r.idx === 0).sort((a, b) => b.areaM2 - a.areaM2)[0];
  for (const r of list) r.keep = r === biggest || r.idx > 0 || !r.isolated || r.areaM2 >= MIN_ISLAND_M2;
}

function ringPoints(r, simpArcs) {
  const out = [];
  for (const { arc, rev } of r.arcs) {
    let pts = simpArcs[arc];
    if (rev) pts = pts.slice().reverse();
    for (let i = out.length ? 1 : 0; i < pts.length; i++) out.push(pts[i]);
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  // drop consecutive duplicates produced by rounding
  return out.filter((p, i) => i === 0 || p[0] !== out[i - 1][0] || p[1] !== out[i - 1][1]);
}

const fmt = (n) => {
  const s = (n / 10).toString();
  return s.startsWith('0.') ? s.slice(1) : s.startsWith('-0.') ? '-' + s.slice(2) : s;
};
function encodeRing(pts) {
  let d = 'M' + fmt(pts[0][0]) + ' ' + fmt(pts[0][1]) + 'l';
  let prev = null;
  for (let i = 1; i < pts.length; i++) {
    for (const v of [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]) {
      const s = fmt(v);
      // SVG number grammar: "-" always starts a new number; "." does too when the previous number already has one
      const glue = prev === null || s.startsWith('-') || (s.startsWith('.') && prev.includes('.'));
      d += glue ? s : ' ' + s;
      prev = s;
    }
  }
  return d + 'z';
}

function render(minAreaM2) {
  const simpArcs = topo.arcs.map((a, i) => simplifyArc(a, arcAreas[i], minAreaM2).map(proj));
  const paths = {};
  const polysProjected = {};
  const directedOuter = [];
  features.forEach((f, fi) => {
    const rings = (ringsByFeature.get(fi) || []).filter((r) => r.keep);
    const byPoly = new Map();
    for (const r of rings) {
      let pts = ringPoints(r, simpArcs);
      if (pts.length < 3) continue;
      const a = ringArea(pts);
      if (a === 0) continue;
      const reversed = (r.idx === 0) !== (a > 0); // outer rings positive (clockwise on screen), holes negative
      if (reversed) pts = pts.slice().reverse();
      if (!byPoly.has(r.poly)) byPoly.set(r.poly, []);
      byPoly.get(r.poly)[r.idx] = pts;
      // single-use arcs form the national outline; keep them directed like their ring
      for (const { arc, rev } of r.arcs) {
        if (topo.arcUse[arc] !== 1) continue;
        let p = simpArcs[arc];
        if (rev !== reversed) p = p.slice().reverse();
        if (p.length >= 2) directedOuter.push(p);
      }
    }
    const polys = [...byPoly.values()].filter((p) => p[0]).map((p) => p.filter(Boolean));
    polysProjected[f.code] = polys;
    paths[f.code] = polys.flat().map(encodeRing).join('');
  });
  // chain directed outline arcs into closed loops
  const starts = new Map();
  directedOuter.forEach((p, i) => { const k = p[0].join(','); if (!starts.has(k)) starts.set(k, []); starts.get(k).push(i); });
  const used = new Array(directedOuter.length).fill(false);
  const loops = [];
  for (let i = 0; i < directedOuter.length; i++) {
    if (used[i]) continue;
    const loop = [];
    let j = i;
    while (j !== undefined && !used[j]) {
      used[j] = true;
      const p = directedOuter[j];
      for (let k = loop.length ? 1 : 0; k < p.length; k++) loop.push(p[k]);
      const end = p[p.length - 1].join(',');
      j = (starts.get(end) || []).find((x) => !used[x]);
    }
    if (loop.length > 2 && loop[0].join(',') === loop[loop.length - 1].join(',')) loop.pop();
    if (loop.length >= 3) loops.push(loop);
  }
  const outline = loops.map(encodeRing).join('');
  const size = Object.values(paths).reduce((s, d) => s + d.length + 10, 0) + outline.length;
  return { paths, outline, size, polysProjected, loops };
}

// binary search the simplification area so paths + outline fit the byte budget
let lo = 1e3, hi = 5e8, best = null;
for (let it = 0; it < 28; it++) {
  const mid = Math.sqrt(lo * hi);
  const r = render(mid);
  if (r.size <= PATH_BUDGET) { best = { ...r, minArea: mid }; hi = mid; } else lo = mid;
}
const map = best;
console.log(`map: Visvalingam min area ${(map.minArea / 1e6).toFixed(3)} km², ${map.size} bytes of path data, ${map.loops.length} outline loops`);

// centroids: pole of inaccessibility of the largest drawn polygon (SVG units)
const centroids = {};
for (const f of features) {
  const polys = map.polysProjected[f.code].map((p) => p.map((ring) => ring.map(([x, y]) => [x / 10, y / 10])));
  polys.sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])));
  const [x, y] = polylabel(polys[0], 0.05);
  let c = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  if (!pointInPolygon(c[0], c[1], polys[0])) c = [x, y].map((v) => Math.round(v * 100) / 100);
  if (!pointInPolygon(c[0], c[1], polys[0])) throw new Error('centroid outside polygon for ' + f.code);
  centroids[f.code] = c;
}

// ---------------------------------------------------------------- statistics
function jsonStat(file) {
  const j = readJSON(file);
  const dims = j.id.map((id, k) => ({ id, size: j.size[k], index: j.dimension[id].category.index, label: j.dimension[id].category.label }));
  const strides = dims.map((_, k) => dims.slice(k + 1).reduce((s, d) => s * d.size, 1));
  const get = (sel) => {
    let idx = 0;
    dims.forEach((d, k) => {
      const v = sel[d.id] ?? Object.keys(d.index)[0];
      const pos = d.index[v];
      if (pos === undefined) throw new Error(`${file}: no ${d.id}=${v}`);
      idx += pos * strides[k];
    });
    const val = j.value[idx];
    return val === null || val === undefined ? null : val;
  };
  return { get, dims, updated: j.updated, raw: j };
}

const avain = jsonStat('avainluvut.json');
const avainLabels = avain.dims.find((d) => d.id === 'Tiedot').label;
const tyokay = jsonStat('tyokay-115b.json');
const tyAlue = tyokay.dims[0].id;
const tyYear = Object.keys(tyokay.dims.find((d) => d.id === 'timeperiod_y').index)[0];
const kive = jsonStat('kive_202.json');
const kiveYears = Object.keys(kive.dims.find((d) => d.id === 'Vuosi').index).sort();
const kiveYearLabel = kive.dims.find((d) => d.id === 'Vuosi').label;
const KIVE_SOV = 'Sovellettu kiinteistöveroprosentti';
const tyAreas = new Set(Object.keys(tyokay.dims[0].index));
const kiveAreas = new Set(Object.keys(kive.dims.find((d) => d.id === 'Alue').index));

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------- district heat (Energiateollisuus)
const kl = readJSON('KL_Vuositaulukot_25.json');
const val = (v) => (v === '-' ? 0 : typeof v === 'number' ? v : null); // '-' = zero, '..' = not reported
const networkUse = new Map(); // code -> { use GWh|null, name }
for (const r of kl.Taul1) {
  if (!r || r[3] == null || typeof r[4] !== 'string') continue;
  networkUse.set(String(r[3]).trim(), { use: val(r[9]), name: r[4] });
}
const t8 = [];
for (const r of kl.Taul8) {
  if (!r || typeof r[1] !== 'string' || r[2] == null || !/^\d{3}(\.\d+)?$/.test(String(r[2]).trim())) continue;
  t8.push({
    munis: r[1].split(',').map((s) => s.trim()),
    code: String(r[2]).trim(),
    seller: String(r[3] || '').trim(),
    residents: r[5] === null ? 0 : val(r[5]), // empty cell with share 0 = no residents in DH buildings
    population: num(r[6]),
  });
}

const nameKey = (s) => s.toLocaleLowerCase('fi').replace(/\s+/g, ' ').trim();
const featureByName = new Map();
for (const f of features) {
  for (const n of [f.nimi, f.namn, f.name, f.nimi.split(' - ')[0]]) featureByName.set(nameKey(n), f.code);
}
const dhRows = new Map(); // municipality code -> rows
const unmatched = [];
for (const row of t8) {
  for (const m of row.munis) {
    const code = featureByName.get(nameKey(m));
    if (!code) { unmatched.push(m); continue; }
    if (!dhRows.has(code)) dhRows.set(code, []);
    dhRows.get(code).push(row);
  }
}
if (unmatched.length) console.warn('WARN district heat names not matched:', unmatched);
// network codes used by more than one municipality (split by population)
const networkMunis = new Map();
for (const [code, rows] of dhRows) for (const r of rows) {
  if (!networkMunis.has(r.code)) networkMunis.set(r.code, new Set());
  networkMunis.get(r.code).add(code);
}

// Loviisan Lämpö Oy reports one network total for Loviisa, Pornainen, Pukkila and Pyhtää (and Lappohja village in Hanko);
// Taul8 lists it under Loviisa only. These towns get has:true with unknown demand.
const SELLER_ONLY = {};
for (const row of t8) {
  const parts = row.seller.split(',').map((s) => s.trim());
  for (const p of parts.slice(1)) {
    const code = featureByName.get(nameKey(p));
    if (code && !dhRows.has(code) && !row.munis.some((m) => featureByName.get(nameKey(m)) === code)) SELLER_ONLY[code] = parts[0];
  }
}

// Verified local networks that are missing from the Energiateollisuus statistics (checked 24.10.2026).
// Applied only when the statistics have no row for the town; demand stays unknown (null).
const LOCAL_DH = {
  '071': { seller: 'Haapaveden Energia ja Vesi Oy', url: 'https://haapavesi.jict.fi/sites/default/files/Tiedote%20kaukol%C3%A4mp%C3%B6%20taksat%202027.pdf' },
  '290': { seller: 'Kuhmon VesiEnergia Oy', url: 'https://www.kuhmo.fi/en/energy-advice/' },
  '854': { seller: 'Pellon Energia Oy', url: 'https://www.pello.fi/asuminen-ja-rakentaminen/aluelampo.html' },
};

const KWH_PER_RESIDENT_MWH = 5.9;
const popByCode = {};
function districtHeat(code) {
  const rows = dhRows.get(code);
  if (!rows) {
    if (LOCAL_DH[code]) return { has: true, demandGWh: null, residentsSharePct: null, seller: LOCAL_DH[code].seller, estimated: true, local: true };
    if (SELLER_ONLY[code]) return { has: true, demandGWh: null, residentsSharePct: null, seller: SELLER_ONLY[code], estimated: true };
    return { has: false, demandGWh: null, residentsSharePct: null, seller: null, estimated: false };
  }
  let demand = 0, estimated = false, demandKnown = true, residents = 0, residentsKnown = true;
  let primary = null, primaryUse = -1;
  for (const r of rows) {
    const net = networkUse.get(r.code);
    let use = net ? net.use : null;
    const sharers = networkMunis.get(r.code);
    if (use !== null && sharers && sharers.size > 1) {
      const tot = [...sharers].reduce((s, c) => s + (popByCode[c] || 0), 0);
      use = (use * (popByCode[code] || 0)) / tot;
      estimated = true;
    }
    if (use === null) {
      if (r.residents !== null && sharers.size === 1) { use = (r.residents * KWH_PER_RESIDENT_MWH) / 1000; estimated = true; }
      else demandKnown = false;
    }
    if (use !== null) demand += use;
    if (r.residents === null || (sharers && sharers.size > 1)) residentsKnown = false; else residents += r.residents;
    const rank = use ?? (r.residents || 0) / 1e6;
    if (rank > primaryUse) { primaryUse = rank; primary = r.seller.split(',')[0].trim(); }
  }
  const pop = popByCode[code];
  return {
    has: true,
    demandGWh: demandKnown ? Math.round(demand * 10) / 10 : null,
    residentsSharePct: residentsKnown && pop ? Math.round((residents / pop) * 1000) / 10 : null,
    seller: primary || null,
    estimated: estimated || !demandKnown,
  };
}

// ---------------------------------------------------------------- assemble towns
const towns = features.map((f) => {
  const ku = 'KU' + f.code;
  const a = (m) => num(avain.get({ Alue: ku, Tiedot: m }));
  popByCode[f.code] = a('M411');
  return f;
}).map((f) => {
  const ku = 'KU' + f.code;
  const a = (m) => num(avain.get({ Alue: ku, Tiedot: m }));
  const employed = a('M137');
  const rate = a('M162');
  let unemployed = tyAreas.has(ku) ? num(tyokay.get({ [tyAlue]: ku, paaasial_toimin_3_20180101: '12' })) : null;
  let unemployedDerived = false;
  if (unemployed === null && employed !== null && rate !== null && rate < 100) {
    unemployed = Math.round((employed * rate) / (100 - rate));
    unemployedDerived = true;
  }
  let rateYear = null, rate26 = null, revenue = null, revenueYear = null;
  if (kiveAreas.has(f.code)) {
    for (const y of kiveYears) {
      const r = num(kive.get({ Alue: f.code, [KIVE_SOV]: '7', Vuosi: y, Tiedot: 'Veroprosentti' }));
      if (r !== null) { rate26 = r; rateYear = y; }
      const e = num(kive.get({ Alue: f.code, [KIVE_SOV]: 'SSSSSS', Vuosi: y, Tiedot: 'Arvo_vero' }));
      if (e !== null) { revenue = Math.round(e); revenueYear = y; }
    }
  }
  const fiName = f.nimi.split(' - ')[0].trim(); // 'Maarianhamina - Mariehamn' -> 'Maarianhamina'
  return {
    code: f.code,
    name: { fi: fiName, sv: f.namn, en: fiName },
    population: a('M411'),
    households: a('M44'),
    employed,
    unemployed,
    unemploymentPct: rate,
    jobs: a('M152'),
    propertyTax: { generalRatePct: rateYear === '2026' ? rate26 : null, revenueEur: revenue, revenueYear: revenueYear ? Number(revenueYear) : null },
    districtHeat: districtHeat(f.code),
    centroid: centroids[f.code],
    _unemployedDerived: unemployedDerived,
  };
});
towns.sort((a, b) => a.name.fi.localeCompare(b.name.fi, 'fi'));

// ---------------------------------------------------------------- checks + summary
const fail = (m) => { console.error('CHECK FAILED:', m); process.exitCode = 1; };
const codes = new Set(towns.map((t) => t.code));
if (towns.length !== 308) fail('expected 308 towns, got ' + towns.length);
if (codes.size !== towns.length) fail('duplicate codes');
if (![...codes].every((c) => /^\d{3}$/.test(c))) fail('codes must be 3 digits');
const by = (c) => towns.find((t) => t.code === c);
const tre = by('837');
if (!tre || Math.abs(tre.population - 263000) > 3000) fail('Tampere population ' + tre?.population);
if (!by('091')) fail('Helsinki missing');
if (!by('075')?.districtHeat.has) fail('Hamina should have district heat');
const noDh = towns.filter((t) => !t.districtHeat.has);
if (noDh.length < 50) fail('expected many small towns without district heat');
const nullCount = (fn) => towns.filter((t) => fn(t) === null || fn(t) === undefined).length;
const derived = towns.filter((t) => t._unemployedDerived).length;
const dhEst = towns.filter((t) => t.districtHeat.has && t.districtHeat.estimated).length;
console.log({
  towns: towns.length,
  populationTotal: towns.reduce((s, t) => s + (t.population || 0), 0),
  nulls: {
    population: nullCount((t) => t.population), households: nullCount((t) => t.households), employed: nullCount((t) => t.employed),
    unemployed: nullCount((t) => t.unemployed), unemploymentPct: nullCount((t) => t.unemploymentPct), jobs: nullCount((t) => t.jobs),
    taxRate: nullCount((t) => t.propertyTax.generalRatePct), taxRevenue: nullCount((t) => t.propertyTax.revenueEur),
    dhDemandWhereHas: towns.filter((t) => t.districtHeat.has && t.districtHeat.demandGWh === null).length,
  },
  unemployedDerivedFromRate: derived,
  districtHeat: { has: towns.length - noDh.length, none: noDh.length, estimatedDemand: dhEst },
  taxRevenueYears: [...new Set(towns.map((t) => t.propertyTax.revenueYear))],
  tampere: tre, hamina: by('075'),
});
console.log('examples without district heat:', noDh.slice(0, 8).map((t) => t.name.fi).join(', '));
console.log('estimated DH:', towns.filter((t) => t.districtHeat.estimated && t.districtHeat.has).map((t) => `${t.name.fi} ${t.districtHeat.demandGWh}`).join('; '));

// ---------------------------------------------------------------- write modules
const avYear = (m) => (avainLabels[m].match(/(\d{4})$/) || [])[1];
const META = {
  generated: GENERATED,
  division: 'Kuntajako 2026 (308 kuntaa)',
  fieldYears: {
    population: Number(avYear('M411')), households: Number(avYear('M44')), employed: Number(avYear('M137')),
    unemploymentPct: Number(avYear('M162')), unemployed: Number(tyYear), jobs: Number(avYear('M152')),
    propertyTaxRate: 2026, propertyTaxRevenue: Number(kiveYears.at(-1)), districtHeat: 2025,
  },
  sources: [
    { name: 'Tilastokeskus, Kuntien avainluvut 2026 (väkiluku 2025, asuntokunnat 2024, työllinen työvoima 2024, työttömyysaste 2024, työpaikat 2023)', type: 'statistics', date: avain.updated.slice(0, 10), url: 'https://pxdata.stat.fi/PxWeb/pxweb/fi/Kuntien_avainluvut/Kuntien_avainluvut__2026/kuntien_avainluvut_2026_viimeisin.px/', licence: 'CC BY 4.0', fields: ['population', 'households', 'employed', 'unemploymentPct', 'jobs'] },
    { name: `Tilastokeskus, Työssäkäynti, taulukko 115b (työttömät ${tyYear})`, type: 'statistics', date: tyokay.updated.slice(0, 10), url: 'https://pxdata.stat.fi/PxWeb/pxweb/fi/StatFin/StatFin__tyokay/115b.px/', licence: 'CC BY 4.0', fields: ['unemployed'] },
    { name: 'Verohallinto, Kiinteistöverotilasto 2.2 (kive_202): yleinen kiinteistöveroprosentti 2026 ja kiinteistövero yhteensä', type: 'statistics', date: kive.updated.slice(0, 10), url: 'https://vero2.stat.fi/PXWeb/pxweb/fi/Vero/Vero__Kiinteistoverot/kive_202.px/', licence: 'Lähde: Verohallinto', fields: ['propertyTax'] },
    { name: 'Energiateollisuus ry, Kaukolämpötilasto 2025, taulukot 1 ja 8 (julkaistu 23.10.2026)', type: 'industry', date: '2026-10-23', url: 'https://energia.fi/wp-content/uploads/2026/10/KL_Vuositaulukot_25.xlsx', licence: 'Lähde: Energiateollisuus ry', fields: ['districtHeat'] },
    { name: 'Tilastokeskus, Kuntapohjaiset tilastointialueet: kunta1000k_2026 (WFS, geo.stat.fi)', type: 'statistics', date: '2026-01-01', url: 'https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetCapabilities', licence: 'CC BY 4.0', fields: ['centroid', 'map'] },
  ],
  notes: [
    { fi: `Työttömien määrä on Tilastokeskuksen työssäkäyntitilastosta (taulukko 115b, vuosi ${tyYear}, pääasiallinen toiminta "työttömät").${derived ? ` ${derived} kunnalle se on laskettu: työllinen työvoima × työttömyysaste / (100 − työttömyysaste).` : ''}`, en: `Number of unemployed is from Statistics Finland employment statistics (table 115b, year ${tyYear}, main activity "unemployed").${derived ? ` For ${derived} towns it is derived: employed × rate / (100 − rate).` : ''}` },
    { fi: 'Kaukolämmön kulutus (demandGWh) on kunnan alueen kaukolämpöverkkojen loppukäyttäjille toimitettu lämpö vuonna 2025 (Energiateollisuus, taulukko 1, sarake 1.5 "käyttö"; sisältää kodit, palvelut ja teollisuuden). Jos kunnassa on useita verkkoja, ne on laskettu yhteen.', en: 'District-heat demand (demandGWh) is the heat delivered to end users of the district-heating networks in the municipality in 2025 (Energiateollisuus, table 1, column 1.5 "use"; includes homes, services and industry). Several networks in one town are added together.' },
    { fi: 'Jos sama verkko palvelee usean kunnan aluetta (esim. Loimua Oy, Jyväskylän seutu), sen kulutus on jaettu kunnille asukasluvun suhteessa ja merkitty arvioksi (estimated: true).', en: 'Where one network serves several municipalities (e.g. Loimua Oy, Jyväskylä region), its use is split by population and marked as an estimate (estimated: true).' },
    { fi: `Jos verkon kulutusta ei ole ilmoitettu, mutta kaukolämpötalojen asukasmäärä on, kulutus on arvioitu: asukkaat × ${String(KWH_PER_RESIDENT_MWH).replace('.', ',')} MWh (estimated: true). Arvio on todennäköisesti alakanttiin, koska se ei sisällä palveluja ja teollisuutta.`, en: `If a network's use is not reported but residents in district-heated buildings are, use is estimated as residents × ${KWH_PER_RESIDENT_MWH} MWh (estimated: true). This is probably low because it leaves out services and industry.` },
    { fi: 'Loviisan Lämpö Oy ilmoittaa yhden yhteisluvun Loviisalle, Pornaiselle, Pukkilalle ja Pyhtäälle. Luku on Loviisan kohdalla; muilla kolmella on verkko, mutta kulutus on tuntematon.', en: 'Loviisan Lämpö Oy reports one combined figure for Loviisa, Pornainen, Pukkila and Pyhtää. The figure is shown for Loviisa; the other three have a network but unknown demand.' },
    { fi: 'has: false tarkoittaa, että kunnassa ei ole Energiateollisuuden tilastoon ilmoitettua kaukolämpöverkkoa. Pieniä paikallisia lämpöverkkoja voi silti olla.', en: 'has: false means no district-heating network in the municipality reports to the Energiateollisuus statistics. Small local heating networks may still exist.' },
    { fi: `Paikalliset korjaukset (tarkistettu 24.10.2026): näillä kunnilla on kaukolämpö- tai aluelämpöverkko, vaikka ne puuttuvat Energiateollisuuden tilastosta. Kulutusta ei tiedetä. ${Object.entries(LOCAL_DH).map(([c, v]) => `${by(c)?.name.fi}: ${v.seller}, ${v.url}`).join('; ')}.`, en: `Local corrections (checked 24 Oct 2026): these municipalities have a district or local heating network although they are missing from the Energiateollisuus statistics. Demand is unknown. ${Object.entries(LOCAL_DH).map(([c, v]) => `${by(c)?.name.fi}: ${v.seller}, ${v.url}`).join('; ')}.` },
    { fi: 'residentsSharePct = kaukolämmitetyissä taloissa asuvien osuus väestöstä 31.12.2025 (Energiateollisuus, taulukko 8). null, jos jonkin verkon asukasmäärää ei ole ilmoitettu.', en: 'residentsSharePct = share of residents living in district-heated buildings on 31.12.2025 (Energiateollisuus, table 8). null if any network did not report residents.' },
    { fi: `Kiinteistöveroprosentti on vuoden 2026 yleinen (rakennukset). Kiinteistövero yhteensä (revenueEur) on viimeisimmän vuoden luku (${kiveYearLabel[kiveYears.at(-1)]}), kaikki kiinteistöverolajit.`, en: `Property-tax rate is the 2026 general rate for buildings. Total property tax (revenueEur) is from the latest year (${kiveYears.at(-1)}${/ennakko/.test(kiveYearLabel[kiveYears.at(-1)]) ? ', preliminary' : ''}), all property-tax types.` },
    { fi: 'Kartta: kuntarajat 1:1 000 000 yleistettynä edelleen (Visvalingam), rajat jaettu naapurien kesken, joten aukkoja ei synny. Pienimmät saaret on jätetty pois. centroid = kunnan suurimman alueen sisällä oleva piste (saavuttamattomuuden napa), ei painopiste.', en: 'Map: 1:1,000,000 municipal boundaries further simplified (Visvalingam), with shared borders simplified once so no gaps appear. The smallest islets are left out. centroid = a point inside the largest part of the municipality (pole of inaccessibility), not the centre of mass.' },
    { fi: 'Ruotsinkielinen nimi on Tilastokeskuksen aineistosta. Englanninkielinen nimi = suomenkielinen nimi, koska kunnilla ei ole englanninkielisiä nimiä.', en: 'Swedish names are from Statistics Finland. English name = Finnish name, as municipalities have no English exonyms.' },
  ],
};

const townLines = towns.map((t) => {
  const { _unemployedDerived, ...rest } = t;
  return '  ' + JSON.stringify(rest) + ',';
});
const townsJs = `// GENERATED by scripts/data/build.mjs on ${GENERATED} — do not edit by hand; re-run the script.
// All 308 municipalities (kuntajako 2026). Sources and derivations: TOWNS_META.sources / TOWNS_META.notes.
// null = not available. propertyTax.revenueYear and districtHeat.* are documented in TOWNS_META.notes.
export const TOWNS_META = ${JSON.stringify(META, null, 2)};

export const TOWNS = [
${townLines.join('\n')}
];

const BY_CODE = new Map(TOWNS.map((t) => [t.code, t]));
export const townByCode = (code) => BY_CODE.get(code == null ? '' : String(code).padStart(3, '0')) || null;
`;
writeFileSync(join(APP, 'src', 'data', 'towns.js'), townsJs);

const mapJs = `// GENERATED by scripts/data/build.mjs on ${GENERATED} — do not edit by hand; re-run the script.
// Municipal boundaries 2026 (Tilastokeskus kunta1000k_2026, CC BY 4.0), projected from ETRS-TM35FIN (EPSG:3067):
// x = (E - ${minX}) * ${SCALE.toPrecision(8)} + ${PAD}, y = (${maxY} - N) * ${SCALE.toPrecision(8)} + ${PAD} (north up).
// Shared borders simplified once (topology-preserving Visvalingam), islets < ${MIN_ISLAND_M2 / 1e6} km² dropped.
export const MAP = {
  viewBox: '0 0 ${WIDTH} ${HEIGHT}',
  projection: { crs: 'EPSG:3067', minE: ${minX}, maxN: ${maxY}, scale: ${SCALE.toPrecision(8)}, pad: ${PAD} },
  outline: '${map.outline}',
  paths: {
${Object.keys(map.paths).sort().map((c) => `    '${c}': '${map.paths[c]}',`).join('\n')}
  },
};
`;
writeFileSync(join(APP, 'src', 'data', 'mapPaths.js'), mapJs);
console.log('wrote towns.js', townsJs.length, 'bytes; mapPaths.js', mapJs.length, 'bytes; viewBox', `0 0 ${WIDTH} ${HEIGHT}`);
