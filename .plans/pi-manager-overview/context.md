# Pi Manager Initiative Overview

## Mission

Add Pi as a first-class compatible CLI destination for CCS API key/model profiles, analogous to the existing Droid support, while keeping the dashboard scalable by using a target selector instead of adding one apply button per agent.

## Verified Context

- Existing API key profiles are the source of truth in CCS and can currently be applied to Claude or Droid.
- Droid applies credentials by writing custom model entries to `~/.factory/settings.json` through `src/droid-settings/*`.
- The API key apply flow is implemented in `src/api/services/api-key-service.ts` and currently dispatches by target with explicit `claude` and `droid` branches.
- Target contracts are centralized through `src/targets/target-adapter.ts`, `src/targets/target-metadata.ts`, and adapter registration in `src/ccs.ts`.
- The dashboard apply dialog already uses a selector in `ui/src/components/api-keys/api-key-apply-dialog.tsx`, but its type/options are hardcoded to `claude | droid`.
- Pi provider documentation confirms API key support through environment variables or `~/.pi/agent/auth.json`.
- Pi `auth.json` entries use provider keys such as `anthropic`, `openai`, `deepseek`, `google`, `mistral`, `groq`, `kimi-coding`, and `minimax`, with values shaped like `{ "type": "api_key", "key": "..." }`.
- The repository requires test isolation for CCS-owned paths through `getCcsDir()` and equivalent care must be taken for any Pi path abstraction in tests.

## Initiative Boundaries

### In Scope

- Pi-compatible credential persistence.
- Pi target metadata and optional runtime adapter support.
- API key apply support for Pi.
- Scalable dashboard target selection.
- Pi Manager dashboard surface for diagnostics/configuration parity.
- Planning artifacts that can later be passed to `/plan`.

### Out of Scope

- Implementing code in this phase.
- Full execution-ready implementation plans for each feature.
- Manually changing user Pi configuration during planning.
- Confirming every Pi provider mapping by trial execution.
- Reworking unrelated Claude, Droid, or Codex behavior beyond compatibility needs.

## Assumptions

- The installed Pi CLI binary is named `pi`, unless future discovery proves otherwise.
- Pi's `~/.pi/agent/auth.json` is the right durable configuration target for API keys.
- Applying profiles to Pi can ship before full `ccs --target pi` runtime execution if necessary.
- Proxy strategy for Pi is not assumed supported until verified; direct API key application is the first safe strategy.
- The dashboard should keep one apply action that opens a selector-driven dialog.

## Strategic Decomposition

The initiative does not collapse into one durable feature-sized unit because it crosses backend target contracts, external credential persistence, API dispatch, dashboard UX, and a manager page. The feature briefs split these surfaces so later `/plan` calls can create implementation-ready plans independently.
