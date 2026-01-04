import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  type FlashcardSelfGrade,
  type TrueFalseSelection,
} from "../flashcards/logic";
import type { FlashcardOrder, FlashcardScope } from "../flashcards/useFlashcards";
import type { Flashcard } from "../../lib/flashcards";
import {
  buildSpacedRepetitionSession,
  createEmptySpacedRepetitionSession,
  createEmptySpacedRepetitionUserState,
  createSpacedRepetitionUserId,
  getFlashcardId,
  getSpacedRepetitionEffectiveBox,
  MAX_SPACED_REPETITION_BOX,
  normalizeSpacedRepetitionCardProgress,
  type SpacedRepetitionRepetitionStrength,
  type SpacedRepetitionSession,
  type SpacedRepetitionStorage,
  type SpacedRepetitionUser,
  type SpacedRepetitionUserState,
} from "./logic";

export type SpacedRepetitionPageSize = 1 | 2 | 3 | 5;
export type SpacedRepetitionBoxes = 3 | 5 | 8;
export type SpacedRepetitionOrder = "in-order" | "random" | "repetition";
export type SpacedRepetitionStatsView = "boxes" | "vault" | "completed";
export type { SpacedRepetitionRepetitionStrength };

export const SPACED_REPETITION_PAGE_SIZES: SpacedRepetitionPageSize[] = [
  1, 2, 3, 5,
];
export const DEFAULT_SPACED_REPETITION_PAGE_SIZE: SpacedRepetitionPageSize = 2;
export const SPACED_REPETITION_BOXES: SpacedRepetitionBoxes[] = [3, 5, 8];
const DAY_MS = 24 * 60 * 60 * 1000;
const BERLIN_TIME_ZONE = "Europe/Berlin";
const berlinDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BERLIN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const berlinWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BERLIN_TIME_ZONE,
  weekday: "short",
});

const buildBerlinDateKey = (date: Date) => {
  const parts = berlinDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  if (!year || !month || !day) {
    return berlinDateFormatter.format(date);
  }
  return `${year}-${month}-${day}`;
};

const buildBerlinWeekdayLabel = (date: Date) =>
  berlinWeekdayFormatter.format(date);

const buildLastSevenDays = (now = new Date()) => {
  const days: Date[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    days.push(new Date(now.getTime() - offset * DAY_MS));
  }
  return days;
};

const normalizeCompletedPerDay = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number" && Number.isFinite(count))
      .map(([key, count]) => [key, Math.max(0, Math.floor(count))]),
  );
};

const normalizeSpacedRepetitionPageSize = (value: number) => {
  if (value === 10) {
    return 5;
  }
  return SPACED_REPETITION_PAGE_SIZES.includes(value as SpacedRepetitionPageSize)
    ? (value as SpacedRepetitionPageSize)
    : DEFAULT_SPACED_REPETITION_PAGE_SIZE;
};

type UseSpacedRepetitionOptions = {
  isFlashcardScanning: boolean;
  scanFlashcards: (options?: {
    scopeOverride?: FlashcardScope;
    allowVaultFallback?: boolean;
    orderOverride?: FlashcardOrder;
  }) => Promise<Flashcard[]>;
  setIsFlashcardScanning: (value: boolean) => void;
  settings: {
    spacedRepetitionBoxes: SpacedRepetitionBoxes;
    spacedRepetitionOrder: SpacedRepetitionOrder;
    spacedRepetitionPageSize: SpacedRepetitionPageSize;
    spacedRepetitionRepetitionStrength: SpacedRepetitionRepetitionStrength;
    spacedRepetitionStatsView: SpacedRepetitionStatsView;
    setSpacedRepetitionBoxes: (value: SpacedRepetitionBoxes) => void;
    setSpacedRepetitionOrder: (value: SpacedRepetitionOrder) => void;
    setSpacedRepetitionPageSize: (value: SpacedRepetitionPageSize) => void;
    setSpacedRepetitionRepetitionStrength: (
      value: SpacedRepetitionRepetitionStrength,
    ) => void;
    setSpacedRepetitionStatsView: (value: SpacedRepetitionStatsView) => void;
  };
};

export const useSpacedRepetition = ({
  isFlashcardScanning,
  scanFlashcards,
  setIsFlashcardScanning,
  settings,
}: UseSpacedRepetitionOptions) => {
  const {
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionPageSize,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionStatsView,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionStatsView,
  } = settings;
  const [spacedRepetitionUsers, setSpacedRepetitionUsers] = useState<
    SpacedRepetitionUser[]
  >([]);
  const [spacedRepetitionActiveUserId, setSpacedRepetitionActiveUserId] =
    useState<string | null>(null);
  const [spacedRepetitionSelectedUserId, setSpacedRepetitionSelectedUserId] =
    useState<string>("");
  const [spacedRepetitionNewUserName, setSpacedRepetitionNewUserName] =
    useState("");
  const [spacedRepetitionUserError, setSpacedRepetitionUserError] =
    useState("");
  const [spacedRepetitionUserStateById, setSpacedRepetitionUserStateById] =
    useState<Record<string, SpacedRepetitionUserState>>({});
  const [spacedRepetitionDataLoaded, setSpacedRepetitionDataLoaded] =
    useState(false);
  const [spacedRepetitionSessions, setSpacedRepetitionSessions] = useState<
    Record<string, SpacedRepetitionSession>
  >({});

  const spacedRepetitionActiveUser = spacedRepetitionActiveUserId
    ? spacedRepetitionUsers.find((user) => user.id === spacedRepetitionActiveUserId)
        ?.name ?? null
    : null;
  const spacedRepetitionActiveUserState = spacedRepetitionActiveUserId
    ? spacedRepetitionUserStateById[spacedRepetitionActiveUserId] ?? null
    : null;
  const spacedRepetitionSession = spacedRepetitionActiveUserId
    ? spacedRepetitionSessions[spacedRepetitionActiveUserId]
    : undefined;
  const spacedRepetitionFlashcards = spacedRepetitionSession?.flashcards ?? [];
  const spacedRepetitionSelections = spacedRepetitionSession?.selections ?? {};
  const spacedRepetitionTextResponses =
    spacedRepetitionSession?.textResponses ?? {};
  const spacedRepetitionTextRevealed = spacedRepetitionSession?.textRevealed ?? {};
  const spacedRepetitionSelfGrades = spacedRepetitionSession?.selfGrades ?? {};
  const spacedRepetitionSubmissions =
    spacedRepetitionSession?.submissions ?? {};
  const spacedRepetitionTrueFalseSelections =
    spacedRepetitionSession?.trueFalseSelections ?? {};
  const spacedRepetitionClozeResponses =
    spacedRepetitionSession?.clozeResponses ?? {};
  const spacedRepetitionPage = spacedRepetitionSession?.page ?? 0;
  const spacedRepetitionCardStates =
    spacedRepetitionSession?.cardProgressById ??
    spacedRepetitionActiveUserState?.cardStates ??
    {};
  const spacedRepetitionCompletedPerDay =
    spacedRepetitionSession?.completedPerDay ??
    spacedRepetitionActiveUserState?.completedPerDay ??
    {};

  const resolvedSpacedRepetitionPageSize = useMemo(
    () => normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize),
    [spacedRepetitionPageSize],
  );

  const spacedRepetitionPageCount = useMemo(
    () =>
      Math.ceil(spacedRepetitionFlashcards.length / resolvedSpacedRepetitionPageSize),
    [resolvedSpacedRepetitionPageSize, spacedRepetitionFlashcards.length],
  );

  const spacedRepetitionPageIndex = useMemo(
    () =>
      Math.min(
        spacedRepetitionPage,
        Math.max(0, spacedRepetitionPageCount - 1),
      ),
    [spacedRepetitionPage, spacedRepetitionPageCount],
  );

  const spacedRepetitionPageStart =
    spacedRepetitionPageIndex * resolvedSpacedRepetitionPageSize;

  const spacedRepetitionVisibleFlashcards = useMemo(() => {
    return spacedRepetitionFlashcards.slice(
      spacedRepetitionPageStart,
      spacedRepetitionPageStart + resolvedSpacedRepetitionPageSize,
    );
  }, [
    resolvedSpacedRepetitionPageSize,
    spacedRepetitionFlashcards,
    spacedRepetitionPageStart,
  ]);

  const spacedRepetitionCanGoBack = spacedRepetitionPageIndex > 0;
  const spacedRepetitionCanGoNext =
    spacedRepetitionPageIndex < spacedRepetitionPageCount - 1;

  const spacedRepetitionStatusLabel =
    spacedRepetitionFlashcards.length === 0
      ? "No cards loaded yet"
      : `${spacedRepetitionFlashcards.length} cards loaded`;

  const spacedRepetitionEmptyState = spacedRepetitionActiveUser
    ? "Click the active user to load cards."
    : "Select a user to begin.";

  const {
    correctCount: spacedRepetitionCorrectCount,
    incorrectCount: spacedRepetitionIncorrectCount,
    total: spacedRepetitionTotalQuestions,
  } = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    let correct = 0;
    let incorrect = 0;
    cardStates.forEach((state) => {
      const normalized = normalizeSpacedRepetitionCardProgress(state);
      if (normalized.lastResult === "correct") {
        correct += 1;
      } else if (normalized.lastResult === "incorrect") {
        incorrect += 1;
      }
    });
    return { correctCount: correct, incorrectCount: incorrect, total: cardStates.length };
  }, [spacedRepetitionCardStates]);

  const spacedRepetitionCorrectPercent = useMemo(() => {
    const total = spacedRepetitionCorrectCount + spacedRepetitionIncorrectCount;
    if (total === 0) {
      return 0;
    }
    return Math.round((spacedRepetitionCorrectCount / total) * 100);
  }, [spacedRepetitionCorrectCount, spacedRepetitionIncorrectCount]);

  const spacedRepetitionProgressStats = useMemo(() => {
    const cardStates = Object.values(spacedRepetitionCardStates);
    const total = cardStates.length;
    if (total === 0) {
      return {
        dueNow: 0,
        dueToday: 0,
        inQueue: 0,
        completedToday: 0,
      };
    }

    const dueTodayThreshold = Math.min(2, spacedRepetitionBoxes);
    let dueNow = 0;
    let dueToday = 0;
    let completedEver = 0;

    for (const progress of cardStates) {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      if (normalized.attempts > 0) {
        completedEver += 1;
      }
      if (effectiveBox <= 1) {
        dueNow += 1;
      }
      if (effectiveBox <= dueTodayThreshold) {
        dueToday += 1;
      }
    }

    const todayKey = buildBerlinDateKey(new Date());
    const completedToday = todayKey
      ? spacedRepetitionCompletedPerDay[todayKey] ?? 0
      : 0;

    return {
      dueNow,
      dueToday,
      inQueue: total - completedEver,
      completedToday,
    };
  }, [
    spacedRepetitionBoxes,
    spacedRepetitionCardStates,
    spacedRepetitionCompletedPerDay,
  ]);

  const spacedRepetitionBoxCounts = useMemo(() => {
    const counts = Array.from({ length: spacedRepetitionBoxes }, () => 0);
    Object.values(spacedRepetitionCardStates).forEach((progress) => {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      const effectiveBox = getSpacedRepetitionEffectiveBox(
        normalized,
        spacedRepetitionBoxes,
      );
      const index = Math.max(1, Math.min(spacedRepetitionBoxes, effectiveBox)) - 1;
      counts[index] += 1;
    });
    return counts;
  }, [spacedRepetitionBoxes, spacedRepetitionCardStates]);

  const spacedRepetitionCompletedSeries = useMemo(() => {
    const days = buildLastSevenDays();
    const labels = days.map((day) => buildBerlinWeekdayLabel(day));
    const data = days.map((day) => {
      const key = buildBerlinDateKey(day);
      if (!key) {
        return 0;
      }
      return spacedRepetitionCompletedPerDay[key] ?? 0;
    });
    return { labels, data };
  }, [spacedRepetitionCompletedPerDay]);

  const updateActiveSpacedRepetitionSession = useCallback(
    (updater: (session: SpacedRepetitionSession) => SpacedRepetitionSession) => {
      if (!spacedRepetitionActiveUserId) {
        return;
      }
      setSpacedRepetitionSessions((prev) => {
        const current =
          prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionSession();
        const next = updater(current);
        if (next === current) {
          return prev;
        }
        return { ...prev, [spacedRepetitionActiveUserId]: next };
      });
    },
    [spacedRepetitionActiveUserId],
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSpacedRepetitionData = async () => {
      try {
        const storage = await invoke<SpacedRepetitionStorage>(
          "load_spaced_repetition_data",
        );
        if (cancelled) {
          return;
        }
        const users = Array.isArray(storage.users)
          ? storage.users
              .map((user) => {
                if (!user || typeof user !== "object") {
                  return null;
                }
                const id = "id" in user && typeof user.id === "string" ? user.id : "";
                const name =
                  "name" in user && typeof user.name === "string" ? user.name : "";
                if (!id || !name) {
                  return null;
                }
                const createdAt =
                  "createdAt" in user && typeof user.createdAt === "string"
                    ? user.createdAt
                    : new Date().toISOString();
                return { id, name, createdAt };
              })
              .filter((user): user is SpacedRepetitionUser => Boolean(user))
          : [];
        const userStateByIdRaw =
          storage.userStateById && typeof storage.userStateById === "object"
            ? storage.userStateById
            : {};
        const userIds = new Set(users.map((user) => user.id));
        const userStateById = Object.fromEntries(
          Object.entries(userStateByIdRaw)
            .filter(([userId]) => userIds.has(userId))
            .map(([userId, state]) => {
              const cardStatesRaw =
                state && typeof state === "object" && "cardStates" in state
                  ? (state as SpacedRepetitionUserState).cardStates
                  : {};
              const normalizedCardStates = Object.fromEntries(
                Object.entries(cardStatesRaw ?? {}).map(([cardId, progress]) => [
                  cardId,
                  normalizeSpacedRepetitionCardProgress(progress),
                ]),
              );
              const completedPerDayRaw =
                state && typeof state === "object" && "completedPerDay" in state
                  ? (state as SpacedRepetitionUserState).completedPerDay
                  : {};
              const completedPerDay = normalizeCompletedPerDay(completedPerDayRaw);
              const lastLoadedAt =
                state &&
                typeof state === "object" &&
                "lastLoadedAt" in state &&
                typeof (state as SpacedRepetitionUserState).lastLoadedAt === "string"
                  ? (state as SpacedRepetitionUserState).lastLoadedAt
                  : null;
              return [
                userId,
                {
                  cardStates: normalizedCardStates,
                  completedPerDay,
                  lastLoadedAt,
                },
              ];
            }),
        );
        const lastActiveUserId =
          storage.lastActiveUserId &&
          users.some((user) => user.id === storage.lastActiveUserId)
            ? storage.lastActiveUserId
            : null;

        setSpacedRepetitionUsers(users);
        setSpacedRepetitionUserStateById(userStateById);

        if (lastActiveUserId && users.some((user) => user.id === lastActiveUserId)) {
          setSpacedRepetitionActiveUserId(lastActiveUserId);
          setSpacedRepetitionSelectedUserId(lastActiveUserId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load spaced repetition data", error);
          setSpacedRepetitionUsers([]);
          setSpacedRepetitionUserStateById({});
          setSpacedRepetitionActiveUserId(null);
          setSpacedRepetitionSelectedUserId("");
        }
      } finally {
        if (!cancelled) {
          setSpacedRepetitionDataLoaded(true);
        }
      }
    };

    void restoreSpacedRepetitionData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!spacedRepetitionDataLoaded) {
      return;
    }
    const storage: SpacedRepetitionStorage = {
      users: spacedRepetitionUsers,
      userStateById: spacedRepetitionUserStateById,
      lastActiveUserId: spacedRepetitionActiveUserId,
    };
    void invoke("save_spaced_repetition_data", { storage }).catch((error) => {
      console.error("Failed to save spaced repetition data", error);
    });
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionDataLoaded,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
  ]);

  useEffect(() => {
    const normalized = normalizeSpacedRepetitionPageSize(spacedRepetitionPageSize);
    if (normalized !== spacedRepetitionPageSize) {
      setSpacedRepetitionPageSize(normalized);
    }
  }, [spacedRepetitionPageSize]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    setSpacedRepetitionSessions((prev) => {
      if (prev[spacedRepetitionActiveUserId]) {
        return prev;
      }
      const storedState =
        spacedRepetitionUserStateById[spacedRepetitionActiveUserId];
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...createEmptySpacedRepetitionSession(),
          cardProgressById: storedState?.cardStates ?? {},
          completedPerDay: storedState?.completedPerDay ?? {},
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionUserStateById]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const maxPage = Math.max(0, spacedRepetitionPageCount - 1);
    if (spacedRepetitionPage > maxPage) {
      updateActiveSpacedRepetitionSession((session) => ({
        ...session,
        page: maxPage,
      }));
    }
  }, [
    spacedRepetitionActiveUserId,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    updateActiveSpacedRepetitionSession,
  ]);

  useEffect(() => {
    if (!spacedRepetitionActiveUserId) {
      return;
    }
    const session = spacedRepetitionSessions[spacedRepetitionActiveUserId];
    if (!session) {
      return;
    }
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionActiveUserId] ?? createEmptySpacedRepetitionUserState();
      if (
        current.cardStates === session.cardProgressById &&
        current.completedPerDay === session.completedPerDay
      ) {
        return prev;
      }
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...current,
          cardStates: session.cardProgressById,
          completedPerDay: session.completedPerDay,
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionSessions]);

  const handleSpacedRepetitionCreateUser = useCallback(() => {
    const trimmed = spacedRepetitionNewUserName.trim();
    if (!trimmed) {
      setSpacedRepetitionUserError("User name is required.");
      return;
    }
    const normalized = trimmed.toLowerCase();
    const hasDuplicate = spacedRepetitionUsers.some(
      (user) => user.name.trim().toLowerCase() === normalized,
    );
    if (hasDuplicate) {
      setSpacedRepetitionUserError("User name already exists.");
      return;
    }

    const newUser: SpacedRepetitionUser = {
      id: createSpacedRepetitionUserId(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    };

    setSpacedRepetitionUsers((prev) => [...prev, newUser]);
    setSpacedRepetitionUserStateById((prev) => ({
      ...prev,
      [newUser.id]: createEmptySpacedRepetitionUserState(),
    }));
    setSpacedRepetitionActiveUserId(newUser.id);
    setSpacedRepetitionSelectedUserId(newUser.id);
    setSpacedRepetitionNewUserName("");
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionNewUserName, spacedRepetitionUsers]);

  const handleSpacedRepetitionLoadUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    setSpacedRepetitionActiveUserId(spacedRepetitionSelectedUserId);
    setSpacedRepetitionUserStateById((prev) => {
      const current =
        prev[spacedRepetitionSelectedUserId] ?? createEmptySpacedRepetitionUserState();
      return {
        ...prev,
        [spacedRepetitionSelectedUserId]: {
          ...current,
          lastLoadedAt: new Date().toISOString(),
        },
      };
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionDeleteUser = useCallback(() => {
    if (!spacedRepetitionSelectedUserId) {
      return;
    }
    const deletedId = spacedRepetitionSelectedUserId;

    setSpacedRepetitionSessions((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUserStateById((prev) => {
      if (!prev[deletedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[deletedId];
      return next;
    });
    setSpacedRepetitionUsers((prev) => {
      const next = prev.filter((user) => user.id !== deletedId);
      const nextSelected = next[0]?.id ?? "";
      if (spacedRepetitionActiveUserId === deletedId) {
        setSpacedRepetitionActiveUserId(null);
      }
      setSpacedRepetitionSelectedUserId(nextSelected);
      return next;
    });
    setSpacedRepetitionUserError("");
  }, [spacedRepetitionActiveUserId, spacedRepetitionSelectedUserId]);

  const handleSpacedRepetitionActiveUserLoadCards = useCallback(async (
    options?: { boxFilter?: number | null },
  ) => {
    if (!spacedRepetitionActiveUserId || isFlashcardScanning) {
      return;
    }
    const activeUserId = spacedRepetitionActiveUserId;
    const boxFilter =
      typeof options?.boxFilter === "number" ? options.boxFilter : null;
    setIsFlashcardScanning(true);
    try {
      const cards = await scanFlashcards({
        scopeOverride: "vault",
        orderOverride: "in-order",
      });
      const storedCardStates =
        spacedRepetitionUserStateById[activeUserId]?.cardStates ?? {};
      const storedCompletedPerDay =
        spacedRepetitionUserStateById[activeUserId]?.completedPerDay ?? {};
      const loadOrder =
        boxFilter && spacedRepetitionOrder === "repetition"
          ? "in-order"
          : spacedRepetitionOrder;
      const nextSession = buildSpacedRepetitionSession(cards, storedCardStates, {
        order: loadOrder,
        boxCount: spacedRepetitionBoxes,
        repetitionStrength: spacedRepetitionRepetitionStrength,
      });
      const filteredSession =
        boxFilter === null
          ? nextSession
          : (() => {
              const entries = nextSession.flashcards.map((card, index) => {
                const cardId = nextSession.cardIds[index] ?? getFlashcardId(card);
                const progress = normalizeSpacedRepetitionCardProgress(
                  nextSession.cardProgressById[cardId],
                );
                return {
                  card,
                  cardId,
                  effectiveBox: getSpacedRepetitionEffectiveBox(
                    progress,
                    spacedRepetitionBoxes,
                  ),
                };
              });
              const filteredEntries = entries.filter(
                (entry) => entry.effectiveBox === boxFilter,
              );
              return {
                ...nextSession,
                flashcards: filteredEntries.map((entry) => entry.card),
                cardIds: filteredEntries.map((entry) => entry.cardId),
                page: 0,
              };
            })();
      setSpacedRepetitionSessions((prev) => ({
        ...prev,
        [activeUserId]: {
          ...filteredSession,
          completedPerDay: storedCompletedPerDay,
        },
      }));
      setSpacedRepetitionUserStateById((prev) => {
        const current = prev[activeUserId] ?? createEmptySpacedRepetitionUserState();
        return {
          ...prev,
          [activeUserId]: {
            ...current,
            cardStates: nextSession.cardProgressById,
            lastLoadedAt: new Date().toISOString(),
          },
        };
      });
    } finally {
      setIsFlashcardScanning(false);
    }
  }, [
    isFlashcardScanning,
    scanFlashcards,
    setIsFlashcardScanning,
    spacedRepetitionActiveUserId,
    spacedRepetitionBoxes,
    spacedRepetitionOrder,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionUserStateById,
  ]);

  const handleSpacedRepetitionOptionSelect = useCallback(
    (cardIndex: number, keys: string[]) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const uniqueKeys = Array.from(new Set(keys));
        return {
          ...session,
          selections: { ...session.selections, [cardIndex]: uniqueKeys },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTrueFalseSelect = useCallback(
    (cardIndex: number, itemId: string, value: TrueFalseSelection) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.trueFalseSelections[cardIndex] ?? {}) };
        current[itemId] = value;
        return {
          ...session,
          trueFalseSelections: {
            ...session.trueFalseSelections,
            [cardIndex]: current,
          },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionSubmit = useCallback(
    (cardIndex: number, canSubmit: boolean, selfGrade?: FlashcardSelfGrade) => {
      if (!canSubmit) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const card = session.flashcards[cardIndex];
        if (!card) {
          return session;
        }
        const cardIds =
          session.cardIds.length === session.flashcards.length
            ? session.cardIds
            : session.flashcards.map(getFlashcardId);
        const cardId = cardIds[cardIndex] ?? getFlashcardId(card);
        const nextSelfGrades = selfGrade
          ? { ...session.selfGrades, [cardIndex]: selfGrade }
          : session.selfGrades;
        const result =
          selfGrade ??
          evaluateFlashcardResult(
            card,
            cardIndex,
            session.selections,
            session.trueFalseSelections,
            session.clozeResponses,
            nextSelfGrades,
          );
        const currentProgress = normalizeSpacedRepetitionCardProgress(
          session.cardProgressById[cardId],
        );
        const effectiveBox = getSpacedRepetitionEffectiveBox(
          currentProgress,
          spacedRepetitionBoxes,
        );
        const baseBox =
          currentProgress.boxCanonical > spacedRepetitionBoxes
            ? effectiveBox
            : currentProgress.boxCanonical;
        let nextBox = baseBox;
        if (result === "correct") {
          nextBox = Math.min(baseBox + 1, MAX_SPACED_REPETITION_BOX);
        } else if (result === "incorrect") {
          nextBox = Math.max(baseBox - 1, 1);
        }
        const nextProgress = {
          boxCanonical: nextBox,
          attempts: currentProgress.attempts + 1,
          lastResult: result,
          lastReviewedAt: new Date().toISOString(),
        };
        const todayKey = buildBerlinDateKey(new Date());
        const nextCompletedPerDay = todayKey
          ? {
              ...session.completedPerDay,
              [todayKey]: (session.completedPerDay[todayKey] ?? 0) + 1,
            }
          : session.completedPerDay;

        return {
          ...session,
          cardIds,
          submissions: { ...session.submissions, [cardIndex]: true },
          selfGrades: nextSelfGrades,
          cardProgressById: {
            ...session.cardProgressById,
            [cardId]: nextProgress,
          },
          completedPerDay: nextCompletedPerDay,
        };
      });
    },
    [spacedRepetitionBoxes, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTextInputChange = useCallback(
    (cardIndex: number, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textResponses: { ...session.textResponses, [cardIndex]: value },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionTextCheck = useCallback(
    (cardIndex: number) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex] || session.textRevealed[cardIndex]) {
          return session;
        }
        return {
          ...session,
          textRevealed: { ...session.textRevealed, [cardIndex]: true },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionSelfGrade = useCallback(
    (cardIndex: number, grade: FlashcardSelfGrade) => {
      handleSpacedRepetitionSubmit(cardIndex, true, grade);
    },
    [handleSpacedRepetitionSubmit],
  );

  const handleSpacedRepetitionPageBack = useCallback(() => {
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.max(0, session.page - 1),
    }));
  }, [updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionPageNext = useCallback(() => {
    if (spacedRepetitionPageCount <= 0) {
      return;
    }
    updateActiveSpacedRepetitionSession((session) => ({
      ...session,
      page: Math.min(spacedRepetitionPageCount - 1, session.page + 1),
    }));
  }, [spacedRepetitionPageCount, updateActiveSpacedRepetitionSession]);

  const handleSpacedRepetitionClozeInputChange = useCallback(
    (cardIndex: number, blankId: string, value: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        current[blankId] = value;
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionClozeTokenDrop = useCallback(
    (
      event: DragEvent<HTMLElement>,
      cardIndex: number,
      blankId: string,
      validTokenIds: Set<string>,
      dragBlankIds: Set<string>,
    ) => {
      event.preventDefault();
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      const payload = getClozeDragPayload(event);
      if (!payload || payload.cardIndex !== cardIndex) {
        return;
      }
      if (payload.tokenId === blankId) {
        return;
      }
      if (!validTokenIds.has(payload.tokenId)) {
        return;
      }

      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        const existingBlankId = Object.entries(current).find(
          ([key, value]) => value === payload.tokenId && key !== blankId,
        )?.[0];
        if (existingBlankId) {
          delete current[existingBlankId];
        }
        if (dragBlankIds.has(blankId)) {
          current[blankId] = payload.tokenId;
        }
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  const handleSpacedRepetitionClozeTokenRemove = useCallback(
    (cardIndex: number, blankId: string) => {
      if (spacedRepetitionSubmissions[cardIndex]) {
        return;
      }
      updateActiveSpacedRepetitionSession((session) => {
        const current = { ...(session.clozeResponses[cardIndex] ?? {}) };
        delete current[blankId];
        return {
          ...session,
          clozeResponses: { ...session.clozeResponses, [cardIndex]: current },
        };
      });
    },
    [spacedRepetitionSubmissions, updateActiveSpacedRepetitionSession],
  );

  return {
    handleSpacedRepetitionActiveUserLoadCards,
    handleSpacedRepetitionClozeInputChange,
    handleSpacedRepetitionClozeTokenDrop,
    handleSpacedRepetitionClozeTokenRemove,
    handleSpacedRepetitionCreateUser,
    handleSpacedRepetitionDeleteUser,
    handleSpacedRepetitionLoadUser,
    handleSpacedRepetitionOptionSelect,
    handleSpacedRepetitionPageBack,
    handleSpacedRepetitionPageNext,
    handleSpacedRepetitionSelfGrade,
    handleSpacedRepetitionSubmit,
    handleSpacedRepetitionTextCheck,
    handleSpacedRepetitionTextInputChange,
    handleSpacedRepetitionTrueFalseSelect,
    setSpacedRepetitionActiveUserId,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionNewUserName,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionRepetitionStrength,
    setSpacedRepetitionSelectedUserId,
    setSpacedRepetitionStatsView,
    setSpacedRepetitionUserError,
    spacedRepetitionActiveUser,
    spacedRepetitionBoxes,
    spacedRepetitionBoxCounts,
    spacedRepetitionCanGoBack,
    spacedRepetitionCanGoNext,
    spacedRepetitionClozeResponses,
    spacedRepetitionCompletedChartData: spacedRepetitionCompletedSeries.data,
    spacedRepetitionCompletedChartLabels: spacedRepetitionCompletedSeries.labels,
    spacedRepetitionCorrectCount,
    spacedRepetitionCorrectPercent,
    spacedRepetitionDataLoaded,
    spacedRepetitionEmptyState,
    spacedRepetitionFlashcards,
    spacedRepetitionIncorrectCount,
    spacedRepetitionNewUserName,
    spacedRepetitionOrder,
    spacedRepetitionPage,
    spacedRepetitionPageCount,
    spacedRepetitionPageSize,
    spacedRepetitionPageStart,
    spacedRepetitionCardStates,
    spacedRepetitionProgressStats,
    spacedRepetitionRepetitionStrength,
    spacedRepetitionSelectedUserId,
    spacedRepetitionSelections,
    spacedRepetitionSessions,
    spacedRepetitionStatusLabel,
    spacedRepetitionStatsView,
    spacedRepetitionSubmissions,
    spacedRepetitionTextRevealed,
    spacedRepetitionTextResponses,
    spacedRepetitionSelfGrades,
    spacedRepetitionTotalQuestions,
    spacedRepetitionTrueFalseSelections,
    spacedRepetitionUserError,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
    spacedRepetitionVisibleFlashcards,
    updateActiveSpacedRepetitionSession,
  };
};
