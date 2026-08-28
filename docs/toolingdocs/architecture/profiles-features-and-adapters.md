# Profiles, features and adapters

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Profiles are versioned TOML resources under `tools/resources/profiles/`. A profile
chooses a stable feature set; the catalog maps each feature to exactly one adapter and
validates dependencies before planning.

## Built-in profiles

| Profile | Base features |
| --- | --- |
| `web-only` | `frontend` |
| `web-cloud` | `frontend`, `backend`, `cloud` |
| `desktop-local` | `frontend`, `tauri` |
| `desktop-cloud` | `frontend`, `backend`, `tauri`, `cloud` |
| `full-platform` | `frontend`, `backend`, `tauri`, `cloud` |

`tauri` requires `frontend`; `cloud` requires `backend`. `database` is an optional
feature requiring `backend`, while `postgres` requires `database`. Of those two,
`postgres` is the directly selectable optional feature; resolution adds `database`
transitively and refuses the selection if the chosen profile does not provide
`backend`.

Every profile also selects the core adapters `quality`, `testing`, `documentation`,
`ci` and `release`. Feature selection adds `frontend`, `backend`, `tauri`, `container`
for `cloud`, and `database` for `database` or `postgres`. Registration rejects duplicate
adapter names and ambiguous feature ownership. Selected-policy and planning validation
reject case-colliding paths and overlapping structured keys.

## Adapter contract

Each adapter contributes four separate behaviors:

- detection produces evidence and findings without writes;
- planning compares observed paths with the desired profile and returns typed
  operations or conflicts;
- application submits one combined plan to the shared transaction boundary;
- verification returns stable `PASS`, `WARN`, `FAIL` or `INFO` findings.

Adapters may declare fixed `install`, `run`, `stop`, `test` and `build` capabilities.
Capabilities are not implicit integration steps. They are available only through the
explicit [adapter action command](../reference/adapter-capabilities.md), only when the
active profile selected that adapter, and only for the built-in fixed command mapping.

## Conservative product integration

Product-owned requirements are observational and do not cause scaffolding. A missing
optional product root ordinarily produces information or a configuration warning. An
incompatible required configuration can still block the plan—for example, selecting a
backend feature while the persisted backend path is empty produces a conflict.

The frontend adapter has the one current structured product policy. For an existing,
strict, duplicate-free `package.json`, it may add an absent known script only when
`dependencies` or `devDependencies` already contains a non-empty string declaration
for the corresponding tool. Existing scripts, unknown keys and foreign values are
preserved. Invalid object or string-map shapes, parent/child key overlap and undeclared
keys fail closed.

The [profile reference](../reference/profiles-and-features.md) lists the persisted
choices, and the [capability reference](../reference/adapter-capabilities.md) lists all
live actions.
