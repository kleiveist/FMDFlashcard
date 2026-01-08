[← Back to Docs Home](docs/index.md)

# FMDFlashcard

Local-first, Markdown-based flashcards with built-in learning modes (including spaced repetition).

The project is designed to work with existing Markdown notes (similar in spirit to an Obsidian-style vault),
while adding a dedicated review experience and study progress tracking.

## What you can do

- Use your existing Markdown files as the source of truth for learning content.
- Extract flashcards from Markdown using simple, readable markers.
- Review cards in multiple modes (e.g., standard flashcards, fast mode, spaced repetition).
- Keep your learning workflow local-first.

> Note: The UX and feature set are evolving. If something is unclear, check the in-app Help and the docs in [docs](docs/).

## Documentation index (fast links)

If GitHub’s repository navigation feels slow, use these direct links:

## Pages
- [Refactor notes](refactor-notes.md)

## ADR
- [Overview](adr/adr.md)
- [ADR 0001: Documentation source of truth](adr/0001-documentation-source-of-truth.md)

## DEV
- [Overview](dev/dev.md)
- [Architecture overview](dev/architecture.md)
- [Control script (`tools/control.py`)](dev/control-script.md)
- [Releases / Packaging](dev/release.md)
- [Developer setup (run from source)](dev/setup.md)
- [Testing](dev/testing.md)

## Issus
- [Overview](issus/issus.md)
- [Issustabel](issus/issustabel.md)

## Latex
- [Overview](latex/latex.md)

## USER
- [Overview](user/user.md)
- [Exam syntax](user/exam-syntax.md)
- [Flashcard syntax reference](user/flashcard-syntax.md)
- [Getting started](user/getting-started.md)
- [Settings](user/settings.md)
- [Spaced repetition](user/spaced-repetition.md)
- [Troubleshooting](user/troubleshooting.md)

## Quickstart (run from source)

If you want to run the desktop app from source, follow the full setup guide:

A typical flow looks like:

1. Clone this repo
2. `python3 tools/control.py --doctor`
3. `python3 tools/control.py --install`
4. `python3 tools/control.py --tauri`
5. `python3 tools/control.py --start`


## Contributing

See the [Contributing guide](CONTRIBUTING.md) for development workflow and pull request guidelines.

## License

See [License](LICENSE) (if present in this repository).
