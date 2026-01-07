/**
 * @file apps/fmd-desktop/src/lib/exam.test.ts
 *
 * Zweck:
 * - Testet exam.test und zugehoerige Logik.
 *
 * Verantwortlichkeiten:
 * - Prueft erwartetes Verhalten und Randfaelle.
 * - Sichert Regressionen fuer zentrale Szenarien.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/exam.ts: Hilfsfunktionen oder Typen.
 * - vitest: Externe Bibliothek.
 *
 * Hinweise:
 * - Nur fuer Testlauf; keine Produktivnutzung.
 */

import { describe, expect, it } from "vitest";
import { parseExamTasks } from "./exam";

describe("parseExamTasks", () => {
  it("splits inline Answer markers in exam tasks without flashcard syntax", () => {
    const markdown = `#exam
1) Define foreign key. Answer: A foreign key is an attribute.
#`;

    const { tasks } = parseExamTasks(markdown);

    expect(tasks).toHaveLength(1);
    const part = tasks[0]?.card.parts[0];
    expect(part?.kind).toBe("free-text");
    if (part && part.kind === "free-text") {
      expect(part.front).toBe("1) Define foreign key.");
      expect(part.back).toBe("A foreign key is an attribute.");
    }
  });
});
