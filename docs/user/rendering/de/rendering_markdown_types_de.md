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

- Container: `#exam … #examend`, `#card … #`
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

| Typ                          | Format                     | Bearbeitbar | Editfaktor               |
| ---------------------------- | -------------------------- | ----------- | ------------------------ |
| Trennlinie (Horizontal Rule) | `---`                      | ✔️          | vollständiger Block      |
| Trennlinie (alternativ)      | `***` / `___`              | ✔️          | vollständiger Block      |
| Aufzählungspunkt             | `-`                        | ✔️          | nur Marker (`-`)         |
| Aufzählungspunkt             | `*` / `+`                  | ✔️          | nur Marker               |
| Nummerierung                 | `1.` `2.`                  | ✔️          | nur Marker (`1.`)        |
| Nummerierung (Exam-Stil)     | `1)` `2)`                  | ✔️          | nur Marker (`1)`)        |
| Unterpunkte (Einrückung)     | `-` / `1.`                 | ✔️          | Absatz / Block           |
| Taskliste                    | `- [ ]` / `- [x]`          | ✔️          | nur Marker               |
| Zitat                        | `>`                        | ✔️          | Absatz mit `>`           |
| Verschachteltes Zitat        | `>>`                       | ✔️          | Absatz / Block           |
| Überschrift 1                | `#`                        | ✔️          | nur Marker               |
| Überschrift 2                | `##`                       | ✔️          | nur Marker               |
| Überschrift 3                | `###`                      | ✔️          | nur Marker               |
| Überschrift 4                | `####`                     | ✔️          | nur Marker               |
| Überschrift 5                | `#####`                    | ✔️          | nur Marker               |
| Überschrift 6                | `######`                   | ✔️          | nur Marker               |
| Fett                         | `**text**`                 | ✔️          | Textabschnitt (inline)   |
| Kursiv                       | `*text*` / `_text_`        | ✔️          | Textabschnitt            |
| Fett + Kursiv                | `***text***`               | ✔️          | Textabschnitt            |
| Durchgestrichen              | `~~text~~`                 | ✔️          | Textabschnitt            |
| Inline-Code                  | `` `text` ``               | ✔️          | Textabschnitt            |
| Codeblock                    |                            | ✔️          | vollständiger Block      |
| Codeblock (Sprache)          | `js /` sql                 | ✔️          | vollständiger Block      |
| Mathe-Inline                 | `$a+b$`                    | ✔️          | Textabschnitt            |
| Mathe-Block                  | `$$ … $$`                  | ✔️          | vollständiger Block      |
| Mathe-Block mit `<br>`       | `<br>$$ … $$<br>`          | ✔️          | vollständiger Block      |
| Kommentar (FMD)              | `%%comment%%`              | ✔️          | Textabschnitt            |
| Escape-Zeichen               | `\* \# \- \|`              | ✔️          | Textabschnitt            |
| Link                         | `[text](url)`              | ✔️          | Textabschnitt            |
| Autolink                     | `https://…`                | ✔️          | Textabschnitt            |
| Bild                         | `![alt](src)`              | ✔️          | Block oder Textabschnitt |
| HTML-Inline                  | `<br>` `<sup>` `<sub>`     | ✔️          | Textabschnitt            |
| HTML-Block                   | `<div>…</div>`             | ✔️          | vollständiger Block      |
| Absatz                       | Leerzeile                  | ✔️          | Absatz                   |
| Mehrfach-Leerzeilen          | `\n\n\n`                   | ✔️          | Absatz                   |
| YAML Frontmatter (optional)  | `--- key: value ---`       | ✔️          | vollständiger Block      |
| Definition / Fußnote Marker  | `[^1]`                     | ✔️          | Textabschnitt            |
| Fußnoten-Block               | `[^1]: …`                  | ✔️          | vollständiger Block      |
| Callout / Admonition         | `> [!note]`                | ✔️          | vollständiger Block      |
| Exam-Container               | `#exam … #examend`         | ✔️          | vollständiger Block      |
| Flashcard-Container          | `#card … #`                | ✔️          | vollständiger Block      |
| MC-Option                    | `a)` `b)`                  | ✔️          | Absatz                   |
| MC-Antwortmarker             | `-a` `-b`                  | ✔️          | nur Marker               |
| True/False-Marker            | `-true` / `-false`         | ✔️          | nur Marker               |
| Cloze (Typed)                | `%%answer%%`               | ✔️          | Textabschnitt            |
| Cloze (Drag)                 | `` `token` ``              | ✔️          | Textabschnitt            |
| Kombination cl+cd            | `%%text%%` + `` `token` `` | ✔️          | Textabschnitt            |
| Trennmarker (Exam/Composite) | `---`                      | ✔️          | vollständiger Block      |
| Mehrfache Trennmarker        | `--- ---`                  | ✔️          | vollständiger Block      |
| Verschachtelte Blöcke        | Liste → Zitat → Code       | ✔️          | Blockhierarchie          |

---

## Wichtige Klarstellung (entscheidend für Bugs)

- **Bearbeitbar ist IMMER ✔️**
    „Editfaktor“ beschreibt **nur**, _wie_ in Rohtext gewechselt wird – nicht _ob_.

- **Kein Typ darf:**
    - automatisch umnummeriert werden
    - strukturell „fixiert“ sein
    - nur über UI-Controls statt Text editierbar sein
