# Vault-Watcher: inkrementelles Re-Scan bei Dateiänderungen

## Kontext
Manuelles Rescanning ist für MVP ok, wird aber bei großen Vaults langsam.

## Ziel
Watcher hinzufügen, der Änderungen im Vault erkennt und aktualisiert:
- Markdown-Dateiliste
- ggf. extrahierte Cards

## Umfang
- Create/Update/Delete von `.md` Files beobachten.
- Burst-Debounce.
- UI zeigt „Updating…“ Status.

## Aufgaben
- [ ] Watcher im Rust-Backend implementieren (empfohlen) via Notify-Crate.
- [ ] Events an Frontend senden.
- [ ] Dateiliste inkrementell aktualisieren (Full-Rescan vermeiden, wenn möglich).
- [ ] Rename/Move Events behandeln (falls verfügbar).

## Akzeptanzkriterien
- Edit/Add/Remove einer Markdown-Datei aktualisiert UI automatisch innerhalb kurzer Zeit.
- Keine übermäßige CPU-Last bei großen Vaults.

## Hinweise
Optional per Settings abschaltbar.
