# Demo script and Q&A — Naapurina datakeskus

> Draft. Check each step against the final build before you rehearse. Numbers on screen come from the app; don't memorise them, read them off the screen.

## The 30-second pitch

**FI**
Suomessa on noin 40 datakeskusta toiminnassa, 14 rakenteilla ja noin 130 hanketta vireillä. Kun sellaista suunnitellaan omaan kuntaan, kysymykset ovat aina samat: tuleeko töitä, riittääkö sähkö, lämmittääkö se koteja, kuluuko vettä, kuuluuko melu, kaadetaanko metsää. Tieto on hajallaan ja täynnä vaikeita termejä. Naapurina datakeskus kokoaa sen yhteen. Valitset oman kuntasi, suunnittelet datakeskuksen, arvaat ensin ja kelaat aikaa 30 vuotta eteenpäin. Jokainen luku on vaihteluväli, ja jokaisen takana on lähde. Sama datakeskus, eri kunta, eri tarina.

**EN**
Finland has about 40 data centres running, 14 under construction and about 130 projects in the pipeline. When one is planned in your town, people ask the same things: will there be jobs, is there enough electricity, will it heat our homes, does it use water, will we hear it, will the forest go. The answers are scattered and full of jargon. A data centre next door puts them in one place. You pick your own town, design a data centre, guess first, then fast-forward 30 years. Every number is a range with its source. Same data centre, different town, different story.

(National figures: Inderes 3.9.2026 and EK's data window 30.6.2026, as in the challenge brief.)

## Before you present

- Open the app in a **fresh private window**. The app remembers your last design, guesses and priorities in the browser, so a used window starts mid-story.
- Offline backup: `app/dist/naapurina-datakeskus.html` works without internet (fonts fall back to system fonts). Keep it on the desktop.
- Test the projector: open the simulator and press **F** (presentation mode). The town scene should fill the screen.
- Live site: https://chintufp.github.io/naapurina-datakeskus/ (jurors can open it on their phones).
- Have the real-project link ready: https://chintufp.github.io/naapurina-datakeskus/#hanke-jarvenpaa-dc
- Language: English by default; **FI / EN** switch at the top right.
- On a laptop the simulator is three columns that each scroll on their own: steps 1–3 on the left, the town picture in the middle, results and step 5 on the right. Scroll with the mouse over the column you mean, or click a step at the top.
- Video backup: if the live demo fails, play `pitch/demo-video-en.mp4` from the project folder (the Finnish one is in `pitch/finnish/`). The slides are in the pitch deck link in `pitch/README.md`.
- Roles: one person talks, one person clicks, one person leads Q&A.

## The 3-minute demo

| Time | Screen | What to do | What to say |
|---|---|---|---|
| 0:00–0:20 | Home (#koti) | Nothing yet. | The 30-second pitch, shortened: the numbers, the questions, "tieto on hajallaan". |
| 0:20–0:45 | Home | Type **Hamina** in "Etsi oma kuntasi", then **Tampere**. Point at the town card: benefits and burdens side by side. | "Sama 50 MW:n datakeskus. Haminassa hukkalämpö kattaisi suuren osan kaukolämmöstä, Tampereella pienen osan. Sama datakeskus, eri kunta, eri tarina." |
| 0:45–1:05 | Simulator, steps 1–2 | Click **Aloita: Tampere**. In the left column click **Suuri 150 MW**, choose **Metsä** (forest) and drag the homes closer. The picture redraws. | "Suunnittelet itse: koko, jäähdytys, hukkalämpö, tontti ja etäisyys koteihin." |
| 1:05–1:25 | Step 3, guess | Guess the permanent jobs high (for example 300) and click **Lukitse arvaukset**. The answers appear when the data centre opens in the time-lapse (or click **Näytä silti** above the results). | "Arvaa ensin. Useimmat arvaavat työpaikkoja paljon enemmän kuin niitä oikeasti on. Peliä ei pisteytetä: ei ole oikeaa mielipidettä, vain tietoa." |
| 1:25–2:05 | Step 4, presentation mode | Press **F**, then play. Let it run: zoning and YVA, construction trucks and crane, opening, heat to homes in winter, expansions, generator test, equipment refresh, the end-of-life decision. | Narrate the phases briefly. Point at the running totals beside the picture: they start only when the data centre opens, and are put in the town's own scale (share of the town's home heating, property tax per resident). "Tämä on laskelma, ei ennuste." |
| 2:05–2:25 | A result card, Miksi? | Press **Esc**. Open **Miksi?** on Water use. | "Jokaisen luvun takana: kaava, kertoimet ja lähteet. Neljä merkintää: toteutunut, arvio, laskettu, näkemys." |
| 2:25–2:45 | Real project | Open `#hanke-jarvenpaa-dc`. Show the project's own figures next to the typical range. Click **Kopioi linkki**. | "Desprolle: hanke ladataan sovellukseen ennen OAS- tai YVA-tilaisuutta. Linkki kutsuun, asukkaat tutkivat kotona." |
| 2:45–3:00 | Step 5, Oma näkemys | Mark two priorities, show the suggested questions, **Kopioi yhteenveto**. | "Ei pisteitä, ei tuomiota. Hyödyt ja haitat rinnakkain, lähteet näkyvissä. Asukas tulee tilaisuuteen omien kysymystensä kanssa." |

If time is short, skip the Miksi? step. Never skip the real-project step: it's the Despro use case.

## Q&A prep

**Isn't this just a prediction?**
No. It calculates what the chosen design would mean, using sourced coefficients with low, typical and high values. It runs each case 400 times and shows the likely range. It does not predict which projects get built or what electricity will cost.

**Where do the numbers come from?**
Municipal data from Statistics Finland, the Tax Administration and Finnish Energy (308 municipalities). Coefficients from Finnish environmental impact assessments such as Järvenpää, from Fingrid, research and company reports. Every number shows its source and date, and company claims are marked as the company's own.

**Is it for or against data centres?**
Neither. Benefits and burdens are side by side, "Sources disagree" shows both sides of each debate, and "Nobody knows" lists open questions. There is no score and no good/bad colouring.

**Why did you not calculate the effect on my electricity bill?**
One data centre's effect on the price can't be calculated reliably. The app shows the debate instead: AFRY's market model vs Finnish Energy's view.

**Water? I heard data centres use huge amounts.**
In Finland most are cooled with outdoor air and use little water. The Järvenpää EIA estimates 4,000–5,000 m³ a year for a 100–130 MW site. Evaporative cooling uses much more, and the simulator shows the difference.

**How many jobs does a data centre bring?**
Many during construction, few once it runs. The Järvenpää EIA estimates about 40 permanent jobs. The guess step is built around this surprise.

**What about Google's Muhos project and the police?**
Say only what the sources say: on 22 Oct 2026 the permit and supervision agency (LVV) asked the police to investigate Google's Muhos data-centre project; the agency has not said what the request concerns because the matter is confidential, and the police said no preliminary inquiry had started. A request is not a finding of a crime. Do not say it is about the logging.

**Google has not published the size of its Muhos site. Where does 500 MW come from?**
It is our example, and the app says so at the top of the results; the cards that depend on it are marked **Oletus**. One tap tries 10, 50, 150 or 500 MW with the project still loaded.

**How would Despro use it?**
Load a real project's parameters before a zoning (OAS) or environmental impact assessment (YVA) event. Put the link in the invitation so residents can explore at home and bring their questions. Later: an anonymous summary of residents' questions for the developer (this needs a server and a privacy process).

**How do you keep it up to date?**
The municipal data is re-fetched with one script. Each fact and policy item has a date and a "status checked" stamp. Coefficients are one line each in one file.

**What did you build yourselves?**
Be open about the tools you used, including AI coding assistants, and explain what you decided: the idea, the principles (ranges, labels, no score), the design and the checks.

**What would you do next?**
Swedish and plain-language (selkokieli) versions, a review of the numbers by one industry reviewer and one critical reviewer, real project data from Despro, and the anonymous question summary.

## Questions to ask the Despro mentors

- What does your Community Engagement service include in practice?
- At which project stage do you meet residents, and what do they ask most?
- Would you load real project figures into a tool like this before a public event?
