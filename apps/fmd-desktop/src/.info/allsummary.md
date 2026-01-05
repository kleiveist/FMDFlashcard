# Gesamtinhalte – Root: /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop/src

## 📝 App.css — ./App.css

:root {
  font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
  font-size: 16px;
  line-height: 1.5;
  font-weight: 400;
  color: var(--ink);
  background-color: var(--bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color-scheme: light;
  --bg: #f3efe6;
  --bg-strong: #ece6da;
  --panel: #ffffff;
  --panel-warm: #f8f2e8;
  --ink: #141717;
  --muted: #5b6265;
  --line: rgba(18, 24, 27, 0.12);
  --line-soft: rgba(18, 24, 27, 0.08);
  --accent: #e07a5f;
  --accent-strong: #cc5c3f;
  --accent-soft: rgba(224, 122, 95, 0.14);
  --accent-highlight: #f2cc8f;
  --accent-border: rgba(224, 122, 95, 0.35);
  --accent-contrast: #1a1a1a;
  --accent-contrast-strong: #ffffff;
  --shadow: 0 20px 40px rgba(19, 26, 28, 0.1);
  --shadow-soft: 0 12px 24px rgba(19, 26, 28, 0.08);
  --mono: "JetBrains Mono", "Fira Code", "IBM Plex Mono", monospace;
  --bg-gradient: radial-gradient(
    circle at top left,
    #f7dccb 0%,
    #f3efe6 45%,
    #e6f0ee 100%
  );
  --preview-bg: #111616;
  --preview-ink: #f5f1e6;
  --preview-code-bg: rgba(255, 255, 255, 0.08);
  --preview-code-border: rgba(255, 255, 255, 0.16);
  --chip-bg: rgba(20, 23, 23, 0.06);
  --glow: radial-gradient(circle, rgba(47, 143, 131, 0.18), transparent 70%);
  --error-bg: rgba(204, 92, 63, 0.12);
  --error-border: rgba(204, 92, 63, 0.3);
  --error-ink: #7a2e1c;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1417;
  --bg-strong: #121a1f;
  --panel: #151c20;
  --panel-warm: #1b2429;
  --ink: #edf2f4;
  --muted: #a3abb0;
  --line: rgba(237, 242, 244, 0.16);
  --line-soft: rgba(237, 242, 244, 0.1);
  --shadow: 0 20px 40px rgba(0, 0, 0, 0.45);
  --shadow-soft: 0 12px 24px rgba(0, 0, 0, 0.3);
  --bg-gradient: radial-gradient(
    circle at top left,
    #1b2a33 0%,
    #0f1417 55%,
    #0b1012 100%
  );
  --preview-bg: #0b0f12;
  --preview-ink: #e7edf0;
  --preview-code-bg: rgba(255, 255, 255, 0.12);
  --preview-code-border: rgba(255, 255, 255, 0.24);
  --chip-bg: rgba(237, 242, 244, 0.08);
  --glow: radial-gradient(circle, rgba(224, 122, 95, 0.18), transparent 70%);
  --error-bg: rgba(204, 92, 63, 0.2);
  --error-border: rgba(204, 92, 63, 0.45);
  --error-ink: #f6c1b2;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--bg-gradient);
  color: var(--ink);
}

#root {
  min-height: 100vh;
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.app-shell {
  position: relative;
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  padding: 24px;
  min-height: 100vh;
  animation: riseIn 0.6s ease both;
}

.app-shell.sidebar-collapsed {
  grid-template-columns: 52px 1fr;
}

.app-shell.dashboard-active {
  height: 100vh;
  grid-template-rows: minmax(0, 1fr);
}

.app-shell.dashboard-active .content {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-shell::before {
  content: "";
  position: absolute;
  inset: 32px 40px auto auto;
  width: 240px;
  height: 240px;
  background: var(--glow);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.app-shell > * {
  position: relative;
  z-index: 1;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: var(--panel);
  border-radius: 24px;
  padding: 24px;
  box-shadow: var(--shadow);
  border: 1px solid var(--line-soft);
}

.sidebar.collapsed {
  padding: 12px 8px;
  gap: 0;
  align-items: center;
  justify-content: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  background: linear-gradient(140deg, var(--accent), var(--accent-highlight));
  color: var(--accent-contrast);
  display: grid;
  place-items: center;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
}

.sidebar-rail {
  width: 100%;
  min-height: 180px;
  border: none;
  background: transparent;
  color: var(--ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  border-radius: 16px;
  transition: 0.2s ease;
}

.sidebar-rail:hover {
  background: var(--panel-warm);
  color: var(--accent-strong);
}

.sidebar-rail:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 4px;
}

.rail-arrow {
  font-size: 1.2rem;
  font-weight: 700;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brand-title {
  font-size: 1.1rem;
  font-weight: 700;
}

.brand-sub {
  font-size: 0.85rem;
  color: var(--muted);
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.nav-item {
  border: 1px solid transparent;
  background: transparent;
  color: var(--ink);
  padding: 12px 16px;
  border-radius: 14px;
  text-align: left;
  font-weight: 600;
  transition: 0.2s ease;
  cursor: pointer;
}

.nav-item:hover {
  background: var(--panel-warm);
}

.nav-item.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.nav-item-help {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.nav-subtext {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--muted);
}

.nav-item.active .nav-subtext {
  color: var(--accent-strong);
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

.vault-status {
  flex: 1;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.vault-status:hover {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.vault-status:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.nav-icon {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  display: grid;
  place-items: center;
  color: var(--ink);
  cursor: pointer;
  transition: 0.2s ease;
}

.nav-icon:hover {
  border-color: var(--accent-border);
  color: var(--accent);
}

.nav-icon.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.nav-icon svg {
  width: 20px;
  height: 20px;
}

.sidebar-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background: var(--panel-warm);
  border-radius: 16px;
  border: 1px solid var(--line-soft);
}

.label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  color: var(--muted);
}

.value {
  font-weight: 700;
}

.active-user-button {
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}

.active-user-button:not(:disabled):hover {
  color: var(--accent-strong);
  text-decoration: underline;
}

.active-user-button:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
  border-radius: 6px;
}

.active-user-button:disabled {
  color: var(--muted);
  cursor: not-allowed;
}

.path {
  font-size: 0.85rem;
  color: var(--muted);
  word-break: break-all;
}

button {
  border: none;
  font: inherit;
}

.primary,
.ghost {
  padding: 12px 18px;
  border-radius: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s ease;
}

.primary {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--shadow-soft);
}

.primary:hover {
  background: var(--accent-strong);
  color: var(--accent-contrast-strong);
}

.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  box-shadow: none;
}

.ghost {
  background: transparent;
  border: 1px dashed var(--line);
  color: var(--ink);
}

.ghost:hover {
  border-color: var(--accent-strong);
  color: var(--accent-strong);
}

.ghost:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost.small.active {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.ghost.small {
  padding: 8px 12px;
  font-size: 0.85rem;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: riseIn 0.6s ease both;
  animation-delay: 0.05s;
}

.mobile-nav-header {
  display: none;
  align-items: center;
  justify-content: flex-start;
}

.mobile-nav-toggle {
  align-self: flex-start;
}

.mobile-nav-backdrop {
  position: fixed;
  inset: 0;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(10, 12, 16, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 25;
}

.mobile-nav-close {
  display: none;
  margin-left: auto;
  border: 1px solid var(--line-soft);
  background: transparent;
  color: var(--ink);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 0.75rem;
  cursor: pointer;
}

.mobile-nav-close:hover {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.content-header {
  display: flex;
  justify-content: space-between;
  gap: 24px;
  align-items: center;
  flex-wrap: wrap;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  font-size: 0.75rem;
  margin: 0 0 6px;
}

h1 {
  margin: 0 0 6px;
  font-size: 2rem;
}

h2 {
  margin: 0 0 6px;
  font-size: 1.2rem;
}

.muted {
  color: var(--muted);
  margin: 0;
}

.actions {
  display: flex;
  gap: 12px;
}

.vault-details {
  background: var(--panel);
  border-radius: 18px;
  padding: 14px 18px;
  border: 1px solid var(--line-soft);
  box-shadow: var(--shadow-soft);
}

.vault-details summary {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  font-weight: 600;
}

.vault-details summary::-webkit-details-marker {
  display: none;
}

.vault-details summary::after {
  content: ">";
  font-size: 0.9rem;
  color: var(--muted);
  transition: transform 0.2s ease;
}

.vault-details[open] summary::after {
  transform: rotate(90deg);
}

.vault-summary {
  font-size: 0.85rem;
  color: var(--muted);
}

.vault-body {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.vault-tree {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tree-dir {
  border-radius: 12px;
}

.tree-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--panel-warm);
  border: 1px solid transparent;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  transition: 0.2s ease;
}

.tree-item:hover {
  border-color: var(--accent-border);
}

.tree-item.active {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.tree-dir summary {
  list-style: none;
}

.tree-dir summary::-webkit-details-marker {
  display: none;
}

.tree-dir summary::after {
  content: ">";
  margin-left: auto;
  color: var(--muted);
  transition: transform 0.2s ease;
}

.tree-dir[open] summary::after {
  transform: rotate(90deg);
}

.tree-children {
  margin-left: 16px;
  padding-left: 12px;
  border-left: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tree-icon {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  color: var(--accent);
}

.tree-icon svg {
  width: 18px;
  height: 18px;
}

.tree-file {
  background: var(--panel-warm);
}

.tree-name {
  font-size: 0.9rem;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 0.8fr);
  gap: 24px;
  align-items: stretch;
  flex: 1;
  min-height: 0;
}

.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
  height: 100%;
  min-height: 0;
}

.workspace > * {
  min-height: 0;
}

.workspace .panel,
.workspace .vault-details {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.workspace .panel-body,
.workspace .vault-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.flashcard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  align-items: start;
}

.fast-flashcard-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-rows: auto auto;
  gap: 18px 24px;
  align-items: start;
}

.spaced-repetition-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  grid-template-rows: auto auto auto;
  gap: 24px;
  align-items: start;
}

body.focus-mode .app-shell,
body.focus-mode .app-shell.sidebar-collapsed {
  grid-template-columns: 1fr;
  padding: 16px;
}

body.focus-mode .sidebar {
  display: none;
}

body.focus-mode .flashcard-layout,
body.focus-mode .spaced-repetition-layout {
  grid-template-columns: 1fr;
}

body.focus-mode .flashcard-panel {
  width: 100%;
  max-width: 100%;
  margin: 0;
  justify-self: stretch;
}

body.focus-mode .sr-flashcards-panel {
  width: 100%;
  max-width: 100%;
  margin: 0;
}

.fast-stats-panel {
  grid-column: 1;
  grid-row: 1;
}

.fast-stats-panel .panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fast-tools-panel {
  grid-column: 2;
  grid-row: 1;
}

.fast-flashcard-tools-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fast-flashcard-tools-settings--dividers .fast-flashcard-tools-settings-section {
  padding-top: 0;
}

.fast-flashcard-tools-settings--dividers
.fast-flashcard-tools-settings-section + .fast-flashcard-tools-settings-section {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.fast-flashcard-panel {
  grid-column: 1;
  grid-row: 2;
}

.fast-history-panel {
  grid-column: 2;
  grid-row: 2;
}

body.focus-mode .flashcard-panel img,
body.focus-mode .sr-flashcards-panel img {
  max-width: 100%;
  height: auto;
  display: block;
}

body.focus-mode .flashcard-sidebar,
body.focus-mode .sr-diagram-panel,
body.focus-mode .sr-user-panel,
body.focus-mode .sr-tools-panel,
body.focus-mode .sr-stats-panel {
  display: none;
}

.spaced-repetition-layout .sr-diagram-panel {
  grid-column: 1;
  grid-row: 1;
}

.spaced-repetition-layout .sr-user-panel {
  grid-column: 2;
  grid-row: 1;
}

.spaced-repetition-layout .sr-flashcards-panel {
  grid-column: 1;
  grid-row: 2;
}

.spaced-repetition-layout .sr-tools-panel {
  grid-column: 2;
  grid-row: 2;
}

.spaced-repetition-layout .sr-stats-panel {
  grid-column: 1 / span 2;
  grid-row: 3;
}

.flashcard-sidebar {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.panel {
  background: var(--panel);
  border-radius: 20px;
  padding: 20px;
  box-shadow: var(--shadow-soft);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: riseIn 0.6s ease both;
}

.toolbar-panel .panel-body {
  min-height: auto;
}

.toolbar-panel .primary {
  width: 100%;
}

.flashcard-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.timer-start-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: var(--accent);
  color: var(--accent-contrast);
  font-weight: 600;
  transition: 0.2s ease;
  box-shadow: var(--shadow-soft);
}

.timer-start-button:not(.active):hover {
  background: var(--accent-strong);
}

.timer-start-button.active {
  background: var(--panel);
  border-color: var(--accent);
  color: var(--accent-strong);
  box-shadow: none;
}

.timer-start-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.timer-start-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.timer-start-meta {
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.8;
}

.timer-start-action {
  font-size: 0.95rem;
  font-weight: 700;
}

.timer-start-icon svg {
  width: 18px;
  height: 18px;
}

.pill-button {
  border: 1px solid transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.pill-button:hover {
  border-color: var(--accent-border);
}

.pill-button.active {
  background: var(--accent);
  color: var(--accent-contrast);
  box-shadow: var(--shadow-soft);
}

.pill-button:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.pill-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.flashcard-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flashcard-item {
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.composite-card {
  gap: 16px;
}

.composite-parts {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.composite-card .flashcard-item {
  background: var(--panel);
}

.flashcard-question {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.flashcard-options {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.truefalse-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.truefalse-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
}

.truefalse-question {
  font-weight: 600;
  color: var(--ink);
}

.truefalse-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.truefalse-option {
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  padding: 6px 12px;
  background: var(--panel-warm);
  color: var(--ink);
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s ease;
}

.truefalse-option.selected {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.truefalse-option.correct {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.truefalse-option.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.truefalse-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.truefalse-result {
  font-size: 0.8rem;
  font-weight: 600;
}

.truefalse-result.correct {
  color: var(--accent-strong);
}

.truefalse-result.incorrect {
  color: var(--error-ink);
}

.truefalse-solution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.truefalse-solution-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.truefalse-solution-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--muted);
}

.truefalse-solution-answer {
  font-weight: 600;
  color: var(--ink);
}

.flashcard-option {
  width: 100%;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  border-radius: 12px;
  padding: 8px 10px;
  display: flex;
  gap: 8px;
  align-items: center;
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.flashcard-option:hover {
  border-color: var(--accent-border);
  background: var(--panel-warm);
}

.flashcard-option.selected {
  border-color: var(--accent-strong);
  background: var(--panel-warm);
}

.flashcard-option.correct {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.flashcard-option.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.flashcard-option:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.flashcard-key {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: lowercase;
  flex-shrink: 0;
}

.flashcard-text {
  color: var(--ink);
}

.flashcard-pagination {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.flashcard-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.flashcard-text-block {
  font-weight: 600;
  color: var(--ink);
  white-space: pre-wrap;
}

.flashcard-input {
  width: 100%;
  min-height: 120px;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  color: var(--ink);
  font: inherit;
  resize: vertical;
}

.flashcard-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.flashcard-answer {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.flashcard-answer-text {
  color: var(--ink);
  white-space: pre-wrap;
}

.cloze-text {
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--ink);
}

.cloze-blank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 120px;
  min-height: 36px;
  padding: 6px 8px;
  margin: 0 4px;
  border-radius: 10px;
  border: 1px dashed var(--line);
  background: var(--panel);
  vertical-align: middle;
}

.cloze-blank.input {
  min-width: 90px;
}

.cloze-blank.filled {
  border-style: solid;
  background: var(--panel-warm);
}

.cloze-blank.correct {
  border-color: var(--accent-border);
  background: var(--accent-soft);
}

.cloze-blank.incorrect {
  border-color: var(--error-border);
  background: var(--error-bg);
}

.cloze-input {
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  color: var(--ink);
  border-radius: 8px;
  padding: 4px 6px;
  font-size: 0.85rem;
  min-width: 80px;
}

.cloze-input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.cloze-blank.correct .cloze-input {
  border-color: var(--accent-border);
}

.cloze-blank.incorrect .cloze-input {
  border-color: var(--error-border);
}

.cloze-placeholder {
  font-size: 0.75rem;
  color: var(--muted);
}

.cloze-token {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.token-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}

.token-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 36px;
}

.token-chip {
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--panel-warm);
  color: var(--ink);
  cursor: grab;
  user-select: none;
}

.token-chip:active {
  cursor: grabbing;
}

.token-chip:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.token-chip.used {
  opacity: 0.6;
}

.token-remove {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.75rem;
  line-height: 1;
}

.token-remove:hover {
  color: var(--ink);
  border-color: var(--line-soft);
}

.cloze-solution {
  line-height: 1.6;
  white-space: pre-wrap;
  color: var(--ink);
}

.cloze-solution-token {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  margin: 0 2px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-weight: 600;
}

.token-solution {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}

.flashcard-submit {
  border-style: solid;
}

.flashcard-result {
  font-weight: 600;
}

.flashcard-result.correct {
  color: var(--accent-strong);
}

.flashcard-result.incorrect {
  color: var(--error-ink);
}

.flashcard-result.neutral {
  color: var(--muted);
}

.stats-panel .panel-body {
  min-height: auto;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.kpi-card {
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpi-label {
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.kpi-value {
  font-weight: 700;
  font-size: 1.2rem;
}

.chart-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart-meta {
  font-size: 0.75rem;
  color: var(--muted);
}

.chart-canvas {
  padding: 10px;
  border-radius: 12px;
  background: var(--panel);
  border: 1px solid var(--line-soft);
}

.sr-chart {
  width: 100%;
  height: 120px;
}

.sr-chart-axis {
  stroke: var(--line);
  stroke-width: 0.8;
}

.sr-chart-line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
}

.chart-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--muted);
}

.stats-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.fast-stats-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.fast-stats-blocks {
  display: grid;
  grid-template-columns: minmax(0, 0.6fr) minmax(0, 1fr);
  gap: 12px;
}

.fast-time-block,
.fast-stats-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
}

.fast-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.fast-stats-block-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.fast-stats-grid {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.fast-stats-grid .stats-chart {
  justify-self: center;
}

.fast-stats-labels,
.fast-stats-values {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fast-stats-values {
  text-align: right;
}

.fast-time-meter {
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: var(--chip-bg);
  border: 1px solid var(--line-soft);
  position: relative;
  overflow: hidden;
}

.fast-time-meter::after {
  content: "";
  position: absolute;
  inset: 0;
  width: var(--fast-time-progress, 0%);
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent-highlight) 100%);
  box-shadow: 0 0 8px rgba(224, 122, 95, 0.35);
  transition: width 0.2s ease;
}

.fast-time-status {
  font-size: 0.8rem;
  color: var(--muted);
}

.fast-time-status.active {
  color: var(--ink);
}

.fast-time-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--muted);
}

.fast-session-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fast-history-sections {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.fast-section-title {
  margin: 0 0 4px;
  font-size: 1.05rem;
}

.fast-session-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.fast-session-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 16px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
}

.fast-session-value {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.1;
}

.fast-session-sub {
  font-size: 0.75rem;
  color: var(--muted);
}

.fast-vault-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
}

.fast-vault-block .label {
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.fast-vault-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 0.85rem;
  color: var(--ink);
}

.fast-vault-sep {
  font-size: 0.75rem;
  color: var(--muted);
}

.fast-session-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fast-session-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 0.7fr));
  gap: 8px;
  align-items: center;
  font-size: 0.85rem;
}

.fast-session-row.header {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.fast-session-cell {
  text-align: right;
}

.fast-session-cell.timestamp {
  text-align: left;
}

.stats-counters {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stats-counter {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.stats-label {
  color: var(--muted);
  font-size: 0.85rem;
}

.stats-value {
  font-weight: 700;
  font-size: 1.1rem;
}

.stats-chart {
  --stats-primary: var(--accent);
  --stats-secondary: var(--error-ink);
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: conic-gradient(
    var(--stats-primary) 0 var(--correct-percent),
    var(--stats-secondary) var(--correct-percent) 100%
  );
  position: relative;
  flex-shrink: 0;
}

.stats-chart::after {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 50%;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  z-index: 1;
}

.stats-chart.empty {
  background: conic-gradient(var(--line) 0 100%);
}

.stats-chart-label {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  z-index: 2;
  pointer-events: none;
}

.stats-chart-total {
  font-weight: 700;
  font-size: 1.1rem;
}

.stats-chart-caption {
  font-size: 0.7rem;
  color: var(--muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sr-stats-top {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 0.9fr);
  gap: 16px;
  align-items: start;
}

.sr-stats-left,
.sr-stats-right {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sr-stats-switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.sr-stats-right .stats-summary {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.sr-stats-right .stats-counters {
  width: 100%;
}

.sr-stats-right .stats-counter {
  width: 100%;
}

.sr-box-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
}

.sr-box-chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sr-vault-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
}

.help-panel .panel-body {
  min-height: auto;
}

.help-body {
  gap: 16px;
}

.help-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.help-item:first-child {
  border-top: none;
  padding-top: 0;
}

.help-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.help-block-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ink);
  text-transform: none;
  letter-spacing: 0;
}

.help-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
}

.help-list li {
  line-height: 1.5;
}

.help-examples {
  display: grid;
  gap: 10px;
}

.help-example {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-example-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.help-example-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.help-example-title {
  font-weight: 600;
}

.help-example-description {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.help-copy {
  flex-shrink: 0;
}

.help-code {
  margin: 0;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  font-family: var(--mono);
  font-size: 0.82rem;
  white-space: pre-wrap;
}

.help-overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.help-topic-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.help-topic-card:hover {
  border-color: var(--accent-border);
  box-shadow: var(--shadow-soft);
  transform: translateY(-1px);
}

.help-topic-card:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.help-topic-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-topic-icon {
  width: 28px;
  height: 28px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  color: var(--muted);
  font-size: 0.85rem;
}

.help-topic-title {
  font-weight: 600;
}

.help-topic-summary {
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.4;
}

.help-app-sections-card {
  padding: 16px;
  border-radius: 16px;
  background: var(--panel-warm);
  border: 1px solid var(--line-soft);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-app-sections-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.help-app-sections-title {
  font-weight: 600;
}

.help-app-sections-summary {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

.help-app-sections-body {
  display: grid;
  grid-template-columns: minmax(0, 0.35fr) minmax(0, 0.65fr);
  gap: 16px;
}

.help-app-sections-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.help-app-sections-list-item {
  background: transparent;
  border: 1px solid transparent;
  padding: 10px 12px;
  border-radius: 12px;
  font-weight: 600;
  text-align: left;
  color: var(--ink);
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.help-app-sections-list-item:hover,
.help-app-sections-list-item:focus-visible {
  border-color: var(--line);
}

.help-app-sections-list-item.selected {
  background: var(--panel);
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.help-app-sections-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-app-sections-intro {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.help-app-sections-detail-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.help-app-sections-detail-description {
  margin: 0;
}

.help-app-sections-detail-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.help-app-sections-detail-field .label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.help-app-section-workflow {
  margin: 0;
  font-size: 0.85rem;
  color: var(--muted);
}

.help-topic-arrow {
  margin-left: auto;
  color: var(--muted);
  font-weight: 700;
}

.help-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-breadcrumb {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.help-breadcrumb-current {
  color: var(--ink);
  font-weight: 600;
}

.help-breadcrumb-leaf {
  color: var(--accent-strong);
}

.help-crumb-sep {
  color: var(--muted);
}

.help-detail-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.help-detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
}

.help-detail-section:first-child {
  border-top: none;
  padding-top: 0;
}

.help-syntax-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.help-syntax-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.help-syntax-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  text-align: left;
  cursor: pointer;
  transition: 0.2s ease;
}

.help-syntax-card:hover {
  border-color: var(--accent-border);
  transform: translateY(-1px);
}

.help-syntax-card:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.help-syntax-card.active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  box-shadow: var(--shadow-soft), inset 4px 0 0 var(--accent-strong);
}

.help-syntax-card.active .help-syntax-card-title {
  color: var(--accent-strong);
}

.help-syntax-card-title {
  font-weight: 600;
}

.help-syntax-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 0.78rem;
}

.help-syntax-card-label {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.65rem;
}

.help-syntax-token-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.help-syntax-token {
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: var(--panel);
  font-family: var(--mono);
  font-size: 0.72rem;
  color: var(--ink);
}

.help-syntax-card-rule {
  color: var(--muted);
  font-size: 0.85rem;
  line-height: 1.4;
}

.help-syntax-snippet {
  margin: 0;
  padding: 8px;
  border-radius: 10px;
  border: 1px dashed var(--line-soft);
  background: var(--panel);
  font-family: var(--mono);
  font-size: 0.75rem;
  color: var(--muted);
  white-space: pre-wrap;
}

.help-syntax-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  min-width: 0;
}

.help-syntax-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-syntax-detail-title {
  font-weight: 600;
  font-size: 1rem;
}

.help-syntax-lang-tabs {
  display: flex;
  gap: 6px;
}

.help-syntax-lang {
  border-radius: 999px;
  border: 1px solid var(--line-soft);
  padding: 4px 10px;
  font-size: 0.75rem;
  color: var(--muted);
  background: transparent;
  cursor: pointer;
}

.help-syntax-lang:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.help-syntax-lang.active {
  border-color: var(--accent-border);
  color: var(--ink);
  background: var(--panel);
}

.help-syntax-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line-soft);
}

.help-syntax-section:first-of-type {
  border-top: none;
  padding-top: 0;
}

.help-syntax-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.help-syntax-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
}

.help-syntax-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--muted);
}

@media (max-width: 960px) {
  .help-syntax-layout {
    grid-template-columns: 1fr;
  }
}

.sr-vault-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sr-box-chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, 1fr));
  gap: 12px;
  align-items: end;
  min-height: 140px;
}

.sr-box-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
  border-radius: 16px;
  border: 1px solid transparent;
  background: transparent;
  padding: 10px 6px 8px;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  font: inherit;
  color: inherit;
  text-align: center;
  appearance: none;
  -webkit-appearance: none;
}

.sr-box-column:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 3px;
}

.sr-box-column.active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  box-shadow: 0 0 0 1px var(--accent-border);
}

.sr-box-count {
  font-weight: 700;
  font-size: 0.9rem;
}

.sr-box-label {
  font-size: 0.7rem;
  color: var(--muted);
}

.sr-box-bar {
  width: 100%;
  height: 120px;
  background: var(--panel);
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  display: flex;
  align-items: flex-end;
  padding: 6px;
}

.sr-box-bar-fill {
  width: 100%;
  height: var(--bar-height);
  background: linear-gradient(180deg, var(--accent) 0%, var(--accent-strong) 100%);
  border-radius: 10px;
  transition: height 0.2s ease;
}

.workspace .panel:nth-child(1) {
  animation-delay: 0.1s;
}

.workspace .panel:nth-child(2) {
  animation-delay: 0.16s;
}

.workspace .panel:nth-child(3) {
  animation-delay: 0.22s;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.focus-toggle {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  color: var(--ink);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: 0.2s ease;
}

.focus-toggle:hover {
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.focus-toggle.active {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent-strong);
}

.focus-toggle:focus-visible {
  outline: 2px solid var(--accent-border);
  outline-offset: 2px;
}

.focus-toggle svg {
  width: 18px;
  height: 18px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-content {
  flex: 1;
  min-height: 0;
  display: flex;
}

.preview-edit-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: auto;
  align-self: flex-end;
}

.preview-edit-button {
  padding: 6px 10px;
  font-size: 0.8rem;
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 240px;
}

.panel-body.preview-body {
  flex: 1;
  min-height: 0;
}

.workspace .panel-body {
  flex: 1;
  min-height: 0;
}

.list-panel .panel-body,
.preview-panel .panel-body {
  overflow: hidden;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 20;
}

.modal-panel {
  width: min(420px, 100%);
  background: var(--panel);
  border-radius: 18px;
  border: 1px solid var(--line-soft);
  padding: 20px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.file-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.file-item {
  width: 100%;
  text-align: left;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--panel-warm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.file-item:hover {
  border-color: var(--accent-border);
}

.file-item.active {
  border-color: var(--accent-strong);
  background: var(--accent-soft);
}

.file-name {
  font-size: 0.9rem;
  color: var(--ink);
}

.preview {
  margin: 0;
  padding: 16px;
  background: var(--preview-bg);
  color: var(--preview-ink);
  border-radius: 16px;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
}

.preview-editor {
  width: 100%;
  height: 100%;
  flex: 1;
  min-height: 0;
  padding: 16px;
  border-radius: 16px;
  border: 1px solid var(--line-soft);
  background: var(--preview-bg);
  color: var(--preview-ink);
  font-family: var(--mono);
  font-size: 0.85rem;
  resize: none;
}

.preview.raw {
  font-family: var(--mono);
  font-size: 0.85rem;
  white-space: pre-wrap;
}

.preview.raw pre {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
  font-size: inherit;
}

.preview.markdown {
  font-size: 0.95rem;
  line-height: 1.6;
}

.preview.markdown > :first-child {
  margin-top: 0;
}

.preview.markdown h1 {
  font-size: 1.4rem;
  margin: 0 0 0.6rem;
}

.preview.markdown h2 {
  font-size: 1.2rem;
  margin: 1.2rem 0 0.6rem;
}

.preview.markdown h3 {
  font-size: 1.05rem;
  margin: 1rem 0 0.5rem;
}

.preview.markdown p {
  margin: 0 0 0.8rem;
}

.preview.markdown ul,
.preview.markdown ol {
  margin: 0 0 0.8rem;
  padding-left: 1.4rem;
}

.preview.markdown a {
  color: var(--accent);
  text-decoration: underline;
}

.preview.markdown a:hover {
  color: var(--accent-strong);
}

.preview.markdown code {
  font-family: var(--mono);
  font-size: 0.85rem;
  background: var(--preview-code-bg);
  border: 1px solid var(--preview-code-border);
  border-radius: 6px;
  padding: 2px 6px;
}

.preview.markdown pre {
  margin: 0 0 0.8rem;
  padding: 12px;
  background: var(--preview-code-bg);
  border: 1px solid var(--preview-code-border);
  border-radius: 12px;
  overflow-x: auto;
}

.preview.markdown pre code {
  background: transparent;
  border: none;
  padding: 0;
}

.preview.markdown blockquote {
  margin: 0 0 0.8rem;
  padding-left: 12px;
  border-left: 3px solid var(--accent);
  color: var(--preview-ink);
  opacity: 0.9;
}

.preview.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  flex: 1;
  min-height: 0;
  text-align: center;
  color: var(--muted);
  font-style: italic;
}

.empty-state {
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed var(--line);
  color: var(--muted);
  background: var(--panel-warm);
}

.error {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--error-bg);
  border: 1px solid var(--error-border);
  color: var(--error-ink);
}

.chip {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--chip-bg);
  font-size: 0.8rem;
  color: var(--muted);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  grid-template-rows: auto auto;
  gap: 20px;
  align-items: start;
  overflow-x: auto;
}

.settings-grid .panel {
  min-width: 0;
}

.settings-grid .vault-index-panel {
  grid-column: 1 / span 2;
  grid-row: 1;
}

.settings-grid .settings-tabs-panel {
  grid-column: 3 / span 2;
  grid-row: 1;
}

.settings-grid .settings-flashcards-panel {
  grid-column: 1;
  grid-row: 2;
}

.settings-grid .fast-flashcard-tools-panel {
  grid-column: 2;
  grid-row: 2;
}

.settings-grid .spaced-repetition-panel {
  grid-column: 3;
  grid-row: 2;
}

.settings-tabs-panel .settings-tab-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-grid .appearance-panel {
  grid-column: 4;
  grid-row: 2;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.setting-subrow {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.spaced-repetition-layout .setting-row {
  border-top: none;
  padding-top: 0;
}

.setting-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.setting-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.status-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.status-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
}

.status-checkbox input {
  accent-color: var(--accent);
}

.appearance-panel .setting-row:first-of-type {
  border-top: none;
  padding-top: 0;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
}

.toggle-label {
  font-size: 0.85rem;
  color: var(--muted);
}

.switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 46px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--line);
  border-radius: 999px;
  transition: background 0.2s ease;
}

.slider::before {
  content: "";
  position: absolute;
  width: 20px;
  height: 20px;
  left: 3px;
  top: 3px;
  border-radius: 50%;
  background: var(--panel);
  box-shadow: var(--shadow-soft);
  transition: transform 0.2s ease;
}

.switch input:checked + .slider {
  background: var(--accent);
}

.switch input:checked + .slider::before {
  transform: translateX(20px);
}

.switch input:disabled + .slider {
  background: var(--line-soft);
  opacity: 0.6;
  cursor: not-allowed;
}

.text-input {
  min-width: 140px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  color: var(--ink);
  font-size: 0.85rem;
}

.text-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.accent-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.color-wheel {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--line-soft);
  background: var(--panel);
  padding: 0;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
}

.color-wheel::-webkit-color-swatch-wrapper {
  padding: 0;
}

.color-wheel::-webkit-color-swatch {
  border: none;
  border-radius: 10px;
}

.color-wheel::-moz-color-swatch {
  border: none;
  border-radius: 10px;
}

.accent-palette {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.accent-swatch {
  width: 26px;
  height: 26px;
  border-radius: 9px;
  border: 2px solid transparent;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--line-soft);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.accent-swatch:hover {
  transform: translateY(-1px);
}

.accent-swatch.active {
  box-shadow:
    inset 0 0 0 1px var(--line-soft),
    0 0 0 2px var(--panel),
    0 0 0 4px var(--accent-border);
}

.accent-hex {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hex-input {
  min-width: 120px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--line-soft);
  background: var(--panel-warm);
  color: var(--ink);
  font-family: var(--mono);
  font-size: 0.85rem;
}

.helper-text {
  font-size: 0.8rem;
  color: var(--muted);
}

.helper-text.error-text {
  color: var(--accent-strong);
}

.path-value {
  word-break: break-all;
  overflow-wrap: anywhere;
}

.pill-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-strong);
  font-size: 0.85rem;
  font-weight: 600;
}

@media (max-width: 1200px) {
  .flashcard-layout {
    grid-template-columns: 1fr;
  }

  .fast-flashcard-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto;
  }

  .fast-stats-panel {
    grid-column: 1;
    grid-row: 1;
  }

  .fast-tools-panel {
    grid-column: 1;
    grid-row: 2;
  }

  .fast-history-panel {
    grid-column: 1;
    grid-row: 3;
  }

  .fast-session-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .fast-flashcard-panel {
    grid-column: 1;
    grid-row: 4;
  }

  .fast-stats-blocks {
    grid-template-columns: 1fr;
  }

  .spaced-repetition-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto auto auto;
  }

  .spaced-repetition-layout .sr-diagram-panel {
    grid-column: 1;
    grid-row: 1;
  }

  .spaced-repetition-layout .sr-user-panel {
    grid-column: 1;
    grid-row: 2;
  }

  .spaced-repetition-layout .sr-flashcards-panel {
    grid-column: 1;
    grid-row: 3;
  }

  .spaced-repetition-layout .sr-tools-panel {
    grid-column: 1;
    grid-row: 4;
  }

  .spaced-repetition-layout .sr-stats-panel {
    grid-column: 1;
    grid-row: 5;
  }

  .sr-stats-top {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 980px) {
  .app-shell,
  .app-shell.sidebar-collapsed {
    grid-template-columns: 1fr;
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 85vw);
    max-height: 100vh;
    overflow-y: auto;
    transform: translateX(-110%);
    transition: transform 0.2s ease;
    z-index: 30;
  }

  .app-shell.nav-open .sidebar {
    transform: translateX(0);
  }

  .app-shell.dashboard-active .content {
    overflow: auto;
  }

  .mobile-nav-header {
    display: flex;
  }

  .mobile-nav-close {
    display: inline-flex;
  }

  .app-shell.nav-open .mobile-nav-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .dashboard-page {
    height: auto;
  }

  .workspace {
    grid-template-columns: 1fr;
    flex: 0 0 auto;
  }

  .workspace .panel,
  .workspace .vault-details {
    height: auto;
  }

  .sidebar {
    order: 1;
  }

  .content {
    order: 2;
  }
}

---

## 📝 App.tsx — ./App.tsx

import { useState } from "react";
import "./App.css";
import { AppStateProvider, useAppState } from "./components/AppStateProvider";
import { SidebarNav } from "./components/SidebarNav";
import { DashboardPage } from "./pages/DashboardPage";
import { FlashcardPage } from "./pages/FlashcardPage";
import { FastFlashcardPage } from "./pages/FastFlashcardPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

const AppContent = () => {
  const { settings } = useAppState();
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isDashboard = activeTab === "dashboard";
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setIsMobileNavOpen(false);
  };

  return (
    <div
      className={`app-shell ${
        settings.rightToolbarCollapsed ? "sidebar-collapsed" : ""
      } ${isDashboard ? "dashboard-active" : ""} ${
        isMobileNavOpen ? "nav-open" : ""
      }`}
    >
      <SidebarNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isMobileNavOpen={isMobileNavOpen}
        onMobileNavClose={() => setIsMobileNavOpen(false)}
      />
      <main className="content">
        <div className="mobile-nav-header">
          <button
            type="button"
            className="ghost small mobile-nav-toggle"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="Open navigation"
            aria-controls="app-sidebar"
            aria-expanded={isMobileNavOpen}
          >
            Menu
          </button>
        </div>
        {activeTab === "dashboard" ? (
          <DashboardPage />
        ) : activeTab === "flashcard" ? (
          <FlashcardPage />
        ) : activeTab === "spaced-repetition" ? (
          <SpacedRepetitionPage />
        ) : activeTab === "fast-flashcard" ? (
          <FastFlashcardPage />
        ) : activeTab === "help" ? (
          <HelpPage />
        ) : (
          <SettingsPage />
        )}
      </main>
      <button
        type="button"
        className="mobile-nav-backdrop"
        onClick={() => setIsMobileNavOpen(false)}
        aria-hidden={!isMobileNavOpen}
        tabIndex={-1}
      />
    </div>
  );
};

function App() {
  return (
    <AppStateProvider>
      <AppContent />
    </AppStateProvider>
  );
}

export default App;

---

## 📝 AppStateProvider.tsx — ./components/AppStateProvider.tsx

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { isValidHex, normalizeHex } from "../lib/color";
import { type ThemeMode } from "../lib/theme";
import { type VaultFile } from "../lib/tree";
import { useFlashcards } from "../features/flashcards/useFlashcards";
import { usePreview } from "../features/preview/usePreview";
import { useAppSettings } from "../features/settings/useAppSettings";
import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition";
import { useVault } from "../features/vault/useVault";

type AppActions = {
  handlePickVault: () => Promise<boolean>;
  handleSelectFile: (file: VaultFile) => void;
  handleThemeChange: (nextTheme: ThemeMode) => void;
  handleAccentPick: (value: string) => void;
  handleAccentInputChange: (value: string) => void;
  handleCopyAccent: () => Promise<void>;
  handleCopyVaultPath: () => Promise<void>;
  handleRescanVault: () => void;
  handleMaxFilesPerScanChange: (value: string) => void;
};

type AppState = {
  actions: AppActions;
  flashcards: ReturnType<typeof useFlashcards>;
  fastFlashcards: ReturnType<typeof useFlashcards>;
  preview: ReturnType<typeof usePreview>;
  settings: ReturnType<typeof useAppSettings>;
  spacedRepetition: ReturnType<typeof useSpacedRepetition>;
  vault: ReturnType<typeof useVault>;
};

const AppStateContext = createContext<AppState | null>(null);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const settings = useAppSettings();
  const {
    activeNotePath,
    accentColor,
    persistSettings,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setMaxFilesPerScan,
    setTheme,
    settingsLoaded,
    vaultPath: storedVaultPath,
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
  } = settings;
  const vault = useVault({ persistSettings });
  const preview = usePreview();
  const flashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode,
      flashcardOrder,
      flashcardPageSize,
      flashcardScope,
      setFlashcardMode,
      setFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const fastFlashcards = useFlashcards({
    files: vault.files,
    preview: preview.preview,
    selectedFile: preview.selectedFile,
    vaultPath: vault.vaultPath,
    settings: {
      flashcardMode: fastFlashcardMode,
      flashcardOrder: fastFlashcardOrder,
      flashcardPageSize,
      flashcardScope: fastFlashcardScope,
      setFlashcardMode: setFastFlashcardMode,
      setFlashcardOrder: setFastFlashcardOrder,
      setFlashcardPageSize,
      setFlashcardScope: setFastFlashcardScope,
      setSolutionRevealEnabled,
      setStatsResetMode,
      solutionRevealEnabled,
      statsResetMode,
    },
  });
  const spacedRepetition = useSpacedRepetition({
    isFlashcardScanning: flashcards.isFlashcardScanning,
    scanFlashcards: flashcards.scanFlashcards,
    setIsFlashcardScanning: flashcards.setIsFlashcardScanning,
    settings: {
      setSpacedRepetitionBoxes: settings.setSpacedRepetitionBoxes,
      setSpacedRepetitionOrder: settings.setSpacedRepetitionOrder,
      setSpacedRepetitionPageSize: settings.setSpacedRepetitionPageSize,
      setSpacedRepetitionRepetitionStrength:
        settings.setSpacedRepetitionRepetitionStrength,
      setSpacedRepetitionStatsView: settings.setSpacedRepetitionStatsView,
      spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
      spacedRepetitionOrder: settings.spacedRepetitionOrder,
      spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength:
        settings.spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
    },
  });
  const hasRestoredVault = useRef(false);
  const isRestoringActiveNote = useRef(false);
  const hasResolvedActiveNote = useRef(false);
  const { loadVault, pickVault, rescanVault, setVaultPath, vaultPath } = vault;
  const {
    resetPreview,
    restoreSnapshot: restorePreviewSnapshot,
    selectFile,
    setPreviewError,
    takeSnapshot: takePreviewSnapshot,
  } = preview;
  const {
    resetFlashcards,
    restoreSnapshot: restoreFlashcardsSnapshot,
    takeSnapshot: takeFlashcardsSnapshot,
  } = flashcards;

  useEffect(() => {
    if (!settingsLoaded || hasRestoredVault.current) {
      return;
    }
    hasRestoredVault.current = true;
    if (!storedVaultPath) {
      return;
    }
    let cancelled = false;

    const restoreVault = async () => {
      const loaded = await loadVault(storedVaultPath, {
        persist: false,
        clearOnFailure: false,
        errorMessage:
          "Gespeicherter Vault ist nicht verfuegbar. Bitte neu auswaehlen.",
      });
      if (!loaded && !cancelled) {
        setVaultPath(null);
        await persistSettings({ vaultPath: null });
      }
    };

    void restoreVault();

    return () => {
      cancelled = true;
    };
  }, [loadVault, persistSettings, setVaultPath, settingsLoaded, storedVaultPath]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (preview.selectedFile && !hasResolvedActiveNote.current) {
      hasResolvedActiveNote.current = true;
    }
    if (!hasResolvedActiveNote.current) {
      return;
    }
    const nextPath = preview.selectedFile?.relative_path ?? null;
    if (nextPath === activeNotePath) {
      return;
    }
    setActiveNotePath(nextPath);
  }, [activeNotePath, preview.selectedFile, setActiveNotePath, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!vault.vaultPath || vault.listState !== "idle") {
      return;
    }
    if (preview.selectedFile || isRestoringActiveNote.current) {
      if (preview.selectedFile) {
        hasResolvedActiveNote.current = true;
      }
      return;
    }
    if (!activeNotePath) {
      hasResolvedActiveNote.current = true;
      return;
    }
    const storedFile = vault.files.find(
      (file) =>
        file.relative_path === activeNotePath || file.path === activeNotePath,
    );
    if (!storedFile) {
      setActiveNotePath(null);
      if (vault.files.length === 0) {
        hasResolvedActiveNote.current = true;
        return;
      }
    }
    const nextFile = storedFile ?? vault.files[0];
    if (!nextFile) {
      return;
    }
    isRestoringActiveNote.current = true;
    resetFlashcards();
    void Promise.resolve(selectFile(nextFile)).finally(() => {
      isRestoringActiveNote.current = false;
      hasResolvedActiveNote.current = true;
    });
  }, [
    activeNotePath,
    preview.selectedFile,
    resetFlashcards,
    selectFile,
    setActiveNotePath,
    settingsLoaded,
    vault.files,
    vault.listState,
    vault.vaultPath,
  ]);

  const handlePickVault = useCallback(async () => {
    setPreviewError("");
    const previewSnapshot = takePreviewSnapshot();
    const flashcardsSnapshot = takeFlashcardsSnapshot();

    const loaded = await pickVault({
      errorMessage: "Ausgewaehlter Vault ist nicht verfuegbar.",
      onBeforeLoad: () => {
        resetPreview();
        resetFlashcards();
      },
      onLoadFailed: () => {
        restorePreviewSnapshot(previewSnapshot);
        restoreFlashcardsSnapshot(flashcardsSnapshot);
      },
    });

    return loaded;
  }, [
    pickVault,
    resetFlashcards,
    resetPreview,
    restoreFlashcardsSnapshot,
    restorePreviewSnapshot,
    setPreviewError,
    takeFlashcardsSnapshot,
    takePreviewSnapshot,
  ]);

  const handleSelectFile = useCallback(
    (file: VaultFile) => {
      resetFlashcards();
      void selectFile(file);
    },
    [resetFlashcards, selectFile],
  );

  const handleThemeChange = useCallback(
    (nextTheme: ThemeMode) => {
      setTheme(nextTheme);
    },
    [setTheme],
  );

  const handleAccentPick = useCallback(
    (value: string) => {
      const normalized = normalizeHex(value);
      if (!isValidHex(normalized)) {
        return;
      }
      setAccentError("");
      setAccentColor(normalized);
      setAccentDraft(normalized);
    },
    [setAccentColor, setAccentDraft, setAccentError],
  );

  const handleAccentInputChange = useCallback(
    (value: string) => {
      const nextValue = normalizeHex(value);
      setAccentDraft(nextValue);
      if (!nextValue) {
        setAccentError("");
        return;
      }
      if (isValidHex(nextValue)) {
        setAccentError("");
        setAccentColor(nextValue);
      } else {
        setAccentError("HEX muss #RRGGBB sein.");
      }
    },
    [setAccentColor, setAccentDraft, setAccentError],
  );

  const handleCopyAccent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(accentColor);
    } catch (error) {
      console.error("Failed to copy accent color", error);
    }
  }, [accentColor]);

  const handleCopyVaultPath = useCallback(async () => {
    if (!vaultPath) {
      return;
    }
    try {
      await navigator.clipboard.writeText(vaultPath);
    } catch (error) {
      console.error("Failed to copy vault path", error);
    }
  }, [vaultPath]);

  const handleRescanVault = useCallback(() => {
    void rescanVault();
  }, [rescanVault]);

  const handleMaxFilesPerScanChange = useCallback(
    (value: string) => {
      const nextValue = value.trim();
      if (nextValue === "" || /^[0-9]+$/.test(nextValue)) {
        setMaxFilesPerScan(nextValue);
      }
    },
    [setMaxFilesPerScan],
  );

  const value: AppState = {
    actions: {
      handlePickVault,
      handleSelectFile,
      handleThemeChange,
      handleAccentPick,
      handleAccentInputChange,
      handleCopyAccent,
      handleCopyVaultPath,
      handleRescanVault,
      handleMaxFilesPerScanChange,
    },
    flashcards,
    fastFlashcards,
    preview,
    settings,
    spacedRepetition,
    vault,
  };

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
};

---

## 📝 FileList.tsx — ./components/FileList.tsx

import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type FileListProps = {
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const FileList = ({
  fileCountLabel,
  files,
  listError,
  listState,
  onSelectFile,
  selectedFile,
  vaultPath,
}: FileListProps) => {
  return (
    <section className="panel list-panel">
      <div className="panel-header">
        <div>
          <h2>Notizen</h2>
          <p className="muted">{fileCountLabel}</p>
        </div>
        {listState === "loading" ? <span className="chip">Scanne...</span> : null}
      </div>
      <div className="panel-body">
        {!vaultPath ? (
          <div className="empty-state">Waehle einen Vault, um die Liste zu fuellen.</div>
        ) : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && files.length === 0 ? (
          <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
        ) : null}
        {vaultPath && listState !== "error" ? (
          <ul className="file-list">
            {files.map((file) => (
              <li key={file.path}>
                <button
                  type="button"
                  className={`file-item ${
                    selectedFile?.path === file.path ? "active" : ""
                  }`}
                  onClick={() => onSelectFile(file)}
                >
                  <span className="file-name">{file.relative_path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
};

---

## 📝 ClozeCard.tsx — ./components/flashcards/ClozeCard.tsx

import { type DragEvent } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeCard as ClozeCardType,
} from "../../lib/flashcards";
import {
  areClozeBlanksComplete,
  getClozeBlanks,
  isClozeCardCorrect,
} from "../../features/flashcards/logic";

type ClozeCardProps = {
  card: ClozeCardType;
  cardIndex: number;
  submitted: boolean;
  responses: Record<string, string>;
  submissionLocked?: boolean;
  partIndex?: number;
  showSubmit?: boolean;
  onInputChange: (cardIndex: number, blankId: string, value: string) => void;
  onTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onTokenRemove: (cardIndex: number, blankId: string) => void;
  onTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const ClozeCard = ({
  card,
  cardIndex,
  submitted,
  responses,
  submissionLocked = false,
  partIndex,
  showSubmit = true,
  onBlankDragOver,
  onInputChange,
  onSubmit,
  onTokenDragStart,
  onTokenDrop,
  onTokenRemove,
}: ClozeCardProps) => {
  const blanks = getClozeBlanks(card.segments);
  const dragBlanks = blanks.filter((blank) => blank.kind === "drag");
  const dragBlankIds = new Set(dragBlanks.map((blank) => blank.id));
  const tokenById = new Map(
    card.dragTokens.map((token) => [token.id, token.value]),
  );
  const assignedTokenIds = new Set(
    dragBlanks
      .map((blank) => responses[blank.id])
      .filter((tokenId) => tokenById.has(tokenId)),
  );
  const hasDragTokens = card.dragTokens.length > 0;
  const validTokenIds = new Set(card.dragTokens.map((token) => token.id));
  const canSubmit = areClozeBlanksComplete(card, responses);
  const isCorrect = isClozeCardCorrect(card, responses);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || submitted;
  let blankPosition = 0;

  return (
    <article className="flashcard-item cloze-card">
      <h3 className="flashcard-question">{card.question}</h3>
      <div className="cloze-text">
        {card.segments.map((segment, segmentIndex) => {
          if (segment.type === "text") {
            return (
              <span key={`cloze-text-${cardIndex}-${segmentIndex}`}>
                {segment.value}
              </span>
            );
          }

          blankPosition += 1;
          const blankNumber = blankPosition;

          if (segment.kind === "input") {
            const value = responses[segment.id] ?? "";
            const isBlankCorrect = submitted
              ? isInputAnswerMatch(value, segment.solution)
              : false;
            const blankClasses = [
              "cloze-blank",
              "input",
              value.trim() ? "filled" : "",
              submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <span
                key={`cloze-blank-${cardIndex}-${segmentIndex}`}
                className={blankClasses}
              >
                <input
                  type="text"
                  className="cloze-input"
                  value={value}
                  onChange={(event) =>
                    onInputChange(cardIndex, segment.id, event.target.value)
                  }
                  disabled={submitted}
                  placeholder="____"
                  aria-label={`Blank ${blankNumber}`}
                />
              </span>
            );
          }

          const assignedTokenId = responses[segment.id] ?? "";
          const assignedValue = assignedTokenId
            ? tokenById.get(assignedTokenId) ?? ""
            : "";
          const hasToken = Boolean(assignedValue);
          const isBlankCorrect = submitted
            ? isDragAnswerMatch(assignedValue, segment.solution)
            : false;
          const blankClasses = [
            "cloze-blank",
            "drag",
            hasToken ? "filled" : "",
            submitted ? (isBlankCorrect ? "correct" : "incorrect") : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <span
              key={`cloze-blank-${cardIndex}-${segmentIndex}`}
              className={blankClasses}
              aria-label={`Drop zone ${blankNumber}`}
              onDragOver={onBlankDragOver}
              onDrop={(event) =>
                onTokenDrop(event, cardIndex, segment.id, validTokenIds, dragBlankIds)
              }
            >
              {hasToken ? (
                <span className="cloze-token">
                  <button
                    type="button"
                    className="token-chip"
                    draggable={!submitted}
                    onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: assignedTokenId,
                      partIndex,
                    })
                  }
                  disabled={submitted}
                >
                    {assignedValue}
                  </button>
                  {!submitted ? (
                    <button
                      type="button"
                      className="token-remove"
                      onClick={() => onTokenRemove(cardIndex, segment.id)}
                      aria-label="Remove token"
                    >
                      x
                    </button>
                  ) : null}
                </span>
              ) : (
                <span className="cloze-placeholder">Drop token</span>
              )}
            </span>
          );
        })}
      </div>
      {hasDragTokens ? (
        <div className="token-section">
          <span className="label">Tokens</span>
          <div className="token-pool">
            {card.dragTokens.map((token) => {
              const isUsed = assignedTokenIds.has(token.id);
              return (
                <button
                  key={`token-${cardIndex}-${token.id}`}
                  type="button"
                  className={`token-chip ${isUsed ? "used" : ""}`}
                  draggable={!submitted && !isUsed}
                  onDragStart={(event) =>
                    onTokenDragStart(event, {
                      cardIndex,
                      tokenId: token.id,
                      partIndex,
                    })
                  }
                  disabled={submitted || isUsed}
                >
                  {token.value}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={submitted || !canSubmit || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {submitted ? (
        <div className="token-solution">
          <span className="label">Solution</span>
          <div className="cloze-solution">
            {card.segments.map((segment, segmentIndex) => {
              if (segment.type === "text") {
                return (
                  <span key={`solution-text-${cardIndex}-${segmentIndex}`}>
                    {segment.value}
                  </span>
                );
              }
              return (
                <span
                  key={`solution-blank-${cardIndex}-${segmentIndex}`}
                  className="cloze-solution-token"
                >
                  {segment.solution}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 CompositeCard.tsx — ./components/flashcards/CompositeCard.tsx

import type { DragEvent } from "react";
import { ClozeCard } from "./ClozeCard";
import { FreeTextCard } from "./FreeTextCard";
import { MultipleChoiceCard } from "./MultipleChoiceCard";
import { TrueFalseCard } from "./TrueFalseCard";
import type { CompositeFlashcard } from "../../lib/flashcards";
import {
  evaluateFlashcardPartResult,
  isFlashcardPartComplete,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";

type CompositeCardProps = {
  card: CompositeFlashcard;
  cardIndex: number;
  submitted: boolean;
  submissionLocked?: boolean;
  partStates: CompositePartState[];
  onOptionSelect: (cardIndex: number, partIndex: number, keys: string[]) => void;
  onTrueFalseSelect: (
    cardIndex: number,
    partIndex: number,
    itemId: string,
    value: TrueFalseSelection,
  ) => void;
  onClozeInputChange: (
    cardIndex: number,
    partIndex: number,
    blankId: string,
    value: string,
  ) => void;
  onClozeTokenDrop: (
    event: DragEvent<HTMLElement>,
    cardIndex: number,
    partIndex: number,
    blankId: string,
    validTokenIds: Set<string>,
    dragBlankIds: Set<string>,
  ) => void;
  onClozeTokenRemove: (cardIndex: number, partIndex: number, blankId: string) => void;
  onClozeTokenDragStart: (
    event: DragEvent<HTMLElement>,
    payload: { cardIndex: number; tokenId: string; partIndex?: number },
  ) => void;
  onBlankDragOver: (event: DragEvent<HTMLElement>) => void;
  onTextInputChange: (cardIndex: number, partIndex: number, value: string) => void;
  onTextCheck: (cardIndex: number, partIndex: number) => void;
  onSelfGrade: (
    cardIndex: number,
    partIndex: number,
    grade: FlashcardSelfGrade,
  ) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const CompositeCard = ({
  card,
  cardIndex,
  submitted,
  submissionLocked = false,
  partStates,
  onBlankDragOver,
  onClozeInputChange,
  onClozeTokenDragStart,
  onClozeTokenDrop,
  onClozeTokenRemove,
  onOptionSelect,
  onSelfGrade,
  onSubmit,
  onTextCheck,
  onTextInputChange,
  onTrueFalseSelect,
}: CompositeCardProps) => {
  const canSubmit =
    card.parts.length > 0 &&
    card.parts.every((part, index) =>
      isFlashcardPartComplete(part, partStates[index] ?? {}),
    );
  const allCorrect = card.parts.every(
    (part, index) =>
      evaluateFlashcardPartResult(part, partStates[index] ?? {}) === "correct",
  );
  const resultLabel = submitted ? (allCorrect ? "Correct" : "Incorrect") : "";

  return (
    <article className="flashcard-item composite-card">
      <div className="composite-parts">
        {card.parts.map((part, partIndex) => {
          const state = partStates[partIndex] ?? {};
          if (part.kind === "cloze") {
            return (
              <ClozeCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                partIndex={partIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                responses={state.clozeResponses ?? {}}
                onInputChange={(index, blankId, value) =>
                  onClozeInputChange(index, partIndex, blankId, value)
                }
                onTokenDrop={(event, index, blankId, validTokenIds, dragBlankIds) =>
                  onClozeTokenDrop(
                    event,
                    index,
                    partIndex,
                    blankId,
                    validTokenIds,
                    dragBlankIds,
                  )
                }
                onTokenRemove={(index, blankId) =>
                  onClozeTokenRemove(index, partIndex, blankId)
                }
                onTokenDragStart={onClozeTokenDragStart}
                onBlankDragOver={onBlankDragOver}
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "true-false") {
            return (
              <TrueFalseCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                selections={state.trueFalseSelections ?? {}}
                onSelect={(index, itemId, value) =>
                  onTrueFalseSelect(index, partIndex, itemId, value)
                }
                onSubmit={onSubmit}
                showSubmit={false}
              />
            );
          }

          if (part.kind === "free-text") {
            return (
              <FreeTextCard
                key={`composite-${cardIndex}-${partIndex}`}
                card={part}
                cardIndex={cardIndex}
                submitted={submitted}
                submissionLocked={submissionLocked}
                response={state.textResponse ?? ""}
                revealed={state.textRevealed ?? false}
                selfGrade={state.selfGrade}
                onInputChange={(index, value) =>
                  onTextInputChange(index, partIndex, value)
                }
                onCheck={(index) => onTextCheck(index, partIndex)}
                onSelfGrade={(index, grade) => onSelfGrade(index, partIndex, grade)}
              />
            );
          }

          return (
            <MultipleChoiceCard
              key={`composite-${cardIndex}-${partIndex}`}
              card={part}
              cardIndex={cardIndex}
              submitted={submitted}
              submissionLocked={submissionLocked}
              selectedKeys={state.selections ?? []}
              onSelect={(index, keys) => onOptionSelect(index, partIndex, keys)}
              onSubmit={onSubmit}
              showSubmit={false}
            />
          );
        })}
      </div>
      <div className="flashcard-actions">
        <button
          type="button"
          className="ghost small flashcard-submit"
          onClick={() => onSubmit(cardIndex, canSubmit)}
          disabled={!canSubmit || submitted || submissionLocked}
        >
          Submit
        </button>
        {submitted ? (
          <span
            className={`flashcard-result ${allCorrect ? "correct" : "incorrect"}`}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
    </article>
  );
};

---

## 📝 FreeTextCard.tsx — ./components/flashcards/FreeTextCard.tsx

import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards";
import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

type FreeTextCardProps = {
  card: FreeTextCardType;
  cardIndex: number;
  submitted: boolean;
  response: string;
  revealed: boolean;
  selfGrade?: FlashcardSelfGrade;
  submissionLocked?: boolean;
  onInputChange: (cardIndex: number, value: string) => void;
  onCheck: (cardIndex: number) => void;
  onSelfGrade: (cardIndex: number, grade: FlashcardSelfGrade) => void;
};

export const FreeTextCard = ({
  card,
  cardIndex,
  submitted,
  response,
  revealed,
  selfGrade,
  submissionLocked = false,
  onInputChange,
  onCheck,
  onSelfGrade,
}: FreeTextCardProps) => {
  const hasInput = response.trim().length > 0;
  const resultLabel = submitted
    ? selfGrade === "correct"
      ? "Correct"
      : "Incorrect"
    : "";

  return (
    <article className="flashcard-item free-text-card">
      <div className="flashcard-text-block">{card.front}</div>
      <textarea
        className="flashcard-input"
        value={response}
        onChange={(event) => onInputChange(cardIndex, event.target.value)}
        placeholder="Your answer"
        aria-label="Your answer"
        disabled={submitted || revealed}
      />
      <div className="flashcard-actions">
        {!revealed ? (
          <button
            type="button"
            className="ghost small flashcard-submit"
            onClick={() => onCheck(cardIndex)}
            disabled={!hasInput || submitted || submissionLocked}
          >
            Check
          </button>
        ) : (
          <>
            <button
              type="button"
              className="primary small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "correct")}
              disabled={submitted || submissionLocked}
            >
              Correct
            </button>
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSelfGrade(cardIndex, "incorrect")}
              disabled={submitted || submissionLocked}
            >
              Incorrect
            </button>
          </>
        )}
        {submitted ? (
          <span
            className={`flashcard-result ${
              selfGrade === "correct" ? "correct" : "incorrect"
            }`}
          >
            {resultLabel}
          </span>
        ) : null}
      </div>
      {revealed ? (
        <div className="flashcard-answer">
          <span className="label">Answer</span>
          <div className="flashcard-answer-text">{card.back}</div>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 MultipleChoiceCard.tsx — ./components/flashcards/MultipleChoiceCard.tsx

import { useMemo } from "react";
import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

const OPTION_LABELS = "abcdefghijklmnopqrstuvwxyz";

const indexToLabel = (index: number) => {
  let label = "";
  let cursor = index;
  do {
    label = OPTION_LABELS[cursor % 26] + label;
    cursor = Math.floor(cursor / 26) - 1;
  } while (cursor >= 0);
  return label;
};

const shuffleOptions = <T,>(options: T[]) => {
  const copy = [...options];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const isExactKeyMatch = (selected: string[], correct: string[]) => {
  if (selected.length !== correct.length) {
    return false;
  }
  const selectedSet = new Set(selected);
  if (selectedSet.size !== correct.length) {
    return false;
  }
  return correct.every((key) => selectedSet.has(key));
};

type MultipleChoiceCardProps = {
  card: MultipleChoiceCardType;
  cardIndex: number;
  submitted: boolean;
  selectedKeys: string[];
  submissionLocked?: boolean;
  showSubmit?: boolean;
  onSelect: (cardIndex: number, keys: string[]) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const MultipleChoiceCard = ({
  card,
  cardIndex,
  submitted,
  selectedKeys,
  submissionLocked = false,
  showSubmit = true,
  onSelect,
  onSubmit,
}: MultipleChoiceCardProps) => {
  const hasSolutions = card.correctKeys.length > 0;
  const isMultiSelect = card.correctKeys.length > 1;
  const selectionIsCorrect =
    hasSolutions && selectedKeys.length > 0
      ? isExactKeyMatch(selectedKeys, card.correctKeys)
      : false;
  const resultLabel = submitted
    ? hasSolutions
      ? selectionIsCorrect
        ? "Correct"
        : "Incorrect"
      : "No solution defined"
    : "";

  const cardSignature = useMemo(() => {
    const optionsSignature = card.options
      .map((option) => `${option.key}:${option.text}`)
      .join("|");
    return [card.question, card.correctKeys.join(","), optionsSignature].join("::");
  }, [card.question, card.correctKeys, card.options]);

  const displayOptions = useMemo(
    () =>
      shuffleOptions(card.options).map((option, index) => ({
        option,
        label: indexToLabel(index),
      })),
    [cardSignature],
  );

  const showActions = showSubmit || submitted;

  return (
    <article className="flashcard-item">
      <h3 className="flashcard-question">{card.question}</h3>
      <ul className="flashcard-options">
        {displayOptions.map(({ option, label }) => {
          const isSelected = selectedKeys.includes(option.key);
          const isCorrect = hasSolutions && card.correctKeys.includes(option.key);
          const isIncorrect = hasSolutions && submitted && isSelected && !isCorrect;
          const optionClasses = [
            "flashcard-option",
            isSelected ? "selected" : "",
            submitted && isCorrect ? "correct" : "",
            isIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={`flashcard-${cardIndex}-${option.key}`}>
              <button
                type="button"
                className={optionClasses}
                onClick={() => {
                  if (isMultiSelect) {
                    const nextKeys = isSelected
                      ? selectedKeys.filter((key) => key !== option.key)
                      : [...selectedKeys, option.key];
                    onSelect(cardIndex, nextKeys);
                    return;
                  }
                  onSelect(cardIndex, [option.key]);
                }}
                disabled={submitted}
                aria-pressed={isSelected}
              >
                <span className="flashcard-key">{label}</span>
                <span className="flashcard-text">{option.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, selectedKeys.length > 0)}
              disabled={selectedKeys.length === 0 || submitted || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span
              className={`flashcard-result ${
                hasSolutions ? (selectionIsCorrect ? "correct" : "incorrect") : "neutral"
              }`}
            >
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 TrueFalseCard.tsx — ./components/flashcards/TrueFalseCard.tsx

import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards";
import {
  areTrueFalseItemsComplete,
  isTrueFalseCardCorrect,
  type TrueFalseSelection,
} from "../../features/flashcards/logic";

type TrueFalseCardProps = {
  card: TrueFalseCardType;
  cardIndex: number;
  submitted: boolean;
  selections: Record<string, TrueFalseSelection>;
  submissionLocked?: boolean;
  showSubmit?: boolean;
  onSelect: (cardIndex: number, itemId: string, value: TrueFalseSelection) => void;
  onSubmit: (cardIndex: number, canSubmit: boolean) => void;
};

export const TrueFalseCard = ({
  card,
  cardIndex,
  submitted,
  selections,
  submissionLocked = false,
  showSubmit = true,
  onSelect,
  onSubmit,
}: TrueFalseCardProps) => {
  const canSubmit = areTrueFalseItemsComplete(card, selections);
  const isCorrect = isTrueFalseCardCorrect(card, selections);
  const resultLabel = submitted ? (isCorrect ? "Correct" : "Incorrect") : "";
  const showActions = showSubmit || submitted;

  return (
    <article className="flashcard-item truefalse-card">
      <h3 className="flashcard-question">True/False</h3>
      <ul className="truefalse-list">
        {card.items.map((item) => {
          const selected = selections[item.id];
          const isItemCorrect = submitted && selected === item.correct;
          const isItemIncorrect = submitted && selected && selected !== item.correct;
          const trueClasses = [
            "truefalse-option",
            selected === "wahr" ? "selected" : "",
            submitted && item.correct === "wahr" ? "correct" : "",
            submitted && selected === "wahr" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const falseClasses = [
            "truefalse-option",
            selected === "falsch" ? "selected" : "",
            submitted && item.correct === "falsch" ? "correct" : "",
            submitted && selected === "falsch" && isItemIncorrect ? "incorrect" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li key={item.id} className="truefalse-item">
              <div className="truefalse-question">{item.question}</div>
              <div className="truefalse-options">
                <button
                  type="button"
                  className={trueClasses}
                  onClick={() => onSelect(cardIndex, item.id, "wahr")}
                  aria-pressed={selected === "wahr"}
                  disabled={submitted}
                >
                  True
                </button>
                <button
                  type="button"
                  className={falseClasses}
                  onClick={() => onSelect(cardIndex, item.id, "falsch")}
                  aria-pressed={selected === "falsch"}
                  disabled={submitted}
                >
                  False
                </button>
              </div>
              {submitted ? (
                <span
                  className={`truefalse-result ${
                    isItemCorrect ? "correct" : "incorrect"
                  }`}
                >
                  {isItemCorrect ? "Correct" : "Incorrect"}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {showActions ? (
        <div className="flashcard-actions">
          {showSubmit ? (
            <button
              type="button"
              className="ghost small flashcard-submit"
              onClick={() => onSubmit(cardIndex, canSubmit)}
              disabled={submitted || !canSubmit || submissionLocked}
            >
              Submit
            </button>
          ) : null}
          {submitted ? (
            <span className={`flashcard-result ${isCorrect ? "correct" : "incorrect"}`}>
              {resultLabel}
            </span>
          ) : null}
        </div>
      ) : null}
      {submitted ? (
        <div className="truefalse-solution">
          <span className="label">Solution</span>
          <ul className="truefalse-solution-list">
            {card.items.map((item) => (
              <li key={`solution-${item.id}`} className="truefalse-solution-item">
                <span>{item.question}</span>
                <span className="truefalse-solution-answer">
                  {item.correct === "wahr" ? "True" : "False"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
};

---

## 📝 icons.tsx — ./components/icons.tsx

export const FolderIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const FileIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M14 4v5h5" />
  </svg>
);

---

## 📝 KpiGrid.tsx — ./components/KpiGrid.tsx

type KpiItem = {
  label: string;
  value: number;
};

type KpiGridProps = {
  items: KpiItem[];
};

export const KpiGrid = ({ items }: KpiGridProps) => (
  <div className="kpi-grid">
    {items.map((kpi) => (
      <div key={kpi.label} className="kpi-card">
        <span className="kpi-label">{kpi.label}</span>
        <span className="kpi-value">{kpi.value}</span>
      </div>
    ))}
  </div>
);

---

## 📝 PreviewPanel.tsx — ./components/PreviewPanel.tsx

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import { type LoadState } from "../lib/types";
import { type VaultFile } from "../lib/tree";

type PreviewPanelProps = {
  editDraft: string;
  editError: string;
  isEditing: boolean;
  isSaving: boolean;
  emptyPreview: string;
  preview: string;
  previewError: string;
  previewState: LoadState;
  rawPreview: boolean;
  selectedFile: VaultFile | null;
  canEdit: boolean;
  onEditCancel: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditStart: () => void;
  setRawPreview: (value: boolean | ((prev: boolean) => boolean)) => void;
};

export const PreviewPanel = ({
  editDraft,
  editError,
  isEditing,
  isSaving,
  emptyPreview,
  preview,
  previewError,
  previewState,
  rawPreview,
  selectedFile,
  canEdit,
  onEditCancel,
  onEditChange,
  onEditSave,
  onEditStart,
  setRawPreview,
}: PreviewPanelProps) => (
  <section className="panel preview-panel">
    <div className="panel-header">
      <div>
        <h2>Vorschau</h2>
        <p className="muted">
          {selectedFile?.relative_path ?? "Keine Datei ausgewaehlt"}
        </p>
      </div>
      <div className="preview-actions">
        <button
          type="button"
          className={`ghost small ${rawPreview ? "active" : ""}`}
          onClick={() => setRawPreview((prev) => !prev)}
          aria-pressed={rawPreview}
          disabled={!selectedFile || isEditing}
        >
          {rawPreview ? "Markdown" : "Rohtext"}
        </button>
        {previewState === "loading" ? <span className="chip">Lade...</span> : null}
      </div>
    </div>
    <div className="panel-body preview-body">
      {previewState === "error" ? <div className="error">{previewError}</div> : null}
      <div className="preview-content">
        {isEditing ? (
          <textarea
            className="preview-editor"
            value={editDraft}
            onChange={(event) => onEditChange(event.target.value)}
            aria-label="Edit markdown preview"
          />
        ) : preview ? (
          <div className={`preview ${rawPreview ? "raw" : "markdown"}`}>
            {rawPreview ? (
              <pre>{preview}</pre>
            ) : (
              <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
                {preview}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div className="preview placeholder">{emptyPreview}</div>
        )}
      </div>
      {editError ? <div className="error">{editError}</div> : null}
      {selectedFile ? (
        <div className="preview-edit-actions">
          {isEditing ? (
            <>
              <button
                type="button"
                className="primary small preview-edit-button"
                onClick={onEditSave}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="ghost small preview-edit-button"
                onClick={onEditCancel}
                disabled={isSaving}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary small preview-edit-button"
              onClick={onEditStart}
              disabled={!canEdit}
            >
              Edit
            </button>
          )}
        </div>
      ) : null}
    </div>
  </section>
);

---

## 📝 AppearanceSection.tsx — ./components/settings/AppearanceSection.tsx

import { type ThemeMode } from "../../lib/theme";

type AppearanceSectionProps = {
  accentColor: string;
  accentDraft: string;
  accentError: string;
  onAccentInputChange: (value: string) => void;
  onAccentPick: (value: string) => void;
  onCopyAccent: () => void;
  onThemeToggle: (nextTheme: ThemeMode) => void;
  theme: ThemeMode;
};

const ACCENT_PALETTE = [
  "#E07A5F",
  "#2F8F83",
  "#3A7D44",
  "#3B82F6",
  "#D97706",
  "#DC2626",
];

export const AppearanceSection = ({
  accentColor,
  accentDraft,
  accentError,
  onAccentInputChange,
  onAccentPick,
  onCopyAccent,
  onThemeToggle,
  theme,
}: AppearanceSectionProps) => (
  <section className="panel appearance-panel">
    <h2>Erscheinungsbild</h2>
    <p className="muted">
      Theme und Akzentfarbe praegen die Oberflaeche und bleiben gespeichert.
    </p>
    <div className="setting-row">
      <span className="label">Theme</span>
      <div className="theme-toggle">
        <span className="toggle-label">Hell</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={theme === "dark"}
            onChange={(event) =>
              onThemeToggle(event.target.checked ? "dark" : "light")
            }
            aria-label="Theme umschalten"
          />
          <span className="slider" />
        </label>
        <span className="toggle-label">Dunkel</span>
      </div>
      <span className="helper-text">
        Wechselt Hintergrund, Kontrast und Panels.
      </span>
    </div>
    <div className="setting-row">
      <span className="label">Akzentfarbe</span>
      <div className="accent-controls">
        <input
          type="color"
          className="color-wheel"
          value={accentColor}
          onChange={(event) => onAccentPick(event.target.value)}
          aria-label="Akzentfarbe auswaehlen"
        />
        <div className="accent-palette">
          {ACCENT_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`accent-swatch ${accentColor === color ? "active" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => onAccentPick(color)}
              aria-label={`Akzentfarbe ${color}`}
            />
          ))}
        </div>
      </div>
      <div className="accent-hex">
        <input
          type="text"
          className="hex-input"
          value={accentDraft}
          onChange={(event) => onAccentInputChange(event.target.value)}
          placeholder="#RRGGBB"
          aria-label="Akzentfarbe als HEX"
        />
        <button type="button" className="ghost small" onClick={onCopyAccent}>
          Kopieren
        </button>
      </div>
      <span className={`helper-text ${accentError ? "error-text" : ""}`}>
        {accentError || "HEX Wert der Akzentfarbe (#RRGGBB)."}
      </span>
    </div>
  </section>
);

---

## 📝 DataSyncTabContent.tsx — ./components/settings/DataSyncTabContent.tsx

type AppLanguage = "de" | "en";

const LANGUAGE_LABELS: Record<
  AppLanguage,
  { heading: string; placeholder: string; deLabel: string; enLabel: string }
> = {
  de: {
    heading: "Sprache",
    placeholder: "Kommt spaeter.",
    deLabel: "Deutsch",
    enLabel: "Englisch",
  },
  en: {
    heading: "Language",
    placeholder: "Coming later.",
    deLabel: "German",
    enLabel: "English",
  },
};

export const DataSyncTabContent = () => (
  <>
    <p className="muted">Storage and sync options will land here later.</p>
    <div className="setting-row">
      <span className="label">Local storage path</span>
      <input
        type="text"
        className="text-input"
        value="—"
        disabled
        aria-label="Local storage path"
      />
    </div>
    <div className="setting-row">
      <span className="label">Export / Import (JSON)</span>
      <div className="setting-actions">
        <button type="button" className="ghost small" disabled>
          Export JSON
        </button>
        <button type="button" className="ghost small" disabled>
          Import JSON
        </button>
      </div>
      <span className="helper-text">Coming later.</span>
    </div>
    <div className="setting-row">
      <span className="label">Sync provider</span>
      <input
        type="text"
        className="text-input"
        value="Coming later"
        disabled
        aria-label="Sync provider"
      />
    </div>
  </>
);

type LanguageTabContentProps = {
  language: AppLanguage;
  onLanguageChange: (value: AppLanguage) => void;
};

export const LanguageTabContent = ({
  language,
  onLanguageChange,
}: LanguageTabContentProps) => {
  const labels = LANGUAGE_LABELS[language];
  return (
    <>
      <p className="muted">{labels.placeholder}</p>
      <div className="setting-row">
        <span className="label">{labels.heading}</span>
        <div className="pill-grid">
          <button
            type="button"
            className={`pill pill-button ${language === "de" ? "active" : ""}`}
            aria-pressed={language === "de"}
            onClick={() => onLanguageChange("de")}
          >
            {labels.deLabel}
          </button>
          <button
            type="button"
            className={`pill pill-button ${language === "en" ? "active" : ""}`}
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            {labels.enLabel}
          </button>
        </div>
        <span className="helper-text">{labels.placeholder}</span>
      </div>
    </>
  );
};

---

## 📝 FastFlashcardToolsSettings.tsx — ./components/settings/FastFlashcardToolsSettings.tsx

import { type FlashcardMode, type FlashcardOrder, type FlashcardScope } from "../../features/flashcards/useFlashcards";

type FastFlashcardToolsSettingsProps = {
  fastFlashcardOrder: FlashcardOrder;
  fastFlashcardMode: FlashcardMode;
  fastFlashcardScope: FlashcardScope;
  setFastFlashcardOrder: (value: FlashcardOrder) => void;
  setFastFlashcardMode: (value: FlashcardMode) => void;
  setFastFlashcardScope: (value: FlashcardScope) => void;
  showSectionDividers?: boolean;
};

export const FastFlashcardToolsSettings = ({
  fastFlashcardOrder,
  fastFlashcardMode,
  fastFlashcardScope,
  setFastFlashcardOrder,
  setFastFlashcardMode,
  setFastFlashcardScope,
  showSectionDividers = false,
}: FastFlashcardToolsSettingsProps) => {
  const containerClass = [
    "fast-flashcard-tools-settings",
    showSectionDividers ? "fast-flashcard-tools-settings--dividers" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">ORDER</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "in-order" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "in-order"}
              onClick={() => setFastFlashcardOrder("in-order")}
            >
              In order
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardOrder === "random" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardOrder === "random"}
              onClick={() => setFastFlashcardOrder("random")}
            >
              Random
            </button>
          </div>
        </div>
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">MODE</span>
          <select
            className="text-input"
            value={fastFlashcardMode}
            onChange={(event) =>
              setFastFlashcardMode(event.target.value as FlashcardMode)
            }
            aria-label="Select mode filter"
          >
            <option value="all">All</option>
            <option value="qa">Q&amp;A</option>
            <option value="multiple-choice">Multiple Choice</option>
            <option value="fill-blank">Fill-in-the-blank</option>
            <option value="assignment">Assignment</option>
            <option value="true-false">True/False</option>
            <option value="mix">Mix</option>
          </select>
        </div>
      </div>
      <div className="fast-flashcard-tools-settings-section">
        <div className="toolbar-section">
          <span className="label">DEFAULT SCOPE</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "current" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "current"}
              onClick={() => setFastFlashcardScope("current")}
            >
              Current note
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                fastFlashcardScope === "vault" ? "active" : ""
              }`}
              aria-pressed={fastFlashcardScope === "vault"}
              onClick={() => setFastFlashcardScope("vault")}
            >
              Whole vault
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

---

## 📝 FlashcardsSettingsSection.tsx — ./components/settings/FlashcardsSettingsSection.tsx

import type {
  FlashcardOrder,
  FlashcardPageSize,
  FlashcardScope,
  StatsResetMode,
} from "../../features/flashcards/useFlashcards";

type FlashcardsSettingsSectionProps = {
  flashcardOrder: FlashcardOrder;
  flashcardPageSize: FlashcardPageSize;
  flashcardPageSizes: FlashcardPageSize[];
  flashcardScope: FlashcardScope;
  setFlashcardOrder: (value: FlashcardOrder) => void;
  setFlashcardPageSize: (value: FlashcardPageSize) => void;
  setFlashcardScope: (value: FlashcardScope) => void;
  setSolutionRevealEnabled: (value: boolean) => void;
  setStatsResetMode: (value: StatsResetMode) => void;
  solutionRevealEnabled: boolean;
  statsResetMode: StatsResetMode;
};

export const FlashcardsSettingsSection = ({
  flashcardOrder,
  flashcardPageSize,
  flashcardPageSizes,
  flashcardScope,
  setFlashcardOrder,
  setFlashcardPageSize,
  setFlashcardScope,
  setSolutionRevealEnabled,
  setStatsResetMode,
  solutionRevealEnabled,
  statsResetMode,
}: FlashcardsSettingsSectionProps) => (
  <section className="panel settings-flashcards-panel">
    <h2>Flashcard</h2>
    <p className="muted">Default behavior for scans and review sessions.</p>
    <div className="setting-row">
      <span className="label">Default scope</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${
            flashcardScope === "current" ? "active" : ""
          }`}
          aria-pressed={flashcardScope === "current"}
          onClick={() => setFlashcardScope("current")}
        >
          Current note
        </button>
        <button
          type="button"
          className={`pill pill-button ${flashcardScope === "vault" ? "active" : ""}`}
          aria-pressed={flashcardScope === "vault"}
          onClick={() => setFlashcardScope("vault")}
        >
          Whole vault
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Default order</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${
            flashcardOrder === "in-order" ? "active" : ""
          }`}
          aria-pressed={flashcardOrder === "in-order"}
          onClick={() => setFlashcardOrder("in-order")}
        >
          In order
        </button>
        <button
          type="button"
          className={`pill pill-button ${flashcardOrder === "random" ? "active" : ""}`}
          aria-pressed={flashcardOrder === "random"}
          onClick={() => setFlashcardOrder("random")}
        >
          Random
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Page size</span>
      <div className="pill-grid">
        {flashcardPageSizes.map((size) => (
          <button
            key={size}
            type="button"
            className={`pill pill-button ${
              flashcardPageSize === size ? "active" : ""
            }`}
            aria-pressed={flashcardPageSize === size}
            onClick={() => setFlashcardPageSize(size)}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Solution reveal</span>
      <div className="toggle-row">
        <span className="toggle-label">{solutionRevealEnabled ? "On" : "Off"}</span>
        <label className="switch">
          <input
            type="checkbox"
            checked={solutionRevealEnabled}
            onChange={(event) => setSolutionRevealEnabled(event.target.checked)}
            aria-label="Solution reveal"
          />
          <span className="slider" />
        </label>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Statistics reset</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${statsResetMode === "scan" ? "active" : ""}`}
          aria-pressed={statsResetMode === "scan"}
          onClick={() => setStatsResetMode("scan")}
        >
          Per scan
        </button>
        <button
          type="button"
          className={`pill pill-button ${statsResetMode === "session" ? "active" : ""}`}
          aria-pressed={statsResetMode === "session"}
          onClick={() => setStatsResetMode("session")}
        >
          Per session
        </button>
      </div>
    </div>
  </section>
);

---

## 📝 PerformanceTabContent.tsx — ./components/settings/PerformanceTabContent.tsx

type PerformanceTabContentProps = {
  maxFilesPerScan: string;
  onMaxFilesPerScanChange: (value: string) => void;
  scanParallelism: "low" | "medium" | "high";
  setScanParallelism: (value: "low" | "medium" | "high") => void;
};

export const PerformanceTabContent = ({
  maxFilesPerScan,
  onMaxFilesPerScanChange,
  scanParallelism,
  setScanParallelism,
}: PerformanceTabContentProps) => (
  <>
    <p className="muted">Tune vault scans for larger libraries.</p>
    <div className="setting-row">
      <span className="label">Max files per vault scan</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="text-input"
        value={maxFilesPerScan}
        onChange={(event) => onMaxFilesPerScanChange(event.target.value)}
        placeholder="Optional"
        aria-label="Max files per vault scan"
      />
      <span className="helper-text">Leave empty for no limit.</span>
    </div>
    <div className="setting-row">
      <span className="label">Scan parallelism</span>
      <div className="pill-grid">
        {(["low", "medium", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`pill pill-button ${scanParallelism === level ? "active" : ""}`}
            aria-pressed={scanParallelism === level}
            onClick={() => setScanParallelism(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Watcher debounce/throttle</span>
      <input
        type="text"
        className="text-input"
        value="Coming later"
        disabled
        aria-label="Watcher debounce or throttle (coming later)"
      />
    </div>
  </>
);

---

## 📝 SpacedRepetitionSettingsSection.tsx — ./components/settings/SpacedRepetitionSettingsSection.tsx

import type {
  SpacedRepetitionBoxes,
  SpacedRepetitionOrder,
  SpacedRepetitionPageSize,
  SpacedRepetitionRepetitionStrength,
} from "../../features/spaced-repetition/useSpacedRepetition";

type SpacedRepetitionSettingsSectionProps = {
  spacedRepetitionBoxes: SpacedRepetitionBoxes;
  spacedRepetitionBoxOptions: SpacedRepetitionBoxes[];
  spacedRepetitionOrder: SpacedRepetitionOrder;
  spacedRepetitionPageSize: SpacedRepetitionPageSize;
  spacedRepetitionPageSizes: SpacedRepetitionPageSize[];
  spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
  setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
  setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
  setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
  setSpacedRepetitionRepetitionStrength: (
    value: SpacedRepetitionRepetitionStrength,
  ) => void;
};

export const SpacedRepetitionSettingsSection = ({
  spacedRepetitionBoxes,
  spacedRepetitionBoxOptions,
  spacedRepetitionOrder,
  spacedRepetitionPageSize,
  spacedRepetitionPageSizes,
  spacedRepetitionRepetitionStrength,
  setSpacedRepetitionBoxes,
  setSpacedRepetitionOrder,
  setSpacedRepetitionPageSize,
  setSpacedRepetitionRepetitionStrength,
}: SpacedRepetitionSettingsSectionProps) => (
  <section className="panel spaced-repetition-panel">
    <h2>Spaced Repetition</h2>
    <p className="muted">Configure spaced repetition behavior.</p>
    <div className="setting-row">
      <span className="label">Boxes</span>
      <div className="pill-grid">
        {spacedRepetitionBoxOptions.map((box) => (
          <button
            key={box}
            type="button"
            className={`pill pill-button ${spacedRepetitionBoxes === box ? "active" : ""}`}
            aria-pressed={spacedRepetitionBoxes === box}
            onClick={() => setSpacedRepetitionBoxes(box)}
          >
            {box} Boxes
          </button>
        ))}
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Default order</span>
      <div className="pill-grid">
        <button
          type="button"
          className={`pill pill-button ${
            spacedRepetitionOrder === "in-order" ? "active" : ""
          }`}
          aria-pressed={spacedRepetitionOrder === "in-order"}
          onClick={() => setSpacedRepetitionOrder("in-order")}
        >
          In order
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            spacedRepetitionOrder === "random" ? "active" : ""
          }`}
          aria-pressed={spacedRepetitionOrder === "random"}
          onClick={() => setSpacedRepetitionOrder("random")}
        >
          Random
        </button>
        <button
          type="button"
          className={`pill pill-button ${
            spacedRepetitionOrder === "repetition" ? "active" : ""
          }`}
          aria-pressed={spacedRepetitionOrder === "repetition"}
          onClick={() => setSpacedRepetitionOrder("repetition")}
        >
          Repetition
        </button>
      </div>
      <span className="helper-text">
        In order keeps scan order. Random shuffles on load. Repetition prioritizes
        lower boxes and skips the last box.
      </span>
      {spacedRepetitionOrder === "repetition" && (
        <div className="setting-subrow">
          <span className="label">Repetition strength</span>
          <div className="pill-grid">
            <button
              type="button"
              className={`pill pill-button ${
                spacedRepetitionRepetitionStrength === "weak" ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionRepetitionStrength === "weak"}
              onClick={() => setSpacedRepetitionRepetitionStrength("weak")}
            >
              Weak
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                spacedRepetitionRepetitionStrength === "medium" ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionRepetitionStrength === "medium"}
              onClick={() => setSpacedRepetitionRepetitionStrength("medium")}
            >
              Medium
            </button>
            <button
              type="button"
              className={`pill pill-button ${
                spacedRepetitionRepetitionStrength === "strong" ? "active" : ""
              }`}
              aria-pressed={spacedRepetitionRepetitionStrength === "strong"}
              onClick={() => setSpacedRepetitionRepetitionStrength("strong")}
            >
              Strong
            </button>
          </div>
        </div>
      )}
    </div>
    <div className="setting-row">
      <span className="label">Page size</span>
      <div className="pill-grid">
        {spacedRepetitionPageSizes.map((size) => (
          <button
            key={size}
            type="button"
            className={`pill pill-button ${
              spacedRepetitionPageSize === size ? "active" : ""
            }`}
            aria-pressed={spacedRepetitionPageSize === size}
            onClick={() => setSpacedRepetitionPageSize(size)}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  </section>
);

---

## 📝 VaultIndexSection.tsx — ./components/settings/VaultIndexSection.tsx

import { type LoadState } from "../../lib/types";

type VaultIndexSectionProps = {
  lastOpenedFile: string | null;
  listState: LoadState;
  onCopyVaultPath: () => void;
  onRescanVault: () => void;
  vaultIndexedComplete: boolean;
  vaultPath: string | null;
};

export const VaultIndexSection = ({
  lastOpenedFile,
  listState,
  onCopyVaultPath,
  onRescanVault,
  vaultIndexedComplete,
  vaultPath,
}: VaultIndexSectionProps) => (
  <section className="panel vault-index-panel">
    <div>
      <h2>Vault &amp; Index</h2>
      <p className="muted">Vault path, last opened note, and index status.</p>
    </div>
    <div className="setting-row">
      <span className="label">Current vault path</span>
      <div className="setting-inline">
        <span className="value path-value">{vaultPath ?? "—"}</span>
        <button
          type="button"
          className="ghost small"
          onClick={onCopyVaultPath}
          disabled={!vaultPath}
        >
          Copy
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Last opened</span>
      <span className="value path-value">{lastOpenedFile ?? "Not loaded yet"}</span>
    </div>
    <div className="setting-row">
      <span className="label">Status indicators</span>
      <div className="status-list">
        <div className="status-item">
          <label className="status-checkbox">
            <input
              type="checkbox"
              checked={vaultIndexedComplete}
              disabled
              aria-label="Fully processed"
            />
            <span>Fully processed</span>
          </label>
          <span className="helper-text">All notes have been scanned and indexed.</span>
        </div>
        <div className="status-item">
          <div className="status-row">
            <span>Watcher active</span>
            <div className="toggle-row">
              <span className="toggle-label">Coming later</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  aria-label="Watcher active (coming later)"
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
        <div className="status-item">
          <div className="status-row">
            <span>Auto-scan</span>
            <div className="toggle-row">
              <span className="toggle-label">Coming later</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  aria-label="Auto-scan (coming later)"
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Actions</span>
      <div className="setting-actions">
        <button
          type="button"
          className="ghost small"
          onClick={onRescanVault}
          disabled={!vaultPath || listState === "loading"}
        >
          Rescan vault
        </button>
        <button type="button" className="ghost small" disabled>
          Reset index
        </button>
      </div>
      <span className="helper-text">Reset index is coming later.</span>
    </div>
  </section>
);

---

## 📝 SidebarNav.tsx — ./components/SidebarNav.tsx

import { useMemo } from "react";
import { useAppState } from "./AppStateProvider";
import { vaultBaseName } from "../lib/path";

type TabKey =
  | "dashboard"
  | "flashcard"
  | "spaced-repetition"
  | "fast-flashcard"
  | "help"
  | "settings";

type SidebarNavProps = {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  isMobileNavOpen: boolean;
  onMobileNavClose: () => void;
};

export const SidebarNav = ({
  activeTab,
  onTabChange,
  isMobileNavOpen,
  onMobileNavClose,
}: SidebarNavProps) => {
  const { actions, settings, vault } = useAppState();
  const vaultRootName = useMemo(
    () => vaultBaseName(vault.vaultPath),
    [vault.vaultPath],
  );
  const isCollapsed = settings.rightToolbarCollapsed && !isMobileNavOpen;

  return (
    <aside
      id="app-sidebar"
      className={`sidebar ${isCollapsed ? "collapsed" : ""}`}
      aria-label="Primary navigation"
    >
      {isCollapsed ? (
        <button
          type="button"
          className="sidebar-rail"
          onClick={() => settings.setRightToolbarCollapsed(false)}
          aria-label="Expand toolbar"
        >
          <span className="rail-arrow">&gt;</span>
        </button>
      ) : (
        <>
          <div className="brand">
            <button
              type="button"
              className="brand-mark"
              onClick={() => settings.setRightToolbarCollapsed(true)}
              aria-label="Collapse toolbar"
            >
              FMD
            </button>
            <div className="brand-text">
              <span className="brand-title">FMD Flashcard</span>
              <span className="brand-sub">Vault-first study workspace</span>
            </div>
            <button
              type="button"
              className="mobile-nav-close"
              onClick={onMobileNavClose}
              aria-label="Close navigation"
            >
              Close
            </button>
          </div>
          <nav className="nav">
            <button
              type="button"
              className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => onTabChange("dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-item ${activeTab === "flashcard" ? "active" : ""}`}
              onClick={() => onTabChange("flashcard")}
            >
              Flashcard
            </button>
            <button
              type="button"
              className={`nav-item ${
                activeTab === "fast-flashcard" ? "active" : ""
              }`}
              onClick={() => onTabChange("fast-flashcard")}
            >
              Fast Flashcard
            </button>
            <button
              type="button"
              className={`nav-item ${
                activeTab === "spaced-repetition" ? "active" : ""
              }`}
              onClick={() => onTabChange("spaced-repetition")}
            >
              Spaced Repetition
            </button>
            <button
              type="button"
              className={`nav-item nav-item-help ${
                activeTab === "help" ? "active" : ""
              }`}
              onClick={() => onTabChange("help")}
            >
              <span>Help</span>
              <span className="nav-subtext">
                Quick reminders for this workflow.
              </span>
            </button>
          </nav>
          <div className="sidebar-footer">
            <button
              type="button"
              className="vault-status"
              onClick={actions.handlePickVault}
              title={vault.vaultPath ?? "Vault auswaehlen"}
              aria-label="Vault auswaehlen"
            >
              <span className="label">Aktiver Vault</span>
              <span className="value">
                Vault: {vault.vaultPath ? vaultRootName : "Nicht gesetzt"}
              </span>
            </button>
            <button
              type="button"
              className={`nav-icon ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => onTabChange("settings")}
              aria-label="Einstellungen"
              title="Einstellungen"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="4" y1="6" x2="20" y2="6" />
                <circle cx="9" cy="6" r="2.5" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <circle cx="14" cy="12" r="2.5" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="11" cy="18" r="2.5" />
              </svg>
            </button>
          </div>
        </>
      )}
    </aside>
  );
};

---

## 📝 StatsPanel.tsx — ./components/StatsPanel.tsx

import { useMemo, type CSSProperties } from "react";

type StatsPanelProps = {
  correctCount: number;
  correctPercent: number;
  incorrectCount: number;
  totalQuestions: number;
};

export const StatsPanel = ({
  correctCount,
  correctPercent,
  incorrectCount,
  totalQuestions,
}: StatsPanelProps) => {
  const statsTotal = correctCount + incorrectCount;
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";

  return (
    <section className="panel stats-panel">
      <div className="panel-header">
        <div>
          <h2>Statistics</h2>
        </div>
      </div>
      <div className="panel-body">
        <div className="stats-summary">
          <div className="stats-counters">
            <div className="stats-counter">
              <span className="stats-label">Correct</span>
              <span className="stats-value">{correctCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Incorrect</span>
              <span className="stats-value">{incorrectCount}</span>
            </div>
            <div className="stats-counter">
              <span className="stats-label">Total</span>
              <span className="stats-value">{totalQuestions}</span>
            </div>
          </div>
          <div
            className={statsChartClass}
            style={statsChartStyle}
            role="img"
            aria-label={`Correct ${correctCount}, Incorrect ${incorrectCount}, Total ${totalQuestions}`}
          >
            <div className="stats-chart-label">
              <span className="stats-chart-total">{totalQuestions}</span>
              <span className="stats-chart-caption">Total</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

---

## 📝 VaultTree.tsx — ./components/VaultTree.tsx

import { useMemo } from "react";
import { FileIcon, FolderIcon } from "./icons";
import { vaultBaseName } from "../lib/path";
import { buildTree, type TreeNode, type VaultFile } from "../lib/tree";
import { type LoadState } from "../lib/types";

type VaultTreeProps = {
  fileCountLabel: string;
  files: VaultFile[];
  listError: string;
  listState: LoadState;
  onSelectFile: (file: VaultFile) => void;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
};

export const VaultTree = ({
  fileCountLabel,
  files,
  listError,
  listState,
  onSelectFile,
  selectedFile,
  vaultPath,
}: VaultTreeProps) => {
  const vaultRootName = useMemo(() => vaultBaseName(vaultPath), [vaultPath]);
  const treeNodes = useMemo(() => buildTree(files), [files]);

  const renderTreeNodes = (nodes: TreeNode[]) =>
    nodes.map((node) => {
      if (node.type === "dir") {
        return (
          <details className="tree-dir" key={node.path}>
            <summary className="tree-item">
              <span className="tree-icon">
                <FolderIcon />
              </span>
              <span className="tree-name">{node.name}</span>
            </summary>
            <div className="tree-children">{renderTreeNodes(node.children ?? [])}</div>
          </details>
        );
      }

      const fileRef =
        node.file ??
        (node.fullPath ? { path: node.fullPath, relative_path: node.path } : null);
      const isActive = !!fileRef && selectedFile?.path === fileRef.path;

      return (
        <button
          type="button"
          key={node.path}
          className={`tree-item tree-file ${isActive ? "active" : ""}`}
          onClick={() => fileRef && onSelectFile(fileRef)}
          title={node.path}
          disabled={!fileRef}
        >
          <span className="tree-icon">
            <FileIcon />
          </span>
          <span className="tree-name">{node.name}</span>
        </button>
      );
    });

  return (
    <details className="vault-details">
      <summary>
        <span>Datenverzeichnis</span>
        <span className="vault-summary">{fileCountLabel}</span>
      </summary>
      <div className="vault-body">
        {!vaultPath ? (
          <div className="empty-state">
            Waehle einen Vault, um das Verzeichnis anzuzeigen.
          </div>
        ) : null}
        {listState === "loading" ? <span className="chip">Scanne...</span> : null}
        {listError ? <div className="error">{listError}</div> : null}
        {vaultPath && listState === "idle" && treeNodes.length === 0 ? (
          <div className="empty-state">Keine Markdown-Dateien in diesem Vault.</div>
        ) : null}
        {vaultPath && listState === "idle" && treeNodes.length > 0 ? (
          <div className="vault-tree">
            <details className="tree-dir" open>
              <summary className="tree-item">
                <span className="tree-icon">
                  <FolderIcon />
                </span>
                <span className="tree-name">{vaultRootName}</span>
              </summary>
              <div className="tree-children">{renderTreeNodes(treeNodes)}</div>
            </details>
          </div>
        ) : null}
      </div>
    </details>
  );
};

---

## 📝 logic.ts — ./features/flashcards/logic.ts

import type { DragEvent } from "react";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  type ClozeSegment,
  type FlashcardPart,
  type Flashcard,
} from "../../lib/flashcards";

export type TrueFalseSelection = "wahr" | "falsch";
export type FlashcardResult = "correct" | "incorrect" | "neutral";
export type FlashcardSelfGrade = Exclude<FlashcardResult, "neutral">;

export type FlashcardStats = {
  correctCount: number;
  incorrectCount: number;
  correctPercent: number;
};

export type ClozeDragPayload = {
  cardIndex: number;
  tokenId: string;
  partIndex?: number;
};

export type CompositePartState = {
  selections?: string[];
  trueFalseSelections?: Record<string, TrueFalseSelection>;
  clozeResponses?: Record<string, string>;
  textResponse?: string;
  textRevealed?: boolean;
  selfGrade?: FlashcardSelfGrade;
};

type ClozeBlankSegment = Extract<ClozeSegment, { type: "blank" }>;

export const CLOZE_TOKEN_DRAG_TYPE = "application/x-cloze-token";

export const setClozeDragPayload = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.setData(CLOZE_TOKEN_DRAG_TYPE, JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "move";
};

export const getClozeDragPayload = (event: DragEvent<HTMLElement>) => {
  const raw = event.dataTransfer.getData(CLOZE_TOKEN_DRAG_TYPE);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ClozeDragPayload;
    if (typeof parsed.cardIndex !== "number" || typeof parsed.tokenId !== "string") {
      return null;
    }
    if (
      "partIndex" in parsed &&
      typeof parsed.partIndex !== "number" &&
      parsed.partIndex !== undefined
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const handleClozeTokenDragStart = (
  event: DragEvent<HTMLElement>,
  payload: ClozeDragPayload,
) => {
  event.dataTransfer.clearData();
  setClozeDragPayload(event, payload);
};

export const handleClozeBlankDragOver = (event: DragEvent<HTMLElement>) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
};

export const shuffleFlashcards = <T,>(cards: T[]) => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const getClozeBlanks = (segments: ClozeSegment[]) =>
  segments.filter((segment): segment is ClozeBlankSegment => segment.type === "blank");

const isClozeBlankFilled = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return value.trim().length > 0;
  }
  return tokenById.has(value);
};

const isClozeBlankCorrect = (
  blank: ClozeBlankSegment,
  responses: Record<string, string>,
  tokenById: Map<string, string>,
) => {
  const value = responses[blank.id] ?? "";
  if (blank.kind === "input") {
    return isInputAnswerMatch(value, blank.solution);
  }
  return isDragAnswerMatch(tokenById.get(value) ?? "", blank.solution);
};

export const areClozeBlanksComplete = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankFilled(blank, responses, tokenById));
};

export const isClozeCardCorrect = (
  card: Extract<Flashcard, { kind: "cloze" }>,
  responses: Record<string, string>,
) => {
  const blanks = getClozeBlanks(card.segments);
  if (blanks.length === 0) {
    return false;
  }
  const tokenById = new Map(card.dragTokens.map((token) => [token.id, token.value]));
  return blanks.every((blank) => isClozeBlankCorrect(blank, responses, tokenById));
};

export const areTrueFalseItemsComplete = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => Boolean(selections[item.id]));
};

export const isTrueFalseCardCorrect = (
  card: Extract<Flashcard, { kind: "true-false" }>,
  selections: Record<string, TrueFalseSelection>,
) => {
  if (card.items.length === 0) {
    return false;
  }
  return card.items.every((item) => selections[item.id] === item.correct);
};

export const isFlashcardPartComplete = (
  part: FlashcardPart,
  state: CompositePartState = {},
) => {
  if (part.kind === "multiple-choice") {
    return (state.selections ?? []).length > 0;
  }
  if (part.kind === "true-false") {
    return areTrueFalseItemsComplete(part, state.trueFalseSelections ?? {});
  }
  if (part.kind === "cloze") {
    return areClozeBlanksComplete(part, state.clozeResponses ?? {});
  }
  return Boolean(state.selfGrade);
};

const isExactKeyMatch = (selected: string[], correct: string[]) => {
  if (selected.length !== correct.length) {
    return false;
  }
  const selectedSet = new Set(selected);
  if (selectedSet.size !== correct.length) {
    return false;
  }
  return correct.every((key) => selectedSet.has(key));
};

export const evaluateFlashcardPartResult = (
  part: FlashcardPart,
  state: CompositePartState = {},
): FlashcardResult => {
  if (part.kind === "multiple-choice") {
    if (part.correctKeys.length === 0) {
      return "neutral";
    }
    const selected = state.selections ?? [];
    return isExactKeyMatch(selected, part.correctKeys) ? "correct" : "incorrect";
  }

  if (part.kind === "true-false") {
    const selections = state.trueFalseSelections ?? {};
    return isTrueFalseCardCorrect(part, selections) ? "correct" : "incorrect";
  }

  if (part.kind === "cloze") {
    const responses = state.clozeResponses ?? {};
    return isClozeCardCorrect(part, responses) ? "correct" : "incorrect";
  }

  return state.selfGrade ?? "neutral";
};

export const evaluateFlashcardResult = (
  card: Flashcard,
  cardIndex: number,
  selections: Record<number, string[]>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
  selfGrades: Record<number, FlashcardSelfGrade> = {},
  compositeStates?: Record<number, CompositePartState[]>,
): FlashcardResult => {
  if (card.kind === "composite") {
    const partStates = compositeStates?.[cardIndex] ?? [];
    const allCorrect = card.parts.every((part, partIndex) =>
      evaluateFlashcardPartResult(part, partStates[partIndex] ?? {}),
    );
    return allCorrect ? "correct" : "incorrect";
  }

  if (card.kind === "multiple-choice") {
    if (card.correctKeys.length === 0) {
      return "neutral";
    }
    const selected = selections[cardIndex] ?? [];
    return isExactKeyMatch(selected, card.correctKeys) ? "correct" : "incorrect";
  }

  if (card.kind === "true-false") {
    if (card.items.length === 0) {
      return "neutral";
    }
    const selectionsForCard = trueFalseSelections[cardIndex] ?? {};
    return isTrueFalseCardCorrect(card, selectionsForCard) ? "correct" : "incorrect";
  }

  if (card.kind === "cloze") {
    const blanks = getClozeBlanks(card.segments);
    if (blanks.length === 0) {
      return "neutral";
    }
    const responses = clozeResponses[cardIndex] ?? {};
    return isClozeCardCorrect(card, responses) ? "correct" : "incorrect";
  }

  const grade = selfGrades[cardIndex];
  return grade ?? "neutral";
};

export const calculateFlashcardStats = (
  flashcards: Flashcard[],
  submissions: Record<number, boolean>,
  selections: Record<number, string[]>,
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>,
  clozeResponses: Record<number, Record<string, string>>,
  selfGrades: Record<number, FlashcardSelfGrade> = {},
  compositeStates?: Record<number, CompositePartState[]>,
): FlashcardStats => {
  let correct = 0;
  let incorrect = 0;

  flashcards.forEach((card, index) => {
    if (!submissions[index]) {
      return;
    }
    const result = evaluateFlashcardResult(
      card,
      index,
      selections,
      trueFalseSelections,
      clozeResponses,
      selfGrades,
      compositeStates,
    );
    if (result === "correct") {
      correct += 1;
    } else if (result === "incorrect") {
      incorrect += 1;
    }
  });

  const total = correct + incorrect;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
};

---

## 📝 useFlashcards.ts — ./features/flashcards/useFlashcards.ts

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  parseFlashcards,
  type Flashcard,
  type FlashcardDetectedType,
  type FlashcardPart,
} from "../../lib/flashcards";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  handleClozeBlankDragOver,
  handleClozeTokenDragStart,
  shuffleFlashcards,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "./logic";
import { type VaultFile } from "../../lib/tree";

export type FlashcardOrder = "in-order" | "random";
export type FlashcardMode =
  | "all"
  | "qa"
  | "multiple-choice"
  | "mix"
  | "fill-blank"
  | "assignment"
  | "true-false"
  | "yes-no";
export type FlashcardScope = "current" | "vault";
export type FlashcardPageSize = 1 | 2 | 3 | 5;
export type StatsResetMode = "scan" | "session";

export const FLASHCARD_PAGE_SIZES: FlashcardPageSize[] = [1, 2, 3, 5];
export const DEFAULT_FLASHCARD_PAGE_SIZE: FlashcardPageSize = 2;

const normalizeFlashcardPageSize = (value: number) => {
  if (value === 10) {
    return 5;
  }
  return FLASHCARD_PAGE_SIZES.includes(value as FlashcardPageSize)
    ? (value as FlashcardPageSize)
    : DEFAULT_FLASHCARD_PAGE_SIZE;
};

const normalizeFlashcardMode = (
  mode: FlashcardMode,
): Exclude<FlashcardMode, "yes-no"> =>
  mode === "yes-no" ? "true-false" : mode;

const getDetectedTypesForPart = (card: FlashcardPart): FlashcardDetectedType[] => {
  if (card.kind === "multiple-choice") {
    return ["multiple-choice"];
  }
  if (card.kind === "true-false") {
    return ["true-false"];
  }
  if (card.kind === "free-text") {
    return ["qa"];
  }

  const types: FlashcardDetectedType[] = [];
  const hasInputBlank = card.segments.some(
    (segment) => segment.type === "blank" && segment.kind === "input",
  );
  const hasDragBlank = card.segments.some(
    (segment) => segment.type === "blank" && segment.kind === "drag",
  );
  if (hasInputBlank) {
    types.push("fill-blank");
  }
  if (hasDragBlank) {
    types.push("assignment");
  }
  return types.length > 0 ? types : ["fill-blank"];
};

const getPrimaryTypeFromKind = (card: Flashcard): FlashcardDetectedType => {
  if (card.primaryType) {
    return card.primaryType;
  }
  if (card.kind === "composite") {
    const detected = card.detectedTypes ?? [];
    if (detected.length > 0) {
      return detected[0];
    }
    const partTypes = card.parts.flatMap(getDetectedTypesForPart);
    return partTypes[0] ?? "qa";
  }
  if (card.kind === "multiple-choice") {
    return "multiple-choice";
  }
  if (card.kind === "true-false") {
    return "true-false";
  }
  if (card.kind === "cloze") {
    const hasInputBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "input",
    );
    const hasDragBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "drag",
    );
    if (hasDragBlank && !hasInputBlank) {
      return "assignment";
    }
    return "fill-blank";
  }
  return "qa";
};

const getDetectedTypes = (card: Flashcard): FlashcardDetectedType[] => {
  const detected = card.detectedTypes;
  if (detected && detected.length > 0) {
    return detected;
  }
  if (card.kind === "composite") {
    const types: FlashcardDetectedType[] = [];
    card.parts.forEach((part) => {
      getDetectedTypesForPart(part).forEach((type) => {
        if (!types.includes(type)) {
          types.push(type);
        }
      });
    });
    return types.length > 0 ? types : ["qa"];
  }
  if (card.kind === "cloze") {
    const types: FlashcardDetectedType[] = [];
    const hasInputBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "input",
    );
    const hasDragBlank = card.segments.some(
      (segment) => segment.type === "blank" && segment.kind === "drag",
    );
    if (hasInputBlank) {
      types.push("fill-blank");
    }
    if (hasDragBlank) {
      types.push("assignment");
    }
    if (types.length > 0) {
      return types;
    }
  }
  return [card.primaryType ?? getPrimaryTypeFromKind(card)];
};

const matchesFlashcardMode = (card: Flashcard, mode: FlashcardMode) => {
  const resolvedMode = normalizeFlashcardMode(mode);
  if (resolvedMode === "all") {
    return true;
  }
  const detectedTypes = getDetectedTypes(card);
  const isMix = card.isMixed ?? detectedTypes.length >= 2;
  if (resolvedMode === "mix") {
    return isMix;
  }
  if (isMix) {
    return false;
  }
  const primaryType = card.primaryType ?? getPrimaryTypeFromKind(card);
  return primaryType === resolvedMode;
};

type ScanOptions = {
  scopeOverride?: FlashcardScope;
  allowVaultFallback?: boolean;
  orderOverride?: FlashcardOrder;
};

type UseFlashcardsOptions = {
  files: VaultFile[];
  preview: string;
  selectedFile: VaultFile | null;
  vaultPath: string | null;
  settings: {
    flashcardMode: FlashcardMode;
    flashcardOrder: FlashcardOrder;
    flashcardPageSize: FlashcardPageSize;
    flashcardScope: FlashcardScope;
    setFlashcardMode: (value: FlashcardMode) => void;
    setFlashcardOrder: (value: FlashcardOrder) => void;
    setFlashcardPageSize: (value: FlashcardPageSize) => void;
    setFlashcardScope: (value: FlashcardScope) => void;
    setSolutionRevealEnabled: (value: boolean) => void;
    setStatsResetMode: (value: StatsResetMode) => void;
    solutionRevealEnabled: boolean;
    statsResetMode: StatsResetMode;
  };
};

export const useFlashcards = ({
  files,
  preview,
  selectedFile,
  vaultPath,
  settings,
}: UseFlashcardsOptions) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const {
    flashcardMode,
    flashcardOrder,
    flashcardPageSize,
    flashcardScope,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
  } = settings;
  const [flashcardPage, setFlashcardPage] = useState(0);
  const [isFlashcardScanning, setIsFlashcardScanning] = useState(false);
  const [flashcardSelections, setFlashcardSelections] = useState<
    Record<number, string[]>
  >({});
  const [flashcardTextResponses, setFlashcardTextResponses] = useState<
    Record<number, string>
  >({});
  const [flashcardTextRevealed, setFlashcardTextRevealed] = useState<
    Record<number, boolean>
  >({});
  const [flashcardSelfGrades, setFlashcardSelfGrades] = useState<
    Record<number, FlashcardSelfGrade>
  >({});
  const [flashcardSubmissions, setFlashcardSubmissions] = useState<
    Record<number, boolean>
  >({});
  const [flashcardTrueFalseSelections, setFlashcardTrueFalseSelections] =
    useState<Record<number, Record<string, TrueFalseSelection>>>({});
  const [flashcardClozeResponses, setFlashcardClozeResponses] = useState<
    Record<number, Record<string, string>>
  >({});
  const [flashcardCompositeStates, setFlashcardCompositeStates] = useState<
    Record<number, CompositePartState[]>
  >({});
  const takeSnapshot = useCallback(
    () => ({
      flashcards,
      flashcardSelections,
      flashcardTextResponses,
      flashcardTextRevealed,
      flashcardSelfGrades,
      flashcardSubmissions,
      flashcardTrueFalseSelections,
      flashcardClozeResponses,
      flashcardCompositeStates,
      flashcardPage,
    }),
    [
      flashcardClozeResponses,
      flashcardCompositeStates,
      flashcardPage,
      flashcardSelections,
      flashcardSelfGrades,
      flashcardSubmissions,
      flashcardTextResponses,
      flashcardTextRevealed,
      flashcardTrueFalseSelections,
      flashcards,
    ],
  );

  const restoreSnapshot = useCallback(
    (snapshot: {
      flashcards: Flashcard[];
      flashcardSelections: Record<number, string[]>;
      flashcardTextResponses: Record<number, string>;
      flashcardTextRevealed: Record<number, boolean>;
      flashcardSelfGrades: Record<number, FlashcardSelfGrade>;
      flashcardSubmissions: Record<number, boolean>;
      flashcardTrueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
      flashcardClozeResponses: Record<number, Record<string, string>>;
      flashcardCompositeStates: Record<number, CompositePartState[]>;
      flashcardPage: number;
    }) => {
      setFlashcards(snapshot.flashcards);
      setFlashcardSelections(snapshot.flashcardSelections);
      setFlashcardTextResponses(snapshot.flashcardTextResponses);
      setFlashcardTextRevealed(snapshot.flashcardTextRevealed);
      setFlashcardSelfGrades(snapshot.flashcardSelfGrades);
      setFlashcardSubmissions(snapshot.flashcardSubmissions);
      setFlashcardTrueFalseSelections(snapshot.flashcardTrueFalseSelections);
      setFlashcardClozeResponses(snapshot.flashcardClozeResponses);
      setFlashcardCompositeStates(snapshot.flashcardCompositeStates);
      setFlashcardPage(snapshot.flashcardPage);
    },
    [],
  );

  const resolvedFlashcardPageSize = useMemo(
    () => normalizeFlashcardPageSize(flashcardPageSize),
    [flashcardPageSize],
  );

  const filteredFlashcardIndices = useMemo(() => {
    return flashcards.reduce<number[]>((accumulator, card, cardIndex) => {
      if (matchesFlashcardMode(card, flashcardMode)) {
        accumulator.push(cardIndex);
      }
      return accumulator;
    }, []);
  }, [flashcards, flashcardMode]);

  const orderedFlashcardIndices = useMemo(() => {
    if (flashcardOrder === "random") {
      return shuffleFlashcards(filteredFlashcardIndices);
    }
    return filteredFlashcardIndices;
  }, [filteredFlashcardIndices, flashcardOrder]);

  const orderedFlashcardEntries = useMemo(
    () =>
      orderedFlashcardIndices.map((cardIndex) => ({
        cardIndex,
        card: flashcards[cardIndex]!,
      })),
    [flashcards, orderedFlashcardIndices],
  );

  const flashcardPageCount = useMemo(
    () => Math.ceil(orderedFlashcardIndices.length / resolvedFlashcardPageSize),
    [orderedFlashcardIndices.length, resolvedFlashcardPageSize],
  );

  const flashcardPageIndex = useMemo(
    () => Math.min(flashcardPage, Math.max(0, flashcardPageCount - 1)),
    [flashcardPage, flashcardPageCount],
  );

  const flashcardPageStart = flashcardPageIndex * resolvedFlashcardPageSize;

  const visibleFlashcardEntries = useMemo(() => {
    return orderedFlashcardIndices
      .slice(flashcardPageStart, flashcardPageStart + resolvedFlashcardPageSize)
      .map((cardIndex) => ({
        cardIndex,
        card: flashcards[cardIndex]!,
      }));
  }, [
    flashcardPageStart,
    flashcards,
    orderedFlashcardIndices,
    resolvedFlashcardPageSize,
  ]);

  const visibleFlashcards = useMemo(
    () => visibleFlashcardEntries.map((entry) => entry.card),
    [visibleFlashcardEntries],
  );

  const filteredFlashcardCount = orderedFlashcardIndices.length;

  const canGoBack = flashcardPageIndex > 0;
  const canGoNext = flashcardPageIndex < flashcardPageCount - 1;

  const { correctCount, incorrectCount, correctPercent } = useMemo(() => {
    let correct = 0;
    let incorrect = 0;

    orderedFlashcardIndices.forEach((cardIndex) => {
      if (!flashcardSubmissions[cardIndex]) {
        return;
      }
      const card = flashcards[cardIndex];
      if (!card) {
        return;
      }
      const result = evaluateFlashcardResult(
        card,
        cardIndex,
        flashcardSelections,
        flashcardTrueFalseSelections,
        flashcardClozeResponses,
        flashcardSelfGrades,
        flashcardCompositeStates,
      );
      if (result === "correct") {
        correct += 1;
      } else if (result === "incorrect") {
        incorrect += 1;
      }
    });

    const total = correct + incorrect;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correctCount: correct, incorrectCount: incorrect, correctPercent: percent };
  }, [
    flashcardClozeResponses,
    flashcardCompositeStates,
    flashcardSelections,
    flashcardSelfGrades,
    flashcardSubmissions,
    flashcardTrueFalseSelections,
    flashcards,
    orderedFlashcardIndices,
  ]);

  useEffect(() => {
    const normalized = normalizeFlashcardPageSize(flashcardPageSize);
    if (normalized !== flashcardPageSize) {
      setFlashcardPageSize(normalized);
    }
  }, [flashcardPageSize]);

  useEffect(() => {
    const maxPage = Math.max(0, flashcardPageCount - 1);
    if (flashcardPage > maxPage) {
      setFlashcardPage(maxPage);
    }
  }, [flashcardPage, flashcardPageCount]);

  const resetFlashcards = useCallback((options?: { keepScanning?: boolean }) => {
    setFlashcards([]);
    setFlashcardSelections({});
    setFlashcardTextResponses({});
    setFlashcardTextRevealed({});
    setFlashcardSelfGrades({});
    setFlashcardSubmissions({});
    setFlashcardTrueFalseSelections({});
    setFlashcardClozeResponses({});
    setFlashcardCompositeStates({});
    setFlashcardPage(0);
    if (!options?.keepScanning) {
      setIsFlashcardScanning(false);
    }
  }, []);

  const scanFlashcards = useCallback(
    async (options?: ScanOptions) => {
      const scope = options?.scopeOverride ?? flashcardScope;
      const shouldFallbackToVault =
        options?.allowVaultFallback && scope === "current" && !selectedFile;
      const resolvedScope = shouldFallbackToVault ? "vault" : scope;

      if (resolvedScope === "vault") {
        if (!vaultPath || files.length === 0) {
          return [];
        }

        const results = await Promise.allSettled(
          files.map(async (file) => {
            const contents = await invoke<string>("read_text_file", {
              path: file.path,
            });
            return parseFlashcards(contents);
          }),
        );

        const merged: Flashcard[] = [];
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            merged.push(...result.value);
          } else {
            console.warn(
              "Failed to read markdown file",
              files[index]?.path,
              result.reason,
            );
          }
        });

        return merged;
      }

      const cards = parseFlashcards(preview);
      return cards;
    },
    [files, flashcardScope, preview, selectedFile, vaultPath],
  );

  const handleFlashcardScan = useCallback(async () => {
    setIsFlashcardScanning(true);
    resetFlashcards({ keepScanning: true });

    try {
      const cards = await scanFlashcards();
      setFlashcards(cards);
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [resetFlashcards, scanFlashcards]);

  const handleFlashcardOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const uniqueKeys = Array.from(new Set(keys));
      setFlashcardSelections((prev) => ({ ...prev, [cardIndex]: uniqueKeys }));
    },
    [flashcardSubmissions],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: TrueFalseSelection) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardTrueFalseSelections((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        current[itemId] = value;
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  const handleFlashcardSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!canSubmit) {
        return;
      }
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSubmissions((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions],
  );

  const handleFlashcardTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      if (flashcardSubmissions[cardIndex] || flashcardTextRevealed[cardIndex]) {
        return;
      }
      setFlashcardTextResponses((prev) => ({ ...prev, [cardIndex]: value }));
    },
    [flashcardSubmissions, flashcardTextRevealed],
  );

  const handleFlashcardTextCheck = useCallback(
    (cardIndex: number) => {
      if (flashcardSubmissions[cardIndex] || flashcardTextRevealed[cardIndex]) {
        return;
      }
      setFlashcardTextRevealed((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions, flashcardTextRevealed],
  );

  const handleFlashcardSelfGrade = useCallback(
    (cardIndex: number, grade: FlashcardSelfGrade) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardSelfGrades((prev) => ({ ...prev, [cardIndex]: grade }));
      setFlashcardSubmissions((prev) => ({ ...prev, [cardIndex]: true }));
    },
    [flashcardSubmissions],
  );

  const updateCompositePartState = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      setFlashcardCompositeStates((prev) => {
        const nextParts = [...(prev[cardIndex] ?? [])];
        const current = nextParts[partIndex] ?? {};
        const nextState = updater(current);
        nextParts[partIndex] = nextState;
        return { ...prev, [cardIndex]: nextParts };
      });
    },
    [],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const uniqueKeys = Array.from(new Set(keys));
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: TrueFalseSelection) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex || payload.partIndex !== partIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        const existingBlankId = Object.entries(responses).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete responses[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          responses[blankId] = payload.tokenId;
        }
        return { ...current, clozeResponses: responses };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textResponse: value };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textRevealed: true };
      });
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: FlashcardSelfGrade) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selfGrade: grade,
      }));
    },
    [flashcardSubmissions, updateCompositePartState],
  );

  const handleFlashcardPageBack = useCallback(() => {
    setFlashcardPage((prev) => Math.max(0, prev - 1));
  }, []);

  const handleFlashcardPageNext = useCallback(() => {
    if (flashcardPageCount <= 0) {
      return;
    }
    setFlashcardPage((prev) => Math.min(flashcardPageCount - 1, prev + 1));
  }, [flashcardPageCount]);

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        current[blankId] = value;
        return { ...prev, [cardIndex]: current };
      });
    },
    [],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        const existingBlankId = Object.entries(current).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete current[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          current[blankId] = payload.tokenId;
        }
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      if (flashcardSubmissions[cardIndex]) {
        return;
      }
      setFlashcardClozeResponses((prev) => {
        const current = { ...(prev[cardIndex] ?? {}) };
        delete current[blankId];
        return { ...prev, [cardIndex]: current };
      });
    },
    [flashcardSubmissions],
  );

  return {
    canGoBack,
    canGoNext,
    correctCount,
    flashcardClozeResponses,
    flashcardCompositeStates,
    flashcardMode,
    flashcardOrder,
    flashcardPage,
    flashcardPageCount,
    flashcardPageIndex,
    flashcardPageSize,
    flashcardPageStart,
    flashcardScope,
    flashcardSelections,
    flashcardSelfGrades,
    flashcardSubmissions,
    flashcardTextResponses,
    flashcardTextRevealed,
    flashcardTrueFalseSelections,
    flashcards,
    filteredFlashcardCount,
    handleClozeBlankDragOver,
    handleClozeInputChange,
    handleClozeTokenDragStart,
    handleClozeTokenDrop,
    handleClozeTokenRemove,
    handleFlashcardOptionSelect,
    handleFlashcardPageBack,
    handleFlashcardPageNext,
    handleFlashcardScan,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
    handleFlashcardTextCheck,
    handleFlashcardTextInputChange,
    handleTrueFalseSelect,
    handleCompositeOptionSelect,
    handleCompositeTrueFalseSelect,
    handleCompositeClozeInputChange,
    handleCompositeClozeTokenDrop,
    handleCompositeClozeTokenRemove,
    handleCompositeTextInputChange,
    handleCompositeTextCheck,
    handleCompositeSelfGrade,
    incorrectCount,
    isFlashcardScanning,
    resetFlashcards,
    restoreSnapshot,
    scanFlashcards,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setIsFlashcardScanning,
    setSolutionRevealEnabled,
    setStatsResetMode,
    solutionRevealEnabled,
    statsResetMode,
    takeSnapshot,
    orderedFlashcardEntries,
    visibleFlashcardEntries,
    visibleFlashcards,
    correctPercent,
  };
};

---

## 📝 usePreview.ts — ./features/preview/usePreview.ts

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

export type PreviewSnapshot = {
  selectedFile: VaultFile | null;
  preview: string;
  previewState: LoadState;
  previewError: string;
  rawPreview: boolean;
};

export const usePreview = () => {
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [preview, setPreview] = useState("");
  const [previewState, setPreviewState] = useState<LoadState>("idle");
  const [previewError, setPreviewError] = useState("");
  const [rawPreview, setRawPreview] = useState(false);

  const takeSnapshot = useCallback(
    (): PreviewSnapshot => ({
      selectedFile,
      preview,
      previewState,
      previewError,
      rawPreview,
    }),
    [preview, previewError, previewState, rawPreview, selectedFile],
  );

  const restoreSnapshot = useCallback((snapshot: PreviewSnapshot) => {
    setSelectedFile(snapshot.selectedFile);
    setPreview(snapshot.preview);
    setPreviewState(snapshot.previewState);
    setPreviewError(snapshot.previewError);
    setRawPreview(snapshot.rawPreview);
  }, []);

  const resetPreview = useCallback(() => {
    setSelectedFile(null);
    setPreview("");
    setPreviewState("idle");
    setPreviewError("");
  }, []);

  const selectFile = useCallback(async (file: VaultFile) => {
    setSelectedFile(file);
    setPreview("");
    setPreviewError("");
    setPreviewState("loading");
    try {
      const contents = await invoke<string>("read_text_file", {
        path: file.path,
      });
      setPreview(contents);
      setPreviewState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Failed to load file contents.");
      setPreviewError(message);
      setPreviewState("error");
    }
  }, []);

  return {
    preview,
    previewError,
    previewState,
    rawPreview,
    resetPreview,
    restoreSnapshot,
    selectFile,
    selectedFile,
    setPreview,
    setPreviewError,
    setPreviewState,
    setRawPreview,
    takeSnapshot,
  };
};

---

## 📝 useAppSettings.ts — ./features/settings/useAppSettings.ts

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color";
import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme";
import {
  DEFAULT_FLASHCARD_PAGE_SIZE,
  FLASHCARD_PAGE_SIZES,
  type FlashcardMode,
  type FlashcardOrder,
  type FlashcardPageSize,
  type FlashcardScope,
  type StatsResetMode,
} from "../flashcards/useFlashcards";
import {
  DEFAULT_SPACED_REPETITION_PAGE_SIZE,
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
  type SpacedRepetitionBoxes,
  type SpacedRepetitionOrder,
  type SpacedRepetitionPageSize,
  type SpacedRepetitionRepetitionStrength,
} from "../spaced-repetition/useSpacedRepetition";

type AppLanguage = "de" | "en";
type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";

type AppSettings = {
  active_note_path?: string | null;
  vault_path?: string | null;
  theme?: string | null;
  accent_color?: string | null;
  language?: AppLanguage | null;
  max_files_per_scan?: string | null;
  scan_parallelism?: string | null;
  flashcard_order?: string | null;
  flashcard_mode?: string | null;
  flashcard_scope?: string | null;
  flashcard_page_size?: number | null;
  flashcard_solution_reveal_enabled?: boolean | null;
  flashcard_stats_reset_mode?: string | null;
  fast_flashcard_order?: string | null;
  fast_flashcard_mode?: string | null;
  fast_flashcard_scope?: string | null;
  spaced_repetition_boxes?: number | null;
  spaced_repetition_order?: string | null;
  spaced_repetition_page_size?: number | null;
  spaced_repetition_repetition_strength?: string | null;
  spaced_repetition_stats_view?: string | null;
  right_toolbar_collapsed?: boolean | null;
};

type PersistUpdates = {
  activeNotePath?: string | null;
  vaultPath?: string | null;
  theme?: ThemeMode;
  accentColor?: string;
  language?: AppLanguage;
  maxFilesPerScan?: string;
  scanParallelism?: "low" | "medium" | "high";
  flashcardOrder?: FlashcardOrder;
  flashcardMode?: FlashcardMode;
  flashcardScope?: FlashcardScope;
  flashcardPageSize?: FlashcardPageSize;
  solutionRevealEnabled?: boolean;
  statsResetMode?: StatsResetMode;
  fastFlashcardOrder?: FlashcardOrder;
  fastFlashcardMode?: FlashcardMode;
  fastFlashcardScope?: FlashcardScope;
  spacedRepetitionBoxes?: SpacedRepetitionBoxes;
  spacedRepetitionOrder?: SpacedRepetitionOrder;
  spacedRepetitionPageSize?: SpacedRepetitionPageSize;
  spacedRepetitionRepetitionStrength?: SpacedRepetitionRepetitionStrength;
  spacedRepetitionStatsView?: SpacedRepetitionStatsView;
  rightToolbarCollapsed?: boolean;
};

export const DEFAULT_THEME: ThemeMode = "light";
export const DEFAULT_LANGUAGE: AppLanguage = "de";
const DEFAULT_SCAN_PARALLELISM: "low" | "medium" | "high" = "medium";
const DEFAULT_FLASHCARD_ORDER: FlashcardOrder = "in-order";
const DEFAULT_FLASHCARD_MODE: FlashcardMode = "all";
const DEFAULT_FLASHCARD_SCOPE: FlashcardScope = "current";
const DEFAULT_STATS_RESET_MODE: StatsResetMode = "scan";
const DEFAULT_FAST_FLASHCARD_ORDER: FlashcardOrder = DEFAULT_FLASHCARD_ORDER;
const DEFAULT_FAST_FLASHCARD_MODE: FlashcardMode = DEFAULT_FLASHCARD_MODE;
const DEFAULT_FAST_FLASHCARD_SCOPE: FlashcardScope = DEFAULT_FLASHCARD_SCOPE;
const DEFAULT_SPACED_REPETITION_BOXES: SpacedRepetitionBoxes = 5;
const DEFAULT_SPACED_REPETITION_ORDER: SpacedRepetitionOrder = "in-order";
const DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH: SpacedRepetitionRepetitionStrength =
  "medium";
const DEFAULT_SPACED_REPETITION_STATS_VIEW: SpacedRepetitionStatsView = "boxes";
const DEFAULT_RIGHT_TOOLBAR_COLLAPSED = false;

export const useAppSettings = () => {
  const [theme, setTheme] = useState<ThemeMode>(DEFAULT_THEME);
  const [accentColor, setAccentColor] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [accentError, setAccentError] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [activeNotePath, setActiveNotePath] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [language, setLanguage] = useState<AppLanguage>(DEFAULT_LANGUAGE);
  const [maxFilesPerScan, setMaxFilesPerScan] = useState("");
  const [scanParallelism, setScanParallelism] = useState<
    "low" | "medium" | "high"
  >(DEFAULT_SCAN_PARALLELISM);
  const [flashcardOrder, setFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FLASHCARD_ORDER);
  const [flashcardMode, setFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FLASHCARD_MODE);
  const [flashcardScope, setFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FLASHCARD_SCOPE);
  const [flashcardPageSize, setFlashcardPageSize] =
    useState<FlashcardPageSize>(DEFAULT_FLASHCARD_PAGE_SIZE);
  const [solutionRevealEnabled, setSolutionRevealEnabled] = useState(true);
  const [statsResetMode, setStatsResetMode] =
    useState<StatsResetMode>(DEFAULT_STATS_RESET_MODE);
  const [fastFlashcardOrder, setFastFlashcardOrder] =
    useState<FlashcardOrder>(DEFAULT_FAST_FLASHCARD_ORDER);
  const [fastFlashcardMode, setFastFlashcardMode] =
    useState<FlashcardMode>(DEFAULT_FAST_FLASHCARD_MODE);
  const [fastFlashcardScope, setFastFlashcardScope] =
    useState<FlashcardScope>(DEFAULT_FAST_FLASHCARD_SCOPE);
  const [spacedRepetitionBoxes, setSpacedRepetitionBoxes] =
    useState<SpacedRepetitionBoxes>(DEFAULT_SPACED_REPETITION_BOXES);
  const [spacedRepetitionOrder, setSpacedRepetitionOrder] =
    useState<SpacedRepetitionOrder>(DEFAULT_SPACED_REPETITION_ORDER);
  const [spacedRepetitionPageSize, setSpacedRepetitionPageSize] =
    useState<SpacedRepetitionPageSize>(DEFAULT_SPACED_REPETITION_PAGE_SIZE);
  const [
    spacedRepetitionRepetitionStrength,
    setSpacedRepetitionRepetitionStrength,
  ] = useState<SpacedRepetitionRepetitionStrength>(
    DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH,
  );
  const [spacedRepetitionStatsView, setSpacedRepetitionStatsView] =
    useState<SpacedRepetitionStatsView>(DEFAULT_SPACED_REPETITION_STATS_VIEW);
  const [rightToolbarCollapsed, setRightToolbarCollapsed] = useState(
    DEFAULT_RIGHT_TOOLBAR_COLLAPSED,
  );
  const autoSaveReady = useRef(false);
  const autoSaveTimer = useRef<number | null>(null);

  const saveSettings = useCallback(
      async (settings: {
        activeNotePath: string | null;
        vaultPath: string | null;
        theme: ThemeMode;
        accentColor: string;
        language: AppLanguage;
        maxFilesPerScan: string;
        scanParallelism: "low" | "medium" | "high";
        flashcardOrder: FlashcardOrder;
        flashcardMode: FlashcardMode;
        flashcardScope: FlashcardScope;
        flashcardPageSize: FlashcardPageSize;
        solutionRevealEnabled: boolean;
        statsResetMode: StatsResetMode;
        spacedRepetitionBoxes: SpacedRepetitionBoxes;
        spacedRepetitionOrder: SpacedRepetitionOrder;
        spacedRepetitionPageSize: SpacedRepetitionPageSize;
        spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
        spacedRepetitionStatsView: SpacedRepetitionStatsView;
        rightToolbarCollapsed: boolean;
        fastFlashcardOrder: FlashcardOrder;
        fastFlashcardMode: FlashcardMode;
        fastFlashcardScope: FlashcardScope;
      }) => {
      try {
        await invoke("save_app_settings", {
          activeNotePath: settings.activeNotePath,
          vaultPath: settings.vaultPath,
          theme: settings.theme,
          accentColor: settings.accentColor,
          language: settings.language,
          maxFilesPerScan: settings.maxFilesPerScan || null,
          scanParallelism: settings.scanParallelism,
          flashcardOrder: settings.flashcardOrder,
          flashcardMode: settings.flashcardMode,
          flashcardScope: settings.flashcardScope,
          flashcardPageSize: settings.flashcardPageSize,
          flashcardSolutionRevealEnabled: settings.solutionRevealEnabled,
          flashcardStatsResetMode: settings.statsResetMode,
          fastFlashcardOrder: settings.fastFlashcardOrder,
          fastFlashcardMode: settings.fastFlashcardMode,
          fastFlashcardScope: settings.fastFlashcardScope,
          spacedRepetitionBoxes: settings.spacedRepetitionBoxes,
          spacedRepetitionOrder: settings.spacedRepetitionOrder,
          spacedRepetitionPageSize: settings.spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength:
            settings.spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView: settings.spacedRepetitionStatsView,
          rightToolbarCollapsed: settings.rightToolbarCollapsed,
        });
        return true;
      } catch (error) {
        console.error("Failed to save settings", error);
        return false;
      }
    },
    [],
  );

  const persistSettings = useCallback(
    async (updates: PersistUpdates) => {
      if (!settingsLoaded) {
        return false;
      }
      const nextSettings = {
        activeNotePath: updates.activeNotePath ?? activeNotePath,
        vaultPath: updates.vaultPath ?? vaultPath,
        theme: updates.theme ?? theme,
        accentColor: updates.accentColor ?? accentColor,
        language: updates.language ?? language,
        maxFilesPerScan: updates.maxFilesPerScan ?? maxFilesPerScan,
        scanParallelism: updates.scanParallelism ?? scanParallelism,
        flashcardOrder: updates.flashcardOrder ?? flashcardOrder,
        flashcardMode: updates.flashcardMode ?? flashcardMode,
        flashcardScope: updates.flashcardScope ?? flashcardScope,
        fastFlashcardOrder: updates.fastFlashcardOrder ?? fastFlashcardOrder,
        fastFlashcardMode: updates.fastFlashcardMode ?? fastFlashcardMode,
        fastFlashcardScope: updates.fastFlashcardScope ?? fastFlashcardScope,
        flashcardPageSize: updates.flashcardPageSize ?? flashcardPageSize,
        solutionRevealEnabled:
          updates.solutionRevealEnabled ?? solutionRevealEnabled,
        statsResetMode: updates.statsResetMode ?? statsResetMode,
        spacedRepetitionBoxes:
          updates.spacedRepetitionBoxes ?? spacedRepetitionBoxes,
        spacedRepetitionOrder:
          updates.spacedRepetitionOrder ?? spacedRepetitionOrder,
        spacedRepetitionPageSize:
          updates.spacedRepetitionPageSize ?? spacedRepetitionPageSize,
        spacedRepetitionRepetitionStrength:
          updates.spacedRepetitionRepetitionStrength ??
          spacedRepetitionRepetitionStrength,
        spacedRepetitionStatsView:
          updates.spacedRepetitionStatsView ?? spacedRepetitionStatsView,
        rightToolbarCollapsed:
          updates.rightToolbarCollapsed ?? rightToolbarCollapsed,
      };
      const saved = await saveSettings(nextSettings);
      if (saved && "activeNotePath" in updates) {
        setActiveNotePath(nextSettings.activeNotePath ?? null);
      }
      if (saved && "vaultPath" in updates) {
        setVaultPath(nextSettings.vaultPath ?? null);
      }
      return saved;
    },
    [
      activeNotePath,
      accentColor,
      flashcardMode,
      flashcardOrder,
      fastFlashcardMode,
      fastFlashcardOrder,
      fastFlashcardScope,
      flashcardPageSize,
      flashcardScope,
      language,
      maxFilesPerScan,
      saveSettings,
      scanParallelism,
      settingsLoaded,
      solutionRevealEnabled,
      spacedRepetitionBoxes,
      spacedRepetitionOrder,
      spacedRepetitionPageSize,
      spacedRepetitionRepetitionStrength,
      spacedRepetitionStatsView,
      statsResetMode,
      theme,
      vaultPath,
      rightToolbarCollapsed,
    ],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSettings = async () => {
      try {
        const settings = await invoke<AppSettings>("load_app_settings");
        if (cancelled) {
          return;
        }

        const storedTheme = settings.theme === "dark" ? "dark" : DEFAULT_THEME;
        const storedAccentRaw = settings.accent_color ?? DEFAULT_ACCENT;
        const storedAccent = normalizeHex(storedAccentRaw);
        const resolvedAccent = isValidHex(storedAccent)
          ? storedAccent
          : DEFAULT_ACCENT;
        const storedLanguage =
          settings.language === "en" ? "en" : DEFAULT_LANGUAGE;
        const maxFilesRaw = settings.max_files_per_scan;
        const maxFilesValue =
          typeof maxFilesRaw === "number"
            ? String(maxFilesRaw)
            : typeof maxFilesRaw === "string"
              ? maxFilesRaw.trim()
              : "";
        const storedMaxFilesPerScan =
          maxFilesValue && /^[0-9]+$/.test(maxFilesValue) ? maxFilesValue : "";
        const storedScanParallelism =
          settings.scan_parallelism === "low" ||
          settings.scan_parallelism === "high" ||
          settings.scan_parallelism === "medium"
            ? settings.scan_parallelism
            : DEFAULT_SCAN_PARALLELISM;
        const storedFlashcardOrder =
          settings.flashcard_order === "random"
            ? "random"
            : DEFAULT_FLASHCARD_ORDER;
        const storedFlashcardMode =
          settings.flashcard_mode === "all" ||
          settings.flashcard_mode === "qa" ||
          settings.flashcard_mode === "multiple-choice" ||
          settings.flashcard_mode === "mix" ||
          settings.flashcard_mode === "fill-blank" ||
          settings.flashcard_mode === "assignment" ||
          settings.flashcard_mode === "true-false"
            ? settings.flashcard_mode
            : settings.flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FLASHCARD_MODE;
        const storedFlashcardScope =
          settings.flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FLASHCARD_SCOPE;
        const storedFastFlashcardOrder =
          settings.fast_flashcard_order === "random"
            ? "random"
            : DEFAULT_FAST_FLASHCARD_ORDER;
        const storedFastFlashcardMode =
          settings.fast_flashcard_mode === "all" ||
          settings.fast_flashcard_mode === "qa" ||
          settings.fast_flashcard_mode === "multiple-choice" ||
          settings.fast_flashcard_mode === "mix" ||
          settings.fast_flashcard_mode === "fill-blank" ||
          settings.fast_flashcard_mode === "assignment" ||
          settings.fast_flashcard_mode === "true-false"
            ? settings.fast_flashcard_mode
            : settings.fast_flashcard_mode === "yes-no"
              ? "true-false"
              : DEFAULT_FAST_FLASHCARD_MODE;
        const storedFastFlashcardScope =
          settings.fast_flashcard_scope === "vault"
            ? "vault"
            : DEFAULT_FAST_FLASHCARD_SCOPE;
        const storedFlashcardPageSizeRaw = settings.flashcard_page_size;
        const migratedFlashcardPageSize =
          storedFlashcardPageSizeRaw === 10
            ? 5
            : storedFlashcardPageSizeRaw;
        const storedFlashcardPageSize =
          typeof migratedFlashcardPageSize === "number" &&
          FLASHCARD_PAGE_SIZES.includes(
            migratedFlashcardPageSize as FlashcardPageSize,
          )
            ? (migratedFlashcardPageSize as FlashcardPageSize)
            : DEFAULT_FLASHCARD_PAGE_SIZE;
        const storedSolutionRevealEnabled =
          typeof settings.flashcard_solution_reveal_enabled === "boolean"
            ? settings.flashcard_solution_reveal_enabled
            : true;
        const storedStatsResetMode =
          settings.flashcard_stats_reset_mode === "session"
            ? "session"
            : DEFAULT_STATS_RESET_MODE;
        const storedSpacedRepetitionBoxes =
          typeof settings.spaced_repetition_boxes === "number" &&
          SPACED_REPETITION_BOXES.includes(
            settings.spaced_repetition_boxes as SpacedRepetitionBoxes,
          )
            ? (settings.spaced_repetition_boxes as SpacedRepetitionBoxes)
            : DEFAULT_SPACED_REPETITION_BOXES;
        const storedSpacedRepetitionOrder =
          settings.spaced_repetition_order === "random" ||
          settings.spaced_repetition_order === "repetition"
            ? settings.spaced_repetition_order
            : DEFAULT_SPACED_REPETITION_ORDER;
        const storedSpacedRepetitionPageSizeRaw =
          settings.spaced_repetition_page_size;
        const migratedSpacedRepetitionPageSize =
          storedSpacedRepetitionPageSizeRaw === 10
            ? 5
            : storedSpacedRepetitionPageSizeRaw;
        const storedSpacedRepetitionPageSize =
          typeof migratedSpacedRepetitionPageSize === "number" &&
          SPACED_REPETITION_PAGE_SIZES.includes(
            migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize,
          )
            ? (migratedSpacedRepetitionPageSize as SpacedRepetitionPageSize)
            : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
        const storedSpacedRepetitionRepetitionStrength =
          settings.spaced_repetition_repetition_strength === "weak" ||
          settings.spaced_repetition_repetition_strength === "strong" ||
          settings.spaced_repetition_repetition_strength === "medium"
            ? settings.spaced_repetition_repetition_strength
            : DEFAULT_SPACED_REPETITION_REPETITION_STRENGTH;
        const storedSpacedRepetitionStatsView =
          settings.spaced_repetition_stats_view === "vault" ||
          settings.spaced_repetition_stats_view === "completed"
            ? settings.spaced_repetition_stats_view
            : DEFAULT_SPACED_REPETITION_STATS_VIEW;
        const storedActiveNotePath =
          typeof settings.active_note_path === "string"
            ? settings.active_note_path
            : null;
        const storedRightToolbarCollapsed =
          typeof settings.right_toolbar_collapsed === "boolean"
            ? settings.right_toolbar_collapsed
            : DEFAULT_RIGHT_TOOLBAR_COLLAPSED;
        setTheme(storedTheme);
        setAccentColor(resolvedAccent);
        setAccentDraft(resolvedAccent);
        setAccentError("");
        setActiveNotePath(storedActiveNotePath);
        setVaultPath(settings.vault_path ?? null);
        setLanguage(storedLanguage);
        setMaxFilesPerScan(storedMaxFilesPerScan);
        setScanParallelism(storedScanParallelism);
        setFlashcardOrder(storedFlashcardOrder);
        setFlashcardMode(storedFlashcardMode);
        setFlashcardScope(storedFlashcardScope);
        setFastFlashcardOrder(storedFastFlashcardOrder);
        setFastFlashcardMode(storedFastFlashcardMode);
        setFastFlashcardScope(storedFastFlashcardScope);
        setFlashcardPageSize(storedFlashcardPageSize);
        setSolutionRevealEnabled(storedSolutionRevealEnabled);
        setStatsResetMode(storedStatsResetMode);
        setSpacedRepetitionBoxes(storedSpacedRepetitionBoxes);
        setSpacedRepetitionOrder(storedSpacedRepetitionOrder);
        setSpacedRepetitionPageSize(storedSpacedRepetitionPageSize);
        setSpacedRepetitionRepetitionStrength(
          storedSpacedRepetitionRepetitionStrength,
        );
        setSpacedRepetitionStatsView(storedSpacedRepetitionStatsView);
        setRightToolbarCollapsed(storedRightToolbarCollapsed);
        setSettingsLoaded(true);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load settings", error);
          setSettingsLoaded(true);
        }
      }
    };

    void restoreSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    if (!autoSaveReady.current) {
      autoSaveReady.current = true;
      return;
    }
    if (autoSaveTimer.current) {
      window.clearTimeout(autoSaveTimer.current);
    }
      autoSaveTimer.current = window.setTimeout(() => {
        void saveSettings({
          activeNotePath,
          vaultPath,
          theme,
          accentColor,
          language,
          maxFilesPerScan,
          scanParallelism,
          flashcardOrder,
          flashcardMode,
          flashcardScope,
          flashcardPageSize,
          solutionRevealEnabled,
          statsResetMode,
          spacedRepetitionBoxes,
          spacedRepetitionOrder,
          spacedRepetitionPageSize,
          spacedRepetitionRepetitionStrength,
          spacedRepetitionStatsView,
          rightToolbarCollapsed,
          fastFlashcardOrder,
          fastFlashcardMode,
          fastFlashcardScope,
        });
      }, 300);

    return () => {
      if (autoSaveTimer.current) {
        window.clearTimeout(autoSaveTimer.current);
      }
    };
  }, [
    accentColor,
    activeNotePath,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    saveSettings,
    scanParallelism,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  ]);

  return {
    accentColor,
    activeNotePath,
    accentDraft,
    accentError,
    flashcardMode,
    flashcardOrder,
    fastFlashcardMode,
    fastFlashcardOrder,
    fastFlashcardScope,
    flashcardPageSize,
    flashcardScope,
    language,
    maxFilesPerScan,
    persistSettings,
    scanParallelism,
    setAccentColor,
    setAccentDraft,
    setAccentError,
    setActiveNotePath,
    setFlashcardMode,
    setFlashcardOrder,
    setFlashcardPageSize,
    setFlashcardScope,
    setFastFlashcardMode,
    setFastFlashcardOrder,
    setFastFlashcardScope,
    setLanguage,
    setMaxFilesPerScan,
    setRightToolbarCollapsed,
    setScanParallelism,
    setSolutionRevealEnabled,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
    setStatsResetMode,
    setTheme,
    settingsLoaded,
    solutionRevealEnabled,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    statsResetMode,
    theme,
    vaultPath,
    rightToolbarCollapsed,
  };
};

---

## 📝 logic.ts — ./features/spaced-repetition/logic.ts

import type { Flashcard, FlashcardPart } from "../../lib/flashcards";
import type {
  CompositePartState,
  FlashcardResult,
  FlashcardSelfGrade,
  TrueFalseSelection,
} from "../flashcards/logic";

export const MAX_SPACED_REPETITION_BOX = 8;
export type SpacedRepetitionRepetitionStrength = "weak" | "medium" | "strong";

// Index 0..7 maps to boxes 1..8 for weighted repetition order.
const REPETITION_WEIGHTS: Record<SpacedRepetitionRepetitionStrength, number[]> = {
  weak: [6, 5, 4, 3, 2, 2, 1, 1],
  medium: [8, 5, 3, 2, 1, 1, 1, 1],
  strong: [12, 6, 3, 2, 1, 1, 1, 1],
};

export type SpacedRepetitionCardProgress = {
  boxCanonical: number;
  attempts: number;
  lastResult: FlashcardResult;
  lastReviewedAt: string | null;
};

type SpacedRepetitionCardProgressInput = Partial<SpacedRepetitionCardProgress> & {
  box?: number;
  boxCanonical?: number;
};

export type SpacedRepetitionSession = {
  flashcards: Flashcard[];
  cardIds: string[];
  selections: Record<number, string[]>;
  textResponses: Record<number, string>;
  textRevealed: Record<number, boolean>;
  selfGrades: Record<number, FlashcardSelfGrade>;
  submissions: Record<number, boolean>;
  trueFalseSelections: Record<number, Record<string, TrueFalseSelection>>;
  clozeResponses: Record<number, Record<string, string>>;
  compositeStates: Record<number, CompositePartState[]>;
  page: number;
  cardProgressById: Record<string, SpacedRepetitionCardProgress>;
  completedPerDay: Record<string, number>;
};

export type SpacedRepetitionUser = {
  id: string;
  name: string;
  createdAt: string;
};

export type SpacedRepetitionUserState = {
  cardStates: Record<string, SpacedRepetitionCardProgress>;
  lastLoadedAt: string | null;
  completedPerDay: Record<string, number>;
};

export type SpacedRepetitionStorage = {
  users: SpacedRepetitionUser[];
  userStateById: Record<string, SpacedRepetitionUserState>;
  lastActiveUserId: string | null;
};

export const createSpacedRepetitionUserId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const getFlashcardPartIdentityPayload = (card: FlashcardPart) => {
  if (card.kind === "multiple-choice") {
    return {
      kind: card.kind,
      question: card.question,
      options: card.options,
      correctKeys: [...card.correctKeys].sort((a, b) => a.localeCompare(b)),
    };
  }

  if (card.kind === "true-false") {
    return {
      kind: card.kind,
      items: card.items,
    };
  }

  if (card.kind === "free-text") {
    return {
      kind: card.kind,
      front: card.front,
      back: card.back,
    };
  }

  return {
    kind: card.kind,
    question: card.question,
    segments: card.segments,
    dragTokens: card.dragTokens,
  };
};

const getFlashcardLegacyPartIdentityPayload = (card: FlashcardPart) => {
  if (card.kind === "multiple-choice") {
    return {
      kind: card.kind,
      question: card.question,
      options: card.options,
      correctKeys: card.correctKeys,
    };
  }

  if (card.kind === "true-false") {
    return {
      kind: card.kind,
      items: card.items,
    };
  }

  if (card.kind === "free-text") {
    return {
      kind: card.kind,
      front: card.front,
      back: card.back,
    };
  }

  return {
    kind: card.kind,
    question: card.question,
    segments: card.segments,
    dragTokens: card.dragTokens,
  };
};

const getFlashcardIdentityPayload = (card: Flashcard) => {
  if (card.kind === "composite") {
    return {
      kind: card.kind,
      parts: card.parts.map(getFlashcardPartIdentityPayload),
    };
  }
  return getFlashcardPartIdentityPayload(card);
};

const getFlashcardLegacyIdentityPayload = (card: Flashcard) => {
  if (card.kind === "composite") {
    return {
      kind: card.kind,
      parts: card.parts.map(getFlashcardLegacyPartIdentityPayload),
    };
  }
  return getFlashcardLegacyPartIdentityPayload(card);
};

export const getFlashcardId = (card: Flashcard) =>
  `card-${hashString(JSON.stringify(getFlashcardIdentityPayload(card)))}`;

const getFlashcardLegacyId = (card: Flashcard) =>
  `card-${hashString(JSON.stringify(getFlashcardLegacyIdentityPayload(card)))}`;

export const createEmptySpacedRepetitionSession = (): SpacedRepetitionSession => ({
  flashcards: [],
  cardIds: [],
  selections: {},
  textResponses: {},
  textRevealed: {},
  selfGrades: {},
  submissions: {},
  trueFalseSelections: {},
  clozeResponses: {},
  compositeStates: {},
  page: 0,
  cardProgressById: {},
  completedPerDay: {},
});

export const createEmptySpacedRepetitionUserState = (): SpacedRepetitionUserState => ({
  cardStates: {},
  lastLoadedAt: null,
  completedPerDay: {},
});

export const normalizeSpacedRepetitionCardProgress = (
  progress?: SpacedRepetitionCardProgressInput | null,
): SpacedRepetitionCardProgress => {
  const rawBoxCanonical =
    typeof progress?.boxCanonical === "number" && Number.isFinite(progress.boxCanonical)
      ? progress.boxCanonical
      : typeof progress?.box === "number" && Number.isFinite(progress.box)
        ? progress.box
        : 1;
  const clampedBoxCanonical = Math.min(
    MAX_SPACED_REPETITION_BOX,
    Math.max(1, rawBoxCanonical),
  );

  return {
    boxCanonical: clampedBoxCanonical,
    attempts:
      typeof progress?.attempts === "number" && Number.isFinite(progress.attempts)
        ? Math.max(0, progress.attempts)
        : 0,
    lastResult:
      progress?.lastResult === "correct" || progress?.lastResult === "incorrect"
        ? progress.lastResult
        : "neutral",
    lastReviewedAt:
      typeof progress?.lastReviewedAt === "string"
        ? progress.lastReviewedAt
        : null,
  };
};

export const getSpacedRepetitionEffectiveBox = (
  progress: SpacedRepetitionCardProgress,
  boxCount: number,
) => Math.min(progress.boxCanonical, boxCount);

const shuffleEntries = <T>(entries: T[]) => {
  const copy = [...entries];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const buildWeightedOrder = <T extends { progress: SpacedRepetitionCardProgress }>(
  entries: T[],
  boxCount: number,
  strength: SpacedRepetitionRepetitionStrength,
) => {
  const weights = REPETITION_WEIGHTS[strength];
  const candidates = entries
    .map((entry) => {
      const effectiveBox = getSpacedRepetitionEffectiveBox(entry.progress, boxCount);
      return {
        entry,
        effectiveBox,
        weight: Math.max(1, weights[effectiveBox - 1] ?? 1),
      };
    })
    .filter((candidate) => candidate.effectiveBox < boxCount);

  const ordered: T[] = [];
  while (candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
    let threshold = Math.random() * totalWeight;
    const index = candidates.findIndex((candidate) => {
      threshold -= candidate.weight;
      return threshold <= 0;
    });
    const pickedIndex = index >= 0 ? index : candidates.length - 1;
    const [picked] = candidates.splice(pickedIndex, 1);
    ordered.push(picked.entry);
  }
  return ordered;
};

export const buildSpacedRepetitionSession = (
  flashcards: Flashcard[],
  existingCardStates: Record<string, SpacedRepetitionCardProgress> = {},
  options?: {
    order?: "in-order" | "random" | "repetition";
    boxCount?: number;
    repetitionStrength?: SpacedRepetitionRepetitionStrength;
  },
): SpacedRepetitionSession => {
  const nextCardStates = Object.fromEntries(
    Object.entries(existingCardStates).map(([cardId, progress]) => [
      cardId,
      normalizeSpacedRepetitionCardProgress(progress),
    ]),
  );

  const cardIds = flashcards.map((card) => {
    const cardId = getFlashcardId(card);
    const legacyId = getFlashcardLegacyId(card);
    if (!nextCardStates[cardId]) {
      if (legacyId !== cardId && nextCardStates[legacyId]) {
        nextCardStates[cardId] = nextCardStates[legacyId];
        delete nextCardStates[legacyId];
      } else {
        nextCardStates[cardId] = normalizeSpacedRepetitionCardProgress(null);
      }
    }
    return cardId;
  });

  const entries = flashcards.map((card, index) => ({
    card,
    cardId: cardIds[index],
    progress: nextCardStates[cardIds[index]],
  }));
  const order = options?.order ?? "in-order";
  const boxCount = options?.boxCount ?? MAX_SPACED_REPETITION_BOX;
  const orderedEntries =
    order === "random"
      ? shuffleEntries(entries)
      : order === "repetition"
        ? buildWeightedOrder(
            entries,
            boxCount,
            options?.repetitionStrength ?? "medium",
          )
        : entries;

  return {
    ...createEmptySpacedRepetitionSession(),
    flashcards: orderedEntries.map((entry) => entry.card),
    cardIds: orderedEntries.map((entry) => entry.cardId),
    cardProgressById: nextCardStates,
  };
};

---

## 📝 useSpacedRepetition.ts — ./features/spaced-repetition/useSpacedRepetition.ts

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  type CompositePartState,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../flashcards/logic";
import type { FlashcardOrder, FlashcardScope } from "../flashcards/useFlashcards";
import type { Flashcard } from "../../lib/flashcards";
import {
  buildSpacedRepetitionSession,
  createEmptySpacedRepetitionSession,
  createEmptySpacedRepetitionUserState,
  createSpacedRepetitionUserId,
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  MAX_SPACED_REPETITION_BOX,
  normalizeSpacedRepetitionCardProgress,
  type SpacedRepetitionRepetitionStrength,
  type SpacedRepetitionSession,
  type SpacedRepetitionStorage,
  type SpacedRepetitionUser,
  type SpacedRepetitionUserState,
} from "./logic";

export type SpacedRepetitionPageSize = 1 | 2 | 3 | 5;
export type SpacedRepetitionBoxes = 3 | 5 | 8;
export type SpacedRepetitionOrder = "in-order" | "random" | "repetition";
export type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";
export type { SpacedRepetitionRepetitionStrength };

export const SPACED_REPETITION_PAGE_SIZES: SpacedRepetitionPageSize[] = [
  1, 2, 3, 5,
];
export const DEFAULT_SPACED_REPETITION_PAGE_SIZE: SpacedRepetitionPageSize = 2;
export const SPACED_REPETITION_BOXES: SpacedRepetitionBoxes[] = [3, 5, 8];
const DAY_MS = 24 * 60 * 60 * 1000;
const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TIME_ZONE,
  weekday: "short",
});

const buildBerlinDateKey = (date: Date) => {
  const parts = berlinDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) {
    return berlinDateFormatter.format(date);
  }
  return `${year}-${month}-${day}`;
};

const buildBerlinWeekdayLabel = (date: Date) =>
  berlinWeekdayFormatter.format(date);

const buildLastSevenDays = (now = new Date()) => {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push(new Date(now.getTime() - offset * DAY_MS));
  }
  return days;
};

const normalizeCompletedPerDay = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
      .map(([key, count]) => [key, Math.max(0, Math.floor(count))]),
  );
};

const normalizeSpacedRepetitionPageSize = (value: number) => {
  if (value === 10) {
    return 5;
  }
  return SPACED_REPETITION_PAGE_SIZES.includes(value as SpacedRepetitionPageSize)
    ? (value as SpacedRepetitionPageSize)
    : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
};

type UseSpacedRepetitionOptions = {
  isFlashcardScanning: boolean;
  scanFlashcards: (options?: {
    scopeOverride?: FlashcardScope;
    allowVaultFallback?: boolean;
    orderOverride?: FlashcardOrder;
  }) => Promise<Flashcard[]>;
  setIsFlashcardScanning: (value: boolean) => void;
  settings: {
    spacedRepetitionBoxes: SpacedRepetitionBoxes;
    spacedRepetitionOrder: SpacedRepetitionOrder;
    spacedRepetitionPageSize: SpacedRepetitionPageSize;
    spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
    spacedRepetitionStatsView: SpacedRepetitionStatsView;
    setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
    setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
    setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
    setSpacedRepetitionRepetitionStrength: (
      value: SpacedRepetitionRepetitionStrength,
    ) => void;
    setSpacedRepetitionStatsView: (value: SpacedRepetitionStatsView) => void;
  };
};

export const useSpacedRepetition = ({
  isFlashcardScanning,
  scanFlashcards,
  setIsFlashcardScanning,
  settings,
}: UseSpacedRepetitionOptions) => {
  const {
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
  } = settings;
  const [spacedRepetitionUsers, setSpacedRepetitionUsers] = useState<
    SpacedRepetitionUser[]
  >([]);
  const [spacedRepetitionActiveUserId, setSpacedRepetitionActiveUserId] =
    useState<string | null>(null);
  const [spacedRepetitionSelectedUserId, setSpacedRepetitionSelectedUserId] =
    useState<string>("");
  const [spacedRepetitionNewUserName, setSpacedRepetitionNewUserName] =
    useState("");
  const [spacedRepetitionUserError, setSpacedRepetitionUserError] =
    useState("");
  const [spacedRepetitionUserStateById, setSpacedRepetitionUserStateById] =
    useState<Record<string, SpacedRepetitionUserState>>({});
  const [spacedRepetitionDataLoaded, setSpacedRepetitionDataLoaded] =
    useState(false);
  const [spacedRepetitionSessions, setSpacedRepetitionSessions] = useState<
    Record<string, SpacedRepetitionSession>
  >({});

  const spacedRepetitionActiveUser = spacedRepetitionActiveUserId
    ? spacedRepetitionUsers.find((user) => user.id === spacedRepetitionActiveUserId)
        ?.name ?? null
    : null;
  const spacedRepetitionActiveUserState = spacedRepetitionActiveUserId
    ? spacedRepetitionUserStateById[spacedRepetitionActiveUserId] ?? null
    : null;
  const spacedRepetitionSession = spacedRepetitionActiveUserId
    ? spacedRepetitionSessions[spacedRepetitionActiveUserId]
    : undefined;
  const spacedRepetitionFlashcards = spacedRepetitionSession?.flashcards ?? [];
  const spacedRepetitionSelections = spacedRepetitionSession?.selections ?? {};
  const spacedRepetitionTextResponses =
    spacedRepetitionSession?.textResponses ?? {};
  const spacedRepetitionTextRevealed = spacedRepetitionSession?.textRevealed ?? {};
  const spacedRepetitionSelfGrades = spacedRepetitionSession?.selfGrades ?? {};
  const spacedRepetitionSubmissions =
    spacedRepetitionSession?.submissions ?? {};
  const spacedRepetitionTrueFalseSelections =
    spacedRepetitionSession?.trueFalseSelections ?? {};
  const spacedRepetitionClozeResponses =
    spacedRepetitionSession?.clozeResponses ?? {};
  const spacedRepetitionCompositeStates =
    spacedRepetitionSession?.compositeStates ?? {};
  const spacedRepetitionPage = spacedRepetitionSession?.page ?? 0;
  const spacedRepetitionCardStates =
    spacedRepetitionSession?.cardProgressById ??
    spacedRepetitionActiveUserState?.cardStates ??
    {};
  const spacedRepetitionCompletedPerDay =
    spacedRepetitionSession?.completedPerDay ??
    spacedRepetitionActiveUserState?.completedPerDay ??
    {};

  const resolvedSpacedRepetitionPageSize = useMemo(
    () => normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize),
    [spacedRepetitionPageSize],
  );

  const spacedRepetitionPageCount = useMemo(
    () =>
      Math.ceil(spacedRepetitionFlashcards.length / resolvedSpacedRepetitionPageSize),
    [resolvedSpacedRepetitionPageSize, spacedRepetitionFlashcards.length],
  );

  const spacedRepetitionPageIndex = useMemo(
    () =>
      Math.min(
        spacedRepetitionPage,
        Math.max(0, spacedRepetitionPageCount - 1),
      ),
    [spacedRepetitionPage, spacedRepetitionPageCount],
  );

  const spacedRepetitionPageStart =
    spacedRepetitionPageIndex * resolvedSpacedRepetitionPageSize;

  const spacedRepetitionVisibleFlashcards = useMemo(() => {
    return spacedRepetitionFlashcards.slice(
      spacedRepetitionPageStart,
      spacedRepetitionPageStart + resolvedSpacedRepetitionPageSize,
    );
  }, [
    resolvedSpacedRepetitionPageSize,
    spacedRepetitionFlashcards,
    spacedRepetitionPageStart,
  ]);

  const spacedRepetitionCanGoBack = spacedRepetitionPageIndex > 0;
  const spacedRepetitionCanGoNext =
    spacedRepetitionPageIndex < spacedRepetitionPageCount - 1;

  const spacedRepetitionStatusLabel =
    spacedRepetitionFlashcards.length === 0
      ? "No cards loaded yet"
      : `${spacedRepetitionFlashcards.length} cards loaded`;

  const spacedRepetitionEmptyState = spacedRepetitionActiveUser
    ? "Click the active user to load cards."
    : "Select a user to begin.";

  const {
    correctCount: spacedRepetitionCorrectCount,
    incorrectCount: spacedRepetitionIncorrectCount,
    total: spacedRepetitionTotalQuestions,
  } = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    let correct = 0;
    let incorrect = 0;
    cardStates.forEach((state) => {
      const normalized = normalizeSpacedRepetitionCardProgress(state);
      if (normalized.lastResult === "correct") {
        correct += 1;
      } else if (normalized.lastResult === "incorrect") {
        incorrect += 1;
      }
    });
    return { correctCount: correct, incorrectCount: incorrect, total: cardStates.length };
  }, [spacedRepetitionCardStates]);

  const spacedRepetitionCorrectPercent = useMemo(() => {
    const total = spacedRepetitionCorrectCount + spacedRepetitionIncorrectCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((spacedRepetitionCorrectCount / total) * 100);
  }, [spacedRepetitionCorrectCount, spacedRepetitionIncorrectCount]);

  const spacedRepetitionProgressStats = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    const total = cardStates.length;
    if (total === 0) {
      return {
        dueNow: 0,
        dueToday: 0,
        inQueue: 0,
        completedToday: 0,
      };
    }

    const dueTodayThreshold = Math.min(2, spacedRepetitionBoxes);
    let dueNow = 0;
    let dueToday = 0;
    let completedEver = 0;

    for (const progress of cardStates) {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      if (normalized.attempts > 0) {
        completedEver += 1;
      }
      if (effectiveBox <= 1) {
        dueNow += 1;
      }
      if (effectiveBox <= dueTodayThreshold) {
        dueToday += 1;
      }
    }

    const todayKey = buildBerlinDateKey(new Date());
    const completedToday = todayKey
      ? spacedRepetitionCompletedPerDay[todayKey] ?? 0
      : 0;

    return {
      dueNow,
      dueToday,
      inQueue: total - completedEver,
      completedToday,
    };
  }, [
    spacedRepetitionBoxes,
    spacedRepetitionCardStates,
    spacedRepetitionCompletedPerDay,
  ]);

  const spacedRepetitionBoxCounts = useMemo(() => {
    const counts = Array.from({ length: spacedRepetitionBoxes }, () => 0);
    Object.values(spacedRepetitionCardStates).forEach((progress) => {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      const index = Math.max(1, Math.min(spacedRepetitionBoxes, effectiveBox)) - 1;
      counts[index] += 1;
    });
    return counts;
  }, [spacedRepetitionBoxes, spacedRepetitionCardStates]);

  const spacedRepetitionCompletedSeries = useMemo(() => {
    const days = buildLastSevenDays();
    const labels = days.map((day) => buildBerlinWeekdayLabel(day));
    const data = days.map((day) => {
      const key = buildBerlinDateKey(day);
      if (!key) {
        return 0;
      }
      return spacedRepetitionCompletedPerDay[key] ?? 0;
    });
    return { labels, data };
  }, [spacedRepetitionCompletedPerDay]);

  const updateActiveSpacedRepetitionSession = useCallback(
    (updater: (session: SpacedRepetitionSession) => SpacedRepetitionSession) => {
      if (!spacedRepetitionActiveUserId) {
        return;
      }
      setSpacedRepetitionSessions((prev) => {
        const current =
          prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionSession();
        const next = updater(current);
        if (next === current) {
          return prev;
        }
        return { ...prev, [spacedRepetitionActiveUserId]: next };
      });
    },
    [spacedRepetitionActiveUserId],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSpacedRepetitionData = async () => {
      try {
        const storage = await invoke<SpacedRepetitionStorage>(
          "load_spaced_repetition_data",
        );
        if (cancelled) {
          return;
        }
        const users = Array.isArray(storage.users)
          ? storage.users
              .map((user) => {
                if (!user || typeof user !== "object") {
                  return null;
                }
                const id = "id" in user && typeof user.id === "string" ? user.id : "";
                const name =
                  "name" in user && typeof user.name === "string" ? user.name : "";
                if (!id || !name) {
                  return null;
                }
                const createdAt =
                  "createdAt" in user && typeof user.createdAt === "string"
                    ? user.createdAt
                    : new Date().toISOString();
                return { id, name, createdAt };
              })
              .filter((user): user is SpacedRepetitionUser => Boolean(user))
          : [];
        const userStateByIdRaw =
          storage.userStateById && typeof storage.userStateById === "object"
            ? storage.userStateById
            : {};
        const userIds = new Set(users.map((user) => user.id));
        const userStateById = Object.fromEntries(
          Object.entries(userStateByIdRaw)
            .filter(([userId]) => userIds.has(userId))
            .map(([userId, state]) => {
              const cardStatesRaw =
                state && typeof state === "object" && "cardStates" in state
                  ? (state as SpacedRepetitionUserState).cardStates
                  : {};
              const normalizedCardStates = Object.fromEntries(
                Object.entries(cardStatesRaw ?? {}).map(([cardId, progress]) => [
                  cardId,
                  normalizeSpacedRepetitionCardProgress(progress),
                ]),
              );
              const completedPerDayRaw =
                state && typeof state === "object" && "completedPerDay" in state
                  ? (state as SpacedRepetitionUserState).completedPerDay
                  : {};
              const completedPerDay = normalizeCompletedPerDay(completedPerDayRaw);
              const lastLoadedAt =
                state &&
                typeof state === "object" &&
                "lastLoadedAt" in state &&
                typeof (state as SpacedRepetitionUserState).lastLoadedAt === "string"
                  ? (state as SpacedRepetitionUserState).lastLoadedAt
                  : null;
              return [
                userId,
                {
                  cardStates: normalizedCardStates,
                  completedPerDay,
                  lastLoadedAt,
                },
              ];
            }),
        );
        const lastActiveUserId =
          storage.lastActiveUserId &&
          users.some((user) => user.id === storage.lastActiveUserId)
            ? storage.lastActiveUserId
            : null;

        setSpacedRepetitionUsers(users);
        setSpacedRepetitionUserStateById(userStateById);

        if (lastActiveUserId && users.some((user) => user.id === lastActiveUserId)) {
          setSpacedRepetitionActiveUserId(lastActiveUserId);
          setSpacedRepetitionSelectedUserId(lastActiveUserId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load spaced repetition data", error);
          setSpacedRepetitionUsers([]);
          setSpacedRepetitionUserStateById({});
          setSpacedRepetitionActiveUserId(null);
          setSpacedRepetitionSelectedUserId("");
        }
      } finally {
        if (!cancelled) {
          setSpacedRepetitionDataLoaded(true);
        }
      }
    };

    void restoreSpacedRepetitionData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!spacedRepetitionDataLoaded) {
      return;
    }
    const storage: SpacedRepetitionStorage = {
      users: spacedRepetitionUsers,
      userStateById: spacedRepetitionUserStateById,
      lastActiveUserId: spacedRepetitionActiveUserId,
    };
    void invoke("save_spaced_repetition_data", { storage }).catch((error) => {
      console.error("Failed to save spaced repetition data", error);
    });
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionDataLoaded,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
  ]);

  useEffect(() => {
    const normalized = normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize);
    if (normalized !== spacedRepetitionPageSize) {
      setSpacedRepetitionPageSize(normalized);
    }
  }, [spacedRepetitionPageSize]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    setSpacedRepetitionSessions((prev) => {
      if (prev[spacedRepetitionActiveUserId]) {
        return prev;
      }
      const storedState =
        spacedRepetitionUserStateById[spacedRepetitionActiveUserId];
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...createEmptySpacedRepetitionSession(),
          cardProgressById: storedState?.cardStates ?? {},
          completedPerDay: storedState?.completedPerDay ?? {},
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionUserStateById]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const maxPage = Math.max(0, spacedRepetitionPageCount - 1);
    if (spacedRepetitionPage > maxPage) {
      updateActiveSpacedRepetitionSession((session) => ({
        ...session,
        page: maxPage,
      }));
    }
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    updateActiveSpacedRepetitionSession,
  ]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const session = spacedRepetitionSessions[spacedRepetitionActiveUserId];
    if (!session) {
      return;
    }
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionUserState();
      if (
        current.cardStates === session.cardProgressById &&
        current.completedPerDay === session.completedPerDay
      ) {
        return prev;
      }
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...current,
          cardStates: session.cardProgressById,
          completedPerDay: session.completedPerDay,
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionSessions]);

  const handleSpacedRepetitionCreateUser = useCallback(() => {
    const trimmed = spacedRepetitionNewUserName.trim();
    if (!trimmed) {
      setSpacedRepetitionUserError("User name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const hasDuplicate = spacedRepetitionUsers.some(
      (user) => user.name.trim().toLowerCase() === normalized,
    );
    if (hasDuplicate) {
      setSpacedRepetitionUserError("User name already exists.");
      return;
    }

    const newUser: SpacedRepetitionUser = {
      id: createSpacedRepetitionUserId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    setSpacedRepetitionUsers((prev) => [...prev, newUser]);
    setSpacedRepetitionUserStateById((prev) => ({
      ...prev,
      [newUser.id]: createEmptySpacedRepetitionUserState(),
    }));
    setSpacedRepetitionActiveUserId(newUser.id);
    setSpacedRepetitionSelectedUserId(newUser.id);
    setSpacedRepetitionNewUserName("");
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionNewUserName, spacedRepetitionUsers]);

  const handleSpacedRepetitionLoadUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    setSpacedRepetitionActiveUserId(spacedRepetitionSelectedUserId);
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionSelectedUserId] ?? createEmptySpacedRepetitionUserState();
      return {
        ...prev,
        [spacedRepetitionSelectedUserId]: {
          ...current,
          lastLoadedAt: new Date().toISOString(),
        },
      };
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionDeleteUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    const deletedId = spacedRepetitionSelectedUserId;

    setSpacedRepetitionSessions((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUserStateById((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUsers((prev) => {
      const next = prev.filter((user) => user.id !== deletedId);
      const nextSelected = next[0]?.id ?? "";
      if (spacedRepetitionActiveUserId === deletedId) {
        setSpacedRepetitionActiveUserId(null);
      }
      setSpacedRepetitionSelectedUserId(nextSelected);
      return next;
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionActiveUserId, spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionActiveUserLoadCards = useCallback(async (
    options?: { boxFilter?: number | null },
  ) => {
    if (!spacedRepetitionActiveUserId || isFlashcardScanning) {
      return;
    }
    const activeUserId = spacedRepetitionActiveUserId;
    const boxFilter =
      typeof options?.boxFilter === "number" ? options.boxFilter : null;
    setIsFlashcardScanning(true);
    try {
      const cards = await scanFlashcards({
        scopeOverride: "vault",
        orderOverride: "in-order",
      });
      const storedCardStates =
        spacedRepetitionUserStateById[activeUserId]?.cardStates ?? {};
      const storedCompletedPerDay =
        spacedRepetitionUserStateById[activeUserId]?.completedPerDay ?? {};
      const loadOrder =
        boxFilter && spacedRepetitionOrder === "repetition"
          ? "in-order"
          : spacedRepetitionOrder;
      const nextSession = buildSpacedRepetitionSession(cards, storedCardStates, {
        order: loadOrder,
        boxCount: spacedRepetitionBoxes,
        repetitionStrength: spacedRepetitionRepetitionStrength,
      });
      const filteredSession =
        boxFilter === null
          ? nextSession
          : (() => {
              const entries = nextSession.flashcards.map((card, index) => {
                const cardId = nextSession.cardIds[index] ?? getFlashcardId(card);
                const progress = normalizeSpacedRepetitionCardProgress(
                  nextSession.cardProgressById[cardId],
                );
                return {
                  card,
                  cardId,
                  effectiveBox: getSpacedRepetitionEffectiveBox(
                    progress,
                    spacedRepetitionBoxes,
                  ),
                };
              });
              const filteredEntries = entries.filter(
                (entry) => entry.effectiveBox === boxFilter,
              );
              return {
                ...nextSession,
                flashcards: filteredEntries.map((entry) => entry.card),
                cardIds: filteredEntries.map((entry) => entry.cardId),
                page: 0,
              };
            })();
      setSpacedRepetitionSessions((prev) => ({
        ...prev,
        [activeUserId]: {
          ...filteredSession,
          completedPerDay: storedCompletedPerDay,
        },
      }));
      setSpacedRepetitionUserStateById((prev) => {
        const current = prev[activeUserId] ?? createEmptySpacedRepetitionUserState();
        return {
          ...prev,
          [activeUserId]: {
            ...current,
            cardStates: nextSession.cardProgressById,
            lastLoadedAt: new Date().toISOString(),
          },
        };
      });
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [
    isFlashcardScanning,
    scanFlashcards,
    setIsFlashcardScanning,
    spacedRepetitionActiveUserId,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionUserStateById,
  ]);

  const handleSpacedRepetitionOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const uniqueKeys = Array.from(new Set(keys));
        return {
          ...session,
          selections: { ...session.selections, [cardIndex]: uniqueKeys },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: TrueFalseSelection) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.trueFalseSelections[cardIndex] ?? {}) };
        current[itemId] = value;
        return {
          ...session,
          trueFalseSelections: {
            ...session.trueFalseSelections,
            [cardIndex]: current,
          },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const updateCompositePartState = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      updater: (current: CompositePartState) => CompositePartState,
    ) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const nextParts = [...(session.compositeStates[cardIndex] ?? [])];
        const current = nextParts[partIndex] ?? {};
        const nextState = updater(current);
        nextParts[partIndex] = nextState;
        return {
          ...session,
          compositeStates: {
            ...session.compositeStates,
            [cardIndex]: nextParts,
          },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      const uniqueKeys = Array.from(new Set(keys));
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selections: uniqueKeys,
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: TrueFalseSelection) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        trueFalseSelections: {
          ...(current.trueFalseSelections ?? {}),
          [itemId]: value,
        },
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean, selfGrade?: FlashcardSelfGrade) => {
      if (!canSubmit) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const card = session.flashcards[cardIndex];
        if (!card) {
          return session;
        }
        const cardIds =
          session.cardIds.length === session.flashcards.length
            ? session.cardIds
            : session.flashcards.map(getFlashcardId);
        const cardId = cardIds[cardIndex] ?? getFlashcardId(card);
        const nextSelfGrades = selfGrade
          ? { ...session.selfGrades, [cardIndex]: selfGrade }
          : session.selfGrades;
        const result =
          selfGrade ??
          evaluateFlashcardResult(
            card,
            cardIndex,
            session.selections,
            session.trueFalseSelections,
            session.clozeResponses,
            nextSelfGrades,
            session.compositeStates,
          );
        const currentProgress = normalizeSpacedRepetitionCardProgress(
          session.cardProgressById[cardId],
        );
        const effectiveBox = getSpacedRepetitionEffectiveBox(
          currentProgress,
          spacedRepetitionBoxes,
        );
        const baseBox =
          currentProgress.boxCanonical > spacedRepetitionBoxes
            ? effectiveBox
            : currentProgress.boxCanonical;
        let nextBox = baseBox;
        if (result === "correct") {
          nextBox = Math.min(baseBox + 1, MAX_SPACED_REPETITION_BOX);
        } else if (result === "incorrect") {
          nextBox = Math.max(baseBox - 1, 1);
        }
        const nextProgress = {
          boxCanonical: nextBox,
          attempts: currentProgress.attempts + 1,
          lastResult: result,
          lastReviewedAt: new Date().toISOString(),
        };
        const todayKey = buildBerlinDateKey(new Date());
        const nextCompletedPerDay = todayKey
          ? {
              ...session.completedPerDay,
              [todayKey]: (session.completedPerDay[todayKey] ?? 0) + 1,
            }
          : session.completedPerDay;

        return {
          ...session,
          cardIds,
          submissions: { ...session.submissions, [cardIndex]: true },
          selfGrades: nextSelfGrades,
          cardProgressById: {
            ...session.cardProgressById,
            [cardId]: nextProgress,
          },
          completedPerDay: nextCompletedPerDay,
        };
      });
    },
    [spacedRepetitionBoxes, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textResponse: value };
      });
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      updateCompositePartState(cardIndex, partIndex, (current) => {
        if (current.textRevealed) {
          return current;
        }
        return { ...current, textRevealed: true };
      });
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: FlashcardSelfGrade) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        selfGrade: grade,
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textResponses: { ...session.textResponses, [cardIndex]: value },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTextCheck = useCallback(
    (cardIndex: number) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textRevealed: { ...session.textRevealed, [cardIndex]: true },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionSelfGrade = useCallback(
    (cardIndex: number, grade: FlashcardSelfGrade) => {
      handleSpacedRepetitionSubmit(cardIndex, true, grade);
    },
    [handleSpacedRepetitionSubmit],
  );

  const handleSpacedRepetitionPageBack = useCallback(() => {
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.max(0, session.page - 1),
    }));
  }, [updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionPageNext = useCallback(() => {
    if (spacedRepetitionPageCount <= 0) {
      return;
    }
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.min(spacedRepetitionPageCount - 1, session.page + 1),
    }));
  }, [spacedRepetitionPageCount, updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        current[blankId] = value;
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      updateCompositePartState(cardIndex, partIndex, (current) => ({
        ...current,
        clozeResponses: {
          ...(current.clozeResponses ?? {}),
          [blankId]: value,
        },
      }));
    },
    [updateCompositePartState],
  );

  const handleSpacedRepetitionClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        const existingBlankId = Object.entries(current).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete current[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          current[blankId] = payload.tokenId;
        }
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex || payload.partIndex !== partIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        const existingBlankId = Object.entries(responses).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete responses[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          responses[blankId] = payload.tokenId;
        }
        return { ...current, clozeResponses: responses };
      });
    },
    [spacedRepetitionSubmissions, updateCompositePartState],
  );

  const handleSpacedRepetitionClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        delete current[blankId];
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      updateCompositePartState(cardIndex, partIndex, (current) => {
        const responses = { ...(current.clozeResponses ?? {}) };
        delete responses[blankId];
        return { ...current, clozeResponses: responses };
      });
    },
    [spacedRepetitionSubmissions, updateCompositePartState],
  );

  return {
    handleSpacedRepetitionActiveUserLoadCards,
    handleSpacedRepetitionClozeInputChange,
    handleSpacedRepetitionClozeTokenDrop,
    handleSpacedRepetitionClozeTokenRemove,
    handleSpacedRepetitionCompositeClozeInputChange,
    handleSpacedRepetitionCompositeClozeTokenDrop,
    handleSpacedRepetitionCompositeClozeTokenRemove,
    handleSpacedRepetitionCreateUser,
    handleSpacedRepetitionDeleteUser,
    handleSpacedRepetitionLoadUser,
    handleSpacedRepetitionOptionSelect,
    handleSpacedRepetitionCompositeOptionSelect,
    handleSpacedRepetitionPageBack,
    handleSpacedRepetitionPageNext,
    handleSpacedRepetitionSelfGrade,
    handleSpacedRepetitionCompositeSelfGrade,
    handleSpacedRepetitionSubmit,
    handleSpacedRepetitionTextCheck,
    handleSpacedRepetitionTextInputChange,
    handleSpacedRepetitionCompositeTextCheck,
    handleSpacedRepetitionCompositeTextInputChange,
    handleSpacedRepetitionTrueFalseSelect,
    handleSpacedRepetitionCompositeTrueFalseSelect,
    setSpacedRepetitionActiveUserId,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionNewUserName,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionSelectedUserId,
    setSpacedRepetitionStatsView,
    setSpacedRepetitionUserError,
    spacedRepetitionActiveUser,
    spacedRepetitionBoxes,
    spacedRepetitionBoxCounts,
    spacedRepetitionCanGoBack,
    spacedRepetitionCanGoNext,
    spacedRepetitionClozeResponses,
    spacedRepetitionCompositeStates,
    spacedRepetitionCompletedChartData: spacedRepetitionCompletedSeries.data,
    spacedRepetitionCompletedChartLabels: spacedRepetitionCompletedSeries.labels,
    spacedRepetitionCorrectCount,
    spacedRepetitionCorrectPercent,
    spacedRepetitionDataLoaded,
    spacedRepetitionEmptyState,
    spacedRepetitionFlashcards,
    spacedRepetitionIncorrectCount,
    spacedRepetitionNewUserName,
    spacedRepetitionOrder,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    spacedRepetitionPageSize,
    spacedRepetitionPageStart,
    spacedRepetitionCardStates,
    spacedRepetitionProgressStats,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionSelectedUserId,
    spacedRepetitionSelections,
    spacedRepetitionSessions,
    spacedRepetitionStatusLabel,
    spacedRepetitionStatsView,
    spacedRepetitionSubmissions,
    spacedRepetitionTextRevealed,
    spacedRepetitionTextResponses,
    spacedRepetitionSelfGrades,
    spacedRepetitionTotalQuestions,
    spacedRepetitionTrueFalseSelections,
    spacedRepetitionUserError,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
    spacedRepetitionVisibleFlashcards,
    updateActiveSpacedRepetitionSession,
  };
};

---

## 📝 useVault.ts — ./features/vault/useVault.ts

import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { asErrorMessage } from "../../lib/errors";
import { type LoadState } from "../../lib/types";
import { type VaultFile } from "../../lib/tree";

type LoadOptions = {
  persist: boolean;
  clearOnFailure?: boolean;
  errorMessage?: string;
};

type PickOptions = {
  errorMessage?: string;
  onBeforeLoad?: () => void;
  onLoadFailed?: () => void;
};

export type VaultSnapshot = {
  vaultPath: string | null;
  files: VaultFile[];
  listState: LoadState;
  listError: string;
};

type UseVaultOptions = {
  persistSettings: (updates: { vaultPath?: string | null }) => Promise<boolean>;
};

export const useVault = ({ persistSettings }: UseVaultOptions) => {
  const [vaultPath, setVaultPath] = useState<string | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [listState, setListState] = useState<LoadState>("idle");
  const [listError, setListError] = useState("");

  const takeSnapshot = useCallback(
    (): VaultSnapshot => ({
      vaultPath,
      files,
      listState,
      listError,
    }),
    [files, listError, listState, vaultPath],
  );

  const restoreSnapshot = useCallback((snapshot: VaultSnapshot) => {
    setVaultPath(snapshot.vaultPath);
    setFiles(snapshot.files);
    setListState(snapshot.listState);
    setListError(snapshot.listError);
  }, []);

  const loadVault = useCallback(
    async (path: string, options: LoadOptions) => {
      setListError("");
      setVaultPath(path);
      setFiles([]);
      setListState("loading");
      try {
        const results = await invoke<VaultFile[]>("list_markdown_files", {
          vaultPath: path,
        });
        setFiles(results);
        setListState("idle");
        if (options.persist) {
          await persistSettings({ vaultPath: path });
        }
        return true;
      } catch (error) {
        const message = asErrorMessage(error, "Failed to list markdown files.");
        setListError(options.errorMessage ?? message);
        setListState("error");
        if (options.clearOnFailure) {
          setVaultPath(null);
          await persistSettings({ vaultPath: null });
        }
        return false;
      }
    },
    [persistSettings],
  );

  const pickVault = useCallback(
    async (options?: PickOptions) => {
      setListError("");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Vault auswaehlen",
      });

      if (!selected || Array.isArray(selected)) {
        return false;
      }

      const snapshot = takeSnapshot();
      options?.onBeforeLoad?.();

      const errorMessage =
        options?.errorMessage ?? "Ausgewaehlter Vault ist nicht verfuegbar.";
      const loaded = await loadVault(selected, {
        persist: true,
        clearOnFailure: false,
        errorMessage,
      });

      if (!loaded) {
        restoreSnapshot(snapshot);
        setListError(errorMessage);
        options?.onLoadFailed?.();
      }

      return loaded;
    },
    [loadVault, restoreSnapshot, takeSnapshot],
  );

  const rescanVault = useCallback(async () => {
    if (!vaultPath || listState === "loading") {
      return;
    }
    setListError("");
    setListState("loading");
    try {
      const results = await invoke<VaultFile[]>("list_markdown_files", {
        vaultPath,
      });
      setFiles(results);
      setListState("idle");
    } catch (error) {
      const message = asErrorMessage(error, "Vault konnte nicht neu gescannt werden.");
      setListError(message);
      setListState("error");
    }
  }, [listState, vaultPath]);

  return {
    files,
    listError,
    listState,
    loadVault,
    pickVault,
    rescanVault,
    restoreSnapshot,
    setFiles,
    setListError,
    setListState,
    setVaultPath,
    takeSnapshot,
    vaultPath,
  };
};

---

## 📝 chart.ts — ./lib/chart.ts

export const buildLineChartPoints = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }
  const maxValue = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : 100 / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 40 - (value / maxValue) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};

---

## 📝 color.ts — ./lib/color.ts

export const DEFAULT_ACCENT = "#E07A5F";

export const normalizeHex = (value: string) => {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }
  if (!trimmed.startsWith("#")) {
    return `#${trimmed}`;
  }
  return `#${trimmed.slice(1)}`;
};

export const isValidHex = (value: string) => /^#[0-9A-F]{6}$/.test(value);

export const hexToRgb = (value: string) => {
  if (!isValidHex(value)) {
    return null;
  }
  const hex = value.slice(1);
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return { r, g, b };
};

export const rgbToHex = (r: number, g: number, b: number) => {
  const toHex = (channel: number) =>
    channel.toString(16).toUpperCase().padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const mixChannel = (from: number, to: number, amount: number) =>
  Math.round(from + (to - from) * amount);

export const mixRgb = (
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
) => ({
  r: mixChannel(rgb.r, target.r, amount),
  g: mixChannel(rgb.g, target.g, amount),
  b: mixChannel(rgb.b, target.b, amount),
});

export const contrastFor = (rgb: { r: number; g: number; b: number }) => {
  const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  return luminance > 170 ? "#1A1A1A" : "#FFFFFF";
};

export const buildAccentTokens = (value: string, fallback = DEFAULT_ACCENT) => {
  const normalized = normalizeHex(value);
  const rgb = hexToRgb(normalized) ?? hexToRgb(fallback)!;
  const strong = mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.18);
  const highlight = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.28);
  return {
    accent: rgbToHex(rgb.r, rgb.g, rgb.b),
    accentStrong: rgbToHex(strong.r, strong.g, strong.b),
    accentSoft: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.14)`,
    accentHighlight: rgbToHex(highlight.r, highlight.g, highlight.b),
    accentBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`,
    accentContrast: contrastFor(rgb),
    accentContrastStrong: contrastFor(strong),
  };
};

---

## 📝 errors.ts — ./lib/errors.ts

export const asErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};

---

## 📝 flashcardKeywords.ts — ./lib/flashcardKeywords.ts

export const answerMarkers = [
  "Answer:",
  "Antwort:",
  "Réponse:",
  "Respuesta:",
  "Resposta:",
  "Risposta:",
  "Antwoord:",
  "Svar:",
  "Vastaus:",
  "Odpowiedź:",
  "Odpověď:",
  "Odpoveď:",
  "Válasz:",
  "Răspuns:",
  "Cevap:",
  "Ответ:",
  "Απάντηση:",
  "إجابة:",
];

export const trueTokens = [
  "true",
  "yes",
  "ja",
  "wahr",
  "vrai",
  "verdadero",
  "verdadeiro",
  "vero",
  "waar",
  "sant",
  "sann",
  "sandt",
  "tosi",
  "prawda",
  "pravda",
  "igaz",
  "adevărat",
  "doğru",
  "правда",
  "αληθές",
  "صحيح",
];

export const falseTokens = [
  "false",
  "no",
  "nein",
  "falsch",
  "faux",
  "falso",
  "onwaar",
  "falskt",
  "usann",
  "falsk",
  "epätosi",
  "fałsz",
  "nepravda",
  "hamis",
  "fals",
  "yanlış",
  "ложь",
  "ψευδές",
  "خطأ",
];

---

## 📝 flashcards.test.ts — ./lib/flashcards.test.ts

import { describe, expect, it } from "vitest";
import {
  isDragAnswerMatch,
  isInputAnswerMatch,
  parseFlashcards,
  type Flashcard,
} from "./flashcards";

const getCompositeParts = (card: Flashcard | undefined) => {
  expect(card?.kind).toBe("composite");
  if (!card || card.kind !== "composite") {
    throw new Error("Expected composite card");
  }
  return card.parts;
};

const getSinglePart = (card: Flashcard | undefined) => {
  const parts = getCompositeParts(card);
  expect(parts).toHaveLength(1);
  return parts[0];
};

describe("parseFlashcards", () => {
  it("parses a single card", () => {
    const markdown = `#card
1.5 Which SQL category controls access rights?
a) DML
b) DDL
c) TCL
d) DCL

-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("1.5 Which SQL category controls access rights?");
      expect(part.options).toEqual([
        { key: "a", text: "DML" },
        { key: "b", text: "DDL" },
        { key: "c", text: "TCL" },
        { key: "d", text: "DCL" },
      ]);
      expect(part.correctKeys).toEqual(["d"]);
    }
  });

  it("parses multiple cards in one document", () => {
    const markdown = `Intro text.

#card
First question?
a) One
b) Two
-b
#

Some notes between.

#card
Second question?
a) Alpha
b) Beta
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("multiple-choice");
    expect(secondPart.kind).toBe("multiple-choice");
    if (firstPart.kind === "multiple-choice") {
      expect(firstPart.question).toBe("First question?");
    }
    if (secondPart.kind === "multiple-choice") {
      expect(secondPart.question).toBe("Second question?");
    }
  });

  it("parses multiple parts inside a single block", () => {
    const markdown = `#card
Statement 1. Wahr/Falsch?
-wahr

What is SQL?
Answer: A query language.

Pick one.
a) First
b) Second
-a
Pick two.
a) Alpha
b) Beta
c) Gamma
-a
-c

Cloze sample.
Use %%token%% with \`drag\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts.map((part) => part.kind)).toEqual([
      "true-false",
      "free-text",
      "multiple-choice",
      "multiple-choice",
      "cloze",
    ]);
    const [trueFalsePart, freeTextPart, singleMc, multiMc, clozePart] = parts;
    if (trueFalsePart.kind === "true-false") {
      expect(trueFalsePart.items).toHaveLength(1);
    }
    if (freeTextPart.kind === "free-text") {
      expect(freeTextPart.front).toBe("What is SQL?");
      expect(freeTextPart.back).toBe("A query language.");
    }
    if (singleMc.kind === "multiple-choice") {
      expect(singleMc.options).toEqual([
        { key: "a", text: "First" },
        { key: "b", text: "Second" },
      ]);
      expect(singleMc.correctKeys).toEqual(["a"]);
    }
    if (multiMc.kind === "multiple-choice") {
      expect(multiMc.options).toEqual([
        { key: "a", text: "Alpha" },
        { key: "b", text: "Beta" },
        { key: "c", text: "Gamma" },
      ]);
      expect(multiMc.correctKeys).toEqual(["a", "c"]);
    }
    if (clozePart.kind === "cloze") {
      expect(clozePart.dragTokens).toEqual([{ id: "token-0", value: "drag" }]);
    }
  });

  it("splits parts on separators inside a block", () => {
    const markdown = `#card
First question?
Answer: One
---
Second question?
Answer: Two
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("free-text");
    expect(second.kind).toBe("free-text");
    if (first.kind === "free-text") {
      expect(first.front).toBe("First question?");
      expect(first.back).toBe("One");
    }
    if (second.kind === "free-text") {
      expect(second.front).toBe("Second question?");
      expect(second.back).toBe("Two");
    }
  });

  it("parses a front/back card with Answer marker", () => {
    const markdown = `#card
What is SQL used for as a common interface?
Answer: SQL is used to define, manipulate, manage permissions, and handle transactions.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("What is SQL used for as a common interface?");
      expect(part.back).toBe(
        "SQL is used to define, manipulate, manage permissions, and handle transactions.",
      );
    }
  });

  it("parses a front/back card with Antwort marker", () => {
    const markdown = `#card
1. Was ist eine Transaktion?
Antwort:
Eine Transaktion ist eine atomare Einheit von Operationen.
#
`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("1. Was ist eine Transaktion?");
      expect(part.back).toBe(
        "Eine Transaktion ist eine atomare Einheit von Operationen.",
      );
    }
  });

  it("parses a front/back card with Reponse marker", () => {
    const markdown = `#card
Que signifie SQL ?
Reponse: SQL est un langage pour interroger des bases de donnees.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("free-text");
    if (part.kind === "free-text") {
      expect(part.front).toBe("Que signifie SQL ?");
      expect(part.back).toBe(
        "SQL est un langage pour interroger des bases de donnees.",
      );
    }
  });

  it("parses a single true/false item", () => {
    const markdown = `#card
1. The earth orbits the sun. Wahr/Falsch?
-wahr
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "1. The earth orbits the sun. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses true/false items without suffix in other languages", () => {
    const markdown = `#card
La tierra orbita el sol.
-verdadero
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items).toEqual([
        {
          id: "tf-0",
          question: "La tierra orbita el sol.",
          correct: "wahr",
        },
      ]);
    }
  });

  it("parses multiple true/false items in one block", () => {
    const markdown = `#card
2. Water boils at 100C. Wahr/Falsch?
-wahr
3. The moon is a planet. Wahr/Falsch?
-falsch
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const parts = getCompositeParts(cards[0]);
    expect(parts).toHaveLength(2);
    const [first, second] = parts;
    expect(first.kind).toBe("true-false");
    expect(second.kind).toBe("true-false");
    if (first.kind === "true-false") {
      expect(first.items).toEqual([
        {
          id: "tf-0",
          question: "2. Water boils at 100C. Wahr/Falsch?",
          correct: "wahr",
        },
      ]);
    }
    if (second.kind === "true-false") {
      expect(second.items).toEqual([
        {
          id: "tf-0",
          question: "3. The moon is a planet. Wahr/Falsch?",
          correct: "falsch",
        },
      ]);
    }
  });

  it("skips true/false questions without valid markers", () => {
    const markdown = `#card
Missing marker. Wahr/Falsch?
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses true/false markers case-insensitively", () => {
    const markdown = `#card
Case check. Wahr/Falsch?
-FALSCH
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("parses true/false markers with spacing and punctuation", () => {
    const markdown = `#card
Spacing check.
- falsch,
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("true-false");
    if (part.kind === "true-false") {
      expect(part.items[0]?.correct).toBe("falsch");
    }
  });

  it("collects multiple correct markers", () => {
    const markdown = `#card
Choose two.
a) One
b) Two
c) Three

-a
-d
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.correctKeys).toEqual(["a", "d"]);
    }
  });

  it("ignores irrelevant text outside cards", () => {
    const markdown = `Random text.
- Not a marker.
#card
Question?
a) Option
#
More text.`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("multiple-choice");
    if (part.kind === "multiple-choice") {
      expect(part.question).toBe("Question?");
    }
  });

  it("parses multiple cloze cards with separators", () => {
    const markdown = `Intro section.
---
#card
First.
Fill %%one%% and \`alpha\`.
#
---
#card
Second.
Only \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(2);
    const firstPart = getSinglePart(cards[0]);
    const secondPart = getSinglePart(cards[1]);
    expect(firstPart.kind).toBe("cloze");
    expect(secondPart.kind).toBe("cloze");
    if (firstPart.kind === "cloze") {
      expect(firstPart.dragTokens).toEqual([{ id: "token-0", value: "alpha" }]);
      expect(firstPart.segments).toEqual([
        { type: "text", value: "Fill " },
        { type: "blank", id: "blank-0", kind: "input", solution: "one" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: "." },
      ]);
    }
    if (secondPart.kind === "cloze") {
      expect(secondPart.dragTokens).toEqual([{ id: "token-0", value: "beta" }]);
      expect(secondPart.segments).toEqual([
        { type: "text", value: "Only " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("skips cards with missing end markers", () => {
    const markdown = `#card
Question without end?
a) Option`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("parses cloze cards with %% blanks", () => {
    const markdown = `#card
Define foreign key.
A foreign key is an %% attribute or attribute set %% that references a %%primary key%% in another %% table %%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.question).toBe("Define foreign key.");
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "A foreign key is an " },
        {
          type: "blank",
          id: "blank-0",
          kind: "input",
          solution: "attribute or attribute set",
        },
        { type: "text", value: " that references a " },
        { type: "blank", id: "blank-1", kind: "input", solution: "primary key" },
        { type: "text", value: " in another " },
        { type: "blank", id: "blank-2", kind: "input", solution: "table" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("supports multiple blanks with and without spacing", () => {
    const markdown = `#card
Short cloze.
%%alpha%% and %% beta %% then %%gamma%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.segments).toEqual([
        { type: "blank", id: "blank-0", kind: "input", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "input", solution: "beta" },
        { type: "text", value: " then " },
        { type: "blank", id: "blank-2", kind: "input", solution: "gamma" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("collects backtick tokens alongside blanks", () => {
    const markdown = `#card
Mixed markers.
Use %%blank%% with \`alpha\` and \`beta\`.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "input", solution: "blank" },
        { type: "text", value: " with " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-2", kind: "drag", solution: "beta" },
        { type: "text", value: "." },
      ]);
    }
  });

  it("keeps cards with only backtick tokens", () => {
    const markdown = `#card
Only tokens.
Use \`alpha\` and \`beta\` here.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "alpha" },
        { id: "token-1", value: "beta" },
      ]);
      expect(part.segments).toEqual([
        { type: "text", value: "Use " },
        { type: "blank", id: "blank-0", kind: "drag", solution: "alpha" },
        { type: "text", value: " and " },
        { type: "blank", id: "blank-1", kind: "drag", solution: "beta" },
        { type: "text", value: " here." },
      ]);
    }
  });

  it("keeps duplicate tokens with unique ids", () => {
    const markdown = `#card
Duplicate tokens.
Use \`same\` and \`same\` again.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([
        { id: "token-0", value: "same" },
        { id: "token-1", value: "same" },
      ]);
    }
  });

  it("handles unclosed %% safely", () => {
    const markdown = `#card
Broken markers.
Valid %%answer%% and %%unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and %%unfinished." },
      ]);
    }
  });

  it("handles unclosed backticks safely", () => {
    const markdown = `#card
Broken token.
Valid %%answer%% and \`unfinished.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([]);
      expect(part.segments).toEqual([
        { type: "text", value: "Valid " },
        { type: "blank", id: "blank-0", kind: "input", solution: "answer" },
        { type: "text", value: " and `unfinished." },
      ]);
    }
  });

  it("ignores markers inside fenced code blocks", () => {
    const markdown = `#card
Question.
Code:
~~~
\`ignored\`
%%not%%
~~~
Outside \`token\` and %%blank%%.
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(1);
    const part = getSinglePart(cards[0]);
    expect(part.kind).toBe("cloze");
    if (part.kind === "cloze") {
      expect(part.dragTokens).toEqual([{ id: "token-0", value: "token" }]);
      const blanks = part.segments.filter((segment) => segment.type === "blank");
      expect(blanks).toEqual([
        { type: "blank", id: "blank-0", kind: "drag", solution: "token" },
        { type: "blank", id: "blank-1", kind: "input", solution: "blank" },
      ]);
    }
  });

  it("skips cards with empty blanks", () => {
    const markdown = `#card
Empty blank.
%%%%
#`;

    const cards = parseFlashcards(markdown);

    expect(cards).toHaveLength(0);
  });

  it("matches input blanks case-insensitively with trim", () => {
    expect(isInputAnswerMatch(" Atomic Values ", "atomic values")).toBe(true);
    expect(isInputAnswerMatch("Atomic", "atom")).toBe(false);
  });

  it("matches drag tokens by trimmed exact value", () => {
    expect(isDragAnswerMatch("Token", "Token")).toBe(true);
    expect(isDragAnswerMatch("Token ", "Token")).toBe(true);
    expect(isDragAnswerMatch("token", "Token")).toBe(false);
  });
});

---

## 📝 flashcards.ts — ./lib/flashcards.ts

import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";

/**
 * Flashcard syntax:
 * v1 (multiple choice)
 * #card
 * Question line
 * a) Option text
 * -a
 * #
 *
 * v3 (cloze blanks + tokens)
 * #card
 * Question line
 * Body text with input blanks like %%answer%% and drag tokens like `token`
 * #
 *
 * v4 (true/false)
 * #card
 * Statement Wahr/Falsch?
 * -wahr
 * #
 *
 * Invalid cards (missing end marker, empty question, no options/blanks/tokens) are skipped.
 */
export type FlashcardOption = {
  key: string;
  text: string;
};

export type MultipleChoiceCard = {
  kind: "multiple-choice";
  question: string;
  options: FlashcardOption[];
  correctKeys: string[];
};

export type FreeTextCard = {
  kind: "free-text";
  front: string;
  back: string;
};

export type TrueFalseItem = {
  id: string;
  question: string;
  correct: "wahr" | "falsch";
};

export type TrueFalseCard = {
  kind: "true-false";
  items: TrueFalseItem[];
};

export type ClozeSegment =
  | { type: "text"; value: string }
  | { type: "blank"; id: string; kind: "input" | "drag"; solution: string };

export type ClozeDragToken = {
  id: string;
  value: string;
};

export type ClozeCard = {
  kind: "cloze";
  question: string;
  segments: ClozeSegment[];
  dragTokens: ClozeDragToken[];
};

export type FlashcardPart = MultipleChoiceCard | FreeTextCard | TrueFalseCard | ClozeCard;

export type CompositeFlashcard = {
  kind: "composite";
  parts: FlashcardPart[];
};

export type FlashcardDetectedType =
  | "qa"
  | "multiple-choice"
  | "fill-blank"
  | "assignment"
  | "true-false";

export type FlashcardMetadata = {
  primaryType?: FlashcardDetectedType;
  detectedTypes?: FlashcardDetectedType[];
  isMixed?: boolean;
};

export type Flashcard = (FlashcardPart | CompositeFlashcard) & FlashcardMetadata;

export const normalizeInputAnswer = (value: string) => value.trim().toLowerCase();

export const isInputAnswerMatch = (input: string, solution: string) =>
  normalizeInputAnswer(input) === normalizeInputAnswer(solution);

export const normalizeDragAnswer = (value: string) => value.trim();

export const isDragAnswerMatch = (tokenValue: string, solution: string) =>
  normalizeDragAnswer(tokenValue) === normalizeDragAnswer(solution);

const normalizeLines = (markdown: string) =>
  markdown.replace(/\r\n?/g, "\n").split("\n");

const optionPattern = /^([A-Za-z])\)\s+(.*)$/;
const markerPattern = /^-([A-Za-z])$/;
const assignmentPattern = /^(.+?)=>\s*(.+)$/;
const separatorLine = "---";

const normalizeKeyword = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizedTrueTokens = new Set(trueTokens.map(normalizeKeyword));
const normalizedFalseTokens = new Set(falseTokens.map(normalizeKeyword));
const normalizedAnswerMarkers = answerMarkers.map((marker) => ({
  raw: marker,
  normalized: normalizeKeyword(marker),
}));

const trimEmptyLines = (lines: string[]) => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }
  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const isSeparatorLine = (line: string) => line.trim() === separatorLine;

const isAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return false;
  }
  const left = match[1].trim();
  const right = match[2].trim();
  return Boolean(left && right);
};

const normalizeAssignmentLine = (line: string) => {
  const match = line.match(assignmentPattern);
  if (!match) {
    return null;
  }
  const left = match[1].trimEnd();
  const right = match[2].trim();
  if (!left || !right) {
    return null;
  }
  const normalizedRight =
    right.startsWith("`") && right.endsWith("`") ? right : `\`${right}\``;
  return `${left} => ${normalizedRight}`;
};

const isOptionLine = (line: string) => optionPattern.test(line.trim());
const isCorrectMarkerLine = (line: string) => markerPattern.test(line.trim());
const isTrueFalseMarkerLine = (line: string) =>
  normalizeTrueFalseMarker(line.trim()) !== null;
const isAnswerMarkerLine = (line: string) => Boolean(findAnswerMarkerMatch(line));
const hasClozeMarker = (line: string) => line.includes("%%") || line.includes("`");

const appendText = (segments: ClozeSegment[], text: string) => {
  if (!text) {
    return;
  }
  const last = segments[segments.length - 1];
  if (last?.type === "text") {
    last.value += text;
  } else {
    segments.push({ type: "text", value: text });
  }
};

const parseClozeSegments = (lines: string[]) => {
  const segments: ClozeSegment[] = [];
  const dragTokens: ClozeDragToken[] = [];
  let blankIndex = 0;
  let tokenIndex = 0;
  let inFence = false;
  const fencePattern = /^(```|~~~)/;

  const handleLine = (line: string) => {
    let cursor = 0;

    while (cursor < line.length) {
      const nextInput = line.indexOf("%%", cursor);
      const nextDrag = line.indexOf("`", cursor);
      const nextMarker = Math.min(
        nextInput === -1 ? Number.POSITIVE_INFINITY : nextInput,
        nextDrag === -1 ? Number.POSITIVE_INFINITY : nextDrag,
      );

      if (!Number.isFinite(nextMarker)) {
        appendText(segments, line.slice(cursor));
        break;
      }

      if (nextMarker > cursor) {
        appendText(segments, line.slice(cursor, nextMarker));
      }

      if (nextMarker === nextInput) {
        const end = line.indexOf("%%", nextInput + 2);
        if (end === -1) {
          appendText(segments, line.slice(nextInput));
          break;
        }
        const rawSolution = line.slice(nextInput + 2, end);
        const solution = rawSolution.trim();
        if (!solution) {
          return null;
        }
        segments.push({
          type: "blank",
          id: `blank-${blankIndex}`,
          kind: "input",
          solution,
        });
        blankIndex += 1;
        cursor = end + 2;
        continue;
      }

      const end = line.indexOf("`", nextDrag + 1);
      if (end === -1) {
        appendText(segments, line.slice(nextDrag));
        break;
      }
      const rawToken = line.slice(nextDrag + 1, end);
      const value = rawToken.trim();
      if (!value) {
        appendText(segments, line.slice(nextDrag, end + 1));
        cursor = end + 1;
        continue;
      }
      segments.push({
        type: "blank",
        id: `blank-${blankIndex}`,
        kind: "drag",
        solution: value,
      });
      dragTokens.push({ id: `token-${tokenIndex}`, value });
      blankIndex += 1;
      tokenIndex += 1;
      cursor = end + 1;
    }

    return true;
  };

  const trimmedLines = trimEmptyLines(lines);
  for (let lineIndex = 0; lineIndex < trimmedLines.length; lineIndex += 1) {
    const line = trimmedLines[lineIndex];
    const trimmed = line.trimStart();
    if (fencePattern.test(trimmed)) {
      inFence = !inFence;
      appendText(segments, line);
    } else if (inFence) {
      appendText(segments, line);
    } else {
      const parsed = handleLine(line);
      if (!parsed) {
        return null;
      }
    }

    if (lineIndex < trimmedLines.length - 1) {
      appendText(segments, "\n");
    }
  }

  return { segments, dragTokens };
};

const normalizeTrueFalseMarker = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("-")) {
    return null;
  }
  const rawToken = trimmed.slice(1).trim();
  if (!rawToken) {
    return null;
  }
  const cleaned = rawToken.replace(/[.,;:!?]+$/g, "");
  const normalized = normalizeKeyword(cleaned);
  if (normalizedTrueTokens.has(normalized)) {
    return "wahr";
  }
  if (normalizedFalseTokens.has(normalized)) {
    return "falsch";
  }
  return null;
};

const parseTrueFalseItems = (lines: string[]) => {
  const items: TrueFalseItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const question = lines[index].trim();
    if (!question) {
      continue;
    }

    let markerIndex = index + 1;
    while (markerIndex < lines.length && lines[markerIndex].trim() === "") {
      markerIndex += 1;
    }
    if (markerIndex >= lines.length) {
      continue;
    }

    const marker = normalizeTrueFalseMarker(lines[markerIndex].trim());
    if (!marker) {
      continue;
    }

    items.push({
      id: `tf-${items.length}`,
      question,
      correct: marker,
    });
    index = markerIndex;
  }

  return items;
};

const findAnswerMarkerMatch = (line: string) => {
  const trimmedLine = line.trimStart();
  const normalizedLine = normalizeKeyword(trimmedLine);
  for (const marker of normalizedAnswerMarkers) {
    if (normalizedLine.startsWith(marker.normalized)) {
      const colonIndex = trimmedLine.indexOf(":");
      const markerEndIndex = colonIndex >= 0 ? colonIndex + 1 : marker.raw.length;
      return { trimmedLine, markerEndIndex };
    }
  }
  return null;
};

const findAnswerMarkerLine = (lines: string[]) => {
  for (let index = 0; index < lines.length; index += 1) {
    const match = findAnswerMarkerMatch(lines[index] ?? "");
    if (match) {
      return { index, match };
    }
  }
  return null;
};

const splitAnswerCard = (lines: string[]) => {
  const markerInfo = findAnswerMarkerLine(lines);
  if (!markerInfo) {
    return null;
  }
  const frontLines = trimEmptyLines(lines.slice(0, markerInfo.index));
  const inlineAnswer = markerInfo.match.trimmedLine
    .slice(markerInfo.match.markerEndIndex)
    .trimStart();
  const backLines = [inlineAnswer, ...lines.slice(markerInfo.index + 1)];
  const normalizedFront = trimEmptyLines(frontLines).join("\n").trim();
  const normalizedBack = trimEmptyLines(backLines).join("\n").trim();
  if (!normalizedFront || !normalizedBack) {
    return null;
  }
  return {
    front: normalizedFront,
    back: normalizedBack,
  };
};

const pushUnique = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value);
  }
};

type CardSplitState = {
  hasQuestion: boolean;
  hasOption: boolean;
  hasCorrectMarker: boolean;
  hasAnswerMarker: boolean;
  hasTrueFalseMarker: boolean;
  hasClozeMarker: boolean;
  hasAssignmentLine: boolean;
};

const createSplitState = (): CardSplitState => ({
  hasQuestion: false,
  hasOption: false,
  hasCorrectMarker: false,
  hasAnswerMarker: false,
  hasTrueFalseMarker: false,
  hasClozeMarker: false,
  hasAssignmentLine: false,
});

const splitCardLines = (lines: string[]) => {
  const blocks: string[][] = [];
  let current: string[] = [];
  let state = createSplitState();

  const reset = () => {
    current = [];
    state = createSplitState();
  };

  const flush = () => {
    const trimmed = trimEmptyLines(current);
    if (trimmed.length > 0) {
      blocks.push(trimmed);
    }
    reset();
  };

  const updateState = (line: string) => {
    const trimmed = line.trim();
    if (!state.hasQuestion && trimmed) {
      state.hasQuestion = true;
    }
    if (isOptionLine(line)) {
      state.hasOption = true;
    }
    if (isCorrectMarkerLine(line)) {
      state.hasCorrectMarker = true;
    }
    if (isAnswerMarkerLine(line)) {
      state.hasAnswerMarker = true;
    }
    if (isTrueFalseMarkerLine(line)) {
      state.hasTrueFalseMarker = true;
    }
    if (hasClozeMarker(line)) {
      state.hasClozeMarker = true;
    }
    if (isAssignmentLine(line)) {
      state.hasAssignmentLine = true;
    }
  };

  const isComplete = () =>
    state.hasTrueFalseMarker ||
    (state.hasOption && state.hasCorrectMarker) ||
    state.hasAnswerMarker ||
    state.hasClozeMarker ||
    state.hasAssignmentLine;

  const findNextNonEmpty = (startIndex: number) => {
    for (let i = startIndex; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (!trimmed || isSeparatorLine(lines[i])) {
        continue;
      }
      return trimmed;
    }
    return null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();

    if (isSeparatorLine(line)) {
      flush();
      continue;
    }

    if (
      current.length > 0 &&
      state.hasOption &&
      state.hasCorrectMarker &&
      trimmed &&
      !isOptionLine(line) &&
      !isCorrectMarkerLine(line)
    ) {
      flush();
    }

    current.push(line);
    updateState(line);

    if (state.hasTrueFalseMarker && state.hasQuestion && isTrueFalseMarkerLine(line)) {
      flush();
      continue;
    }

    if (!trimmed && isComplete()) {
      const nextNonEmpty = findNextNonEmpty(index + 1);
      if (nextNonEmpty) {
        flush();
      }
    }
  }

  flush();
  return blocks;
};

const parseCardLines = (
  cardLines: string[],
): { part: FlashcardPart; detectedTypes: FlashcardDetectedType[] } | null => {
  const questionIndex = cardLines.findIndex((entry) => entry.trim() !== "");
  if (questionIndex === -1) {
    return null;
  }
  const question = cardLines[questionIndex].trim();
  const bodyLines = cardLines.slice(questionIndex + 1);
  const contentLines = cardLines.slice(questionIndex);

  const options: FlashcardOption[] = [];
  const correctKeys: string[] = [];
  const clozeLines: string[] = [];
  let hasAssignmentLines = false;

  bodyLines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      clozeLines.push("");
      return;
    }

    const optionMatch = trimmed.match(optionPattern);
    if (optionMatch) {
      const text = optionMatch[2].trim();
      if (text) {
        options.push({
          key: optionMatch[1].toLowerCase(),
          text,
        });
      }
      return;
    }

    const markerMatch = trimmed.match(markerPattern);
    if (markerMatch) {
      pushUnique(correctKeys, markerMatch[1].toLowerCase());
      return;
    }

    const assignmentLine = normalizeAssignmentLine(rawLine);
    if (assignmentLine) {
      hasAssignmentLines = true;
      clozeLines.push(assignmentLine);
      return;
    }

    clozeLines.push(rawLine);
  });

  const detectedTypes: FlashcardDetectedType[] = [];
  if (options.length > 0) {
    pushUnique(detectedTypes, "multiple-choice");
  }

  const trueFalseItems = parseTrueFalseItems(cardLines.slice(questionIndex));
  if (trueFalseItems.length > 0) {
    pushUnique(detectedTypes, "true-false");
  }

  const answerCard = splitAnswerCard(contentLines);
  if (answerCard) {
    pushUnique(detectedTypes, "qa");
  }

  const parsed = parseClozeSegments(clozeLines);
  let hasInputBlanks = false;
  let hasDragBlanks = false;
  if (parsed) {
    parsed.segments.forEach((segment) => {
      if (segment.type !== "blank") {
        return;
      }
      if (segment.kind === "input") {
        hasInputBlanks = true;
      } else {
        hasDragBlanks = true;
      }
    });
  }
  if (hasInputBlanks) {
    pushUnique(detectedTypes, "fill-blank");
  }
  if (hasDragBlanks || hasAssignmentLines) {
    pushUnique(detectedTypes, "assignment");
  }

  if (options.length > 0) {
    return {
      part: {
        kind: "multiple-choice",
        question,
        options,
        correctKeys,
      },
      detectedTypes,
    };
  }

  if (trueFalseItems.length > 0) {
    return {
      part: {
        kind: "true-false",
        items: trueFalseItems,
      },
      detectedTypes,
    };
  }

  if (answerCard) {
    return {
      part: {
        kind: "free-text",
        ...answerCard,
      },
      detectedTypes,
    };
  }

  if (!parsed) {
    return null;
  }
  if (hasInputBlanks || hasDragBlanks || hasAssignmentLines) {
    return {
      part: {
        kind: "cloze",
        question,
        segments: parsed.segments,
        dragTokens: parsed.dragTokens,
      },
      detectedTypes,
    };
  }

  return null;
};

export const parseFlashcards = (markdown: string): Flashcard[] => {
  const lines = normalizeLines(markdown);
  const cards: Flashcard[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (line !== "#card") {
      index += 1;
      continue;
    }

    const cardLines: string[] = [];
    let foundEnd = false;

    index += 1;

    while (index < lines.length) {
      const trimmed = lines[index].trim();
      if (trimmed === "#") {
        foundEnd = true;
        index += 1;
        break;
      }
      if (trimmed === "#card") {
        break;
      }
      cardLines.push(lines[index]);
      index += 1;
    }

    if (!foundEnd) {
      continue;
    }

    const blocks = splitCardLines(cardLines);
    const parts: FlashcardPart[] = [];
    const detectedTypes: FlashcardDetectedType[] = [];

    blocks.forEach((block) => {
      const parsed = parseCardLines(block);
      if (!parsed) {
        return;
      }
      parts.push(parsed.part);
      parsed.detectedTypes.forEach((detected) => {
        pushUnique(detectedTypes, detected);
      });
    });

    if (parts.length === 0) {
      continue;
    }

    const isMixed = detectedTypes.length >= 2;
    const primaryType = detectedTypes.length === 1 ? detectedTypes[0] : undefined;

    cards.push({
      kind: "composite",
      parts,
      primaryType,
      detectedTypes,
      isMixed,
    });
  }

  return cards;
};

---

## 📝 path.ts — ./lib/path.ts

export const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/^\/+/, "");

export const vaultBaseName = (value: string | null) => {
  if (!value) {
    return "Vault";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || "Vault";
};

---

## 📝 theme.ts — ./lib/theme.ts

import { buildAccentTokens } from "./color";

export type ThemeMode = "light" | "dark";

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export const applyAccentColor = (value: string) => {
  const root = document.documentElement;
  const tokens = buildAccentTokens(value);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-strong", tokens.accentStrong);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--accent-highlight", tokens.accentHighlight);
  root.style.setProperty("--accent-border", tokens.accentBorder);
  root.style.setProperty("--accent-contrast", tokens.accentContrast);
  root.style.setProperty("--accent-contrast-strong", tokens.accentContrastStrong);
};

---

## 📝 tree.ts — ./lib/tree.ts

import { normalizeRelativePath } from "./path";

export type VaultFile = {
  path: string;
  relative_path: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  children?: TreeNode[];
  file?: VaultFile;
  fullPath?: string;
};

export const buildTree = (files: VaultFile[]): TreeNode[] => {
  const root: TreeNode = {
    name: "__root__",
    path: "",
    type: "dir",
    children: [],
  };

  for (const file of files) {
    const relative = normalizeRelativePath(file.relative_path);
    const parts = relative.split("/").filter(Boolean);
    if (parts.length === 0) {
      continue;
    }
    let current = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (isFile) {
        const existing = current.children?.find(
          (child) => child.type === "file" && child.path === currentPath,
        );
        if (!existing) {
          current.children = current.children ?? [];
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            file,
            fullPath: file.path,
          });
        }
        return;
      }

      let next = current.children?.find(
        (child) => child.type === "dir" && child.name === part,
      );
      if (!next) {
        next = {
          name: part,
          path: currentPath,
          type: "dir",
          children: [],
        };
        current.children = current.children ?? [];
        current.children.push(next);
      }
      current = next;
    });
  }

  return sortNodes(root.children ?? []);
};

export const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) => {
    if (node.type === "dir" && node.children) {
      return { ...node, children: sortNodes(node.children) };
    }
    return node;
  });
};

---

## 📝 types.ts — ./lib/types.ts

export type LoadState = "idle" | "loading" | "error";

---

## 📝 main.tsx — ./main.tsx

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

---

## 📝 DashboardPage.tsx — ./pages/DashboardPage.tsx

import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileList } from "../components/FileList";
import { PreviewPanel } from "../components/PreviewPanel";
import { VaultTree } from "../components/VaultTree";
import { useAppState } from "../components/AppStateProvider";
import { asErrorMessage } from "../lib/errors";

const emptyPreview = "Waehle eine Notiz fuer die Vorschau.";

export const DashboardPage = () => {
  const { actions, preview, vault } = useAppState();
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const fileCountLabel = useMemo(() => {
    if (!vault.vaultPath) {
      return "Kein Vault gewaehlt";
    }
    if (vault.files.length === 0) {
      return "Keine Markdown-Dateien";
    }
    return `${vault.files.length} Markdown-Datei${
      vault.files.length === 1 ? "" : "en"
    }`;
  }, [vault.files.length, vault.vaultPath]);
  const canEdit =
    Boolean(preview.selectedFile) && preview.previewState === "idle";

  useEffect(() => {
    setIsEditing(false);
    setEditDraft("");
    setEditError("");
    setIsSaving(false);
  }, [preview.selectedFile?.path]);

  const handleEditStart = () => {
    if (!preview.selectedFile || preview.previewState !== "idle") {
      return;
    }
    setEditDraft(preview.preview);
    setEditError("");
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!preview.selectedFile) {
      return;
    }
    setIsSaving(true);
    setEditError("");
    try {
      await invoke("write_text_file", {
        path: preview.selectedFile.path,
        contents: editDraft,
      });
      preview.setPreview(editDraft);
      setIsEditing(false);
    } catch (error) {
      setEditError(asErrorMessage(error, "Failed to save file."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dashboard-page">
      <header className="content-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Vault</h1>
          <p className="muted">
            Waehle einen Vault, scanne Markdown-Dateien und sieh dir Inhalte sofort
            an.
          </p>
        </div>
      </header>

      <div className="workspace">
        <VaultTree
          fileCountLabel={fileCountLabel}
          files={vault.files}
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />

        <PreviewPanel
          emptyPreview={emptyPreview}
          editDraft={editDraft}
          editError={editError}
          isEditing={isEditing}
          isSaving={isSaving}
          preview={preview.preview}
          previewError={preview.previewError}
          previewState={preview.previewState}
          rawPreview={preview.rawPreview}
          selectedFile={preview.selectedFile}
          canEdit={canEdit}
          onEditCancel={handleEditCancel}
          onEditChange={setEditDraft}
          onEditSave={handleEditSave}
          onEditStart={handleEditStart}
          setRawPreview={preview.setRawPreview}
        />

        <FileList
          fileCountLabel={fileCountLabel}
          files={vault.files}
          listError={vault.listError}
          listState={vault.listState}
          onSelectFile={actions.handleSelectFile}
          selectedFile={preview.selectedFile}
          vaultPath={vault.vaultPath}
        />
      </div>
    </div>
  );
};

---

## 📝 FastFlashcardPage.tsx — ./pages/FastFlashcardPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { CompositeCard } from "../components/flashcards/CompositeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings";
import { useAppState } from "../components/AppStateProvider";
import { evaluateFlashcardResult } from "../features/flashcards/logic";
import { vaultBaseName } from "../lib/path";

const fastFlashcardStatusLabel = "Not scanned yet";
const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48];

type FastFlashcardResult = "correct" | "incorrect" | "timeout";

type FastFlashcardSessionSummary = {
  id: string;
  endedAt: string;
  score: number;
  correct: number;
  incorrect: number;
  timeout?: number;
  total: number;
  accuracy: number;
  pace: number;
  durationMs: number;
};

type FastFlashcardStorage = {
  sessions: FastFlashcardSessionSummary[];
};

type FastFlashcardSessionStats = {
  correct: number;
  incorrect: number;
  timeout: number;
};

const FAST_FLASHCARD_SCORE_BY_RESULT: Record<FastFlashcardResult, number> = {
  correct: 10,
  incorrect: -5,
  timeout: -5,
};

const FAST_FLASHCARD_DURATION_MULTIPLIER: Record<number, number> = {
  3: 1.5,
  6: 1.2,
  12: 1.0,
  24: 0.8,
  48: 0.5,
};

const getFastFlashcardMultiplier = (duration: number) =>
  FAST_FLASHCARD_DURATION_MULTIPLIER[duration] ?? 1;

const buildSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getSessionTimeValue = (value: string) => {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const formatSessionTimestamp = (value: string) => {
  const timestamp = getSessionTimeValue(value);
  if (!timestamp) {
    return value;
  }
  return new Date(timestamp).toLocaleString("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatSessionPace = (pace: number) =>
  Number.isFinite(pace) ? pace.toFixed(1) : "0.0";

export const FastFlashcardPage = () => {
  const { flashcards: appFlashcards, fastFlashcards, settings, vault } =
    useAppState();
  const {
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  } = fastFlashcards;
  const [fastCardPosition, setFastCardPosition] = useState(0);
  const [isTimeModeEnabled, setIsTimeModeEnabled] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(6);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [sessionStats, setSessionStats] = useState<FastFlashcardSessionStats>({
    correct: 0,
    incorrect: 0,
    timeout: 0,
  });
  const [sessionElapsedMs, setSessionElapsedMs] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<
    FastFlashcardSessionSummary[]
  >([]);
  const [sessionHistoryLoaded, setSessionHistoryLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sessionTimerRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const sessionCountedRef = useRef<Set<number>>(new Set());
  const sessionResultsRef = useRef<Map<number, FastFlashcardResult>>(new Map());
  const sessionTimeoutsRef = useRef<Set<number>>(new Set());
  const prevTimeModeRef = useRef(false);

  const orderedEntries = fastFlashcards.orderedFlashcardEntries;
  const currentEntry = orderedEntries[fastCardPosition] ?? null;
  const currentCardIndex = currentEntry?.cardIndex;
  const hasScannedCards = fastFlashcards.flashcards.length > 0;
  const hasFilteredCards = orderedEntries.length > 0;
  const statsCorrect = appFlashcards.correctCount;
  const statsIncorrect = appFlashcards.incorrectCount;
  const statsTotal = statsCorrect + statsIncorrect;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const timeModeActive = isTimeModeEnabled;
  const isCurrentSubmitted =
    currentCardIndex !== undefined &&
    Boolean(flashcardSubmissions[currentCardIndex]);
  const submissionLocked = !timeModeActive;
  const isTimerRunning =
    timeModeActive && currentCardIndex !== undefined && !isCurrentSubmitted;

  const currentResult = useMemo(() => {
    if (!currentEntry || !isCurrentSubmitted) {
      return "neutral";
    }
    return evaluateFlashcardResult(
      currentEntry.card,
      currentEntry.cardIndex,
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardCompositeStates,
    );
  }, [
    currentEntry,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
    isCurrentSubmitted,
  ]);

  const canGoBack =
    timeModeActive &&
    isCurrentSubmitted &&
    currentResult === "correct" &&
    fastCardPosition > 0;
  const canGoNext =
    timeModeActive &&
    isCurrentSubmitted &&
    fastCardPosition < orderedEntries.length - 1;

  const correctPercent =
    statsTotal > 0 ? Math.round((statsCorrect / statsTotal) * 100) : 0;

  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${correctPercent}%`,
      }) as CSSProperties,
    [correctPercent],
  );

  const remainingSeconds = Math.max(0, timeRemaining ?? selectedDuration);
  const timeProgress = timeModeActive
    ? isTimerRunning
      ? Math.max(0, Math.min(1, remainingSeconds / selectedDuration))
      : 1
    : 0;

  const timeStatusLabel = !timeModeActive
    ? "Inactive"
    : isTimerRunning
      ? `Remaining: ${remainingSeconds}s`
      : "Ready";

  const timeProgressStyle = useMemo(
    () =>
      ({
        "--fast-time-progress": `${Math.round(timeProgress * 100)}%`,
      }) as CSSProperties,
    [timeProgress],
  );

  const registerSessionResult = useCallback(
    (cardIndex: number, result: FastFlashcardResult) => {
      const results = sessionResultsRef.current;
      if (results.has(cardIndex)) {
        return;
      }
      results.set(cardIndex, result);
      setSessionStats((prev) => {
        if (result === "correct") {
          return { ...prev, correct: prev.correct + 1 };
        }
        if (result === "incorrect") {
          return { ...prev, incorrect: prev.incorrect + 1 };
        }
        return { ...prev, timeout: prev.timeout + 1 };
      });
    },
    [],
  );

  const resolveSessionResult = useCallback(
    (cardIndex: number): FastFlashcardResult | null => {
      if (sessionTimeoutsRef.current.has(cardIndex)) {
        sessionTimeoutsRef.current.delete(cardIndex);
        return "timeout";
      }
      const card = fastFlashcards.flashcards[cardIndex];
      if (!card) {
        return null;
      }
      const result = evaluateFlashcardResult(
        card,
        cardIndex,
        fastFlashcards.flashcardSelections,
        fastFlashcards.flashcardTrueFalseSelections,
        fastFlashcards.flashcardClozeResponses,
        fastFlashcards.flashcardSelfGrades,
        fastFlashcards.flashcardCompositeStates,
      );
      if (result === "correct" || result === "incorrect") {
        return result;
      }
      return null;
    },
    [
      fastFlashcards.flashcardClozeResponses,
      fastFlashcards.flashcardCompositeStates,
      fastFlashcards.flashcardSelections,
      fastFlashcards.flashcardSelfGrades,
      fastFlashcards.flashcardTrueFalseSelections,
      fastFlashcards.flashcards,
    ],
  );

  const recordSessionResults = useCallback(
    (indices: number[]) => {
      if (indices.length === 0) {
        return;
      }
      const counted = sessionCountedRef.current;
      indices.forEach((index) => counted.add(index));
      indices.forEach((index) => {
        const result = resolveSessionResult(index);
        if (result) {
          registerSessionResult(index, result);
        }
      });
    },
    [registerSessionResult, resolveSessionResult],
  );

  useEffect(() => {
    let cancelled = false;

    const loadSessions = async () => {
      try {
        const storage = await invoke<FastFlashcardStorage>(
          "load_fast_flashcard_data",
        );
        if (cancelled) {
          return;
        }
        const sessions = Array.isArray(storage?.sessions) ? storage.sessions : [];
        setSessionHistory(sessions);
      } catch (error) {
        console.warn("Failed to load fast flashcard sessions", error);
      } finally {
        if (!cancelled) {
          setSessionHistoryLoaded(true);
        }
      }
    };

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionHistoryLoaded) {
      return;
    }
    const storage: FastFlashcardStorage = {
      sessions: sessionHistory,
    };
    void invoke("save_fast_flashcard_data", { storage }).catch((error) => {
      console.warn("Failed to save fast flashcard sessions", error);
    });
  }, [sessionHistory, sessionHistoryLoaded]);

  useEffect(() => {
    if (fastCardPosition < orderedEntries.length) {
      return;
    }
    setFastCardPosition(0);
  }, [fastCardPosition, orderedEntries.length]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcardMode, fastFlashcards.flashcardOrder]);

  useEffect(() => {
    setFastCardPosition(0);
  }, [fastFlashcards.flashcards]);

  useEffect(() => {
    const wasEnabled = prevTimeModeRef.current;
    if (!wasEnabled && isTimeModeEnabled) {
      sessionStartRef.current = Date.now();
      const baseline = new Set(
        Object.keys(flashcardSubmissions)
          .map((key) => Number(key))
          .filter((index) => flashcardSubmissions[index]),
      );
      sessionCountedRef.current = baseline;
      sessionResultsRef.current = new Map();
      sessionTimeoutsRef.current = new Set();
      setSessionStats({ correct: 0, incorrect: 0, timeout: 0 });
      setSessionElapsedMs(0);
    }
    prevTimeModeRef.current = isTimeModeEnabled;
  }, [flashcardSubmissions, isTimeModeEnabled]);

  useEffect(() => {
    if (!timeModeActive) {
      return;
    }

    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index]);
    const newIndices = submittedIndices.filter((index) => !counted.has(index));

    recordSessionResults(newIndices);
  }, [
    flashcardSubmissions,
    fastFlashcards.flashcardClozeResponses,
    fastFlashcards.flashcardCompositeStates,
    fastFlashcards.flashcardSelections,
    fastFlashcards.flashcardSelfGrades,
    fastFlashcards.flashcardTrueFalseSelections,
    fastFlashcards.flashcards,
    recordSessionResults,
    timeModeActive,
  ]);

  useEffect(() => {
    if (!timeModeActive || !sessionStartRef.current) {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
      return;
    }

    const updateElapsed = () => {
      if (!sessionStartRef.current) {
        return;
      }
      setSessionElapsedMs(Date.now() - sessionStartRef.current);
    };

    updateElapsed();
    if (sessionTimerRef.current !== null) {
      window.clearInterval(sessionTimerRef.current);
    }
    sessionTimerRef.current = window.setInterval(updateElapsed, 1000);

    return () => {
      if (sessionTimerRef.current !== null) {
        window.clearInterval(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }
    };
  }, [timeModeActive]);

  const handleTimeout = useCallback(() => {
    if (!currentEntry) {
      return;
    }
    if (!flashcardSubmissions[currentEntry.cardIndex]) {
      sessionTimeoutsRef.current.add(currentEntry.cardIndex);
      if (currentEntry.card.kind === "free-text") {
        handleFlashcardSelfGrade(currentEntry.cardIndex, "incorrect");
      } else {
        handleFlashcardSubmit(currentEntry.cardIndex, true);
      }
    }
  }, [
    currentEntry,
    flashcardSubmissions,
    handleFlashcardSelfGrade,
    handleFlashcardSubmit,
  ]);

  useEffect(() => {
    if (
      !timeModeActive ||
      currentCardIndex === undefined ||
      isCurrentSubmitted
    ) {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining(selectedDuration);
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        const next = prev === null ? selectedDuration : prev - 1;
        if (next <= 0) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          handleTimeout();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    currentCardIndex,
    handleTimeout,
    isCurrentSubmitted,
    selectedDuration,
    timeModeActive,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      fastFlashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [fastFlashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      fastFlashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [fastFlashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [fastFlashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      fastFlashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [fastFlashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      fastFlashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [fastFlashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      fastFlashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [fastFlashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      fastFlashcards.handleFlashcardTextCheck(cardIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      fastFlashcards.handleCompositeOptionSelect(cardIndex, partIndex, keys);
    },
    [fastFlashcards],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (
      cardIndex: number,
      partIndex: number,
      itemId: string,
      value: "wahr" | "falsch",
    ) => {
      fastFlashcards.handleCompositeTrueFalseSelect(
        cardIndex,
        partIndex,
        itemId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      fastFlashcards.handleCompositeClozeInputChange(
        cardIndex,
        partIndex,
        blankId,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
        fastFlashcards.handleCompositeClozeTokenDrop(
          event,
          cardIndex,
          partIndex,
          blankId,
          validTokenIds,
          dragBlankIds,
        );
      },
      [fastFlashcards],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      fastFlashcards.handleCompositeClozeTokenRemove(
        cardIndex,
        partIndex,
        blankId,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      fastFlashcards.handleCompositeTextInputChange(
        cardIndex,
        partIndex,
        value,
      );
    },
    [fastFlashcards],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      fastFlashcards.handleCompositeTextCheck(cardIndex, partIndex);
    },
    [fastFlashcards],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      fastFlashcards.handleCompositeSelfGrade(cardIndex, partIndex, grade);
    },
    [fastFlashcards],
  );

  const finalizeSession = useCallback(() => {
    if (!sessionStartRef.current) {
      return;
    }
    const counted = sessionCountedRef.current;
    const submittedIndices = Object.keys(flashcardSubmissions)
      .map((key) => Number(key))
      .filter((index) => flashcardSubmissions[index])
      .filter((index) => !counted.has(index));
    recordSessionResults(submittedIndices);

    let correct = 0;
    let incorrect = 0;
    let timeout = 0;
    sessionResultsRef.current.forEach((result) => {
      if (result === "correct") {
        correct += 1;
      } else if (result === "incorrect") {
        incorrect += 1;
      } else {
        timeout += 1;
      }
    });

    const total = correct + incorrect + timeout;
    if (total === 0) {
      return;
    }
    const durationMs = Math.max(0, Date.now() - sessionStartRef.current);
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const pace =
      durationMs > 0 ? Number((total / (durationMs / 60000)).toFixed(1)) : 0;
    const baseScore =
      correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
      incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
      timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
    const multiplier = getFastFlashcardMultiplier(selectedDuration);
    const score = Math.round(baseScore * multiplier);

    setSessionElapsedMs(durationMs);
    setSessionHistory((prev) => [
      ...prev,
      {
        id: buildSessionId(),
        endedAt: new Date().toISOString(),
        score,
        correct,
        incorrect,
        timeout,
        total,
        accuracy,
        pace,
        durationMs,
      },
    ]);
  }, [flashcardSubmissions, recordSessionResults, selectedDuration]);

  const handleTimeToggle = useCallback(() => {
    setIsTimeModeEnabled((prev) => {
      if (prev) {
        finalizeSession();
      }
      return !prev;
    });
  }, [finalizeSession]);

  const handleFastSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean) => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSubmit(cardIndex, canSubmit);
    },
    [handleFlashcardSubmit, timeModeActive],
  );

  const handleFastSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      if (!timeModeActive) {
        return;
      }
      handleFlashcardSelfGrade(cardIndex, grade);
    },
    [handleFlashcardSelfGrade, timeModeActive],
  );

  const sessionCompleted =
    sessionStats.correct + sessionStats.incorrect + sessionStats.timeout;
  const sessionMissed = sessionStats.incorrect + sessionStats.timeout;
  const sessionAccuracy =
    sessionCompleted > 0
      ? Math.round((sessionStats.correct / sessionCompleted) * 100)
      : 0;
  const sessionBaseScore =
    sessionStats.correct * FAST_FLASHCARD_SCORE_BY_RESULT.correct +
    sessionStats.incorrect * FAST_FLASHCARD_SCORE_BY_RESULT.incorrect +
    sessionStats.timeout * FAST_FLASHCARD_SCORE_BY_RESULT.timeout;
  const sessionMultiplier = getFastFlashcardMultiplier(selectedDuration);
  const sessionScore = Math.round(sessionBaseScore * sessionMultiplier);
  const sessionMinutes = sessionElapsedMs / 60000;
  const sessionPace =
    sessionMinutes > 0 ? (sessionCompleted / sessionMinutes).toFixed(1) : "0.0";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "ToDoList"),
    [vault.vaultPath],
  );
  const lastSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt))
      .slice(0, 10);
  }, [sessionHistory]);
  const topSessions = useMemo(() => {
    return [...sessionHistory]
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return getSessionTimeValue(b.endedAt) - getSessionTimeValue(a.endedAt);
      })
      .slice(0, 3);
  }, [sessionHistory]);

  return (
    <div className="fast-flashcard-layout">
      <section className="panel fast-stats-panel">
        <div className="panel-header">
          <div>
            <h2>Statistics Diagram</h2>
            <p className="muted">Progress trends over time</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="fast-stats-switch">
            <span className="label">View</span>
            <button
              type="button"
              className={`timer-start-button ${isTimeModeEnabled ? "active" : ""}`}
              onClick={handleTimeToggle}
              aria-pressed={isTimeModeEnabled}
            >
              <span className="timer-start-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="7.5" />
                  <path d="M12 7.5v4.4l2.8 1.8" />
                </svg>
              </span>
              <span className="timer-start-text">
                <span className="timer-start-meta">Time</span>
                <span className="timer-start-action">
                  {isTimeModeEnabled ? "Stop" : "Start"}
                </span>
              </span>
            </button>
          </div>
          <div className="fast-stats-blocks">
            <div className="fast-time-block">
              <div className="fast-block-header">
                <span className="label">Time</span>
                <span
                  className={`fast-time-status ${
                    timeModeActive ? "active" : "inactive"
                  }`}
                >
                  {timeStatusLabel}
                </span>
              </div>
              <div
                className="fast-time-meter"
                style={timeProgressStyle}
                aria-hidden="true"
              />
              <div className="fast-time-scale">
                <span>0s</span>
                <span>{selectedDuration}s</span>
              </div>
            </div>
            <div className="fast-stats-block">
              <div className="fast-stats-block-header">
                <span className="label">Statistics</span>
              </div>
              <div className="fast-stats-grid">
                <div className="fast-stats-labels">
                  <span className="stats-label">Correct</span>
                  <span className="stats-label">Incorrect</span>
                  <span className="stats-label">Total</span>
                </div>
                <div
                  className={statsChartClass}
                  style={statsChartStyle}
                  role="img"
                  aria-label={`Total ${statsTotal}`}
                >
                  <div className="stats-chart-label">
                    <span className="stats-chart-total">{statsTotal}</span>
                    <span className="stats-chart-caption">Total</span>
                  </div>
                </div>
                <div className="fast-stats-values">
                  <span className="stats-value">{statsCorrect}</span>
                  <span className="stats-value">{statsIncorrect}</span>
                  <span className="stats-value">{statsTotal}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="fast-session-section">
            <div className="fast-section-header">
              <div>
                <h3 className="fast-section-title">Session Momentum</h3>
                <p className="muted">Your progress for the current timer run.</p>
              </div>
            </div>
            <div className="fast-session-grid">
              <div className="fast-session-card">
                <span className="label">Cards</span>
                <span className="fast-session-value">{sessionCompleted}</span>
                <span className="fast-session-sub">Completed</span>
              </div>
              <div className="fast-session-card">
                <span className="label">Accuracy</span>
                <span className="fast-session-value">{sessionAccuracy}%</span>
                <span className="fast-session-sub">
                  {sessionStats.correct} correct / {sessionMissed} missed
                </span>
              </div>
              <div className="fast-session-card">
                <span className="label">Pace</span>
                <span className="fast-session-value">{sessionPace}</span>
                <span className="fast-session-sub">cards / min</span>
              </div>
            <div className="fast-session-card">
              <span className="label">Score</span>
              <span className="fast-session-value">{sessionScore}</span>
              <span className="fast-session-sub">
                +10 / -5 • x{sessionMultiplier.toFixed(1)}
              </span>
            </div>
            </div>
          </div>
          <div className="fast-vault-block">
            <span className="label">AKTIVER VAULT</span>
            <div className="fast-vault-row">
              <span>Vault: {vaultName}</span>
              <span className="fast-vault-sep" aria-hidden="true">
                •
              </span>
              <span>Cards loaded: {fastFlashcards.flashcards.length}</span>
              <span className="fast-vault-sep" aria-hidden="true">
                •
              </span>
              <span>Filtered cards: {fastFlashcards.filteredFlashcardCount}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="panel fast-tools-panel">
        <div className="panel-header">
          <div>
            <h2>Fast Flashcard Tools</h2>
            <p className="muted">Scan current notes for cards.</p>
          </div>
        </div>
        <div className="panel-body">
          <button
            type="button"
            className="primary"
            onClick={fastFlashcards.handleFlashcardScan}
            disabled={fastFlashcards.isFlashcardScanning}
          >
            {fastFlashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
          </button>
          <div className="flashcard-controls">
            <div className="toolbar-section">
              <span className="label">Duration</span>
              <div className="pill-grid">
                {FAST_FLASHCARD_DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    className={`pill pill-button ${
                      selectedDuration === duration ? "active" : ""
                    }`}
                    aria-pressed={selectedDuration === duration}
                    disabled={isTimeModeEnabled}
                    title={
                      isTimeModeEnabled ? "Stop timer to change duration" : undefined
                    }
                    onClick={() => setSelectedDuration(duration)}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </div>
            <FastFlashcardToolsSettings
              fastFlashcardOrder={settings.fastFlashcardOrder}
              fastFlashcardMode={settings.fastFlashcardMode}
              fastFlashcardScope={settings.fastFlashcardScope}
              setFastFlashcardOrder={settings.setFastFlashcardOrder}
              setFastFlashcardMode={settings.setFastFlashcardMode}
              setFastFlashcardScope={settings.setFastFlashcardScope}
            />
          </div>
        </div>
      </section>

      <section className="panel fast-history-panel">
        <div className="panel-header">
          <div>
            <h2>Session History</h2>
            <p className="muted">Top scores and recent runs.</p>
          </div>
        </div>
        <div className="panel-body">
          {sessionHistory.length === 0 ? (
            <div className="empty-state">No sessions yet.</div>
          ) : (
            <div className="fast-history-sections">
              <div className="fast-session-section">
                <div>
                  <h3 className="fast-section-title">Top 3 Sessions</h3>
                  <p className="muted">Highest scores so far.</p>
                </div>
                <div className="fast-session-table">
                  <div className="fast-session-row header">
                    <span className="fast-session-cell timestamp">Date/Time</span>
                    <span className="fast-session-cell">Score</span>
                    <span className="fast-session-cell">Accuracy</span>
                    <span className="fast-session-cell">Pace</span>
                  </div>
                  {topSessions.map((session) => (
                    <div key={session.id} className="fast-session-row">
                      <span className="fast-session-cell timestamp">
                        {formatSessionTimestamp(session.endedAt)}
                      </span>
                      <span className="fast-session-cell">{session.score}</span>
                      <span className="fast-session-cell">{session.accuracy}%</span>
                      <span className="fast-session-cell">
                        {formatSessionPace(session.pace)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="fast-session-section">
                <div>
                  <h3 className="fast-section-title">Last 10 Sessions</h3>
                  <p className="muted">Most recent timer runs.</p>
                </div>
                <div className="fast-session-table">
                  <div className="fast-session-row header">
                    <span className="fast-session-cell timestamp">Date/Time</span>
                    <span className="fast-session-cell">Score</span>
                    <span className="fast-session-cell">Accuracy</span>
                    <span className="fast-session-cell">Pace</span>
                  </div>
                  {lastSessions.map((session) => (
                    <div key={session.id} className="fast-session-row">
                      <span className="fast-session-cell timestamp">
                        {formatSessionTimestamp(session.endedAt)}
                      </span>
                      <span className="fast-session-cell">{session.score}</span>
                      <span className="fast-session-cell">{session.accuracy}%</span>
                      <span className="fast-session-cell">
                        {formatSessionPace(session.pace)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel fast-flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcard</h2>
            {!hasScannedCards ? (
              <p className="muted">{fastFlashcardStatusLabel}</p>
            ) : null}
          </div>
        </div>
        <div className="panel-body">
          {!hasScannedCards ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : !hasFilteredCards ? (
            <div className="empty-state">No cards match the selected mode.</div>
          ) : currentEntry ? (
            <div className="flashcard-list">
              {currentEntry.card.kind === "composite" ? (
                <CompositeCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  partStates={
                    fastFlashcards.flashcardCompositeStates[currentEntry.cardIndex] ?? []
                  }
                  onOptionSelect={handleCompositeOptionSelect}
                  onTrueFalseSelect={handleCompositeTrueFalseSelect}
                  onClozeInputChange={handleCompositeClozeInputChange}
                  onClozeTokenDrop={handleCompositeClozeTokenDrop}
                  onClozeTokenRemove={handleCompositeClozeTokenRemove}
                  onClozeTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
                  onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
                  onTextInputChange={handleCompositeTextInputChange}
                  onTextCheck={handleCompositeTextCheck}
                  onSelfGrade={handleCompositeSelfGrade}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "cloze" ? (
                <ClozeCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  responses={
                    fastFlashcards.flashcardClozeResponses[currentEntry.cardIndex] ?? {}
                  }
                  onInputChange={handleClozeInputChange}
                  onTokenDrop={handleClozeTokenDrop}
                  onTokenRemove={handleClozeTokenRemove}
                  onTokenDragStart={fastFlashcards.handleClozeTokenDragStart}
                  onBlankDragOver={fastFlashcards.handleClozeBlankDragOver}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "true-false" ? (
                <TrueFalseCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  selections={
                    fastFlashcards.flashcardTrueFalseSelections[currentEntry.cardIndex] ?? {}
                  }
                  onSelect={handleTrueFalseSelect}
                  onSubmit={handleFastSubmit}
                />
              ) : currentEntry.card.kind === "free-text" ? (
                <FreeTextCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  response={
                    fastFlashcards.flashcardTextResponses[currentEntry.cardIndex] ?? ""
                  }
                  revealed={
                    fastFlashcards.flashcardTextRevealed[currentEntry.cardIndex] ?? false
                  }
                  selfGrade={fastFlashcards.flashcardSelfGrades[currentEntry.cardIndex]}
                  onInputChange={handleTextInputChange}
                  onCheck={handleTextCheck}
                  onSelfGrade={handleFastSelfGrade}
                />
              ) : (
                <MultipleChoiceCard
                  key={`fast-flashcard-${currentEntry.cardIndex}`}
                  card={currentEntry.card}
                  cardIndex={currentEntry.cardIndex}
                  submitted={isCurrentSubmitted}
                  submissionLocked={submissionLocked}
                  selectedKeys={
                    fastFlashcards.flashcardSelections[currentEntry.cardIndex] ?? []
                  }
                  onSelect={handleOptionSelect}
                  onSubmit={handleFastSubmit}
                />
              )}
            </div>
          ) : (
            <div className="empty-state">No cards available.</div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={() => setFastCardPosition((prev) => Math.max(0, prev - 1))}
              disabled={!canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={() =>
                setFastCardPosition((prev) =>
                  Math.min(prev + 1, Math.max(orderedEntries.length - 1, 0)),
                )
              }
              disabled={!canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

---

## 📝 FlashcardPage.tsx — ./pages/FlashcardPage.tsx

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { CompositeCard } from "../components/flashcards/CompositeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { StatsPanel } from "../components/StatsPanel";
import { useAppState } from "../components/AppStateProvider";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../features/flashcards/logic";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

const flashcardStatusLabel = "Not scanned yet";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const FlashcardPage = () => {
  const { flashcards } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const totalQuestions = flashcards.filteredFlashcardCount;
  const hasScannedCards = flashcards.flashcards.length > 0;
  const hasFilteredCards = flashcards.filteredFlashcardCount > 0;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isFocusMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (flashcards.canGoBack) {
          flashcards.handleFlashcardPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (flashcards.canGoNext) {
          flashcards.handleFlashcardPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleEntries = flashcards.visibleFlashcardEntries;
      if (visibleEntries.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleEntries.length; localIndex += 1) {
          const entry = visibleEntries[localIndex];
          const cardIndex = entry.cardIndex;
          const card = entry.card;
          if (flashcards.flashcardSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "composite") {
            const partStates = flashcards.flashcardCompositeStates[cardIndex] ?? [];
            const canSubmit =
              card.parts.length > 0 &&
              card.parts.every((part, partIndex) =>
                isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
              );
            if (canSubmit) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "multiple-choice") {
            if ((flashcards.flashcardSelections[cardIndex] ?? []).length > 0) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections = flashcards.flashcardTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "free-text") {
            continue;
          }
          const responses = flashcards.flashcardClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        visibleEntries.some((entry) => entry.cardIndex === activeCardIndex)
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const resolvedEntry = visibleEntries.find(
        (entry) => entry.cardIndex === resolvedIndex,
      );
      const card = resolvedEntry?.card;
      if (!card || flashcards.flashcardSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "composite") {
        const partStates = flashcards.flashcardCompositeStates[resolvedIndex] ?? [];
        const canSubmit =
          card.parts.length > 0 &&
          card.parts.every((part, partIndex) =>
            isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
          );
        if (!canSubmit) {
          return;
        }
      } else if (card.kind === "multiple-choice") {
        if ((flashcards.flashcardSelections[resolvedIndex] ?? []).length === 0) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections = flashcards.flashcardTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
      const responses = flashcards.flashcardClozeResponses[resolvedIndex] ?? {};
      if (!areClozeBlanksComplete(card, responses)) {
        return;
      }
    }

    event.preventDefault();
    flashcards.handleFlashcardSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardIndex,
    flashcards,
    isFocusMode,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardOptionSelect(cardIndex, keys);
    },
    [flashcards],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleTrueFalseSelect(cardIndex, itemId, value);
    },
    [flashcards],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeInputChange(cardIndex, blankId, value);
    },
    [flashcards],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [flashcards],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleClozeTokenRemove(cardIndex, blankId);
    },
    [flashcards],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextInputChange(cardIndex, value);
    },
    [flashcards],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardTextCheck(cardIndex);
    },
    [flashcards],
  );

  const handleSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleFlashcardSelfGrade(cardIndex, grade);
    },
    [flashcards],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeOptionSelect(cardIndex, partIndex, keys);
    },
    [flashcards],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTrueFalseSelect(cardIndex, partIndex, itemId, value);
    },
    [flashcards],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeInputChange(cardIndex, partIndex, blankId, value);
    },
    [flashcards],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeTokenDrop(
        event,
        cardIndex,
        partIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [flashcards],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeClozeTokenRemove(cardIndex, partIndex, blankId);
    },
    [flashcards],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTextInputChange(cardIndex, partIndex, value);
    },
    [flashcards],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeTextCheck(cardIndex, partIndex);
    },
    [flashcards],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      flashcards.handleCompositeSelfGrade(cardIndex, partIndex, grade);
    },
    [flashcards],
  );

  return (
    <div className={`flashcard-layout ${isFocusMode ? "focus-mode" : ""}`}>
      <section className="panel flashcard-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcard</h2>
            {!hasScannedCards ? (
              <p className="muted">{flashcardStatusLabel}</p>
            ) : null}
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className={`focus-toggle ${isFocusMode ? "active" : ""}`}
              onClick={() => setIsFocusMode((prev) => !prev)}
              aria-pressed={isFocusMode}
              aria-label={focusLabel}
              title={focusLabel}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-body">
          {!hasScannedCards ? (
            <div className="empty-state">
              Select a note from DASHBOARD and start the flashcard scan
            </div>
          ) : !hasFilteredCards ? (
            <div className="empty-state">No cards match the selected mode.</div>
          ) : (
            <div className="flashcard-list">
              {flashcards.visibleFlashcardEntries.map((entry) => {
                const cardIndex = entry.cardIndex;
                const card = entry.card;
                const submitted = !!flashcards.flashcardSubmissions[cardIndex];

                if (card.kind === "composite") {
                  return (
                    <CompositeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      partStates={flashcards.flashcardCompositeStates[cardIndex] ?? []}
                      onOptionSelect={handleCompositeOptionSelect}
                      onTrueFalseSelect={handleCompositeTrueFalseSelect}
                      onClozeInputChange={handleCompositeClozeInputChange}
                      onClozeTokenDrop={handleCompositeClozeTokenDrop}
                      onClozeTokenRemove={handleCompositeClozeTokenRemove}
                      onClozeTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onTextInputChange={handleCompositeTextInputChange}
                      onTextCheck={handleCompositeTextCheck}
                      onSelfGrade={handleCompositeSelfGrade}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "cloze") {
                  return (
                    <ClozeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      responses={flashcards.flashcardClozeResponses[cardIndex] ?? {}}
                      onInputChange={handleClozeInputChange}
                      onTokenDrop={handleClozeTokenDrop}
                      onTokenRemove={handleClozeTokenRemove}
                      onTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "true-false") {
                  return (
                    <TrueFalseCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      selections={flashcards.flashcardTrueFalseSelections[cardIndex] ?? {}}
                      onSelect={handleTrueFalseSelect}
                      onSubmit={flashcards.handleFlashcardSubmit}
                    />
                  );
                }

                if (card.kind === "free-text") {
                  return (
                    <FreeTextCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      response={flashcards.flashcardTextResponses[cardIndex] ?? ""}
                      revealed={flashcards.flashcardTextRevealed[cardIndex] ?? false}
                      selfGrade={flashcards.flashcardSelfGrades[cardIndex]}
                      onInputChange={handleTextInputChange}
                      onCheck={handleTextCheck}
                      onSelfGrade={handleSelfGrade}
                    />
                  );
                }

                return (
                  <MultipleChoiceCard
                    key={`flashcard-${cardIndex}`}
                    card={card}
                    cardIndex={cardIndex}
                    submitted={submitted}
                    selectedKeys={flashcards.flashcardSelections[cardIndex] ?? []}
                    onSelect={handleOptionSelect}
                    onSubmit={flashcards.handleFlashcardSubmit}
                  />
                );
              })}
            </div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageBack}
              disabled={!flashcards.canGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={flashcards.handleFlashcardPageNext}
              disabled={!flashcards.canGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFocusMode ? null : (
        <div className="flashcard-sidebar">
          <section className="panel toolbar-panel">
            <div className="panel-header">
              <div>
                <h2>Flashcard Tools</h2>
                <p className="muted">Scan current notes for cards.</p>
              </div>
            </div>
            <div className="panel-body">
              <button
                type="button"
                className="primary"
                onClick={flashcards.handleFlashcardScan}
                disabled={flashcards.isFlashcardScanning}
              >
                {flashcards.isFlashcardScanning ? "Scanning..." : "Flashcard"}
              </button>
              <div className="flashcard-controls">
                <div className="toolbar-section">
                  <span className="label">ORDER</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "in-order" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "in-order"}
                      onClick={() => flashcards.setFlashcardOrder("in-order")}
                    >
                      In order
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardOrder === "random" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardOrder === "random"}
                      onClick={() => flashcards.setFlashcardOrder("random")}
                    >
                      Random
                    </button>
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">MODE</span>
                  <select
                    className="text-input"
                    value={flashcards.flashcardMode}
                    onChange={(event) =>
                      flashcards.setFlashcardMode(
                        event.target.value as typeof flashcards.flashcardMode,
                      )
                    }
                    aria-label="Select mode filter"
                  >
                    <option value="all">All</option>
                    <option value="qa">Q&amp;A</option>
                    <option value="multiple-choice">Multiple Choice</option>
                    <option value="fill-blank">Fill-in-the-blank</option>
                    <option value="assignment">Assignment</option>
                    <option value="true-false">True/False</option>
                    <option value="mix">Mix</option>
                  </select>
                </div>
                <div className="toolbar-section">
                  <span className="label">PAGE SIZE</span>
                  <div className="pill-grid">
                    {FLASHCARD_PAGE_SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={`pill pill-button ${
                          flashcards.flashcardPageSize === size ? "active" : ""
                        }`}
                        aria-pressed={flashcards.flashcardPageSize === size}
                        onClick={() => flashcards.setFlashcardPageSize(size)}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="toolbar-section">
                  <span className="label">DEFAULT SCOPE</span>
                  <div className="pill-grid">
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "current" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "current"}
                      onClick={() => flashcards.setFlashcardScope("current")}
                    >
                      Current note
                    </button>
                    <button
                      type="button"
                      className={`pill pill-button ${
                        flashcards.flashcardScope === "vault" ? "active" : ""
                      }`}
                      aria-pressed={flashcards.flashcardScope === "vault"}
                      onClick={() => flashcards.setFlashcardScope("vault")}
                    >
                      Whole vault
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <StatsPanel
            correctCount={flashcards.correctCount}
            correctPercent={flashcards.correctPercent}
            incorrectCount={flashcards.incorrectCount}
            totalQuestions={totalQuestions}
          />
        </div>
      )}
    </div>
  );
};

---

## 📝 HelpPage.tsx — ./pages/HelpPage.tsx

import { useEffect, useRef, useState } from "react";
import { useAppState } from "../components/AppStateProvider";

type AppLanguage = "de" | "en";
type LocalizedText = { de?: string; en?: string };

type HelpExample = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
};

type SyntaxDetail = {
  whatItIs: string;
  rules: string[];
  rulesNote?: string;
  promptTemplate: string;
  example: string;
  mistakes?: string[];
};

type SyntaxEntry = {
  id: string;
  title: LocalizedText;
  markers: string[];
  keyRule: LocalizedText;
  snippet?: LocalizedText;
  detail: { en: SyntaxDetail; de: SyntaxDetail };
};

type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: HelpExample[];
  tone?: "help-block";
};

type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: HelpSection[];
  draft?: boolean;
  icon?: string;
};

type AppSectionId =
  | "dashboard"
  | "flashcard"
  | "fast-flashcard"
  | "spaced-repetition";

type AppSectionContent = {
  title: LocalizedText;
  description: LocalizedText;
  whatYouSee: LocalizedText;
  coreActions: LocalizedText;
  showingCards: LocalizedText;
  workflow: LocalizedText;
};

const helpHeader = {
  eyebrow: { en: "Help", de: "Hilfe" },
  title: { en: "Help", de: "Hilfe" },
  summary: {
    en: "Quick reminders for the workflow and syntax.",
    de: "Kurze Hinweise zum Workflow und zur Syntax.",
  },
};

const helpLabels = {
  back: { en: "Back", de: "Zurueck" },
  copy: { en: "Copy", de: "Kopieren" },
  copied: { en: "Copied", de: "Kopiert" },
  copyExample: { en: "Copy example", de: "Beispiel kopieren" },
  copyPrompt: { en: "Copy LLM prompt", de: "LLM-Prompt kopieren" },
  promptTemplate: { en: "LLM prompt template", de: "LLM-Prompt-Template" },
  example: { en: "Example", de: "Beispiel" },
  rules: { en: "Rules", de: "Regeln" },
  whatItIs: { en: "What it is", de: "Was ist es" },
  mistakes: { en: "Common mistakes", de: "Haeufige Fehler" },
  markers: { en: "Markers", de: "Marker" },
  draft: { en: "Draft", de: "Entwurf" },
  openTopic: { en: "Open topic", de: "Thema oeffnen" },
};

const joinLines = (lines: string[]) => lines.join("\n");

const flashcardSyntaxOverview = {
  title: { en: "Core rules", de: "Grundregeln" },
  bullets: [
    {
      en: "Wrap every card with #card and # on their own lines; content outside is ignored.",
      de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.",
    },
    {
      en: "The first non-empty line is the prompt.",
      de: "Die erste nicht-leere Zeile ist die Frage.",
    },
    {
      en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.",
      de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.",
    },
  ],
};

const flashcardSyntaxEntries: SyntaxEntry[] = [
  {
    id: "separator-block",
    title: { en: "Structured separator block", de: "Strukturierter Separator-Block" },
    markers: ["---", "#card", "#"],
    keyRule: {
      en: "Use --- to wrap cards; only #card/# defines card content.",
      de: "--- kann Karten umrahmen; nur #card/# definiert Karteninhalt.",
    },
    snippet: {
      en: "---\n#card",
      de: "---\n#card",
    },
    detail: {
      en: {
        whatItIs:
          "Markdown separators (---) can wrap card blocks to structure notes. The parser still relies on #card and #; text outside the block is ignored.",
        rules: [
          "Use --- on its own lines if you want separators.",
          "Cards still require #card and # on their own lines.",
          "Content outside #card/# is ignored.",
          "Do not expect --- to start or end a card by itself.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        rulesNote:
          "Cards must be wrapped with #card and #. The first non-empty line is the question. The remaining lines define the card type (options, blanks, or Answer/Antwort marker). Workflow: Dashboard -> select note -> scan -> review (via Flashcard Tools or Spaced Repetition Tools).",
        promptTemplate: joinLines([
          "Create one flashcard and optionally wrap it with markdown separators.",
          "Return only the #card block (and optional --- lines).",
          "Rules:",
          "- #card/# define the card.",
          "- --- is optional and must be on its own lines.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "---",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Define CPU.",
          "Answer: The central processing unit.",
          "#",
          "---",
        ]),
        mistakes: [
          "Using --- without #card/#.",
          "Placing --- inside the #card block.",
        ],
      },
      de: {
        whatItIs:
          "Markdown-Trennlinien (---) koennen Kartenbloecke optisch gruppieren. Der Parser nutzt weiterhin #card und #; Text ausserhalb wird ignoriert.",
        rules: [
          "--- nur als eigene Zeile verwenden.",
          "Karten brauchen weiterhin #card und # auf eigenen Zeilen.",
          "Inhalt ausserhalb #card/# wird ignoriert.",
          "--- ersetzt keine #card/#-Markierung.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        rulesNote:
          "Karten muessen mit #card und # umschlossen sein. Die erste nicht-leere Zeile ist die Frage. Die restlichen Zeilen definieren den Kartentyp (Optionen, Luecken oder Answer-/Antwort-Marker). Workflow: Dashboard -> Notiz waehlen -> scannen -> wiederholen (ueber Flashcard Tools oder Spaced Repetition Tools).",
        promptTemplate: joinLines([
          "Erstelle eine Karte und umrahme sie optional mit Markdown-Trennlinien.",
          "Antworte nur mit dem #card-Block (und optional ---).",
          "Regeln:",
          "- #card/# definieren die Karte.",
          "- --- ist optional und steht allein in der Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "---",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
          "---",
        ]),
        example: joinLines([
          "---",
          "#card",
          "Definiere CPU.",
          "Antwort: Die zentrale Verarbeitungseinheit.",
          "#",
          "---",
        ]),
        mistakes: [
          "--- ohne #card/# verwenden.",
          "--- innerhalb des #card-Blocks platzieren.",
        ],
      },
    },
  },
  {
    id: "qa-classic",
    title: { en: "Classic Q&A", de: "Klassische Q&A" },
    markers: ["Answer:", "Antwort:"],
    keyRule: {
      en: "Answer:/Antwort: splits front and back; answers can be multiline.",
      de: "Answer:/Antwort: trennt Vorder- und Rueckseite; Antworten koennen mehrzeilig sein.",
    },
    snippet: {
      en: "Answer: {{answer}}",
      de: "Antwort: {{antwort}}",
    },
    detail: {
      en: {
        whatItIs:
          "Use a direct question on the first non-empty line and provide the answer after the Answer: marker. The answer may be inline or on the following lines. Answer: and Antwort: behave identically; only the label language changes.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Start the answer with Answer: (or Antwort:) inside the block.",
          "Answer: and Antwort: behave identically; only the label language changes.",
          "Do not mix with other card types.",
        ],
        promptTemplate: joinLines([
          "Write exactly one flashcard in FMDFlashcard syntax.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use Answer: (or Antwort:) to start the answer.",
          "- Do not mix with other card types.",
          "Template:",
          "#card",
          "{{prompt}}",
          "Answer: {{answer}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "What is SQL?",
          "Answer: A language for querying databases.",
          "#",
        ]),
        mistakes: [
          "Placing Answer: before the prompt.",
          "Putting #card and # on the same line.",
          "Mixing with multiple choice or true/false.",
        ],
      },
      de: {
        whatItIs:
          "Nutze eine direkte Frage in der ersten nicht-leeren Zeile und schreibe die Antwort nach dem Marker Antwort: (oder Answer:). Die Antwort darf in derselben Zeile oder in den folgenden Zeilen stehen. Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Antwort mit Antwort: (oder Answer:) starten.",
          "Answer: und Antwort: verhalten sich identisch; nur die Sprache des Labels aendert sich.",
          "Nicht mit anderen Kartentypen mischen.",
        ],
        promptTemplate: joinLines([
          "Erstelle genau eine Karte in FMDFlashcard-Syntax.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Starte die Antwort mit Antwort: (oder Answer:).",
          "- Nicht mit anderen Kartentypen mischen.",
          "Template:",
          "#card",
          "{{frage}}",
          "Antwort: {{antwort}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Was ist SQL?",
          "Antwort: Eine Sprache zum Abfragen von Datenbanken.",
          "#",
        ]),
        mistakes: [
          "Antwort: vor die Frage setzen.",
          "#card und # in derselben Zeile schreiben.",
          "Mit Multiple Choice oder True/False mischen.",
        ],
      },
    },
  },
  {
    id: "mc-single",
    title: { en: "Multiple choice (Single Answer)", de: "Multiple Choice (eine Antwort)" },
    markers: ["a)", "b)", "c)", "-a"],
    keyRule: {
      en: "At least two options, exactly one correct marker (-a, -b, ...).",
      de: "Mindestens zwei Optionen, genau ein korrekter Marker (-a, -b, ...).",
    },
    snippet: {
      en: "a) {{option_a}}\n-b",
      de: "a) {{option_a}}\n-b",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with exactly one correct option. Label options as a), b), c) and mark the correct option with a single -a, -b, or -c line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Include exactly one correct marker (-a, -b, ...).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with a single correct answer.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- Exactly one correct marker (-a, -b, ...).",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which planet is known as the Red Planet?",
          "a) Earth",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Marking more than one correct option.",
          "Using option labels without a correct marker.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit genau einer richtigen Antwort. Optionen als a), b), c) schreiben und genau einen Marker -a, -b oder -c setzen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Genau einen korrekten Marker setzen (-a, -b, ...).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit genau einer richtigen Antwort.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Genau ein korrekter Marker (-a, -b, ...).",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welcher Planet ist der Rote Planet?",
          "a) Erde",
          "b) Mars",
          "c) Venus",
          "-b",
          "#",
        ]),
        mistakes: [
          "Mehrere richtige Marker setzen.",
          "Keine Option als richtig markieren.",
        ],
      },
    },
  },
  {
    id: "mc-multi",
    title: {
      en: "Multiple choice (Multiple Answers)",
      de: "Multiple Choice (mehrere Antworten)",
    },
    markers: ["a)", "b)", "c)", "-a", "-c"],
    keyRule: {
      en: "At least two options; multiple correct markers allowed.",
      de: "Mindestens zwei Optionen; mehrere korrekte Marker erlaubt.",
    },
    detail: {
      en: {
        whatItIs:
          "A multiple choice card with more than one correct option. Label options as a), b), c) and list every correct marker on its own line.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Provide at least two options labeled a), b), c) ...",
          "Allow multiple correct markers (-a, -b, -c).",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one multiple choice flashcard with multiple correct answers.",
          "Return only the #card block.",
          "Rules:",
          "- Prompt on the first non-empty line.",
          "- Options labeled a), b), c)...",
          "- List every correct marker on its own line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{correct_letter_1}}",
          "-{{correct_letter_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Which numbers are prime?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Using only one correct marker for a multi-answer prompt.",
          "Forgetting to mark all correct options.",
        ],
      },
      de: {
        whatItIs:
          "Eine Multiple-Choice-Karte mit mehreren richtigen Antworten. Optionen als a), b), c) schreiben und alle korrekten Marker jeweils in einer eigenen Zeile angeben.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Mindestens zwei Optionen mit a), b), c) ...",
          "Mehrere korrekte Marker erlaubt (-a, -b, -c).",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Multiple-Choice-Karte mit mehreren richtigen Antworten.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Frage in der ersten nicht-leeren Zeile.",
          "- Optionen als a), b), c)...",
          "- Alle korrekten Marker jeweils in eigener Zeile.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "a) {{option_a}}",
          "b) {{option_b}}",
          "c) {{option_c}}",
          "-{{korrekt_1}}",
          "-{{korrekt_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Welche Zahlen sind prim?",
          "a) 2",
          "b) 4",
          "c) 5",
          "-a",
          "-c",
          "#",
        ]),
        mistakes: [
          "Nur einen Marker setzen, obwohl mehrere Antworten richtig sind.",
          "Nicht alle korrekten Optionen markieren.",
        ],
      },
    },
  },
  {
    id: "true-false",
    title: { en: "True/False statements", de: "True/False-Aussagen" },
    markers: ["-true", "-false", "-wahr", "-falsch"],
    keyRule: {
      en: "Each statement line is followed by -true/-false (or -wahr/-falsch).",
      de: "Jede Aussage wird von -true/-false (oder -wahr/-falsch) gefolgt.",
    },
    snippet: {
      en: "Statement\n-true",
      de: "Aussage\n-true",
    },
    detail: {
      en: {
        whatItIs:
          "A statement followed by -true or -false. You can stack multiple statements in one card, as long as every statement line is immediately followed by its marker.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the first statement.",
          "Each statement line must be followed by -true/-false or -wahr/-falsch.",
          "You may stack multiple statement/marker pairs.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
          "Multilingual markers supported: -true/-false and -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Create one true/false flashcard, optionally with multiple statements.",
          "Return only the #card block.",
          "Rules:",
          "- Each statement line is followed by -true or -false.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "- Markers can be -true/-false or -wahr/-falsch.",
          "Template:",
          "#card",
          "{{statement_1}}",
          "-{{true_or_false_1}}",
          "{{statement_2}}",
          "-{{true_or_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "The Earth orbits the Sun.",
          "-true",
          "Pluto is a planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Writing two statements and only one marker.",
          "Placing a marker without a statement line.",
        ],
      },
      de: {
        whatItIs:
          "Eine Aussage gefolgt von -true oder -false. Du kannst mehrere Aussagen stapeln, solange jede Aussage direkt ihren Marker hat.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die erste Aussage.",
          "Jede Aussage braucht direkt danach -true/-false oder -wahr/-falsch.",
          "Mehrere Aussage/Marker-Paare sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Mehrsprachige Marker: -true/-false und -wahr/-falsch.",
        ],
        promptTemplate: joinLines([
          "Erstelle eine True/False-Karte, optional mit mehreren Aussagen.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Jede Aussage wird direkt von -true oder -false gefolgt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "- Marker koennen -true/-false oder -wahr/-falsch sein.",
          "Template:",
          "#card",
          "{{aussage_1}}",
          "-{{true_oder_false_1}}",
          "{{aussage_2}}",
          "-{{true_oder_false_2}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Die Erde kreist um die Sonne.",
          "-true",
          "Pluto ist ein Planet.",
          "-false",
          "#",
        ]),
        mistakes: [
          "Zwei Aussagen schreiben, aber nur einen Marker setzen.",
          "Marker ohne Aussagezeile setzen.",
        ],
      },
    },
  },
  {
    id: "inline-code-multi",
    title: { en: "Inline-code tokens", de: "Inline-Code-Tokens" },
    markers: ["`token`"],
    keyRule: {
      en: "Multiple `...` tokens in one line create multiple drag blanks.",
      de: "Mehrere `...`-Tokens in einer Zeile erzeugen mehrere Drag-Luecken.",
    },
    snippet: {
      en: "`git` `status`",
      de: "`git` `status`",
    },
    detail: {
      en: {
        whatItIs:
          "Inline code tokens (`...`) become draggable blanks. You can place multiple tokens in one line to create multiple blanks.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use backticks around each token.",
          "Multiple tokens per line are allowed.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one inline-code flashcard with multiple drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- Use backticks around each token.",
          "- You may include multiple tokens per line.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt}}",
          "{{text_with_`token_1`_and_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Complete the command:",
          "`git` `status` shows changes.",
          "#",
        ]),
        mistakes: [
          "Using single quotes instead of backticks.",
          "Leaving a token without closing backticks.",
        ],
      },
      de: {
        whatItIs:
          "Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Du kannst mehrere Tokens in einer Zeile setzen, um mehrere Luecken zu erzeugen.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "Jeden Token mit Backticks markieren.",
          "Mehrere Tokens pro Zeile sind erlaubt.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Inline-Code-Karte mit mehreren Drag-Tokens.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Tokens mit Backticks markieren.",
          "- Mehrere Tokens pro Zeile sind erlaubt.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage}}",
          "{{text_mit_`token_1`_und_`token_2`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Vervollstaendige den Befehl:",
          "`git` `status` zeigt Aenderungen.",
          "#",
        ]),
        mistakes: [
          "Einfache Anfuehrungszeichen statt Backticks nutzen.",
          "Token ohne schliessende Backticks.",
        ],
      },
    },
  },
  {
    id: "cloze-typed",
    title: { en: "Cloze (typed blanks)", de: "Cloze (Eingabe-Luecken)" },
    markers: ["%%...%%"],
    keyRule: {
      en: "%%...%% creates typed input blanks.",
      de: "%%...%% erzeugt Eingabe-Luecken.",
    },
    snippet: {
      en: "%%Paris%%",
      de: "%%Paris%%",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze cards hide parts of a sentence inside %%...%% and require typed input for each blank.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% to mark each typed blank.",
          "Each blank must have content inside the %%...%% markers.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard with typed blanks.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Use %%...%% for each blank.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting to close a %%...%% marker.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Karten verstecken Teile eines Satzes in %%...%% und erwarten eine getippte Eingabe fuer jede Luecke.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer jede Eingabe-Luecke nutzen.",
          "Jede Luecke muss Inhalt zwischen %%...%% haben.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte mit Eingabe-Luecken.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- %%...%% fuer jede Luecke nutzen.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Ergaenze: Die Hauptstadt von Frankreich ist %%Paris%%.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Luecken lassen.",
          "%%...%%-Marker nicht schliessen.",
        ],
      },
    },
  },
  {
    id: "cloze-inline",
    title: { en: "Cloze + inline code", de: "Cloze + Inline-Code" },
    markers: ["%%...%%", "`token`"],
    keyRule: {
      en: "Typed cloze blanks and inline-code drag tokens can be combined.",
      de: "Cloze-Luecken und Inline-Code-Drag-Tokens koennen kombiniert werden.",
    },
    snippet: {
      en: "%%Paris%% and `Seine`",
      de: "%%Paris%% und `Seine`",
    },
    detail: {
      en: {
        whatItIs:
          "Cloze blanks (%%...%%) are typed inputs, while inline code tokens (`...`) become drag blanks. You can use both in one card and combine with other syntaxes if desired.",
        rules: [
          "Wrap the card with #card and # on their own lines.",
          "The first non-empty line is the prompt.",
          "Use %%...%% for typed cloze blanks.",
          "Use `...` for drag tokens.",
          "Can be combined with other syntaxes in the same #card block (if desired).",
        ],
        promptTemplate: joinLines([
          "Create one cloze flashcard that may combine typed blanks and drag tokens.",
          "Return only the #card block.",
          "Rules:",
          "- First non-empty line is the prompt.",
          "- Typed blanks use %%...%%.",
          "- Drag tokens use `...`.",
          "- Can be combined with other syntaxes in the same #card block (if desired).",
          "Template:",
          "#card",
          "{{prompt_with_%%cloze%%_and_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: The capital of France is %%Paris%% and the river is `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leaving an empty %%...%% segment.",
          "Forgetting backticks around a drag token.",
        ],
      },
      de: {
        whatItIs:
          "Cloze-Luecken (%%...%%) sind Eingabefelder, Inline-Code-Tokens (`...`) werden zu Drag-Luecken. Beides kann in einer Karte stehen und mit anderen Syntaxen kombiniert werden.",
        rules: [
          "Karte mit #card und # auf eigenen Zeilen umschliessen.",
          "Die erste nicht-leere Zeile ist die Frage.",
          "%%...%% fuer Cloze-Eingaben nutzen.",
          "`...` fuer Drag-Tokens nutzen.",
          "Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
        ],
        promptTemplate: joinLines([
          "Erstelle eine Cloze-Karte, die Eingabeblanks und Drag-Tokens kombinieren darf.",
          "Antworte nur mit dem #card-Block.",
          "Regeln:",
          "- Erste nicht-leere Zeile ist die Frage.",
          "- Eingabeblanks mit %%...%%.",
          "- Drag-Tokens mit `...`.",
          "- Kann mit anderen Syntaxen im selben #card-Block kombiniert werden (falls gewuenscht).",
          "Template:",
          "#card",
          "{{frage_mit_%%cloze%%_und_`token`}}",
          "#",
        ]),
        example: joinLines([
          "#card",
          "Fill in: Die Hauptstadt von Frankreich ist %%Paris%% und der Fluss ist `Seine`.",
          "#",
        ]),
        mistakes: [
          "Leere %%...%%-Blaenke lassen.",
          "Backticks fuer Drag-Tokens vergessen.",
        ],
      },
    },
  },
];

const helpTopics: HelpTopic[] = [
  {
    id: "flashcard-syntax",
    title: { en: "Flashcard syntax", de: "Karteikarten-Syntax" },
    summary: {
      en: "Complete syntax reference with examples for every supported card type.",
      de: "Komplette Syntax-Referenz mit Beispielen fuer alle Kartentypen.",
    },
    sections: [],
  },
  {
    id: "spaced-repetition",
    title: { en: "App Sections", de: "App-Bereiche" },
    summary: {
      en: "Dashboard, Flashcard, Fast Flashcard, and Spaced Repetition – overview & getting started.",
      de: "Dashboard, Flashcard, Fast Flashcard und Spaced Repetition – Überblick & Einstieg.",
    },
    sections: [
      {
        id: "sr-boxes",
        title: { en: "Leitner boxes", de: "Leitner-Boxen" },
        bullets: [
          {
            en: "3/5/8 boxes represent learning stages.",
            de: "3/5/8 Boxen bilden Lernstufen ab.",
          },
          {
            en: "Cards in the last box are excluded from sessions.",
            de: "Karten in der letzten Box werden nicht angezeigt.",
          },
        ],
      },
      {
        id: "sr-progression",
        title: { en: "Progression", de: "Fortschritt" },
        bullets: [
          {
            en: "Correct answers promote a card; incorrect answers demote it.",
            de: "Korrekte Antworten befoerdern eine Karte, falsche stufen sie herunter.",
          },
        ],
      },
      {
        id: "sr-order",
        title: { en: "Default order", de: "Standardreihenfolge" },
        bullets: [
          {
            en: "In order, Random, or Repetition (box-weighted; lower boxes appear more often).",
            de: "In order, Random oder Repetition (box-gewichtet; niedrigere Boxen haeufiger).",
          },
        ],
      },
      {
        id: "sr-flow",
        title: { en: "Workflow", de: "Workflow" },
        bullets: [
          {
            en: "Select a user, load cards, review, and watch stats update live.",
            de: "User waehlen, Karten laden, wiederholen und Live-Statistiken beobachten.",
          },
        ],
      },
    ],
  },
  {
    id: "settings",
    title: { en: "Settings explained", de: "Einstellungen erklaert" },
    summary: {
      en: "What the main options control and where defaults live.",
      de: "Welche Optionen was steuern und wo Standards gesetzt werden.",
    },
    sections: [
      {
        id: "settings-flashcards",
        title: { en: "Flashcard Tools defaults", de: "Flashcard-Tools-Defaults" },
        bullets: [
          {
            en: "Scan scope, order, page size, and stats reset define the review flow.",
            de: "Scan-Scope, Reihenfolge, Page Size und Statistik-Reset steuern den Ablauf.",
          },
        ],
      },
      {
        id: "settings-sr",
        title: {
          en: "Spaced Repetition Tools defaults",
          de: "Spaced Repetition-Tools-Defaults",
        },
        bullets: [
          {
            en: "Boxes, order, page size, and repetition strength set SR behavior.",
            de: "Boxen, Reihenfolge, Page Size und Repetition Strength bestimmen SR.",
          },
        ],
      },
      {
        id: "settings-language",
        title: { en: "Language & appearance", de: "Sprache & Aussehen" },
        bullets: [
          {
            en: "Language switches labels instantly; theme and accent change visuals.",
            de: "Sprache schaltet Labels sofort um; Theme und Accent aendern das Aussehen.",
          },
        ],
      },
      {
        id: "settings-persistence",
        title: { en: "Persistence", de: "Persistenz" },
        bullets: [
          {
            en: "All settings and tool options are saved automatically and restored after restart.",
            de: "Alle Einstellungen und Tool-Optionen werden automatisch gespeichert.",
          },
        ],
      },
    ],
  },
  {
    id: "advanced",
    title: { en: "More settings / Advanced", de: "Weitere Einstellungen / Advanced" },
    summary: {
      en: "Performance, layout tweaks, and power options.",
      de: "Performance, Layout-Anpassungen und Power-Optionen.",
    },
    sections: [
      {
        id: "advanced-performance",
        title: { en: "Performance", de: "Performance" },
        bullets: [
          {
            en: "Max files per scan and scan parallelism limit how much is indexed at once.",
            de: "Max Files pro Scan und Scan-Parallelism begrenzen die Indexierung.",
          },
        ],
      },
      {
        id: "advanced-layout",
        title: { en: "Layout", de: "Layout" },
        bullets: [
          {
            en: "The right toolbar can be collapsed and restored with the FMD toggle.",
            de: "Die rechte Toolbar laesst sich ueber den FMD-Schalter einklappen.",
          },
        ],
      },
      {
        id: "advanced-data",
        title: { en: "Data & Sync", de: "Data & Sync" },
        bullets: [
          {
            en: "Data & Sync collects storage-related options; some items may be placeholders.",
            de: "Data & Sync enthaelt Speicher-Optionen; einige Punkte koennen Platzhalter sein.",
          },
        ],
      },
    ],
  },
  {
    id: "vault",
    title: { en: "Load a vault", de: "Vault laden" },
    summary: {
      en: "Select a vault and troubleshoot common issues.",
      de: "Vault auswaehlen und typische Probleme beheben.",
    },
    sections: [
      {
        id: "vault-select",
        title: { en: "Select a vault", de: "Vault auswaehlen" },
        bullets: [
          {
            en: "Use Dashboard to choose a folder and allow access when prompted.",
            de: "Im Dashboard einen Ordner waehlen und Zugriff erlauben.",
          },
          {
            en: "After loading, pick a note to preview and scan.",
            de: "Nach dem Laden eine Notiz waehlen und scannen.",
          },
        ],
      },
      {
        id: "vault-issues",
        title: { en: "Common issues", de: "Haeufige Probleme" },
        bullets: [
          {
            en: "Missing permissions can block the file list or previews.",
            de: "Fehlende Berechtigungen blockieren Dateiliste oder Vorschau.",
          },
          {
            en: "If the list is empty, verify the path and markdown file types.",
            de: "Bei leerer Liste Pfad und Markdown-Dateien pruefen.",
          },
          {
            en: "If the vault moved, reselect it in Dashboard.",
            de: "Wenn der Vault verschoben wurde, neu auswaehlen.",
          },
        ],
      },
    ],
  },
  {
    id: "extras",
    title: { en: "Additional features", de: "Weitere Funktionsbereiche" },
    summary: {
      en: "Focus mode, shortcuts, and optional tooling.",
      de: "Fokusmodus, Shortcuts und optionale Funktionen.",
    },
    sections: [
      {
        id: "extras-focus",
        title: { en: "Focus mode", de: "Fokusmodus" },
        bullets: [
          {
            en: "Use the eye icon to focus on the card and hide the rest of the UI.",
            de: "Mit dem Auge-Icon nur die Karte anzeigen und den Rest ausblenden.",
          },
          {
            en: "Press Esc to exit focus mode.",
            de: "Mit Esc den Fokusmodus verlassen.",
          },
        ],
      },
      {
        id: "extras-shortcuts",
        title: { en: "Shortcuts", de: "Shortcuts" },
        bullets: [
          {
            en: "In focus mode: Left/Right for Back/Next, Enter to submit when possible.",
            de: "Im Fokusmodus: Links/Rechts fuer Zurueck/Weiter, Enter zum Abgeben.",
          },
          {
            en: "Shortcuts are ignored while typing in inputs.",
            de: "Shortcuts werden in Eingabefeldern ignoriert.",
          },
        ],
      },
      {
        id: "extras-import",
        title: { en: "Import / Export", de: "Import / Export" },
        bullets: [
          {
            en: "If available, use Data & Sync to manage exports; otherwise it is coming later.",
            de: "Falls vorhanden, ueber Data & Sync exportieren; sonst Coming Later.",
          },
        ],
      },
    ],
  },
];

const APP_SECTION_ORDER: AppSectionId[] = [
  "dashboard",
  "flashcard",
  "fast-flashcard",
  "spaced-repetition",
];

const APP_SECTION_INTRO: LocalizedText = {
  en: "The Dashboard lists your notes, lets you select one, and keeps track of recent scans. Select a note, click Scan to build or refresh its cards, then jump into Flashcard, Fast Flashcard, or Spaced Repetition to start reviewing quickly.",
  de: "Das Dashboard listet deine Notizen, erlaubt die Auswahl einer aktiven Notiz und zeigt Scan-Status. Wähle eine Notiz, klicke auf Scannen, um Karten zu erstellen oder zu aktualisieren, und starte dann Flashcard, Fast Flashcard oder Spaced Repetition zum Wiederholen.",
};

const APP_SECTION_DETAILS: Record<AppSectionId, AppSectionContent> = {
  dashboard: {
    title: { en: "Dashboard", de: "Dashboard" },
    description: {
      en: "Dashboard is the home screen for selecting notes, seeing scan progress, and spotting new cards. It summarizes each note’s scan status, last scan time, and quick links to open the file. After selecting a note and clicking Scan, the app builds or refreshes that note’s cards so every review tool works with the latest data.",
      de: "Das Dashboard ist die Startseite, um Notizen auszuwählen, Scan-Fortschritte zu sehen und neue Karten zu erkennen. Es zeigt für jede Notiz den Scan-Status, Zeitstempel und schnelle Links zum Öffnen. Nach der Auswahl einer Notiz und einem Klick auf Scannen werden die Karten erstellt oder aktualisiert, damit alle Review-Tools auf dem aktuellen Stand arbeiten.",
    },
    whatYouSee: {
      en: "A note list with scan status, last scan timestamps, status badges, and quick actions, plus aggregate stats and filters for recently scanned items.",
      de: "Eine Notizenliste mit Scan-Status, letzter Scan-Zeit, Status-Badges und Schnellaktionen sowie aggregierten Statistiken und Filtern für kürzlich gescannte Einträge.",
    },
    coreActions: {
      en: "Pick the active note, press Scan or Rescan to generate cards, open the note preview, and watch the status indicators update after each scan.",
      de: "Wähle die aktive Notiz, drücke Scannen/Rescan zum Erstellen von Karten, öffne die Notiz-Vorschau und beobachte, wie sich die Statusanzeigen nach jedem Scan aktualisieren.",
    },
    showingCards: {
      en: "Scanned cards feed into Flashcard, Fast Flashcard, and Spaced Repetition; change Flashcard or Fast Flashcard scope, order, and mode, or limit Spaced Repetition boxes to control which cards appear.",
      de: "Die gescannten Karten fließen in Flashcard, Fast Flashcard und Spaced Repetition; passe Scope, Order und Mode der Flashcard- oder Fast-Tools an oder beschränke Spaced Repetition auf bestimmte Boxen, um die Auswahl zu steuern.",
    },
    workflow: {
      en: "Workflow: Select a note → Scan → choose Flashcard, Fast Flashcard, or Spaced Repetition.",
      de: "Workflow: Notiz wählen → Scannen → Flashcard, Fast Flashcard oder Spaced Repetition öffnen.",
    },
  },
  flashcard: {
    title: { en: "Flashcard", de: "Flashcard" },
    description: {
      en: "Flashcard Tools runs the main review session with large cards, correctness stats, and navigation controls. It walks through the scanned content one card at a time while keeping the stats diagram and counters visible. The Flashcard Tools sidebar houses filters so you can focus on the cards you need.",
      de: "Die Flashcard Tools führen die reguläre Wiederholung mit großen Karten, Korrektheitsstatistiken und Navigation durch. Sie arbeiten die gescannten Inhalte eine Karte nach der anderen ab und behalten das Statistik-Diagramm im Blick. Die Flashcard Tools-Seitenleiste enthält Filter, damit du dich auf die gewünschten Karten konzentrieren kannst.",
    },
    whatYouSee: {
      en: "A card view, stats diagram, correct/incorrect/total counters, and Flashcard Tools controls for ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, solution reveal, and submission navigation.",
      de: "Eine Kartenansicht, Statistik-Diagramm, Correct/Incorrect/Total-Zähler sowie Flashcard Tools-Schalter für ORDER, MODE, DEFAULT SCOPE, PAGE SIZE, Solution Reveal und Navigationsbuttons.",
    },
    coreActions: {
      en: "Use ORDER (In order/Random) and MODE filters (QA, multiple choice, fill-in, assignment, etc.), pick DEFAULT SCOPE (current note vs whole vault), adjust PAGE SIZE, toggle solution reveal, submit answers, and move through cards with Back/Next.",
      de: "Nutze ORDER (In order/Random) und MODE-Filter (QA, Multiple Choice, Fill-in, Assignment etc.), wähle DEFAULT SCOPE (aktuelle Notiz vs gesamter Vault), passe PAGE SIZE an, toggel die Solution Reveal, sende Antworten ab und navigiere mit Zurück/Weiter.",
    },
    showingCards: {
      en: "Displayed cards respect the current scope/order/mode/page size so scanned results refresh immediately; change the filters in the Flashcard Tools panel at any time.",
      de: "Die angezeigten Karten folgen Scope, Order, Mode und Page Size der Flashcard Tools, sodass gescannte Ergebnisse sofort aktualisiert werden; ändere die Filter jederzeit im Flashcard Tools-Panel.",
    },
    workflow: {
      en: "Workflow: Scan note → open Flashcard → tweak filters → answer cards sequentially.",
      de: "Workflow: Notiz scannen → Flashcard öffnen → Filter anpassen → Karten der Reihe nach beantworten.",
    },
  },
  "fast-flashcard": {
    title: { en: "Fast Flashcard", de: "Fast Flashcard" },
    description: {
      en: "Fast Flashcard is the timed sprint with a countdown, session momentum, and scoreboard tailored for quick repetitions. It keeps a sharply focused flashcard view, session stats, and history so you can monitor cards, accuracy, pace, and score. Fast Flashcard Tools mirror the regular filters while adding duration pills for pace-driven runs.",
      de: "Fast Flashcard ist der zeitgesteuerte Sprint mit Countdown, Session-Momentum und Scoreboard für schnelle Wiederholungen. Es zeigt einen fokussierten Kartenbereich, Session-Statistiken und Verlauf, sodass du Karten, Genauigkeit, Tempo und Punkte im Blick behältst. Die Fast Flashcard Tools spiegeln die regulären Filter und fügen Dauer-Buttons für tempoabhängige Läufe hinzu.",
    },
    whatYouSee: {
      en: "The timer block, stats diagram, session momentum cards (Cards/Accuracy/Pace/Score), vault info, flashcard list, submission outcome pill, and Fast Flashcard Tools with duration pills plus ORDER/MODE/DEFAULT SCOPE.",
      de: "Timer-Block, Statistiken, Session-Momentum-Karten (Cards/Accuracy/Pace/Score), Vault-Info, Kartenliste, Submit-Ergebnis und Fast Flashcard Tools mit Dauer-Buttons sowie ORDER/MODE/DEFAULT SCOPE.",
    },
    coreActions: {
      en: "Choose a duration, start the timer, submit answers before time expires (self-grade free text when required), and watch accuracy, pace, and the duration-weighted score update live.",
      de: "Wähle eine Dauer, starte den Timer, sende Antworten vor Ablauf ab (self-grade Free-Text bei Bedarf) und beobachte, wie Genauigkeit, Tempo und der dauergewichtete Score live aktualisiert werden.",
    },
    showingCards: {
      en: "Cards obey the Fast Flashcard Tools filters; ORDER, MODE, and DEFAULT SCOPE plus the duration pills control which cards and what pacing you encounter.",
      de: "Die Karten folgen den Fast Flashcard Tools-Filtern; ORDER, MODE und DEFAULT SCOPE sowie die Dauer-Buttons bestimmen, welche Karten und welches Tempo du bekommst.",
    },
    workflow: {
      en: "Workflow: Scan note → set duration → start Fast Flashcard → answer under the timer.",
      de: "Workflow: Notiz scannen → Dauer wählen → Fast Flashcard starten → unter dem Timer beantworten.",
    },
  },
  "spaced-repetition": {
    title: { en: "Spaced Repetition", de: "Spaced Repetition" },
    description: {
      en: "Spaced Repetition Tools organize cards into Leitner boxes and run graduated sessions to strengthen retention. It tracks promotions/demotions and shows box counts so you can focus on hard cards. Choose the right boxes, order, and repetition strength to shape each session.",
      de: "Die Spaced Repetition Tools ordnen Karten in Leitner-Boxen und führen abgestufte Sessions zur Verfestigung durch. Sie verfolgen Beförderungen/Herabstufungen und zeigen Boxenzahlen, damit du schwierige Karten fokussieren kannst. Wähle passende Boxen, Reihenfolge und Repetition Strength für jede Session.",
    },
    whatYouSee: {
      en: "A grid of boxes with counts, session controls for order/page size/repetition strength, queue previews, and stats that highlight how many cards sit in each box.",
      de: "Ein Raster aus Boxen mit Zählern, Session-Kontrollen für Order/Page Size/Repetition Strength, Queue-Preview und Statistiken, die zeigen, wie viele Karten in jeder Box liegen.",
    },
    coreActions: {
      en: "Load cards, select the boxes you want to review, pick order (In order/Random/Repetition), set page size and repetition strength, start a session, and let answers promote or demote cards automatically.",
      de: "Karten laden, gewünschte Boxen auswählen, Order (In order/Random/Repetition) einstellen, Page Size und Repetition Strength festlegen, Session starten und Antworten automatisch Karten befördern oder herunterstufen lassen.",
    },
    showingCards: {
      en: "Only cards from the chosen boxes appear during a session; order and page size drop-downs plus repetition strength sliders decide how often lower boxes resurface.",
      de: "Nur Karten aus den gewählten Boxen erscheinen während einer Session; Order- und Page-Size-Dropdowns sowie die Repetition Strength entscheiden, wie oft niedrigere Boxen wieder auftauchen.",
    },
    workflow: {
      en: "Workflow: Scan note → open Spaced Repetition → choose boxes/order → run session.",
      de: "Workflow: Notiz scannen → Spaced Repetition öffnen → Boxen/Order wählen → Session starten.",
    },
  },
};

const resolveText = (value: LocalizedText, language: AppLanguage) => {
  if (language === "de") {
    return value.de ?? value.en ?? "";
  }
  return value.en ?? value.de ?? "";
};

const resolveList = (items: LocalizedText[] | undefined, language: AppLanguage) =>
  (items ?? [])
    .map((item) => resolveText(item, language))
    .filter((item) => item.trim() !== "");

type AppSectionsGuidePanelProps = {
  language: AppLanguage;
  title: string;
  summary: string;
};

const AppSectionsGuidePanel = ({
  language,
  title,
  summary,
}: AppSectionsGuidePanelProps) => {
  const [selectedSectionId, setSelectedSectionId] =
    useState<AppSectionId>("dashboard");
  const selectedDetail = APP_SECTION_DETAILS[selectedSectionId];

  return (
    <div className="help-app-sections-card">
      <div className="help-app-sections-header">
        <div className="help-app-sections-title">{title}</div>
        <p className="muted help-app-sections-summary">{summary}</p>
      </div>
      <div className="help-app-sections-body">
        <div className="help-app-sections-list" role="tablist">
          {APP_SECTION_ORDER.map((sectionId) => (
            <button
              key={sectionId}
              type="button"
              className={`help-app-sections-list-item ${
                selectedSectionId === sectionId ? "selected" : ""
              }`}
              aria-pressed={selectedSectionId === sectionId}
              onClick={() => setSelectedSectionId(sectionId)}
            >
              {resolveText(APP_SECTION_DETAILS[sectionId].title, language)}
            </button>
          ))}
        </div>
        <div className="help-app-sections-detail">
          <p className="help-app-sections-intro">
            {resolveText(APP_SECTION_INTRO, language)}
          </p>
          <h3 className="help-app-sections-detail-title">
            {resolveText(selectedDetail.title, language)}
          </h3>
          <p className="help-app-sections-detail-description">
            {resolveText(selectedDetail.description, language)}
          </p>
          <div className="help-app-sections-detail-field">
            <span className="label">What you see</span>
            <p>{resolveText(selectedDetail.whatYouSee, language)}</p>
          </div>
          <div className="help-app-sections-detail-field">
            <span className="label">Core actions</span>
            <p>{resolveText(selectedDetail.coreActions, language)}</p>
          </div>
          <div className="help-app-sections-detail-field">
            <span className="label">Showing cards &amp; filtering</span>
            <p>{resolveText(selectedDetail.showingCards, language)}</p>
          </div>
          <p className="help-app-section-workflow">
            <span className="label">Typical workflow</span>{" "}
            {resolveText(selectedDetail.workflow, language)}
          </p>
        </div>
      </div>
    </div>
  );
};

export const HelpPage = () => {
  const { settings } = useAppState();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeSyntaxId, setActiveSyntaxId] = useState<string | null>(
    flashcardSyntaxEntries[0]?.id ?? null,
  );
  const [syntaxLanguage, setSyntaxLanguage] = useState<AppLanguage>(
    settings.language,
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;
  const isSyntaxTopic = activeTopic?.id === "flashcard-syntax";
  const activeSyntax =
    flashcardSyntaxEntries.find((entry) => entry.id === activeSyntaxId) ??
    flashcardSyntaxEntries[0] ??
    null;

  const titleText = resolveText(helpHeader.title, language);

  const copyLabel = resolveText(helpLabels.copy, language);
  const copiedLabel = resolveText(helpLabels.copied, language);
  const syntaxCopyExampleLabel = resolveText(
    helpLabels.copyExample,
    syntaxLanguage,
  );
  const syntaxCopyPromptLabel = resolveText(
    helpLabels.copyPrompt,
    syntaxLanguage,
  );
  const syntaxCopiedLabel = resolveText(helpLabels.copied, syntaxLanguage);
  const syntaxPromptLabel = resolveText(
    helpLabels.promptTemplate,
    syntaxLanguage,
  );
  const syntaxExampleLabel = resolveText(helpLabels.example, syntaxLanguage);
  const syntaxRulesLabel = resolveText(helpLabels.rules, syntaxLanguage);
  const syntaxWhatItIsLabel = resolveText(helpLabels.whatItIs, syntaxLanguage);
  const syntaxMistakesLabel = resolveText(helpLabels.mistakes, syntaxLanguage);
  const syntaxMarkersLabel = resolveText(helpLabels.markers, syntaxLanguage);
  const overviewBullets = resolveList(
    flashcardSyntaxOverview.bullets,
    syntaxLanguage,
  );

  const handleCopy = async (text: string, copyId: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedItemId(copyId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy example", error);
    }
  };

  useEffect(() => {
    if (activeTopicId !== "flashcard-syntax") {
      return;
    }
    setActiveSyntaxId((prev) => {
      if (prev && flashcardSyntaxEntries.some((entry) => entry.id === prev)) {
        return prev;
      }
      return flashcardSyntaxEntries[0]?.id ?? null;
    });
    setSyntaxLanguage(settings.language);
  }, [activeTopicId, settings.language]);

  useEffect(() => {
    if (!activeTopicId) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      setActiveTopicId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTopicId]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">{resolveText(helpHeader.eyebrow, language)}</p>
          <h1>{titleText}</h1>
          <p className="muted">{resolveText(helpHeader.summary, language)}</p>
        </div>
      </header>
      <section className="panel help-panel">
        <div className="panel-body help-body">
          {activeTopic ? (
            <>
              <div className="help-detail-header">
                <div className="help-breadcrumb">
                  <span>{titleText}</span>
                  <span className="help-crumb-sep">&gt;</span>
                  <span className="help-breadcrumb-current">
                    {resolveText(activeTopic.title, language)}
                  </span>
                  {isSyntaxTopic && activeSyntax ? (
                    <>
                      <span className="help-crumb-sep">&gt;</span>
                      <span className="help-breadcrumb-current help-breadcrumb-leaf">
                        {resolveText(activeSyntax.title, syntaxLanguage)}
                      </span>
                    </>
                  ) : null}
                  {activeTopic.draft ? (
                    <span className="chip">
                      {resolveText(helpLabels.draft, language)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setActiveTopicId(null)}
                >
                  {resolveText(helpLabels.back, language)}
                </button>
              </div>
              <p className="muted">
                {resolveText(activeTopic.summary, language)}
              </p>
              {isSyntaxTopic ? (
                <div className="help-detail-sections">
                  <div className="help-detail-section help-block">
                    <div className="help-item-header">
                      <span className="help-block-title">
                        {resolveText(flashcardSyntaxOverview.title, syntaxLanguage)}
                      </span>
                    </div>
                    {overviewBullets.length > 0 ? (
                      <ul className="help-list">
                        {overviewBullets.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="help-syntax-layout">
                    <div className="help-syntax-cards" role="tablist">
                      {flashcardSyntaxEntries.map((entry) => {
                        const isActive = entry.id === activeSyntax?.id;
                        const entryTitle = resolveText(
                          entry.title,
                          syntaxLanguage,
                        );
                        const entrySnippet = entry.snippet
                          ? resolveText(entry.snippet, syntaxLanguage)
                          : "";
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={`help-syntax-card${
                              isActive ? " active" : ""
                            }`}
                            onClick={() => setActiveSyntaxId(entry.id)}
                            role="tab"
                            aria-selected={isActive}
                          >
                            <div className="help-syntax-card-title">
                              {entryTitle}
                            </div>
                            <div className="help-syntax-card-meta">
                              <span className="help-syntax-card-label">
                                {syntaxMarkersLabel}
                              </span>
                              <div className="help-syntax-token-list">
                                {entry.markers.map((marker) => (
                                  <span key={marker} className="help-syntax-token">
                                    {marker}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="help-syntax-card-rule">
                              {resolveText(entry.keyRule, syntaxLanguage)}
                            </div>
                            {entrySnippet ? (
                              <pre className="help-syntax-snippet">
                                {entrySnippet}
                              </pre>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {activeSyntax ? (
                      <div className="help-syntax-detail">
                        <div className="help-syntax-detail-header">
                          <div className="help-syntax-detail-title">
                            {resolveText(activeSyntax.title, syntaxLanguage)}
                          </div>
                          <div className="help-syntax-lang-tabs">
                            <button
                              type="button"
                              className={`help-syntax-lang${
                                syntaxLanguage === "en" ? " active" : ""
                              }`}
                              onClick={() => setSyntaxLanguage("en")}
                            >
                              EN
                            </button>
                            <button
                              type="button"
                              className={`help-syntax-lang${
                                syntaxLanguage === "de" ? " active" : ""
                              }`}
                              onClick={() => setSyntaxLanguage("de")}
                            >
                              DE
                            </button>
                          </div>
                        </div>
                        <div className="help-syntax-section">
                          <div className="help-syntax-section-header">
                            <span className="label">{syntaxWhatItIsLabel}</span>
                          </div>
                          <p className="help-syntax-text">
                            {activeSyntax.detail[syntaxLanguage].whatItIs}
                          </p>
                        </div>
                        <div className="help-syntax-section">
                          <div className="help-syntax-section-header">
                            <span className="label">{syntaxRulesLabel}</span>
                          </div>
                          {activeSyntax.detail[syntaxLanguage].rulesNote ? (
                            <p className="help-syntax-text">
                              {activeSyntax.detail[syntaxLanguage].rulesNote}
                            </p>
                          ) : null}
                          <ul className="help-syntax-list">
                            {activeSyntax.detail[syntaxLanguage].rules.map(
                              (rule) => (
                                <li key={rule}>{rule}</li>
                              ),
                            )}
                          </ul>
                        </div>
                        <div className="help-syntax-section">
                          <div className="help-syntax-section-header">
                            <span className="label">{syntaxPromptLabel}</span>
                            <button
                              type="button"
                              className="ghost small help-copy"
                              onClick={() =>
                                handleCopy(
                                  activeSyntax.detail[syntaxLanguage]
                                    .promptTemplate,
                                  `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`,
                                )
                              }
                              aria-label={`${syntaxCopyPromptLabel}: ${resolveText(
                                activeSyntax.title,
                                syntaxLanguage,
                              )}`}
                            >
                              {copiedItemId ===
                              `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`
                                ? syntaxCopiedLabel
                                : syntaxCopyPromptLabel}
                            </button>
                          </div>
                          <pre className="help-code">
                            {activeSyntax.detail[syntaxLanguage].promptTemplate}
                          </pre>
                        </div>
                        <div className="help-syntax-section">
                          <div className="help-syntax-section-header">
                            <span className="label">{syntaxExampleLabel}</span>
                            <button
                              type="button"
                              className="ghost small help-copy"
                              onClick={() =>
                                handleCopy(
                                  activeSyntax.detail[syntaxLanguage].example,
                                  `syntax-example-${activeSyntax.id}-${syntaxLanguage}`,
                                )
                              }
                              aria-label={`${syntaxCopyExampleLabel}: ${resolveText(
                                activeSyntax.title,
                                syntaxLanguage,
                              )}`}
                            >
                              {copiedItemId ===
                              `syntax-example-${activeSyntax.id}-${syntaxLanguage}`
                                ? syntaxCopiedLabel
                                : syntaxCopyExampleLabel}
                            </button>
                          </div>
                          <pre className="help-code">
                            {activeSyntax.detail[syntaxLanguage].example}
                          </pre>
                        </div>
                        {activeSyntax.detail[syntaxLanguage].mistakes?.length ? (
                          <div className="help-syntax-section">
                            <div className="help-syntax-section-header">
                              <span className="label">
                                {syntaxMistakesLabel}
                              </span>
                            </div>
                            <ul className="help-syntax-list">
                              {activeSyntax.detail[syntaxLanguage].mistakes?.map(
                                (mistake) => (
                                  <li key={mistake}>{mistake}</li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="help-detail-sections">
                  {activeTopic.sections.map((section) => {
                    const bullets = resolveList(section.bullets, language);
                    const examples = section.examples ?? [];
                    const sectionLabelClass =
                      section.tone === "help-block"
                        ? "help-block-title"
                        : "label";
                    const sectionClassName =
                      section.tone === "help-block"
                        ? "help-detail-section help-block"
                        : "help-detail-section";
                    return (
                      <div key={section.id} className={sectionClassName}>
                        <div className="help-item-header">
                          <span className={sectionLabelClass}>
                            {resolveText(section.title, language)}
                          </span>
                        </div>
                        {bullets.length > 0 ? (
                          <ul className="help-list">
                            {bullets.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                        {examples.length > 0 ? (
                          <div className="help-examples">
                            {examples.map((example) => {
                              const exampleTitle = resolveText(
                                example.title,
                                language,
                              );
                              const exampleDescription = resolveText(
                                example.description,
                                language,
                              );
                              const copyId = `example-${example.id}`;
                              const isCopied = copiedItemId === copyId;
                              return (
                                <div key={example.id} className="help-example">
                                  <div className="help-example-header">
                                    <div className="help-example-text">
                                      <div className="help-example-title">
                                        {exampleTitle}
                                      </div>
                                      {exampleDescription ? (
                                        <p className="help-example-description">
                                          {exampleDescription}
                                        </p>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      className="ghost small help-copy"
                                      onClick={() =>
                                        handleCopy(example.code, copyId)
                                      }
                                      aria-label={`${copyLabel}: ${exampleTitle}`}
                                    >
                                      {isCopied ? copiedLabel : copyLabel}
                                    </button>
                                  </div>
                                  <pre className="help-code">{example.code}</pre>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="help-overview-grid">
              {helpTopics.map((topic) => {
                if (topic.id === "spaced-repetition") {
                  return (
                    <AppSectionsGuidePanel
                      key={topic.id}
                      language={language}
                      title={resolveText(topic.title, language)}
                      summary={resolveText(topic.summary, language)}
                    />
                  );
                }
                return (
                  <button
                    key={topic.id}
                    type="button"
                    className="help-topic-card"
                    aria-label={`${resolveText(
                      helpLabels.openTopic,
                      language,
                    )}: ${resolveText(topic.title, language)}`}
                    onClick={() => setActiveTopicId(topic.id)}
                  >
                    {topic.icon ? (
                      <span className="help-topic-icon">{topic.icon}</span>
                    ) : null}
                    <div className="help-topic-content">
                      <div className="help-topic-title">
                        {resolveText(topic.title, language)}
                      </div>
                      <div className="help-topic-summary">
                        {resolveText(topic.summary, language)}
                      </div>
                    </div>
                    {topic.draft ? (
                      <span className="chip">
                        {resolveText(helpLabels.draft, language)}
                      </span>
                    ) : null}
                    <span className="help-topic-arrow">&gt;</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
};

---

## 📝 SettingsPage.tsx — ./pages/SettingsPage.tsx

import { useCallback, useMemo, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings";
import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection";
import { LanguageTabContent, DataSyncTabContent } from "../components/settings/DataSyncTabContent";
import { PerformanceTabContent } from "../components/settings/PerformanceTabContent";
import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection";
import { VaultIndexSection } from "../components/settings/VaultIndexSection";
import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";

const SETTINGS_TABS = [
  { id: "data-sync", label: "Data & Sync" },
  { id: "performance", label: "Performance" },
  { id: "language", label: "Language" },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const SettingsPage = () => {
  const { actions, flashcards, preview, settings, spacedRepetition, vault } =
    useAppState();
  const { language, setLanguage } = settings;
  const lastOpenedFile = preview.selectedFile?.relative_path ?? null;
  const vaultIndexedComplete = useMemo(
    () => Boolean(vault.vaultPath) && vault.listState === "idle",
    [vault.listState, vault.vaultPath],
  );
  const handleLanguageChange = useCallback(
    (nextLanguage: "de" | "en") => {
      setLanguage(nextLanguage);
    },
    [setLanguage],
  );
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTabId>("data-sync");

  return (
    <>
      <header className="content-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Einstellungen</h1>
          <p className="muted">
            Passe deinen Workflow an. Die naechsten Features bauen auf dieser
            Vault-Basis auf.
          </p>
        </div>
        <div className="actions">
          <button type="button" className="primary" onClick={actions.handlePickVault}>
            Vault auswaehlen
          </button>
        </div>
      </header>
      <div className="settings-grid">
        <VaultIndexSection
          lastOpenedFile={lastOpenedFile}
          listState={vault.listState}
          onCopyVaultPath={actions.handleCopyVaultPath}
          onRescanVault={actions.handleRescanVault}
          vaultIndexedComplete={vaultIndexedComplete}
          vaultPath={vault.vaultPath}
        />
        <section className="panel settings-tabs-panel">
          <div className="panel-header">
            <div>
              <h2>App Settings</h2>
              <p className="muted">
                Manage storage, performance, and language preferences here.
              </p>
            </div>
            <div className="pill-grid">
              {SETTINGS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`pill pill-button ${
                    activeSettingsTab === tab.id ? "active" : ""
                  }`}
                  aria-pressed={activeSettingsTab === tab.id}
                  onClick={() => setActiveSettingsTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-body">
            <div className="settings-tab-content">
              {activeSettingsTab === "data-sync" ? (
                <DataSyncTabContent />
              ) : activeSettingsTab === "performance" ? (
                <PerformanceTabContent
                  maxFilesPerScan={settings.maxFilesPerScan}
                  onMaxFilesPerScanChange={actions.handleMaxFilesPerScanChange}
                  scanParallelism={settings.scanParallelism}
                  setScanParallelism={settings.setScanParallelism}
                />
              ) : (
                <LanguageTabContent
                  language={language}
                  onLanguageChange={handleLanguageChange}
                />
              )}
            </div>
          </div>
        </section>
        <FlashcardsSettingsSection
          flashcardOrder={flashcards.flashcardOrder}
          flashcardPageSize={flashcards.flashcardPageSize}
          flashcardPageSizes={FLASHCARD_PAGE_SIZES}
          flashcardScope={flashcards.flashcardScope}
          setFlashcardOrder={flashcards.setFlashcardOrder}
          setFlashcardPageSize={flashcards.setFlashcardPageSize}
          setFlashcardScope={flashcards.setFlashcardScope}
          setSolutionRevealEnabled={flashcards.setSolutionRevealEnabled}
          setStatsResetMode={flashcards.setStatsResetMode}
          solutionRevealEnabled={flashcards.solutionRevealEnabled}
          statsResetMode={flashcards.statsResetMode}
        />
        <section className="panel fast-flashcard-tools-panel">
          <div className="panel-header">
            <div>
              <h2>Fast Flashcard Tools</h2>
              <p className="muted">Control fast flashcard ordering rules.</p>
            </div>
          </div>
          <div className="panel-body">
            <FastFlashcardToolsSettings
              fastFlashcardOrder={settings.fastFlashcardOrder}
              fastFlashcardMode={settings.fastFlashcardMode}
              fastFlashcardScope={settings.fastFlashcardScope}
              setFastFlashcardOrder={settings.setFastFlashcardOrder}
              setFastFlashcardMode={settings.setFastFlashcardMode}
              setFastFlashcardScope={settings.setFastFlashcardScope}
              showSectionDividers
            />
          </div>
        </section>
        <SpacedRepetitionSettingsSection
          spacedRepetitionBoxes={spacedRepetition.spacedRepetitionBoxes}
          spacedRepetitionBoxOptions={SPACED_REPETITION_BOXES}
          spacedRepetitionOrder={spacedRepetition.spacedRepetitionOrder}
          spacedRepetitionPageSize={spacedRepetition.spacedRepetitionPageSize}
          spacedRepetitionPageSizes={SPACED_REPETITION_PAGE_SIZES}
          spacedRepetitionRepetitionStrength={
            spacedRepetition.spacedRepetitionRepetitionStrength
          }
          setSpacedRepetitionBoxes={spacedRepetition.setSpacedRepetitionBoxes}
          setSpacedRepetitionOrder={spacedRepetition.setSpacedRepetitionOrder}
          setSpacedRepetitionPageSize={spacedRepetition.setSpacedRepetitionPageSize}
          setSpacedRepetitionRepetitionStrength={
            spacedRepetition.setSpacedRepetitionRepetitionStrength
          }
        />
        <section className="panel fast-flashcard-tools-panel">
          <div className="panel-header">
            <div>
              <h2>Fast Flashcard Tools</h2>
              <p className="muted">Control fast flashcard ordering rules.</p>
            </div>
          </div>
          <div className="panel-body">
            <FastFlashcardToolsSettings
              fastFlashcardOrder={settings.fastFlashcardOrder}
              fastFlashcardMode={settings.fastFlashcardMode}
              fastFlashcardScope={settings.fastFlashcardScope}
              setFastFlashcardOrder={settings.setFastFlashcardOrder}
              setFastFlashcardMode={settings.setFastFlashcardMode}
              setFastFlashcardScope={settings.setFastFlashcardScope}
            />
          </div>
        </section>
        <AppearanceSection
          accentColor={settings.accentColor}
          accentDraft={settings.accentDraft}
          accentError={settings.accentError}
          onAccentInputChange={actions.handleAccentInputChange}
          onAccentPick={actions.handleAccentPick}
          onCopyAccent={actions.handleCopyAccent}
          onThemeToggle={actions.handleThemeChange}
          theme={settings.theme}
        />
      </div>
    </>
  );
};

---

## 📝 SpacedRepetitionPage.tsx — ./pages/SpacedRepetitionPage.tsx

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { buildLineChartPoints } from "../lib/chart";
import { ClozeCard } from "../components/flashcards/ClozeCard";
import { CompositeCard } from "../components/flashcards/CompositeCard";
import { FreeTextCard } from "../components/flashcards/FreeTextCard";
import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard";
import { TrueFalseCard } from "../components/flashcards/TrueFalseCard";
import { KpiGrid } from "../components/KpiGrid";
import { useAppState } from "../components/AppStateProvider";
import { vaultBaseName } from "../lib/path";
import {
  areClozeBlanksComplete,
  areTrueFalseItemsComplete,
  isFlashcardPartComplete,
} from "../features/flashcards/logic";
import {
  SPACED_REPETITION_BOXES,
  SPACED_REPETITION_PAGE_SIZES,
} from "../features/spaced-repetition/useSpacedRepetition";
import {
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  normalizeSpacedRepetitionCardProgress,
} from "../features/spaced-repetition/logic";

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
};

export const SpacedRepetitionPage = () => {
  const { flashcards, spacedRepetition, vault } = useAppState();
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [activeBoxFilter, setActiveBoxFilter] = useState<number | null>(null);
  const statsView = spacedRepetition.spacedRepetitionStatsView;
  const focusLabel = isFocusMode ? "Exit focus mode" : "Enter focus mode";
  const vaultName = useMemo(
    () => (vault.vaultPath ? vaultBaseName(vault.vaultPath) : "—"),
    [vault.vaultPath],
  );
  const showBoxEmptyMessage =
    statsView === "boxes" &&
    activeBoxFilter !== null &&
    Boolean(spacedRepetition.spacedRepetitionActiveUser);
  const selectedUser = useMemo(
    () =>
      spacedRepetition.spacedRepetitionUsers.find(
        (user) => user.id === spacedRepetition.spacedRepetitionSelectedUserId,
      ),
    [
      spacedRepetition.spacedRepetitionSelectedUserId,
      spacedRepetition.spacedRepetitionUsers,
    ],
  );
  const deleteTargetName = selectedUser?.name ?? "";
  const deleteInputValue = deleteConfirmInput.trim();
  const canConfirmDelete =
    Boolean(deleteTargetName) && deleteInputValue === deleteTargetName;

  const statsTotal =
    spacedRepetition.spacedRepetitionCorrectCount +
    spacedRepetition.spacedRepetitionIncorrectCount;
  const statsChartClass = statsTotal === 0 ? "stats-chart empty" : "stats-chart";
  const statsChartStyle = useMemo(
    () =>
      ({
        "--correct-percent": `${spacedRepetition.spacedRepetitionCorrectPercent}%`,
      }) as CSSProperties,
    [spacedRepetition.spacedRepetitionCorrectPercent],
  );
  const maxBoxCount = Math.max(...spacedRepetition.spacedRepetitionBoxCounts, 0);
  const visibleFlashcardEntries = useMemo(
    () =>
      spacedRepetition.spacedRepetitionVisibleFlashcards.map((card, localIndex) => ({
        card,
        cardIndex: spacedRepetition.spacedRepetitionPageStart + localIndex,
      })),
    [
      spacedRepetition.spacedRepetitionPageStart,
      spacedRepetition.spacedRepetitionVisibleFlashcards,
    ],
  );
  const filteredFlashcardEntries = useMemo(() => {
    if (
      activeBoxFilter === null ||
      statsView !== "boxes" ||
      !spacedRepetition.spacedRepetitionCardStates
    ) {
      return visibleFlashcardEntries;
    }
    return visibleFlashcardEntries.filter(({ card }) => {
      const cardId = getFlashcardId(card);
      const progress =
        spacedRepetition.spacedRepetitionCardStates[cardId] ?? null;
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetition.spacedRepetitionBoxes,
      );
      return effectiveBox === activeBoxFilter;
    });
  }, [
    activeBoxFilter,
    statsView,
    spacedRepetition.spacedRepetitionBoxes,
    spacedRepetition.spacedRepetitionCardStates,
    visibleFlashcardEntries,
  ]);
  const toggleBoxFilter = useCallback(
    (boxNumber: number) => {
      const nextFilter = activeBoxFilter === boxNumber ? null : boxNumber;
      setActiveBoxFilter(nextFilter);
      spacedRepetition.handleSpacedRepetitionActiveUserLoadCards({
        boxFilter: nextFilter,
      });
    },
    [activeBoxFilter, spacedRepetition],
  );

  const kpiItems = [
    { label: "Correct", value: spacedRepetition.spacedRepetitionCorrectCount },
    { label: "Incorrect", value: spacedRepetition.spacedRepetitionIncorrectCount },
    { label: "Total", value: spacedRepetition.spacedRepetitionTotalQuestions },
    {
      label: "Due now",
      value: spacedRepetition.spacedRepetitionProgressStats.dueNow,
    },
    {
      label: "Due today",
      value: spacedRepetition.spacedRepetitionProgressStats.dueToday,
    },
    {
      label: "In queue",
      value: spacedRepetition.spacedRepetitionProgressStats.inQueue,
    },
    {
      label: "Completed today",
      value: spacedRepetition.spacedRepetitionProgressStats.completedToday,
    },
  ];

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return;
    }
    if (!selectedUser) {
      setIsDeleteDialogOpen(false);
      setDeleteConfirmInput("");
    }
  }, [isDeleteDialogOpen, selectedUser]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", isFocusMode);
    return () => {
      document.body.classList.remove("focus-mode");
    };
  }, [isFocusMode]);

  useEffect(() => {
    if (!isFocusMode) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setIsFocusMode(false);
        return;
      }
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (spacedRepetition.spacedRepetitionCanGoBack) {
          spacedRepetition.handleSpacedRepetitionPageBack();
        }
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (spacedRepetition.spacedRepetitionCanGoNext) {
          spacedRepetition.handleSpacedRepetitionPageNext();
        }
        return;
      }

      if (event.key !== "Enter" && event.key !== "NumpadEnter") {
        return;
      }

      const visibleCards = spacedRepetition.spacedRepetitionVisibleFlashcards;
      if (visibleCards.length === 0) {
        return;
      }

      const findFirstSubmittableIndex = () => {
        for (let localIndex = 0; localIndex < visibleCards.length; localIndex += 1) {
          const cardIndex =
            spacedRepetition.spacedRepetitionPageStart + localIndex;
          const card = visibleCards[localIndex];
          if (spacedRepetition.spacedRepetitionSubmissions[cardIndex]) {
            continue;
          }
          if (card.kind === "composite") {
            const partStates =
              spacedRepetition.spacedRepetitionCompositeStates?.[cardIndex] ?? [];
            const canSubmit =
              card.parts.length > 0 &&
              card.parts.every((part, partIndex) =>
                isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
              );
            if (canSubmit) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "multiple-choice") {
            if (
              (spacedRepetition.spacedRepetitionSelections[cardIndex] ?? []).length > 0
            ) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "true-false") {
            const selections =
              spacedRepetition.spacedRepetitionTrueFalseSelections[cardIndex] ?? {};
            if (areTrueFalseItemsComplete(card, selections)) {
              return cardIndex;
            }
            continue;
          }
          if (card.kind === "free-text") {
            continue;
          }
          const responses =
            spacedRepetition.spacedRepetitionClozeResponses[cardIndex] ?? {};
          if (areClozeBlanksComplete(card, responses)) {
            return cardIndex;
          }
        }
        return null;
      };

      const resolvedIndex =
        activeCardIndex !== null &&
        activeCardIndex >= spacedRepetition.spacedRepetitionPageStart &&
        activeCardIndex <
          spacedRepetition.spacedRepetitionPageStart +
            spacedRepetition.spacedRepetitionVisibleFlashcards.length
          ? activeCardIndex
          : findFirstSubmittableIndex();

      if (resolvedIndex === null) {
        return;
      }

      const localIndex = resolvedIndex - spacedRepetition.spacedRepetitionPageStart;
      const card = visibleCards[localIndex];
      if (!card || spacedRepetition.spacedRepetitionSubmissions[resolvedIndex]) {
        return;
      }
      if (card.kind === "composite") {
        const partStates =
          spacedRepetition.spacedRepetitionCompositeStates?.[resolvedIndex] ?? [];
        const canSubmit =
          card.parts.length > 0 &&
          card.parts.every((part, partIndex) =>
            isFlashcardPartComplete(part, partStates[partIndex] ?? {}),
          );
        if (!canSubmit) {
          return;
        }
      } else if (card.kind === "multiple-choice") {
        if (
          (spacedRepetition.spacedRepetitionSelections[resolvedIndex] ?? []).length ===
          0
        ) {
          return;
        }
      } else if (card.kind === "true-false") {
        const selections =
          spacedRepetition.spacedRepetitionTrueFalseSelections[resolvedIndex] ?? {};
        if (!areTrueFalseItemsComplete(card, selections)) {
          return;
        }
      } else if (card.kind === "free-text") {
        return;
      } else {
        const responses =
          spacedRepetition.spacedRepetitionClozeResponses[resolvedIndex] ?? {};
        if (!areClozeBlanksComplete(card, responses)) {
          return;
        }
      }

      event.preventDefault();
      spacedRepetition.handleSpacedRepetitionSubmit(resolvedIndex, true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeCardIndex,
    isFocusMode,
    spacedRepetition,
  ]);

  const handleOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionOptionSelect(cardIndex, keys);
    },
    [spacedRepetition],
  );

  const handleTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTrueFalseSelect(
        cardIndex,
        itemId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeInputChange(
        cardIndex,
        blankId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeTokenDrop(
        event,
        cardIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [spacedRepetition],
  );

  const handleClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionClozeTokenRemove(cardIndex, blankId);
    },
    [spacedRepetition],
  );

  const handleTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTextInputChange(cardIndex, value);
    },
    [spacedRepetition],
  );

  const handleTextCheck = useCallback(
    (cardIndex: number) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionTextCheck(cardIndex);
    },
    [spacedRepetition],
  );

  const handleSelfGrade = useCallback(
    (cardIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionSelfGrade(cardIndex, grade);
    },
    [spacedRepetition],
  );

  const handleCompositeOptionSelect = useCallback(
    (cardIndex: number, partIndex: number, keys: string[]) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeOptionSelect(
        cardIndex,
        partIndex,
        keys,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTrueFalseSelect = useCallback(
    (cardIndex: number, partIndex: number, itemId: string, value: "wahr" | "falsch") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTrueFalseSelect(
        cardIndex,
        partIndex,
        itemId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeInputChange = useCallback(
    (cardIndex: number, partIndex: number, blankId: string, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeInputChange(
        cardIndex,
        partIndex,
        blankId,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      partIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeTokenDrop(
        event,
        cardIndex,
        partIndex,
        blankId,
        validTokenIds,
        dragBlankIds,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeClozeTokenRemove = useCallback(
    (cardIndex: number, partIndex: number, blankId: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeClozeTokenRemove(
        cardIndex,
        partIndex,
        blankId,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTextInputChange = useCallback(
    (cardIndex: number, partIndex: number, value: string) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTextInputChange(
        cardIndex,
        partIndex,
        value,
      );
    },
    [spacedRepetition],
  );

  const handleCompositeTextCheck = useCallback(
    (cardIndex: number, partIndex: number) => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeTextCheck(cardIndex, partIndex);
    },
    [spacedRepetition],
  );

  const handleCompositeSelfGrade = useCallback(
    (cardIndex: number, partIndex: number, grade: "correct" | "incorrect") => {
      setActiveCardIndex(cardIndex);
      spacedRepetition.handleSpacedRepetitionCompositeSelfGrade(
        cardIndex,
        partIndex,
        grade,
      );
    },
    [spacedRepetition],
  );

  const handleDeleteOpen = useCallback(() => {
    if (!selectedUser) {
      return;
    }
    setDeleteConfirmInput("");
    setIsDeleteDialogOpen(true);
  }, [selectedUser]);

  const handleDeleteCancel = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!canConfirmDelete) {
      return;
    }
    spacedRepetition.handleSpacedRepetitionDeleteUser();
    setIsDeleteDialogOpen(false);
    setDeleteConfirmInput("");
  }, [canConfirmDelete, spacedRepetition]);

  return (
    <div className={`spaced-repetition-layout ${isFocusMode ? "focus-mode" : ""}`}>
      {isFocusMode ? null : (
        <section className="panel sr-diagram-panel">
        <div className="panel-header">
          <div>
            <h2>Statistics Diagram</h2>
            <p className="muted">Progress trends over time.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="sr-stats-top">
            <div className="sr-stats-left">
              <div className="sr-stats-switch">
                <span className="label">View</span>
                <div className="pill-grid">
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "boxes" ? "active" : ""}`}
                    aria-pressed={statsView === "boxes"}
                    onClick={() => spacedRepetition.setSpacedRepetitionStatsView("boxes")}
                  >
                    Boxes
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${statsView === "vault" ? "active" : ""}`}
                    aria-pressed={statsView === "vault"}
                    onClick={() => spacedRepetition.setSpacedRepetitionStatsView("vault")}
                  >
                    Active vault
                  </button>
                  <button
                    type="button"
                    className={`pill pill-button ${
                      statsView === "completed" ? "active" : ""
                    }`}
                    aria-pressed={statsView === "completed"}
                    onClick={() =>
                      spacedRepetition.setSpacedRepetitionStatsView("completed")
                    }
                  >
                    Completed per day
                  </button>
                </div>
              </div>
              {statsView === "boxes" ? (
                <div className="sr-box-chart">
                  <div className="sr-box-chart-header">
                    <span className="label">BOXES</span>
                  </div>
                  <div className="sr-box-chart-grid">
                    {spacedRepetition.spacedRepetitionBoxCounts.map((count, index) => {
                      const heightPercent =
                        maxBoxCount > 0
                          ? Math.round((count / maxBoxCount) * 100)
                          : 0;
                      const barStyle = {
                        "--bar-height":
                          count > 0 ? `${Math.max(heightPercent, 6)}%` : "0%",
                      } as CSSProperties;
                      const boxNumber = index + 1;
                      const isFilterActive = activeBoxFilter === boxNumber;

                      return (
                        <button
                          key={`box-${boxNumber}`}
                          type="button"
                          className={`sr-box-column ${isFilterActive ? "active" : ""}`}
                          aria-pressed={isFilterActive}
                          onClick={() => toggleBoxFilter(boxNumber)}
                        >
                          <span className="sr-box-count">{count}</span>
                          <div className="sr-box-bar" style={barStyle}>
                            <div className="sr-box-bar-fill" />
                          </div>
                          <span className="sr-box-label">{boxNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : statsView === "vault" ? (
                <div className="sr-vault-card">
                  <div className="sr-vault-row">
                    <span className="label">Vault</span>
                    <span className="value">{vaultName}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Notes</span>
                    <span className="value">{vault.files.length}</span>
                  </div>
                  <div className="sr-vault-row">
                    <span className="label">Cards loaded</span>
                    <span className="value">
                      {spacedRepetition.spacedRepetitionFlashcards.length}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="chart-card">
                  <div className="chart-header">
                    <span className="label">Completed per day</span>
                    <span className="chart-meta">Last 7 days</span>
                  </div>
                  <div className="chart-canvas">
                    <svg
                      className="sr-chart"
                      viewBox="0 0 100 40"
                      role="img"
                      aria-label="Completed per day"
                    >
                      <line
                        x1="0"
                        y1="40"
                        x2="100"
                        y2="40"
                        className="sr-chart-axis"
                      />
                      <polyline
                        className="sr-chart-line"
                        points={buildLineChartPoints(
                          spacedRepetition.spacedRepetitionCompletedChartData,
                        )}
                      />
                    </svg>
                  </div>
                  <div className="chart-axis">
                    {spacedRepetition.spacedRepetitionCompletedChartLabels.map(
                      (label) => (
                      <span key={label}>{label}</span>
                    ),
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="sr-stats-right">
              <span className="label">Statistics</span>
              <div className="stats-summary">
                <div className="stats-counters">
                  <div className="stats-counter">
                    <span className="stats-label">Correct</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionCorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Incorrect</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionIncorrectCount}
                    </span>
                  </div>
                  <div className="stats-counter">
                    <span className="stats-label">Total</span>
                    <span className="stats-value">
                      {spacedRepetition.spacedRepetitionTotalQuestions}
                    </span>
                  </div>
                </div>
                <div
                  className={statsChartClass}
                  style={statsChartStyle}
                  role="img"
                  aria-label={`Correct ${spacedRepetition.spacedRepetitionCorrectCount}, Incorrect ${spacedRepetition.spacedRepetitionIncorrectCount}, Total ${spacedRepetition.spacedRepetitionTotalQuestions}`}
                >
                  <div className="stats-chart-label">
                    <span className="stats-chart-total">
                      {spacedRepetition.spacedRepetitionTotalQuestions}
                    </span>
                    <span className="stats-chart-caption">Total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {isFocusMode ? null : (
        <section className="panel sr-user-panel">
        <div className="panel-header">
          <div>
            <h2>User Tools</h2>
          </div>
        </div>
        <div className="panel-body">
          <div className="setting-row">
            <span className="label">Active user</span>
            <button
              type="button"
              className="value active-user-button"
              onClick={spacedRepetition.handleSpacedRepetitionActiveUserLoadCards}
              disabled={
                !spacedRepetition.spacedRepetitionActiveUser ||
                flashcards.isFlashcardScanning
              }
              aria-label="Load flashcards for active user"
            >
              {spacedRepetition.spacedRepetitionActiveUser ?? "—"}
            </button>
          </div>
          <div className="setting-row">
            <span className="label">User list</span>
            <select
              className="text-input"
              value={spacedRepetition.spacedRepetitionSelectedUserId}
              onChange={(event) =>
                spacedRepetition.setSpacedRepetitionSelectedUserId(event.target.value)
              }
              aria-label="Select user"
            >
              <option value="">Select user</option>
              {spacedRepetition.spacedRepetitionUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <span className="label">New user</span>
            <div className="setting-inline">
              <input
                type="text"
                className="text-input"
                value={spacedRepetition.spacedRepetitionNewUserName}
                onChange={(event) => {
                  spacedRepetition.setSpacedRepetitionNewUserName(event.target.value);
                  if (spacedRepetition.spacedRepetitionUserError) {
                    spacedRepetition.setSpacedRepetitionUserError("");
                  }
                }}
                placeholder="User name"
                aria-label="New user name"
              />
              <button
                type="button"
                className="ghost small"
                onClick={spacedRepetition.handleSpacedRepetitionCreateUser}
              >
                Create
              </button>
            </div>
            {spacedRepetition.spacedRepetitionUserError ? (
              <span className="helper-text error-text">
                {spacedRepetition.spacedRepetitionUserError}
              </span>
            ) : null}
          </div>
          <div className="setting-row">
            <span className="label">Actions</span>
            <div className="setting-actions">
              <button
                type="button"
                className="ghost small"
                onClick={spacedRepetition.handleSpacedRepetitionLoadUser}
                disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
              >
                Load
              </button>
              <button
                type="button"
                className="ghost small"
                onClick={handleDeleteOpen}
                disabled={!spacedRepetition.spacedRepetitionSelectedUserId}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      <section className="panel sr-flashcards-panel">
        <div className="panel-header">
          <div>
            <h2>Flashcard</h2>
            <p className="muted">{spacedRepetition.spacedRepetitionStatusLabel}</p>
          </div>
          <div className="panel-actions">
            <button
              type="button"
              className={`focus-toggle ${isFocusMode ? "active" : ""}`}
              onClick={() => setIsFocusMode((prev) => !prev)}
              aria-pressed={isFocusMode}
              aria-label={focusLabel}
              title={focusLabel}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="3.5" />
              </svg>
            </button>
          </div>
        </div>
        <div className="panel-body">
          {filteredFlashcardEntries.length === 0 ? (
            <div className="empty-state">
              {showBoxEmptyMessage
                ? `No cards currently in box ${activeBoxFilter}.`
                : spacedRepetition.spacedRepetitionEmptyState}
            </div>
          ) : (
            <div className="flashcard-list">
              {filteredFlashcardEntries.map(({ card, cardIndex }) => {
                const submitted = !!spacedRepetition.spacedRepetitionSubmissions[
                  cardIndex
                ];

                if (card.kind === "composite") {
                  return (
                    <CompositeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      partStates={
                        spacedRepetition.spacedRepetitionCompositeStates?.[cardIndex] ??
                        []
                      }
                      onOptionSelect={handleCompositeOptionSelect}
                      onTrueFalseSelect={handleCompositeTrueFalseSelect}
                      onClozeInputChange={handleCompositeClozeInputChange}
                      onClozeTokenDrop={handleCompositeClozeTokenDrop}
                      onClozeTokenRemove={handleCompositeClozeTokenRemove}
                      onClozeTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onTextInputChange={handleCompositeTextInputChange}
                      onTextCheck={handleCompositeTextCheck}
                      onSelfGrade={handleCompositeSelfGrade}
                      onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                    />
                  );
                }

                if (card.kind === "cloze") {
                  return (
                    <ClozeCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      responses={spacedRepetition.spacedRepetitionClozeResponses[cardIndex] ?? {}}
                      onInputChange={handleClozeInputChange}
                      onTokenDrop={handleClozeTokenDrop}
                      onTokenRemove={handleClozeTokenRemove}
                      onTokenDragStart={flashcards.handleClozeTokenDragStart}
                      onBlankDragOver={flashcards.handleClozeBlankDragOver}
                      onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                    />
                  );
                }

                if (card.kind === "true-false") {
                  return (
                    <TrueFalseCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      selections={
                        spacedRepetition.spacedRepetitionTrueFalseSelections[cardIndex] ?? {}
                      }
                      onSelect={handleTrueFalseSelect}
                      onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                    />
                  );
                }

                if (card.kind === "free-text") {
                  return (
                    <FreeTextCard
                      key={`flashcard-${cardIndex}`}
                      card={card}
                      cardIndex={cardIndex}
                      submitted={submitted}
                      response={
                        spacedRepetition.spacedRepetitionTextResponses[cardIndex] ?? ""
                      }
                      revealed={
                        spacedRepetition.spacedRepetitionTextRevealed[cardIndex] ??
                        false
                      }
                      selfGrade={spacedRepetition.spacedRepetitionSelfGrades[cardIndex]}
                      onInputChange={handleTextInputChange}
                      onCheck={handleTextCheck}
                      onSelfGrade={handleSelfGrade}
                    />
                  );
                }

                return (
                  <MultipleChoiceCard
                    key={`flashcard-${cardIndex}`}
                    card={card}
                    cardIndex={cardIndex}
                    submitted={submitted}
                    selectedKeys={
                      spacedRepetition.spacedRepetitionSelections[cardIndex] ?? []
                    }
                    onSelect={handleOptionSelect}
                    onSubmit={spacedRepetition.handleSpacedRepetitionSubmit}
                  />
                );
              })}
            </div>
          )}
          <div className="flashcard-pagination">
            <button
              type="button"
              className="ghost small"
              onClick={spacedRepetition.handleSpacedRepetitionPageBack}
              disabled={!spacedRepetition.spacedRepetitionCanGoBack}
            >
              Back
            </button>
            <button
              type="button"
              className="ghost small"
              onClick={spacedRepetition.handleSpacedRepetitionPageNext}
              disabled={!spacedRepetition.spacedRepetitionCanGoNext}
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isFocusMode ? null : (
        <section className="panel sr-tools-panel">
          <div className="panel-header">
            <div>
              <h2>Spaced Repetition Tools</h2>
            </div>
          </div>
          <div className="panel-body">
            <div className="setting-row">
              <span className="label">Boxes</span>
              <div className="pill-grid">
                {SPACED_REPETITION_BOXES.map((box) => (
                  <button
                    key={box}
                    type="button"
                    className={`pill pill-button ${
                      spacedRepetition.spacedRepetitionBoxes === box ? "active" : ""
                    }`}
                    aria-pressed={spacedRepetition.spacedRepetitionBoxes === box}
                    onClick={() => spacedRepetition.setSpacedRepetitionBoxes(box)}
                  >
                    {box} Boxes
                  </button>
                ))}
              </div>
            </div>
            <div className="setting-row">
              <span className="label">Default order</span>
              <div className="pill-grid">
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "in-order" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "in-order"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("in-order")}
                >
                  In order
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "random" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "random"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("random")}
                >
                  Random
                </button>
                <button
                  type="button"
                  className={`pill pill-button ${
                    spacedRepetition.spacedRepetitionOrder === "repetition" ? "active" : ""
                  }`}
                  aria-pressed={spacedRepetition.spacedRepetitionOrder === "repetition"}
                  onClick={() => spacedRepetition.setSpacedRepetitionOrder("repetition")}
                >
                  Repetition
                </button>
              </div>
              <span className="helper-text">
                In order keeps scan order. Random shuffles on load. Repetition
                prioritizes lower boxes and skips the last box.
              </span>
            </div>
            <div className="setting-row">
              <span className="label">Page size</span>
              <div className="pill-grid">
                {SPACED_REPETITION_PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`pill pill-button ${
                      spacedRepetition.spacedRepetitionPageSize === size ? "active" : ""
                    }`}
                    aria-pressed={spacedRepetition.spacedRepetitionPageSize === size}
                    onClick={() => spacedRepetition.setSpacedRepetitionPageSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {isFocusMode ? null : (
        <section className="panel stats-panel sr-stats-panel">
          <div className="panel-header">
            <div>
              <h2>Statistics</h2>
            </div>
          </div>
          <div className="panel-body">
            <KpiGrid items={kpiItems} />
          </div>
        </section>
      )}
      {isDeleteDialogOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
          >
            <h3 id="delete-user-title">Delete user</h3>
            <p className="muted">
              This permanently deletes the user and all spaced repetition progress.
            </p>
            <div className="modal-body">
              <span className="label">Type {deleteTargetName} to confirm</span>
              <input
                type="text"
                className="text-input"
                value={deleteConfirmInput}
                onChange={(event) => setDeleteConfirmInput(event.target.value)}
                aria-label="Type the username to confirm deletion"
              />
              <span className="helper-text">
                Match is case-sensitive. Leading/trailing spaces are ignored.
              </span>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleDeleteConfirm}
                disabled={!canConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

---

## 📝 vite-env.d.ts — ./vite-env.d.ts

/// <reference types="vite/client" />

---

