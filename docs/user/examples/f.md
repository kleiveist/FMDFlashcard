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
