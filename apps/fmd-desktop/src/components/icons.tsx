/**
 * @file apps/fmd-desktop/src/components/icons.tsx
 *
 * Zweck:
 * - Rendert die UI-Komponente icons.
 *
 * Verantwortlichkeiten:
 * - Baut die UI-Struktur und zugehoerige Klassen auf.
 * - Verdrahtet Props und Callbacks mit Unterkomponenten.
 * - Stellt Inhalts- und Statusvarianten dar.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/SidebarNav.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/components/VaultTree.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - FolderIcon: React-Komponente.
 * - FileIcon: React-Komponente.
 *
 * Hinweise:
 * - Styling erfolgt ueber globale CSS-Klassen und Variablen.
 */

const isDesktopDesignMode = () =>
  typeof document !== "undefined" && document.documentElement.dataset.designMode === "desktop";

const DESKTOP_ICON_RADIUS = 1;

const getStrokeProps = () => {
  const desktop = isDesktopDesignMode();
  return {
    strokeWidth: desktop ? "1.9" : "1.8",
    strokeLinecap: desktop ? "square" : "round",
    strokeLinejoin: desktop ? "miter" : "round",
  } as const;
};

export const FolderIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      {desktop ? (
        <>
          <path d="M3 6h6l2 2h10v11H3V6z" />
          <line x1="3" y1="8" x2="21" y2="8" />
        </>
      ) : (
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      )}
    </svg>
  );
};

export const FileIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      {desktop ? (
        <>
          <path d="M7 4h8l4 4v12H7V4z" />
          <path d="M15 4v4h4" />
        </>
      ) : (
        <>
          <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M14 4v5h5" />
        </>
      )}
    </svg>
  );
};

export const MarkdownIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M14 4v5h5" />
      <path d="M8 14h8" />
      <path d="M8 18h5" />
    </svg>
  );
};

export const CodeIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <polyline points="8 8 4 12 8 16" />
      <polyline points="16 8 20 12 16 16" />
      <line x1="11" y1="6" x2="13" y2="18" />
    </svg>
  );
};

export const EditIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
};

export const MenuIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
};

export const CardsIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <rect x="5" y="6" width="12" height="7" rx={desktop ? DESKTOP_ICON_RADIUS : 2} />
      <rect x="7" y="11" width="12" height="7" rx={desktop ? DESKTOP_ICON_RADIUS : 2} />
    </svg>
  );
};

export const GridEventIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <rect x="4" y="4" width="16" height="16" rx={desktop ? DESKTOP_ICON_RADIUS : 2} />
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="9" y1="9" x2="9" y2="20" />
      <line x1="15" y1="9" x2="15" y2="20" />
      <line x1="4" y1="15" x2="20" y2="15" />
    </svg>
  );
};

export const HelpIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      {desktop ? (
        <>
          <rect x="4" y="4" width="16" height="16" />
          <path d="M9.5 9a2.5 2.5 0 1 1 5 1c0 1.4-1.5 2-2.4 2.7-0.4 0.3-0.6 0.7-0.6 1.3" />
          <rect x="11.2" y="16.4" width="1.6" height="1.6" fill="currentColor" stroke="none" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 5 1c0 1.4-1.5 2-2.4 2.7-0.4 0.3-0.6 0.7-0.6 1.3" />
          <circle cx="12" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
};

export const SettingsIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2.5" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="14" cy="12" r="2.5" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="11" cy="18" r="2.5" />
    </svg>
  );
};

export const AppearanceIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
      <line x1="5" y1="5" x2="6.5" y2="6.5" />
      <line x1="17.5" y1="17.5" x2="19" y2="19" />
      <line x1="5" y1="19" x2="6.5" y2="17.5" />
      <line x1="17.5" y1="6.5" x2="19" y2="5" />
    </svg>
  );
};

export const KeyboardIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <rect x="3" y="6" width="18" height="12" rx={desktop ? DESKTOP_ICON_RADIUS : 2} />
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="11" y2="14" />
      <line x1="13" y1="14" x2="17" y2="14" />
    </svg>
  );
};

export const GlobeIcon = () => {
  const desktop = isDesktopDesignMode();
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      {desktop ? <path d="M7 3h10l4 4v10l-4 4H7l-4-4V7z" /> : <circle cx="12" cy="12" r="9" />}
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <path d="M5.5 7c4.5 2.5 8.5 2.5 13 0" />
      <path d="M5.5 17c4.5-2.5 8.5-2.5 13 0" />
    </svg>
  );
};

export const GaugeIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M4 16a8 8 0 1 1 16 0" />
      <line x1="12" y1="12" x2="16" y2="9" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
};

export const RefreshIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <polyline points="21 3 21 9 15 9" />
    </svg>
  );
};

export const ChevronDownIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
};

export const CheckIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
};

export const ExamEditorIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M4 5h10l4 4v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
      <path d="M14 5v4h4" />
      <path d="M8 15l6-6 2 2-6 6H8z" />
    </svg>
  );
};

export const CloseIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
};

export const TrashIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 12h8l1-12" />
      <line x1="10" y1="11" x2="10" y2="16" />
      <line x1="14" y1="11" x2="14" y2="16" />
    </svg>
  );
};

export const AlertIcon = () => {
  const stroke = getStrokeProps();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.strokeWidth}
      strokeLinecap={stroke.strokeLinecap}
      strokeLinejoin={stroke.strokeLinejoin}
    >
      <path d="M12 3l9 16H3l9-16Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
};
