/* PAYIT FC — selectieplatform (selectie.html)
   Spelers melden zich aan met naam + pincode en duiden per match aan of ze kunnen.
   De database (supabase/selectie.sql) sluit de inschrijving 2 dagen voor de aftrap af en maakt
   dan zelf de selectie; deze pagina toont alleen wat de database teruggeeft. */
(function () {
  "use strict";

  var CFG = window.PAYIT_SELECTIE || {};
  var D = window.PAYIT || {};
  var app = document.getElementById("sel-app");
  var userEl = document.getElementById("sel-user");
  var TOKEN_KEY = "payit-selectie-token";

  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) { /* privévenster: gewoon opnieuw aanmelden */ }

  var S = null;          // toestand uit de database
  var roster = null;     // namenlijst voor het aanmeldscherm
  var clockSkew = 0;     // verschil tussen de klok van de server en die van dit toestel
  var synced = false;
  var ui = { busy: false, err: "", loginErr: "", loginPlayer: "", confirm: "", edit: {}, open: {} };

  /* ---------- hulpjes ---------- */
  var fDay = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", weekday: "long", day: "numeric", month: "long" });
  var fShort = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", day: "numeric", month: "short" });
  var fTime = new Intl.DateTimeFormat("nl-BE", { timeZone: "Europe/Brussels", hour: "2-digit", minute: "2-digit" });
  var fIso = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function now() { return Date.now() + clockSkew; }
  function t(iso) { return iso ? Date.parse(iso) : null; }
  function title(m) { return m.home + " – " + m.away; }
  function when(m) { var d = new Date(m.kickoff); return fDay.format(d) + " · " + fTime.format(d) + (m.place ? " · " + m.place : ""); }
  function pname(id) { for (var i = 0; i < S.players.length; i++) if (S.players[i].id === id) return S.players[i].name; return "?"; }
  function matchen(n) { return n + (n === 1 ? " match" : " matchen"); }
  function has(arr, id) { return arr.indexOf(id) >= 0; }
  function inLineup(m, id) { return m.lineup.some(function (l) { return l.id === id; }); }
  function rank(id) { for (var i = 0; i < S.players.length; i++) if (S.players[i].id === id) return i; return 999; }

  // aantal matchen dat meetelt voor de selectie van match m: alle afgesloten matchen ervoor
  function countBefore(id, m) {
    var k = t(m.kickoff);
    return S.matches.filter(function (x) { return x.final && x.kickoff && t(x.kickoff) < k && inLineup(x, id); }).length;
  }
  function played(id) {
    return S.matches.filter(function (x) { return x.final && x.kickoff && t(x.kickoff) <= now() && inLineup(x, id); }).length;
  }
  function remaining(ms) {
    var min = Math.floor(ms / 60000);
    if (min < 60) return "nog " + Math.max(min, 1) + (min === 1 ? " minuut" : " minuten");
    var h = Math.floor(min / 60);
    if (h < 48) return "nog " + h + " uur";
    return "nog " + Math.floor(h / 24) + " dagen";
  }

  // voorlopige stand zolang de inschrijving open is (zelfde regel als de database bij het afsluiten)
  function provisional(m) {
    var list = m.yes.map(function (id) { return { id: id, c: countBefore(id, m) }; })
      .sort(function (a, b) { return a.c - b.c || rank(a.id) - rank(b.id); });
    if (list.length <= S.spots) { list.forEach(function (x) { x.tag = "in"; }); return list; }
    var th = list[S.spots - 1].c;
    var sure = list.filter(function (x) { return x.c < th; }).length;
    var tied = list.filter(function (x) { return x.c === th; }).length;
    list.forEach(function (x) { x.tag = x.c < th ? "in" : x.c > th ? "out" : tied === S.spots - sure ? "in" : "lot"; });
    return list;
  }

  /* ---------- database ---------- */
  function rpc(fn, args) {
    return fetch(CFG.url.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: "Bearer " + CFG.key },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (j) {
        if (!r.ok) throw { code: (j && j.message) || "ERROR" };
        return j;
      });
    }, function () { throw { code: "OFFLINE" }; });
  }

  function setToken(v) {
    token = v;
    try { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); } catch (e) { /* zie boven */ }
  }
  function setState(st) {
    S = st;
    clockSkew = Date.parse(st.now) - Date.now();
    render();
  }
  function fail(e) {
    ui.busy = false;
    if (e && e.code === "NOT_LOGGED_IN") { setToken(null); S = null; return showLogin(); }
    ui.err = e && e.code === "CLOSED" ? "De inschrijving voor deze match is net afgesloten."
      : e && e.code === "TOO_EARLY" ? "Voor deze match kan je nog niet aanduiden."
      : e && e.code === "OFFLINE" ? "Geen verbinding. Controleer je internet en probeer opnieuw."
      : "Er ging iets mis. Probeer het zo meteen opnieuw.";
    if (S) { render(); if (e && e.code === "CLOSED") load(true); } else renderError();
  }
  function call(fn, args) {
    if (ui.busy) return;
    ui.busy = true; ui.err = "";
    render();
    args.p_token = token;
    rpc(fn, args).then(function (st) { ui.busy = false; setState(st); }, fail);
  }
  function load(silent) {
    if (!token) return showLogin();
    rpc("sel_state", { p_token: token }).then(function (st) {
      if (silent && S && JSON.stringify(st.matches) === JSON.stringify(S.matches) && JSON.stringify(st.players) === JSON.stringify(S.players)) {
        clockSkew = Date.parse(st.now) - Date.now();
        return;
      }
      setState(st);
      syncCalendar();
    }, function (e) { if (!silent || (e && e.code === "NOT_LOGGED_IN")) fail(e); });
  }

  // beheerder: kalender uit js/data.js doorgeven als er iets gewijzigd is (nieuwe match, ander uur, uitstel)
  function syncCalendar() {
    if (synced || !S || !S.me.admin || !D.wedstrijden) return;
    synced = true;
    var club = (D.club && D.club.naam) || "PAYIT FC";
    var list = D.wedstrijden.filter(function (w) { return w.thuis === club || w.uit === club; }).map(function (w) {
      var off = !!w.uitgesteld || !w.datum || !w.uur;
      return { key: w.thuis + "|" + w.uit, home: w.thuis, away: w.uit, place: w.locatie || null, date: off ? null : w.datum, time: off ? null : w.uur };
    });
    var changed = list.filter(function (w) {
      var m = S.matches.filter(function (x) { return x.home === w.home && x.away === w.away; })[0];
      if (!m) return true;
      if (m.final) return false;
      var cur = m.kickoff ? fIso.format(new Date(m.kickoff)) : null;
      var want = w.date ? w.date + " " + w.time : null;
      return cur !== want || (m.place || null) !== w.place;
    });
    if (changed.length) rpc("sel_admin_sync", { p_token: token, p_matches: changed }).then(setState, function () { /* volgende keer opnieuw */ });
  }

  /* ---------- aanmelden ---------- */
  function showLogin() {
    userEl.innerHTML = "";
    if (roster) return renderLogin();
    rpc("sel_roster").then(function (r) { roster = r; renderLogin(); }, fail);
  }
  function renderLogin() {
    var sel = roster.filter(function (p) { return String(p.id) === ui.loginPlayer; })[0];
    app.innerHTML =
      '<section class="sel-card hero"><p class="kicker">Alleen voor de ploeg</p><h1>Selectie</h1>' +
      '<p class="sel-note">Meld je aan om aan te duiden of je de volgende match kan meespelen.</p>' +
      '<form class="sel-form" id="sel-login">' +
      '<div class="sel-field"><label for="sel-player">Wie ben je?</label><select id="sel-player" required>' +
      '<option value="">Kies je naam</option>' +
      roster.map(function (p) { return '<option value="' + p.id + '"' + (String(p.id) === ui.loginPlayer ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="sel-field"><label for="sel-pin">Pincode (4 cijfers)</label>' +
      '<input class="pin" id="sel-pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required></div>' +
      '<p class="sel-note" id="sel-pin-hint">' + pinHint(sel) + "</p>" +
      (ui.loginErr ? '<p class="sel-note bad" role="alert">' + esc(ui.loginErr) + "</p>" : "") +
      '<div class="sel-row"><button class="sel-btn primary" type="submit"' + (ui.busy ? " disabled" : "") + ">" + (ui.busy ? "Bezig…" : "Aanmelden") + "</button></div>" +
      "</form></section>";
  }
  function pinHint(p) {
    if (!p) return "De eerste keer kies je zelf je pincode.";
    return p.has_pin ? "Vul de pincode in die je de eerste keer koos. Vergeten? Vraag Jean-Louis om ze te wissen."
      : "Eerste keer: kies nu zelf een pincode van 4 cijfers en onthoud ze.";
  }
  var LOGIN_ERR = {
    PIN_FORMAT: "Een pincode bestaat uit precies 4 cijfers.",
    WRONG_PIN: "Die pincode klopt niet. Probeer opnieuw.",
    LOCKED: "Te veel foute pogingen. Wacht een kwartier en probeer dan opnieuw.",
    UNKNOWN_PLAYER: "Kies eerst je naam."
  };
  function submitLogin() {
    var player = document.getElementById("sel-player").value, pin = document.getElementById("sel-pin").value;
    ui.loginPlayer = player;
    if (!player) { ui.loginErr = LOGIN_ERR.UNKNOWN_PLAYER; return renderLogin(); }
    ui.busy = true; ui.loginErr = "";
    renderLogin();
    rpc("sel_login", { p_player: +player, p_pin: pin }).then(function (res) {
      ui.busy = false;
      if (res.error) { ui.loginErr = LOGIN_ERR[res.error] || "Aanmelden lukte niet."; roster = null; return showLogin(); }
      setToken(res.token); roster = null;
      load();
    }, function (e) {
      ui.busy = false;
      ui.loginErr = e && e.code === "OFFLINE" ? "Geen verbinding. Controleer je internet en probeer opnieuw." : "Aanmelden lukte niet. Probeer het zo meteen opnieuw.";
      renderLogin();
    });
  }

  /* ---------- weergave ---------- */
  function renderError() {
    app.innerHTML = '<section class="sel-card"><h2>Even geduld</h2><p class="sel-note bad">' + esc(ui.err) + "</p>" +
      '<div class="sel-row"><button class="sel-btn" data-act="reload">Opnieuw proberen</button></div></section>';
  }
  function names(ids, withCount, m) {
    if (!ids.length) return "niemand";
    return ids.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (id) {
      return "<b>" + esc(pname(id)) + "</b>" + (withCount ? " (" + countBefore(id, m) + ")" : "");
    }).join(", ");
  }
  function details(key, label, inner) {
    return '<details data-key="' + key + '"' + (ui.open[key] ? " open" : "") + "><summary>" + label + "</summary><div>" + inner + "</div></details>";
  }
  function choice(m) {
    var me = S.me.id, mine = has(m.yes, me) ? "ja" : has(m.no, me) ? "nee" : "";
    return '<div class="sel-choice">' +
      '<button class="yes" data-act="avail" data-m="' + m.id + '" data-s="ja" aria-pressed="' + (mine === "ja") + '"' + (ui.busy ? " disabled" : "") + ">Ik kan</button>" +
      '<button class="no" data-act="avail" data-m="' + m.id + '" data-s="nee" aria-pressed="' + (mine === "nee") + '"' + (ui.busy ? " disabled" : "") + ">Ik kan niet</button></div>";
  }
  function pills(m) {
    var open = S.players.length - m.yes.length - m.no.length;
    return '<div class="sel-pills"><span class="sel-pill' + (m.yes.length < S.min ? " bad" : m.yes.length >= S.spots ? " good" : " warn") + '">' + m.yes.length + (m.yes.length === 1 ? " kan" : " kunnen") + "</span>" +
      '<span class="sel-pill">' + m.no.length + (m.no.length === 1 ? " kan niet" : " kunnen niet") + "</span>" +
      '<span class="sel-pill">' + open + " zonder antwoord</span></div>";
  }
  function adminAvail(m) {
    if (!S.me.admin) return "";
    return details("av" + m.id, "Beheer: antwoorden van ploegmaats",
      '<p class="sel-note">Tik op een naam om te wisselen: kan, kan niet, geen antwoord.</p><div class="sel-chips">' +
      S.players.map(function (p) {
        var s = has(m.yes, p.id) ? "ja" : has(m.no, p.id) ? "nee" : "";
        return '<button class="sel-chip ' + s + '" data-act="avail-for" data-m="' + m.id + '" data-p="' + p.id + '" data-s="' + s + '"' + (ui.busy ? " disabled" : "") + ">" + esc(p.name) + "</button>";
      }).join("") + "</div>");
  }

  function openView(m, big) {
    var left = t(m.deadline) - now(), d = new Date(m.deadline), h = "";
    h += choice(m);
    h += '<p class="sel-note">Aanduiden kan tot ' + fDay.format(d) + " om " + fTime.format(d) + " (" + remaining(left) + "). Daarna volgt automatisch de selectie.</p>";
    h += pills(m);
    if (m.yes.length < S.min) h += '<p class="sel-note bad">We hebben minimum ' + S.min + " spelers nodig om te kunnen spelen.</p>";
    var none = S.players.map(function (p) { return p.id; }).filter(function (id) { return !has(m.yes, id) && !has(m.no, id); });
    var who = "";
    if (m.yes.length) {
      var TAG = { "in": '<span class="sel-tag">Erbij</span>', lot: '<span class="sel-tag wait">Loting</span>', out: '<span class="sel-tag out">Niet erbij</span>' };
      who += '<div><p class="sel-h3">Voorlopige stand</p><ol class="sel-list">' + provisional(m).map(function (x, i) {
        return "<li" + (x.id === S.me.id ? ' class="me"' : "") + '><span class="nr">' + ("0" + (i + 1)).slice(-2) + '</span><span class="name">' + esc(pname(x.id)) +
          '</span><span class="cnt">' + matchen(x.c) + "</span>" + TAG[x.tag] + "</li>";
      }).join("") + '</ol><p class="sel-note">Wie het minst speelde, gaat voor. Dit kan nog wijzigen tot de inschrijving sluit.</p></div>';
    }
    who += '<p class="sel-names">Kunnen niet: ' + names(m.no) + "</p>";
    who += '<p class="sel-names">Nog geen antwoord: ' + names(none) + "</p>";
    h += big ? who : details("who" + m.id, "Wie kan?", who);
    return h + adminAvail(m);
  }

  // latere matchen: zichtbaar, maar aanduiden kan pas bij de eerstvolgende 3
  function lockedView() {
    return '<p class="sel-note">Aanduiden kan nog niet. Dat kan zodra deze match bij de eerstvolgende 3 hoort.</p>';
  }

  function finalView(m, upcoming) {
    var r = m.result || {}, counts = r.counts || {}, h = "", me = S.me.id;
    var ORDER = { zeker: 0, loting: 1, manueel: 2 };
    var line = m.lineup.slice().sort(function (a, b) {
      return ORDER[a.via] - ORDER[b.via] || (counts[a.id] || 0) - (counts[b.id] || 0) || rank(a.id) - rank(b.id);
    });
    var TAG = { zeker: '<span class="sel-tag">Zeker</span>', loting: '<span class="sel-tag lot">Geloot</span>', manueel: '<span class="sel-tag out">Aangepast</span>' };
    if (upcoming) {
      h += '<div class="sel-pills"><span class="sel-pill">Inschrijving afgesloten</span><span class="sel-pill' + (line.length < S.min ? " bad" : " good") + '">' + line.length + (line.length === 1 ? " speler" : " spelers") + "</span></div>";
      if (inLineup(m, me)) h += '<p class="sel-note good">Je bent geselecteerd.</p>';
      else if (has(m.yes, me)) h += '<p class="sel-note warn">Je bent er deze keer niet bij. Volgende keer heb je voorrang op wie nu speelt.</p>';
      if (line.length < S.min) h += '<p class="sel-note bad">Maar ' + line.length + (line.length === 1 ? " speler" : " spelers") + ": we hebben er minimum " + S.min + " nodig.</p>";
    }
    h += '<ol class="sel-list">' + line.map(function (l, i) {
      return "<li" + (l.id === me ? ' class="me"' : "") + '><span class="nr">' + ("0" + (i + 1)).slice(-2) + '</span><span class="name">' + esc(pname(l.id)) +
        '</span><span class="cnt">' + (counts[l.id] != null ? matchen(counts[l.id]) : "") + "</span>" + (upcoming || m.result ? TAG[l.via] : "<span></span>") + "</li>";
    }).join("") + "</ol>";
    var bench = m.yes.filter(function (id) { return !inLineup(m, id); });
    if (bench.length) h += '<p class="sel-names">Niet geselecteerd: ' + bench.sort(function (a, b) { return rank(a) - rank(b); }).map(function (id) {
      return "<b>" + esc(pname(id)) + "</b>" + (counts[id] != null ? " (" + counts[id] + ")" : "");
    }).join(", ") + "</p>";
    if (r.rounds && r.rounds.length) {
      h += details("dr" + m.id, "Bekijk de loting", '<div class="sel-draw"><p class="sel-note">' + r.candidates.length + " spelers met evenveel matchen voor " + r.spots +
        (r.spots === 1 ? " plaats" : " plaatsen") + ". Lotnummers volgen het alfabet op familienaam.</p><ol>" +
        r.candidates.map(function (id) { return "<li>" + esc(pname(id)) + "</li>"; }).join("") + "</ol></div>" +
        r.rounds.map(function (x) {
          return '<div class="sel-draw"><dl><dt>Startwaarde</dt><dd>' + esc(x.text) + '</dd><dt>SHA-256</dt><dd class="hash">' + esc(x.hash) +
            "</dd><dt>Uitkomst</dt><dd>rest bij deling door " + x.n + " = " + x.rest + ", dus lot " + (x.rest + 1) + " van de overblijvers: " + esc(pname(x.pick)) + "</dd></dl></div>";
        }).join("") +
        '<p class="sel-note">Nagaan kan: plak de startwaarde in een online SHA-256-calculator en deel het getal door het aantal lotnummers. De startwaarde is altijd PAYIT-FC- plus de matchdatum.</p>');
    }
    if (S.me.admin) {
      var ed = ui.edit[m.id] || m.lineup.map(function (l) { return l.id; });
      h += details("ed" + m.id, "Beheer: selectie aanpassen", '<p class="sel-note">Bij een afzegging of wissel: tik aan wie effectief meespeelt en sla op. Dit bepaalt ook de telling.</p><div class="sel-chips">' +
        S.players.map(function (p) {
          return '<button class="sel-chip' + (has(ed, p.id) ? " on" : "") + '" data-act="edit-toggle" data-m="' + m.id + '" data-p="' + p.id + '">' + esc(p.name) + "</button>";
        }).join("") + '</div><div class="sel-row"><button class="sel-btn primary small" data-act="edit-save" data-m="' + m.id + '"' + (ui.busy || !ui.edit[m.id] ? " disabled" : "") + ">Selectie opslaan (" + ed.length + ")</button></div>");
    }
    return h;
  }

  function render() {
    if (!S) return;
    var n = now(), h = [];
    var upcoming = S.matches.filter(function (m) { return m.kickoff && t(m.kickoff) > n; });
    var past = S.matches.filter(function (m) { return m.kickoff && t(m.kickoff) <= n; }).reverse();
    var postponed = S.matches.filter(function (m) { return !m.kickoff; });

    userEl.innerHTML = "<span>Dag " + esc(S.me.first) + '</span><button class="sel-btn small" data-act="logout">Afmelden</button>';
    if (ui.err) h.push('<p class="sel-note bad" role="alert">' + esc(ui.err) + "</p>");

    var hero = upcoming[0];
    if (hero) {
      h.push('<section class="sel-card hero"><p class="kicker">Volgende match</p><h1>' + esc(title(hero)) + '</h1><p class="sel-meta">' + esc(when(hero)) + "</p>" +
        (hero.final ? finalView(hero, true) : hero.selectable ? openView(hero, true) : lockedView()) + "</section>");
    } else {
      h.push('<section class="sel-card hero"><p class="kicker">Volgende match</p><h1>Nog niets gepland</h1><p class="sel-note">Zodra er een nieuwe match op de kalender staat, kan je hier aanduiden of je kan.</p></section>');
    }

    if (upcoming.length > 1) {
      h.push('<section class="sel-card"><h2>Daarna</h2><p class="sel-note">Je kan aanduiden voor de eerstvolgende 3 matchen. Wijzigen kan tot 2 dagen voor de match.</p><div>' +
        upcoming.slice(1).map(function (m) {
          return '<article class="sel-match"><div><h3>' + esc(title(m)) + '</h3><p class="sel-note">' + esc(when(m)) + "</p></div>" + (m.final ? finalView(m, true) : m.selectable ? openView(m, false) : lockedView()) + "</article>";
        }).join("") + "</div></section>");
    }
    if (postponed.length) {
      h.push('<section class="sel-card"><h2>Uitgesteld</h2><p class="sel-names">' + postponed.map(function (m) { return "<b>" + esc(title(m)) + "</b>"; }).join(", ") +
        '</p><p class="sel-note">Aanduiden kan zodra de nieuwe datum bekend is.</p></section>');
    }

    var tally = S.players.map(function (p) { return { p: p, c: played(p.id) }; }).sort(function (a, b) { return a.c - b.c || rank(a.p.id) - rank(b.p.id); });
    h.push('<section class="sel-card"><h2>De telling</h2><p class="sel-note">Aantal gespeelde matchen dit seizoen. Wie bovenaan staat, heeft voorrang.</p><table class="sel-table"><tbody>' +
      tally.map(function (x) { return "<tr" + (x.p.id === S.me.id ? ' class="me"' : "") + "><td>" + esc(x.p.name) + "</td><td>" + x.c + "</td></tr>"; }).join("") + "</tbody></table></section>");

    if (past.length) {
      h.push('<section class="sel-card"><h2>Gespeeld</h2><div>' + past.map(function (m) {
        return '<article class="sel-match"><div><h3>' + esc(title(m)) + '</h3><p class="sel-note">' + esc(fShort.format(new Date(m.kickoff))) + " · " + m.lineup.length + " spelers</p></div>" +
          details("pa" + m.id, "Wie speelde mee?", finalView(m, false)) + "</article>";
      }).join("") + "</div></section>");
    }

    if (S.me.admin) {
      h.push('<section class="sel-card"><h2>Beheer: pincodes</h2><p class="sel-note">Pincode vergeten? Wis ze hier; de speler kiest bij zijn volgende aanmelding een nieuwe.</p><div>' +
        S.players.map(function (p) {
          var c = ui.confirm === "pin" + p.id;
          return '<div class="sel-admin-row"><span>' + esc(p.name) + "</span>" + (p.has_pin
            ? '<button class="sel-btn small' + (c ? " danger" : "") + '" data-act="reset-pin" data-p="' + p.id + '"' + (ui.busy ? " disabled" : "") + ">" + (c ? "Zeker wissen?" : "Pincode wissen") + "</button>"
            : '<span class="sel-note">nog geen pincode</span>') + "</div>";
        }).join("") + "</div></section>");
    }
    app.innerHTML = h.join("");
  }

  /* ---------- acties ---------- */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-act]");
    if (!b) return;
    var act = b.getAttribute("data-act"), m = +b.getAttribute("data-m"), p = +b.getAttribute("data-p"), s = b.getAttribute("data-s");
    var confirm = ui.confirm;
    ui.confirm = "";
    if (act === "avail") {
      call("sel_set_availability", { p_match: m, p_status: b.getAttribute("aria-pressed") === "true" ? null : s });
    } else if (act === "avail-for") {
      call("sel_set_availability", { p_match: m, p_player: p, p_status: s === "" ? "ja" : s === "ja" ? "nee" : null });
    } else if (act === "edit-toggle") {
      var match = S.matches.filter(function (x) { return x.id === m; })[0];
      var ed = ui.edit[m] || match.lineup.map(function (l) { return l.id; });
      var i = ed.indexOf(p);
      if (i >= 0) ed.splice(i, 1); else ed.push(p);
      ui.edit[m] = ed;
      render();
    } else if (act === "edit-save") {
      var list = ui.edit[m];
      delete ui.edit[m];
      call("sel_admin_lineup", { p_match: m, p_players: list });
    } else if (act === "reset-pin") {
      if (confirm === "pin" + p) call("sel_admin_reset_pin", { p_player: p });
      else { ui.confirm = "pin" + p; render(); }
    } else if (act === "logout") {
      var old = token;
      setToken(null); S = null; ui.err = "";
      rpc("sel_logout", { p_token: old }).then(null, function () { /* sessie was al weg */ });
      showLogin();
    } else if (act === "reload") {
      ui.err = "";
      load();
    }
  });
  document.addEventListener("submit", function (ev) {
    if (ev.target.id !== "sel-login") return;
    ev.preventDefault();
    if (!ui.busy) submitLogin();
  });
  document.addEventListener("change", function (ev) {
    if (ev.target.id !== "sel-player") return;
    ui.loginPlayer = ev.target.value;
    var p = roster.filter(function (x) { return String(x.id) === ui.loginPlayer; })[0];
    document.getElementById("sel-pin-hint").textContent = pinHint(p);
  });
  // onthoud welke uitklapblokken open staan, zodat ze open blijven na een update
  app.addEventListener("toggle", function (ev) {
    var k = ev.target.getAttribute && ev.target.getAttribute("data-key");
    if (k) ui.open[k] = ev.target.open;
  }, true);

  /* ---------- start ---------- */
  if (!CFG.url || !CFG.key) {
    app.innerHTML = '<section class="sel-card"><h2>Nog niet gekoppeld</h2><p class="sel-note">Deze pagina is nog niet verbonden met de database. Vul de gegevens in js/selectie-config.js in.</p></section>';
    return;
  }
  load();
  // op de achtergrond bijwerken: wanneer je terugkeert naar de pagina en elke minuut
  document.addEventListener("visibilitychange", function () { if (!document.hidden && S && !ui.busy) load(true); });
  setInterval(function () { if (!document.hidden && S && !ui.busy) load(true); }, 60000);
})();
