// Controleert de kalender van PAYIT FC op mvbi.be en houdt website én selectiedashboard gelijk.
// Gebruik: node scripts/update-kalender.mjs   (Node 18 of nieuwer)
// Draait automatisch via GitHub Actions (.github/workflows/kalender.yml), een paar keer per dag.
//
// Wat het doet:
// 1. Leest alle matchen van PAYIT FC op https://www.mvbi.be/payitfc (datum, uur, plaats).
// 2. Past datum, uur en plaats aan in js/data.js en voegt nieuwe matchen toe (namen, scores,
//    verslagen enz. blijven onaangeroerd).
// 3. Zet dezelfde kalender in de database van het selectiedashboard (secret SYNC_SECRET).
// 4. Mailt bij een wijziging aan een komende match, en de dag voor elke match een herinnering
//    (secrets RESEND_API_KEY en MAIL_TO).
process.env.TZ = "Europe/Brussels";

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA = ROOT + "js/data.js";
const BRON = "https://www.mvbi.be/payitfc";
const DASHBOARD = "https://payitfc.be/selectie.html";
const { SYNC_SECRET, RESEND_API_KEY, MAIL_TO } = process.env;

const laad = (src, naam) => { const ctx = vm.createContext({ window: {} }); vm.runInContext(src, ctx); return ctx.window[naam]; };
const sleutel = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const decode = (s) => s.replace(/<[^>]+>/g, "")
  .replace(/&#0*39;|&apos;|’/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const kort = (w) => w.uitgesteld || !w.datum ? "uitgesteld, nieuwe datum nog niet bekend"
  : `${DAGEN[new Date(w.datum + "T12:00").getDay()]} ${w.datum.slice(8)}/${w.datum.slice(5, 7)} om ${w.uur} in ${w.locatie}`;
const waarschuw = (msg) => console.log(`::warning::${msg}`);

/* ---------- 1. MVBI ---------- */
const html = await (await fetch(BRON, { headers: { "User-Agent": "PAYIT FC website (kalender-check)" } })).text();
const src0 = readFileSync(DATA, "utf8");
const D = laad(src0, "PAYIT");
const CLUB = D.club.naam;
const wijZijn = (naam) => sleutel(naam) === sleutel(CLUB);

const mvbi = [];
for (const rij of html.split("wedstrijd_teaser").slice(1)) {
  const veld = (re) => { const m = rij.match(re); return m ? decode(m[1]) : ""; };
  const ts = +veld(/data-timestamp="(\d+)"/);
  const thuis = veld(/Thuisploeg-naam">([\s\S]*?)<\/div>/), uit = veld(/Bezoekers-naam">([\s\S]*?)<\/div>/);
  if (!ts || !(wijZijn(thuis) || wijZijn(uit))) continue;
  const d = new Date(ts * 1000), twee = (n) => String(n).padStart(2, "0");
  mvbi.push({
    datum: `${d.getFullYear()}-${twee(d.getMonth() + 1)}-${twee(d.getDate())}`,
    uur: `${twee(d.getHours())}:${twee(d.getMinutes())}`,
    // MVBI zet een K voor het uur als er in Kachtem gespeeld wordt; zonder K is het Izegem
    locatie: /^\s*K/i.test(veld(/class="Uur">([\s\S]*?)<\/div>/)) ? "Kachtem" : "Izegem",
    thuis: wijZijn(thuis) ? CLUB : thuis,
    uit: wijZijn(uit) ? CLUB : uit,
    link: "https://www.mvbi.be" + veld(/href="(\/[^"]+)" hreflang/)
  });
}
if (mvbi.length < 5) {
  console.error(`Maar ${mvbi.length} matchen gevonden op ${BRON}. Is de MVBI-site veranderd?`);
  process.exit(1);
}

/* ---------- 2. koppelen aan js/data.js ---------- */
const tegenstander = (w) => wijZijn(w.thuis) ? w.uit : w.thuis;
const lijkt = (a, b) => { const x = sleutel(a), y = sleutel(b); return x === y || x.includes(y) || y.includes(x); };
const pad = (u) => (u || "").replace(/^https?:\/\/(www\.)?mvbi\.be/, "");
const ons = D.wedstrijden.filter((w) => wijZijn(w.thuis) || wijZijn(w.uit));
const gebruikt = new Set();
const paren = mvbi.map((r) => {
  let w = ons.find((x) => !gebruikt.has(x) && x.link && pad(x.link) === pad(r.link));
  if (!w) {
    // zelfde tegenstander, liefst met dezelfde thuisploeg (data.js wijkt daar soms af van MVBI), dichtstbijzijnde datum
    const kand = ons.filter((x) => !gebruikt.has(x) && !(x.link && pad(x.link) !== pad(r.link)) && lijkt(tegenstander(x), tegenstander(r)));
    const afstand = (x) => (wijZijn(x.thuis) === wijZijn(r.thuis) ? 0 : 1e13) + Math.abs(new Date(x.datum) - new Date(r.datum));
    w = kand.sort((a, b) => afstand(a) - afstand(b))[0];
  }
  if (w) gebruikt.add(w);
  return { r, w };
});

// tekstuele aanpassingen, zodat opmaak en commentaar in data.js behouden blijven
let src = src0;
function objectBereik(w) {
  const tekst = `thuis: ${JSON.stringify(w.thuis)}, uit: ${JSON.stringify(w.uit)}`;
  const n = D.wedstrijden.filter((x, i) => i < D.wedstrijden.indexOf(w) && x.thuis === w.thuis && x.uit === w.uit).length;
  let pos = -1;
  for (let i = 0; i <= n; i++) { pos = src.indexOf(tekst, pos + 1); if (pos < 0) throw new Error(`Niet gevonden in data.js: ${tekst}`); }
  const start = src.lastIndexOf("{", pos);
  let diepte = 0, inStr = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "{") diepte++;
    else if (c === "}" && --diepte === 0) return [start, i + 1];
  }
  throw new Error(`Einde van object niet gevonden: ${tekst}`);
}
function pasAan(w, velden) {
  const [a, b] = objectBereik(w);
  let obj = src.slice(a, b);
  for (const [k, v] of Object.entries(velden)) {
    const re = new RegExp(`\\b${k}:\\s*"[^"]*"`);
    if (re.test(obj)) obj = obj.replace(re, `${k}: ${JSON.stringify(v)}`);
    else { const eind = obj.replace(/\s*\}$/, "").length; obj = obj.slice(0, eind) + `, ${k}: ${JSON.stringify(v)}` + obj.slice(eind); }
  }
  obj = obj.replace(/,\s*uitgesteld:\s*true/, "");
  src = src.slice(0, a) + obj + src.slice(b);
}
function voegToe(r) {
  const start = src.indexOf("wedstrijden: [");
  let diepte = 0, inStr = false, eind = -1;
  for (let i = start + "wedstrijden: ".length; i < src.length; i++) {
    const c = src[i];
    if (inStr) { if (c === "\\") i++; else if (c === '"' || c === "`") inStr = false; continue; }
    if (c === '"' || c === "`") inStr = true;
    else if (c === "[") diepte++;
    else if (c === "]" && --diepte === 0) { eind = i; break; }
  }
  const laatste = src.slice(0, eind).replace(/\s+$/, "");
  const regel = `{ datum: "${r.datum}", uur: "${r.uur}", locatie: ${JSON.stringify(r.locatie)}, thuis: ${JSON.stringify(r.thuis)}, uit: ${JSON.stringify(r.uit)}, link: "${r.link}" }`;
  src = laatste + (laatste.endsWith(",") ? "" : ",") + "\n    " + regel + "\n  " + src.slice(eind);
}

const meldingen = [];   // voor de mail: alleen wat komende matchen raakt
const titel = (w) => `${w.thuis} – ${w.uit}`;
for (const { r, w } of paren) {
  if (!w) {
    if (new Date(r.datum) < new Date()) { waarschuw(`Gespeelde match niet gevonden in data.js: ${titel(r)} (${r.datum}).`); continue; }
    voegToe(r); meldingen.push(`Nieuwe match: ${titel(r)}, ${kort(r)}.`); continue;
  }
  const nieuw = { datum: r.datum, uur: r.uur, locatie: r.locatie };
  const anders = w.datum !== r.datum || w.uur !== r.uur || w.locatie !== r.locatie || !!w.uitgesteld;
  if (!anders && w.link === r.link) continue;
  pasAan(w, w.link === r.link ? nieuw : { ...nieuw, link: r.link });
  if (anders && !Array.isArray(w.score)) meldingen.push(`${titel(w)}: was ${kort(w)}, nu ${kort(r)}.`);
}
for (const w of ons) {
  if (!gebruikt.has(w) && !Array.isArray(w.score) && !w.uitgesteld && new Date(w.datum) > new Date()) {
    meldingen.push(`${titel(w)} (${kort(w)}) staat niet meer op MVBI. Controleer of die match nog doorgaat.`);
  }
}

if (src !== src0) {
  // veiligheidscontrole: het aangepaste bestand moet geldig zijn en exact de MVBI-gegevens bevatten
  const N = laad(src, "PAYIT");
  for (const { r } of paren.filter((x) => x.w || new Date(x.r.datum) >= new Date())) {
    const w = N.wedstrijden.find((x) => pad(x.link) === pad(r.link));
    if (!w || w.datum !== r.datum || w.uur !== r.uur || w.locatie !== r.locatie || w.uitgesteld) {
      console.error(`Controle mislukt voor ${titel(r)}; data.js niet aangepast.`);
      process.exit(1);
    }
  }
  writeFileSync(DATA, src);
  console.log("js/data.js bijgewerkt.");
} else {
  console.log("Kalender klopt met MVBI.");
}
meldingen.forEach((m) => console.log("- " + m));

/* ---------- 3. selectiedashboard ---------- */
const NU = laad(src, "PAYIT");
const CFG = laad(readFileSync(ROOT + "js/selectie-config.js", "utf8"), "PAYIT_SELECTIE");
async function cron(args) {
  const r = await fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/sel_cron", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: "Bearer " + CFG.key },
    body: JSON.stringify({ p_secret: SYNC_SECRET, ...args })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.message) || `HTTP ${r.status}`);
  return j;
}
let db = null;
if (!SYNC_SECRET) waarschuw("SYNC_SECRET ontbreekt: dashboard niet bijgewerkt.");
else {
  try {
    db = await cron({
      p_matches: NU.wedstrijden.filter((w) => wijZijn(w.thuis) || wijZijn(w.uit)).map((w) => {
        const weg = !!w.uitgesteld || !w.datum || !w.uur;
        return { key: `${w.thuis}|${w.uit}`, home: w.thuis, away: w.uit, place: w.locatie || null, date: weg ? null : w.datum, time: weg ? null : w.uur };
      })
    });
    console.log("Selectiedashboard bijgewerkt.");
  } catch (e) { waarschuw(`Dashboard bijwerken mislukt: ${e.message}`); }
}

/* ---------- 4. mails ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function mail(onderwerp, regels) {
  if (!RESEND_API_KEY || !MAIL_TO) { waarschuw(`Geen mail verstuurd (RESEND_API_KEY of MAIL_TO ontbreekt): ${onderwerp}`); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: "PAYIT FC <onboarding@resend.dev>", to: [MAIL_TO], subject: onderwerp,
      text: regels.join("\n\n"),
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#061522">${regels.map((l) => `<p>${esc(l)}</p>`).join("")}</div>`
    })
  });
  if (!r.ok) { waarschuw(`Mail mislukt (${r.status}): ${await r.text()}`); return false; }
  console.log(`Mail verstuurd: ${onderwerp}`);
  return true;
}

if (meldingen.length) {
  await mail("PAYIT FC: kalender gewijzigd op MVBI", [
    "De kalender op MVBI is aangepast. Website en selectiedashboard zijn al bijgewerkt.",
    ...meldingen,
    `Dashboard: ${DASHBOARD}`, `Officiële kalender: ${BRON}`
  ]);
}

// herinnering de dag voor de match (één keer per match: de database onthoudt wat al verstuurd is)
if (db) {
  const morgen = new Date(Date.now() + 864e5).toLocaleDateString("sv-SE");
  for (const m of db.matches || []) {
    if (!m.kickoff) continue;
    const k = new Date(m.kickoff);
    if (k.toLocaleDateString("sv-SE") !== morgen) continue;
    const id = `herinnering|${m.key}|${m.kickoff}`;
    if ((db.notices || []).includes(id)) continue;
    const uur = k.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
    const regels = [`Morgen speelt PAYIT FC: ${m.home} – ${m.away}, ${DAGEN[k.getDay()]} ${k.getDate()}/${k.getMonth() + 1} om ${uur} in ${m.place}.`];
    if (m.final) {
      regels.push(m.lineup.length ? `Selectie (${m.lineup.length}): ${m.lineup.join(", ")}.` : "Er is niemand geselecteerd.");
      if (m.lineup.length < 5) regels.push(`Let op: maar ${m.lineup.length} spelers, minimum is 5.`);
    } else regels.push(`De selectie is nog niet afgesloten (${m.yes} spelers kunnen).`);
    regels.push(`Dashboard: ${DASHBOARD}`);
    if (await mail(`PAYIT FC morgen: ${m.home} – ${m.away} om ${uur}`, regels)) {
      try { await cron({ p_notice: id }); } catch (e) { waarschuw(`Herinnering niet als verstuurd bewaard: ${e.message}`); }
    }
  }
}
