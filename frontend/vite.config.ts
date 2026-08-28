/**
 * @file frontend/vite.config.ts
 *
 * Zweck:
 * - Konfiguriert den Vite-Build fuer das Desktop-Frontend.
 *
 * Verantwortlichkeiten:
 * - Definiert Build- und Tooling-Optionen.
 * - Stellt zentrale Defaults fuer die Umgebung bereit.
 *
 * Verbunden mit:
 * - vite: Externe Bibliothek.
 * - @vitejs/plugin-react: Externe Bibliothek.
 *
 * Exportiert:
 * - default: Tooling-Konfiguration.
 *
 * Hinweise:
 * - Aenderungen wirken sich auf Build- oder Testprozesse aus.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  base: "./",

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
