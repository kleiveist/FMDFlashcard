/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpOverviewSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Overview Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpOverviewSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, helpLabels, resolveText } from "../helpContent";

type HelpOverviewSectionProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  setActiveTopicId: (value: string | null) => void;
};

export const HelpOverviewSection = ({
  helpTopics,
  language,
  setActiveTopicId,
}: HelpOverviewSectionProps) => (
  <div className="help-overview-grid">
    {helpTopics.map((topic) => (
      <button
        key={topic.id}
        type="button"
        className="help-topic-card"
        aria-label={`${resolveText(helpLabels.openTopic, language)}: ${resolveText(
          topic.title,
          language,
        )}`}
        onClick={() => setActiveTopicId(topic.id)}
      >
        {topic.icon ? <span className="help-topic-icon">{topic.icon}</span> : null}
        <div className="help-topic-content">
          <div className="help-topic-title">{resolveText(topic.title, language)}</div>
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
    ))}
  </div>
);
