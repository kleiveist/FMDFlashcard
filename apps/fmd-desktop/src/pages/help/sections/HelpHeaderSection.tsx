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
