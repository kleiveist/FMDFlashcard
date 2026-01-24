<!-- AUTO-GENERATED:backlink START -->
[← Back](de.md)
<!-- AUTO-GENERATED:backlink END -->
---
### Tabelle 1 – Markdown-Typen & Editfaktor (vollständig)

| Typ                          | Format                     | Bearbeitbar | Editfaktor               |
| ---------------------------- | -------------------------- | ----------- | ------------------------ |
| Trennlinie (Horizontal Rule) | `---`                      |             | vollständiger Block      |
| Trennlinie (alternativ)      | `***` / `___`              |             | vollständiger Block      |
| Aufzählungspunkt             | `-`                        |             | nur Marker (`-`)         |
| Aufzählungspunkt             | `*` / `+`                  |             | nur Marker               |
| Nummerierung                 | `1.` `2.`                  |             | nur Marker (`1.`)        |
| Nummerierung (Exam-Stil)     | `1)` `2)`                  |             | nur Marker (`1)`)        |
| Unterpunkte (Einrückung)     | `-` / `1.`                 |             | Absatz / Block           |
| Taskliste                    | `- [ ]` / `- [x]`          |             | nur Marker               |
| Zitat                        | `>`                        |             | Absatz mit `>`           |
| Verschachteltes Zitat        | `>>`                       |             | Absatz / Block           |
| Überschrift 1                | `#`                        |             | nur Marker               |
| Überschrift 2                | `##`                       |             | nur Marker               |
| Überschrift 3                | `###`                      |             | nur Marker               |
| Überschrift 4                | `####`                     |             | nur Marker               |
| Überschrift 5                | `#####`                    |             | nur Marker               |
| Überschrift 6                | `######`                   |             | nur Marker               |
| Fett                         | `**text**`                 |             | Textabschnitt (inline)   |
| Kursiv                       | `*text*` / `_text_`        |             | Textabschnitt            |
| Fett + Kursiv                | `***text***`               |             | Textabschnitt            |
| Durchgestrichen              | `~~text~~`                 |             | Textabschnitt            |
| Inline-Code                  | `` `text` ``               |             | Textabschnitt            |
| Codeblock                    | `` ```code``` ``           |             | vollständiger Block      |
| Trennmarker (Exam/Composite) | `---`                      | ✔️          | vollständiger Block      |
| Mehrfache Trennmarker        | `--- ---`                  | ✔️          | vollständiger Block      |
| Codeblock (Sprache)          | `js /` sql                 | ✔️          | vollständiger Block      |
| Mathe-Inline                 | `$a+b$`                    | ✔️          | Textabschnitt            |
| Mathe-Block                  | `$$ … $$`                  | ✔️          | vollständiger Block      |
| Mathe-Block mit `<br>`       | `<br>$$ … $$<br>`          | ✔️          | vollständiger Block      |
| Kommentar (FMD)              | `%comment%`              | ✔️          | Textabschnitt            |
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
| Cloze (Typed)                | `%answer%`               | ✔️          | Textabschnitt            |
| Cloze (Drag)                 | `"token"`           | ✔️          | Textabschnitt            |
| Kombination cl+cd            | `%text%` + `"token"` | ✔️          | Textabschnitt            |
| Verschachtelte Blöcke        | Liste → Zitat → Code       | ✔️          | Blockhierarchie          |

---

## Wichtige Klarstellung (entscheidend für Bugs)

- **Bearbeitbar ist IMMER ✔️**
    „Editfaktor“ beschreibt **nur**, _wie_ in Rohtext gewechselt wird – nicht _ob_.

- **Kein Typ darf:**
    - automatisch umnummeriert werden
    - strukturell „fixiert“ sein
    - nur über UI-Controls statt Text editierbar sein
