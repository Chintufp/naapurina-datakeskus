// Layer 6: connections and movement — power line from the grid, waste-heat pipe to the town,
// water main (evaporative cooling), trucks and cars on the road, noise rings, distance marker,
// and the event moments in the world: a truck taking old equipment away, residents at a notice board.
import { css, mix } from './colors.js';
import { clamp, fract, lerp, quadAt, circle, rrect, poly } from './util.js';
import { gantryTop, heatPumpBox, hallRects, geo, person } from './datacentre.js';

/* ---------- power line ---------- */

export function powerGeometry(L) {
  const g = gantryTop(L);
  const [gx, gy] = L.toWorld(g.x, g.y);
  const pylons = [];
  for (let i = 1; i <= 5; i++) {
    const f = i / 4;
    const x = gx + 26 + (i - 1) * 40;
    const base = lerp(L.plot.y - 2, L.yH + 16, clamp(f, 0, 1));
    const sc = lerp(L.plot.s, 0.5, clamp(f, 0, 1));
    pylons.push({ x, base, sc, top: base - 34 * sc });
    if (x > L.view.x1 + 20) break;
  }
  const points = [[[gx - 5 * L.plot.s, gy], [gx, gy], [gx + 5 * L.plot.s, gy]]];
  for (const p of pylons) points.push([-9, 0, 9].map((o) => [p.x + o * p.sc, p.top + 1.5 * p.sc]));
  return { gx, gy, pylons, points };
}

function pylon(ctx, P, p) {
  const { x, base, sc, top } = p;
  ctx.strokeStyle = css(P.steel);
  ctx.lineWidth = Math.max(0.6, 1.1 * sc);
  ctx.beginPath();
  // guyed portal pylon (common on Finnish transmission lines)
  ctx.moveTo(x - 8 * sc, base); ctx.lineTo(x - 5 * sc, top + 2 * sc);
  ctx.moveTo(x + 8 * sc, base); ctx.lineTo(x + 5 * sc, top + 2 * sc);
  ctx.moveTo(x - 11 * sc, top + 1.5 * sc); ctx.lineTo(x + 11 * sc, top + 1.5 * sc);
  ctx.moveTo(x - 11 * sc, top + 3.5 * sc); ctx.lineTo(x + 11 * sc, top + 3.5 * sc);
  ctx.stroke();
  ctx.strokeStyle = css(P.steel, 0.35);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(x - 5 * sc, top + 3 * sc); ctx.lineTo(x - 16 * sc, base);
  ctx.moveTo(x + 5 * sc, top + 3 * sc); ctx.lineTo(x + 16 * sc, base);
  ctx.stroke();
}

export function drawPowerStatic(ctx, L, P, S, st, geom, wires) {
  for (const p of geom.pylons) pylon(ctx, P, p);
  if (!wires) return;
  ctx.strokeStyle = css(P.ink, P.dark ? 0.45 : 0.55);
  ctx.lineWidth = 0.45;
  ctx.beginPath();
  for (let i = 0; i < geom.points.length - 1; i++) {
    for (let w = 0; w < 3; w++) {
      const [x0, y0] = geom.points[i][w], [x1, y1] = geom.points[i + 1][w];
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + 5, x1, y1);
    }
  }
  ctx.stroke();
}

/** Planned (not yet built) line: dashed. */
export function drawPowerPlanned(ctx, L, P, geom) {
  ctx.strokeStyle = css(P.cEnergy, 0.6);
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  const pts = geom.points.map((p) => p[1]);
  ctx.moveTo(pts[0][0], L.plot.y - 6);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y + 20);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawPowerFlow(ctx, L, P, geom, t, strong) {
  ctx.fillStyle = css(P.cEnergy, strong ? 1 : 0.85);
  for (let i = 0; i < geom.points.length - 1; i++) {
    const w = 1;
    const [x0, y0] = geom.points[i + 1][w], [x1, y1] = geom.points[i][w];
    const n = strong ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const u = fract(t * 0.45 + k / n + i * 0.21);
      const [x, y] = quadAt(x0, y0, (x0 + x1) / 2, Math.max(y0, y1) + 5, x1, y1, u);
      circle(ctx, x, y, strong ? 1.3 : 1); ctx.fill();
    }
  }
}

/* ---------- waste-heat pipe ---------- */

export function heatPipeGeometry(L, plan) {
  if (!plan.dh) return null;
  const hp = heatPumpBox(L);
  const [x0, y0] = L.toWorld(hp.x + hp.w / 2, 1);
  const x1 = plan.dh.x + plan.dh.w + 9, y1 = plan.dh.y + 2;
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: Math.max(y0, y1) + 4 };
}

export function drawHeatPipeStatic(ctx, P, g, strong) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(mix(P.heat, P.building, 0.55), 0.9);
  ctx.lineWidth = strong ? 4 : 3.2;
  ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.quadraticCurveTo(g.cx, g.cy, g.x1, g.y1); ctx.stroke();
  ctx.strokeStyle = css(mix(P.heat, P.windowWarm, 0.2), 0.55);
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(g.x0, g.y0); ctx.quadraticCurveTo(g.cx, g.cy, g.x1, g.y1); ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Amber dots flowing to the town; intensity follows the heat demand (strong in winter). */
export function drawHeatFlow(ctx, P, g, t, intensity, strong) {
  const n = Math.round(4 + 10 * intensity);
  const speed = 0.12 + 0.18 * intensity;
  for (let i = 0; i < n; i++) {
    const u = fract(t * speed + i / n);
    const [x, y] = quadAt(g.x0, g.y0, g.cx, g.cy, g.x1, g.y1, u);
    ctx.fillStyle = css(P.cHeat, 0.25 * (0.5 + intensity));
    circle(ctx, x, y, strong ? 3.6 : 2.8); ctx.fill();
    ctx.fillStyle = css(mix(P.cHeat, P.windowWarm, 0.4));
    circle(ctx, x, y, strong ? 1.6 : 1.25); ctx.fill();
  }
}

/** 'heatFirst': a brighter pulse travelling along the pipe from the data centre to the plant (fixed when still). */
export function drawHeatPulse(ctx, P, g, age, still) {
  const u = still ? 0.62 : fract(age * 0.42);
  // the stretch of pipe the pulse has already passed glows a little
  ctx.lineCap = 'round';
  ctx.strokeStyle = css(mix(P.cHeat, P.windowWarm, 0.5), 0.5);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const [x, y] = quadAt(g.x0, g.y0, g.cx, g.cy, g.x1, g.y1, (u * i) / 24);
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  const [x, y] = quadAt(g.x0, g.y0, g.cx, g.cy, g.x1, g.y1, u);
  const r = 11;
  const glow = ctx.createRadialGradient(x, y, 0.5, x, y, r);
  glow.addColorStop(0, css(P.windowWarm, 0.95));
  glow.addColorStop(0.35, css(P.cHeat, 0.55));
  glow.addColorStop(1, css(P.cHeat, 0));
  ctx.fillStyle = glow;
  circle(ctx, x, y, r); ctx.fill();
  ctx.fillStyle = css(mix(P.windowWarm, P.snow, 0.35));
  circle(ctx, x, y, 2.1); ctx.fill();
}

/* ---------- water main (evaporative cooling uses town water) ---------- */

export function waterGeometry(L, plan) {
  const w = plan.water;
  const y = L.roadY + 9.5;
  const [px, py] = L.toWorld(L.plot.hallX + 4, 2);
  return { pts: [[w.x, w.y], [w.x, y], [L.gateX + 10, y], [L.gateX + 10, L.roadY + 6], [px, py]] };
}

export function drawWaterStatic(ctx, P, g, strong) {
  ctx.strokeStyle = css(P.cWater, strong ? 0.9 : 0.55);
  ctx.lineWidth = strong ? 1.6 : 1;
  ctx.setLineDash([4, 2]);
  ctx.beginPath();
  g.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawWaterFlow(ctx, P, g, t, strong) {
  // walk along the polyline
  const segs = [];
  let total = 0;
  for (let i = 0; i < g.pts.length - 1; i++) {
    const [x0, y0] = g.pts[i], [x1, y1] = g.pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    segs.push({ x0, y0, x1, y1, len, at: total });
    total += len;
  }
  const n = Math.max(4, Math.round(total / 26));
  ctx.fillStyle = css(P.cWater);
  for (let i = 0; i < n; i++) {
    const d = fract(t * 0.06 + i / n) * total;
    const s = segs.find((q) => d >= q.at && d <= q.at + q.len) || segs[segs.length - 1];
    const u = (d - s.at) / (s.len || 1);
    circle(ctx, lerp(s.x0, s.x1, u), lerp(s.y0, s.y1, u), strong ? 1.5 : 1.1); ctx.fill();
  }
}

/* ---------- vehicles ---------- */

function truck(ctx, P, x, y, dir, loaded, scale = 1, hi = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scale, scale);
  if (loaded === 'crates') {
    // flatbed with crates of old servers (equipment refresh)
    ctx.fillStyle = css(mix(P.building, P.ink, 0.25));
    ctx.fillRect(-10, -3.4, 13.5, 1.2);
    const col = P.crate;
    for (const [bx, by] of [[-9.7, -3.4], [-3.9, -3.4], [-7.2, -7.6]]) {
      ctx.fillStyle = css(col);
      ctx.fillRect(bx, by - 4.2, 5.6, 4.2);
      ctx.strokeStyle = css(P.ink, 0.5);
      ctx.lineWidth = 0.3;
      ctx.strokeRect(bx, by - 4.2, 5.6, 4.2);
      ctx.fillStyle = css(mix(col, P.ink, 0.35));
      ctx.fillRect(bx, by - 2.4, 5.6, 0.5);
    }
  } else {
    // tipper body
    ctx.fillStyle = css(hi ? mix(P.crane, P.cTraffic, 0.2) : mix(P.crane, P.building, 0.25));
    ctx.fillRect(-9, -7, 12, 5);
    if (loaded) {
      ctx.fillStyle = css(P.earth);
      ctx.beginPath(); ctx.ellipse(-3, -7, 5.5, 1.6, 0, Math.PI, 0); ctx.fill();
    }
  }
  // cab
  ctx.fillStyle = css(mix(P.accent, P.houseWhite, P.dark ? 0.35 : 0.1));
  rrect(ctx, 3.5, -8, 5, 6, 1); ctx.fill();
  ctx.fillStyle = css(mix(P.glassDay, P.snow, 0.3));
  ctx.fillRect(6, -7, 2.2, 2.2);
  ctx.fillStyle = css(P.ink, 0.85);
  ctx.fillRect(-9, -2.4, 17.5, 0.9);
  for (const wx of [-6.5, -3, 6]) { circle(ctx, wx, -1, 1.4); ctx.fill(); }
  if (P.dark) {
    ctx.fillStyle = css(P.windowWarm, 0.9);
    ctx.fillRect(8.3, -4, 0.8, 0.9);
  }
  ctx.restore();
}

function car(ctx, P, x, y, dir, col) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = css(col);
  rrect(ctx, -4, -3.4, 8, 2.6, 1); ctx.fill();
  rrect(ctx, -2.2, -5, 4.4, 2, 1); ctx.fill();
  ctx.fillStyle = css(P.ink, 0.85);
  circle(ctx, -2.4, -0.8, 0.9); ctx.fill();
  circle(ctx, 2.4, -0.8, 0.9); ctx.fill();
  if (P.dark) { ctx.fillStyle = css(P.windowWarm); ctx.fillRect(3.6, -3, 0.6, 0.7); }
  ctx.restore();
}

export function truckCount(st) {
  if (st.phase !== 'construction') return st.phase === 'operation' ? 1 : 0;
  const tpd = st.trucksPerDay > 0 ? st.trucksPerDay : 40;
  return clamp(Math.round(tpd / 10), 2, 14);
}

export function drawTraffic(ctx, L, P, st, t, hiRoad) {
  const { view, roadY } = L;
  const start = view.x0 - 30;
  const gate = L.gateX + 6 * L.plot.s;
  const n = truckCount(st);
  const speed = 26;
  for (let i = 0; i < n; i++) {
    const inbound = i % 2 === 0;
    const len = gate - start;
    const u = fract((t * speed) / len + i / n * 1.37 + (inbound ? 0 : 0.5));
    const x = inbound ? lerp(start, gate, u) : lerp(gate, start, u);
    const fade = clamp((gate - x) / 12, 0, 1);
    ctx.globalAlpha = fade;
    if (st.phase === 'operation') truck(ctx, P, x, roadY + (inbound ? 4.5 : -1), inbound ? 1 : -1, false, 0.9);
    else truck(ctx, P, x, roadY + (inbound ? 4.5 : -1), inbound ? 1 : -1, inbound, 1, hiRoad);
    ctx.globalAlpha = 1;
  }
  // everyday town traffic
  const cols = [P.houseRed, P.accent, P.houseWhite];
  for (let i = 0; i < 3; i++) {
    const dir = i % 2 ? -1 : 1;
    const len = view.x1 - view.x0 + 60;
    const u = fract((t * (18 + i * 5)) / len + i * 0.31);
    const x = dir > 0 ? view.x0 - 30 + u * len : view.x1 + 30 - u * len;
    car(ctx, P, x, roadY + (dir > 0 ? 4.5 : -1), dir, mix(cols[i], P.building, 0.15));
  }
}

/**
 * 'refresh': a truck loaded with crates of old equipment leaves the plot — out of the gate, down the access road
 * and off to the left along the main road. Loops while the event lasts; the still pose is on the access road.
 */
export function drawRefreshTruck(ctx, L, P, age, still) {
  const p = L.plot;
  const gx = L.gateX + 6 * p.s;
  const [ax, ay] = L.toWorld(12, -1);
  const pts = [[ax, ay], [gx + 4 * p.s, p.y + 2], [gx, L.roadY - 1], [gx - 150, L.roadY - 1]];
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    segs.push({ i, len, at: total });
    total += len;
  }
  const speed = 30;
  const cycle = total / speed + 0.9;
  const d = still ? segs[0].len + segs[1].len * 0.45 : (age % cycle) * speed;
  if (d > total) return;
  const s = segs.find((q) => d <= q.at + q.len) || segs[segs.length - 1];
  const u = clamp((d - s.at) / (s.len || 1), 0, 1);
  const x = lerp(pts[s.i][0], pts[s.i + 1][0], u), y = lerp(pts[s.i][1], pts[s.i + 1][1], u);
  const big = L.narrow ? 1.2 : 1.05;
  const scale = (s.i === 0 ? p.s : s.i === 1 ? lerp(p.s, 0.95, u) : 0.95) * big;
  ctx.globalAlpha = still ? 1 : clamp(d / 6, 0, 1) * clamp((total - d) / 30, 0, 1);
  truck(ctx, P, x, y, -1, 'crates', scale);
  ctx.globalAlpha = 1;
}

/* ---------- public event: residents at a notice board in town ---------- */

/** Ground point of the notice board (in front of the homes nearest to the site), its scale and the top of its roof. */
export function noticeBoardSpot(L, plan) {
  const k = L.narrow ? 1.45 : 1.15;   // a little larger than life so it reads on a phone
  const x = plan.homeRight - (L.narrow ? 20 : 24), y = L.yB + 9;
  return { x, y, k, top: y - 19 * k };
}

export function drawPublicEvent(ctx, L, P, S, plan, t, still) {
  const spot = noticeBoardSpot(L, plan);
  ctx.save();
  ctx.translate(spot.x, spot.y);
  ctx.scale(spot.k, spot.k);
  const x = 0, y = 0;
  const wood = mix(P.field, P.houseRed, 0.35);
  // posts, board, a little roof
  ctx.fillStyle = css(mix(wood, P.ink, 0.25));
  ctx.fillRect(x - 6.5, y - 13, 1, 13);
  ctx.fillRect(x + 5.5, y - 13, 1, 13);
  ctx.fillStyle = css(wood);
  ctx.fillRect(x - 8, y - 15, 16, 9);
  ctx.fillStyle = css(P.roofDark);
  poly(ctx, [x - 9, y - 15, x, y - 18.5, x + 9, y - 15]); ctx.fill();
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); poly(ctx, [x - 9, y - 15, x, y - 18.9, x + 9, y - 15, x, y - 17.4]); ctx.fill(); }
  // notices (the main one with an accent header)
  ctx.fillStyle = css(P.houseWhite);
  ctx.fillRect(x - 6.9, y - 14, 4.4, 6.2);
  ctx.fillRect(x - 1.6, y - 14, 3.4, 4.4);
  ctx.fillRect(x + 2.7, y - 13.6, 4.1, 5.6);
  ctx.fillStyle = css(P.accent);
  ctx.fillRect(x - 6.9, y - 14, 4.4, 1.2);
  ctx.fillStyle = css(P.ink, 0.45);
  for (let i = 0; i < 3; i++) ctx.fillRect(x - 6.3, y - 12.2 + i * 1.3, 3.2, 0.4);
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 3.2, y - 12.6 + i * 1.3, 3, 0.4);
  // residents reading and talking (jackets in token colours)
  const cols = [P.accent, P.houseRed, P.cJobs, P.cWater, P.yellowHouse];
  const spots = [[-12.5, 3.2], [-6.5, 4.4], [0.4, 3.8], [6.6, 4.6], [12.4, 3.4]];
  spots.forEach(([dx, dy], i) => {
    const bob = still ? 0 : Math.max(0, Math.sin(t * 1.6 + i * 1.9)) * 0.35;
    person(ctx, P, x + dx, y + dy - bob, false, cols[i]);
  });
  // a speech bubble: someone is asking a question
  if (still || fract(t * 0.35) < 0.65) {
    const bx = x - 6.5 + 1.2, by = y + 4.4 - 12.5;
    ctx.fillStyle = css(P.houseWhite);
    rrect(ctx, bx, by, 6.4, 4, 1.6); ctx.fill();
    poly(ctx, [bx + 1.2, by + 3.6, bx + 0.4, by + 5.6, bx + 2.8, by + 3.8]); ctx.fill();
    ctx.strokeStyle = css(P.ink, 0.5);
    ctx.lineWidth = 0.3;
    rrect(ctx, bx, by, 6.4, 4, 1.6); ctx.stroke();
    ctx.fillStyle = css(P.ink, 0.6);
    for (let i = 0; i < 3; i++) { circle(ctx, bx + 1.8 + i * 1.4, by + 2, 0.4); ctx.fill(); }
  }
  ctx.restore();
}

/* ---------- noise rings ---------- */

export function noiseSource(L, st) {
  const p = L.plot;
  const rects = hallRects(L);
  const r = rects[0];
  const { dx, dy } = geo(p);
  if (st.phase === 'construction') return L.toWorld(p.plotW * 0.45, -dy * 0.4);
  return L.toWorld(r.x + r.w * 0.4 + dx * 0.5, -r.h - dy * 0.5);
}

export function drawNoise(ctx, L, P, st, t, strong) {
  if (st.phase === 'planning') return;
  const [sx, sy] = noiseSource(L, st);
  const maxR = 200;
  const n = 6;
  ctx.lineWidth = strong ? 1.3 : 0.8;
  for (let i = 0; i < n; i++) {
    const r = fract(t * 0.18 + i / n) * maxR;
    const a = Math.pow(1 - r / maxR, 1.6) * (strong ? 0.8 : 0.35);
    ctx.strokeStyle = css(P.dark ? P.snow : P.ink, a);
    ctx.beginPath();
    ctx.ellipse(sx, sy, r, r * 0.42, 0, Math.PI * 0.62, Math.PI * 1.38);
    ctx.stroke();
  }
}

/* ---------- distance marker ---------- */

export function drawDistance(ctx, L, P, homeX) {
  const y = L.yB + 10;
  const x0 = homeX + 1, x1 = L.plot.x - 2;
  if (x1 - x0 < 8) return;
  ctx.strokeStyle = css(P.ink, P.dark ? 0.6 : 0.5);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x0, y); ctx.lineTo(x1, y);
  ctx.moveTo(x0, y - 3); ctx.lineTo(x0, y + 3);
  ctx.moveTo(x1, y - 3); ctx.lineTo(x1, y + 3);
  ctx.moveTo(x0 + 3, y - 2); ctx.lineTo(x0, y); ctx.lineTo(x0 + 3, y + 2);
  ctx.moveTo(x1 - 3, y - 2); ctx.lineTo(x1, y); ctx.lineTo(x1 - 3, y + 2);
  ctx.stroke();
}
