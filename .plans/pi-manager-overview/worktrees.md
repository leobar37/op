# Worktree Guidance

## Initiative Worktree Strategy

Use one feature branch/worktree per feature brief once `/plan` produces an implementation-ready plan. Keep foundation changes isolated because they touch global target contracts and can create merge conflicts.

## Recommended Worktrees

| Feature | Suggested Branch / Worktree | Recommendation | Notes |
| --- | --- | --- | --- |
| F-001 | `feat/pi-target-foundation` | Dedicated worktree | Global types/metadata; should land first. |
| F-002 | `feat/pi-auth-writer` | Dedicated worktree after F-001 | Security-sensitive credential writer; keep review focused. |
| F-003 | `feat/api-key-target-dispatch` | Dedicated worktree after F-002 | Refactors apply flow and adds Pi support. |
| F-004 | `feat/apply-target-selector` | Dedicated UI-focused worktree after F-003 | Avoids UI/backend contract drift. |
| F-005 | `feat/pi-runtime-adapter` | Parallel-safe after F-002 | Can proceed independently from UI once writer exists. |
| F-006 | `feat/pi-manager-dashboard` | Parallel-safe after F-002 | May conflict lightly with F-004 in i18n/nav files. |

## Conflict Hotspots

- `src/targets/target-adapter.ts`
- `src/targets/target-metadata.ts`
- `src/api/services/api-key-service.ts`
- `ui/src/lib/api-client.ts`
- `ui/src/lib/i18n.ts`
- `ui/src/App.tsx`

## Parallelization Notes

- Do not run F-003 and F-004 in parallel unless the apply API contract is frozen.
- F-005 and F-006 can run in parallel after F-002, but both should consume the same Pi config helper APIs.
- Coordinate i18n changes when F-004 and F-006 overlap.
