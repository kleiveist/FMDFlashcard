<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `e`: Exam block container

Use `#exam` and `#endexam` to wrap the section you want the Exams page to treat as a dedicated exam session. Anything between these markers runs through the exam parser and renders in the **Exam** view; outside the markers the content behaves like a regular deck.

## Syntax summary

| Component | Purpose |
| --- | --- |
| `#exam` | Stand-alone line that opens the exam block. It signals the Exams page and parser to expect numbered tasks (`ea`). |
| Content between | Treated as an exam file. Free text is allowed, but actual interaction data only comes from the numbered tasks that follow exam numbering rules. |
| `#endexam` | Stand-alone line that closes the block. Ignore it in the UI; no flashcards are created past this point unless a new card block opens. |
| `#endcard` | Still closes a `#card` block inside an exam task just like everywhere else. The exam block itself is not closed by `#endcard`. |

## Example template

```md
#exam
OPTIONAL EXAM INTRO TEXT

1) TASK 1 PROMPT (QA)
Answer: OFFICIAL ANSWER TEXT
---

2) TASK 2 PROMPT (TF)
STATEMENT TEXT
-true
---

3) TASK 3 PROMPT (M1)
a) OPTION A
b) OPTION B
c) OPTION C
-a
#endexam
```

## Behavior reminders

- Do **not** display `#exam` / `#endexam` as visible text—the Exams page keeps those wrappers out of the UI.
- Mark the entire exam file or section as exam content so that scans treat it differently than standard flashcards.
- Only numbered tasks (`ea`) yield cards; stray text between tasks is rendered as instructions or context.
- You can still embed `#card … #endcard` blocks inside a task, the parser merges them, and their interactions obey the usual flashcard rules.
- `#exam` does not interfere with `#card`; every card still needs its own `#endcard` terminator.

For details on each code, follow the respective files above (`ea`, `f`, `qa`, `tf`, `m1`, `m2`, `cl`, `cd`).
