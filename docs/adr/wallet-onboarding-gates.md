<!-- AUTO-GENERATED:backlink START -->
[← Back](adr.md)
<!-- AUTO-GENERATED:backlink END -->
# Wallet Onboarding Gates (Custom Path, Profile, Sync Provider)

## Context / Problem
A wallet can be opened even when no user profile exists. In that first-time state, data and progress cannot be persisted, but the UI previously allowed users to continue without being guided through setup. This created a silent requirement: profile configuration is mandatory, yet not enforced or explained in-context.

## Decision
- Use standalone, blocking modals that embed ONLY the relevant Settings subsections for each gate.
- Do not reuse the full Settings popup container, and do not alter Settings button/popup behavior.
- Modals must be closable (ESC, X, outside click), but closing a modal does not unlock the wallet; the user remains gated until requirements are fulfilled.

## Gate Order and Rules
The onboarding flow selects the next missing gate when a wallet is opened:

1) **Custom Path Gate**
   - Must be satisfied before profile creation is allowed.
   - Gate condition: the active path is missing.

2) **Profile Gate**
   - Requires a valid active path before a profile can be created or loaded.
   - Gate condition: no active profile with a valid name exists.

3) **Sync Provider Gate (prepared)**
   - Blocking only when `VITE_SYNC_PROVIDER_ENABLED` is true (case-insensitive) AND the product rule marks it as required.
   - Gate condition: sync provider is required and not configured.

### Next Missing Gate Selection
- If the wallet is not open or the user vault state is still loading, no gate is shown.
- Otherwise, select the first unmet gate in order:
  `Custom Path -> Profile -> Sync Provider`.

## UI Spec Summary
### Custom Path Modal Blocks
- **ACTIVE PATH**
  - Displays current resolved path or `"—"`.
  - `Change` button uses the existing path picker logic.
  - Helper text: `"Pick a folder outside the vault if you prefer."`
- **PROFILES**
  - `Found profiles: <n>`
  - `Active profile: <name or "—">`
- **CREATE PROFILE**
  - `Create` button is disabled until a valid active path is chosen.
  - Helper text: `"Date is added automatically."`

## Feature Flags / Side Effects
- `VITE_SYNC_PROVIDER_ENABLED`
  - When disabled, the Sync Provider gate is not blocking and no initialization side effects occur.
  - While disabled, the modal (if manually opened) shows `"Disabled (flag off)"` and `"Coming soon"`.
- No network calls are performed while a feature flag is disabled.

## Acceptance Criteria
- On wallet open, the next missing gate modal opens automatically.
- Gate order is enforced: Custom Path -> Profile -> Sync Provider.
- Create Profile is disabled until a valid active path exists.
- Closing a modal via ESC, X, or outside click does not unlock the wallet.
- A persistent inline gate blocker appears with a CTA to reopen the correct modal.
- Settings popup and navigation remain unaffected.
- Sync Provider does not block when `VITE_SYNC_PROVIDER_ENABLED` is false.

## Future Work
- Implement actual Sync Provider configuration and persistence.
- Consider a single step-based modal that guides users through all gates in one flow.
