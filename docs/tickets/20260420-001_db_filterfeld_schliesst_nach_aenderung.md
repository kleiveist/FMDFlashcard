# Ticket 20260420-001

- Ticket-ID: `20260420-001`
- Original-Referenz: `DB-001`
- Bereich: Datenbank / Filter
- Priorität: Hoch
- Titel: Filterfeld schließt sich nach jeder Änderung

## Beschreibung
Sobald in den Filterbedingungen eine Einstellung geändert wird, schließt sich das Filterfeld sofort. Dadurch wird die Bearbeitung mehrerer Bedingungen hintereinander unnötig unterbrochen.

## Reproduktion
1. Datenbankansicht öffnen.
2. Filterfeld öffnen.
3. Eine Filterbedingung hinzufügen oder eine bestehende Bedingung ändern.
4. Beobachten, dass sich das Filterfeld direkt nach der Änderung schließt.

## Ist-Zustand
Nach jeder Anpassung muss das Filterfeld erneut geöffnet werden.

## Soll-Zustand
Das Filterfeld bleibt offen, bis der Nutzer es bewusst schließt, z. B. per Klick außerhalb, per `X` oder per `Escape`.

## Akzeptanzkriterien
- Das Filterfeld bleibt nach Änderungen an Filterbedingungen geöffnet.
- Mehrere Filteränderungen können in einer Sitzung ohne erneutes Öffnen vorgenommen werden.
- Schließen ist weiterhin gezielt möglich über Klick außerhalb, `X` und `Escape`.
