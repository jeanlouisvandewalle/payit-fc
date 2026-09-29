# PAYIT FC — website

Clubwebsite van PAYIT FC, minivoetbal uit Izegem. Gewone HTML/CSS/JavaScript: geen installatie of build nodig, en gratis te hosten op GitHub Pages.

## Pagina's

| Pagina | Bestand |
|---|---|
| Home (stand, volgende match met aftelklok, topschutters, verslagen, selectie, sponsors) | `index.html` |
| Wedstrijden (kalender, klassement van de volledige competitie, uitslagen met doelpuntenmakers) | `wedstrijden.html` |
| Ploeg (selectie met foto's, topschutters-podium, Payit Player of the Match) | `ploeg.html` |
| Blog (matchverslagen) | `blog.html` + `artikel.html?id=…` |
| Sponsors | `sponsors.html` |
| Over ons | `over-ons.html` |

## Inhoud aanpassen

**Alles staat in één bestand: [`js/data.js`](js/data.js).** De rest past zich automatisch aan.

### Na een match
1. Zoek de wedstrijd in `wedstrijden` en voeg toe:
   ```js
   speeldag: 4,
   score: [8, 3],                       // [thuisploeg, uitploeg]
   doelpunten: { "Arthur De Fauw": 3, "Louis Azou": 2, ... },
   motm: "Arthur De Fauw",              // Payit Player of the Match
   quote: "Eén zin die de match samenvat.",
   verslag: "speeldag-4-fc-de-ondank"   // id van de blogpost (optioneel)
   ```
2. Schrijf eventueel een verslag (zie hieronder).

Het klassement moet je **niet** meer overtypen: dat komt automatisch van MVBI (zie verder).
Statistieken, topschutters, Player of the Match-telling, vorm (W/G/V) en de "volgende match" worden automatisch berekend.

### Een verslag schrijven
Voeg bovenaan in `blog` een nieuw item toe:
```js
{
  id: "speeldag-4-fc-de-ondank",       // uniek, geen spaties
  titel: "Titel van het verslag",
  datum: "2026-10-09",
  auteur: "Naam",
  categorie: "Matchverslag",            // of "Nieuws", "Clubleven", ...
  wedstrijd: 4,                         // koppelt de uitslag aan het verslag
  afbeelding: "images/verslagen/speeldag-4.jpg",  // optioneel
  intro: "Korte samenvatting voor de overzichtspagina.",
  inhoud: `
    <p>Eerste alinea.</p>
    <p>Tweede alinea.</p>
  `
}
```

### Spelers
Per speler kan je optioneel `nummer`, `positie` en `bijnaam` toevoegen:
```js
{ naam: "Louis Azou", foto: "images/spelers/louis-azou.webp", nummer: 10, positie: "Aanvaller" }
```
- **Nieuwe speler:** foto (vierkant, bv. 1000×1000) in `images/spelers/` zetten en een regel toevoegen.
- **Speler weg:** de regel verwijderen. Zijn goals in oude matchen blijven gewoon in de uitslagen staan.
- Zonder foto verschijnen de initialen.

### Sponsors
Logo in `images/` zetten (liefst 600×300 px) en een item toevoegen in `sponsors`. `hoofd: true` = main partner (groot uitgelicht).

## Klassement (automatisch)

Het klassement wordt opgehaald van [mvbi.be/klassement](https://www.mvbi.be/klassement) en bewaard in `js/klassement.js`. MVBI verdeelt de ploegen over "Reeks 1" en "Reeks 2"; het script voegt die samen tot één klassement "Competitie" (gesorteerd op punten, bij gelijke punten in de volgorde van MVBI).

- **Eens de site op GitHub staat:** GitHub Actions werkt het klassement elke dag automatisch bij (twee keer per dag, 's ochtends en 's avonds). Meteen bijwerken kan via het tabblad **Actions → Klassement bijwerken → Run workflow**.
- **Op je eigen computer:** `node scripts/update-klassement.mjs`

## Hoe pas ik later iets aan?

**Optie 1 — rechtstreeks op github.com (makkelijkst, geen installatie nodig)**
1. Open de repository op github.com en klik op `js/data.js`.
2. Klik op het potloodje (✏️ *Edit this file*) en pas aan wat je wil.
3. Klik op **Commit changes**. Binnen een minuut staat de wijziging online.
4. Foto toevoegen: open de map `images/spelers`, klik **Add file → Upload files** en sleep de foto erin.

**Optie 2 — op je computer met GitHub Desktop**
1. Pas de bestanden aan in deze map (bv. `js/data.js` in Kladblok of VS Code).
2. Bekijk het resultaat lokaal (zie hieronder).
3. In GitHub Desktop: korte beschrijving invullen → **Commit to main** → **Push origin**.

**Optie 3 — laat Claude het doen**
Open Claude Code in deze map en zeg bv. *"Speeldag 4: 8–3 winst tegen FC de Ondank, goals Arthur 3, Louis 2, … Player of the Match Arthur. Schrijf ook een verslag."*

> Tip: let bij het bewerken van `data.js` op de komma's en aanhalingstekens. Is de site na een wijziging plots leeg, dan zit er meestal een komma te veel of te weinig.

## Lokaal bekijken

Dubbelklik `index.html`, of voor een lokale server:
```bash
python -m http.server 8080
```
en surf naar http://localhost:8080.

## Online zetten met GitHub Pages

1. Maak op github.com een nieuwe repository (bv. `payit-fc`).
2. Push deze map naar die repository.
3. Ga op GitHub naar **Settings → Pages**, kies **Deploy from a branch**, branch `main`, map `/ (root)`, en klik **Save**.
4. Na een minuutje staat de site online. De site draait op het eigen domein **https://payitfc.be** (DNS bij Combell, bestand `CNAME` in deze map — niet verwijderen).

Een eigen domeinnaam (bv. `payitfc.be`) kan je later koppelen via hetzelfde Pages-scherm.

Elke wijziging die je pusht (ook rechtstreeks via de website van GitHub, met het potloodje bij `js/data.js`) staat binnen een minuut online.
