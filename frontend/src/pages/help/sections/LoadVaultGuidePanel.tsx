/**
 * @file apps/fmd-desktop/src/pages/help/sections/LoadVaultGuidePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Load Vault Guide Panel.
 */

import { useState } from "react";
import {
  AppLanguage,
  LoadVaultTabId,
  LOAD_VAULT_ORDER,
  LOAD_VAULT_TABS,
  resolveText,
} from "../helpContent";

type LoadVaultGuidePanelProps = {
  language: AppLanguage;
};

export const LoadVaultGuidePanel = ({ language }: LoadVaultGuidePanelProps) => {
  const defaultTabId = LOAD_VAULT_ORDER[0] as LoadVaultTabId;
  const [selectedTabId, setSelectedTabId] = useState<LoadVaultTabId>(
    defaultTabId,
  );
  const selectedTab =
    LOAD_VAULT_TABS[selectedTabId] ?? LOAD_VAULT_TABS[defaultTabId];
  const selectionError =
    !selectedTab || !defaultTabId || !LOAD_VAULT_TABS[defaultTabId];

  return (
    <div className="help-detail-sections">
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist">
          {LOAD_VAULT_ORDER.map((tabId) => {
            const tab = LOAD_VAULT_TABS[tabId];
            const isActive = selectedTabId === tabId;
            return (
              <button
                key={tabId}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setSelectedTabId(tabId)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">
                  {resolveText(tab.title, language)}
                </div>
                <div className="help-syntax-card-rule">
                  {resolveText(tab.summary, language)}
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
                The Load a vault guide is misconfigured. Check LOAD_VAULT_ORDER
                and LOAD_VAULT_TABS.
              </p>
            </div>
          ) : (
            <>
              <div className="help-syntax-detail-header">
                <div className="help-syntax-detail-title">
                  {resolveText(selectedTab.title, language)}
                </div>
              </div>
              {selectedTab.blocks.map((block) => (
                <div key={block.id} className="help-syntax-section">
                  <div className="help-syntax-section-header">
                    <span className="label">
                      {resolveText(block.title, language)}
                    </span>
                  </div>
                  {block.text ? (
                    <p className="help-syntax-text">
                      {resolveText(block.text, language)}
                    </p>
                  ) : null}
                  {block.bullets && block.bullets.length > 0 ? (
                    <ul className="help-syntax-list">
                      {block.bullets.map((item, index) => (
                        <li key={`${block.id}-${index}`}>
                          {resolveText(item, language)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
