// Haalt het klassement van alle reeksen op van mvbi.be en schrijft js/klassement.js.
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

const reeksen = [];
for (const group of html.split('class="klassement-league-group"').slice(1)) {
  const naam = decode(group.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] || "");
  const rijen = [];
  for (const row of group.split('club_teaser row"').slice(1)) {
    const cols = [...row.matchAll(/<span class="col[^"]*"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => decode(m[1]));
    if (cols.length < 9) continue;
    const [, ploeg, , w, g, v, dv, dt, ptn] = cols;
    const n = (x) => parseInt(x, 10) || 0;
    // MVBI toont bij "gespeeld" soms een foute waarde; we rekenen zelf W + G + V.
    rijen.push([ploeg, n(w) + n(g) + n(v), n(w), n(g), n(v), n(dv), n(dt), n(ptn)]);
  }
  if (naam && rijen.length) reeksen.push({ naam, rijen });
}

if (!reeksen.length) {
  console.error("Geen klassement gevonden — is de MVBI-site veranderd?");
  process.exit(1);
}

const data = { bron: BRON, bijgewerkt: new Date().toISOString().slice(0, 10), reeksen };
writeFileSync(OUT,
  "/* Automatisch gegenereerd door scripts/update-klassement.mjs — niet met de hand aanpassen. */\n" +
  `window.PAYIT_KLASSEMENT = ${JSON.stringify(data, null, 2).replace(/\[\s+("[^"]*"(?:,\s+\d+)+)\s+\]/g, (m, c) => "[" + c.replace(/,\s+/g, ", ") + "]")};\n`);
console.log(`Klassement bijgewerkt: ${reeksen.map((r) => `${r.naam} (${r.rijen.length} ploegen)`).join(", ")}`);
