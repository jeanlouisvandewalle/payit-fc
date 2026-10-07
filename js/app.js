/* PAYIT FC — rendering van alle pagina's op basis van js/data.js.
   Normaal hoef je hier niets aan te veranderen.
   Dit bestand draait in de browser én in scripts/build.mjs, dat de HTML vooraf
   genereert zodat zoekmachines de inhoud zonder JavaScript kunnen lezen. */
(function () {
  const D = window.PAYIT;
  const CLUB = D.club.naam;
  const DOM = typeof document !== "undefined";
  // huidige pagina; het build-script zet deze per pagina via PAYIT_RENDER()
  let page = DOM ? document.body.dataset.page : "home";
  let artikelId = DOM ? document.body.dataset.artikel || new URLSearchParams(location.search).get("id") : null;

  /* ---------- helpers ---------- */
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const toDate = (m) => new Date(`${m.datum}T${m.uur || "00:00"}:00`);
  const fmt = (iso, opts) => new Date(iso + "T12:00:00").toLocaleDateString("nl-BE", opts);
  const fmtShort = (iso) => fmt(iso, { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtLong = (iso) => fmt(iso, { weekday: "long", day: "numeric", month: "long" });
  const fmtBlog = (iso) => fmt(iso, { day: "numeric", month: "long", year: "numeric" });
  const initials = (n) => n.split(/[\s-]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const avatar = (n, cls = "") => { const f = fotoVan(n); return f ? `<img class="avatar ${cls}" src="${esc(f)}" alt="" width="96" height="96" loading="lazy">` : `<span class="initials ${cls}">${initials(n)}</span>`; };
  const slug = (n) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  const $ = (sel) => document.querySelector(sel);
  const postUrl = (p) => `blog-${encodeURIComponent(p.id)}.html`;
  // clubwapen in drie formaten (images/crest-*.webp), zodat elke plek de kleinste versie laadt
  const crest = (px, attrs = "") => `<img src="images/crest-${px}.webp" ${attrs}>`;
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9]/g, "");
  const isUs = (t) => norm(t) === norm(CLUB);
  const fotoVan = (n) => D.spelers.find((p) => p.naam === n)?.foto;

  /* ---------- afgeleide data ---------- */
  const matches = D.wedstrijden.slice().sort((a, b) => toDate(a) - toDate(b));
  const played = matches.filter((m) => Array.isArray(m.score));
  const upcoming = matches.filter((m) => !Array.isArray(m.score) && !m.uitgesteld);
  const uitgesteld = matches.filter((m) => !Array.isArray(m.score) && m.uitgesteld);   // verzet, nieuwe datum nog niet bekend
  const playedDesc = played.slice().reverse();

  const ourGoals = (m) => (isUs(m.thuis) ? m.score[0] : m.score[1]);
  const theirGoals = (m) => (isUs(m.thuis) ? m.score[1] : m.score[0]);
  const outcome = (m) => { const a = ourGoals(m), b = theirGoals(m); return a > b ? "W" : a < b ? "V" : "G"; };
  const opponent = (m) => (isUs(m.thuis) ? m.uit : m.thuis);

  const stats = played.reduce((s, m) => {
    s.m++; s.gv += ourGoals(m); s.gt += theirGoals(m); s[outcome(m)]++; return s;
  }, { m: 0, W: 0, G: 0, V: 0, gv: 0, gt: 0 });

  const goalsBy = {}, crownsBy = {}, crownMatches = {};
  D.spelers.forEach((p) => { goalsBy[p.naam] = 0; crownsBy[p.naam] = 0; crownMatches[p.naam] = []; });
  played.forEach((m) => {
    Object.entries(m.doelpunten || {}).forEach(([n, g]) => { goalsBy[n] = (goalsBy[n] || 0) + g; });
    if (m.motm) { crownsBy[m.motm] = (crownsBy[m.motm] || 0) + 1; (crownMatches[m.motm] ||= []).push(m); }
  });
  const scorers = Object.entries(goalsBy).filter(([, g]) => g > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const crowns = Object.entries(crownsBy).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // rang met gedeelde plaatsen (6, 6 → beide #2)
  const ranked = (list) => list.map(([n, v], i) => ({ naam: n, v, rank: list.findIndex(([, x]) => x === v) + 1, i }));

  const posts = D.blog.slice().sort((a, b) => b.datum.localeCompare(a.datum));
  const postFor = (m) => m.verslag && D.blog.find((p) => p.id === m.verslag);
  const matchFor = (p) => p.wedstrijd && played.find((m) => m.speeldag === p.wedstrijd);

  /* ---------- iconen ---------- */
  const I = {
    ig: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    potm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" fill="currentColor" fill-opacity=".25"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3M8.5 20h7l-.8-3H9.3z"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 3.5L12 5l4.5 6.5L21 8l-2 11H5L3 8z"/></svg>',
    ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z" fill="currentColor"/><path d="M12 3v4.5M16 10.4l4.3-1.4M14.5 15.1l2.7 3.7M9.5 15.1l-2.7 3.7M8 10.4 3.7 9"/></svg>'
  };

  /* ---------- layout ---------- */
  const nav = [
    ["home", "index.html", "Home"],
    ["wedstrijden", "wedstrijden.html", "Wedstrijden"],
    ["ploeg", "ploeg.html", "Ploeg"],
    ["blog", "blog.html", "Blog"],
    ["sponsors", "sponsors.html", "Sponsors"],
    ["over-ons", "over-ons.html", "Over ons"]
  ];
  function header() {
    const active = page === "artikel" ? "blog" : page;
    return `
    <a class="skip" href="#main">Naar inhoud</a>
    <header class="site-header" id="top">
      <div class="wrap header-inner">
        <a class="brand" href="index.html" aria-label="${CLUB} home">
          ${crest(160, 'alt="" width="44" height="44"')}
          <span><strong>${CLUB}</strong><small>${D.club.afkorting || D.club.gemeente.slice(0, 3).toUpperCase()} · ${D.club.opgericht}</small></span>
        </a>
        <nav class="main-nav" id="main-nav" aria-label="Hoofdmenu">
          ${nav.map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ""}>${l}</a>`).join("")}
          <a class="nav-ig" href="${D.club.instagram}" target="_blank" rel="noopener">${I.ig}<span>Instagram</span></a>
        </nav>
        <button class="menu-btn" aria-expanded="false" aria-controls="main-nav" aria-label="Menu"><span></span><span></span></button>
      </div>
    </header>`;
  }

  function footer() {
    return `
    <section class="sponsor-strip" aria-label="Onze partners">
      <div class="marquee"><div class="marquee-track">
        ${[...D.sponsors, ...D.sponsors].map((s, i) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"${s.licht ? ' class="licht"' : ""} ${i >= D.sponsors.length ? 'aria-hidden="true" tabindex="-1"' : ""}><img src="${esc(s.logo)}" alt="${esc(s.naam)}" loading="lazy"></a>`).join("")}
      </div></div>
    </section>
    <footer class="site-footer">
      <div class="wrap footer-grid">
        <div class="footer-brand">
          ${crest(160, `alt="${CLUB} wapen" width="72" height="72" loading="lazy"`)}
          <p class="display">${D.club.slogan.join("<br>")}</p>
        </div>
        <div>
          <h3>Navigatie</h3>
          <ul>${nav.map(([, h, l]) => `<li><a href="${h}">${l}</a></li>`).join("")}</ul>
        </div>
        <div>
          <h3>Volg ons</h3>
          <ul>
            <li><a href="${D.club.instagram}" target="_blank" rel="noopener">${D.club.instagramHandle} ↗</a></li>
            <li><a href="${D.club.mvbi}" target="_blank" rel="noopener">Kalender op MVBI ↗</a></li>
            ${D.club.email ? `<li><a href="mailto:${esc(D.club.email)}">${esc(D.club.email)}</a></li>` : ""}
          </ul>
        </div>
      </div>
      <div class="wrap footer-base">
        <span>© ${new Date().getFullYear()} ${CLUB} · ${D.club.gemeente}</span>
        <a href="#top">Terug naar boven ↑</a>
      </div>
    </footer>`;
  }

  /* ---------- herbruikbare blokken ---------- */
  const sectionHead = (kicker, title, extra = "") => `
    <div class="section-head">
      <div><p class="kicker">${kicker}</p><h2 class="display">${title}</h2></div>${extra}
    </div>`;

  const pageHero = (kicker, title, sub) => `
    <section class="page-hero">
      <div class="wrap">
        <p class="kicker">${kicker}</p>
        <h1 class="display">${title}</h1>
        ${sub ? `<p class="lead">${sub}</p>` : ""}
      </div>
      ${crest(480, 'class="page-hero-crest" alt="" aria-hidden="true" width="480" height="480"')}
    </section>`;

  const teamName = (t) => `<span class="${isUs(t) ? "us" : ""}">${esc(t)}</span>`;

  function nextMatchCard(m) {
    if (!m) return `<div class="card next-card"><p class="kicker">Volgende match</p><p class="muted">Nog geen nieuwe wedstrijden gepland. Hou Instagram in de gaten!</p></div>`;
    const home = isUs(m.thuis);
    return `
      <div class="card next-card">
        <div class="next-top"><p class="kicker">Volgende match</p><span class="tag">${home ? "Thuis" : "Uit"}</span></div>
        <div class="versus">
          <div class="team">${teamName(m.thuis)}</div>
          <div class="vs">VS</div>
          <div class="team">${teamName(m.uit)}</div>
        </div>
        <div class="countdown" data-target="${toDate(m).toISOString()}" aria-live="off">
          <div><b data-u="d">–</b><small>dagen</small></div>
          <div><b data-u="h">–</b><small>uur</small></div>
          <div><b data-u="m">–</b><small>min</small></div>
          <div><b data-u="s">–</b><small>sec</small></div>
        </div>
        <div class="meta">
          <span>${I.clock}${fmtLong(m.datum)} · ${esc(m.uur)}</span>
          <span>${I.pin}${esc(m.locatie)}</span>
        </div>
        <a class="link-arrow" href="${esc(m.link || D.club.mvbi)}" target="_blank" rel="noopener">Info op MVBI ${I.ext}</a>
      </div>`;
  }

  function resultCard(m, { full = false } = {}) {
    const o = outcome(m);
    const post = postFor(m);
    const scorersList = Object.entries(m.doelpunten || {}).sort((a, b) => b[1] - a[1]);
    return `
      <article class="card result-card ${full ? "full" : ""}">
        <div class="result-top">
          <span class="kicker">Speeldag ${m.speeldag ?? ""} · ${fmtShort(m.datum)}</span>
          <span class="badge badge-${o}" title="${{ W: "Winst", G: "Gelijk", V: "Verlies" }[o]}">${o}</span>
        </div>
        <div class="scoreline">
          <span class="team">${teamName(m.thuis)}</span>
          <span class="score">${m.score[0]}<i>–</i>${m.score[1]}</span>
          <span class="team">${teamName(m.uit)}</span>
        </div>
        ${m.quote ? `<p class="quote">“${esc(m.quote)}”</p>` : ""}
        ${full && scorersList.length ? `
          <div class="scorers">
            <h4>${I.ball} Doelpuntenmakers</h4>
            <ul>${scorersList.map(([n, g]) => `<li><span>${esc(n)}</span><b>${g}</b></li>`).join("")}</ul>
          </div>` : ""}
        <div class="result-foot">
          ${m.motm ? `<span class="motm">${avatar(m.motm, "sm")}<span><small>${I.potm} Payit Player of the Match</small>${esc(m.motm)}</span></span>` : "<span></span>"}
          ${post ? `<a class="link-arrow" href="${postUrl(post)}">Verslag ${I.arrow}</a>` : ""}
        </div>
      </article>`;
  }

  function fixtureRow(m) {
    const d = new Date(m.datum + "T12:00:00");
    return `
      <li class="fixture${m.uitgesteld ? " is-uitgesteld" : ""}">
        <div class="fx-date"><b>${d.getDate()}</b><small>${d.toLocaleDateString("nl-BE", { month: "short" }).replace(".", "")}</small></div>
        <div class="fx-teams">${teamName(m.thuis)} <em>vs</em> ${teamName(m.uit)}</div>
        ${m.uitgesteld
          ? `<div class="fx-meta"><span>${I.clock}Nieuwe datum volgt</span></div><span class="tag tag-uitgesteld">Uitgesteld</span>`
          : `<div class="fx-meta"><span>${I.clock}${esc(m.uur)}</span><span>${I.pin}${esc(m.locatie)}</span></div><span class="tag">${isUs(m.thuis) ? "Thuis" : "Uit"}</span>`}
      </li>`;
  }

  function scorerList(limit) {
    const list = ranked(scorers).slice(0, limit || undefined);
    const max = scorers[0]?.[1] || 1;
    if (!list.length) return `<p class="muted">Nog geen doelpunten. Dat komt wel.</p>`;
    return `<ol class="rank-list">${list.map((r) => `
      <li class="${r.rank === 1 ? "top" : ""}">
        <span class="rank">${String(r.rank).padStart(2, "0")}</span>
        <span class="name">${esc(r.naam)}</span>
        <span class="bar"><i style="width:${(r.v / max) * 100}%"></i></span>
        <b>${r.v}</b>
      </li>`).join("")}</ol>`;
  }

  function crownList() {
    if (!crowns.length) return `<p class="muted">Nog geen Player of the Match-trofeeën uitgedeeld.</p>`;
    return `<ul class="crown-list">${ranked(crowns).map((r) => `
      <li>
        ${avatar(r.naam, "md")}
        <span class="name">${esc(r.naam)}<small>${crownMatches[r.naam].map((m) => `${esc(opponent(m))} · ${ourGoals(m)}–${theirGoals(m)}`).join(", ")}</small></span>
        <b>${r.v}<small>× POTM</small></b>
      </li>`).join("")}</ul>`;
  }

  function playerCard(p) {
    const g = goalsBy[p.naam] || 0, c = crownsBy[p.naam] || 0;
    const isTop = scorers.length && scorers[0][1] === g && g > 0;
    return `
      <article class="player ${isTop ? "is-top" : ""}" id="${slug(p.naam)}">
        <div class="player-photo${p.foto ? "" : " no-photo"}">
          ${p.foto ? `<img src="${esc(p.foto)}" alt="${esc(p.naam)}, speler van ${CLUB}" width="600" height="600" loading="lazy">` : `<span class="initials">${initials(p.naam)}</span>`}
          ${p.nummer ? `<span class="number">${esc(p.nummer)}</span>` : ""}
          ${isTop ? `<span class="top-tag">${I.ball} Topschutter</span>` : ""}
        </div>
        <div class="player-body">
          <p class="kicker">${esc(p.positie || "Selectie " + D.club.seizoen)}</p>
          <h3>${esc(p.naam)}</h3>
          ${p.bijnaam ? `<p class="muted">“${esc(p.bijnaam)}”</p>` : ""}
          <div class="player-stats">
            <span><b>${g}</b> ${g === 1 ? "goal" : "goals"}</span>
            ${c ? `<span class="crowns" title="Payit Player of the Match">${I.potm}<b>${c}</b>× POTM</span>` : ""}
          </div>
        </div>
      </article>`;
  }

  function postCard(p, { big = false } = {}) {
    const m = matchFor(p);
    return `
      <article class="card post-card ${big ? "big" : ""}">
        <a href="${postUrl(p)}" class="post-link">
          <div class="post-media">
            ${p.afbeelding ? `<img src="${esc(p.afbeelding)}" alt="" loading="lazy">`
              : m ? `<div class="post-score"><span>${esc(m.thuis)}</span><b>${m.score[0]}–${m.score[1]}</b><span>${esc(m.uit)}</span></div>`
              : `<div class="post-score">${crest(160, 'alt="" width="160" height="160" loading="lazy"')}</div>`}
          </div>
          <div class="post-body">
            <p class="kicker">${esc(p.categorie || "Nieuws")} · ${fmtBlog(p.datum)}</p>
            <h3>${esc(p.titel)}</h3>
            <p class="muted">${esc(p.intro || "")}</p>
            <span class="link-arrow">Lees meer ${I.arrow}</span>
          </div>
        </a>
      </article>`;
  }

  function sponsorCard(s, i) {
    return `
      <a class="card sponsor-card ${s.hoofd ? "main" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener">
        <div class="sponsor-logo${s.licht ? " licht" : ""}"><img src="${esc(s.logo)}" alt="${esc(s.naam)}" loading="lazy"></div>
        <div class="sponsor-body">
          <p class="kicker">${s.hoofd ? "Main partner" : "Partner " + String(i + 1).padStart(2, "0")}</p>
          <h3>${esc(s.naam)}</h3>
          <p class="muted">${esc(s.tekst)}</p>
          <span class="link-arrow">Bezoek partner ${I.ext}</span>
        </div>
      </a>`;
  }

  const K = window.PAYIT_KLASSEMENT;
  const onzeReeks = () => K?.reeksen.find((r) => r.rijen.some((x) => isUs(x[0])));

  function standTable(reeks, max) {
    // max: enkel de eerste plaatsen tonen (PAYIT FC blijft altijd zichtbaar)
    let rijen = reeks.rijen.map((r, i) => [r, i]);
    if (max && rijen.length > max) {
      const ons = rijen.find(([r]) => isUs(r[0]));
      rijen = rijen.slice(0, max);
      if (ons && ons[1] >= max) rijen.push(null, ons);
    }
    const kolommen = 10;
    return `
      <div class="table-wrap">
        <table class="standings">
          <thead><tr><th>#</th><th class="l">Ploeg</th><th title="Matchen">M</th><th title="Winst">W</th><th title="Gelijk">G</th><th title="Verlies">V</th><th class="hide-sm" title="Doelpunten voor">DV</th><th class="hide-sm" title="Doelpunten tegen">DT</th><th title="Doelsaldo">DS</th><th>Ptn</th></tr></thead>
          <tbody>${rijen.map((x) => {
            if (!x) return `<tr><td colspan="${kolommen}" class="muted">…</td></tr>`;
            const [r, i] = x, ds = r[5] - r[6];
            return `<tr class="${isUs(r[0]) ? "us" : ""}"><td>${i + 1}</td><td class="l">${isUs(r[0]) ? CLUB : esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${r[4]}</td><td class="hide-sm">${r[5]}</td><td class="hide-sm">${r[6]}</td><td>${ds > 0 ? "+" : ""}${ds}</td><td><b>${r[7]}</b></td></tr>`;
          }).join("")}</tbody>
        </table>
      </div>`;
  }

  function klassement({ alleen = false, max } = {}) {
    if (!K || !K.reeksen.length) return `<p class="muted">Klassement niet beschikbaar. <a class="link-arrow" href="https://www.mvbi.be/klassement" target="_blank" rel="noopener">Bekijk op MVBI ${I.ext}</a></p>`;
    const eigen = onzeReeks() || K.reeksen[0];
    const lijst = alleen ? [eigen] : [eigen, ...K.reeksen.filter((r) => r !== eigen)];
    const note = `<p class="table-note">Bron: <a href="${esc(K.bron)}" target="_blank" rel="noopener">MVBI</a> · bijgewerkt ${fmtShort(K.bijgewerkt)} · M matchen · W winst · G gelijk · V verlies · DV/DT doelpunten voor/tegen · DS doelsaldo</p>`;
    if (lijst.length === 1) return standTable(lijst[0], max) + note;
    return `
      <div class="tabs" role="tablist">${lijst.map((r, i) => `<button role="tab" class="tab" aria-selected="${i === 0}" data-tab="k${i}">${esc(r.naam)}${r === eigen ? ' <span class="tab-us">onze reeks</span>' : ""}</button>`).join("")}</div>
      ${lijst.map((r, i) => `<div class="tab-panel" data-panel="k${i}" ${i ? "hidden" : ""}>${standTable(r)}</div>`).join("")}
      ${note}`;
  }

  const statBand = () => `
    <div class="stat-band">
      <div><b data-count="${stats.m}">${stats.m}</b><span>Matchen</span></div>
      <div><b data-count="${stats.W}">${stats.W}</b><span>Overwinningen</span></div>
      <div><b data-count="${stats.gv}">${stats.gv}</b><span>Goals voor</span></div>
      <div><b data-count="${stats.gt}">${stats.gt}</b><span>Goals tegen</span></div>
    </div>`;

  const form = () => `<div class="form" aria-label="Vorm laatste matchen">${playedDesc.slice(0, 5).map((m) => `<span class="badge badge-${outcome(m)}" title="${esc(opponent(m))} ${ourGoals(m)}–${theirGoals(m)}">${outcome(m)}</span>`).join("")}</div>`;

  const igBlock = () => `
    <section class="section">
      <div class="wrap">
        <div class="ig-cta">
          <div>
            <p class="kicker">Buiten de lijnen</p>
            <h2 class="display">Volg ons<br><span class="accent">seizoen.</span></h2>
            <p class="muted">Matchdays, uitslagen, Payit Player of the Match en alles wat eigenlijk niet op een officiële clubwebsite thuishoort.</p>
            <a class="btn btn-primary" href="${D.club.instagram}" target="_blank" rel="noopener">${I.ig} ${D.club.instagramHandle}</a>
          </div>
          ${crest(480, 'alt="" width="480" height="480" loading="lazy"')}
        </div>
      </div>
    </section>`;

  /* ---------- pagina's ---------- */
  const pages = {
    home() {
      const next = upcoming.find((m) => toDate(m) > new Date()) || upcoming[0];
      const leader = ranked(scorers).filter((r) => r.rank === 1);
      return `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <p class="kicker">Est. ${D.club.opgericht} · ${D.club.gemeente}</p>
            <h1 class="display hero-title">
              <span class="accent">${esc(D.club.slogan[0].split(" ").slice(0, 2).join(" "))}</span>
              <span>${esc(D.club.slogan[0].split(" ").slice(2).join(" "))}</span>
              <span class="accent">${esc(D.club.slogan[1].split(" ").slice(0, 2).join(" "))}</span>
              <span>${esc(D.club.slogan[1].split(" ").slice(2).join(" "))}</span>
            </h1>
            <p class="lead">${esc(D.club.tagline)}</p>
            <div class="btn-row">
              <a class="btn btn-primary" href="wedstrijden.html">Bekijk wedstrijden ${I.arrow}</a>
              <a class="btn btn-ghost" href="ploeg.html">Ontdek de ploeg</a>
            </div>
          </div>
          <div class="hero-crest"><img src="images/crest-480.webp" srcset="images/crest-480.webp 480w, images/crest-960.webp 960w" sizes="(max-width: 900px) 260px, 460px" alt="${CLUB} wapen" width="480" height="480" fetchpriority="high"></div>
        </div>
      </section>

      <section class="section tight">
        <div class="wrap">
          ${sectionHead(`Seizoen ${D.club.seizoen}`, "Dit is de stand.", form())}
          ${statBand()}
          <div class="grid-2 mt">
            ${nextMatchCard(next)}
            ${playedDesc[0] ? resultCard(playedDesc[0]) : ""}
          </div>
          <div class="mt home-stand">
            <div class="section-head sm"><p class="kicker">Klassement ${esc(onzeReeks()?.naam || D.club.reeks)}</p><a class="link-arrow" href="wedstrijden.html#stand">Volledig klassement ${I.arrow}</a></div>
            ${klassement({ alleen: true, max: 8 })}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          ${sectionHead(`Na ${stats.m} ${stats.m === 1 ? "match" : "matchen"}`, "De tussenstand.", `<a class="link-arrow" href="ploeg.html#topschutters">Volledig klassement ${I.arrow}</a>`)}
          <div class="grid-leader">
            ${leader.length ? `
            <div class="card leader-card">
              <div class="leader-avatars">${leader.map((l) => avatar(l.naam, "lg")).join("")}</div>
              <p class="kicker">${I.ball} Topschutter${leader.length > 1 ? "s" : ""}</p>
              <h3 class="display">${leader.map((l) => esc(l.naam)).join("<br>")}</h3>
              <p class="big-num">${leader[0].v}<small>goals</small></p>
            </div>` : ""}
            <div class="card"><p class="kicker">Goal race</p>${scorerList(5)}</div>
            <div class="card"><p class="kicker">${I.potm} Payit Player of the Match</p>${crownList()}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          ${sectionHead("Matchverslagen", "Van de zijlijn.", `<a class="link-arrow" href="blog.html">Alle verslagen ${I.arrow}</a>`)}
          <div class="grid-3">${posts.slice(0, 3).map((p) => postCard(p)).join("")}</div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          ${sectionHead(`${D.spelers.length} vrienden · 1 ploeg`, "De selectie.", `<a class="link-arrow" href="ploeg.html">Bekijk de ploeg ${I.arrow}</a>`)}
          <div class="squad-strip">${D.spelers.map((p) => `<a href="ploeg.html#${slug(p.naam)}" class="chip">${avatar(p.naam, "sm")}${esc(p.naam)}</a>`).join("")}</div>
        </div>
      </section>

      <section class="section">
        <div class="wrap about-teaser">
          <div>
            <p class="kicker">Welkom in ${D.club.gemeente}</p>
            <h2 class="display">Welcome to<br><span class="accent">${CLUB}</span> <span class="crown-inline">${I.crown}</span></h2>
          </div>
          <div>
            <p class="lead">Een nieuwe ploeg. Een nieuw seizoen. En vooral: zeer veel goesting.</p>
            <p class="muted">${CLUB} is een recreatieve minivoetbalploeg uit ${D.club.gemeente}, opgericht in ${D.club.opgericht}. Een ploeg vrienden die graag voetbalt, graag wint en minstens even graag geniet van alles rond de wedstrijden.</p>
            <a class="link-arrow" href="over-ons.html">Meer over ons ${I.arrow}</a>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          ${sectionHead("Zij spelen mee", "Onze partners.", `<a class="link-arrow" href="sponsors.html">Alle partners ${I.arrow}</a>`)}
          <p class="muted section-sub">Geen bijzaak onderaan de pagina. Deze bedrijven maken het seizoen mee mogelijk en verdienen een plek in de basis.</p>
          <div class="sponsor-grid">${D.sponsors.map(sponsorCard).join("")}</div>
        </div>
      </section>
      ${igBlock()}`;
    },

    wedstrijden() {
      return `
      ${pageHero("Kalender & uitslagen", "Wedstrijden", "De matchen nemen we serieus. Deze pagina net genoeg.")}
      <section class="section tight">
        <div class="wrap">
          ${statBand()}
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${sectionHead("01 · Kalender", "Komende wedstrijden", `<a class="link-arrow" href="${D.club.mvbi}" target="_blank" rel="noopener">Officiële kalender ${I.ext}</a>`)}
          ${upcoming.length || uitgesteld.length ? `<ul class="fixtures">${[...upcoming, ...uitgesteld].map(fixtureRow).join("")}</ul>` : `<p class="muted">Geen komende wedstrijden gepland.</p>`}
        </div>
      </section>
      <section class="section alt" id="stand">
        <div class="wrap">
          ${sectionHead("02 · Stand", "Klassement", `<a class="link-arrow" href="https://www.mvbi.be/klassement" target="_blank" rel="noopener">Op MVBI ${I.ext}</a>`)}
          ${klassement()}
        </div>
      </section>
      <section class="section" id="uitslagen">
        <div class="wrap">
          ${sectionHead("03 · Afgelopen", "Uitslagen & verslagen", form())}
          <div class="results-list">${playedDesc.map((m) => resultCard(m, { full: true })).join("")}</div>
        </div>
      </section>`;
    },

    ploeg() {
      const podium = ranked(scorers).slice(0, 3);
      return `
      ${pageHero(`${D.spelers.length} vrienden · 1 ploeg`, `De mannen van ${CLUB}`, "Talent in verschillende hoeveelheden. Goesting in overvloed.")}
      <section class="section">
        <div class="wrap">
          ${sectionHead("01 · Selectie " + D.club.seizoen, "Volledige selectie")}
          <p class="muted section-sub">Geen rugnummers of vaste posities nodig. Gewoon ${D.spelers.length} vrienden die samen voetballen.</p>
          <div class="player-grid">${D.spelers.map(playerCard).join("")}</div>
        </div>
      </section>
      <section class="section alt" id="topschutters">
        <div class="wrap">
          ${sectionHead("02 · Goal race", "Topschutters")}
          ${podium.length ? `<div class="podium">${podium.map((r) => `
            <div class="podium-step p${r.i + 1}">
              ${avatar(r.naam, "lg")}
              <p class="kicker">#${r.rank}</p>
              <h3>${esc(r.naam)}</h3>
              <p class="big-num">${r.v}<small>goals</small></p>
            </div>`).join("")}</div>` : ""}
          <div class="card mt">${scorerList()}</div>
        </div>
      </section>
      <section class="section" id="motm">
        <div class="wrap">
          ${sectionHead("03 · Payit Player of the Match", "Player of the Match")}
          <p class="muted section-sub">Na elke match kiezen we de Payit Player of the Match: voor één avond officieel de beste van de ploeg.</p>
          <div class="grid-2">
            <div class="card">${crownList()}</div>
            <div class="card">
              <p class="kicker">Per speeldag</p>
              <ul class="motm-timeline">${playedDesc.filter((m) => m.motm).map((m) => `
                <li><span class="kicker">Speeldag ${m.speeldag} · ${esc(opponent(m))} · ${ourGoals(m)}–${theirGoals(m)}</span><b>${avatar(m.motm, "sm")} ${esc(m.motm)}</b>${m.doelpunten?.[m.motm] ? `<small>${m.doelpunten[m.motm]} ${m.doelpunten[m.motm] === 1 ? "goal" : "goals"}</small>` : ""}</li>`).join("")}</ul>
            </div>
          </div>
        </div>
      </section>`;
    },

    blog() {
      const [first, ...rest] = posts;
      return `
      ${pageHero("Blog", "Van de zijlijn", "Matchverslagen, sterke analyses van matige prestaties en alles wat er tussen de wedstrijden door gebeurt.")}
      <section class="section">
        <div class="wrap">
          ${first ? postCard(first, { big: true }) : `<p class="muted">Nog geen berichten.</p>`}
          ${rest.length ? `<div class="grid-3 mt">${rest.map((p) => postCard(p)).join("")}</div>` : ""}
        </div>
      </section>`;
    },

    artikel() {
      const p = D.blog.find((x) => x.id === artikelId);
      if (!p) return `${pageHero("Blog", "Niet gevonden", "Dit bericht bestaat niet (meer).")}<section class="section"><div class="wrap"><a class="btn btn-primary" href="blog.html">Naar de blog</a></div></section>`;
      const m = matchFor(p);
      const others = posts.filter((x) => x.id !== p.id).slice(0, 3);
      return `
      <article class="article">
        <header class="article-head wrap narrow">
          <a class="link-arrow back" href="blog.html">← Alle berichten</a>
          <p class="kicker">${esc(p.categorie || "Nieuws")} · ${fmtBlog(p.datum)}${p.auteur ? " · " + esc(p.auteur) : ""}</p>
          <h1 class="display">${esc(p.titel)}</h1>
          ${p.intro ? `<p class="lead">${esc(p.intro)}</p>` : ""}
        </header>
        ${m ? `<div class="wrap narrow">${resultCard(m, { full: true }).replace(/<a class="link-arrow" href="blog-[^"]*">[\s\S]*?<\/a>/, "")}</div>` : ""}
        ${p.afbeelding ? `<figure class="wrap narrow article-img"><img src="${esc(p.afbeelding)}" alt="${esc(p.titel)}"></figure>` : ""}
        <div class="wrap narrow prose">${p.inhoud}</div>
      </article>
      ${others.length ? `<section class="section alt"><div class="wrap">${sectionHead("Lees ook", "Meer verslagen")}<div class="grid-3">${others.map((x) => postCard(x)).join("")}</div></div></section>` : ""}`;
    },

    sponsors() {
      return `
      ${pageHero("Zij spelen mee", "Onze partners", "Deze bedrijven maken het seizoen mee mogelijk. Steun hen zoals zij ons steunen.")}
      <section class="section">
        <div class="wrap">
          <div class="sponsor-grid big">${D.sponsors.map(sponsorCard).join("")}</div>
        </div>
      </section>
      <section class="section alt">
        <div class="wrap about-teaser">
          <div><p class="kicker">Partner worden?</p><h2 class="display">Een plek<br><span class="accent">in de basis.</span></h2></div>
          <div>
            <p class="lead">Zin om ${CLUB} mee te steunen?</p>
            <p class="muted">Je logo op onze website, onze Instagram en — wie weet — op het shirt. Stuur ons een berichtje en we bekijken samen wat past.</p>
            <a class="btn btn-primary" href="${D.club.email ? "mailto:" + esc(D.club.email) : D.club.instagram}" ${D.club.email ? "" : 'target="_blank" rel="noopener"'}>Neem contact op ${I.arrow}</a>
          </div>
        </div>
      </section>`;
    },

    "over-ons"() {
      const o = D.overOns;
      return `
      ${pageHero("More than just a game", "Hoe het begon", o.titel)}
      <section class="section">
        <div class="wrap about-grid">
          <div class="prose big">${o.tekst.map((t) => `<p>${esc(t)}</p>`).join("")}</div>
          <blockquote class="slogan display">“${D.club.slogan.join("<br>")}”</blockquote>
        </div>
      </section>
      <section class="section alt">
        <div class="wrap">
          <div class="facts">${o.feiten.map((f) => `<div class="card fact"><h3 class="display">${esc(f.titel)}</h3><p class="muted">${esc(f.tekst)}</p></div>`).join("")}</div>
        </div>
      </section>
      <section class="section">
        <div class="wrap">
          ${sectionHead("In cijfers", `Seizoen ${D.club.seizoen}`)}
          ${statBand()}
        </div>
      </section>
      ${igBlock()}`;
    }
  };

  /* ---------- titel & beschrijving per pagina (voor Google en bij het delen) ---------- */
  const plaats = `minivoetbal ${D.club.gemeente}`;
  function seo() {
    const p = page === "artikel" ? D.blog.find((x) => x.id === artikelId) : null;
    if (p) return { titel: `${p.titel} · ${CLUB}`, beschrijving: p.intro || `${p.categorie || "Nieuws"} van ${CLUB}.` };
    return {
      home: { titel: `${CLUB} · Minivoetbal ${D.club.gemeente}`, beschrijving: `${CLUB} is een recreatieve minivoetbalploeg uit ${D.club.gemeente}, opgericht in ${D.club.opgericht}. Bekijk de uitslagen, het klassement, de topschutters en de matchverslagen van seizoen ${D.club.seizoen}.` },
      wedstrijden: { titel: `Wedstrijden, uitslagen en klassement · ${CLUB}`, beschrijving: `Kalender, uitslagen met doelpuntenmakers en het volledige klassement van ${CLUB}, ${plaats}, seizoen ${D.club.seizoen}.` },
      ploeg: { titel: `Ploeg en topschutters · ${CLUB} ${plaats}`, beschrijving: `De ${D.spelers.length} spelers van ${CLUB}, de stand bij de topschutters en wie al Payit Player of the Match werd in seizoen ${D.club.seizoen}.` },
      blog: { titel: `Blog en matchverslagen · ${CLUB}`, beschrijving: `Alle matchverslagen van ${CLUB}, ${plaats}: wat er gebeurde, wie scoorde en wie Payit Player of the Match werd.` },
      sponsors: { titel: `Sponsors en partners · ${CLUB}`, beschrijving: `De partners die ${CLUB} mee mogelijk maken: ${D.sponsors.map((s) => s.naam).join(", ")}. Ook partner worden van onze minivoetbalploeg?` },
      "over-ons": { titel: `Over ons · ${CLUB}, ${plaats}`, beschrijving: `${CLUB} werd in ${D.club.opgericht} opgericht in ${D.club.gemeente}: een groep vrienden die minivoetbal speelt. Competitief tijdens de match, ontspannen erna.` },
      artikel: { titel: `Bericht niet gevonden · ${CLUB}`, beschrijving: `Dit bericht van ${CLUB} bestaat niet (meer).` }
    }[page] || { titel: CLUB, beschrijving: "" };
  }

  /* Vingerafdruk van alles wat de HTML bepaalt. Staat de vooraf gegenereerde HTML
     nog gelijk met de data, dan hoeft de browser de pagina niet opnieuw op te bouwen. */
  function stempel() {
    const next = upcoming.find((m) => toDate(m) > new Date()) || upcoming[0];
    const tekst = JSON.stringify([D, K || null, next ? next.datum + next.uur : "", new Date().getFullYear()]);
    let h = 5381;
    for (let i = 0; i < tekst.length; i++) h = ((h * 33) ^ tekst.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  /* voor scripts/build.mjs */
  window.PAYIT_RENDER = function (pagina, id) {
    page = pagina; artikelId = id || null;
    return { header: header(), main: (pages[page] || pages.home)(), footer: footer(), seo: seo(), stempel: stempel() };
  };
  if (!DOM) return;

  /* ---------- opbouwen ---------- */
  const main = $("#main");
  // oud adres van een verslag (artikel.html?id=…) → door naar de vaste pagina
  if (page === "artikel" && !document.body.dataset.artikel && location.protocol !== "file:" && D.blog.some((x) => x.id === artikelId)) {
    location.replace(postUrl({ id: artikelId }));
    return;
  }
  if (main.dataset.stempel !== stempel()) {
    document.querySelectorAll("body > .skip, body > .site-header, body > .sponsor-strip, body > .site-footer").forEach((el) => el.remove());
    document.body.insertAdjacentHTML("afterbegin", header());
    main.innerHTML = (pages[page] || pages.home)();
    main.insertAdjacentHTML("afterend", footer());
    document.title = seo().titel;
  }

  /* klikken tellen in GoatCounter: sponsors, Instagram en MVBI */
  document.querySelectorAll('a[target="_blank"]').forEach((a) => {
    const sp = D.sponsors.find((s) => a.href === new URL(s.url, location.href).href);
    const naam = sp ? `Klik: sponsor ${sp.naam}` : /instagram\.com/.test(a.href) ? "Klik: Instagram" : /mvbi\.be/.test(a.href) ? "Klik: MVBI" : null;
    if (naam) { a.dataset.goatcounterClick = naam; a.dataset.goatcounterTitle = naam; }
  });

  /* menu */
  const btn = $(".menu-btn"), navEl = $("#main-nav");
  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", open);
    document.body.classList.toggle("nav-open", open);
  });
  navEl.addEventListener("click", (e) => { if (e.target.closest("a")) { btn.setAttribute("aria-expanded", "false"); document.body.classList.remove("nav-open"); } });

  /* header bij scrollen */
  const onScroll = () => document.body.classList.toggle("scrolled", scrollY > 12);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  /* aftellen */
  const cd = $(".countdown");
  if (cd) {
    const t = new Date(cd.dataset.target);
    const tick = () => {
      let s = Math.max(0, Math.floor((t - new Date()) / 1000));
      const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
      Object.entries(v).forEach(([k, n]) => { const el = cd.querySelector(`[data-u="${k}"]`); el.textContent = String(n).padStart(2, "0"); });
    };
    tick(); setInterval(tick, 1000);
  }

  /* tabbladen klassement */
  document.querySelectorAll(".tabs").forEach((tabs) => tabs.addEventListener("click", (e) => {
    const t = e.target.closest(".tab"); if (!t) return;
    tabs.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", b === t));
    tabs.parentElement.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));

  /* reveal-animaties */
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    const els = document.querySelectorAll(".section-head, .card, .player, .fixture, .stat-band > div, .podium-step, .chip");
    els.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { rootMargin: "0px 0px -8% 0px" });
    els.forEach((el) => io.observe(el));

    document.querySelectorAll("[data-count]").forEach((el) => {
      const end = +el.dataset.count; if (!end) return;
      const cio = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; cio.disconnect();
        const t0 = performance.now(), dur = 900;
        const step = (t) => { const k = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
      cio.observe(el);
    });
  }
})();
