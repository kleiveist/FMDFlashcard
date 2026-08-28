<!-- AUTO-GENERATED:backlink START -->
[← Back](toolingdocs.md)
<!-- AUTO-GENERATED:backlink END -->
# Portable tooling documentation

This documentation travels with the `tools/` directory. It explains the observed
implementation of Template Tooling: project-local context resolution, profile-selected
adapters, bounded structured changes, transactional integration, explicit live actions,
versioned folder replacement, verification, and acceptance evidence.

Start with [Check](integration/check.md) before applying any integration. Use the
[installation guide](guides/install.md) only when you intentionally want a live dependency
action, and read [security boundaries](development/security-boundaries.md) before changing
ownership or process policies.

The tooling is deliberately not an application scaffold. Missing product paths remain
informational, foreign product content stays project-owned, and copied payload metadata proves
self-consistency rather than publisher authenticity.

## Documentation map

<!-- AUTO-GENERATED:docs-index START -->
### Acceptance

- [Acceptance](acceptance/acceptance.md)
- [Copy matrix](acceptance/copy-matrix.md)
- [Definition of done](acceptance/definition-of-done.md)
- [Evidence index](acceptance/evidence-index.md)
- [Profile matrix](acceptance/profile-matrix.md)
- [Release gates](acceptance/release-gates.md)
- [Rollback matrix](acceptance/rollback-matrix.md)
- [Test matrix](acceptance/test-matrix.md)
- [Upgrade matrix](acceptance/upgrade-matrix.md)

### Architecture

- [Architecture](architecture/architecture.md)
- [CI and acceptance](architecture/ci-and-acceptance.md)
- [Export and release boundary](architecture/export-and-release.md)
- [Integration pipeline](architecture/integration-pipeline.md)
- [Migration and upgrades](architecture/migration-and-upgrades.md)
- [Ownership and state](architecture/ownership-and-state.md)
- [Ownership, state and transactions](architecture/ownership-state-and-transactions.md)
- [Profiles, features and adapters](architecture/profiles-features-and-adapters.md)
- [Project context and paths](architecture/project-context-and-paths.md)
- [System context](architecture/system-context.md)

### Case study

- [Case-study guidelines](case-study/CASE-STUDY-GUIDELINES.md)
- [Portable tooling case study / Fallstudie zum portablen Tooling](case-study/case-study.md)
- [Template compatibility](case-study/TEMPLATE-COMPATIBILITY.md)

### Development

- [Development](development/development.md)
- [Adapter development](development/adapter-development.md)
- [Contribution guide](development/contribution.md)
- [Documentation development](development/documentation-development.md)
- [Fixture development](development/fixture-development.md)
- [Migration development](development/migration-development.md)
- [Refactor inventory](development/refactor-inventory.md)
- [Release process](development/release-process.md)
- [Security boundaries](development/security-boundaries.md)

### Guides

- [Guides](guides/guides.md)
- [Building and testing](guides/building-and-testing.md)
- [Build product artifacts](guides/builds.md)
- [Custom project paths](guides/custom-project-paths.md)
- [First integration](guides/first-integration.md)
- [Replace a portable tooling payload](guides/folder-replacement.md)
- [Install dependencies](guides/install.md)
- [Prepare a release](guides/releases.md)
- [Selecting a profile](guides/selecting-a-profile.md)
- [Run tests](guides/tests.md)
- [Troubleshooting](guides/troubleshooting.md)
- [Upgrading tooling](guides/upgrading-tooling.md)

### Integration

- [Integration](integration/integration.md)
- [Check](integration/check.md)
- [Full-Fix](integration/full-fix.md)
- [Full-Fix and actions](integration/full-fix-and-actions.md)
- [Migration, verification and drift](integration/migration-verification-and-drift.md)
- [Migrations](integration/migrations.md)
- [Rollback and recovery](integration/rollback-and-recovery.md)
- [Tooling replacement](integration/tooling-replacement.md)
- [Verification](integration/verification.md)

### Reference

- [Reference](reference/reference.md)
- [Adapter capabilities reference](reference/adapter-capabilities.md)
- [Adapter contract](reference/adapter-contract.md)
- [CLI reference](reference/cli.md)
- [Exit codes](reference/exit-codes.md)
- [Feature schema](reference/feature-schema.md)
- [Profile schema](reference/profile-schema.md)
- [Profiles and features reference](reference/profiles-and-features.md)
- [Project configuration reference](reference/project-configuration.md)
- [Project-tooling schema](reference/project-tooling-schema.md)
- [Report schema](reference/report-schema.md)
- [Reports reference](reference/reports.md)
- [State schema](reference/state-schema.md)
- [Tooling state reference](reference/tooling-state.md)
<!-- AUTO-GENERATED:docs-index END -->

For a compact operational route, continue with the [guides overview](guides/guides.md).
