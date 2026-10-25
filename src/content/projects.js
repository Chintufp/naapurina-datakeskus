// Real Finnish data-centre projects (status as of 24.10.2026) with simulator presets and the projects' own
// published figures. Owned by the content package (see SPEC.md §6).
// townCode = Statistics Finland municipality code (classification kunta_1_20260101), checked 24.10.2026.
// preset.sizeMW is the IT power in MW (2–1000). mwBasis says what the stated figure (`mw`) means:
//   'it'      = the source states IT power: sizeMW = mw
//   'total'   = the source states electrical / grid power: sizeMW = mw ÷ 1.25 (cooling and other systems)
//   'unknown' = the source does not say: sizeMW = mw, or an assumed size when nothing is published.
// Anything in a preset that is not published is listed in preset.assumed.
// preset.assumedKeys = the design keys ('sizeMW' | 'cooling' | 'heatReuse' | 'site' | 'distanceM') whose preset value is
//   NOT published by the project (our assumption, or the nearest simulator option to something different, e.g. seawater
//   → 'air'). A published figure used "as stated" or converted (mwBasis) is not listed. Code treats a missing list as [].
// preset.declared = the project's own figures, per metric key, each pointing to a verified fact (SPEC §5 opts.declared).

const u = (fi, en = fi) => ({ fi, en });

export const PROJECTS = [
  {
    id: 'google-hamina', name: u('Google, Hamina'), operator: 'Google',
    municipality: 'Hamina', townCode: '075', status: 'operating',
    mw: null, investmentEur: 3.5e9,
    summary: u('Toiminnassa vuodesta 2011 entisen paperitehtaan alueella Summassa, laajennettu monta kertaa. Haminan kaupungin mukaan Google on investoinut Haminaan tähän mennessä yhteensä noin 3,5 mrd. €, ja siellä työskentelee noin 500 ihmistä. Jäähdytyksessä käytetään merivettä Suomenlahdelta. Hukkalämpö menee nyt maksutta Haminan kaukolämpöön. Googlen syyskuussa 2026 ilmoittama 13 mrd. euron lisäinvestointi sisältää myös Haminan laajennuksen.',
      'Running since 2011 on a former paper-mill site in Summa, expanded many times. The City of Hamina says Google has invested about €3.5 billion in Hamina in total so far, and about 500 people work there. It is cooled with seawater from the Gulf of Finland. Its waste heat now goes free of charge into Hamina’s district heating. The additional €13 billion investment Google announced in September 2026 also includes expanding Hamina.'),
    preset: {
      sizeMW: 150, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['sizeMW', 'cooling', 'distanceM'],
      assumed: u('Googlen Haminan tehoa (MW) ei ole julkaistu: käytämme oletuskokoa 150 MW. Google jäähdyttää Haminassa merivedellä; simulaattorissa ei ole merivesivaihtoehtoa, joten käytämme "ulkoilmaa", joka on lähin vaihtoehto, joka ei haihduta makeaa vettä. Etäisyys koteihin on oletus.',
        'Google has not published Hamina’s power (MW): we assume 150 MW. Google cools Hamina with seawater; the simulator has no seawater option, so we use "outdoor air", the closest option that does not evaporate fresh water. Distance to homes is an assumption.'),
      declared: {
        jobsPermanent: { typ: 500, factId: 'hamina-jobs-500',
          note: u('Koko kampus, jota on laajennettu 15 vuoden ajan; sen tehoa (MW) ei ole julkaistu.', 'The whole campus, expanded over 15 years; its power (MW) has not been published.') },
      },
    },
    actualFacts: ['hamina-heat-flowing', 'hamina-heat-plan', 'hamina-jobs-500', 'hamina-taxes', 'hamina-carbon-free'],
    sources: [
      { name: 'Haminan kaupunki', type: 'authority', date: '2026-06-22', url: 'https://www.hamina.fi/en/haminan-datakeskuksen-vaikutukset-tutkimuskohteena-osallistu-sinakin/' },
      { name: { fi: 'Google: Hamina, Finland (verkkosivu, tarkistettu 24.10.2026)', en: 'Google: Hamina, Finland (web page, checked 24 Oct 2026)' }, type: 'company', date: '2026-10', url: 'https://datacenters.google/locations/hamina-finland/' },
      { name: 'Yle News', type: 'news', date: '2026-09-09', url: 'https://yle.fi/a/74-20245301' },
    ],
  },
  {
    id: 'google-muhos', name: u('Google, Muhos'), operator: 'Google (Tuike Finland Oy)',
    municipality: 'Muhos', townCode: '494', status: 'halted',
    statusNote: u('Keskeytetty 10/2026, YVA kesken', 'Paused 10/2026 until the EIA is done'),
    mw: null, investmentEur: null,
    summary: u('Osa Googlen syyskuussa 2026 ilmoittamaa 13 miljardin euron lisäinvestointia. Metsää hakattiin noin 330 ha ilman YVA:ta, ja Luonnonsuojeluliitto pyysi syyskuussa viranomaista selvittämään epäiltyjä laittomia hakkuita. Lupa- ja valvontavirasto (LVV) kehotti 6.10.2026 keskeyttämään valmistelutyöt, kunnes YVA on tehty; Google kertoi 11.10. keskeyttäneensä ne, ja sen Suomen-maajohtaja pyysi anteeksi 13.10. LVV teki 22.10.2026 poliisille tutkintapyynnön Googlen Muhoksen datakeskushankkeesta. Virasto ei ole kertonut, mitä pyyntö koskee, koska asia on salassa pidettävä. Poliisi kertoi Ylelle samana päivänä, että esiselvitystä ei ole vielä aloitettu. Ylen mukaan LVV vaatii myös tarkempaa vesienhallintasuunnitelmaa 5.11. mennessä, ja vesien tarkkailussa on havaittu happamoitumiseen viittaavia muutoksia.',
      'Part of the additional €13 billion investment Google announced in September 2026. About 330 ha of forest was cleared without an EIA, and in September the Finnish Association for Nature Conservation asked the authority to look into suspected illegal logging. On 6 Oct 2026 the Finnish Supervisory Agency (LVV) told the company to halt preparatory work until the EIA is done; Google said on 11 Oct that it had stopped, and its country head for Finland apologised on 13 Oct. On 22 Oct 2026 LVV asked the police to investigate Google’s Muhos data-centre project. The agency has not said what the request concerns, because the matter is confidential. The police told Yle the same day that no preliminary inquiry had started yet. According to Yle, LVV also requires a more detailed water-management plan by 5 Nov, and water monitoring has shown changes that point to acidification.'),
    preset: {
      sizeMW: 500, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['sizeMW', 'cooling', 'heatReuse', 'distanceM'],
      assumed: u('Kokoa (MW) ei ole julkaistu: käytämme oletuskokoa 500 MW, koska alue on satoja hehtaareja. Jäähdytystä ja hukkalämmön käyttöä ei ole julkaistu. Etäisyys koteihin on oletus.',
        'The size (MW) has not been published: we assume 500 MW because the site covers hundreds of hectares. Cooling and heat reuse have not been published. Distance to homes is an assumption.'),
      declared: {
        land: { typ: 330, factId: 'muhos-logging-330',
          note: u('Hakattu metsä. Metsähallitus sai 2024 luvan myydä Googlelle Muhokselta ja Kajaanista yhteensä noin 1 400 ha.', 'Forest cleared so far. In 2024 Metsähallitus was allowed to sell Google about 1,400 ha in Muhos and Kajaani together.') },
      },
    },
    actualFacts: ['muhos-logging-330', 'lvv-halt', 'lvv-police-request', 'google-land-1400ha', 'muhos-26m', 'muhos-roads', 'muhos-forest-255', 'google-37000'],
    sources: [
      { name: 'Yle', type: 'news', date: '2026-10-22', url: 'https://yle.fi/a/74-20252848' },
      { name: 'Yle', type: 'news', date: '2026-10-23', url: 'https://yle.fi/a/74-20253046' },
      { name: 'Yle News', type: 'news', date: '2026-10-08', url: 'https://yle.fi/a/74-20250446' },
      { name: 'Kaleva / STT', type: 'news', date: '2026-10-13', url: 'https://www.kaleva.fi/yle-ja-mtv-google-pyytaa-anteeksi/13708131' },
      { name: 'Kaleva / STT', type: 'news', date: '2026-09-17', url: 'https://www.kaleva.fi/luonnonsuojeluliitto-googlen-datakeskustyomailla-t/13671648' },
      { name: 'Yle', type: 'news', date: '2025-08-05', url: 'https://yle.fi/a/74-20175928' },
    ],
  },
  {
    id: 'google-kajaani', name: u('Google, Kajaani'), operator: 'Google (Tuike Finland Oy)',
    municipality: 'Kajaani', townCode: '205', status: 'halted',
    statusNote: u('Keskeytetty 10/2026, YVA kesken', 'Paused 10/2026 until the EIA is done'),
    mw: null, investmentEur: null,
    summary: u('Yksi Googlen uusista pohjoisen kohteista (Kajaani, Muhos, Vaala). Metsää hakattiin vajaat 200 ha. Valmistelutyöt keskeytettiin lokakuussa 2026 saman Lupa- ja valvontaviraston kehotuksen jälkeen kuin Muhoksella, kunnes YVA-menettely on tehty. Virasto ei tehnyt Kajaanin työmaasta tutkintapyyntöä poliisille.',
      'One of Google’s new northern sites (Kajaani, Muhos, Vaala). Just under 200 ha of forest was cleared. Preparatory work was halted in October 2026 after the same request from the Finnish Supervisory Agency as in Muhos, until the EIA procedure is done. The agency did not ask the police to investigate the Kajaani site.'),
    preset: {
      sizeMW: 500, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['sizeMW', 'cooling', 'heatReuse', 'distanceM'],
      assumed: u('Kokoa (MW) ei ole julkaistu: käytämme oletuskokoa 500 MW. Jäähdytystä ja hukkalämmön käyttöä ei ole julkaistu. Etäisyys koteihin on oletus.',
        'The size (MW) has not been published: we assume 500 MW. Cooling and heat reuse have not been published. Distance to homes is an assumption.'),
    },
    actualFacts: ['lvv-halt', 'google-land-1400ha', 'google-37000'],
    sources: [
      { name: 'Yle News', type: 'news', date: '2026-10-08', url: 'https://yle.fi/a/74-20250446' },
      { name: 'Yle', type: 'news', date: '2026-10-23', url: 'https://yle.fi/a/74-20253046' },
      { name: 'Kaleva / STT', type: 'news', date: '2026-10-13', url: 'https://www.kaleva.fi/yle-ja-mtv-google-pyytaa-anteeksi/13708131' },
      { name: 'Yle News', type: 'news', date: '2026-09-09', url: 'https://yle.fi/a/74-20245301' },
    ],
  },
  {
    id: 'microsoft-espoo', name: u('Microsoft, Espoo (Hepokorpi)'), operator: 'Microsoft',
    municipality: 'Espoo', townCode: '049', status: 'construction',
    mw: 60, investmentEur: null,
    summary: u('Kolme datakeskusrakennusta otetaan käyttöön vaiheittain 2026–2028. Ensimmäisen (HEL16) sähköteho on noin 60 MW. Hukkalämpö menee Fortumin kaukolämpöön.',
      'Three data-centre buildings come into use in stages in 2026–2028. The first (HEL16) has about 60 MW of electrical power. Its waste heat goes to Fortum’s district heating.'),
    preset: {
      sizeMW: 48, cooling: 'air', heatReuse: true, site: 'forest', distanceM: 1000, mwBasis: 'total',
      assumedKeys: ['cooling', 'site', 'distanceM'],
      assumed: u('Lähde kertoo HEL16:n sähkötehon (noin 60 MW). Simulaattorin MW on IT-teho, joten käytämme 60 ÷ 1,25 = 48 MW. Jäähdytystapa, alueen maasto ja etäisyys koteihin ovat oletuksia.',
        'The source gives HEL16’s electrical power (about 60 MW). The simulator’s MW is IT power, so we use 60 ÷ 1.25 = 48 MW. Cooling method, site type and distance to homes are assumptions.'),
      declared: {
        backupPower: { typ: 160, factId: 'espoo-generators',
          note: u('21 varavoimakonetta ensimmäisessä rakennuksessa (lupahakemus).', '21 backup generators in the first building (permit application).') },
      },
    },
    actualFacts: ['espoo-generators', 'espoo-noise-53', 'espoo-noise-limits', 'espoo-generator-exhaust', 'microsoft-fortum-40', 'ms-construction-workers', 'ms-ops-50', 'ms-multiplier', 'microsoft-co2-plan'],
    sources: [
      { name: 'Espoon ympäristö- ja rakennuslautakunta', type: 'authority', date: '2025-03-20', url: 'https://espoo-sv.oncloudos.com/kokous/20251396-16.PDF' },
      { name: 'Microsoft', type: 'company', date: '2026-04-28', url: 'https://news.microsoft.com/source/emea/2026/04/microsoft-kaynnistaa-paakaupunkiseudun-datakeskusalueen-toisen-vaiheen-rakentamisen/?lang=fi' },
    ],
  },
  {
    id: 'microsoft-vihti', name: u('Microsoft, Vihti'), operator: 'Microsoft',
    municipality: 'Vihti', townCode: '927', status: 'construction',
    mw: 265, investmentEur: null,
    summary: u('Noin 60 hehtaarin alue Nummelan eteläpuolella: neljä rakennusta, sähköteho yhteensä noin 265 MW. Ensimmäinen vaihe on rakenteilla, toinen alkaa 2026.',
      'About 60 hectares south of Nummela: four buildings with about 265 MW of electrical power in total. Phase one is under construction, phase two starts in 2026.'),
    preset: {
      sizeMW: 212, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 1500, mwBasis: 'total',
      assumedKeys: ['cooling', 'heatReuse', 'site', 'distanceM'],
      assumed: u('YVA-ohjelman kuulutus kertoo yhteenlasketun sähkötehon (noin 265 MW). Simulaattorin MW on IT-teho, joten käytämme 265 ÷ 1,25 = 212 MW. Alue on noin 2,5 km Nummelan taajamasta, mutta lähimpien kotien etäisyys on oletus. Hukkalämmön käyttöä vasta selvitettiin YVA-ohjelmassa.',
        'The EIA programme notice gives the combined electrical power (about 265 MW). The simulator’s MW is IT power, so we use 265 ÷ 1.25 = 212 MW. The site is about 2.5 km from Nummela, but the distance to the nearest homes is an assumption. Heat reuse was only to be studied in the EIA programme.'),
      declared: {
        land: { typ: 60, factId: 'vihti-60ha',
          note: u('Neljä rakennusta, louhintaa noin 22 ha.', 'Four buildings, about 22 ha quarried.') },
        backupPower: { typ: 660, factId: 'vihti-generators',
          note: u('Koko alueen varavoimakoneet yhteensä.', 'All backup generators on the site together.') },
      },
    },
    actualFacts: ['vihti-60ha', 'vihti-generators', 'ms-construction-workers', 'ms-ops-50'],
    sources: [
      { name: 'Uudenmaan ELY-keskus', type: 'authority', date: '2023-07-20', url: 'https://www.ymparisto.fi/sites/default/files/documents/Kuulutus%2C_Vihdin_datakeskus.pdf' },
      { name: 'Microsoft', type: 'company', date: '2026-04-28', url: 'https://news.microsoft.com/source/emea/2026/04/microsoft-kaynnistaa-paakaupunkiseudun-datakeskusalueen-toisen-vaiheen-rakentamisen/?lang=fi' },
    ],
  },
  {
    id: 'nebius-mantsala', name: u('Nebius, Mäntsälä'), operator: 'Nebius',
    municipality: 'Mäntsälä', townCode: '505', status: 'operating',
    mw: 75, investmentEur: null,
    summary: u('Laajennettiin 75 MW:iin alkuvuonna 2026. Hukkalämpö on yhtiön mukaan kattanut viime vuosina enimmillään 72 % kunnan vuotuisesta lämmöntarpeesta. Nebius rakentaa Mäntsälään toisen, 70 MW:n datakeskuksen (käyttöön 2027 alkaen).',
      'Expanded to 75 MW in early 2026. The company says its waste heat has covered up to 72% of the town’s annual heating demand in recent years. Nebius is building a second 70 MW data centre in Mäntsälä (online from 2027).'),
    preset: {
      sizeMW: 75, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['cooling', 'site', 'distanceM'],
      assumed: u('Nebius ei kerro, onko 75 MW IT-tehoa vai sähkötehoa; käytämme lukua sellaisenaan. Yhtiön mukaan lämpö otetaan konesalien lämpimästä ilmasta, joten käytämme ilmajäähdytystä. Alueen tyyppi ja etäisyys koteihin ovat oletuksia.',
        'Nebius does not say whether 75 MW is IT or electrical power; we use the figure as stated. The company says heat is taken from the warm air of the server halls, so we use air cooling. Site type and distance to homes are assumptions.'),
      declared: {
        heatUsed: { typ: 15, factId: 'mantsala-heat-share',
          note: u('Yhtiön mukaan yli 30 GWh kahdessa vuodessa, eli keskimäärin yli 15 GWh vuodessa.', 'The company says over 30 GWh in two years, so on average over 15 GWh a year.'),
          comparisons: {
            pctTownDH: { typ: 72, upTo: true, factId: 'mantsala-heat-share',
              note: u('Yhtiön ilmoittama enimmäisosuus kunnan vuotuisesta lämmöntarpeesta.', 'The company’s stated maximum share of the town’s yearly heat demand.') },
          },
        },
      },
    },
    actualFacts: ['mantsala-heat-share', 'mantsala-heat-bills', 'mantsala-co2-2024'],
    sources: [
      { name: 'Nebius', type: 'company', date: '2026-03-31', url: 'https://nebius.com/newsroom/nebius-to-construct-310-mw-ai-factory-in-finland' },
      { name: 'Nebius', type: 'company', date: '2024-10-08', url: 'https://nebius.com/newsroom/nebius-to-triple-capacity-at-finland-data-center-to-75-mw' },
      { name: 'Nebius', type: 'company', date: '2026-10', url: 'https://nebius.com/sustainability/turning-heat-into-a-resource' },
      { name: 'W.Media', type: 'news', date: '2026-08-14', url: 'https://w.media/nebius-expands-its-infrastructure-in-finland-with-second-data-center/' },
    ],
  },
  {
    id: 'nebius-lappeenranta', name: u('Nebius, Lappeenranta'), operator: 'Nebius',
    municipality: 'Lappeenranta', townCode: '405', status: 'construction',
    mw: 310, investmentEur: null,
    summary: u('Jopa 310 MW:n tekoälytehdas noin 40 hehtaarin teollisuusalueella. Ensimmäinen kapasiteetti 2027. Suljettu nestejäähdytys, johon suunnitellaan lämmön talteenotto kaukolämpöön.',
      'An AI factory of up to 310 MW on an industrial site of about 40 hectares (100 acres). First capacity in 2027. Closed-loop liquid cooling designed to feed heat into district heating.'),
    preset: {
      sizeMW: 310, cooling: 'liquid', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['distanceM'],
      assumed: u('Nebius ei kerro, onko "enintään 310 MW" IT-tehoa vai sähkötehoa; käytämme lukua sellaisenaan. Etäisyys koteihin on oletus.',
        'Nebius does not say whether "up to 310 MW" is IT or electrical power; we use the figure as stated. Distance to homes is an assumption.'),
      declared: {
        jobsPermanent: { typ: 100, factId: 'nebius-lpr-jobs',
          note: u('Yhtiön suunnitelma valmiille tehtaalle.', 'The company’s plan for the finished site.') },
        jobsConstruction: { typ: 700, upTo: true, factId: 'nebius-lpr-jobs',
          note: u('Yhtiön ilmoittama enimmäismäärä rakennusvaiheessa.', 'The company’s stated maximum during construction.') },
        land: { typ: 40, factId: 'nebius-lpr-40ha',
          note: u('Noin 100 eekkerin teollisuusalue; tiivis rakentaminen vie vähemmän maata kuin yleinen laskelma.', 'An industrial site of about 100 acres; dense building uses less land than the generic calculation.') },
      },
    },
    actualFacts: ['nebius-lpr-jobs', 'nebius-lpr-40ha', 'mantsala-heat-bills'],
    sources: [
      { name: 'Nebius', type: 'company', date: '2026-03-31', url: 'https://nebius.com/newsroom/nebius-to-construct-310-mw-ai-factory-in-finland' },
    ],
  },
  {
    id: 'verne-mantsala', name: u('Verne, Mäntsälä (Kapuli)'), operator: 'Verne',
    municipality: 'Mäntsälä', townCode: '505', status: 'construction',
    mw: 70, investmentEur: null,
    summary: u('Rakentaminen alkoi kesäkuussa 2026. Ensimmäinen vaihe on 70 MW noin 10 hehtaarin alueella. Hukkalämpö on tarkoitus käyttää paikalliseen lämmitykseen.',
      'Construction started in June 2026. The first phase is 70 MW on about 10 hectares. The waste heat is meant for local heating.'),
    preset: {
      sizeMW: 70, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['cooling', 'site', 'distanceM'],
      assumed: u('Lähde ei kerro, onko ensimmäisen vaiheen 70 MW IT-tehoa vai sähkötehoa; käytämme lukua sellaisenaan. Jäähdytystapa, alueen tyyppi ja etäisyys koteihin ovat oletuksia.',
        'The source does not say whether the first phase’s 70 MW is IT or electrical power; we use the figure as stated. Cooling method, site type and distance to homes are assumptions.'),
      declared: {
        land: { typ: 10, factId: 'verne-kapuli',
          note: u('Ensimmäinen vaihe (70 MW).', 'First phase (70 MW).') },
      },
    },
    actualFacts: ['verne-kapuli'],
    sources: [
      { name: 'Datacenter Forum', type: 'news', date: '2026-06-22', url: 'https://www.datacenter-forum.com/verne/verne-begins-construction-of-its-data-center-campus-in-mantsala-finland' },
    ],
  },
  {
    id: 'csc-lumi-kajaani', name: u('CSC LUMI, Kajaani'), operator: 'CSC – Tieteen tietotekniikan keskus',
    municipality: 'Kajaani', townCode: '205', status: 'operating',
    mw: 10, investmentEur: null,
    summary: u('LUMI-supertietokone toimii Renforsin Rannan yritysalueella. Sen hukkalämpö tuotti lämpöpumpuilla 32,4 GWh lämpöä vuonna 2024 (KAMK). CSC:n mukaan lämpö voi tuottaa noin 20 % Kajaanin vuotuisesta kaukolämmöstä. Viereen rakennetaan LUMI AI Factorya, jonka lämpö on sovittu Loisteelle.',
      'The LUMI supercomputer runs in the Renforsin Ranta business park. With heat pumps its waste heat produced 32.4 GWh of heat in 2024 (KAMK). According to CSC the heat can provide about 20% of Kajaani’s yearly district heat. The LUMI AI Factory is being built next to it, with its heat promised to Loiste.'),
    preset: {
      sizeMW: 8, cooling: 'liquid', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'total',
      assumedKeys: ['distanceM'],
      assumed: u('LUMIn suurin sähköteho on noin 10 MW (KAMK 2025). Simulaattorin MW on IT-teho, joten käytämme 10 ÷ 1,25 = 8 MW. Etäisyys koteihin on oletus.',
        'LUMI’s maximum electrical power is about 10 MW (KAMK 2025). The simulator’s MW is IT power, so we use 10 ÷ 1.25 = 8 MW. Distance to homes is an assumption.'),
      declared: {
        heatUsed: { typ: 32.4, factId: 'lumi-heat-gwh',
          note: u('Lämpöpumpuilla tuotettu lämpö vuonna 2024; vuonna 2023 26,7 GWh.', 'Heat produced with heat pumps in 2024; 26.7 GWh in 2023.'),
          comparisons: {
            pctTownDH: { typ: 20, factId: 'lumi-kajaani-heat',
              note: u('CSC:n arvio siitä, mihin lämpö voi riittää. KAMK:n laskelman mukaan Loisteen verkkoon meni vuonna 2023 noin 6 % Kajaanin vuotuisesta kaukolämmön tarpeesta.', 'CSC’s estimate of what the heat can cover. KAMK calculates that the heat sent to Loiste’s network in 2023 was about 6% of Kajaani’s yearly district-heat demand.') },
          },
        },
        co2HeatAvoided: { typ: 12400, factId: 'lumi-co2',
          note: u('CSC:n arvio vuodessa.', 'CSC’s estimate per year.') },
      },
    },
    actualFacts: ['lumi-heat-gwh', 'lumi-kajaani-heat', 'lumi-co2', 'lumi-ai-heat'],
    sources: [
      { name: 'CSC', type: 'research', date: '2023-04-25', url: 'https://csc.fi/en/news/kajaani-data-center-improving-eco-efficiency/' },
      { name: 'LUMI / CSC', type: 'research', date: '2026-04-23', url: 'https://lumi-supercomputer.eu/csc-loiste-excess-heat-agreement/' },
      { name: 'KAMK: Datakeskusten hukkalämpöskenaariot Kajaanissa (webinaari)', type: 'research', date: '2025-09-24', url: 'https://kamk.fi/wp-content/uploads/2025/10/Datakeskusten-hukkalamposkenaariot-20250924.pdf' },
    ],
  },
  {
    id: 'xtx-kajaani', name: u('XTX Markets, Kajaani'), operator: 'XTX Markets',
    municipality: 'Kajaani', townCode: '205', status: 'construction',
    mw: 22.5, investmentEur: 1e9,
    summary: u('Viiden rakennuksen kampus, investointi yli miljardi euroa. Ensimmäisen rakennuksen kolmessa salissa on yhteensä 22,5 MW IT-tehoa; se oli määrä ottaa käyttöön 2026. Yhtiö selvittää lämmön antamista Kajaanille maksutta.',
      'A five-building campus, an investment of over €1 billion. The first building’s three halls have 22.5 MW of IT power in total; it was due to start in 2026. The company is exploring giving heat to Kajaani free of charge.'),
    preset: {
      sizeMW: 22.5, cooling: 'air', heatReuse: true, site: 'forest', distanceM: 1000, mwBasis: 'it',
      assumedKeys: ['heatReuse', 'site', 'distanceM'],
      assumed: u('Ensimmäinen rakennus, 22,5 MW IT-tehoa; viiden rakennuksen kampus on paljon suurempi (tontti noin 190 ha). Yhtiön mukaan jäähdytys tehdään ulkoilmalla ilman vettä. Maasto ja etäisyys koteihin ovat oletuksia. Lämmön käyttö on vasta selvitys.',
        'The first building, 22.5 MW of IT power; the five-building campus is much larger (a site of about 190 ha). The company says cooling uses outside air without water. Site type and distance to homes are assumptions. Heat reuse is only being explored.'),
    },
    actualFacts: ['xtx-heat-on-paper'],
    sources: [
      { name: 'XTX Markets', type: 'company', date: '2025-01-22', url: 'https://files.xtxmarkets.com/publications/kajaani/index.html' },
    ],
  },
  {
    id: 'atnorth-kouvola', name: u('atNorth FIN04, Kouvola (Myllykoski)'), operator: 'atNorth',
    municipality: 'Kouvola', townCode: '286', status: 'construction',
    mw: 430, investmentEur: 4e9,
    summary: u('Neljän datakeskuksen kampus entisen paperitehtaan alueella, investointi noin 4 miljardia euroa. Yhtiön mukaan täysi 430 MW:n sähköteho saavutetaan noin kymmenessä vuodessa. YIT:n rakentama osa valmistuu 2027.',
      'A four-data-centre campus on a former paper-mill site, an investment of about €4 billion. The company expects to reach the full 430 MW of electrical power in about ten years. The part built by YIT is due in 2027.'),
    preset: {
      sizeMW: 344, cooling: 'air', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'total',
      assumedKeys: ['cooling', 'distanceM'],
      assumed: u('Lähde kertoo suurimman sähkötehon (430 MW). Simulaattorin MW on IT-teho, joten käytämme 430 ÷ 1,25 = 344 MW. Jäähdytys ja etäisyys koteihin ovat oletuksia. YIT:n mukaan ylijäämälämpöä voidaan käyttää kaukolämpönä.',
        'The source gives the maximum electrical power (430 MW). The simulator’s MW is IT power, so we use 430 ÷ 1.25 = 344 MW. Cooling and distance to homes are assumptions. YIT says the surplus heat can be used for district heating.'),
    },
    actualFacts: ['atnorth-60pct'],
    sources: [
      { name: 'Yle', type: 'news', date: '2026-02-11', url: 'https://yle.fi/a/74-20208368' },
      { name: 'YIT (Inderes-tiedote)', type: 'company', date: '2026-07-21', url: 'https://www.inderes.fi/releases/yit-ja-atnorth-sopimukseen-datakeskuksen-rakentamisesta-kouvolaan-arvo-yitlle-noin-300-miljoonaa-euroa' },
    ],
  },
  {
    id: 'dayone-lahti', name: u('DayOne, Lahti (Kiveriö)'), operator: 'DayOne',
    municipality: 'Lahti', townCode: '398', status: 'construction',
    mw: 128, investmentEur: 1.2e9,
    summary: u('Entiselle teollisuusalueelle, noin 10 hehtaarin tontille. Ensimmäinen rakennus 50 MW, koko kampus jopa 128 MW IT-tehoa. Rakentaminen alkoi huhtikuussa 2026, käyttöön 2027. Ilmajäähdytys ilman makeaa vettä.',
      'On a former industrial site of about 10 hectares. The first building is 50 MW, the whole campus up to 128 MW of IT power. Construction began in April 2026, operation in 2027. Air cooling without fresh water.'),
    preset: {
      sizeMW: 128, cooling: 'air', heatReuse: false, site: 'industrial', distanceM: 1000, mwBasis: 'it',
      assumedKeys: ['heatReuse', 'distanceM'],
      assumed: u('Koko kampus, 128 MW IT-tehoa (ensimmäinen rakennus 50 MW). Hukkalämmön käyttöä vasta selvitetään, joten se on pois päältä. Etäisyys koteihin on oletus.',
        'The whole campus, 128 MW of IT power (first building 50 MW). Heat reuse is only being studied, so it is switched off. Distance to homes is an assumption.'),
      declared: {
        jobsPermanent: { typ: 100, factId: 'dayone-lahti-jobs',
          note: u('Yhtiön suunnitelma koko kampukselle.', 'The company’s plan for the whole campus.') },
        jobsConstruction: { typ: 1000, upTo: true, factId: 'dayone-lahti-jobs',
          note: u('Työmaalla huippuvaiheessa.', 'On site at the peak.') },
        land: { typ: 9.9, factId: 'dayone-lahti-10ha',
          note: u('Tontti 98 901 m² valmiiksi kaavoitetulla teollisuusalueella.', 'A plot of 98,901 m² in an area already zoned for industry.') },
      },
    },
    actualFacts: ['dayone-lahti-jobs', 'dayone-lahti-10ha'],
    sources: [
      { name: 'W.Media', type: 'news', date: '2025-08-15', url: 'https://w.media/dayone-to-invest-eur-1-2-billion-in-data-center-in-finland/' },
      { name: 'SRV', type: 'company', date: '2026-04-07', url: 'https://www.srv.fi/en/srv-as-a-company/newsroom/press-release/dayone-data-center-construction-to-start-in-lahti-srv-strengthens-its-position-in-the-growing-market-for-data-center-construction/' },
    ],
  },
  {
    id: 'dayone-sudentulli', name: u('Sudentulli, Nurmijärvi (Klaukkala)'), operator: 'DayOne (DigitalLand Services Kinetic DC Oy)',
    municipality: 'Nurmijärvi', townCode: '543', status: 'planned',
    mw: 560, investmentEur: null,
    summary: u('YVA-menettely alkoi syyskuussa 2026. Suunnitelmassa viisi rakennusta noin 96 hehtaarilla, sähköteho noin 560 MW ja varavoimaa noin 1 360 MW polttoainetehoa. Uudet 400 kV:n linjat Fingridin verkkoon.',
      'The EIA began in September 2026. The plan: five buildings on about 96 hectares, about 560 MW of electrical power and backup generators with about 1,360 MW of fuel power. New 400 kV lines to Fingrid’s grid.'),
    preset: {
      sizeMW: 448, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 1000, mwBasis: 'total',
      assumedKeys: ['cooling', 'heatReuse', 'site', 'distanceM'],
      assumed: u('Viranomainen kertoo sähkötehon (noin 560 MW). Simulaattorin MW on IT-teho, joten käytämme 560 ÷ 1,25 = 448 MW. Jäähdytystä, hukkalämpöä, maastoa ja etäisyyttä koteihin ei kerrottu: ne ovat oletuksia.',
        'The authority gives the electrical power (about 560 MW). The simulator’s MW is IT power, so we use 560 ÷ 1.25 = 448 MW. Cooling, heat reuse, site type and distance to homes were not stated: they are assumptions.'),
      declared: {
        land: { typ: 96, factId: 'sudentulli-96ha',
          note: u('Viisi rakennusta YVA-ohjelman mukaan.', 'Five buildings according to the EIA programme.') },
        backupPower: { typ: 1360, factId: 'sudentulli-generators',
          note: u('Koko alueen varavoimakoneet yhteensä.', 'All backup generators on the site together.') },
      },
    },
    actualFacts: ['sudentulli-96ha', 'sudentulli-generators'],
    sources: [
      { name: 'Lupa- ja valvontavirasto (STT)', type: 'authority', date: '2026-09-16', url: 'https://www.sttinfo.fi/tiedote/72306550' },
    ],
  },
  {
    id: 'compute-nordic-mikkeli', name: u('Compute Nordic / Cerebras, Mikkeli'), operator: 'Compute Nordic Finland',
    municipality: 'Mikkeli', townCode: '491', status: 'construction',
    mw: 165, investmentEur: null,
    summary: u('Ensimmäinen 50 MW:n vaihe on rakenteilla. Täysi koko 165 MW IT-kapasiteettia. Hankeyhtiöiden tiedotteen mukaan Rambollin selvitykseen perustuva arvio on, että investointi on 1,0–1,7 miljardia euroa ja kiinteistövero 0,8–2,5 miljoonaa euroa vuodessa. Suljettu jäähdytyskierto.',
      'The first 50 MW phase is under construction; full size 165 MW of IT capacity. According to the developers’ press release, an estimate based on a Ramboll study puts the investment at €1.0–1.7 billion and property tax at €0.8–2.5 million a year. Closed-loop cooling.'),
    preset: {
      sizeMW: 165, cooling: 'liquid', heatReuse: true, site: 'industrial', distanceM: 1000, mwBasis: 'it',
      assumedKeys: ['site', 'distanceM'],
      assumed: u('Täysi koko, 165 MW IT-kapasiteettia. Suljettu vesikierto on lähinnä vaihtoehtoa "neste". Alueen tyyppi ja etäisyys koteihin ovat oletuksia; hukkalämpö on suunnitelma.',
        'Full size, 165 MW of IT capacity. Closed-loop water cooling is closest to the "liquid" option. Site type and distance to homes are assumptions; heat reuse is a plan.'),
      declared: {
        propertyTax: { low: 0.8e6, typ: 1.65e6, high: 2.5e6, factId: 'mikkeli-ramboll-tax',
          note: u('Arvio täydelle 165 MW:n koolle; "tyypillinen" on välin keskikohta.', 'Estimate for the full 165 MW; "typical" is the middle of the range.') },
        jobsPermanent: { low: 80, typ: 165, high: 250, factId: 'mikkeli-ramboll-tax',
          note: u('Suoria pysyviä työpaikkoja; "tyypillinen" on välin keskikohta.', 'Direct permanent jobs; "typical" is the middle of the range.') },
        investment: { low: 1.0e9, typ: 1.35e9, high: 1.7e9, factId: 'mikkeli-ramboll-tax',
          note: u('Arvio täydelle 165 MW:n koolle; "tyypillinen" on välin keskikohta.', 'Estimate for the full 165 MW; "typical" is the middle of the range.') },
      },
    },
    actualFacts: ['mikkeli-ramboll-tax'],
    sources: [
      { name: 'StorageNewsletter', type: 'news', date: '2026-09-02', url: 'https://www.storagenewsletter.com/2026/09/02/cerebras-and-compute-nordic-finland-announce-new-165mw-ai-data-centre-in-mikkeli-finland/' },
    ],
  },
  {
    id: 'meta-ii', name: u('Meta (Valoa Networks), Ii'), operator: 'Meta (Valoa Networks Oy)',
    municipality: 'Ii', townCode: '139', status: 'planned',
    mw: null, investmentEur: null,
    summary: u('Hervaan kaavoitetaan vajaan 500 hehtaarin tonttia, enimmäkseen talousmetsää. Lähiasukkaat pelkäävät liikennettä, hiljaisuuden katoamista ja asuntojen arvon laskua.',
      'A plot of just under 500 hectares, mostly commercial forest, is being zoned in Herva. Nearby residents fear traffic, loss of quiet and lower home values.'),
    preset: {
      sizeMW: 500, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 1000, mwBasis: 'unknown',
      assumedKeys: ['sizeMW', 'cooling', 'heatReuse', 'distanceM'],
      assumed: u('Kokoa (MW) ei ole julkaistu: käytämme oletuskokoa 500 MW, koska tontti on suuri. Jäähdytystä ja hukkalämmön käyttöä ei ole julkaistu. Etäisyys koteihin on oletus.',
        'The size (MW) has not been published: we assume 500 MW because the plot is large. Cooling and heat reuse have not been published. Distance to homes is an assumption.'),
      declared: {
        land: { typ: 500, upTo: true, factId: 'ii-500ha',
          note: u('Varattu tontti, vajaat 500 ha; kaavoitettava alue on yli 1 000 ha.', 'The reserved plot, just under 500 ha; the planning area is over 1,000 ha.') },
      },
    },
    actualFacts: ['ii-500ha', 'ii-residents-fears'],
    sources: [
      { name: 'Kaleva', type: 'news', date: '2025-12-03', url: 'https://www.kaleva.fi/iihin-tulossa-metan-jattimainen-datakeskus-asukas/12430105' },
      { name: 'Kaleva', type: 'news', date: '2026-07-17', url: 'https://www.kaleva.fi/iin-datakeskushanke-herattaa-pelkoa-hankealueella/13582975' },
    ],
  },
  {
    id: 'jarvenpaa-dc', name: u('Järvenpään datakeskus'), operator: 'Data Prop Link Oy',
    municipality: 'Järvenpää', townCode: '186', status: 'planned',
    mw: 130, investmentEur: null,
    summary: u('YVA-selostus valmistui toukokuussa 2026. 100–130 MW IT-tehoa 8,8 hehtaarin tontilla, joka on asemakaavassa teollisuusaluetta. Ilmajäähdytys ilman jäähdytysvettä. Rakentaminen alkaisi aikaisintaan 2027 ja toiminta 2028–2029.',
      'The EIA report was completed in May 2026: 100–130 MW of IT power on an 8.8-hectare plot zoned for industry, air cooling with no cooling water. Construction would start in 2027 at the earliest, operation in 2028–2029.'),
    preset: {
      sizeMW: 100, cooling: 'air', heatReuse: false, site: 'forest', distanceM: 350, mwBasis: 'it',
      assumedKeys: [],
      assumed: u('YVA:n vaihtoehto 1: 100 MW IT-tehoa (vaihtoehdossa 2 on 130 MW). Tontti on asemakaavassa teollisuusaluetta (T-13), mutta nykyisin pääosin lehtimetsää. Lähin omakotitalo on YVA-selostuksen mukaan noin 350 m päässä pohjoisessa, laajempi asuinalue vähintään 500 m päässä. Hukkalämmön talteenotto ei kuulu arvioituun hankkeeseen.',
        'EIA option 1: 100 MW of IT power (option 2 is 130 MW). The plot is zoned for industry (T-13) but is now mostly deciduous forest. According to the EIA report the nearest detached house is about 350 m to the north and the wider residential area at least 500 m away. Heat recovery is not part of the assessed project.'),
      declared: {
        water: { low: 4000, typ: 4500, high: 5000, factId: 'jarvenpaa-water',
          note: u('Vettä ei käytetä jäähdytykseen, vain talous- ja käyttövedeksi.', 'No water is used for cooling, only for everyday use.') },
        noise: { low: 39, typ: 42, high: 44, factId: 'jarvenpaa-noise',
          note: u('100 MW:n vaihtoehto, mallinnettu lähimmissä asuinkohteissa (130 MW: 41–46 dB).', 'The 100 MW option, modelled at the nearest homes (130 MW: 41–46 dB).') },
        land: { typ: 8.8, factId: 'jarvenpaa-8ha',
          note: u('Tiivis, enintään 30 m korkea rakennus pienellä tontilla.', 'A compact building up to 30 m tall on a small plot.') },
        jobsPermanent: { typ: 40, factId: 'jarvenpaa-jobs',
          note: u('Vakituinen henkilöstö valmiissa datakeskuksessa.', 'Permanent staff at the finished site.') },
        jobsConstruction: { low: 75, typ: 140, high: 200, factId: 'jarvenpaa-jobs',
          note: u('YVA:n arvio 75–200 henkilöä; "tyypillinen" on välin keskikohta.', 'The EIA estimates 75–200 people; "typical" is the middle of the range.') },
        trucks: { typ: 40, factId: 'jarvenpaa-construction-traffic',
          note: u('Maanrakennusvaiheessa (alle vuosi); muuten raskasta liikennettä on vähän.', 'During the earthworks (under a year); otherwise there is little heavy traffic.'),
          comparisons: {
            operation: { low: 1, typ: 1.5, high: 2, factId: 'jarvenpaa-operation-traffic',
              note: u('Valmiin datakeskuksen raskaat kuljetukset päivässä.', 'Heavy deliveries a day once running.') },
          },
        },
        backupPower: { typ: 350, factId: 'jarvenpaa-generators',
          note: u('100 MW:n vaihtoehto; 130 MW:n vaihtoehdossa noin 455 MW.', 'The 100 MW option; about 455 MW in the 130 MW option.') },
        eWaste: { typ: 400, factId: 'jarvenpaa-ewaste',
          note: u('YVA:n varovainen oletus: uusinta noin kolmen vuoden välein.', 'A cautious EIA assumption: a refresh about every three years.') },
        gridPeak: { typ: 125, factId: 'jarvenpaa-peak-power',
          note: u('Huipputehon tarve 100 MW:n vaihtoehdossa; 130 MW:n vaihtoehdossa noin 163 MW.', 'Peak power need in the 100 MW option; about 163 MW in the 130 MW option.') },
      },
    },
    actualFacts: ['jarvenpaa-water', 'jarvenpaa-noise', 'jarvenpaa-jobs', 'jarvenpaa-construction-traffic', 'jarvenpaa-operation-traffic', 'jarvenpaa-8ha', 'jarvenpaa-peak-power', 'jarvenpaa-generators', 'jarvenpaa-generator-tests', 'jarvenpaa-ewaste'],
    sources: [
      { name: 'Järvenpään datakeskuksen YVA-selostus (Ramboll hankkeesta vastaavan Data Prop Link Oy:n puolesta)', type: 'company', date: '2026-05-20', url: 'https://www.ymparisto.fi/sites/default/files/documents/J%C3%A4rvenp%C3%A4%C3%A4n%20datakeskus%20YVA-selostus_saavutettava_FINAL_0.pdf' },
    ],
  },
];

export const projectById = (id) => PROJECTS.find((p) => p.id === id) || null;

const STATUS_ORDER = ['operating', 'construction', 'planned', 'halted'];

/** The PROJECTS in one municipality (3-digit code), ordered operating, construction, planned, halted. */
export function projectsInTown(code) {
  const c = String(code ?? '').padStart(3, '0');
  return PROJECTS
    .filter((p) => p.townCode === c)
    .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
}
