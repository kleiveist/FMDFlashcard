<!-- AUTO-GENERATED:backlink START -->
[← Back](migration.md)
<!-- AUTO-GENERATED:backlink END -->
# Template-Tooling migration report

Status: local implementation complete; pull-request CI and independent review pending

Plan version: 2.0

Started: 2026-08-28

Local implementation completed: 2026-08-29

## Immutable inputs

| Input | Value |
| --- | --- |
| `TEMPLATE_TOOLING_REF` | `tooling-v0.4.0` |
| `TEMPLATE_TOOLING_SHA` | `85a006757622f80f1612edc9ce015d5f91c2fe6c` |
| Template-Tooling default branch | `main` |
| Release archive | `Template-Tooling-0.4.0.tar.gz` |
| Release archive SHA-256 | `4913b337b1e3123fa82b0b8403e872ff120a15e3398304d5919fe5f6355e9f30` |
| `FMDFLASHCARD_BRANCH` | `main` |
| `FMDFLASHCARD_SHA` | `47addd795064e802fb0b67644de1b301c73e3de4` |
| Migration branch | `refactor/fmdflashcard-template-tooling-v2` |

Both local repositories were clean after fetching `origin` and tags. Both pinned commits
equalled their respective `origin/main` tips when this migration began. The migration branch
starts exactly at `FMDFLASHCARD_SHA`.

The release checksum from `SHA256SUMS` passed. The extracted 400-file payload was byte-for-byte
identical to `tools/` and `docs/toolingdocs/` at `TEMPLATE_TOOLING_SHA`. GitHub CLI 2.23.0 in the
initial environment did not provide the newer `gh attestation` command, so checksum, signed Git
tag provenance exposed by GitHub, immutable SHA, and payload-manifest validation are recorded as
the available trust chain. The release's internal manifest digest is
`sha256:86dd794e6a667e260467408c376d4e3d2dce30058bcb6d3449d3c62a72405568`.

## Confirmed tooling contract

The release stores portable documentation at `docs/toolingdocs/`, uses `tools/VERSION` (`0.4.0`),
and persists generated state at `.tooling-state/state.toml`. Only `tools/` and
`docs/toolingdocs/` are centrally replaceable. `project-tooling.toml`, `.tooling-state/`, product
files, arbitrary documentation, and user data remain project-owned.

The environment has `python3`, not a `python` alias. Commands below therefore use `python3`; the
CLI's own help text still renders `python` in its examples.

| Purpose | Confirmed command | Writes? | Rollback boundary |
| --- | --- | --- | --- |
| CLI discovery | `python3 tools/control.py --help` | no | not applicable |
| Diagnosis | `python3 tools/control.py doctor` | no | not applicable |
| Integration plan | `python3 tools/control.py integrate --check --json` | no | not applicable |
| Integration | `python3 tools/control.py integrate --full-fix --json` | on non-empty plan | transactional |
| Verification | `python3 tools/control.py tooling verify --json` | no | not applicable |
| Update plan | `python3 tools/control.py tooling migrate --check --json` | no | not applicable |
| Update apply | `python3 tools/control.py tooling migrate --json` | on non-empty plan | transactional |
| Portable export | `python3 tools/control.py tooling export --output PATH` | creates a new export | refuse existing target |

Read-only commands are required to leave `git status --short` and `git diff --exit-code`
unchanged. A Check exits `1` when a supported change is required and exits `0` only for a
verified no-op; that non-zero planning result is not itself a failed assessment.

## Initial inventory and ownership

The actual initial product layout matched the proposed legacy shape:

- the Vite/React application, its `pnpm-lock.yaml`, and all frontend tests lived below
  `apps/fmd-desktop/`;
- the Tauri 2 application and `Cargo.lock` lived below `apps/fmd-desktop/src-tauri/`;
- project documentation lived below `docs/`;
- an older project toolbox lived below `tools/`;
- `apps/UserGlobal/` contained seven committed JSON files;
- the only workflow-shaped file was `.github/workflows/build-pdf.md`. GitHub Actions does not
  load `.md` files as workflows, and its referenced LaTeX source did not exist in this revision.

| Source | Class | Destination/decision | Owner | Data risk | Verification |
| --- | --- | --- | --- | --- | --- |
| `apps/fmd-desktop/src`, `public`, frontend config | product code | `frontend/` | FMDFlashcard | low | TypeScript, Vitest, Vite |
| `apps/fmd-desktop/src-tauri` | product code | `src-tauri/` | FMDFlashcard | low | Cargo and Tauri smoke/build |
| `apps/UserGlobal/user-vault.json` | runtime user data | remove from Git; preserve external backup | user | high | checksum plus anonymized fixture |
| `apps/UserGlobal/profiles/**` | runtime user data | remove from Git; preserve external backup | user | high | checksum plus anonymized fixture |
| `docs/**` except `docs/toolingdocs/` | product documentation | remain under `docs/` and update active links | FMDFlashcard | low | link/path regression checks |
| old `tools/**` | superseded general tooling | replace only in dedicated tooling commit | Template-Tooling | medium | payload manifest and tooling tests |
| FMD-only extensions, if any survive review | project-specific tooling | `project-tools/fmdflashcard/` | FMDFlashcard | low | focused tests |
| build output, caches, `.BAK`, environments | old/generated data | do not migrate | none | low | ignored/untracked audit |

The legacy toolbox review found no FMD-specific implementation to preserve. Its package builders,
platform installers, environment bootstrap, doctor, and runner functions are general-purpose and
overlap the pinned central payload. `project-tools/fmdflashcard/` is therefore established as an
explicit extension boundary without copying obsolete scripts; later FMD-only acceptance helpers
may live there without modifying central files.

The committed `UserGlobal` files are not examples: they contain personal names, absolute local
paths, profile selections, identifiers, and learning/exam history. Before any mutation, all seven
files were copied outside the repository to a permission-restricted migration backup and a
`SHA256SUMS` file was generated. The repository will receive only anonymous, deterministic test
fixtures. No runtime source is automatically deleted by this migration.

The checksum set was verified immediately before removal from Git. The original working-tree
directory was then relocated, without content changes, beside the verified backup at
`/workspace/fmdflashcard-migration-backup.0lwd40/UserGlobal-working-tree-original`; a recursive
comparison against the checksum-protected copy passed. Both external copies remain available for
rollback, while the repository now contains only `fixtures/user-vault/legacy/` with synthetic
identifiers and paths.

The runtime compatibility path now treats the old JSON files conservatively:

- legacy embedded profile settings are copied to `settings.json`, and the original `profile.json`
  receives a timestamped JSON backup before its metadata is normalized;
- legacy spaced-repetition data is copied into the folder store while its source JSON remains;
- legacy `exam-runs.json` records are copied to per-run Markdown using atomic writes, retain a
  lossless machine-readable payload, and remain readable directly if the target is unavailable;
- repeat and partial-failure runs skip IDs already copied, so migration can resume without
  duplicate history.

Focused tests cover valid input, an already migrated run, a missing legacy file, corrupt input,
an unwritable target, and resumption after an interrupted multi-record copy. No migration path
deletes a legacy JSON source.

## Initial path consumers

Active references to `apps/fmd-desktop` occur in the legacy toolbox, product documentation, file
headers, and the Tauri/frontend layout. Active references to `apps/UserGlobal` are confined to
the committed runtime snapshot; the application resolves user data from the selected vault or
custom external profile root. Historical migration prose may retain old paths only when clearly
marked; build, test, runtime code, and CI may not.

Migration map:

1. `apps/fmd-desktop` -> `frontend`.
2. `frontend/src-tauri` -> root `src-tauri`.
3. Update Tauri commands to run the frontend through an explicit `../frontend` working directory
   and update `frontendDist` to `../frontend/dist` relative to `src-tauri`.
4. Remove committed runtime data after preserving the external backup; add anonymous fixtures.
5. Replace legacy general tooling with the verified `0.4.0` payload pair.
6. Add real `.yml` CI jobs for product, tooling, clean integration, update, idempotency, rollback,
   and old-path regression.

## Baseline evidence

Environment used for the local baseline:

- Debian 12, x86_64;
- Node.js 22.23.2;
- pnpm 9.15.9;
- Python 3.11.2;
- Rust/Cargo 1.97.1;
- GTK 3, WebKitGTK 4.1, Ayatana AppIndicator, and related Tauri build dependencies.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass; lockfile unchanged |
| `pnpm exec tsc --noEmit` | pass |
| frontend lint | not configured in the initial revision; migration gap |
| `pnpm exec vitest run --watch=false` | pass; 109 files, 1,087 tests |
| `pnpm build` | pass; Vite 7.3.2 production output |
| `cargo check --locked` | pass |
| `cargo test --locked` | pass; 3 tests |
| headless `pnpm tauri dev --no-watch` | pass smoke; Vite ready and desktop binary launched before controlled timeout |
| `pnpm tauri build --debug --bundles deb --ci` | pass; Debian package produced |

The frontend build reports a pre-existing large-chunk warning. Several React tests emit a
pre-existing synchronous-unmount warning while still passing. Neither warning is attributed to
the migration. The absent lint command and inactive `.md` workflow are explicit acceptance gaps,
not silently green checks.

## Product layout acceptance

The product now runs from `frontend/` with the Tauri crate at root-level `src-tauri/`.
Tauri build hooks use explicit working directories, and the frontend launcher enters the
repository root before invoking the CLI. The obsolete path-derived Rust package name was replaced
with `fmd-flashcard-desktop`; the lockfile was regenerated offline and then accepted by
`cargo --locked`.

ESLint 10 with the TypeScript parser is locked in `pnpm-lock.yaml`. The frontend now exposes
deterministic `lint`, `typecheck`, and `test:run` scripts. After the complete path rewrite, the
following acceptance passed:

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | pass |
| `pnpm lint` | pass, zero warnings allowed |
| `pnpm typecheck` | pass |
| `pnpm test:run` | pass; 109 files, 1,092 tests |
| `pnpm build` | pass |
| `cargo check --locked` | pass |
| `cargo test --locked` | pass; 3 tests |
| headless Tauri development launch | pass; Vite ready and renamed binary launched |
| debug Debian desktop bundle | pass; real `.deb` produced |

Outside this historical report, a tracked-content search finds no remaining literal reference to
the old desktop or user-data paths.

## Tooling integration evidence

The release payload was first copied to an external staging directory. Before and after the
read-only integration check, a full-tree digest was identical. The plan contained exactly one
addition, `.tooling-state/state.toml`, and no conflict, product edit, deletion, backend, or cloud
component. Staged Full-Fix, verification, and a second check all passed.

The same sequence was then applied to the clean migration branch. The live Full-Fix added only
the state file. A second integration check was a verified no-op, and `tooling verify` passed. The
committed state payload digest is
`sha256:32ea536e28bab879db7113232212ada5dbef98ca26726597b1d585253f6a9097`.

The manifest lists 399 content files; Git tracks exactly those files plus
`tools/PORTABLE-PAYLOAD.json`. Every listed size, executable bit, and SHA-256 digest is checked in
the Path Regression job. This includes the centrally supplied
`tools/quality/rust_analyzer/dist/rust_quality_analyzer.wasm`, which requires a narrow `.gitignore`
exception because product `dist/` directories remain ignored. The complete restored Tooling test
suite passed locally.

The optional generic `quality --release` command is not an acceptance gate for this product at
Tooling `0.4.0`: its default source scan reaches the WASI fuel bound on the existing large Rust
module, and the portable payload does not supply the product-specific frontend AST adapter that
would be needed by this repository. Central files were not patched to hide that incompatibility.
The Product Baseline instead runs real locked ESLint, TypeScript, Vitest, Cargo, and Tauri build
commands. This limitation is explicit rather than reported as a false green check.

## Update and rollback pilot

The update fixture begins with the real Template-Tooling `0.3.0` source at immutable commit
`ee4d4fee50afddb96e3bf3f7d9caf4c060313d05`. The fixture is integrated at that version, its
managed payload pair is replaced by `0.4.0`, and the confirmed migration command plans only
`project-tooling.toml` and `.tooling-state/state.toml`. Applying the registered
`reconcile-managed-payload-0-3-0-to-0-4-0` migration updates both version records, preserves all
product files, and passes verification. A second check and second apply are no-ops.

The rollback fixture uses the actual central transaction engine. It adds two controlled temporary
Tooling files and forces post-apply verification to fail. The transaction removes both additions,
restores the complete managed and product digests, and retains its rollback journal. This tests a
real failure after writing has begun rather than accepting a mocked success code.

## CI acceptance design

`.github/workflows/ci.yml` grants only `contents: read` and defines seven independent jobs:

| Job | Evidence |
| --- | --- |
| Product Baseline | locked install, lint, typecheck, 1,092 frontend tests, web build, Cargo check/test, and real debug Debian package |
| Tooling Verify | side-effect-free integration check, state verification, and restored Tooling tests |
| Clean Integration Fixture | apply and verify against a product copy without state |
| Update Fixture | update from exact `0.3.0` SHA to pinned `0.4.0` |
| Idempotency | run Full-Fix twice and compare the complete fixture digest |
| Rollback | force post-write failure and prove transaction restoration |
| Path Regression | reject active old paths and verify every portable payload file |

The former `.github/workflows/build-pdf.md` was inactive because GitHub does not load Markdown as
a workflow. It also contained a direct automation push to `main` and referenced absent LaTeX
sources, so it was removed rather than activated. No replacement workflow has write permission.
Remote results will be recorded on the pull request; review remains intentionally external to the
implementation author.

## Final structure cleanup

The active `apps/` tree is gone. Obsolete generated root folder listings, a generated frontend
`.summary` snapshot containing a personal absolute path, and the legacy Python toolbox reference
pages were removed because they described caches, personal paths, deleted commands, and the
superseded layout. `.summary` output is now ignored. Current project command pages defer to
executable help from the pinned release, while centrally maintained documentation stays under
`docs/toolingdocs/`. Runtime profile documentation now describes separate settings, SR folders,
and per-run Markdown storage, including conservative legacy-source retention.

## Commit and rollback checkpoints

Each migration phase is committed separately. Structural product commits precede the portable
payload commit so either boundary can be reverted independently. The final branch is pushed only
after local acceptance. Integration into `main` is restricted to a pull request with successful
required CI and an independent review; this migration does not directly merge or push to `main`.
