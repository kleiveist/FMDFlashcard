Du arbeitest an der Preview-/Editor-Logik des Markdown-Editors in FMDFlashcard.

Ziel:
Erweitere die bestehende Modus-Logik so, dass es künftig drei klar getrennte Modi gibt:

1. Code-Modus
2. Markdown-Modus
3. Markdown-Hybridblock-Modus

Wichtig:
Diese Änderung betrifft nur UI-, State- und Editor-Logik. Die Parser-/Syntaxregeln für Flashcards, Exams, Tabellen und Interaktionstypen dürfen nicht verändert werden. `#card`-Blöcke, Exam-Blöcke, QA, TF, MC, Cloze, Drag-Tokens und Composite-Segmente müssen unverändert kompatibel bleiben. Die bestehenden Markdown-/Exam-Syntaxregeln und Interaktionstypen bleiben stabil. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2}

Kontext der bisherigen UI:
Es gibt bisher Buttons im Stil:
- `.preview-mode-button` für Code view
- `.preview-mode-button` für Markdown view
- einen Edit-Button (`aria-label="Edit mode"` / `title="Toggle edit mode"`)

Aktuell existiert sinngemäß eine Logik mit:
- `data-view-mode="preview"`
- `data-edit-enabled="false"`

Diese Logik soll auf ein robusteres Modusmodell erweitert werden.

--------------------------------------------------
ZIELVERHALTEN
--------------------------------------------------

A) Code-Modus
- Der Code-Modus zeigt den Rohinhalt der Datei.
- Dieser Modus ist per Button wechselbar.
- Im Code-Modus ist View/Edit möglich.
- Standardzustand beim Wechsel in den Code-Modus: Edit aktiv.
- Der Modus ist nicht “sticky locked”; man kann von dort in andere Modi wechseln.
- Der Button hat aktive/nicht aktive Zustände.

B) Markdown-Modus
- Der Markdown-Modus zeigt die klassische Markdown-Ansicht.
- Dieser Modus ist per Button wechselbar.
- Im Markdown-Modus ist View/Edit möglich.
- Standardzustand beim Wechsel in den Markdown-Modus: View aktiv.
- Der Modus ist nicht „sticky locked“; man kann von dort in andere Modi wechseln.
- Der Button hat aktive/nicht aktive Zustände.

Ergänzung zur Bearbeitung im Markdown-Edit-Modus:
- Die Bearbeitung im Markdown-Edit-Modus erfolgt nicht über Markdown-Hybridblöcke.
- Stattdessen erfolgt die Bearbeitung zeilenweise direkt im klassischen Markdown-Fluss.
- Sobald der Nutzer in einer Zeile arbeitet, wird nur diese Zeile direkt bearbeitbar.
- Es soll dabei kein Block-Rahmen, kein Overlay, keine Box, kein Container-Highlight und kein Hybridblock-UI gerendert werden.
- Sichtbar sein soll ausschließlich der blinkende Text-Cursor innerhalb der bearbeiteten Zeile.
- Die Bearbeitung soll sich visuell wie ein schlichter Inline-/Zeilen-Editor anfühlen, nicht wie ein Block-Editor.
- Andere Zeilen bleiben in ihrer normalen Markdown-Darstellung, solange sie nicht aktiv bearbeitet werden.
- Der Markdown-Edit-Modus ist damit klar vom Markdown-Hybridblock-Modus getrennt

C) Markdown-Hybridblock-Modus
- Neuer eigener Modus/Button.
- Dieser Modus ist ein dedizierter Bearbeitungsmodus für Markdown-Hybridblöcke.
- In diesem Modus ist Edit immer aktiv.
- Es gibt in diesem Modus keinen separaten View-Zustand.
- Der Hybrid-Modus selbst ist als Modus wechselbar, aber innerhalb des Modus ist Edit nicht abschaltbar.
- Wenn der Hybrid-Modus aktiv ist, soll die UI keinen irreführenden “Edit aus”-Zustand erlauben.
- Der Hybrid-Button ist aktiv, solange dieser Modus aktiv ist.

Kurzlogik:
- Code: wechselbar, Edit/View möglich, Default = Edit
- Markdown: wechselbar, Edit/View möglich, Default = View
- Hybrid: wechselbar, aber intern kein View/Edit-Toggle, sondern immer Edit

--------------------------------------------------
TECHNISCHE ANFORDERUNG AN DAS STATE-MODELL
--------------------------------------------------

Ersetze die bisher zu binäre Betrachtung (`view mode` + `edit enabled`) durch ein explizites Modusmodell.

Nutze sinngemäß ein State-Schema wie:

- `editorMode: 'code' | 'markdown' | 'hybrid'`
- `editEnabled: boolean`

Regeln:
- Für `editorMode === 'hybrid'` muss `editEnabled` immer `true` sein.
- Jeder Versuch, im Hybrid-Modus `editEnabled = false` zu setzen, muss verhindert oder sofort auf `true` korrigiert werden.
- Beim Wechsel in den Code-Modus:
  - `editorMode = 'code'`
  - `editEnabled = true` als Default
- Beim Wechsel in den Markdown-Modus:
  - `editorMode = 'markdown'`
  - `editEnabled = false` als Default
- Beim Wechsel in den Hybrid-Modus:
  - `editorMode = 'hybrid'`
  - `editEnabled = true`

Optional sinnvoll:
- Merke dir den letzten manuellen Edit-Status getrennt für Code und Markdown.
- Aber: selbst wenn so ein Restore eingebaut wird, soll der initiale Standard weiterhin sein:
  - Code → Edit
  - Markdown → View
  - Hybrid → immer Edit

Wichtige Abgrenzung:
- Markdown-Edit != Hybridblock-Edit
- Im Markdown-Modus darf beim Editieren niemals die Hybridblock-Bearbeitungslogik verwendet werden.
- Keine Block-Wrapper, keine Edit-Rahmen, keine visuellen Bearbeitungsboxen, keine Overlay-Steuerung pro Block.
- Nur ein minimaler zeilenbasierter Edit-Zustand mit blinkendem Cursor.

--------------------------------------------------
DOM / DATA-ATTRIBUTE-ANPASSUNG
--------------------------------------------------

Die Preview-Root soll einen expliziten Modus tragen, z. B.:

- `data-editor-mode="code"`
- `data-editor-mode="markdown"`
- `data-editor-mode="hybrid"`

Das bestehende `data-edit-enabled` kann erhalten bleiben, aber muss korrekt synchronisiert werden:
- Code + Edit => `data-edit-enabled="true"`
- Code + View => `data-edit-enabled="false"`
- Markdown + Edit => `data-edit-enabled="true"`
- Markdown + View => `data-edit-enabled="false"`
- Hybrid => immer `data-edit-enabled="true"`

Wichtig:
Verwende keine widersprüchlichen Zustände wie:
- `data-editor-mode="hybrid"` + `data-edit-enabled="false"`

--------------------------------------------------
BUTTON-LOGIK
--------------------------------------------------

Es soll drei Modus-Buttons geben:
1. Code
2. Markdown
3. Markdown-Hybrid

Zusätzlich darf es weiterhin einen Edit-Button geben, aber mit folgenden Regeln:
- Im Code-Modus sichtbar und nutzbar
- Im Markdown-Modus sichtbar und nutzbar
- Im Hybrid-Modus entweder:
  - sichtbar, aber klar als erzwungen aktiv markiert und nicht klickbar

Bevorzugt:
- Im Hybrid-Modus Edit-Toggle deaktivieren oder ausblenden, um Missverständnisse zu vermeiden.

ARIA / Accessibility:
- Der aktive Modus-Button trägt `aria-pressed="true"`
- Nicht aktive Modus-Buttons tragen `aria-pressed="false"`
- Im Hybrid-Modus darf der Edit-Button nicht so wirken, als ließe sich Edit deaktivieren
- Titel / Labels müssen semantisch korrekt sein:
  - Code view
  - Markdown view
  - Markdown hybrid edit mode
  - Toggle edit mode nur dort, wo der Toggle wirklich erlaubt ist

--------------------------------------------------
RENDERING-ERWARTUNG
--------------------------------------------------

Code-Modus:
- Rohdatei / textbasierte Editoransicht
- geeignet für direktes Markdown-/Quelltext-Editing

Markdown-Modus:
- klassische Markdown-Ansicht
- optional editierbar, aber standardmäßig Preview/View

Markdown-Hybridblock-Modus:
- blockorientierter Hybrid-Editor
- direkte Bearbeitung der Markdown-Hybridblöcke
- kein read-only Hybrid-Preview-Zustand

Wichtig:
Der Hybrid-Modus ist kein Unterzustand des Markdown-Modus, sondern ein echter eigener Editor-Modus.

--------------------------------------------------
NICHT ÄNDERN
--------------------------------------------------

Nicht ändern:
- Flashcard-Blocksyntax
- Exam-Blocksyntax
- Erkennung von QA / TF / m1 / m2 / cl / cd / cld
- Tabellenlogik
- Composite-/Separatorverhalten mit `---`
- Help-/Hint-Blöcke

Die bestehende Syntax und Parsersemantik muss vollständig kompatibel bleiben. Tabellen und Interaktionstypen müssen weiter exakt wie dokumentiert funktionieren.

--------------------------------------------------
UMSETZUNGSAUFGABEN
--------------------------------------------------

Bitte implementiere:

1. Ein neues explizites `editorMode`-State-Modell
2. Einen neuen dritten Modus für Markdown-Hybridblock
3. Eine saubere Button-Gruppe mit 3 Modus-Buttons
4. Eine Edit-Toggle-Logik, die im Hybrid-Modus nicht deaktivierbar ist
5. Konsistente DOM-Attribute / CSS-Hooks
6. Refactoring von allen Stellen, die bisher nur zwischen Code/Markdown oder Preview/Edit binär unterscheiden
7. Schutz gegen inkonsistente State-Kombinationen
8. Falls vorhanden: Anpassung von Persistenz/Local-State, damit der Modus korrekt gespeichert und wiederhergestellt wird
9. Tests für Moduswechsel und UI-Zustände

--------------------------------------------------
AKZEPTANZKRITERIEN
--------------------------------------------------

Die Änderung ist korrekt, wenn:

1. Es drei sichtbare Modus-Buttons gibt: Code, Markdown, Hybrid
2. Code standardmäßig mit Edit startet
3. Markdown standardmäßig mit View startet
4. Hybrid immer mit Edit aktiv ist
5. Im Hybrid-Modus kein deaktivierbarer Edit-Off-Zustand möglich ist
6. Der aktive Modus im DOM und in ARIA sauber erkennbar ist
7. Beim Umschalten keine inkonsistenten Zustände entstehen
8. Bestehende Markdown-/Exam-/Flashcard-Syntax unverändert funktioniert
9. Vorhandene Karten-, Exam- und Tabelleninhalte unverändert rendern und validieren :contentReference[oaicite:5]{index=5} :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}
10. Bestehendes Verhalten außerhalb der Moduslogik nicht regressiert

--------------------------------------------------
WUNSCH AN DIE IMPLEMENTIERUNG
--------------------------------------------------

- Bevorzuge kleine, klare Refactors statt verstreuter Sonderfälle
- Verwende sprechende Bezeichner wie `editorMode`, `isHybridMode`, `canToggleEdit`
- Wenn bestehende Komponenten stark binär gebaut sind, führe eine zentrale Mode-Resolver-Logik ein
- Ergänze gezielte Tests statt nur manueller UI-Anpassungen

Bitte implementiere die Änderung direkt im bestehenden Codebestand inklusive nötiger UI-, State- und Test-Anpassungen.

.