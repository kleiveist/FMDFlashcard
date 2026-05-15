<!-- AUTO-GENERATED:backlink START -->
[← Back](syntax.md)
<!-- AUTO-GENERATED:backlink END -->

# Canvas Syntax

Canvas support lets FMD show visual node-and-edge diagrams from either pure `.canvas`
files or embedded Canvas blocks inside Markdown files.

## Pure `.canvas` files

A `.canvas` file is a JSON document with `nodes` and `edges`. The Vault lists these
files next to Markdown notes. Opening a `.canvas` file shows the Canvas View first.

Example:

```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "text",
      "text": "# Example Node",
      "x": 0,
      "y": 0,
      "width": 250,
      "height": 100
    }
  ],
  "edges": []
}
```

## Editor Modes

- `View` renders the Canvas and keeps nodes read-only.
- `Edit` lets you move Canvas nodes visually.
- `Code` shows the raw JSON. Valid JSON can be applied back to the rendered Canvas.

Markdown Hybrid mode is hidden for pure `.canvas` files because `.canvas` files are
JSON documents, not Markdown documents.

## Embedded Canvas Blocks

Markdown files can embed a Canvas block at the exact position where the diagram
should appear:

```markdown
#canvas
{
  "nodes": [
    {
      "id": "node-1",
      "type": "text",
      "text": "# Embedded Node",
      "x": 0,
      "y": 0,
      "width": 250,
      "height": 100
    }
  ],
  "edges": []
}
#canvasend
```

The fenced form is also accepted:

````markdown
```canvas
{
  "nodes": [],
  "edges": []
}
```
````

In Markdown View and Hybrid Edit mode, each Canvas block is rendered inside its own
embedded Canvas container with pan, zoom, fit-to-content, fullscreen, View/Edit/Code,
duplicate, and delete controls.

## Parser Isolation

Canvas block content is isolated before Flashcard and Exam parsing runs. Markers such
as `#card`, `#exam`, `Answer:`, `Antwort:`, `---`, multiple-choice options, true/false
markers, and Cloze tokens inside Canvas JSON do not create Flashcards or Exam tasks.

Flashcards and Exams before or after a Canvas block continue to work normally.

Related syntax documentation:

- [Flashcard syntax reference](flashcard-syntax.md)
- [Exam syntax](exam-syntax.md)
- [Markdown Editor](../pages/markdown-editor.md)

## Invalid JSON

Invalid JSON does not break the full Markdown document. FMD shows an error only for
the affected Canvas block or `.canvas` file. The last valid rendered state is kept
where available, and Code mode can be used to inspect and repair the JSON.
