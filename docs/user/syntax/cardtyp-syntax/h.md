<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `h`: Help / Hint block (compatible with all card types)

A `#help … #helpend` block (`h`) declares a **non-graded help/hint container** that can be embedded anywhere a flashcard task is parsed. It is designed to provide optional guidance (hints, reminders, definitions, mini-cheat-sheets) **without changing the detected interaction type** (qa/tf/m1/m2/cl/cd/cld) and without affecting scoring.

This block is **fully compatible with all flashcard types** because it is treated as **auxiliary metadata/content** that the UI may render as a collapsible “Hint/Help” panel.

## Syntax

```md
#card
QUESTION TEXT

Answer: ANSWER TEXT

#help
Hint title (optional): KEY IDEA
- Hint line 1
- Hint line 2

Additional hint paragraph text.
#helpend

#endcard
```
- A `#help … #helpend` block must be placed **inside a scope** so it can be assigned correctly:
    - **Inside `#card … #endcard`** → the hint is attached to that **flashcard**.
    - **Inside an exam task (`ea`)** (i.e., within the numbered task block in `#exam … #endexam`) → the hint is attached to that **specific exam task**.
- If `#help … #helpend` is placed **outside** any `#card` block and **outside** an `ea` task, it is **ignored** (or treated as plain Markdown), because no valid target scope can be determined.
- Recommended placement: put `#help … #helpend` **directly before or after** the interaction content within the same card/task, so the UI loads it reliably for the intended item
## Behavior

- **Non-intrusive parsing:** The parser should extract `#help … #helpend` blocks and store their content as `helpText[]` (or equivalent) for the surrounding scope, while excluding these lines from interaction detection (so `-true`, `-a`, `Answer:` inside help must **not** be treated as solutions).

- **Scope rules (recommended):**
    - Inside `#card … #endcard`: the help block attaches to that card.
    - Inside `#exam … #endexam`: the help block only becomes relevant if it sits inside a numbered task (`ea`) (same rule as cards), and attaches to that task/card.
- **UI expectations:** Render help as optional content (e.g., a “Show hint” toggle). Help does not affect correctness, grading, or SRS scheduling.
    
- **Compatibility guarantee:** `h` can coexist with qa/tf/m1/m2/cl/cd/cld because it is treated as a separate “side channel” and removed before the main detectors run, preventing false positives and preserving stable detection.

## Related media block

Cards may also define a separate auxiliary media channel via `#media ... #mediaend`.

````md
#card
Question text

#media
[[images/example.png]]

```svg
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>
```
#mediaend

Answer: Example
#endcard
````

- `#media ... #mediaend` is card-scoped and is extracted before interaction detection, just like `#help`.
- Inside `#media`, supported entries are standalone wikilinks such as `[[image.png]]` and fenced code blocks whose info string is exactly `svg`.
- Runtime views resolve image wikilinks to rendered media and resolve valid `svg` fences to a live SVG preview.
- Invalid SVG falls back to the raw code block with an `SVG invalid` indicator.
