/**
 * @file frontend/src/pages/HelpPage.tsx
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
 * - frontend/src/components/AppStateProvider.tsx: UI-Komponente.
 * - frontend/src/pages/help/helpContent.ts: Seiten-Komponente.
 * - frontend/src/pages/help/sections/HelpDetailSection.tsx: Seiten-Komponente.
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
    language,
  );
  const syntaxCopyPromptLabel = resolveText(helpLabels.copyPrompt, language);
  const syntaxCopiedLabel = resolveText(helpLabels.copied, language);
  const syntaxPromptLabel = resolveText(helpLabels.promptTemplate, language);
  const syntaxExampleLabel = resolveText(helpLabels.example, language);
  const syntaxRulesLabel = resolveText(helpLabels.rules, language);
  const syntaxWhatItIsLabel = resolveText(helpLabels.whatItIs, language);
  const syntaxMistakesLabel = resolveText(helpLabels.mistakes, language);
  const syntaxMarkersLabel = resolveText(helpLabels.markers, language);
  const syntaxOverviewBullets = resolveList(
    syntaxOverview.bullets,
    language,
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
    }
    if (normalizedActiveTopic?.id === "structured-syntax") {
      setStructuredSyntaxId((prev) => {
        if (prev && structuredSyntaxEntries.some((entry) => entry.id === prev)) {
          return prev;
        }
        return structuredSyntaxEntries[0]?.id ?? null;
      });
    }
  }, [normalizedActiveTopic?.id]);

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
