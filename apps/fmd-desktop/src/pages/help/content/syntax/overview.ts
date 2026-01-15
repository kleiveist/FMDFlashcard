/**
 * @file apps/fmd-desktop/src/pages/help/content/syntax/overview.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Help.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Help bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/pages/help/helpContent.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const flashcardSyntaxOverview = {
  title: { en: "Core rules", de: "Grundregeln" },
  bullets: [
    {
      en: "Wrap every card with #card and # on their own lines; content outside is ignored.",
      de: "Jede Karte mit #card und # auf eigenen Zeilen umschliessen; Inhalt ausserhalb wird ignoriert.",
    },
    {
      en: "The first non-empty line is the prompt.",
      de: "Die erste nicht-leere Zeile ist die Frage.",
    },
    {
      en: "Syntaxes can be combined in one #card block when desired; keep markers clear and consistent.",
      de: "Syntaxen koennen bei Bedarf in einem #card-Block kombiniert werden; Marker klar und konsistent halten.",
    },
    {
      en: "Optional #help/#helpend blocks add hints without changing card type or scoring.",
      de: "Optionale #help/#helpend-Bloecke liefern Hinweise ohne Kartentyp oder Bewertung zu aendern.",
    },
  ],
};
