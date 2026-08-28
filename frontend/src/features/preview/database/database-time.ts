/**
 * @file frontend/src/features/preview/database/database-time.ts
 *
 * Shared temporal helpers for database time/date/datetime behavior.
 */

import {
  type DatabaseFieldType,
  type DatabaseGanttZoom,
  type DatabaseNormalizedFieldValue,
  type DatabaseTimelineMode,
} from "./database-types";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;
const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

const pad2 = (value: number) => String(value).padStart(2, "0");

const isValidDateParts = (year: number, month: number, day: number) => {
  if (!Number.isInteger(year) || year < 1) {
    return false;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return false;
  }
  const candidate = new Date(year, month - 1, day);
  return candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day;
};

const isValidTimeParts = (hours: number, minutes: number) =>
  Number.isInteger(hours) &&
  Number.isInteger(minutes) &&
  hours >= 0 &&
  hours <= 23 &&
  minutes >= 0 &&
  minutes <= 59;

const parseDateParts = (value: string) => {
  const match = value.match(DATE_PATTERN);
  if (!match) {
    return null;
  }
  const year = Number(match[1] ?? Number.NaN);
  const month = Number(match[2] ?? Number.NaN);
  const day = Number(match[3] ?? Number.NaN);
  if (!isValidDateParts(year, month, day)) {
    return null;
  }
  return { year, month, day };
};

const parseTimeParts = (value: string) => {
  const match = value.match(TIME_PATTERN);
  if (!match) {
    return null;
  }
  const hours = Number(match[1] ?? Number.NaN);
  const minutes = Number(match[2] ?? Number.NaN);
  if (!isValidTimeParts(hours, minutes)) {
    return null;
  }
  return { hours, minutes };
};

const parseDateTimeParts = (value: string) => {
  const match = value.match(DATETIME_PATTERN);
  if (!match) {
    return null;
  }
  const year = Number(match[1] ?? Number.NaN);
  const month = Number(match[2] ?? Number.NaN);
  const day = Number(match[3] ?? Number.NaN);
  const hours = Number(match[4] ?? Number.NaN);
  const minutes = Number(match[5] ?? Number.NaN);
  if (!isValidDateParts(year, month, day) || !isValidTimeParts(hours, minutes)) {
    return null;
  }
  return { year, month, day, hours, minutes };
};

export const isDateValue = (value: string) => Boolean(parseDateParts(value.trim()));
export const isTimeValue = (value: string) => Boolean(parseTimeParts(value.trim()));
export const isDateTimeValue = (value: string) => Boolean(parseDateTimeParts(value.trim()));

export const normalizeDateValue = (value: string) => {
  const parts = parseDateParts(value.trim());
  if (!parts) {
    return null;
  }
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
};

export const normalizeTimeValue = (value: string) => {
  const parts = parseTimeParts(value.trim());
  if (!parts) {
    return null;
  }
  return `${pad2(parts.hours)}:${pad2(parts.minutes)}`;
};

export const normalizeDateTimeValue = (value: string) => {
  const parts = parseDateTimeParts(value.trim());
  if (!parts) {
    return null;
  }
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hours)}:${pad2(parts.minutes)}`;
};

export const normalizeTimelineBaseDate = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }
  return normalizeDateValue(value);
};

export const normalizeTimelineValueForMode = (
  mode: DatabaseTimelineMode,
  value: string,
) => {
  if (mode === "time") {
    return normalizeTimeValue(value);
  }
  if (mode === "datetime") {
    return normalizeDateTimeValue(value);
  }
  return normalizeDateValue(value);
};

const parseDateStringToLocalTimestamp = (value: string) => {
  const normalized = normalizeDateValue(value);
  if (!normalized) {
    return null;
  }
  const parts = parseDateParts(normalized);
  if (!parts) {
    return null;
  }
  return new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
};

const parseDateTimeStringToLocalTimestamp = (value: string) => {
  const normalized = normalizeDateTimeValue(value);
  if (!normalized) {
    return null;
  }
  const parts = parseDateTimeParts(normalized);
  if (!parts) {
    return null;
  }
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    0,
    0,
  ).getTime();
};

const parseTimeStringToMinutes = (value: string) => {
  const normalized = normalizeTimeValue(value);
  if (!normalized) {
    return null;
  }
  const parts = parseTimeParts(normalized);
  if (!parts) {
    return null;
  }
  return (parts.hours * 60) + parts.minutes;
};

const resolveBaseDateTimestamp = (baseDate: string | null | undefined) => {
  const normalizedBaseDate = normalizeTimelineBaseDate(baseDate ?? null);
  if (!normalizedBaseDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }
  return parseDateStringToLocalTimestamp(normalizedBaseDate) ?? (() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  })();
};

const toRawString = (value: DatabaseNormalizedFieldValue | unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}T${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value && typeof value === "object" && "raw" in (value as Record<string, unknown>)) {
    const raw = (value as { raw?: unknown }).raw;
    return typeof raw === "string" ? raw : raw === null || typeof raw === "undefined" ? null : String(raw);
  }
  return null;
};

export const parseTimelineComparableValue = ({
  value,
  fieldType,
  mode,
  baseDate,
}: {
  value: DatabaseNormalizedFieldValue | unknown;
  fieldType?: DatabaseFieldType | null;
  mode: DatabaseTimelineMode;
  baseDate?: string | null;
}) => {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    if (mode === "time") {
      return (value.getHours() * 60) + value.getMinutes();
    }
    return value.getTime();
  }

  const raw = toRawString(value);
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (fieldType === "time" || mode === "time") {
    const minutes = parseTimeStringToMinutes(trimmed);
    if (minutes !== null) {
      return minutes;
    }
  }
  if (fieldType === "datetime" || mode === "datetime") {
    const timestamp = parseDateTimeStringToLocalTimestamp(trimmed);
    if (timestamp !== null) {
      return timestamp;
    }
  }
  if (fieldType === "date" || mode === "date") {
    const timestamp = parseDateStringToLocalTimestamp(trimmed);
    if (timestamp !== null) {
      return timestamp;
    }
  }

  const datetimeTimestamp = parseDateTimeStringToLocalTimestamp(trimmed);
  if (datetimeTimestamp !== null) {
    return mode === "time"
      ? (() => {
        const date = new Date(datetimeTimestamp);
        return (date.getHours() * 60) + date.getMinutes();
      })()
      : datetimeTimestamp;
  }
  const dateTimestamp = parseDateStringToLocalTimestamp(trimmed);
  if (dateTimestamp !== null) {
    return mode === "time" ? 0 : dateTimestamp;
  }
  const timeMinutes = parseTimeStringToMinutes(trimmed);
  if (timeMinutes !== null) {
    return mode === "time" ? timeMinutes : resolveBaseDateTimestamp(baseDate) + (timeMinutes * 60 * 1000);
  }

  return null;
};

export const parseTimelineTimestamp = ({
  value,
  fieldType,
  mode,
  baseDate,
}: {
  value: DatabaseNormalizedFieldValue | unknown;
  fieldType?: DatabaseFieldType | null;
  mode: DatabaseTimelineMode;
  baseDate?: string | null;
}) => {
  const comparable = parseTimelineComparableValue({
    value,
    fieldType,
    mode,
    baseDate,
  });
  if (typeof comparable !== "number" || !Number.isFinite(comparable)) {
    return null;
  }
  if (mode === "time") {
    return resolveBaseDateTimestamp(baseDate) + (comparable * 60 * 1000);
  }
  return comparable;
};

export const getTimelineDefaultZoom = (mode: DatabaseTimelineMode): DatabaseGanttZoom => {
  if (mode === "time") {
    return "hour";
  }
  if (mode === "datetime") {
    return "day";
  }
  return "month";
};

export const getTimelineAllowedZooms = (mode: DatabaseTimelineMode): DatabaseGanttZoom[] => {
  if (mode === "time") {
    return ["day", "hour", "minute"];
  }
  if (mode === "datetime") {
    return ["month", "week", "day", "hour", "minute"];
  }
  return ["year", "quarter", "month", "week", "day"];
};

export const coerceTimelineZoom = (
  mode: DatabaseTimelineMode,
  zoom: DatabaseGanttZoom | null | undefined,
) => {
  const allowed = getTimelineAllowedZooms(mode);
  if (zoom && allowed.includes(zoom)) {
    return zoom;
  }
  return getTimelineDefaultZoom(mode);
};

export const getTimelineDefaultDurationMs = (mode: DatabaseTimelineMode) => {
  if (mode === "date") {
    return 24 * 60 * 60 * 1000;
  }
  return 60 * 60 * 1000;
};

const toDate = (timestamp: number) => new Date(timestamp);

export const toStartOfTimelineZoom = (
  timestamp: number,
  zoom: DatabaseGanttZoom,
) => {
  const date = toDate(timestamp);
  if (zoom === "year") {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (zoom === "quarter") {
    date.setMonth(date.getMonth() - (date.getMonth() % 3), 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (zoom === "month") {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (zoom === "week") {
    const day = date.getDay();
    const distanceToMonday = (day + 6) % 7;
    date.setDate(date.getDate() - distanceToMonday);
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (zoom === "day") {
    date.setHours(0, 0, 0, 0);
    return date;
  }
  if (zoom === "hour") {
    date.setMinutes(0, 0, 0);
    return date;
  }
  date.setSeconds(0, 0);
  return date;
};

export const addTimelineZoomStep = (
  date: Date,
  zoom: DatabaseGanttZoom,
  step = 1,
) => {
  const next = new Date(date.getTime());
  if (zoom === "year") {
    next.setFullYear(next.getFullYear() + step, 0, 1);
    return next;
  }
  if (zoom === "quarter") {
    next.setMonth(next.getMonth() + (step * 3), 1);
    return next;
  }
  if (zoom === "month") {
    next.setMonth(next.getMonth() + step, 1);
    return next;
  }
  if (zoom === "week") {
    next.setDate(next.getDate() + (step * 7));
    return next;
  }
  if (zoom === "day") {
    next.setDate(next.getDate() + step);
    return next;
  }
  if (zoom === "hour") {
    next.setHours(next.getHours() + step);
    return next;
  }
  next.setMinutes(next.getMinutes() + step);
  return next;
};

export const formatTimelineValueFromTimestamp = (
  timestamp: number,
  mode: DatabaseTimelineMode,
) => {
  const date = new Date(timestamp);
  if (mode === "time") {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  if (mode === "datetime") {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

