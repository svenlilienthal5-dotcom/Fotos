# Fotos

Zeigt ein zufälliges Foto aus Tallinn.

## Fotos vom iPhone hochladen

1. In der **Fotos**-App die Tallinn-Bilder auswählen → **Teilen** → **In „Dateien“ sichern**.
   (HEIC-Bilder zeigt Safari an. Andere Browser brauchen JPG: dafür unter *Einstellungen → Kamera → Formate* „Maximale Kompatibilität“ wählen.)
2. In **Safari** `github.com/svenlilienthal5-dotcom/Fotos` öffnen und in den Ordner `tallinn/` wechseln.
3. **Add file → Upload files** antippen, die Bilder aus „Dateien“ auswählen und **Commit changes** drücken.

## Zufallsfoto anzeigen

**Im Browser (auch auf dem iPhone):** GitHub Pages für das Repository aktivieren
(*Settings → Pages → Branch auswählen → Save*). Danach liefert
`https://svenlilienthal5-dotcom.github.io/Fotos/` bei jedem Aufruf bzw. Tippen auf
„Neues Zufallsfoto“ ein anderes Bild. Die Seite liest die Bilder live aus `tallinn/`,
neue Fotos erscheinen also ohne weitere Änderungen.

**Am Computer:**

```bash
python3 zufallsfoto.py          # Pfad eines zufälligen Fotos ausgeben
python3 zufallsfoto.py --open   # und direkt öffnen
```

## Finanz-Check (`finanz-check/`)

Web-App, die prüft, ob du finanziell solide aufgestellt bist: 7 Checks mit Ampel
(Budget, Notgroschen, Schulden, Vermögen, Altersvorsorge, Versicherungen, Sparziele),
eine Gesamtpunktzahl und konkrete nächste Schritte. Per Knopfdruck entsteht eine
PowerPoint-Präsentation mit deinen Zahlen.

- **Öffnen:** Mit aktiviertem GitHub Pages unter `https://svenlilienthal5-dotcom.github.io/Fotos/finanz-check/`,
  oder am Computer `finanz-check/index.html` über einen lokalen Webserver
  (`python3 -m http.server` im Repo-Ordner, dann `http://localhost:8000/finanz-check/`).
- **Datenschutz:** Alle Eingaben bleiben im Browser (localStorage). Mit „Daten sichern“
  lädst du eine JSON-Sicherung herunter, mit „Sicherung laden“ spielst du sie wieder ein.
- **Beispiel:** `finanz-check/Beispiel-Praesentation.pptx` zeigt die Präsentation mit Musterdaten.
- Die Bewertungslogik und der PowerPoint-Aufbau stecken in `finanz-check/finanzcheck.js`.
  `vendor/pptxgen.bundle.js` ist die Bibliothek PptxGenJS 3.12.0 (MIT-Lizenz).
