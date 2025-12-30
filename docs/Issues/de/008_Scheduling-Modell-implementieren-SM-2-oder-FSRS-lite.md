# Scheduling-Modell implementieren (SM-2 oder FSRS-lite)

## Kontext
Review-UI liefert Ratings; Scheduling übersetzt Ratings in Next-Due-Dates.

## Ziel
Scheduling-Algorithmus und Card-State-Modell implementieren.

## Umfang
- Algorithmus wählen:
  - SM-2 (einfach, bekannt)
  - FSRS-lite (moderner, mehr Parameter)
- Pro-Card State: Interval, Ease, Due Date, Reps, Lapses, Last Reviewed.

## Aufgaben
- [ ] Algorithmus wählen und dokumentieren in `docs/scheduling.md`.
- [ ] `apply_rating(state, rating) -> new_state` implementieren.
- [ ] Unit-Tests für Algorithmusverhalten schreiben.
- [ ] In Review-Flow integrieren (State Update nach jedem Rating).

## Akzeptanzkriterien
- Scheduling-Funktion ist deterministisch und getestet.
- Review-UI aktualisiert pro Card den State nach jeder Bewertung.

## Hinweise
Persistenz kommt separat.
