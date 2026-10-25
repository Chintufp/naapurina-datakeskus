// Layer 3: the town — red wooden houses with white trims, apartment blocks, a white church, a water tower and (if
// the town has a network) a district-heating plant with a striped chimney.
// Four templates by population, all drawn at the same fixed scale (see layout.js): a village (a few houses, a church
// and a shop among fields), a small town (low blocks), a regional centre (a row of blocks, a faint skyline) and a city
// (towers that run past the picture's left edge). The nearest homes always end at the same point toward the site.
// In operation with heat reuse, state.heatHomesShare (0..1) of the homes get warm, glowing windows in winter.
import { css, mix } from './colors.js';
import { rng, poly, circle, fract, winterGlow, lerp } from './util.js';
import { birch, spruce } from './trees.js';
import { fieldColor } from './land.js';

/** Is the "homes heated by the data centre" effect on? (operation, heat reused, share given) */
export function warmHomesOn(st) {
  return st.phase === 'operation' && !!st.heatReuse && st.heatHomesShare != null;
}

const FLOOR_H = 5.4; // storey height of an apartment block (world units)

/** Is the middle of this building inside the visible part of the world? (phones crop the left side of the town) */
function inView(L, b) {
  const c = b.x + (b.w || 0) / 2;
  return c >= L.view.x0 && c <= L.view.x1;
}

/** Height of a home above its ground point (roof ridge of a house, roof of a block). */
function homeTop(b, scale = 1) {
  return b.type === 'block' ? b.floors * FLOOR_H + 2 : b.w * scale * 0.55 * 1.75;
}

/**
 * Where the "homes heated by the data centre" label points: a lit home in view, front row first and preferably
 * not the nearest home (that one carries "Nearest homes"). Returns { x, y } (top of the home) or null.
 */
export function warmHomeAnchor(plan) {
  const nearest = plan.front[plan.front.length - 1];
  const front = plan.front.filter((b) => b.warm && b.inView);
  const pick = front.length > 1 ? front.filter((b) => b !== nearest) : front;
  if (pick.length) {
    const b = pick[Math.floor(pick.length / 2)];
    return { x: b.x + b.w / 2, y: b.y - (b.type === 'block' ? homeTop(b) : b.w * 0.55) - 2 };
  }
  const back = plan.back.filter((b) => b.warm && b.inView);
  if (!back.length) return null;
  const b = back[Math.floor(back.length / 2)];
  return { x: b.x + b.w / 2, y: b.y - homeTop(b, 0.85) - 2 };
}

const KIND_SEED = { village: 21, smallTown: 11, regional: 12, city: 13 };
const HOUSE_COLOR = (i) => (i % 4 === 2 ? 'yellow' : i % 5 === 3 ? 'white' : 'red');

/** A row of apartment blocks from x to xEnd; floors from fl (array or [min, max]). */
function blockRow(list, r, x, xEnd, y, fl, wMin, wMax, gap) {
  let i = 0;
  while (x < xEnd - wMin) {
    const w = Math.min(xEnd - x, wMin + Math.floor(r() * (wMax - wMin + 1)));
    const floors = fl[0] + Math.floor(r() * (fl[1] - fl[0] + 1));
    list.push({ type: 'block', x, y: y + (i % 2), w, floors });
    x += w + gap + r() * 3;
    i++;
  }
  return x;
}

/** Positions of the town's buildings (deterministic per town template). */
export function townPlan(L, st) {
  const { yB, townRight } = L;
  const kind = st.townKind || 'regional';
  const backY = yB - 21;
  const farY = yB - 31;
  const r = rng(KIND_SEED[kind] || 12);
  const far = [];    // hazy skyline behind the town (regional centre, city)
  const back = [];
  // the heating plant stands at the town's edge, toward the site; homes end before it
  const dh = st.hasDistrictHeat ? { type: 'dh', x: townRight - 34, y: yB, w: 26 } : null;
  // the chimney top is known here (not only when the cached layer is drawn), so the smoke never goes missing
  if (dh) dh.chimney = { x: dh.x + 5, y: dh.y - CHIMNEY_H };
  const homeRight = dh ? townRight - 42 : townRight;
  const left = Math.min(-12, L.view.x0 - 12);   // the city's towers run past the picture's left edge
  let x0;            // left edge of the built-up area
  let frontBlocksTo = -Infinity;   // front row: apartment blocks up to here, then houses
  let houseGap = [8, 6];           // gap between front houses: min + random
  if (kind === 'village') {
    x0 = townRight - 132;
    back.push({ type: 'water', x: x0 + 8, y: backY - 2 });
    back.push({ type: 'church', x: x0 + 24, y: backY });
    back.push({ type: 'shop', x: x0 + 70, y: backY, w: 26 });
    back.push({ type: 'house', x: x0 + 100, y: backY, w: 18, color: 'yellow' });
    houseGap = [14, 8];
  } else if (kind === 'smallTown') {
    x0 = townRight - 184;
    back.push({ type: 'water', x: x0 + 12, y: backY - 2 });
    back.push({ type: 'church', x: x0 + 40, y: backY });
    back.push({ type: 'block', x: x0 + 80, y: backY, w: 20, floors: 3 });
    back.push({ type: 'block', x: x0 + 104, y: backY + 1, w: 24, floors: 4 });
    back.push({ type: 'shop', x: x0 + 134, y: backY, w: 28 });
  } else if (kind === 'regional') {
    x0 = Math.min(townRight - 206, left + 12);
    blockRow(far, r, left, townRight - 70, farY, [6, 9], 16, 22, 10);
    back.push({ type: 'water', x: 14, y: backY - 2 });
    back.push({ type: 'church', x: 30, y: backY });
    blockRow(back, r, 72, townRight - 40, backY, [5, 8], 18, 24, 4);
    frontBlocksTo = 70;
  } else {
    x0 = left;
    blockRow(far, r, left, townRight - 26, farY, [12, 20], 14, 22, 3);
    // a couple of landmark towers
    if (far.length > 4) { far[2].floors = 24; far[far.length - 3].floors = 22; }
    back.push({ type: 'water', x: Math.max(14, L.view.x0 + 14), y: backY - 2 });
    blockRow(back, r, left, townRight - 40, backY, [6, 11], 18, 26, 3);
    // the water tower stands in a gap: drop the blocks it would hide
    const wt = back[0];
    for (let i = back.length - 1; i > 0; i--) if (back[i].x < wt.x + 14 && back[i].x + back[i].w > wt.x - 14) back.splice(i, 1);
    frontBlocksTo = homeRight - 66;
    houseGap = [5, 4];
  }

  // front row up to homeRight (= nearest homes): apartment blocks in a bigger town's centre, then houses
  const front = [];
  let x = kind === 'city' || kind === 'regional' ? x0 + 2 : x0 + 4;
  if (frontBlocksTo > x) {
    const fl = kind === 'city' ? [3, 5] : [3, 3];
    x = blockRow(front, r, x, frontBlocksTo, yB, fl, 22, 28, 6);
  }
  let i = 0;
  while (x < homeRight - 20) {
    const w = 19 + Math.floor(r() * 6);
    front.push({ type: 'house', x, y: yB, w, color: HOUSE_COLOR(i), seed: i });
    x += w + houseGap[0] + r() * houseGap[1];
    i++;
  }
  // make sure the last house touches the right edge
  const last = front[front.length - 1];
  if (last) last.x = homeRight - last.w;

  // homes heated by the data centre: that share of the homes, as one district next to the heating plant (where the
  // pipe arrives), so a growing share spreads the lit area further into the town.
  // The share is applied to the homes in view and to the cropped ones separately, so a phone (which shows only
  // part of the town) also shows about that share of lit homes.
  const homes = [...front, ...back.filter((b) => b.type === 'house' || b.type === 'block')];
  for (const b of homes) b.inView = inView(L, b);
  const warmOn = warmHomesOn(st);
  if (warmOn) {
    for (const group of [homes.filter((b) => b.inView), homes.filter((b) => !b.inView)]) {
      const order = [...group].sort((a, b) => (b.x + b.w / 2) - (a.x + a.w / 2));
      const nWarm = Math.round(st.heatHomesShare * group.length);
      order.forEach((b, i) => { b.warm = i < nWarm; });
    }
  }
  return { kind, far, back, front, dh, water: back.find((b) => b.type === 'water'), x0, homeRight, warmOn, homes };
}

function lightLevel(P, S) {
  return P.dark ? 1 : S.w > 0.82 ? 0.55 : 0;
}

/**
 * Window light for one home. warm: undefined = normal evening light; true = heated by the data centre
 * (fully lit, warm); false = not heated (dimmer), both blended in by the winter strength.
 */
function homeLight(P, S, warm) {
  const base = lightLevel(P, S);
  if (warm == null) return { lit: base, all: false, glow: 0 };
  const k = winterGlow(S);
  if (warm) return { lit: base + (1 - base) * k, all: k > 0.5, glow: k };
  const dim = P.dark ? 0.3 : 0;
  return { lit: base + (dim - base) * k, all: false, glow: 0 };
}

function windowCol(P, S, lit, on) {
  return on ? mix(P.glassDay, P.windowWarm, lit) : mix(P.glassDay, P.ink, P.dark ? 0.35 : 0);
}

export function house(ctx, P, S, x, y, w, color, seed = 0, scale = 1, warm = undefined) {
  const hgt = w * 0.55 * scale, ww = w * scale;
  const wall = color === 'yellow' ? P.yellowHouse : color === 'white' ? P.houseWhite : P.houseRed;
  const hl = homeLight(P, S, warm);
  const lit = hl.lit;
  // wall
  ctx.fillStyle = css(wall);
  ctx.fillRect(x, y - hgt, ww, hgt);
  // corner boards
  ctx.fillStyle = css(color === 'white' ? mix(P.houseWhite, P.building, 0.2) : P.trim);
  ctx.fillRect(x, y - hgt, 1.1 * scale, hgt);
  ctx.fillRect(x + ww - 1.1 * scale, y - hgt, 1.1 * scale, hgt);
  // windows with white frames
  const wy = y - hgt * 0.72, wh = hgt * 0.36, wwid = ww * 0.16;
  const wins = [x + ww * 0.14, x + ww * 0.62];
  wins.forEach((wx, j) => {
    if (hl.glow > 0.02) {
      // a soft warm halo around the windows of a heated home
      const g = ctx.createRadialGradient(wx + wwid / 2, wy + wh / 2, 0.5, wx + wwid / 2, wy + wh / 2, wwid * 1.9);
      g.addColorStop(0, css(P.windowWarm, 0.55 * hl.glow));
      g.addColorStop(1, css(P.windowWarm, 0));
      ctx.fillStyle = g;
      ctx.fillRect(wx - wwid * 1.5, wy - wwid * 1.5, wwid * 4, wh + wwid * 3);
    }
    ctx.fillStyle = css(P.trim);
    ctx.fillRect(wx - 0.7, wy - 0.7, wwid + 1.4, wh + 1.4);
    ctx.fillStyle = css(windowCol(P, S, lit, hl.all || (seed + j) % 3 !== 0));
    ctx.fillRect(wx, wy, wwid, wh);
    ctx.fillStyle = css(P.trim);
    ctx.fillRect(wx + wwid / 2 - 0.3, wy, 0.6, wh);
  });
  // door
  ctx.fillStyle = css(mix(wall, P.ink, 0.35));
  ctx.fillRect(x + ww * 0.41, y - hgt * 0.62, ww * 0.13, hgt * 0.62);
  // roof
  const rh = hgt * 0.75;
  ctx.fillStyle = css(color === 'red' && seed % 2 ? mix(P.houseRed, P.ink, 0.4) : P.roofDark);
  poly(ctx, [x - 2 * scale, y - hgt, x + ww / 2, y - hgt - rh, x + ww + 2 * scale, y - hgt]);
  ctx.fill();
  // chimney
  ctx.fillStyle = css(P.brick);
  ctx.fillRect(x + ww * 0.68, y - hgt - rh * 0.85, 2.2 * scale, rh * 0.5);
  if (S.snow > 0.05) {
    ctx.fillStyle = css(P.snow, S.snow);
    poly(ctx, [x - 2 * scale, y - hgt, x + ww / 2, y - hgt - rh - 0.6, x + ww + 2 * scale, y - hgt, x + ww / 2, y - hgt - rh + 2.2 * scale]);
    ctx.fill();
  }
}

function block(ctx, P, S, x, y, w, floors, seed, warm = undefined) {
  const fh = FLOOR_H;
  const hgt = floors * fh + 2;
  const hl = homeLight(P, S, warm);
  const lit = hl.lit;
  if (hl.glow > 0.02) {
    const g = ctx.createRadialGradient(x + w / 2, y - hgt / 2, 1, x + w / 2, y - hgt / 2, Math.max(w, hgt) * 0.75);
    g.addColorStop(0, css(P.windowWarm, 0.32 * hl.glow));
    g.addColorStop(1, css(P.windowWarm, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - w * 0.4, y - hgt * 1.25, w * 1.8, hgt * 1.4);
  }
  ctx.fillStyle = css(P.blockWall);
  ctx.fillRect(x, y - hgt, w, hgt);
  ctx.fillStyle = css(mix(P.blockWall, P.ink, 0.18));
  ctx.fillRect(x + w - 3, y - hgt, 3, hgt);
  const r = rng(seed + 3);
  // two passes (lit / unlit) with one colour each: far fewer style changes for the tall city blocks
  const cols = Math.floor((w - 4) / 4.4);
  const onAt = [];
  for (let i = 0; i < floors * cols; i++) onAt.push(r() > (hl.all ? 0.12 : 0.35));
  for (const on of [false, true]) {
    ctx.fillStyle = css(windowCol(P, S, lit, on));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) if (onAt[f * cols + c] === on) ctx.fillRect(x + 2 + c * 4.4, y - hgt + 2.4 + f * fh, 2.6, 2.6);
    }
  }
  // balcony stripes
  ctx.fillStyle = css(mix(P.blockWall, P.accent, 0.18));
  for (let f = 1; f < floors; f++) ctx.fillRect(x + w * 0.5, y - hgt + f * fh + 4.5, w * 0.36, 1.2);
  ctx.fillStyle = css(mix(P.building, P.ink, 0.2));
  ctx.fillRect(x - 0.5, y - hgt - 1.2, w + 1, 1.4);
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x - 0.5, y - hgt - 2.4, w + 1, 1.3); }
}

function church(ctx, P, S, x, y) {
  const white = P.houseWhite;
  ctx.fillStyle = css(white);
  ctx.fillRect(x + 8, y - 12, 26, 12);
  ctx.fillStyle = css(P.roofDark);
  poly(ctx, [x + 6, y - 12, x + 21, y - 22, x + 36, y - 12]); ctx.fill();
  // tower + spire
  ctx.fillStyle = css(white);
  ctx.fillRect(x, y - 26, 9, 26);
  ctx.fillStyle = css(P.roofDark);
  poly(ctx, [x - 1, y - 26, x + 4.5, y - 44, x + 10, y - 26]); ctx.fill();
  ctx.strokeStyle = css(P.roofDark);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x + 4.5, y - 44); ctx.lineTo(x + 4.5, y - 49);
  ctx.moveTo(x + 2.7, y - 47.3); ctx.lineTo(x + 6.3, y - 47.3);
  ctx.stroke();
  ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, lightLevel(P, S) * 0.8));
  for (let i = 0; i < 3; i++) ctx.fillRect(x + 13 + i * 7, y - 9, 2.4, 5);
  ctx.fillRect(x + 3.2, y - 21, 2.6, 4);
  if (S.snow > 0.05) {
    ctx.fillStyle = css(P.snow, S.snow);
    poly(ctx, [x + 6, y - 12, x + 21, y - 22.6, x + 36, y - 12, x + 21, y - 20]); ctx.fill();
  }
}

function waterTower(ctx, P, S, x, y) {
  const c = mix(P.houseWhite, P.building, 0.3);
  ctx.fillStyle = css(mix(c, P.ink, 0.1));
  ctx.fillRect(x - 2.5, y - 34, 5, 34);
  ctx.fillStyle = css(c);
  poly(ctx, [x - 3, y - 34, x - 13, y - 42, x - 13, y - 48, x + 13, y - 48, x + 13, y - 42, x + 3, y - 34]);
  ctx.fill();
  ctx.fillStyle = css(mix(c, P.ink, 0.15));
  ctx.fillRect(x - 13, y - 49.5, 26, 1.6);
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x - 13, y - 50.5, 26, 1.4); }
}

function shop(ctx, P, S, x, y, w) {
  ctx.fillStyle = css(P.yellowHouse);
  ctx.fillRect(x, y - 10, w, 10);
  ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, lightLevel(P, S)));
  ctx.fillRect(x + 3, y - 7, w - 12, 4);
  ctx.fillStyle = css(P.accent);
  ctx.fillRect(x + 2, y - 12.5, w - 4, 2.6);
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x - 0.5, y - 14, w + 1, 1.4); }
}

export const CHIMNEY_H = 74;

function districtHeatPlant(ctx, P, S, b) {
  const { x, y, w } = b;
  ctx.fillStyle = css(P.brick);
  ctx.fillRect(x, y - 16, w, 16);
  ctx.fillStyle = css(mix(P.brick, P.ink, 0.25));
  ctx.fillRect(x, y - 17.5, w, 2);
  ctx.fillStyle = css(mix(P.glassDay, P.windowWarm, lightLevel(P, S) * 0.9));
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 6.6, y - 13, 3, 7);
  // fuel store / boiler hall
  ctx.fillStyle = css(mix(P.building, P.houseWhite, 0.2));
  ctx.fillRect(x + w, y - 10, 9, 10);
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow); ctx.fillRect(x + w, y - 11.3, 9, 1.4); ctx.fillRect(x, y - 19, w, 1.5); }
  // chimney with red-white aviation stripes
  const cx = x + 5, top = y - CHIMNEY_H;
  ctx.fillStyle = css(mix(P.houseWhite, P.building, 0.3));
  poly(ctx, [cx - 3.4, y - 16, cx - 2.2, top, cx + 2.2, top, cx + 3.4, y - 16]);
  ctx.fill();
  ctx.fillStyle = css(P.houseRed);
  ctx.fillRect(cx - 2.3, top + 3, 4.6, 4);
  ctx.fillRect(cx - 2.4, top + 11, 4.8, 4);
  b.chimney = { x: cx, y: top };
}

/** A far tower of the skyline: hazy (air between), with one window band per floor. */
function skyTower(ctx, P, S, b, haze, bandCol) {
  const hgt = b.floors * FLOOR_H + 2;
  const wall = mix(P.blockWall, P.skyBottom, haze);
  ctx.fillStyle = css(wall);
  ctx.fillRect(b.x, b.y - hgt, b.w, hgt);
  ctx.fillStyle = css(mix(wall, P.ink, 0.1));
  ctx.fillRect(b.x + b.w - 2.4, b.y - hgt, 2.4, hgt);
  ctx.fillStyle = bandCol;
  for (let f = 0; f < b.floors; f++) ctx.fillRect(b.x + 1.6, b.y - hgt + 2.2 + f * FLOOR_H, b.w - 5, 1.5);
  if (S.snow > 0.05) { ctx.fillStyle = css(P.snow, S.snow * 0.8); ctx.fillRect(b.x - 0.4, b.y - hgt - 1.2, b.w + 0.8, 1.2); }
}

/** Countryside left of a village: a field with furrows, a red barn and a spruce edge. */
function countryside(ctx, L, P, S, plan) {
  const xL = L.view.x0 - 4, xR = plan.x0 - 6;
  if (xR - xL < 12) return;
  const y0 = L.yB - 30, y1 = L.yB + 2;
  const col = fieldColor(P, S);
  ctx.fillStyle = css(col);
  poly(ctx, [xL, y0 + 2, xR - 8, y0, xR, y1, xL, y1]);
  ctx.fill();
  ctx.strokeStyle = css(mix(col, P.ink, 0.12), 0.6);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let i = 1; i < 6; i++) { const y = lerp(y0, y1, i / 6); ctx.moveTo(xL, y); ctx.lineTo(lerp(xR - 8, xR, i / 6), y); }
  ctx.stroke();
  const bx = Math.max(xL + 6, xR - 44), by = y0 + 8;
  ctx.fillStyle = css(P.houseRed);
  ctx.fillRect(bx, by - 9, 18, 9);
  ctx.fillStyle = css(P.roofDark);
  poly(ctx, [bx - 2, by - 9, bx + 9, by - 15, bx + 20, by - 9]); ctx.fill();
  if (S.snow > 0.1) { ctx.fillStyle = css(P.snow, S.snow); poly(ctx, [bx - 2, by - 9, bx + 9, by - 15, bx + 20, by - 9, bx + 9, by - 13]); ctx.fill(); }
  const r = rng(63);
  for (let x = xL; x < Math.min(bx - 6, xR); x += 6 + r() * 4) spruce(ctx, P, S, x, y0 + 4 + r() * 3, 13 + r() * 7, 0.35);
}

/** A soft warm light over the district whose homes the data centre heats (stronger in winter). */
function warmDistrictGlow(ctx, L, P, S, plan) {
  const k = plan.warmOn ? winterGlow(S) : 0;
  if (k < 0.05) return;
  const lit = plan.homes.filter((b) => b.warm && b.inView);
  if (!lit.length) return;
  const x0 = Math.min(...lit.map((b) => b.x)) - 8, x1 = Math.max(...lit.map((b) => b.x + b.w)) + 8;
  const ry = 34, rx = Math.max(ry, (x1 - x0) / 2);
  ctx.save();
  ctx.translate((x0 + x1) / 2, L.yB - 16);
  ctx.scale(rx / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, ry);
  g.addColorStop(0, css(P.windowWarm, (P.dark ? 0.34 : 0.3) * k));
  g.addColorStop(0.6, css(P.windowWarm, (P.dark ? 0.16 : 0.13) * k));
  g.addColorStop(1, css(P.windowWarm, 0));
  ctx.fillStyle = g;
  ctx.fillRect(-ry, -ry, ry * 2, ry * 2);
  ctx.restore();
}

/** Draw the far skyline and the back row (behind front houses). */
export function drawTownBack(ctx, L, P, S, plan) {
  if (plan.far.length) {
    const haze = plan.kind === 'city' ? 0.34 : 0.46;
    const band = css(mix(mix(P.glassDay, P.windowWarm, lightLevel(P, S) * 0.8), P.skyBottom, haze * 0.6));
    for (const b of plan.far) if (b.x + b.w > L.view.x0 - 2 && b.x < L.view.x1 + 2) skyTower(ctx, P, S, b, haze, band);
  }
  if (plan.kind === 'village') countryside(ctx, L, P, S, plan);
  warmDistrictGlow(ctx, L, P, S, plan);
  for (const b of plan.back) {
    if (b.x + (b.w || 40) < L.view.x0 - 20 || b.x > L.view.x1 + 20) continue;
    if (b.type === 'water') waterTower(ctx, P, S, b.x, b.y);
    else if (b.type === 'church') church(ctx, P, S, b.x, b.y);
    else if (b.type === 'block') block(ctx, P, S, b.x, b.y, b.w, b.floors, Math.round(b.x), plan.warmOn ? !!b.warm : undefined);
    else if (b.type === 'shop') shop(ctx, P, S, b.x, b.y, b.w);
    else if (b.type === 'house') house(ctx, P, S, b.x, b.y, b.w, b.color, 1, 0.85, plan.warmOn ? !!b.warm : undefined);
  }
  // spruces and birches between rows (more in a village, few in a city)
  const r = rng(41);
  const n = { village: 18, smallTown: 16, regional: 11, city: 6 }[plan.kind] ?? 14;
  const xa = Math.max(plan.x0, L.view.x0 - 10);
  for (let i = 0; i < n; i++) {
    const x = xa + r() * (L.townRight - xa - 10);
    const y = L.yB - 6 - r() * 10;
    if (r() < 0.5) birch(ctx, P, S, x, y, 14 + r() * 8, i);
    else spruce(ctx, P, S, x, y, 13 + r() * 8, 0.3);
  }
}

export function drawTownFront(ctx, L, P, S, plan) {
  const r = rng(52);
  if (plan.dh) districtHeatPlant(ctx, P, S, plan.dh);
  for (const b of plan.front) {
    if (b.x + b.w < L.view.x0 - 20 || b.x > L.view.x1 + 20) { r(); continue; }
    if (b.type === 'block') { block(ctx, P, S, b.x, b.y, b.w, b.floors, Math.round(b.x) + 7, plan.warmOn ? !!b.warm : undefined); continue; }
    house(ctx, P, S, b.x, b.y, b.w, b.color, b.seed, 1, plan.warmOn ? !!b.warm : undefined);
    // a birch in the yard
    if (r() < 0.6) birch(ctx, P, S, b.x + b.w + 4, b.y + 3, 15 + r() * 6, b.seed);
  }
  // flag pole with the Finnish flag at one house (blue cross derived from the accent token)
  const houses = plan.front.filter((b) => b.type === 'house');
  const fh = houses[1] || houses[0];
  if (fh) {
    const fx = fh.x - 3, fy = fh.y;
    ctx.strokeStyle = css(P.houseWhite);
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 26); ctx.stroke();
    ctx.fillStyle = css(P.houseWhite);
    ctx.fillRect(fx, fy - 26, 8, 5);
    ctx.fillStyle = css(mix(P.accent, P.cEnergy, 0.3));
    ctx.fillRect(fx + 2.2, fy - 26, 1.4, 5);
    ctx.fillRect(fx, fy - 24.2, 8, 1.4);
  }
}

/** Animated smoke from the heating plant chimney (and from house chimneys in winter). */
export function drawTownSmoke(ctx, L, P, S, plan, t, heatShare) {
  const dh = plan.dh;
  if (dh && dh.chimney) {
    // the plant burns less in summer; with waste heat arriving it burns a bit less in winter too (illustrative)
    const amount = (0.25 + 0.75 * S.w) * (1 - 0.35 * heatShare);
    puffs(ctx, P, dh.chimney.x, dh.chimney.y - 1, t, 7, amount, 1);
  }
  if (S.w > 0.6) {
    for (const b of plan.front) {
      if (b.type !== 'house' || b.seed % 2) continue;
      const hgt = b.w * 0.55, rh = hgt * 0.75;
      puffs(ctx, P, b.x + b.w * 0.68 + 1.1, b.y - hgt - rh * 0.85, t + b.seed, 3, (S.w - 0.6) * 1.5, 0.45);
    }
  }
}

export function puffs(ctx, P, x, y, t, n, amount, size, col) {
  if (amount <= 0.02) return;
  for (let i = 0; i < n; i++) {
    const life = fract(t * 0.18 + i / n);
    const px = x + life * 26 * size + Math.sin(t + i) * 1.5;
    const py = y - life * 30 * size;
    const rad = (2 + life * 7) * size;
    ctx.fillStyle = css(col || P.smoke, (1 - life) * 0.45 * amount);
    circle(ctx, px, py, rad);
    ctx.fill();
  }
}
