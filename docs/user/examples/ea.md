<!-- AUTO-GENERATED:backlink START -->
[← Back to Docs Home](../../index.md)
<!-- AUTO-GENERATED:backlink END -->
← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

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
