<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
Below you’ll find **concrete, practical additions** that are missing if you want to work with **rendered Markdown tables in a truly “ideal” way**—without losing the Markdown nature.

I’m structuring this into:
1. **missing core functions**
2. **editing and focus rules**
3. **structure and safety rules**
4. **extended table (complete)**

---
## 1) Missing core functions (essential)
### a) Add & delete columns / rows
**Why it matters:** Otherwise tables become structurally read-only in practice.
- Insert column left / right
- Insert row above / below
- Delete column
- Delete row
➡ **Important:** The action must produce a _deterministic Markdown change_; no auto reflow unless explicitly triggered by the user.

---
### b) Treat the table header separately
Markdown logically distinguishes:
- Header (`| A | B |`)
- Separator (`| --- | --- |`)
- Body

**Add:**
- Select header row
- Edit header row like normal text
- Never auto-change the separator row (no length adjustments without an explicit command)

---
### c) Cell vs. block editing
You already have “text is normally editable” — good, but the **granularity** is missing:
- Edit a single cell (inline edit)
- Edit the entire cell as a block (for multi-line content)

Example:
- short text → inline
- text with `<br>` or Markdown → block edit

---
## 2) Focus and editing rules (critical for UX)
### a) Clear table focus
- The table has its **own focus state**
- Outside the table:
    - normal Markdown editing
- Inside:
    - table interactions are active
➡ prevents arrow keys, Enter, etc. from unexpectedly “jumping out of the table”.

---
### b) Explicit switch: “table mode ↔ raw text”
Conceptually missing right now.
- Action: “Edit table as Markdown”
- Result: the entire table becomes editable **as a raw text block**
- Return: rendered again
➡ important for power users and edge cases.

---
## 3) Structure & safety rules (so nothing breaks)
### a) No automatic reformatting
- No automatic:
    - column width adjustments
    - `---` normalization
    - whitespace corrections
➡ Formatting only via an explicit command (“Format table”).

---
### b) Mixed content in cells
Cells may contain:
- inline Markdown (`**`, `` ` ``, `%% %%`)
- `<br>` for line breaks
- tokens (e.g., `tocken "token"`)
➡ The editor must **not** resolve, rewrite, or block this content.

---
### c) Tables must not cause editor lock
- The cursor must always be able to:
    - position before / after the table
    - exit the table via keyboard

---
## 4) Extended table – “Table interaction complete”
Here is your table **cleanly extended**, without implementation details:

| Tables  | Function                        | UI                     | Control                                 | Prerequisite            |
| ------- | ------------------------------- | ---------------------- | --------------------------------------- | ----------------------- |
| Columns | Single-column selection          | color highlighting      | hold right mouse button + drag          |                         |
| Columns | Full-column selection            | color highlighting      | drag across the full column             |                         |
| Columns | Move column                      | grab handle top/bottom  | hold left mouse button + move left/right| column selected         |
| Columns | Insert column (left/right)       | plus indicator          | click insertion point                   |                         |
| Columns | Delete column                    | contextual action       | click / confirmation                    | column selected         |
| Rows    | Single-row selection             | color highlighting      | hold right mouse button + drag          |                         |
| Rows    | Full-row selection               | color highlighting      | drag across the full row                |                         |
| Rows    | Move row                         | grab handle left        | hold left mouse button + move up/down   | row selected            |
| Rows    | Insert row (above/below)         | plus indicator          | click insertion point                   |                         |
| Rows    | Delete row                       | contextual action       | click / confirmation                    | row selected            |
| Cell    | Inline edit                      | cursor in text          | left click in cell                      |                         |
| Cell    | Block edit                       | editor overlay          | click / focus                           | multi-line content      |
| Table   | Select header row                | color highlighting      | click on header                         |                         |
| Table   | Preserve separator row           | visually neutral        | no auto action                          |                         |
| Table   | Select entire table              | border                 | click on table edge                     |                         |
| Table   | Edit table as raw text           | toggle action           | click / shortcut                        |                         |
| Table   | Raw text → render                | toggle action           | leave focus                             |                         |
| Table   | Markdown inside cells            | rendered normally       | inline edit                             |                         |
| Table   | Navigation                       | visible focus line      | arrow keys / Tab                        |                         |
| Table   | Exit table                       | cursor outside          | arrow / click                           |                         |
| Table   | No auto-formatting               | –                      | –                                       | explicit action required|

---
## Bottom line
What you added covers **movement and selection**.
What was missing are:

- **structural actions** (insert/delete)
- **focus and mode rules**
- **raw-text fallback**
- **ban on auto-formatting**
- **header/separator awareness**

With these additions, tables are:
- powerful,
- controllable,
- and above all **not a foreign body in a Markdown editor**.

If you want, I can derive a **“Table Editing Policy” (1 page)** or a **minimal UX sketch in text form** from this as the next step.
