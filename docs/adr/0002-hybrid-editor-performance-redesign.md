<!-- AUTO-GENERATED:backlink START -->
[← Back](adr.md)
<!-- AUTO-GENERATED:backlink END -->
# ADR 0002: Hybrid-Editor Performance Redesign (Big Bang)

Date: 2026-03-19

## Status

Implemented (verification in progress)

## Context

Der `MarkdownHybridEditor` hatte bei längeren Dokumenten Keystroke-Lag. Die Hauptursachen waren:

- zu viel globale Arbeit pro Eingabe (Parsing/Analyse auf Gesamtdokument),
- hohe Re-Render-Kosten im Block-Tree,
- enge Kopplung von Input, Layout-Messung und Overlay-Logik,
- steigende DOM-/Render-Kosten bei großen Notizen.

Zusätzlich ist FMD-Markdown semantisch schwerer als Plain Markdown (`#card`, `#exam`, `#help`, `---`, Listen-/Task-Syntax, Tabellen, Medien, Composite-Abschnitte), wodurch naive Full-Reparse-Strategien schneller teuer werden.

## Decision

Es wurde ein direkter Architektur-Umbau ohne Feature-Flag umgesetzt:

1. **Incremental Document Model** als zentrale Parse-Snapshot-Schicht.
2. **Worker-gestützte Parse-Pipeline** mit Stale-Response-Schutz und robustem Fallback.
3. **Render-Isolation pro Row** mit memoisierten Inactive-Bodies.
4. **Fensterbasiertes Rendering (Virtualisierung)** mit Height-Cache.
5. **Layout/Event-Entkopplung** mit `requestAnimationFrame`-Batching.
6. **Keine neuen Runtime-Dependencies**; ausschließlich bestehende Browser-/React-Mittel.

## Scope

- Shared Core (Preview/Hybrid-Editor, damit indirekt für Exam-Editor-Flow relevant, wo derselbe Core genutzt wird).
- Öffentliche `MarkdownHybridEditor`-Props/Ref-API unverändert.
- Keine neuen User-Settings.

## Full Change Inventory

### 1) `apps/fmd-desktop/src/features/preview/markdownDocumentModel.ts` (neu)

**Was wurde gemacht**

- Neue Typen für Diff/Stats/Snapshot eingeführt:
  - `MarkdownDiffRange`
  - `MarkdownParseStats`
  - `MarkdownDocumentSnapshot`
  - `MarkdownParseResult`
- Incremental-Diff-Range-Berechnung (`resolveDiffRange`) implementiert.
- Overlap-Range gegen bestehende Blöcke (`resolveOverlappingRange`) implementiert.
- Reindexing-Logik für Offsets/Zeilen (`reindexBlocks`) eingeführt.
- Incremental-Reparse mit Bereichserweiterung (`while`-Loop) umgesetzt:
  - Start mit geändertem Bereich + Kontextblöcken.
  - Schrittweise Expansion nach links/rechts, bis Rekonstruktion stabil ist.
  - Full-Parse-Fallback bei Inkonsistenz.
- Boundary-Seam-Stabilitätsprüfung ergänzt (`isBoundaryStable`):
  - verhindert semantisch falsches Stitching an Segment-Grenzen
  - wichtig bei Marker-Syntax wie `#card/#endcard`.
- Test-Helper (`__testOnly`) für diff/overlap/reindex exportiert.

**Warum**

- Full-Reparse bei jedem Keystroke wurde durch Delta-orientierte Verarbeitung ersetzt.
- Semantische Sicherheit bleibt erhalten, da unstabile Grenzfälle nicht „durchrutschen“, sondern expandieren/fallbacken.

**Erwartete Verbesserung**

- Parserkosten näher an `O(Δ + Kontext)` statt `O(N)` in typischen Editierfällen.
- Weniger CPU-Spitzen und geringere Input-Latenz.

---

### 2) `apps/fmd-desktop/src/features/preview/markdownBlocks.worker.types.ts` (neu)

**Was wurde gemacht**

- Shared Request/Response-Typen für Worker-Kommunikation ausgelagert.

**Warum**

- Entkoppelt Main-Thread-Hook von direktem Worker-Entrypoint-Import.
- Sauberere Schichtentrennung zwischen Typvertrag und Worker-Runtime.

---

### 3) `apps/fmd-desktop/src/features/preview/markdownBlocks.worker.ts` (neu)

**Was wurde gemacht**

- Worker-Entrypoint für Parse-Requests eingeführt.
- Verarbeitet `parse`-Requests und liefert:
  - `parsed` (Snapshot + Stats) oder
  - `error` (Fehlermeldung).
- Snapshot wird vor `postMessage` sanitisiert.

**Warum**

- Entlastet den Main-Thread von Parserarbeit.
- Hält UI responsiv, besonders bei komplexen Markdown-Strukturen.

**Erwartete Verbesserung**

- Weniger Input-Jank unter Last.
- Glatteres Scrolling/Tippen bei großen Dokumenten.

---

### 4) `apps/fmd-desktop/src/features/preview/useMarkdownDocumentModel.ts` (neu)

**Was wurde gemacht**

- Neuer Hook als Orchestrator zwischen Main-Thread und Worker.
- Hält State als `{ snapshot, stats }`.
- Worker-Lifecycle implementiert:
  - lazy creation,
  - listener cleanup,
  - terminate on unmount.
- Stale-Schutz über monotone `requestId` + `version`.
- Robuste Fallback-Strategien:
  - kein Worker verfügbar,
  - Worker-Erstellung fehlgeschlagen,
  - Worker-Error,
  - `postMessage`-Fehler.
- Bei Worker-Fehlern wird auf Main-Thread-Parsing degradiert (`workerUnavailableRef`).

**Warum**

- Verhindert falsche/verspätete Responses im schnellen Tippfluss.
- Garantiert funktionales Verhalten auch bei Worker-Problemen.

**Erwartete Verbesserung**

- Stabilere Edit-Responsiveness ohne inkonsistente Zwischenzustände.

---

### 5) `apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx` (modifiziert)

**Was wurde gemacht (Hauptpunkte)**

- Parse-Quelle umgestellt:
  - von direktem `parseMarkdownBlocks(markdown)` auf `useMarkdownDocumentModel(markdown)`.
  - defensiver Fallback bleibt erhalten, falls Snapshot-Markdown nicht passt.
- Virtualisierungs-Grundlagen ergänzt:
  - Threshold/Overscan-Konstanten.
  - `virtualViewport`-State.
  - `blockHeightCacheRef`.
  - Fallback-Höhen pro Block-Kind.
  - Sichtbarkeits-Set (`visibleVirtualizedIndices`) + Pinning aktiver/selektierter/dragged Blöcke.
- Viewport-Messung entkoppelt:
  - `measureVirtualViewport` + `scheduleVirtualViewportMeasure` via rAF.
  - Scroll-/Resize-Listener auf Scroll-Host.
- Overlay/Layout-Messung auf rAF-Batching konsolidiert.
- Active-Textarea-Layout-Sync auf rAF umgestellt (`scheduleActiveTextareaLayoutSync`).
- Inactive-Row-Render-Isolation eingeführt:
  - `inactiveBlockBodyByIndex` memoisiert schwere Inactive-Preview-Arbeit.
  - Off-window Rows bekommen Virtual-Placeholder statt voller Heavy-Render-Pipeline.
- Height-Placeholder-Chrome-Korrektur (`VIRTUAL_PLACEHOLDER_BLOCK_CHROME_PX`) ergänzt:
  - verhindert Layout-Drift durch Block-Rand/Padding.

**Warum**

- Der größte Engpass lag im globalen Rechnen/Rendern pro Eingabe.
- Die Trennung „aktiver Block sofort, inaktive Rows effizient“ reduziert Kosten massiv im Tipp-Loop.

**Erwartete Verbesserung**

- Deutlich weniger unnötige Re-Renders.
- Weniger Reflow/Paint-Arbeit außerhalb des sichtbaren Fensters.
- Bessere Scroll-Stabilität bei langen Dokumenten.

---

### 6) `apps/fmd-desktop/src/styles/components/preview.css` (modifiziert)

**Was wurde gemacht**

- Für `.markdown-hybrid-block`:
  - `content-visibility: auto`
  - `contain-intrinsic-size: 96px`
- Neue Klasse `.markdown-hybrid-virtual-placeholder`.

**Warum**

- Browser kann Offscreen-Rendering aggressiver optimieren.
- Placeholder visualisiert virtuelle Off-window-Rows leichtgewichtig.

**Erwartete Verbesserung**

- Reduzierte Paint/Layout-Kosten bei großen Listen.

---

### 7) `apps/fmd-desktop/src/features/preview/markdownDocumentModel.test.ts` (neu)

**Was wurde gemacht**

- Tests für:
  - diff-range Korrektheit,
  - Incremental-vs-Full Äquivalenz über Edit-Sequenzen,
  - sichere Fallback-/Stitching-Korrektheit.
- Randomized-Edit-Test deterministisch gemacht (seeded RNG), um Flaky-Verhalten zu vermeiden.
- Vergleich auf semantische Blockgleichheit (ohne ID-Instabilität) ausgerichtet.

**Warum**

- Regressionen im Incremental-Parser sind subtil; stabile, reproduzierbare Tests sind zwingend.

## Why This Design (Tradeoff-Rationale)

- **Big Bang statt Flag**: reduziert Parallelbetrieb zweier Architekturen und senkt langfristige Komplexität.
- **Incremental + Worker**: kombiniert geringe CPU-Kosten mit UI-Thread-Entlastung.
- **Virtualisierung + Memoization**: reduziert Renderarbeit dort, wo User sie nicht sieht.
- **Fallback-first Safety**: Korrektheit vor aggressiver Optimierung.

## Expected Improvements

Qualitativ wird erwartet:

- spürbar geringerer Keystroke-Lag bei mittleren/großen Dokumenten,
- reduzierte CPU-Spitzen während schneller Eingabe,
- stabileres Scrollen in langen Dokumenten,
- weniger globale Re-Renders pro Input-Tick,
- robustere Reaktion auf Parser-/Worker-Fehlerfälle.

Technisch in Komplexitätsbegriffen:

- Parse-Aufwand typischerweise von Full-Document auf Delta-Bereich reduziert.
- Render-Aufwand von „alle Rows neu“ Richtung „active + visible/pinned Rows“ verschoben.

## Risks / Side Effects

- Höhere interne Komplexität (Invalidierung, Stitching, Worker-Kommunikation).
- Mehr RAM-Verbrauch für Snapshot-/Height-Cache.
- Potenzielle Edge-Cases bei blockübergreifender Syntax bleiben ein Augenmerk.
- Bei Worker-Ausfall erfolgt kontrollierte Degradierung auf Main-Thread.

## Test & Verification Status

- Vorliegender Suite-Lauf zeigte initial 2 Failures in `markdownDocumentModel.test.ts`.
- Diese Ursachen wurden adressiert:
  - Boundary-Stabilitätsprüfung im Incremental-Stitching ergänzt.
  - ID-sensitive Assertion auf semantische Gleichheit korrigiert.
- In der aktuellen Agent-Umgebung war kein erneuter lokaler Run möglich (`pnpm` nicht in `PATH`).

## Rollout

- Direct Replace bereits umgesetzt.
- Keine API-Änderungen an `MarkdownHybridEditor` nach außen.
- Kein Migrationsschritt für Endnutzer erforderlich.

## Follow-up (Recommended)

1. Vollen Testlauf erneut ausführen (`python3 tools/control.py --test`).
2. React Profiler Vorher/Nachher für große Notizen dokumentieren.
3. Optional: Debug-Metriken für `stats.mode`, `changedBlockRange`, Worker-Fallback-Rate in Dev-Builds ergänzen.
