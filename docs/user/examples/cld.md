← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `cld`: Cloze (typed blanks + drag tokens)

`cld` is the combined Cloze format that supports **both**:
- **Typed blanks** using `%%...%%`
- **Drag tokens** using backticks `` `token` ``

- This lets you build a single cloze interaction where learners can either type answers (typed blanks) and/or use a token bank (drag tokens) within the same part.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle sequence is seeded by the card/part identity so the same task keeps the same order within a session.
---

## Syntax

### Typed blanks
Use `%%...%%` to create an input field. The text inside is the **solution**.

Example:
```md
#card
The `capital` of France is %%Paris%%.
#
```
---
