import { Tooltip } from "../../../components/Tooltip";
import { getMathToolbarGroups } from "./palette";
import { MathToolbarIcon } from "./MathToolbarIcons";

export const MathPalettePane = ({
  onTemplateSelect,
}: {
  onTemplateSelect: (templateId: string) => void;
}) => {
  const groups = getMathToolbarGroups();

  return (
    <div className="markdown-hybrid-structural-math-palette" aria-label="Math insert toolbar">
      <div className="markdown-hybrid-structural-math-pane-title">Toolbar</div>
      <div className="markdown-hybrid-structural-math-toolbar-scroll">
        <div className="markdown-hybrid-structural-math-toolbar" role="toolbar" aria-label="Structural math inserts">
          {groups.map((group) => (
            <div
              key={group.id}
              className="markdown-hybrid-structural-math-toolbar-group"
              role="group"
              aria-label={group.label}
            >
              {group.items.map((item) => (
                <Tooltip key={item.id} content={item.tooltipLabel}>
                  <button
                    type="button"
                    className="markdown-hybrid-structural-math-tool"
                    aria-label={item.tooltipLabel}
                    onClick={() => onTemplateSelect(item.id)}
                  >
                    <MathToolbarIcon iconId={item.iconId} />
                  </button>
                </Tooltip>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
