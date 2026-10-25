// Downloads every raw input for the town data into app/data-raw/ (Node >= 18, built-ins only).
//   node scripts/data/fetch.mjs            -> download everything that is missing
//   node scripts/data/fetch.mjs --force    -> re-download everything
// Then:  python -I scripts/data/xlsx2json.py data-raw/KL_Vuositaulukot_25.xlsx data-raw/KL_Vuositaulukot_25.json
//        node scripts/data/build.mjs
// Raw files are treated as untrusted data: they are parsed as JSON/XML only, never executed.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(APP, 'data-raw');
const FORCE = process.argv.includes('--force');

const WFS = 'https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetFeature&outputFormat=json&srsName=EPSG:3067&typeName=tilastointialueet:';

const JOBS = [
  { file: 'wfs-capabilities.xml', url: 'https://geo.stat.fi/geoserver/tilastointialueet/wfs?service=WFS&version=2.0.0&request=GetCapabilities' },
  { file: 'kunta1000k_2026.3067.geojson', url: WFS + 'kunta1000k_2026' },
  { file: 'kunta4500k_2026.3067.geojson', url: WFS + 'kunta4500k_2026' },
  // Kuntien avainluvut 2026 (Statistics Finland): metadata first, then the values.
  { file: 'avainluvut-meta.json', url: 'https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_avainluvut/2026/kuntien_avainluvut_2026_viimeisin.px' },
  {
    file: 'avainluvut.json',
    url: 'https://pxdata.stat.fi/PxWeb/api/v1/fi/Kuntien_avainluvut/2026/kuntien_avainluvut_2026_viimeisin.px',
    body: {
      query: [
        { code: 'Alue', selection: { filter: 'all', values: ['*'] } },
        { code: 'Tiedot', selection: { filter: 'item', values: ['M411', 'M137', 'M162', 'M44', 'M152'] } },
      ],
      response: { format: 'json-stat2' },
    },
  },
  // Employment statistics 115b: number of unemployed (pääasiallinen toiminta 12 = työttömät) per municipality.
  { file: 'tyokay-115b-meta.json', url: 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/tyokay/115b.px' },
  {
    file: 'tyokay-115b.json',
    url: 'https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/tyokay/115b.px',
    body: (meta) => {
      const year = meta.variables.find((v) => v.code === 'timeperiod_y').values.at(-1);
      const alue = meta.variables.find((v) => v.text === 'Alue').code;
      return {
        query: [
          { code: alue, selection: { filter: 'all', values: ['*'] } },
          { code: 'paaasial_toimin_3_20180101', selection: { filter: 'item', values: ['11+12', '11', '12'] } },
          { code: 'sukupuoli_9_20180101', selection: { filter: 'item', values: ['SSS'] } },
          { code: 'ikaryhma_10_20180101', selection: { filter: 'item', values: ['SSS'] } },
          { code: 'timeperiod_y', selection: { filter: 'item', values: [year] } },
        ],
        response: { format: 'json-stat2' },
      };
    },
    metaFile: 'tyokay-115b-meta.json',
  },
  // Verohallinto property tax statistics 2.2 (kive_202): rates and euros by municipality, 2014-2026.
  { file: 'kive_202-meta.json', url: 'https://vero2.stat.fi/PXWeb/api/v1/fi/Vero/Kiinteistoverot/kive_202.px' },
  {
    file: 'kive_202.json',
    url: 'https://vero2.stat.fi/PXWeb/api/v1/fi/Vero/Kiinteistoverot/kive_202.px',
    body: {
      query: [
        { code: 'Alue', selection: { filter: 'all', values: ['*'] } },
        { code: 'Sovellettu kiinteistöveroprosentti', selection: { filter: 'item', values: ['SSSSSS', '7'] } },
        { code: 'Vuosi', selection: { filter: 'all', values: ['*'] } },
        { code: 'Tiedot', selection: { filter: 'item', values: ['Arvo_vero', 'Veroprosentti'] } },
      ],
      response: { format: 'json-stat2' },
    },
  },
  // Energiateollisuus ry, Kaukolämpötilasto 2025 (published 23.10.2026).
  { file: 'KL_Vuositaulukot_25.xlsx', url: 'https://energia.fi/wp-content/uploads/2026/10/KL_Vuositaulukot_25.xlsx', binary: true },
];

const exists = (p) => access(p).then(() => true, () => false);

async function get(job, metaCache) {
  let init = {};
  if (job.body) {
    const body = typeof job.body === 'function' ? job.body(metaCache[job.metaFile]) : job.body;
    init = {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: Buffer.from(JSON.stringify(body), 'utf8'),
    };
  }
  const res = await fetch(job.url, init);
  if (!res.ok) throw new Error(`${job.file}: HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 400));
  return Buffer.from(await res.arrayBuffer());
}

await mkdir(RAW, { recursive: true });
const metaCache = {};
for (const job of JOBS) {
  const out = join(RAW, job.file);
  if (!FORCE && (await exists(out))) {
    console.log('skip (exists)', job.file);
  } else {
    const buf = await get(job, metaCache);
    await writeFile(out, buf);
    console.log('saved', job.file, buf.length, 'bytes');
    await new Promise((r) => setTimeout(r, 400)); // be polite to PxWeb rate limits
  }
  if (job.file.endsWith('-meta.json')) {
    const { readFile } = await import('node:fs/promises');
    metaCache[job.file] = JSON.parse(await readFile(out, 'utf8'));
  }
}
await writeFile(join(RAW, 'fetched-at.txt'), new Date().toISOString() + '\n');
console.log('done');
