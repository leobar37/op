# F-003: Extensible API Key Target Dispatch

## Objective

Refactor API key application into an extensible target applicator model and add Pi direct application through the Pi auth writer.

## Scope Boundaries

### In Scope

- Extend API key apply contracts to accept Pi.
- Replace hardcoded apply branching with an extensible target dispatch pattern.
- Add Pi direct apply behavior.
- Keep existing Claude and Droid apply behavior compatible.
- Update CLI validation/help for supported apply targets.

### Out of Scope

- Dashboard selector redesign.
- Pi Manager page.
- Pi runtime execution.
- Proxy support for Pi unless verified during planning.

## Verified Context

- Apply logic currently lives in `src/api/services/api-key-service.ts`.
- `ApplyApiKeyInput` uses `TargetType` from `src/api/services/api-key-types.ts`.
- `POST /api/api-keys/:id/apply` is routed through `src/web-server/routes/api-key-routes.ts`.
- CLI API key apply behavior/help lives in `src/commands/api-key-command.ts`.
- Current dispatch supports Claude and Droid only.

## Assumptions

- Pi apply should initially use `strategy: "direct"`.
- If users request `proxy` for Pi, the implementation should reject it clearly or the UI should disable it.
- The response should include the Pi config path when successful.

## Likely Files or Directories Involved

- `src/api/services/api-key-service.ts` - Modify - target applicator dispatch and Pi apply.
- `src/api/services/api-key-types.ts` - Modify - target compatibility if needed.
- `src/web-server/routes/api-key-routes.ts` - Modify/Review - validation and response handling.
- `src/web-server/routes/route-helpers.ts` - Review - target parsing behavior.
- `src/commands/api-key-command.ts` - Modify - help and validation.
- `src/pi-settings/` - Review/Use - Pi writer from F-002.

## Dependencies on Other Feature IDs

- F-001.
- F-002.

## Parallelization Notes

Should not run in parallel with F-004 unless the final API contract is already decided. Can run in parallel with F-005 and F-006 after F-002.

## Worktree Recommendation

Use a dedicated backend/API worktree.

## Suggested Branch/Worktree Name

`feat/api-key-target-dispatch`

## Suggested `/plan` Mode

`structured`

## Status

Unplanned

## Owner

Unassigned

## Decision Notes

None.

## Manual Overrides

None.
