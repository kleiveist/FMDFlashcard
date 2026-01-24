<!-- AUTO-GENERATED:backlink START -->
[← Back](issusDE.md)
<!-- AUTO-GENERATED:backlink END -->
#29
## Master Issue (DE): Implementierung “Exam Editor” (Blueprint + Content Authoring)
### Hintergrund / Motivation
Aktuell werden Exams in FMD über Markdown (`#exam … #examend` + nummerierte `ea`-Tasks) erstellt. Das ist funktional, aber für Autoren aufwendig und fehleranfällig. Ziel ist ein visueller **Exam Editor**, der Prüfungen **strukturiert aufbaut** und anschließend **inhaltlich ausfüllt**, während als Persistenz weiterhin das bestehende Markdown-Format genutzt wird.

---
## Ziel / Outcome
Ein neuer Editor-Bereich “Exam Editor” mit **zwei Modi**:
1. **Exam-Aufbau-Modus (Blueprint/Structure)**    
    - Drag & Drop von Kartentypen (Icons/Palette) in eine Aufgaben-Struktur (Layer-Modell).
    - Aufgaben können eine oder mehrere Card-Interaktionen enthalten (Composite), standardmäßig jedoch 1 Interaktion pro Aufgabe.
2. **Content-Modus (Authoring)**
    - Formularbasierte Eingabe aller benötigten Felder (Prompt, Optionen, Lösungen, Tokens, Cloze-Lücken etc.).
    - Navigation taskweise (Aufgabe 1..N), inklusive Validierung.
Persistenz als Markdown im bestehenden Format, damit Parser/Renderer unverändert bzw. minimal angepasst weiterarbeiten.
---

## Umfang (Scope)
### In Scope
- Neuer UI-Bereich “Exam Editor” (Route/Panel) mit:
    - **Palette** der Kartentypen: `qa`, `tf`, `m1`, `m2`, `cl`, `cd`, `cld` (+ ggf. weitere vorhandene Typen).
    - **Canvas** zum Aufbau:
        - Exam Layer (Exam-Metadaten)
        - Aufgaben Layer (Task-Liste)
        - Card Layer (Interaktionen pro Aufgabe, optional mehrere)
    - **Property Panel**: kontextsensitiv (Exam/Task/Card).
    - **Modusumschalter**: “Structure” ↔ “Content”
- Mapping Editor → Markdown:
    - `#exam … #examend`
    - Aufgaben als `ea` (nummerierte Tasks 1..N)
    - Interaktionen über `#card … #` und/oder direkte Task-Bodies (gemäß existierender Regeln)
    - Composite/Mehrfach-Interaktionen via `---` innerhalb Task/Card.
- Validierung gemäß Syntax-Regeln:
    - `#card` und `#` jeweils auf eigener Zeile.
    - `m1`: genau 1 korrekt (`-a` etc.), mind. 2 Optionen.
    - `m2`: mind. 2 korrekte Marker.
    - `tf`: Marker auf der nächsten non-empty line.
    - `cl`: `%...%` darf nicht leer sein.
    - `qa`: Answer-Marker am Zeilenanfang (Exam-Modus line-start).
    - Hinweise/Warnungen bei Mischtypen (auto-grading Risiken).
### Out of Scope (für dieses Master Issue)
- Neue Kartentypen außerhalb der bestehenden Syntax
- Neuer Exam-Grading-Algorithmus oder KI-Evaluation (separates Issue)
- Sync/Cloud/Collaboration
- Umfangreiche Parser-Neuschreibung (nur Erweiterungen/Adapter falls nötig)
---
## UX / Bedienablauf
### A) Structure Mode (Blueprint)
1. Nutzer öffnet Exam Editor → “Neues Exam” oder “Exam aus Markdown laden”.
2. Rechts: Kartentyp-Palette als Icons mit Tooltip (QA/TF/M1/M2/CL/CD/CLD).
3. Drag & Drop:
    - Drop in leeren Canvas → erzeugt Aufgabe 1 + Card
    - Drop in bestehende Aufgabe → fügt Card zur Aufgabe hinzu
4. Aufgaben sind:
    - reorderbar (Drag & Drop)
    - duplizierbar
    - löschbar
5. Cards innerhalb einer Aufgabe sind:
    - reorderbar
    - konfigurierbar (Property Panel)
### B) Content Mode (Authoring)
- Für jede Aufgabe/Cards werden passende Eingabefelder angezeigt:
    - QA: Prompt + Answer-Text
    - TF: Prompt + true/false
    - M1/M2: Prompt + Optionsliste + korrekte Marker
    - CL: Prompt mit `%...%`
    - CD: Prompt mit `"token"`
    - CLD: Kombination aus CL + CD
- Live-Validation und Fehlerhinweise mit “Fix actions” (z. B. “mind. 2 Optionen hinzufügen”).

---

## Datenmodell (minimal, intern)
- `ExamBlueprint`
    - `meta`: title, description, optional settings
    - `tasks[]: ExamTaskBlueprint`
- `ExamTaskBlueprint`
    - `id`, `order`, `title/heading`
    - `cards[]: CardBlueprint`
- `CardBlueprint`
    - `type`: qa/tf/m1/m2/cl/cd/cld
    - `config`: typ-spezifische Parameter (z. B. optionCount)
    - `content`: Prompt/Answer/Options/Tokens etc.
Serializer:
- `ExamBlueprint -> Markdown`
- `Markdown -> ExamBlueprint` (für “Edit existing exam”, optional zunächst read-only import)

---

## Akzeptanzkriterien (Definition of Done)
1. **Neues Exam erstellen**: Nutzer kann per Drag&Drop mindestens 3 Aufgaben mit unterschiedlichen Typen anlegen.
2. **Konfiguration je Typ**:
    - M1: Optionen editierbar + exakt 1 korrekt
    - M2: Optionen editierbar + ≥2 korrekt
    - TF: true/false wählbar
    - QA: Answer marker + Answer text
    - CL/CD/CLD: Eingaben führen zu syntaktisch korrekten Tokens/Lücken
3. **Content Mode**: Alle erforderlichen Felder sind ausfüllbar und validiert.
4. **Export**: “Save” erzeugt korrektes Markdown mit `#exam … #examend` und `ea`-Tasks.
5. **Re-Open**: Exportiertes Markdown wird in der bestehenden Exam-Ansicht korrekt gerendert/ausgeführt.
6. **Warnungen**: Beim Kombinieren unterschiedlicher Interaktionstypen in einer Aufgabe (Composite) erscheint ein Hinweis “Auto-Grading kann unzuverlässig sein”.

---

## Technische Aufgaben (Sub-Tasks / Checkliste)
### UI / State
-  Neue Route/Ansicht “Exam Editor”
-  Palette-Komponente (Typ-Icons)
-  Canvas: Task-Liste + Card-Layer Darstellung
-  Drag & Drop (Tasks reorder + Cards add/reorder)
-  Property Panel (Exam/Task/Card)
### Content Forms
-  Formular-Komponenten für QA/TF/M1/M2/CL/CD/CLD
-  Validierungslogik pro Typ (inline Fehler + Blocker bei Save)
### Markdown I/O
-  Serializer `Blueprint -> Markdown`
    -  `#exam … #examend` Container
    -  `ea` Nummerierung + Task-Grenzen
    -  `#card … #` Container Regeln
    -  Composite via `---`
-  Optional: Parser/Importer `Markdown -> Blueprint` (zunächst für einfache Fälle)
### Integration
-  “Open existing exam file/section” Hook (Vault-Integration)
-  “Save back to file” mit minimalen Diffs (oder kompletter Section-Rewrite, je nach Architektur)
### Tests
-  Unit: Serializer erzeugt gültige Blöcke für alle Typen
-  Unit: Validation für Edge Cases (leere Cloze, zu wenig Optionen, fehlende Marker)
-  E2E: Create → Save → Render in Exam View

---

## Risiken / offene Punkte
- **Composite Tasks**: Mischtypen innerhalb einer Aufgabe erhöhen UI-/Grading-Komplexität. Empfehlung: Default “1 Card pro Aufgabe”, Composite als Advanced Feature (Warnhinweis + klare `---`-Trennung).
- **Import bestehender Exams**: Vollständiges Roundtrip (Markdown ↔ Blueprint) kann aufwendig sein; kann schrittweise erfolgen (erst Export-only, dann Import eingeschränkt).
- **Markdown-Stabilität**: Strikte Einhaltung der Marker-Zeilen (Standalone lines) nötig, um Parser-Bugs zu vermeiden.

---

## Beispiel-Output (Referenz)
Einfaches Exam mit 2 Tasks (M1 + TF), kompatibel zur existierenden Syntax:
```md
#exam
1) (M1) Choose exactly one correct answer.
#card
Which planet is known as the Red Planet?
a) Earth
b) Mars
c) Venus
-b
#
2) (TF) Decide whether the statement is true or false.
#card
The Sun is a star.
-true
#
#examend
```

---

Wenn du mir noch kurz sagst, **wie das GitHub-Repo heißt** (oder ob ihr Labels/Milestones habt), kann ich dir im gleichen Stil direkt auch **Sub-Issues** vorschlagen (UI, Serializer, Import, Tests) – aber dieses Master Issue ist so bereits copy/paste-fertig.
