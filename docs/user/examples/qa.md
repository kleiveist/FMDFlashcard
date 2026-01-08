<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
# Code `qa`: Answer marker (Q/A part)

Answer markers signal that everything that follows belongs to the official solution. The parser pulls the marker line plus all subsequent text until the end of the card (`#`) and stores it as the answer/back side of a QA part.

## Markers that are recognized

Exam tasks use the same `answerMarkers` list from `flashcardKeywords.ts`. Common entries include:

- `Answer:` (English)
- `Antwort:` (German)
- `Réponse:`, `Respuesta:`, `Risposta:` (Romance languages)
- `Antwoord:`, `Svar:`, `Odpověď:`, `Ответ:`, `Απάντηση:` (others)

The parser normalizes the marker (case, accents, whitespace) so you can also write the marker as bold text like `**Answer:**` as long as the marker still starts the line.

## How answer text is captured

- The marker must appear at the start of the line (except for optional leading `**` or a hyphen). Exam parsing uses `answerMatch: "line-start"` to enforce that behavior.
- Everything after the colon on the same line becomes the beginning of the answer. Follow-up lines are appended until you hit the closing `#` or the next block separator (`---`).
- Line breaks stay intact, so you can format diagrams or lists inside the answer.

Example:

```md
#card
Explain the principle of least privilege.
Answer: Keep permissions as tight as possible so users only see what they need.
#
```

## Exam-specific caution

Mixing QA parts with interactive types (true/false, multiple choice, clozes) inside the same task can make automated scoring less reliable. If you combine them, consider splitting the task into composites (use `---`) or providing explicit instructions about manual scoring.
