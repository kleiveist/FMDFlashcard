<!-- AUTO-GENERATED:backlink START -->
[← Back](sync.md)
<!-- AUTO-GENERATED:backlink END -->
# Profile system

This page describes the active runtime storage contract. Repository-level
`profiles/` contains only project defaults or documentation; real runtime
profiles always remain in the selected vault or external profile root.

## Root selection

In automatic mode, the profile root is `<vault>/.profile`. A custom selection
is normalized to a `.profile` child unless the selected directory already ends
in `.profile` or the legacy name `profile`. The earlier `<vault>/user` root can
be moved to `.profile` only when the destination does not already exist; a
source/destination conflict is reported and left untouched.

`user-vault.json` at the profile root contains schema version `1` and the
active profile ID. Invalid metadata is backed up with a timestamp before a new
empty metadata file is written. Missing roots and metadata are created only
after the selected location has been validated.

## Active layout

```text
<PROFILE_ROOT>/
  user-vault.json
  users/
    <YYYY-MM-DD_name>/
      profile.json
      settings.json
      fast-flashcard.json
      exam-points-profiles.json
      spaced-repetition/
        registry.json
        users/
          <encoded-user-id>/
            progress.json
      exam-runs/
        <user>_<timestamp>_run-<id>.md
```

For compatibility, profile folders below `profiles/` and profile folders
directly below the root are still discovered. New profiles prefer `users/`,
but continue using an existing `profiles/` directory when no `users/`
directory exists.

## File ownership

| Path | Purpose |
| --- | --- |
| `user-vault.json` | Root schema and active profile selection. |
| `profile.json` | Profile identity only: schema version, ID, name, and creation time. |
| `settings.json` | Profile-scoped application settings. |
| `fast-flashcard.json` | Fast-mode session history. |
| `exam-points-profiles.json` | Normalized exam point profiles and default selection. |
| `spaced-repetition/registry.json` | Active SR user and legacy-migration registry. |
| `spaced-repetition/users/*/progress.json` | One SR user's identity and card progress. |
| `exam-runs/*.md` | One exam run per Markdown file with readable frontmatter and lossless `run_data`. |

## Compatibility migrations

Migration is deliberately copy-first and repeatable:

- Embedded settings in an old `profile.json` are written atomically to
  `settings.json`; the original metadata is timestamp-backed up before it is
  reduced to identity fields.
- Legacy `spaced-repetition.json` data is merged into the folder store. The
  registry records migrated vault IDs, so another load does not duplicate
  progress. The source JSON remains in place.
- Legacy `exam-runs.json` entries are copied one at a time into atomic
  Markdown files. Existing run IDs are skipped, a partial copy can resume,
  and the JSON source is never automatically deleted. Until a run is copied,
  it remains readable from the source store.
- Invalid legacy data is reported or ignored without deleting it. A failed or
  unwritable target leaves the source as the rollback path.

The anonymous compatibility fixture is under
`fixtures/user-vault/legacy/`. Tests in
`frontend/src/features/user-vault/storage.test.ts` cover valid migration,
already-migrated state, a missing source, invalid input, an unwritable target,
and resumption after an interrupted copy.

## Operational rules

- Never place real profile roots, settings, vault paths, names, or learning
  history in Git.
- Back up a profile root before manual repair.
- Do not remove legacy JSON sources merely because the current application
  has copied their contents.
- Treat timestamped `.legacy.*`, `.corrupt.*`, and `.deleted.*` siblings as
  recovery material until the user has verified the migrated data.
- Use the in-app profile manager for normal create, select, and delete flows;
  edit runtime files manually only for a documented recovery operation.
