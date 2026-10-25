// Reads the scene palette from the CSS tokens (tokens.css) and derives the extra shades the
// drawing needs with mix(), so light and dark themes both come from the design tokens.

const TOKENS = [
  'bg', 'surface', 'surface-2', 'ink', 'ink-2', 'ink-3', 'line', 'line-strong', 'accent', 'heat',
  'c-energy', 'c-heat', 'c-water', 'c-land', 'c-jobs', 'c-traffic', 'c-safety', 'c-future',
  'sky-top', 'sky-bottom', 'ground', 'snow', 'forest', 'forest-dark', 'field',
  'house-red', 'house-white', 'building', 'window-warm',
];

// Safety net only (used if a token is missing, e.g. a page that forgot tokens.css): mid greys.
const NEUTRAL = [128, 136, 140];

function parseColor(raw) {
  if (!raw) return null;
  const v = raw.trim();
  let m = v.match(/^#([0-9a-f]{3,8})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = hex.split('').map((c) => c + c).join('');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}

const camel = (k) => k.replace(/-(\w)/g, (_, c) => c.toUpperCase());

/** Mix two rgb arrays: t = 0 → a, 1 → b. */
export function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** rgb array (+ alpha) → CSS colour string. */
export function css(c, a = 1) {
  const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
  return a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.max(0, a).toFixed(3)})`;
}

const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

export function readPalette(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const P = {};
  for (const k of TOKENS) P[camel(k)] = parseColor(cs.getPropertyValue('--' + k)) || NEUTRAL;
  P.fontBody = (cs.getPropertyValue('--font-body') || '').trim() || 'system-ui, sans-serif';
  P.fontDisplay = (cs.getPropertyValue('--font-display') || '').trim() || P.fontBody;
  P.dark = lum(P.bg) < 0.35;

  // derived shades (all from tokens)
  P.earth = mix(mix(P.field, P.forestDark, 0.5), P.houseRed, 0.18);
  P.asphalt = mix(P.building, P.ink, P.dark ? 0.15 : 0.35);
  P.roadLine = mix(P.houseWhite, P.windowWarm, 0.15);
  P.hallWall = P.dark ? mix(P.houseWhite, P.building, 0.45) : mix(P.houseWhite, P.building, 0.22);
  P.hallTop = mix(P.hallWall, P.building, 0.35);
  P.hallSide = mix(P.hallWall, P.ink, 0.22);
  P.steel = mix(P.building, P.ink, 0.25);
  P.crane = mix(P.windowWarm, P.heat, 0.3);
  P.hivis = mix(P.windowWarm, P.heat, 0.15);
  P.brick = mix(P.houseRed, P.building, 0.4);
  P.roofDark = mix(P.ink, P.building, 0.45);
  P.trim = P.houseWhite;
  P.glassDay = mix(P.skyTop, P.building, 0.55);
  P.lake = P.dark ? mix(P.skyBottom, P.accent, 0.25) : mix(P.skyTop, P.accent, 0.28);
  P.ice = mix(P.snow, P.skyTop, 0.35);
  P.hillFar = mix(P.forestDark, P.skyBottom, P.dark ? 0.55 : 0.62);
  P.hillMid = mix(P.forestDark, P.skyBottom, P.dark ? 0.32 : 0.4);
  P.smoke = mix(P.houseWhite, P.building, 0.35);
  P.vapour = P.dark ? mix(P.snow, P.skyBottom, 0.25) : mix(P.snow, P.building, 0.16);
  P.cloud = P.dark ? mix(P.skyBottom, P.building, 0.35) : mix(P.snow, P.skyBottom, 0.2);
  P.leafGreen = mix(P.forest, P.field, 0.42);
  P.leafSpring = mix(mix(P.forest, P.field, 0.55), P.snow, 0.18);
  P.leafAutumn = mix(P.windowWarm, P.heat, 0.25);
  P.grassSummer = mix(P.ground, P.forest, P.dark ? 0.25 : 0.32);
  P.yellowHouse = mix(P.windowWarm, P.houseWhite, 0.55);
  P.blockWall = P.dark ? mix(P.houseWhite, P.building, 0.5) : mix(P.houseWhite, P.building, 0.15);
  P.shadow = P.ink;
  P.crate = mix(P.field, P.houseRed, 0.2);   // wooden crates of old equipment (refresh)
  return P;
}
