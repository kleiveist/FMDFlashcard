# Review-Session UI hinzufügen (Again/Hard/Good/Easy)

## Kontext
Sobald Cards extrahiert werden können, braucht es eine minimale Review-Erfahrung.

## Ziel
Review-Screen implementieren, der Cards nacheinander zeigt inkl. Bewertungsbuttons:
- Again / Hard / Good / Easy

## Umfang
- Session arbeitet zunächst nur mit In-Memory Queue.
- Kein langfristiges Scheduling in diesem Issue.

## Aufgaben
- [ ] `Review`-Page/Route erstellen.
- [ ] Karte Front/Back (Answer anzeigen) umschaltbar machen.
- [ ] Rating-Buttons hinzufügen und zur nächsten Karte weitergehen.
- [ ] Basis-Session-Stats (remaining, completed).

## Akzeptanzkriterien
- User kann Session von einer Note oder „alle Cards“ starten und Cards durchgehen.
- Ratings werden erfasst (z. B. in State/Log), auch wenn noch ohne Persistenz.

## Hinweise
UI minimal halten; Scheduling folgt danach.
