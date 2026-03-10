<!-- AUTO-GENERATED:backlink START -->
[← Back](cardtyp-syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `cd`: Cloze (drag tokens)

Drag tokens use the `"token"` syntax to create draggable pieces learners can drop into blanks. The parser reads these markers as drag-and-drop solutions inside the same cloze pipeline.

```md
#card
SENTENCE WITH TOKENS tocken "TOKEN1", tocken "TOKEN2", tocken "TOKEN3".
#endcard
```

- Each `"token"` marker becomes a drag token that learners can drag into the drop zone associated with that blank.
- Empty tokens are ignored, so always place visible text inside the quotes.
- Drag tokens work alongside typed cloze blanks; both are treated as "cloze" parts with "kind" "drag" in the segment list.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle order is seeded by the card/part identity so repeated views keep the same arrangement.

## Behavior notes

- Use drag tokens when you want the learner to match predefined units instead of typing them.
- Drag and typed blanks render together on the same UI if they belong to the same block. If you need to mix drag tokens with other modes (TF or MC), separate them with "---" or split into different tasks.
- Backticks are treated as normal inline code and do not create drag blanks.

### Drag tokens mit Codeblock

````md
#card
```q
The colors of the German flag are "black", "red", and "gold".
```
#endcard
````
