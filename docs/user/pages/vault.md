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

| Typ                        | Format                 | Bearbeitbar | Editfaktor                         |     |
| -------------------------- | ---------------------- | ----------- | ---------------------------------- | --- |
| Trennlinien                | ---                    | ❌           | nur --- -----                      |     |
| Punkte                     | -                      | ❌           | nur -                              |     |
| Nummerierung               | 1. 2.                  | ❌           | nur 1. 2.                          |     |
| Tags                       | #text                  | ❌           | Textabschnitt                      |     |
| Fetter Text                | **fett**               | ❌           | Textabschnitt                      |     |
| Kommentare                 | %%asdasd%%             | ❌           | Textabschnitt                      |     |
| Codeblocke (Quellenbox)    | ```sgq<br><br>s<br>``` | ❌           | Absatz bzw <br>vollständiger block |     |
| Quellentext                | `t`                    | ❌           | Textabschnitt                      |     |
| - [ ]                      | Aufgabeliste           | ❌           | nur - [ ]                          |     |
| >                          | Zitate                 | ❌           | Absatz mit >                       |     |
| ====                       | Hervorheben            | ❌           | Textabschnitt                      |     |
| $$<br><br>$$               | Matheblock             | ❌           | Absatz bzw <br>vollständiger block |     |
| **                         | Kursiv                 | ❌           | Textabschnitt                      |     |
| ~~ss~~                     | Durchstreichen         | ❌           | Textabschnitt                      |     |
| #                          | Uberschrift 1          | ❌           | nur #                              |     |
| ##                         | Uberschrift 2          | ❌           | nur ##                             |     |
| ###                        | Uberschrift 3          | ❌           | nur ###                            |     |
| ####                       | Uberschrift 4          | ❌           | nur ####                           |     |
| #####                      | Uberschrift 5          | ❌           | nur #####                          |     |
| ######                     | Uberschrift 6          | ❌           | nur ######                         |     |
| <br>$$<br> 5 + 5<br>$$<br> | Mahateblock            | ❌           | Absatz bzw <br>vollständiger block |     |
|                            |                        |             |                                    |     |


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


## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
- `../troubleshooting.md`
