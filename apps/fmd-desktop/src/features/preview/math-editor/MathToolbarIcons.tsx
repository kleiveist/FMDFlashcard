import type { MathTemplateIconId } from "./types";

const glyphIcon = (glyph: string, className?: string) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
  >
    <text
      x="12"
      y="16"
      textAnchor="middle"
      fontSize="12"
      fontWeight="700"
      fill="currentColor"
      fontFamily="Space Grotesk, IBM Plex Sans, Segoe UI, sans-serif"
    >
      {glyph}
    </text>
  </svg>
);

export const MathToolbarIcon = ({ iconId }: { iconId: MathTemplateIconId }) => {
  switch (iconId) {
    case "plus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 6v12" />
          <path d="M6 12h12" />
        </svg>
      );
    case "minus":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 12h12" />
        </svg>
      );
    case "times":
      return glyphIcon("×");
    case "divide":
      return glyphIcon("÷");
    case "equals":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 9h12" />
          <path d="M6 15h12" />
        </svg>
      );
    case "not-equals":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 9h12" />
          <path d="M6 15h12" />
          <path d="M16.5 6 7.5 18" />
        </svg>
      );
    case "leq":
      return glyphIcon("≤");
    case "geq":
      return glyphIcon("≥");
    case "parentheses":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5.5C7.1 7.5 6 9.5 6 12s1.1 4.5 3 6.5" />
          <path d="M15 5.5c1.9 2 3 4 3 6.5s-1.1 4.5-3 6.5" />
          <path d="M10.2 9.5h3.6" />
          <path d="M10.2 14.5h3.6" />
        </svg>
      );
    case "brackets":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5.5H6v13h3" />
          <path d="M15 5.5h3v13h-3" />
          <path d="M10.2 9.5h3.6" />
          <path d="M10.2 14.5h3.6" />
        </svg>
      );
    case "braces":
      return glyphIcon("{ }");
    case "absolute":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5v14" />
          <path d="M16 5v14" />
          <rect x="9.5" y="8.5" width="5" height="7" rx="1.2" />
        </svg>
      );
    case "fraction":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="5" width="12" height="5" rx="1.5" />
          <path d="M5 12h14" />
          <rect x="6" y="14" width="12" height="5" rx="1.5" />
        </svg>
      );
    case "sqrt":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h3l2.4 5L13 7h7" />
          <rect x="13.2" y="8.2" width="5" height="6.4" rx="1.2" />
        </svg>
      );
    case "nth-root":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 12h2l2.2 5L13 7h7" />
          <rect x="13.2" y="8.2" width="5" height="6.4" rx="1.2" />
          <path d="M5.2 8.4V5.6l2 2.8V5.6" />
        </svg>
      );
    case "power":
      return glyphIcon("xʸ");
    case "index":
      return glyphIcon("xᵢ");
    case "integral":
      return glyphIcon("∫");
    case "sum":
      return glyphIcon("Σ");
    case "product":
      return glyphIcon("∏");
    case "limit":
      return glyphIcon("lim");
    case "matrix":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );
    case "pmatrix":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 4.5C5.2 6.3 4.5 8.7 4.5 12s.7 5.7 2 7.5" />
          <path d="M17.5 4.5c1.3 1.8 2 4.2 2 7.5s-.7 5.7-2 7.5" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );
    case "vector":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 4.5C5.2 6.3 4.5 8.7 4.5 12s.7 5.7 2 7.5" />
          <path d="M17.5 4.5c1.3 1.8 2 4.2 2 7.5s-.7 5.7-2 7.5" />
          <rect x="9.5" y="7" width="5" height="2.5" rx="0.8" />
          <rect x="9.5" y="10.75" width="5" height="2.5" rx="0.8" />
          <rect x="9.5" y="14.5" width="5" height="2.5" rx="0.8" />
        </svg>
      );
    case "cases":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5.5c-1.6 0-2 1-2 2.2v1.2c0 1-.6 1.7-1.6 2.1 1 .4 1.6 1.1 1.6 2.1v1.2c0 1.2.4 2.2 2 2.2" />
          <rect x="10.5" y="7" width="6.5" height="3" rx="1" />
          <rect x="10.5" y="14" width="6.5" height="3" rx="1" />
        </svg>
      );
    case "aligned":
      return (
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8h5" />
          <path d="M13 7h6" />
          <path d="M13 9h6" />
          <path d="M5 16h5" />
          <path d="M13 15h6" />
          <path d="M13 17h6" />
        </svg>
      );
    case "text":
      return glyphIcon("abc");
    case "sin":
      return glyphIcon("sin");
    case "cos":
      return glyphIcon("cos");
    case "log":
      return glyphIcon("log");
    case "pi":
      return glyphIcon("π");
    case "theta":
      return glyphIcon("θ");
    case "alpha":
      return glyphIcon("α");
    case "infty":
      return glyphIcon("∞");
    case "partial":
      return glyphIcon("∂");
    case "nabla":
      return glyphIcon("∇");
    case "arrow":
      return glyphIcon("→");
    case "element":
      return glyphIcon("∈");
    case "subset":
      return glyphIcon("⊂");
    case "forall":
      return glyphIcon("∀");
    case "exists":
      return glyphIcon("∃");
  }
};
