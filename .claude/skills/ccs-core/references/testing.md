# CCS Testing Reference

## Test Organization

```
tests/
├── unit/              # Fast unit tests (parallel)
│   ├── commands/
│   ├── cliproxy/
│   ├── config/
│   ├── droid-settings/   # NEW: droid-settings library tests
│   ├── targets/
│   ├── utils/
│   └── web-server/
├── integration/       # Integration tests
├── e2e/              # End-to-end tests
├── npm/              # npm package tests
└── native/           # Native install tests (bash/ps1)
```

## Test Buckets

| Bucket | Command | Characteristics |
|--------|---------|----------------|
| Fast | `bun run test:fast` | No process spawn, no port binding, < 1.5s |
| Slow | `bun run test:slow` | Process spawn, port binding, reads dist/ |
| All | `bun run test:all` | Fast + Slow |
| E2E | `bun run test:e2e` | Full integration, external services |

## Fast Test Criteria

A test is **fast** if it does NOT:
1. Spawn child processes
2. Bind to ports or talk to localhost
3. Read `dist/` at runtime
4. Use timers > 500ms
5. Consistently take > 1.5s

## Test Isolation (CRITICAL)

**NEVER touch real `~/.ccs/` or `~/.claude/` directories.**

### Correct pattern:
```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

describe('my-module', () => {
  let tmpDir: string;
  let originalCcsHome: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-test-'));
    originalCcsHome = process.env.CCS_HOME;
    process.env.CCS_HOME = tmpDir;
  });

  afterEach(() => {
    if (originalCcsHome !== undefined) {
      process.env.CCS_HOME = originalCcsHome;
    } else {
      delete process.env.CCS_HOME;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should work in isolation', () => {
    // Test uses tmpDir as CCS home
  });
});
```

### Using getCcsDir():
```typescript
import { getCcsDir } from '../src/utils/config-manager';

// This respects CCS_HOME env var
const ccsDir = getCcsDir(); // Returns tmpDir/.ccs when CCS_HOME is set
```

## Common Test Patterns

### Testing file operations:
```typescript
it('should create settings.json', () => {
  const settingsPath = path.join(tmpDir, '.factory', 'settings.json');
  // ... operation ...
  expect(fs.existsSync(settingsPath)).toBe(true);
  const content = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  expect(content.customModels).toHaveLength(1);
});
```

### Testing async operations:
```typescript
it('should handle async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Testing errors:
```typescript
it('should throw on invalid input', async () => {
  await expect(asyncFunction('invalid')).rejects.toThrow(/expected error/);
});
```

### Testing concurrent operations:
```typescript
it('should handle concurrent writes', async () => {
  const promises = Array.from({ length: 10 }, (_, i) =>
    upsertCcsModel(`profile-${i}`, modelData)
  );
  await Promise.all(promises);
  const models = await listCcsModels();
  expect(models.size).toBe(10);
}, 15000); // Increase timeout for concurrent tests
```

## Droid Settings Testing

**Location:** `tests/unit/droid-settings/droid-settings.test.ts`

Key test scenarios:
- CRUD operations on customModels
- Reasoning override persistence (anthropic/openai/generic)
- Legacy `ccs-` prefix handling
- Symlink rejection (security)
- Concurrent write safety
- Corrupted JSON recovery
- User-managed entry preservation

## Running Tests

```bash
# Run specific test file:
bun test tests/unit/droid-settings/droid-settings.test.ts

# Run all unit tests:
bun run test:unit

# Run fast bucket:
bun run test:fast

# Run with coverage:
bun test --coverage tests/unit/
```

## CI Pipeline

```
PR -> main/dev
  |
  +-- validate (parallel)
  |     +-- typecheck
  |     +-- lint
  |     +-- format:check
  |
  +-- build
  |     +-- bun run build:all
  |
  +-- test
  |     +-- bun run test:all
  |     +-- bun run test:e2e
```
