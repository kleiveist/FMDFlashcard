import { AppLanguage, HelpTopic, resolveText } from "../helpContent";

type HelpTopicHeadingsBlockProps = {
  helpTopics: HelpTopic[];
  language: AppLanguage;
  activeTopicId: string;
  setActiveTopicId: (value: string | null) => void;
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
