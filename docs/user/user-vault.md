<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
# User Vault (Statistiken)

Der User Vault speichert deine Lernstatistiken lokal, damit sie nach einem Neustart erhalten bleiben.

## Was ist ein Profil?

Ein **Profil** ist der Container fuer alle Statistiken. Du kannst mehrere Profile anlegen und zwischen ihnen wechseln (z.B. pro Person oder pro Kurs).

Beispielpfad:
- Auto-Mode: `<VAULT_ROOT>/user/profiles/2026-01-14_MeinLoard/`
- Custom-Mode: `<CUSTOM_PATH>/profiles/2026-01-14_MeinLoard/`

## Unterschied zwischen Profile und User

- **Profil**: Gesamt-Container fuer alle Statistiken.
- **User**: Nur innerhalb der Spaced-Repetition-Logik genutzt (mehrere SR-User innerhalb eines Profils moeglich).

Kurz: Profile steuern den Speicherort, User steuern SR-Logik.

## Was wird gespeichert?

Pro Profil werden JSON-Dateien abgelegt:
- `profile.json`: Profil-Metadaten
- `spaced-repetition.json`: SR-Fortschritt (pro Vault-ID)
- `fast-flashcard.json`: Fast-Flashcard Session-Historie
- `exam-runs.json`: Exam-Simulation Runs

## Mode: Auto vs Custom

- **Auto (empfohlen):** Speichert unter `<VAULT_ROOT>/user/`. Beim Vault-Wechsel wechselt auch der User Vault.
- **Custom path:** Speichert in einem von dir gewaehlten Ordner. Bleibt gleich, auch wenn du den Vault wechselst.

## Export / Import

Du kannst das aktive Profil oder alle Profile als JSON exportieren und wieder importieren.
- **Merge:** fuegt neue Eintraege hinzu, laesst vorhandene bestehen.
- **Overwrite:** ersetzt die vorhandenen Daten komplett.
