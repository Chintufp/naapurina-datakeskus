// Fact card: the claim, its number, the trust labels and the source side by side.
// Used by the Sources page, the topic pages and the simulator's "Why?" drawer. Keep the export signature:
//   factCard(fact, { compact = false, showTheme = false } = {}) → <article>
import { h } from '../dom.js';
import { kindChip, confidenceChip } from './chips.js';
import { sourceLink } from './sourceLink.js';
import { autoTerms } from './term.js';
import { L, t } from '../../i18n.js';
import { fmtNum, roundSig } from '../format.js';
import * as Themes from '../../content/themes.js';

// Technical words explained (glossary popover) at their first mention in a card on the pages; the simulator's
// compact cards stay plain text.
export const CARD_TERMS = ['GWh', 'desibeli', 'YVA', 'polttoaineteho', 'itTeho'];

const HUE = {
  energy: 'var(--c-energy)', environment: 'var(--c-water)', jobs: 'var(--c-jobs)', traffic: 'var(--c-traffic)',
  land: 'var(--c-land)', safety: 'var(--c-safety)', future: 'var(--c-future)',
};

// Reported (measured) numbers keep up to 3 significant figures, e.g. 84,5 TWh — not 85.
function rep(x) {
  if (x == null || !Number.isFinite(x)) return '–';
  const r = roundSig(x, 3);
  const dec = r === 0 ? 0 : Math.max(0, Math.min(2, 3 - Math.ceil(Math.log10(Math.abs(r) + 1e-12))));
  return fmtNum(r, { digits: dec });
}
function valueText(v) {
  if (!v) return null;
  const unit = L(v.unit);
  const one = v.low == null || v.high == null || v.low === v.high;
  const num = one ? rep(v.typ ?? v.low ?? v.high) : (rep(v.low) === rep(v.high) ? rep(v.low) : `${rep(v.low)}–${rep(v.high)}`);
  if (num === '–') return null;
  return { num, unit, typ: !one && v.typ != null && v.typ !== v.low && v.typ !== v.high ? rep(v.typ) : null };
}

/** fact: an entry of FACTS in content/facts.js */
export function factCard(fact, { compact = false, showTheme = false } = {}) {
  if (!fact) return null;
  const v = valueText(fact.value);
  const theme = showTheme && Array.isArray(Themes.THEMES) ? Themes.THEMES.find((x) => x.key === fact.theme) : null;
  return h('article', {
    class: ['fact-card', compact && 'fact-card--compact', `fact-card--${fact.kind || 'measured'}`],
    id: compact ? null : `fact-${fact.id}`,
    style: { '--hue': HUE[fact.theme] || 'var(--line-strong)' },
  },
  h('div', { class: 'fact-card__labels' },
    fact.kind ? kindChip(fact.kind) : null,
    fact.confidence ? confidenceChip(fact.confidence) : null,
    theme ? h('span', { class: 'theme-tag', style: { '--hue': HUE[fact.theme] } }, L(theme.title)) : null),
  v ? h('p', { class: 'fact-card__value' },
    h('span', { class: 'fact-card__num' }, v.num), v.unit ? h('span', { class: 'fact-card__unit' }, ` ${v.unit}`) : null,
    v.typ ? h('span', { class: 'fact-card__typ' }, ` · ${t('common.typical', { typ: v.typ })}`) : null) : null,
  h('p', { class: 'fact-card__claim' }, compact ? L(fact.claim) : autoTerms(L(fact.claim), CARD_TERMS)),
  fact.note ? h('p', { class: 'fact-card__note' }, L(fact.note)) : null,
  fact.verified === false && !compact ? h('p', { class: 'fact-card__flag' }, t('facts.verifiedNo')) : null,
  h('footer', { class: 'fact-card__source' }, sourceLink(fact.source)));
}
