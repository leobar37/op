# CLIProxy Integration in CCS

## Overview

CLIProxy (CLIProxyAPI) is an external Go binary that CCS orchestrates to bridge Claude Code with non-Anthropic providers. It translates Anthropic API requests into provider-specific protocols (Google Gemini, OpenAI Codex, Antigravity, etc.) and manages OAuth authentication, quota rotation, and model routing.

**Upstream Repository:** [github.com/router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)  
**Community Fork:** [github.com/kaitranntt/CLIProxyAPIPlus](https://github.com/kaitranntt/CLIProxyAPIPlus) (opt-in via `backend: plus`)

---

## Architecture

```
User runs: ccs gemini "write a script"

    |
    v
+---------------------+
|  CCS CLI (Node.js)  |
|                     |
| 1. Detect profile   |
| 2. Check OAuth auth |
| 3. Generate config  |
| 4. Spawn CLIProxy   |
| 5. Build env vars   |
| 6. Spawn Claude CLI |
+---------------------+
    |
    v
+---------------------+
|  CLIProxy Binary    |
|  (Go, port 8317)    |
|                     |
| - Reads config.yaml |
| - Uses OAuth tokens |
| - Routes by model   |
| - Translates API    |
+---------------------+
    |
    v
+---------------------+
|   Google/Gemini     |
|   (or other API)    |
+---------------------+
```

---

## Integration Components

### 1. Binary Manager (`src/cliproxy/binary-manager.ts`)

Downloads and manages the CLIProxy binary from GitHub releases:

| Method | Description |
|--------|-------------|
| `ensureCLIProxyBinary()` | Downloads if missing, returns path |
| `isCLIProxyInstalled()` | Checks if binary exists |
| `getCLIProxyPath()` | Returns binary path |
| `checkCliproxyUpdate()` | Checks for new releases |
| `installCliproxyVersion()` | Installs specific version |

**Binary locations:**
- Original: `~/.ccs/bin/original/cliproxy`
- Plus fork: `~/.ccs/bin/plus/cliproxy`

### 2. Config Generator (`src/cliproxy/config/generator.ts`)

Generates `config.yaml` for CLIProxy. Key sections:

```yaml
port: 8317
api-keys:
  - "ccs-internal-managed"
auth-dir: "/Users/xxx/.ccs/cliproxy/auth"
routing:
  strategy: round-robin
  session-affinity: false
quota-exceeded:
  switch-project: true
remote-management:
  allow-remote: true
  secret-key: "ccs"
  disable-control-panel: false
oauth-model-alias:
  antigravity:
    - name: claude-sonnet-4-6
      alias: claude-sonnet-4-6
      fork: true
```

### 3. Environment Builder (`src/cliproxy/config/env-builder.ts`)

Constructs env vars injected into Claude CLI:

```typescript
// For local CLIProxy (per-provider routing)
ANTHROPIC_BASE_URL: `http://127.0.0.1:8317/api/provider/${provider}`
ANTHROPIC_AUTH_TOKEN: "ccs-internal-managed"
ANTHROPIC_MODEL: "gemini-2.5-pro-preview"

// For composite variants (model-based routing)
ANTHROPIC_BASE_URL: `http://127.0.0.1:8317`  // root URL
```

### 4. Service Manager (`src/cliproxy/service-manager.ts`)

Manages persistent background CLIProxy instance for the dashboard:

```typescript
interface ServiceStartResult {
  started: boolean;
  alreadyRunning: boolean;
  port: number;
  configRegenerated?: boolean;
  error?: string;
}

await ensureCliproxyService(8317, verbose);
```

Features:
- Startup lock (prevents race conditions)
- Token refresh worker
- Port health checks
- Session registration

### 5. Executor (`src/cliproxy/executor/index.ts`)

Full execution orchestrator for per-session CLIProxy:

1. **Proxy config resolution** (local vs remote)
2. **Binary preparation** (download if needed)
3. **OAuth authentication** (browser or headless)
4. **Model configuration** (per-provider defaults)
5. **Proxy spawn/join** (reuse existing or start new)
6. **Proxy chain setup** (HTTPS tunnel, tool sanitization, Codex reasoning)
7. **Claude CLI spawn** with injected env vars

---

## CLIProxy API Endpoints

### Anthropic-Compatible Endpoints

These are the endpoints Claude CLI calls. CLIProxy translates them to provider APIs.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/provider/{provider}/v1/messages` | POST | Main chat completions endpoint |
| `/api/provider/{provider}/v1/models` | GET | List available models |

**Providers:** `gemini`, `codex`, `agy`, `qwen`, `kiro`, `gitlab`, `iflow`, `cursor`

### Management API (`/v0/management/*`)

Requires `Authorization: Bearer {managementKey}` header.

#### Health & Status

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /` | - | Root endpoint (liveness check, no auth) |
| `GET /v0/management/claude-api-key` | GET | Health check + list API keys |

#### Usage Statistics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v0/management/usage` | GET | Usage statistics by provider/model |
| `GET /v0/management/auth-files` | GET | List authenticated accounts |
| `GET /v0/management/request-error-logs` | GET | List error log files |
| `GET /v0/management/request-error-logs/{name}` | GET | Download error log content |

#### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v0/management/{provider}-auth-url` | GET | Get OAuth URL for provider |
| `POST /v0/management/oauth-callback` | POST | Submit OAuth callback |
| `GET /v0/management/get-auth-status?state={state}` | GET | Poll OAuth status |

**Provider auth URL prefixes:**
- `gemini-cli-auth-url`
- `codex-auth-url`
- `antigravity-auth-url`
- `github-auth-url` (for ghcp)
- `kiro-auth-url`
- `gitlab-auth-url`

#### Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v0/management/routing/strategy` | GET | Get routing strategy |
| `PUT /v0/management/routing/strategy` | PUT | Set routing strategy |
| `GET /v0/management/model-definitions/{channel}` | GET | Get model catalog for channel |
| `GET /v0/management/auth-files/fields` | GET | Get auth file field metadata |
| `PATCH /v0/management/auth-files/fields` | PATCH | Update auth file fields |
| `GET /v0/management/auth-files/download?name={name}` | GET | Download auth file |

#### API Key Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /v0/management/claude-api-key` | GET | List all Claude API keys |
| `PUT /v0/management/claude-api-key` | PUT | Replace all keys |
| `PATCH /v0/management/claude-api-key` | PATCH | Update single key |
| `DELETE /v0/management/claude-api-key?api-key={key}` | DELETE | Remove key |

### OpenAI-Compatible Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/models` | GET | List models (OpenAI format) |
| `/v1/chat/completions` | POST | Chat completions |

---

## Data Flow

### Local Mode (Default)

```
Claude CLI
  |-- POST /api/provider/gemini/v1/messages
  |-- Authorization: Bearer ccs-internal-managed
  v
CLIProxy @ localhost:8317
  |-- Routes to /api/provider/gemini
  |-- Reads OAuth token from ~/.ccs/cliproxy/auth/gemini/
  |-- Translates Anthropic -> Gemini API
  v
Google Gemini API
```

### Remote Mode

```
Claude CLI
  |-- POST /v1/messages (no /api/provider prefix)
  v
CLIProxy @ remote.example.com:8317
  |-- Uses remote management key for auth
  |-- Routes by model name in request body
  v
Provider API
```

### Composite Variant Mode

```
Claude CLI
  |-- POST /v1/messages
  |-- ANTHROPIC_MODEL = "claude-opus-4.5"
  v
CLIProxy @ localhost:8317
  |-- Root URL (no /api/provider path)
  |-- Routes by model name to tier provider
  |-- opus -> gemini, sonnet -> codex, haiku -> agy
  v
Multiple provider APIs
```

---

## Proxy Chain Architecture

For complex scenarios, CCS chains multiple proxies:

```
Claude CLI
  |
  v
[ToolSanitizationProxy]  (fixes tool names for Gemini 64-char limit)
  |-- Port: dynamic
  |
  v
[CodexReasoningProxy]    (handles --effort for Codex)
  |-- Port: dynamic
  |-- Strips /api/provider/codex prefix for remote
  |
  v
[HttpsTunnelProxy]       (tunnel to remote proxy)
  |-- Port: dynamic
  |
  v
[CLIProxyAPI]            (main proxy)
  |-- Port: 8317
  |
  v
Provider API
```

---

## Authentication Flow

### OAuth (Browser-based)

```
1. User runs: ccs gemini --auth
2. CCS fetches auth URL from CLIProxy:
   GET /v0/management/gemini-cli-auth-url?is_webui=true
3. Browser opens to OAuth consent page
4. User approves, callback to localhost:{port}
5. CCS submits callback to CLIProxy:
   POST /v0/management/oauth-callback
6. CLIProxy stores token in ~/.ccs/cliproxy/auth/gemini/
```

### Headless (SSH/No Display)

```
1. User runs: ccs gemini --auth --headless
2. CCS fetches auth URL
3. URL printed to terminal for manual copy-paste
4. User pastes callback URL
5. CCS submits to CLIProxy
```

### Device Code Flow

```
1. CLIProxy returns device code + verification URL
2. User opens URL on another device
3. Poll /v0/management/get-auth-status?state={state}
4. Token stored on success
```

---

## Configuration

### Unified Config (`~/.ccs/config.yaml`)

```yaml
cliproxy:
  backend: original          # or "plus" for community fork
  logging:
    enabled: false
    request_log: false
  routing:
    strategy: round-robin    # or fill-first
    session_affinity: false
    session_affinity_ttl: "1h"

cliproxy_server:
  remote:
    enabled: false
    host: ""
    port: 8317
    protocol: http
    auth_token: ""
    management_key: ""
    timeout: 2000
  local:
    port: 8317
    auto_start: true
```

### Provider Variants

```yaml
cliproxy:
  variants:
    my-gemini:
      provider: gemini
      model: gemini-2.5-pro
      port: 8318
```

---

## Dashboard Integration

The CCS web dashboard (`ccs config`) requires CLIProxy running for:

| Feature | Endpoint Used |
|---------|--------------|
| Live Auth Monitor | `/v0/management/auth-files` |
| Usage Analytics | `/v0/management/usage` |
| Model Catalog | `/v1/models` |
| OAuth Flows | `/v0/management/*-auth-url` |
| Error Logs | `/v0/management/request-error-logs` |
| Routing Control | `/v0/management/routing/strategy` |

---

## Commands

```bash
# Authentication
ccs gemini --auth              # Authenticate with browser
ccs gemini --auth --headless   # Authenticate without browser
ccs gemini --logout            # Remove auth
ccs gemini --accounts          # List accounts
ccs gemini --use <nickname>    # Switch account

# Configuration
ccs gemini --config            # Configure model
ccs cliproxy status            # Check proxy status
ccs cliproxy update            # Update binary
ccs cliproxy backend plus      # Switch to Plus fork

# Proxy management
ccs proxy start gemini         # Start proxy manually
ccs proxy stop                 # Stop proxy
ccs proxy activate             # Export env vars

# Dashboard
ccs config                     # Open web dashboard
```

---

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| `Connection refused` | CLIProxy not running | Run `ccs doctor --fix` |
| `Auth failed` | Invalid management key | Check `config.yaml` |
| `DNS failed` | Remote host unreachable | Check network/hostname |
| `Timeout` | Slow proxy response | Increase timeout in config |
| `Quota exceeded` | Rate limited | CLIProxy auto-switches account |

---

## File Structure

```
~/.ccs/
├── bin/
│   ├── original/
│   │   └── cliproxy           # CLIProxy binary
│   └── plus/
│       └── cliproxy           # Plus fork binary
├── cliproxy/
│   ├── config.yaml            # Generated CLIProxy config
│   ├── auth/
│   │   ├── gemini/
│   │   │   └── token-*.json   # OAuth tokens
│   │   ├── codex/
│   │   └── agy/
│   └── logs/                  # Request logs (if enabled)
└── gemini.settings.json       # Provider-specific env vars
```

---

## Related Documentation

- [CLIProxyAPI GitHub](https://github.com/router-for-me/CLIProxyAPI)
- [CLIProxyAPI Management Center](https://github.com/router-for-me/Cli-Proxy-API-Management-Center)
- [CLIProxyAPI Docs](https://help.router-for.me/)
