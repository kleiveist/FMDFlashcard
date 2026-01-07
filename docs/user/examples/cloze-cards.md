[← Back to Docs Home](../../index.md)

# Cloze cards

Cloze cards hide parts of a sentence inside a card block. Typed blanks use %%...%%, and drag tokens
use backticks.

## Typed blanks (input)

```md
#card
Fill in: The capital of France is %%Paris%%.
#
```

## Drag tokens (inline code)

```md
#card
Complete the command:
`git` `status` shows changes.
#
```

## Mixed typed + drag

```md
#card
Fill in: The capital of %%France%% is `Paris`.
#
```

## Tips

- Every %%...%% blank must contain text.
- Use backticks around each drag token.
- You can include multiple blanks in one line.
