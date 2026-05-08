# F-001: Pi Foundation and Metadata

## Objective

Introduce Pi as a known CCS-compatible target/apply destination and establish shared primitives for Pi paths, metadata, and docs registry integration.

## Scope Boundaries

### In Scope

- Add Pi to target/apply metadata.
- Define display name, aliases, and persistence behavior.
- Establish Pi path conventions for future config helpers.
- Identify docs registry/navigation hooks for Pi-compatible CLI surfaces.

### Out of Scope

- Writing `~/.pi/agent/auth.json`.
- Applying API keys to Pi.
- Creating the Pi Manager page.
- Executing the Pi runtime.

## Verified Context

- `TargetType` currently lives in `src/targets/target-adapter.ts`.
- Target metadata is centralized in `src/targets/target-metadata.ts`.
- Runtime adapters are registered in `src/ccs.ts`.
- Droid is the closest pattern for a persisted compatible CLI target.
- Codex is a useful comparison for compatible CLI docs/navigation patterns.

## Assumptions

- Pi should be represented as `pi`.
- The Pi CLI binary is likely `pi`.
- Pi should be treated as an apply-capable destination even if runtime execution ships later.

## Likely Files or Directories Involved

- `src/targets/target-adapter.ts` - Modify - add or prepare Pi target typing.
- `src/targets/target-metadata.ts` - Modify - add Pi metadata and persistence/apply capability.
- `src/targets/index.ts` - Review - future export placement.
- `src/ccs.ts` - Review - future adapter registration site.
- `src/web-server/services/compatible-cli-docs-registry.ts` - Modify/Review - Pi docs registry entry.
- `src/pi-settings/` - Create/Review - home for Pi path/config primitives.

## Dependencies on Other Feature IDs

- None.

## Parallelization Notes

This is the foundation and should land before other feature work. Other work can branch from its resulting contract.

## Worktree Recommendation

Use a dedicated worktree because target metadata touches global contracts.

## Suggested Branch/Worktree Name

`feat/pi-target-foundation`

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
