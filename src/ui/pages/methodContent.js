// Bilingual prose for the method page (#menetelma) and the label explanations shared with the Sources page.
// Plain language. No numbers here that are not in the model, the coefficient table or a cited source.
import { t, L } from '../../i18n.js';

// ---- trust labels -------------------------------------------------------------------------------------------------
/** The four labels, in the order they are explained. */
export const LABEL_KINDS = ['measured', 'estimate', 'calculated', 'opinion'];

// Same words as the shared dictionary (dict-core); used only if a key is missing there.
const KIND_HELP = {
  measured: { fi: 'Tilastoon kirjattu, mitattu tai raportoitu luku tai tapahtuma jostain, joka on jo olemassa tai tapahtunut.', en: 'A statistic, measurement or reported figure or event about something that already exists or has happened.' },
  estimate: { fi: 'Hankkeen, viranomaisen tai konsultin ennuste, suunnitelma tai arvio, esimerkiksi YVA-selostuksen luku tai Fingridin ennuste. Ei vielä toteutunut.', en: 'A forecast, plan or assessment by a project, an authority or a consultant, such as a figure in an environmental impact assessment or a Fingrid forecast. Not yet an outcome.' },
  calculated: { fi: 'Tämän sovelluksen oma laskelma valinnoistasi ja lähteistä poimituista kertoimista.', en: "This app's own calculation from your choices and coefficients taken from sources." },
  opinion: { fi: 'Jonkun osapuolen mielipide, väite tai tulkinta. Ei mitattu eikä laskettu tosiasia.', en: "One party's opinion, claim or interpretation. Not a measured or calculated fact." },
};
export const kindHelp = (kind) => {
  const key = `kind.${kind}.help`;
  const s = t(key);
  return s && s !== key ? s : L(KIND_HELP[kind]);
};

/** The one rule that decides the label of every number in the app. */
export const LABEL_RULE = {
  fi: 'Sääntö: jos luku kertoo jostain, mikä on jo olemassa tai jo tapahtunut, se on toteutunut. Jos se on ennuste, suunnitelma tai arvio tulevasta, se on arvio – myös silloin, kun sen on laatinut viranomainen tai YVA-konsultti. Tämän sovelluksen omat laskelmat ovat laskettuja. Osapuolen mielipide, väite tai tulkinta on näkemys. Yritysten omat ilmoitukset merkitään lisäksi sanoilla ”yhtiön mukaan”.',
  en: 'The rule: if a number is about something that already exists or has already happened, it is reported. If it is a forecast, plan or assessment of the future, it is an estimate – also when an authority or an EIA consultant made it. This app’s own calculations are calculated. A party’s opinion, claim or interpretation is a viewpoint. Companies’ own statements are also marked “according to the company”.',
};

export const INTRO = {
  fi: 'Sovellus ei ennusta tulevaisuutta. Se laskee, mitä valitsemasi datakeskus tarkoittaisi, kun käytetään lähteistä poimittuja lukuja. Koska lähteetkään eivät ole yksimielisiä, näytämme aina vaihteluvälin.',
  en: 'The app does not predict the future. It calculates what the data centre you choose would mean, using numbers taken from sources. Because the sources do not agree either, we always show a range.',
};

export const STEPS = [
  { icon: 'map', title: { fi: 'Sinun valintasi', en: 'Your choices' },
    text: { fi: 'Kunta, datakeskuksen koko, jäähdytystapa, hukkalämpö, tontti ja etäisyys lähimpiin koteihin.', en: 'Town, size, cooling method, waste heat, site and distance to the nearest homes.' } },
  { icon: 'ruler', title: { fi: 'Kertoimet lähteineen', en: 'Coefficients with sources' },
    text: { fi: 'Jokaiselle luvulle pieni, tyypillinen ja suuri arvo: esimerkiksi sähkö megawattia kohti tai työpaikat megawattia kohti. Lähteinä viranomaiset, YVA-selostukset, tutkimukset ja yritykset.', en: 'Each number has a low, typical and high value: for example electricity per megawatt or jobs per megawatt. Sources: authorities, EIA reports, research and companies.' } },
  { icon: 'calc', title: { fi: '400 laskentaa', en: '400 calculations' },
    text: { fi: 'Laskemme saman asian 400 kertaa. Joka kerta jokainen epävarma kerroin arvotaan sen pienen ja suuren arvon väliltä, useimmiten lähelle tyypillistä.', en: 'We calculate the same thing 400 times. Each time, every uncertain coefficient is drawn between its low and high value, most often close to the typical one.' } },
  { icon: 'check', title: { fi: 'Vaihteluväli', en: 'The range' },
    text: { fi: 'Näytämme keskimmäiset 80 % tuloksista: alin kymmenesosa ja ylin kymmenesosa jätetään pois. Tyypillinen arvo on tulosten keskimmäinen.', en: 'We show the middle 80% of the results: the lowest tenth and the highest tenth are left out. The typical value is the middle result.' } },
];

export const WHY_RANGES = {
  fi: 'Miksi vaihteluväli eikä yksi luku? Tutkimuksen mukaan numeroina kerrottu epävarmuus ei heikennä luottamusta lähteeseen, mutta epämääräiset sanalliset varaukset heikentävät.',
  en: 'Why a range and not one number? Research shows that uncertainty stated in numbers does not reduce trust in the source, while vague verbal hedges do.',
};
export const WHY_RANGES_SOURCE = { name: { fi: 'van der Bles ym., PNAS 2020', en: 'van der Bles et al., PNAS 2020' }, type: 'research', date: '2020-03', url: 'https://doi.org/10.1073/pnas.1913678117' };

// ---- MW means IT load ---------------------------------------------------------------------------------------------
// {low}/{high}/{typ} come from COEF.gridPeakRatio (Järvenpää EIA), {ex1}/{ex2} = 100 MW × low/high.
export const MW_BASIS = {
  title: { fi: 'MW tarkoittaa IT-tehoa', en: 'MW means IT load' },
  text: {
    fi: 'Datakeskuksen koko kerrotaan megawatteina (MW). Tässä sovelluksessa MW tarkoittaa aina IT-tehoa eli palvelinten sähkötehoa. Sähköverkosta tarvitaan huipulla enemmän, koska myös jäähdytys ja muu tekniikka käyttävät sähköä: sähköliittymän huipputeho on noin {low}–{high} × MW. Esimerkiksi 100 MW:n datakeskus tarvitsee noin {ex1}–{ex2} MW:n sähköliittymän.',
    en: 'A data centre’s size is given in megawatts (MW). In this app MW always means IT load: the electrical power of the servers. At peak the site needs more from the grid, because cooling and other systems use electricity too: the grid connection peaks at about {low}–{high} × MW. For example, a 100 MW data centre needs a grid connection of about {ex1}–{ex2} MW.',
  },
  projects: {
    fi: 'Hankkeet kertovat joskus kokonaistehon tai liittymätehon. Silloin muutamme sen IT-tehoksi jakamalla luvulla {typ}, ja kerromme sen hankkeen oletuksissa.',
    en: 'Projects sometimes give their total power or grid connection instead. Then we convert it to IT load by dividing by {typ}, and say so in the project’s assumptions.',
  },
};

// ---- waste heat in three parts ------------------------------------------------------------------------------------
export const HEAT_SPLIT = {
  title: { fi: 'Hukkalämpö kolmessa osassa', en: 'Waste heat in three parts' },
  lead: {
    fi: 'Hukkalämmöstä puhutaan kolmella eri luvulla, ja ne menevät helposti sekaisin:',
    en: 'Waste heat is described with three different numbers, and they are easily mixed up:',
  },
  parts: [
    { key: 'heatAvailable',
      title: { fi: 'Palvelimista talteen saatu lämpö', en: 'Heat captured from the servers' },
      text: { fi: 'Lähes kaikki palvelinten sähkö muuttuu lämmöksi, ja siitä {cap} saadaan talteen. Jäähdytyksestä talteen saatu lämpö on haaleaa, noin 30–40 °C, joten sellaisenaan se ei kelpaa kaukolämmöksi.', en: 'Almost all the servers’ electricity turns into heat, and {cap} of it can be captured. The heat recovered from the cooling is lukewarm, about 30–40 °C, so on its own it is not hot enough for district heating.' } },
    { key: 'heatPumpElectricity',
      title: { fi: 'Lämpöpumppujen sähkö', en: 'Heat-pump electricity' },
      text: { fi: 'Lämpöpumppu nostaa lämmön kaukolämmön lämpötilaan ja käyttää siihen sähköä. Usein lämpöpumput rakentaa kaukolämpöyhtiö, ja silloin myös niiden sähkö on sen kulu eikä datakeskuksen. Esimerkiksi Fortum kertoi vuonna 2023 investoivansa noin 225 miljoonaa euroa lämpöpumppulaitoksiin ja kaukolämpöputkiin, joilla se aikoo ottaa talteen Microsoftin suunniteltujen datakeskusten lämmön Espoossa ja Kirkkonummella.', en: 'A heat pump raises the heat to district-heating temperature and uses electricity to do so. The heat pumps are often built by the district-heating company, and then their electricity is that company’s cost, not the data centre’s. For example, in 2023 Fortum announced it would invest about €225 million in heat-pump plants and district-heating pipes to recover the heat of Microsoft’s planned data centres in Espoo and Kirkkonummi.' } },
    { key: 'heatUsed',
      title: { fi: 'Kaukolämpöön toimitettu lämpö', en: 'Heat delivered to district heating' },
      text: { fi: 'Talteen saatu lämpö ja lämpöpumppujen sähkö yhdessä. Vain se osa lasketaan, jolle on käyttöä: kesällä lämpöä jää yli, eikä yksi lähde voi kattaa koko kunnan kaukolämpöä.', en: 'The captured heat plus the heat pumps’ electricity together. Only the part that can be used counts: in summer there is surplus heat, and one source cannot cover a whole town’s district heating.' } },
  ],
  // Checked 24.10.2026.
  // Sweco (FI page modified 2026-06-16): heat pumps raise the 30–40 °C waste heat from data-centre cooling to 60–115 °C.
  // Fortum (21.6.2023): plans to invest about EUR 225 million in 2023–2027 in heat-pump plants and about 15 km of
  // district-heating pipes to recover the waste heat of Microsoft's planned data centres in Espoo and Kirkkonummi.
  sources: [
    { name: { fi: 'Sweco: Datakeskusten hukkalämpö', en: 'Sweco: Data center waste heat' }, type: 'company', date: '2026-06-16', url: 'https://www.sweco.fi/datakeskussuunnittelu/datakeskusten-hukkalampo/' },
    { name: { fi: 'Fortum: noin 225 milj. euroa hukkalämpöhankkeisiin Espoossa ja Kirkkonummella', en: 'Fortum: about €225 million for waste-heat projects in Espoo and Kirkkonummi' }, type: 'company', date: '2023-06-21', url: 'https://www.fortum.com/media/2023/06/fortum-invest-approximately-eur-225-million-waste-heat-projects-espoo-and-kirkkonummi-finland' },
  ],
};

export const TOWN_DATA = {
  fi: 'Kunnan omat tiedot tulevat tilastoista: asukkaat, kotitaloudet ja työttömät (Tilastokeskus), kiinteistöveroprosentti ja kiinteistöverotulot (Verohallinto) sekä kaukolämmön kulutus (Energiateollisuus). Siksi sama datakeskus näyttää eri kunnissa erilaiselta: hukkalämpöä voi käyttää vain sen verran kuin kunnan kaukolämpöverkko tarvitsee.',
  en: "The town's own figures come from statistics: residents, households and unemployed people (Statistics Finland), the property tax rate and property-tax income (Tax Administration) and district-heat use (Finnish Energy). That is why the same data centre looks different in different towns: waste heat can only be used as far as the town's district-heating network needs it.",
};

export const NOT_CALCULATED = [
  { title: { fi: 'Asuntojen hinnat', en: 'House prices' },
    text: { fi: 'Suomesta ei ole tutkimusta datakeskusten vaikutuksesta lähialueen asuntojen hintoihin. Asukkaat ovat huolissaan, mutta lukua ei voi laskea luotettavasti.', en: 'There is no Finnish research on how data centres affect nearby house prices. Residents are worried, but the number cannot be calculated reliably.' } },
  { title: { fi: 'Yhden datakeskuksen vaikutus sähkön hintaan', en: "One data centre's effect on electricity prices" },
    text: { fi: 'Hinta riippuu koko sähköjärjestelmästä. Arviot koko alan vaikutuksesta ovat ristiriitaisia, joten näytämme ne näkemyksinä.', en: 'The price depends on the whole power system. Estimates for the whole industry conflict, so we show them as viewpoints.' } },
  { title: { fi: 'Maiseman ja luonnon arvo', en: 'The value of landscape and nature' },
    text: { fi: 'Metsän, hiljaisuuden tai maiseman arvoa ei voi mitata euroina tai yhdellä luvulla. Näytämme pinta-alan ja annamme sinun arvioida itse.', en: 'The value of a forest, quiet or a view cannot be measured in euros or as one number. We show the area and let you judge.' } },
  { title: { fi: 'Pärjääkö kunta', en: 'Will the town thrive' },
    text: { fi: 'Kunnan tulevaisuus riippuu monesta asiasta. Emme anna pisteitä emmekä tuomiota.', en: "A town's future depends on many things. We give no score and no verdict." } },
  { title: { fi: 'Turvallisuus- ja omistajuusriskit', en: 'Security and ownership risks' },
    text: { fi: 'Esimerkiksi Suojelupoliisin varoitukset ulkomaisesta omistuksesta ovat tärkeitä, mutta niitä ei voi muuttaa luvuiksi. Ne näkyvät lähdekirjastossa.', en: "Warnings such as the Finnish Security and Intelligence Service's about foreign ownership matter, but they cannot be turned into numbers. They are in the source library." } },
];

export const LIMITATIONS = [
  { fi: 'Monet kertoimet perustuvat muutamaan suomalaiseen YVA-selostukseen ja yritysten ilmoituksiin. Osa (esimerkiksi haihdutusjäähdytyksen vedenkulutus) perustuu ulkomaiseen dataan, ja se on merkitty heikoksi näytöksi.', en: 'Many coefficients rest on a few Finnish EIA reports and company statements. Some (for example the water use of evaporative cooling) rest on foreign data and are marked as weak evidence.' },
  { fi: 'Laskelma käyttää vuoden keskiarvoja. Se ei mallinna tunnin huippuja, sähkökatkoja tai kesän ja talven lämpötasetta tarkasti.', en: 'The calculation uses yearly averages. It does not model hourly peaks, power cuts or the summer and winter heat balance in detail.' },
  { fi: 'Melu on karkea arvio etäisyyden perusteella. Todellinen melu riippuu laitteista, maastosta ja rakennuksista, ja se selvitetään melumallinnuksella.', en: 'Noise is a rough estimate based on distance. Real noise depends on the equipment, terrain and buildings, and it is studied with noise modelling.' },
  { fi: 'Kuntien tiedot ovat eri vuosilta (esimerkiksi väkiluku 2025, työpaikat 2023, kiinteistövero 2026). Osalle kunnista kaukolämmön kulutus on arvioitu asukasmäärästä.', en: 'The town figures are from different years (for example population 2025, jobs 2023, property tax 2026). For some towns district-heat use is estimated from the number of residents.' },
  { fi: '400 laskentaa olettaa, että kertoimet vaihtelevat toisistaan riippumatta. Vaihteluväli kertoo meidän oletustemme epävarmuudesta, ei siitä, mitä varmasti tapahtuu.', en: 'The 400 calculations assume the coefficients vary independently. The range shows the uncertainty of our assumptions, not what will certainly happen.' },
  { fi: 'Hankelista ei ole täydellinen, ja tilat on tarkistettu 24.10.2026. Hankkeet muuttuvat nopeasti.', en: 'The project list is not complete, and the statuses were checked on 24 Oct 2026. Projects change quickly.' },
];

export const DEVELOP_LEAD = {
  fi: 'Hackathonin jälkeen sovelluksesta voisi tulla työkalu todellisten hankkeiden asukasvuoropuheluun. Kaavoituksessa laaditaan osallistumis- ja arviointisuunnitelma (OAS, alueidenkäyttölain 63 §), ja YVA-menettelyssä järjestetään yleisötilaisuuksia. Niihin asukkaat voisivat tulla valmistautuneina.',
  en: 'After the hackathon the app could become a tool for residents’ dialogue on real projects. Zoning includes a participation and assessment plan (OAS, section 63 of the Land Use Act), and the environmental impact assessment (EIA) includes public events. Residents could come to them prepared.',
};

export const DEVELOP = [
  { icon: 'ruler', title: { fi: 'Todellinen hanke ladataan', en: 'A real project is loaded' },
    text: { fi: 'Despro tai hankkeen kehittäjä syöttää hankkeen omat luvut: koko, jäähdytys, tontti, etäisyydet ja lämpösuunnitelma. Ne näkyvät merkinnällä ”hankkeen ilmoittama”.', en: 'Despro or the developer enters the project’s own numbers: size, cooling, site, distances and heat plan. They are shown labelled “stated by the project”.' } },
  { icon: 'people', title: { fi: 'Asukkaat tutustuvat etukäteen', en: 'Residents explore beforehand' },
    text: { fi: 'Linkki tai QR-koodi OAS- tai YVA-tilaisuuden kutsuun. Tilaisuudessa sama näkymä valkokankaalla.', en: 'A link or QR code in the invitation to the OAS or EIA event. At the event, the same view on a projector.' } },
  { icon: 'bubble', title: { fi: 'Kysymykset kootaan nimettömästi', en: 'Questions are collected anonymously' },
    text: { fi: 'Asukkaiden painotukset ja kysymykset kootaan nimettömäksi yhteenvedoksi kehittäjälle ja kunnalle. Ei henkilötietoja.', en: 'Residents’ priorities and questions are gathered into an anonymous summary for the developer and the municipality. No personal data.' } },
  { icon: 'shield', title: { fi: 'Kaksi tarkastajaa', en: 'Two reviewers' },
    text: { fi: 'Ennen julkaisua luvut tarkistaa sekä alan asiantuntija että kriittinen tarkastaja, esimerkiksi ympäristöjärjestö tai yliopisto.', en: 'Before release, the numbers are checked by both an industry expert and a critical reviewer, such as an environmental organisation or a university.' } },
  { icon: 'clock', title: { fi: 'Julkinen päivitysloki', en: 'A public update log' },
    text: { fi: 'Jokainen muutettu luku päivätään ja perustellaan. Kuntien tilastot päivitetään vuosittain valmiilla skripteillä.', en: 'Every changed number is dated and explained. Town statistics are updated every year with ready-made scripts.' } },
];

/** Who pays: one possible model, clearly a proposal, not an agreement. */
export const WHO_PAYS = {
  title: { fi: 'Kuka maksaa?', en: 'Who pays?' },
  text: {
    fi: 'Yksi mahdollinen malli, ei sovittu: hankkeesta vastaava yhtiö tai kunta tilaa hankekohtaisen version osana OAS- tai YVA-vuorovaikutusta, ja Despro ylläpitää sitä. Lähteet, laskentatapa ja tarkastajien huomiot pysyvät julkisina, jotta maksaja ei voi muuttaa lukuja huomaamatta.',
    en: 'One possible model, not agreed with anyone: the developer or the municipality orders a project-specific version as part of the OAS or EIA participation, and Despro maintains it. The sources, the method and the reviewers’ comments stay public, so whoever pays cannot change the numbers unnoticed.',
  },
};

/** Accessibility: what is done and the known gaps. No claim of conformance with any standard. */
export const ACCESSIBILITY = {
  title: { fi: 'Saavutettavuus', en: 'Accessibility' },
  done: {
    fi: 'Tehty: kaikkia ohjaimia voi käyttää näppäimistöllä, ja kohdistus näkyy; kun näkymä vaihtuu, kohdistus siirtyy sen otsikkoon ja ruudunlukija kertoo näkymän nimen; ruudunlukija kuulee ohjainten nimet ja tilat; kaupunkinäkymällä on tekstivastine; harmaan tekstin kontrasti taustaan on vähintään 4,5:1; valitut vaihtoehdot näkyvät myös Windowsin suurikontrastitilassa; liike vähenee, jos laite pyytää vähemmän liikettä; sivu toimii 320 pikselin levyisellä näytöllä; tekstiä voi suurentaa yläpalkin painikkeella; vaikeat sanat selitetään napauttamalla.',
    en: 'Done: every control works with a keyboard and focus is visible; when the view changes, focus moves to its heading and screen readers hear the view’s name; screen readers hear the names and states of controls; the town scene has a text alternative; grey text has a contrast of at least 4.5:1 against its background; selected options stay visible in Windows high-contrast mode; motion is reduced when the device asks for less motion; the page works on a screen 320 pixels wide; text can be enlarged with the button in the top bar; difficult words are explained with a tap.',
  },
  gaps: {
    fi: 'Tunnetut puutteet: kartalta ei voi valita kuntaa näppäimistöllä, joten näppäimistön käyttäjä valitsee kunnan hakukentästä tai hankkeen hankelistasta. Sivua ei ole testattu ruudunlukijan käyttäjien kanssa, ja 24.10.2026 tehdyt korjaukset (kontrasti, suurikontrastitila, kohdistus) on tarkistettu vain omilla testeillämme. Selkokielinen ja ruotsinkielinen versio puuttuvat. Sivun saavutettavuutta ei ole arvioitu minkään standardin mukaan.',
    en: 'Known gaps: towns cannot be chosen on the map with a keyboard, so keyboard users choose a town with the search box or a project from the project list. The site has not been tested with screen-reader users, and the fixes made on 24 Oct 2026 (contrast, high-contrast mode, focus) have only been checked with our own tests. Plain-language (selkokieli) and Swedish versions are missing. The site’s accessibility has not been assessed against any standard.',
  },
};

export const TECH = {
  fi: 'Tekniikka: tavallinen JavaScript ilman ulkoisia kirjastoja, kartta ja kaaviot piirretään itse. Uusi kerroin on yksi rivi kerrointiedostossa, ja kuntien tiedot haetaan uudelleen yhdellä komennolla. Sovellus toimii myös ilman verkkoyhteyttä.',
  en: 'Technology: plain JavaScript with no external libraries; the map and charts are drawn by hand. A new coefficient is one entry in the coefficient file, and the town data is re-fetched with one command. The app also works offline.',
};

export const EXTRA_DATA = [
  { name: { fi: 'Fingrid: sähkönkulutus ja ennusteet', en: 'Fingrid: electricity use and forecasts' }, use: { fi: 'Koko Suomen vertailut', en: 'All-of-Finland comparisons' }, licence: 'CC BY 4.0', url: 'https://www.fingrid.fi/', date: '2026-09-30' },
  { name: { fi: 'Kertoimet: YVA-selostukset, EU:n datakeskusraportti, tutkimukset ja yritysten tiedot', en: 'Coefficients: EIA reports, the EU data-centre report, research and company data' }, use: { fi: 'Laskennan kertoimet', en: 'Calculation coefficients' }, licence: { fi: 'Lähde mainittu jokaisen luvun kohdalla', en: 'Source named for every number' }, url: null, date: null, toSources: true },
];

export const LOG = [
  { date: '2026-10-24', text: { fi: 'Ensimmäinen versio Tampereen hackathonissa. Kuntatiedot: Tilastokeskus (2026), Verohallinto (2026) ja Energiateollisuuden kaukolämpötilasto 2025 (julkaistu 23.10.2026). Hankkeiden tilat tarkistettu.', en: 'First version at the Tampere hackathon. Town data: Statistics Finland (2026), Tax Administration (2026) and the Finnish Energy district-heating statistics 2025 (published 23 Oct 2026). Project statuses checked.' } },
];
