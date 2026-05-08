# F-002: Pi Auth Writer and Provider Mapping

## Objective

Create a safe Pi configuration writer that maps CCS API key profiles into Pi `~/.pi/agent/auth.json` entries while preserving existing credentials and redacting secrets in diagnostics.

## Scope Boundaries

### In Scope

- Read and write Pi `auth.json`.
- Preserve existing auth entries.
- Write API key entries using Pi's documented `{ "type": "api_key", "key": "..." }` shape.
- Map CCS providers to Pi auth provider keys.
- Provide redaction-safe summaries for UI/API consumers.
- Add test-isolated path handling.

### Out of Scope

- Dashboard UI.
- API key apply endpoint changes.
- Pi runtime execution.
- OAuth subscription flows inside Pi.

## Verified Context

- Pi docs identify `~/.pi/agent/auth.json` as the credential store.
- Pi docs list provider keys including `anthropic`, `openai`, `deepseek`, `google`, `mistral`, `groq`, `kimi-coding`, and `minimax`.
- Droid config writing lives under `src/droid-settings/*` and is the closest repository pattern.
- Existing repository guidance requires avoiding accidental writes to real user config during tests.

## Assumptions

- Direct API key application is the first supported Pi strategy.
- Unsupported or ambiguous providers should fail with a clear message rather than guessing.
- File writes should be atomic and restrictive enough for secrets.

## Likely Files or Directories Involved

- `src/pi-settings/` - Create - Pi auth path, read/write, types, provider mapping.
- `src/droid-settings/` - Review - analogous writer patterns.
- `src/utils/config-manager.ts` - Review - test isolation convention.
- `src/api/services/provider-presets.ts` - Review - CCS provider IDs and defaults.
- `tests/` or existing unit test directories - Modify/Create - mapping and writer tests.

## Dependencies on Other Feature IDs

- F-001.

## Parallelization Notes

Can start after F-001. F-003, F-005, and F-006 should consume this writer rather than duplicating Pi file logic.

## Worktree Recommendation

Use a dedicated security-focused worktree.

## Suggested Branch/Worktree Name

`feat/pi-auth-writer`

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
