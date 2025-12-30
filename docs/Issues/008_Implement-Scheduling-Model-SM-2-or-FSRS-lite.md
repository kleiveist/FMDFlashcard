# Implement Scheduling Model (SM-2 or FSRS-lite)

## Context
The review UI will produce ratings; scheduling turns ratings into next due dates.

## Goal
Implement a scheduling algorithm and card state model.

## Scope
- Choose algorithm:
  - SM-2 (simple, well-known)
  - FSRS-lite (better modern performance but more parameters)
- Define per-card state: interval, ease, due date, reps, lapses, last reviewed.

## Tasks
- [ ] Choose algorithm and document it in `docs/scheduling.md`.
- [ ] Implement `apply_rating(state, rating) -> new_state`.
- [ ] Add unit tests for algorithm behavior.
- [ ] Integrate into review flow (in-memory state update).

## Acceptance Criteria
- Scheduling function is deterministic and tested.
- Review UI updates per-card state after each rating.

## Notes
Persistence is a separate issue.
