/**
 * @file frontend/src/pages/help/sections/HelpHeaderSection.tsx
 *
 * Zweck:
 * - Rendert die Seite Help Header Section.
 *
 * Verantwortlichkeiten:
 * - Komponiert Seitenlayout und Unterbereiche.
 * - Bindet Panels, Listen oder Tools fuer den Bereich ein.
 * - Reicht App-State und Handler an Unterkomponenten weiter.
 *
 * Verbunden mit:
 * - frontend/src/pages/HelpPage.tsx: Nutzt dieses Modul.
 *
 * Exportiert:
 * - HelpHeaderSection: React-Komponente.
 *
 * Hinweise:
 * - Aenderungen beeinflussen den Ablauf der Seite und deren Unterbereiche.
 */

type HelpHeaderSectionProps = {
  eyebrowText: string;
  titleText: string;
  summaryText: string;
};

export const HelpHeaderSection = ({
  eyebrowText,
  titleText,
  summaryText,
}: HelpHeaderSectionProps) => (
  <header className="content-header">
    <div>
      <p className="eyebrow">{eyebrowText}</p>
      <h1>{titleText}</h1>
      <p className="muted">{summaryText}</p>
    </div>
  </header>
);
