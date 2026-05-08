# Feature Index

## Refresh Notes

- Status: Initial overview created.
- Added features: F-001 through F-006.
- Removed features: none.
- Split features: none.
- Merged features: none.

## Features

| ID | Feature | Status | Owner | Summary | Dependencies |
| --- | --- | --- | --- | --- | --- |
| F-001 | Pi foundation and metadata | Unplanned | Unassigned | Introduce Pi as a known compatible CLI/apply target and establish shared path/config primitives. | none |
| F-002 | Pi auth writer and provider mapping | Unplanned | Unassigned | Write CCS API key profiles into Pi `auth.json` safely with provider mapping and redaction-aware helpers. | F-001 |
| F-003 | Extensible API key target dispatch | Unplanned | Unassigned | Replace hardcoded apply branches with target applicators and add Pi direct apply support. | F-001, F-002 |
| F-004 | Scalable apply target selector UI | Unplanned | Unassigned | Evolve the dashboard apply dialog into a generic target selector including Pi without adding per-agent buttons. | F-003 |
| F-005 | Pi runtime adapter | Unplanned | Unassigned | Add optional `ccs --target pi` execution support analogous to Droid. | F-001, F-002 |
| F-006 | Pi Manager dashboard | Unplanned | Unassigned | Add a Pi Manager page/API for diagnostics and safe inspection of Pi configuration. | F-001, F-002 |

## Execution Guidance

Start with F-001. After F-001, F-002 can begin. Once F-002 is complete, F-003, F-005, and F-006 become independently plannable; F-004 should follow F-003 because the UI should target the final apply contract.

## Human-Owned Fields

These fields must be preserved exactly during future refreshes when present in feature briefs:

- Status
- Owner
- Decision Notes
- Manual Overrides
