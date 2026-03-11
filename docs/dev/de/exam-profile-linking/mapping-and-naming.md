<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Mapping und Naming Regeln

## Quellattribut

- Quellfeld im Markdown-Frontmatter: `Task`
- Beispiel:

```yaml
---
Section: IUF
Rank: SE1
Projekt: IDBS01
Task: Exam
---
```

## Aufloesungsregeln

- `Task` wird gegen vorhandene Points-Profilnamen aufgeloest.
- Matching ist trim + case-insensitive.
- Unbekannte `Task`-Namen werden als nicht aufloesbar behandelt und fallen auf Standardverhalten zurueck.
- Kein `Task`-Attribut bedeutet: kein zugewiesenes Task-Profil.

## Begriffe in der Exam Simulation

- `Standard` bedeutet technisch `selectedRunProfileId = null`.
- `Task-Profil` ist das aus Frontmatter `Task` aufgeloeste Profil.
- `Gleiche Exams` bedeutet: alle einbezogenen Sources haben dieselbe aufgeloeste `Task`-Profil-ID.
- `Unterschiedliche Exams` bedeutet: unterschiedliche IDs oder nicht aufgeloeste Task-Werte.

## Prioritaet

- Manuell gewaehltes Run-Profil uebersteuert die Frontmatter-Verknuepfung in der Berechnung.
- Der automatische Matrix-Set laeuft nur bei relevanten Zustandsaenderungen:
- Selection-Aenderung
- Kombinationmodus-Aenderung
- Task-Aufloesungs-Aenderung aus Frontmatter
- Reine manuelle Dropdown-Aenderung triggert keinen sofortigen erneuten Auto-Set.
