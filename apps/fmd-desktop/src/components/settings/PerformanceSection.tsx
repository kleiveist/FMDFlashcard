type PerformanceSectionProps = {
  maxFilesPerScan: string;
  onMaxFilesPerScanChange: (value: string) => void;
  scanParallelism: "low" | "medium" | "high";
  setScanParallelism: (value: "low" | "medium" | "high") => void;
};

export const PerformanceSection = ({
  maxFilesPerScan,
  onMaxFilesPerScanChange,
  scanParallelism,
  setScanParallelism,
}: PerformanceSectionProps) => (
  <section className="panel performance-panel">
    <h2>Performance</h2>
    <p className="muted">Tune vault scans for larger libraries.</p>
    <div className="setting-row">
      <span className="label">Max files per vault scan</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="text-input"
        value={maxFilesPerScan}
        onChange={(event) => onMaxFilesPerScanChange(event.target.value)}
        placeholder="Optional"
        aria-label="Max files per vault scan"
      />
      <span className="helper-text">Leave empty for no limit.</span>
    </div>
    <div className="setting-row">
      <span className="label">Scan parallelism</span>
      <div className="pill-grid">
        {(["low", "medium", "high"] as const).map((level) => (
          <button
            key={level}
            type="button"
            className={`pill pill-button ${scanParallelism === level ? "active" : ""}`}
            aria-pressed={scanParallelism === level}
            onClick={() => setScanParallelism(level)}
          >
            {level.charAt(0).toUpperCase() + level.slice(1)}
          </button>
        ))}
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Watcher debounce/throttle</span>
      <input
        type="text"
        className="text-input"
        value="Coming later"
        disabled
        aria-label="Watcher debounce or throttle (coming later)"
      />
    </div>
  </section>
);
