<!-- AUTO-GENERATED:backlink START -->
[← Back to Docs Home](../../index.md)
<!-- AUTO-GENERATED:backlink END -->
← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

| Description                              | Syntax start                                                          | Syntax end                                                | Relevant for           | Action                                                                                           | Code |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | ---- |
|                                          |                                                                       | IMPORTANT: `#`                                            | does not apply when    | `#` heading <br> `##` heading                                                                    |      |
|                                          |                                                                       |                                                           | e = exam               | f = flashcard                                                                                    |      |
| Exam block (container)                   | #exam                                                                 | #examend                                                  | e-page<br>Exam mode    | - Mark file/section as **exam content**<br>- Do **not** treat contents as flashcards             | e    |
| Exam task block                          | - Start task numbering, <br>1.   2)   2.)    1.2.3 <br>n = 99         | ---  <br>1.2.3<br>#                                       | e-page<br>Exam mode    | Treat task as an exam item                                                                       | ea   |
| Flashcard block (card block / container) | #card                                                                 | #                                                         | f-pages Flashcard scan | - Treat block as a flashcard item                                                                | f    |
| Answer marker (Q/A part)                 | Answer:{text}<br>Antwort: {text}<br>answertocken:{text}               | ---  <br>#                                                | e-page <br>f-pages     | - Store everything after the marker as **answer text**; preserve line breaks.                    | qa   |
| True/False marker <br>(2-button card)    | true/false? {text}<br>-true or<br>-false                              | ---  <br>#                                                | e-page <br>f-pages     | - UI: **2 buttons (True/False)**<br>- Validation: marker must be on the **next non-empty line**. | tf   |
| Multiple choice (single-answer)          | - Option labels in the block,<br>`a)` `b)` `c)` …                     | selection ends with<br>-a)<br>block ends with<br>#<br>--- | e-page <br>f-pages     | - UI: single choice; at least 1 correct marker<br>-x = 1<br>-a)                                  | m1   |
| Multiple choice <br>(multi-answer)       | - Option labels in the block,<br>`a)` `b)` `c)` …                     | selection ends with<br>-a)<br>block ends with<br>#<br>--- | e-page <br>f-pages     | Multi choice; at least 2 correct markers<br>-x < 2<br>-a)<br>-b)                                 | m2   |
| Cloze (typed blanks)                     | Typed blanks: `%%...%%` inside                                        | ---  <br>#                                                | e-page <br>f-pages     | For typed blanks: validation requires every `%%...%%` to contain text.                           | cl   |
| Cloze <br>(drag tokens)                  | in the text: drag tokens: ``token``                                   | ---  <br>#                                                | e-page <br>f-pages     | - UI: input fields for ``token`` + drag/drop                                                     | cd   |
| Cloze <br>(drag tokens)                  | in the text: drag tokens: ``token``<br>Typed blanks: `%%...%%` inside | ---  <br>#                                                | e-page <br>f-pages     | - UI: input fields for ``token`` + drag/drop and  blanks: validation `%%...%%`                   | cd   |

## **Combination matrix**
Legend: 💠 works · ❕ works with care · ⚠️ works with limitations · ❌ not possible

|     | e   | ea  | f   | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| e   | ❌   | 💠  | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   |
| ea  | 💠  | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| f   | ❕   | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| qa  | ❕   | 💠  | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| tf  | ❕   | 💠  | 💠  | ⚠️  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| m1  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | 💠  | ❕   | ⚠️  | ⚠️  | ⚠️  |
| m2  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ❕   | 💠  | ⚠️  | ⚠️  | ⚠️  |
| cl  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cd  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cld | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ❕   | ❕   | 💠  |

---
### Short rules per code (reasoning for ❕/⚠️)

| Code | Status | Note                                                                                                                                                       |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e    | ❕      | Inside `#exam … #`, card types are **only meaningful inside** a task block (`ea`). Outside of tasks: typically **free text / ignored**.                    |
| f    | ❕      | `#exam` is not affected by `#card`; it ends with `#examend`.                                                                                               |
| ea   | 💠     | A task block can contain **exactly one** interaction type (qa/tf/m1/m2/cl/cd). Multiple types in a _single_ task only as a composite (then like below ⚠️). |
| f    | 💠     | A `#card … #` block can contain qa/tf/m1/m2/cl/cd. Multiple types in _one_ `#card` only as a composite (⚠️).                                               |
| qa   | ⚠️     | Once Q/A is mixed with interactive types (tf/m1/m2/cl/cd), answers are often **no longer cleanly auto-checkable** → consider self-check / partial scoring. |
| tf   | ⚠️     | Mixed with m1/m2/cl/cd requires **dedicated UI/logic per part** (multi-widget composite). If not implemented: limitation or fallback.                      |
| m1   | ❕      | m1+m2 is possible, but **only as separate parts** (clear markers per part).                                                                                |
| m2   | ❕      | Same as m2+m1.                                                                                                                                             |
| cl   | 💠     | cl+cd is fine (one cloze text can contain both). With other types only as a composite (⚠️).                                                                |
| cd   | 💠     | Same as cl.                                                                                                                                                |
| cld  |        | Same as cl + cd                                                                                                                                            |
