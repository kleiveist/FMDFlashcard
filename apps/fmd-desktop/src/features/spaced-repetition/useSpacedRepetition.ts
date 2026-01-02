import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  evaluateFlashcardResult,
  getClozeDragPayload,
  type TrueFalseSelection,
} from "../flashcards/logic";
import type { FlashcardScope } from "../flashcards/useFlashcards";
import type { Flashcard } from "../../lib/flashcards";
import {
  buildSpacedRepetitionSession,
  createEmptySpacedRepetitionSession,
  createEmptySpacedRepetitionUserState,
  createSpacedRepetitionUserId,
  getFlashcardId,
  normalizeSpacedRepetitionCardProgress,
  type SpacedRepetitionCardProgress,
  type SpacedRepetitionSession,
  type SpacedRepetitionStorage,
  type SpacedRepetitionUser,
  type SpacedRepetitionUserState,
} from "./logic";

export type SpacedRepetitionPageSize = 1 | 2 | 5 | 10;
export type SpacedRepetitionBoxes = 3 | 5 | 8;
export type SpacedRepetitionOrder = "in-order" | "random" | "repetition";

export const SPACED_REPETITION_PAGE_SIZES: SpacedRepetitionPageSize[] = [
  1, 2, 5, 10,
];
export const DEFAULT_SPACED_REPETITION_PAGE_SIZE: SpacedRepetitionPageSize = 2;
export const SPACED_REPETITION_BOXES: SpacedRepetitionBoxes[] = [3, 5, 8];
export const SPACED_REPETITION_CHART_LABELS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];
export const SPACED_REPETITION_CHART_DATA = [1, 3, 2, 4, 3, 5, 4];

const normalizeSpacedRepetitionPageSize = (value: number) =>
  SPACED_REPETITION_PAGE_SIZES.includes(value as SpacedRepetitionPageSize)
    ? (value as SpacedRepetitionPageSize)
    : DEFAULT_SPACED_REPETITION_PAGE_SIZE;

type UseSpacedRepetitionOptions = {
  isFlashcardScanning: boolean;
  scanFlashcards: (options?: {
    scopeOverride?: FlashcardScope;
    allowVaultFallback?: boolean;
  }) => Promise<Flashcard[]>;
  setIsFlashcardScanning: (value: boolean) => void;
};

export const useSpacedRepetition = ({
  isFlashcardScanning,
  scanFlashcards,
  setIsFlashcardScanning,
}: UseSpacedRepetitionOptions) => {
  const [spacedRepetitionPageSize, setSpacedRepetitionPageSize] =
    useState<SpacedRepetitionPageSize>(DEFAULT_SPACED_REPETITION_PAGE_SIZE);
  const [spacedRepetitionBoxes, setSpacedRepetitionBoxes] =
    useState<SpacedRepetitionBoxes>(5);
  const [spacedRepetitionOrder, setSpacedRepetitionOrder] =
    useState<SpacedRepetitionOrder>("in-order");
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
  const spacedRepetitionSubmissions =
    spacedRepetitionSession?.submissions ?? {};
  const spacedRepetitionTrueFalseSelections =
    spacedRepetitionSession?.trueFalseSelections ?? {};
  const spacedRepetitionClozeResponses =
    spacedRepetitionSession?.clozeResponses ?? {};
  const spacedRepetitionPage = spacedRepetitionSession?.page ?? 0;
  const spacedRepetitionCardStates =
    spacedRepetitionActiveUserState?.cardStates ??
    spacedRepetitionSession?.cardProgressById ??
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
    let completedToday = 0;

    for (const progress of cardStates) {
      const normalized = normalizeSpacedRepetitionCardProgress(progress);
      if (normalized.attempts > 0) {
        completedToday += 1;
      }
      if (normalized.box <= 1) {
        dueNow += 1;
      }
      if (normalized.box <= dueTodayThreshold) {
        dueToday += 1;
      }
    }

    return {
      dueNow,
      dueToday,
      inQueue: total - completedToday,
      completedToday,
    };
  }, [spacedRepetitionBoxes, spacedRepetitionCardStates]);

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
        },
      };
    });
  }, [spacedRepetitionActiveUserId, spacedRepetitionUserStateById]);

  useEffect(() => {
    setSpacedRepetitionSessions((prev) => {
      let changed = false;
      const next: Record<string, SpacedRepetitionSession> = {};

      Object.entries(prev).forEach(([user, session]) => {
        let progressChanged = false;
        const nextProgress: Record<string, SpacedRepetitionCardProgress> = {};

        Object.entries(session.cardProgressById).forEach(([cardId, progress]) => {
          const normalized = normalizeSpacedRepetitionCardProgress(progress);
          const clampedBox = Math.min(normalized.box, spacedRepetitionBoxes);
          if (clampedBox !== normalized.box) {
            progressChanged = true;
            nextProgress[cardId] = { ...normalized, box: clampedBox };
          } else {
            nextProgress[cardId] = normalized;
          }
        });

        if (progressChanged) {
          changed = true;
          next[user] = {
            ...session,
            cardProgressById: nextProgress,
          };
        } else {
          next[user] = session;
        }
      });

      return changed ? next : prev;
    });
  }, [spacedRepetitionBoxes]);

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
      if (current.cardStates === session.cardProgressById) {
        return prev;
      }
      return {
        ...prev,
        [spacedRepetitionActiveUserId]: {
          ...current,
          cardStates: session.cardProgressById,
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

  const handleSpacedRepetitionActiveUserLoadCards = useCallback(async () => {
    if (!spacedRepetitionActiveUserId || isFlashcardScanning) {
      return;
    }
    const activeUserId = spacedRepetitionActiveUserId;
    setIsFlashcardScanning(true);
    try {
      const cards = await scanFlashcards({ allowVaultFallback: true });
      const storedCardStates =
        spacedRepetitionUserStateById[activeUserId]?.cardStates ?? {};
      const nextSession = buildSpacedRepetitionSession(cards, storedCardStates);
      setSpacedRepetitionSessions((prev) => ({
        ...prev,
        [activeUserId]: nextSession,
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
    spacedRepetitionUserStateById,
  ]);

  const handleSpacedRepetitionOptionSelect = useCallback(
    (cardIndex: number, key: string) => {
      updateActiveSpacedRepetitionSession((session) => {
        if (session.submissions[cardIndex]) {
          return session;
        }
        return {
          ...session,
          selections: { ...session.selections, [cardIndex]: key },
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
    (cardIndex: number, canSubmit: boolean) => {
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
        const result = evaluateFlashcardResult(
          card,
          cardIndex,
          session.selections,
          session.trueFalseSelections,
          session.clozeResponses,
        );
        const currentProgress = normalizeSpacedRepetitionCardProgress(
          session.cardProgressById[cardId],
        );
        const nextProgress = {
          box: currentProgress.box,
          attempts: currentProgress.attempts + 1,
          lastResult: result,
          lastReviewedAt: new Date().toISOString(),
        };
        if (result === "correct") {
          nextProgress.box = Math.min(currentProgress.box + 1, spacedRepetitionBoxes);
        } else if (result === "incorrect") {
          nextProgress.box = 1;
        }

        return {
          ...session,
          cardIds,
          submissions: { ...session.submissions, [cardIndex]: true },
          cardProgressById: {
            ...session.cardProgressById,
            [cardId]: nextProgress,
          },
        };
      });
    },
    [spacedRepetitionBoxes, updateActiveSpacedRepetitionSession],
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
    handleSpacedRepetitionSubmit,
    handleSpacedRepetitionTrueFalseSelect,
    setSpacedRepetitionActiveUserId,
    setSpacedRepetitionBoxes,
    setSpacedRepetitionNewUserName,
    setSpacedRepetitionOrder,
    setSpacedRepetitionPageSize,
    setSpacedRepetitionSelectedUserId,
    setSpacedRepetitionUserError,
    spacedRepetitionActiveUser,
    spacedRepetitionBoxes,
    spacedRepetitionCanGoBack,
    spacedRepetitionCanGoNext,
    spacedRepetitionClozeResponses,
    spacedRepetitionCorrectCount,
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
    spacedRepetitionProgressStats,
    spacedRepetitionSelectedUserId,
    spacedRepetitionSelections,
    spacedRepetitionSessions,
    spacedRepetitionStatusLabel,
    spacedRepetitionSubmissions,
    spacedRepetitionTotalQuestions,
    spacedRepetitionTrueFalseSelections,
    spacedRepetitionUserError,
    spacedRepetitionUserStateById,
    spacedRepetitionUsers,
    spacedRepetitionVisibleFlashcards,
    updateActiveSpacedRepetitionSession,
  };
};
