// Layer 2: far landscape (hills, lake, ground), the site's own land (forest / field / industrial yard) and the road.
import { css, mix } from './colors.js';
import { rng, lerp, poly, rrect, smooth } from './util.js';
import { spruce, birch, pine } from './trees.js';

export function groundColor(P, S) {
  let g = mix(P.grassSummer, P.earth, S.autumn * 0.3 + (S.spring > 0.5 && S.snow < 0.3 ? 0.25 : 0));
  return mix(g, P.snow, S.snow * 0.92);
}

function ridge(seed, x0, x1, base, amp, step) {
  const r = rng(seed);
  const pts = [];
  let y = base, v = 0;
  for (let x = x0 - 10; x <= x1 + 10; x += step) {
    v = v * 0.7 + (r() - 0.5) * amp * 0.6;
    y = base + Math.sin(x * 0.012 + seed) * amp * 0.6 + v;
    pts.push([x, y]);
  }
  return pts;
}

export function drawFarLand(ctx, L, P, S) {
  const { view, yH, Hw } = L;
  // far hills (blue-ish, atmospheric)
  for (const [seed, base, amp, col] of [[3, yH - 6, 10, P.hillFar], [11, yH + 2, 7, P.hillMid]]) {
    const pts = ridge(seed, view.x0, view.x1, base, amp, 8);
    ctx.fillStyle = css(mix(col, P.snow, S.snow * (P.dark ? 0.12 : 0.25)));
    ctx.beginPath();
    ctx.moveTo(view.x0 - 10, yH + 30);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(view.x1 + 10, yH + 30);
    ctx.closePath();
    ctx.fill();
    // spruce fringe on the ridge
    if (seed === 11) {
      ctx.fillStyle = css(mix(col, P.forestDark, 0.35));
      ctx.beginPath();
      const r = rng(5);
      for (const [x, y] of pts) {
        for (let j = 0; j < 2; j++) {
          const tx = x + j * 4 + r() * 2, th = 4 + r() * 5;
          ctx.moveTo(tx - 2, y + 1);
          ctx.lineTo(tx, y - th);
          ctx.lineTo(tx + 2, y + 1);
        }
      }
      ctx.fill();
    }
  }
  // ground
  const g = groundColor(P, S);
  const grad = ctx.createLinearGradient(0, yH, 0, Hw);
  grad.addColorStop(0, css(mix(g, P.hillMid, 0.25)));
  grad.addColorStop(0.25, css(g));
  grad.addColorStop(1, css(mix(g, P.ink, P.dark ? 0.05 : 0.07)));
  ctx.fillStyle = grad;
  ctx.fillRect(view.x0 - 2, yH + 2, view.x1 - view.x0 + 4, Hw - yH);

  // lake behind the town (frozen in winter)
  const lx0 = view.x0 - 10, lx1 = Math.min(L.townRight + 40, 300);
  const ly = yH + 7;
  const water = mix(P.lake, P.ice, S.snow);
  ctx.fillStyle = css(water);
  ctx.beginPath();
  ctx.moveTo(lx0, ly);
  ctx.bezierCurveTo(lx0 + 80, ly - 4, lx1 - 60, ly - 3, lx1, ly + 4);
  ctx.bezierCurveTo(lx1 - 40, ly + 14, lx0 + 90, ly + 16, lx0, ly + 13);
  ctx.closePath();
  ctx.fill();
  if (S.snow > 0.3) { ctx.strokeStyle = css(mix(P.ice, P.ink, 0.25), 0.5 * S.snow); ctx.lineWidth = 0.7; ctx.stroke(); }
  // reflections
  ctx.strokeStyle = css(P.dark ? P.windowWarm : P.snow, S.snow > 0.5 ? 0.15 : 0.45);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  const r = rng(21);
  for (let i = 0; i < 9; i++) {
    const x = lerp(lx0 + 20, lx1 - 50, r()), y = ly + 2 + r() * 9;
    ctx.moveTo(x, y); ctx.lineTo(x + 6 + r() * 10, y);
  }
  ctx.stroke();
  // a sauna and a jetty on the far shore (a small Finnish detail)
  const sx = lx0 + 48, sy = ly + 1;
  ctx.fillStyle = css(mix(P.houseRed, P.ink, 0.25));
  ctx.fillRect(sx, sy - 5, 8, 5);
  ctx.fillStyle = css(P.roofDark);
  poly(ctx, [sx - 1, sy - 5, sx + 4, sy - 8, sx + 9, sy - 5]); ctx.fill();
  ctx.fillStyle = css(mix(P.field, P.houseRed, 0.3));
  ctx.fillRect(sx + 8, sy + 1, 12, 1.2);
}

/** A field's colour through the year: green in early summer, stubble in autumn, bare in spring, snow in winter. */
export function fieldColor(P, S) {
  let col = mix(P.field, P.grassSummer, smooth(0.4, 0.5, S.s) * (1 - smooth(0.58, 0.66, S.s)) * 0.75);
  col = mix(col, P.earth, S.spring * 0.55 + S.autumn * 0.15);
  return mix(col, P.snow, S.snow * 0.95);
}

/** Middle-ground forest belt behind the town and the plot, plus the site's own land before building. */
export function drawSiteLand(ctx, L, P, S, st, pass = 'back') {
  const { view, yH, plot } = L;
  const fp = footprint(L);
  const cleared = clearedAmount(st);
  if (pass === 'front') { if (st.site === 'forest') forestTrees(ctx, L, P, S, fp, cleared, pass); return; }
  // forest belt along the back, always there: a dark mass with a spruce-top edge, then single trees
  const bx0 = L.townRight - 20, bx1 = view.x1 + 10;
  const r = rng(31);
  const mass = mix(mix(P.forestDark, P.forest, 0.25), P.hillMid, 0.25);
  ctx.fillStyle = css(mix(mass, P.snow, S.snow * 0.18));
  ctx.beginPath();
  ctx.moveTo(bx0, yH + 22);
  for (let x = bx0; x <= bx1; x += 3.2) {
    const ramp = Math.min(1, (x - bx0) / 40);
    const top = yH + 22 - ramp * 14 - r() * 7 * ramp;
    ctx.lineTo(x, Math.max(top + 4, yH + 10)); ctx.lineTo(x + 1.6, top);
  }
  ctx.lineTo(bx1, yH + 22);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 46; i++) {
    const x = lerp(bx0 + 10, bx1, r());
    const y = yH + 14 + r() * 10;
    const hgt = 10 + r() * 8;
    if (r() < 0.72) spruce(ctx, P, S, x, y, hgt, r() * 0.4);
    else birch(ctx, P, S, x, y, hgt * 0.85, i);
  }

  if (st.site === 'field') {
    // a big field around the plot
    const fx0 = L.townRight + 16, fx1 = view.x1 + 10, fy0 = yH + 22, fy1 = L.yB + 10;
    const col = fieldColor(P, S);
    ctx.fillStyle = css(col);
    poly(ctx, [fx0 + 20, fy0, fx1, fy0 - 2, fx1, fy1, fx0, fy1]);
    ctx.fill();
    ctx.strokeStyle = css(mix(col, P.ink, 0.12), 0.6);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let i = 1; i < 9; i++) {
      const y = lerp(fy0, fy1, i / 9);
      ctx.moveTo(lerp(fx0 + 20, fx0, i / 9), y);
      ctx.lineTo(fx1, y);
    }
    ctx.stroke();
    // a red barn at the far edge
    const bx = fx1 - 70, by = fy0 + 4;
    ctx.fillStyle = css(P.houseRed);
    ctx.fillRect(bx, by - 9, 18, 9);
    ctx.fillStyle = css(P.roofDark);
    poly(ctx, [bx - 2, by - 9, bx + 9, by - 15, bx + 20, by - 9]); ctx.fill();
    if (S.snow > 0.1) { ctx.fillStyle = css(P.snow, S.snow); poly(ctx, [bx - 2, by - 9, bx + 9, by - 15, bx + 20, by - 9, bx + 9, by - 13]); ctx.fill(); }
    // silage bales ("tractor eggs") in late summer / autumn, outside the cleared plot
    if (S.s > 0.6 && S.s < 0.86 && S.snow < 0.1) {
      const rb = rng(8);
      for (let i = 0; i < 9; i++) {
        const x = lerp(fx0 + 30, fx1 - 10, rb()), y = lerp(fy0 + 6, fy1 - 4, rb());
        if (cleared > 0 && x > fp.x0 - 6 && x < fp.x1 + 10 && y > fp.y0 - 4) continue;
        ctx.fillStyle = css(P.houseWhite);
        rrect(ctx, x, y - 4, 6, 4, 2); ctx.fill();
        ctx.fillStyle = css(P.ink, 0.15);
        ctx.fillRect(x + 4.5, y - 4, 1.5, 4);
      }
    }
  } else if (st.site === 'industrial') {
    // existing industrial area: yard, old sheds and containers either side of the plot
    const ix0 = L.townRight + 14, ix1 = view.x1 + 10;
    ctx.fillStyle = css(mix(mix(P.asphalt, groundColor(P, S), 0.62), P.snow, S.snow * 0.6));
    poly(ctx, [ix0 + 20, plot.y - 34 * plot.s - 8, ix1, plot.y - 34 * plot.s - 10, ix1, L.yB + 12, ix0, L.yB + 12]);
    ctx.fill();
    const sheds = [[fp.x1 + 14, plot.y - 22 * plot.s, 34, 14], [fp.x0 - 40, plot.y - 30 * plot.s, 30, 11], [fp.x1 + 40, plot.y - 34 * plot.s, 44, 16]];
    for (const [x, y, w, hgt] of sheds) {
      if (x > view.x1 + 5) continue;
      const ww = w * plot.s, hh = hgt * plot.s;
      ctx.fillStyle = css(mix(P.building, P.houseWhite, 0.25));
      ctx.fillRect(x, y - hh, ww, hh);
      ctx.strokeStyle = css(P.ink, 0.12);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let xx = x + 2; xx < x + ww; xx += 2.5) { ctx.moveTo(xx, y - hh); ctx.lineTo(xx, y); }
      ctx.stroke();
      ctx.fillStyle = css(mix(P.building, P.ink, 0.3));
      ctx.fillRect(x - 1, y - hh - 1.5, ww + 2, 2);
      if (S.snow > 0.1) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x - 1, y - hh - 2.5, ww + 2, 1.5); }
    }
    // yard lamp posts
    ctx.strokeStyle = css(P.steel, 0.8);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (const lx of [fp.x0 - 30, fp.x1 + 8, fp.x1 + 60]) {
      if (lx > view.x1) continue;
      ctx.moveTo(lx, L.yB + 6); ctx.lineTo(lx, L.yB - 18); ctx.lineTo(lx + 3, L.yB - 18);
    }
    ctx.stroke();
    if (P.dark || S.w > 0.85) {
      for (const lx of [fp.x0 - 30, fp.x1 + 8, fp.x1 + 60]) {
        if (lx > view.x1) continue;
        const g = ctx.createRadialGradient(lx + 3, L.yB - 17, 0.5, lx + 3, L.yB - 17, 7);
        g.addColorStop(0, css(P.windowWarm, 0.9));
        g.addColorStop(1, css(P.windowWarm, 0));
        ctx.fillStyle = g;
        ctx.fillRect(lx - 4, L.yB - 24, 14, 14);
      }
    }
    // shipping containers
    const cc = [P.accent, P.houseRed, P.cFuture];
    for (let i = 0; i < 3; i++) {
      const x = fp.x0 - 22 + i * 7, y = plot.y + 4 - i * 1;
      ctx.fillStyle = css(mix(cc[i], P.building, 0.3));
      ctx.fillRect(x, y - 6, 12, 6);
    }
  }

  if (st.site === 'forest') forestTrees(ctx, L, P, S, fp, cleared, pass);
}

// forest on the plot (the forest site): a dense spruce/pine/birch forest, cleared as construction proceeds
function forestTrees(ctx, L, P, S, fp, cleared, pass) {
  const { view, yH, plot } = L;
  const rf = rng(77);
  const gx = L.gateX + 6 * plot.s;
  for (let y = yH + 22; y < L.yB + 14; y += 6.5) {
    const depth = (y - yH) / (L.yB - yH);
    for (let x = L.townRight + 14 + rf() * 4; x < view.x1 + 10; x += 7 + rf() * 3) {
      const ty = y + rf() * 3;
      const k = rf(), hgt = (13 + rf() * 8) * lerp(0.7, 1.05, depth), id = Math.floor(rf() * 100);
      if (pass === 'back' ? ty >= plot.y + 2 : ty < plot.y + 2) continue;
      // keep the town's edge open so the houses and the heating plant stay visible
      if (x < L.townRight + 26 && ty > L.yB - 40) continue;
      const inPlot = x > fp.x0 - 5 && x < fp.x1 + 6 && ty > fp.y0 - 6 && ty < fp.y1 + 5;
      const inFront = cleared > 0 && ty >= plot.y + 2 && x > fp.x0 - 6 && x < fp.x1 + 6;
      const onRoad = cleared > 0 && Math.abs(x - gx) < 9 && ty > plot.y;
      if (inPlot && k < cleared) {
        if (cleared > 1) continue;
        ctx.fillStyle = css(mix(P.field, P.houseRed, 0.3));
        ctx.fillRect(x - 1, ty - 1.4, 2, 1.4);
        continue;
      }
      if (inFront || onRoad) continue;
      if (k < 0.7) spruce(ctx, P, S, x, ty, hgt, k * 0.6 + depth * 0.3);
      else if (k < 0.8) pine(ctx, P, S, x, ty, hgt * 1.1);
      else birch(ctx, P, S, x, ty, hgt * 0.9, id);
    }
  }
}

/** How much of the plot has been cleared (0 = untouched, 1 = fully built). */
export function clearedAmount(st) {
  if (st.phase === 'planning') return 0;
  if (st.phase === 'construction') return Math.min(1, 0.15 + st.phaseProgress * 3.5);
  return 1.01;
}

/** The plot footprint in world coordinates (¾ view parallelogram, as a bounding box). */
export function footprint(L) {
  const p = L.plot;
  const dy = (p.depth * 0.45 + 8) * p.s;
  return { x0: p.x - 4 * p.s, x1: p.x + p.w, y0: p.y - dy, y1: p.y + 3 * p.s };
}

/** Foreground road through the town to the site gate. */
export function drawRoad(ctx, L, P, S, st) {
  const { view, roadY, plot } = L;
  const x1 = view.x1 + 10;
  const hw = 6;
  const asphalt = mix(P.asphalt, P.snow, S.snow * 0.25);
  // verge
  ctx.fillStyle = css(mix(groundColor(P, S), P.ink, 0.04));
  ctx.fillRect(view.x0 - 2, roadY + hw, x1 - view.x0, L.Hw - roadY);
  // access road up to the plot
  const gx = L.gateX + 6 * plot.s;
  const accessCol = st.phase === 'planning' ? mix(P.earth, groundColor(P, S), 0.4) : st.phase === 'construction' ? mix(P.earth, P.asphalt, 0.25) : asphalt;
  ctx.fillStyle = css(accessCol);
  poly(ctx, [gx - 5, roadY, gx + 5, roadY, gx + 4 * plot.s + 4, plot.y + 2, gx + 4 * plot.s - 4, plot.y + 2]);
  ctx.fill();
  // main road
  ctx.fillStyle = css(asphalt);
  ctx.fillRect(view.x0 - 2, roadY - hw, x1 - view.x0, hw * 2);
  ctx.strokeStyle = css(P.roadLine, P.dark ? 0.55 : 0.85);
  ctx.lineWidth = 0.8;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(view.x0, roadY); ctx.lineTo(x1, roadY);
  ctx.stroke();
  ctx.setLineDash([]);
  // snow banks in winter
  if (S.snow > 0.2) {
    ctx.fillStyle = css(P.snow, S.snow);
    ctx.fillRect(view.x0 - 2, roadY - hw - 1.5, x1 - view.x0, 1.6);
    ctx.fillRect(view.x0 - 2, roadY + hw, x1 - view.x0, 1.6);
  }
}
