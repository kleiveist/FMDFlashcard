[← Back to Docs Home](../index.md)

# Flashcard syntax reference

The goal of the syntax is to keep Markdown readable while still being machine-parseable.

## Card blocks

A card block starts with:

```md
#card
```

Everything that follows belongs to that card until the next card block starts or the file ends.

## Question / answer pairs

Inside a card block, each question is written as plain text.
The answer is written on the next line, prefixed with a dash (`-`).

Example:

```md
#card

What is a primary key?
- A primary key uniquely identifies a row in a table.
```

## Composite cards (multiple Q/A pairs in one block)

You can place multiple Q/A pairs inside one `#card` block. The block forms one composite card.

Example:

```md
#card

2NF requires every non-key attribute depends on the whole composite key. True/False?
- True

Define a foreign key.
- A foreign key references a primary key (or a unique key) of another table to enforce referential integrity.
```

**Composite scoring rule:** the card is considered correct only if *all* answers are correct.

## Formatting tips

- Keep questions short and unambiguous.
- Put only the final answer after the dash line.
- If you need longer answers, write them as a single paragraph after the dash (still one answer).

## Notes

The exact parsing rules may evolve. If you encounter differences between this doc and the current app behavior,
prefer the in-app Help and open an issue to align documentation.
