[← Back to Docs Home](../../index.md)

# Formatting patterns

These examples show how multi-line prompts and answers behave. The app displays text as plain text with
line breaks preserved, so Markdown formatting (lists, code fences) is not rendered.

## Code block in the question

````md
#card
What does this Python function return?
```python
def add(a, b):
    return a + b
```
Answer: It returns the sum of a and b.
#
````

## List-style answer (plain text)

```md
#card
Name three SQL command categories.
Answer:
- DDL
- DML
- DCL
#
```

## Definition-style answer

```md
#card
Define "idempotent".
Answer: Idempotent - calling it multiple times has the same effect as calling it once.
#
```

## Supported vs. not supported

- Supported: multi-line prompts and answers; line breaks are preserved.
- Supported: list or code block text inside a Q/A card block (displayed as plain text).
- Not supported: Markdown rendering such as syntax highlighting or automatic lists.
- Caution: a line that is exactly `#` ends the card block.
