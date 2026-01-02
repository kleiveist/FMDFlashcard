# Add Review Session UI (Again/Hard/Good/Easy)

## Context
Once cards can be extracted, a minimal review experience is needed.

## Goal
Implement a review screen that presents cards one-by-one with rating buttons:
- Again / Hard / Good / Easy

## Scope
- Session uses an in-memory queue first.
- No long-term scheduling required in this issue.

## Tasks
- [ ] Create a `Review` page/route.
- [ ] Add card front/back flip interaction (show answer).
- [ ] Add rating buttons and advance to next card.
- [ ] Basic session stats (remaining, completed).

## Acceptance Criteria
- User can start a session from a note or “all cards” and review through cards.
- Ratings are captured (even if only logged/in memory).

## Notes
Keep UI minimal; scheduling persistence comes next.
