# Issue tracker: Linear

Track tasks and specs in Linear:

- Team: `Personal`
- Project: `simonwong/skills`

Use the connected Linear tools. Resolve team and project names to IDs before writing. If multiple matches remain, ask the user to identify the target.

## Ticket operations

- Search existing project issues before creating a ticket.
- Read the issue, comments, and relations before updating it.
- Create new work in Backlog unless the user specifies another state.
- Use explicit Linear identifiers such as `IND-35`.
- Treat GitHub issue and PR references as GitHub references.
- Preserve unrelated fields when updating tickets.
- Read available team statuses before changing state.
- Record the result and validation before marking work Done.
- If Linear is unavailable, return the proposed ticket text and report that it was not saved.

## Skill conventions

“Publish to the issue tracker” means create or update a Linear issue.
“Fetch the relevant ticket” means read its Linear issue and comments.

Apply labels required by the invoking skill. Resolve existing labels before creating missing ones.

## Wayfinding operations

- Map: create a Linear issue labelled `wayfinder:map`.
- Children: create tickets under the map using the native parent relation. Apply `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task` as appropriate.
- Blocking: use native blocking relations.
- Frontier: list open children; inspect blockers and assignees. Select unblocked, unassigned tickets in map order.
- Claim: assign the ticket to the driving developer.
- Resolve: record the answer, complete the ticket, and update the map's Decisions-so-far with a short finding and ticket link.
