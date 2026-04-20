<!-- AUTO-GENERATED:backlink START -->
[← Back](tickets.md)
<!-- AUTO-GENERATED:backlink END -->
# Ticket 20260420-002

- Ticket ID: `20260420-002`
- Original Reference: `DB-002`
- Area: Database / Filter Inputs
- Priority: High
- Title: Text input stops after one character

## Description
When typing in input fields inside filter conditions, only one character can be entered. After that, input stops or focus is lost.

## Reproduction
1. Open the database view.
2. Open the filter panel.
3. Activate a text input field inside a filter condition.
4. Type multiple characters in sequence.
5. Observe that input stops after the first character or focus is lost.

## Current State
Continuous typing is not possible.

## Target State
Text input works continuously without focus loss or interruption after one character.

## Acceptance Criteria
- Any number of characters can be entered continuously in filter text inputs.
- Focus stays in the active input field until the user intentionally changes it.
- Input no longer stops after the first character.
