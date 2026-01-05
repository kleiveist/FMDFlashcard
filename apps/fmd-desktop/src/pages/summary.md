Markdown-Scan – Root: /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop/src/pages
Erzeugt: 2026-01-05T10:59:30
Einstellungen: content=snippet, snippet_chars=800, toc_depth=3, types=.tsx, .css, .ts, .shipping

=== Dateien ===

📁 .
  📝 HelpPage.tsx
     Pfad: 📝 HelpPage.tsx
     Größe: 5.89 KB (6032 B)
     Geändert: 2026-01-05T10:20:01
     Überschriften: 0, Zeilen: 172, Wörter: 424, Zeichen: 6032
     Inhalt (Auszug): import { useEffect, useRef, useState } from "react"; import { useAppState } from "../components/AppStateProvider"; import { AppLanguage, flashcardSyntaxEntries, flashcardSyntaxOverview, helpHeader, helpLabels, helpTopics, resolveList, resolveText, } from "./help/helpContent"; import { HelpDetailSection } from "./help/sections/HelpDetailSection"; import { HelpHeaderSection } from "./help/sections/HelpHeaderSection"; import { HelpOverviewSection } from "./help/sections/HelpOverviewSection";

📁 help
  📝 helpContent.ts
     Pfad: 📁 help / 📝 helpContent.ts
     Größe: 257 B (257 B)
     Geändert: 2026-01-05T10:48:11
     Überschriften: 0, Zeilen: 7, Wörter: 30, Zeichen: 257
     Inhalt (Auszug): export * from "./content/types"; export * from "./content/i18n"; export * from "./content/labels"; export * from "./content/topics"; export * from "./content/appSections"; export * from "./content/syntax/overview"; export * from "./content/syntax/entries";


📁 help/content
  📝 appSections.ts
     Pfad: 📁 help / 📁 content / 📝 appSections.ts
     Größe: 9.76 KB (9991 B)
     Geändert: 2026-01-05T10:48:00
     Überschriften: 0, Zeilen: 230, Wörter: 1157, Zeichen: 9911
     Inhalt (Auszug): import { AppSectionData, AppSectionId, LocalizedText } from "./types";

  📝 i18n.ts
     Pfad: 📁 help / 📁 content / 📝 i18n.ts
     Größe: 441 B (441 B)
     Geändert: 2026-01-05T10:46:30
     Überschriften: 0, Zeilen: 13, Wörter: 43, Zeichen: 441
     Inhalt (Auszug): import { AppLanguage, LocalizedText } from "./types";

  📝 labels.ts
     Pfad: 📁 help / 📁 content / 📝 labels.ts
     Größe: 941 B (941 B)
     Geändert: 2026-01-05T10:46:41
     Überschriften: 0, Zeilen: 24, Wörter: 116, Zeichen: 941
     Inhalt (Auszug): export const helpHeader = { eyebrow: { en: "Help", de: "Hilfe" }, title: { en: "Help", de: "Hilfe" }, summary: { en: "Quick reminders for the workflow and syntax.", de: "Kurze Hinweise zum Workflow und zur Syntax.", }, };

  📝 topics.ts
     Pfad: 📁 help / 📁 content / 📝 topics.ts
     Größe: 7.92 KB (8106 B)
     Geändert: 2026-01-05T10:57:51
     Überschriften: 0, Zeilen: 205, Wörter: 883, Zeichen: 8106
     Inhalt (Auszug): import { HelpTopic } from "./types";

  📝 types.ts
     Pfad: 📁 help / 📁 content / 📝 types.ts
     Größe: 1.29 KB (1318 B)
     Geändert: 2026-01-05T10:46:25
     Überschriften: 0, Zeilen: 66, Wörter: 120, Zeichen: 1318
     Inhalt (Auszug): export type AppLanguage = "de" | "en"; export type LocalizedText = { de?: string; en?: string };


📁 help/content/syntax
  📝 entries.ts
     Pfad: 📁 help / 📁 content / 📁 syntax / 📝 entries.ts
     Größe: 26.60 KB (27237 B)
     Geändert: 2026-01-05T10:47:21
     Überschriften: 0, Zeilen: 719, Wörter: 2800, Zeichen: 27237
     Inhalt (Auszug): import { SyntaxEntry } from "../types";

  📝 overview.ts
     Pfad: 📁 help / 📁 content / 📁 syntax / 📝 overview.ts
     Größe: 683 B (683 B)
     Geändert: 2026-01-05T10:46:49
     Überschriften: 0, Zeilen: 17, Wörter: 89, Zeichen: 683
     Inhalt (Auszug): export const flashcardSyntaxOverview = { title: { en: "Core rules", de: "Grundregeln" }, bullets: [ { en: "Wrap every card with #card and # on their own lines; content outside is ignored.", de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.", }, { en: "The first non-empty line is the prompt.", de: "Die erste nicht-leere Zeile ist die Frage.", }, { en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.", de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.", }, ], };


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
│   ├── 📁 content
│   │   ├── 📁 syntax
│   │   │   ├── 📝 entries.ts
│   │   │   └── 📝 overview.ts
│   │   ├── 📝 appSections.ts
│   │   ├── 📝 i18n.ts
│   │   ├── 📝 labels.ts
│   │   ├── 📝 topics.ts
│   │   └── 📝 types.ts
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
│   ├── 📁 content
│   │   ├── 📁 syntax
│   │   │   ├── 📝 entries.ts
│   │   │   └── 📝 overview.ts
│   │   ├── 📝 appSections.ts
│   │   ├── 📝 i18n.ts
│   │   ├── 📝 labels.ts
│   │   ├── 📝 topics.ts
│   │   └── 📝 types.ts
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
