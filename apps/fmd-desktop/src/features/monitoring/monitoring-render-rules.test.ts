import { describe, expect, it } from "vitest";
import {
  DEFAULT_MONITORING_RENDER_PROFILES,
  normalizeMonitoringRenderProfiles,
  renderMonitoringValue,
  resolveMonitoringProfileForAttribute,
  type MonitoringRenderProfile,
} from "./monitoring-render-rules";

const createProfile = (partial: Partial<MonitoringRenderProfile>): MonitoringRenderProfile => ({
  id: partial.id ?? "profile-1",
  name: partial.name ?? "Profile",
  attributeAliases: partial.attributeAliases ?? ["value"],
  inputFormat: partial.inputFormat ?? "text",
  scopes: partial.scopes ?? ["database"],
  rules: partial.rules ?? [],
  enabled: partial.enabled ?? true,
});

describe("monitoring-render-rules", () => {
  it("seeds default profiles when registry is empty", () => {
    const normalized = normalizeMonitoringRenderProfiles(null);

    expect(normalized).toHaveLength(3);
    expect(normalized.map((profile) => profile.name)).toEqual(["Score", "Percent", "Status"]);
    expect(normalized[2]?.attributeAliases).toContain("corrected status");
    expect(normalized[0]?.previewRawValue).toBe("59/69");
    expect(normalized[1]?.previewRawValue).toBe("86");
    expect(normalized[2]?.previewRawValue).toBe("2");
  });

  it("keeps previewRawValue when normalizing stored profiles", () => {
    const normalized = normalizeMonitoringRenderProfiles([
      {
        id: "custom-profile",
        name: "Custom",
        attributeAliases: ["custom"],
        inputFormat: "code",
        previewRawValue: "X",
        scopes: ["database"],
        rules: [],
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.previewRawValue).toBe("X");
  });

  it("resolves aliases case-insensitively including corrected keys", () => {
    const profile = resolveMonitoringProfileForAttribute(
      DEFAULT_MONITORING_RENDER_PROFILES,
      "Corrected Percent",
    );

    expect(profile?.id).toBe("monitoring-percent");
  });

  it("renders ratio-derived percent for score", () => {
    const result = renderMonitoringValue({
      attributeKey: "score",
      value: "59/69",
      profiles: DEFAULT_MONITORING_RENDER_PROFILES,
    });

    expect(result).not.toBeNull();
    expect(result?.displayText).toBe("59/69 (86%)");
    expect(Math.round(result?.percentValue ?? Number.NaN)).toBe(86);
  });

  it("renders percent format plus progress bar", () => {
    const result = renderMonitoringValue({
      attributeKey: "percent",
      value: "86%",
      profiles: DEFAULT_MONITORING_RENDER_PROFILES,
    });

    expect(result).not.toBeNull();
    expect(result?.displayText).toBe("86%");
    expect(result?.progressBar).toBe(true);
    expect(result?.progressRing).toBe(false);
    expect(result?.percentValue).toBe(86);
  });

  it("renders progress ring when configured", () => {
    const profile = createProfile({
      id: "ring-profile",
      name: "Ring",
      attributeAliases: ["ring-percent"],
      inputFormat: "numeric-percent",
      rules: [
        {
          id: "percent-format-ring",
          type: "percent-format",
          decimals: 0,
          clamp: true,
        },
        {
          id: "progress-ring-1",
          type: "progress-ring",
          min: 0,
          max: 100,
        },
      ],
    });

    const result = renderMonitoringValue({
      attributeKey: "ring-percent",
      value: "42",
      profiles: [profile],
    });

    expect(result?.displayText).toBe("42%");
    expect(result?.progressRing).toBe(true);
    expect(result?.progressBar).toBe(false);
    expect(result?.percentValue).toBe(42);
  });

  it("renders status mappings for raw code and legacy code+emoji", () => {
    const fromRawCode = renderMonitoringValue({
      attributeKey: "status",
      value: "2",
      profiles: DEFAULT_MONITORING_RENDER_PROFILES,
    });
    const fromLegacyValue = renderMonitoringValue({
      attributeKey: "status",
      value: "2 🟢",
      profiles: DEFAULT_MONITORING_RENDER_PROFILES,
    });

    expect(fromRawCode?.displayText).toBe("2 🟢");
    expect(fromLegacyValue?.displayText).toBe("2 🟢");
    expect(fromRawCode?.symbol).toBe("🟢");
  });

  it("supports short structured text with number and blocks long text parsing", () => {
    const shortStructured = createProfile({
      id: "short-structured",
      name: "Short Structured",
      attributeAliases: ["health"],
      inputFormat: "short-structured-text-with-number",
      rules: [
        {
          id: "percent-format-1",
          type: "percent-format",
          decimals: 0,
          clamp: false,
        },
      ],
    });

    const validResult = renderMonitoringValue({
      attributeKey: "health",
      value: "🟢 2",
      profiles: [shortStructured],
    });
    const invalidResult = renderMonitoringValue({
      attributeKey: "health",
      value:
        "Das ist ein langer Freitext ohne stabile Kurzstruktur mit einer Zahl 2 im Satz.",
      profiles: [shortStructured],
    });

    expect(validResult?.displayText).toBe("2%");
    expect(invalidResult?.displayText).toBe(
      "Das ist ein langer Freitext ohne stabile Kurzstruktur mit einer Zahl 2 im Satz.",
    );
  });

  it("supports threshold symbol and grouped label map", () => {
    const profile = createProfile({
      id: "advanced",
      name: "Advanced",
      attributeAliases: ["quality", "grade"],
      inputFormat: "numeric-percent",
      rules: [
        {
          id: "percent-format-2",
          type: "percent-format",
          decimals: 0,
          clamp: true,
        },
        {
          id: "threshold-1",
          type: "threshold-symbol",
          thresholds: [{ op: ">=", value: 90, symbol: "⭐" }],
          appendToText: true,
          separator: " ",
        },
      ],
    });

    const thresholdResult = renderMonitoringValue({
      attributeKey: "quality",
      value: "95",
      profiles: [profile],
    });

    const groupedProfile = createProfile({
      id: "grouped",
      name: "Grouped",
      attributeAliases: ["grade"],
      inputFormat: "text",
      rules: [
        {
          id: "grouped-1",
          type: "grouped-label-map",
          groups: [
            {
              label: "Bestanden",
              symbol: "✅",
              values: ["passed", "ok"],
            },
          ],
          caseSensitive: false,
          replaceText: true,
          separator: " ",
        },
      ],
    });

    const groupedResult = renderMonitoringValue({
      attributeKey: "grade",
      value: "PASSED",
      profiles: [groupedProfile],
    });

    expect(thresholdResult?.displayText).toBe("95% ⭐");
    expect(thresholdResult?.badge).toBe("⭐");
    expect(groupedResult?.displayText).toBe("Bestanden ✅");
    expect(groupedResult?.symbol).toBe("✅");
  });

  it("falls back to raw value when rule parsing does not match", () => {
    const result = renderMonitoringValue({
      attributeKey: "score",
      value: "not-a-ratio",
      profiles: DEFAULT_MONITORING_RENDER_PROFILES,
    });

    expect(result).not.toBeNull();
    expect(result?.displayText).toBe("not-a-ratio");
    expect(result?.percentValue).toBeNull();
  });
});
