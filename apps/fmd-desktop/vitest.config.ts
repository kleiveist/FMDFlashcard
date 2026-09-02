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

const runtime = globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};
const env = runtime.process?.env ?? {};
const reportDirectory = env.FMD_FRONTEND_REPORT_DIR ?? "../../.reports/frontend";
const junitOutputFile = env.FMD_JUNIT_OUTPUT_FILE;

export default defineConfig({
  test: {
    environment: "node",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
    reporters: junitOutputFile ? ["default", "junit"] : ["default"],
    outputFile: junitOutputFile ? { junit: junitOutputFile } : undefined,
    fileParallelism: false,
    minWorkers: 1,
    maxWorkers: 1,
    pool: "forks",
    teardownTimeout: 3000,
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reportsDirectory: `${reportDirectory}/coverage`,
      reporter: ["text", "json-summary", "lcov", "cobertura"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.d.ts"],
      thresholds: {
        statements: 60,
        branches: 70,
        functions: 65,
        lines: 60,
      },
    },
  },
});
