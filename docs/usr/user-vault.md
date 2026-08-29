<!-- AUTO-GENERATED:backlink START -->
[← Back](usr.md)
<!-- AUTO-GENERATED:backlink END -->
# User Vault (Statistiken)

Der User Vault speichert Profile, Einstellungen und Lernfortschritt lokal.
Diese Daten liegen nicht im Programm-Repository und bleiben beim Neustart
erhalten.

## Profile und SR-User

Ein **Profil** ist der gemeinsame Speichercontainer für Einstellungen,
Fast-Flashcard-Sitzungen, Prüfungsverläufe und Spaced Repetition. Innerhalb
eines Profils können mehrere **SR-User** mit getrenntem Kartenfortschritt
existieren.

Neue Profilordner erhalten eine Datums-ID, zum Beispiel
`2026-08-29_Lernprofil`.

## Speicherort

- **Auto (empfohlen):** `<VAULT_ROOT>/.profile/users/<PROFIL-ID>/`
- **Custom:** `<AUSGEWÄHLTER_ORDNER>/.profile/users/<PROFIL-ID>/`

Wird bereits ein vorhandener Profilwurzelordner ausgewählt, verwendet die App
diesen direkt. Beim Wechsel des Vaults wechselt im Auto-Modus auch der
Profilwurzelordner; ein Custom-Pfad bleibt gleich.

## Gespeicherte Daten

```text
<PROFIL-ID>/
  profile.json
  settings.json
  fast-flashcard.json
  exam-points-profiles.json
  spaced-repetition/
    registry.json
    users/<SR-USER>/progress.json
  exam-runs/<PRÜFUNGSLAUF>.md
```

- `profile.json` enthält nur die Profilidentität.
- `settings.json` enthält die Einstellungen des Profils.
- Spaced Repetition speichert pro SR-User eine eigene Fortschrittsdatei.
- Jeder Prüfungslauf wird als lesbare Markdown-Datei gespeichert.

## Bestehende Daten

Ältere Profilordner und die Dateien `spaced-repetition.json` sowie
`exam-runs.json` werden weiterhin gelesen. Die App kopiert noch fehlende
Einträge in die neue Struktur, löscht die Quelldateien aber nicht automatisch.
Ein unterbrochener Kopiervorgang kann beim nächsten Start fortgesetzt werden.

Vor einer manuellen Bereinigung sollte der gesamte Profilwurzelordner gesichert
und der Inhalt in der App geprüft werden.

## Export und Import

Das aktive Profil oder alle Profile können als JSON exportiert und wieder
importiert werden:

- **Merge** ergänzt neue Einträge und behält vorhandene Daten.
- **Overwrite** ersetzt die vorhandenen Profildaten durch den Import.

Exporte können private Pfade, Namen und Lernverläufe enthalten. Sie gehören
nicht in Git, Issues oder öffentliche Anhänge.
