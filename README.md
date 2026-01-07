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
  Main documentation landing page with user and developer tracks.
- [User docs index](docs/user/index.md)  
  Overview of user docs, including workflows, syntax, and examples.
- [Getting started](docs/user/getting-started.md)  
  Step-by-step from choosing a vault to your first review mode.
- [Flashcard syntax](docs/user/flashcard-syntax.md)  
  How card blocks are structured and how composite cards work.
- [Examples](docs/user/examples/index.md)  
  Copy/paste-ready card blocks, formatting patterns, and workflows.
- [Spaced repetition](docs/user/spaced-repetition.md)  
  How spaced repetition works and how to build a daily routine.
- [Settings](docs/user/settings.md)  
  What each setting controls, including scan markers and performance.
- [Troubleshooting](docs/user/troubleshooting.md)  
  Fix common scanning and review issues quickly.

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
