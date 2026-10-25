// Step 5: your view. Rate the 7 themes, see what this design means for your top themes, which choice moves them most,
// what nobody knows yet, write your own question, how to have your say, and copy a plain-text summary (with the
// project's own figures first, sources of the coefficients that drive each number, and a link back). No score, no verdict.
import { h, icon, replace, announce } from '../dom.js';
import { t, L } from '../../i18n.js';
import { fmtNum, fmtDate } from '../format.js';
import { store } from '../../store.js';
import { COEF } from '../../model/coefficients.js';
import * as factsMod from '../../content/facts.js';
import * as projectsMod from '../../content/projects.js';
import { projectToken, scenarioToken, shareUrl } from '../router.js';
import { sourceLink } from '../components/sourceLink.js';
import { segmented } from './controls.js';
import { runSim, themeKeys, metricKeysByTheme, headline, fmtRangeUnit, designOptions, hasDH, themeVar } from './compute.js';
import { KEY_METRICS, PERSONAS, themeTitle, declaredFor, declaredLabel, fmtDeclared } from './results.js';
import { townName } from './townCard.js';
import * as participationMod from '../../content/participation.js';

const SAY = participationMod.HAVE_YOUR_SAY && Array.isArray(participationMod.HAVE_YOUR_SAY.steps) ? participationMod.HAVE_YOUR_SAY : null;

/** Today as YYYY-MM-DD in the reader's own time zone (toISOString would give the UTC date). */
function localISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Names of the sources behind the coefficients that drive a metric (deduplicated, at most 3). */
function driverSources(m) {
  const keys = Array.isArray(m?.drivers) && m.drivers.length ? m.drivers : (m?.inputs || []);
  return [...new Set(keys.flatMap((ck) => (COEF?.[ck]?.sources || []).map((s) => L(s.name))))].filter(Boolean).slice(0, 3);
}

const lowerFirst = (s) => (s && !/^[A-ZÅÄÖ]{2}/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const UNKNOWNS = () => (Array.isArray(factsMod.UNKNOWNS) ? factsMod.UNKNOWNS : []);
const leverCache = new Map();

function themeMetricKeys(th, sim) {
  const all = (metricKeysByTheme()[th] || []).filter((k) => sim?.metrics?.[k]);
  // energy: the heat pumps' electricity sits next to the heat it delivers
  const key = [...KEY_METRICS, 'heatPumpElectricity'].filter((k) => all.includes(k));
  return (key.length ? [...key, ...all.filter((k) => !key.includes(k))] : all).slice(0, 3);
}

/** Which design choice (apart from size) changes this theme's numbers most? Uses memoised model runs. */
function computeLever(th, town, design, overrides, sim) {
  const ck = `${town?.code}|${JSON.stringify(design)}|${JSON.stringify(overrides)}|${th}`;
  if (leverCache.has(ck)) return leverCache.get(ck);
  const o = designOptions();
  const dims = [
    { key: 'cooling', alts: o.cooling.map((c) => ({ cooling: c })) },
    hasDH(town) ? { key: 'heatReuse', alts: [{ heatReuse: true }, { heatReuse: false }] } : null,
    { key: 'site', alts: o.site.map((s) => ({ site: s })) },
    { key: 'distance', alts: [{ distanceM: o.distance.min }, { distanceM: o.distance.max }] },
  ].filter(Boolean);
  const metrics = (metricKeysByTheme()[th] || []).filter((k) => sim?.metrics?.[k]);
  let best = null;
  for (const d of dims) {
    const runs = d.alts.map((a) => runSim(town, { ...design, ...a }, overrides).result).filter(Boolean);
    for (const k of metrics) {
      const vals = runs.map((r) => headline(r.metrics?.[k]).typ).filter(Number.isFinite);
      if (vals.length < 2) continue;
      const mn = Math.min(...vals); const mx = Math.max(...vals);
      if (mx <= 0) continue;
      const ratio = mx / Math.max(mn, mx * 1e-3);
      if (ratio > 1.15 && (!best || ratio > best.ratio)) best = { dim: d.key, metric: k, min: mn, max: mx, ratio };
    }
  }
  leverCache.set(ck, best);
  if (leverCache.size > 100) leverCache.delete(leverCache.keys().next().value);
  return best;
}

export function createYourView(ctx) {
  const root = h('section', { class: 'sim-panel sim-view', 'data-step': '5', 'aria-labelledby': 'sim-view-title' });
  const prioEl = h('div', { class: 'sim-view__prios' });
  const summaryEl = h('div', { class: 'sim-view__summary' });
  const sayEl = h('details', { class: 'sim-view__say', hidden: true });
  const textarea = h('textarea', { class: 'sim-input sim-view__q', id: 'sim-view-q', rows: 3, placeholder: t('sim.view.questionPh') });
  const suggestEl = h('div', { class: 'sim-view__suggest' });
  const copyStatus = h('p', { class: 'sim-view__status', role: 'status' });
  const preview = h('textarea', { class: 'sim-input sim-view__preview', readonly: true, rows: 12, 'aria-label': t('sim.view.preview') });
  const previewBox = h('details', { class: 'sim-view__previewbox' }, h('summary', null, t('sim.view.preview')), preview);
  const copyBtn = h('button', { type: 'button', class: 'btn btn--primary sim-view__copy', onclick: () => copy() }, icon('check', { size: 18 }), t('sim.view.copy'));
  let qTimer = 0;
  textarea.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => store.set({ question: textarea.value }), 250);
  });

  const segs = {};
  const rows = themeKeys().map((th) => {
    const seg = segmented({
      labelledby: `sim-prio-${th}`, className: 'sim-seg--prio',
      options: [0, 1, 2, 3].map((v) => ({ value: v, label: t(`sim.view.p${v}`) })),
      value: store.get().priorities?.[th] ?? null,
      onChange: (v) => {
        const st = store.get();
        store.set({ priorities: { ...(st.priorities || {}), [th]: v }, simStep: Math.max(st.simStep || 1, 5) });
      },
    });
    segs[th] = seg;
    return h('div', { class: 'sim-view__prio', style: `--theme: var(${themeVar(th)})` },
      h('span', { class: 'sim-view__prioname', id: `sim-prio-${th}` }, h('span', { class: 'sim-mark', 'aria-hidden': 'true' }), themeTitle(th)), seg);
  });
  prioEl.append(...rows);

  root.append(
    h('div', { class: 'sim-panel__head' },
      h('p', { class: 'sim-panel__eyebrow' }, h('span', { class: 'sim-panel__num' }, '5'), t('sim.view.title')),
      h('h2', { class: 'sim-view__title', id: 'sim-view-title' }, t('sim.view.title')),
      h('p', { class: 'sim-panel__lead' }, t('sim.view.lead'))),
    h('div', { class: 'sim-view__grid' },
      h('div', { class: 'sim-view__col' }, prioEl),
      h('div', { class: 'sim-view__col' }, summaryEl,
        h('div', { class: 'sim-view__ask' },
          h('label', { class: 'sim-field__label', for: 'sim-view-q' }, t('sim.view.question')),
          textarea,
          suggestEl),
        h('div', { class: 'sim-view__copyrow' }, copyBtn, copyStatus),
        previewBox,
        sayEl,
        h('p', { class: 'sim-view__disclaimer' }, icon('info', { size: 16 }), t('sim.view.disclaimer')))));

  function topThemes(state) {
    const pr = state.priorities || {};
    return themeKeys().filter((k) => (pr[k] ?? 0) >= 1).sort((a, b) => (pr[b] ?? 0) - (pr[a] ?? 0)).slice(0, 3);
  }

  let leverJob = 0;
  function renderSummary(state) {
    const sim = ctx.sim();
    const tops = topThemes(state);
    clearTimeout(leverJob);
    if (!tops.length || !sim) {
      replace(summaryEl, h('p', { class: 'sim-view__empty' }, t('sim.view.empty')));
      return;
    }
    const town = ctx.town();
    const leverEls = {};
    replace(summaryEl, 
      h('h3', { class: 'sim-view__h' }, t('sim.view.summary')),
      ...tops.map((th) => {
        const ms = themeMetricKeys(th, sim).map((k) => sim.metrics[k]);
        leverEls[th] = h('p', { class: 'sim-view__lever' }, t('sim.view.computing'));
        const unk = UNKNOWNS().filter((u) => u.theme === th);
        return h('article', { class: 'sim-view__theme', style: `--theme: var(${themeVar(th)})` },
          h('h4', null, h('span', { class: 'sim-mark', 'aria-hidden': 'true' }), themeTitle(th),
            h('span', { class: 'sim-tag' }, t(`sim.view.p${state.priorities[th]}`))),
          h('ul', { class: 'sim-view__means' }, ms.map((m) => {
            const hl = headline(m);
            const dec = declaredFor(m, state);
            if (dec) {
              const { label } = declaredLabel(dec);
              return h('li', null, h('span', null, L(m.title)), h('strong', null, fmtDeclared(dec, m.unit)),
                h('span', { class: 'muted' }, `(${lowerFirst(label)}; ${L({ fi: 'yleinen laskelma', en: 'generic calculation' })} ${fmtRangeUnit(hl.low, hl.high, m.unit)})`));
            }
            return h('li', null, h('span', null, L(m.title)), h('strong', null, fmtRangeUnit(hl.low, hl.high, m.unit)), hl.when ? h('span', { class: 'muted' }, ` ${L(hl.when)}`) : null);
          })),
          leverEls[th],
          unk.length ? h('div', { class: 'sim-view__unknown' }, h('p', { class: 'sim-view__unknownh' }, icon('question', { size: 16 }), t('sim.view.unknown')),
            h('ul', null, unk.slice(0, 2).map((u) => h('li', null, h('strong', null, L(u.question)), u.why ? ` ${L(u.why)}` : '')))) : null);
      }));
    // levers: computed after paint (a few memoised model runs per theme)
    const des = { ...state.design }; const ov = { ...(state.overrides || {}) };
    leverJob = setTimeout(() => {
      for (const th of tops) {
        const lv = computeLever(th, town, des, ov, sim);
        const el = leverEls[th];
        if (!el) continue;
        if (!lv) { el.textContent = t('sim.view.leverNone'); continue; }
        const m = sim.metrics[lv.metric];
        replace(el, icon('arrowRight', { size: 16 }), ' ', t('sim.view.lever', { dim: t(`sim.dim.${lv.dim}`), metric: lowerFirst(L(m?.title) || lv.metric), range: fmtRangeUnit(lv.min, lv.max, m?.unit) }));
      }
    }, 60);
  }

  function renderSuggestions(state) {
    const sim = ctx.sim();
    const tops = topThemes(state);
    const want = new Set(tops.flatMap((th) => metricKeysByTheme()[th] || []));
    const ps = PERSONAS();
    const ranked = [...ps.filter((p) => (p.cares || []).some((k) => want.has(k))), ...ps.filter((p) => !(p.cares || []).some((k) => want.has(k)))];
    const qs = [];
    for (const p of ranked) {
      for (const q of p.asks || []) {
        const s = L(q);
        if (s && !qs.includes(s)) { qs.push(s); break; }
      }
      if (qs.length >= 3) break;
    }
    replace(suggestEl, ...(qs.length ? [h('p', { class: 'sim-view__suggesth' }, t('sim.view.suggest')),
      ...qs.map((q) => h('button', { type: 'button', class: 'sim-suggest', onclick: () => {
        textarea.value = textarea.value.trim() ? `${textarea.value.trim()}\n${q}` : q;
        store.set({ question: textarea.value });
        textarea.focus();
      } }, icon('bubble', { size: 16 }), q))] : []));
    void sim;
  }

  function renderSay() {
    if (!SAY) { sayEl.hidden = true; replace(sayEl); return; }
    sayEl.hidden = false;
    replace(sayEl,
      h('summary', null, icon('bubble', { size: 18 }), ' ', L(SAY.title) || L({ fi: 'Näin voit vaikuttaa', en: 'How to have your say' })),
      SAY.lead ? h('p', { class: 'sim-view__saylead' }, L(SAY.lead)) : null,
      h('ol', { class: 'sim-view__saysteps' }, SAY.steps.map((st) => h('li', null,
        st.title ? h('strong', null, L(st.title)) : null,
        st.text ? h('p', null, L(st.text)) : null,
        st.source ? sourceLink(st.source) : null))));
  }
  renderSay();

  function summaryText(state) {
    const sim = ctx.sim();
    const town = ctx.town();
    const des = state.design || {};
    const lines = [];
    const sizeKey = designOptions().sizes.find((s) => s.mw === des.sizeMW)?.key;
    lines.push(t('sim.sum.head'));
    lines.push(`${t('sim.sum.date')}: ${fmtDate(localISODate())}`);
    lines.push('');
    lines.push(`${t('sim.sum.town')}: ${townName(town)}${Number.isFinite(town?.population) ? ` (${t('sim.sum.residents', { n: fmtNum(town.population, { sig: 3 }) })})` : ''}`);
    const p = state.presetId && projectsMod.projectById ? projectsMod.projectById(state.presetId) : null;
    if (p) lines.push(`${t('sim.sum.project')}: ${L(p.name)}`);
    lines.push(`${t('sim.sum.design')}: ${fmtNum(des.sizeMW, { digits: 1 })} MW${sizeKey ? ` (${t(`sim.size.${sizeKey}`).toLowerCase()})` : ''}, ${t(`sim.cooling.${des.cooling}`).toLowerCase()}, ${t('sim.design.heat').toLowerCase()}: ${(des.heatReuse && hasDH(town) ? t('sim.heat.on') : t('sim.heat.off')).toLowerCase()}, ${t(`sim.site.${des.site}`).toLowerCase()}, ${fmtNum(des.distanceM, { sig: 3 })} m`);
    const ov = Object.entries(state.overrides || {});
    if (ov.length) lines.push(`${t('sim.sum.overrides')}: ${ov.map(([k, v]) => `${L(COEF?.[k]?.title) || k} = ${t(`sim.why.use${v === 'low' ? 'Low' : v === 'high' ? 'High' : 'Typ'}`).toLowerCase()}`).join(', ')}`);
    lines.push('');
    if (sim) {
      lines.push(`${t('sim.sum.numbers')}:`);
      const keys = [...KEY_METRICS];
      const hu = keys.indexOf('heatUsed');
      if (sim.metrics.heatPumpElectricity && !keys.includes('heatPumpElectricity')) keys.splice(hu >= 0 ? hu + 1 : keys.length, 0, 'heatPumpElectricity');
      for (const k of keys) {
        const m = sim.metrics[k];
        if (!m) continue;
        const hl = headline(m);
        const srcs = driverSources(m);
        const model = `${fmtRangeUnit(hl.low, hl.high, m.unit)}${hl.when ? ` (${L(hl.when)})` : ''}${srcs.length ? ` [${t('sim.sum.sources')}: ${srcs.join('; ')}]` : ''}`;
        const dec = declaredFor({ ...m, key: k }, state);
        if (dec) {
          const { fact, label } = declaredLabel(dec);
          const src = fact?.source ? L(fact.source.name) : '';
          lines.push(`- ${L(m.title)}: ${lowerFirst(label)} ${fmtDeclared(dec, m.unit)}${src ? ` [${L({ fi: 'lähde', en: 'source' })}: ${src}]` : ''}; ${L({ fi: 'yleinen laskelma tämän kokoiselle', en: 'generic calculation for this size' })} ${model}`);
          continue;
        }
        lines.push(`- ${L(m.title)}: ${fmtRangeUnit(hl.low, hl.high, m.unit)}${hl.when ? ` (${L(hl.when)})` : ''}${srcs.length ? ` [${t('sim.sum.sources')}: ${srcs.join('; ')}]` : ''}`);
      }
      lines.push('');
    }
    const pr = state.priorities || {};
    const rated = themeKeys().filter((k) => pr[k] != null).sort((a, b) => pr[b] - pr[a]);
    lines.push(`${t('sim.sum.priorities')}: ${rated.length ? rated.map((k) => `${themeTitle(k)} (${t(`sim.view.p${pr[k]}`).toLowerCase()})`).join(', ') : t('sim.sum.noPriorities')}`);
    const unk = topThemes(state).flatMap((th) => UNKNOWNS().filter((u) => u.theme === th)).slice(0, 4);
    if (unk.length) {
      lines.push(`${t('sim.sum.unknowns')}:`);
      for (const u of unk) lines.push(`- ${L(u.question)}`);
    }
    lines.push('');
    lines.push(`${t('sim.sum.question')}: ${(state.question || '').trim() || t('sim.sum.noQuestion')}`);
    lines.push('');
    lines.push(t('sim.view.disclaimer'));
    lines.push(t('sim.sum.footer'));
    const token = state.presetId ? projectToken(state.presetId) : scenarioToken({ townCode: state.townCode, design: state.design });
    lines.push(`${L({ fi: 'Linkki tähän näkymään', en: 'Link to this view' })}: ${shareUrl(token)}`);
    if (SAY?.channelLine) lines.push(L(SAY.channelLine));
    return lines.join('\n');
  }

  async function copy() {
    clearTimeout(qTimer);
    if (textarea.value !== (store.get().question || '')) store.set({ question: textarea.value });
    const text = summaryText(store.get());
    preview.value = text;
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; }
    } catch { ok = false; }
    if (ok) {
      copyStatus.textContent = t('sim.view.copied');
    } else {
      previewBox.open = true;
      preview.focus();
      preview.select();
      try { ok = document.execCommand && document.execCommand('copy'); } catch { ok = false; }
      copyStatus.textContent = ok ? t('sim.view.copied') : t('sim.view.copyFallback');
    }
  }

  let lastPrios = JSON.stringify(store.get().priorities || {});
  function update(state, sim, { structural }) {
    for (const th of themeKeys()) segs[th]?.set(state.priorities?.[th] ?? null);
    const prios = JSON.stringify(state.priorities || {});
    if (prios !== lastPrios) {
      lastPrios = prios;
      const tops = topThemes(state);
      announce(tops.length
        ? L({ fi: `Yhteenveto päivitetty: ${tops.map(themeTitle).join(', ')}.`, en: `Summary updated: ${tops.map(themeTitle).join(', ')}.` })
        : t('sim.view.empty'));
    }
    if (document.activeElement !== textarea && textarea.value !== (state.question || '')) textarea.value = state.question || '';
    if (structural) { renderSummary(state); renderSuggestions(state); }
    preview.value = summaryText(state);
  }

  return { el: root, update, destroy: () => { clearTimeout(leverJob); clearTimeout(qTimer); } };
}
