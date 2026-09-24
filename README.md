# moxd Lab — Play

Ein begehbares 3D-Labor mit drei interaktiven Minispielen, umgesetzt mit Three.js und Vite.

**[Im Browser spielen](https://kneater.github.io/moxd-lab-game/)**

## Die Stationen

1. **Abstandsmelder:** Bauteile platzieren, verkabeln und die Abstandsmessung ausprobieren.
2. **Lötstation – Ruhige Hand:** Den Lötkolben mit der Maus führen, Drift ausgleichen und vier Kontakte verbinden. Lötzinn wird automatisch zugeführt.
3. **3D-Druck – Dein Platinenhalter:** Für drei Platinenformen eine Kontur zeichnen, den eigenen Halter drucken und die Platine per Drag-and-drop einpassen. Zu enge Halter leuchten rot; bei zu viel Spiel blinkt und wackelt die Platine orange. Danach fährt sie zurück.

## Steuerung

Am besten mit Maus und Tastatur auf einem Desktop oder Laptop spielen. Der Browser benötigt WebGL2.

- **WASD:** Bewegen; **Maus:** Umsehen; **E:** Markierte Station öffnen.
- **Esc:** Pause bzw. zurück ins Lab. **?:** Anleitung zur aktuellen Bedienung.
- Alle Stationen lassen sich auch direkt über das Startmenü öffnen.
- Fortschritt wird lokal im jeweiligen Browser gespeichert. Es gibt keine Anmeldung, keinen Server-Spielstand und keinen Mehrspielermodus.

## Lokal starten

Node.js 24 und npm installieren, dann im Repository:

```sh
npm ci
npm run dev
```

Öffnen: http://127.0.0.1:5173/

```sh
npm test
npm run build
npm run preview
```

Die Produktionsvorschau läuft unter http://127.0.0.1:4173/. Der fertige Web-Build liegt in `dist/`.

## Veröffentlichung

GitHub Pages verwendet **GitHub Actions** als Quelle. `.github/workflows/pages.yml` prüft jeden Push auf `main` und veröffentlicht nach erfolgreichen Tests den Build. Pull Requests werden nur getestet und gebaut.

Die Anwendung verwendet relative Asset-Pfade und funktioniert daher auch unter `/moxd-lab-game/`. Bei einem Transfer zu einer Organisation bleibt der Code unverändert; Pages-Einstellungen und den Spiel-Link in dieser README anschließend prüfen bzw. aktualisieren. Die alte Pages-Adresse wird von GitHub nicht automatisch weitergeleitet.

## Dateien und Modelle

- `src/`: Spielzustände, Three.js-Szenen und Benutzeroberfläche.
- `public/models/`: Für den Browser exportierte Blender-Modelle; alle zum Spielen benötigten Assets sind enthalten.
- `tests/`: Spielabläufe und Prüfungen der Modellqualität. Die Dreieckszahl des ursprünglichen Lab-Exports steht als Vergleichswert in `tests/fixtures/lab-source-metrics.json`.
- `scripts/optimize-assets.mjs`: Optionaler lokaler GLB-Optimierer. Legt Sicherungen neben dem Repository unter `../work/game-source-assets/` ab. Nicht für Build oder Hosting erforderlich.

Die ursprünglichen Blender-Arbeitsdateien und Referenzfotos werden separat im lokalen Blender-Projekt aufbewahrt. Die Löt- und Druckmechaniken sind vereinfachte Lernsimulationen; das Spiel steuert keine reale Hardware.
