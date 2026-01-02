export const DataSyncSection = () => (
  <section className="panel data-sync-panel">
    <h2>Data &amp; Sync</h2>
    <p className="muted">Storage and sync options will land here later.</p>
    <div className="setting-row">
      <span className="label">Local storage path</span>
      <input
        type="text"
        className="text-input"
        value="—"
        disabled
        aria-label="Local storage path"
      />
    </div>
    <div className="setting-row">
      <span className="label">Export / Import (JSON)</span>
      <div className="setting-actions">
        <button type="button" className="ghost small" disabled>
          Export JSON
        </button>
        <button type="button" className="ghost small" disabled>
          Import JSON
        </button>
      </div>
      <span className="helper-text">Coming later.</span>
    </div>
    <div className="setting-row">
      <span className="label">Sync provider</span>
      <input
        type="text"
        className="text-input"
        value="Coming later"
        disabled
        aria-label="Sync provider"
      />
    </div>
  </section>
);
