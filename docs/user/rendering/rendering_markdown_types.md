<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
## 1) Links and Images (very common, high UX impact)

**Why it matters:** Links/images are often the first area that becomes “clickable” in the render view and then prevents editing.

- **Links (inline)**
    - Format: `[text](url)` and autolinks `https://…`
    - Edit factor: text segment (inline)
    - Risk: click opens link instead of placing cursor/selection
- **Images (block or inline)**
    - Format: `![alt](path-or-url)`
    - Edit factor: usually the entire block (because render size/selection is difficult)
    - Risk: image takes focus; text is hard to position

---
## 2) Inline HTML / HTML blocks (already occurs via `<br>` in your case)

**Why it matters:** Many users mix Markdown + HTML. Your system actively uses `<br>` in task statements, and you want it output as a downloadable .md.

- Format: `<br>`, `<kbd>`, `<sub>`, `<sup>`, `<span …>`, `<div …>`
- Edit factor: text segment (inline) vs. full block (for `<div>…</div>`)
- Risk: HTML gets “swallowed” in the render layer; sanitizer/renderer changes content

---
## 3) Escape sequences and special characters

**Why it matters:** With “render + edit”, escaping behavior is a frequent data-loss candidate.
- Format: `\* \# \- \|` etc.
- Edit factor: text segment
- Risk: renderer removes backslashes or normalizes them

---
## 4) Footnotes, references, definitions (optional, but relevant for knowledge notes)

If you want Obsidian-like behavior, these are typical Markdown extensions:
- Footnote: `Text[^1]` + `[^1]: Footnote`
- References/definition lists (depending on flavor)
- Edit factor: inline for markers, block for definition

---

## 5) Callouts / admonitions (if you support them or want them later)

Obsidian-style or flavor-specific:
- Example formats: `> [!note]` / `::: warning` (depending on the standard)
- Edit factor: full block
- Risk: quote/block container becomes “non-editable” in render view

---

## 6) Nesting (the underestimated main driver for editor bugs)

You list the types, but not the “meta topic”: **combinations**.

Examples:
- List inside quote: `> - item`
- List with task list: `- [ ] …`
- Code block inside a list
- Numbering with sub-items
- Multiple `---` (not just once)
- Multiple math blocks back-to-back

**Why it matters:** Many failures only appear with nesting; that is often the difference between “demo works” and “real world breaks”.

---

## 7) Whitespace rules: blank lines, indentation, tabs

**Why it matters:** Markdown is extremely whitespace-sensitive.
- Indentation (4 spaces) can trigger a code block
- Blank lines control list/paragraph boundaries
- Edit factor: paragraph/block
- Risk: normalizer removes blank lines or “pulls” blocks together (your case 2)

---

## 8) Horizontal rule vs. minus lines vs. table separators (conflict zone)

You have `---` as a horizontal rule, but it is important that `---` has multiple meanings:
- Horizontal rule
- YAML frontmatter separator (when at the beginning of a file)
- Table header separator `| --- |`

**Why it matters:** Your app also uses `---` as an **exam/task/composite separator**. That is a real collision zone.

---

## 9) YAML frontmatter (if you want Obsidian-like behavior)

- Format:
    - `---`
    - `key: value`
    - `---`
- Edit factor: full block (at the start of the file)
- Risk: incorrectly interpreted as an “exam separator” (or vice versa)

---

## 10) Your special syntax (FMD): #exam, #card, markers, option labels

You mention this in text, but not in your type table as its own category. I would add it because it is functionally decisive:

- Containers: `#exam … #examend`, `#card … #`
- Markers: `-a`, `-b`, `-true/-false`, `Answer:`/`Antwort:`
- Option labels: `a)` `b)` etc.
- Edit factor: blockwise or inline depending on line, but always 100% editable
- Risk: parser/renderer layer treats this as “structural control characters” and locks it

---

# Recommendation: Extend your table by 3 meta columns

This makes it substantially stronger as a specification:

1. **Inline vs. Block** (you already have “Edit factor”, but “Inline/Block” as a clear classification helps)
2. **Collision risk** (low/medium/high) – where standard Markdown overlaps with exam syntax (`---`, `1)`, lists)
3. **Nesting allowed?** (yes/no) – e.g., “code block in list” yes, “table in table” no

---
> **Global assumption:**
> **Editable = ✔️ for all entries.**
> Everything is Markdown; nothing may be read-only.
> _Tables are the only explicit special case (see separate table)._

---

### Table 1 – Markdown Types & Edit Factor (complete)

| Type                         | Format                     | Editable | Edit factor               |
| ---------------------------- | -------------------------- | -------- | ------------------------- |
| Horizontal rule              | `---`                      | ✔️       | full block                |
| Horizontal rule (alternative)| `***` / `___`              | ✔️       | full block                |
| Bullet item                  | `-`                        | ✔️       | marker only (`-`)         |
| Bullet item                  | `*` / `+`                  | ✔️       | marker only               |
| Numbering                    | `1.` `2.`                  | ✔️       | marker only (`1.`)        |
| Numbering (exam style)       | `1)` `2)`                  | ✔️       | marker only (`1)`)        |
| Sub-items (indentation)      | `-` / `1.`                 | ✔️       | paragraph / block         |
| Task list                    | `- [ ]` / `- [x]`          | ✔️       | marker only               |
| Quote                        | `>`                        | ✔️       | paragraph with `>`        |
| Nested quote                 | `>>`                       | ✔️       | paragraph / block         |
| Heading 1                    | `#`                        | ✔️       | marker only               |
| Heading 2                    | `##`                       | ✔️       | marker only               |
| Heading 3                    | `###`                      | ✔️       | marker only               |
| Heading 4                    | `####`                     | ✔️       | marker only               |
| Heading 5                    | `#####`                    | ✔️       | marker only               |
| Heading 6                    | `######`                   | ✔️       | marker only               |
| Bold                         | `**text**`                 | ✔️       | text segment (inline)     |
| Italic                       | `*text*` / `_text_`        | ✔️       | text segment              |
| Bold + italic                | `***text***`               | ✔️       | text segment              |
| Strikethrough                | `~~text~~`                 | ✔️       | text segment              |
| Inline code                  | `` `text` ``               | ✔️       | text segment              |
| Code block                   |                            | ✔️       | full block                |
| Code block (language)        | `js /` sql                 | ✔️       | full block                |
| Math (inline)                | `$a+b$`                    | ✔️       | text segment              |
| Math (block)                 | `$$ … $$`                  | ✔️       | full block                |
| Math block with `<br>`       | `<br>$$ … $$<br>`          | ✔️       | full block                |
| Comment (FMD)                | `%%comment%%`              | ✔️       | text segment              |
| Escape characters            | `\* \# \- \|`              | ✔️       | text segment              |
| Link                         | `[text](url)`              | ✔️       | text segment              |
| Autolink                     | `https://…`                | ✔️       | text segment              |
| Image                        | `![alt](src)`              | ✔️       | block or text segment     |
| Inline HTML                  | `<br>` `<sup>` `<sub>`     | ✔️       | text segment              |
| HTML block                   | `<div>…</div>`             | ✔️       | full block                |
| Paragraph                    | blank line                 | ✔️       | paragraph                 |
| Multiple blank lines         | `\n\n\n`                   | ✔️       | paragraph                 |
| YAML frontmatter (optional)  | `--- key: value ---`       | ✔️       | full block                |
| Definition / footnote marker | `[^1]`                     | ✔️       | text segment              |
| Footnote block               | `[^1]: …`                  | ✔️       | full block                |
| Callout / admonition         | `> [!note]`                | ✔️       | full block                |
| Exam container               | `#exam … #examend`         | ✔️       | full block                |
| Flashcard container          | `#card … #`                | ✔️       | full block                |
| MC option                    | `a)` `b)`                  | ✔️       | paragraph                 |
| MC answer marker             | `-a` `-b`                  | ✔️       | marker only               |
| True/False marker            | `-true` / `-false`         | ✔️       | marker only               |
| Cloze (typed)                | `%%answer%%`               | ✔️       | text segment              |
| Cloze (drag)                 | `tocken "token"`           | ✔️       | text segment              |
| Combination cl+cd            | `%%text%%` + `tocken "token"` | ✔️       | text segment              |
| Separator marker (exam/composite) | `---`                 | ✔️       | full block                |
| Multiple separator markers   | `--- ---`                  | ✔️       | full block                |
| Nested blocks                | List → Quote → Code        | ✔️       | block hierarchy           |

---

## Important clarification (critical for bugs)

- **Editable is ALWAYS ✔️**  
  “Edit factor” describes only *how* you switch in raw text — not *whether*.

- **No type may:**
    - be auto-renumbered
    - be structurally “fixed”
    - be editable only via UI controls instead of text
