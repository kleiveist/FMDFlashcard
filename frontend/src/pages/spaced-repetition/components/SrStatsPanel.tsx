/**
 * @file frontend/src/pages/spaced-repetition/components/SrStatsPanel.tsx
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
 * - frontend/src/components/KpiGrid.tsx: UI-Komponente.
 * - frontend/src/pages/spaced-repetition/SpacedRepetitionPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - SrStatsPanel: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

import { KpiGrid } from "../../../components/KpiGrid";
import { CollapsiblePanelHeader } from "../../../components/CollapsiblePanelHeader";

type SrStatsPanelProps = {
  kpiItems: { label: string; value: number }[];
  isCollapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  controlsId?: string;
};

export const SrStatsPanel = ({
  kpiItems,
  isCollapsible = false,
  isCollapsed = false,
  onToggleCollapse,
  controlsId,
}: SrStatsPanelProps) => (
  <section className="panel stats-panel sr-stats-panel">
    {isCollapsible && onToggleCollapse && controlsId ? (
      <CollapsiblePanelHeader
        title="Statistics"
        isCollapsed={isCollapsed}
        onToggle={onToggleCollapse}
        controlsId={controlsId}
      />
    ) : (
      <div className="panel-header">
        <div>
          <h2>Statistics</h2>
        </div>
      </div>
    )}
    <div
      className="panel-body"
      id={controlsId}
      hidden={Boolean(isCollapsible && isCollapsed)}
      aria-hidden={Boolean(isCollapsible && isCollapsed)}
    >
      <KpiGrid items={kpiItems} />
    </div>
  </section>
);
