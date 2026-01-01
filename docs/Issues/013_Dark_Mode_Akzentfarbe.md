## Issue 013: Light/Dark Mode + Akzentfarbe (UI-Settings inkl. Farbwahl) 🌗🎨

### Kontext

Die App läuft im Dev-Modus stabil. In den Einstellungen fehlen noch visuelle Anpassungen (Theme, Akzentfarbe), die für UX und Branding relevant sind.

### Ziel

In den Einstellungen sollen Nutzer:

1. zwischen **Light** und **Dark Mode** umschalten können (Switch),
2. eine **Akzentfarbe** auswählen können (Farbwahlfeld + Paletten + Farbring),
3. den **Hex-Wert (#RRGGBB)** sehen und optional direkt editieren,
4. Änderungen **persistieren** und beim Start wiederherstellen.

### Umfang

* Settings-UI (linke Spalte) erweitern:

  * Link/Info-Text zur Erklärung
  * Akzentfarbe: Farbwahlfeld + vordefinierte Paletten + Farbring, Hex-Anzeige
  * Theme: Light/Dark Toggle (Switch) + kurzer Erklärungstext + „An/Aus“-Button (falls du zusätzlich einen Button willst)
* Technische Umsetzung:

  * Theme & Akzentfarbe über **CSS-Variablen** (z. B. `--accent`, `--bg`, `--fg`) oder über ein Theme-System im Frontend
  * Persistenz via Store/Settings (z. B. Tauri Store Plugin oder vorhandener Settings-Mechanismus)

### Aufgaben

* [ ] UI in `Settings.tsx` erweitern:

  * [ ] Abschnitt „Darstellung“
  * [ ] Akzentfarbe: Color Picker (Farbring), plus Palette-Chips
  * [ ] Hex-Wert anzeigen (z. B. `#3B82F6`) + Copy-Button (optional)
  * [ ] Theme: Switch (Light/Dark) + kurzer Erklärungstext
  * [ ] Optional: zusätzlicher Button „An/Aus“ (falls gewünscht; ansonsten Switch allein)
* [ ] Theme-Implementierung:

  * [ ] CSS-Variablen definieren (global, z. B. in `App.css` oder `globals.css`)
  * [ ] Bei Theme-Wechsel `data-theme="light|dark"` am Root setzen **oder** Klassenansatz
* [ ] Akzentfarbe anwenden:

  * [ ] Akzent als CSS-Variable setzen (z. B. `--accent: #...`)
  * [ ] Buttons/Links/Highlights nutzen Akzentfarbe konsistent
* [ ] Persistenz:

  * [ ] `settings.theme` und `settings.accentColor` speichern
  * [ ] Beim App-Start laden und anwenden (vor Render oder sehr früh im UI)
* [ ] Validierung/UX:

  * [ ] Hex-Eingabe validieren (nur `#RRGGBB`)
  * [ ] Fallback auf Default bei ungültigen Werten

### Akzeptanzkriterien

* Nutzer kann Light/Dark umschalten; UI wechselt sofort sichtbar.
* Nutzer kann Akzentfarbe über Farbring oder Palette wählen; Hex wird angezeigt.
* Akzentfarbe wirkt auf definierte UI-Elemente (mind. Buttons/Links/aktive Auswahl).
* Nach Neustart werden Theme und Akzentfarbe korrekt wiederhergestellt.

### Hinweise

* Wenn ihr bereits eine Settings-Persistenz habt (z. B. Vault-Pfad), daran anschließen, statt ein zweites System einzuführen.

---
