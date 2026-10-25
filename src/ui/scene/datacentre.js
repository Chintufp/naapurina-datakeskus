// Layer 4+5: the plot and the data centre, in the plot's own local units (ground line y = 0, up is negative).
// Planning: survey stakes + zoning sign. Construction: earthworks, steel frame, crane, site huts.
// Operation: hall(s) with rooftop coolers (spinning fans), cooling towers + vapour plume if evaporative,
// backup generators, substation, heat pump unit if the waste heat goes to district heating.
// When the caller gives hallStates (0 not started, 0..1 building, 1 done), each hall follows its own state, also
// during operation: an expansion gets an earth patch, a steel frame, site huts and a crane; an unbuilt hall is an empty pad.
import { css, mix } from './colors.js';
import { clamp, fract, lerp, poly, rrect, circle, rng, smooth } from './util.js';
import * as M from '../../model/coefficients.js';

export const geo = (p) => ({ dx: p.depth * 0.6, dy: p.depth * 0.45 });

/** Build progress of each hall (giant sites are built in stages). Explicit hallStates win over the phase. */
export function hallProgress(st, L) {
  const n = L.plot.halls;
  const given = st.hallStates;
  const out = [];
  for (let i = 0; i < n; i++) {
    if (given) out.push(i < given.length ? clamp(given[i], 0, 1) : 0);
    else if (st.phase === 'operation') out.push(1);
    else if (st.phase === 'planning') out.push(0);
    else {
      const stagger = n > 1 ? 0.16 : 0;
      out.push(clamp((st.phaseProgress - i * stagger) / (1 - (n - 1) * stagger), 0, 1));
    }
  }
  return out;
}

/** Index of the first hall that is being built (0 < progress < 1), or -1. */
export function buildingHall(progs) {
  return progs.findIndex((v) => v > 0 && v < 1);
}

// The car park reacts to the people on site, at one fixed scale: one car per 10 people. Builders' cars fill it at
// the construction peak (it is sized for the model's typical peak workforce per MW), and in operation only the
// staff's cars are left.
const PER_CAR = 10;
const PEAK_PER_MW = M.COEF?.['jobs.constructionPerMW']?.typ || 1.5;
// car park in front of the plot, right of the gate (local units); two rows of bays
const PARK = { x: 22, y: 1.2, bay: 6.6, row: 4.6 };

/** Columns of bays: enough for the typical construction peak, within the front of the plot. */
export function carParkCols(L, st) {
  const maxCols = Math.max(3, Math.floor((L.plot.plotW * 0.92 - PARK.x) / PARK.bay));
  return clamp(Math.ceil((st.sizeMW * PEAK_PER_MW) / PER_CAR / 2), 3, maxCols);
}

/** Cars in the car park now: builders during construction, staff in operation; null when the caller gave neither. */
export function carCount(st) {
  if (st.phase === 'construction') return st.workers > 0 ? Math.ceil(st.workers / PER_CAR) : null;
  if (st.phase === 'operation') return st.staff == null ? null : Math.ceil(st.staff / PER_CAR);
  return null;
}

export function carParkBox(L, st) {
  const cols = L && st ? carParkCols(L, st) : 6;
  return { x0: PARK.x - 1, x1: PARK.x - 1 + cols * PARK.bay + 2, y0: PARK.y, y1: PARK.y + 2 * PARK.row + 1.6 };
}

/** Where old equipment waits for the truck during an equipment refresh: by the loading door of the first finished hall. */
export function crateSpot(L, st) {
  const progs = hallProgress(st, L);
  const rects = hallRects(L);
  const i = Math.max(0, progs.findIndex((v) => v >= 1));
  const r = rects[i];
  return { x: r.x + r.w * 0.76, y: 0 };
}

export function hallRects(L) {
  const p = L.plot;
  const rects = [];
  for (let i = 0; i < p.halls; i++) rects.push({ x: p.hallX + i * (p.hallW + p.gap), w: p.hallW, h: p.hallH });
  return rects;
}

/** Fan / cooler / tower positions on the roofs (local units); each spot knows its hall. */
export function roofSpots(L, st) {
  const p = L.plot;
  const { dx, dy } = geo(p);
  const fans = [], towers = [];
  hallRects(L).forEach((r, hallI) => {
    const evap = st.cooling === 'evaporative';
    const step = st.cooling === 'liquid' ? 15 : 10.5;
    const cols = Math.max(1, Math.floor((r.w - (evap ? 14 : 4)) / step));
    const rows = st.cooling === 'liquid' ? 1 : 2;
    for (let row = 0; row < rows; row++) {
      const v = rows === 1 ? 0.5 : 0.3 + row * 0.42;
      for (let c = 0; c < cols; c++) {
        const u = (c + 0.5) / cols;
        const x = r.x + (evap ? 12 : 2) + u * (r.w - (evap ? 14 : 4)) + v * dx;
        const y = -r.h - v * dy;
        fans.push({ x, y, row, big: st.cooling === 'liquid', hall: hallI });
      }
    }
    if (evap) {
      towers.push({ x: r.x + 3 + 0.3 * dx, y: -r.h - 0.3 * dy, hall: hallI });
      if (r.w > 50) towers.push({ x: r.x + 3 + 0.75 * dx, y: -r.h - 0.75 * dy, back: true, hall: hallI });
    }
  });
  return { fans, towers };
}

/**
 * The coolers that exist right now: all of them in operation, a growing share while the last hall is fitted out.
 * With explicit hallStates each hall gets its own coolers once it is nearly finished (> 0.92).
 */
export function visibleRoofSpots(L, st, progs = hallProgress(st, L)) {
  const spots = roofSpots(L, st);
  if (st.phase === 'planning') return { fans: [], towers: [] };
  if (!st.hallStates) {
    if (st.phase === 'operation') return spots;
    const last = progs[progs.length - 1];
    if (!(last > 0.92)) return { fans: [], towers: [] };
    const k = smooth(0.92, 1, last);
    return { fans: spots.fans.slice(0, Math.round(spots.fans.length * k)), towers: spots.towers.slice(0, Math.round(spots.towers.length * k)) };
  }
  const keep = (list) => {
    const out = [];
    progs.forEach((v, i) => {
      if (!(v > 0.92)) return;
      const mine = list.filter((s) => s.hall === i);
      out.push(...mine.slice(0, Math.round(mine.length * smooth(0.92, 1, v))));
    });
    return out;
  };
  return { fans: keep(spots.fans), towers: keep(spots.towers) };
}

function hall(ctx, P, S, r, depth, prog, st, hasReuse, building = false) {
  const { x, w, h } = r;
  const dx = depth * 0.6, dy = depth * 0.45;
  if (prog <= 0) return;
  if (prog > 0.62) {
    ctx.fillStyle = css(P.ink, 0.12 * smooth(0.62, 0.9, prog));
    poly(ctx, [x - 1, 1.5, x + w + 6, 1.5, x + w + dx + 8, -dy + 1, x + dx, -dy]);
    ctx.fill();
  }
  // foundation slab (a hall marked as being built always shows its slab and a first steel frame)
  const slab = building ? Math.max(0.7, smooth(0.08, 0.22, prog)) : smooth(0.08, 0.22, prog);
  if (slab > 0) {
    ctx.fillStyle = css(mix(P.building, P.houseWhite, 0.45), slab);
    poly(ctx, [x - 2, 1, x + w + 2, 1, x + w + dx + 2, -dy - 1, x + dx - 2, -dy - 1]);
    ctx.fill();
  }
  const frame = building ? Math.max(0.3, smooth(0.22, 0.62, prog)) : smooth(0.22, 0.62, prog);
  const clad = smooth(0.62, 0.92, prog);
  if (frame > 0 && clad < 1) {
    // steel frame: columns rising, then beams
    const fh = h * frame;
    ctx.strokeStyle = css(P.steel);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cols = Math.max(3, Math.round(w / 9));
    for (let c = 0; c <= cols; c++) {
      const cx = x + (c / cols) * w;
      ctx.moveTo(cx, 0); ctx.lineTo(cx, -fh);
      ctx.moveTo(cx + dx, -dy); ctx.lineTo(cx + dx, -dy - fh);
    }
    if (frame > 0.5) {
      ctx.moveTo(x, -fh); ctx.lineTo(x + w, -fh);
      ctx.moveTo(x + dx, -dy - fh); ctx.lineTo(x + w + dx, -dy - fh);
      for (let c = 0; c <= cols; c += 2) { const cx = x + (c / cols) * w; ctx.moveTo(cx, -fh); ctx.lineTo(cx + dx, -dy - fh); }
      ctx.moveTo(x, -fh * 0.5); ctx.lineTo(x + w, -fh * 0.5);
    }
    ctx.stroke();
  }
  if (clad > 0) {
    const cw = w * clad;
    // side + top only once fully clad
    if (clad > 0.98) {
      ctx.fillStyle = css(P.hallSide);
      poly(ctx, [x + w, 0, x + w, -h, x + w + dx, -h - dy, x + w + dx, -dy]); ctx.fill();
    }
    ctx.fillStyle = css(P.hallTop);
    poly(ctx, [x, -h, x + dx, -h - dy, x + cw + dx, -h - dy, x + cw, -h]); ctx.fill();
    if (S.snow > 0.05) {
      ctx.fillStyle = css(P.snow, S.snow * 0.9);
      poly(ctx, [x, -h, x + dx, -h - dy, x + cw + dx, -h - dy, x + cw, -h]); ctx.fill();
    }
    // front facade with vertical ribs
    ctx.fillStyle = css(P.hallWall);
    ctx.fillRect(x, -h, cw, h);
    ctx.strokeStyle = css(P.ink, 0.07);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let xx = x + 3; xx < x + cw; xx += 3) { ctx.moveTo(xx, -h); ctx.lineTo(xx, -1.5); }
    ctx.stroke();
    ctx.fillStyle = css(mix(P.hallWall, P.ink, 0.28));
    ctx.fillRect(x, -1.8, cw, 1.8);
    ctx.fillRect(x, -h, cw, 1.2);
    if (clad > 0.98) {
      // loading door + entrance
      ctx.fillStyle = css(mix(P.hallWall, P.ink, 0.35));
      ctx.fillRect(x + w * 0.7, -h * 0.45, w * 0.12, h * 0.45);
      ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, P.dark ? 0.8 : 0));
      ctx.fillRect(x + 4, -h * 0.4, 4, h * 0.4);
      // a thin accent band (no logo)
      ctx.fillStyle = css(mix(P.hallWall, P.accent, 0.45));
      ctx.fillRect(x, -h * 0.72, w, 0.9);
    }
  }
}

function coolerBoxes(ctx, P, S, L, st, spots, progs) {
  for (const f of spots.fans) {
    const bw = f.big ? 11 : 8, bh = f.big ? 3.4 : 2.6;
    ctx.fillStyle = css(mix(P.building, P.ink, 0.15));
    ctx.fillRect(f.x - bw / 2, f.y - bh, bw, bh);
    ctx.fillStyle = css(mix(P.building, P.houseWhite, 0.15));
    poly(ctx, [f.x - bw / 2, f.y - bh, f.x - bw / 2 + 1.8, f.y - bh - 1.4, f.x + bw / 2 + 1.8, f.y - bh - 1.4, f.x + bw / 2, f.y - bh]);
    ctx.fill();
  }
  for (const tw of spots.towers) {
    const x = tw.x, y = tw.y;
    ctx.fillStyle = css(mix(P.hallWall, P.building, 0.35));
    ctx.fillRect(x, y - 8, 10, 8);
    ctx.fillStyle = css(mix(P.building, P.ink, 0.3));
    ctx.fillRect(x + 1, y - 6, 8, 1);
    ctx.fillRect(x + 1, y - 4, 8, 1);
    ctx.fillStyle = css(mix(P.hallWall, P.building, 0.15));
    poly(ctx, [x, y - 8, x + 2, y - 10, x + 12, y - 10, x + 10, y - 8]); ctx.fill();
    ctx.fillStyle = css(P.ink, 0.5);
    ctx.beginPath(); ctx.ellipse(x + 6, y - 9, 3.4, 0.9, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (st.cooling === 'liquid') {
    // liquid loop pipes along the side wall (on halls that are finished or nearly so)
    hallRects(L).forEach((r, i) => {
      if (!(progs[i] > 0.92)) return;
      ctx.strokeStyle = css(mix(P.cWater, P.building, 0.35));
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + 2, -r.h * 0.3); ctx.lineTo(r.x + r.w - 2, -r.h * 0.3);
      ctx.moveTo(r.x + 2, -r.h * 0.22); ctx.lineTo(r.x + r.w - 2, -r.h * 0.22);
      ctx.stroke();
    });
  }
}

/** A reserved place for a later hall: a levelled gravel pad with a dashed outline and corner stakes. */
function emptyPad(ctx, P, S, r, depth) {
  const { x, w } = r;
  const dx = depth * 0.6, dy = depth * 0.45;
  const pts = [x - 1, 1, x + w + 1, 1, x + w + dx + 1, -dy, x + dx - 1, -dy];
  ctx.fillStyle = css(mix(mix(P.asphalt, P.houseWhite, 0.55), P.snow, S.snow * 0.6));
  poly(ctx, pts); ctx.fill();
  ctx.strokeStyle = css(P.ink, P.dark ? 0.45 : 0.35);
  ctx.lineWidth = 0.6;
  ctx.setLineDash([2.5, 2]);
  poly(ctx, pts); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 4; i++) {
    const sx = pts[i * 2], sy = pts[i * 2 + 1];
    ctx.fillStyle = css(mix(P.field, P.houseRed, 0.3));
    ctx.fillRect(sx - 0.4, sy - 4, 0.8, 4);
    ctx.fillStyle = css(P.heat);
    ctx.fillRect(sx - 0.6, sy - 4, 1.2, 1.2);
  }
}

/** Earthworks under a hall that is being built while the rest of the site is already running. */
function sitePatch(ctx, P, S, r, depth) {
  const { x, w } = r;
  const dx = depth * 0.6, dy = depth * 0.45;
  ctx.fillStyle = css(mix(P.earth, P.snow, S.snow * 0.45));
  poly(ctx, [x - 3, 1.5, x + w + 3, 1.5, x + w + dx + 3, -dy - 1.5, x + dx - 3, -dy - 1.5]);
  ctx.fill();
  // a dirt pile behind the hall
  const px = x + w * 0.8 + dx * 0.6, py = -dy * 0.75;
  ctx.fillStyle = css(mix(P.earth, P.ink, 0.15));
  ctx.beginPath(); ctx.ellipse(px, py, 6, 3.4, 0, Math.PI, 0); ctx.fill();
  if (S.snow > 0.3) { ctx.fillStyle = css(P.snow, S.snow * 0.8); ctx.beginPath(); ctx.ellipse(px, py - 2, 3.4, 1.4, 0, Math.PI, 0); ctx.fill(); }
}

/**
 * Car park in front of the plot: two rows of bays and n cars (one per 10 people). Gravel while the site is being
 * built, asphalt later. More cars than bays (a busy construction peak) park in a line along the verge.
 */
function carPark(ctx, P, S, n, cols, gravel) {
  const b = { x0: PARK.x - 1, x1: PARK.x - 1 + cols * PARK.bay + 2, y0: PARK.y, y1: PARK.y + 2 * PARK.row + 1.6 };
  const surface = gravel ? mix(P.earth, P.asphalt, 0.35) : mix(P.asphalt, P.houseWhite, 0.2);
  ctx.fillStyle = css(mix(surface, P.snow, S.snow * 0.45));
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  // bay lines
  ctx.strokeStyle = css(P.roadLine, P.dark ? 0.5 : gravel ? 0.6 : 0.85);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let row = 0; row < 2; row++) {
    const y0 = PARK.y + 0.4 + row * PARK.row, y1 = y0 + PARK.row - 0.8;
    for (let c = 0; c <= cols; c++) {
      const x = PARK.x + c * PARK.bay;
      ctx.moveTo(x, y0); ctx.lineTo(x, y1);
    }
  }
  ctx.stroke();
  // car colours that stand out from the asphalt in both themes (so the cars can be counted)
  const cc = [P.accent, P.houseWhite, P.houseRed, P.roofDark, P.cWater, P.yellowHouse];
  const bays = cols * 2;
  const extra = Math.min(Math.max(0, n - bays), 8);
  for (let i = 0; i < Math.min(n, bays) + extra; i++) {
    const over = i >= bays;
    const row = over ? 1 : Math.floor(i / cols), col = over ? cols + 0.3 + (i - bays) * 1.05 : i % cols;
    const x = PARK.x + col * PARK.bay + 0.55, y = PARK.y + (row + 1) * PARK.row - 0.6 + (over ? 1.2 : 0);
    const c = mix(cc[(i * 5 + row) % cc.length], P.building, 0.2);
    ctx.fillStyle = css(c);
    rrect(ctx, x, y - 2.4, 5.5, 2.4, 0.8); ctx.fill();
    ctx.fillRect(x + 1.2, y - 3.6, 3, 1.4);
    ctx.fillStyle = css(mix(P.glassDay, P.ink, 0.15));
    ctx.fillRect(x + 1.5, y - 3.3, 1.1, 0.9);
    ctx.fillRect(x + 2.9, y - 3.3, 1.1, 0.9);
    if (S.snow > 0.4) { ctx.fillStyle = css(P.snow, S.snow * 0.9); ctx.fillRect(x + 1.2, y - 3.9, 3, 0.5); }
  }
}

function generators(ctx, P, S, L) {
  const p = L.plot;
  const n = p.gensN;
  const perRow = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const row = i < perRow ? 1 : 0; // back row first
    const col = i % perRow;
    const x = p.gensX + col * 4 + row * 3, y = -row * 5;
    ctx.fillStyle = css(mix(P.building, P.houseWhite, row ? 0.05 : 0.2));
    ctx.fillRect(x, y - 5, 8, 5);
    ctx.fillStyle = css(P.ink, 0.25);
    ctx.fillRect(x + 1, y - 3.6, 5, 0.6);
    ctx.fillStyle = css(mix(P.building, P.ink, 0.35));
    ctx.fillRect(x + 6, y - 9, 1.2, 4);
    if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x, y - 5.8, 8, 0.9); }
  }
  // fuel tank
  ctx.fillStyle = css(mix(P.houseWhite, P.building, 0.25));
  rrect(ctx, p.gensX + perRow * 4 + 6, -4.5, 9, 4.5, 2.2); ctx.fill();
}

export function generatorStacks(L) {
  const p = L.plot;
  const perRow = Math.ceil(p.gensN / 2);
  const out = [];
  for (let i = 0; i < p.gensN; i++) {
    const row = i < perRow ? 1 : 0, col = i % perRow;
    out.push({ x: p.gensX + col * 4 + row * 3 + 6.6, y: -row * 5 - 9 });
  }
  return out;
}

export function gantryTop(L) {
  const p = L.plot;
  return { x: p.subX + p.subW - 6, y: -20 };
}

function substation(ctx, P, S, L, built) {
  const p = L.plot;
  const x = p.subX, w = p.subW;
  ctx.fillStyle = css(mix(P.asphalt, P.houseWhite, 0.45), 0.6 + 0.4 * built);
  poly(ctx, [x, 2, x + w, 2, x + w + 6, -8, x + 6, -8]); ctx.fill();
  if (built < 0.3) return;
  // transformers
  for (let i = 0; i < 2; i++) {
    const tx = x + 4 + i * 9, ty = -2 - i * 2;
    ctx.fillStyle = css(mix(P.building, P.cEnergy, 0.15));
    ctx.fillRect(tx, ty - 6, 7, 6);
    ctx.strokeStyle = css(P.ink, 0.25);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (let k = 1; k < 7; k += 1.4) { ctx.moveTo(tx + k, ty - 6); ctx.lineTo(tx + k, ty); }
    ctx.stroke();
    ctx.fillStyle = css(P.steel);
    ctx.fillRect(tx + 1.5, ty - 8.5, 0.8, 2.5);
    ctx.fillRect(tx + 4.5, ty - 8.5, 0.8, 2.5);
  }
  // gantry where the line lands
  const g = gantryTop(L);
  ctx.strokeStyle = css(P.steel);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(g.x - 5, -4); ctx.lineTo(g.x - 5, g.y);
  ctx.moveTo(g.x + 5, -4); ctx.lineTo(g.x + 5, g.y);
  ctx.moveTo(g.x - 6, g.y); ctx.lineTo(g.x + 6, g.y);
  ctx.stroke();
  // fence
  ctx.strokeStyle = css(P.ink, 0.2);
  ctx.lineWidth = 0.4;
  ctx.strokeRect(x - 0.5, -9, w + 7, 11);
}

function fence(ctx, P, L, kind) {
  const p = L.plot;
  const x0 = -4, x1 = p.plotW;
  const gate0 = 1, gate1 = 12;
  if (kind === 'site') {
    // construction-site mesh fence panels
    ctx.fillStyle = css(P.steel, 0.18);
    ctx.fillRect(gate1, -3.5, x1 - gate1, 3.5);
    ctx.fillRect(x0, -3.5, gate0 - x0, 3.5);
  }
  ctx.strokeStyle = css(P.ink, kind === 'site' ? 0.35 : 0.28);
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (const [a, b] of [[x0, gate0], [gate1, x1]]) {
    ctx.moveTo(a, -3.5); ctx.lineTo(b, -3.5);
    ctx.moveTo(a, -0.8); ctx.lineTo(b, -0.8);
    for (let x = a; x <= b; x += 5) { ctx.moveTo(x, 0); ctx.lineTo(x, -3.8); }
  }
  ctx.stroke();
}

function plotOutline(L) {
  const p = L.plot;
  const { dx, dy } = geo(p);
  const top = dy + 8;
  return [-4, 3, p.plotW, 3, p.plotW + dx, -top, -4 + dx, -top];
}

function planningMarks(ctx, P, S, L, st) {
  const pts = plotOutline(L);
  // dashed outline + survey stakes
  ctx.strokeStyle = css(P.heat, 0.75);
  ctx.lineWidth = 0.7;
  ctx.setLineDash([3, 3]);
  poly(ctx, pts); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 4; i++) {
    const ax = pts[i * 2], ay = pts[i * 2 + 1];
    const bx = pts[((i + 1) % 4) * 2], by = pts[((i + 1) % 4) * 2 + 1];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 18));
    for (let k = 0; k < n; k++) {
      const x = lerp(ax, bx, k / n), y = lerp(ay, by, k / n);
      ctx.fillStyle = css(mix(P.field, P.houseRed, 0.3));
      ctx.fillRect(x - 0.4, y - 5, 0.8, 5);
      ctx.fillStyle = css(P.heat);
      ctx.fillRect(x - 0.6, y - 5, 1.2, 1.5);
    }
  }
  // the zoning sign at the front of the plot
  const sx = 2, sy = 2;
  ctx.fillStyle = css(mix(P.field, P.houseRed, 0.3));
  ctx.fillRect(sx + 2, sy - 13, 1, 13);
  ctx.fillRect(sx + 21, sy - 13, 1, 13);
  ctx.fillStyle = css(P.houseWhite);
  ctx.fillRect(sx, sy - 22, 24, 11);
  ctx.strokeStyle = css(P.accent);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(sx + 0.4, sy - 21.6, 23.2, 10.2);
  ctx.fillStyle = css(P.accent);
  ctx.fillRect(sx + 3, sy - 19.5, 18, 2.2);
  ctx.fillStyle = css(P.ink, 0.45);
  ctx.fillRect(sx + 3, sy - 16, 14, 0.8);
  ctx.fillRect(sx + 3, sy - 14.3, 16, 0.8);
  // a surveyor with a tripod
  const vx = L.plot.plotW * 0.55, vy = -3;
  ctx.strokeStyle = css(P.ink, 0.6);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(vx + 6, vy); ctx.lineTo(vx + 7.5, vy - 5); ctx.lineTo(vx + 9, vy);
  ctx.moveTo(vx + 7.5, vy - 5); ctx.lineTo(vx + 7.5, vy);
  ctx.stroke();
  ctx.fillStyle = css(P.ink, 0.7);
  ctx.fillRect(vx + 6.6, vy - 6.5, 2, 1.4);
  person(ctx, P, vx + 3.5, vy, true);
}

export function person(ctx, P, x, y, vest, col) {
  ctx.fillStyle = css(mix(P.ink, P.accent, 0.25));
  ctx.fillRect(x - 0.65, y - 2.2, 0.55, 2.2);
  ctx.fillRect(x + 0.1, y - 2.2, 0.55, 2.2);
  ctx.fillStyle = css(col || (vest ? P.hivis : P.accent));
  ctx.fillRect(x - 0.85, y - 4.6, 1.7, 2.6);
  ctx.fillStyle = css(mix(P.houseWhite, P.windowWarm, 0.35));
  circle(ctx, x, y - 5.4, 0.8); ctx.fill();
  if (vest) { ctx.fillStyle = css(P.houseWhite); ctx.fillRect(x - 0.9, y - 6.3, 1.8, 0.7); }
}

function siteHuts(ctx, P, S, x = -2) {
  // stacked site cabins (blue/white): at the front-left of the plot, or by the hall of an expansion
  const y = 0;
  const c = [mix(P.accent, P.houseWhite, 0.2), P.houseWhite];
  for (let i = 0; i < 3; i++) {
    const row = i === 2 ? 1 : 0;
    const xx = x + (i % 2) * 11 + (row ? 5 : 0), yy = y - row * 5;
    ctx.fillStyle = css(c[i % 2]);
    ctx.fillRect(xx - 10, yy - 5, 10, 5);
    ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, P.dark ? 0.7 : 0));
    ctx.fillRect(xx - 8, yy - 3.6, 2, 1.6);
    ctx.fillRect(xx - 4, yy - 3.6, 2, 1.6);
    if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(xx - 10, yy - 5.8, 10, 0.9); }
  }
}

/** Static part of the plot (cached). Called inside the plot transform. */
export function drawPlotStatic(ctx, L, P, S, st) {
  const p = L.plot;
  const { dy } = geo(p);
  const progs = hallProgress(st, L);
  const rects = hallRects(L);
  if (st.phase === 'planning') {
    planningMarks(ctx, P, S, L, st);
    return;
  }
  // ground of the plot
  const pts = plotOutline(L);
  const earth = mix(P.earth, P.snow, S.snow * (st.phase === 'construction' ? 0.45 : 0.2));
  const paved = mix(mix(P.asphalt, P.houseWhite, 0.35), P.snow, S.snow * 0.55);
  ctx.fillStyle = css(st.phase === 'construction' ? earth : paved);
  poly(ctx, pts); ctx.fill();

  if (st.phase === 'construction') {
    // dirt piles
    const r = rng(5);
    for (let i = 0; i < 3; i++) {
      const x = p.plotW * (0.55 + i * 0.13) + r() * 6, y = -dy * 0.55 - i;
      ctx.fillStyle = css(mix(P.earth, P.ink, 0.15 + i * 0.05));
      ctx.beginPath(); ctx.ellipse(x, y, 7 + r() * 4, 4 + r() * 2, 0, Math.PI, 0); ctx.fill();
      if (S.snow > 0.3) { ctx.fillStyle = css(P.snow, S.snow * 0.8); ctx.beginPath(); ctx.ellipse(x, y - 2.5, 4, 1.6, 0, Math.PI, 0); ctx.fill(); }
    }
  }
  // explicit hall states: an expansion being built while the site runs, and pads kept for later halls
  const explicit = !!st.hallStates;
  const bi = explicit ? buildingHall(progs) : -1;
  if (explicit) {
    rects.forEach((r, i) => {
      if (progs[i] <= 0) emptyPad(ctx, P, S, r, p.depth);
      else if (progs[i] < 1 && st.phase === 'operation') sitePatch(ctx, P, S, r, p.depth);
    });
  }
  rects.forEach((r, i) => hall(ctx, P, S, r, p.depth, progs[i], st, st.heatReuse, explicit && progs[i] > 0 && progs[i] < 1));

  const spots = visibleRoofSpots(L, st, progs);
  if (spots.fans.length || spots.towers.length) coolerBoxes(ctx, P, S, L, st, spots, progs);
  if (st.phase === 'operation' || st.phaseProgress > 0.75) generators(ctx, P, S, L);
  substation(ctx, P, S, L, st.phase === 'operation' ? 1 : smooth(0.4, 0.8, st.phaseProgress));

  // heat pump unit at the left end (needed to lift the temperature for district heating)
  if (st.phase === 'operation' && st.heatReuse) {
    const hp = heatPumpBox(L);
    ctx.fillStyle = css(mix(P.hallWall, P.heat, 0.25));
    ctx.fillRect(hp.x, hp.y - 7, hp.w, 7);
    ctx.fillStyle = css(mix(P.heat, P.ink, 0.2));
    ctx.fillRect(hp.x + 1, hp.y - 5, hp.w - 2, 1);
    ctx.fillRect(hp.x + 1, hp.y - 3, hp.w - 2, 1);
  }
  if (st.phase === 'construction') {
    siteHuts(ctx, P, S);
    fence(ctx, P, L, 'site');
    // builders' cars: the car park fills up toward the construction peak
    const nCars = carCount(st);
    if (nCars != null) carPark(ctx, P, S, nCars, carParkCols(L, st), true);
  } else {
    fence(ctx, P, L, 'final');
    // site cabins in front of an expansion hall
    if (bi >= 0) siteHuts(ctx, P, S, rects[bi].x + 12);
    const nCars = carCount(st);
    if (nCars != null) carPark(ctx, P, S, nCars, carParkCols(L, st), false);
    else {
      // a few staff cars in front
      const cc = [P.accent, P.houseWhite, P.houseRed, P.building];
      for (let i = 0; i < Math.min(4, 1 + p.halls); i++) {
        const x = 16 + i * 7, y = 1.6;
        ctx.fillStyle = css(mix(cc[i % 4], P.building, 0.2));
        rrect(ctx, x, y - 2.4, 5.5, 2.4, 0.8); ctx.fill();
        ctx.fillRect(x + 1.2, y - 3.6, 3, 1.4);
      }
    }
  }
}

export function heatPumpBox(L) {
  const p = L.plot;
  return { x: p.hallX - 9, y: 0, w: 8 };
}

/** Index of the hall currently being built (for the crane). */
function activeHall(progs) {
  for (let i = 0; i < progs.length; i++) if (progs[i] < 1) return i;
  return progs.length - 1;
}

function excavator(ctx, P, ex, ey, t) {
  const arm = Math.sin(t * 1.2) * 0.35;
  ctx.fillStyle = css(P.crane);
  ctx.fillRect(ex - 6, ey - 5, 9, 4);
  ctx.fillStyle = css(mix(P.glassDay, P.ink, 0.2));
  ctx.fillRect(ex - 5, ey - 4.3, 3, 2.4);
  ctx.fillStyle = css(P.ink, 0.75);
  ctx.fillRect(ex - 7, ey - 1.2, 11, 1.6);
  ctx.strokeStyle = css(mix(P.crane, P.ink, 0.2));
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  const jx = ex + 3 + Math.cos(-0.9 + arm) * 9, jy = ey - 4 + Math.sin(-0.9 + arm) * 9;
  ctx.moveTo(ex + 3, ey - 4); ctx.lineTo(jx, jy);
  ctx.lineTo(jx + 4, jy + 6 + arm * 4);
  ctx.stroke();
}

/** Top of the tower crane's mast for hall rect r (local units). */
export function craneTop(L, r) {
  const p = L.plot;
  const { dy } = geo(p);
  return { x: r.x + r.w * 0.55 + p.depth * 0.3, y: -dy * 0.6 - (r.h + 60) };
}

function towerCrane(ctx, P, L, r, t) {
  const p = L.plot;
  const { dy } = geo(p);
  const cx = r.x + r.w * 0.55 + p.depth * 0.3, cy = -dy * 0.6;
  const mastH = r.h + 60;
  const top = cy - mastH;
  ctx.strokeStyle = css(P.crane);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cx - 1.6, cy); ctx.lineTo(cx - 1.6, top);
  ctx.moveTo(cx + 1.6, cy); ctx.lineTo(cx + 1.6, top);
  for (let y = cy; y > top + 3; y -= 4) { ctx.moveTo(cx - 1.6, y); ctx.lineTo(cx + 1.6, y - 4); }
  ctx.stroke();
  // slewing jib (foreshortened by the rotation angle)
  const a = Math.sin(t * 0.22) * 1.1 + 0.4;
  const jib = 58 * Math.cos(a), cj = -17 * Math.cos(a);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx + cj, top); ctx.lineTo(cx + jib, top);
  ctx.moveTo(cx, top - 7); ctx.lineTo(cx + jib * 0.98, top);
  ctx.moveTo(cx, top - 7); ctx.lineTo(cx + cj, top);
  ctx.moveTo(cx, top); ctx.lineTo(cx, top - 7);
  ctx.stroke();
  ctx.fillStyle = css(mix(P.building, P.ink, 0.4));
  ctx.fillRect(cx + cj - (cj < 0 ? 0 : 5), top - 1, 5, 3.2);
  ctx.fillStyle = css(P.crane);
  ctx.fillRect(cx - 2.6, top - 0.5, 5.2, 4);
  // trolley, cable and swinging load
  const tr = 0.4 + 0.35 * (0.5 + 0.5 * Math.sin(t * 0.31));
  const tx = cx + jib * tr;
  const loadY = top + 16 + 10 * (0.5 + 0.5 * Math.sin(t * 0.4 + 1));
  const sway = Math.sin(t * 1.7) * 0.8;
  ctx.strokeStyle = css(P.ink, 0.6);
  ctx.lineWidth = 0.35;
  ctx.beginPath(); ctx.moveTo(tx, top + 1); ctx.lineTo(tx + sway, loadY); ctx.stroke();
  ctx.fillStyle = css(P.steel);
  ctx.fillRect(tx + sway - 6, loadY, 12, 1.4);
}

/** 'opening': the hall lights come on, window by window (k = 0..1; 1 = all on). */
function hallLights(ctx, P, r, k) {
  const { x, w, h } = r;
  const y = -h * 0.62, wh = Math.max(1.6, h * 0.13);
  const slots = [];
  for (let xx = x + 11; xx + 3 < x + w - 2; xx += 5) {
    if (xx + 3 > x + w * 0.68 && xx < x + w * 0.84) continue; // loading door
    slots.push(xx);
  }
  slots.forEach((xx, i) => {
    const on = clamp(k * (slots.length + 2) - i, 0, 1);
    if (on <= 0) return;
    ctx.fillStyle = css(P.windowWarm, 0.22 * on);
    ctx.fillRect(xx - 1.2, y - 1.2, 5.4, wh + 2.4);
    ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, on));
    ctx.fillRect(xx, y, 3, wh);
  });
  // the entrance glows too
  ctx.fillStyle = css(P.windowWarm, 0.9 * clamp(k * 3, 0, 1));
  ctx.fillRect(x + 4, -h * 0.4, 4, h * 0.4);
}

/** 'refresh': crates of old equipment waiting by the loading door. */
function refreshCrates(ctx, P, S, L, st) {
  const c = crateSpot(L, st);
  const col = P.crate;
  const boxes = [[-7, 0, 6, 4.2], [-0.6, 0, 6, 4.2], [-4, -4.2, 6, 4.2]];
  for (const [bx, by, bw, bh] of boxes) {
    const x = c.x + bx, y = c.y + by + 1.5;
    ctx.fillStyle = css(col);
    ctx.fillRect(x, y - bh, bw, bh);
    ctx.strokeStyle = css(P.ink, 0.45);
    ctx.lineWidth = 0.35;
    ctx.strokeRect(x, y - bh, bw, bh);
    ctx.fillStyle = css(mix(col, P.ink, 0.35));
    ctx.fillRect(x, y - bh * 0.55, bw, 0.6);
    if (S.snow > 0.4) { ctx.fillStyle = css(P.snow, S.snow * 0.9); ctx.fillRect(x, y - bh - 0.4, bw, 0.5); }
  }
}

/**
 * Dynamic parts inside the plot transform: fans, crane, excavator, workers, and event moments
 * (ev = { key, age, still }: 'opening' turns the hall lights on, 'refresh' puts crates by the door).
 */
export function drawPlotDynamic(ctx, L, P, S, st, t, ev = null) {
  const p = L.plot;
  const { dy } = geo(p);
  const progs = hallProgress(st, L);
  const rects = hallRects(L);
  const spots = visibleRoofSpots(L, st, progs);
  if (spots.fans.length) {
    const speed = (st.cooling === 'liquid' ? 2.2 : 4) * (0.6 + 0.6 * (1 - S.w));
    ctx.strokeStyle = css(P.ink, 0.55);
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (const f of spots.fans) {
      const bh = f.big ? 3.4 : 2.6;
      const cx = f.x + 0.9, cy = f.y - bh - 0.7;
      const rx = f.big ? 2.6 : 1.8, ry = f.big ? 0.9 : 0.62;
      for (const ox of f.big ? [-2.7, 2.7] : [-2, 2]) {
        const a0 = t * speed + f.x;
        for (let b = 0; b < 3; b++) {
          const a = a0 + (b * Math.PI * 2) / 3;
          ctx.moveTo(cx + ox, cy);
          ctx.lineTo(cx + ox + Math.cos(a) * rx, cy + Math.sin(a) * ry);
        }
      }
    }
    ctx.stroke();
  }
  if (ev && st.phase === 'operation') {
    if (ev.key === 'opening') {
      const k = ev.still ? 1 : clamp(ev.age / 1.4, 0, 1);
      rects.forEach((r, i) => { if (progs[i] >= 1) hallLights(ctx, P, r, k); });
    }
    if (ev.key === 'refresh') refreshCrates(ctx, P, S, L, st);
  }
  if (st.phase === 'planning') return;
  const explicit = !!st.hallStates;
  const bi = buildingHall(progs);

  if (st.phase === 'operation') {
    // an expansion: the next hall is built beside the running ones
    if (bi < 0) return;
    const r = rects[bi];
    if (progs[bi] < 0.25) excavator(ctx, P, r.x + r.w * 0.45 + p.depth * 0.3, -dy * 0.35, t);
    towerCrane(ctx, P, L, r, t);
    for (let i = 0; i < 4; i++) {
      const ph = fract(t * (0.03 + (i % 2) * 0.01) + i * 0.29);
      const x = r.x + 4 + (ph < 0.5 ? ph * 2 : 2 - ph * 2) * (r.w - 8);
      person(ctx, P, x, i % 2 ? -dy * 0.5 - 2 : -1.5, true);
    }
    return;
  }

  // construction phase
  const ai = explicit ? bi : activeHall(progs);

  // excavator during earthworks
  if (st.phaseProgress < 0.45) excavator(ctx, P, p.plotW * 0.52, -dy * 0.35, t);

  // tower crane by the hall being built
  const craneOn = explicit ? bi >= 0 : st.phaseProgress > 0.12 && st.phaseProgress < 0.98;
  if (craneOn && ai >= 0) towerCrane(ctx, P, L, rects[ai], t);

  // workers on site
  const n = clamp(Math.round(st.workers / 35), 3, 14);
  for (let i = 0; i < n; i++) {
    const span = p.plotW - 20;
    const ph = fract(t * (0.025 + (i % 3) * 0.008) + i * 0.137);
    const back = i % 2;
    const x = 14 + (ph < 0.5 ? ph * 2 : 2 - ph * 2) * span;
    const y = back ? -dy * 0.5 - 2 : -1.5;
    person(ctx, P, x, y, true);
  }
}

/** Plume / shimmer / generator puffs drawn in world space (they rise above the plot). */
export function drawPlotAir(ctx, L, P, S, st, t, extra) {
  const p = L.plot;
  if (st.phase !== 'operation') return;
  const spots = visibleRoofSpots(L, st);
  // heat haze: surplus heat to the air (all year if not reused, mainly in summer if reused)
  const haze = st.heatReuse ? 0.25 + 0.75 * (1 - S.w) : 0.75 + 0.25 * (1 - S.w);
  if (spots.fans.length) {
    ctx.strokeStyle = css(mix(P.heat, P.skyBottom, 0.35), 0.22 * haze);
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const step = Math.max(1, Math.floor(spots.fans.length / 8));
    for (let i = 0; i < spots.fans.length; i += step) {
      const f = spots.fans[i];
      const [wx, wy] = L.toWorld(f.x, f.y - 4);
      for (let k = 0; k < 2; k++) {
        const ph = fract(t * 0.5 + i * 0.13 + k * 0.5);
        const y0 = wy - ph * 14;
        ctx.moveTo(wx + Math.sin(ph * 9 + t * 3) * 1.5, y0);
        for (let j = 1; j <= 4; j++) ctx.lineTo(wx + Math.sin(ph * 9 + j * 1.3 + t * 3) * 1.5, y0 - j * 2.2);
      }
    }
    ctx.stroke();
  }
  // vapour plume from evaporative cooling towers (more visible in cold air)
  if (spots.towers.length) {
    const vis = (0.55 + 0.45 * S.w) * (extra.water ? 1.2 : 1);
    for (const [ti, tw] of spots.towers.entries()) {
      const [wx, wy] = L.toWorld(tw.x + 6, tw.y - 10);
      const n = 10;
      for (let i = 0; i < n; i++) {
        const life = fract(t * 0.16 + i / n + ti * 0.37);
        const rise = (16 + 34 * S.w) * life * p.s + 2;
        const x = wx + life * (10 + 10 * S.w) * p.s + Math.sin(t * 0.7 + i) * 1.2;
        const y = wy - rise * 1.6;
        const rad = (2.5 + life * (6 + 6 * S.w)) * p.s;
        ctx.fillStyle = css(P.vapour, Math.min(0.9, Math.pow(1 - life, 1.2) * 0.75 * vis));
        circle(ctx, x, y, rad); ctx.fill();
      }
    }
  }
  // generator test run: a short puff of exhaust
  const g = extra.genPuff;
  if (g > 0) {
    for (const s of generatorStacks(L)) {
      const [wx, wy] = L.toWorld(s.x, s.y);
      for (let i = 0; i < 4; i++) {
        const life = fract(t * 0.5 + i / 4);
        ctx.fillStyle = css(mix(P.building, P.ink, 0.35), (1 - life) * 0.5 * g);
        circle(ctx, wx + life * 6, wy - life * 12, (1 + life * 4) * p.s); ctx.fill();
      }
    }
  }
}
