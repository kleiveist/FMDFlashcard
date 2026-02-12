<!-- AUTO-GENERATED:backlink START -->
[← Back](sync.md)
<!-- AUTO-GENERATED:backlink END -->
# Profile System (Developer Documentation)

This document describes the current profile/user storage system based on implemented code, including legacy compatibility, invariants, and debugging.

## 1. Terms and Responsibilities

| Term | Meaning | Source of Truth / Owner |
| --- | --- | --- |
| Vault | Open markdown folder in the app. | AppState + vault feature (`apps/fmd-desktop/src/components/AppStateProvider.tsx:197`) |
| Profile root | Root folder for profile files (`auto`: `<vault>/profile`, `custom`: selected path normalized to `<selected>/profile`, unless already ending with `profile`). | Resolver in `resolveActiveProfileRoot` + `resolveCustomProfileRootPath` (`apps/fmd-desktop/src/lib/userVault.ts:92`, `apps/fmd-desktop/src/lib/userVault.ts:106`) |
| Profile | Filesystem folder with at least `profile.json`; contains per-profile feature stores. | Storage service (`apps/fmd-desktop/src/features/user-vault/storage.ts:660`) |
| "User" (SR user) | Domain user inside spaced repetition (multiple per profile). | `spaced-repetition.json` under `byVaultId[*].users` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:426`) |

Profile vs user boundary:
- A profile decides storage location and associated files for settings, SRS, exam runs, and fast flashcard (`apps/fmd-desktop/src/features/user-vault/storage.ts:707`).
- An SR user lives inside a profile in `spaced-repetition.json` and only controls spaced repetition state (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:700`).

## 2. Directory Layout (with Tree + Explanation)

Current target layout (new writes default to `users/`):

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

Legacy-compatible reads (still supported):
- `<PROFILE_ROOT>/profiles/<profile-id>/...` (`apps/fmd-desktop/src/features/user-vault/storage.ts:213`)
- `<PROFILE_ROOT>/<profile-id>/...` directly under root when `profile.json` exists (`apps/fmd-desktop/src/features/user-vault/storage.ts:262`)

### Profile folder naming scheme

Profile IDs are generated as follows:
1. Sanitize name (`sanitizeProfileName`): whitespace -> `-`, invalid filename chars -> `-`, collapse repeated `-` (`apps/fmd-desktop/src/lib/userVault.ts:61`).
2. Prefix with day stamp (`YYYY-MM-DD_`) via `Intl.DateTimeFormat("en-CA")` (`apps/fmd-desktop/src/lib/userVault.ts:55`, `apps/fmd-desktop/src/lib/userVault.ts:76`).
3. On collision add suffix `-1`, `-2`, ... (`apps/fmd-desktop/src/features/user-vault/storage.ts:671`).

Example:
- `default` -> `2026-02-11_default`
- collision -> `2026-02-11_default-1`

Write target for new profiles:
- If `users/` exists: write to `users/`.
- Else, if only `profiles/` exists: write to `profiles/`.
- Else create and write to `users/` (`apps/fmd-desktop/src/features/user-vault/storage.ts:636`).

## 3. File Overview

| File | Scope (global/per-user) | Owner module | When written | When read | Content/schema | Example path |
| --- | --- | --- | --- | --- | --- | --- |
| `user-vault.json` | global (per profile root) | Storage service (`apps/fmd-desktop/src/features/user-vault/storage.ts:613`) | Root init/repair, active profile switch (`apps/fmd-desktop/src/features/user-vault/storage.ts:356`, `apps/fmd-desktop/src/features/user-vault/storage.ts:697`) | Bootstrap, vault manager (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:271`, `apps/fmd-desktop/src/components/VaultManagerModal.tsx:157`) | `{ schemaVersion, activeProfileId }` | `<PROFILE_ROOT>/user-vault.json` |
| `profile.json` | per-user (per profile folder) | Storage service + settings hook (`apps/fmd-desktop/src/features/user-vault/storage.ts:722`, `apps/fmd-desktop/src/features/settings/useAppSettings.ts:1542`) | Profile creation, settings save, settings migration (`apps/fmd-desktop/src/features/user-vault/storage.ts:689`, `apps/fmd-desktop/src/features/user-vault/storage.ts:765`) | Profile listing/meta, settings load (`apps/fmd-desktop/src/features/user-vault/storage.ts:232`, `apps/fmd-desktop/src/features/user-vault/storage.ts:726`) | `{ schemaVersion, id, name, createdAt, settings }` | `<PROFILE_ROOT>/users/<id>/profile.json` |
| `spaced-repetition.json` | per-user | Spaced-repetition hook + storage service (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`, `apps/fmd-desktop/src/features/user-vault/storage.ts:781`) | While persisting SR state (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:593`) | On SR context load (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`) | `{ schemaVersion, byVaultId, migratedVaultIds }` | `<PROFILE_ROOT>/users/<id>/spaced-repetition.json` |
| `exam-runs.json` | per-user | Exam view model + storage service (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`, `apps/fmd-desktop/src/features/user-vault/storage.ts:837`) | Exam run append/delete/save + recovery (`apps/fmd-desktop/src/features/user-vault/storage.ts:896`, `apps/fmd-desktop/src/features/user-vault/storage.ts:951`) | Exam history load (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`) | `{ schemaVersion, runs, migratedFromAppData }` | `<PROFILE_ROOT>/users/<id>/exam-runs.json` |
| `fast-flashcard.json` | per-user | Fast-session hook + storage service (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`, `apps/fmd-desktop/src/features/user-vault/storage.ts:809`) | Session history save/reset (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:411`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:65`) | Session history load (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`) | `{ schemaVersion, sessions, migratedFromAppData }` | `<PROFILE_ROOT>/users/<id>/fast-flashcard.json` |

## 4. JSON Schemas (per file)

### 4.1 `user-vault.json`

| Field | Type | Meaning | Default / normalization |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Schema level for root metadata. | Always normalized to `1` (`apps/fmd-desktop/src/features/user-vault/storage.ts:365`). |
| `activeProfileId` | `string | null` | Active profile ID in current profile root. | Non-string -> `null` (`apps/fmd-desktop/src/features/user-vault/storage.ts:367`). |

Example (real keys):

```json
{
  "schemaVersion": 1,
  "activeProfileId": "2026-01-14_Kleif"
}
```

Source example: `docs/dev/test/archive/test_editor/user/user-vault.json`.

### 4.2 `profile.json`

Top-level fields:

| Field | Type | Meaning | Default / normalization |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Profile schema version. | Missing/old gets migrated to `1` while loading (`apps/fmd-desktop/src/features/user-vault/storage.ts:455`). |
| `id` | `string` | Profile ID (folder ID). | Fallback from folder name when metadata is invalid (`apps/fmd-desktop/src/features/user-vault/storage.ts:448`). |
| `name` | `string` | Display name. | Fallback from `parseProfileId(id)` (`apps/fmd-desktop/src/features/user-vault/storage.ts:452`). |
| `createdAt` | `string` (ISO) | Profile creation timestamp. | Fallback from date prefix or `now` (`apps/fmd-desktop/src/features/user-vault/storage.ts:449`). |
| `settings` | `object | null` | Profile-scoped app settings. | New profile starts with `{}` (`apps/fmd-desktop/src/features/user-vault/storage.ts:692`), empty object is treated as `null` on read (`apps/fmd-desktop/src/features/user-vault/storage.ts:746`). |

Persisted `settings` keys (write path):
- Write list source: `buildProfileSettingsPayload` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:676`)
- Defaults/normalization source: `normalizeSettings` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:734`)

| Key | Type | Default (on load) |
| --- | --- | --- |
| `active_note_path`, `vault_path` | `string | null` | `null` if not set. |
| `recent_vaults` | `RecentVaultEntry[]` | `[]` (normalized). |
| `theme` | `"light" | "dark"` | `"light"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:738`). |
| `accent_color` | `string` (hex) | `DEFAULT_ACCENT` when invalid (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:739`). |
| `markdownEditor` | `object` | Falls back to normalized hex values. |
| `editor_markdown_exact_colors_enabled` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:757`). |
| `editor_blueprint_grid`, `editor_blueprint_grid_intensity` | `boolean`, `string` | `false`, `"medium"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:288`). |
| `editor_markdown_view_edit_enabled`, `editor_markdown_preview_default_mode` | `boolean`, `"markdown" | "raw"` | `false`, `"markdown"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:292`). |
| `exam_editor_show_move_buttons` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:290`). |
| `language` | `"de" | "en"` | `"de"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:287`). |
| `max_files_per_scan` | `string` | `"50"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:295`). |
| `scan_parallelism` | `"low" | "medium" | "high"` | `"medium"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:296`). |
| `show_hidden_folders`, `show_empty_folders` | `boolean`, `boolean` | `false`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:297`). |
| `flashcard_*` | mixed | Defaults from flashcard constants (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:300`). |
| `fast_flashcard_*` | mixed | Defaults from fast-flashcard constants (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:305`). |
| `spaced_repetition_*` | mixed | Defaults from SR constants (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:312`). |
| `exam_show_timeline`, `exam_help_enabled` | `boolean`, `boolean` | `true`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:310`). |
| `right_toolbar_collapsed` | `boolean` | `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:318`). |
| `exam_max_total_points`, `exam_task_count`, `exam_task_points` | `number`, `number`, `number[]` | Clamped/normalized (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:968`). |
| `exam_duration_minutes`, `exam_time_limit_enabled` | `number`, `boolean` | `30`, `true` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:324`). |
| `exam_auto_cards_types`, `exam_auto_cards_return_on_correct` | `object`, `boolean` | Type-normalized, default `false` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:326`). |
| `exam_grade_scale` | `"standard-1-6"` | `"standard-1-6"` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:340`). |
| `exam_ai_evaluation` | `{ enabled: boolean, provider: "shared-gpt" | null }` | `{ enabled: false, provider: null }` (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:336`). |
| `keyboard_shortcuts` | `object` | Normalized (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:1005`). |

Example (shortened, real keys):

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

Example sources:
- `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/profile.json`
- `docs/dev/test/archive/user/profiles/2026-01-14_Kleif/profile.json`

### 4.3 `spaced-repetition.json`

| Field | Type | Meaning | Default / normalization |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Store schema version. | Always `1` in normalized store (`apps/fmd-desktop/src/features/user-vault/storage.ts:503`). |
| `byVaultId` | `Record<string, SpacedRepetitionStorage>` | SR data per vault key. | Missing -> `{}` (`apps/fmd-desktop/src/features/user-vault/storage.ts:495`). |
| `migratedVaultIds` | `string[]` | Marker for migrated vault IDs. | Missing/invalid -> `[]` (`apps/fmd-desktop/src/features/user-vault/storage.ts:499`). |

`SpacedRepetitionStorage` (per `byVaultId[key]`):
- `users: { id, name, createdAt }[]`
- `userStateById: Record<userId, { cardStates, completedPerDay, lastLoadedAt }>`
- `lastActiveUserId: string | null`

Hydration normalizes user/state entries and repairs card progress (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:426`).

Important key rule:
- Current behavior uses the stable key `__profile__` for all profile modes (auto/custom), so SR users move with the profile folder (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:197`).
- Legacy vault-path hash keys are auto-migrated to `__profile__` when needed, preferring the current vault hash first and otherwise the most populated legacy entry (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:157`, `apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:560`).

Example (shortened, real keys):

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

Example source: `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/spaced-repetition.json`.

### 4.4 `exam-runs.json`

| Field | Type | Meaning | Default / normalization |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Exam store schema version. | Always `1` (`apps/fmd-desktop/src/features/user-vault/storage.ts:605`). |
| `runs` | `ExamRun[]` | History of exam sessions. | Missing -> `[]`, invalid runs are filtered out (`apps/fmd-desktop/src/features/user-vault/storage.ts:593`). |
| `migratedFromAppData` | `boolean` | Marker for legacy app-data migration. | Missing -> `false` (`apps/fmd-desktop/src/features/user-vault/storage.ts:595`). |

`ExamRun` fields: `id`, `startedAt`, `endedAt`, `durationMs`, `userId`, `userName`, `examFilePath`, `tasksDetected`, `maxPoints`, `achievedPoints`, `percent`, `passed`, `grade`, `gradeScaleId` (`apps/fmd-desktop/src/lib/examRuns.ts:16`).

Corruption handling:
- Parse error -> file is renamed to `.corrupt.<timestamp>.json` and an empty store is written (`apps/fmd-desktop/src/features/user-vault/storage.ts:843`).
- Writes are atomic-like here (tmp + rename, fallback direct write) (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`).

Example (shortened, real keys):

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

Example source: `docs/dev/test/archive/user/profiles/2026-01-14_Kleif/exam-runs.json`.

### 4.5 `fast-flashcard.json` (present in current system)

| Field | Type | Meaning | Default / normalization |
| --- | --- | --- | --- |
| `schemaVersion` | `number` | Store schema version. | Always `1` (`apps/fmd-desktop/src/features/user-vault/storage.ts:522`). |
| `sessions` | `FastFlashcardSessionSummary[]` | Session history. | Missing -> `[]` (`apps/fmd-desktop/src/features/user-vault/storage.ts:514`). |
| `migratedFromAppData` | `boolean` | Marker for legacy app-data migration. | Missing -> `false` (`apps/fmd-desktop/src/features/user-vault/storage.ts:517`). |

Example (shortened, real keys):

```json
{
  "schemaVersion": 1,
  "sessions": [{ "id": "48be8948-...", "score": 16, "durationMs": 33846 }],
  "migratedFromAppData": true
}
```

Example source: `docs/dev/test/archive/test_editor/user/profiles/2026-01-14_Kleif/fast-flashcard.json`.

## 5. Lifecycle / Flows

### 5.1 App start / open vault

1. `AppStateProvider` initializes `useUserVault` with `vaultPath`, `mode`, and `customPath` from settings (`apps/fmd-desktop/src/components/AppStateProvider.tsx:197`).
2. `useUserVault` triggers `refreshProfiles()` on mount (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:386`).
3. Active `activeProfilePath` is mirrored into settings hook context (`setUserVaultProfileContext`) (`apps/fmd-desktop/src/components/AppStateProvider.tsx:212`).
4. Feature hooks then load profile-scoped data:
   - SRS (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:533`)
   - Exam (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:163`)
   - Fast flashcard (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:350`)

### 5.2 Resolve profile root (auto vs custom)

1. `resolveActiveProfileRoot(mode, vaultPath, customPath)`:
   - `auto` -> `<vault>/profile`
   - `custom` -> `resolveCustomProfileRootPath(customPath)`:
     selected parent folder becomes `<selected>/profile`; if already ending with `profile`, path is reused (`apps/fmd-desktop/src/lib/userVault.ts:92`, `apps/fmd-desktop/src/lib/userVault.ts:106`)
2. In auto mode without a vault there is no root (`No active vault selected`) (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:193`).
3. In custom mode without path -> error `Custom path is required.` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:221`).

### 5.3 First-time initialization (folders + default files)

1. If a vault exists, app tries legacy migration `user -> profile` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:160`).
2. `ensureProfileRoot`:
   - creates root folder when needed,
   - validates/repairs `user-vault.json`,
   - verifies root accessibility (`apps/fmd-desktop/src/features/user-vault/storage.ts:319`).
3. Profiles are listed; if empty: auto-create profile named `default` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:274`).
4. Active profile is set (or fixed to first profile) and persisted to `user-vault.json` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:320`).

### 5.4 Load user (active user from `user-vault.json` etc.)

There are two active-user axes:

1. Active profile (profile level):
   - Source: `user-vault.json.activeProfileId` (`apps/fmd-desktop/src/features/user-vault/storage.ts:617`).
   - If ID is invalid/missing: fallback to first profile + rewrite (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:312`).

2. Active SR user (inside a profile):
   - Source: `spaced-repetition.json.byVaultId[key].lastActiveUserId` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:487`).
   - Hydration only keeps references to existing users (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:496`).

Legacy fallback outside profile root:
- If no `activeProfilePath` exists, exam/fast read from app-data files (`exam_runs.json`, `fast_flashcard.json`) via Tauri commands (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:183`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:372`, `apps/fmd-desktop/src-tauri/src/lib.rs:337`, `apps/fmd-desktop/src-tauri/src/lib.rs:330`).
- On first profile load with empty profile store and `migratedFromAppData=false`, legacy data is imported once into the profile and flagged (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:166`, `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:353`).

### 5.5 Create user (including collision handling)

Profile creation:
1. Sanitize input name.
2. Build ID `YYYY-MM-DD_<name>`.
3. Collision loop `-1`, `-2`, ...
4. Create folder + write `profile.json` (`settings: {}`) (`apps/fmd-desktop/src/features/user-vault/storage.ts:660`).

Callers:
- Auto-create during bootstrap (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:276`)
- Vault manager `CREATE PROFILE` (`apps/fmd-desktop/src/components/VaultManagerModal.tsx:479`)

SR user creation (not profile folder):
- Implemented in spaced-repetition state (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:700`)
- Persisted indirectly on next `spaced-repetition.json` save (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:593`)

### 5.6 Switch user (persistence + reload conditions)

Switch profile:
1. `setActiveProfileId(profileRoot, profileId)` writes `user-vault.json` (`apps/fmd-desktop/src/features/user-vault/storage.ts:697`).
2. UI state `activeProfileId` is updated (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:458`).
3. Dependent hooks reload via `activeProfilePath` dependency:
   - SRS (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:576`)
   - Exam (`apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts:204`)
   - Fast (`apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts:393`)
   - Settings in profile (`apps/fmd-desktop/src/features/settings/useAppSettings.ts:1889`)

Delete profile:
- There is currently no delete API for profile folders in user-vault storage (exported write operations are create + set-active + save operations, e.g. `apps/fmd-desktop/src/features/user-vault/storage.ts:660`, `apps/fmd-desktop/src/features/user-vault/storage.ts:697`).

## 6. Consistency Rules and Invariants

1. Single source of truth for active profile is `user-vault.json.activeProfileId` (`apps/fmd-desktop/src/features/user-vault/storage.ts:613`).
2. A folder is only treated as a profile if `profile.json` exists/readable (`apps/fmd-desktop/src/features/user-vault/storage.ts:94`).
3. Profile ID should be consistent with folder name. Otherwise deduplication and selection may become inconsistent because listing merges by `meta.id` (`apps/fmd-desktop/src/features/user-vault/storage.ts:267`).
4. Writes:
   - Atomic-like handling only for `exam-runs.json` (tmp+rename, fallback direct write) (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`).
   - Other JSON files are direct writes (`apps/fmd-desktop/src/features/user-vault/storage.ts:163`).
   - Backend IO uses `fs::write` / `fs::rename`; there are no explicit `fsync` steps (`apps/fmd-desktop/src-tauri/src/lib.rs:803`, `apps/fmd-desktop/src-tauri/src/lib.rs:815`).
5. Missing files:
   - `user-vault.json`: created/repaired by `ensureProfileRoot` (`apps/fmd-desktop/src/features/user-vault/storage.ts:347`).
   - `exam-runs.json`: recreated during load/recovery (`apps/fmd-desktop/src/features/user-vault/storage.ts:854`).
   - `spaced-repetition.json` / `fast-flashcard.json`: missing -> in-memory default; file is written on next save (`apps/fmd-desktop/src/features/user-vault/storage.ts:785`, `apps/fmd-desktop/src/features/user-vault/storage.ts:813`).
6. Vault switch:
   - Auto mode follows active vault (`apps/fmd-desktop/src/lib/userVault.ts:101`).
   - Custom mode stays fixed (`apps/fmd-desktop/src/lib/userVault.ts:97`).
7. Legacy conflict `/user` + `/profile`:
   - No automatic choice; warning only (`apps/fmd-desktop/src/features/user-vault/storage.ts:292`, `apps/fmd-desktop/src/features/user-vault/useUserVault.ts:161`).

## 7. Failure Modes and Debugging Checklist

| Failure mode | UI symptom | Most likely cause | File(s) to inspect | Expected fix |
| --- | --- | --- | --- | --- |
| Active profile points to missing folder | Profile status jumps to another profile or no profile | Stale `activeProfileId` after manual FS edits | `<PROFILE_ROOT>/user-vault.json` | Set `activeProfileId` to an existing ID or let bootstrap run (it picks first valid profile) (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:316`). |
| Profile root is a file instead of folder | Error "Profile root is not a directory." | Wrong custom path / broken FS state | Root path itself | Correct path / reselect folder (`apps/fmd-desktop/src/features/user-vault/storage.ts:328`). |
| Profile folder exists but is not listed | No profile in list even though data files exist | `profile.json` missing or invalid | `<profile>/profile.json` | Recreate/repair `profile.json`; folder is only recognized with this file (`apps/fmd-desktop/src/features/user-vault/storage.ts:94`). |
| `exam-runs.json` is corrupted | Exam history suddenly empty | Parse error, file got rotated | `<profile>/exam-runs.json` + `.corrupt.*.json` | Check backup, restore manually if needed; store is recreated empty (`apps/fmd-desktop/src/features/user-vault/storage.ts:844`). |
| Unexpected write path (`profiles` vs `users`) | New profiles appear in unexpected folder | Legacy folder structure affects write-root resolver | `<PROFILE_ROOT>/users`, `<PROFILE_ROOT>/profiles` | Normalize structure; resolver prefers `users`, then `profiles` (`apps/fmd-desktop/src/features/user-vault/storage.ts:645`). |
| Warning about `/user` and `/profile` both existing | Migration warning in status | Both legacy and new roots exist | `<VAULT>/user` and `<VAULT>/profile` | Consolidate to one root; auto mode uses `<vault>/profile` (`apps/fmd-desktop/src/features/user-vault/useUserVault.ts:163`). |
| Data missing after abrupt close | Some changes missing after restart | Non-atomic or fire-and-forget saves (SRS/Fast) | `spaced-repetition.json`, `fast-flashcard.json` | Harden persistence path (await + atomic writes); only exam store currently uses atomic helper (`apps/fmd-desktop/src/features/user-vault/storage.ts:168`). |

## 8. Tests / Assertions (Recommendations)

### 8.1 Unit/integration test cases

Required cases (some already exist):
1. Root init/repair (`ensureProfileRoot`) including invalid `user-vault.json` (`apps/fmd-desktop/src/features/user-vault/storage.test.ts:114`).
2. Profile scan in `users/`, `profiles/`, direct-root (`apps/fmd-desktop/src/features/user-vault/profileUsers.test.ts:54`).
3. Naming collisions on profile creation (`-1`, `-2`).
4. Corrupt `exam-runs.json` -> `.corrupt` backup + empty store.
5. Active-profile recovery with stale `activeProfileId`.
6. Auto-vs-custom root behavior on vault switch.
7. Legacy migration `/user` -> `/profile` including conflict case.
8. SR custom-key migration to `__profile__` (`apps/fmd-desktop/src/features/spaced-repetition/useSpacedRepetition.ts:537`).

### 8.2 Manual smoke test steps

1. Open an empty vault (auto mode enabled).
2. Expect `<vault>/profile/user-vault.json` to exist and a default profile to be created.
3. Expect profile folder `profile/users/<YYYY-MM-DD>_default/` with `profile.json`.
4. Create/load an SR user in SRS.
5. Expect `spaced-repetition.json` to be written.
6. Complete an exam.
7. Expect `exam-runs.json` to contain a new run.
8. Finish a fast-flashcard session.
9. Expect `fast-flashcard.json` to contain session history.
10. Switch profile (or create a new one) and verify data isolation.

## 9. Change Guide

When adding a new per-user feature (for example `learning-streak.json`):

1. Extend `storage.ts`:
   - file constant + path resolver
   - store type
   - `createEmpty*`, `normalize*`, `load*`, `save*`
   (`apps/fmd-desktop/src/features/user-vault/storage.ts`).
2. Hook into `loadProfileData` so export/import includes the feature (`apps/fmd-desktop/src/features/user-vault/storage.ts:707`).
3. Extend export/import merge logic in `lib/userVault.ts` and `useUserVault.ts` (`apps/fmd-desktop/src/lib/userVault.ts:156`, `apps/fmd-desktop/src/features/user-vault/useUserVault.ts:529`).
4. Ensure feature hook reacts to `userVault.activeProfilePath` + `userVault.revision` (see SRS/Exam/Fast patterns).
5. Add tests:
   - missing/parse error
   - migration/defaulting
   - profile-switch isolation
6. Update docs:
   - file overview
   - JSON schema
   - debugging checklist
