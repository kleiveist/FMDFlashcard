<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
# Exam syntax

The Exams page treats blocks wrapped between `#exam` and `#examend` differently than the standard flashcard scan. This document covers the wrappers, task numbering, and how interaction types behave inside an exam file.

## Wrapping an exam

```md
#exam
... exam sections ...
#examend
```

- `#exam` and `#examend` must each appear on their own line. Do not show them in the UI—they exist only to signal exam parsing (`e`).
- Everything between the wrappers is considered exam content. Free text is allowed, but only numbered tasks (`ea`) produce interactive items.
- You can still embed `#card … #` blocks inside exam tasks; they behave the same as outside, but the Exams page uses them as prompts.

## Numbered tasks (`ea`)

A task starts when a trimmed line begins with a number from 1 to 20. The parser accepts these variants:

- `1. Question...`
- `2)` or `2.)`
- Bold numbering like `**3)**`
- A leading `-` prior to the number, e.g., `-4. Section`

After the numeric prefix, the parser expects whitespace (or closing punctuation) before the task prompt. Each task runs until one of:

1. A line containing `---` (separator for composite tasks).
2. The next numbered task line.
3. `#examend`.

Use tasks to wrap a single interaction type (qa/tf/m1/m2/cl/cd). If you need multiple interactions, separate them with `---` inside the `#card` block so the parser treats each chunk independently.

## Interactions inside exam tasks

Once a task is detected, the parser reuses the same logic as the flashcard scan. The most common interaction codes are documented under `docs/user/examples/`:

- QA parts: `examples/qa.md` (answer markers).
- True/False: `examples/tf.md` (next-line markers).
- Multiple choice: `examples/m1.md` and `examples/m2.md`.
- Cloze typed blanks: `examples/cl.md`.
- Drag tokens: `examples/cd.md`.
- Card containers: `examples/f.md`.

The `examples/e.md` guide also lists the combination matrix and short rules per code when building exam content.

## Exam task output

- Each numbered task becomes an `ExamTask` object with a prompt, optional official answer, and metadata such as grading mode (`auto`, `manual`, `hybrid`).
- Add answer markers to include official solutions that appear in the reveal area only after Submit.
- True/false, multiple choice, and cloze interactions appear with their dedicated widgets in the Exams UI.

## Best practices

1. Keep each task focused on a single interaction type. Use `---` when composing mixed interactions.
2. Only include `#card … #` blocks inside tasks when you need formatting or multiple Q/A segments.
3. Avoid showing `#exam`, `#examend`, or numbered prefixes as visible text—the UI hides them.
4. Mirror this doc when authoring exam material in other languages; the parser only relies on the numeric pattern and answer markers, not the language itself.
