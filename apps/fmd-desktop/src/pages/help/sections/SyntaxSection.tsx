import {
  AppLanguage,
  SyntaxEntry,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  resolveText,
} from "../helpContent";

type SyntaxSectionProps = {
  overviewBullets: string[];
  activeSyntax: SyntaxEntry | null;
  syntaxLanguage: AppLanguage;
  setActiveSyntaxId: (value: string | null) => void;
  setSyntaxLanguage: (value: AppLanguage) => void;
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
  overviewBullets,
  activeSyntax,
  syntaxLanguage,
  setActiveSyntaxId,
  setSyntaxLanguage,
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
}: SyntaxSectionProps) => (
  <div className="help-detail-sections">
    <div className="help-detail-section help-block">
      <div className="help-item-header">
        <span className="help-block-title">
          {resolveText(flashcardSyntaxOverview.title, syntaxLanguage)}
        </span>
      </div>
      {overviewBullets.length > 0 ? (
        <ul className="help-list">
          {overviewBullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
    <div className="help-syntax-layout">
      <div className="help-syntax-cards" role="tablist">
        {flashcardSyntaxEntries.map((entry) => {
          const isActive = entry.id === activeSyntax?.id;
          const entryTitle = resolveText(entry.title, syntaxLanguage);
          const entrySnippet = entry.snippet
            ? resolveText(entry.snippet, syntaxLanguage)
            : "";
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
              <div className="help-syntax-card-rule">
                {resolveText(entry.keyRule, syntaxLanguage)}
              </div>
              {entrySnippet ? (
                <pre className="help-syntax-snippet">{entrySnippet}</pre>
              ) : null}
            </button>
          );
        })}
      </div>
      {activeSyntax ? (
        <div className="help-syntax-detail">
          <div className="help-syntax-detail-header">
            <div className="help-syntax-detail-title">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </div>
            <div className="help-syntax-lang-tabs">
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "en" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("en")}
              >
                EN
              </button>
              <button
                type="button"
                className={`help-syntax-lang${
                  syntaxLanguage === "de" ? " active" : ""
                }`}
                onClick={() => setSyntaxLanguage("de")}
              >
                DE
              </button>
            </div>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxWhatItIsLabel}</span>
            </div>
            <p className="help-syntax-text">
              {activeSyntax.detail[syntaxLanguage].whatItIs}
            </p>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxRulesLabel}</span>
            </div>
            {activeSyntax.detail[syntaxLanguage].rulesNote ? (
              <p className="help-syntax-text">
                {activeSyntax.detail[syntaxLanguage].rulesNote}
              </p>
            ) : null}
            <ul className="help-syntax-list">
              {activeSyntax.detail[syntaxLanguage].rules.map((rule) => (
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
                    activeSyntax.detail[syntaxLanguage].promptTemplate,
                    `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyPromptLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-prompt-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyPromptLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].promptTemplate}
            </pre>
          </div>
          <div className="help-syntax-section">
            <div className="help-syntax-section-header">
              <span className="label">{syntaxExampleLabel}</span>
              <button
                type="button"
                className="ghost small help-copy"
                onClick={() =>
                  handleCopy(
                    activeSyntax.detail[syntaxLanguage].example,
                    `syntax-example-${activeSyntax.id}-${syntaxLanguage}`,
                  )
                }
                aria-label={`${syntaxCopyExampleLabel}: ${resolveText(
                  activeSyntax.title,
                  syntaxLanguage,
                )}`}
              >
                {copiedItemId ===
                `syntax-example-${activeSyntax.id}-${syntaxLanguage}`
                  ? syntaxCopiedLabel
                  : syntaxCopyExampleLabel}
              </button>
            </div>
            <pre className="help-code">
              {activeSyntax.detail[syntaxLanguage].example}
            </pre>
          </div>
          {activeSyntax.detail[syntaxLanguage].mistakes?.length ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">{syntaxMistakesLabel}</span>
              </div>
              <ul className="help-syntax-list">
                {activeSyntax.detail[syntaxLanguage].mistakes?.map((mistake) => (
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
