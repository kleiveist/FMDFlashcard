<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Testing

## Tests ausfuehren

Bevorzugter Befehl:

```bash
python3 tools/control.py --test
```

Optionaler Dry-Run:

```bash
python3 tools/control.py --test --dry-run
```

Direkter Workspace-Befehl (falls noetig):

```bash
pnpm -C apps/fmd-desktop test
```

Bei kleinen Aenderungen bevorzugt gezielte Tests fuer kurze Feedback-Zyklen.

## Erwartungen an Pull Requests

- Tests fuer geaenderte Logik aktualisieren oder ergaenzen
- Lint und Typechecks muessen vor Review durchlaufen

## Table-rendering Checkliste

- Flashcard-Tabellen werden als echte Tabellen gerendert
- Nicht-Token-Tabellen koennen horizontal scrollen
- `cl`, `cd`, `cld` Tokens rendern in Tabellenzellen korrekt
- `---` trennt keine Karten/Tasks innerhalb von Tabellenbloecken
