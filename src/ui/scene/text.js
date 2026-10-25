// Scene words in Finnish and English (labels, chip, accessible summary). Plain language, no numbers
// except the user's own choices (size, distance), so nothing here needs a source.
// District heat: the data only knows whether a town is in Finnish Energy's district-heat statistics, so the
// scene never says a town has no network ("not in the statistics; a local network may exist").

import { PUBLIC_EVENTS } from './layout.js';
import { winterGlow } from './util.js';

export const TXT = {
  phase: {
    planning: { fi: 'Suunnittelu', en: 'Planning' },
    construction: { fi: 'Rakentaminen', en: 'Construction' },
    operation: { fi: 'Käytössä', en: 'In operation' },
  },
  season: {
    winter: { fi: 'talvi', en: 'winter' },
    spring: { fi: 'kevät', en: 'spring' },
    summer: { fi: 'kesä', en: 'summer' },
    autumn: { fi: 'syksy', en: 'autumn' },
  },
  year: { fi: 'vuosi', en: 'year' },
  note: { fi: 'Kuvitus – ei mittakaavassa', en: 'Illustration – not to scale' },
  label: {
    dc: { fi: 'Datakeskus', en: 'Data centre' },
    site: { fi: 'Työmaa', en: 'Building site' },
    zoning: { fi: 'Kaavoitus käynnissä', en: 'Zoning under way' },
    dh: { fi: 'Kaukolämpölaitos', en: 'District heating plant' },
    dhLocal: { fi: 'Paikallinen lämpölaitos? (ei tilastossa)', en: 'Local heating plant? (not in statistics)' },
    pipe: { fi: 'Hukkalämpö kaukolämpöön', en: 'Waste heat to district heating' },
    heatAir: { fi: 'Lämpö ilmaan', en: 'Heat released to the air' },
    heatAirAssumed: { fi: 'Lämpö ilmaan (oletus)', en: 'Heat to the air (assumption)' },
    noDH: { fi: 'Ei kaukolämpöä tilastossa', en: 'Not in district-heat statistics' },
    heatHomes: { fi: 'Datakeskuksen lämmittämät kodit', en: 'Homes heated by the data centre' },
    expansion: { fi: 'Laajennus rakenteilla', en: 'Expansion being built' },
    refresh: { fi: 'Laitteiden vaihto', en: 'Equipment refresh' },
    endOfLife: { fi: 'Päätös tulevaisuudesta', en: 'Decision on the future' },
    renew: { fi: 'Uudistetaan?', en: 'Renew?' },
    dismantle: { fi: 'Puretaan?', en: 'Dismantle?' },
    publicEvent: { fi: 'Yleisötilaisuus', en: 'Public event' },
    power: { fi: 'Voimalinja', en: 'Power line' },
    powerPlanned: { fi: 'Suunniteltu voimalinja', en: 'Planned power line' },
    plume: { fi: 'Vesihöyryä', en: 'Water vapour' },
    waterMain: { fi: 'Vettä kunnan verkosta', en: 'Water from the town mains' },
    lowWater: { fi: 'Suljettu kierto: vähän vettä', en: 'Closed loop: little water' },
    gens: { fi: 'Varavoimakoneet', en: 'Backup generators' },
    genTest: { fi: 'Varavoiman koekäyttö', en: 'Backup generator test run' },
    trucks: { fi: 'Raskas liikenne', en: 'Heavy traffic' },
    homes: { fi: 'Lähimmät kodit', en: 'Nearest homes' },
    noise: { fi: 'Melu', en: 'Noise' },
    workers: { fi: 'Rakentajia työmaalla', en: 'Builders on site' },
    staff: { fi: 'Pysyvät työpaikat', en: 'Permanent jobs' },
    land: { fi: 'Tontin pinta-ala', en: 'Site area' },
    construction: { fi: 'Rakentaminen', en: 'Construction' },
    trees: { fi: 'Metsää kaadettu', en: 'Forest cleared' },
  },
  townSize: {
    small: { fi: 'pieni kunta', en: 'a small town' },
    medium: { fi: 'keskikokoinen kaupunki', en: 'a medium-sized town' },
    large: { fi: 'suuri kaupunki', en: 'a large city' },
  },
  // the drawn town template (by population: < 5 000, 5 000–30 000, 30 000–150 000, > 150 000 residents)
  townKind: {
    village: { fi: 'pieni maaseutukunta', en: 'a small rural municipality' },
    smallTown: { fi: 'pieni kaupunki tai kunta', en: 'a small town' },
    regional: { fi: 'keskikokoinen kaupunki', en: 'a medium-sized town' },
    city: { fi: 'suuri kaupunki', en: 'a large city' },
  },
  site: {
    industrial: { fi: 'teollisuusalueella', en: 'in an industrial area' },
    forest: { fi: 'metsässä', en: 'in a forest' },
    field: { fi: 'pellolla', en: 'on a field' },
  },
};

export const tr = (obj, lang) => (obj ? obj[lang] ?? obj.fi : '');

// Number formatters are costly to create and the scene formats on every update while the timeline plays: reuse them.
const NF = new Map();
export function numFmt(lang, digits = 0) {
  const k = `${lang}|${digits}`;
  let f = NF.get(k);
  if (!f) { f = new Intl.NumberFormat(lang === 'fi' ? 'fi-FI' : 'en-GB', { maximumFractionDigits: digits }); NF.set(k, f); }
  return f;
}

export function fmtInt(v, lang) {
  return numFmt(lang, 0).format(v);
}

/** Round the distance like a person would say it (no false precision). */
export function roundDistance(m) {
  if (m < 1000) return Math.round(m / 50) * 50;
  return Math.round(m / 100) * 100;
}

export function distanceText(m, lang) {
  const r = roundDistance(m);
  if (r >= 1000) {
    const km = r / 1000;
    const s = numFmt(lang, 1).format(km);
    return `≈ ${s} km`;
  }
  return `≈ ${fmtInt(r, lang)} m`;
}

export function townLabel(st) {
  const n = st.townName;
  if (!n) return '';
  if (typeof n === 'string') return n;
  return n[st.lang] || n.fi || '';
}

/** Finished / building / not started halls, when the caller gave hallStates (else null). */
export function hallCounts(st) {
  const hs = st.hallStates;
  if (!hs) return null;
  return {
    n: hs.length,
    done: hs.filter((v) => v >= 1).length,
    building: hs.filter((v) => v > 0 && v < 1).length,
    waiting: hs.filter((v) => v <= 0).length,
  };
}

function joinList(items, lang) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${lang === 'fi' ? 'ja' : 'and'} ${items[items.length - 1]}`;
}

/** "The data centre has 3 halls: 1 finished, 1 being built and 1 not started yet." */
function hallSentence(hc, lang) {
  const fi = lang === 'fi';
  if (hc.n === 1) {
    if (hc.building) return fi ? 'Halli on vielä rakenteilla.' : 'The hall is still being built.';
    if (hc.waiting) return fi ? 'Hallille on varattu paikka, mutta rakentamista ei ole aloitettu.' : 'Space is kept for the hall, but building has not started.';
    return '';
  }
  const items = [];
  if (hc.done) items.push(fi ? `${hc.done} ${hc.done === 1 ? 'valmis' : 'valmista'}` : `${hc.done} finished`);
  if (hc.building) items.push(fi ? `${hc.building} rakenteilla` : `${hc.building} being built`);
  if (hc.waiting) items.push(fi ? `${hc.waiting} vielä aloittamatta` : `${hc.waiting} not started yet`);
  return fi ? `Datakeskuksessa on ${hc.n} hallia: ${joinList(items, lang)}.` : `The data centre has ${hc.n} halls: ${joinList(items, lang)}.`;
}

/** Waste-heat sentence for the operation phase. Never claims that a town has no network. */
function heatSentence(st, S, lang) {
  const fi = lang === 'fi';
  const winter = S.w > 0.5;
  if (st.heatReuse && st.plantUncertain) {
    return fi
      ? `Kunta ei ole kaukolämmön tilastossa, mutta paikallinen lämpölaitos voi olla olemassa. Kuvassa hukkalämpö kulkee putkea pitkin sellaiselle laitokselle${winter ? ', talvella eniten' : '; kesällä osa lämmöstä menee ilmaan'}.`
      : `The town is not in the district-heat statistics, but a local heating plant may exist. In the picture, waste heat flows through a pipe to such a plant${winter ? ', most of all in winter' : '; in summer part of the heat goes into the air'}.`;
  }
  if (st.heatReuse) {
    return fi
      ? `Hukkalämpö kulkee putkea pitkin kaukolämpölaitokselle${winter ? ', talvella eniten' : '; kesällä osa lämmöstä menee ilmaan'}.`
      : `Waste heat flows through a pipe to the district heating plant${winter ? ', most of all in winter' : '; in summer part of the heat goes into the air'}.`;
  }
  if (!st.hasDistrictHeat) {
    return fi
      ? 'Kunta ei ole kaukolämmön tilastossa, joten kuvassa lämpö menee ilmaan. Paikallinen kaukolämpöverkko voi silti olla olemassa.'
      : 'The town is not in the district-heat statistics, so in the picture the heat goes into the air. A local district-heating network may still exist.';
  }
  if (st.plantUncertain) {
    return fi
      ? 'Kunta ei ole kaukolämmön tilastossa; kuvan lämpölaitos on mahdollinen paikallinen laitos. Hukkalämpöä ei hyödynnetä, vaan se menee ilmaan.'
      : 'The town is not in the district-heat statistics; the heating plant in the picture is a possible local plant. The waste heat is not reused; it goes into the air.';
  }
  return fi ? 'Hukkalämpöä ei hyödynnetä, vaan se menee ilmaan.' : 'The waste heat is not reused; it goes into the air.';
}

function warmHomesSentence(share, lang) {
  if (lang === 'fi') {
    if (share >= 0.95) return 'Talvella lähes kaikki kodit lämpenevät datakeskuksen hukkalämmöllä, ja niiden ikkunat hehkuvat lämpimästi.';
    return `Talvella ${share >= 0.5 ? 'suurin osa' : 'osa'} kodeista lämpenee datakeskuksen hukkalämmöllä; niiden ikkunat hehkuvat lämpimästi.`;
  }
  const who = share >= 0.95 ? 'almost all homes are' : share >= 0.5 ? 'most of the homes are' : 'some of the homes are';
  return `In winter ${who} warmed by the data centre’s waste heat; their windows glow warm.`;
}

/** Sentence for the event moment drawn in the picture (or ''). */
function eventSentence(st, lang) {
  const fi = lang === 'fi';
  const k = st.eventKey;
  if (PUBLIC_EVENTS.includes(k)) return fi ? 'Asukkaita on koolla ilmoitustaulun luona: yleisötilaisuus.' : 'Residents gather at a notice board: a public event.';
  if (k === 'endOfLife') return fi ? 'Tienviitassa kysytään: uudistetaanko vai puretaanko? Edessä on päätös tulevaisuudesta.' : 'A signpost asks: renew or dismantle? A decision on the future lies ahead.';
  if (st.phase !== 'operation') return '';
  if (k === 'refresh') return fi ? 'Kuorma-auto vie vanhoja laitteita pois: laitteiden vaihto.' : 'A truck takes old equipment away: an equipment refresh.';
  if (k === 'opening') return fi ? 'Hallin valot syttyvät: datakeskus avataan.' : 'The hall lights come on: the data centre opens.';
  if (k === 'heatFirst' && st.heatReuse) return fi ? 'Ensimmäinen lämpö kulkee putkea pitkin lämpölaitokselle.' : 'The first heat travels through the pipe to the heating plant.';
  return '';
}

/** One accessible paragraph describing what the picture shows right now. */
export function ariaSummary(st, S) {
  const l = st.lang;
  const fi = l === 'fi';
  const parts = [];
  const town = townLabel(st);
  const season = tr(TXT.season[S.name], l);
  const phase = tr(TXT.phase[st.phase], l);
  const size = fmtInt(st.sizeMW, l);
  const dist = distanceText(st.distanceM, l).replace('≈ ', fi ? 'noin ' : 'about ');
  const hc = hallCounts(st);
  const add = (s) => { if (s) parts.push(s); };
  if (fi) {
    parts.push(`Kuvitus: ${town ? town + ', ' : ''}${tr(TXT.townKind[st.townKind] || TXT.townSize[st.townSize], l)}, ${season}. ${phase}, vuosi ${Math.floor(st.year)}.`);
    parts.push(`Datakeskuksen tontti (${size} MW) on ${tr(TXT.site[st.site], l)}, ${dist} lähimmistä kodeista.`);
    if (st.phase === 'planning') parts.push('Tontilla on mittausmerkit ja kaavakyltti. Mitään ei ole vielä rakennettu.');
    if (st.phase === 'construction') {
      parts.push('Työmaalla on nosturi, työkoneita ja rakentajia. Tiellä kulkee kuorma-autoja.');
      if (st.site === 'forest') parts.push('Metsää on kaadettu tontilta.');
      if (hc && hc.n > 1) add(hallSentence(hc, l));
    }
    if (st.phase === 'operation') {
      if (hc) add(hallSentence(hc, l));
      if (!hc || hc.done === 1) parts.push('Valmis halli, jonka katolla on jäähdyttimiä ja puhaltimia. Voimalinja tuo sähköä.');
      else if (hc.done > 1) parts.push('Valmiiden hallien katoilla on jäähdyttimiä ja puhaltimia. Voimalinja tuo sähköä.');
      else parts.push('Voimalinja tuo sähköä.');
      if (hc && hc.building) parts.push('Laajennusta rakennetaan: tontilla on nosturi ja työmaakoppeja.');
      if (st.cooling === 'evaporative') parts.push('Haihdutusjäähdytys käyttää vettä, ja katolta nousee vesihöyryä, varsinkin pakkasella.');
      else if (st.cooling === 'liquid') parts.push('Nestejäähdytys kiertää suljetussa putkistossa.');
      else parts.push('Ulkoilmajäähdytys ei juuri käytä vettä.');
      parts.push(heatSentence(st, S, l));
      if (st.heatReuse && st.heatHomesShare > 0 && winterGlow(S) > 0.5) parts.push(warmHomesSentence(st.heatHomesShare, l));
      if (st.staff != null && st.staff > 0) parts.push('Tontin edessä on henkilökunnan parkkipaikka.');
    }
    add(eventSentence(st, l));
    if (st.highlight) parts.push(`Korostettuna: ${highlightWord(st.highlight, l)}.`);
    parts.push('Kuva ei ole mittakaavassa.');
  } else {
    parts.push(`Illustration: ${town ? town + ', ' : ''}${tr(TXT.townKind[st.townKind] || TXT.townSize[st.townSize], l)} in ${season}. ${phase}, year ${Math.floor(st.year)}.`);
    parts.push(`The data-centre site (${size} MW) is ${tr(TXT.site[st.site], l)}, ${dist} from the nearest homes.`);
    if (st.phase === 'planning') parts.push('The site has survey stakes and a zoning sign. Nothing has been built yet.');
    if (st.phase === 'construction') {
      parts.push('The building site has a crane, machines and builders. Trucks drive on the road.');
      if (st.site === 'forest') parts.push('Forest has been cleared from the site.');
      if (hc && hc.n > 1) add(hallSentence(hc, l));
    }
    if (st.phase === 'operation') {
      if (hc) add(hallSentence(hc, l));
      if (!hc || hc.done === 1) parts.push('A finished hall with coolers and fans on the roof. A power line brings electricity.');
      else if (hc.done > 1) parts.push('The finished halls have coolers and fans on their roofs. A power line brings electricity.');
      else parts.push('A power line brings electricity.');
      if (hc && hc.building) parts.push('An expansion is being built: there is a crane and site cabins on the plot.');
      if (st.cooling === 'evaporative') parts.push('Evaporative cooling uses water, and vapour rises from the roof, especially in frosty weather.');
      else if (st.cooling === 'liquid') parts.push('Liquid cooling circulates in a closed loop.');
      else parts.push('Outdoor-air cooling uses very little water.');
      parts.push(heatSentence(st, S, l));
      if (st.heatReuse && st.heatHomesShare > 0 && winterGlow(S) > 0.5) parts.push(warmHomesSentence(st.heatHomesShare, l));
      if (st.staff != null && st.staff > 0) parts.push('There is a staff car park in front of the site.');
    }
    add(eventSentence(st, l));
    if (st.highlight) parts.push(`Highlighted: ${highlightWord(st.highlight, l)}.`);
    parts.push('The picture is not to scale.');
  }
  return parts.join(' ');
}

/** metric key (or theme key) → which part of the picture to emphasise */
export const HIGHLIGHT_TARGET = {
  electricity: 'power', gridPeak: 'power', co2Electricity: 'power', energy: 'power',
  heatAvailable: 'heat', heatUsed: 'heat', co2HeatAvoided: 'heat',
  water: 'water', environment: 'water',
  noise: 'noise',
  co2Construction: 'site',
  jobsConstruction: 'workers', jobsPermanent: 'staff', jobsIndirect: 'staff', jobs: 'staff',
  propertyTax: 'hall', electricityTax: 'power', investment: 'hall', future: 'hall', eWaste: 'hall',
  trucks: 'road', traffic: 'road',
  land: 'land',
  backupPower: 'gens', safety: 'gens',
};

const HL_WORD = {
  power: { fi: 'sähkö ja voimalinja', en: 'electricity and the power line' },
  heat: { fi: 'hukkalämpö', en: 'waste heat' },
  water: { fi: 'vesi', en: 'water' },
  noise: { fi: 'melu', en: 'noise' },
  site: { fi: 'rakentaminen', en: 'construction' },
  workers: { fi: 'rakentajat', en: 'builders' },
  staff: { fi: 'työpaikat', en: 'jobs' },
  hall: { fi: 'datakeskus', en: 'the data centre' },
  road: { fi: 'raskas liikenne', en: 'heavy traffic' },
  land: { fi: 'tontin pinta-ala', en: 'site area' },
  gens: { fi: 'varavoima', en: 'backup power' },
};

export function highlightWord(key, lang) {
  return tr(HL_WORD[HIGHLIGHT_TARGET[key] || key], lang) || key;
}
