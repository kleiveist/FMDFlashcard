/**
 * @file apps/fmd-desktop/src/features/preview/frontmatter-property-icons.tsx
 *
 * Shared icon set for frontmatter and database property type UIs.
 */

import { type SharedPropertyIcon } from "./attribute-type-catalog";

export const FrontmatterTextIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 6h12" />
    <path d="M6 12h12" />
    <path d="M6 18h8" />
  </svg>
);

export const FrontmatterTaskIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="4" width="16" height="16" rx="2.5" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
    <path d="M8 17h3" />
  </svg>
);

export const FrontmatterNumberIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 5L6 19" />
    <path d="M16 5l-2 14" />
    <path d="M4 10h16" />
    <path d="M3 15h16" />
  </svg>
);

export const FrontmatterTimeIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const FrontmatterToggleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="8" width="18" height="8" rx="4" />
    <circle cx="9" cy="12" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

export const FrontmatterTagIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13l-7 7-9-9V4h7l9 9z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </svg>
);

export const FrontmatterLinkIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 1 0-7l1-1a5 5 0 0 1 7 7l-1 1" />
    <path d="M14 11a5 5 0 0 1 0 7l-1 1a5 5 0 0 1-7-7l1-1" />
  </svg>
);

export const FrontmatterImageIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M3 16l5-4 4 3 3-2 6 5" />
  </svg>
);

export const FrontmatterFormulaIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 6h9" />
    <path d="M8 12h6" />
    <path d="M8 18h9" />
    <path d="M5 6l-2 3 2 3" />
    <path d="M5 15l-2 3 2 3" />
  </svg>
);

export const FrontmatterUnknownIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.2a2.4 2.4 0 0 1 4.8 0c0 1.4-1.5 1.9-2.3 2.5-.5.3-.7.7-.7 1.3" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const FrontmatterGripIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="8" cy="7" r="1.2" />
    <circle cx="8" cy="12" r="1.2" />
    <circle cx="8" cy="17" r="1.2" />
    <circle cx="16" cy="7" r="1.2" />
    <circle cx="16" cy="12" r="1.2" />
    <circle cx="16" cy="17" r="1.2" />
  </svg>
);

export const FrontmatterPropertyIconView = ({ icon }: { icon: SharedPropertyIcon }) => {
  switch (icon) {
    case "cover":
      return <FrontmatterImageIcon />;
    case "task":
      return <FrontmatterTaskIcon />;
    case "time":
      return <FrontmatterTimeIcon />;
    case "number":
      return <FrontmatterNumberIcon />;
    case "boolean":
      return <FrontmatterToggleIcon />;
    case "tags":
      return <FrontmatterTagIcon />;
    case "link":
      return <FrontmatterLinkIcon />;
    case "formula":
      return <FrontmatterFormulaIcon />;
    case "unknown":
      return <FrontmatterUnknownIcon />;
    default:
      return <FrontmatterTextIcon />;
  }
};
