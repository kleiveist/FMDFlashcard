<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# User Vault (Dev Notes)

## Begriffe

- **Profil**: Storage-Container fuer alle Stats (global pro Profil).
- **User**: SR-User in der Spaced-Repetition-Logik (mehrere pro Profil moeglich).

## Schichten (wo greifen Profil und User?)

| Schicht | Profil | User | Hinweise |
| --- | --- | --- | --- |
| UI (Settings) | Auswahl, Erstellung, Export/Import | Anzeige SR-User in SR-UI | Profile werden in Data & Sync verwaltet |
| State Hook | `useUserVault` | `useSpacedRepetition` (SR-User) | Profil steuert Speicherpfad |
| Storage Service | `features/user-vault/storage.ts` | SR-User im Storage-JSON | Pro Profil JSON-Dateien |
| Tauri IO | `read_json_file`, `write_json_file`, `ensure_directory` | - | rein dateibasiert |

## Sync-Optionen (Future)

1) **File-based Sync** (Nextcloud/Dropbox/OneDrive)
   - Vorteil: Einfach, nutzt vorhandene Cloud-Sync Tools.
   - Risiko: Konflikte bei gleichzeitigen Writes (JSON Merge/Locking).

2) **Git-basiert**
   - Vorteil: Versionierung, Rollback.
   - Risiko: Merge-Konflikte fuer JSON; UX komplex.

3) **Provider API**
   - Vorteil: Gesteuerte Konfliktloesung, Auth, Access Control.
   - Risiko: Hoher Integrationsaufwand, Offline-Handling.

4) **Custom Remote Service**
   - Vorteil: Volle Kontrolle (Schema, Locking, Delta-Sync).
   - Risiko: Betrieb/Hosting, Datenschutz.

## Offene Themen / Risiken

- **Konflikte** bei Multi-Device Sync (gleichzeitige Writes).
- **Schema-Versioning** fuer JSON; Migrationen sauber definieren.
- **Settings Persistenz**: user vault mode + custom path sind App-Settings.
- **Vault-Wechsel**: Auto-Mode wechselt path; Custom-Mode bleibt.
- **Backup/Restore UX**: Export/Import fuer Profile + optionaler Vault-wide Export.
- **Security/Privacy**: Optional Verschluesselung fuer Sync-Provider.
