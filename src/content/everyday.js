// Everyday sound levels for the noise comparison (SPEC §6, interfaces §7). Owned by content.
// One source only: the A-weighted example levels (LAeq) on Valtteri Hongisto's slide, checked 24.10.2026.
// db = the level given on the slide; where the slide gives a range, db is its upper end and the label shows the range.
// Sorted ascending by db.
export const NOISE_LEVELS_SOURCE = {
  name: 'Valtteri Hongisto (Turun ammattikorkeakoulu, meluntorjunnan dosentti, Aalto-yliopisto): Tuulivoimamelu ja sen vaikutukset, Konnevesi 24.4.2024',
  type: 'research',
  date: '2024-04-24',
  url: 'https://konnevesi.fi/wp-content/uploads/2024/04/2024-04-24-Konnevesi-Hongisto.pdf',
  note: { fi: 'Esityksen dia "Melu vai ääni", tarkistettu 24.10.2026.', en: 'Slide "Noise or sound" in the presentation, checked 24 Oct 2026.' },
};

export const NOISE_LEVELS = [
  { db: 18, label: { fi: 'Tätä hiljaisempaa ääntä ei yleensä erota', en: 'Quieter sounds usually cannot be heard' } },
  { db: 28, label: { fi: 'Makuuhuone yöllä (18–28 dB)', en: 'A bedroom at night (18–28 dB)' } },
  { db: 40, label: { fi: 'Toimiston ilmanvaihto (30–40 dB)', en: 'Office ventilation (30–40 dB)' } },
  { db: 55, label: { fi: 'Tuulivoimalan juurella', en: 'At the foot of a wind turbine' } },
  { db: 60, label: { fi: 'Keskustelu huoneessa', en: 'A conversation in a room' } },
  { db: 75, label: { fi: 'Henkilöautossa 100 km/h:n nopeudella', en: 'Inside a car at 100 km/h' } },
];
