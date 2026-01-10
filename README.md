
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
<!-- AUTO-GENERATED:docs-index START -->

## 📄 Files
- 📝 [Changelog](CHANGELOG.md)
- 📝 [Contributing](CONTRIBUTING.md)
- 📝 [Security Policy](SECURITY.md)

# DOCS
- 📚 [Docs Home](docs/index.md)
- 📝 [Folderlist](docs/folderlist.md)
- 📝 [Refactor notes](docs/refactor-notes.md)

## 📁 ADR
- 🗂️ [Overview](docs/adr/adr.md)
- 📝 [ADR 0001: Documentation source of truth](docs/adr/0001-documentation-source-of-truth.md)

## 📁 DEV
- 🗂️ [Overview](docs/dev/dev.md)
- 📝 [Architecture overview](docs/dev/architecture.md)
- 📝 [Control script (`tools/control.py`)](docs/dev/control-script.md)
- 📝 [Releases / Packaging](docs/dev/release.md)
- 📝 [Developer setup (run from source)](docs/dev/setup.md)
- 📝 [Testing](docs/dev/testing.md)

## 📁 Issus
- 🗂️ [Overview](docs/issus/issus.md)
- 📝 [Issue Notes (Bug Report)](docs/issus/issus_note.md)
- 📝 [Issustabel](docs/issus/issustabel.md)

## 📁 USER
- 🗂️ [Overview](docs/user/user.md)
- 📝 [Getting started](docs/user/getting-started.md)
- 📝 [Settings](docs/user/settings.md)
- 📝 [Spaced repetition](docs/user/spaced-repetition.md)
- 📝 [Troubleshooting](docs/user/troubleshooting.md)

<!-- AUTO-GENERATED:docs-index END -->

If GitHub’s repository navigation feels slow, use these direct links:

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
