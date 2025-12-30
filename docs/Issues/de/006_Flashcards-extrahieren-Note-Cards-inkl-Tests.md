# Flashcards extrahieren (Note → Cards) inkl. Tests

## Kontext
Vault-Browsing funktioniert. Nächster Schritt: Notizinhalt in Flashcards umwandeln.

## Ziel
Gegeben eine Markdown-Datei: Flashcards nach Spezifikation extrahieren.

## Umfang
- Parser an einer Stelle implementieren (Rust oder TypeScript):
  - Rust: performant, Backend-Logik zentral
  - TypeScript: schneller iterierbar, bleibt im Frontend
- Unit-Tests für typische Fälle und Edge-Cases.

## Aufgaben
- [ ] Ort der Implementierung wählen (Rust-Command vs. TS-Modul).
- [ ] `extract_cards(markdown: string) -> Card[]` implementieren.
- [ ] Test-Fixtures anlegen für:
  - [ ] Single Card
  - [ ] Multiple Cards
  - [ ] Listen/Codeblöcke in Answers
  - [ ] Ungültige Card-Blöcke (ignorieren oder Warnung)
- [ ] In UI: Cards für selektierte Note anzeigen (read-only Liste).

## Akzeptanzkriterien
- Parser besteht Tests.
- Bei Note-Selection kann „cards found: N“ angezeigt werden inkl. Fragenliste.

## Hinweise
Ohne Scheduling starten; erst Extraktion.
