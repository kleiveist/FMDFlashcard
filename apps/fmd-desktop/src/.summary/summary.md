Markdown-Scan – Root: /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop/src
Erzeugt: 2026-01-07T17:38:31
Einstellungen: content=snippet, snippet_chars=800, toc_depth=3, types=.tsx, .css, .ts, .json, .shipping

=== Dateien ===

📁 .
  📝 App.css
     Pfad: 📝 App.css
     Größe: 665 B (665 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 16, Wörter: 79, Zeichen: 665
     Inhalt (Auszug): @import "./styles/tokens.css"; @import "./styles/base.css"; @import "./styles/layout.css"; @import "./styles/components/buttons.css"; @import "./styles/components/content.css"; @import "./styles/components/panels.css"; @import "./styles/components/flashcards.css"; @import "./styles/components/stats.css"; @import "./styles/components/help.css"; @import "./styles/components/spaced-repetition.css"; @import "./styles/components/panel-layout.css"; @import "./styles/components/modals.css"; @import "./styles/components/preview.css"; @import "./styles/components/utility.css"; @import "./styles/components/settings.css"; @import "./styles/components/responsive.css";

  📝 App.tsx
     Pfad: 📝 App.tsx
     Größe: 2.80 KB (2870 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 97, Wörter: 205, Zeichen: 2870
     Inhalt (Auszug): import { useState } from "react"; import "./App.css"; import { AppStateProvider, useAppState } from "./components/AppStateProvider"; import { AppErrorBoundary } from "./components/AppErrorBoundary"; import { SidebarNav } from "./components/SidebarNav"; import { DashboardPage } from "./pages/DashboardPage"; import { ExamSimulationPage } from "./pages/ExamSimulationPage"; import { FlashcardPage } from "./pages/FlashcardPage"; import { FastFlashcardPage } from "./pages/FastFlashcardPage"; import { HelpPage } from "./pages/HelpPage"; import { SettingsPage } from "./pages/SettingsPage"; import { SpacedRepetitionPage } from "./pages/SpacedRepetitionPage";

  📝 main.tsx
     Pfad: 📝 main.tsx
     Größe: 1.24 KB (1272 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 37, Wörter: 131, Zeichen: 1272
     Inhalt (Auszug): import React from "react"; import ReactDOM from "react-dom/client"; import App from "./App";

  📝 vite-env.d.ts
     Pfad: 📝 vite-env.d.ts
     Größe: 38 B (38 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1, Wörter: 4, Zeichen: 38
     Inhalt (Auszug): /// <reference types="vite/client" />


📁 components
  📝 AppErrorBoundary.tsx
     Pfad: 📁 components / 📝 AppErrorBoundary.tsx
     Größe: 2.37 KB (2430 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 94, Wörter: 196, Zeichen: 2430
     Inhalt (Auszug): import { Component, type ErrorInfo, type ReactNode } from "react";

  📝 AppStateProvider.tsx
     Pfad: 📁 components / 📝 AppStateProvider.tsx
     Größe: 13.31 KB (13629 B)
     Geändert: 2026-01-07T09:45:42
     Überschriften: 0, Zeilen: 488, Wörter: 915, Zeichen: 13629
     Inhalt (Auszug): import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, } from "react"; import { isValidHex, normalizeHex } from "../lib/color"; import { normalizeRelativePath } from "../lib/path"; import { type ThemeMode } from "../lib/theme"; import { type VaultFile } from "../lib/tree"; import { useFlashcards } from "../features/flashcards/useFlashcards"; import { usePreview } from "../features/preview/usePreview"; import { useAppSettings } from "../features/settings/useAppSettings"; import { type SettingsPageId } from "../features/settings/settingsNavigation"; import { useSpacedRepetition } from "../features/spaced-repetition/useSpacedRepetition"; import { useVault } from "../features/vault/useVault"; import { LargeVaultWarningModal } from "./LargeVaultWarningModa …

  📝 FileList.tsx
     Pfad: 📁 components / 📝 FileList.tsx
     Größe: 1.92 KB (1968 B)
     Geändert: 2026-01-07T09:28:01
     Überschriften: 0, Zeilen: 66, Wörter: 168, Zeichen: 1968
     Inhalt (Auszug): import { type LoadState } from "../lib/types"; import { type VaultFile } from "../lib/tree";

  📝 icons.tsx
     Pfad: 📁 components / 📝 icons.tsx
     Größe: 1.81 KB (1856 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 78, Wörter: 303, Zeichen: 1856
     Inhalt (Auszug): export const FolderIcon = () => ( <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"

  📝 KpiGrid.tsx
     Pfad: 📁 components / 📝 KpiGrid.tsx
     Größe: 402 B (402 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 19, Wörter: 45, Zeichen: 402
     Inhalt (Auszug): type KpiItem = { label: string; value: number; };

  📝 LargeVaultWarningModal.tsx
     Pfad: 📁 components / 📝 LargeVaultWarningModal.tsx
     Größe: 998 B (998 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 38, Wörter: 98, Zeichen: 998
     Inhalt (Auszug): type LargeVaultWarningModalProps = { count: number | null; onClose: () => void; };

  📝 PreviewPanel.tsx
     Pfad: 📁 components / 📝 PreviewPanel.tsx
     Größe: 25.75 KB (26369 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 949, Wörter: 2149, Zeichen: 26369
     Inhalt (Auszug): import { type FocusEvent, type MouseEvent, useCallback, useEffect, useLayoutEffect, useRef, } from "react"; import ReactMarkdown from "react-markdown"; import rehypeSanitize, { defaultSchema } from "rehype-sanitize"; import remarkGfm from "remark-gfm"; import { type LoadState } from "../lib/types"; import { type VaultFile } from "../lib/tree";

  📝 SidebarNav.tsx
     Pfad: 📁 components / 📝 SidebarNav.tsx
     Größe: 10.21 KB (10456 B)
     Geändert: 2026-01-07T09:43:57
     Überschriften: 0, Zeilen: 317, Wörter: 706, Zeichen: 10456
     Inhalt (Auszug): import { useEffect, useMemo, useState } from "react"; import { useAppState } from "./AppStateProvider"; import { normalizeRelativePath, vaultBaseName } from "../lib/path"; import { VaultTree } from "./VaultTree"; import { CardsIcon, FolderIcon, HelpIcon, SettingsIcon } from "./icons"; import { helpTopics, resolveText } from "../pages/help/helpContent"; import { SETTINGS_PAGES } from "../features/settings/settingsNavigation";

  📝 StatsPanel.tsx
     Pfad: 📁 components / 📝 StatsPanel.tsx
     Größe: 1.93 KB (1975 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 64, Wörter: 165, Zeichen: 1975
     Inhalt (Auszug): import { useMemo, type CSSProperties } from "react";

  📝 VaultCreateModal.tsx
     Pfad: 📁 components / 📝 VaultCreateModal.tsx
     Größe: 2.53 KB (2591 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 100, Wörter: 219, Zeichen: 2591
     Inhalt (Auszug): import { useEffect, useRef } from "react";

  📝 VaultTree.tsx
     Pfad: 📁 components / 📝 VaultTree.tsx
     Größe: 18.98 KB (19434 B)
     Geändert: 2026-01-07T09:46:11
     Überschriften: 0, Zeilen: 626, Wörter: 1498, Zeichen: 19434
     Inhalt (Auszug): import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, } from "react"; import { invoke } from "@tauri-apps/api/core"; import { openPath } from "@tauri-apps/plugin-opener"; import { FileIcon, FolderIcon } from "./icons"; import { VaultCreateModal } from "./VaultCreateModal"; import { asErrorMessage } from "../lib/errors"; import { normalizeRelativePath, vaultBaseName } from "../lib/path"; import { buildTree, sortNodes, type TreeNode, type VaultFile, } from "../lib/tree"; import { type LoadState } from "../lib/types";


📁 components/flashcards
  📝 ClozeCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 ClozeCard.tsx
     Größe: 8.40 KB (8602 B)
     Geändert: 2026-01-07T13:46:38
     Überschriften: 0, Zeilen: 265, Wörter: 594, Zeichen: 8602
     Inhalt (Auszug): import { type DragEvent } from "react"; import { isDragAnswerMatch, isInputAnswerMatch, type ClozeCard as ClozeCardType, } from "../../lib/flashcards"; import { areClozeBlanksComplete, getClozeBlanks, isClozeCardCorrect, } from "../../features/flashcards/logic";

  📝 CompositeCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 CompositeCard.tsx
     Größe: 7.21 KB (7387 B)
     Geändert: 2026-01-07T13:47:26
     Überschriften: 0, Zeilen: 225, Wörter: 479, Zeichen: 7387
     Inhalt (Auszug): import type { DragEvent } from "react"; import { ClozeCard } from "./ClozeCard"; import { FreeTextCard } from "./FreeTextCard"; import { MultipleChoiceCard } from "./MultipleChoiceCard"; import { TrueFalseCard } from "./TrueFalseCard"; import type { CompositeFlashcard } from "../../lib/flashcards"; import { evaluateFlashcardPartResult, isFlashcardPartComplete, type CompositePartState, type FlashcardSelfGrade, type TrueFalseSelection, } from "../../features/flashcards/logic";

  📝 FreeTextCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 FreeTextCard.tsx
     Größe: 2.81 KB (2879 B)
     Geändert: 2026-01-07T13:46:52
     Überschriften: 0, Zeilen: 99, Wörter: 210, Zeichen: 2879
     Inhalt (Auszug): import type { FreeTextCard as FreeTextCardType } from "../../lib/flashcards"; import type { FlashcardSelfGrade } from "../../features/flashcards/logic";

  📝 MultipleChoiceCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 MultipleChoiceCard.tsx
     Größe: 4.90 KB (5018 B)
     Geändert: 2026-01-07T13:46:10
     Überschriften: 0, Zeilen: 161, Wörter: 398, Zeichen: 5018
     Inhalt (Auszug): import { useMemo } from "react"; import { type MultipleChoiceCard as MultipleChoiceCardType } from "../../lib/flashcards";

  📝 TrueFalseCard.tsx
     Pfad: 📁 components / 📁 flashcards / 📝 TrueFalseCard.tsx
     Größe: 4.70 KB (4817 B)
     Geändert: 2026-01-07T13:46:25
     Überschriften: 0, Zeilen: 139, Wörter: 342, Zeichen: 4817
     Inhalt (Auszug): import { type TrueFalseCard as TrueFalseCardType } from "../../lib/flashcards"; import { areTrueFalseItemsComplete, isTrueFalseCardCorrect, type TrueFalseSelection, } from "../../features/flashcards/logic";


📁 components/settings
  📝 AppearanceSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 AppearanceSection.tsx
     Größe: 6.23 KB (6384 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 187, Wörter: 471, Zeichen: 6384
     Inhalt (Auszug): import { type ThemeMode } from "../../lib/theme";

  📝 DataSyncTabContent.tsx
     Pfad: 📁 components / 📁 settings / 📝 DataSyncTabContent.tsx
     Größe: 2.46 KB (2516 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 95, Wörter: 221, Zeichen: 2514
     Inhalt (Auszug): type AppLanguage = "de" | "en";

  📝 ExamSettingsSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 ExamSettingsSection.tsx
     Größe: 3.72 KB (3808 B)
     Geändert: 2026-01-07T08:51:20
     Überschriften: 0, Zeilen: 120, Wörter: 335, Zeichen: 3808
     Inhalt (Auszug): import { useMemo } from "react"; import type { ExamAiEvaluation } from "../../features/settings/useAppSettings";

  📝 FastFlashcardToolsSettings.tsx
     Pfad: 📁 components / 📁 settings / 📝 FastFlashcardToolsSettings.tsx
     Größe: 3.67 KB (3760 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 108, Wörter: 277, Zeichen: 3760
     Inhalt (Auszug): import { type FlashcardMode, type FlashcardOrder, type FlashcardScope } from "../../features/flashcards/useFlashcards";

  📝 FlashcardsSettingsSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 FlashcardsSettingsSection.tsx
     Größe: 4.80 KB (4920 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 150, Wörter: 379, Zeichen: 4920
     Inhalt (Auszug): import type { FlashcardMode, FlashcardOrder, FlashcardPageSize, FlashcardScope, StatsResetMode, } from "../../features/flashcards/useFlashcards";

  📝 PerformanceTabContent.tsx
     Pfad: 📁 components / 📁 settings / 📝 PerformanceTabContent.tsx
     Größe: 1.47 KB (1508 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 48, Wörter: 131, Zeichen: 1508
     Inhalt (Auszug): type PerformanceTabContentProps = { maxFilesPerScan: string; onMaxFilesPerScanChange: (value: string) => void; scanParallelism: "low" | "medium" | "high"; setScanParallelism: (value: "low" | "medium" | "high") => void; };

  📝 ResetSessionHistoryModal.tsx
     Pfad: 📁 components / 📁 settings / 📝 ResetSessionHistoryModal.tsx
     Größe: 1.28 KB (1315 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 49, Wörter: 118, Zeichen: 1315
     Inhalt (Auszug): type ResetSessionHistoryModalProps = { isOpen: boolean; isPending?: boolean; onCancel: () => void; onConfirm: () => void; };

  📝 SpacedRepetitionSettingsSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 SpacedRepetitionSettingsSection.tsx
     Größe: 5.32 KB (5452 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 153, Wörter: 340, Zeichen: 5452
     Inhalt (Auszug): import type { SpacedRepetitionBoxes, SpacedRepetitionOrder, SpacedRepetitionPageSize, SpacedRepetitionRepetitionStrength, } from "../../features/spaced-repetition/useSpacedRepetition";

  📝 VaultIndexSection.tsx
     Pfad: 📁 components / 📁 settings / 📝 VaultIndexSection.tsx
     Größe: 5.73 KB (5863 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 172, Wörter: 470, Zeichen: 5861
     Inhalt (Auszug): import { useState } from "react"; import { type LoadState } from "../../lib/types"; import { DataSyncTabContent } from "./DataSyncTabContent";


📁 features/fast-flashcard
  📝 constants.ts
     Pfad: 📁 features / 📁 fast-flashcard / 📝 constants.ts
     Größe: 149 B (149 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 3, Wörter: 16, Zeichen: 149
     Inhalt (Auszug): export const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48] as const;


📁 features/flashcards
  📝 logic.test.ts
     Pfad: 📁 features / 📁 flashcards / 📝 logic.test.ts
     Größe: 1.43 KB (1465 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 68, Wörter: 112, Zeichen: 1465
     Inhalt (Auszug): import { describe, expect, it } from "vitest"; import type { Flashcard } from "../../lib/flashcards"; import { calculateFlashcardStats, evaluateFlashcardResult, type CompositePartState, } from "./logic";

  📝 logic.ts
     Pfad: 📁 features / 📁 flashcards / 📝 logic.ts
     Größe: 8.44 KB (8640 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 296, Wörter: 800, Zeichen: 8640
     Inhalt (Auszug): import type { DragEvent } from "react"; import { isDragAnswerMatch, isInputAnswerMatch, type ClozeSegment, type FlashcardPart, type Flashcard, } from "../../lib/flashcards";

  📝 useFlashcards.ts
     Pfad: 📁 features / 📁 flashcards / 📝 useFlashcards.ts
     Größe: 24.85 KB (25448 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 857, Wörter: 1704, Zeichen: 25448
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"; import { invoke } from "@tauri-apps/api/core"; import { parseFlashcards, type Flashcard, type FlashcardDetectedType, type FlashcardPart, } from "../../lib/flashcards"; import { evaluateFlashcardResult, getClozeDragPayload, handleClozeBlankDragOver, handleClozeTokenDragStart, shuffleFlashcards, type CompositePartState, type FlashcardSelfGrade, type TrueFalseSelection, } from "./logic"; import { type VaultFile } from "../../lib/tree";


📁 features/preview
  📝 usePreview.ts
     Pfad: 📁 features / 📁 preview / 📝 usePreview.ts
     Größe: 2.15 KB (2199 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 81, Wörter: 170, Zeichen: 2199
     Inhalt (Auszug): import { useCallback, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { asErrorMessage } from "../../lib/errors"; import { type LoadState } from "../../lib/types"; import { type VaultFile } from "../../lib/tree";


📁 features/settings
  📝 settingsNavigation.ts
     Pfad: 📁 features / 📁 settings / 📝 settingsNavigation.ts
     Größe: 307 B (307 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 8, Wörter: 34, Zeichen: 307
     Inhalt (Auszug): export const SETTINGS_PAGES = [ { id: "app-settings", label: "App Settings" }, { id: "exam-settings", label: "Exam Settings" }, { id: "review-tools", label: "Review Tools" }, { id: "appearance", label: "Appearance" }, ] as const;

  📝 useAppSettings.ts
     Pfad: 📁 features / 📁 settings / 📝 useAppSettings.ts
     Größe: 33.40 KB (34197 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 924, Wörter: 1938, Zeichen: 34197
     Inhalt (Auszug): import { useCallback, useEffect, useRef, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { DEFAULT_ACCENT, isValidHex, normalizeHex } from "../../lib/color"; import { applyAccentColor, applyTheme, type ThemeMode } from "../../lib/theme"; import { DEFAULT_FLASHCARD_PAGE_SIZE, FLASHCARD_PAGE_SIZES, type FlashcardMode, type FlashcardOrder, type FlashcardPageSize, type FlashcardScope, type StatsResetMode, } from "../flashcards/useFlashcards"; import { FAST_FLASHCARD_DURATIONS, type FastFlashcardDuration, } from "../fast-flashcard/constants"; import { DEFAULT_SPACED_REPETITION_PAGE_SIZE, SPACED_REPETITION_BOXES, SPACED_REPETITION_PAGE_SIZES, type SpacedRepetitionBoxes, type SpacedRepetitionOrder, type SpacedRepetitionPageSize, type SpacedRepetitionRepetitionStreng …


📁 features/spaced-repetition
  📝 logic.ts
     Pfad: 📁 features / 📁 spaced-repetition / 📝 logic.ts
     Größe: 9.02 KB (9238 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 326, Wörter: 792, Zeichen: 9238
     Inhalt (Auszug): import type { Flashcard, FlashcardPart } from "../../lib/flashcards"; import type { CompositePartState, FlashcardResult, FlashcardSelfGrade, TrueFalseSelection, } from "../flashcards/logic";

  📝 useSpacedRepetition.ts
     Pfad: 📁 features / 📁 spaced-repetition / 📝 useSpacedRepetition.ts
     Größe: 39.59 KB (40539 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1204, Wörter: 2364, Zeichen: 40539
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"; import { invoke } from "@tauri-apps/api/core"; import { evaluateFlashcardResult, getClozeDragPayload, type CompositePartState, type FlashcardSelfGrade, type TrueFalseSelection, } from "../flashcards/logic"; import type { FlashcardOrder, FlashcardScope } from "../flashcards/useFlashcards"; import type { Flashcard } from "../../lib/flashcards"; import { buildSpacedRepetitionSession, createEmptySpacedRepetitionSession, createEmptySpacedRepetitionUserState, createSpacedRepetitionUserId, getFlashcardId, getSpacedRepetitionEffectiveBox, MAX_SPACED_REPETITION_BOX, normalizeSpacedRepetitionCardProgress, type SpacedRepetitionRepetitionStrength, type SpacedRepetitionSession, type SpacedRepetitionStorage, type SpacedRe …


📁 features/vault
  📝 useVault.ts
     Pfad: 📁 features / 📁 vault / 📝 useVault.ts
     Größe: 3.91 KB (4002 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 153, Wörter: 318, Zeichen: 4002
     Inhalt (Auszug): import { useCallback, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { open } from "@tauri-apps/plugin-dialog"; import { asErrorMessage } from "../../lib/errors"; import { type LoadState } from "../../lib/types"; import { type VaultFile } from "../../lib/tree";


📁 lib
  📝 chart.ts
     Pfad: 📁 lib / 📝 chart.ts
     Größe: 414 B (414 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 14, Wörter: 49, Zeichen: 414
     Inhalt (Auszug): export const buildLineChartPoints = (values: number[]) => { if (values.length === 0) { return ""; } const maxValue = Math.max(1, ...values); const step = values.length === 1 ? 0 : 100 / (values.length - 1); return values .map((value, index) => { const x = index * step; const y = 40 - (value / maxValue) * 30; return `${x.toFixed(2)},${y.toFixed(2)}`; }) .join(" "); };

  📝 color.ts
     Pfad: 📁 lib / 📝 color.ts
     Größe: 2.15 KB (2197 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 66, Wörter: 293, Zeichen: 2197
     Inhalt (Auszug): export const DEFAULT_ACCENT = "#E07A5F";

  📝 errors.ts
     Pfad: 📁 lib / 📝 errors.ts
     Größe: 211 B (211 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 9, Wörter: 22, Zeichen: 211
     Inhalt (Auszug): export const asErrorMessage = (error: unknown, fallback: string) => { if (error instanceof Error) { return error.message; } if (typeof error === "string") { return error; } return fallback; };

  📝 exam.test.ts
     Pfad: 📁 lib / 📝 exam.test.ts
     Größe: 653 B (653 B)
     Geändert: 2026-01-07T15:55:37
     Titel: `;
     Überschriften: 1, Zeilen: 20, Wörter: 82, Zeichen: 653
     Inhalt (Auszug): import { describe, expect, it } from "vitest"; import { parseExamTasks } from "./exam";

  📝 exam.ts
     Pfad: 📁 lib / 📝 exam.ts
     Größe: 5.34 KB (5464 B)
     Geändert: 2026-01-07T15:24:25
     Überschriften: 0, Zeilen: 245, Wörter: 508, Zeichen: 5464
     Inhalt (Auszug): import { parseFlashcards, splitAnswerCard, type CompositeFlashcard, type Flashcard, } from "./flashcards";

  📝 flashcardKeywords.ts
     Pfad: 📁 lib / 📝 flashcardKeywords.ts
     Größe: 850 B (850 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 66, Wörter: 67, Zeichen: 790
     Inhalt (Auszug): export const answerMarkers = [ "Answer:", "Antwort:", "Réponse:", "Respuesta:", "Resposta:", "Risposta:", "Antwoord:", "Svar:", "Vastaus:", "Odpowiedź:", "Odpověď:", "Odpoveď:", "Válasz:", "Răspuns:", "Cevap:", "Ответ:", "Απάντηση:", "إجابة:", ];

  📝 flashcards.test.ts
     Pfad: 📁 lib / 📝 flashcards.test.ts
     Größe: 21.66 KB (22184 B)
     Geändert: 2026-01-07T15:53:20
     Titel: `;
     Überschriften: 40, Zeilen: 822, Wörter: 2528, Zeichen: 22184
     Inhalt (Auszug): import { describe, expect, it } from "vitest"; import { isDragAnswerMatch, isInputAnswerMatch, parseFlashcards, splitAnswerCard, type Flashcard, } from "./flashcards";

  📝 flashcards.ts
     Pfad: 📁 lib / 📝 flashcards.ts
     Größe: 18.79 KB (19242 B)
     Geändert: 2026-01-07T15:58:58
     Überschriften: 0, Zeilen: 796, Wörter: 1739, Zeichen: 19242
     Inhalt (Auszug): import { answerMarkers, falseTokens, trueTokens } from "./flashcardKeywords";

  📝 path.ts
     Pfad: 📁 lib / 📝 path.ts
     Größe: 339 B (339 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 11, Wörter: 33, Zeichen: 339
     Inhalt (Auszug): export const normalizeRelativePath = (value: string) => value.replace(/\\/g, "/").replace(/^\/+/, "");

  📝 theme.ts
     Pfad: 📁 lib / 📝 theme.ts
     Größe: 920 B (920 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 22, Wörter: 95, Zeichen: 920
     Inhalt (Auszug): import { buildAccentTokens } from "./color";

  📝 tree.ts
     Pfad: 📁 lib / 📝 tree.ts
     Größe: 2.08 KB (2129 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 88, Wörter: 200, Zeichen: 2129
     Inhalt (Auszug): import { normalizeRelativePath } from "./path";

  📝 types.ts
     Pfad: 📁 lib / 📝 types.ts
     Größe: 54 B (54 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1, Wörter: 6, Zeichen: 54
     Inhalt (Auszug): export type LoadState = "idle" | "loading" | "error";


📁 pages
  📝 DashboardPage.tsx
     Pfad: 📁 pages / 📝 DashboardPage.tsx
     Größe: 4.98 KB (5101 B)
     Geändert: 2026-01-07T09:44:07
     Überschriften: 0, Zeilen: 157, Wörter: 394, Zeichen: 5101
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { FileList } from "../components/FileList"; import { PreviewPanel } from "../components/PreviewPanel"; import { useAppState } from "../components/AppStateProvider"; import { asErrorMessage } from "../lib/errors"; import { normalizeRelativePath } from "../lib/path";

  📝 ExamSimulationPage.tsx
     Pfad: 📁 pages / 📝 ExamSimulationPage.tsx
     Größe: 75 B (75 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1, Wörter: 6, Zeichen: 75
     Inhalt (Auszug): export { ExamSimulationPage } from "./exam-simulation/ExamSimulationPage";

  📝 FastFlashcardPage.tsx
     Pfad: 📁 pages / 📝 FastFlashcardPage.tsx
     Größe: 72 B (72 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1, Wörter: 6, Zeichen: 72
     Inhalt (Auszug): export { FastFlashcardPage } from "./fast-flashcard/FastFlashcardPage";

  📝 FlashcardPage.tsx
     Pfad: 📁 pages / 📝 FlashcardPage.tsx
     Größe: 21.52 KB (22033 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 625, Wörter: 1418, Zeichen: 22033
     Inhalt (Auszug): import { useCallback, useEffect, useState, type DragEvent } from "react"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { CompositeCard } from "../components/flashcards/CompositeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { StatsPanel } from "../components/StatsPanel"; import { useAppState } from "../components/AppStateProvider"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, isFlashcardPartComplete, } from "../features/flashcards/logic"; import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

  📝 HelpPage.tsx
     Pfad: 📁 pages / 📝 HelpPage.tsx
     Größe: 6.26 KB (6409 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 181, Wörter: 438, Zeichen: 6409
     Inhalt (Auszug): import { useEffect, useRef, useState } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppLanguage, flashcardSyntaxEntries, flashcardSyntaxOverview, helpHeader, helpLabels, helpTopics, resolveList, resolveText, } from "./help/helpContent"; import { HelpDetailSection } from "./help/sections/HelpDetailSection"; import { HelpHeaderSection } from "./help/sections/HelpHeaderSection"; import { HelpOverviewSection } from "./help/sections/HelpOverviewSection"; import { HelpTopicHeadingsBlock } from "./help/sections/HelpTopicHeadingsBlock";

  📝 SettingsPage.tsx
     Pfad: 📁 pages / 📝 SettingsPage.tsx
     Größe: 12.67 KB (12978 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 302, Wörter: 822, Zeichen: 12978
     Inhalt (Auszug): import { useCallback, useMemo, useState } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppearanceSection } from "../components/settings/AppearanceSection"; import { ExamSettingsSection } from "../components/settings/ExamSettingsSection"; import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection"; import { ResetSessionHistoryModal } from "../components/settings/ResetSessionHistoryModal"; import { LanguageTabContent } from "../components/settings/DataSyncTabContent"; import { PerformanceTabContent } from "../components/settings/PerformanceTabContent"; import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection"; import { VaultIndexSection } from "../components/settings/VaultI …

  📝 SpacedRepetitionPage.tsx
     Pfad: 📁 pages / 📝 SpacedRepetitionPage.tsx
     Größe: 81 B (81 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 1, Wörter: 6, Zeichen: 81
     Inhalt (Auszug): export { SpacedRepetitionPage } from "./spaced-repetition/SpacedRepetitionPage";


📁 pages/exam-simulation
  📝 ExamSimulationPage.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📝 ExamSimulationPage.tsx
     Größe: 5.40 KB (5531 B)
     Geändert: 2026-01-07T15:03:18
     Überschriften: 0, Zeilen: 157, Wörter: 307, Zeichen: 5531
     Inhalt (Auszug): import { ExamFilePanel } from "./components/ExamFilePanel"; import { ExamIdlePanel } from "./components/ExamIdlePanel"; import { ExamResultsPanel } from "./components/ExamResultsPanel"; import { ExamTaskRunner } from "./components/ExamTaskRunner"; import { ExamToolsPanel } from "./components/ExamToolsPanel"; import { useExamSimulationViewModel } from "./hooks/useExamSimulationViewModel";


📁 pages/exam-simulation/components
  📝 ExamFilePanel.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamFilePanel.tsx
     Größe: 1.97 KB (2017 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 66, Wörter: 178, Zeichen: 2017
     Inhalt (Auszug): import type { LoadState } from "../../../lib/types"; import type { VaultFile } from "../../../lib/tree";

  📝 ExamIdlePanel.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamIdlePanel.tsx
     Größe: 1.61 KB (1653 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 69, Wörter: 149, Zeichen: 1653
     Inhalt (Auszug): import type { LoadState } from "../../../lib/types"; import type { VaultFile } from "../../../lib/tree";

  📝 ExamMarkdown.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamMarkdown.tsx
     Größe: 1.00 KB (1028 B)
     Geändert: 2026-01-07T12:15:42
     Überschriften: 0, Zeilen: 43, Wörter: 80, Zeichen: 1028
     Inhalt (Auszug): import ReactMarkdown from "react-markdown"; import rehypeSanitize, { defaultSchema } from "rehype-sanitize"; import remarkGfm from "remark-gfm";

  📝 ExamResultsPanel.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamResultsPanel.tsx
     Größe: 1.66 KB (1699 B)
     Geändert: 2026-01-07T13:55:15
     Überschriften: 0, Zeilen: 60, Wörter: 147, Zeichen: 1699
     Inhalt (Auszug): type ExamTaskBreakdown = { index: number; awardedPoints: number; maxPoints: number; isCorrect: boolean | null; };

  📝 ExamTaskRunner.test.ts
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamTaskRunner.test.ts
     Größe: 3.43 KB (3512 B)
     Geändert: 2026-01-07T15:55:57
     Überschriften: 0, Zeilen: 123, Wörter: 279, Zeichen: 3512
     Inhalt (Auszug): import { createElement, type ComponentProps } from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { describe, expect, it } from "vitest"; import type { ExamTask } from "../../../lib/exam"; import { ExamTaskRunner } from "./ExamTaskRunner";

  📝 ExamTaskRunner.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamTaskRunner.tsx
     Größe: 8.50 KB (8705 B)
     Geändert: 2026-01-07T15:03:52
     Überschriften: 0, Zeilen: 271, Wörter: 671, Zeichen: 8705
     Inhalt (Auszug): import { type DragEvent } from "react"; import { CompositeCard } from "../../../components/flashcards/CompositeCard"; import { evaluateFlashcardPartResult, type CompositePartState, type TrueFalseSelection } from "../../../features/flashcards/logic"; import type { ExamTask } from "../../../lib/exam"; import type { FlashcardPart } from "../../../lib/flashcards";

  📝 ExamToolsPanel.tsx
     Pfad: 📁 pages / 📁 exam-simulation / 📁 components / 📝 ExamToolsPanel.tsx
     Größe: 3.12 KB (3196 B)
     Geändert: 2026-01-07T13:55:33
     Überschriften: 0, Zeilen: 106, Wörter: 234, Zeichen: 3196
     Inhalt (Auszug): type ExamStage = "idle" | "running" | "review" | "scoring" | "finished";


📁 pages/exam-simulation/hooks
  📝 useExamSimulationViewModel.ts
     Pfad: 📁 pages / 📁 exam-simulation / 📁 hooks / 📝 useExamSimulationViewModel.ts
     Größe: 18.67 KB (19115 B)
     Geändert: 2026-01-07T15:03:10
     Überschriften: 0, Zeilen: 666, Wörter: 1451, Zeichen: 19115
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react"; import { invoke } from "@tauri-apps/api/core"; import { useAppState } from "../../../components/AppStateProvider"; import { evaluateFlashcardPartResult, getClozeDragPayload, handleClozeBlankDragOver, handleClozeTokenDragStart, type CompositePartState, type TrueFalseSelection, } from "../../../features/flashcards/logic"; import { type ExamAiEvaluation } from "../../../features/settings/useAppSettings"; import { asErrorMessage } from "../../../lib/errors"; import { parseExamTasks, type ExamTask } from "../../../lib/exam"; import { type FlashcardPart } from "../../../lib/flashcards"; import { type LoadState } from "../../../lib/types"; import { type VaultFile } from "../../../lib/tree";


📁 pages/fast-flashcard
  📝 FastFlashcardPage.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📝 FastFlashcardPage.tsx
     Größe: 4.34 KB (4440 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 130, Wörter: 212, Zeichen: 4440
     Inhalt (Auszug): import { FastCardHost } from "./components/FastCardHost"; import { FastHeader } from "./components/FastHeader"; import { FastHistoryPanel } from "./components/FastHistoryPanel"; import { FastStatsPanel } from "./components/FastStatsPanel"; import { FastToolsPanel } from "./components/FastToolsPanel"; import { useFastSession } from "./hooks/useFastSession";


📁 pages/fast-flashcard/components
  📝 FastCardHost.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 components / 📝 FastCardHost.tsx
     Größe: 8.39 KB (8590 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 238, Wörter: 563, Zeichen: 8590
     Inhalt (Auszug): import type { DragEvent } from "react"; import { ClozeCard } from "../../../components/flashcards/ClozeCard"; import { CompositeCard } from "../../../components/flashcards/CompositeCard"; import { FreeTextCard } from "../../../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard";

  📝 FastHeader.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 components / 📝 FastHeader.tsx
     Größe: 391 B (391 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 16, Wörter: 31, Zeichen: 391
     Inhalt (Auszug): import { fastFlashcardStatusLabel } from "../hooks/useFastSession";

  📝 FastHistoryPanel.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 components / 📝 FastHistoryPanel.tsx
     Größe: 3.16 KB (3240 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 80, Wörter: 281, Zeichen: 3240
     Inhalt (Auszug): import type { FastFlashcardSessionSummary } from "../hooks/useFastSession"; import { formatSessionPace, formatSessionTimestamp } from "../hooks/useFastSession";

  📝 FastStatsPanel.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 components / 📝 FastStatsPanel.tsx
     Größe: 5.51 KB (5641 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 165, Wörter: 503, Zeichen: 5639
     Inhalt (Auszug): import type { CSSProperties } from "react"; import type { FastFlashcardSessionStats } from "../hooks/useFastSession";

  📝 FastToolsPanel.tsx
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 components / 📝 FastToolsPanel.tsx
     Größe: 2.58 KB (2645 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 77, Wörter: 179, Zeichen: 2645
     Inhalt (Auszug): import { FastFlashcardToolsSettings } from "../../../components/settings/FastFlashcardToolsSettings"; import { FAST_FLASHCARD_DURATIONS } from "../../../features/fast-flashcard/constants";


📁 pages/fast-flashcard/hooks
  📝 useFastSession.ts
     Pfad: 📁 pages / 📁 fast-flashcard / 📁 hooks / 📝 useFastSession.ts
     Größe: 22.54 KB (23086 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 822, Wörter: 1628, Zeichen: 23086
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, } from "react"; import { invoke } from "@tauri-apps/api/core"; import { useAppState } from "../../../components/AppStateProvider"; import { evaluateFlashcardResult } from "../../../features/flashcards/logic";


📁 pages/help
  📝 helpContent.ts
     Pfad: 📁 pages / 📁 help / 📝 helpContent.ts
     Größe: 257 B (257 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 7, Wörter: 30, Zeichen: 257
     Inhalt (Auszug): export * from "./content/types"; export * from "./content/i18n"; export * from "./content/labels"; export * from "./content/topics"; export * from "./content/appSections"; export * from "./content/syntax/overview"; export * from "./content/syntax/entries";


📁 pages/help/content
  📝 appSections.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📝 appSections.ts
     Größe: 12.20 KB (12490 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 230, Wörter: 1561, Zeichen: 12425
     Inhalt (Auszug): import { AppSectionData, AppSectionId, LocalizedText } from "./types";

  📝 i18n.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📝 i18n.ts
     Größe: 441 B (441 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 13, Wörter: 43, Zeichen: 441
     Inhalt (Auszug): import { AppLanguage, LocalizedText } from "./types";

  📝 labels.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📝 labels.ts
     Größe: 941 B (941 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 24, Wörter: 116, Zeichen: 941
     Inhalt (Auszug): export const helpHeader = { eyebrow: { en: "Help", de: "Hilfe" }, title: { en: "Help", de: "Hilfe" }, summary: { en: "Quick reminders for the workflow and syntax.", de: "Kurze Hinweise zum Workflow und zur Syntax.", }, };

  📝 topics.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📝 topics.ts
     Größe: 7.92 KB (8111 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 205, Wörter: 885, Zeichen: 8111
     Inhalt (Auszug): import { HelpTopic } from "./types";

  📝 types.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📝 types.ts
     Größe: 1.29 KB (1318 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 66, Wörter: 120, Zeichen: 1318
     Inhalt (Auszug): export type AppLanguage = "de" | "en"; export type LocalizedText = { de?: string; en?: string };


📁 pages/help/content/syntax
  📝 entries.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📁 syntax / 📝 entries.ts
     Größe: 26.59 KB (27233 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 719, Wörter: 2800, Zeichen: 27233
     Inhalt (Auszug): import { SyntaxEntry } from "../types";

  📝 overview.ts
     Pfad: 📁 pages / 📁 help / 📁 content / 📁 syntax / 📝 overview.ts
     Größe: 683 B (683 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 17, Wörter: 89, Zeichen: 683
     Inhalt (Auszug): export const flashcardSyntaxOverview = { title: { en: "Core rules", de: "Grundregeln" }, bullets: [ { en: "Wrap every card with #card and # on their own lines; content outside is ignored.", de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.", }, { en: "The first non-empty line is the prompt.", de: "Die erste nicht-leere Zeile ist die Frage.", }, { en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.", de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.", }, ], };


📁 pages/help/sections
  📝 AppSectionsGuidePanel.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 AppSectionsGuidePanel.tsx
     Größe: 6.28 KB (6433 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 174, Wörter: 462, Zeichen: 6433
     Inhalt (Auszug): import { useEffect, useState } from "react"; import { APP_SECTION_DATA, APP_SECTION_GROUND_RULES, APP_SECTION_LABELS, APP_SECTION_ORDER, AppLanguage, AppSectionId, resolveText, } from "../helpContent";

  📝 HelpDetailSection.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 HelpDetailSection.tsx
     Größe: 3.65 KB (3735 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 120, Wörter: 250, Zeichen: 3735
     Inhalt (Auszug): import { AppLanguage, HelpTopic, SyntaxEntry, helpLabels, resolveText } from "../helpContent"; import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel"; import { HelpTopicSections } from "./HelpTopicSections"; import { SyntaxSection } from "./SyntaxSection";

  📝 HelpHeaderSection.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 HelpHeaderSection.tsx
     Größe: 407 B (407 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 19, Wörter: 35, Zeichen: 407
     Inhalt (Auszug): type HelpHeaderSectionProps = { eyebrowText: string; titleText: string; summaryText: string; };

  📝 HelpOverviewSection.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 HelpOverviewSection.tsx
     Größe: 1.26 KB (1295 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 42, Wörter: 114, Zeichen: 1295
     Inhalt (Auszug): import { AppLanguage, HelpTopic, helpLabels, resolveText } from "../helpContent";

  📝 HelpTopicHeadingsBlock.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 HelpTopicHeadingsBlock.tsx
     Größe: 779 B (779 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 29, Wörter: 63, Zeichen: 779
     Inhalt (Auszug): import { AppLanguage, HelpTopic, resolveText } from "../helpContent";

  📝 HelpTopicSections.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 HelpTopicSections.tsx
     Größe: 2.93 KB (3002 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 89, Wörter: 217, Zeichen: 3002
     Inhalt (Auszug): import { AppLanguage, HelpTopic, resolveList, resolveText, } from "../helpContent";

  📝 SyntaxSection.tsx
     Pfad: 📁 pages / 📁 help / 📁 sections / 📝 SyntaxSection.tsx
     Größe: 7.55 KB (7732 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 219, Wörter: 549, Zeichen: 7732
     Inhalt (Auszug): import { AppLanguage, SyntaxEntry, flashcardSyntaxEntries, flashcardSyntaxOverview, resolveText, } from "../helpContent";


📁 pages/spaced-repetition
  📝 SpacedRepetitionPage.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📝 SpacedRepetitionPage.tsx
     Größe: 6.96 KB (7127 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 183, Wörter: 295, Zeichen: 7127
     Inhalt (Auszug): import { SrCardHost } from "./components/SrCardHost"; import { SrDeleteModal } from "./components/SrDeleteModal"; import { SrHeader } from "./components/SrHeader"; import { SrStatsAndChart } from "./components/SrStatsAndChart"; import { SrStatsPanel } from "./components/SrStatsPanel"; import { SrToolsPanel } from "./components/SrToolsPanel"; import { SrUserPanel } from "./components/SrUserPanel"; import { useSrSessionViewModel } from "./hooks/useSrSessionViewModel";


📁 pages/spaced-repetition/components
  📝 SrBoxesPanel.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrBoxesPanel.tsx
     Größe: 1.48 KB (1515 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 48, Wörter: 134, Zeichen: 1515
     Inhalt (Auszug): import type { CSSProperties } from "react";

  📝 SrCardHost.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrCardHost.tsx
     Größe: 8.22 KB (8416 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 228, Wörter: 476, Zeichen: 8416
     Inhalt (Auszug): import type { DragEvent } from "react"; import { ClozeCard } from "../../../components/flashcards/ClozeCard"; import { CompositeCard } from "../../../components/flashcards/CompositeCard"; import { FreeTextCard } from "../../../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../../../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../../../components/flashcards/TrueFalseCard"; import { SrReviewActions } from "./SrReviewActions";

  📝 SrDeleteModal.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrDeleteModal.tsx
     Größe: 1.79 KB (1829 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 60, Wörter: 149, Zeichen: 1829
     Inhalt (Auszug): type SrDeleteModalProps = { isDeleteDialogOpen: boolean; deleteTargetName: string; deleteConfirmInput: string; setDeleteConfirmInput: (value: string) => void; handleDeleteCancel: () => void; handleDeleteConfirm: () => void; canConfirmDelete: boolean; };

  📝 SrHeader.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrHeader.tsx
     Größe: 1.17 KB (1193 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 45, Wörter: 124, Zeichen: 1193
     Inhalt (Auszug): import type { Dispatch, SetStateAction } from "react";

  📝 SrReviewActions.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrReviewActions.tsx
     Größe: 813 B (813 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 32, Wörter: 47, Zeichen: 813
     Inhalt (Auszug): type SrReviewActionsProps = { spacedRepetitionCanGoBack: boolean; spacedRepetitionCanGoNext: boolean; handleSpacedRepetitionPageBack: () => void; handleSpacedRepetitionPageNext: () => void; };

  📝 SrStatsAndChart.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrStatsAndChart.tsx
     Größe: 6.36 KB (6514 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 173, Wörter: 457, Zeichen: 6514
     Inhalt (Auszug): import type { CSSProperties } from "react"; import { buildLineChartPoints } from "../../../lib/chart"; import { type SpacedRepetitionStatsView } from "../../../features/spaced-repetition/useSpacedRepetition"; import { SrBoxesPanel } from "./SrBoxesPanel";

  📝 SrStatsPanel.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrStatsPanel.tsx
     Größe: 453 B (453 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 18, Wörter: 44, Zeichen: 453
     Inhalt (Auszug): import { KpiGrid } from "../../../components/KpiGrid";

  📝 SrToolsPanel.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrToolsPanel.tsx
     Größe: 3.53 KB (3613 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 108, Wörter: 247, Zeichen: 3613
     Inhalt (Auszug): import { SPACED_REPETITION_BOXES, SPACED_REPETITION_PAGE_SIZES, type SpacedRepetitionBoxes, type SpacedRepetitionOrder, type SpacedRepetitionPageSize, } from "../../../features/spaced-repetition/useSpacedRepetition";

  📝 SrUserPanel.tsx
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 components / 📝 SrUserPanel.tsx
     Größe: 3.85 KB (3939 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 119, Wörter: 266, Zeichen: 3937
     Inhalt (Auszug): type SrUserPanelProps = { flashcards: { isFlashcardScanning: boolean; }; spacedRepetition: { spacedRepetitionActiveUser: string | null; spacedRepetitionSelectedUserId: string; spacedRepetitionUsers: { id: string; name: string }[]; spacedRepetitionNewUserName: string; spacedRepetitionUserError: string; handleSpacedRepetitionActiveUserLoadCards: () => void; setSpacedRepetitionSelectedUserId: (value: string) => void; setSpacedRepetitionNewUserName: (value: string) => void; setSpacedRepetitionUserError: (value: string) => void; handleSpacedRepetitionCreateUser: () => void; handleSpacedRepetitionLoadUser: () => void; }; handleDeleteOpen: () => void; };


📁 pages/spaced-repetition/hooks
  📝 useSrSessionViewModel.ts
     Pfad: 📁 pages / 📁 spaced-repetition / 📁 hooks / 📝 useSrSessionViewModel.ts
     Größe: 16.56 KB (16957 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 572, Wörter: 1003, Zeichen: 16955
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, } from "react"; import { useAppState } from "../../../components/AppStateProvider"; import { vaultBaseName } from "../../../lib/path"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, isFlashcardPartComplete, } from "../../../features/flashcards/logic"; import { getFlashcardId, getSpacedRepetitionEffectiveBox, normalizeSpacedRepetitionCardProgress, } from "../../../features/spaced-repetition/logic";


📁 styles
  📝 base.css
     Pfad: 📁 styles / 📝 base.css
     Größe: 302 B (302 B)
     Geändert: 2026-01-07T06:50:59
     Titel: root {
     Überschriften: 1, Zeilen: 26, Wörter: 35, Zeichen: 302
     Inhalt (Auszug): box-sizing: border-box; }

  📝 layout.css
     Pfad: 📁 styles / 📝 layout.css
     Größe: 6.38 KB (6537 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 359, Wörter: 875, Zeichen: 6533
     Inhalt (Auszug): .app-shell {

  📝 tokens.css
     Pfad: 📁 styles / 📝 tokens.css
     Größe: 8.99 KB (9206 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 258, Wörter: 1412, Zeichen: 9206
     Inhalt (Auszug): :root { font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif; font-size: 16px; line-height: 1.5; font-weight: 400; color: var(--ink); background-color: var(--bg); font-synthesis: none; text-rendering: optimizeLegibility;


📁 styles/components
  📝 buttons.css
     Pfad: 📁 styles / 📁 components / 📝 buttons.css
     Größe: 861 B (861 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 57, Wörter: 108, Zeichen: 861
     Inhalt (Auszug): button { border: none; font: inherit; }

  📝 content.css
     Pfad: 📁 styles / 📁 components / 📝 content.css
     Größe: 10.68 KB (10939 B)
     Geändert: 2026-01-07T13:55:52
     Überschriften: 0, Zeilen: 661, Wörter: 1505, Zeichen: 10939
     Inhalt (Auszug): .content { display: flex; flex-direction: column; gap: 24px; animation: riseIn 0.6s ease both; animation-delay: 0.05s; min-height: 0; overflow: auto; }

  📝 flashcards.css
     Pfad: 📁 styles / 📁 components / 📝 flashcards.css
     Größe: 6.87 KB (7035 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 430, Wörter: 907, Zeichen: 7035
     Inhalt (Auszug): .flashcard-list { display: flex; flex-direction: column; gap: 12px; }

  📝 help.css
     Pfad: 📁 styles / 📁 components / 📝 help.css
     Größe: 6.60 KB (6757 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 404, Wörter: 928, Zeichen: 6757
     Inhalt (Auszug): .help-panel .panel-body { min-height: auto; }

  📝 modals.css
     Pfad: 📁 styles / 📁 components / 📝 modals.css
     Größe: 595 B (595 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 36, Wörter: 79, Zeichen: 595
     Inhalt (Auszug): .modal-backdrop { position: fixed; inset: 0; background: rgba(10, 12, 16, 0.45); display: flex; align-items: center; justify-content: center; padding: 24px; z-index: 20; }

  📝 panel-layout.css
     Pfad: 📁 styles / 📁 components / 📝 panel-layout.css
     Größe: 1.63 KB (1666 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 107, Wörter: 224, Zeichen: 1666
     Inhalt (Auszug): .workspace .panel:nth-child(1) { animation-delay: 0.1s; }

  📝 panels.css
     Pfad: 📁 styles / 📁 components / 📝 panels.css
     Größe: 1.95 KB (1992 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 119, Wörter: 261, Zeichen: 1992
     Inhalt (Auszug): .panel { background: var(--panel); border-radius: 20px; padding: 20px; box-shadow: var(--shadow-soft); border: 1px solid var(--line-soft); display: flex; flex-direction: column; gap: 16px; animation: riseIn 0.6s ease both; }

  📝 preview.css
     Pfad: 📁 styles / 📁 components / 📝 preview.css
     Größe: 5.50 KB (5637 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 275, Wörter: 807, Zeichen: 5637
     Inhalt (Auszug): .file-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; flex: 1; min-height: 0; overflow-y: auto; }

  📝 responsive.css
     Pfad: 📁 styles / 📁 components / 📝 responsive.css
     Größe: 2.15 KB (2203 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 138, Wörter: 274, Zeichen: 2203
     Inhalt (Auszug): @media (max-width: 1200px) { .flashcard-layout { grid-template-columns: 1fr; }

  📝 settings.css
     Pfad: 📁 styles / 📁 components / 📝 settings.css
     Größe: 7.47 KB (7653 B)
     Geändert: 2026-01-07T09:18:59
     Überschriften: 0, Zeilen: 474, Wörter: 1024, Zeichen: 7653
     Inhalt (Auszug): .settings-nav .nav-item { width: 100%; }

  📝 spaced-repetition.css
     Pfad: 📁 styles / 📁 components / 📝 spaced-repetition.css
     Größe: 1.43 KB (1463 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 74, Wörter: 207, Zeichen: 1463
     Inhalt (Auszug): .sr-vault-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  📝 stats.css
     Pfad: 📁 styles / 📁 components / 📝 stats.css
     Größe: 6.44 KB (6592 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 397, Wörter: 894, Zeichen: 6592
     Inhalt (Auszug): .stats-panel .panel-body { min-height: auto; }

  📝 utility.css
     Pfad: 📁 styles / 📁 components / 📝 utility.css
     Größe: 440 B (440 B)
     Geändert: 2026-01-07T06:50:59
     Überschriften: 0, Zeilen: 24, Wörter: 59, Zeichen: 440
     Inhalt (Auszug): .empty-state { padding: 18px; border-radius: 16px; border: 1px dashed var(--block-border); color: var(--muted); background: var(--block-bg); }


=== Ordnerbaum (Quelle, nur ausgewählte Typen) ===

📁 .
├── 📁 .summary
│   └── 📝 index.json
├── 📁 assets
├── 📁 components
│   ├── 📁 flashcards
│   │   ├── 📝 ClozeCard.tsx
│   │   ├── 📝 CompositeCard.tsx
│   │   ├── 📝 FreeTextCard.tsx
│   │   ├── 📝 MultipleChoiceCard.tsx
│   │   └── 📝 TrueFalseCard.tsx
│   ├── 📁 settings
│   │   ├── 📝 AppearanceSection.tsx
│   │   ├── 📝 DataSyncTabContent.tsx
│   │   ├── 📝 ExamSettingsSection.tsx
│   │   ├── 📝 FastFlashcardToolsSettings.tsx
│   │   ├── 📝 FlashcardsSettingsSection.tsx
│   │   ├── 📝 PerformanceTabContent.tsx
│   │   ├── 📝 ResetSessionHistoryModal.tsx
│   │   ├── 📝 SpacedRepetitionSettingsSection.tsx
│   │   └── 📝 VaultIndexSection.tsx
│   ├── 📝 AppErrorBoundary.tsx
│   ├── 📝 AppStateProvider.tsx
│   ├── 📝 FileList.tsx
│   ├── 📝 icons.tsx
│   ├── 📝 KpiGrid.tsx
│   ├── 📝 LargeVaultWarningModal.tsx
│   ├── 📝 PreviewPanel.tsx
│   ├── 📝 SidebarNav.tsx
│   ├── 📝 StatsPanel.tsx
│   ├── 📝 VaultCreateModal.tsx
│   └── 📝 VaultTree.tsx
├── 📁 features
│   ├── 📁 fast-flashcard
│   │   └── 📝 constants.ts
│   ├── 📁 flashcards
│   │   ├── 📝 logic.test.ts
│   │   ├── 📝 logic.ts
│   │   └── 📝 useFlashcards.ts
│   ├── 📁 preview
│   │   └── 📝 usePreview.ts
│   ├── 📁 settings
│   │   ├── 📝 settingsNavigation.ts
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
│   ├── 📝 exam.test.ts
│   ├── 📝 exam.ts
│   ├── 📝 flashcardKeywords.ts
│   ├── 📝 flashcards.test.ts
│   ├── 📝 flashcards.ts
│   ├── 📝 path.ts
│   ├── 📝 theme.ts
│   ├── 📝 tree.ts
│   └── 📝 types.ts
├── 📁 pages
│   ├── 📁 exam-simulation
│   │   ├── 📁 components
│   │   │   ├── 📝 ExamFilePanel.tsx
│   │   │   ├── 📝 ExamIdlePanel.tsx
│   │   │   ├── 📝 ExamMarkdown.tsx
│   │   │   ├── 📝 ExamResultsPanel.tsx
│   │   │   ├── 📝 ExamTaskRunner.test.ts
│   │   │   ├── 📝 ExamTaskRunner.tsx
│   │   │   └── 📝 ExamToolsPanel.tsx
│   │   ├── 📁 hooks
│   │   │   └── 📝 useExamSimulationViewModel.ts
│   │   └── 📝 ExamSimulationPage.tsx
│   ├── 📁 fast-flashcard
│   │   ├── 📁 components
│   │   │   ├── 📝 FastCardHost.tsx
│   │   │   ├── 📝 FastHeader.tsx
│   │   │   ├── 📝 FastHistoryPanel.tsx
│   │   │   ├── 📝 FastStatsPanel.tsx
│   │   │   └── 📝 FastToolsPanel.tsx
│   │   ├── 📁 hooks
│   │   │   └── 📝 useFastSession.ts
│   │   └── 📝 FastFlashcardPage.tsx
│   ├── 📁 help
│   │   ├── 📁 content
│   │   │   ├── 📁 syntax
│   │   │   │   ├── 📝 entries.ts
│   │   │   │   └── 📝 overview.ts
│   │   │   ├── 📝 appSections.ts
│   │   │   ├── 📝 i18n.ts
│   │   │   ├── 📝 labels.ts
│   │   │   ├── 📝 topics.ts
│   │   │   └── 📝 types.ts
│   │   ├── 📁 sections
│   │   │   ├── 📝 AppSectionsGuidePanel.tsx
│   │   │   ├── 📝 HelpDetailSection.tsx
│   │   │   ├── 📝 HelpHeaderSection.tsx
│   │   │   ├── 📝 HelpOverviewSection.tsx
│   │   │   ├── 📝 HelpTopicHeadingsBlock.tsx
│   │   │   ├── 📝 HelpTopicSections.tsx
│   │   │   └── 📝 SyntaxSection.tsx
│   │   └── 📝 helpContent.ts
│   ├── 📁 spaced-repetition
│   │   ├── 📁 components
│   │   │   ├── 📝 SrBoxesPanel.tsx
│   │   │   ├── 📝 SrCardHost.tsx
│   │   │   ├── 📝 SrDeleteModal.tsx
│   │   │   ├── 📝 SrHeader.tsx
│   │   │   ├── 📝 SrReviewActions.tsx
│   │   │   ├── 📝 SrStatsAndChart.tsx
│   │   │   ├── 📝 SrStatsPanel.tsx
│   │   │   ├── 📝 SrToolsPanel.tsx
│   │   │   └── 📝 SrUserPanel.tsx
│   │   ├── 📁 hooks
│   │   │   └── 📝 useSrSessionViewModel.ts
│   │   └── 📝 SpacedRepetitionPage.tsx
│   ├── 📝 DashboardPage.tsx
│   ├── 📝 ExamSimulationPage.tsx
│   ├── 📝 FastFlashcardPage.tsx
│   ├── 📝 FlashcardPage.tsx
│   ├── 📝 HelpPage.tsx
│   ├── 📝 SettingsPage.tsx
│   └── 📝 SpacedRepetitionPage.tsx
├── 📁 styles
│   ├── 📁 components
│   │   ├── 📝 buttons.css
│   │   ├── 📝 content.css
│   │   ├── 📝 flashcards.css
│   │   ├── 📝 help.css
│   │   ├── 📝 modals.css
│   │   ├── 📝 panel-layout.css
│   │   ├── 📝 panels.css
│   │   ├── 📝 preview.css
│   │   ├── 📝 responsive.css
│   │   ├── 📝 settings.css
│   │   ├── 📝 spaced-repetition.css
│   │   ├── 📝 stats.css
│   │   └── 📝 utility.css
│   ├── 📝 base.css
│   ├── 📝 layout.css
│   └── 📝 tokens.css
├── 📝 App.css
├── 📝 App.tsx
├── 📝 main.tsx
└── 📝 vite-env.d.ts

=== Ordnerbaum (Ausgabeordner) ===

📁 .
├── 📝 allsummary.md
├── 📝 index.json
└── 📝 summary.md
