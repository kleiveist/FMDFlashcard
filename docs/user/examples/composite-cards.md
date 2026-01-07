[← Back to Docs Home](../../index.md)

# Composite cards

A composite card is a single card block that contains multiple parts. The card is marked correct only
if every part is correct.

## Short composite (two parts)

```md
#card
What is 2NF?
Answer: Every non-key attribute depends on the whole key.

What is 3NF?
Answer: No non-key attribute depends on another non-key attribute.
#
```

## Longer composite (three parts)

```md
#card
Define "primary key".
Answer: A unique identifier for a row.

Define "foreign key".
Answer: A field that references a primary key in another table.

Define "candidate key".
Answer: Any key that could serve as the primary key.
#
```

## Notes

- Separate each part with at least one blank line inside the card block.
- Use the same card type for every part (for example, all Q/A with `Answer:`).
- Composite cards are graded as a whole in review mode.
