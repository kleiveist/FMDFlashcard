Markdown-Scan – Root: /mnt/daten/workspace/Blobbite/Develop/FMDFlashcard/apps/fmd-desktop/src
Erzeugt: 2026-01-04T20:55:36
Einstellungen: content=snippet, snippet_chars=800, toc_depth=3, types=.tsx, .css, .ts

=== Dateien ===

📁 .
  📝 App.css
     Pfad: 📝 App.css
     Größe: 48.27 KB (49424 B)
     Geändert: 2026-01-04T19:32:34
     Titel: f7dccb 0%,
     Überschriften: 7, Zeilen: 2956, Wörter: 6652, Zeichen: 49424
     Inhalt (Auszug): :root { font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif; font-size: 16px; line-height: 1.5; font-weight: 400; color: var(--ink); background-color: var(--bg); font-synthesis: none; text-rendering: optimizeLegibility;

  📝 App.tsx
     Pfad: 📝 App.tsx
     Größe: 2.54 KB (2605 B)
     Geändert: 2026-01-04T14:07:00
     Überschriften: 0, Zeilen: 90, Wörter: 189, Zeichen: 2605
     Inhalt (Auszug): import { useState } from "react"; import "./App.css"; import { AppStateProvider, useAppState } from "./components/AppStateProvider"; import { SidebarNav } from "./components/SidebarNav"; import { DashboardPage } from "./pages/DashboardPage"; import { FlashcardPage } from "./pages/FlashcardPage"; import { FastFlashcardPage } from "./pages/FastFlashcardPage"; import { HelpPage } from "./pages/HelpPage"; import { SettingsPage } from "./pages/SettingsPage"; import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

  📝 main.tsx
     Pfad: 📝 main.tsx
     Größe: 229 B (229 B)
     Geändert: 2025-12-28T04:12:07
     Überschriften: 0, Zeilen: 9, Wörter: 27, Zeichen: 229
     Inhalt (Auszug): import React from "react"; import ReactDOM from "react-dom/client"; import App from "./App";

  📝 vite-env.d.ts
     Pfad: 📝 vite-env.d.ts
     Größe: 38 B (38 B)
     Geändert: 2025-12-28T04:12:07
     Überschriften: 0, Zeilen: 1, Wörter: 4, Zeichen: 38
     Inhalt (Auszug): /// <reference types="vite/client" />


📁 components
  📝 AppStateProvider.tsx
     Pfad: 📁 components / 📝 AppStateProvider.tsx
     Größe: 9.80 KB (10033 B)
     Geändert: 2026-01-04T01:45:04
     Überschriften: 0, Zeilen: 349, Wörter: 688, Zeichen: 10033
     Inhalt (Auszug): import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode, } from "react"; import { isValidHex, normalizeHex } from "../lib/color"; import { type ThemeMode } from "../lib/theme"; import { type VaultFile } from "../lib/tree"; import { useFlashcards } from "../features/flashcards/useFlashcards"; import { usePreview } from "../features/preview/usePreview"; import { useAppSettings } from "../features/settings/useAppSettings"; import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition"; import { useVault } from "../features/vault/useVault";

  📝 FileList.tsx
     Pfad: 📁 components / 📝 FileList.tsx
     Größe: 1.75 KB (1793 B)
     Geändert: 2026-01-02T18:05:13
     Überschriften: 0, Zeilen: 60, Wörter: 157, Zeichen: 1793
     Inhalt (Auszug): import { type LoadState } from "../lib/types"; import { type VaultFile } from "../lib/tree";

  📝 icons.tsx
     Pfad: 📁 components / 📝 icons.tsx
     Größe: 639 B (639 B)
     Geändert: 2026-01-02T17:04:48
     Überschriften: 0, Zeilen: 28, Wörter: 104, Zeichen: 639
     Inhalt (Auszug): export const FolderIcon = () => ( <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"

  📝 KpiGrid.tsx
     Pfad: 📁 components / 📝 KpiGrid.tsx
     Größe: 402 B (402 B)
     Geändert: 2026-01-02T17:53:21
     Überschriften: 0, Zeilen: 19, Wörter: 45, Zeichen: 402
     Inhalt (Auszug): type KpiItem = { label: string; value: number; };

  📝 PreviewPanel.tsx
     Pfad: 📁 components / 📝 PreviewPanel.tsx
     Größe: 3.47 KB (3556 B)
     Geändert: 2026-01-03T19:30:44
     Überschriften: 0, Zeilen: 124, Wörter: 268, Zeichen: 3556
     Inhalt (Auszug): import ReactMarkdown from "react-markdown"; import rehypeSanitize from "rehype-sanitize"; import { type LoadState } from "../lib/types"; import { type VaultFile } from "../lib/tree";

  📝 SidebarNav.tsx
     Pfad: 📁 components / 📝 SidebarNav.tsx
     Größe: 4.85 KB (4971 B)
     Geändert: 2026-01-04T17:19:24
     Überschriften: 0, Zeilen: 160, Wörter: 378, Zeichen: 4971
     Inhalt (Auszug): import { useMemo } from "react"; import { useAppState } from "./AppStateProvider"; import { vaultBaseName } from "../lib/path";

  📝 StatsPanel.tsx
     Pfad: 📁 components / 📝 StatsPanel.tsx
     Größe: 1.93 KB (1975 B)
     Geändert: 2026-01-02T17:53:15
     Überschriften: 0, Zeilen: 64, Wörter: 165, Zeichen: 1975
     Inhalt (Auszug): import { useMemo, type CSSProperties } from "react";

  📝 VaultTree.tsx
     Pfad: 📁 components / 📝 VaultTree.tsx
     Größe: 3.16 KB (3238 B)
     Geändert: 2026-01-02T18:05:05
     Überschriften: 0, Zeilen: 100, Wörter: 286, Zeichen: 3238
     Inhalt (Auszug): import { useMemo } from "react"; import { FileIcon, FolderIcon } from "./icons"; import { vaultBaseName } from "../lib/path"; import { buildTree, type TreeNode, type VaultFile } from "../lib/tree"; import { type LoadState } from "../lib/types";


📁 components/flashcards
  📝 ClozeCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 ClozeCard.tsx
     Größe: 7.80 KB (7987 B)
     Geändert: 2026-01-04T15:09:11
     Überschriften: 0, Zeilen: 246, Wörter: 554, Zeichen: 7987
     Inhalt (Auszug): import { type DragEvent } from "react"; import { isDragAnswerMatch, isInputAnswerMatch, type ClozeCard as ClozeCardType, } from "../../lib/flashcards"; import { areClozeBlanksComplete, getClozeBlanks, isClozeCardCorrect, } from "../../features/flashcards/logic";

  📝 FreeTextCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 FreeTextCard.tsx
     Größe: 2.65 KB (2713 B)
     Geändert: 2026-01-04T15:09:19
     Überschriften: 0, Zeilen: 95, Wörter: 204, Zeichen: 2713
     Inhalt (Auszug): import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards"; import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

  📝 MultipleChoiceCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 MultipleChoiceCard.tsx
     Größe: 4.48 KB (4592 B)
     Geändert: 2026-01-04T15:08:59
     Überschriften: 0, Zeilen: 148, Wörter: 371, Zeichen: 4592
     Inhalt (Auszug): import { useMemo } from "react"; import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

  📝 TrueFalseCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 TrueFalseCard.tsx
     Größe: 4.20 KB (4301 B)
     Geändert: 2026-01-04T15:09:05
     Überschriften: 0, Zeilen: 124, Wörter: 308, Zeichen: 4301
     Inhalt (Auszug): import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards"; import { areTrueFalseItemsComplete, isTrueFalseCardCorrect, type TrueFalseSelection, } from "../../features/flashcards/logic";


📁 components/settings
  📝 AppearanceSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 AppearanceSection.tsx
     Größe: 2.84 KB (2913 B)
     Geändert: 2026-01-02T17:57:26
     Überschriften: 0, Zeilen: 100, Wörter: 246, Zeichen: 2913
     Inhalt (Auszug): import { type ThemeMode } from "../../lib/theme";

  📝 DataSyncSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 DataSyncSection.tsx
     Größe: 3.80 KB (3888 B)
     Geändert: 2026-01-02T21:37:41
     Überschriften: 0, Zeilen: 128, Wörter: 320, Zeichen: 3886
     Inhalt (Auszug): import { useState } from "react";

  📝 FlashcardsSettingsSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 FlashcardsSettingsSection.tsx
     Größe: 4.33 KB (4439 B)
     Geändert: 2026-01-03T18:56:49
     Überschriften: 0, Zeilen: 139, Wörter: 336, Zeichen: 4439
     Inhalt (Auszug): import type { FlashcardOrder, FlashcardPageSize, FlashcardScope, StatsResetMode, } from "../../features/flashcards/useFlashcards";

  📝 PerformanceSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 PerformanceSection.tsx
     Größe: 1.85 KB (1896 B)
     Geändert: 2026-01-02T17:57:08
     Überschriften: 0, Zeilen: 58, Wörter: 177, Zeichen: 1896
     Inhalt (Auszug): type PerformanceSectionProps = { maxFilesPerScan: string; onMaxFilesPerScanChange: (value: string) => void; scanParallelism: "low" | "medium" | "high"; setScanParallelism: (value: "low" | "medium" | "high") => void; };

  📝 SpacedRepetitionSettingsSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 SpacedRepetitionSettingsSection.tsx
     Größe: 5.19 KB (5310 B)
     Geändert: 2026-01-03T18:56:27
     Überschriften: 0, Zeilen: 149, Wörter: 329, Zeichen: 5310
     Inhalt (Auszug): import type { SpacedRepetitionBoxes, SpacedRepetitionOrder, SpacedRepetitionPageSize, SpacedRepetitionRepetitionStrength, } from "../../features/spaced-repetition/useSpacedRepetition";

  📝 VaultIndexSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 VaultIndexSection.tsx
     Größe: 3.40 KB (3480 B)
     Geändert: 2026-01-02T17:56:00
     Überschriften: 0, Zeilen: 112, Wörter: 307, Zeichen: 3478
     Inhalt (Auszug): import { type LoadState } from "../../lib/types";


📁 features/flashcards
  📝 logic.ts
     Pfad: 📁 features / 📁 flashcards / 📝 logic.ts
     Größe: 6.39 KB (6542 B)
     Geändert: 2026-01-04T12:59:23
     Überschriften: 0, Zeilen: 226, Wörter: 627, Zeichen: 6542
     Inhalt (Auszug): import type { DragEvent } from "react"; import { isDragAnswerMatch, isInputAnswerMatch, type ClozeSegment, type Flashcard, } from "../../lib/flashcards";

  📝 useFlashcards.ts
     Pfad: 📁 features / 📁 flashcards / 📝 useFlashcards.ts
     Größe: 17.93 KB (18356 B)
     Geändert: 2026-01-04T14:02:28
     Überschriften: 0, Zeilen: 626, Wörter: 1230, Zeichen: 18356
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"; import { invoke } from "@tauri-apps/api/core"; import { parseFlashcards, type Flashcard, type FlashcardDetectedType, } from "../../lib/flashcards"; import { evaluateFlashcardResult, getClozeDragPayload, handleClozeBlankDragOver, handleClozeTokenDragStart, shuffleFlashcards, type FlashcardSelfGrade, type TrueFalseSelection, } from "./logic"; import { type VaultFile } from "../../lib/tree";


📁 features/preview
  📝 usePreview.ts
     Pfad: 📁 features / 📁 preview / 📝 usePreview.ts
     Größe: 2.15 KB (2199 B)
     Geändert: 2026-01-02T17:14:52
     Überschriften: 0, Zeilen: 81, Wörter: 170, Zeichen: 2199
     Inhalt (Auszug): import { useCallback, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { asErrorMessage } from "../../lib/errors"; import { type LoadState } from "../../lib/types"; import { type VaultFile } from "../../lib/tree";


📁 features/settings
  📝 useAppSettings.ts
     Pfad: 📁 features / 📁 settings / 📝 useAppSettings.ts
     Größe: 19.10 KB (19561 B)
     Geändert: 2026-01-04T13:34:55
     Überschriften: 0, Zeilen: 524, Wörter: 1078, Zeichen: 19561
     Inhalt (Auszug): import { useCallback, useEffect, useRef, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color"; import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme"; import { DEFAULT_FLASHCARD_PAGE_SIZE, FLASHCARD_PAGE_SIZES, type FlashcardMode, type FlashcardOrder, type FlashcardPageSize, type FlashcardScope, type StatsResetMode, } from "../flashcards/useFlashcards"; import { DEFAULT_SPACED_REPETITION_PAGE_SIZE, SPACED_REPETITION_BOXES, SPACED_REPETITION_PAGE_SIZES, type SpacedRepetitionBoxes, type SpacedRepetitionOrder, type SpacedRepetitionPageSize, type SpacedRepetitionRepetitionStrength, } from "../spaced-repetition/useSpacedRepetition";


📁 features/spaced-repetition
  📝 logic.ts
     Pfad: 📁 features / 📁 spaced-repetition / 📝 logic.ts
     Größe: 8.38 KB (8577 B)
     Geändert: 2026-01-04T03:37:20
     Überschriften: 0, Zeilen: 303, Wörter: 745, Zeichen: 8577
     Inhalt (Auszug): import type { Flashcard } from "../../lib/flashcards"; import type { FlashcardResult, FlashcardSelfGrade, TrueFalseSelection, } from "../flashcards/logic";

  📝 useSpacedRepetition.ts
     Pfad: 📁 features / 📁 spaced-repetition / 📝 useSpacedRepetition.ts
     Größe: 34.30 KB (35124 B)
     Geändert: 2026-01-04T10:34:03
     Überschriften: 0, Zeilen: 1039, Wörter: 2056, Zeichen: 35124
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"; import { invoke } from "@tauri-apps/api/core"; import { evaluateFlashcardResult, getClozeDragPayload, type FlashcardSelfGrade, type TrueFalseSelection, } from "../flashcards/logic"; import type { FlashcardOrder, FlashcardScope } from "../flashcards/useFlashcards"; import type { Flashcard } from "../../lib/flashcards"; import { buildSpacedRepetitionSession, createEmptySpacedRepetitionSession, createEmptySpacedRepetitionUserState, createSpacedRepetitionUserId, getFlashcardId, getSpacedRepetitionEffectiveBox, MAX_SPACED_REPETITION_BOX, normalizeSpacedRepetitionCardProgress, type SpacedRepetitionRepetitionStrength, type SpacedRepetitionSession, type SpacedRepetitionStorage, type SpacedRepetitionUser, type Spaced …


📁 features/vault
  📝 useVault.ts
     Pfad: 📁 features / 📁 vault / 📝 useVault.ts
     Größe: 3.85 KB (3940 B)
     Geändert: 2026-01-02T17:14:27
     Überschriften: 0, Zeilen: 153, Wörter: 312, Zeichen: 3940
     Inhalt (Auszug): import { useCallback, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { open } from "@tauri-apps/plugin-dialog"; import { asErrorMessage } from "../../lib/errors"; import { type LoadState } from "../../lib/types"; import { type VaultFile } from "../../lib/tree";


📁 lib
  📝 chart.ts
     Pfad: 📁 lib / 📝 chart.ts
     Größe: 414 B (414 B)
     Geändert: 2026-01-02T17:01:49
     Überschriften: 0, Zeilen: 14, Wörter: 49, Zeichen: 414
     Inhalt (Auszug): export const buildLineChartPoints = (values: number[]) => { if (values.length === 0) { return ""; } const maxValue = Math.max(1, ...values); const step = values.length === 1 ? 0 : 100 / (values.length - 1); return values .map((value, index) => { const x = index * step; const y = 40 - (value / maxValue) * 30; return `${x.toFixed(2)},${y.toFixed(2)}`; }) .join(" "); };

  📝 color.ts
     Pfad: 📁 lib / 📝 color.ts
     Größe: 2.10 KB (2150 B)
     Geändert: 2026-01-02T17:01:35
     Überschriften: 0, Zeilen: 65, Wörter: 286, Zeichen: 2150
     Inhalt (Auszug): export const DEFAULT_ACCENT = "#E07A5F";

  📝 errors.ts
     Pfad: 📁 lib / 📝 errors.ts
     Größe: 211 B (211 B)
     Geändert: 2026-01-02T17:00:59
     Überschriften: 0, Zeilen: 9, Wörter: 22, Zeichen: 211
     Inhalt (Auszug): export const asErrorMessage = (error: unknown, fallback: string) => { if (error instanceof Error) { return error.message; } if (typeof error === "string") { return error; } return fallback; };

  📝 flashcardKeywords.ts
     Pfad: 📁 lib / 📝 flashcardKeywords.ts
     Größe: 815 B (815 B)
     Geändert: 2026-01-03T10:58:29
     Überschriften: 0, Zeilen: 62, Wörter: 63, Zeichen: 755
     Inhalt (Auszug): export const answerMarkers = [ "Answer:", "Antwort:", "Réponse:", "Respuesta:", "Resposta:", "Risposta:", "Antwoord:", "Svar:", "Vastaus:", "Odpowiedź:", "Odpověď:", "Odpoveď:", "Válasz:", "Răspuns:", "Cevap:", "Ответ:", "Απάντηση:", "إجابة:", ];

  📝 flashcards.test.ts
     Pfad: 📁 lib / 📝 flashcards.test.ts
     Größe: 13.95 KB (14286 B)
     Geändert: 2026-01-03T18:34:33
     Titel: `;
     Überschriften: 30, Zeilen: 527, Wörter: 1650, Zeichen: 14286
     Inhalt (Auszug): import { describe, expect, it } from "vitest"; import { isDragAnswerMatch, isInputAnswerMatch, parseFlashcards } from "./flashcards";

  📝 flashcards.ts
     Pfad: 📁 lib / 📝 flashcards.ts
     Größe: 12.24 KB (12530 B)
     Geändert: 2026-01-04T13:34:26
     Überschriften: 0, Zeilen: 513, Wörter: 1132, Zeichen: 12530
     Inhalt (Auszug): import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";

  📝 path.ts
     Pfad: 📁 lib / 📝 path.ts
     Größe: 339 B (339 B)
     Geändert: 2026-01-04T01:45:04
     Überschriften: 0, Zeilen: 11, Wörter: 33, Zeichen: 339
     Inhalt (Auszug): export const normalizeRelativePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

  📝 theme.ts
     Pfad: 📁 lib / 📝 theme.ts
     Größe: 860 B (860 B)
     Geändert: 2026-01-02T17:01:43
     Überschriften: 0, Zeilen: 21, Wörter: 88, Zeichen: 860
     Inhalt (Auszug): import { buildAccentTokens } from "./color";

  📝 tree.ts
     Pfad: 📁 lib / 📝 tree.ts
     Größe: 2.08 KB (2129 B)
     Geändert: 2026-01-02T17:01:14
     Überschriften: 0, Zeilen: 88, Wörter: 200, Zeichen: 2129
     Inhalt (Auszug): import { normalizeRelativePath } from "./path";

  📝 types.ts
     Pfad: 📁 lib / 📝 types.ts
     Größe: 54 B (54 B)
     Geändert: 2026-01-02T17:13:17
     Überschriften: 0, Zeilen: 1, Wörter: 6, Zeichen: 54
     Inhalt (Auszug): export type LoadState = "idle" | "loading" | "error";


📁 pages
  📝 DashboardPage.tsx
     Pfad: 📁 pages / 📝 DashboardPage.tsx
     Größe: 3.68 KB (3773 B)
     Geändert: 2026-01-03T19:08:03
     Überschriften: 0, Zeilen: 127, Wörter: 304, Zeichen: 3773
     Inhalt (Auszug): import { useEffect, useMemo, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { FileList } from "../components/FileList"; import { PreviewPanel } from "../components/PreviewPanel"; import { VaultTree } from "../components/VaultTree"; import { useAppState } from "../components/AppStateProvider"; import { asErrorMessage } from "../lib/errors";

  📝 FastFlashcardPage.tsx
     Pfad: 📁 pages / 📝 FastFlashcardPage.tsx
     Größe: 25.26 KB (25864 B)
     Geändert: 2026-01-04T19:31:39
     Überschriften: 0, Zeilen: 748, Wörter: 1856, Zeichen: 25864
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, } from "react"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { useAppState } from "../components/AppStateProvider"; import { evaluateFlashcardResult } from "../features/flashcards/logic"; import { vaultBaseName } from "../lib/path";

  📝 FlashcardPage.tsx
     Pfad: 📁 pages / 📝 FlashcardPage.tsx
     Größe: 17.13 KB (17538 B)
     Geändert: 2026-01-04T13:35:05
     Überschriften: 0, Zeilen: 500, Wörter: 1157, Zeichen: 17538
     Inhalt (Auszug): import { useCallback, useEffect, useState, type DragEvent } from "react"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { StatsPanel } from "../components/StatsPanel"; import { useAppState } from "../components/AppStateProvider"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, } from "../features/flashcards/logic"; import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

  📝 HelpPage.tsx
     Pfad: 📁 pages / 📝 HelpPage.tsx
     Größe: 57.09 KB (58459 B)
     Geändert: 2026-01-04T12:40:43
     Überschriften: 0, Zeilen: 1533, Wörter: 5093, Zeichen: 58459
     Inhalt (Auszug): import { useEffect, useRef, useState } from "react"; import { useAppState } from "../components/AppStateProvider";

  📝 SettingsPage.tsx
     Pfad: 📁 pages / 📝 SettingsPage.tsx
     Größe: 4.58 KB (4692 B)
     Geändert: 2026-01-03T01:36:30
     Überschriften: 0, Zeilen: 109, Wörter: 278, Zeichen: 4692
     Inhalt (Auszug): import { useCallback, useMemo } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppearanceSection } from "../components/settings/AppearanceSection"; import { DataSyncSection } from "../components/settings/DataSyncSection"; import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection"; import { PerformanceSection } from "../components/settings/PerformanceSection"; import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection"; import { VaultIndexSection } from "../components/settings/VaultIndexSection"; import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards"; import { SPACED_REPETITION_BOXES, SPACED_REPETITION_PAGE_SIZES, } from "../features/spaced-repetition/use …

  📝 SpacedRepetitionPage.tsx
     Pfad: 📁 pages / 📝 SpacedRepetitionPage.tsx
     Größe: 34.11 KB (34929 B)
     Geändert: 2026-01-04T10:35:32
     Überschriften: 0, Zeilen: 975, Wörter: 2177, Zeichen: 34925
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, } from "react"; import { buildLineChartPoints } from "../lib/chart"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { KpiGrid } from "../components/KpiGrid"; import { useAppState } from "../components/AppStateProvider"; import { vaultBaseName } from "../lib/path"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, } from "../features/flashcards/logic"; import { SPACED_REPETITION_BOXES, SPACED_REPETITION_PAGE_SIZES, } from "../features/spaced-repetitio …


=== Ordnerbaum (Quelle, nur ausgewählte Typen) ===

📁 .
├── 📁 assets
├── 📁 components
│   ├── 📁 flashcards
│   │   ├── 📝 ClozeCard.tsx
│   │   ├── 📝 FreeTextCard.tsx
│   │   ├── 📝 MultipleChoiceCard.tsx
│   │   └── 📝 TrueFalseCard.tsx
│   ├── 📁 settings
│   │   ├── 📝 AppearanceSection.tsx
│   │   ├── 📝 DataSyncSection.tsx
│   │   ├── 📝 FlashcardsSettingsSection.tsx
│   │   ├── 📝 PerformanceSection.tsx
│   │   ├── 📝 SpacedRepetitionSettingsSection.tsx
│   │   └── 📝 VaultIndexSection.tsx
│   ├── 📝 AppStateProvider.tsx
│   ├── 📝 FileList.tsx
│   ├── 📝 icons.tsx
│   ├── 📝 KpiGrid.tsx
│   ├── 📝 PreviewPanel.tsx
│   ├── 📝 SidebarNav.tsx
│   ├── 📝 StatsPanel.tsx
│   └── 📝 VaultTree.tsx
├── 📁 features
│   ├── 📁 flashcards
│   │   ├── 📝 logic.ts
│   │   └── 📝 useFlashcards.ts
│   ├── 📁 preview
│   │   └── 📝 usePreview.ts
│   ├── 📁 settings
│   │   └── 📝 useAppSettings.ts
│   ├── 📁 spaced-repetition
│   │   ├── 📝 logic.ts
│   │   └── 📝 useSpacedRepetition.ts
│   └── 📁 vault
│       └── 📝 useVault.ts
├── 📁 lib
│   ├── 📝 chart.ts
│   ├── 📝 color.ts
│   ├── 📝 errors.ts
│   ├── 📝 flashcardKeywords.ts
│   ├── 📝 flashcards.test.ts
│   ├── 📝 flashcards.ts
│   ├── 📝 path.ts
│   ├── 📝 theme.ts
│   ├── 📝 tree.ts
│   └── 📝 types.ts
├── 📁 pages
│   ├── 📝 DashboardPage.tsx
│   ├── 📝 FastFlashcardPage.tsx
│   ├── 📝 FlashcardPage.tsx
│   ├── 📝 HelpPage.tsx
│   ├── 📝 SettingsPage.tsx
│   └── 📝 SpacedRepetitionPage.tsx
├── 📝 App.css
├── 📝 App.tsx
├── 📝 main.tsx
└── 📝 vite-env.d.ts

=== Ordnerbaum (Ausgabeordner) ===

📁 .
├── 📁 assets
│   └── 📝 react.svg
├── 📁 components
│   ├── 📁 flashcards
│   │   ├── 📝 ClozeCard.tsx
│   │   ├── 📝 FreeTextCard.tsx
│   │   ├── 📝 MultipleChoiceCard.tsx
│   │   └── 📝 TrueFalseCard.tsx
│   ├── 📁 settings
│   │   ├── 📝 AppearanceSection.tsx
│   │   ├── 📝 DataSyncSection.tsx
│   │   ├── 📝 FlashcardsSettingsSection.tsx
│   │   ├── 📝 PerformanceSection.tsx
│   │   ├── 📝 SpacedRepetitionSettingsSection.tsx
│   │   └── 📝 VaultIndexSection.tsx
│   ├── 📝 AppStateProvider.tsx
│   ├── 📝 FileList.tsx
│   ├── 📝 icons.tsx
│   ├── 📝 KpiGrid.tsx
│   ├── 📝 PreviewPanel.tsx
│   ├── 📝 SidebarNav.tsx
│   ├── 📝 StatsPanel.tsx
│   └── 📝 VaultTree.tsx
├── 📁 features
│   ├── 📁 flashcards
│   │   ├── 📝 logic.ts
│   │   └── 📝 useFlashcards.ts
│   ├── 📁 preview
│   │   └── 📝 usePreview.ts
│   ├── 📁 settings
│   │   └── 📝 useAppSettings.ts
│   ├── 📁 spaced-repetition
│   │   ├── 📝 logic.ts
│   │   └── 📝 useSpacedRepetition.ts
│   └── 📁 vault
│       └── 📝 useVault.ts
├── 📁 lib
│   ├── 📝 chart.ts
│   ├── 📝 color.ts
│   ├── 📝 errors.ts
│   ├── 📝 flashcardKeywords.ts
│   ├── 📝 flashcards.test.ts
│   ├── 📝 flashcards.ts
│   ├── 📝 path.ts
│   ├── 📝 theme.ts
│   ├── 📝 tree.ts
│   └── 📝 types.ts
├── 📁 pages
│   ├── 📝 DashboardPage.tsx
│   ├── 📝 FastFlashcardPage.tsx
│   ├── 📝 FlashcardPage.tsx
│   ├── 📝 HelpPage.tsx
│   ├── 📝 SettingsPage.tsx
│   └── 📝 SpacedRepetitionPage.tsx
├── 📝 App.css
├── 📝 App.tsx
├── 📝 FolderList.txt
├── 📝 index.json
├── 📝 main.tsx
├── 📝 summary.md
└── 📝 vite-env.d.ts
