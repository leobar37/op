# F-006: Pi Manager Dashboard

## Objective

Add a Pi Manager dashboard surface analogous to Droid Manager for diagnostics, safe configuration visibility, and provider/auth status.

## Scope Boundaries

### In Scope

- Backend routes/services for Pi diagnostics.
- Dashboard page for Pi status and configuration summary.
- Redacted display of auth entries.
- Navigation/routing integration.
- Reuse Pi auth writer helpers rather than duplicating config parsing.

### Out of Scope

- Raw secret exposure.
- API key apply selector redesign.
- Runtime launch from dashboard.
- Pi OAuth subscription management.

## Verified Context

- Droid Manager backend uses `src/web-server/routes/droid-routes.ts` and `src/web-server/services/droid-dashboard-service.ts`.
- Droid Manager frontend uses `ui/src/pages/droid.tsx` and `ui/src/hooks/use-droid.ts`.
- Routes are wired through web-server route registration and UI app routing.
- i18n and navigation changes likely overlap with other UI features.

## Assumptions

- Pi Manager should initially focus on diagnostics and safe visibility, not full raw editing.
- Any raw config view must redact API keys or require an explicit safe mode.
- Manager page can be implemented after the Pi auth writer exists.

## Likely Files or Directories Involved

- `src/web-server/routes/pi-routes.ts` - Create - Pi dashboard API.
- `src/web-server/services/pi-dashboard-service.ts` - Create - diagnostics/config summary.
- `src/web-server/routes/index.ts` or route registration file - Modify - mount Pi routes.
- `ui/src/pages/pi.tsx` - Create - Pi Manager page.
- `ui/src/hooks/use-pi.ts` - Create - React Query hooks.
- `ui/src/App.tsx` - Modify - route registration.
- `ui/src/lib/i18n.ts` - Modify - navigation/page copy.
- `src/pi-settings/` - Review/Use - auth status helpers.

## Dependencies on Other Feature IDs

- F-001.
- F-002.

## Parallelization Notes

Can run in parallel with F-003 and F-005 after F-002. Coordinate with F-004 for shared UI target names and i18n keys.

## Worktree Recommendation

Use a dedicated dashboard worktree.

## Suggested Branch/Worktree Name

`feat/pi-manager-dashboard`

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
