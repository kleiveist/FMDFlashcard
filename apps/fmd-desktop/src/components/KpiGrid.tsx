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
