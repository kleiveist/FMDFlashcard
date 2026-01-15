/**
 * @file apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite App Sections Guide Panel.
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
 * - AppSectionsGuidePanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { useEffect, useState } from "react";
import {
  APP_SECTION_DATA,
  APP_SECTION_GROUND_RULES,
  APP_SECTION_LABELS,
  APP_SECTION_ORDER,
  AppLanguage,
  AppSectionId,
  resolveText,
} from "../helpContent";

type AppSectionsGuidePanelProps = {
  language: AppLanguage;
};

const APP_SECTION_STORAGE_KEY = "help:app-sections:selected-section";

const isValidSectionId = (value: unknown): value is AppSectionId =>
  typeof value === "string" &&
  (APP_SECTION_ORDER.includes(value as AppSectionId) ||
    Object.prototype.hasOwnProperty.call(APP_SECTION_DATA, value));

export const AppSectionsGuidePanel = ({ language }: AppSectionsGuidePanelProps) => {
  const defaultSectionId = APP_SECTION_ORDER[0] as AppSectionId;
  const [selectedSectionId, setSelectedSectionId] = useState<AppSectionId>(() => {
    if (typeof window === "undefined") {
      return defaultSectionId;
    }
    try {
      const storedSectionId = window.localStorage.getItem(
        APP_SECTION_STORAGE_KEY,
      );
      if (isValidSectionId(storedSectionId)) {
        return storedSectionId;
      }
      if (storedSectionId && defaultSectionId) {
        window.localStorage.setItem(APP_SECTION_STORAGE_KEY, defaultSectionId);
      }
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
    return defaultSectionId;
  });
  const [sectionLanguage, setSectionLanguage] = useState<AppLanguage>(language);
  const selectedSection =
    APP_SECTION_DATA[selectedSectionId] ?? APP_SECTION_DATA[defaultSectionId];
  const selectionError =
    !selectedSection ||
    !defaultSectionId ||
    !APP_SECTION_DATA[defaultSectionId];
  const hasGroundRules =
    (APP_SECTION_GROUND_RULES.paragraph?.[sectionLanguage] ?? "").trim().length >
      0 || (APP_SECTION_GROUND_RULES.bullets?.length ?? 0) > 0;

  useEffect(() => {
    setSectionLanguage(language);
  }, [language]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (!isValidSectionId(selectedSectionId) && defaultSectionId) {
        window.localStorage.setItem(APP_SECTION_STORAGE_KEY, defaultSectionId);
        setSelectedSectionId(defaultSectionId);
        return;
      }
      window.localStorage.setItem(APP_SECTION_STORAGE_KEY, selectedSectionId);
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
  }, [defaultSectionId, selectedSectionId]);

  return (
    <div className="help-detail-sections">
      {hasGroundRules ? (
        <div className="help-detail-section help-block">
          <div className="help-item-header">
            <span className="help-block-title">
              {resolveText(APP_SECTION_LABELS.groundRulesTitle, sectionLanguage)}
            </span>
          </div>
          <p className="help-syntax-text">
            {resolveText(APP_SECTION_GROUND_RULES.paragraph, sectionLanguage)}
          </p>
          <ul className="help-list">
            {APP_SECTION_GROUND_RULES.bullets.map((bullet, index) => (
              <li key={`ground-${index}`}>
                {resolveText(bullet, sectionLanguage)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist">
          {APP_SECTION_ORDER.map((sectionId) => {
            const section = APP_SECTION_DATA[sectionId];
            const isActive = selectedSectionId === sectionId;
            return (
              <button
                key={sectionId}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setSelectedSectionId(sectionId)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">
                  {resolveText(section.title, sectionLanguage)}
                </div>
                <div className="help-syntax-card-meta">
                  <span className="help-syntax-card-label">
                    {resolveText(
                      APP_SECTION_LABELS.typicalAction,
                      sectionLanguage,
                    )}
                  </span>
                  <span>{resolveText(section.action, sectionLanguage)}</span>
                </div>
                <div className="help-syntax-card-rule">
                  {resolveText(section.summary, sectionLanguage)}
                </div>
              </button>
            );
          })}
        </div>
        <div className="help-syntax-detail">
          {selectionError ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">Missing section</span>
              </div>
              <p className="help-syntax-text">
                The App Sections guide is misconfigured. Check APP_SECTION_ORDER
                and APP_SECTION_DATA.
              </p>
            </div>
          ) : (
            <>
              <div className="help-syntax-detail-header">
                <div className="help-syntax-detail-title">
                  {resolveText(selectedSection.title, sectionLanguage)}
                </div>
                <div className="help-syntax-lang-tabs">
                  <button
                    type="button"
                    className={`help-syntax-lang${
                      sectionLanguage === "en" ? " active" : ""
                    }`}
                    onClick={() => setSectionLanguage("en")}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    className={`help-syntax-lang${
                      sectionLanguage === "de" ? " active" : ""
                    }`}
                    onClick={() => setSectionLanguage("de")}
                  >
                    DE
                  </button>
                </div>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.whatIs, sectionLanguage)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(selectedSection.detail.whatIs, sectionLanguage)}
                </p>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.purpose, sectionLanguage)}
                  </span>
                </div>
                <ul className="help-syntax-list">
                  {selectedSection.detail.purpose.map((item, index) => (
                    <li key={`${selectedSectionId}-purpose-${index}`}>
                      {resolveText(item, sectionLanguage)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.whatYouSee, sectionLanguage)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(
                    selectedSection.detail.whatYouSee,
                    sectionLanguage,
                  )}
                </p>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.showCards, sectionLanguage)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(
                    selectedSection.detail.showCards,
                    sectionLanguage,
                  )}
                </p>
              </div>
              {selectedSection.detail.tips ? (
                <div className="help-syntax-section">
                  <div className="help-syntax-section-header">
                    <span className="label">
                      {resolveText(APP_SECTION_LABELS.tips, sectionLanguage)}
                    </span>
                  </div>
                  <p className="help-syntax-text">
                    {resolveText(selectedSection.detail.tips, sectionLanguage)}
                  </p>
                </div>
              ) : null}
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.workflow, sectionLanguage)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(
                    selectedSection.detail.workflow,
                    sectionLanguage,
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
