<!--
FILE: docs/user/examples/exams-syntax-and-rendering.md
Purpose: User documentation (Examples) — explain Exam syntax and how the Exam page renders content by phase.
-->

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Exams Page: Syntax and Rendering Breakdown

This page explains **how exam notes are structured in Markdown** and **how the Exams page renders them**
in two phases:

- **Phase 1 (Answering):** you see prompts and input controls, but **no official solutions**
- **Phase 2 (Review after Submit):** official solutions become visible in the **reveal/solution** area

> Important: In Exam mode, authoring wrappers like `#exam`, `#card`, and a standalone closing `#`
> must never appear as visible text in the UI.

---

## 1) Core exam syntax: `#exam … #`

An exam block looks like this:

```md
#exam
1) Question text…
Answer: (official solution — must not be visible before Submit)
#
