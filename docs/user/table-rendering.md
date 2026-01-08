<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
# Tables in Flashcards and Exams

## Purpose

Tables in FMDFlashcard are primarily a **layout tool**: they let you structure prompts and answers in a clear grid without changing the learning logic. This applies to:

- `#card` blocks (flashcards)
- `#exam … #examend` blocks (exam tasks)

Important: A table is **presentation only**. Evaluation (e.g., Cloze typed blanks and drag tokens) behaves the same as in normal text.

## Supported table syntax

FMDFlashcard renders tables written in **Markdown pipe-table** format. In most Markdown renderers, a table requires:

1) a header row
2) a separator row using `---`

If you do **not** want visible headings, use an **empty header**:


|   |   |
|---|---|
| A | B |

## Rules for stable rendering
- Each table row must have the **same number of columns**.
- Use `|` only as a table delimiter (avoid using `|` as normal text inside cells).
- For line breaks inside a cell, prefer `<br>` instead of empty lines.
- Avoid segment separators like `---` **inside** a table (it may be interpreted as a section divider).
## Layout behavior and scrolling
### Card height
- Flashcards that render tables **auto-expand in height** to fit the content.
- Therefore, flashcards should **not** require vertical scrolling
### Horizontal behavior
- Cards should **adapt to the available width** of the content area.
- If a table becomes too wide to remain readable, the UI may provide a **horizontal scrollbar** as a fallback.
### Important constraint for token cards
- Cards that contain **interactive tokens/blanks** (e.g., `cd`, `cl`, `cld`) must **not** be placed inside scrollable containers.  
    Scrollable containers tend to cause drag/drop and focus bugs.
- This is acceptable because token tables are limited in practice (typically **max. 3 columns**) and should fit the card layout without needing scrolling.
## Interactive content inside table cells
### CL (typed blanks) in tables
Typed blanks are marked with `%%...%%` and can appear inside any table cell.
```q
#card
|   |   |
|---|---|
| Only rows with matches in both tables | %%INNER JOIN%% |
| All rows from the left + matching right rows | %%LEFT JOIN%% |
#
```
### CD (drag tokens) in tables

Drag tokens are marked with backticks (e.g., `` `WHERE` ``) and can be placed in table cells.
```q
#card
|   |   |
|---|---|
| Filter rows | `WHERE` |
| Sort results | `ORDER BY` |
#
```
### CLD (typed blanks + drag tokens) in tables

Combination of drag tokens and typed blanks inside table cells.
```q
#card
|   |   |
|---|---|
| Filter | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Limit  | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#
```
## Tables inside exam blocks

Tables can also be part of an exam prompt within `#exam`.

```q
#exam
1) Fill in JOIN types (CL)
|   |   |
|---|---|
| Only matches in both tables | %%INNER JOIN%% |
| All left rows + matching right rows | %%LEFT JOIN%% |

---
2) Drag + type (CLD)
|   |   |
|---|---|
| Filter | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sort   | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
#examend

```
## Troubleshooting

### Table is not rendered as a table
- Confirm that the header row and separator row exist (`|...|...|` and `|---|---|`).
- Confirm that every row has the same number of columns.
### Layout breaks in narrow windows
- The card should adapt to the available width.
- If the table becomes unreadable, the UI may fall back to a horizontal scrollbar for the rendered card.
- If neither adaptive layout nor horizontal scrolling works, this is a UI bug.
### Tokens/blanks do not work inside table cells
- This is a rendering/UI issue. The syntax is valid.
- Please create an issue and include a minimal reproduction card (the smallest possible example that still fails).
