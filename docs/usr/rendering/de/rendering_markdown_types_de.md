<!-- AUTO-GENERATED:backlink START -->
[← Back](de.md)
<!-- AUTO-GENERATED:backlink END -->
## 1) Links und Bilder (sehr häufig, hoher UX-Impact)

**Warum wichtig:** Links/Bilder sind oft der erste Bereich, der in Render-Ansicht „klickbar“ wird und Editieren verhindert.

- **Links (Inline)**
    - Format: `[Text](url)` und Autolinks `https://…`
    - Editfaktor: Textabschnitt (Inline)
    - Risiko: Klick öffnet Link statt Cursor/Selection
- **Bilder (Block oder Inline)**
    - Format: `![alt](path-or-url)`
    - Editfaktor: meist vollständiger Block (weil Rendergröße/Selection schwierig)
    - Risiko: Image nimmt Fokus, Text lässt sich schwer positionieren

---
## 2) HTML inline / HTML-Blöcke (kommt bei dir durch `<br>` bereits vor)

**Warum wichtig:** Viele Nutzer mischen Markdown + HTML. Dein System nutzt `<br>` aktiv in Aufgabenstellungen.
- Format: `<br>`, `<kbd>`, `<sub>`, `<sup>`, `<span …>`, `<div …>`
- Editfaktor: Textabschnitt (inline) bzw. vollständiger Block (bei `<div>…</div>`)
- Risiko: HTML wird im Render-Layer “verschluckt”, Sanitizer/Renderer verändert Inhalte

---
## 3) Escape-Sequenzen und Sonderzeichen

**Warum wichtig:** Wenn du „Render + Edit“ machst, ist Escape-Verhalten ein häufiger Datenverlust-Kandidat.
- Format: `\* \# \- \|` etc.
- Editfaktor: Textabschnitt
- Risiko: Renderer entfernt Backslashes oder normalisiert sie
---
## 4) Fußnoten, Referenzen, Definitionen (optional, aber relevant für Wissensnotizen)

Falls ihr Obsidian-ähnlich sein wollt, sind das typische Markdown-Erweiterungen:
- Fußnote: `Text[^1]` + `[^1]: Fußnote`
- Referenzen/Definitionslisten (je nach Flavor)
- Editfaktor: Inline für Marker, Block für Definition
---

## 5) Callouts / Admonitions (falls ihr das unterstützt oder später wollt)

Obsidian-Style oder Markdown-Flavor:
- Formatbeispiele: `> [!note]` / `::: warning` (je nach Standard)
- Editfaktor: vollständiger Block
- Risiko: Quote/Block-Container werden „nicht-editierbar“ in Render-Ansicht

---

## 6) Verschachtelung (der unterschätzte Haupttreiber für Editor-Bugs)

Du listest die Typen, aber nicht das „Meta-Thema“: **Kombinationen**.

Beispiele:
- Liste in Quote: `> - item`
- Liste mit Tasklist: `- [ ] …`
- Codeblock in Liste
- Nummerierung mit Unterpunkten
- Mehrere `---` (nicht nur einmal)
- Mehrere Matheblöcke hintereinander
**Warum wichtig:** Viele Fehler entstehen erst bei Nesting; das ist oft der Unterschied zwischen „Demo funktioniert“ und „Real-World bricht“.

---

## 7) Whitespace-Regeln: Leerzeilen, Einrückungen, Tabs

**Warum wichtig:** Markdown ist extrem whitespace-sensitiv.
- Einrückung (4 Spaces) kann Codeblock triggern
- Leerzeilen steuern Listen-/Absatzgrenzen
- Editfaktor: Absatz/Block
- Risiko: Normalizer entfernt Leerzeilen oder “zieht” Blöcke zusammen (dein Fall 2)
---

## 8) Trennlinie vs. Minus-Zeilen vs. Tabellen-Trenner (Konfliktzone)

Du hast `---` als Trennlinie, aber wichtig ist: `---` hat mehrere Bedeutungen:
- Horizontal rule
- YAML Frontmatter Separator (wenn am Dateianfang)
- Tabellen-Header-Trenner `| --- |`
**Warum wichtig:** Deine App nutzt `---` zusätzlich als **Exam/Task/Composite Separator**. Das ist eine echte Collision-Zone.

---

## 9) YAML Frontmatter (falls ihr Obsidian-ähnlich sein wollt)

- Format:
    - `---`
    - `key: value`
    - `---`
- Editfaktor: vollständiger Block (am Dateianfang)

- Risiko: Wird fälschlich als „Exam-Trennlinie“ interpretiert oder umgekehrt

---

## 10) Deine Spezial-Syntax (FMD): #exam, #card, Marker, Optionslabel

Du hast das in Text erwähnt, aber nicht in deiner Typ-Tabelle als eigene Kategorie. Das würde ich ergänzen, weil es funktional entscheidend ist:

- Container: `#exam … #endexam`, `#card … #endcard`
- Marker: `-a`, `-b`, `-true/-false`, `Answer:`/`Antwort:`
- Optionslabels: `a)` `b)` etc.
- Editfaktor: blockweise oder inline je nach Zeile, aber immer 100% editierbar
- Risiko: Parser-/Renderer-Schicht behandelt das als „strukturelle Steuerzeichen“ und sperrt es

---

# Empfehlung: Ergänze deine Tabelle um 3 Meta-Spalten

Damit wird sie als Spezifikation deutlich stärker:

1. **Inline vs Block** (du hast „Editfaktor“ schon, aber “Inline/Block” als klare Klassifikation hilft)
2. **Kollisionsrisiko** (low/medium/high) – wo sich Markdown-Standard mit Exam-Syntax überschneidet (`---`, `1)`, Listen)
3. **Nesting erlaubt?** (ja/nein) – z. B. „Codeblock in Liste“ ja, „Tabelle in Tabelle“ nein

---
> **Grundannahme (global):**
> **Bearbeitbar = ✔️ für alle Einträge.**
> Alles ist Markdown, nichts darf read-only sein.
> _Tabellen sind der einzige explizite Sonderfall (siehe separate Tabelle)._

---

### Tabelle 1 – Markdown-Typen & Editfaktor (vollständig)

| Typ                          | Format                 | Bearbeitbar | Editfaktor               |
| ---------------------------- | ---------------------- | ----------- | ------------------------ |
| Trennlinie (Horizontal Rule) | `---`                  | ✔️          | vollständiger Block      |
| Trennlinie (alternativ)      | `***` / `___`          | ✔️          | vollständiger Block      |
| Aufzählungspunkt             | `-`                    | ✔️          | nur Marker (`-`)         |
| Aufzählungspunkt             | `*` / `+`              | ✔️          | nur Marker               |
| Nummerierung                 | `1.` `2.`              | ✔️          | nur Marker (`1.`)        |
| Nummerierung (Exam-Stil)     | `1)` `2)`              | ✔️          | nur Marker (`1)`)        |
| Unterpunkte (Einrückung)     | `-` / `1.`             | ✔️          | Absatz / Block           |
| Taskliste                    | `- [ ]` / `- [x]`      | ✔️          | nur Marker               |
| Zitat                        | `>`                    | ✔️          | Absatz mit `>`           |
| Verschachteltes Zitat        | `>>`                   | ✔️          | Absatz / Block           |
| Überschrift 1                | `#`                    | ✔️          | nur Marker               |
| Überschrift 2                | `##`                   | ✔️          | nur Marker               |
| Überschrift 3                | `###`                  | ✔️          | nur Marker               |
| Überschrift 4                | `####`                 | ✔️          | nur Marker               |
| Überschrift 5                | `#####`                | ✔️          | nur Marker               |
| Überschrift 6                | `######`               | ✔️          | nur Marker               |
| Fett                         | `**text**`             | ✔️          | Textabschnitt (inline)   |
| Kursiv                       | `*text*` / `_text_`    | ✔️          | Textabschnitt            |
| Fett + Kursiv                | `***text***`           | ✔️          | Textabschnitt            |
| Durchgestrichen              | `~~text~~`             | ✔️          | Textabschnitt            |
| Inline-Code                  | `` `text` ``           | ✔️          | Textabschnitt            |
| Codeblock                    |                        | ✔️          | vollständiger Block      |
| Codeblock (Sprache)          | `js /` sql             | ✔️          | vollständiger Block      |
| Mathe-Inline                 | `$a+b$`                | ✔️          | Textabschnitt            |
| Mathe-Block                  | `$$ … $$`              | ✔️          | vollständiger Block      |
| Mathe-Block mit `<br>`       | `<br>$$ … $$<br>`      | ✔️          | vollständiger Block      |
| Kommentar (FMD)              | `%comment%`            | ✔️          | Textabschnitt            |
| Escape-Zeichen               | `\* \# \- \|`          | ✔️          | Textabschnitt            |
| Link                         | `[text](url)`          | ✔️          | Textabschnitt            |
| Autolink                     | `https://…`            | ✔️          | Textabschnitt            |
| Bild                         | `![alt](src)`          | ✔️          | Block oder Textabschnitt |
| HTML-Inline                  | `<br>` `<sup>` `<sub>` | ✔️          | Textabschnitt            |
| HTML-Block                   | `<div>…</div>`         | ✔️          | vollständiger Block      |
| Absatz                       | Leerzeile              | ✔️          | Absatz                   |
| Mehrfach-Leerzeilen          | `\n\n\n`               | ✔️          | Absatz                   |
| YAML Frontmatter (optional)  | `--- key: value ---`   | ✔️          | vollständiger Block      |
| Definition / Fußnote Marker  | `[^1]`                 | ✔️          | Textabschnitt            |
| Fußnoten-Block               | `[^1]: …`              | ✔️          | vollständiger Block      |
| Callout / Admonition         | `> [!note]`            | ✔️          | vollständiger Block      |
| Exam-Container               | `#exam … #endexam`     | ✔️          | vollständiger Block      |
| Flashcard-Container          | `#card … #endcard`     | ✔️          | vollständiger Block      |
| MC-Option                    | `a)` `b)`              | ✔️          | Absatz                   |
| MC-Antwortmarker             | `-a` `-b`              | ✔️          | nur Marker               |
| True/False-Marker            | `-true` / `-false`     | ✔️          | nur Marker               |
| Cloze (Typed)                | `%answer%`             | ✔️          | Textabschnitt            |
| Cloze (Drag)                 | `"token"`              | ✔️          | Textabschnitt            |
| Kombination cl+cd            | `%text%` + `"token"`   | ✔️          | Textabschnitt            |
| Trennmarker (Exam/Composite) | `---`                  | ✔️          | vollständiger Block      |
| Mehrfache Trennmarker        | `--- ---`              | ✔️          | vollständiger Block      |
| Verschachtelte Blöcke        | Liste → Zitat → Code   | ✔️          | Blockhierarchie          |

### Tabelle 2 – Tabellen-Interaktionen (Kurzfassung)

| Tabellen | Funktion                       | UI                     | Steuerung                             | Voraussetzung          |
| -------- | ------------------------------ | ---------------------- | ------------------------------------- | ---------------------- |
| Spalten  | Einzelspalten-Markierung       | Farbhevorhebung        | Klick auf `Col n`                     |                        |
| Spalten  | Ganze Spalten-Markierung       | spaltenweit            | direkte Spaltenauswahl                | immer nur eine Spalte  |
| Spalten  | Spalte verschieben             | `Col` als Drag-Griff   | Linksklick halten + Maus links/rechts | Spalte markiert        |
| Spalten  | Spalte einfügen (links/rechts) | Plus-Indikator         | Klick auf Einfügepunkt                |                        |
| Spalten  | Spalte löschen                 | Kontextaktion          | Klick / Bestätigung                   | Spalte markiert        |
| Zeilen   | Einzelzeilen-Markierung        | Farbhevorhebung        | Klick auf `Row n`                     |                        |
| Zeilen   | Ganze Zeilen-Markierung        | zeilenweit             | direkte Zeilenauswahl                 | immer nur eine Zeile   |
| Zeilen   | Zeile verschieben              | `Row` als Drag-Griff   | Linksklick halten + Maus hoch/runter  | Zeile markiert         |
| Zeilen   | Zeile einfügen (oben/unten)    | Plus-Indikator         | Klick auf Einfügepunkt                |                        |
| Zeilen   | Zeile löschen                  | Kontextaktion          | Klick / Bestätigung                   | Zeile markiert         |
| Zelle    | Inline-Edit                    | Cursor im Text         | Linksklick in Zelle                   |                        |
| Zelle    | Block-Edit                     | Editor-Overlay         | Klick / Fokus                         | Mehrzeiliger Inhalt    |
| Tabelle  | Kopfzeile markieren            | Farbhevorhebung        | Klick auf Header                      |                        |
| Tabelle  | Separator-Zeile erhalten       | visuell neutral        | keine Autoaktion                      |                        |
| Tabelle  | Gesamttabelle markieren        | Rahmen                 | Klick auf Tabellenrand                |                        |
| Tabelle  | Tabelle als Rohtext bearbeiten | Umschaltaktion         | Klick / Shortcut                      |                        |
| Tabelle  | Rohtext → Render               | Umschaltaktion         | Fokus verlassen                       |                        |
| Tabelle  | Markdown in Zellen             | normal gerendert       | Inline-Edit                           |                        |
| Tabelle  | Navigation                     | visuelle Fokuslinie    | Pfeiltasten / Tab                     |                        |
| Tabelle  | Verlassen der Tabelle          | Cursor außerhalb       | Pfeil / Klick                         |                        |
| Tabelle  | Keine Autoformatierung         | –                      | –                                     | explizite Aktion nötig |

### Tabelle 3 – Tabellen-Interaktionen (Implementierungsdetails)

| Ebene | Funktion | UI/Feedback | Steuerung / Interaktion | Voraussetzung / Regeln |
| --- | --- | --- | --- | --- |
| **Spalten** | **Einzelspalte markieren (Selection)** | Farbhevorhebung der gesamten Spalte + `Col`-Label | Klick auf **`Col n`** | Markierung ist **spaltenweit** (alle Zellen der Spalte); es gibt immer nur **eine** aktive Spaltenselektion |
| **Spalten** | **Mehrfach-/Range-Markierung** | Nicht implementiert | Entfaellt im aktuellen Grid-Modus | Row/Column-Selection ist bewusst auf **Einzelauswahl** reduziert |
| **Spalten** | **Spalte verschieben (Reorder)** | Farbiger Drop-Indicator zwischen Spalten | **`Col n` direkt greifen**: Linksklick halten + nach kleinem Drag-Threshold links/rechts ziehen | Mind. 1 Spalte bleibt immer bestehen; verschoben wird **immer die komplette Spalte** (alle Zeilen) |
| **Spalten** | **Spalte einfügen (links/rechts)** | Plus-Indikator an Einfügepunkt (zwischen Spalten) | Klick auf **Insert-Plus** an der gewünschten Stelle (links/rechts einer Spalte) | Einfuegen bleibt ueber Insert-Plus und Kontextmenue verfuegbar |
| **Spalten** | **Spalte hinzufügen (ohne Edge-Strip)** | Kein separater Rand-Button; Einfuegen ueber Insert-Plus oder Kontextmenue | Klick auf **Insert-Plus** oder Rechtsklick → Insert column links/rechts | Die frueheren linken/rechten Edge-Strips sind entfernt |
| **Spalten** | **Spalte löschen** | Kontextaktion + Bestätigung (optional) | **Entf/Delete** oder **Rechtsklick → Kontextmenü → Delete column** | Voraussetzung: 1 Spalte markiert; **Fail-safe:** nicht unter 1 Spalte löschen; nach Delete Selection stabil neu setzen |
| **Zeilen** | **Einzelzeile markieren (Selection)** | Farbhevorhebung der gesamten Zeile + `Row`-Label | Klick auf **`Row n`** oder `Head` | Markierung ist **zeilenweit** (alle Zellen der Zeile); es gibt immer nur **eine** aktive Zeilenselektion |
| **Zeilen** | **Mehrfach-/Range-Markierung** | Nicht implementiert | Entfaellt im aktuellen Grid-Modus | Row/Column-Selection ist bewusst auf **Einzelauswahl** reduziert |
| **Zeilen** | **Zeile verschieben (Reorder)** | Farbiger Drop-Indicator zwischen Zeilen | **`Row n` direkt greifen**: Linksklick halten + nach kleinem Drag-Threshold hoch/runter ziehen | Verschoben wird **immer die komplette Body-Zeile**; `Head` bleibt fix und startet keinen Reorder |
| **Zeilen** | **Zeile einfügen (oben/unten)** | Plus-Indikator an Einfügepunkt (zwischen Zeilen) | Klick auf **Insert-Plus** ober/unter einer Zeile | Einfuegen bleibt ueber Insert-Plus und Kontextmenue verfuegbar |
| **Zeilen** | **Zeile hinzufügen (ohne Edge-Strip)** | Kein separater Rand-Button; Einfuegen ueber Insert-Plus oder Kontextmenue | Klick auf **Insert-Plus** oder Rechtsklick → Insert row above/below | Der fruehere untere Edge-Strip ist entfernt |
| **Zeilen** | **Zeile löschen** | Kontextaktion + Bestätigung (optional) | **Entf/Delete** oder **Rechtsklick → Kontextmenü → Delete row** | Voraussetzung: 1 Zeile markiert; nach Delete Selection stabil neu setzen |
| **Zelle** | **Inline-Edit** | Cursor im Text, normale Markdown-Inline-Darstellung | Linksklick in Zelle, tippen | Kein “Sprung” beim Tippen; Tab/Shift+Tab navigiert Zellen |
| **Zelle** | **Mehrzeiliger Inhalt** | Sauberes Rendering; optional Editor-Overlay bei Bedarf | Enter/Shift+Enter gemäß bestehender Editor-Regel; optional “Block-Edit” Overlay bei sehr langem Inhalt | Zellinhalt bleibt Markdown-Inline (kein Autoformat, keine Pipe-Zerstörung) |
| **Tabelle (Block)** | **Gesamttabelle aktivieren** | Rahmen/Active-State (z. B. `is-active`) | Klick auf Tabellenrand/Blockfläche oder Fokus in `markdown-hybrid-block-body` | Aktiv-Status steuert Sichtbarkeit von Controls (Toggle etc.) |
| **Tabelle (Block)** | **Code-View Toggle** | Icon-Button oben rechts: `.markdown-hybrid-table-view-toggle` | Klick toggelt **Grid/Table View ↔ Code View (Pipe-Table)** | Toggle ist sichtbar, sobald Tabelle aktiv/angefokust ist (auch nur “Box geklickt”) |
| **Tabelle (Block)** | **Code View bearbeiten** | Code-Editor im Block (Pipe-Table sichtbar) | Edit im Code; Wechsel zurück per Toggle oder Fokus verlassen (je nach Regel) | Beim Zurückschalten: parse → normalisieren; bei invalidem Input: **Fail-safe** (Fehler anzeigen, nichts zerstören) |
| **Tabelle (Struktur)** | **Kopfzeile/Header erhalten** | Header visuell als Kopfzeile | Standard: Header bleibt bestehen; optional markierbar | Header-Row & Separator-Row bleiben valide (Pipe-Table Anforderungen) |
| **Tabelle (Struktur)** | **Separator-Zeile erhalten** | Visuell neutral, keine Autoaktion | Keine automatische Manipulation | Separator darf nicht “wegoptimiert” werden |
| **Navigation** | **Zell-Navigation** | Sichtbare Fokuslinie | Tab / Shift+Tab; optional Pfeiltasten zwischen Zellen | Beim Verlassen: Klick außerhalb oder Pfeil an Rand (je nach bestehendem System) |
| **Selection-State** | **Selection bleibt stabil** | Markierungen bleiben konsistent, keine Glitches | Nach Delete/Reorder Selection deterministisch aktualisieren | Keine invalid indices; bei leerer Selection sauber leeren oder auf Nachbar setzen |
| **Persistenz** | **Kein Auto-Convert zu Code** | Tabelle bleibt Table-Block | Speichern/Laden ohne “Auflösen” | Speicherformat bleibt Markdown Pipe-Table; Normalisierung ohne Datenverlust |
| **Kompatibilität** | **Legacy-Tabellen sichern** | Keine Datenverluste | Beim Laden: Pipe-Table (Text/Legacy) → Table-Block | Best-effort Rückkonvertierung, Fail-safe wenn uneindeutig |
| **Allgemein** | **Undo/Redo** | Wiederherstellung aller Aktionen | Undo/Redo für Edit, Insert, Reorder, Delete, Code-Edits | Keine inkonsistenten Zwischenzustände |
| **Allgemein** | **Kontextmenü** | Right-Click Menu (rows/cols) | Rechtsklick auf markierte Row/Col → Delete / Insert / ggf. weitere Aktionen | Kontextmenü arbeitet auf der aktuell **einzeln** markierten Zeile oder Spalte |
| **Allgemein** | **Auto-Scroll bei Drag** | Smooth Autoscroll | Beim Drag nahe Rand scrollt Container | Besonders wichtig bei großen Tabellen / kleiner Editorgröße |

### Aktueller Hybrid-Editor-Stand

- Pipe-Tabellen werden im `MarkdownHybridEditor` als interaktiver Table-Block geladen und bleiben beim Speichern Pipe-Tabellen.
- Die Tabellenansicht hat einen Grid-Modus und einen Code-Modus; der Umschalter sitzt auf `.markdown-hybrid-table-view-toggle`.
- Der Grid-Modus sieht bewusst wie eine normale Markdown-Tabelle aus und nicht wie ein Kachelraster; Zeilen- und Spaltensteuerung sitzen in schmalen Gutter-Bereichen.
- Auch im reinen View-Modus bleiben Tabellen normale `.markdown-table`-Tabellen, rendern mehrzeilige Zellinhalte aber bewusst fast gleich wie der Grid-Modus.
- Zellbearbeitung passiert direkt im Grid. Zeilenumbrüche in Zellen werden beim Speichern als `<br>` geschrieben.
- In Tabellenzellen bleibt ein einzelnes `<br>` ein Zeilenumbruch; doppelte `<br><br>` werden im View- und Grid-Modus als Absatztrennung dargestellt.
- Kopfzeile und Separator bleiben erhalten. Zeilenoperationen gelten fuer Body-Zeilen, Spaltenoperationen fuer die gesamte Tabelle.
- `Col` und `Row` sind direkte Greifflaechen: Klick selektiert, ein kleiner Pointer-Threshold startet den Reorder.
- Fuer Row/Column-Selection gibt es bewusst keine Multi-Selection oder Range-Selection mehr.
- Beim Reorder erscheint ein farbiger Einfuegestreifen zwischen Zielspalten bzw. Zielzeilen.
- Die frueheren `+`-Strips links, rechts und unten sind entfernt; Einfuegen passiert ueber die Plus-Buttons in den Gutter-Bereichen oder ueber das Kontextmenue.
- Falls Code-View-Inhalt nicht sofort gueltig ist, versucht der Editor eine Best-effort-Normalisierung. Wenn das nicht eindeutig moeglich ist, bleibt die Tabelle im Code-Modus und zeigt einen Fehler statt Inhalte zu zerstoeren.

---

## Wichtige Klarstellung (entscheidend für Bugs)

- **Bearbeitbar ist IMMER ✔️**
    „Editfaktor“ beschreibt **nur**, _wie_ in Rohtext gewechselt wird – nicht _ob_.

- **Kein Typ darf:**
    - automatisch umnummeriert werden
    - strukturell „fixiert“ sein
    - nur über UI-Controls statt Text editierbar sein


<aside>
💡
ycd
</aside>

`sdfgdg`

ASDA %% gdfgsfgh %% SAD
**asdA** fgfsdg

***wdasafsdfdsaf***
