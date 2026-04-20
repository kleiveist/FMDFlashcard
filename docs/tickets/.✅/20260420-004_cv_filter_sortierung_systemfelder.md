<!-- AUTO-GENERATED:backlink START -->
[← Back](tickets.md)
<!-- AUTO-GENERATED:backlink END -->
# Ticket 20260420-004

- Ticket ID: `20260420-004`
- Original Reference: `CV-002`
- Area: Canvas / Filter & Sorting
- Priority: Medium
- Title: Extend filtering and sorting with system fields

## Description
Filtering in canvas currently appears to cover only attributes. System-relevant fields should also be included.

## Reproduction
1. Open the canvas view.
2. Open the filter or sorting function.
3. Check available fields for filtering and sorting.
4. Observe that only attribute fields are available and system fields are missing.

## Current State
Only attribute-based filtering is possible.

## Target State
Filtering and sorting can also use system-relevant fields, such as data name, creation date, and other system fields.

## Acceptance Criteria
- System fields appear as selectable options in filtering and sorting.
- Filtering works for at least data name and creation date.
- Sorting is possible for the same system fields.
