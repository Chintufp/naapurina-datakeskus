// Geometry helpers for the municipality map (Node built-ins only).
// - buildTopology(): splits polygon rings into shared arcs (like TopoJSON) so neighbours are
//   simplified identically and no gaps/overlaps appear between municipalities.
// - simplifyArcs(): Visvalingam-Whyatt on every arc, endpoints (junctions) always kept.
// - polylabel(): pole of inaccessibility = a label point guaranteed inside a polygon.

const key = (p) => p[0] + ',' + p[1];

/** features: [{ id, polygons: [[ring[[x,y]...]...]...] }] with integer coordinates, rings closed. */
export function buildTopology(features) {
  const rings = []; // { fid, poly, idx, pts (open, no repeated last point) }
  features.forEach((f, fi) => {
    f.polygons.forEach((poly, pi) => {
      poly.forEach((ring, ri) => {
        const pts = [];
        for (const p of ring) {
          const last = pts[pts.length - 1];
          if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
        }
        if (pts.length > 1 && key(pts[0]) === key(pts[pts.length - 1])) pts.pop();
        if (pts.length >= 3) rings.push({ fid: fi, poly: pi, idx: ri, pts });
      });
    });
  });

  // Which rings use each undirected edge.
  const edgeKey = (a, b) => { const ka = key(a), kb = key(b); return ka < kb ? ka + '|' + kb : kb + '|' + ka; };
  const edgeUse = new Map();
  rings.forEach((r, id) => {
    const n = r.pts.length;
    for (let i = 0; i < n; i++) {
      const k = edgeKey(r.pts[i], r.pts[(i + 1) % n]);
      const s = edgeUse.get(k) || [];
      if (!s.includes(id)) s.push(id);
      edgeUse.set(k, s);
    }
  });
  const sig = (r, i) => {
    const n = r.pts.length;
    return edgeUse.get(edgeKey(r.pts[i], r.pts[(i + 1) % n])).slice().sort((a, b) => a - b).join(',');
  };

  const arcs = []; // arrays of points
  const arcIndex = new Map(); // canonical string -> arc id
  const arcUse = []; // count of rings using the arc
  const canon = (pts) => pts.map(key).join(';');

  function addArc(pts, closed) {
    let p = pts;
    if (closed) {
      // rotate so it starts at the smallest key, and pick a canonical direction
      const open = p.slice(0, -1);
      let m = 0;
      for (let i = 1; i < open.length; i++) if (key(open[i]) < key(open[m])) m = i;
      const rot = open.slice(m).concat(open.slice(0, m));
      const fwd = rot.concat([rot[0]]);
      const rev = [rot[0]].concat(rot.slice(1).reverse(), [rot[0]]);
      const cf = canon(fwd), cr = canon(rev);
      if (arcIndex.has(cf)) { arcUse[arcIndex.get(cf)]++; return { arc: arcIndex.get(cf), rev: false, rot: m }; }
      if (arcIndex.has(cr)) { arcUse[arcIndex.get(cr)]++; return { arc: arcIndex.get(cr), rev: true, rot: m }; }
      arcs.push(fwd); arcUse.push(1); arcIndex.set(cf, arcs.length - 1);
      return { arc: arcs.length - 1, rev: false, rot: m };
    }
    const cf = canon(p);
    const cr = canon(p.slice().reverse());
    if (arcIndex.has(cf)) { arcUse[arcIndex.get(cf)]++; return { arc: arcIndex.get(cf), rev: false }; }
    if (arcIndex.has(cr)) { arcUse[arcIndex.get(cr)]++; return { arc: arcIndex.get(cr), rev: true }; }
    arcs.push(p); arcUse.push(1); arcIndex.set(cf, arcs.length - 1);
    return { arc: arcs.length - 1, rev: false };
  }

  rings.forEach((r) => {
    const n = r.pts.length;
    const sigs = r.pts.map((_, i) => sig(r, i));
    const cuts = [];
    for (let i = 0; i < n; i++) if (sigs[(i - 1 + n) % n] !== sigs[i]) cuts.push(i);
    r.arcs = [];
    if (!cuts.length) {
      r.arcs.push(addArc(r.pts.concat([r.pts[0]]), true));
      return;
    }
    for (let c = 0; c < cuts.length; c++) {
      const a = cuts[c], b = cuts[(c + 1) % cuts.length];
      const seg = [];
      let i = a;
      do { seg.push(r.pts[i]); i = (i + 1) % n; } while (i !== b);
      seg.push(r.pts[b]);
      r.arcs.push(addArc(seg, false));
    }
  });
  return { rings, arcs, arcUse };
}

function triArea(a, b, c) {
  return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
}

/** Visvalingam-Whyatt effective areas for an open polyline (endpoints = Infinity). */
export function effectiveAreas(pts) {
  const n = pts.length;
  const area = new Array(n).fill(Infinity);
  if (n < 3) return area;
  const prev = pts.map((_, i) => i - 1), next = pts.map((_, i) => i + 1);
  // simple binary heap
  const heap = [];
  const push = (it) => { heap.push(it); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].a <= heap[i].a) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].a < heap[m].a) m = l; if (r < heap.length && heap[r].a < heap[m].a) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const cur = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) { cur[i] = triArea(pts[i - 1], pts[i], pts[i + 1]); push({ i, a: cur[i] }); }
  let maxA = 0;
  const removed = new Array(n).fill(false);
  while (heap.length) {
    const it = pop();
    if (removed[it.i] || it.a !== cur[it.i]) continue;
    const i = it.i;
    // effective area is monotonic: never smaller than a previously eliminated point
    maxA = Math.max(maxA, it.a);
    area[i] = maxA;
    removed[i] = true;
    const p = prev[i], q = next[i];
    next[p] = q; prev[q] = p;
    if (p > 0) { cur[p] = triArea(pts[prev[p]], pts[p], pts[q]); push({ i: p, a: cur[p] }); }
    if (q < n - 1) { cur[q] = triArea(pts[p], pts[q], pts[next[q]]); push({ i: q, a: cur[q] }); }
  }
  return area;
}

/** Keep points with effective area >= minArea. Closed arcs keep at least 4 points (3 distinct). */
export function simplifyArc(pts, areas, minArea) {
  const closed = pts.length > 3 && key(pts[0]) === key(pts[pts.length - 1]);
  let keep = pts.filter((_, i) => areas[i] >= minArea);
  if (closed && keep.length < 4) {
    const order = pts.map((_, i) => i).slice(1, -1).sort((a, b) => areas[b] - areas[a]).slice(0, 2).sort((a, b) => a - b);
    keep = [pts[0], ...order.map((i) => pts[i]), pts[pts.length - 1]];
  }
  return keep;
}

export function ringArea(pts) {
  let s = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInPolygon(x, y, polygon) {
  if (!pointInRing(x, y, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) if (pointInRing(x, y, polygon[i])) return false;
  return true;
}

function segDistSq(px, py, a, b) {
  let x = a[0], y = a[1], dx = b[0] - x, dy = b[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = b[0]; y = b[1]; } else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = px - x; dy = py - y;
  return dx * dx + dy * dy;
}

function signedDist(x, y, polygon) {
  let min = Infinity;
  for (const ring of polygon) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) min = Math.min(min, segDistSq(x, y, ring[i], ring[j]));
  return (pointInPolygon(x, y, polygon) ? 1 : -1) * Math.sqrt(min);
}

/** Pole of inaccessibility (after Mapbox polylabel, ISC licence; re-implemented). polygon = [outer, ...holes]. */
export function polylabel(polygon, precision = 0.2) {
  const outer = polygon[0];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outer) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const w = maxX - minX, h = maxY - minY;
  const size = Math.min(w, h);
  const cell = (x, y, half) => { const d = signedDist(x, y, polygon); return { x, y, h: half, d, max: d + half * Math.SQRT2 }; };
  if (size === 0) return [minX, minY];
  // area centroid as the first guess
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) { const f = outer[i][0] * outer[j][1] - outer[j][0] * outer[i][1]; cx += (outer[i][0] + outer[j][0]) * f; cy += (outer[i][1] + outer[j][1]) * f; a += f * 3; }
  let best = a ? cell(cx / a, cy / a, 0) : cell(outer[0][0], outer[0][1], 0);
  const bbox = cell(minX + w / 2, minY + h / 2, 0);
  if (bbox.d > best.d) best = bbox;
  const queue = [];
  const half = size / 2;
  for (let x = minX; x < maxX; x += size) for (let y = minY; y < maxY; y += size) queue.push(cell(x + half, y + half, half));
  while (queue.length) {
    let bi = 0;
    for (let i = 1; i < queue.length; i++) if (queue[i].max > queue[bi].max) bi = i;
    const c = queue.splice(bi, 1)[0];
    if (c.d > best.d) best = c;
    if (c.max - best.d <= precision) continue;
    const hh = c.h / 2;
    queue.push(cell(c.x - hh, c.y - hh, hh), cell(c.x + hh, c.y - hh, hh), cell(c.x - hh, c.y + hh, hh), cell(c.x + hh, c.y + hh, hh));
  }
  return [best.x, best.y, best.d];
}
