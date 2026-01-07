/**
 * @file apps/fmd-desktop/vitest.config.ts
 *
 * Zweck:
 * - Konfiguriert den Vitest-Testlauf fuer das Frontend.
 *
 * Verantwortlichkeiten:
 * - Definiert Build- und Tooling-Optionen.
 * - Stellt zentrale Defaults fuer die Umgebung bereit.
 *
 * Verbunden mit:
 * - vitest/config: Externe Bibliothek.
 *
 * Exportiert:
 * - default: Tooling-Konfiguration.
 *
 * Hinweise:
 * - Aenderungen wirken sich auf Build- oder Testprozesse aus.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
