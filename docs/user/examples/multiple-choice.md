← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Multiple choice cards

Multiple choice cards use option labels a), b), c) and one or more correct markers (-a, -b, ...)
inside a card block.

## Single-answer

```md
#card
Which planet is known as the Red Planet?
a) Earth
b) Mars
c) Venus
-b
#
```

## Multiple-answer

```md
#card
Which numbers are prime?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
```

## Tips

- Use at least two options.
- Each correct option must have its own marker line.
- Keep `#card` and `#` on their own lines.
