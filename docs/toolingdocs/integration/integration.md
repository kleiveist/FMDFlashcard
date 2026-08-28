# Integration

<!-- AUTO-GENERATED:backlink START -->
[← Back](../toolingdocs.md)
<!-- AUTO-GENERATED:backlink END -->

Portable integration compares the target project with one persisted or detected
profile. It produces a deterministic plan, applies that plan only through a staging and
rollback boundary, and verifies the result with a fresh assessment.

The normal lifecycle is:

1. run read-only `integrate --check` and inspect operations or conflicts;
2. resolve conflicts and commit or stash unrelated work;
3. run `integrate --full-fix` for the complete supported plan;
4. run `tooling verify` and repeat `integrate --check` to confirm a no-op;
5. after replacing copied tooling with a different version, use the registered
   migration workflow rather than re-baselining state.

Full-Fix integrates the portable tooling, configuration, state and narrowly declared
structured changes. It does not manufacture missing product applications or invoke live
product commands implicitly. Profile-selected
[adapter actions](../reference/adapter-capabilities.md) provide a fixed dispatch surface;
the direct install, service, test and build commands in the [guides](../guides/guides.md)
are also explicit live operations. Both remain separate from the fixed checks that run
inside integration staging.

## Integration pages

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Check](check.md)
- 📝 [Full-Fix and actions](full-fix-and-actions.md)
- 📝 [Full-Fix](full-fix.md)
- 📝 [Migration, verification and drift](migration-verification-and-drift.md)
- 📝 [Migrations](migrations.md)
- 📝 [Rollback and recovery](rollback-and-recovery.md)
- 📝 [Tooling replacement](tooling-replacement.md)
- 📝 [Verification](verification.md)

<!-- AUTO-GENERATED:docs-index END -->
