# Gesamtinhalte – Root: /home/kleif/Projects/FMDFlashcard/docs

## 📝 0001-documentation-source-of-truth.md — ./adr/0001-documentation-source-of-truth.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](adr.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 adr.md — ./adr/adr.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->
[← Back](../index.md)

# ADR

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [ADR 0001: Documentation source of truth](0001-documentation-source-of-truth.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 architecture.md — ./dev/architecture.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 dev.md — ./dev/dev.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->

# DEV

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Architecture overview](architecture.md)
- 📝 [Control script (`tools/control.py`)](control-script.md)
- 📝 [Releases / Packaging](release.md)
- 📝 [Developer setup (run from source)](setup.md)
- 📝 [Testing](testing.md)

## 📁 TEST
- 🗂️ [Overview](test.md)
- 📝 [Test cld](test_cld.md)
- 📝 [Test cld tabel](test_cld_tabel.md)
- 📝 [Test n1](test_n1.md)
- 📝 [Test n2](test_n2.md)
- 📝 [Test table rendering](test/test_table_rendering.md)
- 📝 [Testmatix](test/testmatix.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 release.md — ./dev/release.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 test_cld_de.md — ./dev/test/.de/test_cld_de.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 test_cld_tabel_de.md — ./dev/test/.de/test_cld_tabel_de.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
#exam
1) CL (2 Spalten) – Tippe die passenden JOIN-Typen in die Tabelle.

| |   |
|---|---|
| Nur Zeilen mit Match in beiden Tabellen | %%INNER JOIN%% |
| Alle Zeilen links + passende rechts (sonst NULL) | %%LEFT JOIN%% |
| Alle Zeilen rechts + passende links (sonst NULL) | %%RIGHT JOIN%% |
| Alle Zeilen beider Seiten, Matches zusammen, sonst NULL | %%FULL OUTER JOIN%% |

---
2) CL (3 Spalten) – Tippe das richtige SQL-Keyword.

|   |   |   |
|---|---|---|
| Zeilen filtern (vor GROUP BY) | %%WHERE%% | SELECT * FROM users WHERE age > 18; |
| Gruppieren | %%GROUP BY%% | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Gruppen filtern (nach GROUP BY) | %%HAVING%% | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sortieren | %%ORDER BY%% | SELECT * FROM users ORDER BY created_at DESC; |
| Begrenzen | %%LIMIT%% | SELECT * FROM users ORDER BY id LIMIT 10; |

---
3) CD (2 Spalten) – Ziehe den richtigen JOIN in die rechte Zelle (Token-Bank).

|   |   |
|---|---|
| Nur Zeilen mit Match in beiden Tabellen | `INNER JOIN` |
| Alle Zeilen links + passende rechts (sonst NULL) | `LEFT JOIN` |
| Alle Zeilen rechts + passende links (sonst NULL) | `RIGHT JOIN` |
| Alle Zeilen beider Seiten, Matches zusammen, sonst NULL | `FULL OUTER JOIN` |

---
4) CD (3 Spalten) – Ziehe das passende Keyword in die mittlere Spalte.

|   |   |   |
|---|---|---|
| Zeilen filtern (vor GROUP BY) | `WHERE` | SELECT * FROM users WHERE age > 18; |
| Gruppieren | `GROUP BY` | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Gruppen filtern (nach GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sortieren | `ORDER BY` | SELECT * FROM users ORDER BY created_at DESC; |
| Begrenzen | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT 10; |

---
5) CLD (2 Spalten) – Drag Keyword + tippe die fehlenden Werte.

|   |   |
|---|---|
| Zeilen filtern | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sortieren | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Begrenzen | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
| Gruppieren | `GROUP BY` SELECT country, COUNT(*) FROM users GROUP BY %%country%%; |

---
6) CLD (3 Spalten) – Drag Keyword + tippe die fehlenden Werte im Beispiel.

|   |   |   |
|---|---|---|
| Zeilen filtern | `WHERE` | SELECT * FROM users WHERE age > %%18%%; |
| Gruppen filtern (nach GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > %%10%%; |
| Sortieren | `ORDER BY` | SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Begrenzen | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#examend

---

## 📝 test_n1_de.md — ./dev/test/.de/test_n1_de.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 test_n2_de.md — ./dev/test/.de/test_n2_de.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 test.md — ./dev/test/test_editor/test.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# TEST

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Test cld](test_cld.md)
- 📝 [Test cld tabel](test_cld_tabel.md)
- 📝 [Test n1](test_n1.md)
- 📝 [Test n2](test_n2.md)
- 📝 [Test table rendering](test_table_rendering.md)
- 📝 [Testmatix](testmatix.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 test_cld.md — ./dev/test/test_editor/test_cld.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
| n1  | qa  | tf  | m1  | m2  | cl  | cd  | cld |
| --- | --- | --- | --- | --- | --- | --- | --- |
| cld | 2   | 3   | 4   | 5   | 6   | 7   | 8   |

#exam

## n2 – Addition: all combinations with cld (each combination = 1x #card ... #)

2) qa + cld
#card
[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems are granted only the minimum necessary permissions to complete their task.

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
3) tf + cld
#card
[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
2) m1 + cld
#card
[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
5) m2 + cld
#card
[m2]
Which numbers are prime numbers?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
6) cl + cld
#card
[cl]
The capital of France is %%Paris%%.

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
7) cd + cld
#card
[cd]
The colors of the German flag are `black`, `red`, and `gold`.

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#
---
8) cld + cld
#card
[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.

[cld]
[cl] The capital of France is %%Paris%%.
[cd] The colors of the German flag are `black`, `red`, and `gold`.
#

#examend

---

## 📝 test_cld_tabel.md — ./dev/test/test_editor/test_cld_tabel.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
#exam
#card
1) CL (2 columns) – Type the correct JOIN types into the table.

| |   |
|---|---|
| Only rows with a match in both tables | %%INNER JOIN%% |
| All rows on the left + matching on the right (otherwise NULL) | %%LEFT JOIN%% |
| All rows on the right + matching on the left (otherwise NULL) | %%RIGHT JOIN%% |
| All rows from both sides, matches combined, otherwise NULL | %%FULL OUTER JOIN%% |

#
---
#card
2) CL (3 columns) – Type the correct SQL keyword.

|   |   |   |
|---|---|---|
| Filter rows (before GROUP BY) | %%WHERE%% | SELECT * FROM users WHERE age > 18; |
| Group | %%GROUP BY%% | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Filter groups (after GROUP BY) | %%HAVING%% | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sort | %%ORDER BY%% | SELECT * FROM users ORDER BY created_at DESC; |
| Limit | %%LIMIT%% | SELECT * FROM users ORDER BY id LIMIT 10; |

#
---
#card
3) CD (2 columns) – Drag the correct JOIN into the right cell (token bank).

|   |   |
|---|---|
| Only rows with a match in both tables | `INNER JOIN` |
| All rows on the left + matching on the right (otherwise NULL) | `LEFT JOIN` |
| All rows on the right + matching on the left (otherwise NULL) | `RIGHT JOIN` |
| All rows from both sides, matches combined, otherwise NULL | `FULL OUTER JOIN` |

#
---
#card
4) CD (3 columns) – Drag the appropriate keyword into the middle column.

|   |   |   |
|---|---|---|
| Filter rows (before GROUP BY) | `WHERE` | SELECT * FROM users WHERE age > 18; |
| Group | `GROUP BY` | SELECT country, COUNT(*) FROM users GROUP BY country; |
| Filter groups (after GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > 10; |
| Sort | `ORDER BY` | SELECT * FROM users ORDER BY created_at DESC; |
| Limit | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT 10; |

#
---
#card
5) CLD (2 columns) – Drag keyword + type the missing values.

|   |   |
|---|---|
| Filter rows | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sort | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Limit | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
| Group | `GROUP BY` SELECT country, COUNT(*) FROM users GROUP BY %%country%%; |

#
---
#card
6) CLD (3 columns) – Drag keyword + type the missing values in the example.

|   |   |   |
|---|---|---|
| Filter rows | `WHERE` | SELECT * FROM users WHERE age > %%18%%; |
| Filter groups (after GROUP BY) | `HAVING` | SELECT country, COUNT(*) FROM users GROUP BY country HAVING COUNT(*) > %%10%%; |
| Sort | `ORDER BY` | SELECT * FROM users ORDER BY created_at %%DESC%%; |
| Limit | `LIMIT` | SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#
#examend

---

## 📝 test_n1.md — ./dev/test/test_editor/test_n1.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->

| n1  | qa  | tf  | m1  | m2  | cl  | cd  |
| --- | --- | --- | --- | --- | --- | --- |
|     | 1   | 2   | 3   | 4   | 5   | 6   |

#exam

## Test exam block – all card types (qa/tf/m1/m2/cl/cd)

1) QA (answer marker)
#card
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.
#
---
2) True/False (tf)
#card
Statement:
“HTTPS encrypts the connection between client and server.”
-true
#
---
3) Multiple Choice – Single-Answer (m1)
#card
Which number is a prime number?
a) 4
b) 5
c) 9
-b
#
---
4) Multiple Choice – Multi-Answer (m2)
#card
Which numbers are prime numbers?
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
The capital of France is %%Paris%%.
#
---
6) Cloze – Drag tokens (cd)
#card
The colors of the German flag are `black`, `red` and `gold`.
#

#examend

---

## 📝 test_n2.md — ./dev/test/test_editor/test_n2.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->
#exam

## test n2 – n²: first (type+type), then each combination once
## Rule: each combination = 1 task = 1x #card ... # (contains both sub-cards)

### Combination matrix (cell = position number in this file)
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
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.
#
---
2) tf + tf
#card
[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true
#
---
3) m1 + m1
#card
[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b

[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b
#
---
4) m2 + m2
#card
[m2]
Which numbers are prime numbers?
a) 2
b) 4
c) 5
d) 9
-a
-c

[m2]
Which numbers are prime numbers?
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
The capital of France is %%Paris%%.

[cl]
The capital of France is %%Paris%%.
#
---
6) cd + cd
#card
[cd]
The colors of the German flag are `black`, `red` and `gold`.

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#

---

7) qa + tf
#card
[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true
#
---
8) qa + m1
#card
[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b
#
---
9) qa + m2
#card
[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[m2]
Which numbers are prime numbers?
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
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[cl]
The capital of France is %%Paris%%.
#
---
11) qa + cd
#card
[qa]
What does “least privilege” mean in the context of IT security?
Answer: Users and systems receive only the minimum privileges required to perform their task.

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#
---
12) tf + m1
#card
[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b
#
---
13) tf + m2
#card
[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[m2]
Which numbers are prime numbers?
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
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[cl]
The capital of France is %%Paris%%.
#
---
15) tf + cd
#card
[tf]
Statement:
“HTTPS encrypts the connection between client and server.”
-true

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#
---
16) m1 + m2
#card
[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b

[m2]
Which numbers are prime numbers?
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
Which number is a prime number?
a) 4
b) 5
c) 9
-b

[cl]
The capital of France is %%Paris%%.
#
---
18) m1 + cd
#card
[m1]
Which number is a prime number?
a) 4
b) 5
c) 9
-b

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#
---
19) m2 + cl
#card
[m2]
Which numbers are prime numbers?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cl]
The capital of France is %%Paris%%.
#
---
20) m2 + cd
#card
[m2]
Which numbers are prime numbers?
a) 2
b) 4
c) 5
d) 9
-a
-c

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#
---
21) cl + cd
#card
[cl]
The capital of France is %%Paris%%.

[cd]
The colors of the German flag are `black`, `red` and `gold`.
#

#examend

---

## 📝 test_markdown_rewrite.md — ./dev/test/test_markdown_rewrite.md

# 1) PreviewPanel Markdown Rewrite Repro (Testdatei)

Ziel: Diese Datei dient dazu, das Verhalten **„Markdown-Editor schließen ⇒ Datei wird umgeschrieben und bekommt zusätzliche Leerzeilen“** zuverlässig zu prüfen.

## Anleitung

1. Datei in der App öffnen.
2. In den **Markdown view (preview/editor)** wechseln.
3. **Nichts ändern** (kein Tippen).
4. Preview/Editor **schließen**.
5. Datei im Diff/Dateisystem prüfen: Wurden **zusätzliche Leerzeilen** eingefügt oder Absätze/Listen/Tabelle umformatiert?

---

## 1) Absätze & harte Zeilenumbrüche

Erste Zeile.
Zweite Zeile (direkt darunter, ohne Leerzeile).

Dritter Absatz (mit Leerzeile davor).

Vierter Absatz.

---

## 2) Mehrere Leerzeilen (sollten stabil bleiben)

Zwischen diesem Absatz

und diesem Absatz sind absichtlich **zwei** leere Zeilen.

---

## 3) Blockquote mit Leerzeilen

> Das ist eine Quote in Zeile 1.
>
> Das ist Quote Zeile 3 (mit leerer Quote-Zeile dazwischen).

---

## 4) Listen (verschachtelt, gemischt)

- Punkt A
- Punkt B
    - Unterpunkt B.1
    - Unterpunkt B.2

1. Nummeriert 1
2. Nummeriert 2
    - Unterpunkt 2.a
    - Unterpunkt 2.b

---

## 5) Inline-Formatierungen (Stern/Unterstrich/Tilde)

**Fett** und *kursiv* und ~~durchgestrichen~~.

Sonderzeichen-Test: a\_b \* c\_d ~~e~~ `inline code` und ein Backslash: \\

---

## 6) Links & Bilder (Link-Text / URL Roundtrip)

Ein normaler Link: [OpenAI](https://openai.com)

Ein Link mit Klammern in der URL:
[Test](https://example.com/path_(with)_parens)

Ein Bild (nur Syntax, muss nicht existieren):

---

## 7) Tabellen (Pipe-Escapes & Zelleninhalt)

| Spalte A | Spalte B | Spalte C |
| --- | --- | --- |
| normal | Text mit \| Pipe | Mehr   Spaces |
| `code` | **bold** | *italic* |
| Zeile mit  HTML | zweite Zelle | dritte Zelle |

---

## 8) Codeblöcke (Backticks, Fence-Länge, Leerzeilen)

````
// Codeblock Test
const x = "``` not a real fence inside string";
const y = "`inline` and **bold** in string";
console.log(x, y);
````

---

## 📝 test_table_rendering.md — ./dev/test/test_table_rendering.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->

#card

| Term | Answer |
| --- | --- |
| Alpha | %%first%% |
| Beta | `second` |
| Gamma | `third` and %%fourth%% |
#

#exam
1) Table in exam prompt (CL)

| Term | Answer |
| --- | --- |
| Alpha | %%first%% |
| Beta | %%second%% |

---
2) Table in exam prompt (CLD)

| Term | Answer |
| --- | --- |
| Alpha | `first` |
| Beta | `second` and %%third%% |


#card
1) Task (QA): Explain what “least privilege” means in access control. Use the context table below.

| Item | Role | Minimum access needed |
| --- | --- | --- |
| Read monthly report | Analyst | Read-only to reports folder |
| Deploy service | DevOps | Deploy permission to one environment |
| Update billing | Support | Write access to billing records only |

Answer: Least privilege means granting each user or process only the permissions required to perform its current task—no more—so that accidental misuse or compromise has limited impact.
#

#card
2) Task (TF): Decide whether the statement is true or false. Use the context table below.

| Term | Quick meaning |
| --- | --- |
| Star | Produces its own light via fusion |
| Planet | Orbits a star and does not produce light via fusion |

Statement: The Sun is a star.
-true
#

#card
3) Task (M1): Choose exactly one correct answer. Use the context table below.

| HTTP method | Typical intent |
| --- | --- |
| GET | Retrieve a resource |
| POST | Create or trigger processing |
| DELETE | Remove a resource |

Which HTTP method is typically used to retrieve (read) a resource?
a) POST
b) GET
c) DELETE
-b
#

#card
4) Task (M2): Choose all correct answers. Use the context table below.

| Permission class | Abbreviation |
| --- | --- |
| User (owner) | u |
| Group | g |
| Others | o |

Which are permission classes in classic Unix permissions?
a) User (owner)
b) Group
c) Others
d) Process
-a
-b
-c
#

#card
5) Task (CL): Fill in the blank(s). Use the context table below.

| Service | Default port |
| --- | --- |
| HTTP | 80 |
| HTTPS | 443 |

The default port for HTTPS is %%443%%.
#

#card
6) Task (CD): Complete the statement using the drag tokens. Use the context table below.

| OSI layer name | Layer number |
| -------------- | ------------ |
| Transport      | 4            |
| Network        | 3            |
| Data Link      | 2            |

In the OSI model, end-to-end delivery is handled by the `Transport` layer, which is layer `4`.
#

#card
7) Task (CD): Complete the statement using the drag tokens. Use the context table below.

| Protocol | Transport type |
| --- | --- |
| TCP | Connection-oriented |
| UDP | Connectionless |

`TCP` is connection-oriented, while `UDP` is connectionless.
#

#examend

---

## 📝 testmatix.md — ./dev/test/testmatix.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](test.md)
<!-- AUTO-GENERATED:backlink END -->

Ist Verhalten Bug Repro kombiecrads ✔️❌

| qa  | tf  | m1  | m2  | cl  | cd  | cld |       |
| --- | --- | --- | --- | --- | --- | --- | ----- |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #exam |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #card |

| n²  | qa  | tf  | m1  | m2  | cl  | cd  | cld | #exam |
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

Tabellen Ränderring  ✔️❌

| qa  | tf  | m1  | m2  | cl  | cd  | cld |       |
| --- | --- | --- | --- | --- | --- | --- | ----- |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #exam |
| ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | ✔️  | #card |

---

## 📝 testing.md — ./dev/testing.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Testing

## Running tests

If the project uses a monorepo layout, tests are typically run from the app workspace.

Examples (adjust to your workspace names):

```bash
# From repo root
pnpm -C apps/fmd-desktop test
```

If you only changed logic in one file, prefer running targeted tests to shorten feedback loops.
```q
DEV  v2.1.9 /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop  
  
✓ src/lib/exam.test.ts (15)  
✓ src/lib/flashcards.test.ts (40)  
✓ src/lib/seededShuffle.test.ts (3)  
✓ src/features/flashcards/logic.test.ts (5)  
✓ src/features/spaced-repetition/logic.test.ts (3)  
✓ src/pages/exam-simulation/components/ExamTaskRunner.test.ts (7)  
✓ src/pages/fast-flashcard/hooks/useFastSession.test.ts (1)  
  
Test Files  7 passed (7)  
     Tests  74 passed (74)  
  Start at  15:06:35  
  Duration  538ms (transform 548ms, setup 0ms, collect 963ms, tests 46ms, environment 1ms, prepare 1.21s)
```
## Expectations for pull requests

- Add or update tests when changing evaluation logic (e.g., composite cards, result summaries).
- Ensure lint and typechecks pass before requesting review.

## Table rendering checklist

- Flashcard tables render as real tables; non-token tables can scroll horizontally.
- Exam tasks keep table prompts intact inside `#exam` blocks.
- `cl`, `cd`, and `cld` tokens render inside table cells without scroll wrappers.
- `---` separators do not split cards or tasks when they appear inside table blocks.

---

## 📝 folderlist.md — ./folderlist.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
📁 docs
├── 📁 .summary
│   ├── 📝allsummary.md
│   ├── 📄 index.json
│   └── 📝summary.md
├── 📁 adr
│   ├── 📝0001-documentation-source-of-truth.md
│   └── 📝adr.md
├── 📁 dev
│   ├── 📁 test
│   │   ├── 📝test.md
│   │   ├── 📝test_cld.md
│   │   ├── 📝test_cld_tabel.md
│   │   ├── 📝test_n1.md
│   │   ├── 📝test_n2.md
│   │   └── 📝testmatix.md
│   ├── 📝architecture.md
│   ├── 📝control-script.md
│   ├── 📝dev.md
│   ├── 📝release.md
│   ├── 📝setup.md
│   └── 📝testing.md
├── 📁 issus
│   ├── 📝issus.md
│   ├── 📝issus_note.md
│   └── 📝issustabel.md
├── 📁 user
│   ├── 📁 examples
│   │   ├── 📝cd.md
│   │   ├── 📝cl.md
│   │   ├── 📝cld.md
│   │   ├── 📝e.md
│   │   ├── 📝ea.md
│   │   ├── 📝examples.md
│   │   ├── 📝examplestabel_de.md
│   │   ├── 📝examplestabel_en.md
│   │   ├── 📝f.md
│   │   ├── 📝m1.md
│   │   ├── 📝m2.md
│   │   ├── 📝qa.md
│   │   └── 📝tf.md
│   ├── 📝exam-syntax.md
│   ├── 📝flashcard-syntax.md
│   ├── 📝getting-started.md
│   ├── 📝settings.md
│   ├── 📝spaced-repetition.md
│   ├── 📝troubleshooting.md
│   └── 📝user.md
├── 📝index.md
└── 📝refactor-notes.md

---

## 📝 index.md — ./index.md

# Docs

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Folderlist](folderlist.md)
- 📝 [Refactor notes](refactor-notes.md)

## 📁 ADR
- 🗂️ [Overview](adr/adr.md)
- 📝 [ADR 0001: Documentation source of truth](adr/0001-documentation-source-of-truth.md)

## 📁 DEV
- 🗂️ [Overview](dev/dev.md)
- 📝 [Architecture overview](dev/architecture.md)
- 📝 [Control script (`tools/control.py`)](dev/control-script.md)
- 📝 [Releases / Packaging](dev/release.md)
- 📝 [Developer setup (run from source)](dev/setup.md)
- 📝 [Testing](dev/testing.md)

## 📁 Issus
- 🗂️ [Overview](issus/issus.md)
- 📝 [Issue Notes (Bug Report)](issus/issus_note.md)
- 📝 [Issustabel](issus/issustabel.md)

## 📁 USER
- 🗂️ [Overview](user/user.md)
- 📝 [Getting started](user/getting-started.md)
- 📝 [Settings](user/settings.md)
- 📝 [Spaced repetition](user/spaced-repetition.md)
- 📝 [Troubleshooting](user/troubleshooting.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 issus.md — ./issus/issus.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->
[← Back](../index.md)

# Issus

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Issue Notes (Bug Report)](issus_note.md)
- 📝 [Issustabel](issustabel.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 issus_note.md — ./issus/issus_note.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](issus.md)
<!-- AUTO-GENERATED:backlink END -->

# Issue Notes (Bug Report)

| Icon | Area                                   | Bug / Observation                                                                                                                                                                                                                                                                                                              | startus <br>🔵✔️ |     |
| ---- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | --- |
| 📝   | Markdown view (preview/editor)         | Closing the Markdown preview/editor rewrites files by inserting extra blank lines/paragraph breaks across the document, even if nothing was edited.                                                                                                                                                                            | ✔️               | #22 |
| 🔄   | Vault loading / refresh                | After vault reload, renamed files are not re-discovered and the folder tree stays stale, so the vault should rescan/update to find renamed files again.                                                                                                                                                                        | ✔️               | #26 |
| 🖱️  | Markdown tree context menu             | Right-click actions in the Markdown folder tree sometimes trigger a black backdrop and block “New File/New Folder,” likely due to a stuck overlay/focus trap.                                                                                                                                                                  | ✔️               | #22 |
| 📂   | Open path in system explorer           | “Open folder/path” does not launch the OS default file explorer.                                                                                                                                                                                                                                                               | ❔                | #22 |
| 🧩   | Open file with default editor          | “Open with default editor” does not launch the OS default editor.                                                                                                                                                                                                                                                              | ❔                | #22 |
| 🧱   | Wallet Directory context menu layering | The Wallet Directory context menu (GPT Filter/New File/New Folder/Open Data Folder) is covered by other UI blocks and must always appear in the foremost layer.                                                                                                                                                                | ✔️               | #22 |
| 🎨   | App theme / background                 | The background is still too bright and should be adjusted to a slightly greyer/darker tone.                                                                                                                                                                                                                                    |                  | #26 |
| ⚙️   | Settings                               | In Settings, the Markdown editor should get its own dedicated page (separate settings page/section instead of being embedded).                                                                                                                                                                                                 |                  | #22 |
| 🕶️  | App Settings                           | In the App Settings page, under “Vault” and “Index”, add a toggle for “Hidden folders” with 90 values/options (e.g., a selectable list or stepped control) to configure visibility behavior for hidden folders.                                                                                                                |                  | #26 |
| 📚   | Keyboard shortcuts (Docs)              | Provide a dedicated documentation page that lists **all keyboard shortcuts**, what each one does, and in which context it applies (global vs. Examen vs. Flashcards vs. Markdown editor). Example: the “eye” icon toggles Live Mode; document the shortcut to enable it (e.g., “Power”) and the shortcut to exit (e.g., “SK”). |                  | #28 |
| ⌨️   | Keyboard shortcuts (Settings)          | Add a Settings page to **view and customize** all keyboard shortcuts (rebinding). Must support: editing bindings, preventing/flagging conflicts, restoring defaults, and making changes discoverable (e.g., showing the current shortcut next to UI actions like Live Mode).                                                   |                  | #28 |

---

## 📝 issustabel.md — ./issus/issustabel.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](issus.md)
<!-- AUTO-GENERATED:backlink END -->

|   # | Titel                                                                                              |
| --: | -------------------------------------------------------------------------------------------------- |
|  27 | 📄 Master Documentation Issue: Markdown Syntax, Containers, Parts, and Scoring                     |
|  26 | 🐛 Master Bug Tracker (Umbrella Issue) — All Bug Reports & Triage Board                            |
|  25 | 🗃️ Structural Consolidation of the Codebase to Improve Clarity, Maintainability, and LLM Guidance |
|  24 | 🎓 Add Exam Mode with Automatic Evaluation                                                         |
|  23 | Redesign Dashboard as a True Central Dashboard                                                     |
|  22 | 📐 Implement Full-Fledged Markdown Editor and Consistent Markdown Rendering                        |
|  21 | UI Improvement in Smart Mode – Collapsible Tool Settings in Narrow Layout                          |

---

## 📝 refactor-notes.md — ./refactor-notes.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 cd.md — ./user/examples/cd.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 examples.md — ./user/examples/examples.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../user.md)
<!-- AUTO-GENERATED:backlink END -->

# Examples

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Code `cd`: Cloze (drag tokens)](cd.md)
- 📝 [Code `cl`: Cloze (typed blanks)](cl.md)
- 📝 [Code `cld`: Cloze (typed blanks + drag tokens)](cld.md)
- 📝 [Code `e`: Exam block container](e.md)
- 📝 [Code `ea`: Exam task block](ea.md)
- 📝 [Examplestabel de](examplestabel_de.md)
- 📝 [Examplestabel en](examplestabel_en.md)
- 📝 [Code `f`: Flashcard block container](f.md)
- 📝 [Code `m1`: Single-answer multiple choice](m1.md)
- 📝 [Code `m2`: Multi-answer multiple choice](m2.md)
- 📝 [Code `qa`: Answer marker (Q/A part)](qa.md)
- 📝 [Code `tf`: True/False marker (2-button card)](tf.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 examplestabel_de.md — ./user/examples/examplestabel_de.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->


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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->


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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

---

## 📝 tf.md — ./user/examples/tf.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](examples.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 getting-started.md — ./user/getting-started.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 dashboard.md — ./user/pages/dashboard.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Dashboard

## Purpose

The Dashboard is the home screen. It provides a high-level snapshot of your vault state, recent activity, and shortcuts into the main study modes.

## Main areas

- **Status cards:** Scan/index state, number of loaded cards, warnings or errors.
- **Quick actions:** Entry points into Flashcards, Fast Flashcard, Spaced Repetition, and Exams.
- **Recent items:** Recently opened files or last-used sessions (if enabled).

## Typical workflows

### Start a study session

1. Verify the vault is loaded (no scan errors).
2. Choose a mode (Flashcards, Fast Flashcard, Spaced Repetition, or Exams).
3. Optional: apply a filter or select a box (Spaced Repetition).
4. Begin reviewing and submit answers.

### Handle a vault inconsistency

1. If counts look wrong, open the Vault page.
2. Run a rescan/reload to rebuild the index.
3. If the issue persists, capture a minimal reproduction and report it.

## Notes / tips

- If counts look stale after file renames, a rescan is typically required.
- Prefer resolving scan/index warnings before long sessions.

## Related docs

- `../getting-started.md`
- `../troubleshooting.md`
- `../syntax/flashcard-syntax.md`

---

## 📝 exams.md — ./user/pages/exams.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Exams

## Purpose

The Exams page runs exam sessions authored in Markdown. Exams are wrapped in `#exam ... #examend` and consist of numbered tasks.

## Main areas

- **Exam selection:** Choose an exam source file/section.
- **Task list:** Detected tasks and status.
- **Task runner:** Runs the current task with the correct interaction widget(s).
- **Results:** Per-task grading output and overall summary.

## Typical workflows

### Run an exam session

1. Select an exam file/section.
2. Complete tasks in order; submit each task to record results.
3. Review final summary.

### Author a reliable exam file

1. Use `#exam` and `#examend` on their own lines.
2. Start each task with a number (1–20).
3. Prefer one interaction type per task; use composites only when needed.

## Related docs

- `../syntax/exam-syntax.md`
- `../syntax/table-rendering.md`

---

## 📝 fast-flashcard.md — ./user/pages/fast-flashcard.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Fast Flashcard

## Purpose

Fast Flashcard is a speed-focused review mode that minimizes UI friction and prioritizes quick iteration through cards.

## Main areas

- **Queue / ordering:** Choose in-order vs random and session size.
- **Card runner:** Lean UI for fast prompt → answer → next transitions.
- **Quick grading:** Fast correct/incorrect marking; optional reveal behavior.

## Typical workflows

### Quick daily drill

1. Choose a scope and ordering.
2. Start the session and answer quickly.
3. Mark correct/incorrect and move on.
4. Stop at the daily target.

## Related docs

- `../syntax/flashcard-syntax.md`

---

## 📝 flashcards.md — ./user/pages/flashcards.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Flashcards

## Purpose

The Flashcards page is the standard review mode. It loads flashcards found in your vault and presents them as interactive cards with scoring and progress tracking.

## Main areas

- **Deck / scope selector:** Choose the subset of cards to review (all cards, folder, tag, etc.).
- **Card viewer:** Prompt, interactive widgets, and reveal area.
- **Submission controls:** Submit, reveal, next card.
- **Session summary:** Correct/incorrect counts and optional metrics.

## Typical workflows

### Review composite cards

1. Answer each part inside the same `#card` block (parts may be separated by `---`).
2. Submit once for the whole card.
3. If a QA part is present, self-grade it if the UI requests manual confirmation.

## Notes / tips

- If a card renders unexpectedly, verify marker placement (`-true`, `-a`, `%%...%%`, backticks).

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/table-rendering.md`

---

## 📝 help-and-docs.md — ./user/pages/help-and-docs.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Help / Docs

## Purpose

The Help/Docs area surfaces the documentation shipped with the app so users can author and troubleshoot without opening the repository.

## Main areas

- **Docs navigation:** Browse user docs, examples, troubleshooting.
- **Search:** Search within docs (if supported).
- **Context links:** Links from UI features to relevant doc pages (ideal behavior).

## Typical workflows

### Find syntax quickly

1. Open Help/Docs.
2. Open Flashcard syntax or Exam syntax.
3. Open the relevant example (qa/tf/m1/m2/cl/cd/cld).
4. Copy and adapt the pattern.

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
- `../syntax/table-rendering.md`

---

## 📝 keyboard-shortcuts.md — ./user/pages/keyboard-shortcuts.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Keyboard shortcuts

## Purpose

This page documents the keyboard shortcuts supported by the app, what each shortcut does, and where it applies (global vs page-specific).

## Main areas

- **Global shortcuts:** Work across the app.
- **Study mode shortcuts:** Submit, reveal, next/prev during review.
- **Editor shortcuts:** Save, find, toggle preview inside the editor.

## Typical workflows

### Rebind shortcuts (if supported)

1. Open Settings → Shortcuts.
2. Change the binding for an action.
3. Resolve conflicts if warned.
4. Test the new binding in the target context.

## Related docs

- `../settings.md`

---

## 📝 markdown-editor.md — ./user/pages/markdown-editor.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Markdown Editor

## Purpose

The Markdown Editor is used to view and edit `.md` files inside the app. It should preserve formatting and avoid rewriting content unless you explicitly edit it.

## Main areas

- **Editor pane:** Text editing and syntax highlighting.
- **Preview pane:** Rendered Markdown preview consistent with study views.
- **File actions:** Save and open actions (if supported).
- **Tree context menu:** Right-click actions in the Markdown folder tree (New File/New Folder/Open actions), with correct focus and layering.

## Known issues / troubleshooting

### Markdown tree context menu shows a black backdrop and blocks actions

**Symptom**
- Right-click actions in the Markdown folder tree sometimes trigger a black backdrop and block actions such as **New File** / **New Folder**.

**Likely cause**
- A stuck overlay or focus trap (e.g., an unclosed popover/modal layer capturing pointer events).

**What to do**
1. Click once inside the main app area (not inside the backdrop) and try the context menu again.
2. If the issue persists, close any open popovers/menus (Esc) and retry.
3. Capture a screenshot and note:
   - OS + version
   - app version
   - where you clicked (folder vs file node)
   - whether a menu/overlay was already open

### “Open folder/path” does not launch the OS system explorer

**Symptom**
- **Open path in system explorer** does not open Finder/Explorer (or the platform default file manager).

**Notes**
- Treat this as a platform integration issue (shell open path).
- Capture OS + version and the exact path type (file vs folder; local vs network path).

### “Open with default editor” does not launch the OS default editor

**Symptom**
- **Open with default editor** does not open the configured OS default application for `.md` files.

**Notes**
- Treat this as a platform integration issue (shell open file with default app).
- Capture OS + version and the file path (including whether it is inside the selected vault).

### Wallet Directory context menu is covered by other UI blocks

**Symptom**
- The Wallet Directory context menu (e.g., GPT Filter / New File / New Folder / Open Data Folder) appears behind other UI blocks and cannot be clicked reliably.

**Expected**
- Context menus must always appear in the foremost layer above all other panels.

**What to capture**
- Screenshot showing the menu being covered.
- Which panel is covering it (tree, editor, preview, etc.).
- Whether the app is in a narrow layout or split-view mode.

## Typical workflows

### Edit a card safely

1. Open the note that contains the card.
2. Edit only inside markers.
3. Save and rescan if needed.
4. Verify the card in Flashcards/Exams.

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`

---

## 📝 pages.md — ./user/pages/pages.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../user.md)
<!-- AUTO-GENERATED:backlink END -->

# Pages

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Dashboard](dashboard.md)
- 📝 [Exams](exams.md)
- 📝 [Fast Flashcard](fast-flashcard.md)
- 📝 [Flashcards](flashcards.md)
- 📝 [Help / Docs](help-and-docs.md)
- 📝 [Keyboard shortcuts](keyboard-shortcuts.md)
- 📝 [Markdown Editor](markdown-editor.md)
- 📝 [Settings](settings.md)
- 📝 [Spaced Repetition](spaced-repetition.md)
- 📝 [Vault](vault.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 settings.md — ./user/pages/settings.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Settings

## Purpose

Settings control how the app scans the vault, renders content, and runs study modes. Prefer defaults unless you have a concrete reason to change behavior.

## Main areas

- **Vault & index:** Scan markers, indexing behavior, performance toggles.
- **Study modes:** Ordering, reveal behavior, scoring preferences.
- **Editor & rendering:** Markdown preview behavior, table rendering options.
- **Shortcuts:** View or rebind keyboard shortcuts (if supported).

## Typical workflows

### Change scan markers safely

1. Change only one option at a time.
2. Rescan the vault.
3. Verify expected card/exam counts.

## Related docs

- `../settings.md`

---

## 📝 spaced-repetition.md — ./user/pages/spaced-repetition.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Spaced Repetition

## Purpose

Spaced Repetition schedules cards over time using boxes/levels. Cards move forward on correct answers and may move back on incorrect answers.

## Main areas

- **Box / level selection:** Choose which box(es) to review, or use the scheduled set.
- **Session configuration:** Daily limits, ordering, pull rules.
- **Review runner:** Interactive card view with box movement feedback.
- **Progress tracking:** Distribution across boxes and performance.

## Typical workflows

### Standard SR review

1. Pick a box (or scheduled set).
2. Review cards and submit answers.
3. Cards move forward/back based on correctness.
4. Stop at the configured limit.

## Notes / tips

- If box counts include missing cards after renames, run a vault rescan and reconcile card IDs if the app supports it.

## Related docs

- `../spaced-repetition.md`
- `../troubleshooting.md`

---

## 📝 vault.md — ./user/pages/vault.md

# Vault

## Purpose

The Vault page manages your local Markdown vault: selecting the folder, scanning for cards and exams, maintaining the index, and browsing the folder tree.

## Main areas

- **Vault selector:** Choose or change the vault root folder.
- **Active vault badge (🔄):** Refresh/rescan the currently selected vault from disk to pick up renamed/moved files and rebuild the folder tree and index.
- **Folder tree:** Browse and open Markdown files; file/folder actions (if supported).
- **Scan / index controls:** Rescan, reload, and indexing progress.
- **Filters:** Search/tags and other view filters (implementation-dependent).

## Typical workflows

### Load a vault for the first time

1. Open Vault.
2. Select the vault root folder that contains your `.md` notes.
3. Run the initial scan and wait for indexing to complete.
4. Open a file from the tree to verify parsing is correct.

### Rescan after refactors

1. After renames/moves, click **🔄 refresh** (or use other rescan controls, if available).
2. Confirm the folder tree reflects the filesystem state (renamed files appear under the new name; old entries disappear).
3. Re-check card/exam counts in the study modes to ensure the index is consistent.

## Notes / tips

- If “Open folder/path” does not launch the system explorer, treat it as a UI integration issue and capture OS + version.
- If the folder tree looks stale after renames/moves, use **🔄 refresh** to force a full rescan from disk (not just a soft reload of cached data).

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
- `../troubleshooting.md`

---

## 📝 settings.md — ./user/settings.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
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

<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 exam-syntax.md — ./user/syntax/exam-syntax.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](syntax.md)
<!-- AUTO-GENERATED:backlink END -->
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
- If your tasks include tables, follow `table-rendering.md` for the table syntax and layout rules.

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

## 📝 flashcard-syntax.md — ./user/syntax/flashcard-syntax.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](syntax.md)
<!-- AUTO-GENERATED:backlink END -->
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
- For tables inside card prompts or answers, follow `table-rendering.md` (pipe tables, layout rules, token constraints).

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

## 📝 syntax.md — ./user/syntax/syntax.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../user.md)
<!-- AUTO-GENERATED:backlink END -->


# Syntax

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Exam syntax](exam-syntax.md)
- 📝 [Flashcard syntax reference](flashcard-syntax.md)
- 📝 [Tables in Flashcards and Exams](table-rendering.md)

<!-- AUTO-GENERATED:docs-index END -->

---

## 📝 table-rendering.md — ./user/syntax/table-rendering.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](syntax.md)
<!-- AUTO-GENERATED:backlink END -->
# Tables in Flashcards and Exams

## Purpose

Tables in FMDFlashcard are primarily a **layout tool**: they let you structure prompts and answers in a clear grid without changing the learning logic. This applies to:

- `#card` blocks (flashcards)
- `#exam … #examend` blocks (exam tasks)

Important: A table is **presentation only**. Evaluation (e.g., Cloze typed blanks and drag tokens) behaves the same as in normal text.

## Supported table syntax

FMDFlashcard renders tables written in **Markdown pipe-table** format. In most Markdown renderers, a table requires:

1) a header row
2) a separator row using `---`

If you do **not** want visible headings, use an **empty header**:


|   |   |
|---|---|
| A | B |

## Rules for stable rendering
- Each table row must have the **same number of columns**.
- Use `|` only as a table delimiter (avoid using `|` as normal text inside cells).
- For line breaks inside a cell, prefer `<br>` instead of empty lines.
- Segment separators (`---`) are ignored inside table blocks, but keep them outside table rows to avoid ambiguity.
## Layout behavior and scrolling
### Card height
- Flashcards that render tables **auto-expand in height** to fit the content.
- Therefore, flashcards should **not** require vertical scrolling
### Horizontal behavior
- Cards should **adapt to the available width** of the content area.
- If a table becomes too wide to remain readable, the UI may provide a **horizontal scrollbar** as a fallback.
### Important constraint for token cards
- Cards that contain **interactive tokens/blanks** (e.g., `cd`, `cl`, `cld`) must **not** be placed inside scrollable containers.  
    Scrollable containers tend to cause drag/drop and focus bugs.
- This is acceptable because token tables are limited in practice (typically **max. 3 columns**) and should fit the card layout without needing scrolling.
## Interactive content inside table cells
### CL (typed blanks) in tables
Typed blanks are marked with `%%...%%` and can appear inside any table cell.
```q
#card
|   |   |
|---|---|
| Only rows with matches in both tables | %%INNER JOIN%% |
| All rows from the left + matching right rows | %%LEFT JOIN%% |
#
```
### CD (drag tokens) in tables

Drag tokens are marked with backticks (e.g., `` `WHERE` ``) and can be placed in table cells.
```q
#card
|   |   |
|---|---|
| Filter rows | `WHERE` |
| Sort results | `ORDER BY` |
#
```
### CLD (typed blanks + drag tokens) in tables

Combination of drag tokens and typed blanks inside table cells.
```q
#card
|   |   |
|---|---|
| Filter | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Limit  | `LIMIT` SELECT * FROM users ORDER BY id LIMIT %%10%%; |
#
```
## Tables inside exam blocks

Tables can also be part of an exam prompt within `#exam`.

```q
#exam
1) Fill in JOIN types (CL)
|   |   |
|---|---|
| Only matches in both tables | %%INNER JOIN%% |
| All left rows + matching right rows | %%LEFT JOIN%% |

---
2) Drag + type (CLD)
|   |   |
|---|---|
| Filter | `WHERE` SELECT * FROM users WHERE age > %%18%%; |
| Sort   | `ORDER BY` SELECT * FROM users ORDER BY created_at %%DESC%%; |
#examend

```
## Troubleshooting

### Table is not rendered as a table
- Confirm that the header row and separator row exist (`|...|...|` and `|---|---|`).
- Confirm that every row has the same number of columns.
### Layout breaks in narrow windows
- The card should adapt to the available width.
- If the table becomes unreadable, the UI may fall back to a horizontal scrollbar for the rendered card.
- If neither adaptive layout nor horizontal scrolling works, this is a UI bug.
### Tokens/blanks do not work inside table cells
- This is a rendering/UI issue. The syntax is valid.
- Please create an issue and include a minimal reproduction card (the smallest possible example that still fails).

---

## 📝 troubleshooting.md — ./user/troubleshooting.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](user.md)
<!-- AUTO-GENERATED:backlink END -->
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

## 📝 user.md — ./user/user.md

<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->


# USER

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Getting started](getting-started.md)
- 📝 [Settings](settings.md)
- 📝 [Spaced repetition](spaced-repetition.md)
- 📝 [Troubleshooting](troubleshooting.md)

## 📁 Examples
- 🗂️ [Overview](examples/examples.md)
- 📝 [Code `cd`: Cloze (drag tokens)](examples/cd.md)
- 📝 [Code `cl`: Cloze (typed blanks)](examples/cl.md)
- 📝 [Code `cld`: Cloze (typed blanks + drag tokens)](examples/cld.md)
- 📝 [Code `e`: Exam block container](examples/e.md)
- 📝 [Code `ea`: Exam task block](examples/ea.md)
- 📝 [Examplestabel de](examples/examplestabel_de.md)
- 📝 [Examplestabel en](examples/examplestabel_en.md)
- 📝 [Code `f`: Flashcard block container](examples/f.md)
- 📝 [Code `m1`: Single-answer multiple choice](examples/m1.md)
- 📝 [Code `m2`: Multi-answer multiple choice](examples/m2.md)
- 📝 [Code `qa`: Answer marker (Q/A part)](examples/qa.md)
- 📝 [Code `tf`: True/False marker (2-button card)](examples/tf.md)

## 📁 Pages
- 🗂️ [Overview](pages/pages.md)
- 📝 [Dashboard](pages/dashboard.md)
- 📝 [Exams](pages/exams.md)
- 📝 [Fast Flashcard](pages/fast-flashcard.md)
- 📝 [Flashcards](pages/flashcards.md)
- 📝 [Help / Docs](pages/help-and-docs.md)
- 📝 [Keyboard shortcuts](pages/keyboard-shortcuts.md)
- 📝 [Markdown Editor](pages/markdown-editor.md)
- 📝 [Settings](pages/settings.md)
- 📝 [Spaced Repetition](pages/spaced-repetition.md)
- 📝 [Vault](pages/vault.md)

## 📁 Syntax
- 🗂️ [Overview](syntax/syntax.md)
- 📝 [Exam syntax](syntax/exam-syntax.md)
- 📝 [Flashcard syntax reference](syntax/flashcard-syntax.md)
- 📝 [Tables in Flashcards and Exams](syntax/table-rendering.md)

<!-- AUTO-GENERATED:docs-index END -->

---

