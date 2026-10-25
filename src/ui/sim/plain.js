// Plain-language sentences for the simulator's metric cards and the "Why?" drawer (sim-results).
//   plainSentence(metric, value, ctx) → one everyday sentence about the value shown on the card ('' when none fits).
//   plainUses(key)                    → the comparison keys a sentence already uses (the card does not repeat them).
//   heatPumpNote(sim, value)          → the heat-pump electricity line for the heatUsed card ('' when none).
//   plainWhy(key)                     → a short plain explanation of what the number is, for the top of the drawer.
// Everyday conversions reuse the model's own comparisons, scaled to the value shown, so the sentence always agrees
// with the number next to it. No new facts here: guideline values come from COEF (VNp 993/1992). Outdoor noise is
// compared with the outdoor guidelines only, never with indoor sounds (the everyday levels in content/everyday.js are
// indoor examples, so the noise card no longer uses them).
//   noiseGuideSentences(v) → the noise range against each guideline (array of sentences).
//   noiseNightSentence(v)  → the 50 dB night-guideline sentence only.
//   assumedHeatSentence(alt) → the heat card's sentence when the project has not published its heat reuse.
import { L } from '../../i18n.js';
import * as everydayMod from '../../content/everyday.js';
import { fillTemplate } from '../format.js';
import { COEF } from '../../model/coefficients.js';
import { fmtRangeUnit } from './compute.js';

/** Source of the everyday noise levels (kept for other callers; the noise card no longer shows indoor examples). */
export const noiseLevelsSource = () => everydayMod.NOISE_LEVELS_SOURCE || null;

const fin = (v) => Number.isFinite(v);

/** The model comparison `ck`, scaled from the metric's headline to `value` (each end by its own ratio). */
function scaledComparison(metric, ck, value) {
  const c = (Array.isArray(metric?.comparisons) ? metric.comparisons : []).find((x) => x && x.key === ck);
  if (!c || !value) return null;
  const hl = metric.headline || {};
  const typRatio = hl.typ > 0 && fin(value.typ) ? value.typ / hl.typ : 1;
  const ratio = (end) => (hl[end] > 0 && fin(value[end]) ? value[end] / hl[end] : typRatio);
  const ends = [c.low * ratio('low'), c.typ * ratio('typ'), c.high * ratio('high')].map((v) => (fin(v) ? v : 0)).sort((a, b) => a - b);
  return { ...c, low: ends[0], typ: ends[1], high: ends[2] };
}

const fill = (tpl, values) => (values ? fillTemplate(tpl, values) : '');
const isZeroish = (v) => !v || (Math.abs(v.typ || 0) < 1e-9 && Math.abs(v.high || 0) < 1e-9);

// ---------- noise against the guidelines (VNp 993/1992, values from COEF) ----------
// Each guideline has three cases: the whole range above it, only the top above it, or below it (with the margin).
// The ends are rounded as the card shows them (whole dB), so the sentence never contradicts the number next to it.
const GUIDE = () => ({
  night: COEF?.['noise.guideNight']?.typ ?? 50,
  newNight: 45, // new residential areas at night (COEF 'noise.guideNight' explain; VNp 993/1992)
  nature: COEF?.['noise.guideNatureNight']?.typ ?? 40,
  day: COEF?.['noise.guideDay']?.typ ?? 55,
});
const GUIDE_NAME = {
  night: (g) => ({ fi: `asuinalueen yöajan ohjearvon ${g} dB`, en: `the ${g} dB night guideline for homes` }),
  newNight: (g) => ({ fi: `uusien asuinalueiden yöajan ohjearvon ${g} dB`, en: `the ${g} dB night guideline for new residential areas` }),
  nature: (g) => ({ fi: `loma-asuntojen yöajan ohjearvon ${g} dB`, en: `the ${g} dB night guideline for holiday homes` }),
  day: (g) => ({ fi: `asuinalueen päiväajan ohjearvon ${g} dB`, en: `the ${g} dB day guideline for homes` }),
};

/** 'all' (whole range above) | 'top' (only the top above) | 'at' (the top equals it) | 'below'. */
function guideStatus(v, g) {
  const lo = Math.round(v.low);
  const hi = Math.round(v.high);
  if (lo > g) return 'all';
  if (hi > g) return 'top';
  if (hi === g) return 'at';
  return 'below';
}
const isOver = (st) => st === 'all' || st === 'top';
const dbSpan = (a, b) => (a === b ? `${a}` : `${a}–${b}`);
const lc = (s) => s[0].toLowerCase() + s.slice(1);

/** One sentence for one guideline, in the three cases (plus "at" when the top equals it). */
function guideSentence(key, v, g, { also = false } = {}) {
  const n = GUIDE_NAME[key](g);
  const st = guideStatus(v, g);
  const my = also ? { fi: ' myös', en: ' also' } : { fi: '', en: '' };
  if (st === 'all') return L({ fi: `Koko vaihteluväli ylittää${my.fi} ${n.fi}.`, en: `The whole range is${my.en} above ${n.en}.` });
  if (st === 'top') return L({ fi: `Vaihteluvälin yläpää ylittää${my.fi} ${n.fi}.`, en: `The top of the range is${my.en} above ${n.en}.` });
  if (st === 'at') return L({ fi: `Vaihteluvälin yläpää on${my.fi} ${n.fi} tasalla.`, en: `The top of the range${my.en} equals ${n.en}.` });
  const m = dbSpan(Math.max(0, g - Math.round(v.high)), Math.max(0, g - Math.round(v.low)));
  return also
    ? L({ fi: `Se jää noin ${m} dB myös ${n.fi} alapuolelle.`, en: `It is also about ${m} dB below ${n.en}.` })
    : L({ fi: `Melu jää noin ${m} dB ${n.fi} alapuolelle.`, en: `That is about ${m} dB below ${n.en}.` });
}

const ABATE = { fi: 'Tällainen hanke tarvitsisi meluntorjuntaa ja melumallinnuksen lupaa varten.', en: 'A project like this would need noise abatement, and noise modelling for its permit.' };
const TONAL = { fi: 'Jos humina on kapeakaistaista (tasainen vinkuna), siihen lisätään 5 dB ennen vertailua ohjearvoon (VNp 993/1992).', en: 'If the hum is tonal (a steady whine), 5 dB is added before comparing it with the guideline (Government Decision 993/1992).' };

/**
 * The operating noise { low, high } (dB outdoors at the homes) against the guidelines: the 50 dB night guideline
 * first, then the 45 dB (new residential areas) and 40 dB (holiday homes) night values and the 55 dB day value where
 * they add something, one neutral line when a guideline is exceeded, and the tonal-noise rule when the level is within
 * 5 dB of a guideline. Returns an array of sentences ([] for missing values).
 */
export function noiseGuideSentences(v) {
  if (!fin(v?.low) || !fin(v?.high)) return [];
  const G = GUIDE();
  const hi = Math.round(v.high);
  const out = [];
  const night = guideStatus(v, G.night);
  out.push(guideSentence('night', v, G.night));
  // a whole range above 50 dB is also above the stricter 45 and 40 dB values: no need to list them
  let newSt = null;
  let natSt = null;
  if (night !== 'all') {
    newSt = guideStatus(v, G.newNight);
    natSt = guideStatus(v, G.nature);
    if (newSt === natSt && (newSt === 'all' || newSt === 'below')) {
      // the same case for both stricter values: one sentence
      const both = { fi: `uusien asuinalueiden (${G.newNight} dB) ja loma-asuntojen (${G.nature} dB) yöajan ohjearvo`, en: `the night guidelines for new residential areas (${G.newNight} dB) and holiday homes (${G.nature} dB)` };
      out.push(newSt === 'all'
        ? L({ fi: `Koko vaihteluväli ylittää ${both.fi}t.`, en: `The whole range is above ${both.en}.` })
        : L({ fi: `Se jää myös ${both.fi}jen alapuolelle.`, en: `It is also below ${both.en}.` }));
    } else {
      out.push(guideSentence('newNight', v, G.newNight, { also: night === 'below' && newSt === 'below' }));
      out.push(guideSentence('nature', v, G.nature));
    }
  }
  const day = guideStatus(v, G.day);
  if (isOver(night) || night === 'at' || isOver(day)) {
    out.push(day === 'below'
      ? L({ fi: `Asuinalueen päiväajan ohjearvo ${G.day} dB ei ylity.`, en: `The ${G.day} dB day guideline for homes is not exceeded.` })
      : guideSentence('day', v, G.day, { also: isOver(night) }));
  }
  if (isOver(night) || isOver(day)) out.push(L(ABATE));
  else if (isOver(newSt)) out.push(L({ fi: `Jos lähellä on uusia asuinalueita tai loma-asuntoja, ${lc(ABATE.fi)}`, en: `If there are new residential areas or holiday homes nearby, ${lc(ABATE.en)}` }));
  else if (isOver(natSt)) out.push(L({ fi: `Jos lähellä on loma-asuntoja, ${lc(ABATE.fi)}`, en: `If there are holiday homes nearby, ${lc(ABATE.en)}` }));
  // near a guideline (within 5 dB below it, at it, or straddling it): a tonal hum gets +5 dB
  if (night !== 'all') {
    const shown = [[G.night, night], [G.newNight, newSt], [G.nature, natSt]].filter(([, st]) => st);
    if (shown.some(([g, st]) => st === 'top' || st === 'at' || (st === 'below' && g - hi <= 5))) out.push(L(TONAL));
  }
  return out;
}

/** The 50 dB night-guideline sentence only (for a short line such as a persona's home). */
export const noiseNightSentence = (v) => (fin(v?.low) && fin(v?.high) ? guideSentence('night', v, GUIDE().night) : '');

/**
 * Heat card when the project has not published whether it uses its waste heat (preset.assumedKeys has 'heatReuse').
 * alt = { low, typ, high } homes the heat would warm if connected to district heating (from a run with heatReuse on),
 * or null when that cannot be calculated (e.g. no district-heat network).
 */
export function assumedHeatSentence(alt, heatReuseOn) {
  const head = L({ fi: 'Hukkalämmön käyttöä ei ole julkaistu.', en: 'The project has not said whether it will use its waste heat.' });
  if (heatReuseOn) return `${head} ${L({ fi: 'Tässä oletuksessa lämpö menee kaukolämpöön.', en: 'This assumption sends the heat to district heating.' })}`;
  const air = L({ fi: 'Tässä oletuksessa lämpö menee ilmaan', en: 'This assumption releases the heat into the air' });
  if (alt && alt.high > 0) {
    return `${head} ${air}; ${fill({ fi: 'kaukolämpöön liitettynä se lämmittäisi noin {range} kotia.', en: 'connected to district heating, it would warm about {range} homes.' }, alt)}`;
  }
  return `${head} ${air}.`;
}

const USES = { electricity: ['homes'], heatUsed: ['homes'], water: ['residents'], noise: ['guideNight', 'guideDay', 'guideNatureNight'], land: ['pitches'] };

/** Comparison keys a plain sentence already says in words. */
export const plainUses = (key) => USES[key] || [];

const SENTENCES = {
  electricity: (m, v) => fill({ fi: 'Datakeskus käyttää sähköä yhtä paljon kuin {range} kotia.', en: 'The data centre uses as much electricity as {range} homes.' }, scaledComparison(m, 'homes', v)),
  heatUsed: (m, v, ctx) => {
    const off = ctx?.sim?.meta && ctx.sim.meta.heatReuseOn === false;
    // the project has not published its heat reuse: never state the assumption as the project's plan
    if (ctx?.assumed?.has?.('heatReuse')) {
      if (off) return assumedHeatSentence(ctx.heatAlt || null, false);
      const homes = isZeroish(v) ? '' : fill({ fi: 'Kaukolämpöön menevä hukkalämpö lämmittäisi {range} kotia.', en: 'The waste heat would warm {range} homes.' }, scaledComparison(m, 'homes', v));
      return `${assumedHeatSentence(null, true)}${homes ? ` ${homes}` : ''}`;
    }
    if (off) {
      return L({ fi: 'Hukkalämpö johdetaan ilmaan, joten kaukolämpöön ei mene lämpöä.', en: 'The waste heat is released into the air, so no heat goes to district heating.' });
    }
    if (isZeroish(v)) return '';
    return fill({ fi: 'Kaukolämpöön menevä hukkalämpö lämmittäisi {range} kotia.', en: 'The waste heat would warm {range} homes.' }, scaledComparison(m, 'homes', v));
  },
  heatPumpElectricity: (m, v, ctx) => {
    if ((ctx?.sim?.meta && ctx.sim.meta.heatReuseOn === false) || isZeroish(v)) {
      return ctx?.assumed?.has?.('heatReuse') && ctx?.sim?.meta?.heatReuseOn === false
        ? L({ fi: 'Hukkalämmön käyttöä ei ole julkaistu. Tässä oletuksessa lämpö menee ilmaan, joten lämpöpumppuja ei tarvita.', en: 'The project has not said whether it will use its waste heat. This assumption releases the heat into the air, so no heat pumps are needed.' })
        : L({ fi: 'Lämpö johdetaan ilmaan, joten lämpöpumppuja ei tarvita.', en: 'The heat is released into the air, so no heat pumps are needed.' });
    }
    return L({ fi: 'Lämpöpumput nostavat haalean hukkalämmön kaukolämmön lämpötilaan ja käyttävät siihen sähköä.', en: 'Heat pumps raise the lukewarm waste heat to district-heating temperature and use electricity to do so.' });
  },
  water: (m, v) => fill({ fi: 'Vettä kuluu yhtä paljon kuin {range} asukasta käyttää.', en: 'It uses as much water as {range} residents.' }, scaledComparison(m, 'residents', v)),
  noise: (m, v) => {
    // The yearly value is the louder of operation and construction: above the operating level it is building work by day.
    if (fin(v?.typ) && fin(m?.headline?.typ) && v.typ > m.headline.typ + 0.5) {
      return [L({ fi: 'Rakentamisen ääntä päivisin, väliaikaista.', en: 'Construction noise by day, temporary.' }), guideSentence('day', v, GUIDE().day)];
    }
    return noiseGuideSentences(v);
  },
  jobsPermanent: (m, v) => (isZeroish(v) ? '' : fill({ fi: 'Valmiissa datakeskuksessa olisi töissä {range} ihmistä.', en: 'Once it is running, {range} people would work there.' }, { ...v, format: 'int' })),
  land: (m, v) => fill({ fi: 'Ala vastaa {range} jalkapallokenttää.', en: 'That is about the size of {range} football pitches.' }, scaledComparison(m, 'pitches', v)),
};

/**
 * One everyday sentence about `value` ({ low, typ, high }, the range the card shows) for `metric`.
 * ctx: { sim } (the whole simulation result, for heat reuse), optional assumed (Set of design keys a real project has
 * not published, preset.assumedKeys) and heatAlt ({ low, typ, high } homes warmed if the heat went to district heating).
 * Returns '' when no sentence fits.
 */
export function plainSentence(metric, value, ctx = {}) {
  return plainLines(metric, value, ctx).join(' ');
}

/** The same as separate sentences (the noise card shows the first one large and the guideline details below it). */
export function plainLines(metric, value, ctx = {}) {
  const fn = SENTENCES[metric?.key];
  if (!fn) return [];
  try {
    const r = fn(metric, value, ctx);
    return (Array.isArray(r) ? r : [r]).filter(Boolean);
  } catch { return []; }
}

/** "The heat pumps use X–Y GWh/yr for this…" for the heatUsed card, scaled to the heat value shown. */
export function heatPumpNote(sim, value) {
  const hp = sim?.metrics?.heatPumpElectricity;
  const hu = sim?.metrics?.heatUsed;
  if (!hp || !hu || isZeroish(value)) return '';
  const hl = hp.headline || {};
  const r = hu.headline?.typ > 0 && fin(value?.typ) ? value.typ / hu.headline.typ : 1;
  if (!(hl.high > 0)) return '';
  const range = fmtRangeUnit(hl.low * r, hl.high * r, hp.unit);
  return L({ fi: `Lämpöpumput käyttävät tähän sähköä ${range} (usein kaukolämpöyhtiön).`, en: `Heat pumps use ${range} of electricity for this (often the heating company’s).` });
}

const WHY = {
  electricity: { fi: 'Palvelimet käyttävät sähköä koko ajan, ja jäähdytys ja muu tekniikka lisäävät kulutusta. Laskemme sen koosta, siitä kuinka täyteen palvelimet ovat käytössä, ja tehokkuusluvusta (PUE).', en: 'The servers use electricity all the time, and cooling and other systems add to it. We calculate it from the size, how fully the servers are used and the efficiency figure (PUE).' },
  gridPeak: { fi: 'Sähköliittymän pitää kestää suurin hetkellinen kulutus. Se on hieman suurempi kuin palvelinten teho, koska jäähdytys ja muu tekniikka tarvitsevat lisäksi sähköä.', en: 'The grid connection must handle the highest momentary use. It is a little above the servers’ capacity, because cooling and other systems need electricity too.' },
  heatAvailable: { fi: 'Lähes kaikki palvelinten sähkö muuttuu lämmöksi. Tämä luku kertoo, paljonko lämpöä voi ottaa talteen. Se, käytetäänkö lämpöä, riippuu kaukolämpöverkosta.', en: 'Almost all the servers’ electricity turns into heat. This number says how much heat can be captured. Whether the heat is used depends on the district-heating network.' },
  heatPumpElectricity: { fi: 'Hukkalämpö on haaleaa. Lämpöpumppu nostaa sen kaukolämmön lämpötilaan ja käyttää siihen sähköä. Tätä sähköä ei ole laskettu datakeskuksen omaan kulutukseen.', en: 'Waste heat is lukewarm. A heat pump raises it to district-heating temperature and uses electricity to do so. This electricity is not counted in the data centre’s own use.' },
  heatUsed: { fi: 'Kaukolämpöön menee vain se osa lämmöstä, jolle on käyttöä: kesällä lämpöä tarvitaan vähän, eikä yksi lähde voi kattaa koko kunnan tarvetta. Luku sisältää lämpöpumppujen sähkön.', en: 'Only the heat that has a use goes to district heating: little heat is needed in summer, and one source cannot cover the whole town’s need. The number includes the heat pumps’ electricity.' },
  water: { fi: 'Vettä kuluu paljon vain, jos jäähdytyksessä haihdutetaan vettä. Ulkoilma- ja nestejäähdytyksessä vettä kuluu lähinnä henkilökunnan käyttöön.', en: 'A lot of water is used only if the cooling evaporates water. With outdoor-air and liquid cooling, water is used mainly by the staff.' },
  noise: { fi: 'Melu tulee lähinnä jäähdytyslaitteista ja vaimenee, kun etäisyys kasvaa. Laskemme sen koon ja lähimpien kotien etäisyyden perusteella suomalaisten YVA-mallinnusten pohjalta.', en: 'The noise comes mainly from the cooling equipment and fades with distance. We calculate it from the size and the distance to the nearest homes, based on Finnish environmental impact assessments.' },
  co2Electricity: { fi: 'Sähkön tuotannosta syntyy päästöjä. Kerromme sähkönkulutuksen Suomessa käytetyn sähkön keskimääräisillä päästöillä.', en: 'Producing electricity causes emissions. We multiply the electricity use by the average emissions of electricity used in Finland.' },
  co2HeatAvoided: { fi: 'Jos hukkalämpö korvaa kaukolämpöä, joka muuten tuotettaisiin polttamalla, päästöt vähenevät. Paljonko, riippuu siitä, mitä se korvaa.', en: 'If the waste heat replaces district heat that would otherwise come from burning fuel, emissions fall. By how much depends on what it replaces.' },
  co2Construction: { fi: 'Rakennusten ja tekniikan rakentamisesta syntyy päästöjä kerran, rakentamisen aikana.', en: 'Building the halls and their systems causes emissions once, during construction.' },
  jobsConstruction: { fi: 'Työmaalla on eniten työntekijöitä rakentamisen keskivaiheilla. Laskemme määrän rakentajista megawattia kohden.', en: 'The site has the most workers in the middle of construction. We calculate the number from workers per megawatt.' },
  jobsPermanent: { fi: 'Pysyvät työpaikat lasketaan valmiiden ja suunniteltujen hankkeiden työpaikoista megawattia kohden.', en: 'Permanent jobs are calculated from the jobs per megawatt in finished and planned projects.' },
  jobsIndirect: { fi: 'Datakeskus ostaa palveluja, ja sen työntekijät käyttävät rahaa. Siitä syntyy työtä muihin yrityksiin, osin muualle kuin omaan kuntaan.', en: 'The data centre buys services and its staff spend money. That creates work in other companies, partly outside your own town.' },
  propertyTax: { fi: 'Kiinteistövero maksetaan rakennuksista kunnalle joka vuosi. Palvelimista ei makseta kiinteistöveroa.', en: 'Property tax is paid to the town every year on the buildings. No property tax is paid on the servers.' },
  electricityTax: { fi: 'Sähkövero maksetaan jokaisesta käytetystä kilowattitunnista. Se menee valtiolle, ei kunnalle.', en: 'Electricity tax is paid on every kilowatt-hour used. It goes to the state, not the town.' },
  investment: { fi: 'Investointi kertoo, paljonko rakentamiseen käytetään rahaa. Vuokralaisten palvelimet tulevat usein lisäksi, ja ne ostetaan yleensä ulkomailta.', en: 'The investment says how much money goes into construction. Tenants’ servers often come on top and are usually bought from abroad.' },
  trucks: { fi: 'Raskasta liikennettä on eniten maanrakennusvaiheessa. Valmiin datakeskuksen liikenne on muutamia ajoneuvoja päivässä.', en: 'Heavy traffic is busiest during the earthworks. A finished data centre has a few vehicles a day.' },
  land: { fi: 'Pinta-ala lasketaan megawattia kohden: tiivis rakennus vie vähän tilaa, laaja kampus paljon.', en: 'The area is calculated per megawatt: a compact building takes little space, a wide campus a lot.' },
  backupPower: { fi: 'Sähkökatkojen varalle datakeskuksessa on dieselgeneraattoreita. Ne käyvät vain koekäytöissä ja sähkökatkoissa.', en: 'For power cuts the data centre has diesel generators. They run only in tests and blackouts.' },
  eWaste: { fi: 'Palvelimet vaihdetaan uusiin muutaman vuoden välein. Vanhat laitteet kierrätetään tai käytetään uudelleen.', en: 'The servers are replaced every few years. The old equipment is recycled or reused.' },
};

/** A short plain explanation of a metric for the top of the "Why?" drawer ('' when none). */
export function plainWhy(key) {
  return WHY[key] ? L(WHY[key]) : '';
}
