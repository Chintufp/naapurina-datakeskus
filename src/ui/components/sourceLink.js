// One source line: "Fingrid · Viranomainen · 23.7.2026 ↗"
import { h, icon } from '../dom.js';
import { sourceTypeChip } from './chips.js';
import { fmtDate } from '../format.js';
import { L, t } from '../../i18n.js';

/** source: { name, type, date, url, note? } */
export function sourceLink(source) {
  if (!source) return null;
  const name = L(source.name);
  return h('span', { class: 'source' },
    source.url
      ? h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer', class: 'source__name' },
        name, ' ', icon('link', { size: 13 }), h('span', { class: 'sr-only' }, ` ${t('common.newTab')}`))
      : h('span', { class: 'source__name' }, name),
    source.type ? sourceTypeChip(source.type) : null,
    source.date ? h('span', { class: 'source__date' }, fmtDate(source.date)) : null);
}
