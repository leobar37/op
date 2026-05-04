# CCS Architecture Reference

## System Diagram

```
+------------------+     +------------------+     +------------------+
|   User Input     |     |   Dashboard UI   |     |   CLI Commands   |
|   ccs <profile>  |     |   (React/Vite)   |     |   (~40 commands) |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         v                        v                        v
+---------------------------------------------------------------+
|                      CCS Core (src/ccs.ts)                     |
|  - Profile detection    - Target resolution    - CLI routing   |
+---------------------------------------------------------------+
         |
    +----+----+
    |         |
    v         v
+--------+  +---------------------------------------------------+
| Target |  | CLIProxy System                                  |
|Adapter |  |  - OAuth auth    - Variant config    - Quota     |
| Layer  |  |  - Model catalog - Routing strategy  - Sync     |
+--------+  +---------------------------------------------------+
    |                      |
    v                      v
+--------+  +-------------------------------------------+
| Claude |  | CLIProxyAPI Binary (Go)                   |
| Droid  |  |  - /api/provider/<name>                   |
| Codex  |  |  - /v1/messages (composite)               |
+--------+  +-------------------------------------------+
                |
        +-------+-------+
        |               |
        v               v
+--------------+  +------------------+
|  Providers   |  | OpenAI-Compat    |
|  (OAuth/API) |  | Proxy (optional) |
+--------------+  +------------------+
```

## Layered Architecture

```
Presentation Layer
├── CLI (src/ccs.ts, src/commands/)
├── Dashboard (ui/src/, src/web-server/)
└── API (src/web-server/routes/)

Business Logic Layer
├── Profile Management (src/auth/, src/api/)
├── Proxy Orchestration (src/cliproxy/)
├── Target Adapters (src/targets/)
└── Config Management (src/config/)

Configuration Layer
├── Unified Config (src/config/unified-config-loader.ts)
├── Schemas (src/config/schemas/)
└── Migration (src/config/migration-manager.ts)

Infrastructure Layer
├── File System (src/utils/config-manager.ts)
├── Process Spawning (src/utils/process-utils.ts)
├── Network Proxy (src/proxy/, src/cliproxy/proxy/)
└── Logging (src/services/logging/)
```

## Data Flow: Profile Execution

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs.ts
    participant PD as ProfileDetector
    participant TR as TargetResolver
    participant TA as TargetAdapter
    participant CP as CLIProxy
    participant CLI as Claude CLI

    User->>CCS: ccs <profile> [args]
    CCS->>PD: detectProfile()
    PD->>PD: Resolve mechanism (4 tiers)
    PD-->>CCS: {profile, type, creds}
    CCS->>TR: resolveTargetType(args)
    TR-->>CCS: 'claude' | 'droid' | 'codex'
    CCS->>TA: getAdapter(targetType)
    CCS->>TA: prepareCredentials(creds)
    alt CLIProxy profile
        CCS->>CP: ensureRunning()
        CP-->>CCS: {port, env}
    end
    CCS->>TA: buildArgs(profile, userArgs)
    CCS->>TA: buildEnv(creds, profileType)
    TA->>CLI: spawn(args, env)
    CLI-->>User: Interactive session
```

## Data Flow: OAuth Authentication

```mermaid
sequenceDiagram
    participant User
    participant CCS as ccs cliproxy auth
    participant OH as OAuthHandler
    participant CP as CLIProxy Binary
    participant Browser
    participant Provider as Provider OAuth

    User->>CCS: ccs cliproxy auth <provider>
    CCS->>OH: triggerOAuth(provider)
    OH->>OH: Detect headless?
    alt Authorization Code Flow
        OH->>CP: spawn --auth
        CP->>Browser: Open auth URL
        Browser->>Provider: Authenticate
        Provider-->>CP: Callback with code
        CP->>Provider: Exchange for token
    else Device Code Flow
        OH->>CP: Request device code
        CP-->>OH: user_code + verification_url
        OH->>User: Display code + URL
        User->>Browser: Visit URL, enter code
        Browser->>Provider: Authorize
        OH->>CP: Poll for token
    end
    CP-->>OH: {access_token, refresh_token}
    OH->>OH: Store in ~/.ccs/cliproxy/auth/
    OH-->>User: Success
```

## Module Dependencies

```
src/ccs.ts
├── src/auth/profile-detector.ts
├── src/targets/target-resolver.ts
├── src/targets/target-registry.ts
├── src/commands/root-command-router.ts
└── src/cliproxy/executor/index.ts

src/web-server/index.ts
├── src/web-server/routes/index.ts
├── src/web-server/middleware/auth-middleware.ts
├── src/web-server/websocket.ts
└── src/cliproxy/sync/auto-sync-watcher.ts

src/cliproxy/executor/index.ts
├── src/cliproxy/service-manager.ts
├── src/cliproxy/config/generator.ts
├── src/cliproxy/binary-manager.ts
├── src/cliproxy/auth/auth-handler.ts
└── src/cliproxy/accounts/account-manager.ts

src/config/unified-config-loader.ts
├── src/config/schemas/unified-config.ts
├── src/config/migration-manager.ts
└── src/utils/config-manager.ts
```
