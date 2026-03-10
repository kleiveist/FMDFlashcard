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

## Related media syntax

Card/task media is defined directly in Markdown, without `#media ... #mediaend`.

````md
#card
Question text

![[images/example.png]]
![[images/example.png|Optional label]]

```svg
<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>
```

Answer: Example
#endcard
````

- PNG media uses Obsidian-style embeds: `![[relative/path.png]]`.
- Optional PNG label/alt text uses `|`: `![[relative/path.png|Label]]`.
- PNG embeds are rendered as media blocks only when the embed is on a standalone line.
- SVG media uses fenced code blocks with exact info string `svg`.
- Invalid or non-renderable SVG falls back to code view.
- Legacy `#media ... #mediaend` is no longer parsed as a media feature.
