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
