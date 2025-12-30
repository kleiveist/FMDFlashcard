# Review-State persistieren (Start: JSON; SQLite-Migration planen)

## Kontext
Scheduling-State muss Neustarts überleben. Start simpel, aber mit klarer Migrationsroute.

## Ziel
Pro-Card Review-State auf Disk speichern und beim Start laden.

## Umfang
- Phase 1: JSON-File in App-Data-Directory.
- Phase 2: SQLite-Migration planen (Schema definieren; nicht zwingend komplett implementieren).

## Aufgaben
- [ ] Stabiles Card-ID-Schema festlegen (Hash aus File-Pfad + Card-Index + Question-Text).
- [ ] Read/Write von `review_state.json` (oder Store-Plugin) implementieren.
- [ ] State beim Start laden und mit extrahierten Cards mergen.
- [ ] Kurzes SQLite-Schema-Proposal schreiben (Tabellen, Indexe).

## Akzeptanzkriterien
- Nach Review + Neustart bleiben Due Dates/States erhalten.
- State-Datei liegt im OS-spezifischen App-Data-Dir (nicht im Repo).

## Hinweise
Für v1 nicht in Vault-Dateien schreiben.
