// term(key, label?) → inline glossary term: a disclosure button that shows the GLOSSARY plain explanation.
// It opens on click / Enter / Space (aria-expanded), and closes on Esc, when focus leaves it (unless focus moves into
// the explanation), on a click elsewhere and on scroll. It never opens on focus alone (WCAG 2.2 SC 2.4.11), and on
// desktop pointers hovering shows a preview. The explanation is placed with `position: fixed`, inside the viewport,
// on the side that does not cover the next control after the term (usually above a slider or option below it).
// It is also referenced by aria-describedby, so screen readers read it with the term without opening it.
// Unknown keys render the label as plain text.
// Also exports autoTerms(text, keys) which wraps the first mention of glossary terms inside a plain string.
import { h } from '../dom.js';
import * as Glossary from '../../content/glossary.js';
import { L, lang } from '../../i18n.js';

const G = () => Glossary.GLOSSARY || {};
let seq = 0;
let openTerm = null; // the one currently open popover { pop, wrap, close }

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** The next keyboard-focusable control after `el` in document order (null when none is visible). */
function nextControl(el) {
  const all = [...document.querySelectorAll(FOCUSABLE)].filter((x) => x === el || x.getClientRects().length);
  const i = all.indexOf(el);
  for (let j = i + 1; i >= 0 && j < all.length; j++) {
    if (!all[j].closest('.term-pop')) return all[j];
  }
  return null;
}

const overlaps = (a, b, m = 4) => !!b && a.left < b.right + m && a.right > b.left - m && a.top < b.bottom + m && a.bottom > b.top - m;

function placePopover(trigger, pop) {
  const r = trigger.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  pop.style.maxWidth = `${Math.min(320, vw - 24)}px`;
  pop.style.left = '0px';
  pop.style.top = '0px';
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(12, Math.min(vw - pw - 12, left));
  const next = nextControl(trigger)?.getBoundingClientRect() || null;
  const box = (top) => ({ left, right: left + pw, top, bottom: top + ph });
  const cands = [
    { side: 'below', top: r.bottom + 8 },
    { side: 'above', top: r.top - ph - 8 },
  ].map((c) => ({ ...c, fits: c.top >= 8 && c.top + ph <= vh - 8, free: !overlaps(box(c.top), next) }));
  // 1) fits and keeps the next control visible; 2) keeps the next control visible; 3) fits; 4) below
  const pick = cands.find((c) => c.fits && c.free) || cands.find((c) => c.free) || cands.find((c) => c.fits) || cands[0];
  pop.style.left = `${Math.round(left)}px`;
  pop.style.top = `${Math.round(pick.top)}px`;
  pop.dataset.side = pick.side;
}

const canHover = () => {
  try { return window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; }
};

export function term(key, label) {
  const g = G()[key];
  const text = label ?? (g ? L(g.term) : key);
  if (!g) return h('span', null, text);
  const id = `term-pop-${++seq}`;
  const pop = h('span', { id, class: 'term-pop', hidden: true, tabindex: '-1' },
    h('span', { class: 'term-pop__term' }, L(g.term)),
    h('span', { class: 'term-pop__text' }, L(g.plain)));
  let pinned = false;
  let hideTimer = 0;
  const trigger = h('button', { type: 'button', class: 'term', 'aria-describedby': id, 'aria-controls': id, 'aria-expanded': 'false', 'data-term': key }, text);
  const wrap = h('span', { class: 'term-wrap' }, trigger, pop);

  // on scroll the explanation follows its term, and closes once the term leaves the screen
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (pop.hidden) return;
      const r = trigger.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight || !r.width) close(); else placePopover(trigger, pop);
    });
  };
  const show = () => {
    clearTimeout(hideTimer);
    if (openTerm && openTerm.pop !== pop) openTerm.close();
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    placePopover(trigger, pop);
    openTerm = { pop, wrap, close };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  };
  function close() {
    clearTimeout(hideTimer);
    pinned = false;
    if (pop.hidden) return;
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    window.removeEventListener('scroll', onScroll, { capture: true });
    if (openTerm?.pop === pop) openTerm = null;
  }
  const softHide = () => { if (!pinned) hideTimer = setTimeout(close, 120); };

  // hover is only a preview, and only with a mouse-like pointer
  trigger.addEventListener('mouseenter', () => { if (canHover() && pop.hidden) show(); });
  trigger.addEventListener('mouseleave', () => { if (canHover()) softHide(); });
  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', () => { if (canHover()) softHide(); });
  // click, Enter and Space (native button) toggle it
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pinned) close(); else { pinned = true; show(); }
  });
  // focus leaving the term closes it, unless it moves into the explanation
  wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) close(); });
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      e.stopPropagation();
      close();
      trigger.focus({ preventScroll: true });
    }
  });
  return wrap;
}

// Close an open popover when clicking or tapping elsewhere, or pressing Esc anywhere.
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => { if (openTerm && !openTerm.wrap.contains(e.target)) openTerm.close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openTerm) openTerm.close(); });
}

// ---- automatic first-mention linking ---------------------------------------------------------------
// Patterns per glossary key and language. Abbreviations match whole words; Finnish words match common stems so
// inflected forms ("kaukolämpöverkkoon") are found. Only the FIRST match of each key in a text is wrapped.
const PATTERNS = {
  MW: { fi: /\bMW\b/, en: /\bMW\b/ },
  GWh: { fi: /\bGWh\b/, en: /\bGWh\b/ },
  itTeho: { fi: /\bIT-teh\p{L}*/u, en: /\bIT (load|power|capacity)\b/i },
  vaihteluvali: { fi: /todennäköi\p{L}* väli\p{L}*|vaihteluväl\p{L}*/iu, en: /likely range|\bwhole range\b/i },
  huipputeho: { fi: /(sähköliittymän )?huipputeh\p{L}*/iu, en: /peak (grid )?(demand|power)/i },
  CO2: { fi: /CO₂|\bCO2\b|hiilidioksid\p{L}*/u, en: /CO₂|\bCO2\b|carbon dioxide/i },
  vaihtokierros: { fi: /vaihtokierro\p{L}*|vaihtokierto\p{L}*/iu, en: /refresh cycles?|per refresh\b/i },
  TWh: { fi: /\bTWh\b|terawattitun\p{L}*/u, en: /\bTWh\b|terawatt hours?/ },
  kWh: { fi: /\bkWh\b/, en: /\bkWh\b/ },
  PUE: { fi: /\bPUE\b/, en: /\bPUE\b/ },
  WUE: { fi: /\bWUE\b/, en: /\bWUE\b/ },
  UPS: { fi: /\bUPS\b/, en: /\bUPS\b/ },
  YVA: { fi: /\bYVA\b|ympäristövaikutusten arvioin\p{L}*/u, en: /\bEIA\b|environmental impact assessment/i },
  OAS: { fi: /\bOAS\b|osallistumis- ja arviointisuunnitelm\p{L}*/u, en: /\bOAS\b|participation and assessment plan/i },
  kaukolampo: { fi: /kaukolämp\p{L}*/iu, en: /district[- ]heat\w*/i },
  hukkalampo: { fi: /hukkalämp\p{L}*/iu, en: /waste heat/i },
  lampopumppu: { fi: /lämpöpump\p{L}*/iu, en: /heat pumps?/i },
  kantaverkko: { fi: /kantaverk\p{L}*/iu, en: /(national|main) grid/i },
  sahkoliittyma: { fi: /sähköliittym\p{L}*/iu, en: /grid connection/i },
  varavoima: { fi: /varavoim\p{L}*/iu, en: /backup (power|generators?)/i },
  kiinteistovero: { fi: /kiinteistöver\p{L}*/iu, en: /property tax/i },
  sahkovero: { fi: /sähköver\p{L}*/iu, en: /electricity tax/i },
  hyperscale: { fi: /hyperscale\p{L}*/iu, en: /hyperscale\w*/i },
  kaava: { fi: /asemakaav\p{L}*|\bkaav[ao]\p{L}*/iu, en: /zoning plan\w*|\bzoning\b/i },
  desibeli: { fi: /[Dd]esibel\p{L}*|\bdB\b/u, en: /[Dd]ecibels?|\bdB\b/ },
  vapaajaahdytys: { fi: /vapaajäähdyty\p{L}*/iu, en: /free cooling/i },
  haihdutusjaahdytys: { fi: /haihdutusjäähdyty\p{L}*|haihtuv\p{L}* ve(si|de)\p{L}*/iu, en: /evaporative cooling|evaporating water/i },
  nestejaahdytys: { fi: /nestejäähdyty\p{L}*|nestekier\p{L}*/iu, en: /liquid cooling|liquid loop/i },
  kulutusjousto: { fi: /kulutusjoust\p{L}*/iu, en: /demand (response|flexibility)/i },
  kayttoaste: { fi: /käyttöas\p{L}*/iu, en: /utili[sz]ation/i },
  investointipaatos: { fi: /investointipäätö\p{L}*/iu, en: /investment decision/i },
  ymparistolupa: { fi: /ympäristölup\p{L}*/iu, en: /environmental permit/i },
  hulevesi: { fi: /hulev\p{L}*/iu, en: /stormwater/i },
  polttoaineteho: { fi: /polttoaineteh\p{L}*/iu, en: /fuel power/i },
  elektroniikkaromu: { fi: /elektroniikkaromu\p{L}*|sähkö- ja elektroniikkaromu\p{L}*/iu, en: /e-waste|electronic waste/i },
  Fingrid: { fi: /\bFingrid\p{L}*/u, en: /\bFingrid\b/ },
};

/**
 * Wrap the first mention of each glossary key (from `keys`, or all known) inside `text` with term().
 * `seen` (a Set) lets several paragraphs share "first mention only". Returns an array of nodes/strings.
 */
export function autoTerms(text, keys, seen = new Set()) {
  const l = lang();
  const str = String(text ?? '');
  const glossary = G();
  const cands = (keys && keys.length ? keys : Object.keys(PATTERNS)).filter((k) => glossary[k] && PATTERNS[k] && !seen.has(k));
  const hits = [];
  for (const k of cands) {
    const re = PATTERNS[k][l] || PATTERNS[k].fi;
    const m = re.exec(str);
    if (m) hits.push({ k, i: m.index, len: m[0].length, word: m[0] });
  }
  hits.sort((a, b) => a.i - b.i);
  const out = [];
  let pos = 0;
  for (const hit of hits) {
    if (hit.i < pos) continue; // overlapping match
    out.push(str.slice(pos, hit.i));
    out.push(term(hit.k, hit.word));
    seen.add(hit.k);
    pos = hit.i + hit.len;
  }
  out.push(str.slice(pos));
  return out;
}
