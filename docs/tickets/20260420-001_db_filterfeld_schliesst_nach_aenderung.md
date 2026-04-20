<!-- AUTO-GENERATED:backlink START -->
[← Back](tickets.md)
<!-- AUTO-GENERATED:backlink END -->
# Ticket 20260420-001

- Ticket ID: `20260420-001`
- Original Reference: `DB-001`
- Area: Database / Filter
- Priority: High
- Title: Filter panel closes after every change

## Description
As soon as a setting in the filter conditions is changed, the filter panel closes immediately. This interrupts editing multiple conditions in sequence.

## Reproduction
1. Open the database view.
2. Open the filter panel.
3. Add a filter condition or change an existing condition.
4. Observe that the filter panel closes right after the change.

## Current State
After each adjustment, the filter panel must be opened again.

## Target State
The filter panel stays open until the user intentionally closes it, for example by clicking outside, using `X`, or pressing `Escape`.

## Acceptance Criteria
- The filter panel remains open after changes to filter conditions.
- Multiple filter changes can be made in one session without reopening the panel.
- Closing still works intentionally via outside click, `X`, and `Escape`.
