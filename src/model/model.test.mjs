// Sanity tests for the impact model. Run: node src/model/model.test.mjs
import assert from 'node:assert/strict';
import { COEF, UNCERTAIN_KEYS } from './coefficients.js';
import {
  simulate, finlandScenario, FINLAND_REFERENCES, DESIGN_OPTIONS, METRIC_KEYS, THEME_KEYS, GUESS_TARGETS,
  resolveGuessTarget, DEFAULT_TOWN, districtHeatStatus, noiseGuidelines, noiseAtDistance,
} from './model.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exitCode = 1; }
}

const TAMPERE = {
  code: '837', name: { fi: 'Tampere', sv: 'Tammerfors', en: 'Tampere' }, population: 263337, households: 140000, employed: 120000,
  unemployed: 18000, unemploymentPct: 13, jobs: 150000, propertyTax: { generalRatePct: 1.25, revenueEur: 38900000 },
  districtHeat: { has: true, demandGWh: 2000, residentsSharePct: 80, seller: 'Tampereen Energia', estimated: true }, centroid: [0, 0],
};
const HAMINA = {
  code: '075', name: { fi: 'Hamina', sv: 'Fredrikshamn', en: 'Hamina' }, population: 19000, households: 9800, employed: 7500,
  unemployed: 1200, unemploymentPct: 13.8, jobs: 8000, propertyTax: { generalRatePct: 1.25, revenueEur: 5000000 },
  districtHeat: { has: true, demandGWh: 110, residentsSharePct: 50, seller: 'Haminan Energia', estimated: true }, centroid: [0, 0],
};
const NO_DH = {
  code: '999', name: { fi: 'Pikkukylä', sv: 'Pikkukylä', en: 'Pikkukylä' }, population: 1200, households: 600, employed: 450,
  unemployed: null, unemploymentPct: 9, jobs: 300, propertyTax: { generalRatePct: null, revenueEur: null },
  districtHeat: { has: false, demandGWh: null, residentsSharePct: null, seller: null, estimated: false }, centroid: [0, 0],
};
// A verified small local network added by the content package (towns.js shape, SPEC interfaces §7).
const LOCAL_DH = {
  ...NO_DH, code: '998', name: { fi: 'Pikkulämpö', sv: 'Pikkulämpö', en: 'Pikkulämpö' },
  districtHeat: { has: true, demandGWh: null, residentsSharePct: null, seller: 'Paikallinen Lämpö Oy', estimated: true, local: true },
};
const MUHOS = {
  code: '494', name: { fi: 'Muhos', sv: 'Muhos', en: 'Muhos' }, population: 8767, households: 3692, employed: 3400,
  unemployed: 411, unemploymentPct: 10.8, jobs: 2800, propertyTax: { generalRatePct: 1.25, revenueEur: 4678623 },
  districtHeat: { has: true, demandGWh: 27.2, residentsSharePct: null, seller: 'Oulun Seudun Sähkö', estimated: false }, centroid: [0, 0],
};
const TOWNS = [TAMPERE, HAMINA, NO_DH, null];
const ALL_METRICS = Object.values(METRIC_KEYS).flat();
const base = { sizeMW: 50, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 800 };
const LV = ['low', 'typ', 'high'];

function walkNumbers(obj, path, fn) {
  if (obj === null) return;
  if (typeof obj === 'number') { fn(obj, path); return; }
  if (obj === undefined) { fn(obj, path); return; }
  if (Array.isArray(obj)) { obj.forEach((v, i) => walkNumbers(v, `${path}[${i}]`, fn)); return; }
  if (typeof obj === 'object') for (const [k, v] of Object.entries(obj)) walkNumbers(v, `${path}.${k}`, fn);
}
function walkStrings(obj, fn) {
  if (typeof obj === 'string') { fn(obj); return; }
  if (obj && typeof obj === 'object') for (const v of Object.values(obj)) walkStrings(v, fn);
}
const comp = (m, key) => m.comparisons.find((c) => c.key === key);

test('COEF entries are complete and ordered', () => {
  for (const [k, c] of Object.entries(COEF)) {
    assert.ok(Number.isFinite(c.low) && Number.isFinite(c.typ) && Number.isFinite(c.high), k);
    assert.ok(c.low <= c.typ && c.typ <= c.high, `${k} low<=typ<=high`);
    for (const f of ['unit', 'title', 'explain']) assert.ok(c[f] && typeof c[f].fi === 'string' && typeof c[f].en === 'string', `${k}.${f}`);
    assert.ok(c.title.fi && c.explain.fi && c.title.en && c.explain.en, `${k} text`);
    assert.ok(['strong', 'medium', 'weak'].includes(c.confidence), `${k}.confidence`);
    assert.ok(Array.isArray(c.sources), `${k}.sources`);
    for (const s of c.sources) {
      assert.ok(s && s.name && s.url && /^https:\/\//.test(s.url), `${k} source url`);
      assert.match(s.date, /^\d{4}-\d{2}(-\d{2})?$/, `${k} source date`);
      assert.ok(['authority', 'company', 'research', 'news', 'ngo', 'industry', 'politics', 'statistics', 'resident'].includes(s.type), `${k} source type ${s.type}`);
    }
  }
  assert.ok(UNCERTAIN_KEYS.length > 10);
  for (const k of ['heat.copLiquid', 'heat.localNetworkShare']) assert.ok(UNCERTAIN_KEYS.includes(k), `${k} is sampled`);
});

test('no NaN/undefined in any SimResult; percentiles ordered; shape', () => {
  for (const sz of DESIGN_OPTIONS.sizes) for (const cooling of DESIGN_OPTIONS.cooling) for (const site of DESIGN_OPTIONS.site)
    for (const heatReuse of [true, false]) for (const distanceM of [200, 800, 3000]) for (const town of [...TOWNS, LOCAL_DH]) {
      const design = { sizeMW: sz.mw, cooling, heatReuse, site, distanceM };
      const r = simulate(design, town, { samples: 60 });
      const where = `${JSON.stringify(design)} @ ${town ? town.name.fi : 'null'}`;
      walkNumbers(r, 'r', (v, p) => assert.ok(Number.isFinite(v), `${where}: ${p} = ${v}`));
      assert.equal(r.years.length, 31);
      assert.deepEqual(Object.keys(r.metrics).sort(), [...ALL_METRICS].sort(), where);
      for (const k of ALL_METRICS) {
        const m = r.metrics[k];
        assert.equal(m.key, k);
        assert.ok(THEME_KEYS.includes(m.theme));
        assert.equal(m.kind, 'calculated');
        for (const lvl of LV) assert.equal(m.series[lvl].length, 31, `${k} series ${lvl}`);
        for (let y = 0; y < 31; y++) {
          assert.ok(m.series.low[y] <= m.series.typ[y] + 1e-9 && m.series.typ[y] <= m.series.high[y] + 1e-9, `${where} ${k} y${y}`);
        }
        assert.ok(m.headline.low <= m.headline.typ + 1e-9 && m.headline.typ <= m.headline.high + 1e-9, `${where} ${k} headline`);
        assert.ok(m.headline.when.fi && m.headline.when.en);
        assert.ok(m.formula.fi && m.formula.en, `${k} formula`);
        assert.ok(m.inputs.length && m.inputs.every((key) => COEF[key]), `${k} inputs exist in COEF`);
        assert.ok(m.drivers.length && m.drivers.every((key) => COEF[key]), `${k} drivers exist in COEF`);
        assert.ok(!('declared' in m), `${k} has no declared values unless given`);
        for (const c of m.comparisons) {
          assert.ok(c.key && c.text.fi && c.text.en);
          assert.ok(c.low <= c.typ + 1e-9 && c.typ <= c.high + 1e-9, `${k}.${c.key}`);
          assert.ok(!(c.low === 0 && c.typ === 0 && c.high === 0), `${where} ${k}.${c.key} all-zero comparison`);
          if (c.format) assert.ok(['num', 'int', 'eur'].includes(c.format), `${k}.${c.key} format`);
        }
        if (m.townContext) assert.ok(m.townContext.fi && m.townContext.en);
        if (m.notes) assert.ok(m.notes.fi && m.notes.en);
        // no unformatted template leftovers other than the placeholders
        for (const c of m.comparisons) assert.ok(!/undefined|NaN|null/.test(c.text.fi + c.text.en), `${k}.${c.key} text`);
        if (m.townContext) assert.ok(!/undefined|NaN|null/.test(m.townContext.fi + m.townContext.en), `${k} townContext`);
      }
      assert.ok(r.phases.length === 3 && r.phases.every((p) => p.start <= p.end));
      for (const e of r.events) assert.ok(e.year >= 0 && e.year <= 30 && e.title.fi && e.text.en, `event ${e.key}`);
      assert.ok(r.assumptions.every((k) => COEF[k]));
      for (const k of ['electricity', 'heatUsed', 'heatPumpElectricity', 'propertyTax', 'co2Electricity', 'co2HeatAvoided']) {
        for (const lvl of LV) assert.equal(r.cumulative[k][lvl].length, 31, `cumulative ${k}`);
      }
    }
});

test('electricity is monotonic in size (headline and full-capacity years)', () => {
  let prev = null;
  for (const mw of [5, 10, 25, 50, 100, 150, 300, 500, 1000]) {
    const r = simulate({ ...base, sizeMW: mw }, TAMPERE);
    const h = r.metrics.electricity.headline;
    if (prev) for (const l of LV) assert.ok(h[l] > prev[l], `${mw} MW ${l}`);
    prev = h;
  }
  // order of magnitude check: 50 MW × 0.7 × 1.15 × 8.76 ≈ 350 GWh
  const t = simulate(base, TAMPERE).metrics.electricity.headline.typ;
  assert.ok(t > 250 && t < 450, `50 MW typ electricity ${t}`);
});

test('water use calibrated to Finnish data', () => {
  const air = simulate({ ...base, cooling: 'air' }, HAMINA).metrics.water.headline;
  assert.ok(air.typ >= 1500 && air.typ <= 5000, `50 MW air ${air.typ} m³`);
  const air100 = simulate({ ...base, sizeMW: 100, cooling: 'air' }, HAMINA).metrics.water.headline;
  assert.ok(air100.typ >= 3000 && air100.typ <= 9000, `100 MW air ${air100.typ} m³`);
  const evap = simulate({ ...base, cooling: 'evaporative' }, HAMINA).metrics.water.headline;
  assert.ok(evap.typ >= 10000 && evap.typ <= 60000, `50 MW evaporative ${evap.typ} m³`);
  assert.ok(evap.low > air.high, `ranges do not overlap: evap low ${evap.low} vs air high ${air.high}`);
  assert.ok(evap.typ > 5 * air.typ, `evap ${evap.typ} vs air ${air.typ}`);
  const r = simulate({ ...base, cooling: 'air' }, HAMINA).metrics.water;
  assert.ok(/Järvenpää/.test(r.notes.fi) && /henkilökunnalle/.test(r.notes.fi), 'air: water mainly for staff (Järvenpää EIA)');
  const e = simulate({ ...base, cooling: 'evaporative' }, HAMINA).metrics.water;
  assert.ok(/vesihuollon kapasiteetti/.test(e.notes.fi) && /water supply must be checked/.test(e.notes.en), 'evaporative: check the water supply');
});

test('wide ranges are sampled in log space: the median sits near the typical value', () => {
  const r = simulate({ ...base, sizeMW: 100 }, TAMPERE);
  const ratio = r.metrics.jobsPermanent.headline.typ / (100 * COEF['jobs.permanentPerMW'].typ);
  assert.ok(ratio >= 0.9 && ratio <= 1.15, `jobs median / typical ${ratio}`);
  const land = r.metrics.land.headline.typ / (100 * COEF['land.perMW'].typ);
  assert.ok(land >= 0.9 && land <= 1.15, `land median / typical ${land}`);
});

test('heat used is capped by town demand × max coverage; 0 without reuse', () => {
  for (const mw of [10, 50, 150, 500]) {
    const r = simulate({ ...base, sizeMW: mw }, HAMINA);
    const capMax = HAMINA.districtHeat.demandGWh * COEF['heat.maxCoverage'].high;
    for (const lvl of LV) {
      assert.ok(r.metrics.heatUsed.headline[lvl] <= capMax + 1e-9, `${mw} MW headline ${lvl}`);
      for (const v of r.metrics.heatUsed.series[lvl]) assert.ok(v <= capMax + 1e-9);
    }
    // delivered heat = captured heat + heat-pump electricity, at most captured × COP/(COP−1) ≤ 1.5 × captured
    assert.ok(r.metrics.heatUsed.headline.typ <= 1.5 * r.metrics.heatAvailable.headline.typ + 1e-9);
  }
  // pinned coverage: never above demand × pinned value
  const pinned = simulate({ ...base, sizeMW: 500 }, HAMINA, { overrides: { 'heat.maxCoverage': 'low' } });
  assert.ok(Math.abs(pinned.metrics.heatUsed.headline.typ - 110 * 0.6) < 1e-6, 'big site saturates Hamina at 60 %');
  // big city is not saturated
  const tre = simulate({ ...base, sizeMW: 50 }, TAMPERE);
  assert.ok(tre.metrics.heatUsed.headline.typ < 2000 * 0.6);
  assert.ok(tre.metrics.heatUsed.headline.typ > 0);
  const off = simulate({ ...base, heatReuse: false }, TAMPERE);
  assert.equal(off.metrics.heatUsed.headline.high, 0);
  assert.ok(off.metrics.heatUsed.series.high.every((v) => v === 0));
  assert.equal(off.meta.heatReuseOn, false);
  assert.ok(off.events.some((e) => e.key === 'heatWasted'), 'heat released into the air is an event when reuse is off');
});

test('heat split: captured heat, heat-pump electricity, delivered heat', () => {
  const r = simulate(base, TAMPERE);
  const { heatAvailable, heatPumpElectricity, heatUsed, electricity } = r.metrics;
  assert.ok(heatAvailable.headline.typ < electricity.headline.typ, `captured ${heatAvailable.headline.typ} < electricity ${electricity.headline.typ}`);
  const share = heatPumpElectricity.headline.typ / heatUsed.headline.typ;
  assert.ok(share >= 0.15 && share <= 0.35, `heat-pump share of delivered heat ${share}`);
  assert.equal(heatPumpElectricity.confidence, 'weak');
  assert.deepEqual(heatPumpElectricity.unit, { fi: 'GWh/v', en: 'GWh/yr' });
  for (const k of ['avgMW', 'pctOfDc']) assert.ok(comp(heatPumpElectricity, k), `heatPumpElectricity.${k}`);
  assert.ok(Math.abs(comp(heatPumpElectricity, 'avgMW').typ - heatPumpElectricity.headline.typ / 8.76) / comp(heatPumpElectricity, 'avgMW').typ < 0.05);
  for (const k of ['heat.capture', 'heat.usableShare', 'heat.maxCoverage', 'heat.cop']) assert.ok(heatPumpElectricity.inputs.includes(k), `input ${k}`);
  assert.equal(heatAvailable.title.fi, 'Palvelimista talteen saatava lämpö');
  assert.equal(heatUsed.title.en, 'Heat delivered to district heating');
  assert.ok(/lämpöpumppujen avulla/.test(comp(heatAvailable, 'homes').text.fi));
  // yearly series = delivered heat / COP, so it follows the delivered heat
  for (let y = 0; y < 31; y++) assert.equal(heatPumpElectricity.series.typ[y] === 0, heatUsed.series.typ[y] === 0, `year ${y}`);
  const off = simulate({ ...base, heatReuse: false }, TAMPERE).metrics.heatPumpElectricity;
  for (const lvl of LV) assert.ok(off.series[lvl].every((v) => v === 0), `reuse off → 0 (${lvl})`);
  assert.equal(off.comparisons.length, 0, 'all-zero comparisons are left out');
  const f = finlandScenario(2.5);
  const fShare = f.heatPumpTWh.typ / f.heatTWh.typ;
  assert.ok(fShare >= 0.15 && fShare <= 0.35, `Finland heat-pump share ${fShare}`);
  assert.equal(f.order.length, 8);
  assert.deepEqual(f.order.slice(4, 6), ['heatTWh', 'heatPumpTWh']);
});

test('towns outside Finnish Energy statistics: estimated local network, never "no network" as fact', () => {
  assert.equal(districtHeatStatus(NO_DH), 'notInStats');
  assert.equal(districtHeatStatus(TAMPERE), 'statsEstimate');
  assert.equal(districtHeatStatus(MUHOS), 'stats');
  assert.equal(districtHeatStatus(null), 'default');
  assert.equal(districtHeatStatus(LOCAL_DH), 'local');
  const on = simulate(base, NO_DH);
  assert.equal(on.meta.town.dhStatus, 'notInStats');
  assert.equal(on.meta.town.hasDistrictHeat, false);
  assert.equal(on.meta.heatReuseOn, true);
  assert.ok(on.meta.town.demandGWh > 0 && on.meta.town.dhEstimated, 'estimated demand in meta');
  const hu = on.metrics.heatUsed;
  assert.ok(hu.headline.typ > 0, 'heat can still be used');
  assert.equal(hu.confidence, 'weak');
  assert.match(hu.townContext.fi, /tilastossa/);
  assert.match(hu.townContext.fi, /^Pikkukylä: /);
  assert.ok(hu.inputs.includes('heat.localNetworkShare') && hu.drivers.includes('heat.localNetworkShare'));
  for (const k of ['heatUsed', 'heatAvailable']) assert.ok(!comp(on.metrics[k], 'pctTownDH'), `${k}.pctTownDH omitted`);
  // capped by the estimated demand: residents × share (≤ 0.5) × 5.9 MWh / 0.54 × coverage (≤ 0.8)
  const capMax = (1200 * 0.5 * 5.9) / 0.54 / 1000 * 0.8;
  for (const lvl of LV) assert.ok(hu.headline[lvl] <= capMax + 1e-9, `capped ${lvl}`);
  assert.ok(on.events.some((e) => e.key === 'heatFirst'));
  const off = simulate({ ...base, heatReuse: false }, NO_DH);
  for (const k of ['heatUsed', 'heatPumpElectricity', 'co2HeatAvoided']) {
    for (const lvl of LV) {
      assert.equal(off.metrics[k].headline[lvl], 0, `${k} headline ${lvl}`);
      assert.ok(off.metrics[k].series[lvl].every((v) => v === 0), `${k} series ${lvl}`);
    }
  }
  const wasted = off.events.find((e) => e.key === 'heatWasted');
  assert.ok(wasted && /Energiateollisuuden tilastossa/.test(wasted.text.fi), 'heatWasted names the statistics');
  assert.ok(!on.events.some((e) => e.key === 'heatWasted'), 'no heatWasted event while reuse is on');
  for (const r of [on, off]) {
    const json = JSON.stringify(r);
    assert.ok(!json.includes('ei ole kaukolämpöverkkoa'), 'no "ei ole kaukolämpöverkkoa"');
    assert.ok(!json.includes('has no district-heating network'), 'no "has no district-heating network"');
    assert.ok(!/ei ole kaukolämpö|no district-heating network, so/.test(json));
  }
  assert.ok(on.metrics.heatAvailable.headline.typ > 0, 'potential still shown');
  // a verified local network without a demand figure is estimated the same way
  const loc = simulate(base, LOCAL_DH);
  assert.equal(loc.meta.town.dhStatus, 'local');
  assert.ok(Number.isFinite(loc.metrics.heatUsed.headline.typ) && loc.metrics.heatUsed.headline.typ > 0);
  assert.equal(loc.metrics.heatUsed.confidence, 'weak');
  assert.ok(/Paikallinen Lämpö Oy/.test(loc.metrics.heatUsed.townContext.fi));
  // guess question: the potential unless the network is known
  assert.equal(resolveGuessTarget(GUESS_TARGETS[2], NO_DH, base).metric, 'heatAvailable');
  for (const t of [TAMPERE, MUHOS, LOCAL_DH, null]) assert.equal(resolveGuessTarget(GUESS_TARGETS[2], t, base).metric, 'heatUsed');
  assert.equal(resolveGuessTarget(GUESS_TARGETS[2], TAMPERE, { ...base, heatReuse: false }).metric, 'heatAvailable');
});

test('declared values, drivers and cumulative totals', () => {
  const declared = {
    water: { low: 4000, typ: 4500, high: 5000, factId: 'jarvenpaa-water', note: { fi: 'YVA-arvio', en: 'EIA estimate' } },
    jobsPermanent: { typ: 40, factId: 'jarvenpaa-jobs', comparisons: { pctUnemployed: { typ: 1, upTo: true, factId: 'jarvenpaa-jobs' } } },
  };
  const before = JSON.stringify(declared);
  const withDecl = simulate({ ...base, sizeMW: 100 }, TAMPERE, { declared });
  const without = simulate({ ...base, sizeMW: 100 }, TAMPERE);
  assert.equal(JSON.stringify(declared), before, 'declared input not mutated');
  assert.deepEqual(withDecl.metrics.water.declared, declared.water);
  assert.notEqual(withDecl.metrics.water.declared, declared.water, 'a copy, not the same object');
  assert.deepEqual(withDecl.metrics.jobsPermanent.declared, declared.jobsPermanent);
  assert.equal(withDecl.metrics.electricity.declared, undefined);
  for (const k of ALL_METRICS) {
    const { declared: _d, ...a } = withDecl.metrics[k];
    assert.deepEqual(a, without.metrics[k], `${k}: declared values never change the calculation`);
  }
  const expected = {
    electricity: ['utilisation', 'pue.air'], gridPeak: ['gridPeakRatio'], heatAvailable: ['utilisation', 'heat.capture'],
    heatPumpElectricity: ['heat.cop', 'heat.usableShare', 'heat.maxCoverage'],
    heatUsed: ['heat.capture', 'heat.cop', 'heat.usableShare', 'heat.maxCoverage'], water: ['wue.air'], noise: ['noise.opRef'],
    co2Electricity: ['grid.co2'], co2HeatAvoided: ['heat.co2Replaced'], co2Construction: ['construction.co2PerMW'],
    jobsConstruction: ['jobs.constructionPerMW'], jobsPermanent: ['jobs.permanentPerMW'], jobsIndirect: ['jobs.indirectMultiplier'],
    propertyTax: ['tax.propertyPerMW'], electricityTax: ['tax.electricity'], investment: ['investment.perMW'],
    trucks: ['traffic.constructionTrucksPer100MW'], land: ['land.perMW'], backupPower: ['backup.fuelPerMW'], eWaste: ['ewaste.perMW'],
  };
  for (const k of ALL_METRICS) {
    assert.deepEqual(without.metrics[k].drivers, expected[k], `${k} drivers`);
    assert.ok(without.metrics[k].drivers.every((d) => COEF[d]), `${k} drivers exist in COEF`);
  }
  const liquid = simulate({ ...base, cooling: 'liquid' }, TAMPERE);
  assert.deepEqual(liquid.metrics.electricity.drivers, ['utilisation', 'pue.liquid']);
  assert.ok(liquid.metrics.heatUsed.drivers.includes('heat.copLiquid'));
  const cum = without.cumulative.electricity.typ;
  assert.equal(cum.length, 31);
  for (let y = 1; y < 31; y++) assert.ok(cum[y] >= cum[y - 1] - 1e-9, `non-decreasing at ${y}`);
  const sum = without.metrics.electricity.series.typ.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(cum[30] - sum) / sum < 0.1, `cumulative ${cum[30]} vs sum ${sum}`);
  for (const k of ['heatUsed', 'heatPumpElectricity', 'propertyTax', 'co2Electricity', 'co2HeatAvoided']) {
    const c = without.cumulative[k];
    for (let y = 0; y < 31; y++) assert.ok(c.low[y] <= c.typ[y] + 1e-9 && c.typ[y] <= c.high[y] + 1e-9, `${k} y${y}`);
    const s = without.metrics[k].series.typ.reduce((a, b) => a + b, 0);
    if (k !== 'co2HeatAvoided') assert.ok(Math.abs(c.typ[30] - s) / Math.max(Math.abs(s), 1e-9) < 0.1, `${k} cumulative ${c.typ[30]} vs ${s}`);
  }
});

test('any size, halls built in turn, realistic planning', () => {
  assert.deepEqual(DESIGN_OPTIONS.sizeRange, { min: 5, max: 1000 });
  assert.deepEqual(DESIGN_OPTIONS.sizes.map((s) => s.mw), [10, 50, 150, 500]);
  for (const mw of [22.5, 265, 310, 1000]) {
    const r = simulate({ ...base, sizeMW: mw }, TAMPERE, { samples: 100 });
    walkNumbers(r, `r${mw}`, (v, p) => assert.ok(Number.isFinite(v), `${mw} MW: ${p} = ${v}`));
    assert.equal(r.meta.design.sizeMW, mw, 'exact size kept');
  }
  assert.equal(simulate({ ...base, sizeMW: 5000 }, TAMPERE, { samples: 50 }).meta.design.sizeMW, 1000, 'clamped to 1000');
  assert.equal(simulate({ ...base, sizeMW: 0.5 }, TAMPERE, { samples: 50 }).meta.design.sizeMW, 2, 'clamped to 2');
  const r265 = simulate({ ...base, sizeMW: 265 }, TAMPERE);
  assert.equal(r265.meta.halls, 2);
  assert.equal(r265.meta.hallOnline.length, 2);
  assert.equal(r265.meta.hallBuild.length, 2);
  for (let k = 1; k < r265.meta.hallOnline.length; k++) assert.ok(r265.meta.hallOnline[k] > r265.meta.hallOnline[k - 1]);
  assert.equal(r265.meta.expansions.length, 1);
  assert.equal(simulate({ ...base, sizeMW: 500 }, TAMPERE).meta.halls, 3);
  assert.equal(simulate({ ...base, sizeMW: 100 }, TAMPERE).meta.halls, 1);
  const r100 = simulate({ ...base, sizeMW: 100 }, TAMPERE);
  assert.equal(r100.meta.needsEIA, true, '100 MW × 3.1 = 310 MW of fuel power → EIA');
  assert.ok(r100.events.some((e) => e.key === 'eia' && /vähintään 300 MW/.test(e.text.fi)));
  assert.equal(r100.phases[0].end, 3, 'EIA → 3 years of planning');
  const r10 = simulate({ ...base, sizeMW: 10 }, TAMPERE);
  assert.ok(!r10.events.some((e) => e.key === 'eia'), 'no EIA for 10 MW');
  assert.equal(r10.phases[0].end, 1);
  assert.ok(r10.events.some((e) => e.key === 'permit' && /VNA 1065\/2017/.test(e.text.fi)), '1–50 MW: registration');
  assert.equal(simulate({ ...base, sizeMW: 50 }, TAMPERE).phases[0].end, 2, '30 MW or more → 2 years');
});

test('timeline: giant sites phase in, events present, construction metrics only during construction', () => {
  const g = simulate({ ...base, sizeMW: 500 }, TAMPERE);
  const keys = g.events.map((e) => e.key);
  for (const k of ['zoning', 'eia', 'constructionStart', 'constructionPeak', 'opening', 'expansion', 'heatFirst', 'refresh', 'endOfLife']) assert.ok(keys.includes(k), `event ${k}`);
  const el = g.metrics.electricity.series.typ;
  const open = Math.ceil(g.meta.openYear);
  assert.ok(el[open] < el[open + 4] * 0.8, 'capacity ramps up over several years');
  const s = simulate({ ...base, sizeMW: 10 }, TAMPERE);
  assert.equal(s.metrics.electricity.series.typ[0], 0, 'no electricity during planning');
  const inv = s.metrics.investment.series.typ.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(inv - s.metrics.investment.headline.typ) / s.metrics.investment.headline.typ < 0.25, 'investment spread sums to about the total');
  assert.equal(s.metrics.jobsConstruction.series.typ[30], 0);
  assert.ok(s.metrics.jobsConstruction.series.typ.some((v) => Math.abs(v - s.metrics.jobsConstruction.headline.typ) / s.metrics.jobsConstruction.headline.typ < 0.05), 'peak year reaches headline');
  const eol = g.events.find((e) => e.key === 'endOfLife');
  assert.match(eol.text.fi, /UPS, jäähdytys, varavoima/);
});

test('noise falls with distance and rises with size; compared with guidelines', () => {
  const near = simulate({ ...base, distanceM: 200 }, TAMPERE).metrics.noise.headline.typ;
  const far = simulate({ ...base, distanceM: 3000 }, TAMPERE).metrics.noise.headline.typ;
  assert.ok(near > far + 15);
  const big = simulate({ ...base, sizeMW: 500, distanceM: 350 }, TAMPERE).metrics.noise.headline.typ;
  const ref = simulate({ ...base, sizeMW: 100, distanceM: 350 }, TAMPERE).metrics.noise.headline.typ;
  assert.ok(Math.abs(ref - 43) < 1.5, `100 MW at 350 m ≈ Järvenpää 43 dB (got ${ref})`);
  assert.ok(big > ref);
  const n = simulate(base, TAMPERE).metrics.noise;
  const comps = n.comparisons.map((c) => c.key);
  assert.ok(comps.includes('guideNight') && comps.includes('construction'));
  assert.ok(/5 dB/.test(n.notes.fi) && /993\/1992/.test(n.notes.fi) && /pistemäinen/.test(n.notes.fi));
});

test('recalibrated jobs, land, operating trucks and backup power', () => {
  const r150 = simulate({ ...base, sizeMW: 150 }, TAMPERE);
  const jp = r150.metrics.jobsPermanent.headline.typ;
  assert.ok(jp >= 50 && jp <= 75, `150 MW permanent jobs ${jp}`);
  const jc = r150.metrics.jobsConstruction.headline.typ;
  assert.ok(jc >= 200 && jc <= 300, `150 MW construction workers ${jc}`);
  const r100 = simulate({ ...base, sizeMW: 100 }, TAMPERE);
  const land = r100.metrics.land.headline.typ;
  assert.ok(land >= 12 && land <= 20, `100 MW land ${land} ha`);
  const op = comp(r100.metrics.trucks, 'operation');
  assert.ok(op.typ <= 3.5, `100 MW operation trucks ${op.typ}`);
  assert.equal(op.format, 'int');
  const gen = comp(simulate(base, TAMPERE).metrics.backupPower, 'generators');
  for (const lvl of LV) assert.ok(Number.isInteger(gen[lvl]), `generators ${lvl} = ${gen[lvl]}`);
  assert.equal(gen.format, 'int');
});

test('liquid cooling differs from air', () => {
  const air = simulate({ ...base, cooling: 'air' }, TAMPERE).metrics;
  const liq = simulate({ ...base, cooling: 'liquid' }, TAMPERE).metrics;
  assert.ok(liq.electricity.headline.typ <= 0.95 * air.electricity.headline.typ, `liquid ${liq.electricity.headline.typ} vs air ${air.electricity.headline.typ}`);
  assert.ok(liq.heatPumpElectricity.headline.typ < air.heatPumpElectricity.headline.typ, 'liquid needs less heat-pump electricity');
  assert.ok(liq.heatPumpElectricity.inputs.includes('heat.copLiquid') && !liq.heatPumpElectricity.inputs.includes('heat.cop'));
  assert.ok(!/not modelled separately|ei ole mallinnettu erikseen/.test(JSON.stringify(liq.heatAvailable)));
  assert.equal(liq.noise.headline.typ, air.noise.headline.typ, 'noise unchanged');
});

test('one MW basis (IT load) and national references', () => {
  const r = simulate(base, TAMPERE);
  for (const k of ['electricity', 'gridPeak', 'heatAvailable', 'water', 'co2Construction', 'jobsConstruction', 'jobsPermanent', 'propertyTax', 'investment', 'land', 'backupPower', 'eWaste']) {
    assert.ok(r.metrics[k].formula.fi.includes('IT-teho (palvelinten teho'), `${k} formula fi`);
    assert.ok(r.metrics[k].formula.en.includes('IT load (server capacity'), `${k} formula en`);
  }
  assert.ok(r.metrics.gridPeak.formula.fi.includes('× 1,2–1,4 (jäähdytys ja muu tekniikka huipulla)'));
  assert.equal(FINLAND_REFERENCES.length, 3);
  for (const ref of FINLAND_REFERENCES) {
    assert.ok(ref.gw > 0 && ref.source.url && ref.title.fi && ref.text.en);
    assert.ok(['averageDraw', 'grid', 'scenario'].includes(ref.basis), `${ref.key} basis`);
    assert.ok(Number.isFinite(ref.gwStated) && ref.gwStated > 0, `${ref.key} gwStated`);
  }
  const byKey = Object.fromEntries(FINLAND_REFERENCES.map((x) => [x.key, x]));
  assert.ok(byKey.fingridSigned.gw >= 2.3 && byKey.fingridSigned.gw <= 2.5, `signed ${byKey.fingridSigned.gw}`);
  assert.ok(byKey.today.gw >= 0.33 && byKey.today.gw <= 0.4, `today ${byKey.today.gw}`);
  assert.equal(byKey.fdca2030.gw, 2.5);
  assert.ok(/IT/.test(finlandScenario(1).notes.fi));
});

test('texts the model writes (Muhos)', () => {
  for (const design of [base, { ...base, sizeMW: 500, cooling: 'evaporative', site: 'forest' }, { ...base, heatReuse: false, sizeMW: 10 }]) {
    const r = simulate(design, MUHOS);
    const json = JSON.stringify(r);
    for (const bad of ['kunnan Muhos', 'Kunnassa Muhos', 'kunnassa Muhos', 'Muhoksen kunnan', '/v vuodessa', 'vuodessa, kun', '/v vuodessa']) assert.ok(!json.includes(bad), `no "${bad}"`);
    walkStrings(r, (s) => {
      const rest = s.replace(/\{(low|typ|high|value|range)\}/g, '');
      assert.ok(!/[{}]/.test(rest), `template leftover in "${s}"`);
    });
    for (const m of Object.values(r.metrics)) {
      for (const c of m.comparisons) assert.ok(!(c.low === 0 && c.typ === 0 && c.high === 0), `${m.key}.${c.key} all zero`);
      if (m.townContext && /Muhos/.test(m.townContext.fi)) assert.match(m.townContext.fi, /^Muhos: /, `${m.key} townContext starts with the name`);
    }
    assert.equal(r.metrics.electricity.headline.when.fi, 'kun datakeskus on täysin käytössä');
    assert.equal(r.metrics.electricity.headline.when.en, 'once fully running');
  }
  const r = simulate(base, MUHOS);
  assert.ok(r.metrics.propertyTax.townContext.fi.includes('1,25 %'), r.metrics.propertyTax.townContext.fi);
  assert.ok(r.metrics.propertyTax.formula.fi.includes('1,37 %'));
  assert.ok(r.metrics.electricityTax.formula.fi.includes('2,24 snt/kWh'));
  assert.ok(/in Muhos/.test(r.metrics.water.townContext.en));
  // Intl groups thousands with a no-break space in Finnish
  assert.match(r.metrics.water.townContext.fi.replace(/ /g, ' '), /^Muhos: noin 8 800 asukasta; he käyttävät vettä noin 530 000 m³ vuodessa\.$/);
  const inv = comp(r.metrics.investment, 'buildings');
  assert.equal(inv.format, 'eur');
  assert.ok(inv.text.fi.includes('{range}') && inv.text.en.includes('{range}'));
  assert.equal(comp(r.metrics.backupPower, 'generators').format, 'int');
  assert.equal(comp(r.metrics.jobsConstruction, 'carsPerDay').format, 'int');
  assert.ok(comp(r.metrics.jobsConstruction, 'carsPerDay').text.fi.includes('{typ}'));
  const off = simulate({ ...base, heatReuse: false }, MUHOS);
  assert.equal(off.metrics.heatUsed.headline.when.fi, 'nyt ei käytössä');
  assert.ok(!comp(off.metrics.heatUsed, 'homes'), 'all-zero comparison left out');
  // a percentage of 200 % or more is given as times
  const tiny = { ...NO_DH, unemployed: 20, propertyTax: { generalRatePct: 1.2, revenueEur: 200000 } };
  const big = simulate({ ...base, sizeMW: 500 }, tiny);
  const pu = comp(big.metrics.jobsPermanent, 'pctUnemployed');
  assert.equal(pu.times, true);
  assert.ok(pu.typ > 2 && /kertaa kunnan työttömien määrä/.test(pu.text.fi) && /times/.test(pu.text.en), JSON.stringify(pu));
  const pr = comp(big.metrics.propertyTax, 'pctTownRevenue');
  assert.equal(pr.times, true);
  const small = comp(simulate(base, TAMPERE).metrics.jobsPermanent, 'pctUnemployed');
  assert.ok(!small.times && small.typ < 200);
  // EIA texts
  const eia = simulate({ ...base, sizeMW: 150 }, MUHOS);
  const ev = eia.events.find((e) => e.key === 'eia');
  assert.ok(/vähintään 300 MW/.test(ev.text.fi) && /6\.10\.2026/.test(ev.text.fi));
  assert.ok(/tapauskohtaisesti/.test(simulate({ ...base, sizeMW: 10 }, MUHOS).metrics.backupPower.townContext.fi));
  assert.ok(/1–50 MW:n polttolaitokset rekisteröidään \(VNA 1065\/2017\)/.test(simulate({ ...base, sizeMW: 10 }, MUHOS).metrics.backupPower.townContext.fi));
  assert.ok(/budjettiriihessä/.test(r.metrics.electricityTax.notes.fi) && /30 milj/.test(COEF['tax.electricity'].note.fi));
  const forest = simulate({ ...base, site: 'forest' }, MUHOS);
  assert.ok(/6\.10\.2026/.test(forest.metrics.land.townContext.fi));
  // the default town keeps the generic wording
  const d = simulate(base, null);
  assert.match(d.metrics.water.townContext.fi, /^Esimerkkikunta: /);
  assert.ok(comp(d.metrics.water, 'pctTown').text.fi.includes('esimerkkikunnan'));
});

test('texts stay correct for small numbers and big towns', () => {
  // A whole-number comparison whose range collapses to "1" must not put the number before a plural/partitive noun
  // ("1 raskasta ajoneuvoa", "1 heavy vehicles"): the noun comes first ("raskaita ajoneuvoja 1 päivässä").
  const TINY = { ...NO_DH, code: '997', name: { fi: 'Pikkusaari', sv: 'Pikkusaari', en: 'Pikkusaari' }, population: 101, households: 60, employed: 40, unemployed: 3 };
  for (const town of [TAMPERE, TINY]) for (const mw of [2, 5, 10]) for (const cooling of DESIGN_OPTIONS.cooling) {
    const r = simulate({ ...base, sizeMW: mw, cooling }, town, { samples: 100 });
    for (const m of Object.values(r.metrics)) for (const c of m.comparisons) {
      if (c.format !== 'int' || Math.round(c.high) > 1) continue;
      assert.ok(!/\{(range|typ|low)\} (raskasta|dieselgeneraattoria|kotia|asukasta|henkilöautoa|työpaikkaa|henkeä|tonnia)(?=[\s.,)]|$)/.test(c.text.fi), `${mw} MW ${m.key}.${c.key} fi "${c.text.fi}"`);
      assert.ok(!/\{(range|typ|low)\} (heavy vehicles|diesel generators|homes|residents|cars|people|jobs|tonnes)\b/.test(c.text.en), `${mw} MW ${m.key}.${c.key} en "${c.text.en}"`);
    }
  }
  const small = simulate({ ...base, sizeMW: 10 }, TAMPERE);
  assert.match(comp(small.metrics.trucks, 'operation').text.fi, /^käytön aikana raskaita ajoneuvoja \{range\} päivässä$/);
  assert.match(comp(small.metrics.backupPower, 'generators').text.fi, /^dieselgeneraattoreita noin \{range\}$/);
  // phased sites name a whole year
  for (const mw of [150, 310, 500, 1000]) {
    const f = simulate({ ...base, sizeMW: mw }, TAMPERE, { samples: 50 }).metrics.electricity.formula;
    assert.ok(!/vuonna \d+,\d/.test(f.fi) && !/year \d+\.\d/.test(f.en), `${mw} MW: ${f.fi}`);
  }
  // big towns: water in millions of m³
  assert.match(simulate(base, TAMPERE).metrics.water.townContext.fi.replace(/ /g, ' '), /^Tampere: noin 260 000 asukasta; he käyttävät vettä noin 16 milj\. m³ vuodessa\.$/);
  assert.match(simulate(base, TAMPERE).metrics.water.townContext.en, /16 million m³ of water a year\.$/);
  // the heat-pump note cites a checked source
  assert.ok(/Fortum 6\.5\.2026/.test(simulate(base, TAMPERE).metrics.heatPumpElectricity.notes.fi));
});

test('overrides pin a coefficient', () => {
  const lo = simulate(base, TAMPERE, { overrides: { utilisation: 'low' } }).metrics.electricity.headline.typ;
  const hi = simulate(base, TAMPERE, { overrides: { utilisation: 'high' } }).metrics.electricity.headline.typ;
  const ty = simulate(base, TAMPERE).metrics.electricity.headline.typ;
  assert.ok(lo < ty && ty < hi);
  const allPinned = {};
  for (const k of UNCERTAIN_KEYS) allPinned[k] = 'typ';
  const r = simulate(base, TAMPERE, { overrides: allPinned });
  const e = r.metrics.electricity.headline;
  assert.ok(Math.abs(e.low - e.high) < 1e-9, 'all pinned → no spread');
  assert.ok(Math.abs(e.typ - 50 * 0.7 * 1.15 * 8.76) < 1e-6);
  const j = r.metrics.jobsPermanent.headline;
  assert.ok(Math.abs(j.low - j.high) < 1e-9 && Math.abs(j.typ - 50 * COEF['jobs.permanentPerMW'].typ) < 1e-9, 'log-sampled key pinned too');
});

test('deterministic and seed-dependent', () => {
  const a = simulate(base, HAMINA, { seed: 7 });
  const b = simulate(base, HAMINA, { seed: 7 });
  assert.deepEqual(a, b);
  const c = simulate(base, HAMINA, { seed: 8 });
  assert.notEqual(a.metrics.electricity.headline.typ, c.metrics.electricity.headline.typ);
  // reused draws give the same result as fresh ones after other designs were run in between
  simulate({ ...base, sizeMW: 500, cooling: 'liquid' }, TAMPERE, { seed: 7, overrides: { utilisation: 'high' } });
  assert.deepEqual(simulate(base, HAMINA, { seed: 7 }), a);
});

test('town comparisons: jobs vs unemployed, property tax vs revenue, null town default', () => {
  const r = simulate(base, HAMINA);
  assert.ok(r.metrics.jobsPermanent.comparisons.some((c) => c.key === 'pctUnemployed'));
  assert.ok(r.metrics.propertyTax.comparisons.some((c) => c.key === 'pctTownRevenue'));
  const d = simulate(base, null);
  assert.ok(d.meta.town.isDefault);
  assert.equal(d.meta.town.dhStatus, 'default');
  assert.ok(d.metrics.heatUsed.headline.typ > 0, 'default town has district heat');
  // tax scales with the town's rate
  const hiRate = simulate(base, { ...HAMINA, propertyTax: { generalRatePct: 2.0, revenueEur: 5e6 } }).metrics.propertyTax.headline.typ;
  assert.ok(hiRate > r.metrics.propertyTax.headline.typ);
  // missing unemployed derived from rate
  const nd = simulate(base, NO_DH);
  assert.ok(nd.metrics.jobsPermanent.comparisons.some((c) => c.key === 'pctUnemployed'));
  // meta carries the town figures the UI needs
  for (const k of ['population', 'households', 'revenue', 'demandGWh', 'dhStatus']) assert.ok(k in r.meta.town, `meta.town.${k}`);
  assert.equal(r.meta.town.revenue, 5000000);
});

test('guess targets', () => {
  assert.deepEqual(GUESS_TARGETS.map((g) => g.key), ['jobs', 'homesElectricity', 'homesHeat']);
  const r = simulate(base, NO_DH);
  for (const g of GUESS_TARGETS) {
    const t = resolveGuessTarget(g, NO_DH, base);
    assert.ok(t.question.fi && t.unit.fi && t.min > 0 && t.max > t.min);
    const m = r.metrics[t.metric];
    assert.ok(m, t.metric);
    if (t.comparison) assert.ok(m.comparisons.some((c) => c.key === t.comparison), `${t.metric}.${t.comparison}`);
  }
  assert.equal(resolveGuessTarget(GUESS_TARGETS[2], NO_DH, base).metric, 'heatAvailable');
  assert.equal(resolveGuessTarget(GUESS_TARGETS[2], TAMPERE, base).metric, 'heatUsed');
});

test('runtime < 30 ms at 400 samples', () => {
  for (let i = 0; i < 8; i++) simulate({ ...base, sizeMW: [10, 500][i % 2] }, TAMPERE); // JIT warm-up (the browser warms up the same way after the first drag)
  const times = [];
  for (const mw of [10, 50, 150, 500]) {
    let best = Infinity; // best of 3: the machine may be busy with other work
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      simulate({ ...base, sizeMW: mw, cooling: 'evaporative' }, HAMINA, { samples: 400 });
      best = Math.min(best, performance.now() - t0);
    }
    times.push(best);
  }
  const worst = Math.max(...times);
  console.log(`simulate @400 samples: ${times.map((t) => t.toFixed(1)).join(' / ')} ms`);
  assert.ok(worst < 30, `worst ${worst.toFixed(1)} ms`);
});

test('finlandScenario sanity', () => {
  const f = finlandScenario(2.5);
  const keys = ['electricityTWh', 'shareOfFinland', 'shareOfForecast2030', 'olkiluoto3', 'heatTWh', 'heatPumpTWh', 'heatShareOfDistrictHeat', 'electricityTaxEur'];
  for (const k of keys) {
    const v = f[k];
    assert.ok(v.low <= v.typ && v.typ <= v.high, k);
    assert.ok(v.title.fi && v.text.en && v.sources.length && ['num', 'pct', 'eur'].includes(v.format), k);
    assert.ok(v.formula.fi && v.inputs.every((i) => COEF[i]), k);
  }
  assert.deepEqual(f.order, keys);
  assert.equal(f.heatPumpTWh.format, 'num');
  assert.deepEqual(f.heatPumpTWh.unit, { fi: 'TWh/v', en: 'TWh/yr' });
  assert.ok(/lämpöpumppujen sähkön/.test(f.heatTWh.text.fi));
  // 2.5 GW × 0.7 × 1.15 × 8.76 ≈ 17.6 TWh ≈ 21 % of 84.5 TWh
  assert.ok(f.electricityTWh.typ > 13 && f.electricityTWh.typ < 22, `TWh ${f.electricityTWh.typ}`);
  assert.ok(Math.abs(f.shareOfFinland.typ - f.electricityTWh.typ / 84.5) < 0.02);
  assert.ok(f.olkiluoto3.typ > 1 && f.olkiluoto3.typ < 2.2);
  assert.ok(f.electricityTaxEur.typ > 2.5e8 && f.electricityTaxEur.typ < 5e8);
  const small = finlandScenario(0.3);
  const bigger = finlandScenario(10);
  assert.ok(small.electricityTWh.typ < f.electricityTWh.typ && f.electricityTWh.typ < bigger.electricityTWh.typ);
  walkNumbers(finlandScenario(0), 'f0', (v, p) => assert.ok(Number.isFinite(v), p));
});

test('default town is documented', () => {
  assert.ok(DEFAULT_TOWN.note.fi && DEFAULT_TOWN.districtHeat.has);
});

// ---- engineer review (25.10.2026): wider, sourced ranges for construction CO₂, heat per home and e-waste
const srcUrls = (k) => COEF[k].sources.map((s) => s.url).join(' ');

test('construction CO₂: wide weak range from three sources with the scope stated; comparison softened', () => {
  const c = COEF['construction.co2PerMW'];
  assert.ok(c.low >= 90 && c.low <= 160, `low ${c.low} ≈ Järvenpää EIA 94–148 t/MW`);
  assert.ok(c.typ >= 300 && c.typ <= 500, `typ ${c.typ}`);
  assert.ok(c.high >= 1000, `high ${c.high} reaches the international estimates (ICEF ≈ 1,100–1,300, Schneider ≈ 1,830 t/MW)`);
  assert.equal(c.confidence, 'weak');
  assert.ok(/icef\.go\.jp/.test(srcUrls('construction.co2PerMW')) && /se\.com/.test(srcUrls('construction.co2PerMW')) && /ymparisto\.fi/.test(srcUrls('construction.co2PerMW')));
  assert.ok(/A1–A3/.test(c.note.fi) && /4 050–8 100/.test(c.note.fi) && /3 510/.test(c.note.fi) && /1 830/.test(c.note.en.replace(/,/g, ' ')), 'note states the Järvenpää scope and the other sources');
  const m = simulate({ ...base, sizeMW: 100 }, TAMPERE).metrics.co2Construction;
  assert.equal(m.confidence, 'weak');
  const perMW = m.headline.typ / 100;
  assert.ok(perMW > 300 && perMW < 500, `median ${perMW.toFixed(0)} t/MW`);
  assert.ok(m.headline.high / m.headline.low > 3, 'the range stays wide');
  const y = comp(m, 'yearsOfElectricity');
  assert.ok(y && /karkeasti/.test(y.text.fi) && /roughly/.test(y.text.en) && /huonosti/.test(y.text.fi), 'years-of-electricity comparison states the uncertainty');
  assert.ok(y.typ > 1 && y.typ < 3 && y.high > 3, `years ${y.low.toFixed(2)}–${y.high.toFixed(2)}`);
});

test('heat per home: derived from 5.9 MWh per resident × household size; detached house 18 MWh', () => {
  const c = COEF['heat.perHome'];
  assert.equal(c.low, 6.5);
  assert.equal(c.high, 18, 'Finnish Energy type detached house 18 MWh/yr');
  const derived = 5.9 * 1.96; // MWh per resident in a district-heated building × residents per household (2020)
  assert.ok(Math.abs(c.typ - derived) / derived < 0.1, `typ ${c.typ} ≈ ${derived.toFixed(1)}`);
  const own = (5.9 * DEFAULT_TOWN.population) / DEFAULT_TOWN.households; // the model's own default town
  assert.ok(Math.abs(c.typ - own) / own < 0.1, `typ ${c.typ} consistent with the default town (${own.toFixed(1)})`);
  assert.ok(/5,9/.test(c.note.fi) && /1,96/.test(c.note.fi) && /18 MWh/.test(c.note.fi) && /600 MWh/.test(c.note.fi));
  assert.ok(c.sources.some((s) => s.type === 'statistics') && /sttinfo/.test(srcUrls('heat.perHome')));
  const m = simulate({ ...base, sizeMW: 100 }, TAMPERE).metrics.heatUsed;
  const homes = comp(m, 'homes');
  const ratio = (m.headline.typ * 1000) / homes.typ;
  assert.ok(ratio > 9 && ratio < 13.5, `homes use about ${ratio.toFixed(1)} MWh each`);
});

test('e-waste per refresh: covers the EIA and hardware mass; AI racks are denser', () => {
  const c = COEF['ewaste.perMW'];
  assert.ok(c.low <= 4, `low ${c.low} covers Järvenpää 400 t / 100–130 MW (3–4 t/MW)`);
  assert.ok(c.typ >= 10 && c.typ <= 20, `typ ${c.typ} ≈ AI hardware 11–13 t/MW`);
  assert.ok(c.high >= 40, `high ${c.high} for heavier general-purpose racks`);
  assert.equal(c.confidence, 'weak');
  assert.ok(c.sources.length >= 4 && /theregister/.test(srcUrls('ewaste.perMW')) && /nvidia/.test(srcUrls('ewaste.perMW')));
  assert.ok(/1,36 t/.test(c.note.fi) && /400 t/.test(c.note.fi) && /tekoälyräk/.test(c.explain.fi) && /AI racks/.test(c.explain.en));
  const m = simulate({ ...base, sizeMW: 100 }, TAMPERE).metrics.eWaste;
  assert.ok(m.headline.typ > 1000 && m.headline.typ < 2000, `100 MW: ${m.headline.typ.toFixed(0)} t per refresh`);
  assert.ok(/11–13/.test(m.notes.fi) && /11–13/.test(m.notes.en));
});

test('noise is compared with the outdoor guideline values, never indoor sounds', () => {
  for (const [k, v] of [['noise.guideDay', 55], ['noise.guideNight', 50], ['noise.guideNightNew', 45], ['noise.guideNatureNight', 40], ['noise.guideNatureDay', 45], ['noise.tonalPenalty', 5]]) {
    assert.equal(COEF[k].typ, v, k);
    assert.ok(!UNCERTAIN_KEYS.includes(k), `${k} is a fixed reference value`);
  }
  const over = simulate({ ...base, sizeMW: 500, distanceM: 200 }, TAMPERE).metrics.noise;
  const g = over.guidelines;
  assert.deepEqual(g.values, { day: 55, night: 50, nightNew: 45, holidayDay: 45, holidayNight: 40 });
  assert.equal(g.tonalPenalty, 5);
  assert.ok(over.headline.low > 50 && g.checks.night.over === 'all' && g.overNight, 'whole range above the night guideline');
  assert.ok(/Koko arvioitu väli/.test(g.text.fi) && /whole estimated range/.test(g.text.en) && /meluntorjuntaa/.test(g.text.fi) && /5 dB/.test(g.text.fi));
  assert.ok(over.inputs.includes('noise.guideNightNew') && over.inputs.includes('noise.tonalPenalty'));
  const mid = simulate({ ...base, sizeMW: 500, distanceM: 600 }, TAMPERE).metrics.noise.guidelines;
  assert.equal(mid.checks.night.over, 'none');
  assert.notEqual(mid.checks.nightNew.over, 'none', 'above the 45 dB value for new areas');
  assert.ok(mid.checks.night.tonalRisk && /kapeakaistaista/.test(mid.text.fi) && /tonal/.test(mid.text.en), 'within 5 dB → tonal correction mentioned');
  const far = simulate({ ...base, sizeMW: 50, distanceM: 1000 }, TAMPERE).metrics.noise.guidelines;
  assert.ok(far.checks.night.over === 'none' && far.checks.holidayNight.over === 'none' && !far.checks.night.tonalRisk && !far.overNight);
  assert.ok(/alle asuinalueen yöohjearvon 50 dB/.test(far.text.fi) && !/kapeakaistaista/.test(far.text.fi));
  for (const t of [g.text, mid.text, far.text]) assert.ok(!/toimisto|jääkaappi|sisällä|office|fridge|indoor|undefined|NaN/i.test(t.fi + t.en), 'no indoor references');
  // three cases with whole-dB rounding as on the card
  assert.equal(noiseGuidelines({ low: 48, typ: 49, high: 51 }).checks.night.over, 'top');
  assert.ok(/yläpää \(51 dB\)/.test(noiseGuidelines({ low: 48, typ: 49, high: 51 }).text.fi));
  assert.equal(noiseGuidelines({ low: 49.6, typ: 50.2, high: 50.4 }).checks.night.over, 'none');
  assert.ok(/tasolla/.test(noiseGuidelines({ low: 49.6, typ: 50.2, high: 50.4 }).text.fi));
  // moving a range to another distance (e.g. a persona's home) uses the model's own rule
  const moved = noiseAtDistance({ low: 40, typ: 42, high: 44 }, 1000, 500);
  assert.ok(Math.abs(moved.typ - (42 + 20 * Math.log10(2))) < 1e-9 && moved.low < moved.typ && moved.typ < moved.high);
  const near = simulate({ ...base, distanceM: 500 }, TAMPERE).metrics.noise.headline;
  const fromFar = noiseAtDistance(simulate({ ...base, distanceM: 1000 }, TAMPERE).metrics.noise.headline, 1000, 500);
  assert.ok(Math.abs(near.typ - fromFar.typ) < 1e-6, 'same as simulating at that distance');
});

console.log(`${passed} tests passed${process.exitCode ? ', some FAILED' : ''}`);
