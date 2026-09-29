/* ==========================================================================
   PAYIT FC — ALLE INHOUD VAN DE WEBSITE
   --------------------------------------------------------------------------
   Dit is het enige bestand dat je moet aanpassen om de site bij te werken.
   Topschutters, Payit Player of the Match-telling, statistieken en "volgende match"
   worden automatisch berekend op basis van de wedstrijden hieronder.

   Tips:
   - Datums altijd als "JJJJ-MM-DD" (bv. "2026-10-08").
   - Een wedstrijd zonder "score" is een komende wedstrijd.
   - Namen in "doelpunten" en "motm" (= Payit Player of the Match) moeten exact overeenkomen met de spelerslijst.
   ========================================================================== */

window.PAYIT = {
  club: {
    naam: "PAYIT FC",
    gemeente: "Izegem",
    afkorting: "IZG",
    opgericht: 2026,
    seizoen: "2026/27",
    reeks: "Reeks 1",
    slogan: ["Voetbal op ons niveau.", "Ambitie op wereldniveau."],
    tagline: "Talent wisselvallig. Sfeer gegarandeerd.",
    instagram: "https://www.instagram.com/payit.football/",
    instagramHandle: "@payit.football",
    mvbi: "https://www.mvbi.be",
    email: "" // optioneel: bv. "info@payitfc.be"
  },

  /* ------------------------------------------------------------------ SPELERS
     Foto's staan in images/spelers/ (vierkant, bv. 1000×1000).
     Optioneel per speler: nummer, positie, bijnaam. Leeg laten mag gerust. */
  spelers: [
    { naam: "Louis Azou",             foto: "images/spelers/louis-azou.webp" },
    { naam: "Jonas Boucquet",         foto: "images/spelers/jonas-boucquet.webp" },
    { naam: "Artuur Callebert",       foto: "images/spelers/artuur-callebert.webp" },
    { naam: "Arthur De Fauw",         foto: "images/spelers/arthur-de-fauw.webp" },
    { naam: "Achiel Denijs",          foto: "images/spelers/achiel-denijs.webp" },
    { naam: "Milan Deryckere",        foto: "images/spelers/milan-deryckere.webp" },
    { naam: "Jelle Descheemaecker",   foto: "images/spelers/jelle-descheemaecker.webp" },
    { naam: "Pierre Dubuisson",       foto: "images/spelers/pierre-dubuisson.webp" },
    { naam: "Ilias Godefroo",         foto: "images/spelers/ilias-godefroo.webp" },
    { naam: "Niel Lammertyn",         foto: "images/spelers/niel-lammertyn.webp" },
    { naam: "Mathias Vancompernolle", foto: "images/spelers/mathias-vancompernolle.webp" },
    { naam: "Jean-Louis Vandewalle",  foto: "images/spelers/jean-louis-vandewalle.webp" },
    { naam: "Rafael Verhamme",        foto: "images/spelers/rafael-verhamme.webp" }
  ],

  /* --------------------------------------------------------------- WEDSTRIJDEN
     Gespeeld: vul "score" in als [thuisgoals, uitgoals].
     "verslag" verwijst naar de id van een blogpost hieronder. */
  wedstrijden: [
    {
      speeldag: 1, datum: "2026-09-14", uur: "20:55", locatie: "Izegem",
      thuis: "Q-Team", uit: "PAYIT FC", score: [1, 16],
      doelpunten: {
        "Arthur De Fauw": 5, "Jelle Descheemaecker": 4, "Jonas Boucquet": 2,
        "Achiel Denijs": 1, "Jean-Louis Vandewalle": 1, "Niel Lammertyn": 1,
        "Rafael Verhamme": 1, "Milan Deryckere": 1
      },
      motm: "Arthur De Fauw",
      quote: "De competitie openen met zestien goals. Bescheiden blijven doen we morgen wel.",
      verslag: "speeldag-1-q-team"
    },
    {
      speeldag: 2, datum: "2026-09-21", uur: "20:55", locatie: "Izegem",
      thuis: "PAYIT FC", uit: "Driemo", score: [7, 4],
      doelpunten: {
        "Louis Azou": 3, "Jelle Descheemaecker": 2,
        "Jean-Louis Vandewalle": 1, "Rafael Verhamme": 1
      },
      motm: "Louis Azou",
      quote: "Speeldag 2: opnieuw gewonnen. Tactisch niet perfect. Resultaat wel.",
      verslag: "speeldag-2-driemo"
    },
    {
      speeldag: 3, datum: "2026-09-28", uur: "20:30", locatie: "Izegem",
      thuis: "PAYIT FC", uit: "De Kasjotters", score: [16, 0],
      doelpunten: {
        "Rafael Verhamme": 4, "Arthur De Fauw": 4, "Louis Azou": 2,
        "Ilias Godefroo": 2, "Jonas Boucquet": 2, "Pierre Dubuisson": 1,
        "Milan Deryckere": 1
      },
      motm: "Rafael Verhamme",
      quote: "Zestien gemaakt, niets weggegeven. Meer analyse zou alleen maar risico's opleveren.",
      verslag: "speeldag-3-kasjotters"
    },

    // ---- Komende wedstrijden ----
    { datum: "2026-10-08", uur: "18:00", locatie: "Izegem",  thuis: "PAYIT FC", uit: "FC de Ondank", link: "https://www.mvbi.be/payit-fc-fc-de-ondank" },
    { datum: "2026-10-14", uur: "21:00", locatie: "Kachtem", thuis: "Checked by Vanhulle", uit: "PAYIT FC" },
    { datum: "2026-10-22", uur: "19:00", locatie: "Zie MVBI", thuis: "PAYIT FC", uit: "T'Schroefke" },
    { datum: "2026-10-26", uur: "19:30", locatie: "Izegem",  thuis: "Panna FC", uit: "PAYIT FC" },
    { datum: "2026-11-09", uur: "19:30", locatie: "Izegem",  thuis: "PAYIT FC", uit: "L'Abattoir" },
    { datum: "2026-11-18", uur: "19:00", locatie: "Kachtem", thuis: "Lagaar Gworks", uit: "PAYIT FC" },
    { datum: "2026-11-25", uur: "19:00", locatie: "Kachtem", thuis: "Bloemgat", uit: "PAYIT FC" },
    { datum: "2026-12-07", uur: "19:30", locatie: "Izegem",  thuis: "Playa", uit: "PAYIT FC" },
    { datum: "2026-12-14", uur: "20:30", locatie: "Izegem",  thuis: "PAYIT FC", uit: "Sanifro ofzo" }
  ],

  /* ---------------------------------------------------------------- RANGSCHIKKING
     Het klassement van alle reeksen komt automatisch van mvbi.be
     (zie js/klassement.js en scripts/update-klassement.mjs). Niets aan te passen. */

  /* ------------------------------------------------------------------ SPONSORS
     De eerste sponsor met hoofd: true wordt als main partner uitgelicht. */
  sponsors: [
    {
      naam: "Payit", hoofd: true,
      logo: "images/sponsor-payit-refined.png",
      url: "https://www.payit.be/nl",
      tekst: "Maakt inschrijvingen, ticketing en online betalingen voor organisaties een pak eenvoudiger. Onze naamgever en trouwe supporter."
    },
    {
      naam: "Rhodesgoed",
      logo: "images/sponsor-rhodesgoed-refined.png",
      url: "https://www.rhodesgoed.be/home/",
      tekst: "Een gastvrije brasserie in Kachtem met dagverse gerechten, tearoom en veel sfeer."
    },
    {
      naam: "Peracles",
      logo: "images/sponsor-peracles-refined.png",
      url: "http://www.peracles.be/",
      tekst: "Advies en begeleiding rond vermogensplanning, met een persoonlijke aanpak."
    },
    {
      naam: "Rethink Your Talents",
      logo: "images/sponsor-rethink-refined.png",
      url: "https://www.rethinkyourtalents.be/",
      tekst: "Coaching voor loopbaan, persoonlijke ontwikkeling en sterkere teams."
    },
    {
      naam: "SB Flavours",
      logo: "images/sponsor-sbflavours-refined.png",
      url: "https://www.sb-flavours.com/",
      tekst: "Natuurlijke smaakmakers van Sandra Bekkari: kruiden, olijfolie, granola en meer."
    }
  ],

  /* ---------------------------------------------------------------------- BLOG
     Matchverslagen en ander nieuws. Nieuwste bovenaan zetten is niet nodig:
     de site sorteert zelf op datum.
     "inhoud" is gewone HTML: gebruik <p>…</p> voor alinea's. */
  blog: [
    {
      id: "speeldag-3-kasjotters",
      titel: "Zestien keer raak, nul keer gevist",
      datum: "2026-09-29",
      auteur: "De redactie",
      categorie: "Matchverslag",
      wedstrijd: 3,
      // afbeelding: "images/verslagen/speeldag-3.jpg",   // optioneel: omslagfoto
      intro: "Tegen De Kasjotters bleef het net aan onze kant de hele avond ongemoeid. Aan de overkant iets minder: 16–0.",
      inhoud: `
        <p>Speeldag 3, thuis in Izegem, aftrap om half negen. De Kasjotters kwamen op bezoek en gingen naar huis met een 16–0 in de valies. Zestien gemaakt, niets weggegeven. Meer analyse zou alleen maar risico's opleveren — maar we doen het toch even.</p>

        <h3>Twee man op vier</h3>
        <p>Rafael Verhamme en Arthur De Fauw hadden duidelijk afgesproken om de buit eerlijk te verdelen: vier doelpunten elk. Voor Arthur betekent dat een totaal van negen na drie speeldagen, goed voor de alleenheerschappij in de goal race. Rafael klimt met zijn vier treffers naar zes en deelt zo de tweede plaats met Jelle Descheemaecker.</p>
        <p>Achter het duo was het aanschuiven. Louis Azou, Ilias Godefroo en Jonas Boucquet scoorden er elk twee, Pierre Dubuisson en Milan Deryckere tekenden elk voor één doelpunt. Zeven verschillende doelpuntenmakers op één avond: zo verdeel je de werkdruk.</p>

        <h3>De nul</h3>
        <p>Minstens even mooi als de zestien aan de ene kant, is de nul aan de andere. Na vier tegengoals tegen Driemo werd er achterin duidelijk huiswerk gemaakt. De eerste clean sheet uit de clubgeschiedenis is binnen, en daar mag de hele ploeg — ook wie niet scoorde — trots op zijn.</p>

        <h3>Payit Player of the Match</h3>
        <p>De trofee van de avond gaat naar <strong>Rafael Verhamme</strong>. Vier goals, veel loopwerk en voor één avond officieel de beste van de ploeg. Dat zullen we in de kleedkamer nog geweten hebben.</p>

        <h3>En nu?</h3>
        <p>Drie op drie, 39 goals voor en 5 tegen. In het klassement van Reeks 1 staan we tweede, en nog altijd ongeslagen. Een prima begin; de champagne blijft voorlopig gewoon in de frigo. Volgende opdracht: FC de Ondank, op donderdag 8 oktober om 18 uur in Izegem.</p>
      `
    },
    {
      id: "speeldag-2-driemo",
      titel: "Tactisch niet perfect. Resultaat wel.",
      datum: "2026-09-22",
      auteur: "De redactie",
      categorie: "Matchverslag",
      wedstrijd: 2,
      intro: "Tegen Driemo moesten we er een pak meer voor doen dan op speeldag 1. De drie punten bleven wel in Izegem: 7–4.",
      inhoud: `
        <p>Wie na de 1–16 van de openingsspeeldag dacht dat elke match een wandeling zou worden, kreeg van Driemo een vriendelijke maar duidelijke les in nederigheid. Een echte wedstrijd, met tegenstand, tegengoals en af en toe een collectieve zucht op de bank.</p>

        <h3>Louis Azou neemt over</h3>
        <p>Op de momenten dat het moest, stond Louis Azou op. Drie keer vond hij het net, en daarmee zette hij de ploeg telkens weer op het goede spoor. Een hattrick op je tweede officiële speeldag: niet slecht.</p>
        <p>Jelle Descheemaecker bleef in vorm en scoorde er opnieuw twee, na zijn vier van de openingsmatch. Jean-Louis Vandewalle en Rafael Verhamme maakten elk ook hun doelpunt, goed voor een eindstand van 7–4.</p>

        <h3>Werkpunten</h3>
        <p>Vier tegengoals is genoeg om de verdediging even wakker te schudden, maar niet genoeg om de punten weg te geven. Tactisch was het niet perfect — we zeggen het zelf, dan hoeft niemand anders het te doen. Het resultaat was er wel, en na twee speeldagen blijft het maximum van de punten staan.</p>

        <h3>Payit Player of the Match</h3>
        <p><strong>Louis Azou</strong>. Drie goals, één trofee, geen discussie.</p>
      `
    },
    {
      id: "speeldag-1-q-team",
      titel: "Een seizoensopener om in te kaderen",
      datum: "2026-09-15",
      auteur: "De redactie",
      categorie: "Matchverslag",
      wedstrijd: 1,
      intro: "De allereerste officiële match van PAYIT FC, en meteen zestien goals. Bescheiden blijven doen we morgen wel.",
      inhoud: `
        <p>Maandag 14 september 2026 staat voortaan in de clubannalen: de eerste officiële wedstrijd van PAYIT FC. Nieuwe ploeg, nieuw seizoen, een tikje zenuwen. Die zenuwen bleken achteraf ongegrond: Q-Team werd met 1–16 opzij gezet.</p>

        <h3>Een historische eerste avond</h3>
        <p>Arthur De Fauw opende zijn seizoen alsof hij het al maanden had ingestudeerd: vijf doelpunten. Jelle Descheemaecker stond niet ver achter met vier goals, en Jonas Boucquet deed er nog twee bij.</p>
        <p>Daarnaast mochten nog vijf spelers hun eerste officiële doelpunt voor de club vieren: Achiel Denijs, Jean-Louis Vandewalle, Niel Lammertyn, Rafael Verhamme en Milan Deryckere scoorden er elk één. Acht verschillende doelpuntenmakers in de allereerste match — beter kan je een ploeggevoel niet samenvatten.</p>

        <h3>Die ene tegengoal</h3>
        <p>Q-Team scoorde één keer. We vermelden het hier volledigheidshalve, en omdat het goed is om met beide voeten op de grond te blijven. Eén keer.</p>

        <h3>Payit Player of the Match</h3>
        <p>De allereerste trofee uit de clubgeschiedenis gaat naar <strong>Arthur De Fauw</strong>. Vijf goals in de seizoensopener: daar is weinig discussie over mogelijk.</p>
      `
    }
  ],

  /* ------------------------------------------------------------------ OVER ONS */
  overOns: {
    titel: "Geen ingewikkeld project. Geen vijfjarenplan.",
    tekst: [
      "PAYIT FC werd opgericht in 2026 in Izegem.",
      "Gewoon een groep vrienden, een voetbal en voldoende goesting om er iets leuks van te maken.",
      "We zijn competitief tijdens de match en ontspannen zodra het laatste fluitsignaal klinkt. De resultaten zien we wel. De sfeer staat alvast goed."
    ],
    feiten: [
      { titel: "Est. 2026", tekst: "Een jonge club met grote goesting." },
      { titel: "Izegem", tekst: "Hier spelen we. Hier horen we thuis." },
      { titel: "Minivoetbal", tekst: "Vrienden eerst. Ploeggenoten altijd." }
    ]
  }
};
