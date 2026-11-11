# Fotos

Zeigt ein zufälliges Foto aus Tallinn.

Wer hinter den Fotos steckt: [Persönliches Profil](profil.md)

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
