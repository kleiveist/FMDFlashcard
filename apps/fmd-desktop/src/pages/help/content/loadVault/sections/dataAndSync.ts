import { LoadVaultTabData } from "../../types";

export const dataAndSyncSection: LoadVaultTabData = {
  title: { en: "Data & Sync", de: "Data & Sync" },
  summary: {
    en: "Manage local stats storage and profiles.",
    de: "Lokale Statistik-Speicherung und Profile verwalten.",
  },
  blocks: [
    {
      id: "what-is",
      title: { en: "What is it?", de: "Was ist das?" },
      text: {
        en: "A storage and profile management area for user stats (review progress, scoring, repetition state). It defines where stats are stored and which profile is active.",
        de: "Ein Bereich fuer Speicherort und Profile deiner Nutzer-Statistiken (Fortschritt, Scores, Wiederholungszustand). Hier legst du fest, wo Stats liegen und welches Profil aktiv ist.",
      },
    },
    {
      id: "purpose-rules",
      title: { en: "What is it for? / Rules", de: "Wofuer ist es? / Regeln" },
      bullets: [
        {
          en: "Keep progress predictable across vault switches and device moves.",
          de: "Fortschritt nachvollziehbar halten – auch bei Vault-Wechseln und Geraetewechsel.",
        },
        {
          en: "Separate different learners or learning contexts via profiles.",
          de: "Verschiedene Nutzer oder Lernkontexte ueber Profile trennen.",
        },
        {
          en: "Auto (Vault/user) stores stats inside the active vault under /user; Custom path stores stats in a fixed location across vault switches.",
          de: "Auto (Vault/user) speichert Stats im aktiven Vault unter /user; Custom path speichert Stats in einem festen Ordner – auch bei Vault-Wechsel.",
        },
        {
          en: "Sync provider is a placeholder until cloud sync is implemented.",
          de: "Sync provider ist ein Platzhalter, bis Cloud-Sync implementiert ist.",
        },
      ],
    },
    {
      id: "what-you-see",
      title: { en: "What you see there", de: "Was du dort siehst" },
      bullets: [
        {
          en: "User vault mode: Auto (Vault/user), Custom path, and Sync provider (placeholder).",
          de: "User vault mode: Auto (Vault/user), Custom path und Sync provider (Platzhalter).",
        },
        {
          en: "Active path: the current stats folder (Example: /Users/kleif/Vaults/FMD/user).",
          de: "Active path: der aktuelle Stats-Ordner (Beispiel: /Users/kleif/Vaults/FMD/user).",
        },
        {
          en: "Change: selects a different folder when using Custom path.",
          de: "Change: waehlt einen anderen Ordner (bei Custom path).",
        },
        {
          en: "Profiles: how many profiles were found and which one is active.",
          de: "Profiles: wie viele Profile gefunden wurden und welches aktiv ist.",
        },
        {
          en: "Create profile: creates a new profile entry; the date is added automatically.",
          de: "Create profile: erstellt ein neues Profil; das Datum wird automatisch hinzugefuegt.",
        },
        {
          en: "Load profile: switches the active profile for the current session without changing the vault.",
          de: "Load profile: wechselt das aktive Profil fuer die aktuelle Session, ohne den Vault zu aendern.",
        },
        {
          en: "Export / Import (JSON): export a profile or all profiles; import supports merge or overwrite.",
          de: "Export / Import (JSON): Profil oder alle Profile exportieren; Import mit Merge oder Overwrite.",
        },
      ],
    },
    {
      id: "handling",
      title: { en: "How to use it", de: "Umgang mit" },
      bullets: [
        {
          en: "Choose Auto if you want stats to stay with each vault (vault-based learning projects).",
          de: "Auto nutzen, wenn Stats pro Vault getrennt bleiben sollen (vault-basierte Lernprojekte).",
        },
        {
          en: "Choose Custom path if you want one consistent stats location across multiple vaults.",
          de: "Custom path nutzen, wenn Stats zentral und vault-unabhaengig gespeichert werden sollen.",
        },
        {
          en: "Use Create profile for a new learner/context; use Load profile to switch without touching the vault.",
          de: "Create profile fuer neuen Lernkontext nutzen; Load profile zum Umschalten ohne Vault-Wechsel.",
        },
        {
          en: "Export before major changes; import with Merge to add data, or Overwrite to replace the set.",
          de: "Vor groesseren Aenderungen exportieren; Import mit Merge zum Hinzufuegen oder Overwrite zum Ersetzen.",
        },
      ],
    },
    {
      id: "tips",
      title: { en: "Tips", de: "Tipps" },
      bullets: [
        {
          en: "If you switch vaults often, Custom path reduces confusion about where your stats are stored.",
          de: "Bei haeufigen Vault-Wechseln reduziert Custom path Verwirrung, wo Stats gespeichert sind.",
        },
        {
          en: "Use clear profile names (e.g., “Kleif – Biology”, “Kleif – Languages”).",
          de: "Profile eindeutig benennen (z. B. „Kleif – Bio“, „Kleif – Sprachen“).",
        },
        {
          en: "Keep periodic JSON exports as safety backups, especially before migrations or refactors.",
          de: "Regelmaessige JSON-Exports als Sicherheitsbackup, besonders vor Migrationen oder Refactors.",
        },
      ],
    },
    {
      id: "core-workflow",
      title: { en: "Core workflow", de: "Core-Workflow" },
      bullets: [
        {
          en: "Decide your stats strategy: Auto (per vault) or Custom (global).",
          de: "Speicherstrategie waehlen: Auto (pro Vault) oder Custom (global).",
        },
        { en: "Verify the active path.", de: "Active path kontrollieren." },
        { en: "Create or load the intended profile.", de: "Profil erstellen oder laden." },
        { en: "Review normally; stats update automatically.", de: "Normal arbeiten; Stats werden automatisch aktualisiert." },
        { en: "Export JSON regularly; import via Merge/Overwrite when restoring or moving devices.", de: "JSON regelmaessig exportieren; bei Restore/Geraetewechsel per Merge/Overwrite importieren." },
      ],
    },
  ],
};
