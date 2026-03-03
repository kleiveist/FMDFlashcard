import { getTemplateDefinitionsForCategory, MATH_TEMPLATE_CATEGORIES } from "./palette";
import type { MathTemplateCategoryId } from "./types";

export const MathPalettePane = ({
  activeCategoryId,
  recentTemplateIds,
  onCategoryChange,
  onTemplateSelect,
}: {
  activeCategoryId: string;
  recentTemplateIds: string[];
  onCategoryChange: (categoryId: MathTemplateCategoryId) => void;
  onTemplateSelect: (templateId: string) => void;
}) => {
  const items = getTemplateDefinitionsForCategory(
    activeCategoryId as MathTemplateCategoryId,
    recentTemplateIds,
  );

  return (
    <div className="markdown-hybrid-structural-math-palette">
      <div className="markdown-hybrid-structural-math-pane-title">Palette</div>
      <div className="markdown-hybrid-structural-math-categories" role="tablist" aria-label="Math categories">
        {MATH_TEMPLATE_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`markdown-hybrid-structural-math-category${
              activeCategoryId === category.id ? " is-active" : ""
            }`}
            onClick={() => onCategoryChange(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div className="markdown-hybrid-structural-math-template-grid">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="markdown-hybrid-structural-math-template"
            onClick={() => onTemplateSelect(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
};
