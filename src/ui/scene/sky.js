// Layer 1: sky + season light (gradient, sun or moon, stars, aurora, clouds, falling snow).
import { css, mix } from './colors.js';
import { circle, rng, fract, lerp } from './util.js';

/** Static part of the sky (cached). */
export function drawSkyStatic(ctx, L, P, S) {
  const { view, yH } = L;
  const winterTint = S.w * 0.35;
  const top = mix(P.skyTop, P.dark ? P.ink : P.snow, P.dark ? 0.0 : winterTint * 0.4);
  const bottom = mix(P.skyBottom, P.dark ? P.skyTop : P.windowWarm, P.dark ? 0.15 : 0.06 + winterTint * 0.18);
  const g = ctx.createLinearGradient(0, 0, 0, yH + 10);
  g.addColorStop(0, css(top));
  g.addColorStop(1, css(bottom));
  ctx.fillStyle = g;
  ctx.fillRect(view.x0 - 2, -2, view.x1 - view.x0 + 4, yH + 14);

  const sunX = lerp(view.x0, view.x1, 0.8);
  if (P.dark) {
    // stars
    const r = rng(7);
    for (let i = 0; i < 90; i++) {
      const x = lerp(view.x0, view.x1, r());
      const y = r() * (yH - 20);
      ctx.fillStyle = css(P.snow, 0.25 + r() * 0.5);
      ctx.fillRect(x, y, 0.7 + r() * 0.5, 0.7 + r() * 0.5);
    }
    // moon (crescent)
    const my = 26 + S.w * 6;
    ctx.fillStyle = css(P.snow, 0.12);
    circle(ctx, sunX, my, 15); ctx.fill();
    ctx.fillStyle = css(mix(P.snow, P.windowWarm, 0.2), 0.95);
    circle(ctx, sunX, my, 8); ctx.fill();
    ctx.fillStyle = css(top);
    circle(ctx, sunX + 3.6, my - 2, 7); ctx.fill();
  } else {
    // sun: low in winter, high in summer
    const sy = yH - 18 - (1 - S.w) * Math.min(120, yH - 40);
    const sun = mix(P.windowWarm, P.snow, 0.45);
    const halo = ctx.createRadialGradient(sunX, sy, 2, sunX, sy, 46);
    halo.addColorStop(0, css(sun, 0.55));
    halo.addColorStop(1, css(sun, 0));
    ctx.fillStyle = halo;
    circle(ctx, sunX, sy, 46); ctx.fill();
    ctx.fillStyle = css(mix(sun, P.snow, 0.2));
    circle(ctx, sunX, sy, 10); ctx.fill();
  }
}

/** Aurora in dark winter skies: soft curtains that sway slowly. */
export function drawAurora(ctx, L, P, S, t) {
  if (!P.dark || S.w < 0.6) return;
  const a = (S.w - 0.6) / 0.4;
  const { view, yH } = L;
  const w = view.x1 - view.x0;
  const N = 40;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let band = 0; band < 2; band++) {
    const col = band ? P.cFuture : P.cWater;
    const baseY = yH * (0.42 + band * 0.12);
    const bottom = [], top = [];
    for (let i = 0; i <= N; i++) {
      const x = view.x0 + (i / N) * w;
      const y = baseY + Math.sin(i * 0.28 + t * 0.22 + band * 2) * 9 + Math.sin(i * 0.09 - t * 0.08) * 12;
      const hgt = 30 + 16 * Math.sin(i * 0.37 + t * 0.3 + band);
      bottom.push([x, y]);
      top.push([x, y - hgt]);
    }
    const g = ctx.createLinearGradient(0, baseY - 60, 0, baseY + 20);
    g.addColorStop(0, css(col, 0));
    g.addColorStop(0.6, css(col, 0.1 * a));
    g.addColorStop(0.85, css(col, 0.2 * a));
    g.addColorStop(1, css(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1] + 8);
    ctx.closePath();
    ctx.fill();
    // faint vertical rays
    ctx.strokeStyle = css(col, 0.03 * a);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= N; i += 2) {
      const [x, y] = bottom[i];
      ctx.moveTo(x, y + 4); ctx.lineTo(x + 2, top[i][1] - 6);
    }
    ctx.stroke();
  }
  ctx.restore();
}

const CLOUDS = [
  { x: 0.08, y: 0.22, s: 1.0, v: 2.2 },
  { x: 0.42, y: 0.12, s: 0.75, v: 1.6 },
  { x: 0.66, y: 0.3, s: 1.2, v: 2.8 },
  { x: 0.9, y: 0.16, s: 0.6, v: 1.3 },
];

export function drawClouds(ctx, L, P, S, t) {
  const { view, yH } = L;
  const w = view.x1 - view.x0 + 120;
  const alpha = P.dark ? 0.55 : 0.85;
  for (const c of CLOUDS) {
    const x = view.x0 - 60 + fract(c.x + (t * c.v) / w) * w;
    const y = 18 + c.y * (yH - 60);
    const s = c.s * (1 + S.w * 0.25);
    ctx.fillStyle = css(P.cloud, alpha);
    ctx.beginPath();
    for (const [dx, dy, r] of [[0, 0, 11], [12, -5, 13], [25, 0, 10], [-10, 4, 7], [35, 4, 7], [5, 6, 8], [20, 6, 8]]) {
      ctx.moveTo(x + dx * s + r * s, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}

/** Falling snow (only in deep winter). */
export function drawSnowfall(ctx, L, P, S, t) {
  const amount = Math.max(0, (S.w - 0.78) / 0.22);
  if (amount <= 0) return;
  const { view, Hw } = L;
  const w = view.x1 - view.x0;
  const r = rng(99);
  const n = Math.round(110 * amount);
  ctx.fillStyle = css(P.snow, 0.9);
  // one path for all flakes (one fill call instead of ~100)
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const sp = 10 + r() * 14;
    const x0 = r() * w, y0 = r() * Hw, ph = r() * 6;
    const y = (y0 + t * sp) % (Hw + 6) - 3;
    const x = view.x0 + ((x0 + Math.sin(t * 0.8 + ph) * 4 + t * 3) % w + w) % w;
    const rad = 0.7 + (i % 3) * 0.35;
    ctx.moveTo(x + rad, y);
    ctx.arc(x, y, rad, 0, Math.PI * 2);
  }
  ctx.fill();
}

/** Migrating birds in spring and autumn (a V of cranes/geese drifting across). */
export function drawBirds(ctx, L, P, S, t) {
  const spring = S.s > 0.27 && S.s < 0.4, autumn = S.s > 0.7 && S.s < 0.84;
  if (!spring && !autumn) return;
  const { view, yH } = L;
  const w = view.x1 - view.x0 + 80;
  const dir = autumn ? -1 : 1; // south in autumn (to the left), north in spring
  const u = fract(t * 0.012);
  const cx = dir > 0 ? view.x0 - 40 + u * w : view.x1 + 40 - u * w;
  const cy = yH * 0.42;
  ctx.strokeStyle = css(P.dark ? P.snow : P.ink, 0.55);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = -4; i <= 4; i++) {
    const bx = cx - dir * Math.abs(i) * 7, by = cy + i * 4;
    const flap = Math.sin(t * 5 + i) * 1.2;
    ctx.moveTo(bx - 2.5, by - flap);
    ctx.quadraticCurveTo(bx - 1, by - 1.5, bx, by);
    ctx.quadraticCurveTo(bx + 1, by - 1.5, bx + 2.5, by - flap);
  }
  ctx.stroke();
}
