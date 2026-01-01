# Flashcard Syntax v1 (Multiple-Choice) in Markdown + "Flashcard" UI Button

**Type:** Feature  
**Priority:** Medium (adjustable)  
**Components:** Editor/Markdown Parser, UI (Right Toolbar), Flashcard Renderer

### Background / Problem

Markdown notes need a defined flashcard block format. A new UI entry point should detect these blocks and render flashcards. This issue covers **Multiple-Choice** only.

### Goal

1. Define and implement **Syntax v1** for multiple-choice flashcards.
2. Add a **"Flashcard" button** in the right toolbar (below Dashboard).
3. On click: validate/parse Markdown, extract flashcards, and render them in the right action panel — **without showing results/answers**.

---

### Flashcard Syntax (v1) – Multiple-Choice

**Start:** `#card` (own line)  
**Question:** next line (free text, e.g. "1.5 ...")  
**Options:** lines formatted `<letter>) <text>` (e.g. `a) ...`)  
**Correct answer(s):** marker lines `-<letter>` (e.g. `-d`, multiple allowed like `-a` and `-d`)  
**End:** `#` (own line)

**Example**

```md
#card
1.5 Which SQL category controls access rights?
a) DML
b) DDL
c) TCL
d) DCL

-d
#
```

---

### UI/UX Requirements

- In the **right toolbar**, **below Dashboard**, add a new button:
  - **Label:** `Flashcard`
- Clicking `Flashcard`:
  - Validate/parse the current Markdown note
  - Search for the defined syntax pattern
  - Render found cards in the **right action/display panel**
  - **Do not show** correct answer markers (`-x`) or any result
- Also show a **placeholder toolbar** for future settings (structure only):
  - Order: "in order" vs "random" (pill buttons)
  - Additional modes (e.g., Yes/No)
  - Box system / number of boxes

### Functional Requirements

- Multiple cards per Markdown note are supported.
- Correct markers can appear 0..n times (for future grading); do not display them.
- Parser ignores marker lines in rendered output.

### Acceptance Criteria

1. Parser recognizes a card by **exactly**:
   - start line `#card`
   - end line `#`
2. Options are recognized as lines `a) ...`, `b) ...`, `c) ...`, `d) ...` (more letters optional).
3. Correct markers are recognized as `-a`, `-d`, etc., including multiple.
4. Flashcard view shows:
   - question + options
   - **not** the `-x` markers and **no** right/wrong result
5. `Flashcard` button is visible in the right toolbar below Dashboard and triggers rendering.
6. If no cards are found:
   - Empty state (e.g., "No flashcards found"), no errors.

### Out of Scope

- Other flashcard types (separate issues)
- Implementing future settings (placeholder only)
- Spaced repetition / box logic / randomization logic

### Technical Notes (optional)

- Parser can be plain text analysis; Markdown AST not required if robust enough.
- Rendering component receives structured data: `{question, options[], correctKeys[]}`; `correctKeys` are not shown.
