#30
## Master Issue: Neuer Syntax-Block `h` (Help/Hinweise) integrieren (`#help … #`)
### Ziel
Ein neuer, optionaler Syntax-Block **`h`** soll in FMD(Flashcard) integriert werden, um **Hilfen/Hinweise** (Hints) innerhalb von Flashcards und Exam-Tasks bereitzustellen. Der Block ist **mit allen Kartentypen kompatibel** (qa/tf/m1/m2/cl/cd/cld), da er **nicht** in die Interaktions-Erkennung oder Bewertung eingreift.

---

## Motivation / Problem
Aktuell gibt es keine standardisierte Möglichkeit, **Hinweise** pro Karte oder pro Exam-Aufgabe in Markdown abzulegen, ohne das Parsing der Interaktionstypen (z. B. `-true`, `Answer:`, `-a)`) zu stören.  
Benötigt wird ein Block, der:
- pro Karte/Task eindeutig zuordenbar ist,
- **nicht bewertet** wird,
- die Interaktionsdetektoren **nicht beeinflusst**,
- in der UI optional angezeigt werden kann.

---

## Requirements (Functional)
### 1) Neue Syntax: `#help … #` (kürzel: `h`)
**Definition:** Ein `#help … #` Block enthält ausschließlich Hinweis-/Help-Text in Markdown.
**Syntax:**
```md
#help
Hint title (optional): Key idea
- Short hint line 1
- Short hint line 2
You may also use paragraphs, lists, or small tables.
#
```
**Regeln:**
- `#help` und `#` stehen jeweils **alleine in einer Zeile**.
- Inhalt dazwischen ist **Markdown**, darf Listen/Absätze/kleine Tabellen enthalten.
- Mehrere `#help`-Blöcke pro Scope sind erlaubt (z. B. mehrere Hints).

---

### 2) Scope / Zuordnung (entscheidend)
Damit der Hint korrekt geladen werden kann, **muss** `#help … #` innerhalb eines gültigen Containers liegen:
- **Innerhalb von `#card … #`** → Hint wird an **diese Flashcard** gebunden.
- **Innerhalb eines Exam-Tasks (`ea`)** (nummerierte Aufgabe innerhalb von `#exam … #examend`) → Hint wird an **diese Exam-Aufgabe** gebunden.
**Außerhalb** von `#card` und **außerhalb** eines `ea`-Tasks:
- Block wird **ignoriert** (oder als reiner Markdown-Text behandelt), da keine valide Zuordnung möglich ist.

---

### 3) Parser-Verhalten (Non-Intrusive)
- `#help … #` wird beim Parsen **extrahiert** und als separate Datenstruktur gespeichert (z. B. `helpText[]`).
- Die Zeilen des Help-Blocks dürfen **nicht** in die Interaktions-Erkennung einfließen:
    - Inhalte wie `-true`, `-a)`, `Answer:` innerhalb `#help` dürfen **nicht** als Lösung/Marker interpretiert werden.
- Help-Text beeinflusst **nicht**:
    - Scoring/Bewertung
    - Korrektheitsprüfung
    - SRS/Spaced-Repetition Scheduling

---

## UI Requirements
- Help/Hints werden **optional** gerendert, z. B. als:
    - „Show hint“ / „Hinweis anzeigen“ Toggle
    - Accordion / collapsible panel
- Standard: eingeklappt (optional, UI-Entscheidung).
- Mehrere Help-Blöcke:
    - entweder als Liste/Stack anzeigen,
    - oder zusammenführen (UI-Entscheidung, aber konsistent).

---

## Dokumentation: Tabellenzeile ergänzen
Englische Tabellenzeile (für die Syntax-Matrix):

|Description (EN)|Syntax start|Syntax end|Relevant for|Action|Short|
|---|---|---|---|---|---|
|Help/Hint block (optional)|#help|#|e-page f-pages|- Store content as **help/hint text** (not graded). - Parser removes block before interaction detection (qa/tf/m1/m2/cl/cd/cld). - UI: render optionally (e.g., “Show hint”).|h|

---

## Akzeptanzkriterien (Acceptance Criteria)
### Parsing
-  `#help … #` wird erkannt und extrahiert.
-  Help-Content wird dem korrekten Scope zugeordnet:
    -  innerhalb `#card … #` → Karte
    -  innerhalb `ea` → Exam-Task
-  Help-Content beeinflusst **keine** Detektion (qa/tf/m1/m2/cl/cd/cld).
-  `#help` außerhalb gültiger Scopes wird nicht als Hint gespeichert.
### UI
-  UI kann Help-Text pro Karte/Task anzeigen (optional Toggle).
-  Help-Text ist klar als „Hint/Help“ gekennzeichnet.
-  Keine Auswirkungen auf Bewertung/Ready/Statistics/Grading.
### Tests
-  Unit-Tests für:
    -  Help innerhalb QA-Karte
    -  Help innerhalb TF-Karte
    -  Help innerhalb M1/M2
    -  Help innerhalb cl/cd/cld (inkl. Tokens/%%…%%)
    -  Help mit Marker-Strings (`-true`, `Answer:`) ohne Seiteneffekte
    -  Help außerhalb Scope → ignoriert
-  Snapshot/Renderer-Test: Markdown in Help wird korrekt gerendert (inkl. Tabellen).

---

## Implementierungs-Notizen (Technik)
- Help-Block sollte **vor** `splitCardLines` / Interaction-Detektoren entfernt werden (oder dort explizit ausgeschlossen).
- Datenmodell-Vorschlag:
    - `helpText?: string[]` (Array für mehrere Blocks)
    - alternativ `helpMarkdown?: string` + Trennlogik

---

## Beispiel (Exam-Task)
```md
#exam
1) Explain HTTP status codes.
#help
Think in categories:
- 2xx = success
- 3xx = redirect
- 4xx = client error
- 5xx = server error
#
Answer: 2xx means success.
---
#examend
```
## Beispiel (Flashcard)
```md
#card
What is the capital of France?
#help
If you are unsure, recall the Eiffel Tower.
#
Answer: Paris
#
```

---

## Out of Scope
- Automatische Generierung von Hints via AI
- Bewertung von Hint-Inhalten
- Globaler Hint-Scope ohne eindeutige Zuordnung

---

Wenn du willst, kann ich daraus zusätzlich direkt:
- ein GitHub-Issue-Template-Format (mit Checkboxes, Labels, „Definition of Done“) erstellen,
- oder eine Codex/Agent Prompt-Variante, die die Implementierung in die relevanten Parser-Dateien führt.
