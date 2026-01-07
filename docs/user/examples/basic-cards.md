← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Basic cards

Use these minimal Q/A card blocks to get started. Copy/paste into a Markdown file in your vault,
scan your vault, and open a review mode.

## Minimal Q/A card

```md
#card
What is a primary key?
Answer: A primary key uniquely identifies a row in a table.
#
```

## Multiple cards in one file

```md
#card
What does ACID stand for?
Answer: Atomicity, Consistency, Isolation, Durability.
#

#card
What is a foreign key?
Answer: A field that references a primary key in another table.
#
```

## Formatting tips

- Keep the prompt on the first non-empty line of the card block.
- Start the answer with the `Answer:` marker (or `Antwort:`) inside the block.
- The answer can be inline or on the following lines.
- Keep `#card` and `#` on their own lines.
- Separate card blocks with at least one blank line for readability.
