// Small math + drawing helpers shared by the scene layers.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fract = (v) => v - Math.floor(v);
/** Smooth 0→1 step between a and b. */
export function smooth(a, b, v) {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** 0..1 position of v between lo and hi on a log scale. */
export const logNorm = (v, lo, hi) => clamp(Math.log(Math.max(v, 1e-9) / lo) / Math.log(hi / lo), 0, 1);

/** Seeded PRNG (mulberry32) so the town looks the same on every frame and every visit. */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rrect(ctx, x, y, w, h, r, keepPath = false) {
  if (!(w > 0) || !(h > 0)) { if (!keepPath) ctx.beginPath(); return; }
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (!keepPath) ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}

/** Point on a quadratic curve. */
export function quadAt(x0, y0, cx, cy, x1, y1, t) {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

/**
 * Seasonal helpers. season: 0 = midwinter, 0.5 = midsummer, 1 = midwinter again.
 * winter(): 1 in midwinter, 0 in midsummer. snow(): how much snow lies on the ground.
 */
export function seasonInfo(season) {
  const s = fract(season);
  const w = (1 + Math.cos(2 * Math.PI * s)) / 2;
  const snow = smooth(0.62, 0.8, w);
  // birch foliage: 0 bare, 1 full; autumn = how yellow the leaves are
  const leaf = smooth(0.3, 0.4, s) * (1 - smooth(0.8, 0.86, s));
  const autumn = smooth(0.66, 0.76, s);
  const spring = 1 - smooth(0.38, 0.46, s);
  let name = 'winter';
  if (s >= 0.2 && s < 0.42) name = 'spring';
  else if (s >= 0.42 && s < 0.68) name = 'summer';
  else if (s >= 0.68 && s < 0.88) name = 'autumn';
  return { s, w, snow, leaf, autumn, spring, name };
}

/** How strongly the warm windows of homes heated by the data centre show: 0 in summer, 1 in deep winter. */
export const winterGlow = (S) => smooth(0.38, 0.75, S.w);
