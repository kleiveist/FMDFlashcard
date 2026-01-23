<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cd`: Cloze (drag tokens)

Drag tokens use the `tocken "token"` syntax to create draggable pieces learners can drop into blanks. The parser reads these markers as drag-and-drop solutions inside the same cloze pipeline.

```md
#card
The colors of the German flag are tocken "black", tocken "red", and tocken "gold".
#
```

- Each `tocken "token"` marker becomes a drag token that learners can drag into the drop zone associated with that blank.
- Empty tokens are ignored, so always place visible text inside the quotes.
- Drag tokens work alongside typed cloze blanks; both are treated as `cloze` parts with `kind` `drag` in the segment list.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle order is seeded by the card/part identity so repeated views keep the same arrangement.
## Behavior notes

- Use drag tokens when you want the learner to match predefined units instead of typing them.
- Drag and typed blanks render together on the same UI if they belong to the same block. If you need to mix drag tokens with other modes (TF or MC), separate them with `---` or split into different tasks.
- Backticks are treated as normal inline code and do not create drag blanks.
## Migration note

To locate legacy drag-token markers in vault files:
```sh
rg -n --glob "*.md" "tocken`" /path/to/vault
```
### Typed mit codeblock
#card
```q
The colors of the German flag are tocken "black", tocken "red", and tocken "gold".
```
#
