<!-- AUTO-GENERATED:backlink START -->
[← Back](de.md)
<!-- AUTO-GENERATED:backlink END -->
# Profile-System (Entwickler-Doku)

Diese Doku beschreibt das aktuelle Profil-/User-Storage-System auf Basis des implementierten Codes, inkl. Legacy-Kompatibilitaet, Invarianten und Debugging.

## 1. Begriffe & Zustaendigkeiten

| Begriff | Bedeutung | Source of Truth / Owner |
| --- | --- | --- |
| Vault | Geoeffneter Markdown-Ordner in der App. | AppState + Vault-Feature (`apps/fmd-desktop/src/components/AppStateProvider.tsx:197`) |
| Profile-Root | Wurzel fuer Profil-Dateien (`auto`: `<vault>/profile`, `custom`: ausgewaehlter Pfad wird auf `<auswahl>/profile` normalisiert, ausser er endet bereits auf `profile`). | Resolver in `resolveActiveProfileRoot` + `resolveCustomProfileRootPath` (`apps/fmd-desktop/src/lib/userVault.ts:92`, `apps/fmd-desktop/src/lib/userVault.ts:106`) |
| Profil | Dateisystem-Ordner mit mindestens `profile.json`; enthaelt Feature-Stores je Profil. | Storage-Service (`apps/fmd-desktop/src/features/user-vault/storage.ts:660`) |
| "User" (SR-User) | Fachlicher User innerhalb Spaced Repetition (mehrere pro Profil moeglich). | `spaced-repetition.json` unter `byVaultId[*].users` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:426`) |

Abgrenzung "Profil" vs. "User":
- Profil entscheidet den Speicherort und die zugehoerigen Dateien fuer Settings, SRS, Exam Runs, Fast Flashcard (`apps/fmd-desktop/src/features/user-vault/storage.ts:707`).
- SR-User lebt innerhalb eines Profils in `spaced-repetition.json` und steuert nur Spaced-Repetition-Status (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:700`).

## 2. Verzeichnislayout (mit Tree + Erklaerung)

Aktuelles Ziel-Layout (neue Writes standardmaessig unter `users/`):

```text
<PROFILE_ROOT>/
  user-vault.json
  users/
    <profile-id>/
      profile.json
      spaced-repetition.json
      fast-flashcard.json
      exam-runs.json
```

Legacy-kompatible Reads (werden weiterhin gefunden):
- `<PROFILE_ROOT>/profiles/<profile-id>/...` (`apps/fmd-desktop/src/features/user-vault/storage.ts:213`)
- `<PROFILE_ROOT>/<profile-id>/...` direkt unter Root, wenn `profile.json` vorhanden (`apps/fmd-desktop/src/features/user-vault/storage.ts:262`)

### Naming-Schema der Profil-Ordner

Profil-ID wird so erzeugt:
1. Name sanitizen (`sanitizeProfileName`): Leerzeichen -> `-`, ungueltige Dateiname-Zeichen -> `-`, doppelte `-` zusammenfassen (`apps/fmd-desktop/src/lib/userVault.ts:61`).
2. Prefix mit Tagesstempel (`YYYY-MM-DD_`) via `Intl.DateTimeFormat("en-CA")` (`apps/fmd-desktop/src/lib/userVault.ts:55`, `apps/fmd-desktop/src/lib/userVault.ts:76`).
3. Bei Kollision Suffix `-1`, `-2`, ... (`apps/fmd-desktop/src/features/user-vault/storage.ts:671`).

Beispiel:
- `default` -> `2026-02-11_default`
- Kollision -> `2026-02-11_default-1`

Write-Ziel fuer neue Profile:
- Falls `users/` existiert: schreibe nach `users/`.
- Sonst falls nur `profiles/` existiert: schreibe nach `profiles/`.
- Sonst neu nach `users/` (`apps/fmd-desktop/src/features/user-vault/storage.ts:636`).

## 3. Dateiuebersicht

| Datei | Scope (global/per-user) | Owner-Modul | Wann geschrieben | Wann gelesen | Inhalt/Schema | Beispielpfad |
| --- | --- | --- | --- | --- | --- | --- |
| `user-vault.json` | global (pro Profile-Root) | Storage-Service (`apps/fmd-desktop/src/features/user-vault/storage.ts:613`) | Root-Init/Reparatur, Active-Profil-Wechsel (`apps/fmd-desktop/src/features/user-vault/storage.ts:356`, `apps/fmd-desktop/src/features/user-vault/storage.ts:697`) | Bootstrap, Vault-Manager (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:271`, `apps/fmd-desktop/src/components/VaultManagerModal.tsx:157`) | `{ schemaVersion, activeProfileId }` | `<PROFILE_ROOT>/user-vault.json` |
| `profile.json` | per-user (pro Profilordner) | Storage-Service + Settings-Hook (`apps/fmd-desktop/src/features/user-vault/storage.ts:722`, `apps/fmd-desktop/src/features/settings/useAppSettings.ts:1542`) | Profil-Erstellung, Settings-Save, Settings-Migration (`apps/fmd-desktop/src/features/user-vault/storage.ts:689`, `apps/fmd-desktop/src/features/user-vault/storage.ts:765`) | Profil-Listing/Meta, Settings-Load (`apps/fmd-desktop/src/features/user-vault/storage.ts:232`, `apps/fmd-desktop/src/features/user-vault/storage.ts:726`) | `{ schemaVersion, id, name, createdAt, settings }` | `<PROFILE_ROOT>/users/<id>/profile.json` |
| `spaced-repetition.json` | per-user | Spaced-Repetition-Hook + Storage-Service (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`, `apps/fmd-desktop/src/features/user-vault/storage.ts:781`) | Beim Persistieren von SR-States (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:593`) | Beim SR-Context-Load (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`) | `{ schemaVersion, byVaultId, migratedVaultIds }` | `<PROFILE_ROOT>/users/<id>/spaced-repetition.json` |
| `exam-runs.json` | per-user | Exam-ViewModel + Storage-Service (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`, `apps/fmd-desktop/src/features/user-vault/storage.ts:837`) | Exam-Run Append/Delete/Save + Recovery (`apps/fmd-desktop/src/features/user-vault/storage.ts:896`, `apps/fmd-desktop/src/features/user-vault/storage.ts:951`) | Exam-History-Load (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`) | `{ schemaVersion, runs, migratedFromAppData }` | `<PROFILE_ROOT>/users/<id>/exam-runs.json` |
| `fast-flashcard.json` | per-user | Fast-Session-Hook + Storage-Service (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`, `apps/fmd-desktop/src/features/user-vault/storage.ts:809`) | Session-History Save/Reset (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:411`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:65`) | Session-History Load (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`) | `{ schemaVersion, sessions, migratedFromAppData }` | `<PROFILE_ROOT>/users/<id>/fast-flashcard.json` |

## 4. JSON-Schemata (pro Datei)

### 4.1 `user-vault.json`

| Feld | Typ | Bedeutung | Default / Normalisierung |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Schema-Stand fuer Root-Metadaten. | Immer auf `1` normalisiert (`apps/fmd-desktop/src/features/user-vault/storage.ts:365`). |
| `activeProfileId` | `string \| null` | Aktive Profil-ID im aktuellen Profile-Root. | Nicht-String -> `null` (`apps/fmd-desktop/src/features/user-vault/storage.ts:367`). |

Beispiel (echte Keys):

```json
{
  "schemaVersion": 1,
  "activeProfileId": "2026-01-14_Kleif"
}
```

Quelle Beispiel: `docs/dev/test/archive/test_editor/user/user-vault.json`.

### 4.2 `profile.json`

Top-Level:

| Feld | Typ | Bedeutung | Default / Normalisierung |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Profilschema-Version. | Fehlend/alt wird beim Lesen auf `1` migriert (`apps/fmd-desktop/src/features/user-vault/storage.ts:455`). |
| `id` | `string` | Profil-ID (Ordner-ID). | Bei defekten Metadaten Fallback aus Ordnername (`apps/fmd-desktop/src/features/user-vault/storage.ts:448`). |
| `name` | `string` | Anzeigename des Profils. | Bei Fallback aus `parseProfileId(id)` (`apps/fmd-desktop/src/features/user-vault/storage.ts:452`). |
| `createdAt` | `string` (ISO) | Profil-Erstellzeit. | Bei Fallback aus Datums-Prefix oder `now` (`apps/fmd-desktop/src/features/user-vault/storage.ts:449`). |
| `settings` | `object \| null` | Profilgebundene App-Settings. | Neu angelegt als `{}` (`apps/fmd-desktop/src/features/user-vault/storage.ts:692`), beim Lesen leeres Objekt -> `null` (`apps/fmd-desktop/src/features/user-vault/storage.ts:746`). |

Persistierte `settings`-Keys (Write-Pfad):
- Quelle fuer Write-Liste: `buildProfileSettingsPayload` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:676`)
- Defaults/Normalisierung kommen aus `normalizeSettings` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:734`)

| Key | Typ | Default (beim Laden) |
| --- | --- | --- |
| `active_note_path`, `vault_path` | `string \| null` | `null` wenn nicht gesetzt. |
| `recent_vaults` | `RecentVaultEntry[]` | `[]` (normalisiert). |
| `theme` | `"light" \| "dark"` | `"light"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:738`). |
| `accent_color` | `string` (Hex) | `DEFAULT_ACCENT` bei ungueltig (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:739`). |
| `markdownEditor` | `object` | Fallback auf normalisierte Hex-Werte. |
| `editor_markdown_exact_colors_enabled` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:757`). |
| `editor_blueprint_grid`, `editor_blueprint_grid_intensity` | `boolean`, `string` | `false`, `"medium"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:288`). |
| `editor_markdown_view_edit_enabled`, `editor_markdown_preview_default_mode` | `boolean`, `"markdown" \| "raw"` | `false`, `"markdown"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:292`). |
| `exam_editor_show_move_buttons` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:290`). |
| `language` | `"de" \| "en"` | `"de"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:287`). |
| `max_files_per_scan` | `string` | `"50"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:295`). |
| `scan_parallelism` | `"low" \| "medium" \| "high"` | `"medium"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:296`). |
| `show_hidden_folders`, `show_empty_folders` | `boolean`, `boolean` | `false`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:297`). |
| `flashcard_*` | diverse | Defaults aus Flashcard-Konstanten (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:300`). |
| `fast_flashcard_*` | diverse | Defaults aus Fast-Flashcard-Konstanten (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:305`). |
| `spaced_repetition_*` | diverse | Defaults aus SR-Konstanten (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:312`). |
| `exam_show_timeline`, `exam_help_enabled` | `boolean`, `boolean` | `true`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:310`). |
| `right_toolbar_collapsed` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:318`). |
| `exam_max_total_points`, `exam_task_count`, `exam_task_points` | `number`, `number`, `number[]` | Geklemmt/normalisiert (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:968`). |
| `exam_duration_minutes`, `exam_time_limit_enabled` | `number`, `boolean` | `30`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:324`). |
| `exam_auto_cards_types`, `exam_auto_cards_return_on_correct` | `object`, `boolean` | Typ-normalisiert, Default `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:326`). |
| `exam_grade_scale` | `"standard-1-6"` | `"standard-1-6"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:340`). |
| `exam_ai_evaluation` | `{ enabled: boolean, provider: "shared-gpt" \| null }` | `{ enabled: false, provider: null }` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:336`). |
| `keyboard_shortcuts` | `object` | Normalisiert (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:1005`). |

Beispiel (gekuerzt, echte Keys):

```json
{
  "schemaVersion": 1,
  "id": "2026-01-14_Kleif",
  "name": "Kleif",
  "createdAt": "2026-01-14T00:00:00.000Z",
  "settings": {
    "theme": "light",
    "flashcard_mode": "all",
    "spaced_repetition_boxes": 3,
    "exam_grade_scale": "standard-1-6"
  }
}
```

Quellen Beispiele:
- `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/profile.json`
- `docs/dev/test/archive/user/profiles/2026-01-14_Kleif/profile.json`

### 4.3 `spaced-repetition.json`

| Feld | Typ | Bedeutung | Default / Normalisierung |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Store-Schema | Immer `1` im normalisierten Objekt (`apps/fmd-desktop/src/features/user-vault/storage.ts:503`). |
| `byVaultId` | `Record<string, SpacedRepetitionStorage>` | Pro Vault-Key eigene SR-Daten. | Fehlend -> `{}` (`apps/fmd-desktop/src/features/user-vault/storage.ts:495`). |
| `migratedVaultIds` | `string[]` | Markiert migrierte Vault-IDs. | Fehlend/ungueltig -> `[]` (`apps/fmd-desktop/src/features/user-vault/storage.ts:499`). |

`SpacedRepetitionStorage` (pro `byVaultId[key]`):
- `users: { id, name, createdAt }[]`
- `userStateById: Record<userId, { cardStates, completedPerDay, lastLoadedAt }>`
- `lastActiveUserId: string | null`

Beim Hydratisieren werden User-/State-Eintraege normalisiert, card progress repariert (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:426`).

Wichtige Key-Regel:
- Aktuelles Verhalten nutzt fuer alle Profil-Modi (Auto/Custom) den stabilen Key `__profile__`, damit SR-User immer mit dem Profilordner mitwandern (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:197`).
- Legacy-Keys auf Basis des Vault-Pfad-Hash werden bei Bedarf automatisch nach `__profile__` migriert; zuerst wird der aktuelle Vault-Hash bevorzugt, sonst der am besten befuellte Legacy-Eintrag (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:157`, `apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:560`).

Beispiel (gekuerzt, echte Keys):

```json
{
  "schemaVersion": 1,
  "byVaultId": {
    "f636d0e3": {
      "users": [{ "id": "8968e153-...", "name": "Lysanne", "createdAt": "2026-01-14T13:50:43.668Z" }],
      "userStateById": {},
      "lastActiveUserId": "8968e153-..."
    }
  },
  "migratedVaultIds": ["f636d0e3"]
}
```

Quelle Beispiel: `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/spaced-repetition.json`.

### 4.4 `exam-runs.json`

| Feld | Typ | Bedeutung | Default / Normalisierung |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Exam-Store-Schema | Immer `1` (`apps/fmd-desktop/src/features/user-vault/storage.ts:605`). |
| `runs` | `ExamRun[]` | Historie einzelner Exam-Sessions | Fehlend -> `[]`, defekte Runs werden gefiltert (`apps/fmd-desktop/src/features/user-vault/storage.ts:593`). |
| `migratedFromAppData` | `boolean` | Marker fuer Legacy-AppData-Migration | Fehlend -> `false` (`apps/fmd-desktop/src/features/user-vault/storage.ts:595`). |

`ExamRun` Felder: `id`, `startedAt`, `endedAt`, `durationMs`, `userId`, `userName`, `examFilePath`, `tasksDetected`, `maxPoints`, `achievedPoints`, `percent`, `passed`, `grade`, `gradeScaleId` (`apps/fmd-desktop/src/lib/examRuns.ts:16`).

Defektbehandlung:
- Parse-Fehler -> Datei wird nach `.corrupt.<timestamp>.json` umbenannt und leerer Store geschrieben (`apps/fmd-desktop/src/features/user-vault/storage.ts:843`).
- Writes sind hier atomar-angelehnt (tmp + rename, Fallback direct write) (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`).

Beispiel (gekuerzt, echte Keys):

```json
{
  "schemaVersion": 1,
  "runs": [
    {
      "id": "3f1599f4-...",
      "startedAt": "2026-01-14T19:32:24.422Z",
      "endedAt": "2026-01-14T19:33:06.686Z",
      "userName": "xx",
      "percent": 0,
      "gradeScaleId": "standard-1-6"
    }
  ],
  "migratedFromAppData": true
}
```

Quelle Beispiel: `docs/dev/test/archive/user/profiles/2026-01-14_Kleif/exam-runs.json`.

### 4.5 `fast-flashcard.json` (im aktuellen System vorhanden)

| Feld | Typ | Bedeutung | Default / Normalisierung |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Store-Schema | Immer `1` (`apps/fmd-desktop/src/features/user-vault/storage.ts:522`). |
| `sessions` | `FastFlashcardSessionSummary[]` | Session-Historie | Fehlend -> `[]` (`apps/fmd-desktop/src/features/user-vault/storage.ts:514`). |
| `migratedFromAppData` | `boolean` | Marker fuer Legacy-AppData-Migration | Fehlend -> `false` (`apps/fmd-desktop/src/features/user-vault/storage.ts:517`). |

Beispiel (gekuerzt, echte Keys):

```json
{
  "schemaVersion": 1,
  "sessions": [{ "id": "48be8948-...", "score": 16, "durationMs": 33846 }],
  "migratedFromAppData": true
}
```

Quelle Beispiel: `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/fast-flashcard.json`.

## 5. Lebenszyklus / Flows

### 5.1 App Start / Vault oeffnen

1. `AppStateProvider` initialisiert `useUserVault` mit `vaultPath`, `mode`, `customPath` aus Settings (`apps/fmd-desktop/src/components/AppStateProvider.tsx:197`).
2. `useUserVault` fuehrt `refreshProfiles()` auf Mount aus (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:386`).
3. Aktiver `activeProfilePath` wird in den Settings-Hook gespiegelt (`setUserVaultProfileContext`) (`apps/fmd-desktop/src/components/AppStateProvider.tsx:212`).
4. Feature-Hooks laden danach profile-gebundene Daten:
   - SRS (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`)
   - Exam (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`)
   - Fast Flashcard (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`)

### 5.2 Profile-Root ermitteln (Auto vs Custom)

1. `resolveActiveProfileRoot(mode, vaultPath, customPath)`:
   - `auto` -> `<vault>/profile`
   - `custom` -> `resolveCustomProfileRootPath(customPath)`:
     ausgewaehlter Elternordner wird zu `<auswahl>/profile`; bei bestehendem Suffix `profile` bleibt der Pfad unveraendert (`apps/fmd-desktop/src/lib/userVault.ts:92`, `apps/fmd-desktop/src/lib/userVault.ts:106`)
2. In `auto` ohne Vault gibt es keinen Root (`No active vault selected`) (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:193`).
3. In `custom` ohne Pfad -> Fehler `Custom path is required.` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:221`).

### 5.3 Erstinitialisierung (Ordner + Default-Dateien)

1. Bei vorhandenem Vault versucht die App Legacy-Migration `user -> profile` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:160`).
2. `ensureProfileRoot`:
   - erstellt Root-Verzeichnis bei Bedarf,
   - validiert/repariert `user-vault.json`,
   - prueft Root-Zugriff (`apps/fmd-desktop/src/features/user-vault/storage.ts:319`).
3. Profile werden gelistet; wenn leer: Auto-Erzeugung eines Profils mit Name `"default"` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:274`).
4. Active-Profil wird gesetzt (oder auf erstes Profil gefixt) und nach `user-vault.json` persistiert (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:320`).

### 5.4 User laden (Active User aus `user-vault.json` o. ae.)

Es gibt zwei "aktive User"-Achsen:

1. Aktives Profil (Profilebene):
   - Quelle: `user-vault.json.activeProfileId` (`apps/fmd-desktop/src/features/user-vault/storage.ts:617`).
   - Wenn ID ungueltig/nicht vorhanden: Fallback auf erstes Profil + Rewrite (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:312`).

2. Aktiver SR-User (innerhalb eines Profils):
   - Quelle: `spaced-repetition.json.byVaultId[key].lastActiveUserId` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:487`).
   - Beim Hydratisieren wird nur auf existierende User referenziert (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:496`).

Legacy-Fallback ausserhalb des Profile-Roots:
- Wenn kein `activeProfilePath` vorhanden ist, lesen Exam/Fast aus AppData (`exam_runs.json`, `fast_flashcard.json`) via Tauri-Commands (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:183`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:372`, `apps/fmd-desktop/src-tauri/src/lib.rs:337`, `apps/fmd-desktop/src-tauri/src/lib.rs:330`).
- Beim ersten Profil-Load mit leerem Profilstore und `migratedFromAppData=false` wird Legacy einmalig ins Profil uebernommen und markiert (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:166`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:353`).

### 5.5 User erstellen (inkl. Kollisionsbehandlung)

Profil-Erstellung:
1. Name sanitizen.
2. ID `YYYY-MM-DD_<name>`.
3. Kollisionsschleife `-1`, `-2`, ...
4. Ordner anlegen + `profile.json` schreiben (`settings: {}`) (`apps/fmd-desktop/src/features/user-vault/storage.ts:660`).

Aufrufer:
- Auto-Create beim Bootstrap (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:276`)
- Vault-Manager `CREATE PROFILE` (`apps/fmd-desktop/src/components/VaultManagerModal.tsx:479`)

SR-User-Erstellung (nicht Profilordner):
- Erfolgt in Spaced-Repetition-State (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:700`)
- Persistiert indirekt ueber naechsten Save von `spaced-repetition.json` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:593`).

### 5.6 User wechseln (Persistenz + Reload-Bedingungen)

Profil wechseln:
1. `setActiveProfileId(profileRoot, profileId)` schreibt `user-vault.json` (`apps/fmd-desktop/src/features/user-vault/storage.ts:697`).
2. UI-State `activeProfileId` wird gesetzt (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:458`).
3. Abhaengige Hooks laden neu ueber `activeProfilePath`-Dependency:
   - SRS (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:576`)
   - Exam (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:204`)
   - Fast (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:393`)
   - Settings im Profil (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:1889`)

Profil loeschen:
- Aktuell keine Delete-API fuer Profilordner im User-Vault-Storage vorhanden (exportierte Write-Operationen sind Create + SetActive + Save-Operationen, z.B. `apps/fmd-desktop/src/features/user-vault/storage.ts:660`, `apps/fmd-desktop/src/features/user-vault/storage.ts:697`).

## 6. Konsistenzregeln & Invarianten

1. Single source of truth fuer aktives Profil ist `user-vault.json.activeProfileId` (`apps/fmd-desktop/src/features/user-vault/storage.ts:613`).
2. Ein Profilordner gilt nur dann als Profil, wenn `profile.json` vorhanden/lesbar ist (`apps/fmd-desktop/src/features/user-vault/storage.ts:94`).
3. Profil-ID sollte mit Ordnernamen konsistent sein. Sonst koennen Deduplikation und Auswahl inkonsistent werden, weil Listing nach `meta.id` merged (`apps/fmd-desktop/src/features/user-vault/storage.ts:267`).
4. Writes:
   - Atomar-angelehnt nur fuer `exam-runs.json` (tmp+rename, fallback direct write) (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`).
   - Andere JSON-Dateien schreiben direkt (`apps/fmd-desktop/src/features/user-vault/storage.ts:163`).
   - Backend-IO nutzt `fs::write` / `fs::rename`; es gibt keine expliziten `fsync`-Schritte (`apps/fmd-desktop/src-tauri/src/lib.rs:803`, `apps/fmd-desktop/src-tauri/src/lib.rs:815`).
5. Fehlende Dateien:
   - `user-vault.json`: wird bei `ensureProfileRoot` erstellt/repariert (`apps/fmd-desktop/src/features/user-vault/storage.ts:347`).
   - `exam-runs.json`: wird bei Load/Recovery neu erzeugt (`apps/fmd-desktop/src/features/user-vault/storage.ts:854`).
   - `spaced-repetition.json` / `fast-flashcard.json`: fehlend -> In-Memory-Default; Datei erst beim naechsten Save (`apps/fmd-desktop/src/features/user-vault/storage.ts:785`, `apps/fmd-desktop/src/features/user-vault/storage.ts:813`).
6. Vault-Wechsel:
   - Auto-Mode folgt dem aktiven Vault (`apps/fmd-desktop/src/lib/userVault.ts:101`).
   - Custom-Mode bleibt auf fixem Pfad (`apps/fmd-desktop/src/lib/userVault.ts:97`).
7. Legacy-Konflikt `/user` + `/profile`:
   - Es wird nicht automatisch entschieden; nur Warning (`apps/fmd-desktop/src/features/user-vault/storage.ts:292`, `apps/fmd-desktop/src/features/user-vault/useUserVault.ts:161`).

## 7. Fehlerbilder & Debugging-Checkliste

| Fehlerbild                                                        | Symptom in UI                                            | Wahrscheinlichste Ursache                             | Welche Datei pruefen                              | Erwarteter Fix                                                                                                                                                     |
| ----------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Active-Profil zeigt auf nicht existierenden Ordner                | Profilstatus springt auf anderes Profil oder kein Profil | `activeProfileId` stale nach manuellem FS-Eingriff    | `<PROFILE_ROOT>/user-vault.json`                  | `activeProfileId` auf existierende ID setzen oder Bootstrap laufen lassen (setzt ersten Treffer) (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:316`). |
| Profile-Root ist Datei statt Ordner                               | Fehler "Profile root is not a directory."                | Falscher Custom-Pfad / defekter FS-Zustand            | Root-Pfad selbst                                  | Pfad korrigieren/Ordner neu waehlen (`apps/fmd-desktop/src/features/user-vault/storage.ts:328`).                                                                   |
| Profilordner existiert, aber wird nicht gelistet                  | Kein Profil in Liste, obwohl Datendateien da sind        | `profile.json` fehlt oder ist kein JSON-File          | `<profile>/profile.json`                          | `profile.json` anlegen/reparieren; erst dann wird Ordner als Profil erkannt (`apps/fmd-desktop/src/features/user-vault/storage.ts:94`).                            |
| `exam-runs.json` korrupt                                          | Exam-History ploetzlich leer                             | Parse-Fehler, Datei wurde rotiert                     | `<profile>/exam-runs.json` + `.corrupt.*.json`    | Backup prüfen, ggf. Daten manuell wiederherstellen; Store wird als leer neu erstellt (`apps/fmd-desktop/src/features/user-vault/storage.ts:844`).                  |
| Unerwarteter Write-Pfad (`profiles` statt `users` oder umgekehrt) | Neue Profile landen "falsch"                             | Legacy-Ordnerstruktur beeinflusst Write-Root-Resolver | `<PROFILE_ROOT>/users`, `<PROFILE_ROOT>/profiles` | Struktur vereinheitlichen; Resolver waehlt priorisiert `users`, sonst `profiles` (`apps/fmd-desktop/src/features/user-vault/storage.ts:645`).                      |
| Warning zu `/user` und `/profile` gleichzeitig                    | Migration-Warnung im Status                              | Beide Legacy-/neue Roots vorhanden                    | `<VAULT>/user` und `<VAULT>/profile`              | Einen Root konsolidieren; Auto-Mode nutzt `<vault>/profile` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:163`).                                      |
| Datenverlust bei abruptem Close nach Save                         | Einzelne Aenderungen fehlen nach Neustart                | Nicht-atomare bzw. `void`-Saves (SRS/Fast)            | `spaced-repetition.json`, `fast-flashcard.json`   | Persistenzpfad haerten (await + atomare Writes); aktuell nur Exam-Store nutzt atomic helper (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`).           |

## 8. Tests / Assertions (Empfehlungen)

### 8.1 Unit-/Integration-Testfaelle

Pflichtfaelle (teils schon vorhanden):
1. Root-Init/Reparatur (`ensureProfileRoot`) inkl. invalidem `user-vault.json` (`apps/fmd-desktop/src/features/user-vault/storage.test.ts:114`).
2. Profilscan in `users/`, `profiles/`, direct-root (`apps/fmd-desktop/src/features/user-vault/profileUsers.test.ts:54`).
3. Namenskollisionen bei Profil-Erzeugung (`-1`, `-2`).
4. Defekte `exam-runs.json` -> `.corrupt` Backup + Empty-Store.
5. Active-Profil-Recovery bei stale `activeProfileId`.
6. Auto-vs-Custom Root-Wechsel mit Vault-Wechsel.
7. Legacy-Migration `/user` -> `/profile` inkl. Konfliktfall.
8. SR-Custom-Key-Migration zu `__profile__` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:537`).

### 8.2 Manuelle Smoke-Test-Schritte

1. Leeren Vault oeffnen (Auto-Mode aktiv).
2. Erwartung: `<vault>/profile/user-vault.json` existiert und ein Default-Profil wurde erstellt.
3. Erwartung: Profilordner `profile/users/<YYYY-MM-DD>_default/` mit `profile.json`.
4. In SRS User erstellen/laden.
5. Erwartung: `spaced-repetition.json` wird geschrieben.
6. Exam abschliessen.
7. Erwartung: `exam-runs.json` enthaelt neuen Run.
8. Fast-Flashcard Session beenden.
9. Erwartung: `fast-flashcard.json` enthaelt Session-Historie.
10. Profil wechseln (oder neues Profil erzeugen) und pruefen, dass Daten getrennt bleiben.

## 9. Aenderungsleitfaden

Wenn ein neues per-user Feature hinzukommt (z.B. `learning-streak.json`):

1. `storage.ts` erweitern:
   - Dateikonstante + Path-Resolver
   - Store-Typ
   - `createEmpty*`, `normalize*`, `load*`, `save*`
   (`apps/fmd-desktop/src/features/user-vault/storage.ts`).
2. In `loadProfileData` einhaengen, damit Export/Import das Feature kennt (`apps/fmd-desktop/src/features/user-vault/storage.ts:707`).
3. Export/Import-Merge in `lib/userVault.ts` und `useUserVault.ts` erweitern (`apps/fmd-desktop/src/lib/userVault.ts:156`, `apps/fmd-desktop/src/features/user-vault/useUserVault.ts:529`).
4. Feature-Hook auf `userVault.activeProfilePath` + `userVault.revision` reagieren lassen (Muster siehe SRS/Exam/Fast).
5. Tests ergaenzen:
   - Missing/parse-Error
   - Migration/Defaulting
   - Profilwechsel-Isolation
6. Doku aktualisieren:
   - Dateiuebersicht
   - JSON-Schema
   - Debugging-Checkliste
