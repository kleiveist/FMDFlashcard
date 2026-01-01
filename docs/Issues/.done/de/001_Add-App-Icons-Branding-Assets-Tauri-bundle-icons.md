# Add App Icons & Branding Assets (Tauri bundle icons)

## Context
The app scaffolding and MVP vault browser are working. Icons/branding are still using defaults.

## Goal
Provide a complete icon set and wire it into the Tauri bundle so the app shows the correct icon in:
- window title bar/task switcher
- desktop launcher (Linux)
- app bundle (Windows/macOS)

## Scope
- Create SVG source logo + export PNG/ICO/ICNS (or use Tauri icon tooling).
- Update Tauri config to point to the generated icons.
- Verify `tauri build` picks them up.

## Tasks
- [x] Create a single **source** logo (SVG) under `assets/brand/`.
- [x] Generate required icon sizes (Tauri icon set).
- [x] Place generated files in `apps/fmd-desktop/src-tauri/icons/`.
- [x] Update `apps/fmd-desktop/src-tauri/tauri.conf.json` (or v2 config) to reference icons.
- [?] Verify on Linux: `.desktop` entry shows icon (if applicable).
- [?] Run `pnpm tauri build` and confirm the produced bundle contains correct icons.

## Acceptance Criteria
- `pnpm tauri build` completes and the built app shows the new icon.
- No references to default Tauri icons remain in the bundle config.

## Notes
Tauri provides icon generation via `tauri icon <path-to-source>`.
