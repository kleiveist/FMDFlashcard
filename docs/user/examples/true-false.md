[← Back to Docs Home](../../index.md)

# True/false cards

True/false cards use a statement line followed by a marker line (`-true` or `-false`). You can
include multiple statements in one card block to form a composite card.

## Single statement

```md
#card
The Earth orbits the Sun.
-true
#
```

## Multiple statements (composite)

```md
#card
Pluto is a planet.
-false

Water freezes at 0 C.
-true
#
```

## Tips

- Every statement must be followed by its marker on the next non-empty line.
- Use `-true`/`-false` (or `-wahr`/`-falsch`) consistently within a card block.
