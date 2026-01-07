/**
 * @file apps/fmd-desktop/src/pages/spaced-repetition/components/SrStatsPanel.tsx
 *
 * Zweck:
 * - Rendert die Seite Sr Stats Panel.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/KpiGrid.tsx: UI-Komponente.
 * - apps/fmd-desktop/src/pages/spaced-repetition/SpacedRepetitionPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SrStatsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { KpiGrid } from "../../../components/KpiGrid";

type SrStatsPanelProps = {
  kpiItems: { label: string; value: number }[];
};

export const SrStatsPanel = ({ kpiItems }: SrStatsPanelProps) => (
  <section className="panel stats-panel sr-stats-panel">
    <div className="panel-header">
      <div>
        <h2>Statistics</h2>
      </div>
    </div>
    <div className="panel-body">
      <KpiGrid items={kpiItems} />
    </div>
  </section>
);
