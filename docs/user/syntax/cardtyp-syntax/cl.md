<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cl`: Cloze (typed blanks)

Typed clozes use the `%%...%%` syntax to turn inline fragments into input fields (`cl`). The learner must type the missing words exactly as written (normalization is trim-and-lowercase by default).

```md
#card
The capital of France is %%Paris%%.
#
```

- Each `%%…%%` pair becomes an input blank. The parser trims the text inside; blanks without any content are rejected.
- You can combine cloze blanks and drag tokens in the same question as long as the interactions stay within one block. Drag tokens use `tocken "..."`. When cl and cd coexist, the parser spawns both blank and drag segments.
- The blank solutions are case-insensitive and trimmed; punctuation inside the solution is preserved, so `%%Paris%%` differs from `%%Paris,%%`.

## Behavior notes

- Cloze blanks can appear in the prompt or in body text, and the parser splits them into segments for the UI.
- If you need to mix typed blanks with other interactions (MC, TF), insert `---` between them or split them into separate tasks to keep scoring manageable.

### Typed mit codeblock
#card
```sql
The capital of France is %%Paris%%.
```
#
