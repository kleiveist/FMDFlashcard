# Vault-Auswahl speichern und beim Start wiederherstellen

## Kontext
Die Vault-Auswahl liegt aktuell nur im React-State. Nach einem Neustart muss der Vault erneut gewählt werden.

## Ziel
Den Vault-Pfad persistent speichern und beim App-Start automatisch wiederherstellen (inkl. erneuter Dateiliste).

## Umfang
- Vault-Pfad dauerhaft speichern (bevorzugt: Tauri Store Plugin; Fallback: JSON im App-Data-Dir).
- Beim Start: gespeicherten Pfad laden; falls gültig, Dateiliste automatisch laden.

## Aufgaben
- [ ] Speichermethode festlegen:
  - [ ] Bevorzugt: `@tauri-apps/plugin-store`
  - [ ] Fallback: JSON-Datei über Rust-Command im App-Data-Directory
- [ ] `loadSettings()` beim App-Init ergänzen (z. B. in `App.tsx`).
- [ ] `saveVaultPath()` bei Vault-Auswahl implementieren.
- [ ] Beim Start (gültiger Pfad): Listing starten und UI-State setzen.
- [ ] Ungültigen Pfad sauber behandeln (Hinweis anzeigen + gespeicherten Wert löschen/ignorieren).

## Akzeptanzkriterien
- Neustart der App stellt den letzten Vault und die Dateiliste ohne User-Interaktion wieder her.
- Bei ungültigem Pfad wird eine klare Meldung angezeigt und die App stürzt nicht ab.

## Hinweise
UI nutzt bereits Folder-Picker (`@tauri-apps/plugin-dialog`) und Backend-Commands für Listing/Read.
