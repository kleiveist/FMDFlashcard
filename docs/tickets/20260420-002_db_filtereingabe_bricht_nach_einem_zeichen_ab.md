# Ticket 20260420-002

- Ticket-ID: `20260420-002`
- Original-Referenz: `DB-002`
- Bereich: Datenbank / Filtereingaben
- Priorität: Hoch
- Titel: Texteingabe bricht nach einem Buchstaben ab

## Beschreibung
Beim Schreiben in Eingabefelder innerhalb der Filterbedingungen kann nur ein einzelner Buchstabe eingegeben werden. Danach endet die Eingabe oder der Fokus geht verloren.

## Reproduktion
1. Datenbankansicht öffnen.
2. Filterfeld öffnen.
3. Ein Texteingabefeld innerhalb einer Filterbedingung aktivieren.
4. Mehrere Zeichen hintereinander eingeben.
5. Beobachten, dass die Eingabe nach dem ersten Zeichen abbricht oder der Fokus verloren geht.

## Ist-Zustand
Kontinuierliches Schreiben ist nicht möglich.

## Soll-Zustand
Texteingaben funktionieren normal fortlaufend, ohne Fokusverlust oder Unterbrechung nach einem Zeichen.

## Akzeptanzkriterien
- In Filtertexteingaben können beliebig viele Zeichen fortlaufend eingegeben werden.
- Der Fokus bleibt im aktiven Eingabefeld, solange der Nutzer nicht aktiv wechselt.
- Eingabeabbrüche nach dem ersten Zeichen treten nicht mehr auf.
