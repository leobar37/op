# F-005: Pi Runtime Adapter

## Objective

Add optional runtime execution support so CCS can prepare Pi credentials and launch the Pi CLI through the target adapter system.

## Scope Boundaries

### In Scope

- Detect the Pi binary.
- Register a `PiAdapter` if runtime support is selected for this initiative.
- Prepare credentials using the Pi auth writer.
- Build safe environment and arguments.
- Preserve existing Claude, Droid, and Codex runtime behavior.

### Out of Scope

- Dashboard Pi Manager UI.
- API key apply UI selector.
- Implementing Pi OAuth flows.
- Guessing unsupported Pi command-line flags.

## Verified Context

- `src/targets/droid-adapter.ts` is the closest persisted-config runtime adapter.
- `src/targets/codex-adapter.ts` is useful for compatible CLI behavior.
- Adapters are registered in `src/ccs.ts`.
- Binary detection patterns exist in `src/targets/*-detector.ts`.
- Pi docs imply `pi` is the command used after setting environment variables.

## Assumptions

- The Pi binary is named `pi`.
- Pi can run interactively without needing model arguments for the first integration.
- Applying credentials to `auth.json` is sufficient preparation for runtime launch.

## Likely Files or Directories Involved

- `src/targets/pi-adapter.ts` - Create - runtime implementation.
- `src/targets/pi-detector.ts` - Create - binary discovery.
- `src/targets/index.ts` - Modify - exports.
- `src/ccs.ts` - Modify - adapter registration.
- `package.json` - Review/Modify - optional `ccs-pi` binary alias.
- `src/pi-settings/` - Review/Use - credential preparation.

## Dependencies on Other Feature IDs

- F-001.
- F-002.

## Parallelization Notes

Can run in parallel with F-003 and F-006 after F-002, but should avoid changing shared target metadata already owned by F-001.

## Worktree Recommendation

Use a dedicated runtime worktree.

## Suggested Branch/Worktree Name

`feat/pi-runtime-adapter`

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
