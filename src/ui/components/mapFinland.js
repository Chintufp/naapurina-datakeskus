// Interactive map of Finland's 308 municipalities (hand-drawn SVG from MAP, no map library).
// Contract:
//   mountMapFinland(el, { selectedCode, onSelect(code), showProjects: true, projectFilter?: (p) => bool,
//                         onProjectSelect?(project), legend: true, labels: true, zoomControls: true,
//                         zoomOnSelect: false, ariaLabel?, compact: false })
//   → { update(opts), destroy(), zoomTo(code), resetZoom() }
// Hover/focus shows the town name; click/tap selects. Keyboard users choose towns with the search combobox that the
// page puts next to the map (the map itself would be 308 tab stops). Project dots: colour + shape by status.
import { h, s } from '../dom.js';
import { MAP } from '../../data/mapPaths.js';
import * as Projects from '../../content/projects.js';
import * as Towns from '../../data/towns.js';
import { t, L } from '../../i18n.js';
import { fmtNum } from '../format.js';
import { STATUSES, statusGlyph, statusIcon, kids } from '../pages/common.js';

// Larger towns used as faint orientation labels (Statistics Finland codes).
const REF_TOWNS = ['091', '837', '853', '564', '698', '297', '179', '905', '167', '398', '240'];
const LABEL_BELOW = new Set(['091', '853']);

const parseVB = (vb) => { const [x, y, w, hh] = String(vb).split(/[\s,]+/).map(Number); return { x, y, w, h: hh }; };
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const townBy = (code) => (typeof Towns.townByCode === 'function' ? Towns.townByCode(code) : null);

export function mountMapFinland(el, opts = {}) {
  opts = { showProjects: true, legend: true, labels: true, zoomControls: true, zoomOnSelect: false, compact: false, ...opts };
  const base = parseVB(MAP?.viewBox || '0 0 800 1375');
  let vb = { ...base };
  let anim = 0;
  let hoverCode = null;
  const paths = MAP?.paths || {};

  // ---- DOM ------------------------------------------------------------------------------------
  const descId = `map-desc-${Math.random().toString(36).slice(2, 8)}`;
  const svg = s('svg', {
    viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, class: 'map-fi__svg', role: 'img', preserveAspectRatio: 'xMidYMid meet',
    'aria-label': opts.ariaLabel || t('map.label'), 'aria-describedby': descId,
  });
  const gTowns = s('g', { class: 'map-fi__towns' });
  const pathEls = new Map();
  for (const [code, d] of Object.entries(paths)) {
    const p = s('path', { d, 'data-code': code, class: 'map-fi__town' });
    pathEls.set(code, p);
    gTowns.append(p);
  }
  const outline = MAP?.outline ? s('path', { d: MAP.outline, class: 'map-fi__outline' }) : null;
  const hoverPath = s('path', { class: 'map-fi__hover', d: '' });
  const selPath = s('path', { class: 'map-fi__sel', d: '' });
  const gLabels = s('g', { class: 'map-fi__labels', 'aria-hidden': 'true' });
  // The selection pin sits below the project markers (so a project in the chosen town stays visible on top of it);
  // the selected town's name sits above everything.
  const gSelPin = s('g', { class: 'map-fi__sel-pin', 'aria-hidden': 'true' });
  const gProjects = s('g', { class: 'map-fi__projects' });
  const gSelLabel = s('g', { class: 'map-fi__sel-label', 'aria-hidden': 'true' });
  svg.append(...kids(gTowns, outline, selPath, hoverPath, gLabels, gSelPin, gProjects, gSelLabel));

  const tip = h('div', { class: 'map-fi__tip', 'aria-hidden': 'true', hidden: true });
  const desc = h('p', { id: descId, class: 'sr-only' }, t('map.help'));
  const btn = (label, glyph, fn, cls = '') => h('button', { type: 'button', class: `map-fi__zbtn ${cls}`, 'aria-label': label, title: label, onclick: fn }, glyph);
  const resetBtn = btn(t('map.reset'), t('map.reset'), () => resetZoom(), 'map-fi__zbtn--text');
  const zoomBar = opts.zoomControls ? h('div', { class: 'map-fi__zoom' },
    btn(t('map.zoomIn'), '+', () => zoomBy(1.7)),
    btn(t('map.zoomOut'), '−', () => zoomBy(1 / 1.7)),
    resetBtn) : null;
  const stage = h('div', { class: 'map-fi__stage' }, svg, tip, zoomBar, desc);
  const legend = h('div', { class: 'map-fi__legend' });
  const root = h('div', { class: ['map-fi', opts.compact && 'map-fi--compact'] }, stage, legend);
  el.append(root);

  // ---- helpers ------------------------------------------------------------------------------
  const pxPerUnit = () => {
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return 0.6;
    return Math.min(r.width / vb.w, r.height / vb.h);
  };
  const projects = () => {
    const all = Array.isArray(Projects.PROJECTS) ? Projects.PROJECTS : [];
    return all.filter((p) => p && p.townCode && (!opts.projectFilter || opts.projectFilter(p)));
  };
  const projectsIn = (code) => projects().filter((p) => String(p.townCode).padStart(3, '0') === code);
  const centroidOf = (code) => {
    const tw = townBy(code);
    if (tw?.centroid) return tw.centroid;
    const p = pathEls.get(code);
    if (p && p.isConnected) { try { const b = p.getBBox(); return [b.x + b.width / 2, b.y + b.height / 2]; } catch { /* not rendered */ } }
    return null;
  };

  function drawOverlays() {
    const u = 1 / pxPerUnit(); // viewBox units per screen pixel
    // reference labels
    gLabels.replaceChildren();
    if (opts.labels) {
      for (const code of REF_TOWNS) {
        if (code === opts.selectedCode) continue;
        const c = centroidOf(code);
        const tw = townBy(code);
        if (!c || !tw) continue;
        const below = LABEL_BELOW.has(code);
        gLabels.append(s('text', { x: c[0], y: below ? c[1] + 15 * u : c[1] - 7 * u, class: 'map-fi__ref', 'font-size': 11 * u, 'stroke-width': 3 * u, 'text-anchor': 'middle' }, L(tw.name)));
        gLabels.append(s('circle', { cx: c[0], cy: c[1], r: 1.6 * u, class: 'map-fi__refdot' }));
      }
    }
    // project dots, clustered around the town centroid
    gProjects.replaceChildren();
    if (opts.showProjects) {
      const byTown = new Map();
      for (const p of projects()) {
        const code = String(p.townCode).padStart(3, '0');
        if (!byTown.has(code)) byTown.set(code, []);
        byTown.get(code).push(p);
      }
      const r = 5.5 * u;
      for (const [code, list] of byTown) {
        const c = centroidOf(code);
        if (!c) continue;
        list.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status));
        list.forEach((p, i) => {
          const n = list.length;
          const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
          const off = n > 1 ? r * 1.25 : 0;
          const cx = c[0] + Math.cos(ang) * off;
          const cy = c[1] + Math.sin(ang) * off;
          const g = s('g', { class: 'map-fi__dot', 'data-project': p.id, 'data-code': code },
            s('circle', { cx, cy, r: r + 2 * u, class: 'map-fi__dot-ring' }),
            statusGlyph(p.status, cx, cy, r),
            s('circle', { cx, cy, r: Math.max(r * 2, 12 * u), class: 'map-fi__dot-hit' }));
          gProjects.append(g);
        });
      }
    }
    // selected town: pin (below the project markers) and name (on top)
    gSelPin.replaceChildren();
    gSelLabel.replaceChildren();
    const code = opts.selectedCode;
    const tw = code ? townBy(code) : null;
    const c = code ? centroidOf(code) : null;
    if (tw && c) {
      const name = L(tw.name);
      const fs = 14 * u;
      const nDots = opts.showProjects ? projectsIn(code).length : 0;
      // With project markers on the town the pin becomes a ring around them (drawn underneath, so they stay on top).
      const dotR = 5.5;
      const pinR = nDots ? (nDots > 1 ? dotR * 1.25 : 0) + dotR + 5 : 4;
      const above = c[1] - (pinR + 10) * u > vb.y + 20 * u;
      const ty = above ? c[1] - (pinR + 8) * u : c[1] + (pinR + 18) * u;
      gSelPin.append(s('circle', { cx: c[0], cy: c[1], r: pinR * u, class: ['map-fi__pin', nDots && 'map-fi__pin--ring'], 'stroke-width': 2 * u }));
      gSelLabel.append(s('text', { x: c[0], y: ty, class: 'map-fi__sel-text', 'font-size': fs, 'stroke-width': 4 * u, 'text-anchor': 'middle' }, name));
    }
  }

  function applySelection() {
    for (const [code, p] of pathEls) p.classList.toggle('is-selected', code === opts.selectedCode);
    const sel = opts.selectedCode && pathEls.get(opts.selectedCode);
    selPath.setAttribute('d', sel ? sel.getAttribute('d') : '');
    root.classList.toggle('has-selection', !!sel);
  }

  function renderLegend() {
    legend.replaceChildren();
    if (!opts.legend || !opts.showProjects) return;
    const counts = Object.fromEntries(STATUSES.map((k) => [k, 0]));
    for (const p of projects()) if (counts[p.status] != null) counts[p.status]++;
    legend.append(
      h('p', { class: 'map-fi__legend-title' }, t('map.legend')),
      h('ul', { class: 'map-fi__legend-list' }, STATUSES.filter((k) => counts[k] > 0 || k !== 'halted').map((k) => h('li', null,
        statusIcon(k, 16), h('span', null, t(`status.${k}`)), h('span', { class: 'map-fi__legend-n' }, String(counts[k]))))),
      h('p', { class: 'map-fi__legend-note' }, t('map.legendNote')));
  }

  function setVB(next) {
    vb = next;
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
    const zoomed = vb.w < base.w * 0.98;
    root.classList.toggle('is-zoomed', zoomed);
    if (resetBtn) resetBtn.hidden = !zoomed;
    drawOverlays();
  }
  function clampVB(v) {
    const w = Math.min(base.w, Math.max(base.w / 12, v.w));
    const hh = w * (base.h / base.w);
    // keep the view (almost) inside the country's box so a coastal town never leaves half the view as empty sea
    const mx = w * 0.06;
    const my = hh * 0.06;
    const x = Math.min(base.x + base.w - w + mx, Math.max(base.x - mx, v.x));
    const y = Math.min(base.y + base.h - hh + my, Math.max(base.y - my, v.y));
    return { x, y, w, h: hh };
  }
  function animateTo(target) {
    target = clampVB(target);
    cancelAnimationFrame(anim);
    if (reduceMotion()) { setVB(target); return; }
    const from = { ...vb };
    const t0 = performance.now();
    const dur = 420;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setVB({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e });
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function zoomBy(f, cx, cy) {
    const w = vb.w / f;
    const hh = w * (base.h / base.w);
    const ccx = cx ?? vb.x + vb.w / 2;
    const ccy = cy ?? vb.y + vb.h / 2;
    if (f < 1 && w >= base.w) { animateTo(base); return; }
    animateTo({ x: ccx - w / 2, y: ccy - hh / 2, w, h: hh });
  }
  function zoomTo(code) {
    const p = pathEls.get(code);
    if (!p) return;
    let b;
    try { b = p.getBBox(); } catch { return; }
    const size = Math.max(b.width, b.height * (base.w / base.h), base.w / 5);
    const w = Math.min(base.w, size * 2.6);
    const hh = w * (base.h / base.w);
    animateTo({ x: b.x + b.width / 2 - w / 2, y: b.y + b.height / 2 - hh / 2, w, h: hh });
  }
  function resetZoom() { animateTo(base); }

  // ---- interaction ----------------------------------------------------------------------------
  const showTip = (e, text, sub) => {
    const r = stage.getBoundingClientRect();
    tip.replaceChildren(...kids(h('span', { class: 'map-fi__tip-name' }, text), sub ? h('span', { class: 'map-fi__tip-sub' }, sub) : null));
    tip.hidden = false;
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const tw = tip.offsetWidth;
    const left = Math.min(r.width - tw - 4, Math.max(4, x - tw / 2));
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(4, y - tip.offsetHeight - 14)}px`;
  };
  const hideTip = () => { tip.hidden = true; hoverPath.setAttribute('d', ''); hoverCode = null; };

  const onMove = (e) => {
    if (drag?.moved) return;
    const dot = e.target.closest?.('.map-fi__dot');
    if (dot) {
      const p = projects().find((x) => x.id === dot.dataset.project);
      if (p) {
        const code = dot.dataset.code;
        hoverPath.setAttribute('d', pathEls.get(code)?.getAttribute('d') || '');
        showTip(e, L(p.name), `${t(`status.${p.status}`)}${p.mw ? ` · ${fmtNum(p.mw, { sig: 3 })} MW` : ''}`);
        return;
      }
    }
    const path = e.target.closest?.('.map-fi__town');
    if (!path) { hideTip(); return; }
    const code = path.dataset.code;
    if (code !== hoverCode) {
      hoverCode = code;
      hoverPath.setAttribute('d', path.getAttribute('d'));
    }
    const tw = townBy(code);
    const n = projectsIn(code).length;
    showTip(e, tw ? L(tw.name) : code, opts.showProjects && n ? (n === 1 ? t('map.project1') : t('map.projects', { n })) : null);
  };

  let drag = null;
  const onDown = (e) => {
    if (vb.w >= base.w * 0.98 || e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, vb: { ...vb }, moved: false, id: e.pointerId };
  };
  const onDragMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) { drag.moved = true; try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ } hideTip(); root.classList.add('is-dragging'); }
    const k = 1 / pxPerUnit();
    setVB(clampVB({ ...drag.vb, x: drag.vb.x - dx * k, y: drag.vb.y - dy * k }));
  };
  const onUp = () => {
    if (drag?.moved) { root.classList.remove('is-dragging'); setTimeout(() => { drag = null; }, 0); } else drag = null;
  };
  const onClick = (e) => {
    if (drag?.moved) return;
    const dot = e.target.closest?.('.map-fi__dot');
    if (dot) {
      const p = projects().find((x) => x.id === dot.dataset.project);
      if (p && opts.onProjectSelect) { opts.onProjectSelect(p); return; }
      if (opts.onSelect) opts.onSelect(dot.dataset.code);
      return;
    }
    const path = e.target.closest?.('.map-fi__town');
    if (path && opts.onSelect) opts.onSelect(path.dataset.code);
  };

  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerleave', hideTip);
  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onDragMove);
  svg.addEventListener('pointerup', onUp);
  svg.addEventListener('pointercancel', onUp);
  svg.addEventListener('click', onClick);

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => drawOverlays()) : null;
  ro?.observe(svg);

  applySelection();
  renderLegend();
  setVB(vb);
  requestAnimationFrame(() => drawOverlays());

  return {
    update(next = {}) {
      const prevSel = opts.selectedCode;
      opts = { ...opts, ...next };
      applySelection();
      renderLegend();
      drawOverlays();
      if (opts.zoomOnSelect && next.selectedCode && next.selectedCode !== prevSel) zoomTo(next.selectedCode);
    },
    zoomTo,
    resetZoom,
    destroy() { cancelAnimationFrame(anim); ro?.disconnect(); root.remove(); },
  };
}
