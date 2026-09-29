// Haalt het klassement op van mvbi.be (alle ploegen samen, één competitie) en schrijft js/klassement.js.
// Gebruik: node scripts/update-klassement.mjs   (Node 18 of nieuwer)
// Draait ook automatisch via GitHub Actions (.github/workflows/klassement.yml).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BRON = "https://www.mvbi.be/klassement";
const OUT = fileURLToPath(new URL("../js/klassement.js", import.meta.url));

const html = await (await fetch(BRON, { headers: { "User-Agent": "PAYIT FC website (klassement-updater)" } })).text();

const decode = (s) => s
  .replace(/<[^>]+>/g, "")
  .replace(/&#0*39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ").trim();

// MVBI verdeelt de ploegen over "Reeks 1" en "Reeks 2", maar er is maar één competitie.
// We voegen alles samen tot één klassement. Staat een ploeg in meerdere reeksen,
// dan tellen we haar cijfers op.
const perPloeg = new Map();
const sleutel = (naam) => naam.toLowerCase().replace(/[^a-z0-9]/g, "");
for (const group of html.split('class="klassement-league-group"').slice(1)) {
  for (const row of group.split('club_teaser row"').slice(1)) {
    const cols = [...row.matchAll(/<span class="col[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]));
    if (cols.length < 9) continue;
    const [, ploeg, , w, g, v, dv, dt, ptn] = cols;
    const n = (x) => parseInt(x, 10) || 0;
    // MVBI toont bij "gespeeld" soms een foute waarde; we rekenen zelf W + G + V.
    const rij = [ploeg, n(w) + n(g) + n(v), n(w), n(g), n(v), n(dv), n(dt), n(ptn)];
    const k = sleutel(ploeg);
    const oud = perPloeg.get(k);
    perPloeg.set(k, oud ? oud.map((x, i) => (i === 0 ? x : x + rij[i])) : rij);
  }
}

if (!perPloeg.size) {
  console.error("Geen klassement gevonden — is de MVBI-site veranderd?");
  process.exit(1);
}

// Sorteren op punten. Bij gelijke punten blijft de officiële volgorde van MVBI behouden
// (sort() is stabiel), zodat we hun beslissingscriteria niet zelf moeten raden.
const rijen = [...perPloeg.values()].sort((a, b) => b[7] - a[7]);
const reeksen = [{ naam: "Competitie", rijen }];

const data = { bron: BRON, bijgewerkt: new Date().toISOString().slice(0, 10), reeksen };
writeFileSync(OUT,
  "/* Automatisch gegenereerd door scripts/update-klassement.mjs — niet met de hand aanpassen. */\n" +
  `window.PAYIT_KLASSEMENT = ${JSON.stringify(data, null, 2).replace(/\[\s+("[^"]*"(?:,\s+\d+)+)\s+\]/g, (m, c) => "[" + c.replace(/,\s+/g, ", ") + "]")};\n`);
console.log(`Klassement bijgewerkt: ${reeksen.map((r) => `${r.naam} (${r.rijen.length} ploegen)`).join(", ")}`);
