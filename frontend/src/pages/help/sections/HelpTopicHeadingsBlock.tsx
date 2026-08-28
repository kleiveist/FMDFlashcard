/**
 * @file frontend/src/pages/help/sections/HelpTopicHeadingsBlock.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Topic Headings Block.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - frontend/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - frontend/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpTopicHeadingsBlock: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, resolveText } from "../helpContent";

type HelpTopicHeadingsBlockProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  activeTopicId: string;
  setActiveTopicId: (value: string) => void;
};

export const HelpTopicHeadingsBlock = ({
  helpTopics,
  language,
  activeTopicId,
  setActiveTopicId,
}: HelpTopicHeadingsBlockProps) => (
  <div className="pill-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className={`pill pill-button${activeTopicId === topic.id ? " active" : ""}`}
        aria-pressed={activeTopicId === topic.id}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {resolveText(topic.title, language)}
      </button>
    ))}
  </div>
);
