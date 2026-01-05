Markdown-Scan – Root: /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop/src/pages
Erzeugt: 2026-01-05T10:36:37
Einstellungen: content=snippet, snippet_chars=800, toc_depth=3, types=.tsx, .css, .ts, .shipping

=== Dateien ===

📁 .
  📝 DashboardPage.tsx
     Pfad: 📝 DashboardPage.tsx
     Größe: 3.68 KB (3773 B)
     Geändert: 2026-01-05T06:50:48
     Überschriften: 0, Zeilen: 127, Wörter: 304, Zeichen: 3773
     Inhalt (Auszug): import { useEffect, useMemo, useState } from "react"; import { invoke } from "@tauri-apps/api/core"; import { FileList } from "../components/FileList"; import { PreviewPanel } from "../components/PreviewPanel"; import { VaultTree } from "../components/VaultTree"; import { useAppState } from "../components/AppStateProvider"; import { asErrorMessage } from "../lib/errors";

  📝 FastFlashcardPage.tsx
     Pfad: 📝 FastFlashcardPage.tsx
     Größe: 37.55 KB (38448 B)
     Geändert: 2026-01-05T08:46:11
     Überschriften: 0, Zeilen: 1141, Wörter: 2772, Zeichen: 38442
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, } from "react"; import { invoke } from "@tauri-apps/api/core"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { CompositeCard } from "../components/flashcards/CompositeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings"; import { useAppState } from "../components/AppStateProvider"; import { evaluateFlashcardResult } from "../features/flashcards/logic"; import { vaultBaseName } from "../lib/path";

  📝 FlashcardPage.tsx
     Pfad: 📝 FlashcardPage.tsx
     Größe: 21.52 KB (22033 B)
     Geändert: 2026-01-05T06:50:48
     Überschriften: 0, Zeilen: 625, Wörter: 1418, Zeichen: 22033
     Inhalt (Auszug): import { useCallback, useEffect, useState, type DragEvent } from "react"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { CompositeCard } from "../components/flashcards/CompositeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { StatsPanel } from "../components/StatsPanel"; import { useAppState } from "../components/AppStateProvider"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, isFlashcardPartComplete, } from "../features/flashcards/logic"; import { FLASHCARD_PAGE_SIZES } from "../features/flashcards/useFlashcards";

  📝 HelpPage.tsx
     Pfad: 📝 HelpPage.tsx
     Größe: 5.89 KB (6032 B)
     Geändert: 2026-01-05T10:20:01
     Überschriften: 0, Zeilen: 172, Wörter: 424, Zeichen: 6032
     Inhalt (Auszug): import { useEffect, useRef, useState } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppLanguage, flashcardSyntaxEntries, flashcardSyntaxOverview, helpHeader, helpLabels, helpTopics, resolveList, resolveText, } from "./help/helpContent"; import { HelpDetailSection } from "./help/sections/HelpDetailSection"; import { HelpHeaderSection } from "./help/sections/HelpHeaderSection"; import { HelpOverviewSection } from "./help/sections/HelpOverviewSection";

  📝 SettingsPage.tsx
     Pfad: 📝 SettingsPage.tsx
     Größe: 7.88 KB (8072 B)
     Geändert: 2026-01-05T08:53:36
     Überschriften: 0, Zeilen: 191, Wörter: 504, Zeichen: 8072
     Inhalt (Auszug): import { useCallback, useMemo, useState } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppearanceSection } from "../components/settings/AppearanceSection"; import { FastFlashcardToolsSettings } from "../components/settings/FastFlashcardToolsSettings"; import { FlashcardsSettingsSection } from "../components/settings/FlashcardsSettingsSection"; import { LanguageTabContent, DataSyncTabContent } from "../components/settings/DataSyncTabContent"; import { PerformanceTabContent } from "../components/settings/PerformanceTabContent"; import { SpacedRepetitionSettingsSection } from "../components/settings/SpacedRepetitionSettingsSection"; import { VaultIndexSection } from "../components/settings/VaultIndexSection"; import { FLASHCARD_PAGE_SIZES } from "../fea …

  📝 SpacedRepetitionPage.tsx
     Pfad: 📝 SpacedRepetitionPage.tsx
     Größe: 39.09 KB (40024 B)
     Geändert: 2026-01-05T09:34:42
     Überschriften: 0, Zeilen: 1131, Wörter: 2437, Zeichen: 40020
     Inhalt (Auszug): import { useCallback, useEffect, useMemo, useState, type CSSProperties, type DragEvent, } from "react"; import { buildLineChartPoints } from "../lib/chart"; import { ClozeCard } from "../components/flashcards/ClozeCard"; import { CompositeCard } from "../components/flashcards/CompositeCard"; import { FreeTextCard } from "../components/flashcards/FreeTextCard"; import { MultipleChoiceCard } from "../components/flashcards/MultipleChoiceCard"; import { TrueFalseCard } from "../components/flashcards/TrueFalseCard"; import { KpiGrid } from "../components/KpiGrid"; import { useAppState } from "../components/AppStateProvider"; import { vaultBaseName } from "../lib/path"; import { areClozeBlanksComplete, areTrueFalseItemsComplete, isFlashcardPartComplete, } from "../features/flashcards/logic"; imp …


📁 help
  📝 helpContent.ts
     Pfad: 📁 help / 📝 helpContent.ts
     Größe: 45.98 KB (47088 B)
     Geändert: 2026-01-05T10:23:07
     Überschriften: 0, Zeilen: 1273, Wörter: 4978, Zeichen: 47008
     Inhalt (Auszug): export type AppLanguage = "de" | "en"; export type LocalizedText = { de?: string; en?: string };


📁 help/sections
  📝 AppSectionsGuidePanel.tsx
     Pfad: 📁 help / 📁 sections / 📝 AppSectionsGuidePanel.tsx
     Größe: 6.28 KB (6433 B)
     Geändert: 2026-01-05T10:17:25
     Überschriften: 0, Zeilen: 174, Wörter: 462, Zeichen: 6433
     Inhalt (Auszug): import { useEffect, useState } from "react"; import { APP_SECTION_DATA, APP_SECTION_GROUND_RULES, APP_SECTION_LABELS, APP_SECTION_ORDER, AppLanguage, AppSectionId, resolveText, } from "../helpContent";

  📝 HelpDetailSection.tsx
     Pfad: 📁 help / 📁 sections / 📝 HelpDetailSection.tsx
     Größe: 3.65 KB (3735 B)
     Geändert: 2026-01-05T10:19:08
     Überschriften: 0, Zeilen: 120, Wörter: 250, Zeichen: 3735
     Inhalt (Auszug): import { AppLanguage, HelpTopic, SyntaxEntry, helpLabels, resolveText } from "../helpContent"; import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel"; import { HelpTopicSections } from "./HelpTopicSections"; import { SyntaxSection } from "./SyntaxSection";

  📝 HelpHeaderSection.tsx
     Pfad: 📁 help / 📁 sections / 📝 HelpHeaderSection.tsx
     Größe: 407 B (407 B)
     Geändert: 2026-01-05T10:17:31
     Überschriften: 0, Zeilen: 19, Wörter: 35, Zeichen: 407
     Inhalt (Auszug): type HelpHeaderSectionProps = { eyebrowText: string; titleText: string; summaryText: string; };

  📝 HelpOverviewSection.tsx
     Pfad: 📁 help / 📁 sections / 📝 HelpOverviewSection.tsx
     Größe: 1.26 KB (1295 B)
     Geändert: 2026-01-05T10:17:40
     Überschriften: 0, Zeilen: 42, Wörter: 114, Zeichen: 1295
     Inhalt (Auszug): import { AppLanguage, HelpTopic, helpLabels, resolveText } from "../helpContent";

  📝 HelpTopicSections.tsx
     Pfad: 📁 help / 📁 sections / 📝 HelpTopicSections.tsx
     Größe: 2.93 KB (3002 B)
     Geändert: 2026-01-05T10:17:54
     Überschriften: 0, Zeilen: 89, Wörter: 217, Zeichen: 3002
     Inhalt (Auszug): import { AppLanguage, HelpTopic, resolveList, resolveText, } from "../helpContent";

  📝 SyntaxSection.tsx
     Pfad: 📁 help / 📁 sections / 📝 SyntaxSection.tsx
     Größe: 7.55 KB (7732 B)
     Geändert: 2026-01-05T10:19:03
     Überschriften: 0, Zeilen: 219, Wörter: 549, Zeichen: 7732
     Inhalt (Auszug): import { AppLanguage, SyntaxEntry, flashcardSyntaxEntries, flashcardSyntaxOverview, resolveText, } from "../helpContent";


=== Ordnerbaum (Quelle, nur ausgewählte Typen) ===

📁 .
├── 📁 help
│   ├── 📁 sections
│   │   ├── 📝 AppSectionsGuidePanel.tsx
│   │   ├── 📝 HelpDetailSection.tsx
│   │   ├── 📝 HelpHeaderSection.tsx
│   │   ├── 📝 HelpOverviewSection.tsx
│   │   ├── 📝 HelpTopicSections.tsx
│   │   └── 📝 SyntaxSection.tsx
│   └── 📝 helpContent.ts
├── 📝 DashboardPage.tsx
├── 📝 FastFlashcardPage.tsx
├── 📝 FlashcardPage.tsx
├── 📝 HelpPage.tsx
├── 📝 SettingsPage.tsx
└── 📝 SpacedRepetitionPage.tsx

=== Ordnerbaum (Ausgabeordner) ===

📁 .
├── 📁 help
│   ├── 📁 sections
│   │   ├── 📝 AppSectionsGuidePanel.tsx
│   │   ├── 📝 HelpDetailSection.tsx
│   │   ├── 📝 HelpHeaderSection.tsx
│   │   ├── 📝 HelpOverviewSection.tsx
│   │   ├── 📝 HelpTopicSections.tsx
│   │   └── 📝 SyntaxSection.tsx
│   └── 📝 helpContent.ts
├── 📝 DashboardPage.tsx
├── 📝 FastFlashcardPage.tsx
├── 📝 FlashcardPage.tsx
├── 📝 HelpPage.tsx
├── 📝 index.json
├── 📝 SettingsPage.tsx
└── 📝 SpacedRepetitionPage.tsx
