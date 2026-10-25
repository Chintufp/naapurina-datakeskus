// Trust labels shown next to every number: what kind of information it is, how strong the evidence is,
// and what kind of source it comes from. Never colour alone: each chip has an icon and a word.
import { h, icon } from '../dom.js';
import { t } from '../../i18n.js';

// measured = already happened (statistics, measurements, reported outcomes); estimate = a project's, authority's or
// consultant's forecast or plan; calculated = this app's own calculation; opinion = a party's view (SPEC §2).
const KIND_ICON = { measured: 'ruler', estimate: 'doc', calculated: 'calc', opinion: 'bubble' };
export const KINDS = ['measured', 'estimate', 'calculated', 'opinion'];

/** kind: 'measured' | 'estimate' | 'calculated' | 'opinion'. Compact chips show the icon; the word stays for screen readers. */
export function kindChip(kind, { compact = false } = {}) {
  return h('span', { class: `chip chip--kind chip--${kind}`, title: t(`kind.${kind}.help`) },
    icon(KIND_ICON[kind] || 'info', { size: 14 }),
    h('span', { class: compact ? 'sr-only' : null }, t(`kind.${kind}`)));
}

/** confidence: 'strong' | 'medium' | 'weak' — drawn as 3 dots, filled to the level. */
export function confidenceChip(confidence) {
  const level = { strong: 3, medium: 2, weak: 1 }[confidence] || 0;
  return h('span', { class: `chip chip--conf chip--conf-${confidence}`, title: t(`conf.${confidence}.help`) },
    h('span', { class: 'conf-dots', 'aria-hidden': 'true' },
      [1, 2, 3].map((i) => h('span', { class: i <= level ? 'dot dot--on' : 'dot' }))),
    h('span', null, t(`conf.${confidence}`)));
}

/** "Oletus" / "Assumption": the value rests on a design choice a real project has not published (preset.assumedKeys). */
export function assumptionChip({ title } = {}) {
  return h('span', { class: 'chip chip--assumed', title: title || t('chip.assumedHelp') },
    icon('question', { size: 14 }),
    h('span', null, t('chip.assumed')));
}

/** type: authority | company | research | news | ngo | industry | politics | statistics | resident */
export function sourceTypeChip(type) {
  return h('span', { class: `chip chip--src chip--src-${type}` }, t(`src.${type}`));
}
