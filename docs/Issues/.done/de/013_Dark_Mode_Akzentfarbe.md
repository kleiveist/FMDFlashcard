## Issue 013: Implement Light/Dark Mode + Accent Color Settings (Theme UI + Color Picker) 🌗🎨

### Context

The app runs reliably in dev mode. Visual customization is still missing (theme + accent color), which is important for UX and branding.

### Goal

In **Settings**, users can:

1. Toggle **Light** / **Dark** mode (switch),
2. Choose an **accent color** (color picker + palettes + color wheel),
3. See the **HEX value** (`#RRGGBB`) and optionally edit it,
4. Have all changes **persisted** and restored on startup.

### Scope

* Extend Settings UI (left column):

  * Info/link text explaining appearance settings
  * Accent color: picker field + predefined palette chips + color wheel + HEX display
  * Theme: Light/Dark switch + short explanation text + simple “On/Off” toggle button (if you want both)
* Technical:

  * Theme and accent color applied via **CSS variables** (recommended) or a small theming layer
  * Persistence via existing settings storage (Tauri Store plugin or current settings mechanism)

### Tasks

* [ ] **Settings UI**

  * [ ] Add “Appearance” section in `Settings.tsx`
  * [ ] Accent color: color wheel picker + palette chips
  * [ ] Show HEX value (`#RRGGBB`) + optional copy button
  * [ ] Theme switch (Light/Dark) + short explanatory text
  * [ ] Optional: extra “On/Off” button (if required; otherwise the switch alone is enough)
* [ ] **Theme Implementation**

  * [ ] Define global CSS variables (e.g., `--bg`, `--fg`, `--accent`)
  * [ ] Apply theme using `data-theme="light|dark"` on the root element (or class-based)
* [ ] **Accent Color Application**

  * [ ] Store the chosen accent color in `--accent`
  * [ ] Use accent color consistently for buttons/links/active states
* [ ] **Persistence**

  * [ ] Save `settings.theme` and `settings.accentColor`
  * [ ] Load and apply on app startup (as early as possible)
* [ ] **Validation/UX**

  * [ ] Validate HEX input (`#RRGGBB` only)
  * [ ] Fallback to defaults if invalid

### Acceptance Criteria

* Users can switch Light/Dark and the UI updates immediately.
* Users can select accent color via wheel or palette; HEX is displayed.
* Accent color is applied to key UI elements (at least buttons/links/active selection).
* After restart, theme and accent color are restored correctly.

### Notes

Prefer integrating with the existing settings persistence rather than introducing a second system.

---