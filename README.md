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

### User docs
- [Docs home](docs/index.md)
- [User docs index](docs/user/index.md)
- [Getting started](docs/user/getting-started.md)
- [Flashcard syntax](docs/user/flashcard-syntax.md)
- [Spaced repetition](docs/user/spaced-repetition.md)
- [Settings](docs/user/settings.md)
- [Troubleshooting](docs/user/troubleshooting.md)

### Developer docs
- [Developer docs index](docs/dev/index.md)
- [Setup (run from source)](docs/dev/setup.md)
- [Control script](docs/dev/control-script.md)
- [Architecture](docs/dev/architecture.md)
- [Testing](docs/dev/testing.md)
- [Releases / packaging](docs/dev/release.md)

### Project meta
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Security policy](SECURITY.md)
- [ADR index](docs/adr/index.md)


## Quickstart (run from source)

If you want to run the desktop app from source, follow the full setup guide:

- **Developer setup:** [Setup guide](docs/dev/setup.md)
- **Control script guide:** [Control script guide](docs/dev/control-script.md)

A typical flow looks like:

1. Clone this repo
2. `python3 tools/control.py --doctor`
3. `python3 tools/control.py --install`
4. `python3 tools/control.py --tauri`
5. `python3 tools/control.py --start`

## Documentation

- **Docs home:** [Documentation index](docs/index.md)
- **User docs:** [User documentation](docs/user/)
- **Developer docs:** [Developer documentation](docs/dev/)
- **Architecture decisions:** [ADRs](docs/adr/)

## Contributing

See the [Contributing guide](CONTRIBUTING.md) for development workflow and pull request guidelines.

## License

See [License](LICENSE) (if present in this repository).
