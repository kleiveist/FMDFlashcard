/**
 * @file apps/fmd-desktop/src/components/KpiGrid.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente Kpi Grid.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/spaced-repetition/components/SrStatsPanel.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - KpiGrid: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

type KpiItem = {
  label: string;
  value: number;
};

type KpiGridProps = {
  items: KpiItem[];
};

export const KpiGrid = ({ items }: KpiGridProps) => (
  <div className="kpi-grid">
    {items.map((kpi) => (
      <div key={kpi.label} className="kpi-card">
        <span className="kpi-label">{kpi.label}</span>
        <span className="kpi-value">{kpi.value}</span>
      </div>
    ))}
  </div>
);
