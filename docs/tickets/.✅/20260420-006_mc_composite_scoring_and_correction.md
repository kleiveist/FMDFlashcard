<!-- AUTO-GENERATED:backlink START -->
[← Back](tickets.md)
<!-- AUTO-GENERATED:backlink END -->
# Ticket 20260420-006

- Ticket ID: `20260420-006`
- Original Reference: `EXAM-001`
- Area: Exam Simulation / Auto Scoring
- Priority: High
- Title: Composite multiple-choice subtasks are graded as all-or-nothing in correction/scoring flow

## Description
Composite exam tasks with multiple multiple-choice subtasks can produce incorrect correction feedback and zero awarded points unless every subtask is fully correct. This especially affects tasks where each subtask has multiple correct answers (`m2`), including tasks with repeated or differing correct key patterns.

## Reproduction
1. Create an exam task with two or more multiple-choice subtasks inside one numbered task.
2. Use subtasks where each part has multiple correct options (for example 2 or 3 correct keys).
3. Answer one subtask fully correct and another subtask partially or incorrectly.
4. Open scoring and correction result views.
5. Observe task correctness feedback and awarded points.

## Current State
Auto scoring in this flow can behave effectively as all-or-nothing for composite multiple-choice subtasks. Partial correctness within a task may not yield proportional points, and correct subtask input may appear as fully incorrect at task level.

## Target State
Composite multiple-choice subtasks are evaluated per subtask and award proportional points in scoring/correction, while still respecting task max points and profile mapping.

## Acceptance Criteria
- A single multiple-choice task with multi-answer keys is scored correctly.
- A task with two multiple-choice subtasks and 2 correct options per subtask awards partial points when only one subtask is correct.
- A task with two multiple-choice subtasks and 3 correct options per subtask awards partial points when only one subtask is correct.
- A task with multiple-choice subtasks that use different correct key sets is scored independently per subtask.
- A task with multiple-choice subtasks that use identical correct key sets is scored correctly without state bleed between subtasks.
- Tasks with more than two multiple-choice subtasks award proportional points based on number of correct subtasks.
- Awarded auto points remain clamped to task max points.
