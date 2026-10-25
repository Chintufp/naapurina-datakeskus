# Naapurina datakeskus — A data centre next door

**FI:** Valitse oma kuntasi, suunnittele datakeskus ja katso, mitä se tarkoittaisi juuri teillä: sähkö, lämpö, vesi, työpaikat, liikenne, melu ja maa. Jokainen luku on vaihteluväli, ja jokaisen takana on lähde.

**EN:** Pick your own municipality, design a data centre and see what it would mean right there: electricity, heat, water, jobs, traffic, noise and land. Every number is a range, and every range has a source.

*Same data centre, different town, different story.* Built at the Tampere hackathon, October 2026, for the Despro Engineering challenge "Datakeskusten jäljillä / On the trail of data centres".

## Run it

**Offline, nothing to install:** open `dist/naapurina-datakeskus.html` in any modern browser (double-click it). The whole app is in that one file. Without internet the fonts fall back to system fonts; everything else works.

**From the source** (Node 18 or newer, no `npm install` needed):

```bash
node scripts/serve.mjs
```

Then open http://localhost:5173. Use `node scripts/serve.mjs 8080` for another port.

**Online:** https://chintufp.github.io/naapurina-datakeskus/ (GitHub Pages, served straight from this repository's `main` branch). Real projects open directly, for example https://chintufp.github.io/naapurina-datakeskus/#hanke-jarvenpaa-dc.

The live demo script and Q&A prep are in `DEMO.md`.

## What's in it

| View | Hash | What it does |
| --- | --- | --- |
| Koti / Home | `#koti` | Map of Finland's 308 municipalities and real projects; pick your town; the same 50 MW data centre compared across six towns |
| Simulaattori / Simulator | `#simulaattori` | Five steps: town → design (size, cooling, waste heat, site, distance) → guess first → run 30 years (planning, construction, operation) with a living town scene → your own view |
| Aiheet / Topics | `#aiheet` | Seven themes, each with possible benefits, possible drawbacks and what is still unknown, with sources |
| Lähteet / Sources | `#lahteet` | Every fact card with its source, where sources disagree, what nobody knows yet, and the calculation coefficients |
| Koko Suomi / All of Finland | `#suomi` | What many data centres together mean for Finland's electricity, grid and taxes |
| Näin laskemme / Method | `#menetelma` | Formulas, data licences, limitations and how the tool could be developed |

## How the numbers are made

The app does not predict the future. It calculates what the chosen design would mean, using numbers taken from sources:

1. Each coefficient (for example PUE, jobs per MW, water per kWh) has a low, typical and high value, each with its source (`src/model/coefficients.js`).
2. The model runs the same case 400 times, drawing each uncertain coefficient between its low and high value (triangular distribution, fixed seed, so results are repeatable).
3. The app shows the middle 80 % of the results (10th–90th percentile) as the range, and the median as the typical value.
4. Every number carries a label: **measured** (reported from a real project or statistic), **estimate** (a forecast, plan or assessment by a project, an authority or a consultant), **calculated** (our calculation from sourced coefficients) or **opinion** (someone's view), plus the strength of the evidence.
5. The **Miksi? / Why?** button on every result shows the formula, the coefficients and their sources. You can pin a coefficient to its low, typical or high value to see what changes.
6. When a real project has not published a design choice (for example its size), the simulator says so at the top of the results and marks the cards that rest on that assumption with **Oletus / Assumption**.

## Folder structure

```
index.html                 entry page (loads src/main.js as an ES module)
src/
  main.js, store.js, i18n.js   app shell, state, Finnish/English text
  data/towns.js            308 municipalities: population, households, jobs, unemployment, property tax, district heat
  data/mapPaths.js         simplified municipal boundaries for the map
  model/coefficients.js    every coefficient with low/typ/high, unit, sources
  model/model.js           simulate(design, town) and finlandScenario(GW)
  content/                 facts, debates, unknowns, real projects, themes, personas, glossary
  ui/                      views, simulator panels, the town scene (canvas), components
  styles/                  design tokens (light and dark), base, pages, simulator, scene
  i18n/                    dictionaries (dict-core, dict-sim, dict-pages)
scripts/
  serve.mjs                tiny static server
  build-single.mjs         packs everything into dist/ as one HTML file
  data/                    fetch and rebuild the municipal data
dist/                      the single-file builds
../research/               research notes with all sources
```

## Tests

```bash
node src/model/model.test.mjs
```

```bash
node scripts/data/towns.test.mjs
```

## Rebuild the single file

```bash
node scripts/build-single.mjs
```

It uses `npx esbuild@0.25.0`, or an esbuild binary if `ND_ESBUILD` points to one. Output: `dist/naapurina-datakeskus.html` (full page) and `dist/artifact.html` (the same content without the page wrapper, for publishing).

## Update the municipal data

```bash
node scripts/data/fetch.mjs
```

```bash
python scripts/data/xlsx2json.py data-raw/KL_Vuositaulukot_25.xlsx data-raw/KL_Vuositaulukot_25.json
```

```bash
node scripts/data/build.mjs
```

## Data and licences

- Statistics Finland (Tilastokeskus): municipal key figures 2026, employment table 115b, municipal boundaries `kunta1000k_2026` — CC BY 4.0
- Finnish Tax Administration (Verohallinto): property tax statistics 2026 — source: Verohallinto
- Finnish Energy (Energiateollisuus ry): district heating statistics 2025, tables 1 and 8 — source: Energiateollisuus ry
- Fingrid: electricity consumption and forecasts — CC BY 4.0
- Coefficients and facts: environmental impact assessments (YVA), authorities, research, news and company releases; each source is named, dated and linked next to the number it supports.

Content checked against sources on 24 October 2026. Company figures are marked as the company's own statements.
