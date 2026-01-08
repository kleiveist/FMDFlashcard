<!-- AUTO-GENERATED:backlink START -->
[← Back to Docs Home](../index.md)
<!-- AUTO-GENERATED:backlink END -->
# Getting started

This guide covers the shortest path from “I have Markdown notes” to “I can review cards”.

## 1) Create or choose a vault folder

A *vault* is simply a folder that contains your Markdown files. The app scans this folder to find
flashcards embedded in your notes.

## 2) Add your first cards to a Markdown file

Create a new `.md` file (or use an existing one) and add a `#card` block.

Example:

```md
#card

What is 2NF (Second Normal Form)?
- 2NF requires that every non-key attribute depends on the whole of a composite key (if a composite key exists).

Define “foreign key” and give a simple example.
- A foreign key is an attribute (or set of attributes) that references the primary key of another table to enforce referential integrity.
```

## 3) Open the app and load the vault

1. Open the app.
2. Choose your vault folder.
3. Let the app scan your Markdown files.

## 4) Start a review

Pick a review mode (standard, fast, spaced repetition) and start answering cards.
If a card contains multiple Q/A pairs inside the same `#card` block, it is treated as a *composite card*:
the card is correct only if all parts are correct.

## 5) Iterate

- Add cards as you learn.
- Refactor notes as usual—your Markdown remains readable.
- Use Settings to tune parsing markers, review behavior, and performance options.

Next: read `flashcard-syntax.md` for the latest markers and `exam-syntax.md` when you want to author exam files with `#exam … #examend`.
