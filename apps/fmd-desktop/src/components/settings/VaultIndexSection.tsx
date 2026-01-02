import { type LoadState } from "../../lib/types";

type VaultIndexSectionProps = {
  lastOpenedFile: string | null;
  listState: LoadState;
  onCopyVaultPath: () => void;
  onRescanVault: () => void;
  vaultIndexedComplete: boolean;
  vaultPath: string | null;
};

export const VaultIndexSection = ({
  lastOpenedFile,
  listState,
  onCopyVaultPath,
  onRescanVault,
  vaultIndexedComplete,
  vaultPath,
}: VaultIndexSectionProps) => (
  <section className="panel vault-index-panel">
    <div>
      <h2>Vault &amp; Index</h2>
      <p className="muted">Vault path, last opened note, and index status.</p>
    </div>
    <div className="setting-row">
      <span className="label">Current vault path</span>
      <div className="setting-inline">
        <span className="value path-value">{vaultPath ?? "—"}</span>
        <button
          type="button"
          className="ghost small"
          onClick={onCopyVaultPath}
          disabled={!vaultPath}
        >
          Copy
        </button>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Last opened</span>
      <span className="value path-value">{lastOpenedFile ?? "Not loaded yet"}</span>
    </div>
    <div className="setting-row">
      <span className="label">Status indicators</span>
      <div className="status-list">
        <div className="status-item">
          <label className="status-checkbox">
            <input
              type="checkbox"
              checked={vaultIndexedComplete}
              disabled
              aria-label="Fully processed"
            />
            <span>Fully processed</span>
          </label>
          <span className="helper-text">All notes have been scanned and indexed.</span>
        </div>
        <div className="status-item">
          <div className="status-row">
            <span>Watcher active</span>
            <div className="toggle-row">
              <span className="toggle-label">Coming later</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  aria-label="Watcher active (coming later)"
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
        <div className="status-item">
          <div className="status-row">
            <span>Auto-scan</span>
            <div className="toggle-row">
              <span className="toggle-label">Coming later</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  aria-label="Auto-scan (coming later)"
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="setting-row">
      <span className="label">Actions</span>
      <div className="setting-actions">
        <button
          type="button"
          className="ghost small"
          onClick={onRescanVault}
          disabled={!vaultPath || listState === "loading"}
        >
          Rescan vault
        </button>
        <button type="button" className="ghost small" disabled>
          Reset index
        </button>
      </div>
      <span className="helper-text">Reset index is coming later.</span>
    </div>
  </section>
);
