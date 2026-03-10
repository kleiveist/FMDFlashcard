<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
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

```md
#card
SENTENCE BEFORE %ANSWER1% SENTENCE MIDDLE %ANSWER2% SENTENCE AFTER

TOKEN BANK tocken "TOKENA", tocken "TOKENB", tocken "TOKENC"
#endcard
```

- Typed blanks use `%...%`.
- Drag tokens are created from quoted tokens (`"..."`).
---
### Typed mit Codeblock

````md
#card
```c#
The "capital" of France is %Paris%.
```
#endcard
````
