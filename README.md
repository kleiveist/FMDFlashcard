# FMDFlashcard

Local-first, Markdown-based flashcards with built-in learning modes (including spaced repetition).

The project is designed to work with existing Markdown notes (similar in spirit to an Obsidian-style vault),
while adding a dedicated review experience and study progress tracking.

## What you can do

- Use your existing Markdown files as the source of truth for learning content.
- Extract flashcards from Markdown using simple, readable markers.
- Review cards in multiple modes (e.g., standard flashcards, fast mode, spaced repetition).
- Keep your learning workflow local-first.

> Note: The UX and feature set are evolving. If something is unclear, check the in-app Help and the docs in `docs/`.

## Quickstart (run from source)

If you want to run the desktop app from source, follow the full setup guide:

- **Developer setup:** `docs/dev/setup.md`
- **Control script guide:** `docs/dev/control-script.md`

A typical flow looks like:

1. Clone this repo
2. `python3 tools/control.py --doctor`
3. `python3 tools/control.py --install`
4. `python3 tools/control.py --tauri`
5. `python3 tools/control.py --start`

## Documentation

- **Docs home:** `docs/index.md`
- **User docs:** `docs/user/`
- **Developer docs:** `docs/dev/`
- **Architecture decisions:** `docs/adr/`

## Contributing

See `CONTRIBUTING.md` for development workflow and pull request guidelines.

## License

See `LICENSE` (if present in this repository).
