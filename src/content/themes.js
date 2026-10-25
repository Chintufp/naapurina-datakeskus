// Topic explainers — owned by the topics agent (SPEC §6).
// THEMES: exactly the 7 THEME_KEYS, in order. Every benefit / drawback / uncertain item carries a real Source
// (checked 24.10.2026) or `source: null` when it is general knowledge or a known gap. Company statements say
// "yhtiön mukaan" / "according to the company". Never add a number here that is not in the cited source.

// ---------------------------------------------------------------------------------------------
// Shared sources (also used by personas.js). Source = { name, type, date, url, note? }
// ---------------------------------------------------------------------------------------------
const UNDATED = { fi: 'Sivulla ei ole julkaisupäivää; tarkistettu 24.10.2026.', en: 'The page has no publication date; checked 24 Oct 2026.' };

export const TOPIC_SOURCES = {
  yleAfry: { name: 'Yle: AFRYn selvitys valtioneuvostolle', type: 'news', date: '2025-11-05', url: 'https://yle.fi/a/74-20192344' },
  yleEnergiateollisuus: { name: 'Yle: Energiateollisuus ry', type: 'news', date: '2026-02-11', url: 'https://yle.fi/a/74-20208368' },
  fingridForecast: { name: 'Fingrid: sähkönkulutuksen ennuste (STT)', type: 'authority', date: '2026-09-30', url: 'https://www.sttinfo.fi/tiedote/72373063/' },
  nebiusHeat: { name: 'Nebius: hukkalämpö Mäntsälässä', type: 'company', date: '2026-10', url: 'https://nebius.com/sustainability/turning-heat-into-a-resource', note: UNDATED },
  nebius2024: { name: 'Nebius: tiedote Mäntsälän laajennuksesta', type: 'company', date: '2024-10-08', url: 'https://nebius.com/newsroom/nebius-to-triple-capacity-at-finland-data-center-to-75-mw' },
  fortum: { name: 'Fortum: datakeskukset pääkaupunkiseudulla', type: 'company', date: '2026-10', url: 'https://www.fortum.com/data-centres-helsinki-region', note: UNDATED },
  microsoft: { name: 'Microsoft: datakeskusalueen toinen vaihe', type: 'company', date: '2026-04-28', url: 'https://news.microsoft.com/source/emea/2026/04/microsoft-kaynnistaa-paakaupunkiseudun-datakeskusalueen-toisen-vaiheen-rakentamisen/?lang=fi' },
  cscLumi: { name: 'CSC: LUMI-supertietokoneen hukkalämpö Kajaanissa', type: 'research', date: '2023-04-25', url: 'https://csc.fi/en/news/kajaani-data-center-improving-eco-efficiency/' },
  espoo2026: { name: 'Espoon kaupunki: datakeskushankkeiden arviointiperiaatteet (valmisteluaineisto 4.5.2026, hyväksytty 1.6.2026)', type: 'authority', date: '2026-05-04', url: 'https://espoo.oncloudos.com/kokous/20261660-10.PDF' },
  espoo2026Decision: { name: 'Espoon elinkeino- ja kilpailukykyjaosto: päätökset 1.6.2026 (STT)', type: 'authority', date: '2026-06-01', url: 'https://www.sttinfo.fi/tiedote/72092570/elinkeino-ja-kilpailukykyjaoston-paatoksia-162026' },
  espoo2025: { name: 'Espoon ympäristö- ja rakennuslautakunta: lausunto Hepokorven datakeskuksen ympäristöluvasta', type: 'authority', date: '2025-03-20', url: 'https://espoo-sv.oncloudos.com/kokous/20251396-16.PDF' },
  jarvenpaa: { name: 'Järvenpään datakeskuksen YVA-selostus (Ramboll hankkeesta vastaavan Data Prop Link Oy:n puolesta)', type: 'company', date: '2026-05-20', url: 'https://www.ymparisto.fi/sites/default/files/documents/J%C3%A4rvenp%C3%A4%C3%A4n%20datakeskus%20YVA-selostus_saavutettava_FINAL_0.pdf' },
  sudentulli: { name: 'LVV: Sudentullin datakeskuksen YVA-ohjelma (STT)', type: 'authority', date: '2026-09-16', url: 'https://www.sttinfo.fi/tiedote/72306550' },
  vnTax: { name: 'Valtioneuvosto: datakeskusten sähkövero', type: 'authority', date: '2025-10-23', url: 'https://valtioneuvosto.fi/-/hallitus-varmistaa-suomen-kilpailukyvyn-datakeskusinvestointien-houkuttelemiseksi' },
  rambollMikkeli: { name: 'Cerebras ja Compute Nordic: tiedote Mikkelin hankkeesta (StorageNewsletter)', type: 'company', date: '2026-09-02', url: 'https://www.storagenewsletter.com/2026/09/02/cerebras-and-compute-nordic-finland-announce-new-165mw-ai-data-centre-in-mikkeli-finland/' },
  hamina: { name: 'Haminan kaupunki', type: 'authority', date: '2026-06-22', url: 'https://www.hamina.fi/en/haminan-datakeskuksen-vaikutukset-tutkimuskohteena-osallistu-sinakin/' },
  yleHamina: { name: 'Yle: Googlen Haminan laajennus', type: 'news', date: '2024-05', url: 'https://yle.fi/a/74-20089577' },
  yleMuhos: { name: 'Yle: Muhoksen maankäyttösopimus', type: 'news', date: '2025-08-05', url: 'https://yle.fi/a/74-20175928' },
  yleGoogle: { name: 'Yle: Googlen investointi', type: 'news', date: '2026-09-09', url: 'https://yle.fi/a/74-20245301' },
  yleLvvHalt: { name: 'Yle: Google keskeyttää datakeskustyömaat', type: 'news', date: '2026-10-08', url: 'https://yle.fi/a/74-20250446' },
  lvvKehotus: { name: 'LVV: kehotus keskeyttää valmistelutoimet (STT)', type: 'authority', date: '2026-10-06', url: 'https://www.sttinfo.fi/tiedote/72390663' },
  yleSupo: { name: 'Yle: Supo datakeskuksista', type: 'news', date: '2026-06-18', url: 'https://yle.fi/a/74-20232314' },
  kalevaIi: { name: 'Kaleva: Iin datakeskushanke', type: 'news', date: '2026-07-17', url: 'https://www.kaleva.fi/iin-datakeskushanke-herattaa-pelkoa-hankealueella/13582975' },
  inderes: { name: 'Inderes (analyysiyhtiö)', type: 'company', date: '2026-09-02', url: 'https://www.inderes.fi/analyst-comments/case-datakeskukset-rakentamisen-kylmakaynnistajana' },
  // Added 24.10.2026 (policy status and Muhos; each checked today).
  fingridH1: { name: 'Fingrid: puolivuosikatsaus 1.1.–30.6.2026', type: 'authority', date: '2026-07-23', url: 'https://www.fingrid.fi/en/news/news/2026/fingrid-groups-half-year-report-1.1.30.6.2026/' },
  usSupportDropped: { name: 'Uusi Suomi: 30 miljoonan verotuki kaatui', type: 'news', date: '2026-09-02', url: 'https://www.uusisuomi.fi/uutiset/a/8804afef-6cd2-45f8-bbf5-658b90cc104d' },
  vnRegistry: { name: 'Valtioneuvosto: luonnos datakeskusrekisterilaista lausuntokierrokselle', type: 'authority', date: '2026-09-04', url: 'https://valtioneuvosto.fi/-/1410877/luonnos-datakeskusrekisterilaista-lausuntokierrokselle' },
  essScreening: { name: 'Uutissuomalainen (ESS): hallituksen esitys ulkomaisten sijoitusten ennakkoluvasta', type: 'news', date: '2026-10-22', url: 'https://www.ess.fi/uutissuomalainen/9893232' },
  // Added 25.10.2026 (e-waste by hardware mass; checked by the model package today).
  registerGb200: { name: 'The Register: Taking a closer look at Nvidia’s DGX GB200 NVL72 (räkki 1,36 t, 120 kW)', type: 'news', date: '2024-03-21', url: 'https://www.theregister.com/on-prem/2024/03/21/a-closer-look-at-nvidias-120kw-dgx-gb200-nvl72-rack-system/912087' },
  yleLvvPolice: { name: 'Yle: LVV:n tutkintapyyntö Muhoksen datakeskushankkeesta', type: 'news', date: '2026-10-22', url: 'https://yle.fi/a/74-20252848' },
};
const S = TOPIC_SOURCES;
const item = (fi, en, source = null) => ({ text: { fi, en }, source });

// ---------------------------------------------------------------------------------------------
export const THEMES = [
  // ---------------------------------------------------------------- 1. ENERGY
  {
    key: 'energy', icon: 'bolt',
    title: { fi: 'Sähkö ja lämpö', en: 'Electricity and heat' },
    lead: {
      fi: 'Datakeskus käyttää sähköä tasaisesti yötä päivää, ja lähes kaikki siitä muuttuu lopulta lämmöksi.',
      en: 'A data centre uses electricity steadily day and night, and almost all of it ends up as heat.',
    },
    body: [
      {
        fi: 'Datakeskuksen koko kerrotaan yleensä megawatteina (MW). Tässä sovelluksessa MW tarkoittaa palvelinten ja muiden IT-laitteiden enimmäistehoa (IT-teho). Huipussaan sähköliittymä tarvitsee noin 20–40 % enemmän, koska myös jäähdytys ja muut järjestelmät käyttävät sähköä. Suomen datakeskukset käyttivät vuonna 2025 keskimäärin yhteensä noin 300 MW. Alan oma yhdistys arvioi skenaariossaan, että luku voisi olla 2 500 MW jo vuonna 2030.',
        en: 'The size of a data centre is usually given in megawatts (MW). In this app, MW means the maximum power of the servers and other IT equipment (the IT load). At peak, the grid connection needs about 20–40% more, because cooling and other systems use electricity too. In 2025 Finland\'s data centres drew about 300 MW in total on average. The industry\'s own association estimates in a scenario that this could reach 2,500 MW as early as 2030.',
      },
      {
        fi: 'Suomessa käytettiin sähköä 84,5 terawattituntia (TWh) vuonna 2025. Fingrid arvioi kulutuksen kasvavan 106–123 terawattituntiin vuoteen 2030 mennessä. Datakeskukset ovat yksi tärkeimmistä syistä.',
        en: 'Finland used 84.5 terawatt hours (TWh) of electricity in 2025. Fingrid expects use to grow to 106–123 terawatt hours by 2030. Data centres are one of the main reasons.',
      },
      {
        fi: 'Palvelimet lämpenevät, ja niitä pitää jäähdyttää. Talteen otettu lämpö on yleensä haaleaa, joten lämpöpumppu nostaa sen lämpötilaa ennen kuin se kelpaa kaukolämpöverkkoon. Näin tehdään jo esimerkiksi Haminassa, Mäntsälässä ja Kajaanissa. Kesällä lämpöä tarvitaan vähän, joten kaikkea ei saada käyttöön.',
        en: 'Servers get warm and must be cooled. The recovered heat is usually lukewarm, so a heat pump raises its temperature before it can go into the district-heating network. This already happens in Hamina, Mäntsälä and Kajaani, for example. In summer little heat is needed, so not all of it can be used.',
      },
      {
        fi: 'Siitä, nostavatko datakeskukset sähkön hintaa, lähteet ovat eri mieltä. Vastaus riippuu siitä, kuinka paljon uutta sähköntuotantoa rakennetaan samaan aikaan ja joustavatko datakeskukset kulutuksessaan.',
        en: 'Sources disagree on whether data centres will raise electricity prices. The answer depends on how much new power generation is built at the same time and whether data centres can adjust their use.',
      },
    ],
    questions: [
      { fi: 'Nouseeko minun sähkölaskuni?', en: 'Will my electricity bill go up?' },
      { fi: 'Riittääkö sähköverkko, ja tarvitaanko uusia voimalinjoja?', en: 'Is the grid big enough, and will new power lines be needed?' },
      { fi: 'Lämmitetäänkö meidän kotejamme datakeskuksen lämmöllä?', en: 'Will our homes be heated with the data centre\'s heat?' },
      { fi: 'Mitä ylimääräiselle lämmölle tapahtuu kesällä?', en: 'What happens to the extra heat in summer?' },
    ],
    benefits: [
      item('Mäntsälässä datakeskuksen hukkalämpö on yhtiön mukaan kattanut viime vuosina enimmillään 72 % kunnan vuotuisesta lämmöntarpeesta.',
        'In Mäntsälä, according to the company, the data centre\'s waste heat has covered up to 72% of the town\'s annual heating demand in recent years.', S.nebiusHeat),
      item('CSC:n mukaan LUMI-supertietokoneen hukkalämpö voi kattaa noin viidesosan Kajaanin vuotuisesta kaukolämmöstä.',
        'According to CSC, waste heat from the LUMI supercomputer can cover about a fifth of Kajaani\'s annual district heat.', S.cscLumi),
      item('Microsoftin arvion mukaan sen datakeskusten hukkalämpö voisi koko alueen valmistuttua kattaa noin 40 % Espoon, Kauniaisten ja Kirkkonummen kaukolämpöverkon lämmöntarpeesta.',
        'Microsoft estimates that, once the whole area is finished, its data centres\' waste heat could cover about 40% of the heat demand of the Espoo, Kauniainen and Kirkkonummi district-heating network.', S.microsoft),
      item('Selvityksen mukaan datakeskus voi vähentää kulutustaan hintapiikkien aikana ja näin keventää painetta muiden sähkön hintaan.',
        'A study says a data centre can cut its use during price spikes and so ease the pressure on other people\'s electricity prices.', S.yleAfry),
    ],
    drawbacks: [
      item('Hallituksen tilaaman selvityksen mukaan 2 500 MW datakeskuksia voisi nostaa sähkön keskihintaa noin 10 % ja tuoda noin 100 tuntia vuodessa, jolloin hinta ylittää 50 senttiä kilowattitunnilta.',
        'A government-commissioned study says 2,500 MW of data centres could raise the average electricity price by about 10% and bring about 100 hours a year when the price is above 50 cents per kilowatt hour.', S.yleAfry),
      item('Espoon arvion mukaan sähköverkko ei kaikkialla riitä suurille sähkönkäyttäjille, ja verkkoa voi joutua vahvistamaan.',
        'Espoo\'s assessment says the grid cannot take large electricity users everywhere, and it may have to be reinforced.', S.espoo2026),
      item('Kesällä lämpöä syntyy enemmän kuin sitä tarvitaan, joten osa lämmöstä päätyy ilmaan.',
        'In summer more heat is produced than is needed, so part of it ends up in the air.', S.espoo2026),
      item('Suuri keskus voi tarvita kokonaan uusia voimalinjoja: Nurmijärven Sudentulliin suunnitellaan noin 7,7 km ilmajohtoa ja 9,2 km maakaapelia.',
        'A large centre can need entirely new power lines: about 7.7 km of overhead line and 9.2 km of underground cable are planned for Sudentulli in Nurmijärvi.', S.sudentulli),
    ],
    uncertain: [
      item('Energiateollisuuden mukaan huoli hintojen noususta on turha, kunhan uutta tuotantoa, lähinnä maatuulivoimaa, rakennetaan kulutuksen kasvun tahdissa. Eri lähteet päätyvät eri tulokseen.',
        'Finnish Energy says the worry about prices is unfounded as long as new generation, mostly onshore wind, is built as fast as demand grows. Different sources reach different conclusions.', S.yleEnergiateollisuus),
      item('Noin 130 hankkeesta noin kaksi kolmasosaa on vielä ilman investointipäätöstä. Kukaan ei tiedä, montako niistä toteutuu.',
        'Of about 130 projects, roughly two thirds still have no investment decision. Nobody knows how many will be built.', S.inderes),
      item('Jos kaupungin lämmitys nojaa yhteen datakeskukseen, mitä tapahtuu, jos se pysähtyy tai lopettaa? Varalämmön tarve riippuu sopimuksista.',
        'If a town\'s heating relies on one data centre, what happens if it stops or closes? The need for backup heat depends on the contracts.', null),
    ],
    metrics: ['electricity', 'gridPeak', 'heatAvailable', 'heatUsed'],
    terms: ['MW', 'itTeho', 'GWh', 'TWh', 'PUE', 'kaukolampo', 'hukkalampo', 'lampopumppu', 'kantaverkko', 'kulutusjousto'],
  },

  // ---------------------------------------------------------------- 2. ENVIRONMENT
  {
    key: 'environment', icon: 'drop',
    title: { fi: 'Vesi, melu ja ilmasto', en: 'Water, noise and climate' },
    lead: {
      fi: 'Ympäristövaikutukset riippuvat eniten jäähdytystavasta, sijainnista ja siitä, mistä sähkö tulee.',
      en: 'The environmental effects depend most on the cooling method, the location and where the electricity comes from.',
    },
    body: [
      {
        fi: 'Suomessa uudet datakeskukset jäähdytetään yleensä ulkoilmalla, koska ilmasto on viileä. Silloin vettä kuluu lähinnä henkilökunnan käyttöön. Esimerkiksi Järvenpään 100 MW:n hanke arvioi kulutukseksi 4 000–5 000 kuutiometriä vuodessa, eikä vettä käytetä jäähdytykseen. Jos jäähdytykseen haihdutetaan vettä, kulutus on paljon suurempi.',
        en: 'In Finland new data centres are usually cooled with outdoor air, because the climate is cool. Then water is used mainly by the staff. For example, the 100 MW project in Järvenpää estimates 4,000–5,000 cubic metres a year, and no water is used for cooling. If water is evaporated for cooling, use is much higher.',
      },
      {
        fi: 'Katolla olevat jäähdyttimet hurisevat lähes samalla tavalla yöllä ja päivällä. Valtioneuvoston ohjearvojen mukaan melu saa asuinalueilla olla ulkona enintään 55 desibeliä päivällä ja 50 desibeliä yöllä (uusilla alueilla yöllä 45 dB). Ympäristöluvassa rajat voidaan tehdä sitoviksi. Varavoimakoneet pitävät ääntä lähinnä koekäytöissä.',
        en: 'Rooftop coolers hum in much the same way at night as in the day. Under government guideline values, outdoor noise in residential areas should not exceed 55 decibels by day and 50 at night (45 at night in new areas). An environmental permit can make the limits binding. Backup generators make noise mainly during test runs.',
      },
      {
        fi: 'Suomen sähkö tuotetaan jo pääosin ilman suuria hiilidioksidipäästöjä. Kun hukkalämpö korvaa poltettavia polttoaineita kaukolämmössä, päästöt voivat pienentyä. Rakentaminen ja laitteiden valmistus aiheuttavat silti päästöjä.',
        en: 'Most of Finland\'s electricity is already produced without large carbon dioxide emissions. When waste heat replaces burned fuels in district heating, emissions can fall. Construction and making the equipment still cause emissions.',
      },
    ],
    questions: [
      { fi: 'Kuuluuko jäähdyttimien humina meidän pihalle yöllä?', en: 'Will we hear the coolers\' hum in our garden at night?' },
      { fi: 'Paljonko vettä kuluu, ja mistä se otetaan?', en: 'How much water is used, and where does it come from?' },
      { fi: 'Minne sade- ja sammutusvedet valuvat?', en: 'Where does rainwater and firefighting water run off to?' },
      { fi: 'Ovatko varavoimakoneiden pakokaasut haitallisia?', en: 'Are the backup generators\' exhaust fumes harmful?' },
    ],
    benefits: [
      item('Ulkoilmalla jäähdytettävä keskus käyttää vähän vettä: Järvenpään hankkeessa vettä ei käytetä jäähdytykseen lainkaan.',
        'A centre cooled with outdoor air uses little water: in the Järvenpää project no water is used for cooling at all.', S.jarvenpaa),
      item('Mäntsälässä lämmityksen päästöt pienenivät yhtiön mukaan 54 % vuonna 2024, kun hukkalämpö korvasi muuta tuotantoa.',
        'In Mäntsälä, according to the company, heating emissions fell by 54% in 2024 as waste heat replaced other production.', S.nebiusHeat),
      item('Kajaanissa LUMI-supertietokoneen hukkalämpö voi vähentää CSC:n arvion mukaan noin 12 400 tonnia hiilidioksidipäästöjä vuodessa.',
        'In Kajaani the LUMI supercomputer\'s waste heat can cut emissions by about 12,400 tonnes of carbon dioxide a year, CSC estimates.', S.cscLumi),
    ],
    drawbacks: [
      item('Espoon lautakunnan mukaan varavoimakoneiden pakokaasupäästöt ovat suuria tuotettuun sähköön nähden. Koekäytöt pitäisi ajoittaa niin, ettei savu laskeudu maahan.',
        'Espoo\'s environment board says the backup generators\' exhaust emissions are large compared with the electricity they produce. Test runs should be timed so that smoke does not sink to the ground.', S.espoo2025),
      item('Espoon Hepokorven keskuksessa melu voi yöllä nousta lähimmillä asunnoilla noin 53 desibeliin, jos varavoimakoneet käyvät pitkään.',
        'At the Hepokorpi centre in Espoo, night-time noise at the nearest homes could reach about 53 decibels if the backup generators run for a long time.', S.espoo2025),
      item('Kun metsää ja maata päällystetään, sadevettä valuu pois enemmän kuin ennen.',
        'When forest and ground are paved over, more rainwater runs off than before.', S.jarvenpaa),
      item('Varavoimakoneiden uusiutuva diesel on maahan tai veteen päästessään haitallista, vaikka sitä kutsutaan ympäristölle vaarattomaksi.',
        'The backup generators\' renewable diesel is harmful if it gets into soil or water, even though it is called non-hazardous.', S.espoo2025),
    ],
    uncertain: [
      item('Haihdutusjäähdytyksen vedenkulutuksesta ei löytynyt pohjoismaisia mittauksia. Arviot perustuvat lämpimämpien maiden tietoihin.',
        'No Nordic measurements were found for the water use of evaporative cooling. Estimates rely on data from warmer countries.', null),
      item('Espoon mukaan suuri sähkönkulutus voi kasvattaa hiilijalanjälkeä, ellei käytetä uusiutuvaa energiaa. Paljonko, riippuu siitä, millä lisäkulutus katetaan.',
        'Espoo says high electricity use can increase the carbon footprint unless renewable energy is used. How much depends on how the extra demand is met.', S.espoo2026),
      item('Matalataajuinen humina häiritsee ihmisiä eri tavoin. Järvenpään asukaskyselyssä melu ja generaattorit nousivat esiin huolina.',
        'Low-frequency hum bothers people in different ways. In Järvenpää\'s resident survey, noise and generators came up as concerns.', S.jarvenpaa),
    ],
    metrics: ['water', 'noise', 'co2Electricity', 'co2HeatAvoided', 'co2Construction'],
    terms: ['WUE', 'desibeli', 'CO2', 'vapaajaahdytys', 'haihdutusjaahdytys', 'nestejaahdytys', 'hulevesi'],
  },

  // ---------------------------------------------------------------- 3. JOBS & MUNICIPAL ECONOMY
  {
    key: 'jobs', icon: 'coin',
    title: { fi: 'Työpaikat ja kunnan talous', en: 'Jobs and the municipal economy' },
    lead: {
      fi: 'Rakentaminen työllistää paljon mutta lyhyen aikaa; valmis datakeskus työllistää vähemmän mutta pitkään ja maksaa kunnalle kiinteistöveroa.',
      en: 'Construction employs many people for a short time; a finished data centre employs fewer for a long time and pays property tax to the municipality.',
    },
    body: [
      {
        fi: 'Rakennusvaiheessa työmaalla voi olla satoja tai suurimmissa hankkeissa tuhansia ihmisiä. Microsoftin mukaan sen pääkaupunkiseudun työmailla on huipussaan noin 7 500 työntekijää. Pienemmässä Järvenpään hankkeessa arvio on 75–200 henkeä.',
        en: 'During construction there can be hundreds of people on site, or thousands in the largest projects. Microsoft says its sites in the Helsinki region employ about 7,500 people at the peak. For the smaller Järvenpää project the estimate is 75–200 people.',
      },
      {
        fi: 'Valmis datakeskus työllistää kymmeniä tai muutamia satoja ihmisiä. Haminassa Googlen keskuksessa työskentelee noin 500 ihmistä, kun sitä on laajennettu 15 vuoden ajan. Lisäksi työtä syntyy huoltoon, vartiointiin, siivoukseen ja kuljetuksiin.',
        en: 'A finished data centre employs tens or a few hundred people. About 500 people work at Google\'s centre in Hamina, after 15 years of expansion. Extra work is also created in maintenance, security, cleaning and transport.',
      },
      {
        fi: 'Kunta saa kiinteistöveroa rakennuksista. Palvelimista ei makseta kiinteistöveroa. Sähkövero menee valtiolle, ei kunnalle. Toisaalta kunta voi joutua rakentamaan teitä ja vesijohtoja.',
        en: 'The municipality gets property tax on the buildings. No property tax is paid on the servers. Electricity tax goes to the state, not the municipality. On the other hand, the municipality may have to build roads and water pipes.',
      },
    ],
    questions: [
      { fi: 'Saako täältä töitä, ja millaisia töitä ne ovat?', en: 'Will there be jobs here, and what kind?' },
      { fi: 'Paljonko kunta saa veroja vuodessa?', en: 'How much tax will the municipality get each year?' },
      { fi: 'Kuka maksaa uudet tiet ja vesijohdot?', en: 'Who pays for new roads and water pipes?' },
      { fi: 'Jäävätkö työntekijät asumaan meidän kuntaan?', en: 'Will the workers actually live in our municipality?' },
    ],
    benefits: [
      item('Haminan kaupungin mukaan Googlen datakeskus maksaa kaupungille vuosittain miljoonia euroja kiinteistöveroa.',
        'According to the city of Hamina, Google\'s data centre pays the city millions of euros in property tax every year.', S.hamina),
      item('Hankeyhtiöiden tiedotteen mukaan Rambollin datakeskusselvitykseen perustuva arvio on, että Mikkelin hanke toisi täydessä 165 MW:n laajuudessa 0,8–2,5 miljoonaa euroa kiinteistöveroa vuodessa ja 80–250 pysyvää työpaikkaa.',
        'According to the developers\' press release, an estimate based on a Ramboll data-centre study says the Mikkeli project at its full 165 MW would bring €0.8–2.5 million of property tax a year and 80–250 permanent jobs.', S.rambollMikkeli),
      item('Muhoksella Googlen tytäryhtiö maksaa kunnalle 26 miljoonan euron kertakorvauksen, kun kaava on lainvoimainen.',
        'In Muhos, a Google subsidiary pays the municipality a one-off €26 million once the zoning plan takes legal effect.', S.yleMuhos),
      item('Fortumin mukaan suuri datakeskus työllistää tyypillisesti suoraan 100–300 ihmistä.',
        'According to Fortum, a large data centre typically employs 100–300 people directly.', S.fortum),
    ],
    drawbacks: [
      item('Pysyviä työpaikkoja on vähän rakennusaikaan verrattuna: Järvenpään 100 MW:n hankkeen YVA-selostus arvioi vakituiseksi henkilöstöksi noin 40 henkeä, kun rakentajia on 75–200.',
        'There are few permanent jobs compared with construction: the EIA report for the 100 MW Järvenpää project estimates about 40 permanent staff, against 75–200 construction workers.', S.jarvenpaa),
      item('Espoon kaupungin arvion mukaan operatiivinen henkilöstömäärä on pieni.',
        'The city of Espoo\'s assessment says the number of operating staff is small.', S.espoo2026),
      item('Muhoksella kunta sitoutui rakentamaan alueelle noin 8 km teitä, liittymän valtatielle ja vesihuollon.',
        'In Muhos the municipality committed to building about 8 km of roads, a junction to the main road and the water supply for the area.', S.yleMuhos),
      item('Datakeskusten siirto ylempään sähköveroluokkaan 1.7.2026 tuo valtion arvion mukaan noin 47 miljoonaa euroa lisää sähköveroa vuodessa. Sähkövero menee valtiolle eikä sijaintikunnalle. Tilanne tarkistettu 24.10.2026.',
        'Moving data centres to the higher electricity-tax class from 1 July 2026 brings the state about €47 million more electricity tax a year, by the government\'s estimate. Electricity tax goes to the state, not to the host municipality. Status checked 24 Oct 2026.', S.vnTax),
    ],
    uncertain: [
      item('Google puhuu yli 37 000 rakennusaikaisesta työpaikasta uusissa hankkeissaan. Luku on yhtiön oma, eikä sen laskutapaa ole kerrottu.',
        'Google speaks of over 37,000 construction-time jobs in its new projects. The figure is the company\'s own, and how it was calculated has not been published.', S.yleGoogle),
      item('Haminan tarkkaa kiinteistöveroa Googlelta ei ole julkaistu. Kaupungin mukaan yhteisöveroa ei kertynyt vuosina 2024–2025 investointien takia.',
        'Hamina\'s exact property tax from Google has not been published. The city says no corporate tax accrued in 2024–2025 because of investments.', S.hamina),
      item('Arviot välillisistä työpaikoista vaihtelevat paljon, ja niitä on vaikea tarkistaa jälkikäteen.',
        'Estimates of indirect jobs vary a lot and are hard to check afterwards.', null),
    ],
    metrics: ['jobsConstruction', 'jobsPermanent', 'jobsIndirect', 'propertyTax', 'electricityTax', 'investment'],
    terms: ['kiinteistovero', 'sahkovero', 'investointipaatos', 'hyperscale', 'kaava'],
  },

  // ---------------------------------------------------------------- 4. TRAFFIC
  {
    key: 'traffic', icon: 'truck',
    title: { fi: 'Liikenne', en: 'Traffic' },
    lead: {
      fi: 'Liikenne kasvaa eniten rakentamisen aikana; valmis datakeskus tuo teille vain vähän lisää ajoneuvoja.',
      en: 'Traffic grows most during construction; a finished data centre adds only a few vehicles to the roads.',
    },
    body: [
      {
        fi: 'Rakentaminen tuo tontille kuorma-autoja, betoniautoja ja työntekijöiden autoja. Järvenpään hankkeessa raskas liikenne kasvaa enimmillään noin 40 kuorma-autolla ja henkilöautoliikenne 160–240 autolla päivässä; keskimäärin määrät ovat pienempiä.',
        en: 'Construction brings lorries, concrete trucks and workers\' cars to the site. In the Järvenpää project heavy traffic grows by at most about 40 lorries a day and car traffic by 160–240 cars a day; on average the numbers are lower.',
      },
      {
        fi: 'Järvenpään hankkeessa maanrakennusvaiheen arvioidaan kestävän noin puoli vuotta, ja se on usein meluisinta aikaa. Suuret kampukset rakennetaan vaiheittain, joten työmaa voi jatkua vuosia.',
        en: 'In the Järvenpää project the earthworks are expected to take about half a year and are often the noisiest time. Large campuses are built in phases, so building work can go on for years.',
      },
      {
        fi: 'Kun keskus on valmis, liikennettä tulee lähinnä henkilökunnan autoista, huoltoajoista ja polttoainekuljetuksista. Espoon arvion mukaan käytön aikainen vaikutus on vähäinen.',
        en: 'Once the centre is finished, traffic comes mainly from staff cars, service visits and fuel deliveries. Espoo\'s assessment says the effect during operation is small.',
      },
    ],
    questions: [
      { fi: 'Mitä reittiä rekat ajavat? Ohittavatko ne koulun?', en: 'Which route will the lorries take? Will they pass the school?' },
      { fi: 'Mihin aikaan työmaa aloittaa aamulla?', en: 'What time will the building site start in the morning?' },
      { fi: 'Kuinka kauan rakentaminen kestää?', en: 'How long will construction last?' },
      { fi: 'Kuka korjaa tiet, jos ne kuluvat?', en: 'Who repairs the roads if they wear out?' },
    ],
    benefits: [
      item('Valmiin keskuksen liikenne on Espoon arvion mukaan vähäistä.',
        'According to Espoo\'s assessment, traffic from a finished centre is small.', S.espoo2026),
      item('Hankkeen myötä alueelle voi tulla uusia teitä: Muhokselle suunnitellaan noin 8 km teitä, liittymä valtatielle 22 ja alikulku radan alle.',
        'A project can bring new roads to the area: about 8 km of roads, a junction to main road 22 and an underpass beneath the railway are planned in Muhos.', S.yleMuhos),
      item('Työmaaliikenne voidaan ohjata sopiville reiteille ja meluisimmat työt tehdä arkisin päivällä.',
        'Site traffic can be routed along suitable roads, and the noisiest work can be done on weekdays in the daytime.', S.jarvenpaa),
    ],
    drawbacks: [
      item('Järvenpään asukaskyselyssä huolestuttivat rakentamisen melu, pöly, tärinä, räjäytykset ja raskas liikenne.',
        'In Järvenpää\'s resident survey people were worried about construction noise, dust, vibration, blasting and heavy traffic.', S.jarvenpaa),
      item('Kalevan mukaan Iin datakeskus lisää alueen liikennettä roimasti, ja hankealueen asukkaat pelkäävät luonnonrauhan ja asuntojen arvon puolesta.',
        'According to Kaleva, the Ii data centre will add a lot of traffic to the area, and residents fear for the peace of nature and their home values.', S.kalevaIi),
      item('Suuret alueet rakennetaan vaiheittain: Atnorthin mukaan sen Kouvolan Myllykosken datakeskukset saavuttavat täyden tehon vasta noin kymmenen vuoden päästä.',
        'Large sites are built in phases: according to Atnorth, its Myllykoski data centres in Kouvola will reach full power only in about ten years.', S.yleEnergiateollisuus),
    ],
    uncertain: [
      item('Kuorma-autojen määrä riippuu paljon siitä, paljonko kalliota pitää louhia. Se selviää vasta tontin tutkimuksissa.',
        'The number of lorries depends a lot on how much rock must be blasted. That only becomes clear when the site is surveyed.', null),
      item('Kuka maksaa tietyöt? Muhoksen kunnanjohtaja toivoo valtion osallistuvan liikennejärjestelyjen kuluihin.',
        'Who pays for the road works? The municipal manager of Muhos hopes the state will help pay for the traffic arrangements.', S.yleMuhos),
    ],
    metrics: ['trucks'],
    terms: ['kaava', 'OAS', 'YVA'],
  },

  // ---------------------------------------------------------------- 5. LAND
  {
    key: 'land', icon: 'tree',
    title: { fi: 'Maa, metsä ja maisema', en: 'Land, forest and landscape' },
    lead: {
      fi: 'Datakeskus tarvitsee ison, aidatun tontin ja usein uusia voimalinjoja, joten paikan valinta ratkaisee paljon.',
      en: 'A data centre needs a large fenced plot and often new power lines, so the choice of site matters a lot.',
    },
    body: [
      {
        fi: 'Tontit vaihtelevat paljon. Järvenpään 100–130 MW:n hanke mahtuu teollisuusalueelle noin 8,8 hehtaarin alueelle. Nurmijärven Sudentulliin suunnitellaan noin 96 hehtaarin aluetta ja viittä rakennusta. Yksi jalkapallokenttä on noin 0,7 hehtaaria.',
        en: 'Plots vary a lot. The 100–130 MW Järvenpää project fits on about 8.8 hectares in an industrial area. About 96 hectares and five buildings are planned at Sudentulli in Nurmijärvi. One football pitch is about 0.7 hectares.',
      },
      {
        fi: 'Vanhalle teollisuusalueelle rakentaminen säästää metsää. Esimerkiksi Haminan keskus on entisen paperitehtaan paikalla. Metsään rakennettaessa puut ja pintamaa poistetaan.',
        en: 'Building on old industrial land saves forest. Hamina\'s centre, for example, is on the site of a former paper mill. When building in a forest, the trees and topsoil are removed.',
      },
      {
        fi: 'Kunta päättää kaavalla, mitä alueelle saa rakentaa. Asukkaat voivat kommentoida kaavaa ja suurten hankkeiden ympäristövaikutusten arviointia (YVA).',
        en: 'The municipality decides with a zoning plan what may be built in an area. Residents can comment on the plan and on the environmental impact assessment (EIA) of large projects.',
      },
    ],
    questions: [
      { fi: 'Kaadetaanko metsä, jossa nyt ulkoilemme?', en: 'Will the forest where we go walking be cut down?' },
      { fi: 'Miltä rakennus näyttää meidän ikkunasta?', en: 'What will the building look like from our window?' },
      { fi: 'Voiko alueella liikkua jatkossa?', en: 'Will we still be able to walk in the area?' },
      { fi: 'Missä ja milloin voin kommentoida kaavaa?', en: 'Where and when can I comment on the zoning plan?' },
    ],
    benefits: [
      item('Haminan datakeskus on rakennettu entisen paperitehtaan alueelle eli vanhalle teollisuusmaalle.',
        'Hamina\'s data centre was built on the site of a former paper mill, in other words on old industrial land.', S.hamina),
      item('Espoo päätti 1.6.2026, että uudet hankkeet sijoitetaan ensisijaisesti olemassa olevaan kaupunkirakenteeseen ja viheralueiden vähenemistä vältetään.',
        'On 1 June 2026 Espoo decided that new projects should go first into existing built-up areas and avoid shrinking green areas.', S.espoo2026Decision),
      item('Muhoksen sopimukseen kuuluu korvaus noin 255 hehtaarin metsän suojelusta.',
        'The Muhos agreement includes compensation for protecting about 255 hectares of forest.', S.yleMuhos),
    ],
    drawbacks: [
      item('Lupa- ja valvontavirasto (LVV) kehotti 6.10.2026 Googlen tytäryhtiötä keskeyttämään Muhoksen ja Kajaanin datakeskusten valmistelutyöt ympäristövaikutusten arvioinnin valmistumiseen asti. Puustoa oli jo poistettu ja pintamaata kuorittu.',
        'On 6 Oct 2026 the Finnish permit and supervision agency (LVV) told a Google subsidiary to stop preparatory work at the Muhos and Kajaani data-centre sites until the environmental impact assessments are finished. Trees had already been removed and topsoil stripped.', S.lvvKehotus),
      item('Muhos: LVV teki 22.10.2026 poliisille tutkintapyynnön Googlen Muhoksen datakeskushankkeesta. Virasto ei ole kertonut, mitä pyyntö koskee, koska asia on salassa pidettävä. Poliisin mukaan esiselvitystä ei ole aloitettu. Tilanne tarkistettu 25.10.2026.',
        'Muhos: on 22 Oct 2026 LVV asked the police to investigate Google’s Muhos data-centre project. The agency has not said what the request concerns, because the matter is confidential. According to the police, no preliminary inquiry has been started. Status checked 25 Oct 2026.', S.yleLvvPolice),
      item('Rakennukset ovat suuria ja laitosmaisia, ja alue suljetaan turvallisuussyistä.',
        'The buildings are large and industrial-looking, and the area is closed off for security reasons.', S.espoo2026),
      item('Järvenpäässä rakentaminen vähentää liito-oravalle ja lepakoille sopivaa elinympäristöä; vaikutus arvioitiin vähäiseksi.',
        'In Järvenpää, building reduces habitat suitable for flying squirrels and bats; the effect was judged to be small.', S.jarvenpaa),
      item('Uudet voimalinjat vievät maata ja näkyvät maisemassa.',
        'New power lines take up land and are visible in the landscape.', S.sudentulli),
    ],
    uncertain: [
      item('Maiseman ja luonnon arvoa ei voi laskea euroina, joten sitä ei näy laskelmissa. Se on asukkaiden ja päättäjien arvio.',
        'The value of landscape and nature cannot be counted in euros, so it does not show in the calculations. It is for residents and decision-makers to judge.', null),
      item('Iissä asukkaat pelkäävät kiinteistöjen arvon laskevan. Suomesta ei löytynyt tutkimusta datakeskusten vaikutuksesta asuntojen hintoihin.',
        'In Ii residents fear property values will fall. No Finnish research was found on how data centres affect house prices.', S.kalevaIi),
      item('Mitä tontille tapahtuu, kun toiminta joskus loppuu? Rakennukset voidaan purkaa tai ottaa muuhun käyttöön.',
        'What happens to the site when operation ends some day? The buildings can be demolished or put to another use.', S.jarvenpaa),
    ],
    metrics: ['land'],
    terms: ['kaava', 'OAS', 'YVA', 'ymparistolupa', 'kantaverkko'],
  },

  // ---------------------------------------------------------------- 6. SAFETY
  {
    key: 'safety', icon: 'shield',
    title: { fi: 'Turvallisuus ja varavoima', en: 'Safety and backup power' },
    lead: {
      fi: 'Datakeskus varautuu sähkökatkoihin akuilla ja varavoimakoneilla, ja sen omistajat ja asiakkaat voivat olla myös turvallisuuskysymys.',
      en: 'A data centre prepares for power cuts with batteries and backup generators, and its owners and customers can also be a security question.',
    },
    body: [
      {
        fi: 'Jos sähkö katkeaa, akut pitävät palvelimet käynnissä, kunnes dieselillä toimivat varavoimakoneet käynnistyvät. Koneita koekäytetään kuukausittain ja vuosittain. Järvenpään hankkeessa yksi kone käy kokeissa enintään 10 tuntia vuodessa.',
        en: 'If the power goes out, batteries keep the servers running until diesel backup generators start. The generators are test-run monthly and yearly. In the Järvenpää project each generator runs for at most 10 hours a year in tests.',
      },
      {
        fi: 'Varavoimakoneita on paljon, ja niiden polttoaineteho voi olla suuri. Jos se ylittää 300 MW, hankkeelle pitää tehdä ympäristövaikutusten arviointi (YVA).',
        en: 'There are many generators, and their fuel power can be large. If it exceeds 300 MW, the project needs an environmental impact assessment (EIA).',
      },
      {
        fi: 'Suojelupoliisi Supo pitää datakeskusinvestointeja pohjimmiltaan myönteisinä. Se varoittaa kuitenkin, että epäselvä omistus tai yhteydet autoritaarisiin valtioihin voivat olla riski.',
        en: 'The Finnish Security and Intelligence Service (Supo) sees data-centre investment as fundamentally positive. But it warns that unclear ownership or links to authoritarian states can be a risk.',
      },
    ],
    questions: [
      { fi: 'Kuinka usein ja mihin aikaan varavoimakoneita koekäytetään?', en: 'How often, and at what time, are the backup generators tested?' },
      { fi: 'Mitä tapahtuu, jos akut syttyvät palamaan?', en: 'What happens if the batteries catch fire?' },
      { fi: 'Kuka datakeskuksen omistaa, ja keitä sen asiakkaat ovat?', en: 'Who owns the data centre, and who are its customers?' },
      { fi: 'Onko pelastuslaitos varautunut?', en: 'Is the local rescue service prepared?' },
    ],
    benefits: [
      item('Kantaverkon asiakkaiden sähkökatkot kestävät keskimäärin vain 2–3 minuuttia vuodessa, joten varavoimakoneet käyvät lähinnä koekäytöissä.',
        'Power cuts for main-grid customers last only 2–3 minutes a year on average, so the generators mostly run only in tests.', S.jarvenpaa),
      item('Koneet testataan yksi kerrallaan, mikä vähentää melua ja pakokaasuja.',
        'The generators are tested one at a time, which reduces noise and exhaust fumes.', S.jarvenpaa),
      item('Supon mukaan tietoisuus riskeistä on parantunut, ja datakeskusinvestoinnit ovat pohjimmiltaan myönteisiä.',
        'Supo says awareness of the risks has improved and data-centre investments are fundamentally positive.', S.yleSupo),
    ],
    drawbacks: [
      item('Nurmijärven Sudentulliin suunnitellaan varavoimaa, jonka polttoaineteho on yhteensä noin 1 360 MW.',
        'Backup power with a combined fuel power of about 1,360 MW is planned at Sudentulli in Nurmijärvi.', S.sudentulli),
      item('Supo varoittaa, että kunnat voivat painottaa verotuloja enemmän kuin turvallisuusriskejä, ja pyytää kuntia ottamaan yhteyttä ennen ulkomaisten hankkeiden hyväksymistä.',
        'Supo warns that municipalities may weigh tax revenue more than security risks, and asks them to get in touch before agreeing to foreign-owned projects.', S.yleSupo),
      item('Pakokaasut voivat laskeutua maahan tyynellä säällä (inversio), joten koekäytöt pitää ajoittaa huolella.',
        'Exhaust fumes can sink to the ground in still weather (an inversion), so test runs must be timed carefully.', S.espoo2025),
      item('Järvenpään riskiarviossa suurimmaksi riskiksi nimettiin tulipalon sammutusvesien pääsy luontoon. Muita riskejä ovat akkupalon savu ja dieselvuodot. Arvion mukaan ne ovat hallittavissa rakenteilla ja valvonnalla.',
        'Järvenpää\'s risk assessment named firefighting water escaping into nature as the biggest risk. Others include smoke from a battery fire and diesel leaks. The assessment says they can be managed with design and monitoring.', S.jarvenpaa),
    ],
    uncertain: [
      item('Pitäisikö varavoimaa käyttää myös hintapiikkien aikana? Espoon lautakunta halusi rajata varavoiman käytön sähkökatkoihin, päiväaikaisiin koekäyttöihin ja muihin poikkeustilanteisiin, ettei sitä käytetä sähköntuotantoon esimerkiksi korkean hinnan vuoksi.',
        'Should backup power also be used during price spikes? Espoo\'s board wanted it limited to power cuts, daytime tests and other exceptional situations, so that it is not used to make electricity because prices are high.', S.espoo2025),
      item('Hallituksen tilaaman AFRYn selvityksen mukaan datakeskukset voisivat joustaa hintapiikkien aikana esimerkiksi korvaamalla osan verkkosähköstä akuilla tai varavoimakoneilla.',
        'A government-commissioned AFRY study says data centres could be flexible during price spikes, for example by partly replacing grid power with batteries or backup generators.', S.yleAfry),
      item('Hallitus antoi 22.10.2026 eduskunnalle lakiesityksen, jonka mukaan ulkomaiset sijoittajat tarvitsisivat ennakkoluvan yli 100 megawatin datakeskukselle. Laki on tarkoitettu tulemaan voimaan huhtikuun 2027 alussa. Tilanne tarkistettu 24.10.2026.',
        'On 22 Oct 2026 the government gave Parliament a bill under which foreign investors would need prior authorisation for a data centre of over 100 megawatts. The law is meant to take effect at the start of April 2027. Status checked 24 Oct 2026.', S.essScreening),
    ],
    metrics: ['backupPower'],
    terms: ['varavoima', 'UPS', 'polttoaineteho', 'YVA', 'ymparistolupa'],
  },

  // ---------------------------------------------------------------- 7. FUTURE
  {
    key: 'future', icon: 'clock',
    title: { fi: 'Tulevaisuus', en: 'The future' },
    lead: {
      fi: 'Rakennus tehdään vuosikymmeniksi, mutta sen laitteet vaihtuvat muutaman vuoden välein, eikä kukaan tiedä varmasti, paljonko laskentaa tarvitaan 20 vuoden päästä.',
      en: 'The building is made to last decades, but its equipment is replaced every few years, and nobody knows for sure how much computing will be needed in 20 years.',
    },
    body: [
      {
        fi: 'Datakeskuksen palvelimet uusitaan muutaman vuoden välein. Järvenpään 100 MW:n hankkeen arviossa oletetaan, että noin 400 tonnia elektroniikkaa vaihdetaan kolmen vuoden välein. Arvion mukaan todellinen väli on yleensä pidempi.',
        en: 'A data centre\'s servers are replaced every few years. The assessment for the 100 MW Järvenpää project assumes about 400 tonnes of electronics are replaced every three years. It says the real interval is usually longer.',
      },
      {
        fi: 'Suomessa on vireillä noin 130 datakeskushanketta, mutta noin kaksi kolmasosaa niistä on ilman investointipäätöstä. Kaikki eivät toteudu.',
        en: 'About 130 data-centre projects are in the pipeline in Finland, but roughly two thirds of them have no investment decision. Not all will be built.',
      },
      {
        fi: 'Ennusteissa on paljon epävarmuutta. Fingridin mukaan Suomen sähkönkulutus voi vuonna 2035 olla 110–162 terawattituntia. Ero johtuu paljolti siitä, kuinka monta datakeskusta ja muuta teollisuutta rakennetaan.',
        en: 'Forecasts are very uncertain. Fingrid says Finland\'s electricity use in 2035 could be 110–162 terawatt hours. The gap comes largely from how many data centres and other industries are built.',
      },
    ],
    questions: [
      { fi: 'Mitä tapahtuu, jos datakeskus suljetaan?', en: 'What happens if the data centre closes?' },
      { fi: 'Laajeneeko se myöhemmin, ja kysytäänkö meiltä silloin uudelleen?', en: 'Will it expand later, and will we be asked again then?' },
      { fi: 'Kierrätetäänkö vanhat palvelimet?', en: 'Are old servers recycled?' },
      { fi: 'Onko tekoälybuumi pysyvä?', en: 'Will the AI boom last?' },
    ],
    benefits: [
      item('Hamina on saanut Googlelta jo seitsemännen investointikierroksen 15 vuoden aikana.',
        'Hamina has received a seventh round of investment from Google over 15 years.', S.hamina),
      item('Espoon arvion mukaan datayritysten hakeutuminen toistensa lähelle voi pitkällä aikavälillä tuoda alueelle muutakin yritystoimintaa.',
        'Espoo\'s assessment says data companies clustering near each other can, in the long run, bring other business to the area.', S.espoo2026),
      item('Elektroniikkaromun kierrätys pienentää päästöjä, koska materiaaleja saadaan takaisin käyttöön.',
        'Recycling electronic waste reduces emissions, because materials can be used again.', S.jarvenpaa),
    ],
    drawbacks: [
      item('100 MW:n keskuksessa voidaan arvion mukaan vaihtaa noin 400 tonnia elektroniikkaa kerralla.',
        'In a 100 MW centre about 400 tonnes of electronics may be replaced at a time, according to the assessment.', S.jarvenpaa),
      item('Laitteiden painon perusteella määrä voi olla suurempi: 120 kilowatin tekoälyräkki painaa noin 1,4 tonnia, eli noin 11 tonnia megawattia kohden.',
        'Judging by hardware mass the amount can be larger: a 120 kW AI rack weighs about 1.4 tonnes, or about 11 tonnes per megawatt.', S.registerGb200),
      item('Sähköverkon liityntäkapasiteetti ei aina riitä kaikille hankkeille yhtä aikaa. Työ- ja elinkeinoministeriö valmistelee sähkömarkkinalain muutosta, jolla liittymispyynnöt voitaisiin asettaa etusijajärjestykseen. Tilanne tarkistettu 24.10.2026.',
        'Grid connection capacity is not always enough for every project at once. The Ministry of Economic Affairs and Employment is preparing a change to the Electricity Market Act so that connection requests could be put in order of priority. Status checked 24 Oct 2026.', S.vnRegistry),
      item('Hankkeet voivat pysähtyä: viranomainen kehotti lokakuussa 2026 keskeyttämään Googlen Muhoksen ja Kajaanin valmistelutyöt.',
        'Projects can stop: in October 2026 the authority told Google to halt preparatory work in Muhos and Kajaani.', S.lvvKehotus),
    ],
    uncertain: [
      item('Fingridin ennuste vuodelle 2035 on 110–162 TWh. Väli on leveä, koska tulevaisuutta ei tiedetä.',
        'Fingrid\'s forecast for 2035 is 110–162 TWh. The range is wide because the future is not known.', S.fingridForecast),
      item('Hallitus luopui budjettiriihessä 1.9.2026 suunnitellusta, enintään 30 miljoonan euron verotuesta datakeskuksille. Pääministeri Orpon mukaan tuki ei ole nyt prioriteetti. Tilanne tarkistettu 24.10.2026.',
        'At the budget talks on 1 Sep 2026 the government dropped the planned tax support for data centres, worth at most €30 million. Prime Minister Orpo said it is not a priority now. Status checked 24 Oct 2026.', S.usSupportDropped),
      item('Datakeskuksista ei ole kattavaa viranomaisrekisteriä. Lakiluonnoksen mukaan vähintään 0,5 MW:n IT-tehon keskukset pitäisi rekisteröidä, ja laki on tarkoitettu voimaan 1.1.2027. Tilanne tarkistettu 24.10.2026.',
        'There is no comprehensive official register of data centres. Under a draft law, centres with at least 0.5 MW of IT load would have to register; the law is meant to take effect on 1 Jan 2027. Status checked 24 Oct 2026.', S.vnRegistry),
      item('Kukaan ei tiedä, paljonko tekoäly tarvitsee laskentaa kymmenen vuoden päästä tai kuinka paljon laitteet tehostuvat.',
        'Nobody knows how much computing AI will need in ten years, or how much more efficient the equipment will become.', null),
    ],
    metrics: ['eWaste'],
    terms: ['palvelin', 'elektroniikkaromu', 'tekoaly', 'investointipaatos', 'hyperscale', 'kayttoaste'],
  },
];

export const themeByKey = (key) => THEMES.find((t) => t.key === key) || null;
