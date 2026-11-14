/*
 * Finanz-Check – Bewertungslogik und PowerPoint-Export.
 * Läuft im Browser (window.FinanzCheck) und in Node (module.exports).
 * Alle Beträge in Euro pro Monat, sofern nicht anders angegeben.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- Stammdaten

  const AUSGABEN = [
    { key: "wohnen", label: "Miete / Wohnen inkl. Nebenkosten", kurz: "Wohnen", typ: "bedarf" },
    { key: "energie", label: "Strom & Heizung", kurz: "Strom & Heizung", typ: "bedarf" },
    { key: "lebensmittel", label: "Lebensmittel & Drogerie", kurz: "Lebensmittel", typ: "bedarf" },
    { key: "mobilitaet", label: "Auto, ÖPNV & Mobilität", kurz: "Mobilität", typ: "bedarf" },
    { key: "versicherungen", label: "Versicherungen", kurz: "Versicherungen", typ: "bedarf" },
    { key: "kommunikation", label: "Handy & Internet", kurz: "Handy & Internet", typ: "bedarf" },
    { key: "freizeit", label: "Freizeit, Restaurant & Hobbys", kurz: "Freizeit", typ: "wunsch" },
    { key: "shopping", label: "Kleidung & Shopping", kurz: "Shopping", typ: "wunsch" },
    { key: "abos", label: "Abos & Streaming", kurz: "Abos", typ: "wunsch" },
    { key: "urlaub", label: "Urlaub (auf den Monat umgerechnet)", kurz: "Urlaub", typ: "wunsch" },
    { key: "sonstiges", label: "Sonstiges", kurz: "Sonstiges", typ: "wunsch" },
  ];

  const VERSICHERUNGEN = [
    { key: "haftpflicht", label: "Privathaftpflicht", wichtig: "muss", punkte: 35,
      info: "Schützt vor Schadenersatz in unbegrenzter Höhe. Kostet ca. 5–10 € im Monat." },
    { key: "kranken", label: "Krankenversicherung", wichtig: "muss", punkte: 35,
      info: "In Deutschland Pflicht. Bei Angestellten meist automatisch über den Arbeitgeber." },
    { key: "bu", label: "Berufsunfähigkeit", wichtig: "sehr wichtig", punkte: 30,
      info: "Sichert dein Einkommen, wenn du nicht mehr arbeiten kannst." },
    { key: "hausrat", label: "Hausrat", wichtig: "sinnvoll", punkte: 0,
      info: "Lohnt sich bei wertvoller Einrichtung." },
    { key: "rechtsschutz", label: "Rechtsschutz", wichtig: "optional", punkte: 0,
      info: "Nice to have, keine Pflicht." },
  ];

  const BEREICHE = [
    { key: "budget", titel: "Budget", gruppe: "Budget & Sparquote", gewicht: 1.2 },
    { key: "notgroschen", titel: "Notgroschen", gruppe: "Notgroschen & Schulden", gewicht: 1.2 },
    { key: "schulden", titel: "Schulden", gruppe: "Notgroschen & Schulden", gewicht: 1.0 },
    { key: "vermoegen", titel: "Vermögen", gruppe: "Vermögen & Altersvorsorge", gewicht: 0.8 },
    { key: "rente", titel: "Altersvorsorge", gruppe: "Vermögen & Altersvorsorge", gewicht: 1.0 },
    { key: "versicherung", titel: "Versicherungen", gruppe: "Versicherungen & Ziele", gewicht: 1.0 },
    { key: "ziele", titel: "Sparziele", gruppe: "Versicherungen & Ziele", gewicht: 0.6 },
  ];

  // Annahmen (bewusst einfach und konservativ, alles in heutiger Kaufkraft)
  const ANNAHMEN = {
    renditeReal: 0.03,       // reale Rendite langfristiger Anlagen (z. B. breit gestreute ETFs) nach Inflation
    entnahmeZinsReal: 0.01,  // reale Verzinsung während der Rentenphase
    lebenserwartung: 90,
    rentenNettoQuote: 0.82,  // gesetzliche Rente: brutto → netto (Kranken-/Pflegeversicherung, etwas Steuer)
    privatNettoQuote: 0.85,
    wunschrenteQuote: 0.8,   // Wunsch-Einkommen im Alter: 80 % des heutigen Nettos
    sparquoteZiel: 0.2,
    wohnquoteGrenze: 0.35,
  };

  // Richtwert Nettovermögen in Jahresnettoeinkommen nach Alter (Faustregel)
  const VERMOEGEN_RICHTWERT = [[25, 0], [30, 0.5], [35, 1], [40, 1.5], [45, 2.5], [50, 3.5], [55, 4.5], [60, 6], [67, 8]];

  function beispielDaten() {
    return {
      beispiel: true,
      profil: { name: "", alter: 34, rentenalter: 67, notgroschenMonate: 3 },
      einnahmen: { netto: 3200, sonstige: 0 },
      ausgaben: {
        wohnen: 950, energie: 110, lebensmittel: 380, mobilitaet: 220, versicherungen: 90,
        kommunikation: 55, freizeit: 280, shopping: 120, abos: 45, urlaub: 150, sonstiges: 80,
      },
      sparen: { sparrate: 450, langfristig: 250 },
      vermoegen: { liquide: 6500, depot: 14000, altersvorsorge: 8000, immobilie: 0, sonstiges: 0 },
      schulden: { konsumkredit: 4200, kreditrate: 150, dispo: 0, immobilienkredit: 0 },
      rente: { gesetzlichBrutto: 1550, privat: 180, wunsch: 0 },
      versicherungen: { haftpflicht: true, kranken: true, bu: false, hausrat: true, rechtsschutz: false },
      ziele: [
        { name: "Reise nach Japan", betrag: 5000, angespart: 1200, datum: "2027-09" },
        { name: "Neues Auto", betrag: 15000, angespart: 3000, datum: "2029-06" },
      ],
    };
  }

  function leereDaten() {
    const d = beispielDaten();
    d.beispiel = false;
    d.profil = { name: "", alter: 30, rentenalter: 67, notgroschenMonate: 3 };
    for (const grp of ["einnahmen", "ausgaben", "sparen", "vermoegen", "schulden", "rente"]) {
      for (const k of Object.keys(d[grp])) d[grp][k] = 0;
    }
    for (const k of Object.keys(d.versicherungen)) d.versicherungen[k] = false;
    d.ziele = [];
    return d;
  }

  // ---------------------------------------------------------------- Helfer

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const eurFmt = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const eur = (v) => eurFmt.format(Math.round(v)) + " €";
  const pct = (v, digits = 0) => (v * 100).toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits }) + " %";
  const dez = (v, digits = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const ampel = (score) => (score >= 75 ? "gruen" : score >= 50 ? "gelb" : "rot");

  function interpol(tabelle, x) {
    if (x <= tabelle[0][0]) return tabelle[0][1];
    for (let i = 1; i < tabelle.length; i++) {
      const [x1, y1] = tabelle[i];
      const [x0, y0] = tabelle[i - 1];
      if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
    return tabelle[tabelle.length - 1][1];
  }

  function monateBis(datum, heute) {
    if (!datum) return 0;
    const [j, m] = String(datum).split("-").map(Number);
    if (!j || !m) return 0;
    return (j - heute.getFullYear()) * 12 + (m - (heute.getMonth() + 1));
  }

  // Endwert einer monatlichen Sparrate bei jährlicher Rendite r über n Jahre
  const endwertRate = (monatlich, r, jahre) => (jahre <= 0 ? 0 : r === 0 ? monatlich * 12 * jahre : monatlich * 12 * ((Math.pow(1 + r, jahre) - 1) / r));
  // Barwert einer monatlichen Entnahme über n Jahre
  const barwertRente = (monatlich, r, jahre) => (jahre <= 0 ? 0 : r === 0 ? monatlich * 12 * jahre : monatlich * 12 * ((1 - Math.pow(1 + r, -jahre)) / r));

  // ---------------------------------------------------------------- Analyse

  function analysiere(d, heute) {
    heute = heute || new Date();
    const A = ANNAHMEN;
    const netto = num(d.einnahmen.netto) + num(d.einnahmen.sonstige);
    const alter = num(d.profil.alter);
    const rentenalter = Math.max(num(d.profil.rentenalter), alter);
    const zielMonate = Math.max(1, num(d.profil.notgroschenMonate) || 3);

    // --- Budget
    const posten = AUSGABEN.map((a) => ({ ...a, betrag: num(d.ausgaben[a.key]) }));
    const ausgaben = posten.reduce((s, p) => s + p.betrag, 0);
    const kreditrate = num(d.schulden.kreditrate);
    const sparrate = num(d.sparen.sparrate);
    const langfristig = Math.min(num(d.sparen.langfristig), sparrate);
    const bedarf = posten.filter((p) => p.typ === "bedarf").reduce((s, p) => s + p.betrag, 0) + kreditrate;
    const wuensche = posten.filter((p) => p.typ === "wunsch").reduce((s, p) => s + p.betrag, 0);
    const unverplant = netto - ausgaben - kreditrate - sparrate;
    const sparquote = netto > 0 ? sparrate / netto : 0;
    const wohnquote = netto > 0 ? (num(d.ausgaben.wohnen) + num(d.ausgaben.energie)) / netto : 0;

    let budgetScore;
    if (netto <= 0) budgetScore = 0;
    else if (unverplant < 0) budgetScore = 15;
    else {
      budgetScore = sparquote >= 0.2 ? 100 : sparquote >= 0.15 ? 82 : sparquote >= 0.1 ? 65 : sparquote >= 0.05 ? 45 : 30;
      if (wohnquote > 0.4) budgetScore -= 20;
      else if (wohnquote > A.wohnquoteGrenze) budgetScore -= 10;
    }
    budgetScore = clamp(budgetScore, 0, 100);

    const regel = netto > 0
      ? { bedarf: bedarf / netto, wuensche: wuensche / netto, sparen: sparrate / netto, rest: unverplant / netto }
      : { bedarf: 0, wuensche: 0, sparen: 0, rest: 0 };

    // --- Notgroschen
    const monatsbedarf = ausgaben + kreditrate;
    const liquide = num(d.vermoegen.liquide);
    const notgroschenZiel = monatsbedarf * zielMonate;
    const monateReserve = monatsbedarf > 0 ? liquide / monatsbedarf : 0;
    const notScore = monatsbedarf <= 0 ? 0 : monateReserve >= zielMonate ? 100 : clamp((monateReserve / zielMonate) * 90, 0, 90);
    const ueberschuss = liquide - monatsbedarf * Math.max(6, zielMonate * 2);

    // --- Schulden
    const konsum = num(d.schulden.konsumkredit);
    const dispo = num(d.schulden.dispo);
    const immo = num(d.schulden.immobilienkredit);
    const kreditquote = netto > 0 ? kreditrate / netto : 0;
    let schuldScore;
    if (konsum <= 0 && dispo <= 0 && kreditrate <= 0) schuldScore = 100;
    else if (kreditquote <= 0.05) schuldScore = 85;
    else if (kreditquote <= 0.1) schuldScore = 70;
    else if (kreditquote <= 0.2) schuldScore = 45;
    else schuldScore = 20;
    if (dispo > 0) schuldScore = Math.min(schuldScore, 30);

    // --- Vermögen
    const bausteine = [
      { label: "Konto & Tagesgeld", wert: liquide },
      { label: "Depot / ETFs", wert: num(d.vermoegen.depot) },
      { label: "Altersvorsorge-Verträge", wert: num(d.vermoegen.altersvorsorge) },
      { label: "Immobilie", wert: num(d.vermoegen.immobilie) },
      { label: "Sonstiges", wert: num(d.vermoegen.sonstiges) },
    ];
    const bruttoVermoegen = bausteine.reduce((s, b) => s + b.wert, 0);
    const schuldenGesamt = konsum + dispo + immo;
    const nettoVermoegen = bruttoVermoegen - schuldenGesamt;
    const richtwertFaktor = interpol(VERMOEGEN_RICHTWERT, alter);
    const richtwert = richtwertFaktor * netto * 12;
    const vermoegenQuote = richtwert > 0 ? nettoVermoegen / richtwert : nettoVermoegen >= 0 ? 1 : 0;
    const vermScore = clamp(vermoegenQuote * 100, 0, 100);

    // --- Altersvorsorge
    const wunschrente = num(d.rente.wunsch) > 0 ? num(d.rente.wunsch) : netto * A.wunschrenteQuote;
    const gesetzlichNetto = num(d.rente.gesetzlichBrutto) * A.rentenNettoQuote;
    const privatNetto = num(d.rente.privat) * A.privatNettoQuote;
    const luecke = Math.max(0, wunschrente - gesetzlichNetto - privatNetto);
    const jahreBisRente = Math.max(0, rentenalter - alter);
    const jahreRente = Math.max(1, A.lebenserwartung - rentenalter);
    const kapitalBedarf = barwertRente(luecke, A.entnahmeZinsReal, jahreRente);
    const kapitalProg = num(d.vermoegen.depot) * Math.pow(1 + A.renditeReal, jahreBisRente) + endwertRate(langfristig, A.renditeReal, jahreBisRente);
    const deckung = kapitalBedarf > 0 ? kapitalProg / kapitalBedarf : 1;
    const fehlKapital = Math.max(0, kapitalBedarf - kapitalProg);
    const faktor = endwertRate(1, A.renditeReal, jahreBisRente);
    const zusatzRate = fehlKapital > 0 && faktor > 0 ? fehlKapital / faktor : 0;
    const renteScore = netto <= 0 ? 0 : clamp(deckung * 100, 0, 100);

    // --- Versicherungen
    const vers = VERSICHERUNGEN.map((v) => ({ ...v, vorhanden: !!d.versicherungen[v.key] }));
    let versScore = vers.reduce((s, v) => s + (v.vorhanden ? v.punkte : 0), 0);
    if (!d.versicherungen.haftpflicht || !d.versicherungen.kranken) versScore = Math.min(versScore, 40);
    const arbeitskraft = netto * 12 * jahreBisRente;

    // --- Ziele
    const kurzfristig = Math.max(0, sparrate - langfristig) + Math.max(0, unverplant);
    const ziele = (d.ziele || []).filter((z) => z && (z.name || num(z.betrag) > 0)).map((z) => {
      const offen = Math.max(0, num(z.betrag) - num(z.angespart));
      const monate = monateBis(z.datum, heute);
      const proMonat = offen <= 0 ? 0 : monate > 0 ? offen / monate : offen;
      return { name: z.name || "Sparziel", betrag: num(z.betrag), angespart: num(z.angespart), datum: z.datum, offen, monate, proMonat,
        fortschritt: num(z.betrag) > 0 ? clamp(num(z.angespart) / num(z.betrag), 0, 1) : 0 };
    });
    const zieleBedarf = ziele.reduce((s, z) => s + z.proMonat, 0);
    const zieleDeckung = zieleBedarf > 0 ? kurzfristig / zieleBedarf : 1;
    const zielScore = ziele.length ? clamp(zieleDeckung * 100, 0, 100) : null;

    // --- Bereiche
    const scores = { budget: budgetScore, notgroschen: notScore, schulden: schuldScore, vermoegen: vermScore, rente: renteScore, versicherung: versScore, ziele: zielScore };
    const kennzahl = {
      budget: netto > 0 ? `Sparquote ${pct(sparquote)}` : "Kein Einkommen erfasst",
      notgroschen: `${dez(monateReserve)} von ${zielMonate} Monaten`,
      schulden: dispo > 0 ? `Dispo ${eur(dispo)} im Minus` : konsum > 0 || kreditrate > 0 ? `Raten = ${pct(kreditquote, 1)} vom Netto` : "Schuldenfrei",
      vermoegen: `${eur(nettoVermoegen)} netto`,
      rente: luecke <= 0 ? "Keine Rentenlücke" : `${pct(Math.min(deckung, 9.99))} der Rentenlücke gedeckt`,
      versicherung: vers.filter((v) => v.wichtig === "muss" || v.wichtig === "sehr wichtig").filter((v) => !v.vorhanden).length === 0
        ? "Alles Wichtige abgesichert"
        : "Fehlt: " + vers.filter((v) => (v.wichtig === "muss" || v.wichtig === "sehr wichtig") && !v.vorhanden).map((v) => v.label).join(", "),
      ziele: ziele.length ? `${pct(Math.min(zieleDeckung, 9.99))} der nötigen Rate` : "Keine Ziele erfasst",
    };
    const erklaerung = {
      budget: "Ziel: mindestens 20 % vom Netto sparen, Wohnkosten unter 35 %.",
      notgroschen: `Ziel: ${zielMonate} Monatsausgaben (${eur(notgroschenZiel)}) sofort verfügbar.`,
      schulden: "Ziel: kein Dispo, Kreditraten unter 10 % des Nettos.",
      vermoegen: `Richtwert für ${alter} Jahre: ca. ${dez(richtwertFaktor)} Jahresnettos (${eur(richtwert)}).`,
      rente: `Wunschrente ${eur(wunschrente)}/Monat in heutiger Kaufkraft.`,
      versicherung: "Haftpflicht, Krankenversicherung und Berufsunfähigkeit sind das Fundament.",
      ziele: ziele.length ? `Nötig: ${eur(zieleBedarf)}/Monat, frei verfügbar: ${eur(kurzfristig)}/Monat.` : "Trage Ziele ein, um sie zu planen.",
    };
    const bereiche = BEREICHE.map((b) => ({ ...b, score: scores[b.key], ampel: scores[b.key] == null ? "grau" : ampel(scores[b.key]), kennzahl: kennzahl[b.key], erklaerung: erklaerung[b.key] }));
    const aktiv = bereiche.filter((b) => b.score != null);
    const gewSumme = aktiv.reduce((s, b) => s + b.gewicht, 0);
    const gesamt = Math.round(aktiv.reduce((s, b) => s + b.score * b.gewicht, 0) / (gewSumme || 1));
    const urteil = gesamt >= 75
      ? { titel: "Solide aufgestellt", text: "Deine Finanzen stehen auf einem stabilen Fundament. Feinschliff bringt dich noch weiter." }
      : gesamt >= 50
        ? { titel: "Auf gutem Weg", text: "Die Basis stimmt, aber einige Punkte solltest du gezielt angehen." }
        : { titel: "Handlungsbedarf", text: "Mehrere Bereiche sind noch nicht abgesichert. Die nächsten Schritte zeigen, wo du anfangen solltest." };

    // --- Empfehlungen (prio: kleiner = wichtiger)
    const tipps = [];
    const plus = [];
    const add = (prio, titel, text) => tipps.push({ prio, titel, text });

    if (netto > 0 && unverplant < 0) add(1, "Ausgaben unter das Einkommen bringen", `Du gibst ${eur(-unverplant)} pro Monat mehr aus, als reinkommt. Prüfe zuerst die Wünsche-Ausgaben (${eur(wuensche)}/Monat).`);
    if (dispo > 0) add(2, "Dispo ausgleichen", `${eur(dispo)} im Dispo kosten oft 10–14 % Zinsen. Zahle ihn vor allem anderen zurück.`);
    if (!d.versicherungen.haftpflicht) add(3, "Privathaftpflicht abschließen", "Ein einziger Schaden kann dich ruinieren. Kostet nur ca. 5–10 € im Monat.");
    if (monatsbedarf > 0 && monateReserve < zielMonate) {
      const fehlt = notgroschenZiel - liquide;
      const rate = kurzfristig > 0 ? kurzfristig : sparrate;
      const dauer = rate > 0 ? Math.ceil(fehlt / rate) : null;
      add(monateReserve < 1 ? 3 : 5, "Notgroschen auffüllen", `Es fehlen ${eur(fehlt)} bis ${zielMonate} Monatsausgaben (${eur(notgroschenZiel)}).` + (dauer ? ` Mit ${eur(rate)}/Monat aufs Tagesgeld ist das in ca. ${dauer} Monaten geschafft.` : ""));
    }
    if (!d.versicherungen.bu && jahreBisRente > 0) add(4, "Berufsunfähigkeit absichern", `Deine Arbeitskraft ist bis zur Rente rund ${eur(arbeitskraft)} wert. Eine BU-Versicherung schützt dieses Einkommen. Je jünger und gesünder, desto günstiger.`);
    if (konsum > 0) add(6, "Konsumkredit zügig tilgen", `Restschuld ${eur(konsum)}. Bei Zinsen über ca. 5 % lohnt sich eine Sondertilgung mehr als jede Geldanlage.`);
    if (netto > 0 && unverplant > 50) add(6, "Unverplantes Geld automatisch sparen", `${eur(unverplant)} pro Monat haben keinen Zweck und versickern sonst. Richte einen Dauerauftrag direkt nach dem Gehaltseingang ein.`);
    if (netto > 0 && unverplant >= 0 && sparquote < A.sparquoteZiel) {
      const mehr = netto * A.sparquoteZiel - sparrate;
      add(7, "Sparquote auf 20 % erhöhen", `Aktuell ${pct(sparquote)}. Für 20 % fehlen ${eur(mehr)} im Monat.` + (unverplant > 0 ? ` ${eur(Math.min(unverplant, mehr))} davon hast du schon unverplant übrig.` : ` Am meisten Spielraum steckt in den Wünsche-Ausgaben (${eur(wuensche)}).`));
    }
    if (wohnquote > A.wohnquoteGrenze) add(8, "Wohnkosten im Blick behalten", `Wohnen und Energie kosten ${pct(wohnquote)} deines Nettos. Über 35 % wird es eng, etwa bei Gehaltsverlust oder Mieterhöhung.`);
    if (luecke > 0 && deckung < 1) add(deckung < 0.5 ? 5 : 8, "Rentenlücke schließen", `Bis zur Rente mit ${rentenalter} fehlen rechnerisch ${eur(fehlKapital)}. Mit zusätzlich ${eur(zusatzRate)} pro Monat in breit gestreute ETFs (3 % real angenommen) schließt du die Lücke.`);
    for (const z of ziele) {
      if (z.offen > 0 && z.monate <= 0) add(9, `Ziel „${z.name}“ neu terminieren`, `Das Zieldatum ist erreicht, es fehlen noch ${eur(z.offen)}. Lege ein neues Datum fest.`);
    }
    if (ziele.length && zieleDeckung < 1) add(9, "Sparziele realistisch planen", `Für deine Ziele bräuchtest du ${eur(zieleBedarf)}/Monat, frei verfügbar sind ${eur(kurzfristig)}. Strecke ein Ziel zeitlich oder setze Prioritäten.`);
    if (ueberschuss > 1000 && monateReserve >= zielMonate) add(9, "Zu viel Geld auf dem Konto", `Rund ${eur(ueberschuss)} liegen über einer großzügigen Reserve. Langfristig angelegt arbeitet dieses Geld für dich.`);
    if (vermoegenQuote < 0.75 && richtwert > 0) add(10, "Vermögensaufbau beschleunigen", `Dein Nettovermögen liegt bei ${pct(Math.max(0, vermoegenQuote))} des Richtwerts für dein Alter. Jede Gehaltserhöhung zur Hälfte sparen hilft enorm.`);
    if (!d.versicherungen.hausrat && bruttoVermoegen > 0) add(12, "Hausrat prüfen", "Sinnvoll, wenn deine Einrichtung zusammen mehr wert ist, als du spontan ersetzen könntest.");
    tipps.sort((a, b) => a.prio - b.prio);

    if (sparquote >= A.sparquoteZiel) plus.push(`Starke Sparquote von ${pct(sparquote)}`);
    else if (sparquote >= 0.1) plus.push(`Du sparst regelmäßig ${eur(sparrate)} im Monat`);
    if (monateReserve >= zielMonate) plus.push(`Notgroschen für ${dez(monateReserve)} Monate vorhanden`);
    if (dispo <= 0 && konsum <= 0) plus.push("Keine teuren Konsumschulden");
    else if (dispo <= 0) plus.push("Dispo wird nicht genutzt");
    if (wohnquote > 0 && wohnquote <= 0.3) plus.push(`Wohnkosten bei moderaten ${pct(wohnquote)}`);
    if (d.versicherungen.haftpflicht && d.versicherungen.kranken) plus.push("Haftpflicht und Krankenversicherung vorhanden");
    if (langfristig > 0) plus.push(`${eur(langfristig)}/Monat fließen in den langfristigen Vermögensaufbau`);
    if (nettoVermoegen > 0 && vermoegenQuote >= 1) plus.push("Vermögen über dem Richtwert für dein Alter");

    return {
      heute, netto, ausgaben, posten, kreditrate, sparrate, langfristig, kurzfristig, bedarf, wuensche, unverplant, sparquote, wohnquote, regel,
      monatsbedarf, liquide, notgroschenZiel, monateReserve, zielMonate, ueberschuss,
      konsum, dispo, immo, kreditquote,
      bausteine, bruttoVermoegen, schuldenGesamt, nettoVermoegen, richtwert, richtwertFaktor, vermoegenQuote,
      wunschrente, gesetzlichNetto, privatNetto, luecke, jahreBisRente, jahreRente, kapitalBedarf, kapitalProg, deckung, fehlKapital, zusatzRate,
      vers, arbeitskraft, ziele, zieleBedarf, zieleDeckung,
      bereiche, gesamt, urteil, tipps, plus, alter, rentenalter,
    };
  }

  // ---------------------------------------------------------------- PowerPoint

  const P = {
    navy: "16243A", navy2: "22344F", ink: "1C2533", slate: "5B6778", muted: "8A95A5", line: "DCE2EA",
    bg: "F3F6FA", white: "FFFFFF", blue: "3E6FB0", sky: "9DB8DC", ice: "C9D8EC",
    gruen: "2E9E6A", gelb: "D9A21B", rot: "D0503F", grau: "A3ACB9",
  };
  const AMPEL_FARBE = { gruen: P.gruen, gelb: P.gelb, rot: P.rot, grau: P.grau };
  const AMPEL_TEXT = { gruen: "Gut", gelb: "Ausbaufähig", rot: "Handeln", grau: "Offen" };

  function datumLang(d) {
    return d.toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  }

  function erstellePraesentation(pptx, d, r) {
    const FONT = "Calibri";
    pptx.layout = "LAYOUT_16x9"; // 10 × 5.625 in
    pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
    pptx.title = "Mein Finanz-Check";
    pptx.author = d.profil.name || "Finanz-Check";
    pptx.subject = "Persönlicher Finanz-Check";

    const fuss = `Finanz-Check · ${datumLang(r.heute)}${d.beispiel ? " · Beispieldaten" : ""}`;
    pptx.defineSlideMaster({
      title: "DUNKEL",
      background: { color: P.navy },
      objects: [],
    });
    pptx.defineSlideMaster({
      title: "INHALT",
      background: { color: P.white },
      margin: [0.5, 0.5, 0.5, 0.5],
      objects: [
        { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.32, w: 9, h: 0.7, fontSize: 28, bold: true, color: P.navy, fontFace: FONT, margin: 0, valign: "middle", align: "left" }, text: "" } },
        { text: { text: fuss, options: { x: 0.5, y: 5.2, w: 6.5, h: 0.25, fontSize: 9, color: P.muted, fontFace: FONT, margin: 0 } } },
      ],
      slideNumber: { x: 9.1, y: 5.2, w: 0.4, h: 0.25, fontSize: 9, color: P.muted, fontFace: FONT, align: "right" },
    });

    const T = (slide, text, opt) => slide.addText(text, { isTextBox: true, fontFace: FONT, margin: 0, color: P.ink, ...opt });
    const pill = (slide, x, y, a, w = 1.05) => {
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.26, rectRadius: 0.13, fill: { color: AMPEL_FARBE[a] }, line: { color: AMPEL_FARBE[a] } });
      T(slide, AMPEL_TEXT[a], { x, y, w, h: 0.26, fontSize: 10, bold: true, color: P.white, align: "center", valign: "middle" });
    };
    const card = (slide, x, y, w, h, fill = P.bg) => slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
    const bar = (slide, x, y, w, h, anteil, farbe) => {
      slide.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: h / 2, fill: { color: P.line }, line: { color: P.line } });
      const fw = Math.max(h, w * clamp(anteil, 0, 1));
      if (anteil > 0) slide.addShape(pptx.ShapeType.roundRect, { x, y, w: fw, h, rectRadius: h / 2, fill: { color: farbe }, line: { color: farbe } });
    };
    const chartText = { catAxisLabelColor: P.slate, valAxisLabelColor: P.slate, catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, dataLabelFontFace: FONT, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, dataLabelFontSize: 10, dataLabelColor: P.ink };
    const bereich = (k) => r.bereiche.find((b) => b.key === k);
    const kopfAmpel = (slide, keys) => {
      // Ampeln oben rechts neben dem Titel
      let x = 9.5;
      for (const k of keys.slice().reverse()) {
        const b = bereich(k);
        x -= 1.05;
        pill(slide, x, 0.54, b.ampel);
        x -= 0.12;
      }
    };

    // 1 ─ Titel
    {
      const s = pptx.addSlide({ masterName: "DUNKEL" });
      T(s, "PERSÖNLICHER FINANZ-CHECK", { x: 0.6, y: 0.7, w: 6, h: 0.3, fontSize: 12, bold: true, color: P.sky, charSpacing: 3 });
      T(s, d.profil.name ? `Wie solide sind meine Finanzen, ${d.profil.name}?` : "Wie solide sind meine Finanzen?", { x: 0.6, y: 1.05, w: 5.6, h: 1.5, fontSize: 36, bold: true, color: P.white, valign: "top" });
      T(s, datumLang(r.heute) + (d.beispiel ? "  ·  Beispieldaten" : ""), { x: 0.6, y: 2.75, w: 5.5, h: 0.3, fontSize: 14, color: P.ice });
      T(s, r.urteil.text, { x: 0.6, y: 3.45, w: 5.2, h: 0.9, fontSize: 15, color: P.ice, valign: "top" });
      // Score-Kreis
      const a = ampel(r.gesamt);
      s.addShape(pptx.ShapeType.ellipse, { x: 6.75, y: 1.15, w: 2.6, h: 2.6, fill: { color: P.navy2 }, line: { color: AMPEL_FARBE[a], width: 6 } });
      T(s, String(r.gesamt), { x: 6.75, y: 1.6, w: 2.6, h: 1.1, fontSize: 60, bold: true, color: P.white, align: "center", valign: "middle" });
      T(s, "von 100 Punkten", { x: 6.75, y: 2.65, w: 2.6, h: 0.35, fontSize: 12, color: P.ice, align: "center" });
      T(s, r.urteil.titel, { x: 6.25, y: 4.0, w: 3.6, h: 0.45, fontSize: 20, bold: true, color: AMPEL_FARBE[a] === P.gelb ? "F2C14E" : AMPEL_FARBE[a] === P.gruen ? "5CC995" : "F07C6C", align: "center" });
      s.addNotes(`Gesamtergebnis: ${r.gesamt} von 100 Punkten (${r.urteil.titel}). Der Wert ist ein gewichteter Durchschnitt aus sieben Einzelchecks: Budget, Notgroschen, Schulden, Vermögen, Altersvorsorge, Versicherungen und Sparziele. Ab 75 Punkten gilt die Lage als solide, ab 50 als auf gutem Weg.`);
    }

    // 2 ─ Überblick
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Sieben Checks auf einen Blick", { placeholder: "title" });
      const gruen = r.bereiche.filter((b) => b.ampel === "gruen").length;
      const rot = r.bereiche.filter((b) => b.ampel === "rot").length;
      const gelb = r.bereiche.filter((b) => b.ampel === "gelb").length;
      card(s, 0.5, 1.25, 2.9, 3.7, P.navy);
      T(s, String(r.gesamt), { x: 0.75, y: 1.45, w: 2.4, h: 1.0, fontSize: 54, bold: true, color: P.white });
      T(s, "Punkte gesamt", { x: 0.75, y: 2.4, w: 2.4, h: 0.3, fontSize: 12, color: P.ice });
      T(s, r.urteil.titel, { x: 0.75, y: 2.85, w: 2.4, h: 0.4, fontSize: 18, bold: true, color: P.white });
      const zeilen = [[gruen, "gut", P.gruen], [gelb, "ausbaufähig", P.gelb], [rot, "mit Handlungsbedarf", P.rot]];
      zeilen.forEach(([n, txt, c], i) => {
        const y = 3.45 + i * 0.42;
        s.addShape(pptx.ShapeType.ellipse, { x: 0.78, y: y + 0.06, w: 0.2, h: 0.2, fill: { color: c }, line: { color: c } });
        T(s, `${n} ${txt}`, { x: 1.12, y, w: 2.1, h: 0.32, fontSize: 13, color: P.white, valign: "middle" });
      });
      // Kacheln
      const x0 = 3.7, w = 2.8, h = 0.84, gap = 0.12;
      r.bereiche.forEach((b, i) => {
        const col = i < 4 ? 0 : 1;
        const row = i < 4 ? i : i - 4;
        const x = x0 + col * (w + 0.2);
        const y = 1.25 + row * (h + gap);
        card(s, x, y, w, h);
        s.addShape(pptx.ShapeType.ellipse, { x: x + 0.18, y: y + 0.2, w: 0.2, h: 0.2, fill: { color: AMPEL_FARBE[b.ampel] }, line: { color: AMPEL_FARBE[b.ampel] } });
        T(s, b.titel, { x: x + 0.5, y: y + 0.12, w: w - 1.2, h: 0.32, fontSize: 14, bold: true, color: P.navy, valign: "middle" });
        T(s, b.score == null ? "–" : String(Math.round(b.score)), { x: x + w - 0.75, y: y + 0.12, w: 0.6, h: 0.32, fontSize: 14, bold: true, color: AMPEL_FARBE[b.ampel], align: "right", valign: "middle" });
        T(s, b.kennzahl, { x: x + 0.5, y: y + 0.46, w: w - 0.65, h: 0.28, fontSize: 11, color: P.slate, valign: "middle", fit: "shrink" });
      });
      // 7 Kacheln → rechte Spalte hat 3, freie Zelle unten rechts als Legende
      const ly = 1.25 + 3 * (h + gap);
      T(s, "Punkte je Check: 75–100 gut · 50–74 ausbaufähig · unter 50 Handeln", { x: x0 + w + 0.2 + 0.1, y: ly + 0.1, w: w - 0.2, h: 0.64, fontSize: 10, color: P.muted, valign: "middle" });
      s.addNotes(r.bereiche.map((b) => `${b.titel}: ${b.score == null ? "nicht bewertet" : Math.round(b.score) + " Punkte"} – ${b.kennzahl}. ${b.erklaerung}`).join("\n"));
    }

    // 3 ─ Budget
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Wohin mein Geld jeden Monat fließt", { placeholder: "title" });
      kopfAmpel(s, ["budget"]);
      const zeilen = r.posten.filter((p) => p.betrag > 0).map((p) => ({ label: p.kurz, wert: p.betrag }));
      if (r.kreditrate > 0) zeilen.push({ label: "Kreditraten", wert: r.kreditrate });
      zeilen.sort((a, b) => b.wert - a.wert);
      const top = zeilen.slice(0, 10);
      if (zeilen.length > 10) top.push({ label: "Weitere", wert: zeilen.slice(10).reduce((s2, z) => s2 + z.wert, 0) });
      top.reverse(); // größter Posten oben
      if (top.length) {
        s.addChart(pptx.ChartType.bar, [{ name: "€ pro Monat", labels: top.map((z) => z.label), values: top.map((z) => Math.round(z.wert)) }], {
          x: 0.4, y: 1.15, w: 5.6, h: 3.95, barDir: "bar", chartColors: [P.blue], barGapWidthPct: 45,
          showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '#,##0" €"', valAxisHidden: true,
          valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, catAxisLineShow: false, ...chartText,
        });
      }
      const kpis = [
        ["Netto-Einkommen", eur(r.netto), "pro Monat, inkl. sonstiger Einnahmen", P.navy],
        ["Sparquote", pct(r.sparquote), `${eur(r.sparrate)} von ${eur(r.netto)} · Ziel 20 %`, r.sparquote >= 0.2 ? P.gruen : r.sparquote >= 0.1 ? P.gelb : P.rot],
        [r.unverplant >= 0 ? "Unverplant" : "Monatliches Minus", eur(Math.abs(r.unverplant)), r.unverplant >= 0 ? "bleibt nach Ausgaben und Sparen übrig" : "mehr ausgegeben als eingenommen", r.unverplant >= 0 ? P.navy : P.rot],
        ["Wohnkostenquote", pct(r.wohnquote), "Miete und Energie · Grenze 35 %", r.wohnquote <= 0.35 ? P.gruen : P.gelb],
      ];
      kpis.forEach(([lab, val, sub, c], i) => {
        const y = 1.2 + i * 0.97;
        card(s, 6.3, y, 3.2, 0.85);
        T(s, lab, { x: 6.5, y: y + 0.1, w: 1.5, h: 0.3, fontSize: 11, color: P.slate });
        T(s, val, { x: 7.75, y: y + 0.06, w: 1.6, h: 0.4, fontSize: 20, bold: true, color: c, align: "right" });
        T(s, sub, { x: 6.5, y: y + 0.48, w: 2.85, h: 0.28, fontSize: 10, color: P.muted });
      });
      s.addNotes(`Gesamtausgaben ${eur(r.ausgaben)} plus Kreditraten ${eur(r.kreditrate)}. Sparrate ${eur(r.sparrate)} (${pct(r.sparquote)}). Faustregel: mindestens 20 % des Nettos sparen und nicht mehr als 35 % für Wohnen ausgeben.`);
    }

    // 4 ─ 50/30/20
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Die 50/30/20-Regel im Vergleich", { placeholder: "title" });
      const g = r.regel;
      const labels = ["Bedarf", "Wünsche", "Sparen"];
      const ist = [g.bedarf, g.wuensche, g.sparen].map((v) => Math.round(v * 100));
      s.addChart(pptx.ChartType.bar, [
        { name: "Ziel", labels, values: [50, 30, 20] },
        { name: "Ich", labels, values: ist },
      ], {
        x: 0.4, y: 1.15, w: 5.4, h: 3.9, barDir: "col", barGrouping: "clustered", chartColors: [P.ice, P.navy], barGapWidthPct: 60,
        showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '0" %"', valAxisHidden: true, valAxisMinVal: 0,
        valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: true, legendPos: "t", legendFontFace: FONT, legendFontSize: 11, legendColor: P.slate, ...chartText, catAxisLabelFontSize: 12,
      });
      const zeilen = [
        ["Bedarf", g.bedarf, 0.5, "Miete, Energie, Essen, Mobilität, Versicherungen, Kredite", true],
        ["Wünsche", g.wuensche, 0.3, "Freizeit, Shopping, Abos, Urlaub, Sonstiges", true],
        ["Sparen", g.sparen, 0.2, "Rücklagen, ETFs, Altersvorsorge", false],
      ];
      zeilen.forEach(([lab, v, ziel, sub, maxGrenze], i) => {
        const y = 1.25 + i * 1.12;
        const ok = maxGrenze ? v <= ziel + 0.02 : v >= ziel - 0.02;
        T(s, lab, { x: 6.1, y, w: 1.8, h: 0.32, fontSize: 15, bold: true, color: P.navy });
        T(s, `${pct(v)} statt ${pct(ziel)}`, { x: 7.5, y, w: 2.0, h: 0.32, fontSize: 13, bold: true, color: ok ? P.gruen : P.gelb, align: "right" });
        T(s, sub, { x: 6.1, y: y + 0.36, w: 3.4, h: 0.5, fontSize: 11, color: P.slate, valign: "top" });
      });
      T(s, r.regel.rest >= 0 ? `Unverplant: ${pct(r.regel.rest)} (${eur(r.unverplant)})` : `Defizit: ${pct(-r.regel.rest)} (${eur(-r.unverplant)})`, { x: 6.1, y: 4.6, w: 3.4, h: 0.3, fontSize: 12, bold: true, color: r.regel.rest >= 0 ? P.slate : P.rot });
      s.addNotes("Die 50/30/20-Regel ist eine einfache Orientierung: höchstens 50 % des Nettos für Notwendiges, höchstens 30 % für Wünsche und mindestens 20 % zum Sparen. Bedarf enthält hier auch Kreditraten.");
    }

    // 5 ─ Notgroschen & Schulden
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Sicherheitsnetz: Notgroschen und Schulden", { placeholder: "title" });
      const nb = bereich("notgroschen");
      const sb = bereich("schulden");
      // links
      card(s, 0.5, 1.2, 4.35, 3.8);
      T(s, "Notgroschen", { x: 0.75, y: 1.4, w: 2.5, h: 0.35, fontSize: 16, bold: true, color: P.navy });
      pill(s, 3.55, 1.45, nb.ampel);
      T(s, [{ text: dez(r.monateReserve), options: { fontSize: 48, bold: true, color: AMPEL_FARBE[nb.ampel] } }, { text: "  Monate", options: { fontSize: 18, color: P.slate } }], { x: 0.75, y: 1.9, w: 3.9, h: 0.9 });
      bar(s, 0.75, 2.95, 3.85, 0.2, r.monateReserve / r.zielMonate, AMPEL_FARBE[nb.ampel]);
      T(s, `${eur(r.liquide)} von ${eur(r.notgroschenZiel)} (${r.zielMonate} Monatsausgaben)`, { x: 0.75, y: 3.25, w: 3.85, h: 0.3, fontSize: 11, color: P.slate });
      T(s, r.monateReserve >= r.zielMonate
        ? "Reicht, um unerwartete Ausgaben oder eine Jobpause ohne Kredit zu überbrücken."
        : `Noch ${eur(r.notgroschenZiel - r.liquide)} bis zum Ziel. Der Notgroschen hat Vorrang vor Geldanlage.`, { x: 0.75, y: 3.75, w: 3.85, h: 0.9, fontSize: 13, color: P.ink, valign: "top" });
      // rechts
      card(s, 5.15, 1.2, 4.35, 3.8);
      T(s, "Schulden", { x: 5.4, y: 1.4, w: 2.5, h: 0.35, fontSize: 16, bold: true, color: P.navy });
      pill(s, 8.2, 1.45, sb.ampel);
      T(s, [{ text: pct(r.kreditquote, 1), options: { fontSize: 48, bold: true, color: AMPEL_FARBE[sb.ampel] } }, { text: "  vom Netto", options: { fontSize: 18, color: P.slate } }], { x: 5.4, y: 1.9, w: 3.9, h: 0.9 });
      T(s, `Monatliche Kreditraten: ${eur(r.kreditrate)} · Grenze 10 %`, { x: 5.4, y: 2.9, w: 3.85, h: 0.3, fontSize: 11, color: P.slate });
      const posten = [["Konsumkredit", r.konsum], ["Dispo", r.dispo], ["Immobilienkredit", r.immo]];
      posten.forEach(([lab, v], i) => {
        const y = 3.35 + i * 0.5;
        s.addShape(pptx.ShapeType.line, { x: 5.4, y: y - 0.04, w: 3.85, h: 0, line: { color: P.line, width: 1 } });
        T(s, lab, { x: 5.4, y, w: 2.2, h: 0.4, fontSize: 13, color: P.ink, valign: "middle" });
        T(s, v > 0 ? eur(v) : "keine", { x: 7.5, y, w: 1.75, h: 0.4, fontSize: 13, bold: true, color: lab === "Dispo" && v > 0 ? P.rot : P.navy, align: "right", valign: "middle" });
      });
      s.addNotes(`Notgroschen: ${eur(r.liquide)} sofort verfügbar, das entspricht ${dez(r.monateReserve)} Monatsausgaben (Monatsbedarf ${eur(r.monatsbedarf)}). Empfehlung für Singles in Anstellung: 3 Monatsausgaben auf Tagesgeld. Schulden: Ein Dispo sollte nie dauerhaft genutzt werden; Konsumkredit-Raten idealerweise unter 10 % des Nettos.`);
    }

    // 6 ─ Vermögen
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Mein Vermögen", { placeholder: "title" });
      kopfAmpel(s, ["vermoegen"]);
      const bs = r.bausteine.filter((b) => b.wert > 0);
      if (r.schuldenGesamt > 0) bs.push({ label: "Schulden", wert: -r.schuldenGesamt });
      if (bs.length) {
        s.addChart(pptx.ChartType.bar, [{ name: "Vermögen", labels: bs.map((b) => b.label), values: bs.map((b) => Math.round(b.wert)) }], {
          x: 0.4, y: 1.15, w: 5.6, h: 3.9, barDir: "col", chartColors: [P.blue], invertIfNegative: false, barGapWidthPct: 55,
          showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: '#,##0" €";-#,##0" €"', valAxisHidden: true,
          valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, ...chartText, catAxisLabelFontSize: 10,
        });
      }
      const vb = bereich("vermoegen");
      card(s, 6.3, 1.2, 3.2, 3.8, P.navy);
      T(s, "Nettovermögen", { x: 6.55, y: 1.4, w: 2.8, h: 0.3, fontSize: 12, color: P.ice });
      T(s, eur(r.nettoVermoegen), { x: 6.55, y: 1.72, w: 2.8, h: 0.6, fontSize: 30, bold: true, color: P.white, fit: "shrink" });
      T(s, `Richtwert mit ${r.alter} Jahren`, { x: 6.55, y: 2.55, w: 2.8, h: 0.3, fontSize: 12, color: P.ice });
      T(s, eur(r.richtwert), { x: 6.55, y: 2.85, w: 2.8, h: 0.45, fontSize: 20, bold: true, color: P.white });
      bar(s, 6.55, 3.5, 2.7, 0.18, r.vermoegenQuote, vb.ampel === "gruen" ? "5CC995" : vb.ampel === "gelb" ? "F2C14E" : "F07C6C");
      T(s, `${pct(Math.max(0, r.vermoegenQuote))} des Richtwerts erreicht`, { x: 6.55, y: 3.8, w: 2.8, h: 0.3, fontSize: 12, color: P.white });
      T(s, `Faustregel: ca. ${dez(r.richtwertFaktor)} × Jahresnetto`, { x: 6.55, y: 4.3, w: 2.8, h: 0.5, fontSize: 10, color: P.ice, valign: "top" });
      s.addNotes(`Bruttovermögen ${eur(r.bruttoVermoegen)}, Schulden ${eur(r.schuldenGesamt)}, Nettovermögen ${eur(r.nettoVermoegen)}. Der Richtwert ist eine grobe Faustregel (Vielfaches des Jahresnettos je nach Alter: 30 J. 0,5×, 40 J. 1,5×, 50 J. 3,5×, 60 J. 6×, 67 J. 8×) und dient nur der Orientierung.`);
    }

    // 7 ─ Altersvorsorge
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText(r.luecke > 0 ? "Altersvorsorge: Wie groß ist meine Rentenlücke?" : "Altersvorsorge: Meine Rente reicht", { placeholder: "title" });
      const g = Math.round(r.gesetzlichNetto), p = Math.round(r.privatNetto), l = Math.round(r.luecke), w = Math.round(r.wunschrente);
      s.addChart(pptx.ChartType.bar, [
        { name: "Wunschrente", labels: ["Wunsch", "Erwartet"], values: [w, 0] },
        { name: "Gesetzliche Rente (netto)", labels: ["Wunsch", "Erwartet"], values: [0, g] },
        { name: "Privat / Betrieblich", labels: ["Wunsch", "Erwartet"], values: [0, p] },
        { name: "Lücke", labels: ["Wunsch", "Erwartet"], values: [0, l] },
      ], {
        x: 0.4, y: 1.15, w: 4.9, h: 3.95, barDir: "col", barGrouping: "stacked", chartColors: [P.navy, P.blue, P.sky, P.rot], barGapWidthPct: 70,
        showValue: true, dataLabelPosition: "ctr", dataLabelFormatCode: '#,##0" €";;', dataLabelColor: P.white, valAxisHidden: true,
        valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: true, legendPos: "b", legendFontFace: FONT, legendFontSize: 10, legendColor: P.slate,
        ...chartText, dataLabelColor: P.white, catAxisLabelFontSize: 12,
      });
      const rb = bereich("rente");
      const y0 = 1.2;
      card(s, 5.6, y0, 3.9, 3.8);
      T(s, `Bis zur Rente mit ${r.rentenalter}`, { x: 5.85, y: y0 + 0.2, w: 2.4, h: 0.35, fontSize: 15, bold: true, color: P.navy });
      pill(s, 8.2, y0 + 0.24, rb.ampel);
      const rows = [
        ["Benötigtes Kapital", eur(r.kapitalBedarf)],
        ["Voraussichtlich angespart", eur(r.kapitalProg)],
        ["Deckung", pct(Math.min(r.deckung, 9.99))],
      ];
      rows.forEach(([lab, v], i) => {
        const y = y0 + 0.75 + i * 0.5;
        T(s, lab, { x: 5.85, y, w: 2.2, h: 0.4, fontSize: 13, color: P.slate, valign: "middle" });
        T(s, v, { x: 7.6, y, w: 1.7, h: 0.4, fontSize: 15, bold: true, color: P.navy, align: "right", valign: "middle" });
      });
      bar(s, 5.85, y0 + 2.35, 3.45, 0.18, r.deckung, AMPEL_FARBE[rb.ampel]);
      T(s, r.fehlKapital > 0
        ? [{ text: `+ ${eur(r.zusatzRate)} pro Monat`, options: { bold: true, color: P.navy, fontSize: 15, breakLine: true } }, { text: "zusätzlich langfristig anlegen schließt die Lücke", options: { color: P.slate, fontSize: 12 } }]
        : [{ text: "Auf Kurs", options: { bold: true, color: P.gruen, fontSize: 15, breakLine: true } }, { text: "Deine Vorsorge deckt die Wunschrente rechnerisch ab.", options: { color: P.slate, fontSize: 12 } }],
        { x: 5.85, y: y0 + 2.75, w: 3.45, h: 0.85, valign: "top" });
      s.addNotes(`Alle Werte in heutiger Kaufkraft. Wunschrente ${eur(w)} (Standard: 80 % des heutigen Nettos). Gesetzliche Rente netto geschätzt mit 82 % der Bruttorente laut Renteninformation, private/betriebliche Rente mit 85 %. Die Lücke von ${eur(l)} pro Monat über ${r.jahreRente} Rentenjahre (bis 90) erfordert ca. ${eur(r.kapitalBedarf)} Kapital (1 % reale Verzinsung in der Entnahmephase). Prognose: Depot und langfristige Sparrate von ${eur(r.langfristig)} mit 3 % realer Rendite über ${r.jahreBisRente} Jahre.`);
    }

    // 8 ─ Versicherungen & Ziele
    {
      const s = pptx.addSlide({ masterName: "INHALT" });
      s.addText("Absicherung und Sparziele", { placeholder: "title" });
      T(s, "Versicherungen", { x: 0.5, y: 1.2, w: 3, h: 0.35, fontSize: 16, bold: true, color: P.navy });
      r.vers.forEach((v, i) => {
        const y = 1.7 + i * 0.64;
        const wichtig = v.wichtig === "muss" || v.wichtig === "sehr wichtig";
        const c = v.vorhanden ? P.gruen : wichtig ? P.rot : P.grau;
        s.addShape(pptx.ShapeType.ellipse, { x: 0.5, y: y + 0.04, w: 0.36, h: 0.36, fill: { color: c }, line: { color: c } });
        T(s, v.vorhanden ? "✓" : wichtig ? "!" : "–", { x: 0.5, y: y + 0.04, w: 0.36, h: 0.36, fontSize: 14, bold: true, color: P.white, align: "center", valign: "middle" });
        T(s, v.label, { x: 1.0, y: y - 0.02, w: 2.6, h: 0.28, fontSize: 13, bold: true, color: P.ink });
        T(s, (v.vorhanden ? "vorhanden" : "fehlt") + " · " + v.wichtig, { x: 1.0, y: y + 0.25, w: 2.8, h: 0.24, fontSize: 10, color: v.vorhanden ? P.slate : wichtig ? P.rot : P.muted });
      });
      // Ziele
      T(s, "Sparziele", { x: 4.3, y: 1.2, w: 3, h: 0.35, fontSize: 16, bold: true, color: P.navy });
      if (!r.ziele.length) {
        card(s, 4.3, 1.7, 5.2, 1.0);
        T(s, "Noch keine Sparziele erfasst. Konkrete Ziele mit Betrag und Datum machen Sparen leichter.", { x: 4.5, y: 1.8, w: 4.8, h: 0.8, fontSize: 13, color: P.slate, valign: "middle" });
      }
      r.ziele.slice(0, 4).forEach((z, i) => {
        const y = 1.7 + i * 0.82;
        card(s, 4.3, y, 5.2, 0.72);
        T(s, z.name, { x: 4.5, y: y + 0.08, w: 2.6, h: 0.28, fontSize: 13, bold: true, color: P.ink, fit: "shrink" });
        const bis = z.datum ? z.datum.split("-").reverse().join("/") : "ohne Datum";
        T(s, `${eur(z.betrag)} bis ${bis}`, { x: 7.0, y: y + 0.08, w: 2.3, h: 0.28, fontSize: 11, color: P.slate, align: "right" });
        bar(s, 4.5, y + 0.44, 2.4, 0.13, z.fortschritt, P.blue);
        T(s, z.offen <= 0 ? "erreicht" : `${eur(z.proMonat)}/Monat nötig`, { x: 7.0, y: y + 0.38, w: 2.3, h: 0.26, fontSize: 11, bold: true, color: z.offen <= 0 ? P.gruen : P.navy, align: "right" });
      });
      if (r.ziele.length) {
        const y = 1.7 + Math.min(4, r.ziele.length) * 0.82 + 0.05;
        T(s, `Für alle Ziele nötig: ${eur(r.zieleBedarf)}/Monat · frei verfügbar: ${eur(r.kurzfristig)}/Monat`, { x: 4.3, y, w: 5.2, h: 0.3, fontSize: 11, bold: true, color: r.zieleDeckung >= 1 ? P.gruen : P.gelb });
      }
      s.addNotes(`Versicherungen: Privathaftpflicht und Krankenversicherung sind Pflicht-Fundament, die Berufsunfähigkeitsversicherung ist für Angestellte die wichtigste Ergänzung (Wert der Arbeitskraft bis zur Rente ca. ${eur(r.arbeitskraft)}). Sparziele werden aus dem kurzfristigen Sparanteil plus unverplantem Geld finanziert (${eur(r.kurzfristig)}/Monat).`);
    }

    // 9 ─ Nächste Schritte
    {
      const s = pptx.addSlide({ masterName: "DUNKEL" });
      T(s, "Meine nächsten Schritte", { x: 0.6, y: 0.45, w: 8.8, h: 0.7, fontSize: 30, bold: true, color: P.white });
      const top = r.tipps.slice(0, 4);
      if (!top.length) top.push({ titel: "Weiter so", text: "Alle Checks sind im grünen Bereich. Überprüfe deine Finanzen einmal im Jahr." });
      top.forEach((t, i) => {
        const y = 1.35 + i * 0.86;
        s.addShape(pptx.ShapeType.ellipse, { x: 0.6, y: y + 0.05, w: 0.48, h: 0.48, fill: { color: P.blue }, line: { color: P.blue } });
        T(s, String(i + 1), { x: 0.6, y: y + 0.05, w: 0.48, h: 0.48, fontSize: 16, bold: true, color: P.white, align: "center", valign: "middle" });
        T(s, t.titel, { x: 1.3, y, w: 4.9, h: 0.3, fontSize: 15, bold: true, color: P.white });
        T(s, t.text, { x: 1.3, y: y + 0.3, w: 4.9, h: 0.5, fontSize: 10.5, color: P.ice, valign: "top", fit: "shrink" });
      });
      s.addShape(pptx.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 2.9, h: 3.4, rectRadius: 0.08, fill: { color: P.navy2 }, line: { color: P.navy2 } });
      T(s, "Das läuft schon gut", { x: 6.85, y: 1.55, w: 2.5, h: 0.35, fontSize: 14, bold: true, color: "5CC995" });
      const plus = r.plus.length ? r.plus.slice(0, 5) : ["Du hast den ersten Schritt gemacht und deine Zahlen erfasst"];
      T(s, plus.map((p, i) => ({ text: p, options: { bullet: { indent: 12 }, breakLine: i < plus.length - 1, paraSpaceAfter: 6 } })), { x: 6.85, y: 2.0, w: 2.5, h: 2.6, fontSize: 11, color: P.white, valign: "top" });
      T(s, "Hinweis: Diese Auswertung ersetzt keine individuelle Finanzberatung.", { x: 0.6, y: 5.1, w: 8.8, h: 0.25, fontSize: 9, color: P.muted });
      s.addNotes(r.tipps.map((t, i) => `${i + 1}. ${t.titel}: ${t.text}`).join("\n") || "Keine dringenden Maßnahmen.");
    }

    return pptx;
  }

  const api = { AUSGABEN, VERSICHERUNGEN, BEREICHE, ANNAHMEN, beispielDaten, leereDaten, analysiere, erstellePraesentation, format: { eur, pct, dez } };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FinanzCheck = api;
})(typeof window !== "undefined" ? window : globalThis);
