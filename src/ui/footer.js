// Site footer: data attributions (required by the CC BY licences), project note and the date the data was checked.
import { h } from './dom.js';
import { store } from '../store.js';
import { t } from '../i18n.js';
import { go } from './router.js';

const LINKS = [
  ['Tilastokeskus', 'Statistics Finland', 'https://stat.fi/', 'CC BY 4.0'],
  ['Verohallinto', 'Finnish Tax Administration', 'https://www.vero.fi/', null],
  ['Energiateollisuus ry', 'Finnish Energy', 'https://energia.fi/', null],
  ['Fingrid', 'Fingrid', 'https://www.fingrid.fi/', 'CC BY 4.0'],
];

export function mountFooter(el) {
  const render = () => {
    const fi = store.get().lang === 'fi';
    const navLink = (route, key) => h('a', { href: `#${route}`, onclick: (e) => { e.preventDefault(); go(route); } }, t(key));
    el.replaceChildren(h('div', { class: 'site-footer__inner footer' },
      h('div', { class: 'footer__col footer__col--wide' },
        h('p', { class: 'footer__brand' }, t('app.name')),
        h('p', null, t('app.tagline')),
        h('p', { class: 'footer__note' }, t('ftr.notAdvice'))),
      h('div', { class: 'footer__col' },
        h('h2', { class: 'footer__h' }, t('ftr.data')),
        h('ul', { class: 'footer__list' }, LINKS.map(([nfi, nen, url, lic]) => h('li', null,
          h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, fi ? nfi : nen),
          lic ? h('span', { class: 'footer__lic' }, ` · ${lic}`) : null))),
        h('p', { class: 'footer__small' }, t('ftr.dataText'))),
      h('div', { class: 'footer__col' },
        h('h2', { class: 'footer__h' }, t('ftr.project')),
        h('p', null, t('ftr.projectText')),
        h('p', { class: 'footer__links' }, navLink('menetelma', 'ftr.method'), ' · ', navLink('lahteet', 'ftr.sources')),
        h('p', { class: 'footer__checked' }, t('ftr.checked')))));
  };
  render();
  store.subscribe((s, p) => { if (s.lang !== p.lang) render(); });
}
