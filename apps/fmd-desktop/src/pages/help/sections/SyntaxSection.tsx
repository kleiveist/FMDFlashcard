/**
 * @file apps/fmd-desktop/src/pages/help/sections/SyntaxSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Syntax Section.
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
 * - SyntaxSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, LocalizedText, SyntaxEntry, resolveText } from "../helpContent";

type SyntaxSectionProps = {
  language: AppLanguage;
  overviewBullets: string[];
  syntaxOverview: { title: LocalizedText; bullets?: LocalizedText[] };
  syntaxEntries: SyntaxEntry[];
  activeSyntax: SyntaxEntry | null;
  setActiveSyntaxId: (value: string) => void;
  handleCopy: (text: string, copyId: string) => void;
  copiedItemId: string | null;
  syntaxCopyExampleLabel: string;
  syntaxCopyPromptLabel: string;
  syntaxCopiedLabel: string;
  syntaxPromptLabel: string;
  syntaxExampleLabel: string;
  syntaxRulesLabel: string;
  syntaxWhatItIsLabel: string;
  syntaxMistakesLabel: string;
  syntaxMarkersLabel: string;
};

export const SyntaxSection = ({
  language,
  overviewBullets,
  syntaxOverview,
  syntaxEntries,
  activeSyntax,
  setActiveSyntaxId,
  handleCopy,
  copiedItemId,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: SyntaxSectionProps) => {
  const hasOverview =
    (syntaxOverview.bullets?.length ?? 0) > 0 &&
    (syntaxOverview.title?.[language] ?? "").trim().length > 0;

  return (
    <div className="help-detail-sections">
      {hasOverview ? (
        <div className="help-detail-section help-block">
          <div className="help-item-header">
            <span className="help-block-title">{resolveText(syntaxOverview.title, language)}</span>
          </div>
          {overviewBullets.length > 0 ? (
            <ul className="help-list">
              {overviewBullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist">
          {syntaxEntries.map((entry) => {
            const isActive = entry.id === activeSyntax?.id;
            const entryTitle = resolveText(entry.title, language);
            const entrySnippet = entry.snippet ? resolveText(entry.snippet, language) : "";
            return (
              <button
                key={entry.id}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setActiveSyntaxId(entry.id)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">{entryTitle}</div>
                <div className="help-syntax-card-meta">
                  <span className="help-syntax-card-label">{syntaxMarkersLabel}</span>
                  <div className="help-syntax-token-list">
                    {entry.markers.map((marker) => (
                      <span key={marker} className="help-syntax-token">
                        {marker}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="help-syntax-card-rule">{resolveText(entry.keyRule, language)}</div>
                {entrySnippet ? <pre className="help-syntax-snippet">{entrySnippet}</pre> : null}
              </button>
            );
          })}
        </div>
        {activeSyntax ? (
          <div className="help-syntax-detail">
            <div className="help-syntax-detail-header">
              <div className="help-syntax-detail-title">
                {resolveText(activeSyntax.title, language)}
              </div>
            </div>
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxWhatItIsLabel}</span>
              </div>
              <p className="help-syntax-text">{activeSyntax.detail[language].whatItIs}</p>
            </div>
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxRulesLabel}</span>
              </div>
              {activeSyntax.detail[language].rulesNote ? (
                <p className="help-syntax-text">{activeSyntax.detail[language].rulesNote}</p>
              ) : null}
              <ul className="help-syntax-list">
                {activeSyntax.detail[language].rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxPromptLabel}</span>
                <button
                  type="button"
                  className="ghost small help-copy"
                  onClick={() =>
                    handleCopy(
                      activeSyntax.detail[language].promptTemplate,
                      `syntax-prompt-${activeSyntax.id}-${language}`,
                    )
                  }
                  aria-label={`${syntaxCopyPromptLabel}: ${resolveText(
                    activeSyntax.title,
                    language,
                  )}`}
                >
                  {copiedItemId === `syntax-prompt-${activeSyntax.id}-${language}`
                    ? syntaxCopiedLabel
                    : syntaxCopyPromptLabel}
                </button>
              </div>
              <pre className="help-code">{activeSyntax.detail[language].promptTemplate}</pre>
            </div>
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxExampleLabel}</span>
                <button
                  type="button"
                  className="ghost small help-copy"
                  onClick={() =>
                    handleCopy(
                      activeSyntax.detail[language].example,
                      `syntax-example-${activeSyntax.id}-${language}`,
                    )
                  }
                  aria-label={`${syntaxCopyExampleLabel}: ${resolveText(
                    activeSyntax.title,
                    language,
                  )}`}
                >
                  {copiedItemId === `syntax-example-${activeSyntax.id}-${language}`
                    ? syntaxCopiedLabel
                    : syntaxCopyExampleLabel}
                </button>
              </div>
              <pre className="help-code">{activeSyntax.detail[language].example}</pre>
            </div>
            {activeSyntax.detail[language].mistakes?.length ? (
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">{syntaxMistakesLabel}</span>
                </div>
                <ul className="help-syntax-list">
                  {activeSyntax.detail[language].mistakes?.map((mistake) => (
                    <li key={mistake}>{mistake}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
