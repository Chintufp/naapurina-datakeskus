// Tests for the number formatting helpers. Run: node src/ui/format.test.mjs
// Finnish first (the app's default language), then English. Intl's Finnish group separator is a no-break space.
import assert from 'node:assert/strict';
import { store } from '../store.js';
import {
  roundSig, fmtNum, fmtRange, fmtEur, fmtPct, fmtDate, fmtMetricRange,
  fmtCoef, fmtInt, fmtEurRange, fillTemplate,
} from './format.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`FAIL ${name}\n`, e); process.exitCode = 1; }
}
const NB = ' ';   // no-break space (fi-FI grouping)

store.set({ lang: 'fi' });

test('fmtCoef prints coefficients as stored (fi)', () => {
  assert.equal(fmtCoef(1.15), '1,15');
  assert.equal(fmtCoef(0.0224), '0,0224');
  assert.equal(fmtCoef(0.007), '0,007');
  assert.equal(fmtCoef(5000), `5${NB}000`);
  assert.equal(fmtCoef(0.9), '0,9');
  assert.equal(fmtCoef(12.34567), '12,3457');      // at most 4 decimals
  assert.equal(fmtCoef(0.00005), '0,00005');        // too small for 4 decimals: never shown as 0
  assert.equal(fmtCoef(0), '0');
  assert.equal(fmtCoef(NaN), '–');
  assert.equal(fmtCoef(null), '–');
});

test('fmtInt rounds to whole things (fi)', () => {
  assert.equal(fmtInt(6.9), '7');
  assert.equal(fmtInt(6.4), '6');
  assert.equal(fmtInt(99.4), '99');
  assert.equal(fmtInt(1234), `1${NB}200`);
  assert.equal(fmtInt(-0.4), '0');
  assert.equal(fmtInt(Infinity), '–');
  assert.equal(fmtInt(undefined), '–');
});

test('fmtEurRange keeps one unit (fi)', () => {
  assert.equal(fmtEurRange(1.8e8, 3.7e8), '180–370 milj. €');
  assert.equal(fmtEurRange(1.8e9, 3.7e9), '1,8–3,7 mrd. €');
  assert.equal(fmtEurRange(8e8, 1.2e9), '0,8–1,2 mrd. €');
  assert.equal(fmtEurRange(2e8, 2.04e8), '200 milj. €');          // equal ends collapse
  assert.equal(fmtEurRange(12000, 56000), `12${NB}000–56${NB}000 €`);
  assert.equal(fmtEurRange(NaN, NaN), '–');
});

test('fillTemplate (fi): contract cases', () => {
  assert.equal(fillTemplate({ fi: 'noin {low}–{high} autoa' }, { low: 170, typ: 170, high: 170 }), 'noin 170 autoa');
  assert.equal(fillTemplate({ fi: 'josta {range}' }, { low: 1.8e8, typ: 2.7e8, high: 3.7e8, format: 'eur' }), 'josta 180–370 milj. €');
});

test('fillTemplate (fi): placeholders and formats', () => {
  assert.equal(fillTemplate({ fi: 'noin {typ} kotia', en: 'about {typ} homes' }, { low: 9000, typ: 12345, high: 15000 }), `noin 12${NB}000 kotia`);
  assert.equal(fillTemplate({ fi: '{low}–{high} kotia' }, { low: 9000, typ: 12000, high: 15000 }), `9${NB}000–15${NB}000 kotia`);
  assert.equal(fillTemplate({ fi: '{range} kotia' }, { low: 220, typ: 300, high: 510 }), '220–510 kotia');
  assert.equal(fillTemplate({ fi: '{range} kotia' }, { low: 221, typ: 222, high: 224 }), '220 kotia');
  assert.equal(fillTemplate({ fi: 'arvo {value}' }, { value: 0.456 }), 'arvo 0,46');
  // whole machines
  assert.equal(fillTemplate({ fi: '{low}–{high} varavoimakonetta' }, { low: 6.2, typ: 7.4, high: 9.6, format: 'int' }), '6–10 varavoimakonetta');
  assert.equal(fillTemplate({ fi: '{low}–{high} konetta' }, { low: 6.6, typ: 7, high: 7.4, format: 'int' }), '7 konetta');
  assert.equal(fillTemplate({ fi: 'noin {typ} konetta' }, { typ: 6.9, format: 'int' }), 'noin 7 konetta');
  // euros: single values in words, a literal pair keeps one unit
  assert.equal(fillTemplate({ fi: 'noin {typ}' }, { typ: 2.7e8, format: 'eur' }), 'noin 270 milj. €');
  assert.equal(fillTemplate({ fi: '{low}–{high}' }, { low: 1.8e8, typ: 2.7e8, high: 3.7e8, format: 'eur' }), '180–370 milj. €');
  // the old call shape still works: opts go to fmtNum
  assert.equal(fillTemplate({ fi: '{typ}' }, { typ: 1234 }, { sig: 3 }), `1${NB}230`);
  // missing values never print "undefined"
  assert.equal(fillTemplate({ fi: 'noin {typ}' }, {}), 'noin –');
});

test('existing helpers keep their behaviour (fi)', () => {
  assert.equal(roundSig(12345), 12000);
  assert.equal(fmtNum(12345), `12${NB}000`);
  assert.equal(fmtNum(1.54), '1,5');
  assert.equal(fmtRange(220, 510), '220–510');
  assert.equal(fmtRange(221, 224), '220');
  assert.equal(fmtEur(1.2e6), '1,2 milj. €');
  assert.equal(fmtPct(0.43), '43 %');
  assert.equal(fmtDate('2026-07-23'), '23.7.2026');
  assert.equal(fmtMetricRange({ unit: { fi: 'GWh/v', en: 'GWh/yr' }, headline: { low: 280, typ: 350, high: 420 } }), '280–420 GWh/v');
});

store.set({ lang: 'en' });

test('English formats', () => {
  assert.equal(fmtCoef(1.15), '1.15');
  assert.equal(fmtCoef(5000), '5,000');
  assert.equal(fmtCoef(0.0224), '0.0224');
  assert.equal(fmtInt(1234), '1,200');
  assert.equal(fmtEurRange(1.8e8, 3.7e8), '€180–370 million');
  assert.equal(fmtEurRange(1.8e9, 3.7e9), '€1.8–3.7 billion');
  assert.equal(fmtEurRange(3e8, 3e8), '€300 million');
  assert.equal(fillTemplate({ fi: 'josta {range}', en: 'of which {range}' }, { low: 1.8e8, typ: 2.7e8, high: 3.7e8, format: 'eur' }), 'of which €180–370 million');
  assert.equal(fillTemplate({ fi: 'noin {low}–{high} autoa', en: 'about {low}–{high} cars' }, { low: 170, typ: 170, high: 170 }), 'about 170 cars');
  assert.equal(fmtPct(0.43), '43%');
});

store.set({ lang: 'fi' });
console.log(`format.test: ${passed} groups passed${process.exitCode ? ', some FAILED' : ''}`);
