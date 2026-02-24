<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->
# Vault

## Purpose

The Vault page manages your local Markdown vault: selecting the folder, scanning for cards and exams, maintaining the index, and browsing the folder tree.

## Main areas

- **Vault selector:** Choose or change the vault root folder.
- **Active vault badge (🔄):** Refresh/rescan the currently selected vault from disk to pick up renamed/moved files and rebuild the folder tree and index.
- **Folder tree:** Browse and open Markdown files; file/folder actions (if supported).
- **Scan / index controls:** Rescan, reload, and indexing progress.
- **Filters:** Search/tags and other view filters (implementation-dependent).

## Typical workflows

### Load a vault for the first time

1. Open Vault.
2. Select the vault root folder that contains your `.md` notes.
3. Run the initial scan and wait for indexing to complete.
4. Open a file from the tree to verify parsing is correct.

### Rescan after refactors

1. After renames/moves, click **🔄 refresh** (or use other rescan controls, if available).
2. Confirm the folder tree reflects the filesystem state (renamed files appear under the new name; old entries disappear).
3. Re-check card/exam counts in the study modes to ensure the index is consistent.

## Notes / tips

- If “Open folder/path” does not launch the system explorer, treat it as a UI integration issue and capture OS + version.
- If the folder tree looks stale after renames/moves, use **🔄 refresh** to force a full rescan from disk (not just a soft reload of cached data).

## Vault Directory: Markdown editability

In the Vault Directory view, Markdown content should remain editable in the Markdown editor. Raw text and raw text edit resolve correctly, but some Markdown renderings are currently non-editable or auto-formatted.

Falsch aufgelost = X
Richtig aufgelost = OK

| Textform                                                                                                                                                                                                                                                                                                                                                                                     | Rohtext | Rohtext Edit | Markdown                 | Markdown Edit                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | ------------------------ | ---------------------------------------------------------------------------------------------- |
| 1) [m1] Welche Aussage beschreibt am prazisesten den Begriff "Relation" im relationalen Datenmodell?<br>a) Eine einzelne Zeile in einer Tabelle (ein Datensatz)<br>b) Eine gesamte Tabelle mit gleich strukturierten Datensatzen<br>c) Eine einzelne Spalte in einer Tabelle (ein Attribut)<br>d) Ein SQL-Statement zum Abfragen von Daten<br>-b<br>---                                      | ✔️      | ✔️           | ❌<br>Fliestext Auflosung | ❌<br>es werden immer automatische ziffern<br>1. 2. ... 10.<br>erzeugt die ich bearbeitbar sind |
| 2) Welche Eigenschaft muss ein Primarschlussel in einer relationalen Tabelle erfullen?<br><br>a) Er darf NULL-Werte enthalten, wenn ein Default definiert ist<br><br>b) Er muss eindeutig sein und darf nicht NULL sein<br><br>c) Er ist immer ein zusammengesetzter Schlussel aus mehreren Spalten<br><br>d) Er referenziert immer einen Primarschlussel in einer anderen Tabelle<br><br>-b | ✔️      | ✔️           | ✔️                       | ❔<br>Markdown bereich hat keine bearbeitbaren absatze<br>wahrend Rohtext ihn hat               |

Fazit: Alles soll im Markdown-Format bearbeitbar sein.
Editdfaktor = Wie werden bereich editirt also in Rohtext umgwandelt 
Tabelle 1 – Markdown-Typen & Editfaktor (vollständig)

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
| Exam-Container               | `#exam … #endexam`         | ✔️          | vollständiger Block      |
| Flashcard-Container          | `#card … #endcard`                | ✔️          | vollständiger Block      |
| MC-Option                    | `a)` `b)`                  | ✔️          | Absatz                   |
| MC-Antwortmarker             | `-a` `-b`                  | ✔️          | nur Marker               |
| True/False-Marker            | `-true` / `-false`         | ✔️          | nur Marker               |
| Cloze (Typed)                | `%answer%`               | ✔️          | Textabschnitt            |
| Cloze (Drag)                 | `"token"`           | ✔️          | Textabschnitt            |
| Kombination cl+cd            | `%text%` + `"token"` | ✔️          | Textabschnitt            |
| Trennmarker (Exam/Composite) | `---`                      | ✔️          | vollständiger Block      |
| Mehrfache Trennmarker        | `--- ---`                  | ✔️          | vollständiger Block      |
| Verschachtelte Blöcke        | Liste → Zitat → Code       | ✔️          | Blockhierarchie          |

```sgq
DDD
```

$$
 5 + 5
$$

Tabellen sind ein Sonderfall zur Editierung.

| Tabellen                                | Funktzion                 | UI                                   | Steuerung                                                              | Vorraussezung            |
| --------------------------------------- | ------------------------- | ------------------------------------ | ---------------------------------------------------------------------- | ------------------------ |
| Spalten                                 | Einzelspalten Markierung  | Frabehvohebung                       | rech gedückt halten zeihen                                             |                          |
| Spalten                                 | Ganzen Spaltenmakriung    | Frabehvohebung                       | rech gedückt halten über gesammte saplte zeihen                        |                          |
| Spalten                                 | Ganze Spalte verscheiben  | Greiffläche Oben Unten               | Gedrückhalten links: links/recht maus bewegen bewegt spalte L/R Spalte | Spalte muss makiert sein |
| Zeile                                   | Einzezeilen<br>Markierung | Frabehvohebung                       | rech gedückt halten zeihen                                             |                          |
| Zeile                                   | Ganzen Zeilenmakriung     | Frabehvohebung                       | rech gedückt halten über gedammte zielen zeihen                        |                          |
| Zeile                                   | Ganze zeilen verscheiben  | Greiffläche links recht              | Gedrückhalten links: links/recht Maus bewegen bewegt spalte L/R Spalte | Zeilen muss makiert sein |
| Text kann nomal beabeit werrden         | normalöe textbeabeitung   | Text beabeitung in md format möglich | linksklick ins feld                                                    |                          |
| text mit Typ mit Editfaktor wie tabelle | text wie `text`           | nach Editfaktor umwandeln in Rohtext | links klick in feld oder auf aufzulösenden stelle                      |                          |
|                                         |                           |                                      |                                                                        |                          |
