# F-004: Scalable Apply Target Selector UI

## Objective

Evolve the dashboard API key apply dialog into a scalable selector-driven UI that supports Claude, Droid, and Pi without adding one button per agent.

## Scope Boundaries

### In Scope

- Keep one apply entry point.
- Show target choices like “Aplicar a Droid” and “Aplicar a Pi” in a selector/dialog.
- Add Pi to UI target types.
- Handle strategy availability per target.
- Update i18n strings and success/error copy.

### Out of Scope

- Backend apply implementation.
- Pi Manager page.
- Adding separate per-agent buttons.
- Redesigning the entire API keys page.

## Verified Context

- `ui/src/components/api-keys/api-key-apply-dialog.tsx` already uses shadcn `Select`.
- The current component hardcodes `target` state to `'claude' | 'droid'`.
- UI API types are defined in `ui/src/lib/api-client.ts`.
- API key hooks live in `ui/src/hooks/use-api-keys.ts`.
- i18n text is centralized in `ui/src/lib/i18n.ts`.

## Assumptions

- The UI should default to the most relevant target, likely Droid or the profile's saved target.
- Pi proxy strategy should be hidden or disabled unless backend supports it.
- Target labels should be human-readable and translatable.

## Likely Files or Directories Involved

- `ui/src/components/api-keys/api-key-apply-dialog.tsx` - Modify - selector options and target/strategy behavior.
- `ui/src/lib/api-client.ts` - Modify - add Pi target type and response typing.
- `ui/src/hooks/use-api-keys.ts` - Review - mutation contract.
- `ui/src/lib/i18n.ts` - Modify - target labels and dialog text.
- `ui/src/pages/api-keys.tsx` - Review - apply dialog integration.

## Dependencies on Other Feature IDs

- F-003.

## Parallelization Notes

Best after F-003 to avoid coding against a temporary API contract. It may conflict with F-006 in i18n files.

## Worktree Recommendation

Use a UI-focused worktree after backend apply support exists.

## Suggested Branch/Worktree Name

`feat/apply-target-selector`

## Suggested `/plan` Mode

`simple`

## Status

Unplanned

## Owner

Unassigned

## Decision Notes

None.

## Manual Overrides

None.
