import { ChevronDownIcon } from "./icons";

type CollapsiblePanelHeaderProps = {
  title: string;
  description?: string;
  isCollapsed: boolean;
  onToggle: () => void;
  controlsId: string;
};

export const CollapsiblePanelHeader = ({
  title,
  description,
  isCollapsed,
  onToggle,
  controlsId,
}: CollapsiblePanelHeaderProps) => (
  <button
    type="button"
    className="panel-header panel-header-toggle"
    onClick={onToggle}
    aria-expanded={!isCollapsed}
    aria-controls={controlsId}
  >
    <span className="panel-header-content">
      <h2>{title}</h2>
      {description ? <p className="muted">{description}</p> : null}
    </span>
    <span
      className={`panel-header-chevron ${isCollapsed ? "" : "is-open"}`}
      aria-hidden="true"
    >
      <ChevronDownIcon />
    </span>
  </button>
);
