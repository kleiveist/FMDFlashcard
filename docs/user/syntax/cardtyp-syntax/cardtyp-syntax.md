# Gesamtinhalte – Root: /home/kleif/Projects/FMDFlashcard/docs/user/syntax/cardtyp-syntax

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Code `cd`: Cloze (drag tokens)](cd.md)
- 📝 [Code `cl`: Cloze (typed blanks)](cl.md)
- 📝 [Code `cld`: Cloze (typed blanks + drag tokens)](cld.md)
- 📝 [Code `e`: Exam block container](e.md)
- 📝 [Code `ea`: Exam task block](ea.md)
- 📝 [Code `f`: Flashcard block container](f.md)
- 📝 [Code `h`: Help / Hint block (compatible with all card types)](h.md)
- 📝 [Code `m1`: Single-answer multiple choice](m1.md)
- 📝 [Code `m2`: Multi-answer multiple choice](m2.md)
- 📝 [Code `qa`: Answer marker (Q/A part)](qa.md)
- 📝 [Code `tf`: True/False marker (2-button card)](tf.md)

<!-- AUTO-GENERATED:docs-index END -->

## 📝 cd.md — ./cd.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cd`: Cloze (drag tokens)

Drag tokens use the `"token"` syntax to create draggable pieces learners can drop into blanks. The parser reads these markers as drag-and-drop solutions inside the same cloze pipeline.

```md
#card
The colors of the German flag are "black", "red", and "gold".
#
```

- Each `"token"` marker becomes a drag token that learners can drag into the drop zone associated with that blank.
- Empty tokens are ignored, so always place visible text inside the quotes.
- Drag tokens work alongside typed cloze blanks; both are treated as `cloze` parts with `kind` `drag` in the segment list.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle order is seeded by the card/part identity so repeated views keep the same arrangement.

## Behavior notes

- Use drag tokens when you want the learner to match predefined units instead of typing them.
- Drag and typed blanks render together on the same UI if they belong to the same block. If you need to mix drag tokens with other modes (TF or MC), separate them with `---` or split into different tasks.
- Backticks are treated as normal inline code and do not create drag blanks.

### Drag tokens mit Codeblock

````md
#card
```q
The colors of the German flag are "black", "red", and "gold".
```
#
````

---

## 📝 cl.md — ./cl.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cl`: Cloze (typed blanks)

Typed clozes use the `%...%` syntax to turn inline fragments into input fields (`cl`). The learner must type the missing words exactly as written (normalization is trim-and-lowercase by default).

```md
#card
The capital of France is %Paris%.
#
```

- Each `%…%` pair becomes an input blank. The parser trims the text inside; blanks without any content are rejected.
- You can combine cloze blanks and drag tokens in the same question as long as the interactions stay within one block. Drag tokens use `"..."`. When cl and cd coexist, the parser spawns both blank and drag segments.
- The blank solutions are case-insensitive and trimmed; punctuation inside the solution is preserved, so `%Paris%` differs from `%Paris,%`.

## Behavior notes

- Cloze blanks can appear in the prompt or in body text, and the parser splits them into segments for the UI.
- If you need to mix typed blanks with other interactions (MC, TF), insert `---` between them or split them into separate tasks to keep scoring manageable.

### Typed mit Codeblock

````md
#card
```sql
The capital of France is %Paris%.
```
#
````

---

## 📝 cld.md — ./cld.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cld`: Cloze (typed blanks + drag tokens)

`cld` is the combined Cloze format that supports **both**:
- **Typed blanks** using `%...%`
- **Drag tokens** using `"token"`

- This lets you build a single cloze interaction where learners can either type answers (typed blanks) and/or use a token bank (drag tokens) within the same part.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle sequence is seeded by the card/part identity so the same task keeps the same order within a session.
- Backticks are treated as normal inline code and do not create drag blanks.
---
## Syntax

### Typed blanks
Use `%...%` to create an input field. The text inside is the **solution**.

Example:
```md
#card
The `capital` of France is %Paris%.
#
```
---
### Drag tokens
Use `"..."` to create a drag token. The text inside the quotes is the **solution**.

Example:
```md
#card
The colors are "black", "red", and "gold".
#
```
---
### Typed mit Codeblock

````md
#card
```c#
The `capital` of France is %Paris%.
```
#
````




---

## 📝 e.md — ./e.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `e`: Exam block container

Use `#exam` and `#examend` to wrap the section you want the Exams page to treat as a dedicated exam session. Anything between these markers runs through the exam parser and renders in the **Exam** view; outside the markers the content behaves like a regular deck.

## Syntax summary

| Component | Purpose |
| --- | --- |
| `#exam` | Stand-alone line that opens the exam block. It signals the Exams page and parser to expect numbered tasks (`ea`). |
| Content between | Treated as an exam file. Free text is allowed, but actual interaction data only comes from the numbered tasks that follow exam numbering rules. |
| `#examend` | Stand-alone line that closes the block. Ignore it in the UI; no flashcards are created past this point unless a new card block opens. |
| `#` | Still closes a `#card` block inside an exam task just like everywhere else. The exam block itself is not closed by `#`. |

## Behavior reminders

- Do **not** display `#exam` / `#examend` as visible text—the Exams page keeps those wrappers out of the UI.
- Mark the entire exam file or section as exam content so that scans treat it differently than standard flashcards.
- Only numbered tasks (`ea`) yield cards; stray text between tasks is rendered as instructions or context.
- You can still embed `#card … #` blocks inside a task, the parser merges them, and their interactions obey the usual flashcard rules.
- `#exam` does not interfere with `#card`; every card still needs its own `#` terminator.

For details on each code, follow the respective files above (`ea`, `f`, `qa`, `tf`, `m1`, `m2`, `cl`, `cd`).

---

## 📝 ea.md — ./ea.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `ea`: Exam task block

An exam task (`ea`) is the smallest unit that the Exams page turns into an interactive item. Each task starts with a numbered line and continues until the next break marker, a new number, or the end of the exam block.

## Recognizing the start

The parser looks at every line between `#exam` and `#examend`. A new task begins when a trimmed line starts with a number from **1 to 20**. The following variations are all valid:

- `1. Prompt text…`
- `2)` or `2.)`
- `**3)**` (it allows bold markers to highlight the heading)
- `-4. Subtask` (a leading hyphen is stripped before checking the digits)

After the number you can optionally continue with `)`, `.`, `)`, or bold markers; the parser only requires whitespace after the numeric part so that a line such as `5. Explain…` works.

## Ending a task

A task chunk is considered finished when one of these markers appears between the current line and the next:

1. A line that contains exactly `---`. This is also the separator for composite tasks inside one `#card`.
2. Another numbered start line (`ea`). The parser flushes the previous task when it sees the next number.
3. `#examend`, which ensures the final task is emitted.

## What to place inside

- Write the prompt or context just beneath the numbering line.
- Use a single interaction type per task (qa/tf/m1/m2/cl/cd) to keep grading predictable. If you mix types, insert `---` between them so the parser treats each part independently.
- You can still wrap the task text inside a `#card … #` block; the parser adds the task prompt to a temporary card before detecting interactions.
- The Exams page records the official answer when you add answer markers (`qa`) or any graded interaction (tf/m1/m2/cl/cd).

Example:

```md
#exam
1) Discuss the principle of least privilege.
Answer: The principle says …
---
2) Is the following statement true or false?
The principle of least privilege limits what users can do.
-true
#examend
```

Every numbered heading above becomes one `ea` task, with its own prompt and answer chunk.

---

## 📝 f.md — ./f.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `f`: Flashcard block container

A `#card … #` block (`f`) declares the flashcard boundaries that the parser scans. You can use it inside or outside exam content. Inside an exam, the block is only processed if it sits inside a numbered task (`ea`).

## Syntax

```md
#card
Question or prompt text
Answer: The answer text
#
```

- The opening `#card` and the closing `#` must each sit on their own line.
- Everything between those markers is split into sub-blocks (`splitCardLines`), which may become QA text, true/false pairs, MC options, or cloze parts.
- You can host multiple interactions inside a single `#card` by separating them with `---`. Each segment contributes one detected interaction type.
- `#card` is unaffected by `#exam`; the exam wrapper only changes which cards are surfaced in the Exams view.

When you nest this pattern inside an `ea` task, it becomes the container for the official task prompt that the exam parser converts into an `ExamTask` object.

---

## 📝 h.md — ./h.md

# Code `h`: Help / Hint block (compatible with all card types)

A `#help … #helpend` block (`h`) declares a **non-graded help/hint container** that can be embedded anywhere a flashcard task is parsed. It is designed to provide optional guidance (hints, reminders, definitions, mini-cheat-sheets) **without changing the detected interaction type** (qa/tf/m1/m2/cl/cd/cld) and without affecting scoring.

This block is **fully compatible with all flashcard types** because it is treated as **auxiliary metadata/content** that the UI may render as a collapsible “Hint/Help” panel.

## Syntax

```md
#card 
1. Help is Help? 
answer:

#help
Hint title (optional): Key idea
- Short hint line 1
- Short hint line 2

You may also use paragraphs, lists, or small tables.
#helpend

#
```
- A `#help … #` block must be placed **inside a scope** so it can be assigned correctly:
    - **Inside `#card … #`** → the hint is attached to that **flashcard**.
    - **Inside an exam task (`ea`)** (i.e., within the numbered task block in `#exam … #examend`) → the hint is attached to that **specific exam task**.
- If `#help … #` is placed **outside** any `#card` block and **outside** an `ea` task, it is **ignored** (or treated as plain Markdown), because no valid target scope can be determined.
- Recommended placement: put `#help … #` **directly before or after** the interaction content within the same card/task, so the UI loads it reliably for the intended item
## Behavior

- **Non-intrusive parsing:** The parser should extract `#help … #` blocks and store their content as `helpText[]` (or equivalent) for the surrounding scope, while excluding these lines from interaction detection (so `-true`, `-a`, `Answer:` inside help must **not** be treated as solutions).

- **Scope rules (recommended):**
    - Inside `#card … #`: the help block attaches to that card.
    - Inside `#exam … #examend`: the help block only becomes relevant if it sits inside a numbered task (`ea`) (same rule as cards), and attaches to that task/card.
- **UI expectations:** Render help as optional content (e.g., a “Show hint” toggle). Help does not affect correctness, grading, or SRS scheduling.
    
- **Compatibility guarantee:** `h` can coexist with qa/tf/m1/m2/cl/cd/cld because it is treated as a separate “side channel” and removed before the main detectors run, preventing false positives and preserving stable detection.

---

## 📝 m1.md — ./m1.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `m1`: Single-answer multiple choice

Single-answer multiple choice blocks use option labels like `a)`, `b)`, `c)` and a correct marker line such as `-a`. The UI renders these as a radio-style selection.

## Syntax

```md
#card
Which planet is known as the Red Planet?
a) Earth
b) Mars
c) Venus
-b
#
```

- Every option line must follow the pattern `<letter>) <text>` (case-insensitive letter). The parser normalizes the letter to lowercase.
- Correct answers are marked with `-x` where `x` is the corresponding option letter. For single-answer MC, provide exactly one correct marker (`-x = 1`).
- The card must contain at least two options to keep the UI meaningful.

## Behavior

- The UI presents a single choice with radio buttons.
- The parser collects the question plus the options, then uses the `correctKeys` array from the `-x` lines to determine which answer is correct.
- Combining m1 with other interactive codes (e.g., tf, cl) in the same task requires separators (`---`) and dedicated handling.

---

## 📝 m2.md — ./m2.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `m2`: Multi-answer multiple choice

Multi-answer multiple choice is similar to single-answer, but the learner may select several options. Each correct option gets its own `-x` marker line; there must be at least two correct markers to make this a multi-answer question.

## Syntax

```md
#card
Which numbers are prime?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
```

- Provide option lines just like single-answer MC (`letter) text`).
- Add a `-x` line for every correct option. The parser collects them into `correctKeys`. For multi-answer questions, include **two or more** `-x` lines.
- `-x < 2` in the original notation means that you must supply more than one correct marker to float into the multi-answer mode.

## Behavior

- The UI shows checkboxes so learners can pick multiple answers.
- The parser keeps the `correctKeys` list in the same structure as m1 and sets `detectedTypes` to `multiple-choice`.
- When mixing m2 with other interactive codes in one task, separate them with `---` and treat each chunk as its own interaction.

---

## 📝 qa.md — ./qa.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `qa`: Answer marker (Q/A part)

Answer markers signal that everything that follows belongs to the official solution. The parser pulls the marker line plus all subsequent text until the end of the card (`#`) and stores it as the answer/back side of a QA part.

## Markers that are recognized

Exam tasks use the same `answerMarkers` list from `flashcardKeywords.ts`. Common entries include:

- `Answer:` (English)
- `Antwort:` (German)
- `Réponse:`, `Respuesta:`, `Risposta:` (Romance languages)
- `Antwoord:`, `Svar:`, `Odpověď:`, `Ответ:`, `Απάντηση:` (others)

The parser normalizes the marker (case, accents, whitespace) so you can also write the marker as bold text like `**Answer:**` as long as the marker still starts the line.

## How answer text is captured

- The marker must appear at the start of the line (except for optional leading `**` or a hyphen). Exam parsing uses `answerMatch: "line-start"` to enforce that behavior.
- Everything after the colon on the same line becomes the beginning of the answer. Follow-up lines are appended until you hit the closing `#` or the next block separator (`---`).
- Line breaks stay intact, so you can format diagrams or lists inside the answer.

Example:

```md
#card
Explain the principle of least privilege.
Answer: Keep permissions as tight as possible so users only see what they need.
#
```

## Exam-specific caution

Mixing QA parts with interactive types (true/false, multiple choice, clozes) inside the same task can make automated scoring less reliable. If you combine them, consider splitting the task into composites (use `---`) or providing explicit instructions about manual scoring.

---

## 📝 tf.md — ./tf.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `tf`: True/False marker (2-button card)

True/false interactions count as `tf` and render as two-button questions where the learner chooses between true and false. The parser recognizes them by pairing a prompt line with the next non-empty line that starts with a `-` and a truthy/falsy token.

## Format

```
#card
Is the following statement true?
The Sun is a star.
-true
#
```

- The question line(s) appear first, followed by a dedicated result marker on the next non-empty line (no blank line between question and marker is required but allowed).
- The marker must begin with `-` and then a keyword. Valid true tokens include `true`, `yes`, `ja`, `wahr`, `vrai`, `verdadero`, `vero`, `waar`, `sant`, `právda`, etc. False tokens include `false`, `no`, `nein`, `falsch`, `falso`, `neh`, `falskt`, `epätosi`, `hakis`, `ложь`, `خطأ`, and their localized equivalents.
- The parser strips punctuation at the end and matches the normalized keyword, so `-true.` and `-ja` both work.

## Behavior notes

- The marker must sit on the next non-empty line after the question; the parser skips blank lines between them.
- The UI shows the question from the card prompt and then the `true/false` buttons. The correct button is governed by the marker.
- Mixing `tf` with other interactive types (m1/m2/cl/cd) in the same task requires explicit multi-widget handling, so keep the block focused or split it with `---`.

---
