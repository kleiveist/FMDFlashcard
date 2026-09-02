export type StudySectionKey =
  | "dashboard"
  | "exam"
  | "flashcard"
  | "card-monitoring"
  | "points-profiles"
  | "monitoring-rules"
  | "fast-flashcard"
  | "spaced-repetition";

export type StudyMainMode = "study" | "monitoring";

export type StudyModeSectionKey = "exam" | "flashcard" | "fast-flashcard" | "spaced-repetition";

export type MonitoringModeSectionKey = "monitoring-rules" | "card-monitoring" | "points-profiles";

export type StudySection = {
  key: StudySectionKey;
  label: string;
};

export const STUDY_MODE_SECTIONS: Array<{ key: StudyModeSectionKey; label: string }> = [
  { key: "exam", label: "Exam" },
  { key: "flashcard", label: "Flashcard" },
  { key: "fast-flashcard", label: "Fast Flashcard" },
  { key: "spaced-repetition", label: "Repetition" },
];

export const MONITORING_MODE_SECTIONS: Array<{ key: MonitoringModeSectionKey; label: string }> = [
  { key: "monitoring-rules", label: "Attribute Rules" },
  { key: "card-monitoring", label: "Card Monitoring" },
  { key: "points-profiles", label: "Points Profiles" },
];

export const STUDY_SECTIONS: StudySection[] = [
  { key: "dashboard", label: "Study" },
  ...STUDY_MODE_SECTIONS,
  ...MONITORING_MODE_SECTIONS,
];

export const CARD_SECTIONS = [...STUDY_MODE_SECTIONS, ...MONITORING_MODE_SECTIONS];

export const CARD_SECTION_KEYS: StudySectionKey[] = CARD_SECTIONS.map((section) => section.key);

export const STUDY_MODE_SECTION_KEYS: StudyModeSectionKey[] = STUDY_MODE_SECTIONS.map(
  (section) => section.key,
);

export const MONITORING_MODE_SECTION_KEYS: MonitoringModeSectionKey[] =
  MONITORING_MODE_SECTIONS.map((section) => section.key);

export const isStudyModeSection = (section: StudySectionKey): section is StudyModeSectionKey =>
  section === "exam" ||
  section === "flashcard" ||
  section === "fast-flashcard" ||
  section === "spaced-repetition";

export const isMonitoringModeSection = (
  section: StudySectionKey,
): section is MonitoringModeSectionKey =>
  section === "monitoring-rules" || section === "card-monitoring" || section === "points-profiles";
