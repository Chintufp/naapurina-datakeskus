// Contract test for src/data/towns.js and src/data/mapPaths.js:  node scripts/data/towns.test.mjs
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const towns = join(APP, 'src', 'data', 'towns.js');
const mapf = join(APP, 'src', 'data', 'mapPaths.js');
const { TOWNS, TOWNS_META, townByCode } = await import(pathToFileURL(towns).href);
const { MAP } = await import(pathToFileURL(mapf).href);

const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));
assert.equal(TOWNS.length, 308);
assert.equal(new Set(TOWNS.map((t) => t.code)).size, 308);
const sorted = TOWNS.map((t) => t.name.fi).slice().sort((a, b) => a.localeCompare(b, 'fi'));
assert.deepEqual(TOWNS.map((t) => t.name.fi), sorted, 'TOWNS sorted by Finnish name');
assert.ok(TOWNS_META.generated && TOWNS_META.sources.length >= 4 && TOWNS_META.notes.length >= 3);
for (const s of TOWNS_META.sources) assert.ok(s.name && s.type && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^https:\/\//.test(s.url), s.name);

const [, , vw, vh] = MAP.viewBox.split(' ').map(Number);
for (const t of TOWNS) {
  assert.match(t.code, /^\d{3}$/);
  assert.ok(t.name.fi && t.name.sv && t.name.en, t.code);
  for (const k of ['population', 'households', 'employed', 'unemployed', 'unemploymentPct', 'jobs']) assert.ok(isNumOrNull(t[k]), `${t.code}.${k}`);
  assert.ok(isNumOrNull(t.propertyTax.generalRatePct) && isNumOrNull(t.propertyTax.revenueEur));
  const dh = t.districtHeat;
  assert.equal(typeof dh.has, 'boolean');
  assert.equal(typeof dh.estimated, 'boolean');
  assert.ok(isNumOrNull(dh.demandGWh) && isNumOrNull(dh.residentsSharePct));
  if (!dh.has) assert.ok(dh.demandGWh === null && dh.seller === null);
  assert.ok(Array.isArray(t.centroid) && t.centroid[0] > 0 && t.centroid[0] < vw && t.centroid[1] > 0 && t.centroid[1] < vh, t.code);
  assert.ok(typeof MAP.paths[t.code] === 'string' && MAP.paths[t.code].startsWith('M'), 'path for ' + t.code);
}
assert.equal(Object.keys(MAP.paths).length, 308);
assert.ok(MAP.outline.length > 1000);
assert.ok(Math.abs(vw - 800) < 1);
assert.ok(statSync(mapf).size < 350 * 1024, 'mapPaths.js under 350 KB');

const tre = townByCode('837');
assert.ok(Math.abs(tre.population - 263000) < 3000);
assert.equal(townByCode('091').name.fi, 'Helsinki');
assert.equal(townByCode(91).code, '091');
assert.equal(townByCode('999'), null);
assert.ok(townByCode('075').districtHeat.has, 'Hamina has district heat');
assert.ok(TOWNS.filter((t) => !t.districtHeat.has).length > 50, 'many small towns have no network');
console.log('towns.test: all assertions passed');
