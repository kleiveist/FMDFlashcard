<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
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
