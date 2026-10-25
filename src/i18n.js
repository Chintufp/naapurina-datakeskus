// Translation helpers.
//   t('nav.sim')            → UI string from the dictionaries (falls back to Finnish, then the key)
//   t('x.count', { n: 3 })  → replaces {n} placeholders
//   L({ fi: '…', en: '…' }) → picks the current language from a bilingual content object
// Each area owns its own dictionary file so parallel work never edits the same file.
import { store } from './store.js';
import core from './i18n/dict-core.js';
import sim from './i18n/dict-sim.js';
import pages from './i18n/dict-pages.js';

const DICTS = [core, sim, pages];
const merged = { fi: {}, en: {} };
for (const d of DICTS) {
  Object.assign(merged.fi, d.fi || {});
  Object.assign(merged.en, d.en || {});
}

export const lang = () => store.get().lang;

export function t(key, vars) {
  const l = lang();
  let s = merged[l][key] ?? merged.fi[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

export function L(obj) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang()] ?? obj.fi ?? obj.en ?? '';
}

export const locale = () => (lang() === 'fi' ? 'fi-FI' : 'en-GB');
