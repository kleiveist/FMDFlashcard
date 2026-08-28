<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

# Definition of done

This definition is a release gate, not a statement that every future phase is complete. Each
item needs reproducible evidence from the exact candidate revision.

## Portable integration gate

| Area | Pass condition |
| --- | --- |
| Payload scope | The candidate contains only the intended `tools/` and `docs/toolingdocs/` content. The repository root README, source marker, hosted workflows, handoff files, local state, dependency environments, caches, reports, and builds are excluded. |
| Runtime closure | `tools/` contains every packaged profile, configuration resource, runtime module, fixed adapter capability, and verified runtime asset required by a copied execution; it does not depend on the source checkout. |
| Legacy isolation | Runtime code contains no old Template-Projekte repository identity/URL, external template Git source, full-product baseline, adoption/scaffold reconstruction, `tools/template_lifecycle/`, or `.template/` state model. |
| Payload consistency | The reviewed manifest covers the complete portable file set and every copied file matches it. Documentation calls this self-consistency, not publisher authentication. |
| Context and profiles | All five built-in profiles load from `tools/resources/profiles/` through `ProjectContext`; packaged configuration loads from `tools/resources/config/`; configured custom paths remain inside the project; optional missing paths do not cause scaffolding. |
| External state | `.tooling-state/` replaces legacy state and holds tooling environments, runtime records, and evidence outside `tools/`. No `.venv`, `.runtime`, `target`, cache, or local log is versioned in the payload. |
| Read-only planning | `integrate --check` and migration check change no target file or state and fail closed on ambiguity, unsafe paths, malformed structures, conflicts, or invalid payload. |
| Ownership | Unknown/product files remain byte-for-byte unchanged. Structured writes are limited to exact allowlisted keys and preserve all foreign content. Current built-ins do not add dependency declarations. |
| Transaction | Full-fix/migration require applicable preconditions, stage writes, check preimages, back up, verify, publish state last, roll back injected failures, and leave actionable evidence. |
| Action planning | Staged dependency validation is planned only for an actual dependency-key operation. Required quality, tooling-test, and build actions are typed, fixed, run only in staging, and avoid importing arbitrary target plugins. Builds use only a declared `package.json` build script, isolated Python compilation, or locked Cargo/Tauri checks. |
| Live actions | Install/test/build adapter dispatch accepts only a profile-selected adapter and its fixed capability. Those separately requested lifecycle commands may execute live product behavior and remain outside Full-Fix rollback. |
| Idempotence | Check after fix is integrated; a second full-fix and a second migration produce no operations, action, report, state change, or target-tree change. |
| Copy matrix | Every fixture in [the copy matrix](copy-matrix.md) passes detection, fix, verify, copied tools test, protected-hash, and no-op assertions. |
| Historical upgrade | The pinned real `0.1.0`, `0.2.0`, and `0.3.0` payloads each upgrade through their direct registered reconciliation to `0.4.0`; tampering is rejected; config/state migrate; current payload and product hashes remain unchanged. |
| Deterministic export | `tooling export` creates only `tools/` and `docs/toolingdocs/`, refuses an existing destination, rejects unsafe source objects, normalizes metadata and produces the same manifest and bytes from the same source. |
| Test separation | Repository-only tests live under `tests/source/`; the exported `tools/tests/` tree contains portable runtime and acceptance tests without source-marker skips. |
| Local acceptance | The source checkout can run the copy matrix, folder replacement, historical migration, deterministic export, and independent customer smoke explicitly with an external tooling environment. No hosted push or pull-request workflow is required. |
| Documentation | All portable pages use relative links and the exact generated index/backlink markers; `python tools/control.py docs check` passes; command examples match the parser. |
| Case study | New German and English portable-tooling sources and diagrams build reproducibly; no inherited PDF, renamed legacy chapter, old architecture claim, or generated LaTeX artifact is stored as source. |
| Repository quality | Focused tests, the complete `tools/tests` suite, static CLI/documentation contracts, `git diff --check`, and the portable-artifact scan pass on the candidate. |

Warnings, skips, and environment-dependent cases must be explained in the acceptance record. A
skipped required matrix or historical-migration test is not a pass. Product-specific suites may
be inapplicable only when the fixture/profile explicitly does not configure that feature.

## Manual review before handoff

- Review the final diff by ownership class and confirm that no unrelated user changes were
  absorbed.
- Confirm the candidate version and registered migration graph match the release notes.
- Verify that integration reports sanitize their bounded fields. Review optional raw test reports
  for commands, absolute paths, stdout/stderr and secrets before sharing; no private target
  content may appear in fixtures or documentation.
- Exercise a forced transaction failure and recovery path for any changed write/publish logic.
- Copy the candidate into at least one clean temporary target and run its CLI through the copied
  interpreter path, not imports from the source checkout.
- Record commands, exit codes, environment constraints, and the exact commit under test.

## Export evidence and remaining trust boundary

Create the candidate from an existing output parent and inspect it before distribution:

```sh
python tools/control.py tooling export --output PATH
```

The local result is a directory, not a signed archive or a publication. Its
`tools/PORTABLE-PAYLOAD.json` binds every exported file except the manifest itself and is
validated again before the staged directory is published. It detects incomplete, mixed or
changed copies but cannot authenticate an adversarial replacement of both payload and manifest.
The source repository's tagged release workflow adds a deterministic tarball, external checksum,
and GitHub Sigstore provenance without placing publisher metadata inside the payload. Verify all
of them from the trusted tag, and follow the
[folder replacement guide](../guides/folder-replacement.md).
