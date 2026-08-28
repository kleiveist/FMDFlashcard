import { describe, expect, it } from "vitest";
import {
  coerceTimelineZoom,
  formatTimelineValueFromTimestamp,
  getTimelineAllowedZooms,
  normalizeDateTimeValue,
  normalizeDateValue,
  normalizeTimeValue,
  parseTimelineComparableValue,
} from "./database-time";

describe("database-time", () => {
  it("normalizes date/time/datetime values", () => {
    expect(normalizeDateValue("2026-04-03")).toBe("2026-04-03");
    expect(normalizeTimeValue("14:30")).toBe("14:30");
    expect(normalizeDateTimeValue("2026-04-03T14:30")).toBe("2026-04-03T14:30");
  });

  it("parses comparable values for time mode as minutes", () => {
    const parsed = parseTimelineComparableValue({
      value: "14:30",
      fieldType: "time",
      mode: "time",
      baseDate: "2026-04-03",
    });
    expect(parsed).toBe(14 * 60 + 30);
  });

  it("returns mode-specific zoom sets", () => {
    expect(getTimelineAllowedZooms("date")).toEqual(["year", "quarter", "month", "week", "day"]);
    expect(getTimelineAllowedZooms("time")).toEqual(["day", "hour", "minute"]);
    expect(getTimelineAllowedZooms("datetime")).toEqual(["month", "week", "day", "hour", "minute"]);
    expect(coerceTimelineZoom("time", "month")).toBe("hour");
  });

  it("formats timestamps for persistence by mode", () => {
    const timestamp = new Date(2026, 3, 3, 9, 15, 0, 0).getTime();
    expect(formatTimelineValueFromTimestamp(timestamp, "date")).toBe("2026-04-03");
    expect(formatTimelineValueFromTimestamp(timestamp, "time")).toBe("09:15");
    expect(formatTimelineValueFromTimestamp(timestamp, "datetime")).toBe("2026-04-03T09:15");
  });
});
