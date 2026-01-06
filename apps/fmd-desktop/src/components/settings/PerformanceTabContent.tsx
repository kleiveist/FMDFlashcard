type PerformanceTabContentProps = {
  maxFilesPerScan: string;
  onMaxFilesPerScanChange: (value: string) => void;
  scanParallelism: "low" | "medium" | "high";
  setScanParallelism: (value: "low" | "medium" | "high") => void;
};

export const PerformanceTabContent = ({
  maxFilesPerScan,
  onMaxFilesPerScanChange,
  scanParallelism,
  setScanParallelism,
}: PerformanceTabContentProps) => (
  <>
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
      <span className="helper-text">
        Leave empty to disable the large vault warning.
      </span>
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
  </>
);
