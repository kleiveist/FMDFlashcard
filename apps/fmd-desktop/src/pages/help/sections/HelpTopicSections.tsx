/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpTopicSections.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Topic Sections.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpTopicSections: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, resolveList, resolveText } from "../helpContent";

type HelpTopicSectionsProps = {
  activeTopic: HelpTopic;
  language: AppLanguage;
  copiedItemId: string | null;
  copyLabel: string;
  copiedLabel: string;
  handleCopy: (text: string, copyId: string) => void;
};

export const HelpTopicSections = ({
  activeTopic,
  language,
  copiedItemId,
  copyLabel,
  copiedLabel,
  handleCopy,
}: HelpTopicSectionsProps) => (
  <div className="help-detail-sections">
    {activeTopic.sections.map((section) => {
      const bullets = resolveList(section.bullets, language);
      const examples = section.examples ?? [];
      const sectionLabelClass = section.tone === "help-block" ? "help-block-title" : "label";
      const sectionClassName =
        section.tone === "help-block" ? "help-detail-section help-block" : "help-detail-section";
      return (
        <div key={section.id} className={sectionClassName}>
          <div className="help-item-header">
            <span className={sectionLabelClass}>{resolveText(section.title, language)}</span>
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
                const exampleTitle = resolveText(example.title, language);
                const exampleDescription = resolveText(example.description, language);
                const copyId = `example-${example.id}`;
                const isCopied = copiedItemId === copyId;
                return (
                  <div key={example.id} className="help-example">
                    <div className="help-example-header">
                      <div className="help-example-text">
                        <div className="help-example-title">{exampleTitle}</div>
                        {exampleDescription ? (
                          <p className="help-example-description">{exampleDescription}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="ghost small help-copy"
                        onClick={() => handleCopy(example.code, copyId)}
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
);
