# Render Markdown Preview (with safe HTML sanitization)

## Context
Preview currently shows raw text in a `<pre>` block. For reading notes, a rendered Markdown view improves usability.

## Goal
Render Markdown to HTML in the preview panel while preventing unsafe content execution.

## Scope
- Markdown rendering in React (e.g., `react-markdown`).
- Sanitization (e.g., `rehype-sanitize`) to avoid script injection.
- Optional: code block highlighting.

## Tasks
- [ ] Add Markdown renderer dependencies.
- [ ] Replace `<pre className="preview">` with a Markdown renderer component.
- [ ] Preserve a “raw view” toggle (optional).
- [ ] Ensure large files still scroll and remain performant.

## Acceptance Criteria
- Markdown files render headings, lists, links, code blocks.
- No raw HTML/script execution from Markdown content.

## Notes
If you later extract flashcards from notes, the rendered view remains useful for context.
