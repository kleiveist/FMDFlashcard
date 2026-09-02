import { describe, expect, it } from "vitest";
import {
  __TEST_ONLY_SETTINGS_TRANSLATIONS,
  resolveSettingsNavModel,
  SETTINGS_I18N_KEYS,
  tSettings,
  type SettingsI18nKey,
} from "./settingsI18n";

describe("settingsI18n", () => {
  it("provides non-empty translations for every key in en and de", () => {
    SETTINGS_I18N_KEYS.forEach((key) => {
      expect(tSettings("en", key)).not.toBe("");
      expect(tSettings("de", key)).not.toBe("");
    });
  });

  it("falls back to english when a de translation is missing", () => {
    const key: SettingsI18nKey = "settings.language.panelTitle";
    const originalDe = __TEST_ONLY_SETTINGS_TRANSLATIONS.de[key];
    const enValue = __TEST_ONLY_SETTINGS_TRANSLATIONS.en[key];

    (__TEST_ONLY_SETTINGS_TRANSLATIONS.de as Record<string, string | undefined>)[key] = undefined;

    try {
      expect(tSettings("de", key)).toBe(enValue);
    } finally {
      __TEST_ONLY_SETTINGS_TRANSLATIONS.de[key] = originalDe;
    }
  });

  it("resolves nav labels per language while keeping ids stable", () => {
    const enModel = resolveSettingsNavModel("en");
    const deModel = resolveSettingsNavModel("de");

    const enItems = enModel.filter((entry) => entry.type === "item");
    const deItems = deModel.filter((entry) => entry.type === "item");

    expect(enItems.map((item) => item.id)).toEqual(deItems.map((item) => item.id));

    const enSubIds = enItems.map((item) => item.subPages?.map((sub) => sub.id) ?? []);
    const deSubIds = deItems.map((item) => item.subPages?.map((sub) => sub.id) ?? []);

    expect(enSubIds).toEqual(deSubIds);
    expect(enItems.find((item) => item.id === "language")?.label).toBe("Language");
    expect(deItems.find((item) => item.id === "language")?.label).toBe("Sprache");
  });
});
