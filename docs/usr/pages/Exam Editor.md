<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->
# Exam Editor – User Documentation

This guide explains the **Exam Editor from a user perspective**: how the interface works, how to use it, and typical workflows.  
Technical implementation details are intentionally omitted.

---

## 1. What is the Exam Editor?

The **Exam Editor** is a visual tool for creating and editing exams more easily than writing Markdown by hand.  
You first build the exam structure (tasks and card types), then fill in the content (questions, answers, options, and hints).

The Exam Editor always works **inside the Active Vault**.

---

## 2. Where to find the Exam Editor

You can access it here:

**Vault Directory → Exam Editor**

Inside the Vault Directory, you can switch between two views (top left):

- **Markdown** – classic Markdown editor
- **Exam Editor** – visual exam builder

Important:
- When you are on **Markdown**, files open in the Markdown editor.
- When you are on **Exam Editor**, files open in the Exam Editor.
- The app does **not** switch views automatically.

---

## 3. Exam Editor Interface

### 3.1 Header / Title Area
At the top of the Exam Editor you see:

- Title: **EXAM EDITOR**
- Short description of the editor
- **Saved path** – shows the file path of the currently opened exam (if any)

### 3.2 Control Bar (separate block above “Note”)
Directly above the Note panel there is a dedicated control block (same width as Note):

- **Structure** – switch to structure mode
- **Content** – switch to content mode
- **New exam** – create a new exam (auto-creates a file)
- **Save as** – save under a new name or location
- **Save** – save to the current file

### 3.3 Card Palette
Below the header is the **Card Palette**, displayed horizontally across the page.

From here you drag card types into the canvas.

Common card types:
- QA (Question / Answer)
- TF (True / False)
- M1 (Single Choice)
- M2 (Multiple Choice)
- CL (Cloze)
- CD (Drag Tokens)
- CLD (Hybrid)
- Help / Hint (not graded)

### 3.4 Canvas
The **Canvas** shows your exam structure:

- Tasks and their cards
- Scrollable
- Designed to handle large exams

### 3.5 Exam Properties
A separate area for global exam settings (e.g. title, metadata).

---

## 4. Workflow: Create an Exam in Two Steps

### Step 1: Structure Mode
Use **Structure** mode to build the exam layout:

1. Click **New exam**.
2. Drag card types from the Card Palette into the canvas.
3. Each task can contain:
   - **one card** (recommended default), or
   - **multiple cards** for more complex tasks.

Tip:
- Start simple with one card per task.
- Multiple cards per task are allowed but more complex.

---

### Step 2: Content Mode
Switch to **Content** mode to fill in details:

- Task text (questions)
- Answers
- Options (M1 / M2)
- True/False selection
- Cloze gaps or drag tokens
- Optional hints

Both the task list and content area are scrollable, making large exams easy to edit.

---

## 5. Files: New exam, Save, Save as

### 5.1 New exam
Clicking **New exam** automatically:

- Creates a new file:
- Saves it in the **currently selected folder** in the Vault Directory
- Opens and binds it immediately in the Exam Editor

This also works inside subfolders.

---

### 5.2 Save
- Saves changes to the currently bound exam file.
- The file path is shown under **Saved path**.

---

### 5.3 Save as
- Saves the exam under a new name or in a different folder.
- Useful for creating copies.

---

## 6. Help / Hint Blocks

You can add **Help / Hint** content to tasks or cards:

- Not graded
- Purely informational
- Supports Markdown formatting

Hints help learners but do not affect evaluation.

---

## 7. Note Panel: Managing Files

In the Note panel you can manage files:

- **Right-click** on a file:
- New file
- Delete
- **Delete / Del key**:
- Deletes the selected file when the Note panel is focused

Behavior depends on the active view:
- Markdown view → opens files in Markdown editor
- Exam Editor view → opens files in Exam Editor

---

## 8. Settings: Showing Empty Folders

Under:

**Settings → App Settings → Vault & Index**

You can enable:
- **Show hidden folders**
- **Show empty folders** (enabled by default)

With *Show empty folders* enabled, folders without Markdown files are still visible.

---

## 9. FAQ

**Why don’t I see a saved path?**  
The path appears after a file is created or saved. Using **New exam** creates and binds a file automatically.

**Can I edit an exam as Markdown?**  
Yes. Switch to the **Markdown** view in the Vault Directory.

**Should I use one card or multiple cards per task?**  
One card per task is recommended for clarity. Multiple cards are supported but more complex.

---
