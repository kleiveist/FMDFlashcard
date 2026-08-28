<!-- AUTO-GENERATED:backlink START -->
[← Back](../toolingdocs.md)
<!-- AUTO-GENERATED:backlink END -->

# Acceptance

Acceptance is based on black-box copies into independent temporary projects. A passing source
unit test is not sufficient: the copied runtime must detect, plan, integrate, verify, test, and
repeat without gaining ownership of product content.

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Copy matrix](copy-matrix.md)
- 📝 [Definition of done](definition-of-done.md)
- 📝 [Evidence index](evidence-index.md)
- 📝 [Profile matrix](profile-matrix.md)
- 📝 [Release gates](release-gates.md)
- 📝 [Rollback matrix](rollback-matrix.md)
- 📝 [Test matrix](test-matrix.md)
- 📝 [Upgrade matrix](upgrade-matrix.md)

<!-- AUTO-GENERATED:docs-index END -->

The [copy matrix](copy-matrix.md) defines the fixture and historical-replacement evidence. The
[definition of done](definition-of-done.md) combines those gates with deterministic export and
repeatable local copy evidence. Repository-only tests live outside the exported `tools/tests`
tree; customer acceptance runs only the tests that travel with the payload.

Acceptance results are evidence for one repository revision and environment. They are not an
external signature for a copied payload, a hostile-code security audit, or proof that every
product-specific test/build combination is supported.
