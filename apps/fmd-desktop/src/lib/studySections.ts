export type StudySectionKey =
  | "dashboard"
  | "exam"
  | "flashcard"
  | "card-monitoring"
  | "points-profiles"
  | "monitoring-rules"
  | "fast-flashcard"
  | "spaced-repetition";

export type StudySection = {
  key: StudySectionKey;
  label: string;
};

export const STUDY_SECTIONS: StudySection[] = [
  { key: "dashboard", label: "Study" },
  { key: "exam", label: "Exam" },
  { key: "flashcard", label: "Flashcard" },
  { key: "fast-flashcard", label: "Fast Flashcard" },
  { key: "spaced-repetition", label: "Repetition" },
  { key: "card-monitoring", label: "Card Monitoring" },
  { key: "points-profiles", label: "Points Profiles" },
  { key: "monitoring-rules", label: "Attribute Rules" },
];

export const CARD_SECTIONS = STUDY_SECTIONS.filter(
  (section) => section.key !== "dashboard",
);

export const CARD_SECTION_KEYS: StudySectionKey[] = CARD_SECTIONS.map(
  (section) => section.key,
);
