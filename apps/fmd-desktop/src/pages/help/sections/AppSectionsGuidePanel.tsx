/**
 * @file apps/fmd-desktop/src/pages/help/sections/AppSectionsGuidePanel.tsx
 *
 * Zweck:
 * - Rendert die Seite App Sections Guide Panel.
 */

import { useEffect, useMemo, useState } from "react";
import {
  APP_SECTION_CATEGORIES,
  APP_SECTION_CATEGORY_ORDER,
  APP_SECTION_ITEMS,
  APP_SECTION_LABELS,
  AppLanguage,
  AppSectionCategoryId,
  AppSectionItemId,
  resolveText,
} from "../helpContent";

type AppSectionsGuidePanelProps = {
  language: AppLanguage;
};

const APP_SECTION_CATEGORY_STORAGE_KEY = "help:app-sections:selected-category";
const APP_SECTION_ITEM_STORAGE_KEY = "help:app-sections:selected-item";

const isValidCategoryId = (value: unknown): value is AppSectionCategoryId =>
  typeof value === "string" && APP_SECTION_CATEGORY_ORDER.includes(value as AppSectionCategoryId);

const isValidItemId = (value: unknown): value is AppSectionItemId =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(APP_SECTION_ITEMS, value);

const resolveFirstItemForCategory = (categoryId: AppSectionCategoryId) =>
  APP_SECTION_CATEGORIES[categoryId]?.itemOrder[0] ?? null;

const resolveCategoryForItem = (itemId: AppSectionItemId): AppSectionCategoryId | null =>
  APP_SECTION_CATEGORY_ORDER.find((categoryId) =>
    APP_SECTION_CATEGORIES[categoryId]?.itemOrder.includes(itemId),
  ) ?? null;

export const AppSectionsGuidePanel = ({ language }: AppSectionsGuidePanelProps) => {
  const defaultCategoryId = APP_SECTION_CATEGORY_ORDER[0] as AppSectionCategoryId;
  const defaultItemId = resolveFirstItemForCategory(defaultCategoryId);

  const [selectedCategoryId, setSelectedCategoryId] = useState<AppSectionCategoryId>(() => {
    if (typeof window === "undefined") {
      return defaultCategoryId;
    }
    try {
      const storedCategory = window.localStorage.getItem(APP_SECTION_CATEGORY_STORAGE_KEY);
      if (isValidCategoryId(storedCategory)) {
        return storedCategory;
      }
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
    return defaultCategoryId;
  });

  const [selectedItemId, setSelectedItemId] = useState<AppSectionItemId | null>(() => {
    if (typeof window === "undefined") {
      return defaultItemId;
    }
    try {
      const storedItem = window.localStorage.getItem(APP_SECTION_ITEM_STORAGE_KEY);
      if (isValidItemId(storedItem)) {
        return storedItem;
      }
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
    return defaultItemId;
  });

  const selectedCategory =
    APP_SECTION_CATEGORIES[selectedCategoryId] ?? APP_SECTION_CATEGORIES[defaultCategoryId];

  const resolvedSelectedItemId = useMemo(() => {
    if (selectedItemId && selectedCategory.itemOrder.includes(selectedItemId)) {
      return selectedItemId;
    }
    return selectedCategory.itemOrder[0] ?? null;
  }, [selectedCategory.itemOrder, selectedItemId]);

  const selectedItem = resolvedSelectedItemId ? APP_SECTION_ITEMS[resolvedSelectedItemId] : null;
  const selectedActions = selectedItem?.detail.actions ?? [];
  const [selectedActionId, setSelectedActionId] = useState<string | null>(
    selectedActions[0]?.id ?? null,
  );

  useEffect(() => {
    if (selectedActions.length === 0) {
      if (selectedActionId !== null) {
        setSelectedActionId(null);
      }
      return;
    }
    if (!selectedActionId || !selectedActions.some((action) => action.id === selectedActionId)) {
      setSelectedActionId(selectedActions[0]?.id ?? null);
    }
  }, [selectedActionId, selectedActions]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(APP_SECTION_CATEGORY_STORAGE_KEY, selectedCategoryId);
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (!resolvedSelectedItemId || typeof window === "undefined") {
      return;
    }
    try {
      window.localStorage.setItem(APP_SECTION_ITEM_STORAGE_KEY, resolvedSelectedItemId);
    } catch {
      // Ignore storage failures to keep the panel usable.
    }
  }, [resolvedSelectedItemId]);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }
    const itemCategory = resolveCategoryForItem(selectedItemId);
    if (!itemCategory) {
      return;
    }
    if (itemCategory !== selectedCategoryId) {
      setSelectedCategoryId(itemCategory);
    }
  }, [selectedCategoryId, selectedItemId]);

  const activeAction =
    selectedActions.find((action) => action.id === selectedActionId) ?? selectedActions[0] ?? null;

  return (
    <div className="help-detail-sections">
      <div className="toolbar-section">
        <span className="label">{resolveText(APP_SECTION_LABELS.categoryLabel, language)}</span>
        <div className="pill-grid" role="tablist" aria-label="App sections categories">
          {APP_SECTION_CATEGORY_ORDER.map((categoryId) => {
            const category = APP_SECTION_CATEGORIES[categoryId];
            const isActive = categoryId === selectedCategoryId;
            return (
              <button
                key={categoryId}
                type="button"
                className={`pill pill-button${isActive ? " active" : ""}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  const firstItemId = resolveFirstItemForCategory(categoryId);
                  setSelectedCategoryId(categoryId);
                  setSelectedItemId(firstItemId);
                }}
              >
                {resolveText(category.title, language)}
              </button>
            );
          })}
        </div>
        <p className="muted">{resolveText(selectedCategory.summary, language)}</p>
      </div>
      <div className="help-syntax-layout">
        <div className="help-syntax-cards" role="tablist" aria-label="App sections entries">
          {selectedCategory.itemOrder.map((itemId) => {
            const item = APP_SECTION_ITEMS[itemId];
            const isActive = itemId === resolvedSelectedItemId;
            return (
              <button
                key={itemId}
                type="button"
                className={`help-syntax-card${isActive ? " active" : ""}`}
                onClick={() => setSelectedItemId(itemId)}
                role="tab"
                aria-selected={isActive}
              >
                <div className="help-syntax-card-title">{resolveText(item.title, language)}</div>
                <div className="help-syntax-card-meta">
                  <span className="help-syntax-card-label">
                    {resolveText(APP_SECTION_LABELS.typicalAction, language)}
                  </span>
                  <span>{resolveText(item.action, language)}</span>
                </div>
                <div className="help-syntax-card-rule">{resolveText(item.summary, language)}</div>
              </button>
            );
          })}
        </div>
        <div className="help-syntax-detail">
          {!selectedItem ? (
            <div className="help-syntax-section">
              <div className="help-syntax-section-header">
                <span className="label">Missing section</span>
              </div>
              <p className="help-syntax-text">
                The App Sections guide is misconfigured. Check category item assignments.
              </p>
            </div>
          ) : (
            <>
              <div className="help-syntax-detail-header">
                <div className="help-syntax-detail-title">
                  {resolveText(selectedItem.title, language)}
                </div>
              </div>
              {selectedActions.length > 0 ? (
                <div className="help-syntax-section">
                  <div className="help-syntax-section-header">
                    <span className="label">
                      {resolveText(APP_SECTION_LABELS.hybridActions, language)}
                    </span>
                  </div>
                  <div className="pill-grid" role="tablist" aria-label="Hybrid action details">
                    {selectedActions.map((action) => {
                      const isActive = action.id === activeAction?.id;
                      return (
                        <button
                          key={action.id}
                          type="button"
                          className={`pill pill-button${isActive ? " active" : ""}`}
                          role="tab"
                          aria-selected={isActive}
                          onClick={() => setSelectedActionId(action.id)}
                        >
                          {resolveText(action.label, language)}
                        </button>
                      );
                    })}
                  </div>
                  {activeAction ? (
                    <p className="help-syntax-text">
                      {resolveText(activeAction.description, language)}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">{resolveText(APP_SECTION_LABELS.whatIs, language)}</span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(selectedItem.detail.whatIs, language)}
                </p>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">{resolveText(APP_SECTION_LABELS.purpose, language)}</span>
                </div>
                <ul className="help-syntax-list">
                  {selectedItem.detail.purpose.map((item, index) => (
                    <li key={`${resolvedSelectedItemId ?? "section"}-purpose-${index}`}>
                      {resolveText(item, language)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.whatYouSee, language)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(selectedItem.detail.whatYouSee, language)}
                </p>
              </div>
              {selectedItem.detail.keyBehavior ? (
                <div className="help-syntax-section">
                  <div className="help-syntax-section-header">
                    <span className="label">
                      {resolveText(APP_SECTION_LABELS.keyBehavior, language)}
                    </span>
                  </div>
                  <p className="help-syntax-text">
                    {resolveText(selectedItem.detail.keyBehavior, language)}
                  </p>
                </div>
              ) : null}
              <div className="help-syntax-section">
                <div className="help-syntax-section-header">
                  <span className="label">
                    {resolveText(APP_SECTION_LABELS.workflow, language)}
                  </span>
                </div>
                <p className="help-syntax-text">
                  {resolveText(selectedItem.detail.workflow, language)}
                </p>
              </div>
              {selectedItem.detail.tips ? (
                <div className="help-syntax-section">
                  <div className="help-syntax-section-header">
                    <span className="label">{resolveText(APP_SECTION_LABELS.tips, language)}</span>
                  </div>
                  <p className="help-syntax-text">
                    {resolveText(selectedItem.detail.tips, language)}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
