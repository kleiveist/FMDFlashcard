<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
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
