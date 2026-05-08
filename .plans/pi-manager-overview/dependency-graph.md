# Dependency Graph

## Graph

```text
F-001 Pi foundation and metadata
  ├─ F-002 Pi auth writer and provider mapping
  │    ├─ F-003 Extensible API key target dispatch
  │    │    └─ F-004 Scalable apply target selector UI
  │    ├─ F-005 Pi runtime adapter
  │    └─ F-006 Pi Manager dashboard
```

## Dependency List

| Feature | Depends On | Reason |
| --- | --- | --- |
| F-001 | none | Foundation feature establishes shared contracts. |
| F-002 | F-001 | Needs Pi metadata/path conventions before writing Pi config. |
| F-003 | F-001, F-002 | Needs Pi as a known target and a safe Pi writer to add apply support. |
| F-004 | F-003 | UI should call the final apply API contract rather than an interim shape. |
| F-005 | F-001, F-002 | Runtime adapter needs target metadata and credential preparation. |
| F-006 | F-001, F-002 | Manager diagnostics need shared Pi config helpers and redaction behavior. |

## Valid Execution Orders

One valid serial order:

```text
F-001 -> F-002 -> F-003 -> F-004 -> F-005 -> F-006
```

Parallel-safe order after foundation:

```text
Batch 1: F-001
Batch 2: F-002
Batch 3: F-003, F-005, F-006
Batch 4: F-004
```

## Sanity Check

- Circular dependencies: none.
- Missing dependency IDs: none.
- At least one valid execution order exists: yes.
- Every non-foundation feature has a justified dependency path.
