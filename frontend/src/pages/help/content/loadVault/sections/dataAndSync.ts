import { LoadVaultTabData } from "../../types";

export const dataAndSyncSection: LoadVaultTabData = {
  title: { en: "Profile Source", de: "Profile Source" },
  summary: {
    en: "Manage local stats storage and users.",
    de: "Lokale Statistik-Speicherung und Nutzer verwalten.",
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
          en: "Separate different learners or learning contexts via users.",
          de: "Verschiedene Nutzer oder Lernkontexte ueber Nutzer trennen.",
        },
        {
          en: "Auto (Vault/profile) stores stats inside the active vault under /profile; Custom path stores stats in a fixed location across vault switches.",
          de: "Auto (Vault/profile) speichert Stats im aktiven Vault unter /profile; Custom path speichert Stats in einem festen Ordner – auch bei Vault-Wechsel.",
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
          en: "Profile mode: Auto (Vault/profile), Custom path, and Sync provider (placeholder).",
          de: "Profile mode: Auto (Vault/profile), Custom path und Sync provider (Platzhalter).",
        },
        {
          en: "Active path: the current stats folder (Example: /Users/kleif/Vaults/FMD/profile).",
          de: "Active path: der aktuelle Stats-Ordner (Beispiel: /Users/kleif/Vaults/FMD/profile).",
        },
        {
          en: "Change: selects a different folder when using Custom path.",
          de: "Change: waehlt einen anderen Ordner (bei Custom path).",
        },
        {
          en: "Users: how many users were found and which one is active.",
          de: "Users: wie viele Nutzer gefunden wurden und welcher aktiv ist.",
        },
        {
          en: "Create user: creates a new user entry; the date is added automatically.",
          de: "Create user: erstellt einen neuen Nutzer; das Datum wird automatisch hinzugefuegt.",
        },
        {
          en: "Load user: switches the active user for the current session without changing the vault.",
          de: "Load user: wechselt den aktiven Nutzer fuer die aktuelle Session, ohne den Vault zu aendern.",
        },
        {
          en: "Export / Import (JSON): export a user or all users; import supports merge or overwrite.",
          de: "Export / Import (JSON): Nutzer oder alle Nutzer exportieren; Import mit Merge oder Overwrite.",
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
          en: "Use Create user for a new learner/context; use Load user to switch without touching the vault.",
          de: "Create user fuer neuen Lernkontext nutzen; Load user zum Umschalten ohne Vault-Wechsel.",
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
          en: "Use clear user names (e.g., “Kleif – Biology”, “Kleif – Languages”).",
          de: "Nutzer eindeutig benennen (z. B. „Kleif – Bio“, „Kleif – Sprachen“).",
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
