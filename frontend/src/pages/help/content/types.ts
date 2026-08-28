/**
 * @file frontend/src/pages/help/content/types.ts
 *
 * Zweck:
 * - Definiert Typen und Schnittstellen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Definiert Typen fuer Datenstrukturen und APIs.
 * - Sichert konsistente Verwendung in Features und Komponenten.
 *
 * Verbunden mit:
 * - frontend/src/pages/help/content/appSections/index.ts: Nutzt dieses Modul.
 * - frontend/src/pages/help/content/i18n.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Typanpassungen koennen mehrere Module betreffen.
 */

export type AppLanguage = "de" | "en";
export type LocalizedText = { de?: string; en?: string };

export type HelpExample = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  code: string;
};

export type SyntaxDetail = {
  whatItIs: string;
  rules: string[];
  rulesNote?: string;
  promptTemplate: string;
  example: string;
  mistakes?: string[];
};

export type SyntaxEntry = {
  id: string;
  title: LocalizedText;
  markers: string[];
  keyRule: LocalizedText;
  snippet?: LocalizedText;
  detail: { en: SyntaxDetail; de: SyntaxDetail };
};

export type HelpSection = {
  id: string;
  title: LocalizedText;
  bullets?: LocalizedText[];
  examples?: HelpExample[];
  tone?: "help-block";
};

export type HelpTopic = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  sections: HelpSection[];
  draft?: boolean;
  icon?: string;
};

export type AppSectionCategoryId = "editor" | "study" | "monitoring";

export type AppSectionItemId =
  | "markdown-view-modus"
  | "markdown-code-editor"
  | "markdown-editor"
  | "markdown-hybrid-editor"
  | "exam-editor"
  | "exam"
  | "flashcard"
  | "fast-flashcard"
  | "repetition"
  | "card-monitoring"
  | "points-profiles";

export type AppSectionDetailAction = {
  id: string;
  label: LocalizedText;
  description: LocalizedText;
};

export type AppSectionDetailData = {
  whatIs: LocalizedText;
  purpose: LocalizedText[];
  whatYouSee: LocalizedText;
  keyBehavior?: LocalizedText;
  workflow: LocalizedText;
  tips?: LocalizedText;
  actions?: AppSectionDetailAction[];
};

export type AppSectionItemData = {
  title: LocalizedText;
  summary: LocalizedText;
  action: LocalizedText;
  detail: AppSectionDetailData;
};

export type AppSectionCategoryData = {
  title: LocalizedText;
  summary: LocalizedText;
  itemOrder: AppSectionItemId[];
};

export type LoadVaultTabId = "vault-and-index" | "data-and-sync";

export type LoadVaultDetailBlock = {
  id: string;
  title: LocalizedText;
  text?: LocalizedText;
  bullets?: LocalizedText[];
};

export type LoadVaultTabData = {
  title: LocalizedText;
  summary: LocalizedText;
  blocks: LoadVaultDetailBlock[];
};
