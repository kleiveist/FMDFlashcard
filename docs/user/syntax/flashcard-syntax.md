<!-- AUTO-GENERATED:backlink START -->
[← Back](syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Flashcard syntax reference

Markdown flashcards keep your notes readable and the parser precise. The only required markers are the block wrappers and whatever interaction markers you need for the question type.

## Card block basics

```md
#card
...
#endcard
```

- `#card` opens a block.
- Everything after `#card` up until a standalone `#` belongs to the same card.
- A single file can contain multiple `#card … #endcard` blocks; they can appear anywhere in your vault.
- Use `---` inside the block to separate multiple interaction chunks (for example, QA followed by MC). Each chunk is treated independently but still scores as a single composite card.
- For detailed explanations of each interaction type, see the short-code reference examples in `docs/user/examples/` (qa, tf, m1, m2, cl, cd, etc.).
- For tables inside card prompts or answers, follow `table-rendering.md` (pipe tables, layout rules, token constraints).

## Interaction highlights

- **QA (free-text answers):** Place questions followed by an answer marker (for example `Answer:` or `Antwort:`). Everything after the marker becomes the answer. Answers preserve line breaks, so multi-paragraph solutions are fine. Mixed QA + auto-graded parts use `---`.
- **True/False:** Write the statement, then on the very next non-empty line add `-true` or `-false` (normalized to your language). The parser looks for the marker immediately after the question block.
- **Multiple choice (single / multi):** Use option lines like `a) Text`. Mark correct options with `-a`, `-b`, etc. A single marker means single-answer (m1), two or more markers classify the block as multi-answer (m2).
- **Cloze interactions:** `%solution%` produces text inputs. Drag tokens use `"token"` (cd). You can mix typed blanks and drag tokens inside the same cloze chunk; just keep the actual tokens populated. Backticks are treated as normal inline code.

## Composites and interactions

- A `#card` can combine QA with any auto-graded type (tf, m1, m2, cl, cd) by inserting `---`. The order matters for the UI, so keep related parts together.
- QA answers remain in a Pending state after Submit until you self-grade them. Auto-graded interactions show their final state immediately, but they still belong to the same composite card.
- The parser keeps track of detected interaction types through metadata (`primaryType`, `detectedTypes`). Mixed cards (two or more detected types) are treated as composites and typically render a single Submit button.

## Exam content

- If you are authoring a dedicated exam file, wrap your tasks between `#exam` and `#endexam` and refer to `docs/user/exam-syntax.md` for the exam-specific wrappers (`e`, `ea`, etc.).
- `#exam` does not change how `#card` behaves; it only controls whether the Exams page includes the section.

## Notes

- The parser trims whitespace aggressively, so keep markers on their own lines and avoid extra characters before `#card`, `#`, or the interaction markers.
- Prefer the in-app Help to confirm the latest parsing tweaks and file an issue if behavior drifts from this guide.
