<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Developer <-> Codex Workflow

## Zweck

Ein wiederholbarer Ablauf, um Ideen und Bugs in getestete Aenderungen mit klaren Artefakten zu ueberfuehren.

## Rollen

- **Developer:** definiert Scope, Akzeptanzkriterien, betroffene Pfade und gibt Aenderungen frei.
- **Codex:** implementiert Aenderungen und aktualisiert Tests sowie Doku im vorgegebenen Rahmen.

## Kernartefakte

1. **Konzeptnotiz:** Problem + Zielverhalten + Risiken.
2. **Task-Spec:** DoD + Akzeptanzkriterien + Testplan + betroffene Module.
3. **Codex-Prompt:** geordnete Aenderungsliste, Non-Goals, exakte Pfade, auszufuehrende Tests.
4. **Implementierung:** kleine, reviewbare Changesets.
5. **Test-Gate:** Build + Pflichtchecks.
6. **Bugfix-Loop:** Root Cause -> Fix -> Regressionstest -> Doku-Update.
7. **Release-Hinweis (optional):** User-Impact + Migrationshinweise.

## End-to-end Ablauf

1. Intake / Triage
2. Konzept
3. Task-Spec
4. Codex-Prompt
5. Implementierung
6. Test-Gate
7. Bugfix-Loop
8. Release / Merge

## Quality Gates (Minimum DoD)

- Akzeptanzkriterien erfuellt
- Keine Regression in Kernpfaden
- Bei Parser/Rendering-Aenderungen: reproduzierbare Markdown-Testdatei anlegen/aktualisieren
- Doku bei Verhaltensaenderungen aktualisieren (inkl. `docs/dev/de/` Spiegel)

## Packaging-Tasks

- Command-Level-Tooling-Doku liegt zentral unter `docs/tools/`.
- Bei geaenderten Build/Run/Test-Kommandos die passende Seite unter `docs/tools/` aktualisieren.
