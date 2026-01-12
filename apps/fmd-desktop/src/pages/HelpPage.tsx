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
import { registerCloseLayer } from "../lib/shortcuts/closeOrBack";
import {
  AppLanguage,
  flashcardSyntaxEntries,
  flashcardSyntaxOverview,
  helpHeader,
  helpLabels,
  helpTopics,
  resolveList,
  resolveText,
} from "./help/helpContent";
import { HelpDetailSection } from "./help/sections/HelpDetailSection";
import { HelpHeaderSection } from "./help/sections/HelpHeaderSection";
import { HelpOverviewSection } from "./help/sections/HelpOverviewSection";
import { HelpTopicHeadingsBlock } from "./help/sections/HelpTopicHeadingsBlock";

export const HelpPage = () => {
  const { help, settings } = useAppState();
  const { activeTopicId, setActiveTopicId } = help;
  const [activeSyntaxId, setActiveSyntaxId] = useState<string | null>(
    flashcardSyntaxEntries[0]?.id ?? null,
  );
  const [syntaxLanguage, setSyntaxLanguage] = useState<AppLanguage>(
    settings.language,
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);
  const language = settings.language;
  const activeTopic = helpTopics.find((topic) => topic.id === activeTopicId) ?? null;
  const isSyntaxTopic = activeTopic?.id === "flashcard-syntax";
  const isAppSectionsTopic = activeTopic?.id === "app-sections";
  const activeSyntax =
    flashcardSyntaxEntries.find((entry) => entry.id === activeSyntaxId) ??
    flashcardSyntaxEntries[0] ??
    null;
  const titleText = resolveText(helpHeader.title, language);
  const eyebrowText = resolveText(helpHeader.eyebrow, language);
  const summaryText = resolveText(helpHeader.summary, language);

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
  const overviewBullets = resolveList(
    flashcardSyntaxOverview.bullets,
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
    if (activeTopicId !== "flashcard-syntax") {
      return;
    }
    setActiveSyntaxId((prev) => {
      if (prev && flashcardSyntaxEntries.some((entry) => entry.id === prev)) {
        return prev;
      }
      return flashcardSyntaxEntries[0]?.id ?? null;
    });
    setSyntaxLanguage(settings.language);
  }, [activeTopicId, settings.language]);

  useEffect(() => {
    if (!activeTopicId) {
      return;
    }
    return registerCloseLayer({
      id: "help-topic-detail",
      priority: 100,
      isActive: () => true,
      onClose: () => setActiveTopicId(null),
    });
  }, [activeTopicId, setActiveTopicId]);

  useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <>
      <HelpHeaderSection
        eyebrowText={eyebrowText}
        titleText={titleText}
        summaryText={summaryText}
      />
      <section className="panel help-panel">
        <div className="panel-body help-body">
          {activeTopic ? (
            <>
              <HelpTopicHeadingsBlock
                helpTopics={helpTopics}
                language={language}
                activeTopicId={activeTopic.id}
                setActiveTopicId={setActiveTopicId}
              />
              <HelpDetailSection
                titleText={titleText}
                activeTopic={activeTopic}
                language={language}
                isSyntaxTopic={isSyntaxTopic}
                isAppSectionsTopic={isAppSectionsTopic}
                activeSyntax={activeSyntax}
                setActiveTopicId={setActiveTopicId}
                setActiveSyntaxId={setActiveSyntaxId}
                syntaxLanguage={syntaxLanguage}
                setSyntaxLanguage={setSyntaxLanguage}
                copyLabel={copyLabel}
                copiedLabel={copiedLabel}
                copiedItemId={copiedItemId}
                handleCopy={handleCopy}
                overviewBullets={overviewBullets}
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
            </>
          ) : (
            <HelpOverviewSection
              helpTopics={helpTopics}
              language={language}
              setActiveTopicId={setActiveTopicId}
            />
          )}
        </div>
      </section>
    </>
  );
};
