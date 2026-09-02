import { LoadVaultTabData } from "../../types";

export const vaultAndIndexSection: LoadVaultTabData = {
  title: { en: "Vault & Index", de: "Vault & Index" },
  summary: {
    en: "Vault path, last opened note, and index status at a glance.",
    de: "Vault-Pfad, zuletzt geoeffnete Notiz und Index-Status auf einen Blick.",
  },
  blocks: [
    {
      id: "what-is",
      title: { en: "What is it?", de: "Was ist das?" },
      text: {
        en: "A status panel for the currently loaded vault. It summarizes where your vault is located, what you opened last, and whether the index is ready for reliable search and review.",
        de: "Ein Statusbereich fuer den aktuell geladenen Vault. Er zeigt, wo der Vault liegt, welche Notiz du zuletzt geoeffnet hast und ob der Index fuer Suche und Review bereit ist.",
      },
    },
    {
      id: "purpose-rules",
      title: { en: "What is it for? / Rules", de: "Wofuer ist es? / Regeln" },
      bullets: [
        {
          en: "Verify you are working in the correct vault before reviewing or editing notes.",
          de: "Pruefe, dass du im richtigen Vault arbeitest, bevor du Reviews startest oder Notizen bearbeitest.",
        },
        {
          en: "Confirm scanning and indexing are complete so lists, filters, and search results are trustworthy.",
          de: "Stelle sicher, dass Scan und Index fertig sind, damit Listen, Filter und Suchergebnisse zuverlaessig sind.",
        },
        {
          en: "Use hidden folders only for troubleshooting; they can add noise and slow scanning.",
          de: "Versteckte Ordner nur zum Troubleshooting einblenden; sie koennen Rauschen erzeugen und Scans verlangsamen.",
        },
      ],
    },
    {
      id: "what-you-see",
      title: { en: "What you see there", de: "Was du dort siehst" },
      bullets: [
        {
          en: "Current vault path: the folder currently loaded (Example: /Users/alex/Vaults/FMD).",
          de: "Current vault path: der aktuell geladene Ordner (Beispiel: /Users/alex/Vaults/FMD).",
        },
        {
          en: "Last opened: the most recent note you opened (Example: Biology/Cell-Membrane.md).",
          de: "Last opened: die zuletzt geoeffnete Notiz (Beispiel: Biology/Cell-Membrane.md).",
        },
        {
          en: "Show hidden folders: Off hides dot-folders; On reveals them (Examples: .git, .obsidian).",
          de: "Show hidden folders: Off blendet Dot-Folders aus; On zeigt sie an (Beispiele: .git, .obsidian).",
        },
        {
          en: "Status indicators: health signals such as “Fully processed” (all notes scanned and indexed).",
          de: "Status indicators: Signale wie „Fully processed“ (alle Notizen gescannt und indexiert).",
        },
        {
          en: "Actions: Rescan vault and Reset index for maintenance and recovery.",
          de: "Actions: Rescan vault und Reset index fuer Pflege und Wiederherstellung.",
        },
      ],
    },
    {
      id: "handling",
      title: { en: "How to use it", de: "Umgang mit" },
      bullets: [
        {
          en: "If lists look empty, first confirm the current vault path matches the vault you intended to load.",
          de: "Wenn Listen leer wirken, pruefe zuerst, ob der aktuelle Vault-Pfad dem gewuenschten Vault entspricht.",
        },
        {
          en: "If new or changed files do not appear, run Rescan vault to pick up changes.",
          de: "Wenn neue oder geaenderte Dateien fehlen, fuehre Rescan vault aus.",
        },
        {
          en: "If results look inconsistent or obviously wrong, use Reset index to rebuild from scratch.",
          de: "Wenn Ergebnisse widerspruechlich oder offensichtlich falsch sind, nutze Reset index fuer einen Neuaufbau.",
        },
        {
          en: "Turn Show hidden folders on only when you need to check whether dot-folders affect scanning.",
          de: "Show hidden folders nur aktivieren, wenn du pruefen musst, ob Dot-Folders den Scan beeinflussen.",
        },
      ],
    },
    {
      id: "tips",
      title: { en: "Tips", de: "Tipps" },
      bullets: [
        {
          en: "After large moves/renames, prefer Reset index to remove stale entries.",
          de: "Nach grossen Verschiebungen/Umbenennungen lieber Reset index nutzen, um Alt-Eintraege zu entfernen.",
        },
        {
          en: "Keep hidden folders off during normal use to avoid noise and speed up scans.",
          de: "Hidden folders im Alltag aus lassen, um Rauschen zu vermeiden und Scans zu beschleunigen.",
        },
        {
          en: "If “Fully processed” never appears, check permissions and whether the vault path is accessible.",
          de: "Wenn „Fully processed“ nie erscheint, pruefe Berechtigungen und ob der Vault-Pfad erreichbar ist.",
        },
      ],
    },
    {
      id: "core-workflow",
      title: { en: "Core workflow", de: "Core-Workflow" },
      bullets: [
        { en: "Load a vault.", de: "Vault laden." },
        {
          en: "Confirm the current vault path is correct.",
          de: "Current vault path kontrollieren.",
        },
        {
          en: "Wait for “Fully processed” (or run Rescan vault).",
          de: "Auf „Fully processed“ warten (oder Rescan vault ausfuehren).",
        },
        {
          en: "Start review/search once indexing is stable.",
          de: "Reviews/Suche erst starten, wenn der Index stabil ist.",
        },
        {
          en: "If issues persist: Reset index, then rescan.",
          de: "Wenn Probleme bleiben: Reset index, dann erneut scannen.",
        },
      ],
    },
  ],
};
