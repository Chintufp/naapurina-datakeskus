// Tests for deep-link tokens. Run: node src/ui/router.test.mjs
// router.js must not touch window/location/history at import time, so node can import it.
import assert from 'node:assert/strict';
import { parseToken, projectToken, townToken, scenarioToken, shareUrl, ROUTES } from './router.js';
import * as Projects from '../content/projects.js';
import * as Towns from '../data/towns.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exitCode = 1; }
}
const TOKEN_RE = /^[a-z0-9-]+$/;
const PROJECTS = Projects.PROJECTS || [];
const TOWNS = Towns.TOWNS || [];

test('project token: Järvenpää', () => {
  const r = parseToken('hanke-jarvenpaa-dc');
  assert.ok(r, 'parses');
  assert.equal(r.view, 'simulaattori');
  const p = PROJECTS.find((x) => x.id === 'jarvenpaa-dc');
  assert.equal(r.patch.townCode, '186');
  assert.equal(r.patch.presetId, 'jarvenpaa-dc');
  assert.deepEqual(Object.keys(r.patch.design).sort(), ['cooling', 'distanceM', 'heatReuse', 'site', 'sizeMW']);
  for (const k of ['sizeMW', 'cooling', 'heatReuse', 'site', 'distanceM']) assert.equal(r.patch.design[k], p.preset[k], k);
  assert.deepEqual(r.patch.overrides, {});
  assert.equal(r.patch.year, 0);
  assert.equal(r.patch.playing, false);
  assert.deepEqual(r.patch.simUi, {});
});

test('town token: Muhos', () => {
  const r = parseToken('kunta-494');
  assert.deepEqual(r, { view: 'simulaattori', patch: { townCode: '494', presetId: null } });
  assert.equal(Towns.townByCode('494').name.fi, 'Muhos');
});

test('scenario token', () => {
  const r = parseToken('s-837-150-liquid-h0-forest-500');
  assert.deepEqual(r, {
    view: 'simulaattori',
    patch: { townCode: '837', presetId: null, design: { sizeMW: 150, cooling: 'liquid', heatReuse: false, site: 'forest', distanceM: 500 }, overrides: {} },
  });
  assert.equal(parseToken('s-091-2-air-h1-industrial-50').patch.design.sizeMW, 2);
  assert.equal(parseToken('s-091-1000-evaporative-h1-field-10000').patch.design.distanceM, 10000);
  assert.equal(parseToken('#s-837-150-liquid-h0-forest-500').patch.townCode, '837', 'a leading # is fine');
  assert.equal(parseToken('S-837-150-Liquid-H0-Forest-500').patch.design.cooling, 'liquid', 'case-insensitive');
});

test('invalid tokens return null (the app then goes home)', () => {
  const bad = [
    'xyz', '', '   ', null, undefined, 42, 'hanke-', 'hanke-nope', 'hanke-JARVENPAA DC',
    'kunta-', 'kunta-12', 'kunta-4940', 'kunta-000', 'kunta-abc',
    's-837-1-air-h1-forest-500', 's-837-1001-air-h1-forest-500', 's-837-0-air-h1-forest-500',
    's-837-50-water-h1-forest-500', 's-837-50-air-h2-forest-500', 's-837-50-air-h1-lake-500',
    's-837-50-air-h1-forest-49', 's-837-50-air-h1-forest-10001', 's-000-50-air-h1-forest-500',
    's-837-50-air-h1-forest', 's-837-50.5-air-h1-forest-500', 'kunta-494?x=1', 'hanke-jarvenpaa-dc/x',
  ];
  for (const b of bad) assert.equal(parseToken(b), null, String(b));
  for (const r of ROUTES) assert.equal(parseToken(r), null, `route ${r} is not a deep link`);
});

test('builders produce bare tokens', () => {
  assert.equal(projectToken('jarvenpaa-dc'), 'hanke-jarvenpaa-dc');
  assert.equal(townToken('494'), 'kunta-494');
  assert.equal(townToken('91'), 'kunta-091');
  assert.equal(scenarioToken({ townCode: '837', design: { sizeMW: 150, cooling: 'liquid', heatReuse: false, site: 'forest', distanceM: 500 } }), 's-837-150-liquid-h0-forest-500');
  // fractional or out-of-range sizes are rounded and clamped so the token always parses
  assert.equal(scenarioToken({ townCode: '837', design: { sizeMW: 104.4, cooling: 'air', heatReuse: true, site: 'field', distanceM: 37 } }), 's-837-104-air-h1-field-50');
  assert.equal(scenarioToken({ townCode: '837', design: { sizeMW: 5000, distanceM: 99999 } }), 's-837-1000-air-h1-industrial-10000');
});

test('round trips: every project, every town, sample scenarios', () => {
  let projects = 0;
  for (const p of PROJECTS) {
    const tok = projectToken(p.id);
    assert.match(tok, TOKEN_RE, p.id);
    const r = parseToken(tok);
    if (!Towns.townByCode(p.townCode)) { assert.equal(r, null, `${p.id} has no valid town`); continue; }
    assert.ok(r, `project ${p.id} parses`);
    assert.equal(r.patch.presetId, p.id);
    assert.equal(r.patch.townCode, p.townCode);
    projects++;
  }
  assert.ok(projects >= 10, `at least 10 projects round-trip (got ${projects})`);
  assert.equal(TOWNS.length, 308);
  for (const t of TOWNS) {
    const r = parseToken(townToken(t.code));
    assert.ok(r, `town ${t.code}`);
    assert.equal(r.patch.townCode, t.code);
  }
  for (const design of [
    { sizeMW: 10, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 800 },
    { sizeMW: 500, cooling: 'evaporative', heatReuse: false, site: 'forest', distanceM: 200 },
    { sizeMW: 265, cooling: 'liquid', heatReuse: true, site: 'field', distanceM: 3000 },
  ]) {
    for (const code of ['837', '075', '494', '186']) {
      const tok = scenarioToken({ townCode: code, design });
      assert.match(tok, TOKEN_RE);
      const r = parseToken(tok);
      assert.deepEqual(r.patch.design, design, tok);
      assert.equal(r.patch.townCode, code);
    }
  }
});

test('shareUrl keeps the address and replaces the hash', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location');
  const old = globalThis.location;
  globalThis.location = { href: 'https://example.org/app/index.html#simulaattori' };
  try {
    assert.equal(shareUrl('kunta-494'), 'https://example.org/app/index.html#kunta-494');
    globalThis.location = { href: 'https://example.org/app/' };
    assert.equal(shareUrl(projectToken('jarvenpaa-dc')), 'https://example.org/app/#hanke-jarvenpaa-dc');
  } finally {
    if (had) globalThis.location = old; else delete globalThis.location;
  }
});

console.log(`router.test: ${passed} groups passed${process.exitCode ? ', some FAILED' : ''}`);
