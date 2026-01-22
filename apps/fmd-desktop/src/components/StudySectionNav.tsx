/**
 * @file apps/fmd-desktop/src/components/StudySectionNav.tsx
 *
 * Zweck:
 * - Rendert die kompakte Studien-Sektion-Navigation.
 */

import { STUDY_SECTIONS, type StudySectionKey } from "../lib/studySections";

type StudySectionNavProps = {
  activeTab: StudySectionKey;
  onTabChange: (tab: StudySectionKey) => void;
};

export const StudySectionNav = ({ activeTab, onTabChange }: StudySectionNavProps) => (
  <nav className="study-section-nav" aria-label="Study sections">
    {STUDY_SECTIONS.map((section) => {
      const isActive = activeTab === section.key;
      return (
        <button
          key={section.key}
          type="button"
          className={`nav-item study-section-tab ${isActive ? "active" : ""}`}
          onClick={() => onTabChange(section.key)}
          aria-pressed={isActive}
        >
          {section.label}
        </button>
      );
    })}
  </nav>
);
