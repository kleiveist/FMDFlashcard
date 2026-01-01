# App-Icons & Branding-Assets hinzufügen (Tauri Bundle-Icons)

## Kontext
Projektgerüst und MVP-Vault-Browser funktionieren. Icons/Branding sind noch Standardwerte.

## Ziel
Ein vollständiges Icon-Set bereitstellen und in das Tauri-Bundle integrieren, sodass die App das korrekte Icon zeigt in:
- Fenstertitel/Task-Switcher
- Desktop-Launcher (Linux)
- App-Bundle (Windows/macOS)

## Umfang
- Ein SVG als *Quelle* erstellen + Export PNG/ICO/ICNS (oder Tauri-Icon-Tooling nutzen).
- Tauri-Konfiguration so anpassen, dass die generierten Icons genutzt werden.
- Verifizieren, dass `tauri build` die Icons übernimmt.

## Aufgaben
- [x] Ein **Source-Logo (SVG)** unter `assets/brand/` erstellen.
- [x] Benötigte Icon-Größen generieren (Tauri Icon-Set).
- [x] Generierte Dateien nach `apps/fmd-desktop/src-tauri/icons/` ablegen.
- [x] `apps/fmd-desktop/src-tauri/tauri.conf.json` (bzw. v2 config) auf die Icons verweisen lassen.
- [?] Unter Linux prüfen: `.desktop`-Eintrag zeigt Icon (falls vorhanden).
- [?] `pnpm tauri build` ausführen und sicherstellen, dass das Bundle die richtigen Icons enthält.

## Akzeptanzkriterien
- `pnpm tauri build` läuft durch und die gebaute App zeigt das neue Icon.
- Keine Referenzen auf Standard-Tauri-Icons verbleiben in der Bundle-Konfiguration.

## Hinweise
Tauri kann Icons generieren via `tauri icon <pfad-zur-quelle>`.
