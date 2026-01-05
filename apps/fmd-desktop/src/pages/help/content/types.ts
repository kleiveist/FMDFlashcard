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

export type AppSectionId =
  | "dashboard"
  | "flashcard"
  | "fast-flashcard"
  | "spaced-repetition";

export type AppSectionDetail = {
  whatIs: LocalizedText;
  purpose: LocalizedText[];
  whatYouSee: LocalizedText;
  workflow: LocalizedText;
  showCards: LocalizedText;
  tips?: LocalizedText;
};

export type AppSectionData = {
  title: LocalizedText;
  summary: LocalizedText;
  action: LocalizedText;
  detail: AppSectionDetail;
};
