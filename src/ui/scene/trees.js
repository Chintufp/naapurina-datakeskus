// Finnish trees: spruce (kuusi) and birch (koivu), with seasons (snow, bare branches, autumn yellow).
import { css, mix } from './colors.js';
import { lerp } from './util.js';

/** Spruce: stacked triangles; snow on the tiers in winter. x,y = base of trunk, h = height. */
export function spruce(ctx, P, S, x, y, h, shade = 0) {
  const w = h * 0.42;
  const col = mix(P.forestDark, P.forest, 0.35 + shade * 0.5);
  ctx.fillStyle = css(mix(P.forestDark, P.ink, 0.3));
  ctx.fillRect(x - h * 0.03, y - h * 0.14, h * 0.06, h * 0.14);
  ctx.fillStyle = css(col);
  ctx.beginPath();
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t0 = i / tiers;
    const by = y - h * 0.1 - t0 * h * 0.78;
    const bw = w * (1 - t0 * 0.72);
    const ty = by - h * 0.36;
    ctx.moveTo(x - bw / 2, by);
    ctx.lineTo(x, ty);
    ctx.lineTo(x + bw / 2, by);
  }
  ctx.closePath();
  ctx.fill();
  if (S.snow > 0.05) {
    ctx.fillStyle = css(P.snow, S.snow * 0.95);
    ctx.beginPath();
    for (let i = 0; i < tiers; i++) {
      const t0 = i / tiers;
      const by = y - h * 0.1 - t0 * h * 0.78;
      const bw = w * (1 - t0 * 0.72);
      const ty = by - h * 0.36;
      const sx = bw * 0.28;
      ctx.moveTo(x - sx, lerp(ty, by, 0.3) + 1);
      ctx.lineTo(x, ty);
      ctx.lineTo(x + sx, lerp(ty, by, 0.3) + 1);
      ctx.lineTo(x + sx * 0.4, lerp(ty, by, 0.3) + 0.4);
      ctx.lineTo(x - sx * 0.6, lerp(ty, by, 0.32) + 0.4);
    }
    ctx.closePath();
    ctx.fill();
  }
}

/** Birch: white trunk with dark marks, round crown that follows the season. */
export function birch(ctx, P, S, x, y, h, seed = 0) {
  const tw = Math.max(1, h * 0.06);
  ctx.fillStyle = css(P.houseWhite);
  ctx.fillRect(x - tw / 2, y - h * 0.62, tw, h * 0.62);
  ctx.fillStyle = css(P.ink, 0.7);
  for (let i = 0; i < 3; i++) ctx.fillRect(x - tw / 2, y - h * (0.12 + i * 0.17 + (seed % 3) * 0.02), tw * 0.7, Math.max(0.6, h * 0.018));
  // branches visible when bare
  const bare = 1 - S.leaf;
  if (bare > 0.2) {
    ctx.strokeStyle = css(mix(P.ink, P.houseRed, 0.25), 0.55 * bare);
    ctx.lineWidth = Math.max(0.5, h * 0.02);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const by = y - h * (0.45 + i * 0.1);
      const dir = i % 2 ? 1 : -1;
      ctx.moveTo(x, by);
      ctx.lineTo(x + dir * h * (0.22 - i * 0.03), by - h * 0.14);
    }
    ctx.moveTo(x, y - h * 0.6); ctx.lineTo(x, y - h);
    ctx.stroke();
    if (S.snow > 0.3) {
      ctx.fillStyle = css(P.snow, 0.5 * S.snow);
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.72, h * 0.2, h * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (S.leaf > 0.02) {
    let leaf = mix(P.leafGreen, P.leafSpring, S.spring);
    leaf = mix(leaf, P.leafAutumn, S.autumn * (0.75 + ((seed * 37) % 10) / 40));
    ctx.fillStyle = css(leaf, S.leaf);
    ctx.beginPath();
    const cx = x, cy = y - h * 0.68, r = h * 0.24;
    ctx.ellipse(cx, cy, r * 0.95, r * 1.3, 0, 0, Math.PI * 2);
    ctx.moveTo(cx - r * 0.35 + r * 0.7, cy + r * 0.5);
    ctx.ellipse(cx - r * 0.35, cy + r * 0.5, r * 0.7, r * 0.7, 0, 0, Math.PI * 2);
    ctx.moveTo(cx + r * 0.4 + r * 0.65, cy + r * 0.45);
    ctx.ellipse(cx + r * 0.4, cy + r * 0.45, r * 0.65, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Pine (mänty): tall bare trunk, flat crown. */
export function pine(ctx, P, S, x, y, h) {
  ctx.fillStyle = css(mix(mix(P.houseRed, P.building, 0.5), P.ink, 0.35));
  ctx.fillRect(x - h * 0.025, y - h * 0.8, h * 0.05, h * 0.8);
  ctx.fillStyle = css(mix(P.forestDark, P.forest, 0.55));
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.86, h * 0.2, h * 0.11, 0, 0, Math.PI * 2);
  ctx.ellipse(x + h * 0.1, y - h * 0.76, h * 0.14, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  if (S.snow > 0.05) {
    ctx.fillStyle = css(P.snow, S.snow * 0.9);
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.93, h * 0.15, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
