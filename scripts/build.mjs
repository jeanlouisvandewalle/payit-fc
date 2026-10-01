// Genereert de HTML van alle pagina's vooraf, zodat Google, Bing en link-previews de inhoud
// kunnen lezen zonder JavaScript. Maakt ook sitemap.xml aan.
// Gebruik: node scripts/build.mjs   (Node 18 of nieuwer)
// Draait automatisch via GitHub Actions (.github/workflows/build.yml) na elke wijziging.
//
// De HTML-bestanden in de hoofdmap (index.html, blog-….html, …) zijn dus het RESULTAAT van dit
// script: pas ze niet met de hand aan, maar wijzig js/data.js (inhoud) of dit bestand (opmaak).
process.env.TZ = "Europe/Brussels"; // aftrapuren in data.js zijn Belgische tijd

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE = "https://" + readFileSync(ROOT + "CNAME", "utf8").trim();
const OG_IMAGE = `${SITE}/images/og-payit-fc.jpg`;
const GEGENEREERD = "<!-- Automatisch gegenereerd door scripts/build.mjs — niet met de hand aanpassen. -->";

// dezelfde scripts als in de browser, in een afgeschermde omgeving
const ctx = vm.createContext({ window: {} });
for (const f of ["js/data.js", "js/klassement.js", "js/app.js"]) vm.runInContext(readFileSync(ROOT + f, "utf8"), ctx, { filename: f });
const D = ctx.window.PAYIT, K = ctx.window.PAYIT_KLASSEMENT, render = ctx.window.PAYIT_RENDER;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const jsonld = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;
const url = (bestand) => `${SITE}/${bestand === "index.html" ? "" : bestand}`;

/* ---------- structured data (schema.org) ---------- */
const team = {
  "@type": "SportsTeam",
  "@id": `${SITE}/#team`,
  name: D.club.naam,
  sport: "Minivoetbal",
  url: `${SITE}/`,
  logo: `${SITE}/images/crest-960.webp`,
  image: OG_IMAGE,
  description: `Recreatieve minivoetbalploeg uit ${D.club.gemeente}, opgericht in ${D.club.opgericht}.`,
  foundingDate: String(D.club.opgericht),
  slogan: D.club.slogan.join(" "),
  location: { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: D.club.gemeente, addressRegion: "West-Vlaanderen", addressCountry: "BE" } },
  sameAs: [D.club.instagram],
  ...(D.club.email ? { email: D.club.email } : {}),
  sponsor: D.sponsors.map((s) => ({ "@type": "Organization", name: s.naam, url: s.url })),
  athlete: D.spelers.map((p) => ({ "@type": "Person", name: p.naam }))
};
const kruimels = (...stappen) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: stappen.map(([name, bestand], i) => ({ "@type": "ListItem", position: i + 1, name, item: url(bestand) }))
});

/* ---------- pagina's ---------- */
const NAMEN = { wedstrijden: "Wedstrijden", ploeg: "Ploeg", blog: "Blog", sponsors: "Sponsors", "over-ons": "Over ons" };
const paginas = [
  { page: "home", bestand: "index.html", schema: [{ "@context": "https://schema.org", ...team }, { "@context": "https://schema.org", "@type": "WebSite", name: D.club.naam, url: `${SITE}/`, inLanguage: "nl-BE" }] },
  ...Object.entries(NAMEN).map(([page, naam]) => ({ page, bestand: `${page}.html`, schema: [kruimels(["Home", "index.html"], [naam, `${page}.html`])] })),
  ...D.blog.map((p) => ({
    page: "artikel", id: p.id, bestand: `blog-${p.id}.html`, ogType: "article", datum: p.datum,
    schema: [{
      "@context": "https://schema.org", "@type": "BlogPosting",
      headline: p.titel, description: p.intro || undefined,
      datePublished: p.datum, dateModified: p.datum, inLanguage: "nl-BE",
      image: p.afbeelding ? `${SITE}/${p.afbeelding}` : OG_IMAGE,
      mainEntityOfPage: url(`blog-${p.id}.html`),
      author: { "@type": "Organization", name: D.club.naam, url: `${SITE}/` },
      publisher: { "@type": "Organization", name: D.club.naam, logo: { "@type": "ImageObject", url: `${SITE}/images/crest-960.webp` } }
    }, kruimels(["Home", "index.html"], ["Blog", "blog.html"], [p.titel, `blog-${p.id}.html`])]
  })),
  // oude adressen (artikel.html?id=…) sturen door; zonder geldig id: "niet gevonden"
  { page: "artikel", bestand: "artikel.html", noindex: true },
  { page: "artikel", bestand: "404.html", noindex: true, absoluut: true }
];

function html(p) {
  const r = render(p.page, p.id);
  const kop = p.bestand === "index.html";
  return `<!doctype html>
<html lang="nl-BE">
<head>
  <meta charset="utf-8">
  ${GEGENEREERD}
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(r.seo.titel)}</title>
  <meta name="description" content="${esc(r.seo.beschrijving)}">
  ${p.noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${url(p.bestand)}">`}
  <meta name="theme-color" content="#02080f">
  <meta property="og:site_name" content="${esc(D.club.naam)}">
  <meta property="og:locale" content="nl_BE">
  <meta property="og:type" content="${p.ogType || "website"}">
  <meta property="og:title" content="${esc(r.seo.titel)}">
  <meta property="og:description" content="${esc(r.seo.beschrijving)}">
  ${p.noindex ? "" : `<meta property="og:url" content="${url(p.bestand)}">\n  `}<meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">${p.absoluut ? `\n  <base href="/">` : ""}
  <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">${kop ? `
  <link rel="preload" as="image" href="images/crest-480.webp" imagesrcset="images/crest-480.webp 480w, images/crest-960.webp 960w" imagesizes="(max-width: 900px) 260px, 460px" fetchpriority="high">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
  <script>if("IntersectionObserver" in window){document.documentElement.classList.add("js");setTimeout(function(){if(!window.PAYIT_RENDER)document.documentElement.classList.remove("js")},3000)}</script>
  ${(p.schema || []).map(jsonld).join("\n  ")}
</head>
<body data-page="${p.page}"${p.id ? ` data-artikel="${esc(p.id)}"` : ""}>
${r.header.trim()}
  <main id="main" data-stempel="${r.stempel}">${r.main}
  </main>
${r.footer.trim()}
  <script src="js/data.js"></script>
  <script src="js/klassement.js"></script>
  <script src="js/app.js"></script>
  <!-- Bezoekersstatistieken (GoatCounter: geen cookies, geen persoonsgegevens) — dashboard: https://payitfc.goatcounter.com -->
  <script>window.goatcounter = { path: function () { return location.pathname + location.search; } };</script>
  <script data-goatcounter="https://payitfc.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
</body>
</html>
`.replace(/[ \t]+$/gm, "");
}

/* ---------- schrijven ---------- */
const geschreven = new Set();
const schrijf = (bestand, inhoud) => { writeFileSync(ROOT + bestand, inhoud); geschreven.add(bestand); };
for (const p of paginas) schrijf(p.bestand, html(p));

// verslagen die uit data.js verdwenen zijn: gegenereerde pagina opruimen
for (const f of readdirSync(ROOT)) {
  if (/^blog-.+\.html$/.test(f) && !geschreven.has(f) && readFileSync(ROOT + f, "utf8").includes(GEGENEREERD)) unlinkSync(ROOT + f);
}

// sitemap: laatste wijziging = recentste verslag, wedstrijd of klassement-update
const gespeeld = D.wedstrijden.filter((m) => Array.isArray(m.score)).map((m) => m.datum);
const laatst = [...D.blog.map((p) => p.datum), ...gespeeld, K?.bijgewerkt].filter(Boolean).sort().pop();
schrijf("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.filter((p) => !p.noindex).map((p) => `  <url><loc>${url(p.bestand)}</loc><lastmod>${p.datum || laatst}</lastmod></url>`).join("\n")}
</urlset>
`);

console.log(`Gegenereerd: ${[...geschreven].join(", ")}`);
