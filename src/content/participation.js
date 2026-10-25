// How a resident can take part in a data-centre project (SPEC §6, interfaces §7). Owned by content.
// Checked 24.10.2026 against the consolidated acts on Finlex and the EIA page on ymparisto.fi.
// No dates of any single project here: the channel line is generic on purpose.
const CHECKED = { fi: 'Ajantasainen säädösteksti, tarkistettu 24.10.2026.', en: 'Consolidated text, checked 24 Oct 2026.' };
const UNDATED = { fi: 'Sivulla ei ole julkaisupäivää; tarkistettu 24.10.2026.', en: 'The page has no publication date; checked 24 Oct 2026.' };

const SRC = {
  zoningAct: { name: 'Alueidenkäyttölaki 132/1999 (Finlex)', type: 'authority', date: '1999-02-05', url: 'https://www.finlex.fi/fi/lainsaadanto/1999/132', note: CHECKED },
  eiaAct: { name: 'Laki ympäristövaikutusten arviointimenettelystä 252/2017 (Finlex)', type: 'authority', date: '2017-05-05', url: 'https://www.finlex.fi/fi/lainsaadanto/2017/252', note: CHECKED },
  eiaPage: { name: 'Ymparisto.fi: Hankkeiden ympäristövaikutusten arviointimenettely (YVA)', type: 'authority', date: '2026-10', url: 'https://www.ymparisto.fi/fi/osallistu-ja-vaikuta/ymparistovaikutusten-arviointi/hankkeiden-ymparistovaikutusten-arviointimenettely-yva', note: UNDATED },
};

export const HAVE_YOUR_SAY = {
  title: { fi: 'Näin voit vaikuttaa', en: 'How you can have your say' },
  lead: {
    fi: 'Datakeskus tarvitsee kunnan kaavan, ja suuri hanke myös ympäristövaikutusten arvioinnin (YVA). Molemmissa asukkaat voivat kertoa mielipiteensä.',
    en: 'A data centre needs a zoning plan from the municipality, and a large project also needs an environmental impact assessment (EIA). In both, residents can give their opinion.',
  },
  steps: [
    {
      title: { fi: 'Kaavan alku: osallistumis- ja arviointisuunnitelma (OAS)', en: 'Start of zoning: the participation and assessment plan (OAS)' },
      text: {
        fi: 'Kunta kertoo OAS:ssa, mitä kaavassa selvitetään ja miten voit osallistua. Kaavan valmistelun aikana maanomistajat ja ne, joiden asumiseen, työhön tai muihin oloihin kaava voi vaikuttaa huomattavasti, voivat kertoa mielipiteensä kirjallisesti tai suullisesti (alueidenkäyttölaki 62–63 §).',
        en: 'In the OAS the municipality explains what the plan will study and how you can take part. While the plan is being prepared, landowners and people whose living, work or other conditions the plan may significantly affect can give their opinion in writing or orally (Land Use Act, sections 62–63).',
      },
      source: SRC.zoningAct,
    },
    {
      title: { fi: 'Kaavaehdotus nähtävillä: muistutus', en: 'Plan proposal on display: a formal objection' },
      text: {
        fi: 'Kun kaavaehdotus asetetaan julkisesti nähtäville, voit jättää siitä muistutuksen. Kunta antaa perustellun vastauksen niille, jotka ovat jättäneet muistutuksen ja ilmoittaneet osoitteensa (65 §).',
        en: 'When the plan proposal is put on public display, you can submit a formal objection (muistutus). The municipality gives a reasoned reply to those who objected and left their address (section 65).',
      },
      source: SRC.zoningAct,
    },
    {
      title: { fi: 'YVA-ohjelma: mitä arvioidaan', en: 'EIA programme: what will be assessed' },
      text: {
        fi: 'Arviointiohjelmasta voit antaa vapaamuotoisen mielipiteen yhteysviranomaiselle, joka on 1.1.2026 alkaen Lupa- ja valvontavirasto. Aikaa on 30 päivää kuulutuksesta, erityisestä syystä enintään 60 päivää (YVA-laki 17 §).',
        en: 'You can send a free-form opinion on the assessment programme to the contact authority, which since 1 Jan 2026 is the Permit and Supervision Agency (LVV). You have 30 days from the public notice, or up to 60 days for a special reason (EIA Act, section 17).',
      },
      source: SRC.eiaAct,
    },
    {
      title: { fi: 'YVA-selostus: mitä arvioinnissa saatiin selville', en: 'EIA report: what the assessment found' },
      text: {
        fi: 'Kun arviointiselostus valmistuu, voit taas antaa mielipiteen. Aikaa on vähintään 30 ja enintään 60 päivää (20 §). Selostus esitellään yleensä yleisötilaisuudessa.',
        en: 'When the assessment report is ready, you can give your opinion again. You have at least 30 and at most 60 days (section 20). The report is usually presented at a public event.',
      },
      source: SRC.eiaPage,
    },
    {
      title: { fi: 'Kuka järjestää', en: 'Who organises it' },
      text: {
        fi: 'Kaavoituksen järjestää kunta. YVA-menettelyä hoitaa yhteysviranomainen, joka kuuluttaa ohjelmasta ja selostuksesta verkkosivuillaan ja sanomalehdessä.',
        en: 'The municipality runs the zoning. The EIA procedure is run by the contact authority, which announces the programme and the report on its website and in a newspaper.',
      },
      source: SRC.eiaPage,
    },
  ],
  channelLine: {
    fi: 'Katso ajankohtaiset kuulutukset kunnan verkkosivuilta ja ilmoitustaululta sekä ymparisto.fi-palvelun YVA-hankesivuilta.',
    en: 'Look for current public notices on the municipality\'s website and notice board, and on the EIA project pages of the ymparisto.fi service.',
  },
};
