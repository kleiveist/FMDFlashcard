# Gesamtinhalte – Root: /home/kleif/Projects/FMDFlashcard/docs

## 📝 0001-documentation-source-of-truth.md — ./adr/0001-documentation-source-of-truth.md

[← Back to Docs Home](../index.md)

# ADR 0001: Documentation source of truth

Date: 2026-01-06

## Status

Accepted

## Context

The project needs documentation that is:

- easy to review in pull requests,
- friendly to contributors,
- usable for both end users and developers,
- optionally publishable as a website and exportable as PDF.

## Decision

Use **Markdown** files in the repository as the single source of truth for documentation:

- Short overview in `README.md`
- Full docs in `docs/`
- Contribution guidelines in `CONTRIBUTING.md`
- Changelog in `CHANGELOG.md`

Optionally, generate a docs website (MkDocs/Docusaurus) from the same Markdown content.

## Consequences

- Documentation changes are versioned, reviewable, and diff-friendly.
- Website/PDF generation can be automated later via CI without duplicating content.

---

## 📝 index.md — ./adr/index.md

[← Back to Docs Home](../index.md)

# Architecture Decision Records (ADRs)

ADRs capture important engineering decisions and the reasons behind them.

## Index

- ADR 0001: [Documentation source of truth](0001-documentation-source-of-truth.md)

---

## 📝 architecture.md — ./dev/architecture.md

[← Back to Docs Home](../index.md)

# Architecture overview

This document is a high-level guide to how the project is structured. It is intended for contributors.

## High-level components

- **Desktop application:** a cross-platform desktop UI (commonly built with React/TypeScript and packaged via Tauri).
- **Tooling:** helper scripts to standardize installation, checks, and local development (`tools/control.py`).
- **Features:** application modules for flashcards, fast review, spaced repetition, settings, and help.

## Design goals

- Local-first workflow: the vault is a folder of Markdown files.
- Keep Markdown readable: cards are embedded using simple markers.
- Predictable review logic: identical rules across modes for correctness and statistics.

## Where to look next

- Setup: `setup.md`
- Testing: `testing.md`
- User-facing behavior: `../user/`

---

## 📝 control-script.md — ./dev/control-script.md

[← Back to Docs Home](../index.md)

# Control script (`tools/control.py`)

The repository contains a Python control script intended to standardize common development tasks.

## Why it exists

- Reduce setup friction across OSes
- Provide a single entry point for “doctor”, installation, and local runs
- Keep command sequences consistent across contributors

## Common commands

### Health check

```bash
python3 tools/control.py --doctor
```

### Install / setup

```bash
python3 tools/control.py --install
```

### Prepare / run Tauri tooling

```bash
python3 tools/control.py --tauri
```

### Start the app

```bash
python3 tools/control.py --start
```

### Build release bundles

```bash
python3 tools/control.py --build
```

Builds the desktop app release bundles by running `pnpm tauri build`.
Produces platform-specific bundles/installers.

Notes:
- Working directory: `apps/fmd-desktop`.
- Requires Node + pnpm dependencies and Tauri build prerequisites for the OS.
- Outputs are produced by Tauri under the desktop app's release bundle directory (typically `apps/fmd-desktop/src-tauri/target/release/bundle`).

## Suggested workflow

1. `--doctor` to verify dependencies
2. `--install` to install dependencies / bootstrap
3. `--tauri` to prepare Tauri prerequisites
4. `--start` to run the app

For packaging, run `--build` after `--tauri`.

## When to use

- Use `--start` for day-to-day development and local testing.
- Use `--build` when you need release bundles or installers for distribution.

## Extending the control script

If you add new flags, keep them:

- Deterministic (same inputs -> same result)
- Safe by default (no destructive behavior without explicit confirmation)
- Documented here and in `docs/dev/setup.md` if it affects onboarding

---

## 📝 index.md — ./dev/index.md

[← Back to Docs Home](../index.md)

# Developer documentation

This section explains how to build, run, and contribute to the project.

## Start here

- [Setup](setup.md) (run from source)
- [Control script guide](control-script.md) (use `--build` for release bundles)
- [Architecture overview](architecture.md)
- [Testing](testing.md)
- [Releases / packaging](release.md)

---

## 📝 release.md — ./dev/release.md

[← Back to Docs Home](../index.md)

# Releases / Packaging

This project is packaged as a desktop app (commonly via Tauri).

## Local release builds (conceptual)

- Ensure `--doctor` passes
- Run install/bootstrap (`--install`)
- Use the standard packaging command for the desktop app (Tauri bundler)

Because packaging commands vary by OS and CI environment, keep the authoritative steps in CI
and update this document whenever the release pipeline changes.

## Recommended local packaging workflow

Use the control script as the standard entry point for local packaging:

```bash
python3 tools/control.py --build
```

Builds the desktop app release bundles by running `pnpm tauri build`.
Produces platform-specific bundles/installers.

Notes:
- Packaging is OS-specific; build Windows artifacts on Windows, macOS artifacts on macOS, and Linux artifacts on Linux.
- Requires Node + pnpm dependencies and Tauri build prerequisites for the OS.
- Outputs are produced by Tauri under the desktop app's release bundle directory (typically `apps/fmd-desktop/src-tauri/target/release/bundle`).

## Recommended: CI-driven releases

- Tag-based releases
- Automated build artifacts per OS
- Release notes sourced from `CHANGELOG.md`

---

## 📝 setup.md — ./dev/setup.md

[← Back to Docs Home](../index.md)

# Developer setup (run from source)

This guide describes a “fast start” flow for running the desktop app locally.

Note: Example commands for Linux/macOS (Terminal).
On Windows, use PowerShell or Git Bash; the steps are the same, only the directory path may differ.

## 1) Install Python + Git & check versions

```bash
# --- Check Python (or install if missing) ---
python3 --version || true

# Linux (Debian/Ubuntu)
sudo apt update
sudo apt install -y python3 python3-pip git

# macOS (Homebrew, if available)
# brew install python git

# Verify versions
python3 --version
git --version
```

## 2) Clone the repo & switch to a standard project directory

```bash
# Standard project directory (works on all systems):
# Linux/macOS: ~/Projects
mkdir -p ~/Projects
cd ~/Projects

# Clone repository (replace URL if needed)
git clone https://github.com/kleiveist/FMDFlashcard.git
cd FMDFlashcard
```

## 3) Control script (doctor / health check)

```bash
cd ~/Projects/FMDFlashcard

# optional: health check / doctor
python3 tools/control.py --doctor
```

## 4) Install & start

```bash
cd ~/Projects/FMDFlashcard

# installation / setup
python3 tools/control.py --install
```

## 5) Tauri

```bash
python3 tools/control.py --tauri
```

## 6) Start

```bash
python3 tools/control.py --start
```

## 7) Build (release bundles / native packaging)
```bash
cd ~/Projects/FMDFlashcard
# build desktop app bundles (runs: pnpm tauri build)
python3 tools/control.py --build
```
## If something fails

- Re-run `--doctor` and review the printed checks.
- Confirm you have a supported Node.js/pnpm toolchain if the desktop app uses them.
- Open an issue and paste the relevant terminal output.

---

## 📝 testing.md — ./dev/testing.md

[← Back to Docs Home](../index.md)

# Testing

## Running tests

If the project uses a monorepo layout, tests are typically run from the app workspace.

Examples (adjust to your workspace names):

```bash
# From repo root
pnpm -C apps/fmd-desktop test
```

If you only changed logic in one file, prefer running targeted tests to shorten feedback loops.

## Expectations for pull requests

- Add or update tests when changing evaluation logic (e.g., composite cards, result summaries).
- Ensure lint and typechecks pass before requesting review.

---

## 📝 index.md — ./index.md

[← Back to Repository Home](../README.md)

# Documentation

This documentation is split into two main tracks:

> If GitHub's repository navigation feels slow, use these direct links:
>
> **User docs**
> - [Docs home](docs/index.md)  
> - [User docs index](user/index.md)  
> - [Getting started](user/getting-started.md)  
> - [Flashcard syntax](user/flashcard-syntax.md)  
> - [Examples](Examplesindex.md)  
> - [Spaced repetition](user/spaced-repetition.md)  
> - [Settings](user/settings.md)  
> - [Troubleshooting](user/troubleshooting.md)  
>
> **Developer docs**
> - [Developer docs index](dev/index.md)
> - [Setup (run from source)](dev/setup.md)
> - [Control script](dev/control-script.md)
> - [Architecture](dev/architecture.md)
> - [Testing](dev/testing.md)
> - [Releases / packaging](dev/release.md)
>
> **Project meta**
> - [Contributing](../CONTRIBUTING.md)
> - [Changelog](../CHANGELOG.md)
> - [Security policy](../SECURITY.md)
> - [ADR index](adr/index.md)

## Section indexes

- [User docs index](user/index.md)
- [Developer docs index](dev/index.md)
- [ADR index](adr/index.md)

- **User documentation:** [User docs](user/) for app workflows and day-to-day usage.
- **Developer documentation:** [Developer docs](dev/) for build, run, and contribution details.

## Start here

### Users

- [Getting started](user/getting-started.md)  
  Step-by-step from choosing a vault to your first review mode.
- [Flashcard syntax reference](user/flashcard-syntax.md)  
  How card blocks are structured and how composite cards work.
- [Examples](Examplesindex.md)  
  Copy/paste-ready card blocks, formatting patterns, and workflows.
- [Spaced repetition](user/spaced-repetition.md)  
  How spaced repetition works and how to build a daily routine.
- [Settings overview](user/settings.md)  
  What each setting controls, including scan markers and performance.
- [Troubleshooting](user/troubleshooting.md)  
  Fix common scanning and review issues quickly.

### Developers

- [Setup (run from source)](dev/setup.md)
- [Control script guide](dev/control-script.md) (script: [control.py](../tools/control.py))
- [Architecture overview](dev/architecture.md)
- [Testing](dev/testing.md)
- [Release notes / packaging](dev/release.md)

---

## 📝 issustabel.md — ./issus/issustabel.md


|#|Titel|
|--:|---|
|27|📄 Master Documentation Issue: Markdown Syntax, Containers, Parts, and Scoring|
|26|🐛 Master Bug Tracker (Umbrella Issue) — All Bug Reports & Triage Board|
|25|🗃️ Structural Consolidation of the Codebase to Improve Clarity, Maintainability, and LLM Guidance|
|24|🎓 Add Exam Mode with Automatic Evaluation|
|23|Redesign Dashboard as a True Central Dashboard|
|22|📐 Implement Full-Fledged Markdown Editor and Consistent Markdown Rendering|
|21|UI Improvement in Smart Mode – Collapsible Tool Settings in Narrow Layout|

---

## 📝 refactor-notes.md — ./refactor-notes.md

[← Back to Docs Home](docs/index.md)

# Refactor notes

## Fast Flashcard
- Moved page logic into `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts`.
- Extracted UI panels into `apps/fmd-desktop/src/pages/fast-flashcard/components/` and kept `FastFlashcardPage` as composition-only.
- Kept `apps/fmd-desktop/src/pages/FastFlashcardPage.tsx` as a re-export to preserve routing/imports.

## Spaced Repetition
- Moved page logic into `apps/fmd-desktop/src/pages/spaced-repetition/hooks/useSrSessionViewModel.ts`.
- Extracted UI panels into `apps/fmd-desktop/src/pages/spaced-repetition/components/` and kept `SpacedRepetitionPage` as composition-only.
- Kept `apps/fmd-desktop/src/pages/SpacedRepetitionPage.tsx` as a re-export to preserve routing/imports.

## Stylesheets
- Split `apps/fmd-desktop/src/App.css` into layered files under `apps/fmd-desktop/src/styles/` (`tokens.css`, `base.css`, `layout.css`) plus component files in `apps/fmd-desktop/src/styles/components/`.
- Kept `apps/fmd-desktop/src/App.css` as an import-only aggregator to preserve the existing import in `apps/fmd-desktop/src/App.tsx` and the original cascade order.

---

## 📝 exam-syntax.md — ./user/exam-syntax.md

[← Back to Docs Home](../index.md)

# Exam syntax

The Exams page treats blocks wrapped between `#exam` and `#examend` differently than the standard flashcard scan. This document covers the wrappers, task numbering, and how interaction types behave inside an exam file.

## Wrapping an exam

```md
#exam
... exam sections ...
#examend
```

- `#exam` and `#examend` must each appear on their own line. Do not show them in the UI—they exist only to signal exam parsing (`e`).
- Everything between the wrappers is considered exam content. Free text is allowed, but only numbered tasks (`ea`) produce interactive items.
- You can still embed `#card … #` blocks inside exam tasks; they behave the same as outside, but the Exams page uses them as prompts.

## Numbered tasks (`ea`)

A task starts when a trimmed line begins with a number from 1 to 20. The parser accepts these variants:

- `1. Question...`
- `2)` or `2.)`
- Bold numbering like `**3)**`
- A leading `-` prior to the number, e.g., `-4. Section`

After the numeric prefix, the parser expects whitespace (or closing punctuation) before the task prompt. Each task runs until one of:

1. A line containing `---` (separator for composite tasks).
2. The next numbered task line.
3. `#examend`.

Use tasks to wrap a single interaction type (qa/tf/m1/m2/cl/cd). If you need multiple interactions, separate them with `---` inside the `#card` block so the parser treats each chunk independently.

## Interactions inside exam tasks

Once a task is detected, the parser reuses the same logic as the flashcard scan. The most common interaction codes are documented under `docs/user/examples/`:

- QA parts: `examples/qa.md` (answer markers).
- True/False: `examples/tf.md` (next-line markers).
- Multiple choice: `examples/m1.md` and `examples/m2.md`.
- Cloze typed blanks: `examples/cl.md`.
- Drag tokens: `examples/cd.md`.
- Card containers: `examples/f.md`.

The `examples/e.md` guide also lists the combination matrix and short rules per code when building exam content.

## Exam task output

- Each numbered task becomes an `ExamTask` object with a prompt, optional official answer, and metadata such as grading mode (`auto`, `manual`, `hybrid`).
- Add answer markers to include official solutions that appear in the reveal area only after Submit.
- True/false, multiple choice, and cloze interactions appear with their dedicated widgets in the Exams UI.

## Best practices

1. Keep each task focused on a single interaction type. Use `---` when composing mixed interactions.
2. Only include `#card … #` blocks inside tasks when you need formatting or multiple Q/A segments.
3. Avoid showing `#exam`, `#examend`, or numbered prefixes as visible text—the UI hides them.
4. Mirror this doc when authoring exam material in other languages; the parser only relies on the numeric pattern and answer markers, not the language itself.

---

## 📝 basic-cards.md — ./user/examples/.archive/basic-cards.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Basic cards

Use these minimal Q/A card blocks to get started. Copy/paste into a Markdown file in your vault,
scan your vault, and open a review mode.

## Minimal Q/A card

```md
#card
What is a primary key?
Answer: A primary key uniquely identifies a row in a table.
#
```

## Multiple cards in one file

```md
#card
What does ACID stand for?
Answer: Atomicity, Consistency, Isolation, Durability.
#

#card
What is a foreign key?
Answer: A field that references a primary key in another table.
#
```

## Formatting tips

- Keep the prompt on the first non-empty line of the card block.
- Start the answer with the `Answer:` marker (or `Antwort:`) inside the block.
- The answer can be inline or on the following lines.
- Keep `#card` and `#` on their own lines.
- Separate card blocks with at least one blank line for readability.

---

## 📝 cloze-cards.md — ./user/examples/.archive/cloze-cards.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Cloze cards

Cloze cards hide parts of a sentence inside a card block. Typed blanks use %%...%%, and drag tokens
use backticks.

## Typed blanks (input)

```md
#card
Fill in: The capital of France is %%Paris%%.
#
```

## Drag tokens (inline code)

```md
#card
Complete the command:
`git` `status` shows changes.
#
```

## Mixed typed + drag

```md
#card
Fill in: The capital of %%France%% is `Paris`.
#
```

## Tips

- Every %%...%% blank must contain text.
- Use backticks around each drag token.
- You can include multiple blanks in one line.

---

## 📝 composite-cards.md — ./user/examples/.archive/composite-cards.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Composite cards

A composite card is a single card block that contains multiple parts. The card is marked correct only
if every part is correct.

## Short composite (two parts)

```md
#card
What is 2NF?
Answer: Every non-key attribute depends on the whole key.

What is 3NF?
Answer: No non-key attribute depends on another non-key attribute.
#
```

## Longer composite (three parts)

```md
#card
Define "primary key".
Answer: A unique identifier for a row.

Define "foreign key".
Answer: A field that references a primary key in another table.

Define "candidate key".
Answer: Any key that could serve as the primary key.
#
```

## Notes

- Separate each part with at least one blank line inside the card block.
- Use the same card type for every part (for example, all Q/A with `Answer:`).
- Composite cards are graded as a whole in review mode.

---

## 📝 exam.md — ./user/examples/.archive/exam.md

<!--
FILE: docs/user/examples/exams-syntax-and-rendering.md
Purpose: User documentation (Examples) — explain Exam syntax and how the Exam page renders content by phase.
-->

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Exams Page: Syntax and Rendering Breakdown

This page explains **how exam notes are structured in Markdown** and **how the Exams page renders them**
in two phases:

- **Phase 1 (Answering):** you see prompts and input controls, but **no official solutions**
- **Phase 2 (Review after Submit):** official solutions become visible in the **reveal/solution** area

> Important: In Exam mode, authoring wrappers like `#exam`, `#card`, and a standalone closing `#examend`
> must never appear as visible text in the UI.

---

## 1) Core exam syntax: `#exam … #examend`

An exam block looks like this:

```md
#exam
1) Question text…
Answer: (official solution — must not be visible before Submit)
#examend

---

## 📝 formatting.md — ./user/examples/.archive/formatting.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

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

---

## 📝 multiple-choice.md — ./user/examples/.archive/multiple-choice.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Multiple choice cards

Multiple choice cards use option labels a), b), c) and one or more correct markers (-a, -b, ...)
inside a card block.

## Single-answer

```md
#card
Which planet is known as the Red Planet?
a) Earth
b) Mars
c) Venus
-b
#
```

## Multiple-answer

```md
#card
Which numbers are prime?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
```

## Tips

- Use at least two options.
- Each correct option must have its own marker line.
- Keep `#card` and `#` on their own lines.

---

## 📝 true-false.md — ./user/examples/.archive/true-false.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# True/false cards

True/false cards use a statement line followed by a marker line (`-true` or `-false`). You can
include multiple statements in one card block to form a composite card.

## Single statement

```md
#card
The Earth orbits the Sun.
-true
#
```

## Multiple statements (composite)

```md
#card
Pluto is a planet.
-false

Water freezes at 0 C.
-true
#
```

## Tips

- Every statement must be followed by its marker on the next non-empty line.
- Use `-true`/`-false` (or `-wahr`/`-falsch`) consistently within a card block.

---

## 📝 workflows.md — ./user/examples/.archive/workflows.md

← Back to [FMDFlashcard/docs/user/examples/index.md](index.md)

# Workflows

These step-by-step workflows show typical ways to use a vault and review modes.

## Create a vault, add cards, scan, review

1. Create a vault folder and add a Markdown file.
2. Paste a card block (see Basic cards or other examples).
3. Open the app and select your vault.
4. Run a scan from Flashcard Tools.
5. Choose a review mode and start reviewing.

## Fix a parsing issue and rescan

1. Open the note in your vault and verify the markers (`#card`, `#`, `Answer:`).
2. Make sure each card block has `#card` and `#` on their own lines.
3. Remove stray text inside markers or fix option labels.
4. Rescan the vault and confirm the card count.

## Build a daily spaced repetition routine

1. Open the Spaced Repetition review mode.
2. Review due cards until the queue is empty.
3. Add or edit cards after study sessions.
4. Rescan the vault when you change card blocks.
5. Repeat daily to keep the schedule stable.

---

## 📝 cd.md — ./user/examples/cd.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `cd`: Cloze (drag tokens)

Drag tokens use backticks to create draggable pieces learners can drop into blanks. The parser reads ``token`` fragments as drag-and-drop solutions inside the same cloze pipeline.

```md
#card
The colors of the German flag are `black`, `red`, and `gold`.
#
```

- Each inline `token` becomes a drag token that learners can drag into the drop zone associated with that blank.
- Empty tokens are ignored, so always place visible text inside the backticks.
- Drag tokens work alongside typed cloze blanks; both are treated as `cloze` parts with `kind` `drag` in the segment list.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle order is seeded by the card/part identity so repeated views keep the same arrangement.
## Behavior notes

- Use drag tokens when you want the learner to match predefined units instead of typing them.
- Drag and typed blanks render together on the same UI if they belong to the same block. If you need to mix drag tokens with other modes (TF or MC), separate them with `---` or split into different tasks.

---

## 📝 cl.md — ./user/examples/cl.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `cl`: Cloze (typed blanks)

Typed clozes use the `%%...%%` syntax to turn inline fragments into input fields (`cl`). The learner must type the missing words exactly as written (normalization is trim-and-lowercase by default).

```md
#card
The capital of France is %%Paris%%.
#
```

- Each `%%…%%` pair becomes an input blank. The parser trims the text inside; blanks without any content are rejected.
- You can combine cloze blanks and drag tokens in the same question as long as the interactions stay within one block. When cl and cd coexist, the parser spawns both blank and drag segments.
- The blank solutions are case-insensitive and trimmed; punctuation inside the solution is preserved, so `%%Paris%%` differs from `%%Paris,%%`.

## Behavior notes

- Cloze blanks can appear in the prompt or in body text, and the parser splits them into segments for the UI.
- If you need to mix typed blanks with other interactions (MC, TF), insert `---` between them or split them into separate tasks to keep scoring manageable.

---

## 📝 cld.md — ./user/examples/cld.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `cld`: Cloze (typed blanks + drag tokens)

`cld` is the combined Cloze format that supports **both**:
- **Typed blanks** using `%%...%%`
- **Drag tokens** using backticks `` `token` ``

- This lets you build a single cloze interaction where learners can either type answers (typed blanks) and/or use a token bank (drag tokens) within the same part.
- The drag-token list is shuffled before display; the order does not match the order in the source text.
- The shuffle sequence is seeded by the card/part identity so the same task keeps the same order within a session.
---

## Syntax

### Typed blanks
Use `%%...%%` to create an input field. The text inside is the **solution**.

Example:
```md
#card
The `capital` of France is %%Paris%%.
#
```
---

---

## 📝 e.md — ./user/examples/e.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `e`: Exam block container

Use `#exam` and `#examend` to wrap the section you want the Exams page to treat as a dedicated exam session. Anything between these markers runs through the exam parser and renders in the **Exam** view; outside the markers the content behaves like a regular deck.

## Syntax summary

| Component | Purpose |
| --- | --- |
| `#exam` | Stand-alone line that opens the exam block. It signals the Exams page and parser to expect numbered tasks (`ea`). |
| Content between | Treated as an exam file. Free text is allowed, but actual interaction data only comes from the numbered tasks that follow exam numbering rules. |
| `#examend` | Stand-alone line that closes the block. Ignore it in the UI; no flashcards are created past this point unless a new card block opens. |
| `#` | Still closes a `#card` block inside an exam task just like everywhere else. The exam block itself is not closed by `#`. |

## Behavior reminders

- Do **not** display `#exam` / `#examend` as visible text—the Exams page keeps those wrappers out of the UI.
- Mark the entire exam file or section as exam content so that scans treat it differently than standard flashcards.
- Only numbered tasks (`ea`) yield cards; stray text between tasks is rendered as instructions or context.
- You can still embed `#card … #` blocks inside a task, the parser merges them, and their interactions obey the usual flashcard rules.
- `#exam` does not interfere with `#card`; every card still needs its own `#` terminator.

For details on each code, follow the respective files above (`ea`, `f`, `qa`, `tf`, `m1`, `m2`, `cl`, `cd`).

---

## 📝 ea.md — ./user/examples/ea.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `ea`: Exam task block

An exam task (`ea`) is the smallest unit that the Exams page turns into an interactive item. Each task starts with a numbered line and continues until the next break marker, a new number, or the end of the exam block.

## Recognizing the start

The parser looks at every line between `#exam` and `#examend`. A new task begins when a trimmed line starts with a number from **1 to 20**. The following variations are all valid:

- `1. Prompt text…`
- `2)` or `2.)`
- `**3)**` (it allows bold markers to highlight the heading)
- `-4. Subtask` (a leading hyphen is stripped before checking the digits)

After the number you can optionally continue with `)`, `.`, `)`, or bold markers; the parser only requires whitespace after the numeric part so that a line such as `5. Explain…` works.

## Ending a task

A task chunk is considered finished when one of these markers appears between the current line and the next:

1. A line that contains exactly `---`. This is also the separator for composite tasks inside one `#card`.
2. Another numbered start line (`ea`). The parser flushes the previous task when it sees the next number.
3. `#examend`, which ensures the final task is emitted.

## What to place inside

- Write the prompt or context just beneath the numbering line.
- Use a single interaction type per task (qa/tf/m1/m2/cl/cd) to keep grading predictable. If you mix types, insert `---` between them so the parser treats each part independently.
- You can still wrap the task text inside a `#card … #` block; the parser adds the task prompt to a temporary card before detecting interactions.
- The Exams page records the official answer when you add answer markers (`qa`) or any graded interaction (tf/m1/m2/cl/cd).

Example:

```md
#exam
1) Discuss the principle of least privilege.
Answer: The principle says …
---
2) Is the following statement true or false?
The principle of least privilege limits what users can do.
-true
#examend
```

Every numbered heading above becomes one `ea` task, with its own prompt and answer chunk.

---

## 📝 Examplesindex.md — ./user/examples/Examplesindex.md

← Back to [User docs index](../index.md)

# Examples Tabel
- [examplestabel_de](examplestabel_de.md)  
- [examplestabel_en](examplestabel_en.md)  
# Examples

These examples are ready-to-use templates for your vault. Copy/paste a card block into any Markdown file,
scan your vault, and start a review mode. Each example uses the default `#card` and `#` markers. If you
changed scan markers in Settings, update the snippets before scanning.
## Syntax reference
- [`e` – exam block container](e.md)  
- [`ea` – numbered exam task](ea.md)  
- [`f` – `#card … #` containers](f.md)  
- [`qa` – answer markers and QA parts](qa.md)  
- [`tf` – true/false interaction`](tf.md)  
- [`m1` – single-answer multiple choice`](m1.md)  
- [`m2` – multi-answer multiple choice`](m2.md)  
- [`cl` – typed cloze blanks (`%%…%%`)](cl.md)  
- [`cd` – draggable cloze tokens (`` `…` ``)](cd.md)  
- [`cdl` – draggable cloze tokens and typed cloze blanks (`` `…` ``)](cd.md)   
---
## Syntax test
- [Testmatix](Testmatix.md)  
- [Test_n1](Test_n1.md)  
-  [Test_n2](Test_n2.md)  
----

---

## 📝 examplestabel_de.md — ./user/examples/examplestabel_de.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

| Beschreibung                            | Syntax start                                                         | Sytax end                                        | Relewant für           | Aktion                                                                                                 | kürzel |
| --------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------ | ------ |
|                                         |                                                                      | WICHTIG #                                        | gilt nicht wenn        | # Überstich <br>## überschrift                                                                         |        |
|                                         |                                                                      |                                                  | e = exam               | f = flashcard                                                                                          |        |
| Examen-Blog (Container)                 | #exam                                                                | #examend                                         | e-page<br>Exam-Modus   | - Datei/Abschnitt als **Exam-Content** markieren- Inhalte **nicht als Flashcards**                     | e      |
| Examen-Aufgabenblock                    | - Start Aufgabe  Nummerierung, <br>1.   2)   2.)    1.2.3 <br>n = 99 | ---  <br>1.2.3<br>#                              | e-page<br>Exam-Modus   | Aufgabe als Exam-Item                                                                                  | ea     |
| Flashcard-Blog (Card-Block / Container) | #card                                                                | #                                                | f-pages Flashcard-Scan | - Block als Flashcard-Item <br>                                                                        | f      |
| Antwort-Marker (Q/A-Teil)               | Answer:{text}<br>Antwort: {text}<br>answertocken:{text}              | ---  <br>#                                       | e-page <br>f-pages     | - Alles nach Marker als **Antworttext** speichern; Zeilenumbrüche beibehalten.                         | qa     |
| True/False-Marker <br>(2-Button-Karte)  | true/false? {text}<br>-true or<br>-false                             | ---  <br>#                                       | e-page <br>f-pages     | - UI: **2 Buttons (True/False)**- Validierung: Marker muss auf **nächster nicht-leerer Zeile** stehen. | tf     |
| Multiple Choice (Single-Answer)         | - Options-Labels im Block,<br>`a)` `b)` `c)` …                       | aswahl endet mit<br>-a)<br>blog mit <br>#<br>--- | e-page <br>f-pages     | - UI: Auswahl Single Marker mindestens 1<br>-x = 1<br>-a)                                              | m1     |
| Multiple Choice <br>(Multi-Answer)      | - Options-Labels im Block,<br>`a)` `b)` `c)` …                       | aswahl endet mit<br>-a)<br>blog mit <br>#<br>--- | e-page <br>f-pages     | Auswahl Multi Anzahl Marker mindestens 2<br>-x < 2<br>-a)<br>-b)                                       | m2     |
| Cloze Lückentext:                       | -Typed blanks: `%%...%%` innerhalb                                   | ---  <br>#                                       | e-page <br>f-pages     | für Backticks- Validierung: jedes `%%...%%` enthält Text.                                              | cl     |
| Cloze <br>Drag Tokens)                  | des Texts- Drag tokens: ``token``                                    | ---  <br>#                                       | e-page <br>f-pages     | - UI: Eingabefelder für ``token`` + Drag/Drop                                                          | cd     |
| Cloze Lückentext +Drag Tokens           | Typed blanks: `%%...%%` + tokens: ``token``innerhalb                 | ---  <br>#                                       | e-page <br>f-pages     | - UI: Eingabefelder  ``token`` und Drag/Drop<br> Backticks- Validierung: jedes `%%...%%`               | cld    |
## **Kombinierung Tabelle** 
Legende: 💠 problemlos · ❕ mit Beachtung · ⚠️ mit Einschränkungen · ❌ nicht möglich

|     | e   | ea  | f   | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| e   | ❌   | 💠  | ❌   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   |
| ea  | 💠  | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| f   | ❌   | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| qa  | ❕   | 💠  | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| tf  | ❕   | 💠  | 💠  | ⚠️  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| m1  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | 💠  | ❕   | ⚠️  | ⚠️  | ⚠️  |
| m2  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ❕   | 💠  | ⚠️  | ⚠️  | ⚠️  |
| cl  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cd  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cld | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ❕   | ❕   | 💠  |

---
### Kurzregeln je Kürzel (Begründung für ❕/⚠️)

| Kürzel | Status | Hinweis                                                                                                                                                                   |
| ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e      | ❕      | Innerhalb `#exam … #examend` sind Kartentypen **nur sinnvoll innerhalb** eines Aufgabenblocks (`ea`). Außerhalb davon: typischerweise **Freitext/ignored**.               |
| ea     | 💠     | Aufgabenblock kann **genau einen** Interaktionstyp enthalten (qa/tf/m1/m2/cl/cd). Mehrere Typen in _einer_ Aufgabe nur als Composite (dann wie unten ⚠️).                 |
| f      | 💠     | `#card … #` kann qa/tf/m1/m2/cl/cd tragen. Mehrere Typen in _einem_ `#card` nur als Composite (⚠️).                                                                       |
| qa     | ⚠️     | Sobald qa mit interaktiven Typen gemischt wird (tf/m1/m2/cl/cd), sind Antworten häufig **nicht mehr sauber automatisch prüfbar** → ggf. nur Selbstkontrolle/Teil-Scoring. |
| tf     | ⚠️     | Gemischt mit m1/m2/cl/cd erfordert pro Part **eigene UI/Logik** (Multi-Widget Composite). Wenn nicht implementiert: Einschränkung oder Fallback.                          |
| m1     | ❕      | m1+m2 ist möglich, aber **nur als getrennte Parts** (klare Marker je Part).                                                                                               |
| m2     | ❕      | analog m2+m1.                                                                                                                                                             |
| cl     | 💠     | cl+cd ist problemlos (Cloze-Text kann beides enthalten). Mit anderen Typen nur als Composite (⚠️).                                                                        |
| cd     | 💠     | wie cl.                                                                                                                                                                   |
| cld    |        | wie cl + cd                                                                                                                                                               |
|        |        |                                                                                                                                                                           |



---

## 📝 examplestabel_en.md — ./user/examples/examplestabel_en.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

| Description                              | Syntax start                                                          | Syntax end                                                | Relevant for           | Action                                                                                           | Code |
| ---------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ | ---- |
|                                          |                                                                       | IMPORTANT: `#`                                            | does not apply when    | `#` heading <br> `##` heading                                                                    |      |
|                                          |                                                                       |                                                           | e = exam               | f = flashcard                                                                                    |      |
| Exam block (container)                   | #exam                                                                 | #examend                                                  | e-page<br>Exam mode    | - Mark file/section as **exam content**<br>- Do **not** treat contents as flashcards             | e    |
| Exam task block                          | - Start task numbering, <br>1.   2)   2.)    1.2.3 <br>n = 99         | ---  <br>1.2.3<br>#                                       | e-page<br>Exam mode    | Treat task as an exam item                                                                       | ea   |
| Flashcard block (card block / container) | #card                                                                 | #                                                         | f-pages Flashcard scan | - Treat block as a flashcard item                                                                | f    |
| Answer marker (Q/A part)                 | Answer:{text}<br>Antwort: {text}<br>answertocken:{text}               | ---  <br>#                                                | e-page <br>f-pages     | - Store everything after the marker as **answer text**; preserve line breaks.                    | qa   |
| True/False marker <br>(2-button card)    | true/false? {text}<br>-true or<br>-false                              | ---  <br>#                                                | e-page <br>f-pages     | - UI: **2 buttons (True/False)**<br>- Validation: marker must be on the **next non-empty line**. | tf   |
| Multiple choice (single-answer)          | - Option labels in the block,<br>`a)` `b)` `c)` …                     | selection ends with<br>-a)<br>block ends with<br>#<br>--- | e-page <br>f-pages     | - UI: single choice; at least 1 correct marker<br>-x = 1<br>-a)                                  | m1   |
| Multiple choice <br>(multi-answer)       | - Option labels in the block,<br>`a)` `b)` `c)` …                     | selection ends with<br>-a)<br>block ends with<br>#<br>--- | e-page <br>f-pages     | Multi choice; at least 2 correct markers<br>-x < 2<br>-a)<br>-b)                                 | m2   |
| Cloze (typed blanks)                     | Typed blanks: `%%...%%` inside                                        | ---  <br>#                                                | e-page <br>f-pages     | For typed blanks: validation requires every `%%...%%` to contain text.                           | cl   |
| Cloze <br>(drag tokens)                  | in the text: drag tokens: ``token``                                   | ---  <br>#                                                | e-page <br>f-pages     | - UI: input fields for ``token`` + drag/drop                                                     | cd   |
| Cloze <br>(drag tokens)                  | in the text: drag tokens: ``token``<br>Typed blanks: `%%...%%` inside | ---  <br>#                                                | e-page <br>f-pages     | - UI: input fields for ``token`` + drag/drop and  blanks: validation `%%...%%`                   | cd   |

## **Combination matrix**
Legend: 💠 works · ❕ works with care · ⚠️ works with limitations · ❌ not possible

|     | e   | ea  | f   | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| e   | ❌   | 💠  | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   | ❕   |
| ea  | 💠  | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| f   | ❕   | ❌   | ❌   | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  | 💠  |
| qa  | ❕   | 💠  | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| tf  | ❕   | 💠  | 💠  | ⚠️  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ⚠️  |
| m1  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | 💠  | ❕   | ⚠️  | ⚠️  | ⚠️  |
| m2  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ❕   | 💠  | ⚠️  | ⚠️  | ⚠️  |
| cl  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cd  | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | 💠  | 💠  | ❕   |
| cld | ❕   | 💠  | 💠  | ⚠️  | ⚠️  | ⚠️  | ⚠️  | ❕   | ❕   | 💠  |

---
### Short rules per code (reasoning for ❕/⚠️)

| Code | Status | Note                                                                                                                                                       |
| ---- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| e    | ❕      | Inside `#exam … #`, card types are **only meaningful inside** a task block (`ea`). Outside of tasks: typically **free text / ignored**.                    |
| f    | ❕      | `#exam` is not affected by `#card`; it ends with `#examend`.                                                                                               |
| ea   | 💠     | A task block can contain **exactly one** interaction type (qa/tf/m1/m2/cl/cd). Multiple types in a _single_ task only as a composite (then like below ⚠️). |
| f    | 💠     | A `#card … #` block can contain qa/tf/m1/m2/cl/cd. Multiple types in _one_ `#card` only as a composite (⚠️).                                               |
| qa   | ⚠️     | Once Q/A is mixed with interactive types (tf/m1/m2/cl/cd), answers are often **no longer cleanly auto-checkable** → consider self-check / partial scoring. |
| tf   | ⚠️     | Mixed with m1/m2/cl/cd requires **dedicated UI/logic per part** (multi-widget composite). If not implemented: limitation or fallback.                      |
| m1   | ❕      | m1+m2 is possible, but **only as separate parts** (clear markers per part).                                                                                |
| m2   | ❕      | Same as m2+m1.                                                                                                                                             |
| cl   | 💠     | cl+cd is fine (one cloze text can contain both). With other types only as a composite (⚠️).                                                                |
| cd   | 💠     | Same as cl.                                                                                                                                                |
| cld  |        | Same as cl + cd                                                                                                                                            |


---

## 📝 f.md — ./user/examples/f.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `f`: Flashcard block container

A `#card … #` block (`f`) declares the flashcard boundaries that the parser scans. You can use it inside or outside exam content. Inside an exam, the block is only processed if it sits inside a numbered task (`ea`).

## Syntax

```md
#card
Question or prompt text
Answer: The answer text
#
```

- The opening `#card` and the closing `#` must each sit on their own line.
- Everything between those markers is split into sub-blocks (`splitCardLines`), which may become QA text, true/false pairs, MC options, or cloze parts.
- You can host multiple interactions inside a single `#card` by separating them with `---`. Each segment contributes one detected interaction type.
- `#card` is unaffected by `#exam`; the exam wrapper only changes which cards are surfaced in the Exams view.

When you nest this pattern inside an `ea` task, it becomes the container for the official task prompt that the exam parser converts into an `ExamTask` object.

---

## 📝 m1.md — ./user/examples/m1.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `m1`: Single-answer multiple choice

Single-answer multiple choice blocks use option labels like `a)`, `b)`, `c)` and a correct marker line such as `-a`. The UI renders these as a radio-style selection.

## Syntax

```md
#card
Which planet is known as the Red Planet?
a) Earth
b) Mars
c) Venus
-b
#
```

- Every option line must follow the pattern `<letter>) <text>` (case-insensitive letter). The parser normalizes the letter to lowercase.
- Correct answers are marked with `-x` where `x` is the corresponding option letter. For single-answer MC, provide exactly one correct marker (`-x = 1`).
- The card must contain at least two options to keep the UI meaningful.

## Behavior

- The UI presents a single choice with radio buttons.
- The parser collects the question plus the options, then uses the `correctKeys` array from the `-x` lines to determine which answer is correct.
- Combining m1 with other interactive codes (e.g., tf, cl) in the same task requires separators (`---`) and dedicated handling.

---

## 📝 m2.md — ./user/examples/m2.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `m2`: Multi-answer multiple choice

Multi-answer multiple choice is similar to single-answer, but the learner may select several options. Each correct option gets its own `-x` marker line; there must be at least two correct markers to make this a multi-answer question.

## Syntax

```md
#card
Which numbers are prime?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
```

- Provide option lines just like single-answer MC (`letter) text`).
- Add a `-x` line for every correct option. The parser collects them into `correctKeys`. For multi-answer questions, include **two or more** `-x` lines.
- `-x < 2` in the original notation means that you must supply more than one correct marker to float into the multi-answer mode.

## Behavior

- The UI shows checkboxes so learners can pick multiple answers.
- The parser keeps the `correctKeys` list in the same structure as m1 and sets `detectedTypes` to `multiple-choice`.
- When mixing m2 with other interactive codes in one task, separate them with `---` and treat each chunk as its own interaction.

---

## 📝 qa.md — ./user/examples/qa.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

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

---

## 📝 tf.md — ./user/examples/tf.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

# Code `tf`: True/False marker (2-button card)

True/false interactions count as `tf` and render as two-button questions where the learner chooses between true and false. The parser recognizes them by pairing a prompt line with the next non-empty line that starts with a `-` and a truthy/falsy token.

## Format

```
#card
Is the following statement true?
The Sun is a star.
-true
#
```

- The question line(s) appear first, followed by a dedicated result marker on the next non-empty line (no blank line between question and marker is required but allowed).
- The marker must begin with `-` and then a keyword. Valid true tokens include `true`, `yes`, `ja`, `wahr`, `vrai`, `verdadero`, `vero`, `waar`, `sant`, `právda`, etc. False tokens include `false`, `no`, `nein`, `falsch`, `falso`, `neh`, `falskt`, `epätosi`, `hakis`, `ложь`, `خطأ`, and their localized equivalents.
- The parser strips punctuation at the end and matches the normalized keyword, so `-true.` and `-ja` both work.

## Behavior notes

- The marker must sit on the next non-empty line after the question; the parser skips blank lines between them.
- The UI shows the question from the card prompt and then the `true/false` buttons. The correct button is governed by the marker.
- Mixing `tf` with other interactive types (m1/m2/cl/cd) in the same task requires explicit multi-widget handling, so keep the block focused or split it with `---`.

---

## 📝 flashcard-syntax.md — ./user/flashcard-syntax.md

[← Back to Docs Home](../index.md)

# Flashcard syntax reference

Markdown flashcards keep your notes readable and the parser precise. The only required markers are the block wrappers and whatever interaction markers you need for the question type.

## Card block basics

```md
#card
...
#
```

- `#card` opens a block.
- Everything after `#card` up until a standalone `#` belongs to the same card.
- A single file can contain multiple `#card … #` blocks; they can appear anywhere in your vault.
- Use `---` inside the block to separate multiple interaction chunks (for example, QA followed by MC). Each chunk is treated independently but still scores as a single composite card.
- For detailed explanations of each interaction type, see the short-code reference examples in `docs/user/examples/` (qa, tf, m1, m2, cl, cd, etc.).

## Interaction highlights

- **QA (free-text answers):** Place questions followed by an answer marker (`Answer:`, `Antwort:`, `answertocken:` etc.). Everything after the marker becomes the answer. Answers preserve line breaks, so multi-paragraph solutions are fine. Mixed QA + auto-graded parts use `---`.
- **True/False:** Write the statement, then on the very next non-empty line add `-true` or `-false` (normalized to your language). The parser looks for the marker immediately after the question block.
- **Multiple choice (single / multi):** Use option lines like `a) Text`. Mark correct options with `-a`, `-b`, etc. A single marker means single-answer (m1), two or more markers classify the block as multi-answer (m2).
- **Cloze interactions:** `%%solution%%` produces text inputs. Inline `` `token` `` fragments become drag tokens (cd). You can mix typed blanks and drag tokens inside the same cloze chunk; just keep the actual tokens populated.

## Composites and interactions

- A `#card` can combine QA with any auto-graded type (tf, m1, m2, cl, cd) by inserting `---`. The order matters for the UI, so keep related parts together.
- QA answers remain in a Pending state after Submit until you self-grade them. Auto-graded interactions show their final state immediately, but they still belong to the same composite card.
- The parser keeps track of detected interaction types through metadata (`primaryType`, `detectedTypes`). Mixed cards (two or more detected types) are treated as composites and typically render a single Submit button.

## Exam content

- If you are authoring a dedicated exam file, wrap your tasks between `#exam` and `#examend` and refer to `docs/user/exam-syntax.md` for the exam-specific wrappers (`e`, `ea`, etc.).
- `#exam` does not change how `#card` behaves; it only controls whether the Exams page includes the section.

## Notes

- The parser trims whitespace aggressively, so keep markers on their own lines and avoid extra characters before `#card`, `#`, or the interaction markers.
- Prefer the in-app Help to confirm the latest parsing tweaks and file an issue if behavior drifts from this guide.

---

## 📝 getting-started.md — ./user/getting-started.md

[← Back to Docs Home](../index.md)

# Getting started

This guide covers the shortest path from “I have Markdown notes” to “I can review cards”.

## 1) Create or choose a vault folder

A *vault* is simply a folder that contains your Markdown files. The app scans this folder to find
flashcards embedded in your notes.

## 2) Add your first cards to a Markdown file

Create a new `.md` file (or use an existing one) and add a `#card` block.

Example:

```md
#card

What is 2NF (Second Normal Form)?
- 2NF requires that every non-key attribute depends on the whole of a composite key (if a composite key exists).

Define “foreign key” and give a simple example.
- A foreign key is an attribute (or set of attributes) that references the primary key of another table to enforce referential integrity.
```

## 3) Open the app and load the vault

1. Open the app.
2. Choose your vault folder.
3. Let the app scan your Markdown files.

## 4) Start a review

Pick a review mode (standard, fast, spaced repetition) and start answering cards.
If a card contains multiple Q/A pairs inside the same `#card` block, it is treated as a *composite card*:
the card is correct only if all parts are correct.

## 5) Iterate

- Add cards as you learn.
- Refactor notes as usual—your Markdown remains readable.
- Use Settings to tune parsing markers, review behavior, and performance options.

Next: read `flashcard-syntax.md` for the latest markers and `exam-syntax.md` when you want to author exam files with `#exam … #examend`.

---

## 📝 index.md — ./user/index.md

[← Back to Docs Home](../index.md)

# User documentation

This section explains how to use the app day-to-day.

## Start here

- [Getting started](getting-started.md)  
  Step-by-step from choosing a vault to your first review mode.
- [Flashcard syntax reference](flashcard-syntax.md)  
  How card blocks are structured and how composite cards work.
- [Examples](Examplesindex.md)  
  Copy/paste-ready card blocks, formatting patterns, and workflows.
- [Spaced repetition](spaced-repetition.md)  
  How spaced repetition works and how to build a daily routine.
- [Settings overview](settings.md)  
  What each setting controls, including scan markers and performance.
- [Troubleshooting](troubleshooting.md)  
  Fix common scanning and review issues quickly.

---

## 📝 settings.md — ./user/settings.md

[← Back to Docs Home](../index.md)

# Settings

Settings allow you to tune how the app behaves and how it scans your vault.

## Common settings areas

- **Data & Sync:** where your vault is selected, how scanning works, and data storage options.
- **Language / UI:** localization and display preferences.
- **Performance:** options intended for larger vaults and faster scanning.
- **Flashcard / Fast Flashcard / Spaced Repetition tools:** review-mode specific behaviors.

## Recommendations

- Start with default values.
- Only change scan markers (e.g., card prefix) if you have a clear reason.
- If you see performance warnings, enable recommended performance options and rescan.

---

## 📝 spaced-repetition.md — ./user/spaced-repetition.md

[← Back to Docs Home](../index.md)

# Spaced repetition

Spaced repetition helps you review cards at increasing intervals based on performance.

## Concepts

### DEFAULT ORDER

| In order                             | Random                             | Repetition                              |
| ------------------------------------ | ---------------------------------- | --------------------------------------- |
| flashcard after <br>loading sequence | flashcard randomly <br>distributed | flashcard Tracking <br>Boxen evaluation |

Repetition Concepts
- **Boxes / levels:** cards move through boxes based on correct/incorrect answers.
- **Sessions:** you review a subset of cards (often based on box selection and scheduling).
- **Progress tracking:** the app records outcomes to influence future scheduling.

## Typical workflow

1. Select a box (or a scheduled set). 
2. Review cards.
3. Cards move forward on correct answers; they may move back on incorrect answers.

## Practical guidance

- If you have many cards, start with a smaller daily set.
- Be consistent: small daily sessions are more effective than rare large sessions.
- When you change flashcard syntax or refactor notes, re-scan your vault and verify card counts.


---

## 📝 Test_cld.md — ./user/test/Test_cld.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)

| n1  | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cld | 2   | 3   | 4   | 5   | 6   | 7   | 8   |

#exam

## n2 – Ergänzung: alle Kombinationen mit cld (je Kombination = 1x #card ... #)

2) qa + cld
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
3) tf + cld
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
2) m1 + cld
#card
[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
5) m2 + cld
#card
[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
6) cl + cld
#card
[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
7) cd + cld
#card
[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
8) cld + cld
#card
[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.

[cld]
[cl] Die Hauptstadt von Frankreich ist %%Paris%%.
[cd] Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#

#examend

---

## 📝 Test_n1.md — ./user/test/Test_n1.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)


| n1  | qa  | tf  | m1  | m2  | cl  | cd  |
| --- | --- | --- | --- | --- | --- | --- |
|     | 1   | 2   | 3   | 4   | 5   | 6   |

#exam

## Test-Examenblock – alle Kartentypen (qa/tf/m1/m2/cl/cd)

1) QA (Antwort-Marker)
#card
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.
#
---
2) True/False (tf)
#card
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true
#
---
3) Multiple Choice – Single-Answer (m1)
#card
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b
#
---
4) Multiple Choice – Multi-Answer (m2)
#card
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
---
5) Cloze – Typed blanks (cl)
#card
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
6) Cloze – Drag tokens (cd)
#card
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#

#examend

---

## 📝 Test_n2.md — ./user/test/Test_n2.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)


#exam

## test n2 – n²: erst (typ+typ), dann jede Kombination einmal
## Regel: jede Kombination = 1 Aufgabe = 1x #card ... # (enthält beide Teilkarten)

### Kombinationsmatrix (Zelle = Positionsnummer in dieser Datei)
| n²  | qa  | tf  | m1  | m2  | cl  | cd  |
| --- | --- | --- | --- | --- | --- | --- |
| qa  | 1   | 7   | 8   | 9   | 10  | 11  |
| tf  |     | 2   | 12  | 13  | 14  | 15  |
| m1  |     |     | 3   | 16  | 17  | 18  |
| m2  |     |     |     | 4   | 19  | 20  |
| cl  |     |     |     |     | 5   | 21  |
| cd  |     |     |     |     |     | 6   |

---

1) qa + qa
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.
#
---
2) tf + tf
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true
#
---
3) m1 + m1
#card
[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b

[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b
#
---
4) m2 + m2
#card
[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c

[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
---
5) cl + cl
#card
[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.

[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
6) cd + cd
#card
[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#

---

7) qa + tf
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true
#
---
8) qa + m1
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b
#
---
9) qa + m2
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
---
10) qa + cl
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
11) qa + cd
#card
[qa]
Was bedeutet „Least Privilege“ im Kontext von IT-Sicherheit?
Antwort: Benutzer und Systeme erhalten nur die minimal notwendigen Rechte, um ihre Aufgabe zu erfüllen.

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
12) tf + m1
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b
#
---
13) tf + m2
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
---
14) tf + cl
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
15) tf + cd
#card
[tf]
Aussage:
„HTTPS verschlüsselt die Verbindung zwischen Client und Server.“
-true

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
16) m1 + m2
#card
[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b

[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c
#
---
17) m1 + cl
#card
[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b

[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
18) m1 + cd
#card
[m1]
Welche Zahl ist eine Primzahl?
a) 4
b) 5
c) 9
-b

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
19) m2 + cl
#card
[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.
#
---
20) m2 + cd
#card
[m2]
Welche Zahlen sind Primzahlen?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#
---
21) cl + cd
#card
[cl]
Die Hauptstadt von Frankreich ist %%Paris%%.

[cd]
Die Farben der deutschen Flagge sind `schwarz`, `rot` und `gold`.
#

#examend

---

## 📝 Testmatix.md — ./user/test/Testmatix.md

← Back to [FMDFlashcard/docs/user/examples/index.md](Examplesindex.md)
Ist Verhalten Bug Repro kombiecrads

| qa  | tf  | m1  | m2  | cl  | cd  |       |     |
| --- | --- | --- | --- | --- | --- | ----- | --- |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #exam |     |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #card |     |

| n²  | qa  | tf  | m1  | m2  | cl  | cd  |     | #exam |
| --- | --- | --- | --- | --- | --- | --- | --- | ----- |
| qa  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| tf  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| m1  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| m2  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cl  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cd  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cld | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| n²  | qa  | tf  | m1  | m2  | cl  | cd  | cld | #card |
| qa  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| tf  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| m1  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| m2  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cl  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cd  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |
| cld | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  |       |



---

## 📝 troubleshooting.md — ./user/troubleshooting.md

[← Back to Docs Home](../index.md)

# Troubleshooting

## The app shows “0 cards loaded”

- Confirm you selected the correct vault folder.
- Confirm your cards use the expected markers (see `flashcard-syntax.md`), or review `exam-syntax.md` if the file should be scanned as an exam.
- Rescan / reload the vault.

## Clicking a view shows no cards

- Make sure your current filter/box selection contains cards.
- Verify that the vault was fully scanned and indexing completed.

## UI looks off after updates

- Restart the app.
- If you recently changed theme/accent settings, toggle the theme and return to your preferred mode.

## Something is inconsistent between modes (Flashcard / Fast / Spaced)

- Reproduce the issue in a minimal example file.
- Open an issue and include:
  - a small example `#card` block,
  - which mode you used,
  - expected vs. actual behavior.

---

