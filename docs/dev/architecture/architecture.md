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
