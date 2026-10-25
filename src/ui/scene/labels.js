// Layer 7: small labels in the current language + the gentle "highlight" spotlight.
// Event moments add a strong label (prio 4); 'endOfLife' draws a signpost with two arrows (renew? / dismantle?).
// Presentation mode scales the labels ×1.4 (×1.2 on a phone-sized scene) and hides the minor ones (prio 1).
import { css, mix } from './colors.js';
import { rrect, clamp, lerp, winterGlow } from './util.js';
import { TXT, tr, distanceText, townLabel, HIGHLIGHT_TARGET, numFmt } from './text.js';
import { hallRects, geo, generatorStacks, hallProgress, buildingHall, carCount, carParkBox, crateSpot } from './datacentre.js';
import { footprint } from './land.js';
import { CHIMNEY_H, warmHomeAnchor } from './town.js';
import { noticeBoardSpot } from './effects.js';
import { PUBLIC_EVENTS } from './layout.js';

/** World-space boxes for each highlightable part of the picture. */
export function regions(G) {
  const { L, st, plan, power, pipe, water } = G;
  const p = L.plot;
  const { dy } = geo(p);
  const rects = hallRects(L);
  const last = rects[rects.length - 1];
  const [hx0, hy0] = L.toWorld(rects[0].x - 10, -last.h - dy - 14);
  const [hx1] = L.toWorld(last.x + last.w + p.depth * 0.6 + 2, 0);
  const hall = { x0: hx0, y0: hy0, x1: hx1, y1: p.y + 4 };
  const fp = footprint(L);
  const plot = { x0: fp.x0 - 4, y0: Math.min(fp.y0, hall.y0) - 4, x1: fp.x1 + 4, y1: fp.y1 + 4 };
  const out = { hall, plot, land: { x0: fp.x0 - 3, y0: fp.y0 - 3, x1: fp.x1 + 3, y1: fp.y1 + 3 } };
  out.site = plot;
  // builders / staff: include the car park in front of the plot (it fills with their cars)
  const park = carCount(st) != null ? carParkBox(L, st) : null;
  const parkY1 = park ? p.y + park.y1 * p.s + 2 : null;
  out.workers = { ...plot, y0: plot.y0 - (st.phase === 'construction' ? 40 * p.s : 0), y1: Math.max(plot.y1, parkY1 ?? plot.y1) };
  out.staff = { ...hall, y1: st.phase === 'operation' && park ? parkY1 : p.y + 6 };
  out.road = { x0: L.view.x0, y0: L.roadY - 10, x1: L.gateX + 18, y1: L.roadY + 9 };
  if (power) {
    const tops = power.pylons.map((q) => q.top);
    out.power = { x0: power.gx - 10, y0: Math.min(...tops, power.gy) - 6, x1: L.view.x1, y1: p.y + 4 };
  }
  const homeX = plan.homeRight;
  out.noise = { x0: homeX - 46, y0: hall.y0 - 4, x1: hall.x1, y1: L.yB + 6 };
  if (pipe && st.heatReuse && st.phase === 'operation') {
    out.heat = { x0: plan.dh.x - 4, y0: plan.dh.y - CHIMNEY_H - 4, x1: Math.max(pipe.x0, hall.x1) + 2, y1: Math.max(pipe.y0, pipe.y1, pipe.cy) + 6 };
  } else out.heat = { ...hall, y0: hall.y0 - 22 };
  if (st.cooling === 'evaporative' && water) {
    out.water = { x0: L.view.x0, y0: hall.y0 - 40, x1: hall.x1 + 20, y1: L.roadY + 13 };
  } else out.water = { ...hall, y0: hall.y0 - 10 };
  const gs = generatorStacks(L).map((s) => L.toWorld(s.x, s.y));
  if (gs.length) {
    const xs = gs.map((g) => g[0]);
    out.gens = { x0: Math.min(...xs) - 10 * p.s, y0: Math.min(...gs.map((g) => g[1])) - 14, x1: Math.max(...xs) + 16 * p.s, y1: p.y + 3 };
  }
  return out;
}

export function highlightTarget(st) {
  if (!st.highlight) return null;
  const t = HIGHLIGHT_TARGET[st.highlight] || st.highlight;
  if (t === 'gens' && st.phase === 'planning') return 'land';
  if (st.phase === 'planning' && (t === 'hall' || t === 'staff' || t === 'heat' || t === 'water' || t === 'noise')) return 'land';
  if (t === 'workers' && st.phase === 'operation') return 'staff';
  return t;
}

/** Dim everything except the highlighted region (a soft spotlight). */
export function drawSpotlight(ctx, L, P, box, hue, t, still) {
  if (!box) return;
  const pad = 6;
  const x0 = box.x0 - pad, y0 = box.y0 - pad, w = box.x1 - box.x0 + pad * 2, h = box.y1 - box.y0 + pad * 2;
  ctx.save();
  ctx.fillStyle = css(P.bg, P.dark ? 0.42 : 0.38);
  ctx.beginPath();
  ctx.rect(L.view.x0 - 5, -5, L.view.x1 - L.view.x0 + 10, L.Hw + 10);
  rrect(ctx, x0, y0, w, h, 8, true);
  ctx.fill('evenodd');
  const pulse = still ? 0.8 : 0.6 + 0.3 * Math.sin(t * 2.2);
  ctx.strokeStyle = css(hue, pulse);
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  rrect(ctx, x0, y0, w, h, 8);
  ctx.stroke();
  ctx.restore();
}

/** Collect the labels to show for the current state. */
export function collectLabels(G, hlTarget, R) {
  const { L, st, plan, power, pipe, P } = G;
  const lang = st.lang;
  const p = L.plot;
  const { dy } = geo(p);
  const rects = hallRects(L);
  const lab = [];
  const add = (id, text, x, y, prio, hue, below = false) => lab.push({ id, text, x, y, prio, hue, below });
  const T = TXT.label;

  // town name or "nearest homes"
  const nearest = plan.front[plan.front.length - 1];
  const name = townLabel(st);
  const townMid = (Math.max(plan.x0, L.view.x0 + 8) + plan.homeRight) / 2;
  if (name) add('town', name, townMid - 20, L.yB - 50, 1, null);
  if (nearest) add('homes', tr(T.homes, lang), nearest.x + nearest.w / 2, nearest.y - nearest.w * 0.95, 2, null);

  // a town missing from the district-heat statistics: the plant (if drawn) is marked uncertain; never "no network".
  // These two carry a correctness message, so in operation they are kept (prio 3) even when space is tight.
  const op = st.phase === 'operation';
  if (plan.dh) add('dh', tr(st.plantUncertain ? T.dhLocal : T.dh, lang), plan.dh.x + 5, plan.dh.y - CHIMNEY_H - 2, st.plantUncertain ? (op ? 3 : 2) : 1, null);
  else add('noDH', tr(T.noDH, lang), townMid + 10, L.yB - 36, op ? 3 : 1, null);

  const centerX = p.x + p.w * 0.38;
  const [, topY] = L.toWorld(0, -rects[0].h - dy - 4);
  if (st.phase === 'planning') {
    add('site', tr(T.zoning, lang), L.toWorld(14, -22)[0], L.toWorld(14, -22)[1], 3, P.heat);
    if (power) add('power', tr(T.powerPlanned, lang), power.pylons[0]?.x ?? centerX, (power.pylons[0]?.base ?? p.y) - 8, 1, P.cEnergy);
  } else if (st.phase === 'construction') {
    add('site', tr(T.site, lang), centerX, topY - 30 * p.s, 3, P.crane);
    add('trucks', tr(T.trucks, lang), clamp(L.gateX - 70, L.view.x0 + 40, L.view.x1 - 40), L.roadY - 9, 2, P.cTraffic);
  } else {
    add('dc', `${tr(T.dc, lang)} · ${numFmt(lang, 3).format(st.sizeMW)} MW`, centerX, topY - (st.cooling === 'evaporative' ? 34 : 14) * p.s, 3, P.accent);
    if (power && power.pylons[0]) add('power', tr(T.power, lang), power.pylons[0].x, power.pylons[0].top - 3, 1, P.cEnergy);
    if (st.heatReuse && pipe) add('pipe', tr(T.pipe, lang), (pipe.x0 + pipe.x1) / 2, Math.max(pipe.y0, pipe.y1) + 8, 2, P.cHeat, true);
    else add('heatAir', tr(st.heatAssumed ? T.heatAirAssumed : T.heatAir, lang), p.x + p.w * 0.62, topY - 18 * p.s, 2, P.cHeat);
    if (st.cooling === 'evaporative') add('waterMain', tr(T.waterMain, lang), (L.view.x0 + L.gateX) / 2 + 40, L.roadY + 10, 1, P.cWater, true);
    if (st.cooling === 'evaporative') add('plume', tr(T.plume, lang), L.toWorld(rects[0].x + 12, 0)[0], topY - 40 * p.s - 20 * G.S.w, 2, P.cWater);
    // an expansion hall being built beside the running ones
    const bi = buildingHall(hallProgress(st, L));
    if (st.hallStates && bi >= 0) {
      const r = rects[bi];
      const [ex, ey] = L.toWorld(r.x + r.w * 0.5, -r.h - dy - 2);
      add('expansion', tr(T.expansion, lang), ex, ey, 2, P.crane);
    }
    // homes lit by the data centre's heat (winter): pointed at a lit home that is in view (phones crop the town).
    // On a phone-sized scene it takes the place of "Nearest homes" (the distance marker still starts at that home),
    // so the two labels do not pile up over the few houses in view.
    if (plan.warmOn && winterGlow(G.S) > 0.5) {
      const a = warmHomeAnchor(plan);
      if (a) {
        add('heatHomes', tr(T.heatHomes, lang), a.x, a.y, 2, P.cHeat);
        const i = L.narrow ? lab.findIndex((l) => l.id === 'homes') : -1;
        if (i >= 0) lab.splice(i, 1);
      }
    }
    // the yearly generator test run: labelled while the puff is visible
    if (G.genPuff > 0.02 && hlTarget !== 'gens') {
      const gs = generatorStacks(L).map((s) => L.toWorld(s.x, s.y));
      if (gs.length) add('genTest', tr(T.genTest, lang), gs.reduce((a, g) => a + g[0], 0) / gs.length, Math.min(...gs.map((g) => g[1])) - 10, 4, P.cSafety);
    }
  }

  // event moments
  const ek = st.eventKey;
  if (PUBLIC_EVENTS.includes(ek)) {
    const nb = noticeBoardSpot(L, plan);
    add('event', tr(T.publicEvent, lang), nb.x, nb.top, 4, P.accent);
  } else if (ek === 'refresh' && st.phase === 'operation') {
    const c = crateSpot(L, st);
    const [cx, cy] = L.toWorld(c.x - 1, -10);
    add('event', tr(T.refresh, lang), cx, cy, 4, P.cFuture);
  } else if (ek === 'endOfLife') {
    lab.push({
      id: 'fork', fork: true, text: tr(T.endOfLife, lang), renew: tr(T.renew, lang), dismantle: tr(T.dismantle, lang),
      x: lerp(plan.homeRight, L.plot.x, 0.62), y: L.yB - 2, prio: 4, hue: P.cFuture,
    });
  }

  // highlight label (always shown, strongest)
  if (hlTarget && R[hlTarget]) {
    const b = R[hlTarget];
    const map = {
      power: T.power, heat: st.heatReuse && st.phase === 'operation' ? T.pipe : st.heatAssumed ? T.heatAirAssumed : T.heatAir, water: st.cooling === 'evaporative' ? T.waterMain : T.lowWater,
      noise: T.noise, site: T.construction, workers: T.workers, staff: T.staff, hall: T.dc, road: T.trucks, land: T.land, gens: G.genPuff > 0 ? T.genTest : T.gens,
    };
    const hueMap = { power: P.cEnergy, heat: P.cHeat, water: P.cWater, noise: P.ink2, site: P.cFuture, workers: P.cJobs, staff: P.cJobs, hall: P.accent, road: P.cTraffic, land: P.cLand, gens: P.cSafety };
    const text = tr(map[hlTarget], lang);
    // drop a normal label with the same text, the highlight label replaces it
    for (let i = lab.length - 1; i >= 0; i--) if (lab[i].text === text || lab[i].text.startsWith(text)) lab.splice(i, 1);
    const hx = hlTarget === 'road' ? clamp(L.gateX - 70, L.view.x0 + 40, L.view.x1 - 40) : hlTarget === 'water' && st.cooling === 'evaporative' ? (L.view.x0 + L.gateX) / 2 : (b.x0 + b.x1) / 2;
    const hy = hlTarget === 'road' ? b.y0 : hlTarget === 'water' && st.cooling === 'evaporative' ? L.roadY + 10 : b.y0 - 2;
    lab.push({ id: 'hl', text, x: hx, y: hy, prio: 5, hue: hueMap[hlTarget] || P.accent, strong: true, below: hlTarget === 'water' && st.cooling === 'evaporative' });
  }
  return lab;
}

/**
 * The 'endOfLife' signpost, in screen pixels: a wooden post from the ground up to a title plate, with two arrow
 * boards pointing different ways ("Renew?" → / ← "Dismantle?"). Both boards look the same: no answer is favoured.
 */
function forkSize(ctx, P, l, fs) {
  ctx.font = `700 ${fs}px ${P.fontBody}`;
  const tTitle = ctx.measureText(l.text).width;
  ctx.font = `600 ${fs}px ${P.fontBody}`;
  const t1 = ctx.measureText(l.renew).width, t2 = ctx.measureText(l.dismantle).width;
  const ph = Math.round(fs + 8), tip = Math.round(ph * 0.45);
  const titleW = tTitle + 20, titleH = fs + 9;
  const w1 = t1 + 14 + tip, w2 = t2 + 14 + tip;
  const left = Math.max(titleW / 2, w2 - 6), right = Math.max(titleW / 2, w1 - 6);
  return { tTitle, t1, t2, ph, tip, titleW, titleH, w1, w2, left, right, h: titleH + 5 + ph + 4 + ph };
}

/** The signpost's wooden post (drawn with the leader lines, under every label box). */
function drawForkPost(ctx, P, d) {
  const { x, y, m } = d;
  const px = x + m.left;
  const wood = mix(P.field, P.houseRed, 0.3);
  ctx.fillStyle = css(mix(wood, P.ink, P.dark ? 0 : 0.15));
  ctx.fillRect(px - 2, y + m.titleH / 2, 4, Math.max(0, d.ay - (y + m.titleH / 2)));
}

function drawFork(ctx, P, d, fs) {
  const { l, x, y, m } = d;
  const px = x + m.left;                       // the post
  // title plate (strong label style)
  const tx0 = px - m.titleW / 2;
  ctx.fillStyle = css(mix(P.surface, l.hue, 0.12), 0.96);
  rrect(ctx, tx0, y, m.titleW, m.titleH, m.titleH / 2); ctx.fill();
  ctx.strokeStyle = css(l.hue); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = css(l.hue);
  ctx.beginPath(); ctx.arc(tx0 + 9, y + m.titleH / 2, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = css(P.ink);
  ctx.font = `700 ${fs}px ${P.fontBody}`;
  ctx.fillText(l.text, tx0 + 15, y + m.titleH / 2 + 0.5);
  // two arrow boards
  const board = (x0, yb, w, toRight, text) => {
    const h = m.ph, tip = m.tip;
    ctx.beginPath();
    if (toRight) {
      ctx.moveTo(x0, yb); ctx.lineTo(x0 + w - tip, yb); ctx.lineTo(x0 + w, yb + h / 2); ctx.lineTo(x0 + w - tip, yb + h); ctx.lineTo(x0, yb + h);
    } else {
      ctx.moveTo(x0 + w, yb); ctx.lineTo(x0 + tip, yb); ctx.lineTo(x0, yb + h / 2); ctx.lineTo(x0 + tip, yb + h); ctx.lineTo(x0 + w, yb + h);
    }
    ctx.closePath();
    ctx.fillStyle = css(P.surface, 0.97); ctx.fill();
    ctx.strokeStyle = css(P.lineStrong); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = css(P.ink);
    ctx.font = `600 ${fs}px ${P.fontBody}`;
    ctx.fillText(text, toRight ? x0 + 7 : x0 + tip + 7, yb + h / 2 + 0.5);
  };
  const y1 = y + m.titleH + 5, y2 = y1 + m.ph + 4;
  board(px - 6, y1, m.w1, true, l.renew);
  board(px + 6 - m.w2, y2, m.w2, false, l.dismantle);
}

/**
 * Lay out and draw labels in screen pixels (crisp text at any scale). opts.avoid: screen boxes to keep clear (chip,
 * counters). opts.compact (a stage under 600 px): at most two labels (the distance tag competes for a place, just under
 * the event moments), none on top of the data-centre building; l.alpha (0..1) fades a label (event moments).
 */
export function drawLabels(ctx, G, labels, distLabel, opts = {}) {
  const { L, P, st } = G;
  const k = L.k;
  const compact = !!opts.compact;
  const maxN = compact ? 2 : Infinity;
  let shown = 0;
  const sc = st.presentation ? (L.narrow ? 1.2 : 1.4) : 1;   // projector: ×1.4 (a phone-sized scene: ×1.2)
  const fs = Math.round((L.narrow ? 11 : 12) * sc);
  const minPrio = L.narrow || st.presentation ? 2 : 1;
  const placed = [];
  const Wpx = (L.view.x1 - L.view.x0) * k;
  const Hpx = L.Hw * k;
  const list = labels.filter((l) => l.prio >= minPrio && !(l.alpha != null && l.alpha <= 0.02)).sort((a, b) => b.prio - a.prio);
  ctx.textBaseline = 'middle';
  const draw = [];
  const hits = (x, y, w, h) => placed.find((q) => x < q.x + q.w + 4 && x + w + 4 > q.x && y < q.y + q.h + 3 && y + h + 3 > q.y);
  let distBox = null;
  if (distLabel) {
    ctx.font = `600 ${fs}px ${P.fontBody}`;
    const tw = ctx.measureText(distLabel.text).width;
    const w = tw + 12, h = fs + 7;
    const x = clamp((distLabel.x - L.view.x0) * k - w / 2, 4, Wpx - w - 4), y = distLabel.y * k - h / 2;
    distBox = { l: { text: distLabel.text, dist: true }, x, y, w, h, tw };
    if (!compact) placed.push(distBox);
  }
  // keep clear of the chip + counters (top-left) and the "not to scale" note in the bottom-right corner
  for (const b of opts.avoid || []) if (b && b.w > 0 && b.h > 0) placed.push({ ...b, hud: true });
  const noteBox = { x: Wpx - (L.narrow ? 150 : 175), y: Hpx - 22, w: 175, h: 22 };
  placed.push(noteBox);
  // narrow stage: the building stays uncovered (labels go above it or are left out)
  const hb = compact && G.R && G.R.hall;
  const hallBox = hb ? { x: (hb.x0 - L.view.x0) * k, y: hb.y0 * k, w: (hb.x1 - hb.x0) * k, h: (hb.y1 - hb.y0) * k, hall: true } : null;
  if (hallBox) placed.push(hallBox);
  const queue = compact && distBox ? [...list, { distEntry: true, prio: 3.5 }].sort((a, b) => b.prio - a.prio) : list;
  let distShown = !compact && !!distBox;
  for (const l of queue) {
    if (shown >= maxN) break;
    if (l.distEntry) {
      if (!hits(distBox.x, distBox.y, distBox.w, distBox.h)) { placed.push(distBox); distShown = true; shown++; }
      continue;
    }
    const ax = (l.x - L.view.x0) * k, ay = l.y * k;
    if (l.fork) {
      // the signpost stands on its anchor; only its height adapts (the post gets longer)
      const m = forkSize(ctx, P, l, fs);
      const w = m.left + m.right;
      const x = clamp(ax - m.left, 4, Wpx - w - 4);
      let y = ay - 14 - m.h;
      for (let tries = 0; tries < 6; tries++) {
        y = clamp(y, 4, Hpx - m.h - 4);
        const hit = hits(x, y, w, m.h);
        if (!hit) break;
        y = hit.y - m.h - 4;
      }
      placed.push({ x, y, w, h: m.h });
      draw.push({ l, x, y, w, h: m.h, ax, ay, m });
      shown++;
      continue;
    }
    ctx.font = `${l.strong ? 700 : 600} ${fs}px ${P.fontBody}`;
    const tw = ctx.measureText(l.text).width;
    const w = tw + (l.hue ? 20 : 12), h = fs + 9;
    const cx = (v) => clamp(v, 4, Wpx - w - 4), cy = (v) => clamp(v, 4, Hpx - h - 4);
    let x = cx(ax - w / 2);
    let y = l.below ? ay + 4 : ay - h - 6;
    let ok = false;
    let underHud = false;
    for (let tries = 0; tries < 6; tries++) {
      y = cy(y);
      const hit = hits(x, y, w, h);
      if (!hit) { ok = true; break; }
      // a minor label whose place is taken by the chip or the counters is left out, not moved far from its anchor
      if (hit.hud && l.prio < 3) { underHud = true; break; }
      y = l.below ? hit.y + hit.h + 3 : hit.y - h - 3;
      if (tries === 3) { x = cx(hit.x + hit.w + 6); y = l.below ? ay + 4 : ay - h - 6; }
    }
    if (underHud) continue;
    if (!ok && l.below) {
      // no room below: try above the anchor instead
      x = cx(ax - w / 2);
      y = cy(ay - h - 6);
      ok = !hits(x, y, w, h);
      l.below = false;
    }
    if (!ok && l.prio < 3) continue;
    if (!ok) {
      // an important label: take the free spot nearest to its anchor (beside or below whatever is in the way);
      // if there is none, at least keep clear of the chip, the counters and the note
      const cands = [[cx(ax - w / 2), cy(ay - h - 6)], [cx(ax - w / 2), cy(ay + 6)]];
      for (const q of placed) {
        cands.push([cx(ax - w / 2), cy(q.y + q.h + 4)], [cx(q.x + q.w + 6), cy(ay - h - 6)], [cx(q.x - w - 6), cy(ay - h - 6)],
          [cx(q.x + q.w + 6), cy(q.y)], [cx(q.x + q.w + 6), cy(ay + 6)]);
      }
      const dist = ([px, py]) => Math.hypot(px + w / 2 - ax, py + h / 2 - ay);
      cands.sort((a, b) => dist(a) - dist(b));
      const avoid = [...(opts.avoid || []), noteBox].filter(Boolean);
      const clearOfAvoid = (px, py) => !avoid.some((q) => px < q.x + q.w + 4 && px + w + 4 > q.x && py < q.y + q.h + 3 && py + h + 3 > q.y);
      // (a narrow stage leaves it out rather than cover the building or another label)
      const best = cands.find(([px, py]) => !hits(px, py, w, h)) || (compact ? null : cands.find(([px, py]) => clearOfAvoid(px, py)) || cands[0]);
      if (!best) continue;
      [x, y] = best;
    }
    placed.push({ x, y, w, h });
    draw.push({ l, x, y, w, h, ax, ay, tw });
    shown++;
  }
  if (distBox && distShown) draw.unshift(distBox);
  // leader lines (and the signpost's post) first, so no line crosses a label box
  for (const d of draw) {
    const { l, x, y, w, h } = d;
    ctx.globalAlpha = l.alpha == null ? 1 : clamp(l.alpha, 0, 1);
    if (l.fork) { drawForkPost(ctx, P, d); continue; }
    if (l.dist) continue;
    ctx.strokeStyle = css(P.ink, 0.45);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lx = clamp(d.ax, x + 6, x + w - 6);
    if (l.below) { ctx.moveTo(lx, y); ctx.lineTo(d.ax, d.ay); }
    else { ctx.moveTo(lx, y + h); ctx.lineTo(d.ax, Math.max(y + h, d.ay - 2)); }
    ctx.stroke();
  }
  for (const d of draw) {
    const { l, x, y, w, h } = d;
    ctx.globalAlpha = l.alpha == null ? 1 : clamp(l.alpha, 0, 1);
    if (l.fork) { drawFork(ctx, P, d, fs); continue; }
    ctx.fillStyle = css(l.strong ? mix(P.surface, l.hue, 0.12) : P.surface, l.dist ? 0.85 : 0.94);
    rrect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = css(l.strong ? l.hue : P.lineStrong, l.strong ? 1 : 0.9);
    ctx.lineWidth = l.strong ? 1.5 : 1;
    ctx.stroke();
    let tx = x + 6;
    if (l.hue) {
      ctx.fillStyle = css(l.hue);
      ctx.beginPath(); ctx.arc(x + 9, y + h / 2, 3.2, 0, Math.PI * 2); ctx.fill();
      tx = x + 15;
    }
    ctx.fillStyle = css(P.ink);
    ctx.font = `${l.strong ? 700 : 600} ${fs}px ${P.fontBody}`;
    ctx.fillText(l.text, tx, y + h / 2 + 0.5);
  }
  ctx.globalAlpha = 1;
}

export function distanceLabel(G) {
  const { L, st, plan } = G;
  const x0 = plan.homeRight, x1 = L.plot.x;
  if (x1 - x0 < 8) return null;
  return { text: distanceText(st.distanceM, st.lang), x: (x0 + x1) / 2, y: L.yB + 10 };
}
