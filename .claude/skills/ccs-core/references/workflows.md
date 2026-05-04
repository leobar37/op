# CCS Development Workflows

## Adding a New CLI Command

1. **Create handler:** `src/commands/<name>-command.ts`
   ```typescript
   export async function handle<Name>Command(args: string[]): Promise<void> {
     // Implementation
   }
   ```

2. **Register route:** `src/commands/root-command-router.ts`
   ```typescript
   { name: '<name>', handle: handle<Name>Command }
   ```

3. **Update help:** `src/commands/help-command.ts`
   - Add to command list
   - Add description

4. **Add tests:** `tests/unit/commands/<name>-command.test.ts`

5. **Update docs:** If user-facing, update `docs/` and help text

## Adding a New Provider

1. **Capabilities:** `src/cliproxy/provider-capabilities.ts`
   ```typescript
   export const MY_PROVIDER_CAPABILITIES: ProviderCapabilities = {
     id: 'my-provider',
     oauthFlow: 'authorization_code',
     callbackPort: 8321,
     tokenRefreshOwnership: 'ccs',
     // ...
   };
   ```

2. **Model catalog:** `src/cliproxy/model-catalog.ts`
   ```typescript
   'my-provider': [
     { id: 'model-1', name: 'Model 1', thinking: { type: 'budget', ... } },
   ]
   ```

3. **Dashboard route:** `src/web-server/routes/<provider>-routes.ts` (optional)

4. **Help update:** `src/commands/help-command.ts`

## Adding a New Target Adapter

1. **Implement adapter:** `src/targets/<name>-adapter.ts`
   ```typescript
   export class <Name>Adapter implements TargetAdapter {
     readonly type = '<name>';
     detectBinary() { ... }
     prepareCredentials(creds) { ... }
     buildArgs(profile, userArgs) { ... }
     buildEnv(creds, profileType) { ... }
     exec(args, env, options) { ... }
     supportsProfileType(type) { ... }
   }
   ```

2. **Register:** `src/targets/target-registry.ts`
   ```typescript
   registerTarget(new <Name>Adapter());
   ```

3. **Metadata:** `src/targets/target-metadata.ts`
   ```typescript
   '<name>': { displayName: '...', description: '...' }
   ```

4. **Export:** `src/targets/index.ts`

## Working with Config Schemas

1. **Define schema:** `src/config/schemas/<domain>.ts`
   ```typescript
   export interface <Domain>Config {
     enabled: boolean;
     // ...
   }
   ```

2. **Add to unified:** `src/config/schemas/unified-config.ts`
   ```typescript
   export interface UnifiedConfig {
     // ...
     <domain>: <Domain>Config;
   }
   ```

3. **Add defaults:** `src/config/schemas/unified-config.ts`
   ```typescript
   export function createEmptyUnifiedConfig(): UnifiedConfig {
     return {
       // ...
       <domain>: { enabled: false },
     };
   }
   ```

4. **Validate:** `src/config/unified-config-loader.ts`

## Testing Patterns

### Unit test structure:
```typescript
import { describe, it, expect } from 'bun:test';

describe('module-name', () => {
  describe('functionName', () => {
    it('should do something', () => {
      expect(result).toBe(expected);
    });
  });
});
```

### Test isolation (MANDATORY):
```typescript
let tmpDir: string;
let originalCcsHome: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccs-test-'));
  originalCcsHome = process.env.CCS_HOME;
  process.env.CCS_HOME = tmpDir;
});

afterEach(() => {
  process.env.CCS_HOME = originalCcsHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});
```

### Fast vs Slow tests:
- **Fast:** Pure functions, no I/O, no process spawning
- **Slow:** Port binding, file system, process spawning, timers > 500ms

## Git Workflow

```bash
# Standard feature branch:
git checkout dev && git pull origin dev
git checkout -b feat/my-feature
# ... conventional commits ...
git push -u origin feat/my-feature
gh pr create --base dev --title "feat(scope): description"

# Hotfix (production only):
git checkout main && git pull origin main
git checkout -b hotfix/critical-bug
gh pr create --base main --title "fix: critical issue"
```

## Release Process

- **Fully automated** via semantic-release
- **main** branch → `@latest` npm tag
- **dev** branch → `@dev` npm tag
- Conventional commits determine version bump:
  - `feat:` → MINOR
  - `fix:` → PATCH
  - `feat!:` → MAJOR
