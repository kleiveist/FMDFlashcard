/**
 * @file apps/fmd-desktop/src/lib/chart.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Chart.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Chart bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrStatsAndChart.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const buildLineChartPoints = (values: number[]) => {
  if (values.length === 0) {
    return "";
  }
  const maxValue = Math.max(1, ...values);
  const step = values.length === 1 ? 0 : 100 / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = 40 - (value / maxValue) * 30;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
};
