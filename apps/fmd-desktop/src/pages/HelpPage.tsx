/**
 * @file apps/fmd-desktop/src/pages/HelpPage.tsx
 *
 * Zweck:
 * - Rendert die Seite Help.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - apps/fmd-desktop/src/pages/help/sections/HelpDetailSection.tsx: Seiten-Komponente.
 *
 * Exportiert:
 * - HelpPage: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useRef, useState } from "react";
import { useAppState } from "../components/AppStateProvider";
import {
  AppLanguage,
  DEFAULT_HELP_TOPIC_ID,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  structuredSyntaxEntries,
  structuredSyntaxOverview,
  helpHeader,
  helpLabels,
  helpTopics,
  resolveList,
  resolveText,
} from "./help/helpContent";
import { HelpDetailSection } from "./help/sections/HelpDetailSection";
import { HelpTopicHeadingsBlock } from "./help/sections/HelpTopicHeadingsBlock";

type HelpPageProps = {
  onCloseHelp: () => void;
};

export const HelpPage = ({ onCloseHelp }: HelpPageProps) => {
  const { help, settings } = useAppState();
  const { activeTopicId, setActiveTopicId } = help;
  const [flashcardSyntaxId, setFlashcardSyntaxId] = useState<string | null>(
    flashcardSyntaxEntries[0]?.id ?? null,
  );
  const [structuredSyntaxId, setStructuredSyntaxId] = useState<string | null>(
    structuredSyntaxEntries[0]?.id ?? null,
  );
  const [syntaxLanguage, setSyntaxLanguage] = useState<AppLanguage>(
    settings.language,
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;

  const resolvedTopicId = helpTopics.some((topic) => topic.id === activeTopicId)
    ? activeTopicId
    : DEFAULT_HELP_TOPIC_ID;

  useEffect(() => {
    if (activeTopicId !== resolvedTopicId) {
      setActiveTopicId(resolvedTopicId);
    }
  }, [activeTopicId, resolvedTopicId, setActiveTopicId]);

  const normalizedActiveTopic =
    helpTopics.find((topic) => topic.id === resolvedTopicId) ??
    helpTopics[0] ??
    null;
  const isFlashcardSyntaxTopic =
    normalizedActiveTopic?.id === "flashcard-syntax";
  const isStructuredSyntaxTopic =
    normalizedActiveTopic?.id === "structured-syntax";
  const isSyntaxTopic = isFlashcardSyntaxTopic || isStructuredSyntaxTopic;
  const isAppSectionsTopic = normalizedActiveTopic?.id === "app-sections";
  const isLoadVaultTopic = normalizedActiveTopic?.id === "vault";
  const syntaxEntries = isStructuredSyntaxTopic
    ? structuredSyntaxEntries
    : flashcardSyntaxEntries;
  const syntaxOverview = isStructuredSyntaxTopic
    ? structuredSyntaxOverview
    : flashcardSyntaxOverview;
  const activeSyntaxId = isStructuredSyntaxTopic
    ? structuredSyntaxId
    : flashcardSyntaxId;
  const activeSyntax =
    syntaxEntries.find((entry) => entry.id === activeSyntaxId) ??
    syntaxEntries[0] ??
    null;
  const titleText = resolveText(helpHeader.title, language);

  const copyLabel = resolveText(helpLabels.copy, language);
  const copiedLabel = resolveText(helpLabels.copied, language);
  const syntaxCopyExampleLabel = resolveText(
    helpLabels.copyExample,
    syntaxLanguage,
  );
  const syntaxCopyPromptLabel = resolveText(helpLabels.copyPrompt, syntaxLanguage);
  const syntaxCopiedLabel = resolveText(helpLabels.copied, syntaxLanguage);
  const syntaxPromptLabel = resolveText(helpLabels.promptTemplate, syntaxLanguage);
  const syntaxExampleLabel = resolveText(helpLabels.example, syntaxLanguage);
  const syntaxRulesLabel = resolveText(helpLabels.rules, syntaxLanguage);
  const syntaxWhatItIsLabel = resolveText(helpLabels.whatItIs, syntaxLanguage);
  const syntaxMistakesLabel = resolveText(helpLabels.mistakes, syntaxLanguage);
  const syntaxMarkersLabel = resolveText(helpLabels.markers, syntaxLanguage);
  const syntaxOverviewBullets = resolveList(
    syntaxOverview.bullets,
    syntaxLanguage,
  );

  const handleCopy = async (text: string, copyId: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedItemId(copyId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedItemId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy example", error);
    }
  };

  useEffect(() => {
    if (normalizedActiveTopic?.id === "flashcard-syntax") {
      setFlashcardSyntaxId((prev) => {
        if (prev && flashcardSyntaxEntries.some((entry) => entry.id === prev)) {
          return prev;
        }
        return flashcardSyntaxEntries[0]?.id ?? null;
      });
      setSyntaxLanguage(settings.language);
    }
    if (normalizedActiveTopic?.id === "structured-syntax") {
      setStructuredSyntaxId((prev) => {
        if (prev && structuredSyntaxEntries.some((entry) => entry.id === prev)) {
          return prev;
        }
        return structuredSyntaxEntries[0]?.id ?? null;
      });
      setSyntaxLanguage(settings.language);
    }
  }, [normalizedActiveTopic?.id, settings.language]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <div className="help-layout">
      <div className="help-nav" role="navigation" aria-label="Help sections">
        <HelpTopicHeadingsBlock
          helpTopics={helpTopics}
          language={language}
          activeTopicId={normalizedActiveTopic?.id ?? DEFAULT_HELP_TOPIC_ID}
          setActiveTopicId={setActiveTopicId}
        />
      </div>
      <section className="panel help-panel">
        <div className="panel-body help-body">
          <HelpDetailSection
            titleText={titleText}
            activeTopic={normalizedActiveTopic ?? helpTopics[0]!}
            language={language}
            isSyntaxTopic={isSyntaxTopic}
            isAppSectionsTopic={isAppSectionsTopic}
            isLoadVaultTopic={isLoadVaultTopic}
            syntaxEntries={syntaxEntries}
            syntaxOverview={syntaxOverview}
            activeSyntax={activeSyntax}
            setActiveSyntaxId={(value) => {
              if (isStructuredSyntaxTopic) {
                setStructuredSyntaxId(value);
              } else {
                setFlashcardSyntaxId(value);
              }
            }}
            syntaxLanguage={syntaxLanguage}
            setSyntaxLanguage={setSyntaxLanguage}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
            copiedItemId={copiedItemId}
            handleCopy={handleCopy}
            overviewBullets={syntaxOverviewBullets}
            syntaxCopyExampleLabel={syntaxCopyExampleLabel}
            syntaxCopyPromptLabel={syntaxCopyPromptLabel}
            syntaxCopiedLabel={syntaxCopiedLabel}
            syntaxPromptLabel={syntaxPromptLabel}
            syntaxExampleLabel={syntaxExampleLabel}
            syntaxRulesLabel={syntaxRulesLabel}
            syntaxWhatItIsLabel={syntaxWhatItIsLabel}
            syntaxMistakesLabel={syntaxMistakesLabel}
            syntaxMarkersLabel={syntaxMarkersLabel}
            onCloseHelp={onCloseHelp}
          />
        </div>
      </section>
    </div>
  );
};
