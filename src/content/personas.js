// Persona lenses — owned by the topics agent (SPEC §6).
// The six people are FICTIONAL (illustrative). Only their `voices` are real: paraphrased Finnish viewpoints with
// sources. `stance` (extra, optional) tells whether a voice leans supportive, critical or mixed — for balance checks
// and optional labels; it must never be shown as a colour verdict.
// `kind` is the voice's trust label, with the same values and rules as FACTS (see facts.js): 'measured' = a reported
// event or outcome (company-reported outcomes name the company), 'estimate' = a forecast, plan or assessment,
// 'opinion' = a party's view, demand or concern. When a voice has `factId`, its kind is that fact's kind (the content
// validator checks this). Code falls back to 'opinion' when kind is missing.
// `distanceM` (optional) = how far the person lives from the site, in metres, when their text says so; code falls back
// to the design distance when it is missing.
import { TOPIC_SOURCES as S } from './themes.js';

export const PERSONA_NOTE = {
  fi: 'Kuvitteellinen henkilö. Näkökulmat ja lähteet ovat todellisia.',
  en: 'An illustrative, fictional person. The viewpoints and sources are real.',
};

const v = (fi, en, source, stance, kind, factId) => ({ summary: { fi, en }, source, stance, kind, ...(factId ? { factId } : {}) });

export const PERSONAS = [
  {
    id: 'neighbour', icon: 'sound',
    name: { fi: 'Pirjo, 68', en: 'Pirjo, 68' },
    distanceM: 500, // "noin puolen kilometrin päässä"
    who: {
      fi: 'Eläkeläinen. Asuu omakotitalossa noin puolen kilometrin päässä suunnitellusta tontista.',
      en: 'Retired. Lives in a detached house about half a kilometre from the planned site.',
    },
    cares: ['noise', 'trucks', 'land', 'backupPower'],
    says: {
      fi: 'Muutin tänne hiljaisuuden takia, joten haluan tietää, kuuluuko se meille yöllä.',
      en: 'I moved here for the quiet, so I want to know whether we will hear it at night.',
    },
    asks: [
      { fi: 'Kuinka kova ääni on meidän pihalla yöllä, ja kuka sen mittaa valmistumisen jälkeen?', en: 'How loud will it be in our garden at night, and who will measure it once it is running?' },
      { fi: 'Milloin ja kuinka usein varavoimakoneita koekäytetään?', en: 'When and how often will the backup generators be tested?' },
      { fi: 'Mitä reittiä työmaaliikenne kulkee, ja kuinka monta vuotta se kestää?', en: 'Which route will the site traffic take, and for how many years?' },
    ],
    voices: [
      v('Iissä hankealueen asukkaat pelkäävät, että datakeskus pilaa alueen luonnonrauhan ja asuntojen arvon. Kalevan mukaan hanke myös lisää liikennettä roimasti.',
        'In Ii, residents near the site fear the data centre will spoil the peace of nature and their home values. Kaleva reports it will also add a lot of traffic.', S.kalevaIi, 'critical', 'opinion', 'ii-residents-fears'),
      v('Järvenpään asukaskyselyssä (252 vastausta) enemmistö suhtautui hankkeeseen kielteisesti: paikallisia hyötyjä pidettiin pieninä ja moni toivoi keskusta kauemmas asutuksesta. Osa piti vaikutuksia vähäisinä, jos toteutus on huolellinen.',
        'In Järvenpää\'s resident survey (252 responses) most respondents were negative: local benefits were seen as small and many wanted the centre further from homes. Some thought the effects would be small if it is done carefully.', S.jarvenpaa, 'critical', 'opinion'),
      v('Espoon ympäristö- ja rakennuslautakunta vaati, että päiväaikainen melu pysyy enintään 55 dB:ssä myös varavoimakoneiden koekäyttöpäivinä ja että tämä tehdään luvassa velvoittavaksi. Lisäksi varavoiman käyttö pitäisi rajata sähkökatkoihin ja päiväaikaisiin koekäyttöihin.',
        'Espoo\'s environment and building board demanded that daytime noise stay at or below 55 dB also on generator test days, made binding in the permit, and that backup power be limited to power cuts and daytime tests.', S.espoo2025, 'mixed', 'opinion'),
    ],
  },
  {
    id: 'jobseeker', icon: 'people',
    name: { fi: 'Aleksi, 22', en: 'Aleksi, 22' },
    who: {
      fi: 'Valmistui sähköasentajaksi keväällä ja etsii töitä läheltä kotia.',
      en: 'Qualified as an electrician in the spring and is looking for work close to home.',
    },
    cares: ['jobsConstruction', 'jobsPermanent', 'jobsIndirect', 'investment'],
    says: {
      fi: 'Jos täällä on töitä, minun ei tarvitse muuttaa pois kotiseudulta.',
      en: 'If there is work here, I won\'t have to move away from home.',
    },
    asks: [
      { fi: 'Millaisia töitä valmiissa datakeskuksessa on, ja tarvitaanko niihin erityiskoulutusta?', en: 'What jobs are there in a finished data centre, and do they need special training?' },
      { fi: 'Palkataanko rakennusvaiheessa paikallisia yrityksiä ja ihmisiä?', en: 'Will local firms and people be hired during construction?' },
      { fi: 'Montako työpaikkaa jää, kun työmaa loppuu?', en: 'How many jobs remain when the building work ends?' },
    ],
    voices: [
      v('Microsoftin mukaan sen pääkaupunkiseudun työmailla on huipussaan noin 7 500 työntekijää ja valmiissa keskuksessa noin 50 työntekijää rakennusta kohden.',
        'Microsoft says its Helsinki-region sites employ about 7,500 people at the construction peak and about 50 people per building once finished.', S.microsoft, 'supportive', 'estimate', 'ms-ops-50'),
      v('Fortumin mukaan suuri datakeskus työllistää tyypillisesti suoraan 100–300 ihmistä, ja välillisesti enemmän erityisesti rakennusaikana.',
        'Fortum says a large data centre typically employs 100–300 people directly, and more indirectly, especially during construction.', S.fortum, 'supportive', 'estimate'),
      v('Espoon kaupungin arvion mukaan rakentaminen tuo paikallisia työpaikkoja ja investointeja, mutta valmiin datakeskuksen oma henkilöstö on pieni.',
        'The city of Espoo\'s assessment says construction brings local jobs and investment, but a finished data centre has only a small staff of its own.', S.espoo2026, 'mixed', 'estimate'),
    ],
  },
  {
    id: 'heatfamily', icon: 'flame',
    name: { fi: 'Laaksosen perhe', en: 'The Laaksonen family' },
    who: {
      fi: 'Kaksi aikuista ja kolme lasta kerrostalossa, joka lämpiää kaukolämmöllä.',
      en: 'Two adults and three children in a block of flats heated by district heating.',
    },
    cares: ['heatUsed', 'heatAvailable', 'co2HeatAvoided', 'electricity'],
    says: {
      fi: 'Jos datakeskuksen lämpö lämmittää kotimme, haluaisimme nähdä sen myös laskussa.',
      en: 'If the data centre\'s heat warms our home, we would like to see it on our bill too.',
    },
    asks: [
      { fi: 'Halpeneeko kaukolämpö, jos datakeskuksen lämpö on ilmaista tai halpaa?', en: 'Will district heat get cheaper if the data centre\'s heat is free or cheap?' },
      { fi: 'Millä kodit lämmitetään, jos datakeskus pysähtyy talvella?', en: 'How will homes be heated if the data centre stops in winter?' },
      { fi: 'Kuinka suuren osan kaupungin lämmöstä datakeskus voi oikeasti kattaa?', en: 'How much of the town\'s heat can the data centre really cover?' },
    ],
    voices: [
      v('Nebiuksen mukaan sen Mäntsälän datakeskus on kattanut enimmillään 72 % kunnan vuotuisesta lämmöntarpeesta ja pienentänyt lämmityksen päästöjä 54 % vuonna 2024.',
        'Nebius says its Mäntsälä data centre has covered up to 72% of the town\'s annual heat demand and cut heating emissions by 54% in 2024.', S.nebiusHeat, 'supportive', 'measured', 'mantsala-heat-share'),
      v('Haminan kaupungin mukaan Googlen datakeskuksen jäähdytyksestä syntyvä lämpö menee kaupungin kaukolämpöverkkoon maksutta.',
        'The city of Hamina says heat from cooling Google\'s data centre goes into the town\'s district-heating network free of charge.', S.hamina, 'supportive', 'measured', 'hamina-heat-flowing'),
      v('Espoon kaupungin arvion mukaan kesällä kaikkea lämpöä ei voida hyödyntää, eikä lämmön kausivarastointi näytä nyt kannattavalta.',
        'The city of Espoo\'s assessment says not all the heat can be used in summer, and storing heat between seasons does not look profitable for now.', S.espoo2026, 'critical', 'estimate'),
    ],
  },
  {
    id: 'finance', icon: 'coin',
    name: { fi: 'Marja, 51', en: 'Marja, 51' },
    who: {
      fi: 'Pienen kunnan talousjohtaja. Valmistelee laskelmat valtuustolle.',
      en: 'Finance director of a small municipality. Prepares the figures for the council.',
    },
    cares: ['propertyTax', 'electricityTax', 'jobsPermanent', 'investment'],
    says: {
      fi: 'Verotulot ovat tervetulleita, mutta laskelmaan kuuluvat myös tiet, vesijohdot ja riskit.',
      en: 'Tax income is welcome, but the sums must also include roads, water pipes and risks.',
    },
    asks: [
      { fi: 'Paljonko kiinteistöveroa kertyy vuodessa, ja miten se muuttuu rakennuksen vanhetessa?', en: 'How much property tax comes in each year, and how does it change as the building ages?' },
      { fi: 'Mitä kunta joutuu rakentamaan omalla rahallaan, ja kuka maksaa sen?', en: 'What must the municipality build with its own money, and who pays for it?' },
      { fi: 'Kuka omistaa yhtiön, ja onko turvallisuusviranomaisia kuultu?', en: 'Who owns the company, and have the security authorities been consulted?' },
    ],
    voices: [
      v('Hankeyhtiöiden tiedotteen mukaan Rambollin datakeskusselvitykseen perustuva arvio on, että Mikkelin 165 MW:n hanke toisi kaupungille 0,8–2,5 miljoonaa euroa kiinteistöveroa vuodessa.',
        'According to the developers\' press release, an estimate based on a Ramboll data-centre study says the 165 MW Mikkeli project would bring the city €0.8–2.5 million of property tax a year.', S.rambollMikkeli, 'supportive', 'estimate', 'mikkeli-ramboll-tax'),
      v('Muhos saa Googlen tytäryhtiöltä 26 miljoonan euron kertakorvauksen, mutta sitoutuu rakentamaan alueen tiet ja vesihuollon.',
        'Muhos gets a one-off €26 million from a Google subsidiary, but commits to building the area\'s roads and water supply.', S.yleMuhos, 'mixed', 'measured', 'muhos-26m'),
      v('Supo varoittaa, että kunnat voivat painottaa datakeskusten tuloja enemmän kuin turvallisuusriskejä, ja kehottaa ottamaan yhteyttä Supoon etukäteen.',
        'Supo warns that municipalities may weigh data-centre income more heavily than security risks, and urges them to contact Supo in advance.', S.yleSupo, 'critical', 'opinion', 'supo-warning'),
    ],
  },
  {
    id: 'nature', icon: 'tree',
    name: { fi: 'Eero, 45', en: 'Eero, 45' },
    who: {
      fi: 'Paikallisen luontoyhdistyksen aktiivi ja innokas retkeilijä.',
      en: 'Active in the local nature association and a keen hiker.',
    },
    cares: ['land', 'water', 'co2Construction', 'co2HeatAvoided'],
    says: {
      fi: 'Metsää ei saa takaisin, joten paikka pitää valita huolella ennen kuin yhtään puuta kaadetaan.',
      en: 'You can\'t get a forest back, so the site must be chosen carefully before a single tree is cut.',
    },
    asks: [
      { fi: 'Onko alueella liito-oravia tai muita suojeltavia lajeja, ja kuka sen selvittää?', en: 'Are there flying squirrels or other protected species on the site, and who checks?' },
      { fi: 'Voisiko keskuksen rakentaa vanhalle teollisuusalueelle?', en: 'Could the centre be built on an old industrial site instead?' },
      { fi: 'Miten luontohaitat korvataan, ja kuka valvoo sitä?', en: 'How will harm to nature be compensated, and who checks it?' },
    ],
    voices: [
      v('Lupa- ja valvontavirasto kehotti Googlen tytäryhtiötä keskeyttämään Muhoksen ja Kajaanin valmistelutyöt, koska ympäristöä merkittävästi muuttavia töitä, kuten satojen hehtaarien metsänraivausta, oli tehty ennen ympäristövaikutusten arvioinnin valmistumista.',
        'The permit and supervision agency told Google\'s subsidiary to stop preparatory work in Muhos and Kajaani, because work that significantly changes the environment, such as clearing hundreds of hectares of forest, had been done before the environmental impact assessment was finished.', S.lvvKehotus, 'critical', 'measured', 'lvv-halt'),
      v('Espoon elinkeino- ja kilpailukykyjaosto päätti 1.6.2026, että datakeskukset sijoitetaan ensisijaisesti olemassa olevaan kaupunkirakenteeseen ja että hankkeen on esitettävä, miten mahdolliset luontohaitat kompensoidaan.',
        'On 1 June 2026 Espoo\'s business committee decided that data centres should go primarily into existing built-up areas and that projects must present how possible harm to nature would be compensated.', S.espoo2026Decision, 'mixed', 'measured'),
      v('Muhoksen maankäyttösopimukseen kuuluu korvaus noin 255 hehtaarin metsän suojelusta.',
        'The Muhos land-use agreement includes compensation for protecting about 255 hectares of forest.', S.yleMuhos, 'supportive', 'measured', 'muhos-forest-255'),
    ],
  },
  {
    id: 'grid', icon: 'bolt',
    name: { fi: 'Sanna, 39', en: 'Sanna, 39' },
    who: {
      fi: 'Sähköverkkoinsinööri. Suunnittelee työkseen sähköasemia ja voimalinjoja.',
      en: 'Power-grid engineer. Designs substations and power lines for a living.',
    },
    cares: ['electricity', 'gridPeak', 'backupPower', 'heatAvailable'],
    says: {
      fi: 'Tärkein kysymys ei ole pelkkä sähkön määrä, vaan se, joustaako datakeskus silloin, kun sähköä on vähän.',
      en: 'The key question isn\'t just how much electricity, but whether the data centre can ease off when power is scarce.',
    },
    asks: [
      { fi: 'Sitoutuuko datakeskus vähentämään kulutustaan, kun sähköä on niukasti?', en: 'Will the data centre commit to cutting its use when power is scarce?' },
      { fi: 'Tarvitaanko uusia voimalinjoja, ja mihin ne tulevat?', en: 'Will new power lines be needed, and where will they go?' },
      { fi: 'Saako varavoimaa käyttää sähkön tuotantoon hintapiikkien aikana?', en: 'May the backup generators be used to make electricity during price spikes?' },
    ],
    voices: [
      v('Hallituksen tilaaman AFRYn selvityksen mukaan 2 500 MW datakeskuksia voisi nostaa sähkön keskihintaa noin 10 %. Selvitys ehdottaa, että datakeskukset vähentäisivät kulutustaan hintapiikkien aikana.',
        'A government-commissioned AFRY study says 2,500 MW of data centres could raise the average electricity price by about 10%. It suggests data centres cut their use during price spikes.', S.yleAfry, 'critical', 'estimate', 'afry-price-10pct'),
      v('Energiateollisuuden mukaan huoli hintojen noususta on turha, kunhan uutta tuotantoa, lähinnä maatuulivoimaa, rakennetaan kulutuksen kasvun tahdissa.',
        'Finnish Energy says the worry about prices is unfounded as long as new generation, mostly onshore wind, is built as fast as demand grows.', S.yleEnergiateollisuus, 'supportive', 'opinion', 'et-prices-unfounded'),
      v('Fingrid ennustaa Suomen sähkönkulutuksen kasvavan 106–123 terawattituntiin vuoteen 2030 mennessä, ja datakeskukset ovat yksi tärkeimmistä syistä.',
        'Fingrid forecasts Finland\'s electricity use will grow to 106–123 terawatt hours by 2030, with data centres one of the main reasons.', S.fingridForecast, 'mixed', 'estimate', 'fingrid-forecast-2030'),
    ],
  },
];

export const personaById = (id) => PERSONAS.find((p) => p.id === id) || null;
