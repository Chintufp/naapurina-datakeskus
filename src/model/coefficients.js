// Every number the impact model uses, with its range, plain-language meaning and sources.
// Shape (SPEC §5): { low, typ, high, unit, title, explain, confidence, sources, note? }
// A coefficient with low === typ === high is a fixed reference value (it is not varied in the uncertainty runs).
// Wide ranges (high at least 3 × low) are drawn in log space by model.js, so the middle result sits near `typ`.
// Per-MW coefficients are per MW of IT load (server capacity), the one MW basis used everywhere in the model.
// Checked 24.10.2026; construction emissions, heat per home, electronics per refresh and the noise guidelines
// re-checked 25.10.2026. "Derived" in a note means we calculated it from the cited inputs (the calculation is shown).

// ---------------------------------------------------------------- sources
export const SRC = {
  jarvenpaa: { name: 'Järvenpään datakeskuksen YVA-selostus (Ramboll hankkeesta vastaavan Data Prop Link Oy:n puolesta)', type: 'company', date: '2026-05-20', url: 'https://www.ymparisto.fi/sites/default/files/documents/J%C3%A4rvenp%C3%A4%C3%A4n%20datakeskus%20YVA-selostus_saavutettava_FINAL_0.pdf' },
  espooEia: { name: 'Espoon datakeskushanke (Microsoft): YVA-yleisötilaisuuden aineisto', type: 'company', date: '2024-03-14', url: 'https://www.ymparisto.fi/sites/default/files/documents/YVA%20yleis%C3%B6tilaisuus%20Datakeskushanke%20Espoo%2014032024_Nettiv_pdf.pdf' },
  vihti: { name: 'Uudenmaan ELY-keskus: kuulutus, Vihdin datakeskuksen YVA-ohjelma (Microsoft)', type: 'authority', date: '2023-07-20', url: 'https://www.ymparisto.fi/sites/default/files/documents/Kuulutus%2C_Vihdin_datakeskus.pdf' },
  kirkkonummi: { name: 'Uudenmaan ELY-keskus: kuulutus, Kirkkonummen datakeskusalueen YVA-selostus (Microsoft)', type: 'authority', date: '2024-03-26', url: 'https://www.ymparisto.fi/sites/default/files/documents/Kuulutus_Kirkkonummen_datakeskusalue_26032024.pdf' },
  euEed: { name: 'Euroopan komissio: Energy Efficiency Directive – data-centre reporting, technical report', type: 'authority', date: '2025-07', url: 'https://op.europa.eu/en/publication-detail/-/publication/83be4c3e-5c79-11f0-a9d0-01aa75ed71a1/language-en' },
  kamk: { name: 'KAMK: Datakeskusten jäähdytys ja hukkalämpöskenaariot Kajaanissa (webinaari)', type: 'research', date: '2025-09-24', url: 'https://kamk.fi/wp-content/uploads/2025/10/Datakeskusten-hukkalamposkenaariot-20250924.pdf' },
  nebiusHeat: { name: { fi: 'Nebius: Turning heat into a resource (Mäntsälä), luettu 24.10.2026', en: 'Nebius: Turning heat into a resource (Mäntsälä), accessed 24 Oct 2026' }, type: 'company', date: '2026-10-24', url: 'https://nebius.com/sustainability/turning-heat-into-a-resource' },
  msEfficiency: { name: { fi: 'Microsoft: Datacenter efficiency (PUE ja WUE alueittain, FY24–FY25), luettu 24.10.2026', en: 'Microsoft: Datacenter efficiency (PUE and WUE by region, FY24–FY25), accessed 24 Oct 2026' }, type: 'company', date: '2026-10-24', url: 'https://datacenters.microsoft.com/sustainability/efficiency/' },
  dcWater: { name: { fi: 'Datacentres.com: Data centre water usage (WUE jäähdytystavoittain), luettu 24.10.2026', en: 'Datacentres.com: Data centre water usage (WUE by cooling method), accessed 24 Oct 2026' }, type: 'industry', date: '2026-10-24', url: 'https://www.datacentres.com/guides/data-centre-water-usage' },
  csc: { name: 'CSC: Kajaanin datakeskuksen ekotehokkuus (LUMI)', type: 'research', date: '2023-04-25', url: 'https://csc.fi/en/news/kajaani-data-center-improving-eco-efficiency/' },
  fortum: { name: { fi: 'Fortum: Datakeskukset pääkaupunkiseudulla (hukkalämpö kaukolämpöön), luettu 24.10.2026', en: 'Fortum: Data centres in the Helsinki region (waste heat to district heating), accessed 24 Oct 2026' }, type: 'company', date: '2026-10-24', url: 'https://www.fortum.com/data-centres-helsinki-region' },
  caverion: { name: 'Caverion: tiedote Nebiuksen Mäntsälän datakeskuksen laajennuksesta', type: 'company', date: '2025-04-30', url: 'https://www.caverion.com/newsroom/releases/2025/caverion-strengthens-its-position-as-key-partner-in-major-infrastructure-investments-in-europe--secures-a-large-contract-related-to-the-expansion-of-a-state-of-the-art-data-centre-in-finland/' },
  hamina: { name: 'heise online: Google toimittaa Haminan datakeskuksen hukkalämmön kaukolämpöön (noin 80 %)', type: 'news', date: '2024-05-22', url: 'https://heise.de/-9726152' },
  calefa: { name: 'Calefa Oy (STT): Datakeskusten jäähdytys lämmittää suomalaisia koteja', type: 'company', date: '2026-08-31', url: 'https://www.sttinfo.fi/tiedote/72274046/datakeskusten-jaahdytys-lammittaa-suomalaisia-koteja?lang=fi' },
  energiateollisuus: { name: 'Energiateollisuus ry: District heating in Finland 2024', type: 'industry', date: '2026-01', url: 'https://energia.fi/wp-content/uploads/2026/01/District_heating_in_Finland_2024.pdf' },
  ipcc: { name: 'IPCC 2006 Guidelines, Vol. 2 Ch. 2: Stationary Combustion (maakaasun oletuspäästökerroin)', type: 'research', date: '2006-04', url: 'https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/2_Volume2/V2_2_Ch2_Stationary_Combustion.pdf' },
  fingridH1: { name: 'Fingrid: Puolivuosikatsaus 1.1.–30.6.2026', type: 'authority', date: '2026-07-23', url: 'https://www.fingrid.fi/en/news/news/2026/fingrid-groups-half-year-report-1.1.30.6.2026/' },
  fingrid2024: { name: 'Fingrid: Tilinpäätöstiedote 2024', type: 'authority', date: '2025-03-04', url: 'https://www.fingrid.fi/en/news/news/2025/fingrid-oyjs-financial-statements-bulletin-januarydecember-2024-the-need-for-electricity-transmission-and-grid-connection-continued-to-grow-rapidly--fingrids-grid-investments-increased-to-a-reco/' },
  fingridForecast: { name: 'Fingrid (STT): Sähkönkulutuksen ennuste 2030 ja 2035', type: 'authority', date: '2026-09-30', url: 'https://www.sttinfo.fi/tiedote/72373063/' },
  yleDc: { name: 'Yle: Datakeskusten sähkönkulutus ja Datakeskusyhdistyksen 2 500 MW:n skenaario', type: 'news', date: '2025-11-05', url: 'https://yle.fi/a/74-20192344' },
  tvo: { name: 'TVO: Olkiluoto tuotti noin neljänneksen Suomen sähköstä 2025 (OL3: 10,38 TWh)', type: 'company', date: '2026-01', url: 'https://www.tvo.fi/en/index/news/pressreleasesstockexchangereleases/2026/olkiluotoproducedaboutaquarteroffinnishelectricityin2025.html' },
  wnnOl3: { name: 'World Nuclear News: Olkiluoto 3 (1 600 MWe) saavuttaa täyden tehon', type: 'news', date: '2022-09-30', url: 'https://world-nuclear-news.org/articles/finnish-epr-reaches-full-capacity-for-first-time' },
  veroSahko: { name: 'Verohallinto: Sähkövero (datakeskukset veroluokkaan I 1.7.2026)', type: 'authority', date: '2026-04-23', url: 'https://vero.fi/yritykset-ja-yhteisot/verot-ja-maksut/valmisteverotus/sahkovero/' },
  vavm: { name: 'Eduskunta: valtiovarainvaliokunnan mietintö VaVM 28/2025 vp (sähköveroluokka I 2,24 snt/kWh)', type: 'politics', date: '2025-12-05', url: 'https://www.edilex.fi/mt/vavm20250028' },
  veroRates: { name: 'Verohallinto: kiinteistöverotilastot kunnittain (taulukko kive_202, 2025 ja 2026 ennakkotieto)', type: 'statistics', date: '2026-10-24', url: 'https://vero2.stat.fi/PXWeb/pxweb/fi/Vero/Vero__Kiinteistoverot/kive_202.px/' },
  veroBase: { name: 'Verohallinto: Kiinteistön verotusarvo ja kiinteistöverot (rakennuksen jälleenhankinta-arvo, ikäalennus)', type: 'authority', date: '2014-01-20', url: 'https://www.vero.fi/syventavat-vero-ohjeet/ohje-hakusivu/48219/kiinteiston_verotusarvo_kiinteistoverot/' },
  ramboll: { name: 'Cerebras ja Compute Nordic: tiedote Mikkelin 165 MW:n hankkeesta, Rambollin selvitykseen perustuva arvio (StorageNewsletter)', type: 'company', date: '2026-09-02', url: 'https://www.storagenewsletter.com/2026/09/02/cerebras-and-compute-nordic-finland-announce-new-165mw-ai-data-centre-in-mikkeli-finland/' },
  nebiusLpr: { name: 'W.Media: Nebius rakentaa 310 MW:n datakeskuksen Lappeenrantaan', type: 'news', date: '2026-03-31', url: 'https://w.media/nebius-to-construct-310-mw-ai-factory-in-finland/' },
  dayone: { name: 'W.Media: DayOne investoi 1,2 mrd. € Lahden datakeskukseen', type: 'news', date: '2025-08-15', url: 'https://w.media/dayone-to-invest-eur-1-2-billion-in-data-center-in-finland/' },
  msImpact: { name: 'Microsoft: Economic impact of datacenter investments in Finland (infografiikka)', type: 'company', date: '2026-07', url: 'https://local.microsoft.com/wp-content/uploads/2026/07/Economic-Impact_Finland_English_FY26Q4.pdf' },
  mikkeli2020: { name: 'Mikkelin datakeskusselvitys, loppuraportti', type: 'research', date: '2020-11-30', url: 'https://arkisto.mikseimikkeli.fi/wp-content/uploads/2025/03/Loppuraportti_30.11.2020.pdf' },
  turner: { name: 'Turner & Townsend: Data centre cost index 2025 (Helsinki 12,3 USD/W)', type: 'industry', date: '2025-11-05', url: 'https://www.turnerandtownsend.com/en-us/news/ai-data-center-rush-raises-alarm-over-construction-supply-chain/' },
  siliconangle: { name: 'SiliconANGLE: GPU-laitteiden poistoaika (depreciation) 5–6 vuotta', type: 'news', date: '2025-11-22', url: 'https://siliconangle.com/2025/11/22/resetting-gpu-depreciation-ai-factories-bend-dont-break-useful-life-assumptions/' },
  taloustaito: { name: 'Taloustaito: kotitalouden sähkönkulutus (5 000 kWh / sähkölämmitteinen omakotitalo 18 000 kWh)', type: 'news', date: '2019-01-15', url: 'https://www.taloustaito.fi/koti/kerrostalo-ja-pientaloasukas-kilpailuta-sahkosopimus-viimeistaan-nyt/' },
  vnp993: { name: 'Valtioneuvoston päätös melutason ohjearvoista 993/1992', type: 'authority', date: '1992-10-29', url: 'https://www.finlex.fi/fi/laki/alkup/1992/19920993' },
  espooBoard: { name: 'Espoon ympäristö- ja rakennuslautakunta: lausunto Hepokorven datakeskuksen (HEL16) ympäristölupahakemuksesta', type: 'authority', date: '2025-03-20', url: 'https://espoo-sv.oncloudos.com/kokous/20251396-16.PDF' },
  sudentulli: { name: 'Lupa- ja valvontavirasto (STT): Klaukkalan Sudentullin datakeskuksen YVA-menettely käynnistyy', type: 'authority', date: '2026-09-16', url: 'https://www.sttinfo.fi/tiedote/72306550' },
  // added 24.10.2026 (each checked on that day)
  msWater: { name: { fi: 'Microsoft: Inside Microsoft’s two-decade push to cut water intensity (blogi: vettä vain yli 29 °C:n säällä, Dublin ja Amsterdam alle 5 % ajasta)', en: 'Microsoft: Inside Microsoft’s two-decade push to cut water intensity (blog: water only above 29 °C, Dublin and Amsterdam under 5% of the time)' }, type: 'company', date: '2026-06-24', url: 'https://blogs.microsoft.com/blog/2026/06/24/inside-microsofts-two-decade-push-to-cut-water-intensity-while-scaling-for-growth/' },
  msNews: { name: 'Microsoft: pääkaupunkiseudun datakeskusalueen toisen vaiheen rakentaminen alkaa (operointi työllistää noin 50 henkilöä kussakin rakennuksessa)', type: 'company', date: '2026-04-28', url: 'https://news.microsoft.com/source/emea/2026/04/microsoft-kaynnistaa-paakaupunkiseudun-datakeskusalueen-toisen-vaiheen-rakentamisen/?lang=fi' },
  verne: { name: 'Datacenter Forum: Verne aloittaa Mäntsälän (Kapuli) datakeskuskampuksen rakentamisen, noin 10 ha ja 70 MW', type: 'news', date: '2026-06-22', url: 'https://www.datacenter-forum.com/verne/verne-begins-construction-of-its-data-center-campus-in-mantsala-finland' },
  zangeneh: { name: 'Zangeneh & Øi (University of South-Eastern Norway): Economic investigation of heat pumps for heat recovery from data center, SIMS 2023', type: 'research', date: '2023-09', url: 'https://ecp.ep.liu.se/index.php/sims/article/download/747/652' },
  usSupport: { name: 'Uusi Suomi: 30 miljoonan verotuki kaatui (datakeskusten suunniteltu verotuki)', type: 'news', date: '2026-09-02', url: 'https://www.uusisuomi.fi/uutiset/a/8804afef-6cd2-45f8-bbf5-658b90cc104d' },
  tsBudget: { name: 'Turun Sanomat: Hallitus urakoi budjettiriihen valmiiksi päivässä (datakeskusten verotuesta luovutaan)', type: 'news', date: '2026-09-01', url: 'https://www.ts.fi/a/7073134' },
  yvaLaki: { name: { fi: 'Laki ympäristövaikutusten arviointimenettelystä 252/2017 (3 § ja liite 1, kohta 7a), luettu 24.10.2026', en: 'Act on the Environmental Impact Assessment Procedure 252/2017 (section 3 and annex 1, item 7a), accessed 24 Oct 2026' }, type: 'authority', date: '2026-10-24', url: 'https://www.finlex.fi/fi/lainsaadanto/2017/252' },
  vna1065: { name: { fi: 'Valtioneuvoston asetus keskisuurten energiantuotantoyksiköiden ja -laitosten ympäristönsuojeluvaatimuksista 1065/2017 (1 §), luettu 24.10.2026', en: 'Government Decree 1065/2017 on environmental requirements for medium-sized energy production units (section 1), accessed 24 Oct 2026' }, type: 'authority', date: '2026-10-24', url: 'https://www.finlex.fi/fi/lainsaadanto/2017/1065' },
  ysl: { name: { fi: 'Ympäristönsuojelulaki 527/2014 (27 § ja liite 1, kohta 3a: polttoaineteho 50 MW tai enemmän), luettu 24.10.2026', en: 'Environmental Protection Act 527/2014 (section 27 and annex 1, item 3a: fuel power of 50 MW or more), accessed 24 Oct 2026' }, type: 'authority', date: '2026-10-24', url: 'https://www.finlex.fi/fi/lainsaadanto/2014/527' },
  lvvHalt: { name: 'Lupa- ja valvontavirasto (STT): kehotus keskeyttää Muhoksen ja Kajaanin datakeskushankkeiden valmistelutoimet, kunnes YVA on tehty', type: 'authority', date: '2026-10-06', url: 'https://www.sttinfo.fi/tiedote/72390663' },
  fortumHp: { name: 'Fortum: lämmöntuotanto käynnistyi Fortumin lämpöpumppulaitoksilla Espoon ja Kirkkonummen datakeskusalueilla (lehdistötiedote)', type: 'company', date: '2026-05-06', url: 'https://www.fortum.com/media/2026/05/fortum-has-started-heat-production-two-large-data-centre-sites-finland' },
  // Checked 25.10.2026 (engineer review): embodied carbon, heat per home, hardware mass, noise guidelines.
  icef: { name: 'ICEF (Friedmann ja McCormick): Sustainable Data Centers Roadmap, luku 3.3 Embodied Greenhouse Gas Emissions (Scope 3)', type: 'research', date: '2025-10', url: 'https://icef.go.jp/wp-content/themes/icef_new/pdf/roadmap/2025/CHAPTER%20%E2%85%A2%20%E2%80%93%203.%20EMBODIED%20GREENHOUSE%20GAS%20EMISSIONS%20(SCOPE%203).pdf' },
  seWp99: { name: 'Schneider Electric (Lin, Bunger, Avelar): White Paper 99, Quantifying Data Center Scope 3 GHG Emissions to Prioritize Reduction Efforts (1 MW:n esimerkkidatakeskus)', type: 'company', date: '2023-06', url: 'https://download.se.com/doc/SPD_WP99_EN/WP99_V1_EN.pdf' },
  turkuEnergia: { name: 'Turku Energia (STT): Kaukolämmön syyshinta säilyy ennallaan (Energiateollisuuden hintatilaston tyyppirakennukset: 180 m²:n omakotitalo 18 MWh/v, 80 asunnon kerrostalo 600 MWh/v)', type: 'company', date: '2026-08-31', url: 'https://www.sttinfo.fi/tiedote/72276141/kaukolammon-syyshinta-sailyy-ennallaan-hintakehitys-tulevaan-talveen-ja-kevaaseen-on-laskeva?lang=fi' },
  etPrice: { name: 'Energiateollisuus ry: Kaukolämmön hinta 1.1.2026 (tyyppirakennukset: pientalo 600 m³, rivitalo 5 000 m³, kerrostalo 20 000 m³)', type: 'industry', date: '2026-02-17', url: 'https://energia.fi/wp-content/uploads/2026/06/Kaukolammon_hinta_01012026.pdf' },
  statHouseholds: { name: 'Tilastokeskus: Asuntokunnat koon mukaan ja asuntokuntien keskikoko 1960–2020 (2020: 1,96 henkeä)', type: 'statistics', date: '2021-05-20', url: 'https://stat.fi/til/asas/2020/asas_2020_2021-05-20_tau_001_fi.html' },
  registerGb200: { name: 'The Register: Taking a closer look at Nvidia’s DGX GB200 NVL72 (räkki 1,36 t, 120 kW)', type: 'news', date: '2024-03-21', url: 'https://www.theregister.com/on-prem/2024/03/21/a-closer-look-at-nvidias-120kw-dgx-gb200-nvl72-rack-system/912087' },
  nvidiaH100: { name: { fi: 'NVIDIA: DGX H100 User Guide, laitteen tekniset tiedot (enintään 130,45 kg ja 10,2 kW), luettu 25.10.2026', en: 'NVIDIA: DGX H100 User Guide, hardware specifications (up to 130.45 kg and 10.2 kW), accessed 25 Oct 2026' }, type: 'company', date: '2026-10-25', url: 'https://docs.nvidia.com/dgx/dgxh100-user-guide/introduction-to-dgxh100.html' },
  ibmRack: { name: { fi: 'IBM: 7014-T00 and 7014-T42 rack weight distribution and floor loading (täysi räkki enintään 930 kg), luettu 25.10.2026', en: 'IBM: 7014-T00 and 7014-T42 rack weight distribution and floor loading (a full rack up to 930 kg), accessed 25 Oct 2026' }, type: 'company', date: '2026-10-25', url: 'https://www.ibm.com/docs/P9ESS/p9had/p9had_rwdafl.htm' },
  uptime2024: { name: 'Uptime Institute: Global Data Center Survey 2024 (keskimääräinen räkkiteho alle 8 kW)', type: 'industry', date: '2024-07-26', url: 'https://intelligence.uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2024' },
  sitowiseNoise: { name: 'Sitowise Oy Tampereen kaupungille: Sumeliuksenkadun asemakaavan muutos, meluselvitys (VNp 993/1992:n ohjearvotaulukko ja 5 dB:n korjaus)', type: 'company', date: '2026-01-30', url: 'https://www.tampere.fi/sites/default/files/2026-04/8813_meluselvitys_20260130.pdf' },
};

const fi = (fiText, enText) => ({ fi: fiText, en: enText });

// ---------------------------------------------------------------- coefficients
export const COEF = {
  // ---------- electricity
  utilisation: {
    low: 0.45, typ: 0.7, high: 0.9, unit: fi('osuus (0–1)', 'share (0–1)'),
    title: fi('Käyttöaste', 'Utilisation'),
    explain: fi('Kuinka suuren osan täydestä tehostaan palvelimet keskimäärin käyttävät vuoden aikana.', 'How much of their full power the servers use on average over a year.'),
    confidence: 'medium', sources: [SRC.euEed, SRC.kamk],
    note: fi('KAMK käyttää tyypillisesti 80–85 %, tapauksissa 55–95 %. Uudet salit täyttyvät usein vähitellen, siksi alaraja on matalampi.', 'KAMK uses 80–85% as typical, with cases from 55% to 95%. New halls often fill up gradually, so the low end is lower.'),
  },
  'pue.air': {
    low: 1.1, typ: 1.15, high: 1.3, unit: fi('kerroin', 'ratio'),
    title: fi('Sähkön kokonaiskulutus / palvelinten kulutus (PUE), ulkoilmajäähdytys', 'Total power ÷ server power (PUE), outdoor-air cooling'),
    explain: fi('Kuinka paljon sähköä kuluu jäähdytykseen ja muuhun palvelinten lisäksi. 1,15 tarkoittaa 15 % lisää.', 'How much extra electricity goes to cooling and other needs on top of the servers. 1.15 means 15% extra.'),
    confidence: 'medium', sources: [SRC.nebiusHeat, SRC.msEfficiency, SRC.euEed],
    note: fi('Nebius Mäntsälä 1,13 (yhtiön mukaan); Microsoft EMEA 1,16 (yhtiön mukaan).', 'Nebius Mäntsälä 1.13 (company figure); Microsoft EMEA 1.16 (company figure).'),
  },
  'pue.evaporative': {
    low: 1.1, typ: 1.15, high: 1.3, unit: fi('kerroin', 'ratio'),
    title: fi('PUE, haihdutusjäähdytys', 'PUE, evaporative cooling'),
    explain: fi('Sama kerroin, kun jäähdytyksessä haihdutetaan vettä lämpiminä päivinä.', 'The same ratio when the cooling evaporates water on warm days.'),
    confidence: 'weak', sources: [SRC.nebiusHeat, SRC.msEfficiency, SRC.dcWater],
    note: fi('Suomalaista mittausta ei löytynyt. Oletamme saman kuin ulkoilmajäähdytyksessä: viileässä ilmastossa haihdutusta tarvitaan vain lämpiminä päivinä, joten sähkön säästö on pieni.', 'No Finnish measurement was found. We assume the same as outdoor-air cooling: in a cool climate evaporation is needed only on warm days, so the electricity saving is small.'),
  },
  'pue.liquid': {
    low: 1.03, typ: 1.08, high: 1.15, unit: fi('kerroin', 'ratio'),
    title: fi('PUE, nestejäähdytys', 'PUE, liquid cooling'),
    explain: fi('Sama kerroin, kun palvelimet jäähdytetään suoraan nesteellä. Vain datakeskuksen oma kulutus: lämpöpumppujen sähkö lasketaan erikseen.', 'The same ratio when servers are cooled directly with liquid. The data centre’s own use only: the heat pumps’ electricity is counted separately.'),
    confidence: 'medium', sources: [SRC.csc, SRC.kamk],
    note: fi('CSC:n mukaan LUMIn PUE on 1,04 ilman hukkalämmön hyödyntämistä ja 1,24, kun lämpöpumppujen sähkö lasketaan mukaan. KAMK:n Kajaanin skenaarioissa oletettu 1,20 on lähellä LUMIn lukua lämmön talteenoton kanssa. Tyypillinen arvo ja yläraja ovat oma oletuksemme, koska LUMI on poikkeuksellisen tehokas.', 'According to CSC, LUMI’s PUE is 1.04 without waste-heat use and 1.24 when the heat pumps’ electricity is counted. The 1.20 assumed in KAMK’s Kajaani scenarios is close to LUMI’s figure with heat recovery. The typical and high values are our own assumption, because LUMI is unusually efficient.'),
  },
  gridPeakRatio: {
    low: 1.2, typ: 1.25, high: 1.4, unit: fi('kerroin', 'ratio'),
    title: fi('Sähköliittymän huipputeho / palvelinteho', 'Peak grid connection ÷ server capacity'),
    explain: fi('Sähköverkosta tarvitaan huipulla enemmän tehoa kuin palvelimet yksin käyttävät.', 'At peak, the site needs more power from the grid than the servers alone.'),
    confidence: 'medium', sources: [SRC.jarvenpaa],
    note: fi('Järvenpää: huipputeho noin 125 MW, kun palvelinteho on 100 MW (ja 163 MW, kun 130 MW).', 'Järvenpää: about 125 MW peak for 100 MW of servers (and 163 MW for 130 MW).'),
  },
  'home.electricity': {
    low: 5000, typ: 5000, high: 5000, unit: fi('kWh/v', 'kWh/yr'),
    title: fi('Kodin sähkönkulutus', 'Electricity use of a home'),
    explain: fi('Vertailukoti: esimerkkikotitalous, joka käyttää 5 000 kWh vuodessa (esim. pientalo ilman sähkölämmitystä; kerrostaloasunto käyttää tyypillisesti vähemmän, sähkölämmitteinen omakotitalo noin 18 000 kWh).', 'Comparison home: an example household using 5,000 kWh a year (e.g. a house not heated with electricity; a flat typically uses less, an electrically heated detached house about 18,000 kWh).'),
    confidence: 'medium', sources: [SRC.taloustaito],
  },

  // ---------- water
  'wue.air': {
    low: 0.004, typ: 0.008, high: 0.03, unit: fi('l/kWh', 'L/kWh'),
    title: fi('Vettä palvelinten kilowattituntia kohden, ulkoilmajäähdytys', 'Water per kWh of server energy, outdoor-air cooling'),
    explain: fi('Ilmajäähdytys ei juuri käytä vettä: vettä kuluu lähinnä henkilökunnalle, siivoukseen ja ilmankostutukseen.', 'Air cooling uses almost no water: mainly for staff, cleaning and humidifying the air.'),
    confidence: 'medium', sources: [SRC.jarvenpaa, SRC.msEfficiency, SRC.msWater],
    note: fi('Johdettu Järvenpään YVA-selostuksesta: 4 000–5 000 m³ talous- ja käyttövettä vuodessa, jäähdytysjärjestelmässä ei käytetä vettä. IT-teho on 100–130 MW ja palvelinenergiaa noin 610–880 GWh/v (100 MW × 0,7 × 8 760 h ≈ 610 GWh; YVA:n enimmäisarvio 1 010 GWh sähköä ÷ 1,15 ≈ 880 GWh; oma arvio), joten vettä kuluu noin 0,005–0,008 l/kWh. Yläraja on Microsoftin EMEA-alueen datakeskusten keskiarvo 0,03 l/kWh (FY24–FY25, yhtiön mukaan): ne käyttävät haihdutusapua lämpimimpinä tunteina (yli 29 °C; Dublinissa ja Amsterdamissa alle 5 % ajasta).', 'Derived from the Järvenpää EIA report: 4,000–5,000 m³ of domestic and service water a year; the cooling system uses no water. IT load is 100–130 MW and server energy about 610–880 GWh/yr (100 MW × 0.7 × 8,760 h ≈ 610 GWh; the EIA’s maximum of 1,010 GWh of electricity ÷ 1.15 ≈ 880 GWh; our estimate), so water use is about 0.005–0.008 L/kWh. The upper end is Microsoft’s EMEA data-centre average of 0.03 L/kWh (FY24–FY25, company figure): those sites use evaporative assist in the warmest hours (above 29 °C; in Dublin and Amsterdam less than 5% of the time).'),
  },
  'wue.evaporative': {
    low: 0.02, typ: 0.1, high: 0.8, unit: fi('l/kWh', 'L/kWh'),
    title: fi('Vettä palvelinten kilowattituntia kohden, haihdutusjäähdytys', 'Water per kWh of server energy, evaporative cooling'),
    explain: fi('Haihdutusjäähdytys viilentää haihduttamalla vettä lämpiminä tunteina, joten vettä kuluu selvästi enemmän kuin ilmajäähdytyksessä.', 'Evaporative cooling cools by evaporating water in warm hours, so it uses clearly more water than air cooling.'),
    confidence: 'weak', sources: [SRC.msEfficiency, SRC.msWater, SRC.dcWater],
    note: fi('Suomen ilmastossa vettä tarvitaan vain lämpimimpinä tunteina. Microsoftin EMEA-alueen keskiarvo on 0,03 l/kWh (yhtiön mukaan; vettä vain yli 29 °C:n säällä), hybridijärjestelmät käyttävät 0,2–0,8 l/kWh. Lukemat 1,8–4 l/kWh koskevat jäähdytystorneja tai kuumia ilmastoja, eikä niitä käytetä tässä. Tyypillinen arvo on oma valintamme. Suomalaista mittausta ei löytynyt.', 'In a Finnish climate water is needed only in the warmest hours. Microsoft’s EMEA average is 0.03 L/kWh (company figure; water only above 29 °C), hybrid systems use 0.2–0.8 L/kWh. Figures of 1.8–4 L/kWh apply to cooling towers or hot climates and are not used here. The typical value is our own choice. No Finnish measurement was found.'),
  },
  'wue.liquid': {
    low: 0.004, typ: 0.008, high: 0.03, unit: fi('l/kWh', 'L/kWh'),
    title: fi('Vettä palvelinten kilowattituntia kohden, nestejäähdytys', 'Water per kWh of server energy, liquid cooling'),
    explain: fi('Neste kiertää suljetussa kierrossa, joten vettä kuluu suunnilleen yhtä vähän kuin ilmajäähdytyksessä.', 'The liquid circulates in a closed loop, so water use is about as low as with air cooling.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.msEfficiency, SRC.dcWater, SRC.ramboll],
    note: fi('Oletus: sama kuin ilmajäähdytyksessä. Johdettu Järvenpään YVA-selostuksesta (4 000–5 000 m³ talous- ja käyttövettä vuodessa, jäähdytysjärjestelmässä ei vettä, IT-teho 100–130 MW → noin 0,005–0,008 l/kWh); yläraja on Microsoftin EMEA-keskiarvo 0,03 l/kWh (FY24–FY25, yhtiön mukaan), jossa on mukana haihdutusapua lämpimimpinä tunteina. Suora nestejäähdytys kuivajäähdyttimillä ei kuluta jäähdytysvettä. Mikkelin hanke kertoo käyttävänsä suljettua kiertoa (yhtiön mukaan).', 'Assumption: the same as air cooling. Derived from the Järvenpää EIA report (4,000–5,000 m³ of domestic and service water a year, no water in the cooling system, 100–130 MW of IT load → about 0.005–0.008 L/kWh); the upper end is Microsoft’s EMEA average of 0.03 L/kWh (FY24–FY25, company figure), which includes evaporative assist in the warmest hours. Direct liquid cooling with dry coolers uses no cooling water. The Mikkeli project says it uses a closed loop (company statement).'),
  },
  'water.perPerson': {
    low: 60, typ: 60, high: 60, unit: fi('m³/v', 'm³/yr'),
    title: fi('Asukkaan vedenkulutus', 'Water use per resident'),
    explain: fi('Yksi asukas käyttää vettä noin 160–170 litraa päivässä eli noin 60 m³ vuodessa.', 'One resident uses about 160–170 litres a day, about 60 m³ a year.'),
    confidence: 'strong', sources: [SRC.jarvenpaa],
  },

  // ---------- heat
  'heat.capture': {
    low: 0.9, typ: 0.9, high: 0.97, unit: fi('osuus', 'share'),
    title: fi('Talteen saatava lämpö', 'Heat that can be captured'),
    explain: fi('Lähes kaikki palvelinten sähkö muuttuu lämmöksi. Tästä 90–97 % voidaan ottaa talteen.', 'Almost all the servers’ electricity turns into heat. 90–97% of it can be captured.'),
    confidence: 'medium', sources: [SRC.kamk],
  },
  'heat.cop': {
    low: 3, typ: 3.5, high: 5, unit: fi('lämpökerroin', 'COP'),
    title: fi('Lämpöpumpun lämpökerroin (COP), ilma- ja haihdutusjäähdytys', 'Heat-pump efficiency (COP), air and evaporative cooling'),
    explain: fi('Datakeskuksen lämpö on haaleaa (noin 25–40 °C). Lämpöpumppu nostaa sen kaukolämmön lämpötilaan ja käyttää siihen sähköä. COP 3,5 = yhdellä sähkökilowattitunnilla saadaan 3,5 kWh lämpöä.', 'Data-centre heat is lukewarm (about 25–40 °C). A heat pump raises it to district-heating temperature and uses electricity to do so. COP 3.5 = one kWh of electricity gives 3.5 kWh of heat.'),
    confidence: 'weak', sources: [SRC.nebiusHeat, SRC.kamk, SRC.calefa],
    note: fi('Tyypillinen arvo on oma oletuksemme. Calefan tiedotteen mukaan sen asteittain laajennetun laitoksen lämpökerroin ylittää jopa 5 (yhtiön mukaan).', 'The typical value is our own assumption. According to a Calefa press release, the COP of its gradually expanded plant even exceeds 5 (company statement).'),
  },
  'heat.copLiquid': {
    low: 4, typ: 4.5, high: 6, unit: fi('lämpökerroin', 'COP'),
    title: fi('Lämpöpumpun lämpökerroin (COP), nestejäähdytys', 'Heat-pump efficiency (COP), liquid cooling'),
    explain: fi('Nestejäähdytyksestä saadaan lämpimämpää vettä (noin 45–60 °C) kuin ilmajäähdytyksestä, joten lämpöpumppu tarvitsee vähemmän sähköä nostaakseen sen kaukolämmön lämpötilaan.', 'Liquid cooling gives warmer water (about 45–60 °C) than air cooling, so the heat pump needs less electricity to raise it to district-heating temperature.'),
    confidence: 'weak', sources: [SRC.zangeneh, SRC.calefa, SRC.kamk],
    note: fi('Tyypillinen arvo on oma oletuksemme. Norjalaisen yliopiston laskelmassa 45-asteisesta jäähdytysvedestä saadaan COP 5,5, kun kaukolämpö on 60 °C, ja 3,5, kun se on 80 °C; nestejäähdytyksen lämpö on lähteen mukaan noin 50–60 °C. Calefan tiedotteen mukaan sen asteittain laajennetun laitoksen lämpökerroin ylittää jopa 5 (yhtiön mukaan; jäähdytystapaa ei kerrota). KAMK:n webinaarissa ei ole lukua nestejäähdytyksen lämpökertoimelle.', 'The typical value is our own assumption. In a Norwegian university calculation, 45 °C cooling water gives COP 5.5 when district heat is at 60 °C and 3.5 at 80 °C; the same source puts liquid-cooling heat at about 50–60 °C. According to a Calefa press release, the COP of its gradually expanded plant even exceeds 5 (company statement; the cooling method is not stated). The KAMK webinar gives no COP figure for liquid cooling.'),
  },
  'heat.usableShare': {
    low: 0.5, typ: 0.75, high: 0.85, unit: fi('osuus', 'share'),
    title: fi('Vuoden aikana hyödynnettävä osuus', 'Share usable over a year'),
    explain: fi('Kesällä lämpöä tarvitaan vähän, joten osa hukkalämmöstä menee silloin ilmaan.', 'In summer little heat is needed, so part of the waste heat is released into the air.'),
    confidence: 'medium', sources: [SRC.fortum, SRC.fortumHp],
    note: fi('Fortumin mukaan datakeskusten hukkalämmöstä noin 75 % hyödynnetään vuodessa kaukolämpönä (yhtiön mukaan). Microsoftin Espoon ja Kirkkonummen datakeskusten hukkalämpö hyödynnetään Fortumin omissa lämpöpumppulaitoksissa, jotka käynnistyivät toukokuussa 2026; hukkalämmön talteenotto alkaa niissä vaiheittain vuonna 2027 (Fortum 6.5.2026).', 'According to Fortum, about 75% of the data centres’ waste heat is used as district heat over a year (company statement). The waste heat of Microsoft’s Espoo and Kirkkonummi data centres is used in Fortum’s own heat-pump plants, which started up in May 2026; waste-heat recovery there starts step by step in 2027 (Fortum, 6 May 2026).'),
  },
  'heat.maxCoverage': {
    low: 0.6, typ: 0.72, high: 0.8, unit: fi('osuus kunnan kaukolämmöstä', 'share of the town’s district heat'),
    title: fi('Suurin osuus kunnan kaukolämmöstä', 'Largest share of a town’s district heat'),
    explain: fi('Yksi lämmönlähde ei käytännössä kata koko kunnan kaukolämpöä: talven huiput ja varmuus vaativat muitakin lähteitä.', 'In practice one heat source does not cover all of a town’s district heat: winter peaks and reliability need other sources too.'),
    confidence: 'medium', sources: [SRC.nebiusHeat, SRC.hamina],
    note: fi('Mäntsälä: jopa 72 % (Nebiuksen mukaan). Hamina: noin 80 % (suunnitelma 2024).', 'Mäntsälä: up to 72% (according to Nebius). Hamina: about 80% (2024 plan).'),
  },
  'heat.localNetworkShare': {
    low: 0.1, typ: 0.25, high: 0.5, unit: fi('osuus asukkaista', 'share of residents'),
    title: fi('Paikallisen lämpöverkon piirissä asuvat', 'Residents on a small local heating network'),
    explain: fi('Kun kunnalla ei ole kaukolämpöverkkoa Energiateollisuuden tilastossa, arvioimme pienen paikallisen verkon koon: kuinka suuri osa asukkaista asuu sen piirissä.', 'When a town has no district-heating network in Finnish Energy’s statistics, we estimate the size of a small local network: what share of residents live in buildings connected to it.'),
    confidence: 'weak', sources: [SRC.energiateollisuus],
    note: fi('Oma oletuksemme pienelle paikalliselle verkolle, joka ei ole Energiateollisuuden tilastossa. Tarve lasketaan kuten kuntatiedoissa: asukkaat × 5,9 MWh, ja asuinrakennusten osuus kaukolämmöstä on 54 %.', 'Our own assumption for a small local network that is not in Finnish Energy’s statistics. Demand is calculated as in the town data: residents × 5.9 MWh, with residential buildings using 54% of district heat.'),
  },
  'heat.perHome': {
    low: 6.5, typ: 11, high: 18, unit: fi('MWh/v', 'MWh/yr'),
    title: fi('Kodin lämmitykseen kuluva kaukolämpö', 'District heat used by one home'),
    explain: fi('Kerrostaloasunto tarvitsee noin 6,5–7,5 MWh, keskimääräinen kaukolämmitetty koti noin 11 MWh ja 180 m²:n omakotitalo noin 18 MWh vuodessa.', 'A flat needs about 6.5–7.5 MWh, an average district-heated home about 11 MWh and a 180 m² detached house about 18 MWh a year.'),
    confidence: 'medium', sources: [SRC.energiateollisuus, SRC.statHouseholds, SRC.turkuEnergia, SRC.etPrice, SRC.caverion],
    note: fi('Johdettu: kaukolämpöä toimitettiin 32 700 GWh (2024), siitä 54 % asuinrakennuksiin, ja kaukolämmitetyissä rakennuksissa asui 3,0 miljoonaa ihmistä → noin 5,9 MWh asukasta kohden (sama luku kuin kuntatiedoissa). Kotitaloudessa on keskimäärin 1,96 henkeä (2020; luku pienenee hitaasti) → noin 11,5 MWh kotia kohden; käytämme 11. Energiateollisuuden hintatilaston tyyppitaloissa 180 m²:n omakotitalo käyttää 18 MWh (yläraja) ja 80 asunnon kerrostalo 600 MWh eli 7,5 MWh asuntoa kohden. Alaraja 6,5 MWh (pieni kerrostaloasunto) on oma valintamme. Caverionin vertaus 20 000 MWh ≈ 2 500 kotia (8 MWh) osuu välin alapäähän.', 'Derived: 32,700 GWh of district heat was delivered (2024), 54% of it to residential buildings, and 3.0 million people lived in district-heated buildings → about 5.9 MWh per resident (the same figure as in the town data). A household has 1.96 people on average (2020; slowly falling) → about 11.5 MWh per home; we use 11. In Finnish Energy’s price-statistics type buildings, a 180 m² detached house uses 18 MWh (upper value) and an 80-flat block 600 MWh, or 7.5 MWh per flat. The lower value of 6.5 MWh (a small flat) is our choice. Caverion’s comparison of 20,000 MWh ≈ 2,500 homes (8 MWh) falls in the lower part of the range.'),
  },
  'heat.co2Replaced': {
    low: 0, typ: 73, high: 224, unit: fi('g CO₂/kWh', 'g CO₂/kWh'),
    title: fi('Korvattavan lämmön päästöt', 'Emissions of the heat that is replaced'),
    explain: fi('Riippuu siitä, mitä lämpöä hukkalämpö korvaa: puu lasketaan sopimuksen mukaan nollaksi, Suomen kaukolämmön keskiarvo on 73 g, maakaasu noin 224 g.', 'Depends on what heat the waste heat replaces: wood counts as zero by convention, Finland’s district-heat average is 73 g, natural gas about 224 g.'),
    confidence: 'weak', sources: [SRC.energiateollisuus, SRC.ipcc],
    note: fi('Johdettu yläraja: maakaasu 56,1 t CO₂/TJ (IPCC) ≈ 202 g/kWh polttoainetta, jaettuna kattilan hyötysuhteella noin 0,9 (oma oletus).', 'Derived upper value: natural gas 56.1 t CO₂/TJ (IPCC) ≈ 202 g/kWh of fuel, divided by a boiler efficiency of about 0.9 (our assumption).'),
  },

  // ---------- emissions
  'grid.co2': {
    low: 26, typ: 30, high: 40, unit: fi('g CO₂/kWh', 'g CO₂/kWh'),
    title: fi('Suomessa käytetyn sähkön päästöt', 'Emissions of electricity used in Finland'),
    explain: fi('Suomen sähkö on jo hyvin vähäpäästöistä: 40 g (2023), 32 g (2024), 26 g (2025), 32 g (alkuvuosi 2026).', 'Finnish electricity is already very low-carbon: 40 g (2023), 32 g (2024), 26 g (2025), 32 g (first half of 2026).'),
    confidence: 'strong', sources: [SRC.fingridH1, SRC.fingrid2024],
    note: fi('Monet datakeskukset ostavat sopimuksella päästötöntä sähköä; laskemme silti verkon keskiarvolla.', 'Many data centres buy zero-carbon electricity by contract; we still use the grid average.'),
  },
  'construction.co2PerMW': {
    low: 100, typ: 400, high: 1500, unit: fi('t CO₂/MW', 't CO₂/MW'),
    title: fi('Rakentamisen päästöt', 'Emissions from construction'),
    explain: fi('Betonin, teräksen, kuparin sekä sähkö-, jäähdytys- ja varavoimalaitteiden valmistuksen ja rakentamisen päästöt kertaluonteisesti, megawattia kohden. Arviot vaihtelevat paljon, koska tietoa on vähän.', 'One-off emissions from making the concrete, steel, copper and the power, cooling and backup equipment, and from building, per megawatt. Estimates vary a lot because there is little data.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.seWp99, SRC.icef],
    note: fi('Lähteet rajaavat eri asioita. Järvenpään YVA: 10 760–14 810 t / 100 MW eli noin 110–150 t/MW (130 MW: noin 94–136 t/MW). Luvussa ovat rakennusten materiaalit (A1–A3: 4 050–8 100 t, laskettu yleisellä kertoimella 900–1 300 kg CO₂e/m²), työkoneet (1 040 t), rakentamisen kuljetukset (2 160 t) sekä puuston hiilivaraston ja -nielun menetys (3 510 t). Schneider Electric: 1 MW:n esimerkkidatakeskuksen rakennus sekä sähkö-, jäähdytys- ja muut laitteet noin 1 830 t, josta runko ja vaippa 275 t (pieni kohde, ei palvelimia). ICEF: 200 MW:n esimerkissä pelkkä betoni noin 123 000 t ja teräs 95 000–140 000 t eli noin 1 100–1 300 t/MW (oletuksena paljon betonia). Väli 100–1 500 t/MW kattaa nämä; tyypillinen 400 on oma valintamme. Ei sisällä palvelimia (ICEF: IT-laitteet karkeasti 750–1 500 t/MW).', 'The sources cover different things. Järvenpää EIA: 10,760–14,810 t / 100 MW, about 110–150 t/MW (130 MW: about 94–136 t/MW). It includes the buildings’ materials (A1–A3: 4,050–8,100 t, from a general factor of 900–1,300 kg CO₂e/m²), machinery (1,040 t), construction transport (2,160 t) and the lost carbon store and sink of the trees (3,510 t). Schneider Electric: the building and the power, cooling and other equipment of a 1 MW example data centre about 1,830 t, of which the structure and envelope 275 t (a small site, no servers). ICEF: in a 200 MW example, the concrete alone about 123,000 t and the steel 95,000–140,000 t, about 1,100–1,300 t/MW (assuming a lot of concrete). The range of 100–1,500 t/MW covers these; the typical value of 400 is our choice. Does not include the servers (ICEF: IT equipment roughly 750–1,500 t/MW).'),
  },

  // ---------- land
  'land.perMW': {
    low: 0.07, typ: 0.15, high: 0.33, unit: fi('ha/MW', 'ha/MW'),
    title: fi('Pinta-ala megawattia kohden', 'Land per megawatt'),
    explain: fi('Kuinka paljon maata alue vie. Korkea, tiivis rakennus vie vähemmän kuin matala kampus.', 'How much land the site takes. A tall, compact building takes less than a low campus.'),
    confidence: 'medium', sources: [SRC.jarvenpaa, SRC.dayone, SRC.verne, SRC.nebiusLpr, SRC.sudentulli, SRC.vihti, SRC.kirkkonummi],
    note: fi('Järvenpää 8,8 ha / 100–130 MW (0,07–0,09 ha/MW); DayOne Lahti noin 10 ha / 128 MW (0,08); Verne Mäntsälä noin 10 ha / 70 MW (0,14); Nebius Lappeenranta noin 40 ha / 310 MW (0,13); Sudentulli noin 96 ha / 560 MW (0,17); Vihti noin 60 ha / 265 MW (0,23); Kirkkonummi noin 50 ha (kolme rakennusta, tehoa ei ole varmistettu). Hankkeiden MW-luvut on ilmoitettu eri perusteilla (IT-teho tai koko sähköteho).', 'Järvenpää 8.8 ha / 100–130 MW (0.07–0.09 ha/MW); DayOne Lahti about 10 ha / 128 MW (0.08); Verne Mäntsälä about 10 ha / 70 MW (0.14); Nebius Lappeenranta about 40 ha / 310 MW (0.13); Sudentulli about 96 ha / 560 MW (0.17); Vihti about 60 ha / 265 MW (0.23); Kirkkonummi about 50 ha (three buildings, capacity not verified). The projects state their MW on different bases (IT load or total power).'),
  },
  'land.footballPitch': {
    low: 0.714, typ: 0.714, high: 0.714, unit: fi('ha', 'ha'),
    title: fi('Jalkapallokenttä', 'Football pitch'),
    explain: fi('Täysikokoinen jalkapallokenttä 105 m × 68 m = 0,714 hehtaaria.', 'A full-size football pitch 105 m × 68 m = 0.714 hectares.'),
    confidence: 'strong', sources: [],
  },

  // ---------- jobs and money
  'jobs.constructionPerMW': {
    low: 0.75, typ: 1.5, high: 3.5, unit: fi('henkeä/MW', 'people/MW'),
    title: fi('Rakentajia huippuvaiheessa megawattia kohden', 'Construction workers at peak per megawatt'),
    explain: fi('Kuinka monta ihmistä työmaalla on enimmillään.', 'How many people work on the site at the busiest time.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.nebiusLpr, SRC.dayone],
    note: fi('Johdettu: Järvenpää 75–200 henkeä / 100–130 MW (YVA-arvio); Nebius Lappeenranta jopa 700 / 310 MW (2,3 henkeä/MW, yhtiön ilmoitus). DayOnen ilmoittama 1 000 rakentajaa huippuvaiheessa (128 MW) on otsikkoluku, jota pidämme ylärajana; se jää tämän välin ulkopuolelle.', 'Derived: Järvenpää 75–200 people / 100–130 MW (EIA estimate); Nebius Lappeenranta up to 700 / 310 MW (2.3 people/MW, company announcement). DayOne’s figure of 1,000 workers at the construction peak (128 MW) is a headline number that we treat as an upper bound; it falls outside this range.'),
  },
  'jobs.permanentPerMW': {
    low: 0.25, typ: 0.4, high: 0.8, unit: fi('henkeä/MW', 'people/MW'),
    title: fi('Pysyviä työpaikkoja megawattia kohden', 'Permanent jobs per megawatt'),
    explain: fi('Valmis datakeskus työllistää vähän ihmisiä suhteessa kokoonsa: valvontaa, huoltoa, turvallisuutta.', 'A finished data centre employs few people for its size: monitoring, maintenance, security.'),
    confidence: 'medium', sources: [SRC.jarvenpaa, SRC.nebiusLpr, SRC.dayone, SRC.msNews, SRC.espooBoard, SRC.ramboll, SRC.fortum],
    note: fi('Järvenpää noin 40 / 100–130 MW eli 0,31–0,4 (YVA-arvio); Nebius Lappeenranta noin 100 / 310 MW; DayOne Lahti noin 100 / 128 MW; Microsoft noin 50 henkeä rakennusta kohden (Espoon HEL16:n sähkökapasiteetti noin 60 MW) (yhtiöiden ilmoituksia). Taustaksi: Mikkelin hankeyhtiöiden arvio 80–250 / 165 MW (Rambollin selvityksen pohjalta) ja Fortumin mukaan suuri datakeskus työllistää 100–300.', 'Järvenpää about 40 / 100–130 MW, i.e. 0.31–0.4 (EIA estimate); Nebius Lappeenranta about 100 / 310 MW; DayOne Lahti about 100 / 128 MW; Microsoft about 50 people per building (Espoo HEL16: about 60 MW of electrical capacity) (company announcements). For context: the Mikkeli developers’ estimate of 80–250 / 165 MW (based on a Ramboll study) and Fortum’s statement that a large data centre employs 100–300.'),
  },
  'jobs.indirectMultiplier': {
    low: 0.6, typ: 1.6, high: 4.3, unit: fi('työpaikkaa / pysyvä työpaikka', 'jobs per permanent job'),
    title: fi('Välilliset työpaikat', 'Indirect jobs'),
    explain: fi('Kuinka monta muuta työpaikkaa (alihankinta, palvelut, kauppa) yksi pysyvä työpaikka tuo alueelle.', 'How many other jobs (suppliers, services, shops) one permanent job brings to the area.'),
    confidence: 'weak', sources: [SRC.msImpact, SRC.mikkeli2020],
    note: fi('Mikkelin selvitys 2020: noin 40 välillistä työpaikkaa 70 suoraa kohden (0,6). Microsoftin mukaan 4,3 lisätyöpaikkaa jokaista ylläpitotyöpaikkaa kohden (yhtiön arvio, sisältää kulutuksen kautta syntyvät). Tyypillinen arvo on geometrinen keskikohta (oma valinta).', 'Mikkeli study 2020: about 40 indirect jobs per 70 direct jobs (0.6). Microsoft says 4.3 extra jobs per operations job (company estimate, includes jobs created through spending). The typical value is the geometric middle (our choice).'),
  },
  'tax.propertyPerMW': {
    low: 4800, typ: 10000, high: 15200, unit: fi('€/MW/v', '€/MW/yr'),
    title: fi('Kiinteistövero megawattia kohden', 'Property tax per megawatt'),
    explain: fi('Kiinteistövero lasketaan rakennusten arvosta. Palvelimet eivät ole verotettavaa omaisuutta.', 'Property tax is based on the value of the buildings. The servers are not taxed.'),
    confidence: 'weak', sources: [SRC.ramboll, SRC.veroBase],
    note: fi('Johdettu: hankeyhtiöiden Rambollin selvitykseen perustuva arvio Mikkelille, 0,8–2,5 milj. €/v 165 MW:lle. Laskemme sen kunnan omalla veroprosentilla (ks. viiteprosentti).', 'Derived: the developers’ estimate for Mikkeli based on a Ramboll study, €0.8–2.5 million a year for 165 MW. We scale it with the town’s own tax rate (see reference rate).'),
  },
  'tax.propertyRateRef': {
    low: 1.37, typ: 1.37, high: 1.37, unit: fi('%', '%'),
    title: fi('Viiteveroprosentti', 'Reference tax rate'),
    explain: fi('Mikkelin yleinen kiinteistöveroprosentti 2025. Oletamme, että Rambollin arvio vastaa tätä prosenttia.', 'Mikkeli’s general property tax rate in 2025. We assume Ramboll’s estimate matches this rate.'),
    confidence: 'weak', sources: [SRC.veroRates],
    note: fi('Rambollin käyttämää prosenttia ei ole julkaistu. Koko maan keskiarvo 2026 on 1,18 %.', 'The rate Ramboll used has not been published. The national average for 2026 is 1.18%.'),
  },
  'tax.electricity': {
    low: 0.0224, typ: 0.0224, high: 0.0224, unit: fi('€/kWh', '€/kWh'),
    title: fi('Sähkövero (veroluokka I)', 'Electricity tax (class I)'),
    explain: fi('Datakeskukset maksavat 1.7.2026 alkaen tavallista sähköveroa 2,24 senttiä kilowattitunnilta. Vero menee valtiolle, ei kunnalle.', 'Since 1 July 2026 data centres pay the ordinary electricity tax of 2.24 cents per kWh. It goes to the state, not the town.'),
    confidence: 'strong', sources: [SRC.veroSahko, SRC.vavm, SRC.usSupport, SRC.tsBudget],
    note: fi('Aiemmin 0,05 snt/kWh (veroluokka II). Hallitus luopui suunnitellusta enintään 30 milj. euron tuesta budjettiriihessä 1.9.2026 (Turun Sanomat 1.9.2026, Uusi Suomi 2.9.2026).', 'Previously 0.05 c/kWh (class II). The government dropped the planned support of up to €30 million in its budget session on 1 Sept 2026 (Turun Sanomat, 1 Sept 2026; Uusi Suomi, 2 Sept 2026).'),
  },
  'investment.perMW': {
    low: 6, typ: 9, high: 11, unit: fi('milj. €/MW', '€ million/MW'),
    title: fi('Investointi megawattia kohden', 'Investment per megawatt'),
    explain: fi('Luvut kattavat pääosin rakennukset sekä sähkö- ja jäähdytystekniikan. Vuokralaisten palvelimet eivät yleensä sisälly niihin.', 'The figures mostly cover buildings, power and cooling systems. Tenants’ servers are usually not included.'),
    confidence: 'medium', sources: [SRC.ramboll, SRC.dayone, SRC.turner],
    note: fi('Johdettu: Mikkeli 1,0–1,7 mrd. € / 165 MW (hankeyhtiöiden arvio); DayOne Lahti 1,2 mrd. € / 128 MW (yhtiön mukaan, kolokaatiokeskus); Turner & Townsend: Helsinki noin 12,3 USD/W eli noin 10,6 milj. €/MW (vain rakentaminen ja talotekniikka, ei palvelimia).', 'Derived: Mikkeli €1.0–1.7 billion / 165 MW (developers’ estimate); DayOne Lahti €1.2 billion / 128 MW (company figure, colocation centre); Turner & Townsend: Helsinki about USD 12.3/W, about €10.6 million/MW (construction and building systems only, no servers).'),
  },
  'investment.itShare': {
    low: 0, typ: 0.3, high: 0.75, unit: fi('osuus', 'share'),
    title: fi('Laitteiden osuus investoinnista', 'Equipment share of the investment'),
    explain: fi('Osa investointiluvuista voi sisältää tietotekniikkaa, joka vaihdetaan muutaman vuoden välein eikä ole kiinteistöveron alaista. Useimmat luvut kattavat lähinnä rakentamisen.', 'Some investment figures may include IT equipment, which is replaced every few years and is not subject to property tax. Most figures mainly cover construction.'),
    confidence: 'weak', sources: [SRC.mikkeli2020, SRC.turner],
    note: fi('70–75 %:n laiteosuus tulee yhdestä pienestä, IT-laitteet sisältäneestä hankkeesta (Mikkeli 2020). Rakentamisen kustannusindeksi (Turner & Townsend) ei sisällä palvelimia, joten alaraja on 0 (oma valinta).', 'The 70–75% equipment share comes from one small 2020 project that included IT (Mikkeli 2020). The construction cost index (Turner & Townsend) excludes servers, so the low end is 0 (our choice).'),
  },

  // ---------- traffic
  'traffic.constructionTrucksPer100MW': {
    low: 40, typ: 60, high: 100, unit: fi('raskasta ajoneuvoa/pv (100 MW)', 'heavy vehicles/day (100 MW)'),
    title: fi('Raskas liikenne rakentamisen huipussa', 'Heavy traffic at the construction peak'),
    explain: fi('Kuorma-autoja ja muita raskaita ajoneuvoja päivässä, kun maanrakennus on käynnissä.', 'Trucks and other heavy vehicles per day while the earthworks are under way.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.espooEia],
    note: fi('Järvenpää noin 40/pv (100 MW), Espoo enintään noin 100/pv (Espoo: koko kampus, useita rakennuksia, ei skaalattu 100 MW:iin). Lisäksi 240–500 henkilöautoa päivässä.', 'Järvenpää about 40/day (100 MW), Espoo up to about 100/day (Espoo: whole multi-building campus, not scaled to 100 MW). Plus 240–500 cars a day.'),
  },
  'traffic.operationTrucksPer100MW': {
    low: 1, typ: 2, high: 6, unit: fi('raskasta ajoneuvoa/pv (100 MW)', 'heavy vehicles/day (100 MW)'),
    title: fi('Raskas liikenne käytön aikana', 'Heavy traffic during operation'),
    explain: fi('Valmiiseen datakeskukseen ajaa vain muutama raskas ajoneuvo päivässä (huolto, polttoaine, laitteet, jätteet).', 'Only a few heavy vehicles a day drive to a finished data centre (maintenance, fuel, equipment, waste).'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.espooEia],
    note: fi('Järvenpää 1–2/pv ja noin 15 henkilöautoa (YVA-arvio, 100–130 MW). Yläraja 6/pv on oma varovainen oletuksemme. Espoon arvio enintään 16/pv ja 300 henkilöautoa koskee koko monen rakennuksen kampusta, joten emme käytä sitä tässä.', 'Järvenpää 1–2/day and about 15 cars (EIA estimate, 100–130 MW). The upper value of 6/day is our own cautious assumption. Espoo’s estimate of up to 16/day and 300 cars covers a whole multi-building campus, so we do not use it here.'),
  },

  // ---------- safety / backup power
  'backup.fuelPerMW': {
    low: 2.7, typ: 3.1, high: 3.6, unit: fi('MW polttoainetehoa / IT-MW', 'MW of fuel power per IT MW'),
    title: fi('Varavoimakoneiden polttoaineteho', 'Backup generators’ fuel power'),
    explain: fi('Dieselgeneraattorit pitävät palvelimet käynnissä sähkökatkossa. Polttoaineteho kertoo koneiden koon.', 'Diesel generators keep the servers running in a blackout. Fuel power describes how big they are.'),
    confidence: 'medium', sources: [SRC.jarvenpaa, SRC.vihti, SRC.espooBoard, SRC.sudentulli],
    note: fi('Järvenpää 350 MW / 100 MW ja 455 MW / 130 MW eli 3,5 IT-megawattia kohden (YVA). Vihti 660 MW / 265 MW, Sudentulli 1 360 MW / 560 MW ja Espoo HEL16 noin 160 MW / 60 MW on ilmoitettu hankkeen sähkötehoa kohden (2,4–2,7): jos se sisältää jäähdytyksen (÷ 1,25), IT-megawattia kohden noin 3,0–3,3.', 'Järvenpää 350 MW / 100 MW and 455 MW / 130 MW, i.e. 3.5 per IT MW (EIA). Vihti 660 MW / 265 MW, Sudentulli 1,360 MW / 560 MW and Espoo HEL16 about 160 MW / 60 MW are stated per MW of the site’s electrical capacity (2.4–2.7): if that includes cooling (÷ 1.25), it is about 3.0–3.3 per IT MW.'),
  },
  'backup.eiaFuelMW': {
    low: 300, typ: 300, high: 300, unit: fi('MW polttoainetehoa', 'MW of fuel power'),
    title: fi('YVA-raja: polttoaineteho', 'EIA threshold: fuel power'),
    explain: fi('Ympäristövaikutusten arviointi (YVA) tehdään aina, kun kattila- tai voimalaitoksen suurin polttoaineteho on vähintään 300 MW. Viranomainen voi vaatia YVA:n myös tapauskohtaisesti, jos vaikutukset ovat todennäköisesti merkittäviä.', 'An environmental impact assessment (EIA) is always required when the maximum fuel power of boiler or power plants is at least 300 MW. The authority can also require an EIA case by case if significant impacts are likely.'),
    confidence: 'strong', sources: [SRC.yvaLaki, SRC.jarvenpaa, SRC.lvvHalt],
    note: fi('YVA-laki 252/2017, liite 1, kohta 7a, ja 3 §. Jos hanketta aletaan toteuttaa ennen arviointia, viranomainen voi vaatia keskeyttämään työt: esimerkiksi Muhoksella ja Kajaanissa Lupa- ja valvontavirasto kehotti 6.10.2026 YVA-lain 32 §:n 2 momentin nojalla keskeyttämään valmistelutyöt, kunnes YVA on tehty.', 'EIA Act 252/2017, annex 1, item 7a, and section 3. If a project starts before the assessment, the authority can require the work to stop: for example, in Muhos and Kajaani the Finnish Supervisory Agency asked on 6 Oct 2026, under section 32(2) of the EIA Act, for preparatory work to stop until the EIA is done.'),
  },
  'backup.permitFuelMW': {
    low: 50, typ: 50, high: 50, unit: fi('MW polttoainetehoa', 'MW of fuel power'),
    title: fi('Ympäristölupa vai rekisteröinti', 'Environmental permit or registration'),
    explain: fi('1–50 MW:n polttolaitokset rekisteröidään ympäristönsuojelulain mukaan. Vähintään 50 MW:n laitokset tarvitsevat ympäristöluvan.', 'Combustion plants of 1–50 MW are registered under the Environmental Protection Act. Plants of 50 MW or more need an environmental permit.'),
    confidence: 'strong', sources: [SRC.vna1065, SRC.ysl, SRC.jarvenpaa],
    note: fi('VNA 1065/2017 koskee energiantuotantoyksiköitä, joiden polttoaineteho on vähintään 1 MW mutta alle 50 MW ja jotka rekisteröidään ympäristönsuojelulain (527/2014) mukaan. Saman lain liitteen 1 mukaan lupa tarvitaan, kun laitoksen polttoaineteho on 50 MW tai enemmän; kaikki samalla alueella olevat koneet lasketaan yhteen.', 'Decree 1065/2017 covers energy production units of at least 1 MW but under 50 MW of fuel power, which are registered under the Environmental Protection Act (527/2014). Under annex 1 of that Act, a permit is needed when a plant’s fuel power is 50 MW or more; all units on the same site are added together.'),
  },
  'backup.generatorSize': {
    low: 7.1, typ: 7.1, high: 7.1, unit: fi('MW polttoainetehoa', 'MW of fuel power'),
    title: fi('Yhden generaattorin koko', 'Size of one generator'),
    explain: fi('Yksi varavoimakone on polttoaineteholtaan noin 7,1 MW.', 'One backup generator has about 7.1 MW of fuel power.'),
    confidence: 'medium', sources: [SRC.jarvenpaa],
  },
  'backup.dieselPerMW': {
    low: 9.1, typ: 9.1, high: 9.1, unit: fi('t/MW', 't/MW'),
    title: fi('Varastoitu diesel', 'Diesel stored on site'),
    explain: fi('Polttoainetta varastoidaan noin vuorokauden käyttöä varten.', 'Fuel is stored for about one day of running.'),
    confidence: 'medium', sources: [SRC.jarvenpaa],
    note: fi('Järvenpää: noin 910 t 24 tunniksi 100 MW:n datakeskukselle.', 'Järvenpää: about 910 t for 24 hours for a 100 MW data centre.'),
  },
  'backup.testCo2PerMW': {
    low: 1.04, typ: 1.04, high: 1.04, unit: fi('t CO₂/MW/v', 't CO₂/MW/yr'),
    title: fi('Koekäyttöjen päästöt', 'Emissions from generator tests'),
    explain: fi('Varavoimakoneita koekäytetään säännöllisesti (esim. 20 min kuukausittain, tunti vuosittain).', 'Backup generators are test-run regularly (e.g. 20 minutes a month, one hour a year).'),
    confidence: 'medium', sources: [SRC.jarvenpaa],
    note: fi('Järvenpää: noin 104 t CO₂e vuodessa 100 MW:lle.', 'Järvenpää: about 104 t CO₂e a year for 100 MW.'),
  },

  // ---------- future / electronics
  'ewaste.perMW': {
    low: 3, typ: 15, high: 50, unit: fi('t/MW/vaihtokierros', 't/MW per refresh'),
    title: fi('Vaihdettava elektroniikka', 'Electronics replaced'),
    explain: fi('Palvelimet ja muut laitteet vaihdetaan uusiin muutaman vuoden välein. Ne kierrätetään tai käytetään uudelleen. Tiheät tekoälyräkit painavat megawattia kohden vähemmän kuin tavalliset palvelimet.', 'Servers and other equipment are replaced every few years. They are recycled or reused. Dense AI racks weigh less per megawatt than ordinary servers.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.registerGb200, SRC.nvidiaH100, SRC.uptime2024, SRC.ibmRack],
    note: fi('Järvenpään YVA: kaikki elektroniikka, noin 400 t kerralla 100–130 MW:n keskuksessa noin 3 vuoden välein (YVA:n mukaan todellinen väli on yleensä pidempi) → 3–4 t/MW. Laitteiden paino antaa suuremman luvun: tekoälyräkki NVIDIA GB200 NVL72 painaa noin 1,36 t ja ottaa 120 kW → noin 11 t/MW; DGX H100 -palvelin enintään 130 kg ja 10,2 kW → noin 13 t/MW. Tavallisissa saleissa räkin teho on keskimäärin alle 8 kW (Uptime 2024), ja täysi räkki voi painaa jopa 930 kg (IBM); täysi 930 kg:n räkki 8 kW:lla olisi noin 116 t/MW, mutta kaikki räkit eivät ole täysiä. Väli 3–50 t/MW ja tyypillinen 15 ovat oma valintamme näiden pohjalta.', 'Järvenpää EIA: all electronics, about 400 t at a time in a 100–130 MW centre about every 3 years (the EIA says the real interval is usually longer) → 3–4 t/MW. Hardware mass gives a higher figure: an NVIDIA GB200 NVL72 AI rack weighs about 1.36 t and draws 120 kW → about 11 t/MW; a DGX H100 server up to 130 kg and 10.2 kW → about 13 t/MW. In ordinary halls the average rack draws under 8 kW (Uptime 2024), and a full rack can weigh up to 930 kg (IBM); a full 930 kg rack at 8 kW would be about 116 t/MW, but not every rack is full. The range of 3–50 t/MW and the typical value of 15 are our choice based on these.'),
  },
  'ewaste.refreshYears': {
    low: 3, typ: 5, high: 6, unit: fi('vuotta', 'years'),
    title: fi('Laitteiden vaihtoväli', 'Equipment refresh interval'),
    explain: fi('Kuinka usein palvelimet vaihdetaan uusiin.', 'How often the servers are replaced.'),
    confidence: 'medium', sources: [SRC.jarvenpaa, SRC.siliconangle],
    note: fi('Järvenpään YVA olettaa varovaisesti 3 vuotta; suuret yhtiöt kirjaavat laitteet 5–6 vuodessa.', 'The Järvenpää EIA cautiously assumes 3 years; large companies depreciate equipment over 5–6 years.'),
  },

  // ---------- noise
  'noise.opRef': {
    low: 39, typ: 43, high: 46, unit: fi('dB (100 MW, 350 m)', 'dB (100 MW, 350 m)'),
    title: fi('Käytön aikainen melu vertailutilanteessa', 'Operating noise in the reference case'),
    explain: fi('Jäähdytyslaitteiden tasainen humina lähimmissä kodeissa, kun datakeskus on 100 MW ja kodit noin 350 m päässä.', 'The steady hum of the coolers at the nearest homes when the data centre is 100 MW and homes are about 350 m away.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.espooEia],
    note: fi('Järvenpään mallinnus: 39–44 dB (100 MW) ja 41–46 dB (130 MW) lähimmissä tarkastelupisteissä, katolla meluesteet. Espoo: alle 50 dB lähimmissä kohteissa.', 'Järvenpää modelling: 39–44 dB (100 MW) and 41–46 dB (130 MW) at the nearest assessment points, with noise barriers on the roof. Espoo: below 50 dB at the nearest sites.'),
  },
  'noise.constructionLwa': {
    low: 110, typ: 116, high: 123, unit: fi('dB (äänitehotaso)', 'dB (sound power level)'),
    title: fi('Työmaan äänitehotaso', 'Construction site sound power'),
    explain: fi('Kuinka paljon ääntä työkoneet, kallion poraus ja paalutus tuottavat lähteellä.', 'How much sound the machines, rock drilling and piling make at the source.'),
    confidence: 'weak', sources: [SRC.jarvenpaa, SRC.espooEia],
    note: fi('Järvenpää: kuorma-auto 110 dB, kaivinkone 105 dB (12 kpl ≈ 116 dB), poravaunu 121 dB, paalutus 123 dB. Espoo: kokonaismelu rakentamisen aikana 41–70 dB lähimmissä kohteissa, mukaan lukien nykyinen tieliikenne (hiljaisissa kohteissa nousu noin 5–10 dB).', 'Järvenpää: truck 110 dB, excavator 105 dB (12 machines ≈ 116 dB), rock drill 121 dB, piling 123 dB. Espoo: total noise during construction 41–70 dB at the nearest sites, including existing road traffic (quiet sites rise by about 5–10 dB).'),
  },
  'noise.guideDay': {
    low: 55, typ: 55, high: 55, unit: fi('dB', 'dB'),
    title: fi('Melun ohjearvo asuinalueella päivällä', 'Noise guideline, residential area, daytime'),
    explain: fi('Valtioneuvoston ohjearvo asuinalueille klo 7–22 (keskiäänitaso).', 'Government guideline for residential areas 7 am–10 pm (average level).'),
    confidence: 'strong', sources: [SRC.vnp993, SRC.jarvenpaa],
  },
  'noise.guideNight': {
    low: 50, typ: 50, high: 50, unit: fi('dB', 'dB'),
    title: fi('Melun ohjearvo asuinalueella yöllä', 'Noise guideline, residential area, night'),
    explain: fi('Ohjearvo klo 22–7. Uusilla asuinalueilla 45 dB.', 'Guideline 10 pm–7 am. 45 dB for new residential areas.'),
    confidence: 'strong', sources: [SRC.vnp993, SRC.jarvenpaa],
  },
  'noise.guideNatureNight': {
    low: 40, typ: 40, high: 40, unit: fi('dB', 'dB'),
    title: fi('Melun ohjearvo loma-asunnoilla ja luonnonsuojelualueilla yöllä', 'Noise guideline, holiday homes and nature reserves, night'),
    explain: fi('Taajamien ulkopuolisilla loma-asunto- ja luonnonsuojelualueilla 45 dB päivällä ja 40 dB yöllä.', 'Holiday-home and nature-reserve areas outside towns: 45 dB by day and 40 dB at night.'),
    confidence: 'strong', sources: [SRC.vnp993],
  },
  'noise.guideNatureDay': {
    low: 45, typ: 45, high: 45, unit: fi('dB', 'dB'),
    title: fi('Melun ohjearvo loma-asunnoilla ja luonnonsuojelualueilla päivällä', 'Noise guideline, holiday homes and nature reserves, daytime'),
    explain: fi('Taajamien ulkopuolisilla loma-asunto- ja luonnonsuojelualueilla ohjearvo klo 7–22 on 45 dB.', 'Holiday-home and nature-reserve areas outside towns: 45 dB from 7 am to 10 pm.'),
    confidence: 'strong', sources: [SRC.vnp993, SRC.sitowiseNoise],
  },
  'noise.guideNightNew': {
    low: 45, typ: 45, high: 45, unit: fi('dB', 'dB'),
    title: fi('Melun yöohjearvo uusilla asuinalueilla', 'Night noise guideline for new residential areas'),
    explain: fi('Uusilla asuinalueilla yöajan (klo 22–7) ohjearvo on 45 dB, eli 5 dB tiukempi kuin vanhoilla alueilla.', 'In new residential areas the night guideline (10 pm–7 am) is 45 dB, 5 dB stricter than in existing areas.'),
    confidence: 'strong', sources: [SRC.vnp993, SRC.sitowiseNoise],
  },
  'noise.tonalPenalty': {
    low: 5, typ: 5, high: 5, unit: fi('dB', 'dB'),
    title: fi('Korjaus kapeakaistaiselle tai iskumaiselle melulle', 'Correction for tonal or impulsive noise'),
    explain: fi('Jos melu on kapeakaistaista (esimerkiksi tasainen vinkuna) tai iskumaista, mitattuun tai laskettuun tasoon lisätään 5 dB ennen vertaamista ohjearvoon.', 'If the noise is tonal (for example a steady whine) or impulsive, 5 dB is added to the measured or calculated level before it is compared with the guideline.'),
    confidence: 'strong', sources: [SRC.vnp993, SRC.sitowiseNoise],
  },

  // ---------- national reference values
  'finland.consumption2025': {
    low: 84.5, typ: 84.5, high: 84.5, unit: fi('TWh', 'TWh'),
    title: fi('Suomen sähkönkulutus 2025', 'Finland’s electricity use in 2025'),
    explain: fi('Koko Suomessa käytetty sähkö vuonna 2025.', 'All electricity used in Finland in 2025.'),
    confidence: 'strong', sources: [SRC.fingridH1],
  },
  'finland.forecast2030': {
    low: 106, typ: 114.5, high: 123, unit: fi('TWh', 'TWh'),
    title: fi('Fingridin ennuste vuodelle 2030', 'Fingrid’s forecast for 2030'),
    explain: fi('Fingridin arvio Suomen sähkönkulutuksesta vuonna 2030 (kaksi skenaariota).', 'Fingrid’s estimate of Finland’s electricity use in 2030 (two scenarios).'),
    confidence: 'medium', sources: [SRC.fingridForecast],
    note: fi('Tyypillinen arvo on skenaarioiden keskikohta (oma valinta).', 'The typical value is the midpoint of the scenarios (our choice).'),
  },
  'finland.ol3': {
    low: 10.38, typ: 10.38, high: 10.38, unit: fi('TWh/v', 'TWh/yr'),
    title: fi('Olkiluoto 3:n tuotanto 2025', 'Olkiluoto 3 output in 2025'),
    explain: fi('Suomen suurin voimalaitosyksikkö tuotti vuonna 2025 noin 10,4 TWh sähköä.', 'Finland’s largest power unit produced about 10.4 TWh of electricity in 2025.'),
    confidence: 'strong', sources: [SRC.tvo],
  },
  'finland.ol3Capacity': {
    low: 1600, typ: 1600, high: 1600, unit: fi('MW', 'MW'),
    title: fi('Olkiluoto 3:n teho', 'Olkiluoto 3 capacity'),
    explain: fi('Suomen suurimman voimalaitosyksikön sähköteho on noin 1 600 MW.', 'Finland’s largest power unit has an electrical capacity of about 1,600 MW.'),
    confidence: 'strong', sources: [SRC.wnnOl3],
  },
  'finland.districtHeat': {
    low: 32.7, typ: 32.7, high: 32.7, unit: fi('TWh', 'TWh'),
    title: fi('Suomen kaukolämmön kulutus 2024', 'District heat used in Finland in 2024'),
    explain: fi('Asiakkaille toimitettu kaukolämpö koko Suomessa.', 'District heat delivered to customers in all of Finland.'),
    confidence: 'strong', sources: [SRC.energiateollisuus],
  },
};

/** Keys whose value is uncertain (low < high) — these are sampled in the uncertainty runs. Fixed order = reproducible. */
export const UNCERTAIN_KEYS = Object.keys(COEF).filter((k) => COEF[k].low < COEF[k].high);
