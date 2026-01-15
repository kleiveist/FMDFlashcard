/**
 * @file apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Detail Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.tsx: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpTopicSections.tsx: Seiten-Komponente.
 *
 * Exportiert:
 * - HelpDetailSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { AppLanguage, HelpTopic, SyntaxEntry, helpLabels, resolveText } from "../helpContent";
import { AppSectionsGuidePanel } from "./AppSectionsGuidePanel";
import { HelpTopicSections } from "./HelpTopicSections";
import { LoadVaultGuidePanel } from "./LoadVaultGuidePanel";
import { SyntaxSection } from "./SyntaxSection";

type HelpDetailSectionProps = {
  titleText: string;
  activeTopic: HelpTopic;
  language: AppLanguage;
  isSyntaxTopic: boolean;
  isAppSectionsTopic: boolean;
  isLoadVaultTopic: boolean;
  activeSyntax: SyntaxEntry | null;
  setActiveTopicId: (value: string | null) => void;
  setActiveSyntaxId: (value: string | null) => void;
  syntaxLanguage: AppLanguage;
  setSyntaxLanguage: (value: AppLanguage) => void;
  copyLabel: string;
  copiedLabel: string;
  copiedItemId: string | null;
  handleCopy: (text: string, copyId: string) => void;
  overviewBullets: string[];
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

export const HelpDetailSection = ({
  titleText,
  activeTopic,
  language,
  isSyntaxTopic,
  isAppSectionsTopic,
  isLoadVaultTopic,
  activeSyntax,
  setActiveTopicId,
  setActiveSyntaxId,
  syntaxLanguage,
  setSyntaxLanguage,
  copyLabel,
  copiedLabel,
  copiedItemId,
  handleCopy,
  overviewBullets,
  syntaxCopyExampleLabel,
  syntaxCopyPromptLabel,
  syntaxCopiedLabel,
  syntaxPromptLabel,
  syntaxExampleLabel,
  syntaxRulesLabel,
  syntaxWhatItIsLabel,
  syntaxMistakesLabel,
  syntaxMarkersLabel,
}: HelpDetailSectionProps) => (
  <>
    <div className="help-detail-header">
      <div className="help-breadcrumb">
        <span>{titleText}</span>
        <span className="help-crumb-sep">&gt;</span>
        <span className="help-breadcrumb-current">
          {resolveText(activeTopic.title, language)}
        </span>
        {isSyntaxTopic && activeSyntax ? (
          <>
            <span className="help-crumb-sep">&gt;</span>
            <span className="help-breadcrumb-current help-breadcrumb-leaf">
              {resolveText(activeSyntax.title, syntaxLanguage)}
            </span>
          </>
        ) : null}
        {activeTopic.draft ? (
          <span className="chip">{resolveText(helpLabels.draft, language)}</span>
        ) : null}
      </div>
      <button
        type="button"
        className="ghost small"
        onClick={() => setActiveTopicId(null)}
      >
        {resolveText(helpLabels.back, language)}
      </button>
    </div>
    <p className="muted">{resolveText(activeTopic.summary, language)}</p>
    {isSyntaxTopic ? (
      <SyntaxSection
        overviewBullets={overviewBullets}
        activeSyntax={activeSyntax}
        syntaxLanguage={syntaxLanguage}
        setActiveSyntaxId={setActiveSyntaxId}
        setSyntaxLanguage={setSyntaxLanguage}
        handleCopy={handleCopy}
        copiedItemId={copiedItemId}
        syntaxCopyExampleLabel={syntaxCopyExampleLabel}
        syntaxCopyPromptLabel={syntaxCopyPromptLabel}
        syntaxCopiedLabel={syntaxCopiedLabel}
        syntaxPromptLabel={syntaxPromptLabel}
        syntaxExampleLabel={syntaxExampleLabel}
        syntaxRulesLabel={syntaxRulesLabel}
        syntaxWhatItIsLabel={syntaxWhatItIsLabel}
        syntaxMistakesLabel={syntaxMistakesLabel}
        syntaxMarkersLabel={syntaxMarkersLabel}
      />
    ) : isAppSectionsTopic ? (
      <AppSectionsGuidePanel language={language} />
    ) : isLoadVaultTopic ? (
      <LoadVaultGuidePanel language={language} />
    ) : (
      <HelpTopicSections
        activeTopic={activeTopic}
        language={language}
        copiedItemId={copiedItemId}
        copyLabel={copyLabel}
        copiedLabel={copiedLabel}
        handleCopy={handleCopy}
      />
    )}
  </>
);
