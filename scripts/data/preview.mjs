// Writes a standalone HTML/SVG preview of src/data/mapPaths.js (+ centroids from towns.js) for visual checks.
//   node scripts/data/preview.mjs <out.html> [codes-to-highlight,comma-separated] [--zoom x0,y0,w,h]
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { MAP } = await import(pathToFileURL(join(APP, 'src', 'data', 'mapPaths.js')).href);
const { TOWNS } = await import(pathToFileURL(join(APP, 'src', 'data', 'towns.js')).href);
const out = process.argv[2];
const hi = new Set((process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '').split(',').filter(Boolean));
const zi = process.argv.indexOf('--zoom');
const viewBox = zi > 0 ? process.argv[zi + 1].split(',').join(' ') : MAP.viewBox;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const paths = Object.entries(MAP.paths).map(([c, d], i) => {
  const t = TOWNS.find((x) => x.code === c);
  const fill = hi.has(c) ? '#d9822b' : t?.districtHeat?.has ? `hsl(${(i * 47) % 360} 45% 72%)` : `hsl(${(i * 47) % 360} 25% 86%)`;
  return `<path d="${d}" fill="${fill}" stroke="#555" stroke-width="0.3"><title>${esc(c + ' ' + (t?.name.fi || '?'))}</title></path>`;
}).join('\n');
const dots = TOWNS.map((t) => `<circle cx="${t.centroid[0]}" cy="${t.centroid[1]}" r="1.4" fill="#123"/>`).join('');
const labels = TOWNS.filter((t) => t.population > 60000 || hi.has(t.code)).map((t) => `<text x="${t.centroid[0] + 3}" y="${t.centroid[1] + 3}" font-size="11" font-family="sans-serif">${esc(t.name.fi)}</text>`).join('');
writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Map preview</title>
<style>body{margin:0;background:#cfe3f1}svg{display:block;height:100vh;width:auto;margin:auto;background:#cfe3f1}</style>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
<path d="${MAP.outline}" fill="#fff" stroke="none"/>
${paths}
<path d="${MAP.outline}" fill="none" stroke="#000" stroke-width="0.9"/>
${dots}${labels}
</svg>`);
console.log('wrote', out, Object.keys(MAP.paths).length, 'paths');
